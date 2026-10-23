import crypto from 'node:crypto'
import { Router, type Request, type Response } from 'express'
import { env } from '../config/env'
import { whatsAppService } from '../services/whatsapp/whatsapp.service'

const router = Router()

/**
 * Constant-time comparison for webhook verification token.
 */
function verifyTokenSafe(provided?: string, configured?: string): boolean {
  if (!configured || !provided) return false
  try {
    const a = Buffer.from(provided, 'utf-8')
    const b = Buffer.from(configured, 'utf-8')
    if (a.length !== b.length) return false
    return crypto.timingSafeEqual(a, b)
  } catch {
    return false
  }
}

/**
 * Constant-time HMAC-SHA256 signature verification against X-Hub-Signature-256.
 */
function verifySignatureSafe(
  rawBody: Buffer | string,
  signatureHeader?: string,
  secret?: string,
): boolean {
  if (!secret) return true
  if (!signatureHeader) return false

  const parts = signatureHeader.split('=')
  const signature = parts.length === 2 ? parts[1] : signatureHeader

  try {
    const hmac = crypto.createHmac('sha256', secret)
    hmac.update(typeof rawBody === 'string' ? Buffer.from(rawBody, 'utf-8') : rawBody)
    const expected = hmac.digest('hex')

    const sigBuf = Buffer.from(signature, 'hex')
    const expBuf = Buffer.from(expected, 'hex')

    if (sigBuf.length !== expBuf.length) return false
    return crypto.timingSafeEqual(sigBuf, expBuf)
  } catch {
    return false
  }
}

/**
 * GET /api/whatsapp/webhook
 * Meta WhatsApp Cloud API verification handshake.
 * Verifies hub.mode === 'subscribe' and hub.verify_token before echoing hub.challenge.
 */
router.get('/', (req: Request, res: Response): void => {
  const mode = req.query['hub.mode'] as string | undefined
  const verifyToken = req.query['hub.verify_token'] as string | undefined
  const challenge = req.query['hub.challenge'] as string | undefined

  const configuredToken = env.WHATSAPP_WEBHOOK_VERIFY_TOKEN

  if (mode === 'subscribe' && configuredToken && verifyTokenSafe(verifyToken, configuredToken)) {
    res.status(200).send(challenge)
    return
  }

  res.status(403).json({ error: 'Forbidden: invalid verification token or mode' })
})

/**
 * POST /api/whatsapp/webhook
 * Receives Meta WhatsApp Cloud API webhook events (statuses, inbound messages).
 * Validates X-Hub-Signature-256 header using configured WHATSAPP_APP_SECRET.
 */
router.post('/', async (req: Request, res: Response): Promise<void> => {
  const signatureHeader = req.headers['x-hub-signature-256'] as string | undefined
  const appSecret = env.WHATSAPP_APP_SECRET

  // If app secret is configured, enforce strict HMAC-SHA256 signature verification
  if (appSecret) {
    const rawBody =
      (req as unknown as { rawBody?: Buffer }).rawBody ??
      Buffer.from(JSON.stringify(req.body || {}), 'utf-8')

    const isValid = verifySignatureSafe(rawBody, signatureHeader, appSecret)

    if (!isValid) {
      res.status(401).json({ error: 'Unauthorized: invalid webhook signature' })
      return
    }
  }

  try {
    const processed = await whatsAppService.processMetaWebhookPayload(req.body)
    res.status(200).json({ status: 'ok', processed })
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[whatsapp-webhook] Error processing webhook event:', err)
    res.status(200).json({ status: 'error', message: 'Failed to process webhook events' })
  }
})

export default router
