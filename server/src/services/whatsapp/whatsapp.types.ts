export type NormalizedEvolutionPhone = string
export type NormalizedMetaPhone = string

export interface WhatsAppMessageResult {
  success: boolean
  messageId?: string
  status?: 'sent' | 'queued' | 'failed'
  error?: string
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
  type: 'image'
  mediaUrl: string
  caption?: string
  timeoutMs?: number
}

export interface EvolutionWebhookEventData {
  key?: {
    remoteJid?: string
    fromMe?: boolean
    id?: string
  }
  keyId?: string
  id?: string
  messageId?: string
  status?: string | number
  update?: {
    status?: string | number
  }
  messageTimestamp?: number | string
  date_time?: string
  error?: string | { message?: string }
  [key: string]: unknown
}

export interface EvolutionWebhookPayload {
  event?: string
  instance?: string
  data?: EvolutionWebhookEventData | EvolutionWebhookEventData[]
  sender?: string
  destination?: string
  date_time?: string
  server_url?: string
  apikey?: string
  [key: string]: unknown
}

// Retained for historical / backward-compatibility
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
