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
})
