import type { Express } from 'express'
import request from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { plans as websitePlans } from '../../src/data/plans'
import { PLANS } from '../src/config/plans'
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

describe('membership plan catalogue', () => {
  it('exposes the catalogue to authenticated admins', async () => {
    const response = await session.agent.get('/api/admin/plans').expect(200)
    const ids = response.body.plans.map((plan: { id: string }) => plan.id)
    expect(ids).toEqual(['monthly', 'three-months', 'six-months', 'yearly'])
    const yearly = response.body.plans.find((plan: { id: string }) => plan.id === 'yearly')
    expect(yearly.pricePaise).toBe(1000000)
    expect(yearly.durationMonths).toBe(13)
  })

  it('requires authentication', async () => {
    await request(app).get('/api/admin/plans').expect(401)
  })

  it('stays in sync with the prices advertised on the website', () => {
    const siteById = new Map(websitePlans.map((plan) => [plan.id, plan]))
    expect([...siteById.keys()].sort()).toEqual(PLANS.map((plan) => plan.id).sort())

    for (const plan of PLANS) {
      const site = siteById.get(plan.id)
      expect(site, `website plan "${plan.id}" must exist`).toBeTruthy()
      // Advertised offer price (whole rupees) must equal the billed paise price.
      expect(site!.offerPrice * 100).toBe(plan.pricePaise)
      // Duration expressed in the marketing copy must match the billed months.
      const advertisedMonths = Number(/(\d+)\s*month/i.exec(site!.duration)?.[1])
      expect(advertisedMonths).toBe(plan.durationMonths)
    }
  })
})
