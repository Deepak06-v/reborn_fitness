import crypto from 'node:crypto'
import type { WhatsAppProvider } from './whatsapp.provider'
import type {
  SendMediaOptions,
  SendTemplateOptions,
  SendTextOptions,
  WhatsAppConnectionStatusResult,
  WhatsAppMessageResult,
} from './whatsapp.types'

export class MockWhatsAppProvider implements WhatsAppProvider {
  readonly isConfigured: boolean = false
  public simulatedConnectionState: 'connected' | 'disconnected' | 'unreachable' | 'unconfigured' | 'unavailable' | null = null
  public sentMessages: Array<{
    type: 'template' | 'text' | 'media'
    to: string
    payload: unknown
    timestamp: Date
  }> = []

  constructor(isConfigured = false) {
    this.isConfigured = isConfigured
  }

  async getConnectionStatus(): Promise<WhatsAppConnectionStatusResult> {
    if (this.simulatedConnectionState) {
      return { state: this.simulatedConnectionState }
    }
    return {
      state: this.isConfigured ? 'connected' : 'unconfigured',
      rawState: this.isConfigured ? 'open' : 'disconnected',
    }
  }

  async sendTemplateMessage(options: SendTemplateOptions): Promise<WhatsAppMessageResult> {
    const messageId = `mock_wamid_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`
    this.sentMessages.push({
      type: 'template',
      to: options.to,
      payload: options,
      timestamp: new Date(),
    })
    return {
      success: true,
      messageId,
      status: 'sent',
    }
  }

  async sendTextMessage(options: SendTextOptions): Promise<WhatsAppMessageResult> {
    const messageId = `mock_wamid_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`
    this.sentMessages.push({
      type: 'text',
      to: options.to,
      payload: options,
      timestamp: new Date(),
    })
    return {
      success: true,
      messageId,
      status: 'sent',
    }
  }

  async sendMediaMessage(options: SendMediaOptions): Promise<WhatsAppMessageResult> {
    const messageId = `mock_wamid_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`
    this.sentMessages.push({
      type: 'media',
      to: options.to,
      payload: options,
      timestamp: new Date(),
    })
    return {
      success: true,
      messageId,
      status: 'sent',
    }
  }

  verifyWebhookSecret(_providedSecret?: string): boolean {
    return true
  }

  verifyWebhookSignature(_rawBody: Buffer | string, signatureHeader?: string): boolean {
    if (!signatureHeader) return false
    return true
  }
}
