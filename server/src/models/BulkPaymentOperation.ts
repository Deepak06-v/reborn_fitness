import { Schema, model, models, type Document, type Model, type Types } from 'mongoose'
import type { PaymentMethod } from './MonthlyPayment'

export type BulkTargetStatus = 'pending' | 'success' | 'failed' | 'already_paid'
export type BulkOperationStatus = 'pending' | 'completed' | 'partial_failure' | 'failed'

export interface PlannedPaymentTarget {
  memberId: string
  memberRef: string
  memberName: string
  paymentId: string
  invoiceNumber: string | null
  billingMonth: string
  dueDate: Date
  plannedAmountPaise: number
  status: BulkTargetStatus
  error: string | null
  executedAt: Date | null
}

export interface BulkPaymentOperationDoc extends Document<Types.ObjectId> {
  _id: Types.ObjectId
  operationId: string
  adminId: Types.ObjectId
  selectedMemberIds: string[]
  targets: PlannedPaymentTarget[]
  method: PaymentMethod
  paymentDate: Date
  totalPlannedAmountPaise: number
  status: BulkOperationStatus
  createdAt: Date
  updatedAt: Date
}

const plannedPaymentTargetSchema = new Schema<PlannedPaymentTarget>(
  {
    memberId: { type: String, required: true },
    memberRef: { type: String, required: true },
    memberName: { type: String, required: true },
    paymentId: { type: String, required: true },
    invoiceNumber: { type: String, default: null },
    billingMonth: { type: String, required: true },
    dueDate: { type: Date, required: true },
    plannedAmountPaise: { type: Number, required: true, min: 1 },
    status: {
      type: String,
      enum: ['pending', 'success', 'failed', 'already_paid'],
      default: 'pending',
    },
    error: { type: String, default: null },
    executedAt: { type: Date, default: null },
  },
  { _id: false },
)

const bulkPaymentOperationSchema = new Schema<BulkPaymentOperationDoc>(
  {
    operationId: { type: String, required: true },
    adminId: { type: Schema.Types.ObjectId, ref: 'Admin', required: true },
    selectedMemberIds: { type: [String], required: true },
    targets: { type: [plannedPaymentTargetSchema], default: [] },
    method: {
      type: String,
      enum: ['cash', 'upi', 'bank_transfer', 'card', 'other', 'auto_registration'],
      default: 'cash',
    },
    paymentDate: { type: Date, required: true },
    totalPlannedAmountPaise: { type: Number, required: true, default: 0 },
    status: {
      type: String,
      enum: ['pending', 'completed', 'partial_failure', 'failed'],
      default: 'pending',
    },
  },
  { timestamps: true, versionKey: false },
)

bulkPaymentOperationSchema.index({ operationId: 1 }, { unique: true })

export const BulkPaymentOperation =
  (models.BulkPaymentOperation as Model<BulkPaymentOperationDoc>) ??
  model<BulkPaymentOperationDoc>('BulkPaymentOperation', bulkPaymentOperationSchema)
