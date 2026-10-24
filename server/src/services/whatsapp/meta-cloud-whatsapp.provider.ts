import crypto from 'node:crypto'
import type { WhatsAppProvider } from './whatsapp.provider'
import type {
  MetaPhoneNumberDetailsResponse,
  MetaSendMessageResponse,
  SendMediaOptions,
  SendTemplateOptions,
  SendTextOptions,
  WhatsAppConnectionStatusResult,
  WhatsAppMessageResult,
} from './whatsapp.types'

export interface MetaCloudWhatsAppConfig {
  graphApiVersion?: string
  accessToken?: string
  phoneNumberId?: string
  businessAccountId?: string
  appSecret?: string
  webhookVerifyToken?: string
  requestTimeoutMs?: number
}

export class MetaCloudWhatsAppProvider implements WhatsAppProvider {
  readonly isConfigured: boolean
  readonly graphApiVersion: string
  private readonly accessToken: string
  readonly phoneNumberId: string
  readonly businessAccountId?: string
  private readonly appSecret?: string
  private readonly webhookVerifyToken?: string
  private readonly requestTimeoutMs: number

  constructor(config: MetaCloudWhatsAppConfig) {
    this.graphApiVersion = (config.graphApiVersion || 'v26.0').trim()
    this.accessToken = (config.accessToken || '').trim()
    this.phoneNumberId = (config.phoneNumberId || '').trim()
    this.businessAccountId = config.businessAccountId?.trim()
    this.appSecret = config.appSecret?.trim()
    this.webhookVerifyToken = config.webhookVerifyToken?.trim()
    this.requestTimeoutMs = config.requestTimeoutMs ?? 15000

    this.isConfigured = Boolean(this.accessToken && this.phoneNumberId)
  }

  private get messagesUrl(): string {
    return `https://graph.facebook.com/${this.graphApiVersion}/${this.phoneNumberId}/messages`
  }

  private get phoneDetailsUrl(): string {
    return `https://graph.facebook.com/${this.graphApiVersion}/${this.phoneNumberId}`
  }

  /**
   * Diagnostic check of Meta WhatsApp Phone Number registration & quality rating.
   * Endpoint: GET https://graph.facebook.com/{GRAPH_API_VERSION}/{PHONE_NUMBER_ID}
   */
  async getConnectionStatus(): Promise<WhatsAppConnectionStatusResult> {
    if (!this.isConfigured) {
      return { state: 'unconfigured', details: 'Meta Cloud API credentials not configured' }
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 6000)

    try {
      const response = await fetch(
        `${this.phoneDetailsUrl}?fields=verified_name,display_phone_number,quality_rating,code_verification_status`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            Accept: 'application/json',
          },
          signal: controller.signal,
        },
      )

      if (response.status === 401 || response.status === 403) {
        return {
          state: 'unreachable',
          details: 'Meta authentication failed: access token is invalid or expired',
        }
      }

      if (response.status === 404) {
        return {
          state: 'disconnected',
          details: 'Phone number ID not found in Meta Business account',
        }
      }

      if (!response.ok) {
        return {
          state: 'unavailable',
          details: `Meta Graph API returned HTTP ${response.status}`,
        }
      }

      const data = (await response.json()) as MetaPhoneNumberDetailsResponse

