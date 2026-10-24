import { Types } from 'mongoose'
import { env } from '../../config/env'
import { MonthlyPayment } from '../../models/MonthlyPayment'
import { WhatsAppCampaign } from '../../models/WhatsAppCampaign'
import {
  WhatsAppNotification,
  type WhatsAppNotificationDoc,
} from '../../models/WhatsAppNotification'
import { outboundRateLimiter } from './outbound-rate-limiter'
import { whatsAppService } from './whatsapp.service'
import type { WhatsAppTemplateComponent } from './whatsapp.types'

export interface QueueProgressSummary {
  processed: number
  sent: number
  failed: number
  paused: number
  skippedPaid: number
}

export class OutboundQueueService {
  private isDispatching: boolean = false
  private pollTimer: ReturnType<typeof setInterval> | null = null

  /**
   * Recovers any items left in 'sending' state from previous process restarts.
   */
  async recoverStaleSendingItems(): Promise<number> {
    const res = await WhatsAppNotification.updateMany(
      { status: 'sending' },
      { $set: { status: 'queued' } },
    )
    return res.modifiedCount
  }

  /**
   * Resumes paused notifications back to queued state.
   */
  async resumePausedNotifications(): Promise<number> {
    outboundRateLimiter.resume()
    const res = await WhatsAppNotification.updateMany(
      { status: 'paused' },
      { $set: { status: 'queued', error: null, pausedAt: null } },
    )
    await WhatsAppCampaign.updateMany(
      { status: 'paused' },
      { $set: { status: 'processing', error: null } },
    )
    // Wake up dispatcher
    this.dispatchPending().catch(() => {})
    return res.modifiedCount
  }

  /**
   * Manually pauses the queue.
   */
  pauseQueue(reason: string, durationMs?: number): void {
    outboundRateLimiter.pause(reason, durationMs)
  }

  /**
   * Manually resumes the queue.
   */
  resumeQueue(): Promise<number> {
    return this.resumePausedNotifications()
  }

  /**
   * Starts background queue consumer worker.
   */
  startQueueWorker(intervalMs: number = 3000): void {
    if (this.pollTimer || env.isTest) return

    this.recoverStaleSendingItems().catch((err) => {
      // eslint-disable-next-line no-console
      console.error('[whatsapp-queue] Recovery failed on startup:', err)
    })

    this.pollTimer = setInterval(() => {
      this.dispatchPending().catch((err) => {
        // eslint-disable-next-line no-console
        console.error('[whatsapp-queue] Worker cycle error:', err)
      })
    }, intervalMs)

    if (typeof this.pollTimer.unref === 'function') {
      this.pollTimer.unref()
    }
  }

