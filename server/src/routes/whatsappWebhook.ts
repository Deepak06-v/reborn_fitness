import crypto from 'node:crypto'
import { Router, type Request, type Response } from 'express'
import { env } from '../config/env'
import { whatsAppService } from '../services/whatsapp/whatsapp.service'

const router = Router()

/**
 * Constant-time string comparison for webhook shared secret validation.
 */
function verifySecret(providedSecret?: string, configuredSecret?: string): boolean {
  if (!configuredSecret || !providedSecret) return false
  try {
    const a = Buffer.from(providedSecret, 'utf-8')
    const b = Buffer.from(configuredSecret, 'utf-8')
    if (a.length !== b.length) return false
    return crypto.timingSafeEqual(a, b)
  } catch {
    return false
  }
}

/**
 * GET /api/whatsapp/evolution-webhook
 * Connectivity and health check for the Evolution API webhook.
 */
router.get('/', (_req: Request, res: Response): void => {
  res.status(200).json({ status: 'ok', service: 'evolution-webhook' })
})

/**
 * POST /api/whatsapp/evolution-webhook
 * Receives Evolution API webhook events (CONNECTION_UPDATE, MESSAGES_UPDATE, SEND_MESSAGE, etc.)
 */
router.post('/', async (req: Request, res: Response): Promise<void> => {
  const secretHeader = (
    req.headers['x-webhook-secret'] ||
    req.headers['apikey'] ||
    req.headers['x-api-key'] ||
    req.headers['authorization']
  ) as string | undefined

  const rawSecret = process.env.EVOLUTION_WEBHOOK_SECRET ?? env.EVOLUTION_WEBHOOK_SECRET
  const configuredSecret = rawSecret && rawSecret !== 'undefined' ? rawSecret : undefined

  // If a webhook secret is configured or if running in production, enforce strict secret check
  if (configuredSecret) {
    const isValid = verifySecret(secretHeader, configuredSecret)
    if (!isValid) {
      res.status(401).json({ error: 'Unauthorized: invalid webhook secret' })
      return
    }
  }

  try {
    // Check if incoming payload is a legacy Meta payload or Evolution payload
    let processed = 0
    if (req.body?.entry && Array.isArray(req.body.entry)) {
      processed = await whatsAppService.processMetaWebhookPayload(req.body)
    } else {
      processed = await whatsAppService.processEvolutionWebhookPayload(req.body)
    }

    res.status(200).json({ status: 'ok', processed })
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[evolution-webhook] Error processing webhook event:', err)
    res.status(200).json({ status: 'error', message: 'Failed to process webhook events' })
  }
})

export default router
