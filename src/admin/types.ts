export type PaymentMethod = 'cash' | 'upi' | 'bank_transfer' | 'card' | 'other'
export type PaymentStatus = 'unpaid' | 'partial' | 'paid' | 'overdue'
export type MemberStatus = 'active' | 'inactive'
export type AdminRole = 'admin' | 'superadmin'

export interface AdminUser {
  id: string
  username: string
  role: AdminRole
  lastLoginAt: string | null
}

export interface Member {
  id: string
  memberId: string
  fullName: string
  phone: string
  email: string | null
  address: string | null
  notes: string | null
  membershipType: string | null
  joiningDate: string
  monthlyFeePaise: number
  monthlyFee: number
  status: MemberStatus
  createdAt: string
  updatedAt: string
}

export interface CurrentMonthPayment {
  id: string
  dueAmountPaise: number
  amountPaidPaise: number
  balancePaise: number
  dueDate: string
  status: PaymentStatus
}

export interface MemberListItem extends Member {
  currentMonth: string
  currentMonthPayment: CurrentMonthPayment | null
  outstandingPaise: number
}

export interface MemberListResponse {
  items: MemberListItem[]
  total: number
  page: number
  limit: number
  pages: number
  month: string
}

export interface PaymentEntry {
  id: string
  amountPaise: number
  amount: number
  paymentDate: string
  method: PaymentMethod
  referenceNumber: string | null
  notes: string | null
  recordedBy: string | null
  recordedByName: string | null
  recordedAt: string
  voided: boolean
  voidedBy: string | null
  voidedByName: string | null
  voidedAt: string | null
  voidReason: string | null
}

export interface Payment {
  id: string
  member: string
  memberId: string
  billingMonth: string
  dueAmountPaise: number
  dueAmount: number
  amountPaidPaise: number
  amountPaid: number
  balancePaise: number
  balance: number
  dueDate: string
  status: PaymentStatus
  paymentEntries: PaymentEntry[]
  createdAt: string
  updatedAt: string
}

export interface PaymentListItem extends Payment {
  memberName: string
  memberRef: string
  phone: string
}

export interface PaymentListResponse {
  month: string
  items: PaymentListItem[]
  total: number
  page: number
  limit: number
  pages: number
  totals: {
    billedPaise: number
    billed: number
    collectedPaise: number
    collected: number
    remainingPaise: number
    remaining: number
  }
}

export interface MemberDetailResponse {
  member: Member
  payments: Payment[]
  summary: {
    totalBilledPaise: number
    totalPaidPaise: number
    totalOutstandingPaise: number
  }
}

export interface PaymentDetailResponse {
  payment: Payment
  member: Member | null
}

export interface GenerateMonthSummary {
  billingMonth: string
  dueDate: string
  eligible: number
  created: number
  existing: number
}

export interface RecentPayment {
  paymentId: string
  memberName: string
  memberId: string
  amountPaise: number
  amount: number
  paymentDate: string
  method: string
  billingMonth: string
}

export interface OverdueMember {
  id: string
  memberId: string
  fullName: string
  phone: string
  balancePaise: number
  balance: number
  months: number
  oldestDue: string
}

export interface MonthlyTrendPoint {
  month: string
  expectedPaise: number
  expected: number
  collectedPaise: number
  collected: number
  outstandingPaise: number
  outstanding: number
}

export interface DashboardResponse {
  month: string
  metrics: {
    totalActiveMembers: number
    newMembersThisMonth: number
    collectionsThisMonthPaise: number
    collectionsThisMonth: number
    collectionsCount: number
    expectedMonthlyFeesPaise: number
    expectedMonthlyFees: number
    expectedCount: number
    outstandingPaymentsPaise: number
    outstandingPayments: number
    outstandingCount: number
    overduePaymentsPaise: number
    overduePayments: number
    overdueCount: number
  }
  statusOverview: Record<PaymentStatus, number>
  recentMembers: Member[]
  recentPayments: RecentPayment[]
  monthlyTrend: MonthlyTrendPoint[]
  overdueMembers: OverdueMember[]
}
