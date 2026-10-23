import { Router, type Request, type Response } from 'express'
import { env } from '../config/env'
import { whatsAppService } from '../services/whatsapp/whatsapp.service'

const router = Router()

/**
 * GET connectivity / health check for Waporta webhook.
 */
router.get('/', (_req: Request, res: Response): void => {
  res.status(200).json({ status: 'ok', service: 'waporta-webhook' })
})

/**
 * POST handler for Waporta delivery status webhooks.
 * Protected by high-entropy unguessable path (WAPORTA_WEBHOOK_PATH) and session validation.
 */
router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const payload = req.body

    // Basic structure validation
    if (!payload || typeof payload !== 'object') {
      res.status(400).json({ error: 'Invalid payload structure' })
      return
    }

    // Session validation if present in payload
    const eventSession = payload.sessionId || payload.data?.sessionId
    if (
      eventSession &&
      env.WAPORTA_SESSION_ID &&
      eventSession !== env.WAPORTA_SESSION_ID
    ) {
      res.status(403).json({ error: 'Mismatched session ID' })
      return
    }

    const processed = await whatsAppService.processWaportaWebhookPayload(payload)
    res.status(200).json({ status: 'ok', processed })
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[waporta-webhook] Error processing status webhook event:', err)
    res.status(200).json({ status: 'error', message: 'Failed to process webhook event' })
  }
})

export default router
