import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import type { WhatsAppProvider } from './whatsapp.provider'
import type {
  SendMediaOptions,
  SendTemplateOptions,
  SendTextOptions,
  WhatsAppConnectionStatusResult,
  WhatsAppMessageResult,
} from './whatsapp.types'

export interface EvolutionWhatsAppConfig {
  apiUrl: string
  apiKey: string
  instanceName: string
  webhookSecret?: string
  requestTimeoutMs?: number
}

export class EvolutionWhatsAppProvider implements WhatsAppProvider {
  readonly isConfigured: boolean
  private readonly baseUrl: string
  private readonly apiKey: string
  private readonly instanceName: string
  private readonly webhookSecret?: string
  private readonly requestTimeoutMs: number

  constructor(config: EvolutionWhatsAppConfig) {
    this.baseUrl = (config.apiUrl || '').trim().replace(/\/+$/, '')
    this.apiKey = (config.apiKey || '').trim()
    this.instanceName = (config.instanceName || 'reborn-fitness').trim()
    this.webhookSecret = config.webhookSecret?.trim()
    this.requestTimeoutMs = config.requestTimeoutMs ?? 15000

    this.isConfigured = Boolean(this.baseUrl && this.apiKey && this.instanceName)
  }

  /**
   * Safe check for the Evolution instance connection state.
   * Endpoint: GET /instance/connectionState/{instanceName}
   */
  async getConnectionStatus(): Promise<WhatsAppConnectionStatusResult> {
    if (!this.isConfigured) {
      return { state: 'unconfigured' }
    }

    const endpoint = `${this.baseUrl}/instance/connectionState/${encodeURIComponent(this.instanceName)}`
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)

    try {
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          apikey: this.apiKey,
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
          details: 'Evolution instance not found',
        }
      }

      const data = (await response.json()) as {
        instance?: { state?: string }
        state?: string
        status?: string
      }

      const stateVal = (
        data.instance?.state ??
        data.state ??
        data.status ??
        ''
      ).toLowerCase()

      if (stateVal === 'open' || stateVal === 'connected') {
        return { state: 'connected', rawState: stateVal }
      }

      if (
        stateVal === 'close' ||
        stateVal === 'closed' ||
        stateVal === 'connecting' ||
        stateVal === 'disconnected'
      ) {
        return { state: 'disconnected', rawState: stateVal }
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
   * Sends a standard text message.
   * Endpoint: POST /message/sendText/{instanceName}
   */
  async sendTextMessage(options: SendTextOptions): Promise<WhatsAppMessageResult> {
    if (!this.isConfigured) {
      return {
        success: false,
        error: 'Evolution API provider is not configured',
        status: 'failed',
      }
    }

    const endpoint = `${this.baseUrl}/message/sendText/${encodeURIComponent(this.instanceName)}`
    const payload = {
      number: options.to,
      text: options.text,
    }

    return this.postToEvolution(endpoint, payload, options.timeoutMs)
  }

  /**
   * Sends an image or media message.
   * Resolves local relative paths into base64 Data URIs so remote Evolution servers can receive them.
   * Endpoint: POST /message/sendMedia/{instanceName}
   */
  async sendMediaMessage(options: SendMediaOptions): Promise<WhatsAppMessageResult> {
    if (!this.isConfigured) {
      return {
        success: false,
        error: 'Evolution API provider is not configured',
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

    const endpoint = `${this.baseUrl}/message/sendMedia/${encodeURIComponent(this.instanceName)}`
    const payload = {
      number: options.to,
      mediatype: options.type || 'image',
      media: resolvedMedia,
      caption: options.caption ?? '',
    }

    return this.postToEvolution(endpoint, payload, options.timeoutMs)
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
   * Constant-time comparison for webhook shared secret validation.
   */
  verifyWebhookSecret(providedSecret?: string): boolean {
    if (!this.webhookSecret || !providedSecret) return false
    try {
      const a = Buffer.from(providedSecret, 'utf-8')
      const b = Buffer.from(this.webhookSecret, 'utf-8')
      if (a.length !== b.length) return false
      return crypto.timingSafeEqual(a, b)
    } catch {
      return false
    }
  }

  /**
   * Resolves a mediaUrl into either a valid web URL or a base64 Data URI.
   * Prevents directory traversal outside public/uploads/whatsapp.
   */
  private resolveMediaPayload(mediaUrl: string): string | null {
    if (!mediaUrl) return null

    // If it's already a public URL or data URI, pass it through directly
    if (
      mediaUrl.startsWith('http://') ||
      mediaUrl.startsWith('https://') ||
      mediaUrl.startsWith('data:')
    ) {
      return mediaUrl
    }

    try {
      // Relative upload path, e.g. /uploads/whatsapp/wa_xxx.jpg
      const cleanRel = mediaUrl.replace(/^\/+/, '')
      const allowedBase = path.resolve(process.cwd(), 'public', 'uploads', 'whatsapp')
      const targetPath = path.resolve(process.cwd(), 'public', cleanRel)

      // Guard against directory traversal
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
   * Shared POST helper for Evolution API requests with timeout and error handling.
   */
  private async postToEvolution(
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
          apikey: this.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      })

      const data = (await response.json().catch(() => null)) as {
        key?: { id?: string }
        id?: string
        messageId?: string
        status?: string
        error?: string | { message?: string }
        message?: string | string[]
      } | null

      if (!response.ok) {
        let errorMsg = `Evolution API error (${response.status})`
        if (typeof data?.error === 'string') {
          errorMsg = data.error
        } else if (typeof data?.error === 'object' && data.error?.message) {
          errorMsg = data.error.message
        } else if (typeof data?.message === 'string') {
          errorMsg = data.message
        } else if (Array.isArray(data?.message)) {
          errorMsg = data.message.join(', ')
        }

        return {
          success: false,
          error: errorMsg,
          status: 'failed',
        }
      }

      const messageId = data?.key?.id || data?.messageId || data?.id
      return {
        success: true,
        messageId,
        status: 'sent',
      }
    } catch (err) {
      const isAbort = err instanceof Error && err.name === 'AbortError'
      const error = isAbort ? 'Evolution API request timed out' : (err instanceof Error ? err.message : 'Unknown network error')
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
