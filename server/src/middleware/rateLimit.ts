import rateLimit from 'express-rate-limit'
import type { RequestHandler } from 'express'

const rateLimited: RequestHandler = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: {
    error: {
      code: 'rate_limited',
      message: 'Too many login attempts. Please wait and try again.',
    },
  },
})

export const loginRateLimiter = rateLimited

export const apiRateLimiter: RequestHandler = rateLimit({
  windowMs: 60 * 1000,
  limit: 600,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: { code: 'rate_limited', message: 'Too many requests. Please slow down.' },
  },
})
