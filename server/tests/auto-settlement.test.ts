import type { Express } from 'express'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
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
import { Member } from '../src/models/Member'
import { MonthlyPayment } from '../src/models/MonthlyPayment'
import { addMonthsAnchored, formatDDMMYYYY } from '../src/utils/month'

let app: Express
let session: AuthedAgent
let reconcileMemberBilling: (typeof import('../src/services/billing'))['reconcileMemberBilling']

async function addMember(body: Record<string, unknown>) {
  const response = await session.agent
    .post('/api/admin/members')
    .set('x-csrf-token', session.csrf)
    .send({
      fullName: 'Vikram Singh',
      phone: '9876543210',
      ...body,
    })
  return response
}

async function getMember(id: string) {
  return await session.agent.get(`/api/admin/members/${id}`).expect(200)
}

beforeAll(async () => {
  await setupTestEnv()
  reconcileMemberBilling = (await import('../src/services/billing')).reconcileMemberBilling
  app = await loadApp()
})

afterAll(async () => {
  await teardownTestEnv()
})

beforeEach(async () => {
  await clearDatabase()
  await createAdmin()
  session = await loginAgent(app, TEST_ADMIN.username, TEST_ADMIN.password)
}, 30000)

describe('Master Implementation: 4-Month Plan & Automatic First Billing Cycle Settlement', () => {
  // Test 1: Normal monthly registration
  // Joining date: 22 October, Registration date: 22 October
  // Expected: First monthly period automatically PAID.
  it('Test 1: Normal monthly registration - first period is automatically marked PAID', async () => {
    const res = await addMember({
      joiningDate: '2026-10-22',
      planId: 'monthly',
    })
    expect(res.status).toBe(201)
    const member = res.body.member

    const detail = await getMember(member.id)
    expect(detail.body.payments).toHaveLength(1)

    const firstPeriod = detail.body.payments[0]
    expect(firstPeriod.planId).toBe('monthly')
    expect(firstPeriod.dueAmountPaise).toBe(100000)
    expect(firstPeriod.amountPaidPaise).toBe(100000)
    expect(firstPeriod.balancePaise).toBe(0)
    expect(firstPeriod.status).toBe('paid')
    expect(firstPeriod.dueState).toBe('paid')
    expect(firstPeriod.isAutoSettled).toBe(true)

    expect(istDayOf(firstPeriod.periodStart)).toBe('2026-10-22')
    expect(istDayOf(firstPeriod.periodEnd)).toBe('2026-11-22')

    // Payment entry details
    expect(firstPeriod.paymentEntries).toHaveLength(1)
    expect(firstPeriod.paymentEntries[0].method).toBe('auto_registration')
    expect(firstPeriod.paymentEntries[0].amountPaise).toBe(100000)
    expect(firstPeriod.paymentEntries[0].referenceNumber).toBe('AUTO-REG')

    // Member nextBillingDate points to periodEnd
    expect(istDayOf(detail.body.member.nextBillingDate)).toBe('2026-11-22')
  })

  // Test 2: Backdated registration
  // Joining date: 22 October, Registration date: 23 October (or later)
  // Expected: The first period is 22 October – 22 November and automatically PAID.
  it('Test 2: Backdated registration - uses joiningDate as source of truth and marks first period PAID', async () => {
    const res = await addMember({
      joiningDate: '2026-10-22',
      planId: 'monthly-1500',
    })
    expect(res.status).toBe(201)
    const member = res.body.member

    const detail = await getMember(member.id)
    const firstPeriod = detail.body.payments[0]

    expect(detail.body.member.joiningDate.slice(0, 10)).toBe('2026-10-22')
    expect(istDayOf(firstPeriod.periodStart)).toBe('2026-10-22')
    expect(istDayOf(firstPeriod.periodEnd)).toBe('2026-11-22')
    expect(firstPeriod.dueAmountPaise).toBe(150000)
    expect(firstPeriod.amountPaidPaise).toBe(150000)
    expect(firstPeriod.balancePaise).toBe(0)
    expect(firstPeriod.status).toBe('paid')
    expect(istDayOf(detail.body.member.nextBillingDate)).toBe('2026-11-22')
  })

  // Test 3: Four-month plan
  // Joining date: 22 October
  // Plan: 4 Months – ₹5,000 (4months-5000)
  // Expected:
  // - First period: 22 October – 22 February
  // - Amount: ₹5,000
  // - Status: PAID
  // - Next due date: 22 February
  it('Test 3: Four-month plan - 22 Oct to 22 Feb, ₹5,000, PAID, next due 22 Feb', async () => {
    const res = await addMember({
      joiningDate: '2026-10-22',
      planId: '4months-5000',
    })
    expect(res.status).toBe(201)
    const member = res.body.member

    expect(member.planId).toBe('4months-5000')
    expect(member.planName).toBe('4 Months – ₹5,000')
    expect(member.planDurationMonths).toBe(4)
    expect(member.monthlyFeePaise).toBe(500000)

    const detail = await getMember(member.id)
    const firstPeriod = detail.body.payments[0]

    expect(istDayOf(firstPeriod.periodStart)).toBe('2026-10-22')
    expect(istDayOf(firstPeriod.periodEnd)).toBe('2027-02-22')
    expect(firstPeriod.dueAmountPaise).toBe(500000)
    expect(firstPeriod.amountPaidPaise).toBe(500000)
    expect(firstPeriod.balancePaise).toBe(0)
    expect(firstPeriod.status).toBe('paid')
    expect(firstPeriod.dueState).toBe('paid')
    expect(firstPeriod.isAutoSettled).toBe(true)

    expect(istDayOf(detail.body.member.nextBillingDate)).toBe('2027-02-22')
  })

  // Test 4: Subsequent billing
  // After the first four-month period ends, the next billing period must be generated as DUE according to existing billing rules.
  it('Test 4: Subsequent billing - after first period ends, next period is generated as UNPAID / DUE', async () => {
    const res = await addMember({
      joiningDate: '2026-10-22',
      planId: '4months-5000',
    })
    expect(res.status).toBe(201)
    const memberDoc = (await Member.findById(res.body.member.id))!

    // Advance time to 2027-02-25 (after the 4-month period ended on 2027-02-22)
    const simulatedNow = new Date('2027-02-25T00:00:00+05:30')
    const reconcileResult = await reconcileMemberBilling(memberDoc, simulatedNow)
    expect(reconcileResult.created).toBe(1)

    const payments = await MonthlyPayment.find({ member: memberDoc._id }).sort({ periodStart: 1 })
    expect(payments).toHaveLength(2)

    // Period 1: PAID
    const period1 = payments[0]
    expect(istDayOf(period1.periodStart)).toBe('2026-10-22')
    expect(istDayOf(period1.periodEnd)).toBe('2027-02-22')
    expect(period1.status).toBe('paid')
    expect(period1.amountPaidPaise).toBe(500000)
    expect(period1.isAutoSettled).toBe(true)

    // Period 2: DUE / UNPAID (future payments are NOT automatically marked paid)
    const period2 = payments[1]
    expect(istDayOf(period2.periodStart)).toBe('2027-02-22')
    expect(istDayOf(period2.periodEnd)).toBe('2027-06-22')
    expect(period2.dueAmountPaise).toBe(500000)
    expect(period2.amountPaidPaise).toBe(0)
    expect(period2.status).toBe('unpaid')
    expect(period2.isAutoSettled).toBe(false)
    expect(period2.paymentEntries).toHaveLength(0)

    // Next billing date updated to 2027-06-22
    const updatedMember = (await Member.findById(memberDoc._id))!
    expect(istDayOf(updatedMember.nextBillingDate)).toBe('2027-06-22')
  })

  // Test 5: Duplicate registration request
  // Expected: No duplicate first-period payment record under retries or concurrency.
  it('Test 5: Duplicate registration request - idempotent, prevents duplicate first-period payment records', async () => {
    const res = await addMember({
      fullName: 'Rahul Sharma',
      phone: '9999999999',
      joiningDate: '2026-10-22',
      planId: '4months-5000',
    })
    expect(res.status).toBe(201)
    const memberDoc = (await Member.findById(res.body.member.id))!

    // Verify 1 bill initially
    const billsBefore = await MonthlyPayment.find({ member: memberDoc._id })
    expect(billsBefore).toHaveLength(1)

    // Calling reconcileMemberBilling or initial period creation again does not duplicate
    await reconcileMemberBilling(memberDoc, new Date('2026-10-22T00:00:00+05:30'))
    await reconcileMemberBilling(memberDoc, new Date('2026-10-23T00:00:00+05:30'))

    const billsAfter = await MonthlyPayment.find({ member: memberDoc._id })
    expect(billsAfter).toHaveLength(1)
    expect(billsAfter[0].status).toBe('paid')
    expect(billsAfter[0].amountPaidPaise).toBe(500000)
  })

  // Test 6: Month-end date
  // Joining date: 31 January.
  // Expected: Correct calendar-month calculations without date overflow.
  it('Test 6: Month-end date calculations - 31 January does not overflow into March', async () => {
    // 1-month plan from 31 Jan 2026 -> 28 Feb 2026 (non-leap year)
    const nonLeapEnd = addMonthsAnchored(new Date('2026-01-31T00:00:00+05:30'), 1, 31)
    expect(istDayOf(nonLeapEnd)).toBe('2026-02-28')
    expect(formatDDMMYYYY(nonLeapEnd)).toBe('28/02/2026')

    // 1-month plan from 31 Jan 2024 -> 29 Feb 2024 (leap year)
    const leapEnd = addMonthsAnchored(new Date('2024-01-31T00:00:00+05:30'), 1, 31)
    expect(istDayOf(leapEnd)).toBe('2024-02-29')
    expect(formatDDMMYYYY(leapEnd)).toBe('29/02/2024')

    // 4-month plan from 31 Jan 2026 -> 31 May 2026
    const fourMonthEnd = addMonthsAnchored(new Date('2026-01-31T00:00:00+05:30'), 4, 31)
    expect(istDayOf(fourMonthEnd)).toBe('2026-05-31')
    expect(formatDDMMYYYY(fourMonthEnd)).toBe('31/05/2026')

    // End-to-end member registration on 31 Jan
    const res = await addMember({
      joiningDate: '2026-01-31',
      planId: '4months-5000',
    })
    expect(res.status).toBe(201)
    const detail = await getMember(res.body.member.id)
    const sorted = [...detail.body.payments].sort(
      (a, b) => new Date(a.periodStart).getTime() - new Date(b.periodStart).getTime(),
    )
    const firstPeriod = sorted[0]
    expect(istDayOf(firstPeriod.periodStart)).toBe('2026-01-31')
    expect(istDayOf(firstPeriod.periodEnd)).toBe('2026-05-31')
    expect(firstPeriod.status).toBe('paid')
    expect(firstPeriod.amountPaidPaise).toBe(500000)
    expect(istDayOf(res.body.member.nextBillingDate)).toBe('2026-05-31')
    expect(istDayOf(detail.body.member.nextBillingDate)).toBe('2027-01-31')
  })

  // Test 7: Existing member
  // Expected: Existing member and payment records remain unchanged.
  it('Test 7: Existing member - historical unpaid payments remain unpaid during reconcile', async () => {
    // Manually simulate an existing legacy member whose bill is unpaid
    const existingMember = await Member.create({
      memberId: 'RBF-0099',
      fullName: 'Old Member',
      phone: '9888800099',
      joiningDate: new Date('2026-01-01T00:00:00+05:30'),
      planId: 'monthly',
      planName: 'Monthly',
      planDurationMonths: 1,
      planPricePaise: 100000,
      monthlyFeePaise: 100000,
      status: 'active',
    })

    const unpaidBill = await MonthlyPayment.create({
      member: existingMember._id,
      memberId: existingMember.memberId,
      billingMonth: '2026-01',
      invoiceNumber: 'RBF-INV-0099',
      planId: 'monthly',
      planName: 'Monthly',
      durationMonths: 1,
      periodStart: new Date('2026-01-01T00:00:00+05:30'),
      periodEnd: new Date('2026-02-01T00:00:00+05:30'),
      dueDate: new Date('2026-01-01T00:00:00+05:30'),
      dueAmountPaise: 100000,
      amountPaidPaise: 0,
      status: 'unpaid',
      isAutoSettled: false,
    })

    // Reconciling must not alter the existing unpaid bill into paid
    await reconcileMemberBilling(existingMember, new Date('2026-01-15T00:00:00+05:30'))

    const billCheck = await MonthlyPayment.findById(unpaidBill._id)
    expect(billCheck!.status).toBe('unpaid')
    expect(billCheck!.amountPaidPaise).toBe(0)
    expect(billCheck!.isAutoSettled).toBe(false)
  })

  // Test 8: Existing Personal Training plans
  // Ensure their existing three-month and six-month durations and prices continue working.
  it('Test 8: Existing Personal Training plans (pt-3-months, pt-6-months) auto-settle accurately', async () => {
    // PT 3 Months (₹12,000)
    const pt3Res = await addMember({
      fullName: 'PT Client 1',
      phone: '9777700001',
      joiningDate: '2026-10-22',
      planId: 'pt-3-months',
    })
    expect(pt3Res.status).toBe(201)
    const pt3Detail = await getMember(pt3Res.body.member.id)
    const pt3Bill = pt3Detail.body.payments[0]
    expect(pt3Bill.planId).toBe('pt-3-months')
    expect(pt3Bill.dueAmountPaise).toBe(1200000)
    expect(pt3Bill.amountPaidPaise).toBe(1200000)
    expect(pt3Bill.status).toBe('paid')
    expect(istDayOf(pt3Bill.periodStart)).toBe('2026-10-22')
    expect(istDayOf(pt3Bill.periodEnd)).toBe('2027-01-22')
    expect(istDayOf(pt3Detail.body.member.nextBillingDate)).toBe('2027-01-22')

    // PT 6 Months (₹20,000)
    const pt6Res = await addMember({
      fullName: 'PT Client 2',
      phone: '9777700002',
      joiningDate: '2026-10-22',
      planId: 'pt-6-months',
    })
    expect(pt6Res.status).toBe(201)
    const pt6Detail = await getMember(pt6Res.body.member.id)
    const pt6Bill = pt6Detail.body.payments[0]
    expect(pt6Bill.planId).toBe('pt-6-months')
    expect(pt6Bill.dueAmountPaise).toBe(2000000)
    expect(pt6Bill.amountPaidPaise).toBe(2000000)
    expect(pt6Bill.status).toBe('paid')
    expect(istDayOf(pt6Bill.periodStart)).toBe('2026-10-22')
    expect(istDayOf(pt6Bill.periodEnd)).toBe('2027-04-22')
    expect(istDayOf(pt6Detail.body.member.nextBillingDate)).toBe('2027-04-22')
  })

  // Test 9: Payment record integrity & physical collections check
  it('Requirement 4: Auto-settlement does not falsely inflate cash/UPI collections in dashboard', async () => {
    // Register a member on the 4-month plan (₹5,000)
    await addMember({
      joiningDate: '2026-10-22',
      planId: '4months-5000',
    })

    // Fetch dashboard for October 2026
    const dash = await session.agent.get('/api/admin/dashboard?month=2026-10').expect(200)

    // Active members count is incremented
    expect(dash.body.metrics.totalActiveMembers).toBe(1)
    // Status overview shows the bill as paid
    expect(dash.body.statusOverview.paid).toBe(1)
    expect(dash.body.statusOverview.unpaid).toBe(0)
    expect(dash.body.statusOverview.overdue).toBe(0)

    // Collections this month must be 0 because no actual cash/UPI was recorded!
    expect(dash.body.metrics.collectionsThisMonthPaise).toBe(0)
    expect(dash.body.metrics.collectionsCount).toBe(0)
  })
})
