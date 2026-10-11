import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { addMonthsAnchored, istDayOfMonth } from '../src/utils/month'
import { deriveDueState, DUE_SOON_DAYS } from '../src/utils/paymentStatus'
import {
  clearDatabase,
  istDayOf,
  setupTestEnv,
  teardownTestEnv,
} from './helpers/setup'

type BillingModule = typeof import('../src/services/billing')
type MemberModule = typeof import('../src/models/Member')
type PaymentModule = typeof import('../src/models/MonthlyPayment')

let reconcileMemberBilling: BillingModule['reconcileMemberBilling']
let Member: MemberModule['Member']
let MonthlyPayment: PaymentModule['MonthlyPayment']

let phoneCounter = 0

async function makeMember(overrides: Record<string, unknown> = {}) {
  phoneCounter += 1
  return Member.create({
    memberId: `RBF-9${String(phoneCounter).padStart(3, '0')}`,
    fullName: 'Test Member',
    phone: `9000009${String(phoneCounter).padStart(3, '0')}`,
    joiningDate: new Date('2026-01-31T00:00:00+05:30'),
    planId: 'monthly',
    planName: 'Monthly',
    planDurationMonths: 1,
    planPricePaise: 100000,
    monthlyFeePaise: 100000,
    status: 'active',
    ...overrides,
  })
}

beforeAll(async () => {
  await setupTestEnv()
  reconcileMemberBilling = (await import('../src/services/billing')).reconcileMemberBilling
  Member = (await import('../src/models/Member')).Member
  MonthlyPayment = (await import('../src/models/MonthlyPayment')).MonthlyPayment
})

afterAll(async () => {
  await teardownTestEnv()
})

beforeEach(async () => {
  await clearDatabase()
  phoneCounter = 0
})

describe('addMonthsAnchored', () => {
  it('clamps short months and resumes the anchor day', () => {
    expect(
      istDayOf(addMonthsAnchored(new Date('2026-01-31T00:00:00+05:30'), 1, 31)),
    ).toBe('2026-02-28')
    expect(
      istDayOf(addMonthsAnchored(new Date('2026-02-28T00:00:00+05:30'), 1, 31)),
    ).toBe('2026-03-31')
  })

  it('handles February in a leap year', () => {
    expect(
      istDayOf(addMonthsAnchored(new Date('2024-01-31T00:00:00+05:30'), 1, 31)),
    ).toBe('2024-02-29')
  })

  it('adds multi-month durations from a fixed anchor', () => {
    const jan15 = new Date('2026-01-15T00:00:00+05:30')
    expect(istDayOf(addMonthsAnchored(jan15, 3, 15))).toBe('2026-04-15')
    expect(istDayOf(addMonthsAnchored(jan15, 13, 15))).toBe('2027-02-15')
  })

  it('reports the IST day of month', () => {
    expect(istDayOfMonth(new Date('2026-01-31T00:00:00+05:30'))).toBe(31)
  })
})

describe('deriveDueState', () => {
  const at = (offsetDays: number) => new Date(Date.now() + offsetDays * 86_400_000)

  it('is paid when nothing is outstanding', () => {
    expect(deriveDueState(100000, 100000, at(-30))).toBe('paid')
  })

  it('is unpaid when the due date is more than the window away', () => {
    expect(deriveDueState(100000, 0, at(DUE_SOON_DAYS + 1))).toBe('unpaid')
  })

  it('is due_soon inside the window, including today', () => {
    expect(deriveDueState(100000, 0, at(DUE_SOON_DAYS))).toBe('due_soon')
    expect(deriveDueState(100000, 0, at(0))).toBe('due_soon')
  })

  it('is overdue once the due day has passed', () => {
    expect(deriveDueState(100000, 0, at(-1))).toBe('overdue')
  })

  it('keeps a partial balance outstanding', () => {
    expect(deriveDueState(100000, 40000, at(0))).toBe('due_soon')
  })
})

