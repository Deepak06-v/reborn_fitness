import { Types } from 'mongoose'
import { env } from '../../config/env'
import { Member, type MemberDoc } from '../../models/Member'
import { MonthlyPayment, type MonthlyPaymentDoc } from '../../models/MonthlyPayment'
import { WhatsAppCampaign, type WhatsAppCampaignDoc } from '../../models/WhatsAppCampaign'
import {
  WhatsAppNotification,
  type WhatsAppDeliveryStatus,
  type WhatsAppNotificationDoc,
} from '../../models/WhatsAppNotification'
import { paiseToRupees } from '../../utils/money'
import { formatDDMMYYYY, istDay } from '../../utils/month'
import { calendarDaysDifference } from '../../utils/paymentStatus'
import { formatWhatsAppPhone, normalizePhone } from '../../utils/phone'
import { MetaCloudWhatsAppProvider } from './meta-cloud-whatsapp.provider'
import { MockWhatsAppProvider } from './mock-whatsapp.provider'
import { WhatsAppError } from './whatsapp.errors'
import type { WhatsAppProvider } from './whatsapp.provider'
import {
  buildOverdueTemplateComponents,
  buildUpcomingDueTemplateComponents,
  formatOverdueMessage,
  formatUpcomingDueMessage,
  getApprovedTemplateConfig,
} from './whatsapp.templates'
import type {
  MetaWebhookMessage,
  MetaWebhookPayload,
  MetaWebhookStatus,
} from './whatsapp.types'
import { outboundQueueService } from './outbound-queue.service'

const STATUS_RANKS: Record<WhatsAppDeliveryStatus, number> = {
  not_sent: 0,
  queued: 1,
  sending: 1,
  paused: 1,
  sent: 2,
  delivered: 3,
  read: 4,
  failed: -1,
}

class WhatsAppService {
  private provider: WhatsAppProvider

  constructor() {
    this.provider = this.createProvider()
  }

  private createProvider(): WhatsAppProvider {
    if (
      env.whatsappProvider === 'cloud_api' &&
      env.isWhatsAppEnabled &&
      env.WHATSAPP_ACCESS_TOKEN &&
      env.WHATSAPP_PHONE_NUMBER_ID
    ) {
      return new MetaCloudWhatsAppProvider({
        graphApiVersion: env.WHATSAPP_GRAPH_API_VERSION,
        accessToken: env.WHATSAPP_ACCESS_TOKEN,
        phoneNumberId: env.WHATSAPP_PHONE_NUMBER_ID,
        businessAccountId: env.WHATSAPP_BUSINESS_ACCOUNT_ID,
        appSecret: env.WHATSAPP_APP_SECRET,
        webhookVerifyToken: env.WHATSAPP_WEBHOOK_VERIFY_TOKEN,
      })
    }
    return new MockWhatsAppProvider(env.isWhatsAppConfigured)
  }

  /** Allows tests or dynamic reconfiguration to inject a custom provider */
  setProvider(provider: WhatsAppProvider): void {
    this.provider = provider
  }

  getProvider(): WhatsAppProvider {
    return this.provider
  }

  getProviderName(): string {
    if (this.provider instanceof MetaCloudWhatsAppProvider) return 'cloud_api'
    if (this.provider instanceof MockWhatsAppProvider) {
      return env.whatsappProvider === 'cloud_api' ? 'cloud_api' : 'mock'
    }
    return env.whatsappProvider || 'mock'
  }

  get isConfigured(): boolean {
    return this.provider.isConfigured || env.isWhatsAppConfigured
  }

  get isEnabled(): boolean {
    return this.provider.isConfigured || env.isWhatsAppEnabled
  }

