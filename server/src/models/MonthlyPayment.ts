import { Schema, model, models, type Document, type Model, type Types } from 'mongoose'
import type { BasePaymentStatus } from '../utils/paymentStatus'

export type PaymentMethod = 'cash' | 'upi' | 'bank_transfer' | 'card' | 'other'

export interface PaymentEntry {
  _id: Types.ObjectId
  amountPaise: number
  paymentDate: Date
  method: PaymentMethod
  referenceNumber: string | null
  notes: string | null
  recordedBy: Types.ObjectId
  recordedAt: Date
  voided: boolean
  voidedBy: Types.ObjectId | null
  voidedAt: Date | null
  voidReason: string | null
}

export interface MonthlyPaymentDoc extends Document<Types.ObjectId> {
  _id: Types.ObjectId
  member: Types.ObjectId
  memberId: string
  /**
   * IST month (YYYY-MM) in which this billing period starts. Kept as the
   * listing/dashboard key and the duplicate-bill guard (one bill per member
   * per start month).
   */
  billingMonth: string
  /** Human-facing unique invoice reference, e.g. RBF-INV-0001. */
  invoiceNumber: string | null
  /** Plan snapshotted at issue time; null for legacy monthly records. */
  planId: string | null
  planName: string | null
  durationMonths: number | null
  durationDays?: number | null
  planPricePaise: number | null
  /** Inclusive first day of the billing period. */
  periodStart: Date | null
  /** Exclusive end of the billing period (start + duration, day-clamped). */
  periodEnd: Date | null
  dueAmountPaise: number
  amountPaidPaise: number
  dueDate: Date
  status: BasePaymentStatus
  paymentEntries: Types.DocumentArray<PaymentEntry>
  createdAt: Date
  updatedAt: Date
}

const paymentEntrySchema = new Schema<PaymentEntry>(
  {
    amountPaise: {
      type: Number,
      required: true,
      min: 1,
      validate: {
        validator: Number.isInteger,
        message: 'amountPaise must be a positive integer number of paise',
      },
    },
    paymentDate: { type: Date, required: true },
    method: {
      type: String,
      enum: ['cash', 'upi', 'bank_transfer', 'card', 'other'],
      required: true,
    },
    referenceNumber: { type: String, default: null, trim: true, maxlength: 120 },
    notes: { type: String, default: null, trim: true, maxlength: 1000 },
    recordedBy: { type: Schema.Types.ObjectId, ref: 'Admin', required: true },
    recordedAt: { type: Date, default: () => new Date() },
    voided: { type: Boolean, default: false },
    voidedBy: { type: Schema.Types.ObjectId, ref: 'Admin', default: null },
    voidedAt: { type: Date, default: null },
    voidReason: { type: String, default: null, trim: true, maxlength: 500 },
  },
  { _id: true },
)

const monthlyPaymentSchema = new Schema<MonthlyPaymentDoc>(
  {
    member: { type: Schema.Types.ObjectId, ref: 'Member', required: true, index: true },
    memberId: { type: String, required: true, index: true },
    billingMonth: { type: String, required: true },
    invoiceNumber: { type: String, default: null, trim: true },
    planId: { type: String, default: null, trim: true },
    planName: { type: String, default: null, trim: true, maxlength: 60 },
    durationMonths: { type: Number, default: null, min: 0 },
    durationDays: { type: Number, default: null, min: 1 },
    planPricePaise: { type: Number, default: null, min: 0 },
    periodStart: { type: Date, default: null },
    periodEnd: { type: Date, default: null },
    dueAmountPaise: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: 'dueAmountPaise must be an integer number of paise',
      },
    },
    amountPaidPaise: { type: Number, required: true, default: 0, min: 0 },
    dueDate: { type: Date, required: true },
    status: { type: String, enum: ['unpaid', 'partial', 'paid'], default: 'unpaid' },
    paymentEntries: { type: [paymentEntrySchema], default: [] },
  },
  { timestamps: true, versionKey: false },
)

// Guarantee: one bill per member per period start date (prevents duplicate billing).
monthlyPaymentSchema.index({ member: 1, periodStart: 1 }, { unique: true, sparse: true })
monthlyPaymentSchema.index({ member: 1, billingMonth: 1 })
monthlyPaymentSchema.index({ billingMonth: 1, status: 1 })
monthlyPaymentSchema.index({ dueDate: 1 })
// Invoice numbers must be unique; sparse so legacy rows without one are exempt.
monthlyPaymentSchema.index({ invoiceNumber: 1 }, { unique: true, sparse: true })

export async function ensureMonthlyPaymentIndexes(): Promise<void> {
  try {
    const col = MonthlyPayment.collection
    const indexes = await col.indexes().catch(() => [])
    const oldUniqueIndex = indexes.find(
      (idx) => idx.name === 'member_1_billingMonth_1' && idx.unique,
    )
    if (oldUniqueIndex) {
      await col.dropIndex('member_1_billingMonth_1').catch(() => undefined)
    }
  } catch {
    // Non-fatal if collection doesn't exist yet
  }
}

export const MonthlyPayment =
  (models.MonthlyPayment as Model<MonthlyPaymentDoc>) ??
  model<MonthlyPaymentDoc>('MonthlyPayment', monthlyPaymentSchema)
