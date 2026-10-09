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
      joiningDate: '2026-06-02',
      monthlyFeePaise: 150000,
      ...overrides,
    })
    .expect(201)
  return response.body.member as { id: string; memberId: string }
}

async function findPayment(memberRef: string, month: string) {
  const response = await session.agent
    .get(`/api/admin/payments?month=${month}&search=${memberRef}`)
    .expect(200)
  return response.body.items.find((item: { memberRef: string }) => item.memberRef === memberRef)
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

describe('dashboard', () => {
  it('returns meaningful empty states with zero metrics', async () => {
    const response = await session.agent
      .get('/api/admin/dashboard?month=2026-06')
      .expect(200)
    expect(response.body.metrics.totalActiveMembers).toBe(0)
    expect(response.body.metrics.expectedMonthlyFeesPaise).toBe(0)
    expect(response.body.metrics.collectionsThisMonthPaise).toBe(0)
    expect(response.body.recentMembers).toEqual([])
    expect(response.body.recentPayments).toEqual([])
    expect(response.body.overdueMembers).toEqual([])
    expect(response.body.monthlyTrend).toHaveLength(6)
  })

  it('computes real database-backed metrics', async () => {
    const alice = await addMember({
      fullName: 'Alice',
      phone: '9000000001',
      joiningDate: '2026-06-02',
      monthlyFeePaise: 150000,
    })
    await addMember({
      fullName: 'Bob',
      phone: '9000000002',
      joiningDate: '2026-01-10',
      monthlyFeePaise: 150000,
    })

    await session.agent
      .post('/api/admin/payments/generate-month')
      .set('x-csrf-token', session.csrf)
      .send({ billingMonth: '2026-06', dueDate: '2026-06-10' })
      .expect(201)

    const alicePayment = await findPayment(alice.memberId, '2026-06')
    await session.agent
      .post(`/api/admin/payments/${alicePayment.id}/entries`)
      .set('x-csrf-token', session.csrf)
      .send({ method: 'cash', paymentDate: '2026-06-05', amountPaise: 150000 })
      .expect(201)

    const response = await session.agent
      .get('/api/admin/dashboard?month=2026-06')
      .expect(200)
    const metrics = response.body.metrics

    expect(metrics.totalActiveMembers).toBe(2)
    expect(metrics.newMembersThisMonth).toBe(1)
    expect(metrics.expectedMonthlyFeesPaise).toBe(300000)
    expect(metrics.collectionsThisMonthPaise).toBe(150000)
    expect(metrics.outstandingPaymentsPaise).toBe(150000)
    expect(metrics.overduePaymentsPaise).toBe(150000)
    expect(response.body.statusOverview.paid).toBe(1)
    expect(response.body.statusOverview.overdue).toBe(1)
    expect(response.body.recentMembers).toHaveLength(2)
    expect(response.body.recentPayments).toHaveLength(1)
    expect(response.body.overdueMembers).toHaveLength(1)
    expect(response.body.overdueMembers[0].memberId).toBe('RBF-0002')
  })
})