  /**
   * Identifies all active members whose current fee is due in exactly 2 days.
   */
  async getUpcomingFeeDueMembers(now: Date = new Date()): Promise<
    Array<{
      member: MemberDoc
      payment: MonthlyPaymentDoc
      daysLeft: number
      latestNotification: WhatsAppNotificationDoc | null
    }>
  > {
    const members = await Member.find({ status: 'active' })
      .select('_id memberId fullName phone planName')
      .lean()
    const memberIds = members.map((m) => m._id)

    const payments = await MonthlyPayment.find({
      member: { $in: memberIds },
      status: { $in: ['unpaid', 'partial'] },
    })
      .select('_id member memberId dueDate dueAmountPaise amountPaidPaise planName')
      .sort({ dueDate: 1 })
      .lean()

    const memberMap = new Map(members.map((m) => [m._id.toString(), m]))
    const candidatePayments: Array<{
      member: any
      payment: any
      daysLeft: number
      dedupKey: string
    }> = []

    for (const payment of payments) {
      const diff = calendarDaysDifference(payment.dueDate, now)
      if (diff === 2) {
        const member = memberMap.get(payment.member.toString())
        if (!member) continue

        const dedupKey = `${member.memberId}_FEE_DUE_2_DAYS_${istDay(payment.dueDate)}`
        candidatePayments.push({
          member,
          payment,
          daysLeft: diff,
          dedupKey,
        })
      }
    }

    if (candidatePayments.length === 0) {
      return []
    }

    const dedupKeys = candidatePayments.map((c) => c.dedupKey)
    const notifications = await WhatsAppNotification.find({
      dedupKey: { $in: dedupKeys },
    }).lean()
    const notifMap = new Map(notifications.map((n) => [n.dedupKey, n]))

    return candidatePayments.map((item) => ({
      member: item.member as unknown as MemberDoc,
      payment: item.payment as unknown as MonthlyPaymentDoc,
      daysLeft: item.daysLeft,
      latestNotification: ((notifMap.get(item.dedupKey) as unknown) as WhatsAppNotificationDoc) || null,
    }))
  }

  /**
   * Identifies all active members whose current fee is overdue.
   */
  async getOverdueMembers(now: Date = new Date()): Promise<
    Array<{
      member: MemberDoc
      payment: MonthlyPaymentDoc
      daysOverdue: number
      latestNotification: WhatsAppNotificationDoc | null
    }>
  > {
    const today = istDay(now)
    const members = await Member.find({ status: 'active' })
      .select('_id memberId fullName phone planName')
      .lean()
    const memberIds = members.map((m) => m._id)

    const payments = await MonthlyPayment.find({
      member: { $in: memberIds },
      status: { $in: ['unpaid', 'partial'] },
    })
      .select('_id member memberId dueDate dueAmountPaise amountPaidPaise planName')
      .sort({ dueDate: 1 })
      .lean()

    const memberMap = new Map(members.map((m) => [m._id.toString(), m]))
    const candidatePayments: Array<{
      member: any
      payment: any
      daysOverdue: number
      dedupKey: string
    }> = []

    for (const payment of payments) {
      const balance = payment.dueAmountPaise - payment.amountPaidPaise
      if (balance <= 0) continue

      const diff = calendarDaysDifference(payment.dueDate, now)
      if (diff < 0) {
        const daysOverdue = Math.abs(diff)
        const member = memberMap.get(payment.member.toString())
        if (!member) continue

        const dedupKey = `${member.memberId}_FEE_OVERDUE_${today}`
        candidatePayments.push({
          member,
          payment,
          daysOverdue,
          dedupKey,
        })
      }
    }

    if (candidatePayments.length === 0) {
      return []
    }

    const dedupKeys = candidatePayments.map((c) => c.dedupKey)
    const notifications = await WhatsAppNotification.find({
      dedupKey: { $in: dedupKeys },
    }).lean()
    const notifMap = new Map(notifications.map((n) => [n.dedupKey, n]))

    return candidatePayments.map((item) => ({
      member: item.member as unknown as MemberDoc,
      payment: item.payment as unknown as MonthlyPaymentDoc,
      daysOverdue: item.daysOverdue,
      latestNotification: ((notifMap.get(item.dedupKey) as unknown) as WhatsAppNotificationDoc) || null,
    }))
  }

