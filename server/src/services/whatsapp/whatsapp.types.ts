export type NormalizedMetaPhone = string

export interface WhatsAppMessageResult {
  success: boolean
  messageId?: string
  status?: 'sent' | 'queued' | 'failed'
  error?: string
}

export interface WhatsAppTemplateParameter {
  type: 'text' | 'currency' | 'date_time'
  text?: string
}

export interface WhatsAppTemplateComponent {
  type: 'header' | 'body' | 'button'
  sub_type?: string
  index?: string
  parameters: WhatsAppTemplateParameter[]
}

export interface SendTemplateOptions {
  to: string
  templateName: string
  languageCode?: string
  components?: WhatsAppTemplateComponent[]
}

export interface SendTextOptions {
  to: string
  text: string
  previewUrl?: boolean
}

export interface SendMediaOptions {
  to: string
  type: 'image'
  mediaUrl: string
  caption?: string
}

export interface MetaWebhookStatus {
  id: string
  status: 'sent' | 'delivered' | 'read' | 'failed'
  timestamp: string
  recipient_id: string
  errors?: Array<{
    code: number
    title: string
    message?: string
    error_data?: { details: string }
  }>
}

export interface MetaWebhookEntry {
  id: string
  changes: Array<{
    value: {
      messaging_product: string
      metadata: {
        display_phone_number: string
        phone_number_id: string
      }
      statuses?: MetaWebhookStatus[]
      messages?: Array<{
        from: string
        id: string
        timestamp: string
        type: string
        text?: { body: string }
      }>
    }
    field: string
  }>
}

export interface MetaWebhookPayload {
  object: string
  entry: MetaWebhookEntry[]
}
