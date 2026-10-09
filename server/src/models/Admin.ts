import { Schema, model, models, type Document, type Model, type Types } from 'mongoose'

export type AdminRole = 'admin' | 'superadmin'

export interface AdminDoc extends Document<Types.ObjectId> {
  _id: Types.ObjectId
  username: string
  passwordHash: string
  role: AdminRole
  active: boolean
  lastLoginAt: Date | null
  createdAt: Date
  updatedAt: Date
}

const adminSchema = new Schema<AdminDoc>(
  {
    username: { type: String, required: true, trim: true, lowercase: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ['admin', 'superadmin'], default: 'admin' },
    active: { type: Boolean, default: true },
    lastLoginAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: {
      transform(_doc, ret: Record<string, unknown>) {
        delete ret.passwordHash
        return ret
      },
    },
  },
)

adminSchema.index({ username: 1 }, { unique: true })

export const Admin = (models.Admin as Model<AdminDoc>) ?? model<AdminDoc>('Admin', adminSchema)
