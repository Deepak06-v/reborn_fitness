import fs from 'node:fs'
import path from 'node:path'
import type { WhatsAppProvider } from './whatsapp.provider'
import type {
  SendMediaOptions,
  SendTemplateOptions,
  SendTextOptions,
  WhatsAppConnectionStatusResult,
  WhatsAppMessageResult,
  WaportaSessionStatusResponse,
} from './whatsapp.types'
import { formatWhatsAppPhone } from '../../utils/phone'

export interface WaportaWhatsAppConfig {
  apiUrl: string
  apiKey: string
  sessionId: string
  requestTimeoutMs?: number
}

export class WaportaWhatsAppProvider implements WhatsAppProvider {
  readonly isConfigured: boolean
  private readonly baseUrl: string
  private readonly apiKey: string
  readonly sessionId: string
  private readonly requestTimeoutMs: number

  constructor(config: WaportaWhatsAppConfig) {
    this.baseUrl = (config.apiUrl || '').trim().replace(/\/+$/, '')
    this.apiKey = (config.apiKey || '').trim()
    this.sessionId = (config.sessionId || 'reborn-fitness').trim()
    this.requestTimeoutMs = config.requestTimeoutMs ?? 15000

    this.isConfigured = Boolean(this.baseUrl && this.apiKey && this.sessionId)
  }

  /**
   * Queries session connectivity state from Waporta.
   * Endpoint: GET /api/whatsapp/sessions/:sessionId
   */
  async getConnectionStatus(): Promise<WhatsAppConnectionStatusResult> {
    if (!this.isConfigured) {
      return { state: 'unconfigured' }
    }

    const endpoint = `${this.baseUrl}/api/whatsapp/sessions/${encodeURIComponent(this.sessionId)}`
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)

