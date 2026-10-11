/**
 * Canonical membership plan catalogue.
 *
 * This is the single source of truth for prices and durations on the server.
 * The browser sends only a `planId`; the server always looks the price up here
 * so a client can never influence what a member is charged.
 *
 * Prices are integer paise (₹1 = 100 paise) and mirror the plans advertised on
 * the public website (see src/data/plans.ts). A test asserts the two stay in
 * sync so the advertised price and the billed price can never drift apart.
 */
export interface MembershipPlan {
  id: string
  name: string
  /** Length of one billing period, in months. */
  durationMonths: number
  /** Price of one billing period, in integer paise. */
  pricePaise: number
}

export const PLANS: readonly MembershipPlan[] = [
  { id: 'monthly', name: 'Monthly', durationMonths: 1, pricePaise: 100_000 },
  { id: 'three-months', name: '3 Months', durationMonths: 3, pricePaise: 270_000 },
  { id: 'six-months', name: '6 Months', durationMonths: 6, pricePaise: 500_000 },
  // The advertised "1 Year" offer includes one bonus month: 13 months total.
  { id: 'yearly', name: '1 Year', durationMonths: 13, pricePaise: 1_000_000 },
] as const

export const PLAN_IDS = PLANS.map((plan) => plan.id) as [string, ...string[]]

const PLAN_BY_ID = new Map(PLANS.map((plan) => [plan.id, plan]))

export function getPlan(id: string | null | undefined): MembershipPlan | undefined {
  if (!id) return undefined
  return PLAN_BY_ID.get(id)
}

export function isPlanId(value: unknown): boolean {
  return typeof value === 'string' && PLAN_BY_ID.has(value)
}