  /**
   * Sends the automatic Fee Due in 2 Days reminder to a specific member/payment.
   * Enforces deduplication using memberId + FEE_DUE_2_DAYS + dueDate.
   * Formats proper approved Meta template payload components.
   */
  async sendUpcomingDueReminder(
    member: MemberDoc,
    payment: MonthlyPaymentDoc,
    now: Date = new Date(),
  ): Promise<WhatsAppNotificationDoc | null> {
    const dueDayStr = istDay(payment.dueDate)
    const dedupKey = `${member.memberId}_FEE_DUE_2_DAYS_${dueDayStr}`

    // 1. Mandatory deduplication check
    const existing = await WhatsAppNotification.findOne({ dedupKey })
    if (existing) {
      return existing
    }

    const templateConfig = getApprovedTemplateConfig('FEE_DUE_2_DAYS')

    const recipientPhone = formatWhatsAppPhone(member.phone)
    if (!recipientPhone) {
      const failedRecord = await WhatsAppNotification.create({
        member: member._id,
        memberId: member.memberId,
        phoneNumber: member.phone,
        type: 'FEE_DUE_2_DAYS',
        dedupKey,
        payment: payment._id,
        templateName: templateConfig.templateName,
        provider: this.getProviderName(),
        status: 'failed',
        error: 'Invalid recipient phone number',
        failedAt: now,
      })
      return failedRecord
    }

    const balancePaise = Math.max(payment.dueAmountPaise - payment.amountPaidPaise, 0)
    const amountStr = paiseToRupees(balancePaise).toLocaleString('en-IN')
    const dueDateStr = formatDDMMYYYY(payment.dueDate)
    const planName = payment.planName || member.planName || 'Monthly'

    const components = buildUpcomingDueTemplateComponents({
      memberName: member.fullName,
      planName,
      dueDate: dueDateStr,
      amountDue: amountStr,
    })

    const messageText = formatUpcomingDueMessage({
      memberName: member.fullName,
      planName,
      dueDate: dueDateStr,
      amountDue: amountStr,
    })

    // Create record first in queued state with template metadata
    const notification = await WhatsAppNotification.create({
      member: member._id,
      memberId: member.memberId,
      phoneNumber: recipientPhone,
      type: 'FEE_DUE_2_DAYS',
      dedupKey,
      payment: payment._id,
      templateName: templateConfig.templateName,
      message: messageText,
      provider: this.getProviderName(),
      status: 'queued',
      metadata: {
        amountDue: amountStr,
        dueDate: dueDateStr,
        planName,
        languageCode: templateConfig.languageCode,
        components,
      },
    })

    // If WhatsApp integration is not enabled, mark not_sent
    if (!this.isEnabled) {
      notification.status = 'not_sent'
      notification.error = 'WhatsApp integration disabled / not configured'
      await notification.save()
      return notification
    }

    // Process through shared persistent queue and rate limiter
    await outboundQueueService.dispatchPending()
    const updated = await WhatsAppNotification.findById(notification._id)
    return updated || notification
  }

  /**
   * Sends the automatic Daily Overdue Fee reminder to an unpaid member.
   * Stops immediately if member is paid.
   * Deduplicates per member per calendar day.
   * Formats proper approved Meta template payload components.
   */
  async sendOverdueReminder(
    member: MemberDoc,
    payment: MonthlyPaymentDoc,
    now: Date = new Date(),
  ): Promise<WhatsAppNotificationDoc | null> {
    const balance = payment.dueAmountPaise - payment.amountPaidPaise
    if (balance <= 0 || payment.status === 'paid') {
      return null
    }

    const todayStr = istDay(now)
    const dedupKey = `${member.memberId}_FEE_OVERDUE_${todayStr}`

    // Deduplication check: once per calendar day
    const existing = await WhatsAppNotification.findOne({ dedupKey })
    if (existing) {
      return existing
    }

    const templateConfig = getApprovedTemplateConfig('FEE_OVERDUE')

    const recipientPhone = formatWhatsAppPhone(member.phone)
    if (!recipientPhone) {
      const failedRecord = await WhatsAppNotification.create({
        member: member._id,
        memberId: member.memberId,
        phoneNumber: member.phone,
        type: 'FEE_OVERDUE',
        dedupKey,
        payment: payment._id,
        templateName: templateConfig.templateName,
        provider: this.getProviderName(),
        status: 'failed',
        error: 'Invalid recipient phone number',
        failedAt: now,
      })
      return failedRecord
    }

    const daysOverdue = Math.max(Math.abs(calendarDaysDifference(payment.dueDate, now)), 1)
    const amountStr = paiseToRupees(balance).toLocaleString('en-IN')
    const planName = payment.planName || member.planName || 'Monthly'

    const components = buildOverdueTemplateComponents({
      memberName: member.fullName,
      planName,
      daysOverdue,
      amountDue: amountStr,
    })

    const messageText = formatOverdueMessage({
      memberName: member.fullName,
      planName,
      daysOverdue,
      amountDue: amountStr,
    })

    const notification = await WhatsAppNotification.create({
      member: member._id,
      memberId: member.memberId,
      phoneNumber: recipientPhone,
      type: 'FEE_OVERDUE',
      dedupKey,
      payment: payment._id,
      templateName: templateConfig.templateName,
      message: messageText,
      provider: this.getProviderName(),
      status: 'queued',
      metadata: {
        daysOverdue,
        amountDue: amountStr,
        planName,
        languageCode: templateConfig.languageCode,
        components,
      },
    })

    if (!this.isEnabled) {
      notification.status = 'not_sent'
      notification.error = 'WhatsApp integration disabled / not configured'
      await notification.save()
      return notification
    }

    // Process through shared persistent queue and rate limiter
    await outboundQueueService.dispatchPending()
    const updated = await WhatsAppNotification.findById(notification._id)
    return updated || notification
  }

