import { Schema, model, models, type Document, type Model, type Types } from 'mongoose'

export type WhatsAppNotificationType =
  | 'FEE_DUE_2_DAYS'
  | 'FEE_OVERDUE'
  | 'CUSTOM'
  | 'GYM_CLOSURE'
  | 'FESTIVE_OFFER'

export type WhatsAppDeliveryStatus =
  | 'not_sent'
  | 'queued'
  | 'sent'
  | 'delivered'
  | 'read'
  | 'failed'

export interface WhatsAppNotificationDoc extends Document<Types.ObjectId> {
  _id: Types.ObjectId
  member: Types.ObjectId
  memberId: string
  phoneNumber: string
  type: WhatsAppNotificationType
  dedupKey?: string
  campaign: Types.ObjectId | null
  payment: Types.ObjectId | null
  templateName: string | null
  message: string | null
  mediaUrl: string | null
  messageId: string | null // External message identifier (Evolution / Baileys or Meta wamid)
  provider?: string | null
  status: WhatsAppDeliveryStatus
  error: string | null
  sentAt: Date | null
  deliveredAt: Date | null
  readAt: Date | null
  failedAt: Date | null
  metadata: Record<string, unknown>
  createdAt: Date
  updatedAt: Date
}

const whatsAppNotificationSchema = new Schema<WhatsAppNotificationDoc>(
  {
    member: { type: Schema.Types.ObjectId, ref: 'Member', required: true, index: true },
    memberId: { type: String, required: true, index: true },
    phoneNumber: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ['FEE_DUE_2_DAYS', 'FEE_OVERDUE', 'CUSTOM', 'GYM_CLOSURE', 'FESTIVE_OFFER'],
      required: true,
      index: true,
    },
    dedupKey: { type: String, trim: true, sparse: true, unique: true },
    campaign: { type: Schema.Types.ObjectId, ref: 'WhatsAppCampaign', default: null, index: true },
    payment: { type: Schema.Types.ObjectId, ref: 'MonthlyPayment', default: null, index: true },
    templateName: { type: String, default: null, trim: true },
    message: { type: String, default: null, trim: true },
    mediaUrl: { type: String, default: null, trim: true },
    messageId: { type: String, default: null, trim: true, index: true, sparse: true },
    provider: { type: String, default: 'evolution', index: true },
    status: {
      type: String,
      enum: ['not_sent', 'queued', 'sent', 'delivered', 'read', 'failed'],
      default: 'not_sent',
      index: true,
    },
    error: { type: String, default: null },
    sentAt: { type: Date, default: null },
    deliveredAt: { type: Date, default: null },
    readAt: { type: Date, default: null },
    failedAt: { type: Date, default: null },
    metadata: { type: Schema.Types.Mixed, default: () => ({}) },
  },
  { timestamps: true, versionKey: false },
)

whatsAppNotificationSchema.index({ type: 1, createdAt: -1 })
whatsAppNotificationSchema.index({ member: 1, type: 1, createdAt: -1 })

export const WhatsAppNotification =
  (models.WhatsAppNotification as Model<WhatsAppNotificationDoc>) ??
  model<WhatsAppNotificationDoc>('WhatsAppNotification', whatsAppNotificationSchema)
