import crypto from 'node:crypto'
import { Router, type Request } from 'express'
import { Admin } from '../models/Admin'
import { SESSION_COOKIE_NAME } from '../config/constants'
import { env } from '../config/env'
import { requireAdmin } from '../middleware/auth'
import { CSRF_COOKIE } from '../middleware/csrf'
import { loginRateLimiter } from '../middleware/rateLimit'
import { validate } from '../middleware/validate'
import { loginSchema } from '../validation/auth'
import { ApiError, asyncHandler } from '../utils/errors'
import { verifyPassword } from '../utils/password'
import type { AdminDoc } from '../models/Admin'

const router = Router()

function serializeAdmin(admin: AdminDoc) {
  return {
    id: admin._id.toString(),
    username: admin.username,
    role: admin.role,
    lastLoginAt: admin.lastLoginAt ? admin.lastLoginAt.toISOString() : null,
  }
}

function regenerateSession(req: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.regenerate((error) => (error ? reject(error) : resolve()))
  })
}

function destroySession(req: Request): Promise<void> {
  return new Promise((resolve) => {
    req.session.destroy(() => resolve())
  })
}

router.get('/csrf', (req, res) => {
  res.json({ csrfToken: req.session.csrf ?? null })
})

router.post(
  '/login',
  loginRateLimiter,
  validate({ body: loginSchema }),
  asyncHandler(async (req, res) => {
    const { username, password } = req.body as { username: string; password: string }
    const genericError = ApiError.unauthorized('Invalid username or password')

    const admin = await Admin.findOne({ username: username.trim().toLowerCase() }).select(
      '+passwordHash',
    )
    if (!admin || !admin.active) throw genericError

    const valid = await verifyPassword(password, admin.passwordHash)
    if (!valid) throw genericError

    await regenerateSession(req)
    req.session.adminId = admin._id.toString()
    req.session.csrf = crypto.randomBytes(24).toString('hex')

    res.cookie(CSRF_COOKIE, req.session.csrf, {
      httpOnly: false,
      sameSite: 'lax',
      secure: env.cookieSecure,
      path: '/',
    })

    admin.lastLoginAt = new Date()
    await admin.save()

    res.json({ admin: serializeAdmin(admin) })
  }),
)

router.get('/me', requireAdmin, (req, res) => {
  res.json({ admin: serializeAdmin(req.admin as AdminDoc) })
})

router.post(
  '/logout',
  asyncHandler(async (req, res) => {
    await destroySession(req)
    res.clearCookie(SESSION_COOKIE_NAME, { path: '/' })
    res.clearCookie(CSRF_COOKIE, { path: '/' })
    res.status(204).end()
  }),
)

export default router
