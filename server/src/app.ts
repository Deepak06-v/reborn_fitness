import express from 'express'
import session from 'express-session'
import MongoStore from 'connect-mongo'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import helmet from 'helmet'
import { env } from './config/env'
import { SESSION_COOKIE_NAME } from './config/constants'
import { apiRateLimiter } from './middleware/rateLimit'
import { ensureCsrf, verifyCsrf } from './middleware/csrf'
import { requireAdmin } from './middleware/auth'
import { errorHandler, notFoundHandler } from './utils/errors'
import authRouter from './routes/auth'
import membersRouter from './routes/members'
import paymentsRouter from './routes/payments'
import dashboardRouter from './routes/dashboard'

export function createApp() {
  const app = express()

  app.set('trust proxy', 1)
  app.disable('x-powered-by')

  app.use(helmet())
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || env.corsOrigins.includes(origin)) {
          callback(null, true)
          return
        }
        callback(null, false)
      },
      credentials: true,
    }),
  )
  app.use(express.json({ limit: '1mb' }))
  app.use(cookieParser())

  app.use(
    session({
      name: SESSION_COOKIE_NAME,
      secret: env.SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      rolling: true,
      store: env.isTest
        ? undefined
        : MongoStore.create({
            mongoUrl: env.MONGODB_URI,
            collectionName: 'sessions',
            ttl: Math.floor(env.sessionTtlMs / 1000),
            autoRemove: 'native',
          }),
      cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: env.cookieSecure,
        maxAge: env.sessionTtlMs,
        path: '/',
      },
    }),
  )

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' })
  })

  app.use('/api/admin', apiRateLimiter)
  app.use('/api/admin', ensureCsrf, verifyCsrf)
  app.use('/api/admin/auth', authRouter)
  app.use('/api/admin/members', requireAdmin, membersRouter)
  app.use('/api/admin/payments', requireAdmin, paymentsRouter)
  app.use('/api/admin/dashboard', requireAdmin, dashboardRouter)

  app.use(notFoundHandler)
  app.use(errorHandler)

  return app
}
