import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { Router, type Request, type Response } from 'express'
import { env } from '../config/env'
import { WhatsAppCampaign } from '../models/WhatsAppCampaign'
import { WhatsAppNotification } from '../models/WhatsAppNotification'
import { whatsAppService } from '../services/whatsapp/whatsapp.service'
import { outboundQueueService } from '../services/whatsapp/outbound-queue.service'
import { runWhatsAppReminders } from '../services/whatsappScheduler'
import { paiseToRupees } from '../utils/money'
import { ApiError } from '../utils/errors'

const router = Router()

/**
 * GET /api/admin/whatsapp/status
 * Returns selected WhatsApp provider configuration state and live instance connection status without exposing secrets.
 */
router.get('/status', async (_req: Request, res: Response) => {
  let connectionState:
    | 'disabled'
    | 'not_configured'
    | 'unreachable'
    | 'disconnected'
    | 'connected'
    | 'unavailable' = 'disabled'
  let rawState: string | undefined

  if (!env.WHATSAPP_ENABLED) {
    connectionState = 'disabled'
  } else if (!env.isWhatsAppConfigured) {
    connectionState = 'not_configured'
  } else {
    try {
      const provider = whatsAppService.getProvider()
      if (
        'getConnectionStatus' in provider &&
        typeof provider.getConnectionStatus === 'function'
      ) {
        const result = await provider.getConnectionStatus()
        connectionState = result.state === 'unconfigured' ? 'not_configured' : result.state
        rawState = result.rawState
      } else {
        connectionState = 'connected'
      }
    } catch {
      connectionState = 'unreachable'
    }
  }

  const activeProvider = whatsAppService.getProviderName()
  const instanceOrSession =
    activeProvider === 'waporta'
      ? env.WAPORTA_SESSION_ID
      : activeProvider === 'evolution'
        ? env.EVOLUTION_INSTANCE_NAME
        : null

  const webhookPath =
    activeProvider === 'waporta'
      ? env.WAPORTA_WEBHOOK_PATH
      : env.EVOLUTION_WEBHOOK_PATH

  res.json({
    provider: activeProvider,
    isConfigured: env.isWhatsAppConfigured,
    isEnabled: env.isWhatsAppEnabled,
    instanceName: instanceOrSession,
    sessionId: env.WAPORTA_SESSION_ID,
    webhookPath,
    connectionState,
    rawState,
  })
})

/**
 * GET /api/admin/whatsapp/upcoming-due
 * Members whose fees are due in exactly 2 days.
 */
router.get('/upcoming-due', async (_req: Request, res: Response, next) => {
  try {
    const items = await whatsAppService.getUpcomingFeeDueMembers(new Date())
    const results = items.map((item) => {
      const balance = Math.max(item.payment.dueAmountPaise - item.payment.amountPaidPaise, 0)
      return {
        paymentId: item.payment._id.toString(),
        memberId: item.member.memberId,
        memberName: item.member.fullName,
        phone: item.member.phone,
        planName: item.payment.planName || item.member.planName || 'Monthly',
        dueDate: item.payment.dueDate.toISOString(),
        dueAmount: paiseToRupees(balance),
        daysLeft: item.daysLeft,
        notification: {
          status: item.latestNotification?.status ?? 'not_sent',
          sentAt: item.latestNotification?.sentAt?.toISOString() ?? null,
          deliveredAt: item.latestNotification?.deliveredAt?.toISOString() ?? null,
          readAt: item.latestNotification?.readAt?.toISOString() ?? null,
          error: item.latestNotification?.error ?? null,
        },
      }
    })
    res.json({ items: results, count: results.length })
  } catch (err) {
    next(err)
  }
})

/**
 * GET /api/admin/whatsapp/overdue
 * Members whose fees are currently overdue.
 */
