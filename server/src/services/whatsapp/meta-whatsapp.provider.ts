import crypto from 'node:crypto'
import type { WhatsAppProvider } from './whatsapp.provider'
import type {
  SendMediaOptions,
  SendTemplateOptions,
  SendTextOptions,
  WhatsAppMessageResult,
} from './whatsapp.types'

export interface MetaWhatsAppConfig {
  apiVersion: string
  phoneNumberId: string
  accessToken: string
  appSecret?: string
}

export class MetaWhatsAppProvider implements WhatsAppProvider {
  readonly isConfigured: boolean = true
  private readonly baseUrl: string
  private readonly accessToken: string
  private readonly appSecret?: string

  constructor(config: MetaWhatsAppConfig) {
    this.baseUrl = `https://graph.facebook.com/${config.apiVersion}/${config.phoneNumberId}/messages`
    this.accessToken = config.accessToken
    this.appSecret = config.appSecret
  }

  private async postToMeta(payload: Record<string, unknown>): Promise<WhatsAppMessageResult> {
    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      const data = (await response.json()) as {
        messages?: Array<{ id: string }>
        error?: { message?: string; code?: number; type?: string; fbtrace_id?: string }
      }

      if (!response.ok || data.error) {
        const errorMsg = data.error?.message || `Meta WhatsApp API error (${response.status})`
        return {
          success: false,
          error: errorMsg,
          status: 'failed',
        }
      }

      const messageId = data.messages?.[0]?.id
      return {
        success: true,
        messageId,
        status: 'sent',
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown Meta WhatsApp network error'
      return {
        success: false,
        error: message,
        status: 'failed',
      }
    }
  }

  async sendTemplateMessage(options: SendTemplateOptions): Promise<WhatsAppMessageResult> {
    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: options.to,
      type: 'template',
      template: {
        name: options.templateName,
        language: {
          code: options.languageCode || 'en',
        },
        components: options.components || [],
      },
    }

    return this.postToMeta(payload)
  }

  async sendTextMessage(options: SendTextOptions): Promise<WhatsAppMessageResult> {
    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: options.to,
      type: 'text',
      text: {
        preview_url: options.previewUrl ?? false,
        body: options.text,
      },
    }

    return this.postToMeta(payload)
  }

  async sendMediaMessage(options: SendMediaOptions): Promise<WhatsAppMessageResult> {
    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: options.to,
      type: 'image',
      image: {
        link: options.mediaUrl,
        ...(options.caption ? { caption: options.caption } : {}),
      },
    }

    return this.postToMeta(payload)
  }

  verifyWebhookSignature(rawBody: Buffer | string, signatureHeader?: string): boolean {
    if (!this.appSecret || !signatureHeader) return false

    const parts = signatureHeader.split('=')
    if (parts.length !== 2 || parts[0] !== 'sha256') return false

    const expectedSignature = parts[1]
    const bodyBuffer = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody, 'utf-8')

    const hmac = crypto.createHmac('sha256', this.appSecret)
    hmac.update(bodyBuffer)
    const calculatedSignature = hmac.digest('hex')

    try {
      const sigA = Buffer.from(expectedSignature, 'hex')
      const sigB = Buffer.from(calculatedSignature, 'hex')
      if (sigA.length !== sigB.length) return false
      return crypto.timingSafeEqual(sigA, sigB)
    } catch {
      return false
    }
  }
}