  /**
   * Filters members for custom broadcast messages based on requested filter and marketing consent.
   */
  async getRecipientsForFilter(
    filter: string,
    planId?: string,
    requireMarketingConsent = false,
  ): Promise<MemberDoc[]> {
    const baseQuery: Record<string, unknown> = {}

    if (requireMarketingConsent || filter === 'opted_in' || filter === 'marketing') {
      baseQuery.whatsappMarketingOptIn = true
    }

    if (filter === 'active' || filter === 'opted_in' || filter === 'marketing') {
      baseQuery.status = 'active'
      return Member.find(baseQuery)
    }

    if (filter === 'overdue') {
      const now = new Date()
      const activeMembers = await Member.find({ ...baseQuery, status: 'active' })
      const activeMap = new Map(activeMembers.map((m) => [m._id.toString(), m]))
      const payments = await MonthlyPayment.find({
        member: { $in: activeMembers.map((m) => m._id) },
        status: { $in: ['unpaid', 'partial'] },
      })
      const overdueMemberIds = new Set<string>()
      for (const p of payments) {
        if (p.dueAmountPaise > p.amountPaidPaise && calendarDaysDifference(p.dueDate, now) < 0) {
          overdueMemberIds.add(p.member.toString())
        }
      }
      return [...overdueMemberIds].map((id) => activeMap.get(id)!).filter(Boolean)
    }

    if (filter === 'plan' && planId) {
      baseQuery.status = 'active'
      baseQuery.planId = planId
      return Member.find(baseQuery)
    }

    // Default: 'all'
    return Member.find(baseQuery)
  }

  /**
   * Creates a custom broadcast campaign and enqueues messages into the shared persistent queue.
   */
  async createAndSendCampaign(params: {
    name: string
    message: string
    mediaUrl?: string | null
    recipientFilter: string
    planId?: string
    adminId: string
    requireMarketingConsent?: boolean
    waitForCompletion?: boolean
  }): Promise<WhatsAppCampaignDoc> {
    const recipients = await this.getRecipientsForFilter(
      params.recipientFilter,
      params.planId,
      params.requireMarketingConsent,
    )
    if (recipients.length === 0) {
      throw new WhatsAppError('No recipients match the selected filter', 400, 'NO_RECIPIENTS')
    }

    const campaign = await WhatsAppCampaign.create({
      name: params.name,
      message: params.message,
      mediaUrl: params.mediaUrl || null,
      recipientFilter: params.recipientFilter,
      recipientCount: recipients.length,
      stats: { sent: 0, delivered: 0, read: 0, failed: 0, paused: 0 },
      status: 'processing',
      createdBy: new Types.ObjectId(params.adminId),
    })

    // Enqueue all recipient notifications in the shared persistent queue
    for (const member of recipients) {
      const recipientPhone = formatWhatsAppPhone(member.phone)
      if (!recipientPhone) {
        await WhatsAppNotification.create({
          member: member._id,
          memberId: member.memberId,
          phoneNumber: member.phone,
          type: 'CUSTOM',
          campaign: campaign._id,
          message: params.message,
          mediaUrl: params.mediaUrl || null,
          provider: this.getProviderName(),
          status: 'failed',
          error: 'Invalid recipient phone number',
          failedAt: new Date(),
        })
        continue
      }

      await WhatsAppNotification.create({
        member: member._id,
        memberId: member.memberId,
        phoneNumber: recipientPhone,
        type: 'CUSTOM',
        campaign: campaign._id,
        message: params.message,
        mediaUrl: params.mediaUrl || null,
        provider: this.getProviderName(),
        status: 'queued',
      })
    }

    // Refresh campaign stats based on enqueued records
    await outboundQueueService.updateCampaignProgress(campaign._id)

    // Trigger sequential processing through the shared rate-limited queue
    if (params.waitForCompletion) {
      await outboundQueueService.dispatchPending()
      const updated = await WhatsAppCampaign.findById(campaign._id)
      return updated || campaign
    } else {
      outboundQueueService.dispatchPending().catch((err) => {
        // eslint-disable-next-line no-console
        console.error(`[whatsapp] Campaign ${campaign._id} dispatch error:`, err)
      })
      return campaign
    }
  }

