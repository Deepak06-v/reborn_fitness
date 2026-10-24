import type {
  SendMediaOptions,
  SendTemplateOptions,
  SendTextOptions,
  WhatsAppConnectionStatusResult,
  WhatsAppMessageResult,
} from './whatsapp.types'

export interface WhatsAppProvider {
  readonly isConfigured: boolean

  getConnectionStatus?(): Promise<WhatsAppConnectionStatusResult>

  sendTextMessage(options: SendTextOptions): Promise<WhatsAppMessageResult>

  sendMediaMessage(options: SendMediaOptions): Promise<WhatsAppMessageResult>

  sendTemplateMessage(options: SendTemplateOptions): Promise<WhatsAppMessageResult>

  verifyWebhookSignature?(rawBody: Buffer | string, signatureHeader?: string): boolean

  verifyWebhookToken?(mode?: string, token?: string): boolean
}
