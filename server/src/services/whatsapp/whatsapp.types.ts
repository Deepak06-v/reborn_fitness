export type NormalizedMetaPhone = string

export type WhatsAppProviderType = 'mock' | 'cloud_api'

export interface WhatsAppMessageResult {
  success: boolean
  messageId?: string
  status?: 'sent' | 'queued' | 'failed'
  error?: string
  httpStatus?: number
  fbtraceId?: string
}

export type WhatsAppConnectionState =
  | 'disabled'
  | 'not_configured'
  | 'unreachable'
  | 'disconnected'
  | 'connected'
  | 'unavailable'

export interface WhatsAppConnectionStatusResult {
  state: 'connected' | 'disconnected' | 'unreachable' | 'unconfigured' | 'unavailable'
  rawState?: string
  details?: string
  verifiedName?: string
  displayPhoneNumber?: string
  qualityRating?: string
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
  timeoutMs?: number
}

export interface SendMediaOptions {
  to: string
  type?: 'image' | 'document' | 'video'
  mediaUrl: string
  caption?: string
  timeoutMs?: number
}

export interface MetaApiError {
  message: string
  type?: string
  code: number
  error_subcode?: number
  error_data?: {
    messaging_product?: string
    details?: string
  }
  fbtrace_id?: string
}

export interface MetaSendMessageResponse {
  messaging_product?: string
  contacts?: Array<{
    input: string
    wa_id: string
  }>
  messages?: Array<{
    id: string
    message_status?: string
  }>
  error?: MetaApiError
}

export interface MetaPhoneNumberDetailsResponse {
  id: string
  verified_name?: string
  display_phone_number?: string
  quality_rating?: string
  code_verification_status?: string
  account_mode?: string
  error?: MetaApiError
}

export interface MetaWebhookStatus {
  id: string
  status: 'sent' | 'delivered' | 'read' | 'failed'
  timestamp: string
  recipient_id: string
  conversation?: {
    id: string
    expiration_timestamp?: string
    origin?: {
      type: string
    }
  }
  pricing?: {
    billable: boolean
    pricing_model: string
    category: string
  }
  errors?: Array<{
    code: number
    title: string
    message?: string
    error_data?: { details: string }
  }>
}

export interface MetaWebhookMessage {
  from: string
  id: string
  timestamp: string
  type: string
  text?: { body: string }
  [key: string]: unknown
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
      messages?: MetaWebhookMessage[]
      errors?: Array<{
        code: number
        title: string
        message?: string
      }>
    }
    field: string
  }>
}

export interface MetaWebhookPayload {
  object: string
  entry: MetaWebhookEntry[]
}