  /**
   * Updates notification status with strict state hierarchy and idempotent campaign stats.
   * Prevents out-of-order events from downgrading a stronger known status.
   */
  async updateNotificationStatus(
    messageId: string,
    newStatus: WhatsAppDeliveryStatus,
    timestamp: Date = new Date(),
    errorDetails?: string,
  ): Promise<boolean> {
    if (!messageId) return false

    const notification = await WhatsAppNotification.findOne({ messageId })
    if (!notification) return false

    const prevStatus = notification.status
    const prevRank = STATUS_RANKS[prevStatus] ?? 0
    const newRank = STATUS_RANKS[newStatus] ?? 0

    // Hierarchy rule: do not downgrade higher status
    // read (4) > delivered (3) > sent (2) > queued (1) > not_sent (0)
    // If incoming is failed, cannot fail a message that was already delivered or read
    if (newStatus === 'failed') {
      if (prevRank >= 3) {
        // Already delivered or read: do not overwrite with failed
        return false
      }
    } else if (newRank <= prevRank) {
      // Incoming rank is lower than or equal to current rank: no downgrade
      return false
    }

    // Apply the new status
    notification.status = newStatus

    if (newStatus === 'sent' && !notification.sentAt) {
      notification.sentAt = timestamp
    } else if (newStatus === 'delivered') {
      notification.deliveredAt = timestamp
    } else if (newStatus === 'read') {
      notification.readAt = timestamp
      if (!notification.deliveredAt) notification.deliveredAt = timestamp
    } else if (newStatus === 'failed') {
      notification.failedAt = timestamp
      if (errorDetails) notification.error = errorDetails
    }

    await notification.save()

    // Idempotent campaign stats updates
    if (notification.campaign) {
      const updateQuery: Record<string, number> = {}

      if (newStatus === 'delivered' && prevRank < 3) {
        updateQuery['stats.delivered'] = 1
      } else if (newStatus === 'read' && prevRank < 4) {
        updateQuery['stats.read'] = 1
        if (prevRank < 3) {
          updateQuery['stats.delivered'] = 1
        }
      } else if (newStatus === 'failed' && prevStatus !== 'failed') {
        updateQuery['stats.failed'] = 1
      }

      if (Object.keys(updateQuery).length > 0) {
        await WhatsAppCampaign.findByIdAndUpdate(notification.campaign, {
          $inc: updateQuery,
        })
      }

      await outboundQueueService.updateCampaignProgress(notification.campaign)
    }

    return true
  }

  /**
   * Processes a Meta webhook status item (sent, delivered, read, failed).
   */
  async handleWebhookStatus(statusObj: MetaWebhookStatus): Promise<boolean> {
    const { id: messageId, status, timestamp, errors } = statusObj
    const eventTime = new Date(Number(timestamp) * 1000)
    const errorMsg = errors?.[0]?.message || errors?.[0]?.title || errors?.[0]?.error_data?.details
    return this.updateNotificationStatus(messageId, status, eventTime, errorMsg)
  }

  /**
   * Ingests inbound user messages to handle opt-outs (e.g. STOP, UNSUBSCRIBE) and opt-ins.
   * Respects Meta messaging policy and marketing consent requirements.
   */
  async handleInboundMessage(message: MetaWebhookMessage): Promise<boolean> {
    if (!message.text?.body) return false
    const text = message.text.body.trim().toLowerCase()
    const optOutKeywords = ['stop', 'unsubscribe', 'opt out', 'optout', 'cancel']
    const optInKeywords = ['start', 'subscribe', 'opt in', 'optin', 'unstop']

    const normalizedPhone = normalizePhone(message.from)

    if (optOutKeywords.includes(text)) {
      const updated = await Member.findOneAndUpdate(
        { phone: normalizedPhone },
        { $set: { whatsappMarketingOptIn: false } },
      )
      return Boolean(updated)
    }

    if (optInKeywords.includes(text)) {
      const updated = await Member.findOneAndUpdate(
        { phone: normalizedPhone },
        { $set: { whatsappMarketingOptIn: true } },
      )
      return Boolean(updated)
    }

    return false
  }

  /**
   * Ingests Meta WhatsApp Business Cloud API webhook payloads.
   * Processes statuses and inbound messages with strict signature & payload verification.
   */
  async processMetaWebhookPayload(payload: MetaWebhookPayload): Promise<number> {
    if (!payload || typeof payload !== 'object') return 0

    let processed = 0
    for (const entry of payload.entry || []) {
      for (const change of entry.changes || []) {
        const val = change.value
        if (!val) continue

        // Status updates (sent, delivered, read, failed)
        for (const status of val.statuses || []) {
          const handled = await this.handleWebhookStatus(status)
          if (handled) processed += 1
        }

        // Inbound messages (opt-out / opt-in)
        for (const msg of val.messages || []) {
          const handled = await this.handleInboundMessage(msg)
          if (handled) processed += 1
        }
      }
    }
    return processed
  }
}

export const whatsAppService = new WhatsAppService()
