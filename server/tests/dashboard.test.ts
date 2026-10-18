import type { Express } from 'express'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import {
  clearDatabase,
  createAdmin,
  istDay,
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
      planId: 'monthly',
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
    // Member joining 40 days ago (periodEnd is past, so overdue)
    const alice = await addMember({
      fullName: 'Alice',
      phone: '9000000001',
      joiningDate: istDay(-40),
    })
    const bob = await addMember({
      fullName: 'Bob',
      phone: '9000000002',
      joiningDate: istDay(-40),
    })

    const alicePayment = await findPayment(alice.memberId, istDay(-40).slice(0, 7))
    await session.agent
      .post(`/api/admin/payments/${alicePayment.id}/entries`)
      .set('x-csrf-token', session.csrf)
      .send({ method: 'cash', paymentDate: istDay(-30), amountPaise: 100000 })
      .expect(201)

    const billMonth = istDay(-40).slice(0, 7)
    const response = await session.agent
      .get(`/api/admin/dashboard?month=${billMonth}`)
      .expect(200)
    const metrics = response.body.metrics

    expect(metrics.totalActiveMembers).toBe(2)
    expect(response.body.statusOverview.paid).toBe(1)
    expect(response.body.statusOverview.overdue).toBe(1)
    expect(response.body.recentMembers).toHaveLength(2)
    expect(response.body.recentPayments).toHaveLength(1)
    expect(response.body.overdueMembers).toHaveLength(1)
    expect(response.body.overdueMembers[0].memberId).toBe(bob.memberId)
  })

  it('maintains strict consistency between Dashboard overdue members and Payments overdue filter', async () => {
    // Create an overdue member (joined 45 days ago, unpaid)
    const overdueMember = await addMember({
      fullName: 'Overdue John',
      phone: '9888888881',
      joiningDate: istDay(-45),
    })

    // Create a due-soon member (joined 25 days ago, 1-month plan -> due in ~5 days)
    await addMember({
      fullName: 'Due Soon Sarah',
      phone: '9888888882',
      joiningDate: istDay(-25),
    })

    const currentMonthVal = istDay().slice(0, 7)

    // 1. Fetch dashboard
    const dashRes = await session.agent
      .get(`/api/admin/dashboard?month=${currentMonthVal}`)
      .expect(200)

    const dashOverdueMembers = dashRes.body.overdueMembers as Array<{ memberId: string }>
    const dashOverdueCount = dashRes.body.metrics.overdueCount as number

    expect(dashOverdueCount).toBeGreaterThanOrEqual(1)
    expect(dashOverdueMembers.some((m) => m.memberId === overdueMember.memberId)).toBe(true)

    // 2. Fetch payments list filtered by status=overdue (all months / combined view)
    const paymentsRes = await session.agent
      .get('/api/admin/payments?status=overdue')
      .expect(200)

    expect(paymentsRes.body.items.length).toBeGreaterThanOrEqual(1)
    const matchingInPayments = paymentsRes.body.items.find(
      (item: { memberRef: string }) => item.memberRef === overdueMember.memberId,
    )
    expect(matchingInPayments).toBeTruthy()
    expect(matchingInPayments.status).toBe('overdue')
    expect(matchingInPayments.statusTone).toBe('danger')
    expect(matchingInPayments.statusLabel).toMatch(/Overdue by \d+ days/)

    // 3. Payments page urgent count also captures overdue items
    expect(paymentsRes.body.totals.urgentCount).toBeGreaterThanOrEqual(1)
  })
})
