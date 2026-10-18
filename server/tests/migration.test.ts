import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { Member } from '../src/models/Member'
import { MonthlyPayment } from '../src/models/MonthlyPayment'
import { runVerifyAndBackfill } from '../src/migrations/verify-and-backfill'
import {
  clearDatabase,
  setupTestEnv,
  teardownTestEnv,
} from './helpers/setup'

beforeAll(async () => {
  await setupTestEnv()
})

afterAll(async () => {
  await teardownTestEnv()
})

beforeEach(async () => {
  await clearDatabase()
})

describe('verify-and-backfill migration', () => {
  it('reports missing fields in dry-run without mutating records', async () => {
    const member = await Member.create({
      memberId: 'RBF-MIG01',
      fullName: 'Legacy Member',
      phone: '9876543210',
      joiningDate: new Date('2026-01-15T00:00:00+05:30'),
      planId: 'monthly',
      planName: 'Monthly',
      planDurationMonths: 1,
      planPricePaise: 100000,
      monthlyFeePaise: 100000,
      status: 'active',
    })

    const legacyPayment = await MonthlyPayment.create({
      member: member._id,
      memberId: member.memberId,
      billingMonth: '2026-01',
      dueAmountPaise: 100000,
      amountPaidPaise: 0,
      balancePaise: 100000,
      dueDate: new Date('2026-02-15T00:00:00+05:30'),
      status: 'unpaid',
      dueState: 'unpaid',
      periodStart: new Date('2026-01-15T00:00:00+05:30'),
      // periodEnd omitted to simulate legacy record
    })

    // 1. Dry run
    const dryRunResult = await runVerifyAndBackfill(false)
    expect(dryRunResult.dryRun).toBe(true)
    expect(dryRunResult.totalMembers).toBe(1)
    expect(dryRunResult.validMembers).toBe(1)
    expect(dryRunResult.paymentsMissingPeriodEnd).toBe(1)
    expect(dryRunResult.backfilledPeriodEnd).toBe(0)

    const untouched = await MonthlyPayment.findById(legacyPayment._id)
    expect(untouched!.periodEnd).toBeFalsy()

    // 2. Apply run
    const applyResult = await runVerifyAndBackfill(true)
    expect(applyResult.dryRun).toBe(false)
    expect(applyResult.paymentsMissingPeriodEnd).toBe(1)
    expect(applyResult.backfilledPeriodEnd).toBe(1)

    const updated = await MonthlyPayment.findById(legacyPayment._id)
    expect(updated!.periodEnd).toBeDefined()
    expect(updated!.periodEnd).toBeTruthy()

    // 3. Repeated run (idempotency check)
    const secondApply = await runVerifyAndBackfill(true)
    expect(secondApply.paymentsMissingPeriodEnd).toBe(0)
    expect(secondApply.backfilledPeriodEnd).toBe(0)
  })
})
