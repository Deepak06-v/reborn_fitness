export type PaymentMethod = 'cash' | 'upi' | 'bank_transfer' | 'card' | 'other' | 'auto_registration'
export type PaymentStatus = 'unpaid' | 'partial' | 'paid' | 'overdue'
export type DueState = 'paid' | 'unpaid' | 'due_soon' | 'overdue'
export type PaymentFilterStatus = DueState
export type MemberStatus = 'active' | 'inactive'
export type AdminRole = 'admin' | 'superadmin' | 'owner' | 'staff'
export type DueTone = 'lime' | 'accent' | 'danger' | 'neutral'

export interface Plan {
  id: string
  name: string
  durationMonths: number
  durationDays?: number | null
  pricePaise: number
  price: number
}

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
  planId: string | null
  planName: string | null
  planDurationMonths: number | null
  planDurationDays?: number | null
  planPricePaise: number | null
  nextBillingDate: string | null
  joiningDate: string
  membershipStartDate: string
  monthlyFeePaise: number
  monthlyFee: number
  status: MemberStatus
  incomplete?: boolean
  createdAt: string
  updatedAt: string
}

export interface CurrentMonthPayment {
  id: string
  invoiceNumber: string | null
  planName: string | null
  periodStart: string | null
  periodEnd: string | null
  dueAmountPaise: number
  amountPaidPaise: number
  balancePaise: number
  dueDate: string
  status: PaymentStatus
  dueState: DueState
  statusTone?: DueTone
  statusLabel?: string
  daysLeft?: number | null
  sortGroup?: number
  isAutoSettled?: boolean
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
  invoiceNumber: string | null
  planId: string | null
  planName: string | null
  durationMonths: number | null
  durationDays?: number | null
  planPricePaise: number | null
  periodStart: string | null
  periodEnd: string | null
  dueAmountPaise: number
  dueAmount: number
  amountPaidPaise: number
  amountPaid: number
  balancePaise: number
  balance: number
  dueDate: string
  status: PaymentStatus
  dueState: DueState
  statusTone?: DueTone
  statusLabel?: string
  daysLeft?: number | null
  sortGroup?: number
  isAutoSettled?: boolean
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
  month: string | null
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
    paidCount?: number
    urgentCount?: number
    thisWeekCount?: number
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

export type FollowUpStatus = 'overdue' | 'due_today'

export interface PaymentFollowUpItem {
  id: string
  memberId: string
  fullName: string
  phone: string
  planName: string
  balancePaise: number
  balance: number
  months: number
  oldestDue: string
  dueDate: string
  paymentId: string
  status: FollowUpStatus
  statusLabel: 'Overdue' | 'Due Today'
}

export interface BulkRecordResultItem {
  memberId: string
  memberRef?: string
  memberName?: string
  success: boolean
  paymentId?: string
  invoiceNumber?: string | null
  amountPaise?: number
  amount?: number
  error?: string
}

export interface BulkRecordTargetResult {
  paymentId: string
  billingMonth: string
  dueDate: string
  invoiceNumber: string | null
  amountPaise: number
  amount: number
  status: 'success' | 'failed' | 'already_paid'
  error?: string | null
}

export interface MemberBulkResult {
  memberId: string
  memberRef: string
  memberName: string
  totalRecords: number
  processedRecords: number
  totalAmountPaise: number
  totalAmount: number
  success: boolean
  records: BulkRecordTargetResult[]
}

export interface BulkRecordResponse {
  operationId?: string
  total: number
  successfulCount: number
  failedCount: number
  totalAmountPaise?: number
  totalAmount?: number
  memberResults?: MemberBulkResult[]
  results: BulkRecordResultItem[]
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
  dueDate?: string
  planName?: string
  paymentId?: string
  status?: FollowUpStatus
  statusLabel?: string
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
    dueTodayPaymentsPaise?: number
    dueTodayPayments?: number
    dueTodayCount?: number
  }
  statusOverview: Record<PaymentStatus, number>
  recentMembers: Member[]
  recentPayments: RecentPayment[]
  monthlyTrend: MonthlyTrendPoint[]
  overdueMembers: (OverdueMember | PaymentFollowUpItem)[]
  dueTodayMembers?: PaymentFollowUpItem[]
  paymentFollowUp?: PaymentFollowUpItem[]
  followUpCounts?: {
    overdue: number
    dueToday: number
    total: number
  }
}

export type WhatsAppDeliveryStatus =
  | 'not_sent'
  | 'queued'
  | 'sent'
  | 'delivered'
  | 'read'
  | 'failed'

export type WhatsAppConnectionState =
  | 'disabled'
  | 'not_configured'
  | 'unreachable'
  | 'disconnected'
  | 'connected'
  | 'unavailable'

export interface WhatsAppStatusResponse {
  provider?: string
  isConfigured: boolean
  isEnabled: boolean
  instanceName?: string | null
  sessionId?: string | null
  webhookPath: string
  connectionState?: WhatsAppConnectionState
  rawState?: string
  apiVersion?: string
  graphApiVersion?: string
  phoneNumberId?: string | null
  businessAccountId?: string | null
}

export interface WhatsAppNotificationState {
  status: WhatsAppDeliveryStatus
  sentAt: string | null
  deliveredAt: string | null
  readAt: string | null
  error: string | null
}

export interface WhatsAppUpcomingItem {
  paymentId: string
  memberId: string
  memberName: string
  phone: string
  planName: string
  dueDate: string
  dueAmount: number
  daysLeft: number
  notification: WhatsAppNotificationState
}

export interface WhatsAppOverdueItem {
  paymentId: string
  memberId: string
  memberName: string
  phone: string
  planName: string
  dueDate: string
  dueAmount: number
  daysOverdue: number
  notification: WhatsAppNotificationState
}

export interface WhatsAppCampaignItem {
  id: string
  name: string
  message: string
  mediaUrl: string | null
  recipientFilter: string
  recipientCount: number
  stats: {
    processed?: number
    sent: number
    delivered: number
    read: number
    failed: number
    paused?: number
    remaining?: number
  }
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'paused'
  error?: string | null
  createdAt: string
  completedAt: string | null
}

export interface WhatsAppHistoryItem {
  id: string
  memberId: string
  memberName: string
  phoneNumber: string
  type: string
  provider?: string
  status: WhatsAppDeliveryStatus
  attempts?: number
  lastAttemptAt?: string | null
  pausedAt?: string | null
  message: string | null
  mediaUrl: string | null
  sentAt: string | null
  deliveredAt: string | null
  readAt: string | null
  error: string | null
  createdAt: string
}

export interface WhatsAppHistoryResponse {
  items: WhatsAppHistoryItem[]
  page: number
  limit: number
  total: number
  hasMore: boolean
}

export interface WhatsAppCampaignsResponse {
  items: WhatsAppCampaignItem[]
  page: number
  limit: number
  total: number
  hasMore: boolean
}