      return {
        state: 'connected',
        rawState: data.quality_rating || 'AVAILABLE',
        details: data.verified_name || data.display_phone_number || 'Connected to Meta Cloud API',
        verifiedName: data.verified_name,
        displayPhoneNumber: data.display_phone_number,
        qualityRating: data.quality_rating,
      }
    } catch (err) {
      return {
        state: 'unreachable',
        details:
          err instanceof Error && err.name === 'AbortError'
            ? 'Connection timed out reaching Meta Graph API'
            : 'Network error connecting to Meta Graph API',
      }
    } finally {
      clearTimeout(timeout)
    }
  }

  /**
   * Dispatches an approved WhatsApp Business Template message via Meta Graph API.
   */
  async sendTemplateMessage(options: SendTemplateOptions): Promise<WhatsAppMessageResult> {
    if (!this.isConfigured) {
      return {
        success: false,
        status: 'failed',
        error: 'Meta Cloud API is not configured',
        httpStatus: 503,
      }
    }

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: options.to,
      type: 'template',
      template: {
        name: options.templateName,
        language: {
          code: options.languageCode || 'en_US',
        },
        components: options.components || [],
      },
    }

    return this.postGraphApi(payload)
  }

  /**
   * Dispatches a plain text message where permitted (e.g. within customer service window).
   */
  async sendTextMessage(options: SendTextOptions): Promise<WhatsAppMessageResult> {
    if (!this.isConfigured) {
      return {
        success: false,
        status: 'failed',
        error: 'Meta Cloud API is not configured',
        httpStatus: 503,
      }
    }

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: options.to,
      type: 'text',
      text: {
        preview_url: Boolean(options.previewUrl),
        body: options.text,
      },
    }

    return this.postGraphApi(payload, options.timeoutMs)
  }

  /**
   * Dispatches a media message (e.g. image with caption) via Meta Graph API.
   */
  async sendMediaMessage(options: SendMediaOptions): Promise<WhatsAppMessageResult> {
    if (!this.isConfigured) {
      return {
        success: false,
        status: 'failed',
        error: 'Meta Cloud API is not configured',
        httpStatus: 503,
      }
    }

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: options.to,
      type: options.type || 'image',
      [options.type || 'image']: {
        link: options.mediaUrl,
        caption: options.caption || undefined,
      },
    }

    return this.postGraphApi(payload, options.timeoutMs)
  }

  /**
   * Executes HTTP POST to Meta's messages endpoint with strict error categorization.
   * Never logs authorization tokens or application secrets.
   */
  private async postGraphApi(payload: unknown, timeoutMs?: number): Promise<WhatsAppMessageResult> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs ?? this.requestTimeoutMs)

    try {
      const response = await fetch(this.messagesUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      })

      const data = (await response.json().catch(() => ({}))) as MetaSendMessageResponse

      if (response.ok && data.messages?.[0]?.id) {
        return {
          success: true,
          messageId: data.messages[0].id,
          status: 'sent',
          httpStatus: response.status,
        }
      }

      // Handle & categorize Meta Graph API errors
      const metaError = data.error
      const categorizedError = this.categorizeMetaError(response.status, metaError)

      return {
        success: false,
        status: 'failed',
        error: categorizedError,
        httpStatus: response.status,
        fbtraceId: metaError?.fbtrace_id,
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        const timeoutError = new Error(
          'Meta Graph API request timed out without response confirmation',
        )
        timeoutError.name = 'AbortError'
        throw timeoutError
      }
      throw err
    } finally {
      clearTimeout(timeout)
    }
  }

  /**
   * Categorizes Meta Graph API error codes into descriptive messages without exposing secrets.
   */
  private categorizeMetaError(
    httpStatus: number,
    metaError?: { code?: number; message?: string; error_subcode?: number; error_data?: { details?: string } },
  ): string {
    const code = metaError?.code
    const details = metaError?.error_data?.details || metaError?.message

    if (httpStatus === 401 || code === 190) {
      return 'Meta API authentication failed: Access token is invalid, expired, or missing permissions.'
    }

    if (httpStatus === 429 || code === 130429 || code === 80007) {
      return 'Meta WhatsApp Business rate limit reached. Message queued for automatic retry.'
    }

    if (code === 131030 || code === 132000 || code === 132001) {
      return `Template error: ${details || 'Template does not exist, is unapproved, or parameters mismatch.'}`
    }

    if (code === 131047) {
      return 'Customer-service window expired: Message must use an approved Meta template.'
    }

    if (code === 131026) {
      return 'Message undeliverable: Recipient is not registered or cannot receive WhatsApp messages.'
    }

    if (code === 100) {
      return `Invalid parameter: ${details || 'Invalid message parameter.'}`
    }

    return details ? `Meta API Error (${code || httpStatus}): ${details}` : `Meta API request failed with HTTP ${httpStatus}`
  }

  /**
   * Verifies the incoming webhook HMAC-SHA256 signature against X-Hub-Signature-256.
   * Compares timing-safely to protect against timing attacks.
   */
  verifyWebhookSignature(rawBody: Buffer | string, signatureHeader?: string): boolean {
    if (!this.appSecret) {
      return true
    }

    if (!signatureHeader) {
      return false
    }

    const parts = signatureHeader.split('=')
    const signature = parts.length === 2 ? parts[1] : signatureHeader

    try {
      const hmac = crypto.createHmac('sha256', this.appSecret)
      hmac.update(typeof rawBody === 'string' ? Buffer.from(rawBody, 'utf-8') : rawBody)
      const expected = hmac.digest('hex')

      const sigBuf = Buffer.from(signature, 'hex')
      const expBuf = Buffer.from(expected, 'hex')

      if (sigBuf.length !== expBuf.length) {
        return false
      }

      return crypto.timingSafeEqual(sigBuf, expBuf)
    } catch {
      return false
    }
  }

  /**
   * Validates Meta GET verification handshake challenge.
   */
  verifyWebhookToken(mode?: string, token?: string): boolean {
    if (!this.webhookVerifyToken) return false
    if (mode !== 'subscribe' || !token) return false

    try {
      const a = Buffer.from(token, 'utf-8')
      const b = Buffer.from(this.webhookVerifyToken, 'utf-8')
      if (a.length !== b.length) return false
      return crypto.timingSafeEqual(a, b)
    } catch {
      return false
    }
  }
}
