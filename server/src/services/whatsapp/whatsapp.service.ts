import { Types } from 'mongoose'
import { env } from '../../config/env'
import { Member, type MemberDoc } from '../../models/Member'
import { MonthlyPayment, type MonthlyPaymentDoc } from '../../models/MonthlyPayment'
import { WhatsAppCampaign, type WhatsAppCampaignDoc } from '../../models/WhatsAppCampaign'
import { WhatsAppNotification, type WhatsAppNotificationDoc } from '../../models/WhatsAppNotification'
import { paiseToRupees } from '../../utils/money'
import { formatDDMMYYYY, istDay } from '../../utils/month'
import { calendarDaysDifference } from '../../utils/paymentStatus'
import { formatMetaPhone } from '../../utils/phone'
import { MetaWhatsAppProvider } from './meta-whatsapp.provider'
import { MockWhatsAppProvider } from './mock-whatsapp.provider'
import { WhatsAppError } from './whatsapp.errors'
import type { WhatsAppProvider } from './whatsapp.provider'
import {
  buildOverdueFallbackText,
  buildOverdueTemplateComponents,
  buildUpcomingDueFallbackText,
  buildUpcomingDueTemplateComponents,
  WHATSAPP_TEMPLATES,
} from './whatsapp.templates'
import type { MetaWebhookPayload, MetaWebhookStatus } from './whatsapp.types'

class WhatsAppService {
  private provider: WhatsAppProvider

  constructor() {
    this.provider = this.createProvider()
  }

