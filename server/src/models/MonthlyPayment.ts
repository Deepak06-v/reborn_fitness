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
  billingMonth: string
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

// Hard guarantee: one bill per member per month (prevents duplicate billing).
monthlyPaymentSchema.index({ member: 1, billingMonth: 1 }, { unique: true })
monthlyPaymentSchema.index({ billingMonth: 1, status: 1 })
monthlyPaymentSchema.index({ dueDate: 1 })

export const MonthlyPayment =
  (models.MonthlyPayment as Model<MonthlyPaymentDoc>) ??
  model<MonthlyPaymentDoc>('MonthlyPayment', monthlyPaymentSchema)
