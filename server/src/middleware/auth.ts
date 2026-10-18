import type { RequestHandler } from 'express'
import { Admin } from '../models/Admin'
import { ApiError } from '../utils/errors'

export const requireAdmin: RequestHandler = async (req, _res, next) => {
  try {
    const adminId = req.session?.adminId
    if (!adminId) throw ApiError.unauthorized()

    const admin = await Admin.findOne({ _id: adminId, active: true })
    if (!admin) {
      req.session.destroy(() => undefined)
      throw ApiError.unauthorized('Your session has expired. Please sign in again.')
    }

    req.admin = admin
    next()
  } catch (error) {
    next(error)
  }
}

// 'owner' and 'superadmin' are treated as Owner-level (full access).
// 'admin' maps to Staff and must NOT have owner-level access.
export const isOwnerRole = (role: string): boolean =>
  role === 'owner' || role === 'superadmin'

export const requireOwner: RequestHandler = (req, _res, next) => {
  if (!req.admin) {
    return next(ApiError.unauthorized())
  }
  if (!isOwnerRole(req.admin.role)) {
    return next(ApiError.forbidden('Owner authorization required for this action'))
  }
  next()
}