describe('reconcileMemberBilling', () => {
  const jan31 = new Date('2026-01-31T00:00:00+05:30')

  it('creates the initial period then backfills up to now', async () => {
    const member = await makeMember({ joiningDate: jan31 })
    const now = new Date('2026-10-11T00:00:00+05:30')
    const result = await reconcileMemberBilling(member, now)

    const bills = await MonthlyPayment.find({ member: member._id }).sort({ periodStart: 1 })
    expect(result.created).toBeGreaterThan(0)
    const feb = bills.find((bill) => bill.billingMonth === '2026-02')
    const mar = bills.find((bill) => bill.billingMonth === '2026-03')
    expect(istDayOf(feb!.periodStart)).toBe('2026-02-28')
    expect(istDayOf(mar!.periodStart)).toBe('2026-03-31')
    // No future period is ever pre-generated.
    for (const bill of bills) {
      expect(bill.periodStart!.getTime()).toBeLessThanOrEqual(now.getTime())
    }
  })

  it('is idempotent on repeated runs', async () => {
    const member = await makeMember({ joiningDate: new Date('2026-01-15T00:00:00+05:30') })
    const now = new Date('2026-06-01T00:00:00+05:30')
    await reconcileMemberBilling(member, now)
    const count = await MonthlyPayment.countDocuments({ member: member._id })

    const again = await reconcileMemberBilling(member, now)
    expect(again.created).toBe(0)
    expect(await MonthlyPayment.countDocuments({ member: member._id })).toBe(count)
  })

  it('never duplicates periods under concurrent runs', async () => {
    const member = await makeMember({ joiningDate: new Date('2026-01-15T00:00:00+05:30') })
    const now = new Date('2026-06-01T00:00:00+05:30')
    await Promise.all([
      reconcileMemberBilling(member, now),
      reconcileMemberBilling(member, now),
    ])

    const bills = await MonthlyPayment.find({ member: member._id })
    const months = bills.map((bill) => bill.billingMonth)
    expect(new Set(months).size).toBe(months.length)
  })

  it('does not bill an inactive member any further', async () => {
    const member = await makeMember({ joiningDate: new Date('2026-01-15T00:00:00+05:30') })
    await reconcileMemberBilling(member, new Date('2026-03-01T00:00:00+05:30'))
    const before = await MonthlyPayment.countDocuments({ member: member._id })

    member.status = 'inactive'
    await member.save()
    const result = await reconcileMemberBilling(member, new Date('2026-09-01T00:00:00+05:30'))
    expect(result.created).toBe(0)
    expect(await MonthlyPayment.countDocuments({ member: member._id })).toBe(before)
  })

  it('applies a plan change to the next cycle without rewriting history', async () => {
    const member = await makeMember({ joiningDate: new Date('2026-01-15T00:00:00+05:30') })
    await reconcileMemberBilling(member, new Date('2026-10-11T00:00:00+05:30'))

    await Member.updateOne(
      { _id: member._id },
      {
        $set: {
          planId: 'yearly',
          planName: '1 Year',
          planDurationMonths: 13,
          planPricePaise: 1000000,
          monthlyFeePaise: 1000000,
        },
      },
    )

    const refreshed = (await Member.findById(member._id))!
    await reconcileMemberBilling(refreshed, new Date('2026-10-11T00:00:00+05:30'))
    // The current monthly period still runs to mid-October: no yearly bill yet.
    expect(await MonthlyPayment.findOne({ member: member._id, billingMonth: '2026-10' })).toBeNull()
    const jan = await MonthlyPayment.findOne({ member: member._id, billingMonth: '2026-01' })
    expect(jan!.dueAmountPaise).toBe(100000)

    // Advance time: the next period is billed on the new yearly plan.
    const later = (await Member.findById(member._id))!
    await reconcileMemberBilling(later, new Date('2026-11-05T00:00:00+05:30'))
    const nextPeriod = await MonthlyPayment.findOne({
      member: member._id,
      billingMonth: '2026-10',
    })
    expect(nextPeriod).toBeTruthy()
    expect(nextPeriod!.dueAmountPaise).toBe(1000000)
    expect(nextPeriod!.durationMonths).toBe(13)
  })
})