router.get('/overdue', async (_req: Request, res: Response, next) => {
  try {
    const items = await whatsAppService.getOverdueMembers(new Date())
    const results = items.map((item) => {
      const balance = Math.max(item.payment.dueAmountPaise - item.payment.amountPaidPaise, 0)
      return {
        paymentId: item.payment._id.toString(),
        memberId: item.member.memberId,
        memberName: item.member.fullName,
        phone: item.member.phone,
        planName: item.payment.planName || item.member.planName || 'Monthly',
        dueDate: item.payment.dueDate.toISOString(),
        dueAmount: paiseToRupees(balance),
        daysOverdue: item.daysOverdue,
        notification: {
          status: item.latestNotification?.status ?? 'not_sent',
          sentAt: item.latestNotification?.sentAt?.toISOString() ?? null,
          deliveredAt: item.latestNotification?.deliveredAt?.toISOString() ?? null,
          readAt: item.latestNotification?.readAt?.toISOString() ?? null,
          error: item.latestNotification?.error ?? null,
        },
      }
    })
    res.json({ items: results, count: results.length })
  } catch (err) {
    next(err)
  }
})

/**
 * GET /api/admin/whatsapp/campaigns
 * History of custom broadcast campaigns with full progress accounting.
 */
router.get('/campaigns', async (_req: Request, res: Response, next) => {
  try {
    const campaigns = await WhatsAppCampaign.find().sort({ createdAt: -1 }).limit(50)
    res.json({
      items: campaigns.map((c) => {
        const sent = c.stats.sent || 0
        const failed = c.stats.failed || 0
        const delivered = c.stats.delivered || 0
        const read = c.stats.read || 0
        const paused = c.stats.paused || 0
        const processed = sent + failed
        const remaining = Math.max(0, c.recipientCount - processed)

        return {
          id: c._id.toString(),
          name: c.name,
          message: c.message,
          mediaUrl: c.mediaUrl,
          recipientFilter: c.recipientFilter,
          recipientCount: c.recipientCount,
          stats: {
            processed,
            sent,
            delivered,
            read,
            failed,
            paused,
            remaining,
          },
          status: c.status,
          error: c.error,
          createdAt: c.createdAt.toISOString(),
          completedAt: c.completedAt?.toISOString() ?? null,
        }
      }),
    })
  } catch (err) {
    next(err)
  }
})

/**
 * GET /api/admin/whatsapp/history
 * Complete message dispatch logs with attempt count and pause telemetry.
 */
router.get('/history', async (req: Request, res: Response, next) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 100)
    const logs = await WhatsAppNotification.find()
      .populate('member', 'fullName memberId phone')
      .sort({ createdAt: -1 })
      .limit(limit)

    res.json({
      items: logs.map((log) => ({
        id: log._id.toString(),
        memberId: log.memberId,
        memberName: (log.member as unknown as { fullName?: string })?.fullName ?? 'Unknown',
        phoneNumber: log.phoneNumber,
        type: log.type,
        provider: log.provider || 'unknown',
        status: log.status,
        attempts: log.attempts || 0,
        lastAttemptAt: log.lastAttemptAt?.toISOString() ?? null,
        pausedAt: log.pausedAt?.toISOString() ?? null,
        message: log.message,
        mediaUrl: log.mediaUrl,
        sentAt: log.sentAt?.toISOString() ?? null,
        deliveredAt: log.deliveredAt?.toISOString() ?? null,
        readAt: log.readAt?.toISOString() ?? null,
        error: log.error,
        createdAt: log.createdAt.toISOString(),
      })),
    })
  } catch (err) {
    next(err)
  }
})

/**
 * GET /api/admin/whatsapp/queue/status
 * Telemetry and status of the shared outbound rate-limited queue.
 */
router.get('/queue/status', async (_req: Request, res: Response, next) => {
  try {
    const queueStatus = await outboundQueueService.getQueueStatus()
    res.json(queueStatus)
  } catch (err) {
    next(err)
  }
})

/**
 * POST /api/admin/whatsapp/queue/pause
 * Manually pauses the outbound messaging queue.
 */
router.post('/queue/pause', async (req: Request, res: Response, next) => {
  try {
    const reason = typeof req.body?.reason === 'string' ? req.body.reason : 'Paused by administrator'
    outboundQueueService.pauseQueue(reason)
    res.json({ success: true, message: 'Outbound messaging queue paused' })
  } catch (err) {
    next(err)
  }
})

