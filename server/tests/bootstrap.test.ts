import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { Admin } from '../src/models/Admin'
import { verifyPassword } from '../src/utils/password'
import { clearDatabase, setupTestEnv, teardownTestEnv } from './helpers/setup'

const CREDENTIALS = { username: 'Owner', password: 'super-secret-pass-123' }

async function loadBootstrapAdmin() {
  const module = await import('../src/bootstrap/admin')
  return module.bootstrapAdmin
}

describe('bootstrapAdmin', () => {
  beforeAll(async () => {
    delete process.env.ADMIN_USERNAME
    delete process.env.ADMIN_PASSWORD
    await setupTestEnv()
  })
  afterAll(teardownTestEnv)
  beforeEach(clearDatabase)

  it('creates an active superadmin with a hashed password', async () => {
    const bootstrapAdmin = await loadBootstrapAdmin()
    await bootstrapAdmin(CREDENTIALS)

    const admin = await Admin.findOne({ username: 'owner' }).select('+passwordHash')
    expect(admin).not.toBeNull()
    expect(admin?.role).toBe('superadmin')
    expect(admin?.active).toBe(true)
    expect(admin?.passwordHash).not.toBe(CREDENTIALS.password)
    expect(admin?.passwordHash.startsWith('$2')).toBe(true)
    expect(await verifyPassword(CREDENTIALS.password, admin!.passwordHash)).toBe(true)
  })

  it('is idempotent: never duplicates and never resets the password', async () => {
    const bootstrapAdmin = await loadBootstrapAdmin()
    await bootstrapAdmin(CREDENTIALS)
    await bootstrapAdmin({ username: 'owner', password: 'a-different-password-123' })

    const admins = await Admin.find({ username: 'owner' }).select('+passwordHash')
    expect(admins).toHaveLength(1)
    expect(await verifyPassword(CREDENTIALS.password, admins[0].passwordHash)).toBe(true)
    expect(await verifyPassword('a-different-password-123', admins[0].passwordHash)).toBe(
      false,
    )
  })

  it('rejects credentials that are too short', async () => {
    const bootstrapAdmin = await loadBootstrapAdmin()
    await expect(
      bootstrapAdmin({ username: 'ab', password: 'super-secret-pass-123' }),
    ).rejects.toThrow()
    await expect(
      bootstrapAdmin({ username: 'owner', password: 'too-short' }),
    ).rejects.toThrow()
    expect(await Admin.countDocuments()).toBe(0)
  })
})
