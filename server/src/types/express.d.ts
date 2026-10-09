import type { AdminDoc } from '../models/Admin'

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      admin?: AdminDoc
    }
  }
}

declare module 'express-session' {
  interface SessionData {
    adminId?: string
    csrf?: string
    lastLoginMessage?: string
  }
}

export {}
