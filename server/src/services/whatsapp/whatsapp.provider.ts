import type {
  SendMediaOptions,
  SendTemplateOptions,
  SendTextOptions,
  WhatsAppMessageResult,
} from './whatsapp.types'

export interface WhatsAppProvider {
  readonly isConfigured: boolean

  sendTemplateMessage(options: SendTemplateOptions): Promise<WhatsAppMessageResult>

  sendTextMessage(options: SendTextOptions): Promise<WhatsAppMessageResult>

  sendMediaMessage(options: SendMediaOptions): Promise<WhatsAppMessageResult>

  verifyWebhookSignature(rawBody: Buffer | string, signatureHeader?: string): boolean
}
