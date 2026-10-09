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

async function addMember(
  overrides: Record<string, unknown> = {},
): Promise<Record<string, unknown>> {
  const response = await session.agent
    .post('/api/admin/members')
    .set('x-csrf-token', session.csrf)
    .send({
      fullName: 'Alice Kumar',
      phone: '98765 43210',
      joiningDate: '2026-01-15',
      monthlyFeePaise: 150000,
      ...overrides,
    })
    .expect(201)
  return response.body.member
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

describe('member management', () => {
  it('creates a member with a generated ID and normalized phone', async () => {
    const member = await addMember()
    expect(member.memberId).toMatch(/^RBF-\d{4}$/)
    expect(member.phone).toBe('9876543210')
    expect(member.monthlyFeePaise).toBe(150000)
    expect(member.status).toBe('active')
  })

  it('rejects invalid phone numbers', async () => {
    await session.agent
      .post('/api/admin/members')
      .set('x-csrf-token', session.csrf)
      .send({
        fullName: 'Bad Phone',
        phone: '123',
        joiningDate: '2026-01-15',
        monthlyFeePaise: 100000,
      })
      .expect(422)
  })

  it('prevents duplicate phone numbers', async () => {
    await addMember()
    await session.agent
      .post('/api/admin/members')
      .set('x-csrf-token', session.csrf)
      .send({
        fullName: 'Duplicate',
        phone: '9876543210',
        joiningDate: '2026-02-01',
        monthlyFeePaise: 100000,
      })
      .expect(409)
  })

  it('lists, searches and paginates members', async () => {
    await addMember({ fullName: 'Alice Kumar', phone: '9000000001' })
    await addMember({ fullName: 'Bob Singh', phone: '9000000002' })
    await addMember({ fullName: 'Carol Mehta', phone: '9000000003' })

    const all = await session.agent.get('/api/admin/members?limit=2&page=1').expect(200)
    expect(all.body.total).toBe(3)
    expect(all.body.items).toHaveLength(2)

    const search = await session.agent
      .get('/api/admin/members?search=Bob')
      .expect(200)
    expect(search.body.items).toHaveLength(1)
    expect(search.body.items[0].fullName).toBe('Bob Singh')
  })

  it('updates member details and monthly fee', async () => {
    const member = await addMember()
    const updated = await session.agent
      .patch(`/api/admin/members/${member.id}`)
      .set('x-csrf-token', session.csrf)
      .send({ monthlyFeePaise: 200000, fullName: 'Alice K' })
      .expect(200)
    expect(updated.body.member.monthlyFeePaise).toBe(200000)
    expect(updated.body.member.fullName).toBe('Alice K')
  })

  it('deactivates a member without deleting the record', async () => {
    const member = await addMember()
    const deactivated = await session.agent
      .post(`/api/admin/members/${member.id}/deactivate`)
      .set('x-csrf-token', session.csrf)
      .expect(200)
    expect(deactivated.body.member.status).toBe('inactive')

    const detail = await session.agent
      .get(`/api/admin/members/${member.id}`)
      .expect(200)
    expect(detail.body.member.status).toBe('inactive')
    expect(detail.body.member.memberId).toBe(member.memberId)
  })

  it('returns 404 for unknown members', async () => {
    await session.agent
      .get('/api/admin/members/64b7f9a2f1a2b3c4d5e6f7a8')
      .expect(404)
  })
})
