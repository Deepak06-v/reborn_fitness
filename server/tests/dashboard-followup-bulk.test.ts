import type { Express } from 'express'
import { Types } from 'mongoose'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { BulkPaymentOperation } from '../src/models/BulkPaymentOperation'
import { Member } from '../src/models/Member'
import { MonthlyPayment } from '../src/models/MonthlyPayment'
import { getFollowUpMembers } from '../src/services/dashboard'
import { bulkRecordPayments } from '../src/services/payments'
import {
  clearDatabase,
  createAdmin,
  istDay,
  loadApp,
  loginAgent,
  setupTestEnv,
  teardownTestEnv,
  TEST_ADMIN,
  type AuthedAgent,
} from './helpers/setup'

let app: Express
let session: AuthedAgent

async function addMember(overrides: Record<string, unknown> = {}) {
  const response = await session.agent
    .post('/api/admin/members')
    .set('x-csrf-token', session.csrf)
    .send({
      fullName: 'Test Member',
      phone: `98${Math.floor(10000000 + Math.random() * 90000000)}`,
      joiningDate: '2026-06-02',
      planId: 'monthly',
      ...overrides,
    })
    .expect(201)
  return response.body.member as { id: string; memberId: string; fullName: string }
}

async function createBillForMember(
  memberDoc: { id: string; memberId: string },
  opts: {
    billingMonth: string
    periodStart: Date
    periodEnd: Date
    dueDate: Date
    dueAmountPaise: number
    amountPaidPaise?: number
    status?: 'unpaid' | 'partial' | 'paid' | 'overdue'
    paymentEntries?: Array<{
      amountPaise: number
      paymentDate: Date
      method: 'cash' | 'upi' | 'card' | 'bank_transfer' | 'cheque'
      idempotencyKey?: string | null
    }>
  },
) {
  return await MonthlyPayment.create({
    member: memberDoc.id,
    memberId: memberDoc.memberId,
    billingMonth: opts.billingMonth,
    invoiceNumber: `INV-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    planId: 'monthly-1500',
    planName: 'Monthly (₹1,500)',
    durationMonths: 1,
    planPricePaise: opts.dueAmountPaise,
    periodStart: opts.periodStart,
    periodEnd: opts.periodEnd,
    dueAmountPaise: opts.dueAmountPaise,
    amountPaidPaise: opts.amountPaidPaise ?? 0,
    dueDate: opts.dueDate,
    status: opts.status ?? 'unpaid',
    isAutoSettled: false,
    paymentEntries: opts.paymentEntries ?? [],
  })
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
}, 30000)

describe('MANDATORY PRODUCTION VERIFICATION SUITE — TESTS 1 TO 14', () => {
  it('Test 1 — Multiple outstanding periods: Member with 3 unpaid periods; all 3 settled in chronological order', async () => {
    const member = await addMember({
      fullName: 'Rahul Sharma',
      joiningDate: '2026-08-01',
      planId: 'monthly-1500',
    })

    // Remove auto-settled bill so we have exact 3 test bills
    await MonthlyPayment.deleteMany({ member: member.id })

    // Create 3 unpaid periods: Sept, Oct, Nov
    const billSept = await createBillForMember(member, {
      billingMonth: '2026-09',
      periodStart: new Date('2026-09-01T00:00:00+05:30'),
      periodEnd: new Date('2026-10-01T00:00:00+05:30'),
      dueDate: new Date('2026-09-01T00:00:00+05:30'),
      dueAmountPaise: 150000,
    })
    const billOct = await createBillForMember(member, {
      billingMonth: '2026-10',
      periodStart: new Date('2026-10-01T00:00:00+05:30'),
      periodEnd: new Date('2026-11-01T00:00:00+05:30'),
      dueDate: new Date('2026-10-01T00:00:00+05:30'),
      dueAmountPaise: 150000,
    })
    const billNov = await createBillForMember(member, {
      billingMonth: '2026-11',
      periodStart: new Date('2026-11-01T00:00:00+05:30'),
      periodEnd: new Date('2026-12-01T00:00:00+05:30'),
      dueDate: new Date('2026-11-01T00:00:00+05:30'),
      dueAmountPaise: 150000,
    })

    const opId = `bulk_test_1_${Date.now()}`
    const res = await session.agent
      .post('/api/admin/payments/bulk-record')
      .set('x-csrf-token', session.csrf)
      .send({ memberIds: [member.id], operationId: opId })
      .expect(200)

    expect(res.body.successfulCount).toBe(1)
    expect(res.body.totalAmountPaise).toBe(450000)

    // Verify all 3 bills are marked paid
    const updatedSept = await MonthlyPayment.findById(billSept._id)
    const updatedOct = await MonthlyPayment.findById(billOct._id)
    const updatedNov = await MonthlyPayment.findById(billNov._id)

    expect(updatedSept!.status).toBe('paid')
    expect(updatedSept!.amountPaidPaise).toBe(150000)
    expect(updatedOct!.status).toBe('paid')
    expect(updatedOct!.amountPaidPaise).toBe(150000)
    expect(updatedNov!.status).toBe('paid')
    expect(updatedNov!.amountPaidPaise).toBe(150000)

    // Verify operation snapshot records chronological order
    const op = await BulkPaymentOperation.findOne({ operationId: opId })
    expect(op).toBeDefined()
    expect(op!.targets).toHaveLength(3)
    expect(op!.targets[0].paymentId.toString()).toBe(billSept._id.toString())
    expect(op!.targets[1].paymentId.toString()).toBe(billOct._id.toString())
    expect(op!.targets[2].paymentId.toString()).toBe(billNov._id.toString())
    expect(op!.targets.every((t) => t.status === 'success')).toBe(true)
  })

  it('Test 2 — Accurate total: Dashboard shows ₹4,500, bulk payment records ₹4,500, not ₹1,500', async () => {
    const member = await addMember({
      fullName: 'Accurate Total Member',
      joiningDate: '2026-08-01',
      planId: 'monthly-1500',
    })
    await MonthlyPayment.deleteMany({ member: member.id })

    await createBillForMember(member, {
      billingMonth: '2026-09',
      periodStart: new Date('2026-09-01T00:00:00+05:30'),
      periodEnd: new Date('2026-10-01T00:00:00+05:30'),
      dueDate: new Date('2026-09-01T00:00:00+05:30'),
      dueAmountPaise: 150000,
    })
    await createBillForMember(member, {
      billingMonth: '2026-10',
      periodStart: new Date('2026-10-01T00:00:00+05:30'),
      periodEnd: new Date('2026-11-01T00:00:00+05:30'),
      dueDate: new Date('2026-10-01T00:00:00+05:30'),
      dueAmountPaise: 150000,
    })
    await createBillForMember(member, {
      billingMonth: '2026-11',
      periodStart: new Date('2026-11-01T00:00:00+05:30'),
      periodEnd: new Date('2026-12-01T00:00:00+05:30'),
      dueDate: new Date('2026-11-01T00:00:00+05:30'),
      dueAmountPaise: 150000,
    })

    // Dashboard check
    const followUps = await getFollowUpMembers('2026-11', new Date('2026-11-02T10:00:00+05:30'))
    const found = followUps.find((f) => f.id === member.id)
    expect(found).toBeDefined()
    expect(found!.balancePaise).toBe(450000) // ₹4,500 displayed on dashboard
    expect(found!.months).toBe(3)

    // Bulk record execution
    const res = await session.agent
      .post('/api/admin/payments/bulk-record')
      .set('x-csrf-token', session.csrf)
      .send({ memberIds: [member.id] })
      .expect(200)

    expect(res.body.totalAmountPaise).toBe(450000) // ₹4,500 recorded
    expect(res.body.results[0].amountPaise).toBe(450000)
    expect(res.body.memberResults[0].totalAmountPaise).toBe(450000)
    expect(res.body.memberResults[0].processedRecords).toBe(3)
  })

  it('Test 3 — Partial payment: Member with partial payment on oldest bill; pays remaining balance then subsequent bills', async () => {
    const member = await addMember({
      fullName: 'Partial Member',
      joiningDate: '2026-09-01',
      planId: 'monthly-1500',
    })
    await MonthlyPayment.deleteMany({ member: member.id })

    // Oldest bill has partial payment: ₹1,500 due, ₹500 paid, balance ₹1,000 (100,000 paise)
    const billSept = await createBillForMember(member, {
      billingMonth: '2026-09',
      periodStart: new Date('2026-09-01T00:00:00+05:30'),
      periodEnd: new Date('2026-10-01T00:00:00+05:30'),
      dueDate: new Date('2026-09-01T00:00:00+05:30'),
      dueAmountPaise: 150000,
      amountPaidPaise: 50000,
      status: 'partial',
      paymentEntries: [
        {
          amountPaise: 50000,
          paymentDate: new Date('2026-09-05T00:00:00+05:30'),
          method: 'cash',
        },
      ],
    })

    // Second bill is totally unpaid: ₹1,500 due (150,000 paise)
    const billOct = await createBillForMember(member, {
      billingMonth: '2026-10',
      periodStart: new Date('2026-10-01T00:00:00+05:30'),
      periodEnd: new Date('2026-11-01T00:00:00+05:30'),
      dueDate: new Date('2026-10-01T00:00:00+05:30'),
      dueAmountPaise: 150000,
    })

    // Bulk record execution
    const res = await session.agent
      .post('/api/admin/payments/bulk-record')
      .set('x-csrf-token', session.csrf)
      .send({ memberIds: [member.id] })
      .expect(200)

    // Settle remaining 1,000 + full 1,500 = 2,500 (250,000 paise)
    expect(res.body.totalAmountPaise).toBe(250000)

    const updatedSept = await MonthlyPayment.findById(billSept._id)
    const updatedOct = await MonthlyPayment.findById(billOct._id)

    expect(updatedSept!.status).toBe('paid')
    expect(updatedSept!.amountPaidPaise).toBe(150000)
    expect(updatedSept!.paymentEntries).toHaveLength(2)
    expect(updatedSept!.paymentEntries[1].amountPaise).toBe(100000)

    expect(updatedOct!.status).toBe('paid')
    expect(updatedOct!.amountPaidPaise).toBe(150000)
  })

  it('Test 4 — Retry after successful payment: Re-sending same operationId produces zero duplicate payments', async () => {
    const member = await addMember({
      fullName: 'Retry Member',
      joiningDate: '2026-09-01',
      planId: 'monthly-1500',
    })
    await MonthlyPayment.deleteMany({ member: member.id })

    const bill = await createBillForMember(member, {
      billingMonth: '2026-09',
      periodStart: new Date('2026-09-01T00:00:00+05:30'),
      periodEnd: new Date('2026-10-01T00:00:00+05:30'),
      dueDate: new Date('2026-09-01T00:00:00+05:30'),
      dueAmountPaise: 150000,
    })

    const opId = `op_retry_${Date.now()}`

    // First attempt
    const res1 = await session.agent
      .post('/api/admin/payments/bulk-record')
      .set('x-csrf-token', session.csrf)
      .send({ memberIds: [member.id], operationId: opId })
      .expect(200)

    expect(res1.body.successfulCount).toBe(1)
    expect(res1.body.totalAmountPaise).toBe(150000)

    // Second attempt with identical operationId
    const res2 = await session.agent
      .post('/api/admin/payments/bulk-record')
      .set('x-csrf-token', session.csrf)
      .send({ memberIds: [member.id], operationId: opId })
      .expect(200)

    expect(res2.body.successfulCount).toBe(1)
    expect(res2.body.failedCount).toBe(0)

    // Check payment entries in database - must be exactly 1 entry
    const updatedBill = await MonthlyPayment.findById(bill._id)
    expect(updatedBill!.paymentEntries).toHaveLength(1)
    expect(updatedBill!.amountPaidPaise).toBe(150000)
  })

  it('Test 5 — Server interruption during bulk payment: Retry completes remaining bills without duplicating finished ones', async () => {
    const member = await addMember({
      fullName: 'Interrupted Member',
      joiningDate: '2026-09-01',
      planId: 'monthly-1500',
    })
    await MonthlyPayment.deleteMany({ member: member.id })

    const billA = await createBillForMember(member, {
      billingMonth: '2026-09',
      periodStart: new Date('2026-09-01T00:00:00+05:30'),
      periodEnd: new Date('2026-10-01T00:00:00+05:30'),
      dueDate: new Date('2026-09-01T00:00:00+05:30'),
      dueAmountPaise: 150000,
    })
    const billB = await createBillForMember(member, {
      billingMonth: '2026-10',
      periodStart: new Date('2026-10-01T00:00:00+05:30'),
      periodEnd: new Date('2026-11-01T00:00:00+05:30'),
      dueDate: new Date('2026-10-01T00:00:00+05:30'),
      dueAmountPaise: 150000,
    })

    const opId = `op_interrupted_${Date.now()}`

    // Simulate crash after bill A was written with idempotencyKey
    const keyA = `${opId}_${billA._id}`
    await MonthlyPayment.updateOne(
      { _id: billA._id },
      {
        $set: { amountPaidPaise: 150000, status: 'paid' },
        $push: {
          paymentEntries: {
            amountPaise: 150000,
            paymentDate: new Date(),
            method: 'cash',
            idempotencyKey: keyA,
          },
        },
      },
    )

    // Operation doc persisted before crash in 'pending' state
    const adminRes = await session.agent.get('/api/admin/auth/me')
    const adminId = adminRes.body?.admin?.id || new Types.ObjectId()

    await BulkPaymentOperation.create({
      operationId: opId,
      adminId,
      status: 'pending',
      selectedMemberIds: [member.id],
      paymentDate: new Date(),
      totalPlannedAmountPaise: 300000,
      targets: [
        {
          memberId: member.id,
          memberRef: member.memberId,
          memberName: member.fullName,
          paymentId: billA._id.toString(),
          invoiceNumber: billA.invoiceNumber,
          billingMonth: '2026-09',
          dueDate: billA.dueDate,
          plannedAmountPaise: 150000,
          status: 'success',
          executedAt: new Date(),
        },
        {
          memberId: member.id,
          memberRef: member.memberId,
          memberName: member.fullName,
          paymentId: billB._id.toString(),
          invoiceNumber: billB.invoiceNumber,
          billingMonth: '2026-10',
          dueDate: billB.dueDate,
          plannedAmountPaise: 150000,
          status: 'pending',
        },
      ],
    })

    // Retry invocation using bulkRecordPayments
    const res = await session.agent
      .post('/api/admin/payments/bulk-record')
      .set('x-csrf-token', session.csrf)
      .send({ memberIds: [member.id], operationId: opId })
      .expect(200)

    expect(res.body.successfulCount).toBe(1)

    // Verify bill A was NOT duplicated
    const checkA = await MonthlyPayment.findById(billA._id)
    expect(checkA!.paymentEntries).toHaveLength(1)

    // Verify bill B was completed
    const checkB = await MonthlyPayment.findById(billB._id)
    expect(checkB!.status).toBe('paid')
    expect(checkB!.paymentEntries).toHaveLength(1)

    // Verify operation is now completed
    const op = await BulkPaymentOperation.findOne({ operationId: opId })
    expect(op!.status).toBe('completed')
    expect(op!.targets.every((t) => t.status === 'success')).toBe(true)
  })

  it('Test 6 — New invoice generated after operation started: New invoice is NOT included in retry of older operation', async () => {
    const member = await addMember({
      fullName: 'New Invoice Member',
      joiningDate: '2026-09-01',
      planId: 'monthly-1500',
    })
    await MonthlyPayment.deleteMany({ member: member.id })

    const billA = await createBillForMember(member, {
      billingMonth: '2026-09',
      periodStart: new Date('2026-09-01T00:00:00+05:30'),
      periodEnd: new Date('2026-10-01T00:00:00+05:30'),
      dueDate: new Date('2026-09-01T00:00:00+05:30'),
      dueAmountPaise: 150000,
    })

    const opId = `op_snapshot_test_${Date.now()}`

    // Run first operation on bill A
    await session.agent
      .post('/api/admin/payments/bulk-record')
      .set('x-csrf-token', session.csrf)
      .send({ memberIds: [member.id], operationId: opId })
      .expect(200)

    // Now a new overdue bill B is generated subsequently
    const billB = await createBillForMember(member, {
      billingMonth: '2026-10',
      periodStart: new Date('2026-10-01T00:00:00+05:30'),
      periodEnd: new Date('2026-11-01T00:00:00+05:30'),
      dueDate: new Date('2026-10-01T00:00:00+05:30'),
      dueAmountPaise: 150000,
    })

    // Re-send older operationId
    await session.agent
      .post('/api/admin/payments/bulk-record')
      .set('x-csrf-token', session.csrf)
      .send({ memberIds: [member.id], operationId: opId })
      .expect(200)

    // New invoice bill B must NOT have been settled by older operation snapshot
    const checkB = await MonthlyPayment.findById(billB._id)
    expect(checkB!.status).toBe('unpaid')
    expect(checkB!.amountPaidPaise).toBe(0)
  })

  it('Test 7 — Partial failure: 1 member invalid, 1 valid; valid is recorded, invalid reported, retry only attempts invalid', async () => {
    const validMember = await addMember({
      fullName: 'Valid Member',
      joiningDate: '2026-09-01',
      planId: 'monthly-1500',
    })
    await MonthlyPayment.deleteMany({ member: validMember.id })

    await createBillForMember(validMember, {
      billingMonth: '2026-09',
      periodStart: new Date('2026-09-01T00:00:00+05:30'),
      periodEnd: new Date('2026-10-01T00:00:00+05:30'),
      dueDate: new Date('2026-09-01T00:00:00+05:30'),
      dueAmountPaise: 150000,
    })

    const fakeMemberId = '66f000000000000000000000'
    const opId = `op_part_fail_${Date.now()}`

    const res = await session.agent
      .post('/api/admin/payments/bulk-record')
      .set('x-csrf-token', session.csrf)
      .send({ memberIds: [validMember.id, fakeMemberId], operationId: opId })
      .expect(200)

    expect(res.body.successfulCount).toBe(1)
    expect(res.body.failedCount).toBe(1)

    // Results track invalid member and valid member
    expect(res.body.results.find((r: { memberId: string }) => r.memberId === fakeMemberId)?.error).toBe(
      'Member not found',
    )
    expect(res.body.results.find((r: { memberId: string }) => r.memberId === validMember.id)?.success).toBe(
      true,
    )
    const op = await BulkPaymentOperation.findOne({ operationId: opId })
    expect(op!.targets.every((t) => t.status === 'success')).toBe(true)
  })

  it('Test 8 — Concurrent admins: 2 admins submitting bulk payment simultaneously; only one succeeds, no double payment', async () => {
    const member = await addMember({
      fullName: 'Concurrent Member',
      joiningDate: '2026-09-01',
      planId: 'monthly-1500',
    })
    await MonthlyPayment.deleteMany({ member: member.id })

    const bill = await createBillForMember(member, {
      billingMonth: '2026-09',
      periodStart: new Date('2026-09-01T00:00:00+05:30'),
      periodEnd: new Date('2026-10-01T00:00:00+05:30'),
      dueDate: new Date('2026-09-01T00:00:00+05:30'),
      dueAmountPaise: 150000,
    })

    // Execute 2 concurrent calls racing on the same member
    const [resA, resB] = await Promise.all([
      bulkRecordPayments({ memberIds: [member.id], operationId: `race_1_${Date.now()}` }),
      bulkRecordPayments({ memberIds: [member.id], operationId: `race_2_${Date.now()}` }),
    ])

    const totalSuccessful = resA.successfulCount + resB.successfulCount
    expect(totalSuccessful).toBe(1)

    // Bill must have exactly 1 payment entry and exactly ₹1,500 paid
    const updatedBill = await MonthlyPayment.findById(bill._id)
    expect(updatedBill!.paymentEntries).toHaveLength(1)
    expect(updatedBill!.amountPaidPaise).toBe(150000)
    expect(updatedBill!.status).toBe('paid')
  })

  it('Test 9 — Already paid member: Selected member whose balance is 0 is skipped with informative message and no error', async () => {
    const member = await addMember({
      fullName: 'Zero Balance Member',
      joiningDate: '2026-09-01',
      planId: 'monthly-1500',
    })
    // Auto-settled first month is already paid!
    const bill = await MonthlyPayment.findOne({ member: member.id })
    expect(bill!.status).toBe('paid')

    const res = await session.agent
      .post('/api/admin/payments/bulk-record')
      .set('x-csrf-token', session.csrf)
      .send({ memberIds: [member.id] })
      .expect(200)

    expect(res.body.successfulCount).toBe(0)
    expect(res.body.failedCount).toBe(1)
    expect(res.body.results[0].error).toMatch(/no overdue or due-today bills|already fully paid/i)

    // No new payment entries added
    const recheckBill = await MonthlyPayment.findOne({ member: member.id })
    expect(recheckBill!.paymentEntries).toHaveLength(bill!.paymentEntries.length)
  })

  it('Test 10 — Future billing: Member with overdue bill and future scheduled bill; only overdue bill is settled', async () => {
    const member = await addMember({
      fullName: 'Future Bill Member',
      joiningDate: '2026-09-01',
      planId: 'monthly-1500',
    })
    await MonthlyPayment.deleteMany({ member: member.id })

    // Bill 1: Overdue
    const overdueBill = await createBillForMember(member, {
      billingMonth: '2026-09',
      periodStart: new Date('2026-09-01T00:00:00+05:30'),
      periodEnd: new Date('2026-10-01T00:00:00+05:30'),
      dueDate: new Date('2026-09-01T00:00:00+05:30'),
      dueAmountPaise: 150000,
    })

    // Bill 2: Future due (next month)
    const futureBill = await createBillForMember(member, {
      billingMonth: '2026-12',
      periodStart: new Date('2026-12-01T00:00:00+05:30'),
      periodEnd: new Date('2027-01-01T00:00:00+05:30'),
      dueDate: new Date('2026-12-01T00:00:00+05:30'),
      dueAmountPaise: 150000,
    })

    const res = await session.agent
      .post('/api/admin/payments/bulk-record')
      .set('x-csrf-token', session.csrf)
      .send({ memberIds: [member.id] })
      .expect(200)

    expect(res.body.successfulCount).toBe(1)
    expect(res.body.totalAmountPaise).toBe(150000)

    const checkOverdue = await MonthlyPayment.findById(overdueBill._id)
    const checkFuture = await MonthlyPayment.findById(futureBill._id)

    expect(checkOverdue!.status).toBe('paid')
    expect(checkFuture!.status).toBe('unpaid')
    expect(checkFuture!.amountPaidPaise).toBe(0)
  })

  it('Test 11 — Existing individual payment workflow: Add Payment modal on MemberDetail works normally', async () => {
    const member = await addMember({
      fullName: 'Single Pay Member',
      joiningDate: '2026-09-01',
      planId: 'monthly-1500',
    })
    await MonthlyPayment.deleteMany({ member: member.id })

    const bill = await createBillForMember(member, {
      billingMonth: '2026-09',
      periodStart: new Date('2026-09-01T00:00:00+05:30'),
      periodEnd: new Date('2026-10-01T00:00:00+05:30'),
      dueDate: new Date('2026-09-01T00:00:00+05:30'),
      dueAmountPaise: 150000,
    })

    // Record via individual endpoint with UPI
    const res = await session.agent
      .post(`/api/admin/payments/${bill._id}/entries`)
      .set('x-csrf-token', session.csrf)
      .send({
        amountPaise: 150000,
        paymentDate: istDay(),
        method: 'upi',
        referenceNumber: 'UPI-777888',
        notes: 'Individual portal payment',
      })
      .expect(201)

    expect(res.body.payment.amountPaidPaise).toBe(150000)
    expect(res.body.payment.status).toBe('paid')
    expect(res.body.payment.paymentEntries[0].method).toBe('upi')
    expect(res.body.payment.paymentEntries[0].referenceNumber).toBe('UPI-777888')
  })

  it('Test 12 — Historical data: Past paid billing periods are not modified', async () => {
    const member = await addMember({
      fullName: 'Historical Member',
      joiningDate: '2026-06-01',
      planId: 'monthly-1500',
    })

    const initialBill = await MonthlyPayment.findOne({ member: member.id })
    const originalPaid = initialBill!.amountPaidPaise
    const originalUpdatedAt = initialBill!.updatedAt

    // Trigger follow-up check and bulk operations on other members
    await getFollowUpMembers('2026-11')

    const afterBill = await MonthlyPayment.findById(initialBill!._id)
    expect(afterBill!.amountPaidPaise).toBe(originalPaid)
    expect(afterBill!.status).toBe('paid')
    expect(afterBill!.updatedAt.toISOString()).toBe(originalUpdatedAt.toISOString())
  })

  it('Test 13 — Dashboard accuracy: Overdue count, due-today count, and collections are accurate after operations', async () => {
    const memberA = await addMember({
      fullName: 'Dashboard Member A',
      joiningDate: '2026-09-01',
      planId: 'monthly-1500',
    })
    await MonthlyPayment.deleteMany({ member: memberA.id })

    await createBillForMember(memberA, {
      billingMonth: '2026-09',
      periodStart: new Date('2026-09-01T00:00:00+05:30'),
      periodEnd: new Date('2026-10-01T00:00:00+05:30'),
      dueDate: new Date('2026-09-01T00:00:00+05:30'),
      dueAmountPaise: 150000,
    })

    // Dashboard before bulk record
    const month = istDay().slice(0, 7)
    const dashBefore = await session.agent
      .get(`/api/admin/dashboard?month=${month}`)
      .expect(200)

    const overdueBefore = dashBefore.body.followUpCounts.overdue
    expect(overdueBefore).toBeGreaterThanOrEqual(1)

    // Settle memberA
    await session.agent
      .post('/api/admin/payments/bulk-record')
      .set('x-csrf-token', session.csrf)
      .send({ memberIds: [memberA.id] })
      .expect(200)

    // Dashboard after bulk record
    const dashAfter = await session.agent
      .get(`/api/admin/dashboard?month=${month}`)
      .expect(200)

    expect(dashAfter.body.followUpCounts.overdue).toBe(overdueBefore - 1)
    expect(
      dashAfter.body.overdueMembers.some((m: { memberId: string }) => m.memberId === memberA.memberId),
    ).toBe(false)
  })

  it('Test 14 — Auto-registration: First membership billing period automatically marked as PAID using joiningDate', async () => {
    const joiningDate = '2026-10-22'
    const res = await session.agent
      .post('/api/admin/members')
      .set('x-csrf-token', session.csrf)
      .send({
        fullName: 'Auto Reg Member',
        phone: '9888899999',
        joiningDate,
        planId: 'monthly-1500',
      })
      .expect(201)

    const createdMember = res.body.member
    expect(createdMember).toBeDefined()

    // Query MonthlyPayment for this new member
    const bill = await MonthlyPayment.findOne({ member: createdMember.id })
    expect(bill).toBeDefined()
    expect(bill!.isAutoSettled).toBe(true)
    expect(bill!.status).toBe('paid')
    expect(bill!.dueAmountPaise).toBe(150000)
    expect(bill!.amountPaidPaise).toBe(150000)

    // First billing period starts at joiningDate
    const startStr = bill!.periodStart!.toISOString().slice(0, 10)
    expect(startStr).toBe('2026-10-22')
  })
})
