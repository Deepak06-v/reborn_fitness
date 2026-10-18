import type { Express } from 'express'
import request from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import {
  clearDatabase,
  createAdmin,
  istDay,
  istDayOf,
  loadApp,
  loginAgent,
  setupTestEnv,
  teardownTestEnv,
  TEST_ADMIN,
  type AuthedAgent,
} from './helpers/setup'

let app: Express
let session: AuthedAgent

async function addMember(overrides: Record<string, unknown> = {}) {
  const response = await session.agent
    .post('/api/admin/members')
    .set('x-csrf-token', session.csrf)
    .send({
      fullName: 'Alice Kumar',
      phone: '9876543210',
      joiningDate: '2026-01-15',
      planId: 'monthly',
      ...overrides,
    })
    .expect(201)
  return response.body.member as { id: string; memberId: string }
}

async function memberPayments(id: string) {
  const response = await session.agent.get(`/api/admin/members/${id}`).expect(200)
  return response.body.payments as Array<{
    billingMonth: string
    invoiceNumber: string | null
    durationMonths: number | null
    periodStart: string
    periodEnd: string
    dueDate: string
    dueAmountPaise: number
    amountPaidPaise: number
    balancePaise: number
    status: string
    dueState: string
  }>
}

async function findPayment(memberRef: string, month: string) {
  const response = await session.agent
    .get(`/api/admin/payments?month=${month}&search=${memberRef}`)
    .expect(200)
  return response.body.items.find((item: { memberRef: string }) => item.memberRef === memberRef)
}

async function record(
  paymentId: string,
  body: Record<string, unknown> = {},
): Promise<Record<string, unknown>> {
  const response = await session.agent
    .post(`/api/admin/payments/${paymentId}/entries`)
    .set('x-csrf-token', session.csrf)
    .send({ method: 'cash', paymentDate: '2026-06-05', amountPaise: 100000, ...body })
    .expect(201)
  return response.body.payment
}

beforeAll(async () => {
  await setupTestEnv()
  app = await loadApp()
})

afterAll(async () => {
  await teardownTestEnv()
})

beforeEach(async () => {
  await clearDatabase()
  await createAdmin()
  session = await loginAgent(app, TEST_ADMIN.username, TEST_ADMIN.password)
})

describe('automatic period billing', () => {
  it('auto-creates the first period bill when a member is created', async () => {
    const member = await addMember({ joiningDate: '2026-01-15' })
    const jan = await findPayment(member.memberId, '2026-01')
    expect(jan).toBeTruthy()
    expect(jan.dueAmountPaise).toBe(100000)
    expect(jan.invoiceNumber).toMatch(/^RBF-INV-\d{4}$/)
    expect(istDayOf(jan.periodStart)).toBe('2026-01-15')
    expect(istDayOf(jan.periodEnd)).toBe('2026-02-15')
    expect(istDayOf(jan.dueDate)).toBe('2026-01-15')
    // Creation never records payment: a past-due unpaid bill reads as overdue.
    expect(jan.status).toBe('overdue')
    expect(jan.dueState).toBe('overdue')
    expect(jan.balancePaise).toBe(100000)
  })

  it('creates each recurring period exactly once (idempotent)', async () => {
    const member = await addMember({ joiningDate: istDay(-95) })
    const first = await memberPayments(member.id)
    expect(first.length).toBeGreaterThanOrEqual(4)
    const months = first.map((payment) => payment.billingMonth)
    expect(new Set(months).size).toBe(months.length)

    const second = await memberPayments(member.id)
    expect(second.length).toBe(first.length)
  })

  it('bills a multi-month plan once for the whole period', async () => {
    const member = await addMember({ joiningDate: '2026-05-10', planId: 'six-months' })
    const may = await findPayment(member.memberId, '2026-05')
    expect(may.dueAmountPaise).toBe(500000)
    expect(may.durationMonths).toBe(6)
    expect(istDayOf(may.periodEnd)).toBe('2026-11-10')

    // The next six-month period starts in November, so no extra bill exists yet.
    const payments = await memberPayments(member.id)
    expect(payments).toHaveLength(1)
  })

  it('keeps the joining day as the cycle anchor across short months', async () => {
    const member = await addMember({ joiningDate: '2026-01-31' })
    const payments = await memberPayments(member.id)
    const feb = payments.find((payment) => payment.billingMonth === '2026-02')
    const mar = payments.find((payment) => payment.billingMonth === '2026-03')
    expect(feb).toBeTruthy()
    expect(mar).toBeTruthy()
    // February has no 31st, so it clamps to the 28th; March resumes on the 31st.
    expect(istDayOf(feb!.periodStart)).toBe('2026-02-28')
    expect(istDayOf(mar!.periodStart)).toBe('2026-03-31')
  })

  it('does not bill an inactive member any further', async () => {
    const member = await addMember({ joiningDate: istDay(-95) })
    await session.agent
      .post(`/api/admin/members/${member.id}/deactivate`)
      .set('x-csrf-token', session.csrf)
      .expect(200)
    const payments = await memberPayments(member.id)
    expect(payments).toHaveLength(1)
  })

  it('snapshots each period price so a plan change never rewrites history', async () => {
    const member = await addMember({ joiningDate: '2026-01-15' })
    await memberPayments(member.id)

    await session.agent
      .patch(`/api/admin/members/${member.id}`)
      .set('x-csrf-token', session.csrf)
      .send({ planId: 'yearly' })
      .expect(200)

    const after = await memberPayments(member.id)
    // Every already-issued monthly period keeps its original price.
    for (const payment of after) {
      expect(payment.dueAmountPaise).toBe(100000)
      expect(payment.durationMonths).toBe(1)
    }
  })

  it('never exposes manual bill generation', async () => {
    await session.agent
      .post('/api/admin/payments/generate-month')
      .set('x-csrf-token', session.csrf)
      .send({ billingMonth: '2026-03', dueDate: '2026-03-10' })
      .expect(404)
  })

  it('requires authentication for billing lists and export', async () => {
    await request(app).get('/api/admin/payments').expect(401)
    await request(app).get('/api/admin/payments/export').expect(401)
  })
})