  /**
   * Stops the background worker.
   */
  stopQueueWorker(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer)
      this.pollTimer = null
    }
  }

  /**
   * Processes all pending queued notifications sequentially through the shared rate limiter.
   * Enforces singleton execution: parallel invocations simply await the active loop.
   */
  async dispatchPending(): Promise<QueueProgressSummary> {
    const summary: QueueProgressSummary = {
      processed: 0,
      sent: 0,
      failed: 0,
      paused: 0,
      skippedPaid: 0,
    }

    if (this.isDispatching) {
      return summary
    }

    this.isDispatching = true

    try {
      if (outboundRateLimiter.isPaused()) {
        return summary
      }

      const batchSize = env.isTest ? 50 : (env.WHATSAPP_QUEUE_BATCH_SIZE ?? 5)

      // Continuous loop while items are in queue
      while (true) {
        if (outboundRateLimiter.isPaused()) {
          break
        }

        // Fetch oldest batch of queued notifications (FIFO)
        const batch: WhatsAppNotificationDoc[] = await WhatsAppNotification.find({
          status: 'queued',
        })
          .sort({ createdAt: 1 })
          .limit(batchSize)

        if (batch.length === 0) {
          break
        }

        for (const notification of batch) {
          if (outboundRateLimiter.isPaused()) {
            break
          }

          const outcome = await this.dispatchSingleNotification(notification)
          summary.processed += 1
          if (outcome === 'sent') summary.sent += 1
          else if (outcome === 'failed') summary.failed += 1
          else if (outcome === 'paused') summary.paused += 1
          else if (outcome === 'skipped') summary.skippedPaid += 1

          if (outcome === 'paused') {
            // Stop further batch processing if paused due to session/quota rejection
            break
          }
        }
      }

      return summary
    } finally {
      this.isDispatching = false
    }
  }

  /**
   * Dispatches a single notification under rate limits with eligibility validation.
   */
  private async dispatchSingleNotification(
    notification: WhatsAppNotificationDoc,
  ): Promise<'sent' | 'failed' | 'paused' | 'skipped'> {
    // 1. Paid member check for reminders:
    // If a member paid their fees after notification was queued, do not send the reminder!
    if (
      (notification.type === 'FEE_DUE_2_DAYS' || notification.type === 'FEE_OVERDUE') &&
      notification.payment
    ) {
      const payment = await MonthlyPayment.findById(notification.payment)
      if (
        payment &&
        (payment.status === 'paid' || payment.dueAmountPaise <= payment.amountPaidPaise)
      ) {
        notification.status = 'not_sent'
        notification.error = 'Payment settled prior to dispatch. Reminder cancelled.'
        await notification.save()
        if (notification.campaign) {
          await this.updateCampaignProgress(notification.campaign)
        }
        return 'skipped'
      }
    }

    // 2. Integration check
    if (!whatsAppService.isEnabled) {
      notification.status = 'not_sent'
      notification.error = 'WhatsApp integration disabled / not configured'
      await notification.save()
      if (notification.campaign) {
        await this.updateCampaignProgress(notification.campaign)
      }
      return 'failed'
    }

    // 3. Mark in-flight
    notification.status = 'sending'
    notification.attempts = (notification.attempts || 0) + 1
    notification.lastAttemptAt = new Date()
    await notification.save()

    // 4. Shared Rate Limiter slot acquisition
    try {
      await outboundRateLimiter.acquireSlot()
    } catch (limiterErr) {
      notification.status = 'paused'
      notification.pausedAt = new Date()
      notification.error = limiterErr instanceof Error ? limiterErr.message : 'Queue paused'
      await notification.save()
      if (notification.campaign) {
        await this.updateCampaignProgress(notification.campaign)
      }
      return 'paused'
    }

    // 5. Provider dispatch
    const provider = whatsAppService.getProvider()
    try {
      let sendResult
      if (notification.templateName) {
        sendResult = await provider.sendTemplateMessage({
          to: notification.phoneNumber,
          templateName: notification.templateName,
          languageCode: (notification.metadata?.languageCode as string) || 'en_US',
          components: notification.metadata?.components as WhatsAppTemplateComponent[] | undefined,
        })
      } else if (notification.mediaUrl) {
        sendResult = await provider.sendMediaMessage({
          to: notification.phoneNumber,
          type: 'image',
          mediaUrl: notification.mediaUrl,
          caption: notification.message ?? '',
        })
      } else {
        sendResult = await provider.sendTextMessage({
          to: notification.phoneNumber,
          text: notification.message ?? '',
        })
      }

      if (sendResult.success) {
        // Initial provider socket write
        outboundRateLimiter.recordDispatch()

        notification.status = sendResult.status || 'queued'
        notification.messageId = sendResult.messageId || null
        if (notification.status === 'sent') {
          notification.sentAt = new Date()
        }
        await notification.save()

        if (notification.campaign) {
          await this.updateCampaignProgress(notification.campaign)
        }
        return 'sent'
      }

      // Handle provider rejection / error responses
      return this.handleProviderFailure(notification, sendResult.error, sendResult.httpStatus)
    } catch (dispatchErr) {
      const isAbort = dispatchErr instanceof Error && dispatchErr.name === 'AbortError'
      const errorMsg = isAbort
        ? 'Ambiguous timeout: provider request timed out without confirmation. Not auto-retrying to prevent duplicate messages.'
        : dispatchErr instanceof Error
          ? dispatchErr.message
          : 'Unknown network error'

      return this.handleProviderFailure(notification, errorMsg, undefined, isAbort)
    }
  }

  /**
   * Handles errors according to provider status and retry policies.
   */
  private async handleProviderFailure(
    notification: WhatsAppNotificationDoc,
    errorMsg?: string,
    httpStatus?: number,
    isAmbiguousTimeout?: boolean,
  ): Promise<'failed' | 'paused'> {
    // 1. Session-level rejection or quota limit (429, 403, 503): Pause queue!
    if (httpStatus === 429 || httpStatus === 403 || httpStatus === 503) {
      const reason = errorMsg || `Provider session failure (HTTP ${httpStatus})`
      outboundRateLimiter.pause(reason, httpStatus === 429 ? 60000 : undefined)

      notification.status = 'paused'
      notification.pausedAt = new Date()
      notification.error = reason
      await notification.save()

      if (notification.campaign) {
        await WhatsAppCampaign.findByIdAndUpdate(notification.campaign, {
          $set: { status: 'paused', error: reason },
        })
        await this.updateCampaignProgress(notification.campaign)
      }
      return 'paused'
    }

    // 2. Ambiguous timeout: DO NOT blind retry
    if (isAmbiguousTimeout) {
      notification.status = 'failed'
      notification.failedAt = new Date()
      notification.error = errorMsg || 'Ambiguous timeout. Send unconfirmed; retry skipped for safety.'
      await notification.save()

      if (notification.campaign) {
        await this.updateCampaignProgress(notification.campaign)
      }
      return 'failed'
    }

    // 3. Recipient non-retryable error (e.g. 422 unregistered on WhatsApp, 400 invalid recipient/parameter)
    if (httpStatus === 422 || httpStatus === 400) {
      notification.status = 'failed'
      notification.failedAt = new Date()
      notification.error = errorMsg || `Non-retryable request error (HTTP ${httpStatus})`
      await notification.save()

      if (notification.campaign) {
        await this.updateCampaignProgress(notification.campaign)
      }
      return 'failed'
    }

    // 4. Bounded retry policy for other transient failures
    const maxRetries = notification.maxAttempts || env.WHATSAPP_MAX_RETRIES || 3
    if (notification.attempts < maxRetries) {
      // Return to queue for next attempt
      notification.status = 'queued'
      notification.error = `Transient error: ${errorMsg || 'Retrying'}`
      await notification.save()
      return 'failed'
    }

    // Retries exhausted
    notification.status = 'failed'
    notification.failedAt = new Date()
    notification.error = errorMsg || 'Max retries exhausted'
    await notification.save()

    if (notification.campaign) {
      await this.updateCampaignProgress(notification.campaign)
    }
    return 'failed'
  }

  /**
   * Updates campaign statistics and status accurately based on notification records.
   * Never marks a partially processed campaign as fully completed.
   */
  async updateCampaignProgress(campaignId: Types.ObjectId | string): Promise<void> {
    const campaign = await WhatsAppCampaign.findById(campaignId)
    if (!campaign) return

    const notifications = await WhatsAppNotification.find({ campaign: campaign._id })

    let sent = 0
    let delivered = 0
    let read = 0
    let failed = 0
    let paused = 0
    let pendingOrSending = 0

    for (const notif of notifications) {
      if (notif.status === 'sent' || notif.status === 'delivered' || notif.status === 'read') {
        sent += 1
      }
      if (notif.status === 'delivered' || notif.status === 'read') {
        delivered += 1
      }
      if (notif.status === 'read') {
        read += 1
      }
      if (notif.status === 'failed' || notif.status === 'not_sent') {
        failed += 1
      }
      if (notif.status === 'paused') {
        paused += 1
      }
      if (notif.status === 'queued' || notif.status === 'sending') {
        pendingOrSending += 1
      }
    }

    campaign.stats.sent = sent
    campaign.stats.delivered = delivered
    campaign.stats.read = read
    campaign.stats.failed = failed
    campaign.stats.paused = paused

    // Campaign status resolution
    if (paused > 0) {
      campaign.status = 'paused'
    } else if (pendingOrSending > 0) {
      campaign.status = 'processing'
    } else {
      // All items have been processed
      if (failed > 0 && sent === 0) {
        campaign.status = 'failed'
      } else {
        campaign.status = 'completed'
      }
      campaign.completedAt = new Date()
    }

    await campaign.save()
  }

  /**
   * Diagnostic summary of current queue state.
   */
  async getQueueStatus() {
    const [queued, sending, paused, failed, total] = await Promise.all([
      WhatsAppNotification.countDocuments({ status: 'queued' }),
      WhatsAppNotification.countDocuments({ status: 'sending' }),
      WhatsAppNotification.countDocuments({ status: 'paused' }),
      WhatsAppNotification.countDocuments({ status: 'failed' }),
      WhatsAppNotification.countDocuments({}),
    ])

    return {
      isDispatching: this.isDispatching,
      rateLimiter: outboundRateLimiter.getTelemetry(),
      counts: {
        queued,
        sending,
        paused,
        failed,
        total,
      },
    }
  }
}

export const outboundQueueService = new OutboundQueueService()
