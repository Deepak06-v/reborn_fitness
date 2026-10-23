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
  // WhatsApp Provider Configuration (mock by default; supports 'mock', 'evolution', 'waporta')
  WHATSAPP_PROVIDER: z.enum(['mock', 'evolution', 'waporta']).default('mock'),
  WHATSAPP_ENABLED: z
    .string()
    .optional()
    .transform((value) => value === 'true'),
  // Waporta WhatsApp Configuration
  WAPORTA_API_URL: z.string().optional().transform(blankToUndefined),
  WAPORTA_API_KEY: z.string().optional().transform(blankToUndefined),
  WAPORTA_SESSION_ID: z.string().default('reborn-fitness'),
  WAPORTA_WEBHOOK_PATH: z
    .string()
    .default('/api/whatsapp/waporta-webhook/replace-with-a-long-random-token'),
  // Campaign and Outbound Queue Configuration
  WHATSAPP_CAMPAIGN_DELAY_MS: z.coerce.number().positive().default(4000),
  // Batch size for sequential outbound message queue processing
  WHATSAPP_QUEUE_BATCH_SIZE: z.coerce.number().positive().default(5),
  // Cooldown delay between consecutive batches in milliseconds
  WHATSAPP_QUEUE_BATCH_COOLDOWN_MS: z.coerce.number().nonnegative().default(5000),
  // Conservative per-message pacing in milliseconds
  WHATSAPP_MESSAGE_DELAY_MS: z.coerce.number().nonnegative().default(1500),
  // Rolling-window rate limiter settings (safely below Waporta's 20 msgs / 60s limit)
  WHATSAPP_RATE_LIMIT_MAX_PER_WINDOW: z.coerce.number().positive().default(15),
  WHATSAPP_RATE_LIMIT_WINDOW_MS: z.coerce.number().positive().default(60000),
  // Bounded retry policy for transient network failures
  WHATSAPP_MAX_RETRIES: z.coerce.number().nonnegative().default(3),
  // Evolution API WhatsApp Configuration (retained for rollback option)
  EVOLUTION_API_URL: z.string().optional().transform(blankToUndefined),
  EVOLUTION_API_KEY: z.string().optional().transform(blankToUndefined),
  EVOLUTION_INSTANCE_NAME: z.string().default('reborn-fitness'),
  EVOLUTION_WEBHOOK_SECRET: z.string().optional().transform(blankToUndefined),
  EVOLUTION_WEBHOOK_PATH: z.string().default('/api/whatsapp/evolution-webhook'),
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
  whatsappProvider: data.WHATSAPP_PROVIDER,
  isWhatsAppConfigured:
    data.WHATSAPP_PROVIDER === 'waporta'
      ? Boolean(data.WAPORTA_API_URL && data.WAPORTA_API_KEY)
      : data.WHATSAPP_PROVIDER === 'evolution'
        ? Boolean(data.EVOLUTION_API_URL && data.EVOLUTION_API_KEY)
        : false,
  isWhatsAppEnabled:
    (data.WHATSAPP_ENABLED ?? false) &&
    (data.WHATSAPP_PROVIDER === 'waporta'
      ? Boolean(data.WAPORTA_API_URL && data.WAPORTA_API_KEY)
      : data.WHATSAPP_PROVIDER === 'evolution'
        ? Boolean(data.EVOLUTION_API_URL && data.EVOLUTION_API_KEY)
        : false),
}
