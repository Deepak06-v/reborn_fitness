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
