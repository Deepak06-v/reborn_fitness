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
import { formatWhatsAppPhone } from '../../utils/phone'
import { EvolutionWhatsAppProvider } from './evolution-whatsapp.provider'
import { MockWhatsAppProvider } from './mock-whatsapp.provider'
import { WaportaWhatsAppProvider } from './waporta-whatsapp.provider'
import { WhatsAppError } from './whatsapp.errors'
import type { WhatsAppProvider } from './whatsapp.provider'
import {
  formatOverdueMessage,
  formatUpcomingDueMessage,
  WHATSAPP_TEMPLATES,
} from './whatsapp.templates'
import type {
  EvolutionWebhookPayload,
  EvolutionWebhookEventData,
  WaportaWebhookPayload,
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
      env.whatsappProvider === 'waporta' &&
      env.isWhatsAppEnabled &&
      env.WAPORTA_API_URL &&
      env.WAPORTA_API_KEY
    ) {
      return new WaportaWhatsAppProvider({
        apiUrl: env.WAPORTA_API_URL,
        apiKey: env.WAPORTA_API_KEY,
        sessionId: env.WAPORTA_SESSION_ID,
      })
    }
    if (
      env.whatsappProvider === 'evolution' &&
      env.isWhatsAppEnabled &&
      env.EVOLUTION_API_URL &&
      env.EVOLUTION_API_KEY
    ) {
      return new EvolutionWhatsAppProvider({
        apiUrl: env.EVOLUTION_API_URL,
        apiKey: env.EVOLUTION_API_KEY,
        instanceName: env.EVOLUTION_INSTANCE_NAME,
        webhookSecret: env.EVOLUTION_WEBHOOK_SECRET,
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
    if (this.provider instanceof WaportaWhatsAppProvider) return 'waporta'
    if (this.provider instanceof EvolutionWhatsAppProvider) return 'evolution'
    if (this.provider instanceof MockWhatsAppProvider) {
      return env.whatsappProvider === 'waporta' || env.whatsappProvider === 'evolution'
        ? env.whatsappProvider
        : 'mock'
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
    const memberIds = members.map((m) => m._id)

    const payments = await MonthlyPayment.find({
      member: { $in: memberIds },
      status: { $in: ['unpaid', 'partial'] },
    }).sort({ dueDate: 1 })

    const memberMap = new Map(members.map((m) => [m._id.toString(), m]))
    const results: Array<{
      member: MemberDoc
      payment: MonthlyPaymentDoc
      daysLeft: number
      latestNotification: WhatsAppNotificationDoc | null
    }> = []

    for (const payment of payments) {
      const diff = calendarDaysDifference(payment.dueDate, now)
      if (diff === 2) {
        const member = memberMap.get(payment.member.toString())
        if (!member) continue

        const dedupKey = `${member.memberId}_FEE_DUE_2_DAYS_${istDay(payment.dueDate)}`
        const latestNotification = await WhatsAppNotification.findOne({ dedupKey })

        results.push({
          member,
          payment,
          daysLeft: diff,
          latestNotification,
        })
      }
    }

    return results
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
    const memberIds = members.map((m) => m._id)

    const payments = await MonthlyPayment.find({
      member: { $in: memberIds },
      status: { $in: ['unpaid', 'partial'] },
    }).sort({ dueDate: 1 })

    const memberMap = new Map(members.map((m) => [m._id.toString(), m]))
    const results: Array<{
      member: MemberDoc
      payment: MonthlyPaymentDoc
      daysOverdue: number
      latestNotification: WhatsAppNotificationDoc | null
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
        const latestNotification = await WhatsAppNotification.findOne({ dedupKey })

        results.push({
          member,
          payment,
          daysOverdue,
          latestNotification,
        })
      }
    }

    return results
  }

  /**
   * Sends the automatic Fee Due in 2 Days reminder to a specific member/payment.
   * Enforces deduplication using memberId + FEE_DUE_2_DAYS + dueDate.
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

    const recipientPhone = formatWhatsAppPhone(member.phone)
    if (!recipientPhone) {
      const failedRecord = await WhatsAppNotification.create({
        member: member._id,
        memberId: member.memberId,
        phoneNumber: member.phone,
        type: 'FEE_DUE_2_DAYS',
        dedupKey,
        payment: payment._id,
        templateName: WHATSAPP_TEMPLATES.FEE_DUE_2_DAYS,
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

    const messageText = formatUpcomingDueMessage({
      memberName: member.fullName,
      planName,
      dueDate: dueDateStr,
      amountDue: amountStr,
    })

    // Create record first in queued state
    const notification = await WhatsAppNotification.create({
      member: member._id,
      memberId: member.memberId,
      phoneNumber: recipientPhone,
      type: 'FEE_DUE_2_DAYS',
      dedupKey,
      payment: payment._id,
      templateName: WHATSAPP_TEMPLATES.FEE_DUE_2_DAYS,
      message: messageText,
      provider: this.getProviderName(),
      status: 'queued',
      metadata: {
        amountDue: amountStr,
        dueDate: dueDateStr,
        planName,
      },
    })

    // If WhatsApp integration is not enabled, keep in queued or mark not_sent
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

    const recipientPhone = formatWhatsAppPhone(member.phone)
    if (!recipientPhone) {
      const failedRecord = await WhatsAppNotification.create({
        member: member._id,
        memberId: member.memberId,
        phoneNumber: member.phone,
        type: 'FEE_OVERDUE',
        dedupKey,
        payment: payment._id,
        templateName: WHATSAPP_TEMPLATES.FEE_OVERDUE,
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
      templateName: WHATSAPP_TEMPLATES.FEE_OVERDUE,
      message: messageText,
      provider: this.getProviderName(),
      status: 'queued',
      metadata: {
        daysOverdue,
        amountDue: amountStr,
        planName,
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
   * Filters members for custom broadcast messages based on requested filter.
   */
  async getRecipientsForFilter(filter: string, planId?: string): Promise<MemberDoc[]> {
    if (filter === 'active') {
      return Member.find({ status: 'active' })
    }

    if (filter === 'overdue') {
      const now = new Date()
      const activeMembers = await Member.find({ status: 'active' })
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
      return Member.find({ status: 'active', planId })
    }

    // Default: 'all'
    return Member.find({})
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
    waitForCompletion?: boolean
  }): Promise<WhatsAppCampaignDoc> {
    const recipients = await this.getRecipientsForFilter(params.recipientFilter, params.planId)
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
   * Ingests Waporta delivery-status webhook payloads (message.status events).
   * Maps: pending -> queued, server -> sent, delivered -> delivered, read/played -> read, error -> failed.
   * Enforces status hierarchy and idempotent campaign updates.
   */
  async processWaportaWebhookPayload(
    payload: WaportaWebhookPayload | WaportaWebhookPayload[],
  ): Promise<number> {
    if (!payload || typeof payload !== 'object') return 0

    const items: WaportaWebhookPayload[] = Array.isArray(payload) ? payload : [payload]
    let processed = 0

    for (const item of items) {
      if (!item || typeof item !== 'object') continue

      // Ignore incoming user messages: inbound-chat is outside current scope
      const eventName = String(item.event || '').toLowerCase()
      if (eventName === 'message.received') {
        continue
      }

      // Verify sessionId if supplied in event
      const sessionId = item.sessionId || item.data?.sessionId
      if (sessionId && env.WAPORTA_SESSION_ID && sessionId !== env.WAPORTA_SESSION_ID) {
        continue
      }

      const messageId =
        item.messageId ||
        item.data?.messageId ||
        (typeof item.id === 'string' ? item.id : undefined)

      if (!messageId) continue

      const rawStatus = String(item.status || item.data?.status || '').toLowerCase()
      let mappedStatus: WhatsAppDeliveryStatus | null = null

      if (rawStatus === 'pending') {
        mappedStatus = 'queued'
      } else if (rawStatus === 'server' || rawStatus === 'sent') {
        mappedStatus = 'sent'
      } else if (rawStatus === 'delivered') {
        mappedStatus = 'delivered'
      } else if (rawStatus === 'read' || rawStatus === 'played') {
        mappedStatus = 'read'
      } else if (rawStatus === 'error' || rawStatus === 'failed') {
        mappedStatus = 'failed'
      }

      if (!mappedStatus) continue

      let timestamp = new Date()
      const rawTimestamp = item.timestamp ?? item.data?.timestamp
      if (rawTimestamp) {
        const num = Number(rawTimestamp)
        if (!Number.isNaN(num) && num > 0) {
          timestamp = new Date(num > 10000000000 ? num : num * 1000)
        } else {
          const parsed = new Date(String(rawTimestamp))
          if (!Number.isNaN(parsed.getTime())) timestamp = parsed
        }
      }

      const errorMsg =
        (typeof item.error === 'string' ? item.error : undefined) ||
        (typeof item.data?.error === 'string' ? item.data.error : undefined)

      const handled = await this.updateNotificationStatus(
        messageId,
        mappedStatus,
        timestamp,
        errorMsg,
      )
      if (handled) processed += 1
    }

    return processed
  }

  /**
   * Ingests Evolution API webhook payloads.
   * Supports MESSAGES_UPDATE, SEND_MESSAGE, SEND_MESSAGE_UPDATE, CONNECTION_UPDATE.
   */
  async processEvolutionWebhookPayload(payload: EvolutionWebhookPayload): Promise<number> {
    if (!payload || typeof payload !== 'object') return 0

    const event = String(payload.event || '').toUpperCase()

    // Connection update logging/handling
    if (event === 'CONNECTION_UPDATE' || event === 'CONNECTION.UPDATE') {
      return 1
    }

    const rawData = payload.data
    const dataItems: EvolutionWebhookEventData[] = Array.isArray(rawData)
      ? rawData
      : rawData && typeof rawData === 'object'
        ? [rawData as EvolutionWebhookEventData]
        : []

    let processed = 0

    for (const item of dataItems) {
      const messageId =
        item.key?.id ||
        item.keyId ||
        item.id ||
        item.messageId ||
        (typeof item.key === 'string' ? item.key : undefined)

      if (!messageId) continue

      const rawStatus = item.update?.status ?? item.status

      let mappedStatus: WhatsAppDeliveryStatus | null = null
      if (typeof rawStatus === 'number') {
        if (rawStatus === 0) mappedStatus = 'failed'
        else if (rawStatus === 1) mappedStatus = 'queued'
        else if (rawStatus === 2) mappedStatus = 'sent'
        else if (rawStatus === 3) mappedStatus = 'delivered'
        else if (rawStatus === 4 || rawStatus === 5) mappedStatus = 'read'
      } else if (typeof rawStatus === 'string') {
        const upper = rawStatus.toUpperCase()
        if (upper === 'ERROR' || upper === 'FAILED') mappedStatus = 'failed'
        else if (upper === 'PENDING' || upper === 'QUEUED') mappedStatus = 'queued'
        else if (upper === 'SERVER_ACK' || upper === 'SENT') mappedStatus = 'sent'
        else if (upper === 'DELIVERY_ACK' || upper === 'DELIVERED') mappedStatus = 'delivered'
        else if (upper === 'READ' || upper === 'PLAYED') mappedStatus = 'read'
      }

      if (!mappedStatus) continue

      let timestamp = new Date()
      const rawTimestamp = item.messageTimestamp || item.date_time || payload.date_time
      if (rawTimestamp) {
        const num = Number(rawTimestamp)
        if (!Number.isNaN(num) && num > 0) {
          timestamp = new Date(num > 10000000000 ? num : num * 1000)
        } else {
          const parsed = new Date(String(rawTimestamp))
          if (!Number.isNaN(parsed.getTime())) timestamp = parsed
        }
      }

      let errorMsg: string | undefined
      if (typeof item.error === 'string') errorMsg = item.error
      else if (item.error && typeof item.error === 'object' && item.error.message) {
        errorMsg = item.error.message
      }

      const handled = await this.updateNotificationStatus(
        messageId,
        mappedStatus,
        timestamp,
        errorMsg,
      )
      if (handled) processed += 1
    }

    return processed
  }

  /**
   * Backward-compatible handler for Meta webhook callbacks and test suites.
   */
  async handleWebhookStatus(statusObj: MetaWebhookStatus): Promise<boolean> {
    const { id: messageId, status, timestamp, errors } = statusObj
    const eventTime = new Date(Number(timestamp) * 1000)
    const errorMsg = errors?.[0]?.message || errors?.[0]?.title
    return this.updateNotificationStatus(messageId, status, eventTime, errorMsg)
  }

  /**
   * Backward-compatible ingest of Meta webhook payloads.
   */
  async processMetaWebhookPayload(payload: MetaWebhookPayload): Promise<number> {
    let processed = 0
    for (const entry of payload.entry || []) {
      for (const change of entry.changes || []) {
        for (const status of change.value?.statuses || []) {
          const handled = await this.handleWebhookStatus(status)
          if (handled) processed += 1
        }
      }
    }
    return processed
  }
}

export const whatsAppService = new WhatsAppService()
