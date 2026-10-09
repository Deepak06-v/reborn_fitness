import type { Express } from 'express'
import request from 'supertest'
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { Admin } from '../../src/models/Admin'
import { hashPassword } from '../../src/utils/password'

export const TEST_ADMIN = { username: 'owner', password: 'super-secret-pass-123' }

export async function createAdmin(
  username = TEST_ADMIN.username,
  password = TEST_ADMIN.password,
) {
  return Admin.create({
    username,
    passwordHash: await hashPassword(password),
    role: 'superadmin',
    active: true,
  })
}

type TestAgent = ReturnType<typeof request.agent>

let mongod: MongoMemoryServer | null = null

export async function setupTestEnv(): Promise<void> {
  mongod = await MongoMemoryServer.create()
  process.env.NODE_ENV = 'test'
  process.env.MONGODB_URI = mongod.getUri('reborn_test')
  process.env.SESSION_SECRET = 'test-session-secret-0123456789abcdef'
  process.env.CORS_ORIGINS = 'http://localhost:5173'
  process.env.COOKIE_SECURE = 'false'
  await mongoose.connect(process.env.MONGODB_URI)
}

export async function teardownTestEnv(): Promise<void> {
  await mongoose.disconnect()
  if (mongod) await mongod.stop()
  mongod = null
}

export async function clearDatabase(): Promise<void> {
  const collections = mongoose.connection.collections
  for (const name of Object.keys(collections)) {
    await collections[name].deleteMany({})
  }
}

export async function loadApp(): Promise<Express> {
  const module = await import('../../src/app')
  return module.createApp()
}

export const CSRF_COOKIE = 'reborn.csrf'

function readCookie(
  response: { headers: Record<string, unknown> },
  name: string,
): string | null {
  const raw = response.headers['set-cookie']
  const cookies = Array.isArray(raw) ? raw : raw ? [String(raw)] : []
  let found: string | null = null
  for (const cookie of cookies) {
    const [pair] = cookie.split(';')
    const [key, value] = pair.split('=')
    if (key.trim() === name) found = decodeURIComponent(value)
  }
  return found
}

export interface AuthedAgent {
  agent: TestAgent
  csrf: string
}

export async function csrfFor(agent: TestAgent): Promise<string> {
  const response = await agent.get('/api/admin/auth/csrf').expect(200)
  const token = readCookie(response, CSRF_COOKIE) ?? (response.body.csrfToken as string)
  return token
}

export async function loginAgent(
  app: Express,
  username: string,
  password: string,
): Promise<AuthedAgent> {
  const agent = request.agent(app)
  const csrf = await csrfFor(agent)
  const response = await agent
    .post('/api/admin/auth/login')
    .set('x-csrf-token', csrf)
    .send({ username, password })
    .expect(200)
  const rotated = readCookie(response, CSRF_COOKIE) ?? csrf
  return { agent, csrf: rotated }
}
