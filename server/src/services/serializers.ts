import type { MemberDoc } from '../models/Member'
import type { MonthlyPaymentDoc, PaymentEntry } from '../models/MonthlyPayment'
import { paiseToRupees } from '../utils/money'
import { deriveStatus, outstandingBalance } from '../utils/paymentStatus'

export function serializeMember(member: MemberDoc) {
  return {
    id: member._id.toString(),
    memberId: member.memberId,
    fullName: member.fullName,
    phone: member.phone,
    email: member.email,
    address: member.address,
    notes: member.notes,
    membershipType: member.membershipType,
    joiningDate: member.joiningDate.toISOString(),
    monthlyFeePaise: member.monthlyFeePaise,
    monthlyFee: paiseToRupees(member.monthlyFeePaise),
    status: member.status,
    createdAt: member.createdAt.toISOString(),
    updatedAt: member.updatedAt.toISOString(),
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
  return {
    id: payment._id.toString(),
    member: payment.member.toString(),
    memberId: payment.memberId,
    billingMonth: payment.billingMonth,
    dueAmountPaise: payment.dueAmountPaise,
    dueAmount: paiseToRupees(payment.dueAmountPaise),
    amountPaidPaise: payment.amountPaidPaise,
    amountPaid: paiseToRupees(payment.amountPaidPaise),
    balancePaise: balance,
    balance: paiseToRupees(balance),
    dueDate: payment.dueDate.toISOString(),
    status: deriveStatus(
      payment.dueAmountPaise,
      payment.amountPaidPaise,
      payment.dueDate,
    ),
    paymentEntries: payment.paymentEntries.map((entry) => serializeEntry(entry, adminNames)),
    createdAt: payment.createdAt.toISOString(),
    updatedAt: payment.updatedAt.toISOString(),
  }
}
