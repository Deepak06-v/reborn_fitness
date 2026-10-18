import type { MemberDoc } from '../models/Member'
import type { MonthlyPaymentDoc, PaymentEntry } from '../models/MonthlyPayment'
import { getPlan, type MembershipPlan } from '../config/plans'
import { paiseToRupees } from '../utils/money'
import {
  evaluatePaymentStatus,
  outstandingBalance,
} from '../utils/paymentStatus'

export function serializePlan(plan: MembershipPlan) {
  return {
    id: plan.id,
    name: plan.name,
    durationMonths: plan.durationMonths,
    pricePaise: plan.pricePaise,
    price: paiseToRupees(plan.pricePaise),
  }
}

export function serializeMember(member: MemberDoc) {
  const plan = getPlan(member.planId)
  const isIncomplete = !member.joiningDate || !member.planId
  return {
    id: member._id.toString(),
    memberId: member.memberId,
    fullName: member.fullName,
    phone: member.phone,
    email: member.email,
    address: member.address,
    notes: member.notes,
    membershipType: member.membershipType,
    planId: member.planId ?? plan?.id ?? null,
    planName: member.planName ?? plan?.name ?? null,
    planDurationMonths: member.planDurationMonths ?? plan?.durationMonths ?? null,
    planPricePaise: member.planPricePaise ?? plan?.pricePaise ?? null,
    nextBillingDate: member.nextBillingDate ? member.nextBillingDate.toISOString() : null,
    joiningDate: member.joiningDate ? member.joiningDate.toISOString() : null,
    membershipStartDate: member.joiningDate ? member.joiningDate.toISOString() : null,
    monthlyFeePaise: member.monthlyFeePaise ?? 0,
    monthlyFee: paiseToRupees(member.monthlyFeePaise ?? 0),
    status: member.status,
    incomplete: isIncomplete,
    archivedAt: member.archivedAt ? member.archivedAt.toISOString() : null,
    archivedBy: member.archivedBy ? member.archivedBy.toString() : null,
    createdAt: member.createdAt ? member.createdAt.toISOString() : new Date().toISOString(),
    updatedAt: member.updatedAt ? member.updatedAt.toISOString() : new Date().toISOString(),
  }
}

export function serializeEntry(entry: PaymentEntry, adminNames?: Map<string, string>) {
  const recordedBy = entry.recordedBy ? entry.recordedBy.toString() : null
  const voidedBy = entry.voidedBy ? entry.voidedBy.toString() : null
  return {
    id: entry._id.toString(),
    amountPaise: entry.amountPaise,
    amount: paiseToRupees(entry.amountPaise),
    paymentDate: entry.paymentDate.toISOString(),
    method: entry.method,
    referenceNumber: entry.referenceNumber,
    notes: entry.notes,
    recordedBy,
    recordedByName: recordedBy ? adminNames?.get(recordedBy) ?? null : null,
    recordedAt: entry.recordedAt.toISOString(),
    voided: entry.voided,
    voidedBy,
    voidedByName: voidedBy ? adminNames?.get(voidedBy) ?? null : null,
    voidedAt: entry.voidedAt ? entry.voidedAt.toISOString() : null,
    voidReason: entry.voidReason,
  }
}

export function serializePayment(
  payment: MonthlyPaymentDoc,
  adminNames?: Map<string, string>,
): Record<string, unknown> {
  const balance = outstandingBalance(payment.dueAmountPaise, payment.amountPaidPaise)
  const plan = getPlan(payment.planId)
  const effectiveEnd = payment.periodEnd ?? payment.dueDate
  const evalResult = evaluatePaymentStatus(
    payment.dueAmountPaise,
    payment.amountPaidPaise,
    effectiveEnd,
  )

  return {
    id: payment._id.toString(),
    member: payment.member.toString(),
    memberId: payment.memberId,
    billingMonth: payment.billingMonth,
    invoiceNumber: payment.invoiceNumber,
    planId: payment.planId ?? plan?.id ?? null,
    planName: payment.planName ?? plan?.name ?? null,
    durationMonths: payment.durationMonths ?? null,
    planPricePaise: payment.planPricePaise ?? null,
    periodStart: payment.periodStart ? payment.periodStart.toISOString() : null,
    periodEnd: payment.periodEnd ? payment.periodEnd.toISOString() : null,
    dueAmountPaise: payment.dueAmountPaise,
    dueAmount: paiseToRupees(payment.dueAmountPaise),
    amountPaidPaise: payment.amountPaidPaise,
    amountPaid: paiseToRupees(payment.amountPaidPaise),
    balancePaise: balance,
    balance: paiseToRupees(balance),
    dueDate: payment.dueDate.toISOString(),
    status: evalResult.status,
    dueState: evalResult.dueState,
    statusTone: evalResult.tone,
    statusLabel: evalResult.label,
    daysLeft: evalResult.daysLeft,
    sortGroup: evalResult.sortGroup,
    paymentEntries: payment.paymentEntries.map((entry) => serializeEntry(entry, adminNames)),
    createdAt: payment.createdAt.toISOString(),
    updatedAt: payment.updatedAt.toISOString(),
  }
}
