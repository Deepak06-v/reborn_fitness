import type { Express } from 'express'
import request from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import {
  clearDatabase,
  createAdmin,
  csrfFor,
  loadApp,
  loginAgent,
  setupTestEnv,
  teardownTestEnv,
  TEST_ADMIN,
} from './helpers/setup'

let app: Express

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
})

describe('admin authentication', () => {
  it('denies unauthenticated access to protected endpoints', async () => {
    await request(app).get('/api/admin/auth/me').expect(401)
    await request(app).get('/api/admin/members').expect(401)
    await request(app).get('/api/admin/payments').expect(401)
    await request(app).get('/api/admin/dashboard').expect(401)
  })

  it('rejects state-changing requests without a CSRF token', async () => {
    await request(app)
      .post('/api/admin/auth/login')
      .send({ username: TEST_ADMIN.username, password: TEST_ADMIN.password })
      .expect(403)
  })

  it('logs in with valid credentials and reports the admin', async () => {
    const agent = request.agent(app)
    const csrf = await csrfFor(agent)
    const response = await agent
      .post('/api/admin/auth/login')
      .set('x-csrf-token', csrf)
      .send({ username: TEST_ADMIN.username, password: TEST_ADMIN.password })
      .expect(200)
    expect(response.body.admin.username).toBe(TEST_ADMIN.username)

    const me = await agent.get('/api/admin/auth/me').expect(200)
    expect(me.body.admin.username).toBe(TEST_ADMIN.username)
  })

  it('returns a generic error for invalid credentials', async () => {
    const agent = request.agent(app)
    const csrf = await csrfFor(agent)
    const wrongPassword = await agent
      .post('/api/admin/auth/login')
      .set('x-csrf-token', csrf)
      .send({ username: TEST_ADMIN.username, password: 'wrong-password' })
      .expect(401)
    expect(wrongPassword.body.error.message).toBe('Invalid username or password')

    const unknownUser = await agent
      .post('/api/admin/auth/login')
      .set('x-csrf-token', csrf)
      .send({ username: 'nobody', password: 'whatever' })
      .expect(401)
    expect(unknownUser.body.error.message).toBe('Invalid username or password')
  })

  it('invalidates the session on logout', async () => {
    const { agent, csrf } = await loginAgent(app, TEST_ADMIN.username, TEST_ADMIN.password)
    await agent.get('/api/admin/auth/me').expect(200)
    await agent.post('/api/admin/auth/logout').set('x-csrf-token', csrf).expect(204)
    await agent.get('/api/admin/auth/me').expect(401)
  })

  it('enforces role authorization: owner can deactivate, staff is forbidden (403)', async () => {
    const { Member } = await import('../src/models/Member')
    await createAdmin('staff1', 'staff-pass-123', 'staff')

    const member = await Member.create({
      memberId: 'RBF-100',
      fullName: 'Auth Test Member',
      phone: '9876543210',
      joiningDate: new Date('2026-10-01T00:00:00+05:30'),
      planId: 'monthly',
      planName: 'Monthly',
      planDurationMonths: 1,
      planPricePaise: 100000,
      monthlyFeePaise: 100000,
      status: 'active',
    })

    const { agent: staffAgent, csrf: staffCsrf } = await loginAgent(
      app,
      'staff1',
      'staff-pass-123',
    )

    // Staff (role='staff') cannot deactivate
    const staffRes = await staffAgent
      .post(`/api/admin/members/${member._id}/deactivate`)
      .set('x-csrf-token', staffCsrf)
      .send({})
      .expect(403)
    expect(staffRes.body.error.message).toMatch(/Owner authorization required/)

    // Owner can deactivate
    const { agent: ownerAgent, csrf: ownerCsrf } = await loginAgent(
      app,
      TEST_ADMIN.username,
      TEST_ADMIN.password,
    )
    const ownerRes = await ownerAgent
      .post(`/api/admin/members/${member._id}/deactivate`)
      .set('x-csrf-token', ownerCsrf)
      .send({})
      .expect(200)
    expect(ownerRes.body.member.status).toBe('inactive')

    const dbMember = await Member.findById(member._id)
    expect(dbMember!.status).toBe('inactive')
    expect(dbMember!.archivedAt).toBeTruthy()
    expect(dbMember!.archivedBy).toBeTruthy()

    // Owner can reactivate
    const reactivateRes = await ownerAgent
      .post(`/api/admin/members/${member._id}/activate`)
      .set('x-csrf-token', ownerCsrf)
      .send({})
      .expect(200)
    expect(reactivateRes.body.member.status).toBe('active')
  })

  it('enforces role authorization: admin (Staff) is forbidden from deactivating (403)', async () => {
    // KEY TEST: 'admin' role must be treated as Staff, NOT Owner.
    // Before the fix, isOwnerRole() incorrectly included 'admin', granting it owner access.
    const { Member } = await import('../src/models/Member')
    await createAdmin('admin_user', 'admin-pass-123', 'admin')

    const member = await Member.create({
      memberId: 'RBF-101',
      fullName: 'Admin Role Test Member',
      phone: '9123456780',
      joiningDate: new Date('2026-10-01T00:00:00+05:30'),
      planId: 'monthly',
      planName: 'Monthly',
      planDurationMonths: 1,
      planPricePaise: 100000,
      monthlyFeePaise: 100000,
      status: 'active',
    })

    const { agent: adminAgent, csrf: adminCsrf } = await loginAgent(
      app,
      'admin_user',
      'admin-pass-123',
    )

    // 'admin' role must be denied — it is Staff, not Owner
    const res = await adminAgent
      .post(`/api/admin/members/${member._id}/deactivate`)
      .set('x-csrf-token', adminCsrf)
      .send({})
      .expect(403)
    expect(res.body.error.message).toMatch(/Owner authorization required/)

    // Confirm member is still active — no side effects
    const dbMember = await Member.findById(member._id)
    expect(dbMember!.status).toBe('active')
  })

  it('superadmin (Owner) can deactivate; admin (Staff) cannot', async () => {
    // Explicit Owner vs Staff smoke test using the two named roles.
    const { Member } = await import('../src/models/Member')
    await createAdmin('the_admin', 'admin-pass-456', 'admin')

    const member = await Member.create({
      memberId: 'RBF-102',
      fullName: 'Role Smoke Test',
      phone: '9234567801',
      joiningDate: new Date('2026-10-01T00:00:00+05:30'),
      planId: 'monthly',
      planName: 'Monthly',
      planDurationMonths: 1,
      planPricePaise: 100000,
      monthlyFeePaise: 100000,
      status: 'active',
    })

    // superadmin (Owner) succeeds
    const { agent: superAgent, csrf: superCsrf } = await loginAgent(
      app,
      TEST_ADMIN.username, // created with role 'superadmin' by default
      TEST_ADMIN.password,
    )
    await superAgent
      .post(`/api/admin/members/${member._id}/deactivate`)
      .set('x-csrf-token', superCsrf)
      .send({})
      .expect(200)

    // Reactivate so the next check is meaningful
    await superAgent
      .post(`/api/admin/members/${member._id}/activate`)
      .set('x-csrf-token', superCsrf)
      .send({})
      .expect(200)

    // admin (Staff) is denied
    const { agent: adminAgent, csrf: adminCsrf } = await loginAgent(
      app,
      'the_admin',
      'admin-pass-456',
    )
    await adminAgent
      .post(`/api/admin/members/${member._id}/deactivate`)
      .set('x-csrf-token', adminCsrf)
      .send({})
      .expect(403)
  })
})
