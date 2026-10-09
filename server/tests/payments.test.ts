import type { Express } from 'express'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import {
  clearDatabase,
  createAdmin,
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
      monthlyFeePaise: 150000,
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
    .send({ method: 'cash', paymentDate: '2026-06-05', amountPaise: 150000, ...body })
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

describe('monthly billing generation', () => {
  it('bills eligible members only and never duplicates bills', async () => {
    await addMember({ fullName: 'Alice', phone: '9000000001', joiningDate: '2026-01-15' })
    await addMember({ fullName: 'Bob', phone: '9000000002', joiningDate: '2026-06-30' })
    await addMember({ fullName: 'Future', phone: '9000000003', joiningDate: '2026-07-01' })

    const first = await generate('2026-06', '2026-06-10')
    expect(first.eligible).toBe(2)
    expect(first.created).toBe(2)
    expect(first.existing).toBe(0)

    const second = await generate('2026-06', '2026-06-10')
    expect(second.created).toBe(0)
    expect(second.existing).toBe(2)
  })

  it('does not bill inactive members', async () => {
    const member = await addMember()
    await session.agent
      .post(`/api/admin/members/${member.id}/deactivate`)
      .set('x-csrf-token', session.csrf)
      .expect(200)
    const summary = await generate('2026-06', '2026-06-10')
    expect(summary.created).toBe(0)
  })

  it('snapshots the fee and preserves old bills when the fee changes', async () => {
    const member = await addMember({ monthlyFeePaise: 150000 })
    await generate('2026-06', '2026-06-10')
    await session.agent
      .patch(`/api/admin/members/${member.id}`)
      .set('x-csrf-token', session.csrf)
      .send({ monthlyFeePaise: 200000 })
      .expect(200)

    const june = await findPayment(member.memberId, '2026-06')
    expect(june.dueAmountPaise).toBe(150000)

    await generate('2026-07', '2026-07-10')
    const july = await findPayment(member.memberId, '2026-07')
    expect(july.dueAmountPaise).toBe(200000)
  })
})

describe('payment recording', () => {
  it('records a full payment and marks the bill paid', async () => {
    const member = await addMember()
    await generate('2026-06', '2026-06-10')
    const payment = await findPayment(member.memberId, '2026-06')
    const updated = await record(payment.id, { amountPaise: payment.dueAmountPaise })
    expect(updated.status).toBe('paid')
    expect(updated.balancePaise).toBe(0)
    expect(updated.amountPaidPaise).toBe(150000)
  })

  it('supports partial payments and multiple installments', async () => {
    const member = await addMember()
    await generate('2026-06', '2027-06-10')
    const payment = await findPayment(member.memberId, '2026-06')

    const first = await record(payment.id, { amountPaise: 50000 })
    expect(first.status).toBe('partial')
    expect(first.balancePaise).toBe(100000)

    const second = await record(payment.id, {
      amountPaise: 100000,
      paymentDate: '2026-06-20',
      method: 'upi',
    })
    expect(second.status).toBe('paid')
    expect(second.balancePaise).toBe(0)
    expect(second.paymentEntries).toHaveLength(2)
  })

  it('rejects overpayments and non-positive amounts', async () => {
    const member = await addMember()
    await generate('2026-06', '2026-06-10')
    const payment = await findPayment(member.memberId, '2026-06')

    await session.agent
      .post(`/api/admin/payments/${payment.id}/entries`)
      .set('x-csrf-token', session.csrf)
      .send({ method: 'cash', paymentDate: '2026-06-05', amountPaise: 200000 })
      .expect(422)

    await session.agent
      .post(`/api/admin/payments/${payment.id}/entries`)
      .set('x-csrf-token', session.csrf)
      .send({ method: 'cash', paymentDate: '2026-06-05', amountPaise: 0 })
      .expect(422)
  })

  it('derives an overdue status from the due date and balance', async () => {
    const member = await addMember()
    await generate('2026-06', '2026-06-10')
    const payment = await findPayment(member.memberId, '2026-06')
    expect(payment.status).toBe('overdue')

    const detail = await session.agent
      .get(`/api/admin/payments/${payment.id}`)
      .expect(200)
    expect(detail.body.payment.status).toBe('overdue')

    const filtered = await session.agent
      .get('/api/admin/payments?month=2026-06&status=overdue')
      .expect(200)
    expect(filtered.body.items).toHaveLength(1)
  })

  it('records collections by payment date, not billing month', async () => {
    const member = await addMember()
    await generate('2026-06', '2026-06-10')
    const payment = await findPayment(member.memberId, '2026-06')
    await record(payment.id, { amountPaise: 150000, paymentDate: '2026-07-05' })

    const june = await session.agent
      .get('/api/admin/dashboard?month=2026-06')
      .expect(200)
    expect(june.body.metrics.collectionsThisMonthPaise).toBe(0)

    const july = await session.agent
      .get('/api/admin/dashboard?month=2026-07')
      .expect(200)
    expect(july.body.metrics.collectionsThisMonthPaise).toBe(150000)
  })
})

describe('payment corrections', () => {
  it('voids a mistaken entry, recomputes the balance and keeps history', async () => {
    const member = await addMember()
    await generate('2026-06', '2026-06-10')
    const payment = await findPayment(member.memberId, '2026-06')
    const recorded = await record(payment.id, { amountPaise: 150000 })
    expect(recorded.status).toBe('paid')

    const entryId = (recorded.paymentEntries as { id: string }[])[0].id
    const corrected = await session.agent
      .post(`/api/admin/payments/${payment.id}/corrections`)
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
      .post(`/api/admin/payments/${payment.id}/corrections`)
      .set('x-csrf-token', session.csrf)
      .send({ entryId, reason: 'Double correction attempt' })
      .expect(409)
  })
})
