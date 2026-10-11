import type { Express } from 'express'
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

async function generate(billingMonth: string, dueDate: string) {
  const response = await session.agent
    .post('/api/admin/payments/generate-month')
    .set('x-csrf-token', session.csrf)
    .send({ billingMonth, dueDate })
    .expect(201)
  return response.body
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

describe('plan-based period billing', () => {
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

  it('generates one bill per plan period and never duplicates', async () => {
    const member = await addMember({ joiningDate: '2026-01-15' })
    const first = await generate('2026-02', '2026-02-10')
    expect(first.created).toBe(1)

    const feb = await findPayment(member.memberId, '2026-02')
    expect(istDayOf(feb.periodStart)).toBe('2026-02-15')
    expect(istDayOf(feb.periodEnd)).toBe('2026-03-15')

    const second = await generate('2026-02', '2026-02-10')
    expect(second.created).toBe(0)
    expect(second.existing).toBeGreaterThanOrEqual(1)
  })

  it('bills a multi-month plan once for the whole period', async () => {
    const member = await addMember({ joiningDate: '2026-01-10', planId: 'six-months' })
    const jan = await findPayment(member.memberId, '2026-01')
    expect(jan.dueAmountPaise).toBe(500000)
    expect(jan.durationMonths).toBe(6)
    expect(istDayOf(jan.periodEnd)).toBe('2026-07-10')

    const tooEarly = await generate('2026-02', '2026-02-10')
    expect(tooEarly.created).toBe(0)

    const due = await generate('2026-07', '2026-07-10')
    expect(due.created).toBe(1)
    const jul = await findPayment(member.memberId, '2026-07')
    expect(istDayOf(jul.periodStart)).toBe('2026-07-10')
    expect(jul.dueAmountPaise).toBe(500000)
  })

  it('does not bill inactive members', async () => {
    const member = await addMember({ joiningDate: '2026-01-15' })
    await session.agent
      .post(`/api/admin/members/${member.id}/deactivate`)
      .set('x-csrf-token', session.csrf)
      .expect(200)
    const summary = await generate('2026-02', '2026-02-10')
    expect(summary.created).toBe(0)
  })

  it('snapshots the plan price and preserves issued bills when the plan changes', async () => {
    const member = await addMember({ joiningDate: '2026-01-15' })
    await generate('2026-02', '2026-02-10')
    await session.agent
      .patch(`/api/admin/members/${member.id}`)
      .set('x-csrf-token', session.csrf)
      .send({ planId: 'three-months' })
      .expect(200)

    const jan = await findPayment(member.memberId, '2026-01')
    const feb = await findPayment(member.memberId, '2026-02')
    expect(jan.dueAmountPaise).toBe(100000)
    expect(feb.dueAmountPaise).toBe(100000)

    await generate('2026-03', '2026-03-10')
    const mar = await findPayment(member.memberId, '2026-03')
    expect(mar.dueAmountPaise).toBe(270000)
    expect(mar.durationMonths).toBe(3)
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

  it('colour-codes due state as upcoming, due_soon and overdue', async () => {
    const upcoming = await addMember({ phone: '9000000101', joiningDate: istDay(10) })
    const dueSoon = await addMember({ phone: '9000000102', joiningDate: istDay(1) })
    const overdue = await addMember({ phone: '9000000103', joiningDate: istDay(-40) })

    const futureBill = await findPayment(upcoming.memberId, istDay(10).slice(0, 7))
    const soonBill = await findPayment(dueSoon.memberId, istDay(1).slice(0, 7))
    const pastBill = await findPayment(overdue.memberId, istDay(-40).slice(0, 7))

    expect(futureBill.dueState).toBe('upcoming')
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
})