describe('payment recording', () => {
  it('records a full payment and marks the bill paid', async () => {
    const member = await addMember()
    const bill = await findPayment(member.memberId, '2026-01')
    const updated = await record(bill.id, { amountPaise: bill.dueAmountPaise })
    expect(updated.status).toBe('paid')
    expect(updated.dueState).toBe('paid')
    expect(updated.balancePaise).toBe(0)
    expect(updated.amountPaidPaise).toBe(100000)
  })

  it('supports partial payments and multiple installments', async () => {
    // A future-due bill so the balance reads as "partial" rather than "overdue".
    const member = await addMember({ joiningDate: istDay(20) })
    const bill = await findPayment(member.memberId, istDay(20).slice(0, 7))

    const first = await record(bill.id, { amountPaise: 40000, paymentDate: istDay() })
    expect(first.status).toBe('partial')
    expect(first.balancePaise).toBe(60000)

    const second = await record(bill.id, {
      amountPaise: 60000,
      paymentDate: istDay(1),
      method: 'upi',
    })
    expect(second.status).toBe('paid')
    expect(second.balancePaise).toBe(0)
    expect(second.paymentEntries).toHaveLength(2)
  })

  it('rejects overpayments and non-positive amounts', async () => {
    const member = await addMember()
    const bill = await findPayment(member.memberId, '2026-01')

    await session.agent
      .post(`/api/admin/payments/${bill.id}/entries`)
      .set('x-csrf-token', session.csrf)
      .send({ method: 'cash', paymentDate: '2026-01-05', amountPaise: 200000 })
      .expect(422)

    await session.agent
      .post(`/api/admin/payments/${bill.id}/entries`)
      .set('x-csrf-token', session.csrf)
      .send({ method: 'cash', paymentDate: '2026-01-05', amountPaise: 0 })
      .expect(422)
  })

  it('colour-codes due state as unpaid, due_soon and overdue', async () => {
    const unpaid = await addMember({ phone: '9000000101', joiningDate: istDay(10) })
    const dueSoon = await addMember({ phone: '9000000102', joiningDate: istDay(-26) })
    const overdue = await addMember({ phone: '9000000103', joiningDate: istDay(-40) })

    const futureBill = await findPayment(unpaid.memberId, istDay(10).slice(0, 7))
    const soonBill = await findPayment(dueSoon.memberId, istDay(-26).slice(0, 7))
    const pastBill = await findPayment(overdue.memberId, istDay(-40).slice(0, 7))

    expect(futureBill.dueState).toBe('unpaid')
    expect(soonBill.dueState).toBe('due_soon')
    expect(pastBill.dueState).toBe('overdue')
    expect(pastBill.status).toBe('overdue')
  })

  it('records collections by payment date, not billing month', async () => {
    const member = await addMember({ joiningDate: '2026-06-02' })
    const bill = await findPayment(member.memberId, '2026-06')
    await record(bill.id, { amountPaise: 100000, paymentDate: '2026-07-05' })

    const june = await session.agent
      .get('/api/admin/dashboard?month=2026-06')
      .expect(200)
    expect(june.body.metrics.collectionsThisMonthPaise).toBe(0)

    const july = await session.agent
      .get('/api/admin/dashboard?month=2026-07')
      .expect(200)
    expect(july.body.metrics.collectionsThisMonthPaise).toBe(100000)
  })
})

