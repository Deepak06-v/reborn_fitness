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
    expect(ids).toHaveLength(18)
    expect(ids).toContain('monthly')
    expect(ids).toContain('monthly-1500')
    expect(ids).toContain('monthly-2000')
    expect(ids).toContain('15days-500')
    expect(ids).toContain('two-months')
    expect(ids).toContain('fifteen-months')

    const monthly1500 = response.body.plans.find((p: { id: string }) => p.id === 'monthly-1500')
    expect(monthly1500.pricePaise).toBe(150000)
    expect(monthly1500.durationMonths).toBe(1)

    const monthly2000 = response.body.plans.find((p: { id: string }) => p.id === 'monthly-2000')
    expect(monthly2000.pricePaise).toBe(200000)
    expect(monthly2000.durationMonths).toBe(1)

    const fifteenDays = response.body.plans.find((p: { id: string }) => p.id === '15days-500')
    expect(fifteenDays.pricePaise).toBe(50000)
    expect(fifteenDays.durationDays).toBe(15)

    const yearly = response.body.plans.find((plan: { id: string }) => plan.id === 'yearly')
    expect(yearly.pricePaise).toBe(1000000)
    expect(yearly.durationMonths).toBe(12)
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
      // Duration expressed in marketing copy matches billed months or days.
      if (plan.durationDays) {
        const advertisedDays = Number(/(\d+)\s*day/i.exec(site!.duration)?.[1])
        expect(advertisedDays).toBe(plan.durationDays)
      } else {
        const advertisedMonths = Number(/(\d+)\s*month/i.exec(site!.duration)?.[1])
        expect(advertisedMonths).toBe(plan.durationMonths)
      }
    }
  })
})
