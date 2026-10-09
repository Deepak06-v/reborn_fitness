import crypto from 'node:crypto'
import type { RequestHandler } from 'express'
import { env } from '../config/env'
import { ApiError } from '../utils/errors'

export const CSRF_COOKIE = 'reborn.csrf'
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

/**
 * Double-submit CSRF protection. The token lives in the session (server-side)
 * and is mirrored in a readable cookie. Mutating requests must echo the token
 * back in the `x-csrf-token` header. Combined with sameSite=lax cookies this
 * blocks cross-site request forgery.
 */
export const ensureCsrf: RequestHandler = (req, res, next) => {
  if (!req.session.csrf) {
    req.session.csrf = crypto.randomBytes(24).toString('hex')
  }
  // Only (re)issue the readable cookie when it is missing or stale, so a route
  // that rotates the token (e.g. login) does not emit a duplicate cookie.
  if (req.cookies?.[CSRF_COOKIE] !== req.session.csrf) {
    res.cookie(CSRF_COOKIE, req.session.csrf, {
      httpOnly: false,
      sameSite: 'lax',
      secure: env.cookieSecure,
      path: '/',
    })
  }
  next()
}

export const verifyCsrf: RequestHandler = (req, _res, next) => {
  if (SAFE_METHODS.has(req.method.toUpperCase())) {
    next()
    return
  }
  const header = req.get('x-csrf-token')
  if (!header || !req.session.csrf || header !== req.session.csrf) {
    next(ApiError.forbidden('Invalid or missing CSRF token'))
    return
  }
  next()
}
