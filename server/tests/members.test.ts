import type { Express } from 'express'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { Member } from '../src/models/Member'
import { MonthlyPayment } from '../src/models/MonthlyPayment'
import {
  clearDatabase,
  createAdmin,
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
      planId: 'monthly',
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
  it('creates a member with a generated ID, normalized phone and plan', async () => {
    const member = await addMember()
    expect(member.memberId).toMatch(/^RBF-\d{4}$/)
    expect(member.phone).toBe('9876543210')
    expect(member.planId).toBe('monthly')
    expect(member.planName).toBe('Monthly')
    expect(member.planDurationMonths).toBe(1)
    expect(member.planPricePaise).toBe(100000)
    // The plan catalogue is authoritative, not any client-supplied fee.
    expect(member.monthlyFeePaise).toBe(100000)
    expect(member.status).toBe('active')
    expect(istDayOf(member.nextBillingDate as string)).toBe('2026-02-15')
  })

  it('ignores a client-supplied fee in favour of the plan price', async () => {
    const member = await addMember({ planId: 'six-months', monthlyFeePaise: 1 })
    expect(member.monthlyFeePaise).toBe(500000)
    expect(member.planDurationMonths).toBe(6)
  })

  it('requires a known membership plan', async () => {
    await session.agent
      .post('/api/admin/members')
      .set('x-csrf-token', session.csrf)
      .send({
        fullName: 'No Plan',
        phone: '9000000010',
        joiningDate: '2026-01-15',
      })
      .expect(422)

    await session.agent
      .post('/api/admin/members')
      .set('x-csrf-token', session.csrf)
      .send({
        fullName: 'Bad Plan',
        phone: '9000000011',
        joiningDate: '2026-01-15',
        planId: 'platinum',
      })
      .expect(422)
  })

  it('rejects invalid phone numbers', async () => {
    await session.agent
      .post('/api/admin/members')
      .set('x-csrf-token', session.csrf)
      .send({
        fullName: 'Bad Phone',
        phone: '123',
        joiningDate: '2026-01-15',
        planId: 'monthly',
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
        planId: 'monthly',
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

  it('changes a member plan and derives the fee from the plan', async () => {
    const member = await addMember()
    const updated = await session.agent
      .patch(`/api/admin/members/${member.id}`)
      .set('x-csrf-token', session.csrf)
      .send({ planId: 'three-months', fullName: 'Alice K' })
      .expect(200)
    expect(updated.body.member.planId).toBe('three-months')
    expect(updated.body.member.planDurationMonths).toBe(3)
    expect(updated.body.member.monthlyFeePaise).toBe(270000)
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

describe('Strict Duplicate Member Prevention & Availability Check', () => {
  it('check-phone: returns exists: false for unassigned phone number', async () => {
    const res = await session.agent
      .get('/api/admin/members/check-phone?phone=9123456789')
      .expect(200)
    expect(res.body.exists).toBe(false)
    expect(res.body.normalizedPhone).toBe('9123456789')
  })

  it('check-phone: returns exists: true with details for active member', async () => {
    const member = await addMember({ fullName: 'Rohan Sharma', phone: '9876543210' })
    const res = await session.agent
      .get('/api/admin/members/check-phone?phone=+91 98765 43210')
      .expect(200)
    expect(res.body.exists).toBe(true)
    expect(res.body.member.memberId).toBe(member.memberId)
    expect(res.body.member.fullName).toBe('Rohan Sharma')
    expect(res.body.member.status).toBe('active')
  })

  it('check-phone: returns exists: true with details for inactive/archived member', async () => {
    const member = await addMember({ fullName: 'Old Member', phone: '9988776655' })
    await session.agent
      .post(`/api/admin/members/${member.id}/deactivate`)
      .set('x-csrf-token', session.csrf)
      .expect(200)

    const res = await session.agent
      .get('/api/admin/members/check-phone?phone=9988776655')
      .expect(200)
    expect(res.body.exists).toBe(true)
    expect(res.body.member.memberId).toBe(member.memberId)
    expect(res.body.member.status).toBe('inactive')
  })

  it('check-phone: excludes current member when excludeMemberId is provided during editing', async () => {
    const member = await addMember({ fullName: 'Editing Member', phone: '9876543210' })
    const res = await session.agent
      .get(`/api/admin/members/check-phone?phone=9876543210&excludeMemberId=${member.id}`)
      .expect(200)
    expect(res.body.exists).toBe(false)
  })

  it('rejects duplicate registration across various phone formats (+91, spaces, leading 0)', async () => {
    await addMember({ fullName: 'Original Member', phone: '9876543210' })

    // Exact duplicate
    const res1 = await session.agent
      .post('/api/admin/members')
      .set('x-csrf-token', session.csrf)
      .send({
        fullName: 'Dup 1',
        phone: '9876543210',
        joiningDate: '2026-02-01',
        planId: 'monthly',
      })
      .expect(409)
    expect(res1.body.error.code).toBe('duplicate_member')
    expect(res1.body.error.message).toMatch(/already exists/i)

    // With spaces
    const res2 = await session.agent
      .post('/api/admin/members')
      .set('x-csrf-token', session.csrf)
      .send({
        fullName: 'Dup 2',
        phone: '98765 43210',
        joiningDate: '2026-02-01',
        planId: 'monthly',
      })
      .expect(409)
    expect(res2.body.error.code).toBe('duplicate_member')

    // With +91
    const res3 = await session.agent
      .post('/api/admin/members')
      .set('x-csrf-token', session.csrf)
      .send({
        fullName: 'Dup 3',
        phone: '+91 9876543210',
        joiningDate: '2026-02-01',
        planId: 'monthly',
      })
      .expect(409)
    expect(res3.body.error.code).toBe('duplicate_member')

    // With leading 0
    const res4 = await session.agent
      .post('/api/admin/members')
      .set('x-csrf-token', session.csrf)
      .send({
        fullName: 'Dup 4',
        phone: '09876543210',
        joiningDate: '2026-02-01',
        planId: 'monthly',
      })
      .expect(409)
    expect(res4.body.error.code).toBe('duplicate_member')
  })

  it('prevents registering duplicate for inactive or archived members', async () => {
    const member = await addMember({ fullName: 'Archived Member', phone: '9111122222' })
    await session.agent
      .post(`/api/admin/members/${member.id}/deactivate`)
      .set('x-csrf-token', session.csrf)
      .expect(200)

    const res = await session.agent
      .post('/api/admin/members')
      .set('x-csrf-token', session.csrf)
      .send({
        fullName: 'New Attempt',
        phone: '9111122222',
        joiningDate: '2026-02-01',
        planId: 'monthly',
      })
      .expect(409)

    expect(res.body.error.code).toBe('duplicate_member')
    expect(res.body.error.details.status).toBe('inactive')
  })

  it('editing: allows updating member without changing phone, and allows changing to unused phone', async () => {
    const member = await addMember({ fullName: 'Member Edit', phone: '9222233333' })

    // Edit without changing phone
    const res1 = await session.agent
      .patch(`/api/admin/members/${member.id}`)
      .set('x-csrf-token', session.csrf)
      .send({ fullName: 'Member Edit Updated', phone: '9222233333' })
      .expect(200)
    expect(res1.body.member.fullName).toBe('Member Edit Updated')

    // Change to new unused phone
    const res2 = await session.agent
      .patch(`/api/admin/members/${member.id}`)
      .set('x-csrf-token', session.csrf)
      .send({ phone: '9333344444' })
      .expect(200)
    expect(res2.body.member.phone).toBe('9333344444')
  })

  it('editing: rejects changing phone to another member phone number', async () => {
    const m1 = await addMember({ fullName: 'Member 1', phone: '9444455555' })
    const m2 = await addMember({ fullName: 'Member 2', phone: '9555566666' })

    const res = await session.agent
      .patch(`/api/admin/members/${m2.id}`)
      .set('x-csrf-token', session.csrf)
      .send({ phone: '9444455555' })
      .expect(409)

    expect(res.body.error.code).toBe('duplicate_member')
    expect(res.body.error.details.memberId).toBe(m1.memberId)
  })

  it('side-effects: rejected duplicate registration does not create bills, payments, or modify data', async () => {
    const original = await addMember({ fullName: 'Original Solo', phone: '9666677777' })
    const billsBefore = await MonthlyPayment.find({ member: original.id })
    expect(billsBefore).toHaveLength(1)

    // Attempt duplicate registration
    await session.agent
      .post('/api/admin/members')
      .set('x-csrf-token', session.csrf)
      .send({
        fullName: 'Imposter',
        phone: '9666677777',
        joiningDate: '2026-03-01',
        planId: 'monthly',
      })
      .expect(409)

    // Verify only 1 member exists with this phone
    const members = await Member.find({ phone: '9666677777' })
    expect(members).toHaveLength(1)
    expect(members[0].fullName).toBe('Original Solo')

    // Verify no new bills or payment records were created
    const billsAfter = await MonthlyPayment.find({ member: original.id })
    expect(billsAfter).toHaveLength(1)
    expect(billsAfter[0]._id.toString()).toBe(billsBefore[0]._id.toString())
  })

  it('concurrent registrations: two simultaneous requests for the same phone create exactly one member', async () => {
    const phone = '9777788888'
    const [resA, resB] = await Promise.all([
      session.agent
        .post('/api/admin/members')
        .set('x-csrf-token', session.csrf)
        .send({
          fullName: 'Concurrent A',
          phone,
          joiningDate: '2026-01-15',
          planId: 'monthly',
        }),
      session.agent
        .post('/api/admin/members')
        .set('x-csrf-token', session.csrf)
        .send({
          fullName: 'Concurrent B',
          phone,
          joiningDate: '2026-01-15',
          planId: 'monthly',
        }),
    ])

    const statuses = [resA.status, resB.status].sort()
    expect(statuses).toEqual([201, 409])

    const count = await Member.countDocuments({ phone })
    expect(count).toBe(1)
  })
})
