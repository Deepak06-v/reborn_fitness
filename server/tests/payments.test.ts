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
    const dueSoon = await addMember({ phone: '9000000102', joiningDate: istDay(5) })
    const overdue = await addMember({ phone: '9000000103', joiningDate: istDay(-10) })

    const futureBill = await findPayment(unpaid.memberId, istDay(10).slice(0, 7))
    const soonBill = await findPayment(dueSoon.memberId, istDay(5).slice(0, 7))
    const pastBill = await findPayment(overdue.memberId, istDay(-10).slice(0, 7))

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

describe('new membership plans (Monthly-1500, Monthly-2000, 15days-500)', () => {
  it('bills Monthly – ₹1,500 with a 1-month duration and 150000 paise fee', async () => {
    const member = await addMember({ joiningDate: '2026-08-10', planId: 'monthly-1500' })
    const payments = await memberPayments(member.id)
    expect(payments.length).toBeGreaterThanOrEqual(1)
    const sorted = [...payments].sort(
      (a, b) => new Date(a.periodStart).getTime() - new Date(b.periodStart).getTime(),
    )
    const first = sorted[0]
    expect(first.planId).toBe('monthly-1500')
    expect(first.planName).toBe('Monthly – ₹1,500')
    expect(first.dueAmountPaise).toBe(150000)
    expect(first.durationMonths).toBe(1)
    expect(istDayOf(first.periodStart)).toBe('2026-08-10')
    expect(istDayOf(first.periodEnd)).toBe('2026-09-10')
  })

  it('bills Monthly – ₹2,000 with a 1-month duration and 200000 paise fee', async () => {
    const member = await addMember({ joiningDate: '2026-08-10', planId: 'monthly-2000' })
    const payments = await memberPayments(member.id)
    expect(payments.length).toBeGreaterThanOrEqual(1)
    const sorted = [...payments].sort(
      (a, b) => new Date(a.periodStart).getTime() - new Date(b.periodStart).getTime(),
    )
    const first = sorted[0]
    expect(first.planId).toBe('monthly-2000')
    expect(first.planName).toBe('Monthly – ₹2,000')
    expect(first.dueAmountPaise).toBe(200000)
    expect(first.durationMonths).toBe(1)
    expect(istDayOf(first.periodStart)).toBe('2026-08-10')
    expect(istDayOf(first.periodEnd)).toBe('2026-09-10')
  })

  it('bills 15 Days – ₹500 with exactly 15 days duration and 50000 paise fee', async () => {
    const member = await addMember({ joiningDate: '2026-10-01', planId: '15days-500' })
    const payments = await memberPayments(member.id)
    expect(payments.length).toBeGreaterThanOrEqual(1)
    const sorted = [...payments].sort(
      (a, b) => new Date(a.periodStart).getTime() - new Date(b.periodStart).getTime(),
    )
    const first = sorted[0]
    expect(first.planId).toBe('15days-500')
    expect(first.planName).toBe('15 Days – ₹500')
    expect(first.dueAmountPaise).toBe(50000)
    expect(first.durationDays).toBe(15)
    expect(istDayOf(first.periodStart)).toBe('2026-10-01')
    expect(istDayOf(first.periodEnd)).toBe('2026-10-16')
    expect(istDayOf(first.dueDate)).toBe('2026-10-01')
  })

  it('generates consecutive 15-day billing periods without duplicate key collisions', async () => {
    // Joining 35 days ago should generate 3 consecutive periods:
    // Period 1: day -35 to day -20
    // Period 2: day -20 to day -5
    // Period 3: day -5 to day +10 (current period)
    const member = await addMember({ joiningDate: istDay(-35), planId: '15days-500' })
    const payments = await memberPayments(member.id)
    expect(payments.length).toBeGreaterThanOrEqual(3)

    // Sort ascending by period start
    const sorted = [...payments].sort(
      (a, b) => new Date(a.periodStart).getTime() - new Date(b.periodStart).getTime(),
    )
    for (let i = 0; i < sorted.length - 1; i += 1) {
      expect(sorted[i].dueAmountPaise).toBe(50000)
      expect(sorted[i].durationDays).toBe(15)
      // The end of one 15-day period matches the start of the next period
      expect(istDayOf(sorted[i].periodEnd)).toBe(istDayOf(sorted[i + 1].periodStart))
    }
  })

  it('calculates 15-day periods correctly across month and year boundaries', async () => {
    // Member joining Dec 20, 2026
    const member = await addMember({ joiningDate: '2026-12-20', planId: '15days-500' })
    const payments = await memberPayments(member.id)
    const first = payments[0]
    expect(istDayOf(first.periodStart)).toBe('2026-12-20')
    // Dec 20 + 15 days = Jan 04, 2027
    expect(istDayOf(first.periodEnd)).toBe('2027-01-04')
  })

  it('supports partial and full payments and overdue state for 15-day plans', async () => {
    // 1. Past-due bill: partial payment keeps status 'overdue' with reduced balance
    const overdueMember = await addMember({
      phone: '9876500001',
      joiningDate: istDay(-20),
      planId: '15days-500',
    })
    const overduePayments = await memberPayments(overdueMember.id)
    const overdueBill = overduePayments[0]
    expect(overdueBill.status).toBe('overdue')

    const partialOverdue = await record(overdueBill.id, { amountPaise: 20000 })
    expect(partialOverdue.amountPaidPaise).toBe(20000)
    expect(partialOverdue.balancePaise).toBe(30000)
    expect(partialOverdue.status).toBe('overdue')

    const paidOverdue = await record(overdueBill.id, { amountPaise: 30000 })
    expect(paidOverdue.amountPaidPaise).toBe(50000)
    expect(paidOverdue.balancePaise).toBe(0)
    expect(paidOverdue.status).toBe('paid')

    // 2. Future-due bill: partial payment sets status 'partial'
    const futureMember = await addMember({
      phone: '9876500002',
      joiningDate: istDay(5),
      planId: '15days-500',
    })
    const futurePayments = await memberPayments(futureMember.id)
    const futureBill = futurePayments[0]
    const partialFuture = await record(futureBill.id, { amountPaise: 20000, paymentDate: istDay() })
    expect(partialFuture.amountPaidPaise).toBe(20000)
    expect(partialFuture.balancePaise).toBe(30000)
    expect(partialFuture.status).toBe('partial')
  })
})
