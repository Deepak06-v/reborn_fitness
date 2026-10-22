import { Schema, model, models, type Document, type Model, type Types } from 'mongoose'
import { nextSequence } from './Counter'

export type MemberStatus = 'active' | 'inactive'

export interface MemberDoc extends Document<Types.ObjectId> {
  _id: Types.ObjectId
  memberId: string
  fullName: string
  phone: string
  email: string | null
  address: string | null
  notes: string | null
  membershipType: string | null
  /** Selected plan id (catalogue key); null only for legacy, pre-plan members. */
  planId: string | null
  /** Plan name snapshotted from the catalogue at selection time. */
  planName: string | null
  planDurationMonths: number | null
  planDurationDays?: number | null
  /** Price of one billing period at selection time, in integer paise. */
  planPricePaise: number | null
  /** First day of the current/next billing period; null when not scheduled. */
  nextBillingDate: Date | null
  joiningDate: Date
  monthlyFeePaise: number
  status: MemberStatus
  archivedAt?: Date | null
  archivedBy?: Types.ObjectId | null
  createdAt: Date
  updatedAt: Date
}

export interface MemberModel extends Model<MemberDoc> {
  generateMemberId(): Promise<string>
}

const memberSchema = new Schema<MemberDoc, MemberModel>(
  {
    memberId: { type: String, required: true, unique: true, index: true },
    fullName: { type: String, required: true, trim: true, maxlength: 120 },
    phone: { type: String, required: true, trim: true },
    email: { type: String, default: null, trim: true, lowercase: true },
    address: { type: String, default: null, trim: true, maxlength: 300 },
    notes: { type: String, default: null, trim: true, maxlength: 2000 },
    membershipType: { type: String, default: null, trim: true, maxlength: 60 },
    planId: { type: String, default: null, trim: true },
    planName: { type: String, default: null, trim: true, maxlength: 60 },
    planDurationMonths: { type: Number, default: null, min: 0 },
    planDurationDays: { type: Number, default: null, min: 1 },
    planPricePaise: { type: Number, default: null, min: 0 },
    nextBillingDate: { type: Date, default: null },
    joiningDate: { type: Date, required: true },
    monthlyFeePaise: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: 'monthlyFeePaise must be an integer number of paise',
      },
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
      index: true,
    },
    archivedAt: { type: Date, default: null },
    archivedBy: { type: Schema.Types.ObjectId, ref: 'Admin', default: null },
  },
  { timestamps: true, versionKey: false },
)

// Phone numbers are normalized (digits only) before save, so a unique index
// prevents duplicate member records.
memberSchema.index({ phone: 1 }, { unique: true })

memberSchema.statics.generateMemberId = async function generateMemberId(): Promise<string> {
  const sequence = await nextSequence('member')
  return `RBF-${String(sequence).padStart(4, '0')}`
}

export const Member =
  (models.Member as MemberModel) ?? model<MemberDoc, MemberModel>('Member', memberSchema)