    try {
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'X-API-Key': this.apiKey,
        },
        signal: controller.signal,
      })

      if (response.status === 401 || response.status === 403) {
        return {
          state: 'unreachable',
          details: `Authentication failed (HTTP ${response.status})`,
        }
      }

      if (response.status === 404) {
        return {
          state: 'disconnected',
          details: 'Waporta session not found',
        }
      }

      const data = (await response.json()) as WaportaSessionStatusResponse

      const stateVal = (
        data.session?.status ??
        data.session?.state ??
        data.status ??
        data.state ??
        ''
      ).toLowerCase()

      if (stateVal === 'connected' || stateVal === 'open') {
        return { state: 'connected', rawState: stateVal }
      }

      if (
        stateVal === 'connecting' ||
        stateVal === 'disconnected' ||
        stateVal === 'closed' ||
        stateVal === 'close'
      ) {
        return {
          state: 'disconnected',
          rawState: stateVal,
          details: stateVal === 'connecting' ? 'Session connecting' : undefined,
        }
      }

      return {
        state: 'unavailable',
        rawState: stateVal || JSON.stringify(data),
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Network error'
      return {
        state: 'unreachable',
        details: msg,
      }
    } finally {
      clearTimeout(timeout)
    }
  }

  /**
   * Diagnostic query for message status held in Waporta's memory cache.
   * Endpoint: GET /api/whatsapp/messages/:messageId
   */
  async getMessageStatus(messageId: string): Promise<Record<string, unknown> | null> {
    if (!this.isConfigured || !messageId) return null

    const endpoint = `${this.baseUrl}/api/whatsapp/messages/${encodeURIComponent(messageId)}`
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)

    try {
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'X-API-Key': this.apiKey,
        },
        signal: controller.signal,
      })

      if (!response.ok) return null
      return (await response.json()) as Record<string, unknown>
    } catch {
      return null
    } finally {
      clearTimeout(timeout)
    }
  }

  /**
   * Sends a standard text message via Waporta.
   * Endpoint: POST /api/whatsapp/send/text
   */
  async sendTextMessage(options: SendTextOptions): Promise<WhatsAppMessageResult> {
    if (!this.isConfigured) {
      return {
        success: false,
        error: 'Waporta provider is not configured',
        status: 'failed',
      }
    }

    const recipientPhone = formatWhatsAppPhone(options.to)
    if (!recipientPhone) {
      return {
        success: false,
        error: 'Invalid recipient phone number',
        status: 'failed',
      }
    }

    const endpoint = `${this.baseUrl}/api/whatsapp/send/text`
    const payload = {
      sessionId: this.sessionId,
      to: recipientPhone,
      text: options.text,
    }

    return this.postToWaporta(endpoint, payload, options.timeoutMs)
  }

  /**
   * Sends an image or media message via Waporta.
   * Resolves local uploads to secure base64 data URIs so external Waporta servers can consume them.
   * Endpoint: POST /api/whatsapp/send/image
   */
  async sendMediaMessage(options: SendMediaOptions): Promise<WhatsAppMessageResult> {
    if (!this.isConfigured) {
      return {
        success: false,
        error: 'Waporta provider is not configured',
        status: 'failed',
      }
    }

    const recipientPhone = formatWhatsAppPhone(options.to)
    if (!recipientPhone) {
      return {
        success: false,
        error: 'Invalid recipient phone number',
        status: 'failed',
      }
    }

    const resolvedMedia = this.resolveMediaPayload(options.mediaUrl)
    if (!resolvedMedia) {
      return {
        success: false,
        error: 'Media attachment could not be read or is invalid',
        status: 'failed',
      }
    }

    const endpoint = `${this.baseUrl}/api/whatsapp/send/image`
    const payload = {
      sessionId: this.sessionId,
      to: recipientPhone,
      media: resolvedMedia,
      text: options.caption || undefined,
    }

    return this.postToWaporta(endpoint, payload, options.timeoutMs)
  }

  /**
   * Adapts legacy template options into a regular formatted text message.
   */
  async sendTemplateMessage(options: SendTemplateOptions): Promise<WhatsAppMessageResult> {
    const textPieces: string[] = []
    for (const comp of options.components || []) {
      for (const param of comp.parameters || []) {
        if (param.text) textPieces.push(param.text)
      }
    }
    const text = textPieces.length > 0 ? textPieces.join(' | ') : `Template: ${options.templateName}`
    return this.sendTextMessage({ to: options.to, text })
  }

  /**
   * Resolves a mediaUrl into either an existing HTTPS URL or a base64 Data URI.
   * Guards against directory traversal outside public/uploads/whatsapp.
   */
  private resolveMediaPayload(mediaUrl: string): string | null {
    if (!mediaUrl) return null

    // Pass through valid remote HTTPS URLs or base64 data URIs directly
    if (
      mediaUrl.startsWith('https://') ||
      mediaUrl.startsWith('http://') ||
      mediaUrl.startsWith('data:')
    ) {
      return mediaUrl
    }

    try {
      const cleanRel = mediaUrl.replace(/^\/+/, '')
      const allowedBase = path.resolve(process.cwd(), 'public', 'uploads', 'whatsapp')
      const targetPath = path.resolve(process.cwd(), 'public', cleanRel)

      if (!targetPath.startsWith(allowedBase)) {
        return null
      }

      if (!fs.existsSync(targetPath)) {
        return null
      }

      const fileBuffer = fs.readFileSync(targetPath)
      const ext = path.extname(targetPath).toLowerCase()
      let mime = 'image/jpeg'
      if (ext === '.png') mime = 'image/png'
      else if (ext === '.webp') mime = 'image/webp'

      return `data:${mime};base64,${fileBuffer.toString('base64')}`
    } catch {
      return null
    }
  }

  /**
   * Shared POST helper for Waporta API requests with distinct status handling.
   */
  private async postToWaporta(
    url: string,
    payload: Record<string, unknown>,
    timeoutMs?: number,
  ): Promise<WhatsAppMessageResult> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs ?? this.requestTimeoutMs)

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'X-API-Key': this.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      })

      const data = (await response.json().catch(() => null)) as {
        status?: string
        messageId?: string
        id?: string
        key?: { id?: string }
        ack?: string
        error?: string | { message?: string }
        message?: string | string[]
      } | null

      if (!response.ok) {
        let errorMsg = `Waporta API error (${response.status})`
        if (typeof data?.error === 'string') {
          errorMsg = data.error
        } else if (typeof data?.error === 'object' && data.error?.message) {
          errorMsg = data.error.message
        } else if (typeof data?.message === 'string') {
          errorMsg = data.message
        } else if (Array.isArray(data?.message)) {
          errorMsg = data.message.join(', ')
        }

        // Distinct provider error categorization
        if (response.status === 429) {
          errorMsg = `Rate limit or quota exceeded (HTTP 429): ${errorMsg}`
        } else if (response.status === 422) {
          errorMsg = `Recipient is not registered on WhatsApp (HTTP 422): ${errorMsg}`
        } else if (response.status === 403) {
          errorMsg = `Waporta session rejected or banned (HTTP 403): ${errorMsg}`
        } else if (response.status === 503) {
          errorMsg = `Waporta session unavailable (HTTP 503): ${errorMsg}`
        }

        return {
          success: false,
          error: errorMsg,
          status: 'failed',
          httpStatus: response.status,
        }
      }

      const messageId = data?.messageId || data?.id || data?.key?.id

      // Critical requirement: Waporta's initial response (ack: socket) indicates only that
      // the message was written to the WhatsApp connection socket. It does NOT prove delivery.
      // Therefore, the application initially records this as 'queued' until a stronger
      // delivery-status webhook event (e.g. server, delivered, read) arrives.
      return {
        success: true,
        messageId,
        status: 'queued',
      }
    } catch (err) {
      const isAbort = err instanceof Error && err.name === 'AbortError'
      const error = isAbort
        ? 'Waporta API request timed out'
        : err instanceof Error
          ? err.message
          : 'Unknown network error'
      return {
        success: false,
        error,
        status: 'failed',
      }
    } finally {
      clearTimeout(timer)
    }
  }
}