  private createProvider(): WhatsAppProvider {
    if (env.isWhatsAppEnabled && env.WHATSAPP_ACCESS_TOKEN && env.WHATSAPP_PHONE_NUMBER_ID) {
      return new MetaWhatsAppProvider({
        apiVersion: env.WHATSAPP_API_VERSION,
        phoneNumberId: env.WHATSAPP_PHONE_NUMBER_ID,
        accessToken: env.WHATSAPP_ACCESS_TOKEN,
        appSecret: env.WHATSAPP_APP_SECRET,
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
    // Find active members
    const members = await Member.find({ status: 'active' })
    const memberIds = members.map((m) => m._id)

    // Find unpaid or partial payments
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

        // Daily dedup key for today
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

    const recipientPhone = formatMetaPhone(member.phone)
    if (!recipientPhone) {
      const failedRecord = await WhatsAppNotification.create({
        member: member._id,
        memberId: member.memberId,
        phoneNumber: member.phone,
        type: 'FEE_DUE_2_DAYS',
        dedupKey,
        payment: payment._id,
        templateName: WHATSAPP_TEMPLATES.FEE_DUE_2_DAYS,
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

    const fallbackText = buildUpcomingDueFallbackText({
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
      message: fallbackText,
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

    try {
      const sendResult = await this.provider.sendTemplateMessage({
        to: recipientPhone,
        templateName: WHATSAPP_TEMPLATES.FEE_DUE_2_DAYS,
        components,
      })

      if (sendResult.success) {
        notification.status = 'sent'
        notification.messageId = sendResult.messageId || null
        notification.sentAt = new Date()
      } else {
        notification.status = 'failed'
        notification.error = sendResult.error || 'Failed to send template message'
        notification.failedAt = new Date()
      }
      await notification.save()
      return notification
    } catch (err) {
      notification.status = 'failed'
      notification.error = err instanceof Error ? err.message : 'Unknown dispatch error'
      notification.failedAt = new Date()
      await notification.save()
      return notification
    }
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
    // Check payment status first (billing system is single source of truth)
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

    const recipientPhone = formatMetaPhone(member.phone)
    if (!recipientPhone) {
      const failedRecord = await WhatsAppNotification.create({
        member: member._id,
        memberId: member.memberId,
        phoneNumber: member.phone,
        type: 'FEE_OVERDUE',
        dedupKey,
        payment: payment._id,
        templateName: WHATSAPP_TEMPLATES.FEE_OVERDUE,
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

    const fallbackText = buildOverdueFallbackText({
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
      message: fallbackText,
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

    try {
      const sendResult = await this.provider.sendTemplateMessage({
        to: recipientPhone,
        templateName: WHATSAPP_TEMPLATES.FEE_OVERDUE,
        components,
      })

      if (sendResult.success) {
        notification.status = 'sent'
        notification.messageId = sendResult.messageId || null
        notification.sentAt = new Date()
      } else {
        notification.status = 'failed'
        notification.error = sendResult.error || 'Failed to send overdue template message'
        notification.failedAt = new Date()
      }
      await notification.save()
      return notification
    } catch (err) {
      notification.status = 'failed'
      notification.error = err instanceof Error ? err.message : 'Unknown dispatch error'
      notification.failedAt = new Date()
      await notification.save()
      return notification
    }
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
   * Creates a custom broadcast campaign and processes its queue.
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
      stats: { sent: 0, delivered: 0, read: 0, failed: 0 },
      status: 'processing',
      createdBy: new Types.ObjectId(params.adminId),
    })

    const runPromise = this.processCampaignQueue(
      campaign._id.toString(),
      recipients,
      params.message,
      params.mediaUrl,
    ).catch((err) => {
      // eslint-disable-next-line no-console
      console.error(`[whatsapp] Campaign ${campaign._id} error:`, err)
    })

    if (params.waitForCompletion) {
      await runPromise
    }

    return campaign
  }

  /**
   * Internal queue processor for a campaign.
   */
  private async processCampaignQueue(
    campaignId: string,
    recipients: MemberDoc[],
    message: string,
    mediaUrl?: string | null,
  ): Promise<void> {
    const campaign = await WhatsAppCampaign.findById(campaignId)
    if (!campaign) return

    let sentCount = 0
    let failedCount = 0

    for (const member of recipients) {
      const recipientPhone = formatMetaPhone(member.phone)
      if (!recipientPhone) {
        await WhatsAppNotification.create({
          member: member._id,
          memberId: member.memberId,
          phoneNumber: member.phone,
          type: 'CUSTOM',
          campaign: campaign._id,
          message,
          mediaUrl: mediaUrl || null,
          status: 'failed',
          error: 'Invalid recipient phone number',
          failedAt: new Date(),
        })
        failedCount += 1
        continue
      }

      const notification = await WhatsAppNotification.create({
        member: member._id,
        memberId: member.memberId,
        phoneNumber: recipientPhone,
        type: 'CUSTOM',
        campaign: campaign._id,
        message,
        mediaUrl: mediaUrl || null,
        status: 'queued',
      })

      if (!this.isEnabled) {
        notification.status = 'not_sent'
        notification.error = 'WhatsApp integration disabled / not configured'
        await notification.save()
        failedCount += 1
        continue
      }

      try {
        let sendResult
        if (mediaUrl) {
          sendResult = await this.provider.sendMediaMessage({
            to: recipientPhone,
            type: 'image',
            mediaUrl,
            caption: message,
          })
        } else {
          sendResult = await this.provider.sendTextMessage({
            to: recipientPhone,
            text: message,
          })
        }

        if (sendResult.success) {
          notification.status = 'sent'
          notification.messageId = sendResult.messageId || null
          notification.sentAt = new Date()
          sentCount += 1
        } else {
          notification.status = 'failed'
          notification.error = sendResult.error || 'Failed to send'
          notification.failedAt = new Date()
          failedCount += 1
        }
        await notification.save()
      } catch (err) {
        notification.status = 'failed'
        notification.error = err instanceof Error ? err.message : 'Unknown dispatch error'
        notification.failedAt = new Date()
        await notification.save()
        failedCount += 1
      }
    }

    campaign.stats.sent = sentCount
    campaign.stats.failed = failedCount
    campaign.status = 'completed'
    campaign.completedAt = new Date()
    await campaign.save()
  }

  /**
   * Processes webhook delivery status callbacks from Meta.
   */
  async handleWebhookStatus(statusObj: MetaWebhookStatus): Promise<boolean> {
    const { id: messageId, status, timestamp, errors } = statusObj

    const notification = await WhatsAppNotification.findOne({ messageId })
    if (!notification) {
      // Notification may have been sent externally or messageId not mapped yet
      return false
    }

    const previousStatus = notification.status
    const eventTime = new Date(Number(timestamp) * 1000)

    if (status === 'delivered') {
      notification.status = 'delivered'
      notification.deliveredAt = eventTime
    } else if (status === 'read') {
      notification.status = 'read'
      notification.readAt = eventTime
      if (!notification.deliveredAt) notification.deliveredAt = eventTime
    } else if (status === 'failed') {
      notification.status = 'failed'
      notification.failedAt = eventTime
      notification.error = errors?.[0]?.message || errors?.[0]?.title || 'Delivery failed'
    } else if (status === 'sent') {
      notification.status = 'sent'
      if (!notification.sentAt) notification.sentAt = eventTime
    }

    await notification.save()

    // If part of a campaign, update campaign aggregated stats
    if (notification.campaign) {
      const updateQuery: Record<string, number> = {}
      if (status === 'delivered' && previousStatus !== 'delivered' && previousStatus !== 'read') {
        updateQuery['stats.delivered'] = 1
      } else if (status === 'read' && previousStatus !== 'read') {
        updateQuery['stats.read'] = 1
        if (previousStatus !== 'delivered') updateQuery['stats.delivered'] = 1
      } else if (status === 'failed' && previousStatus !== 'failed') {
        updateQuery['stats.failed'] = 1
      }

      if (Object.keys(updateQuery).length > 0) {
        await WhatsAppCampaign.findByIdAndUpdate(notification.campaign, {
          $inc: updateQuery,
        })
      }
    }

    return true
  }

  /**
   * Ingests full Meta webhook payload.
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