describe('payment corrections', () => {
  it('voids a mistaken entry, recomputes the balance and keeps history', async () => {
    const member = await addMember({ joiningDate: istDay(-40) })
    const bill = await findPayment(member.memberId, istDay(-40).slice(0, 7))
    const recorded = await record(bill.id, { amountPaise: bill.dueAmountPaise })
    expect(recorded.status).toBe('paid')

    const entryId = (recorded.paymentEntries as { id: string }[])[0].id
    const corrected = await session.agent
      .post(`/api/admin/payments/${bill.id}/corrections`)
      .set('x-csrf-token', session.csrf)
      .send({ entryId, reason: 'Recorded against the wrong member' })
      .expect(200)

    expect(corrected.body.payment.amountPaidPaise).toBe(0)
    expect(corrected.body.payment.status).toBe('overdue')
    const entries = corrected.body.payment.paymentEntries as {
      voided: boolean
      voidReason: string
    }[]
    expect(entries).toHaveLength(1)
    expect(entries[0].voided).toBe(true)
    expect(entries[0].voidReason).toBe('Recorded against the wrong member')

    await session.agent
      .post(`/api/admin/payments/${bill.id}/corrections`)
      .set('x-csrf-token', session.csrf)
      .send({ entryId, reason: 'Double correction attempt' })
      .expect(409)
  })

  it('forbids staff from voiding payment entries (403)', async () => {
    await createAdmin('staff_pay', 'staff-pass-123', 'staff')
    const member = await addMember({ joiningDate: istDay(-30) })
    const bill = await findPayment(member.memberId, istDay(-30).slice(0, 7))
    const recorded = await record(bill.id, { amountPaise: 50000 })
    const entryId = (recorded.paymentEntries as { id: string }[])[0].id

    const { agent: staffAgent, csrf: staffCsrf } = await loginAgent(
      app,
      'staff_pay',
      'staff-pass-123',
    )
    const res = await staffAgent
      .post(`/api/admin/payments/${bill.id}/corrections`)
      .set('x-csrf-token', staffCsrf)
      .send({ entryId, reason: 'Mistake' })
      .expect(403)
    expect(res.body.error.message).toMatch(/Owner authorization required/)
  })

  it('forbids admin (Staff) role from voiding payment entries (403)', async () => {
    // KEY TEST: 'admin' role must be Staff, not Owner. Before the fix, 'admin' could void payments.
    await createAdmin('admin_pay', 'admin-pass-123', 'admin')
    const member = await addMember({ joiningDate: istDay(-30) })
    const bill = await findPayment(member.memberId, istDay(-30).slice(0, 7))
    const recorded = await record(bill.id, { amountPaise: 50000 })
    const entryId = (recorded.paymentEntries as { id: string }[])[0].id

    const { agent: adminAgent, csrf: adminCsrf } = await loginAgent(
      app,
      'admin_pay',
      'admin-pass-123',
    )
    const res = await adminAgent
      .post(`/api/admin/payments/${bill.id}/corrections`)
      .set('x-csrf-token', adminCsrf)
      .send({ entryId, reason: 'Mistake' })
      .expect(403)
    expect(res.body.error.message).toMatch(/Owner authorization required/)
  })
})

describe('payments CSV export', () => {
  it('exports every billing period with the full column set and correct escaping', async () => {
    await addMember({ fullName: 'Doe, John "JD"', phone: '9000000301', joiningDate: '2026-01-31' })

    const response = await session.agent.get('/api/admin/payments/export').expect(200)
    expect(response.headers['content-disposition']).toMatch(
      /reborn-fitness-payments-\d{4}-\d{2}-\d{2}\.csv/,
    )
    const [header, ...rows] = response.text.split('\r\n')
    expect(header).toBe(
      [
        'Member Name',
        'Member ID',
        'Phone',
        'Plan',
        'Joining Date',
        'Period Start',
        'Period End',
        'Due Date',
        'Invoice Number',
        'Amount Due (INR)',
        'Amount Paid (INR)',
        'Outstanding (INR)',
        'Status',
        'Last Payment Date',
        'Last Payment Method',
      ].join(','),
    )
    expect(rows.length).toBeGreaterThanOrEqual(1)
    // Commas and quotes in a value are escaped per RFC 4180.
    expect(response.text).toContain('"Doe, John ""JD"""')
    // Money is exported as a fixed 2-decimal rupee amount (100000 paise = 1000.00).
    expect(rows[0]).toContain('1000.00')
  })
})
