import { Schema, model, models, type Document, type Model, type Types } from 'mongoose'

export type CampaignStatus = 'pending' | 'processing' | 'completed' | 'failed'

export interface CampaignStats {
  sent: number
  delivered: number
  read: number
  failed: number
}

export interface WhatsAppCampaignDoc extends Document<Types.ObjectId> {
  _id: Types.ObjectId
  name: string
  message: string
  mediaUrl: string | null
  recipientFilter: string
  recipientCount: number
  stats: CampaignStats
  status: CampaignStatus
  error: string | null
  createdBy: Types.ObjectId
  completedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

const whatsAppCampaignSchema = new Schema<WhatsAppCampaignDoc>(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    message: { type: String, required: true, trim: true, maxlength: 4096 },
    mediaUrl: { type: String, default: null, trim: true },
    recipientFilter: { type: String, default: 'all' },
    recipientCount: { type: Number, required: true, min: 0, default: 0 },
    stats: {
      sent: { type: Number, default: 0, min: 0 },
      delivered: { type: Number, default: 0, min: 0 },
      read: { type: Number, default: 0, min: 0 },
      failed: { type: Number, default: 0, min: 0 },
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed'],
      default: 'pending',
      index: true,
    },
    error: { type: String, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: 'Admin', required: true },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false },
)

whatsAppCampaignSchema.index({ createdAt: -1 })

export const WhatsAppCampaign =
  (models.WhatsAppCampaign as Model<WhatsAppCampaignDoc>) ??
  model<WhatsAppCampaignDoc>('WhatsAppCampaign', whatsAppCampaignSchema)
