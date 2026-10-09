import { env } from '../config/env'
import { Admin } from '../models/Admin'
import { hashPassword } from '../utils/password'

const MIN_USERNAME_LENGTH = 3
const MIN_PASSWORD_LENGTH = 12

export interface BootstrapAdminOptions {
  username?: string
  password?: string
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: number }).code === 11000
  )
}

/**
 * Ensure the production admin account exists, driven purely by environment
 * variables (`ADMIN_USERNAME` / `ADMIN_PASSWORD`).
 *
 * Idempotent by design:
 *   - first startup  -> creates the admin (`role: superadmin`, `active: true`)
 *   - later startups -> detects the existing admin and leaves it untouched
 *
 * The password is only ever persisted as a bcrypt hash and is never logged.
 * When neither variable is set (e.g. local development), it is a no-op; in
 * production the env schema guarantees both are present before this runs.
 */
export async function bootstrapAdmin(
  options: BootstrapAdminOptions = {
    username: env.ADMIN_USERNAME,
    password: env.ADMIN_PASSWORD,
  },
): Promise<void> {
  const username = options.username?.trim().toLowerCase()
  const password = options.password

  if (!username || !password) {
    if (env.isProd) {
      throw new Error(
        'Cannot bootstrap admin: ADMIN_USERNAME and ADMIN_PASSWORD must be set in production.',
      )
    }
    // eslint-disable-next-line no-console
    console.log(
      '[api] Admin bootstrap skipped (ADMIN_USERNAME/ADMIN_PASSWORD not configured).',
    )
    return
  }

  if (username.length < MIN_USERNAME_LENGTH) {
    throw new Error(
      `Cannot bootstrap admin: ADMIN_USERNAME must be at least ${MIN_USERNAME_LENGTH} characters.`,
    )
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(
      `Cannot bootstrap admin: ADMIN_PASSWORD must be at least ${MIN_PASSWORD_LENGTH} characters.`,
    )
  }

  if (await Admin.exists({ username })) {
    // eslint-disable-next-line no-console
    console.log(`[api] Admin "${username}" already exists — leaving it unchanged.`)
    return
  }

  try {
    await Admin.create({
      username,
      passwordHash: await hashPassword(password),
      role: 'superadmin',
      active: true,
    })
    // eslint-disable-next-line no-console
    console.log(`[api] Admin "${username}" created and ready to log in.`)
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      // A concurrent startup won the race — the account exists, so do nothing.
      // eslint-disable-next-line no-console
      console.log(`[api] Admin "${username}" already exists — leaving it unchanged.`)
      return
    }
    throw error
  }
}
