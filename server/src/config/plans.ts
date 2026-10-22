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
  /** Length of one billing period, in months. 0 for sub-month plans. */
  durationMonths: number
  /** Length of one billing period in calendar days, when not whole months. */
  durationDays?: number
  /** Price of one billing period, in integer paise. */
  pricePaise: number
}

export const PLANS: readonly MembershipPlan[] = [
  { id: 'monthly', name: 'Monthly', durationMonths: 1, pricePaise: 100_000 },
  { id: 'monthly-1500', name: 'Monthly – ₹1,500', durationMonths: 1, pricePaise: 150_000 },
  { id: 'monthly-2000', name: 'Monthly – ₹2,000', durationMonths: 1, pricePaise: 200_000 },
  { id: '15days-500', name: '15 Days – ₹500', durationMonths: 0, durationDays: 15, pricePaise: 50_000 },
  { id: 'two-months', name: '2 Months', durationMonths: 2, pricePaise: 200_000 },
  { id: 'three-months', name: '3 Months', durationMonths: 3, pricePaise: 270_000 },
  { id: 'four-months', name: '4 Months', durationMonths: 4, pricePaise: 400_000 },
  { id: 'five-months', name: '5 Months', durationMonths: 5, pricePaise: 500_000 },
  { id: 'six-months', name: '6 Months', durationMonths: 6, pricePaise: 500_000 },
  { id: 'seven-months', name: '7 Months', durationMonths: 7, pricePaise: 700_000 },
  { id: 'eight-months', name: '8 Months', durationMonths: 8, pricePaise: 800_000 },
  { id: 'nine-months', name: '9 Months', durationMonths: 9, pricePaise: 900_000 },
  { id: 'ten-months', name: '10 Months', durationMonths: 10, pricePaise: 1_000_000 },
  { id: 'eleven-months', name: '11 Months', durationMonths: 11, pricePaise: 1_100_000 },
  { id: 'yearly', name: '12 Months (1 Year)', durationMonths: 12, pricePaise: 1_000_000 },
  { id: 'thirteen-months', name: '13 Months', durationMonths: 13, pricePaise: 1_300_000 },
  { id: 'fourteen-months', name: '14 Months', durationMonths: 14, pricePaise: 1_400_000 },
  { id: 'fifteen-months', name: '15 Months', durationMonths: 15, pricePaise: 1_300_000 },
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
