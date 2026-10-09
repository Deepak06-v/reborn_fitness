import { Types, type FilterQuery, type SortOrder } from 'mongoose'
import { Member, type MemberDoc } from '../models/Member'
import { MonthlyPayment } from '../models/MonthlyPayment'
import { ApiError } from '../utils/errors'
import { currentMonth } from '../utils/month'
import { deriveStatus, outstandingBalance, type PaymentStatus } from '../utils/paymentStatus'
import { isValidPhone, normalizePhone } from '../utils/phone'
import { escapeRegex, paymentStatusExpr } from '../utils/query'
import { serializeMember, serializePayment } from './serializers'

export interface MemberInput {
  fullName: string
  phone: string
  joiningDate: Date
  monthlyFeePaise: number
  email?: string | null
  address?: string | null
  notes?: string | null
  membershipType?: string | null
}

export interface ListMembersParams {
  search?: string
  status?: 'active' | 'inactive'
  paymentStatus?: PaymentStatus
  month?: string
  sort?: string
  page: number
  limit: number
}

function sortSpec(sort?: string): Record<string, SortOrder> {
  switch (sort) {
    case 'name':
      return { fullName: 1 }
    case 'name_desc':
      return { fullName: -1 }
    case 'joining':
      return { joiningDate: 1 }
    case 'joining_desc':
      return { joiningDate: -1 }
    case 'fee':
      return { monthlyFeePaise: -1 }
    case 'fee_asc':
      return { monthlyFeePaise: 1 }
    case 'memberId':
      return { memberId: 1 }
    default:
      return { createdAt: -1 }
  }
}

export async function createMember(input: MemberInput): Promise<MemberDoc> {
  const phone = normalizePhone(input.phone)
  if (!isValidPhone(phone)) {
    throw ApiError.unprocessable('Phone number must contain 10 to 12 digits', [
      { path: 'phone', message: 'Invalid phone number' },
    ])
  }

  const memberId = await Member.generateMemberId()
  return Member.create({
    memberId,
    fullName: input.fullName.trim(),
    phone,
    email: input.email?.trim() || null,
    address: input.address?.trim() || null,
    notes: input.notes?.trim() || null,
    membershipType: input.membershipType?.trim() || null,
    joiningDate: input.joiningDate,
    monthlyFeePaise: input.monthlyFeePaise,
    status: 'active',
  })
}

export async function updateMember(
  id: string,
  patch: Partial<MemberInput> & { status?: 'active' | 'inactive' },
): Promise<MemberDoc> {
  if (!Types.ObjectId.isValid(id)) throw ApiError.notFound('Member not found')
  const member = await Member.findById(id)
  if (!member) throw ApiError.notFound('Member not found')

  if (patch.phone !== undefined) {
    const phone = normalizePhone(patch.phone)
    if (!isValidPhone(phone)) {
      throw ApiError.unprocessable('Phone number must contain 10 to 12 digits', [
        { path: 'phone', message: 'Invalid phone number' },
      ])
    }
    member.phone = phone
  }
  if (patch.fullName !== undefined) member.fullName = patch.fullName.trim()
  if (patch.email !== undefined) member.email = patch.email?.trim() || null
  if (patch.address !== undefined) member.address = patch.address?.trim() || null
  if (patch.notes !== undefined) member.notes = patch.notes?.trim() || null
  if (patch.membershipType !== undefined) {
    member.membershipType = patch.membershipType?.trim() || null
  }
  if (patch.joiningDate !== undefined) member.joiningDate = patch.joiningDate
  if (patch.monthlyFeePaise !== undefined) member.monthlyFeePaise = patch.monthlyFeePaise
  if (patch.status !== undefined) member.status = patch.status

  await member.save()
  return member
}

export async function getMemberOrThrow(id: string): Promise<MemberDoc> {
  if (!Types.ObjectId.isValid(id)) throw ApiError.notFound('Member not found')
  const member = await Member.findById(id)
  if (!member) throw ApiError.notFound('Member not found')
  return member
}

