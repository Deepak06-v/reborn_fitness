import path from 'node:path'
import dotenv from 'dotenv'
import { z } from 'zod'

dotenv.config({ path: process.env.ENV_FILE ?? path.resolve(process.cwd(), '.env') })

const blankToUndefined = (value: string | undefined): string | undefined =>
  value !== undefined && value.trim() !== '' ? value : undefined

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
  SESSION_SECRET: z
    .string()
    .min(16, 'SESSION_SECRET must be at least 16 characters'),
  CORS_ORIGINS: z.string().default('http://localhost:5173'),
  COOKIE_SECURE: z
    .string()
    .optional()
    .transform((value) => value === 'true'),
  SESSION_TTL_HOURS: z.coerce.number().positive().default(8),
  // How often the in-process billing job reconciles recurring billing periods.
  BILLING_RECONCILE_INTERVAL_MINUTES: z.coerce.number().positive().default(360),
  // WhatsApp Cloud API Configuration (all optional for dev / safe fallback mode)
  WHATSAPP_ENABLED: z
    .string()
    .optional()
    .transform((value) => value === 'true'),
  WHATSAPP_API_VERSION: z.string().default('v21.0'),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional().transform(blankToUndefined),
  WHATSAPP_WABA_ID: z.string().optional().transform(blankToUndefined),
  WHATSAPP_ACCESS_TOKEN: z.string().optional().transform(blankToUndefined),
  WHATSAPP_VERIFY_TOKEN: z.string().optional().transform(blankToUndefined),
  WHATSAPP_APP_SECRET: z.string().optional().transform(blankToUndefined),
  WHATSAPP_WEBHOOK_PATH: z.string().default('/api/whatsapp/webhook'),
  // Optional at parse time; the production requirement is enforced below.
  // Blank values (`ADMIN_USERNAME=`) are treated as "not configured".
  ADMIN_USERNAME: z
    .string()
    .optional()
    .transform(blankToUndefined)
    .refine((value) => value === undefined || value.length >= 3, {
      message: 'ADMIN_USERNAME must be at least 3 characters',
    }),
  ADMIN_PASSWORD: z
    .string()
    .optional()
    .transform(blankToUndefined)
    .refine((value) => value === undefined || value.length >= 12, {
      message: 'ADMIN_PASSWORD must be at least 12 characters',
    }),
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
    .join('\n')
  throw new Error(`Invalid environment configuration:\n${issues}`)
}

const data = parsed.data

if (data.NODE_ENV === 'production') {
  const missing = (['ADMIN_USERNAME', 'ADMIN_PASSWORD'] as const).filter(
    (key) => !data[key],
  )
  if (missing.length > 0) {
    throw new Error(
      `Invalid environment configuration:\n${missing
        .map((key) => `  - ${key} must be set in production`)
        .join('\n')}`,
    )
  }
}

export const env = {
  ...data,
  isTest: data.NODE_ENV === 'test',
  isProd: data.NODE_ENV === 'production',
  cookieSecure: data.COOKIE_SECURE,
  corsOrigins: data.CORS_ORIGINS.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  sessionTtlMs: data.SESSION_TTL_HOURS * 60 * 60 * 1000,
  billingReconcileIntervalMinutes: data.BILLING_RECONCILE_INTERVAL_MINUTES,
  isWhatsAppConfigured: Boolean(data.WHATSAPP_ACCESS_TOKEN && data.WHATSAPP_PHONE_NUMBER_ID),
  isWhatsAppEnabled:
    (data.WHATSAPP_ENABLED ?? true) &&
    Boolean(data.WHATSAPP_ACCESS_TOKEN && data.WHATSAPP_PHONE_NUMBER_ID),
}