/**
 * POST /api/admin/whatsapp/queue/resume
 * Resumes the outbound messaging queue.
 */
router.post('/queue/resume', async (_req: Request, res: Response, next) => {
  try {
    const resumedCount = await outboundQueueService.resumeQueue()
    res.json({ success: true, resumedCount, message: 'Outbound messaging queue resumed' })
  } catch (err) {
    next(err)
  }
})

/**
 * POST /api/admin/whatsapp/campaigns/preview
 * Calculates recipient count for a given filter before sending.
 */
router.post('/campaigns/preview', async (req: Request, res: Response, next) => {
  try {
    const filter = String(req.body.recipientFilter || 'all')
    const planId = req.body.planId ? String(req.body.planId) : undefined
    const recipients = await whatsAppService.getRecipientsForFilter(filter, planId)

    res.json({
      recipientCount: recipients.length,
      sampleRecipients: recipients.slice(0, 5).map((m) => ({
        id: m._id.toString(),
        fullName: m.fullName,
        memberId: m.memberId,
        phone: m.phone,
      })),
    })
  } catch (err) {
    next(err)
  }
})

/**
 * POST /api/admin/whatsapp/campaigns/send
 * Dispatches a custom message campaign with recipient validation.
 */
router.post('/campaigns/send', async (req: Request, res: Response, next) => {
  try {
    const name = String(req.body.name || '').trim()
    const message = String(req.body.message || '').trim()
    const mediaUrl = req.body.mediaUrl ? String(req.body.mediaUrl).trim() : null
    const recipientFilter = String(req.body.recipientFilter || 'all')
    const planId = req.body.planId ? String(req.body.planId) : undefined

    if (!message && !mediaUrl) {
      throw ApiError.badRequest('Message body or media attachment is required')
    }

    if (!name) {
      throw ApiError.badRequest('Campaign title/name is required')
    }

    const adminId = (req.session as unknown as { adminId?: string })?.adminId || '000000000000000000000000'

    const campaign = await whatsAppService.createAndSendCampaign({
      name,
      message,
      mediaUrl,
      recipientFilter,
      planId,
      adminId,
      waitForCompletion: req.query.wait === 'true' || env.isTest,
    })

    res.json({
      success: true,
      campaign: {
        id: campaign._id.toString(),
        name: campaign.name,
        recipientCount: campaign.recipientCount,
        status: campaign.status,
      },
    })
  } catch (err) {
    next(err)
  }
})

/**
 * POST /api/admin/whatsapp/upload-image
 * Stores custom campaign image locally to provide a URL for WhatsApp.
 */
router.post('/upload-image', async (req: Request, res: Response, next) => {
  try {
    const { data, mimeType } = req.body as { data?: string; mimeType?: string }
    if (!data) {
      throw ApiError.badRequest('No image data provided')
    }

    // Strip data URL scheme if present (data:image/jpeg;base64,...)
    const base64Data = data.includes('base64,') ? data.split('base64,')[1] : data
    const buffer = Buffer.from(base64Data, 'base64')

    if (buffer.length > 5 * 1024 * 1024) {
      throw ApiError.badRequest('Image must be under 5MB')
    }

    let ext = '.jpg'
    if (mimeType?.includes('png')) ext = '.png'
    else if (mimeType?.includes('webp')) ext = '.webp'

    const filename = `wa_${Date.now()}_${crypto.randomBytes(4).toString('hex')}${ext}`
    const uploadsDir = path.resolve(process.cwd(), 'public', 'uploads', 'whatsapp')

    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true })
    }

    const filePath = path.join(uploadsDir, filename)
    fs.writeFileSync(filePath, buffer)

    const mediaUrl = `/uploads/whatsapp/${filename}`
    res.json({ mediaUrl })
  } catch (err) {
    next(err)
  }
})

/**
 * POST /api/admin/whatsapp/reminders/run
 * Triggers an immediate reminder cycle.
 */
router.post('/reminders/run', async (_req: Request, res: Response, next) => {
  try {
    const summary = await runWhatsAppReminders(new Date())
    res.json({ success: true, summary })
  } catch (err) {
    next(err)
  }
})

export default router