export async function setMemberStatus(
  id: string,
  status: 'active' | 'inactive',
): Promise<MemberDoc> {
  const member = await getMemberOrThrow(id)
  member.status = status
  await member.save()
  return member
}

export async function listMembers(params: ListMembersParams) {
  const filter: FilterQuery<MemberDoc> = {}
  if (params.status) filter.status = params.status
  if (params.search) {
    const rx = new RegExp(escapeRegex(params.search.trim()), 'i')
    filter.$or = [{ fullName: rx }, { memberId: rx }, { phone: rx }]
  }

  const selectedMonth = params.month ?? currentMonth()

  if (params.paymentStatus) {
    const now = new Date()
    const matches = await MonthlyPayment.find({
      billingMonth: selectedMonth,
      $expr: paymentStatusExpr(params.paymentStatus, now),
    })
      .select('member')
      .lean()
    filter._id = { $in: matches.map((match) => match.member) }
  }

  const page = Math.max(params.page, 1)
  const limit = Math.min(Math.max(params.limit, 1), 100)
  const total = await Member.countDocuments(filter)
  const members = await Member.find(filter)
    .sort(sortSpec(params.sort))
    .skip((page - 1) * limit)
    .limit(limit)

  const ids = members.map((member) => member._id)
  const [payments, outstanding] = await Promise.all([
    MonthlyPayment.find({ member: { $in: ids }, billingMonth: selectedMonth }),
    MonthlyPayment.aggregate<{ _id: Types.ObjectId; total: number }>([
      { $match: { member: { $in: ids } } },
      {
        $project: {
          member: 1,
          balance: { $subtract: ['$dueAmountPaise', '$amountPaidPaise'] },
        },
      },
      { $match: { balance: { $gt: 0 } } },
      { $group: { _id: '$member', total: { $sum: '$balance' } } },
    ]),
  ])

  const paymentByMember = new Map(
    payments.map((payment) => [payment.member.toString(), payment]),
  )
  const outstandingByMember = new Map(
    outstanding.map((row) => [row._id.toString(), row.total]),
  )

  const items = members.map((member) => {
    const payment = paymentByMember.get(member._id.toString())
    const outstandingPaise = outstandingByMember.get(member._id.toString()) ?? 0
    return {
      ...serializeMember(member),
      currentMonth: selectedMonth,
      currentMonthPayment: payment
        ? {
            id: payment._id.toString(),
            dueAmountPaise: payment.dueAmountPaise,
            amountPaidPaise: payment.amountPaidPaise,
            balancePaise: outstandingBalance(
              payment.dueAmountPaise,
              payment.amountPaidPaise,
            ),
            dueDate: payment.dueDate.toISOString(),
            status: deriveStatus(
              payment.dueAmountPaise,
              payment.amountPaidPaise,
              payment.dueDate,
            ),
          }
        : null,
      outstandingPaise,
    }
  })

  return {
    items,
    total,
    page,
    limit,
    pages: Math.max(Math.ceil(total / limit), 1),
    month: selectedMonth,
  }
}

export async function getMemberDetail(id: string) {
  const member = await getMemberOrThrow(id)
  const payments = await MonthlyPayment.find({ member: member._id }).sort({
    billingMonth: -1,
  })

  const summary = payments.reduce(
    (acc, payment) => {
      acc.totalBilledPaise += payment.dueAmountPaise
      acc.totalPaidPaise += payment.amountPaidPaise
      acc.totalOutstandingPaise += outstandingBalance(
        payment.dueAmountPaise,
        payment.amountPaidPaise,
      )
      return acc
    },
    { totalBilledPaise: 0, totalPaidPaise: 0, totalOutstandingPaise: 0 },
  )

  return {
    member: serializeMember(member),
    payments: payments.map((payment) => serializePayment(payment)),
    summary,
  }
}
