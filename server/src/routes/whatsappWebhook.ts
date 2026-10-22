import { Router, type Request, type Response } from 'express'
import { env } from '../config/env'
import { whatsAppService } from '../services/whatsapp/whatsapp.service'

const router = Router()

/**
 * GET /api/whatsapp/webhook
 * Meta Webhook verification handshake.
 */
router.get('/', (req: Request, res: Response): void => {
  const mode = req.query['hub.mode']
  const token = req.query['hub.verify_token']
  const challenge = req.query['hub.challenge']

  if (!mode || !token) {
    res.status(400).send('Missing hub.mode or hub.verify_token')
    return
  }

  const configuredVerifyToken = process.env.WHATSAPP_VERIFY_TOKEN || env.WHATSAPP_VERIFY_TOKEN

  if (mode === 'subscribe' && configuredVerifyToken && token === configuredVerifyToken) {
    res.status(200).send(challenge)
    return
  }

  res.status(403).send('Verification token mismatch')
})

/**
 * POST /api/whatsapp/webhook
 * Receives delivery receipts and status updates from Meta.
 */
router.post('/', async (req: Request, res: Response): Promise<void> => {
  const signature = req.headers['x-hub-signature-256'] as string | undefined
  const rawBody = (req as unknown as { rawBody?: Buffer }).rawBody || Buffer.from(JSON.stringify(req.body))

  // If WHATSAPP_APP_SECRET is configured, enforce signature verification
  if (env.WHATSAPP_APP_SECRET) {
    const isValid = whatsAppService.getProvider().verifyWebhookSignature(rawBody, signature)
    if (!isValid) {
      res.status(401).json({ error: 'Invalid webhook signature' })
      return
    }
  }

  try {
    const processed = await whatsAppService.processMetaWebhookPayload(req.body)
    res.status(200).json({ status: 'ok', processed })
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[whatsapp-webhook] Error processing webhook:', err)
    // Always return 200 to Meta once received so Meta doesn't disable the webhook endpoint
    res.status(200).json({ status: 'error', message: 'Failed to process webhook events' })
  }
})

export default router
