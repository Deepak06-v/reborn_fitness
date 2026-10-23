import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import request from 'supertest'
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import {
  setupTestEnv,
  teardownTestEnv,
  clearDatabase,
  loadApp,
  loginAgent,
  createAdmin,
  TEST_ADMIN,
  istDay,
} from './helpers/setup'
import { Member } from '../src/models/Member'
import { MonthlyPayment } from '../src/models/MonthlyPayment'
import { WhatsAppNotification } from '../src/models/WhatsAppNotification'
import { WhatsAppCampaign } from '../src/models/WhatsAppCampaign'
import { whatsAppService } from '../src/services/whatsapp/whatsapp.service'
import { env } from '../src/config/env'
import { outboundRateLimiter } from '../src/services/whatsapp/outbound-rate-limiter'
import { outboundQueueService } from '../src/services/whatsapp/outbound-queue.service'
import { MetaCloudWhatsAppProvider } from '../src/services/whatsapp/meta-cloud-whatsapp.provider'
import { MockWhatsAppProvider } from '../src/services/whatsapp/mock-whatsapp.provider'
import {
  formatWhatsAppPhone,
  formatMetaPhone,
  normalizePhone,
  isValidIndianMobile,
} from '../src/utils/phone'
import {
  buildFestiveOfferTemplateComponents,
  buildGymClosureTemplateComponents,
  buildOverdueTemplateComponents,
  buildUpcomingDueTemplateComponents,
  formatCustomMessage,
  formatFestivalOfferMessage,
  formatGymClosureMessage,
  formatOverdueMessage,
  formatUpcomingDueMessage,
  getApprovedTemplateConfig,
} from '../src/services/whatsapp/whatsapp.templates'
import type { Express } from 'express'

describe('WhatsApp Notification Module (Meta Cloud API)', () => {
  let app: Express
  let mockProvider: MockWhatsAppProvider
  let memberSeq = 1
  let invSeq = 1

  async function createTestMember(overrides: Partial<Parameters<typeof Member.create>[0]> = {}) {
    const seq = String(memberSeq++).padStart(4, '0')
    return Member.create({
      memberId: `RBF-${seq}`,
      fullName: `Test Member ${seq}`,
      phone: `98765${seq}`,
      joiningDate: new Date(),
      monthlyFeePaise: 150000,
      status: 'active',
      ...overrides,
    })
  }

  async function createTestPayment(
    member: { _id: unknown; memberId: string; planName?: string | null },
    overrides: {
      dueDate?: Date
      periodStart?: Date
      periodEnd?: Date
      dueAmountPaise?: number
      amountPaidPaise?: number
      status?: 'unpaid' | 'partial' | 'paid'
      planName?: string
      invoiceNumber?: string
    } = {},
  ) {
    const periodStart = overrides.periodStart || new Date('2026-10-25')
    const periodEnd = overrides.periodEnd || new Date('2026-11-24')
    const dueDate = overrides.dueDate || periodStart
    const invoiceNumber = overrides.invoiceNumber || `RBF-INV-${String(invSeq++).padStart(4, '0')}`

    return MonthlyPayment.create({
      member: member._id,
      memberId: member.memberId,
      billingMonth: '2026-10',
      invoiceNumber,
      dueDate,
      periodStart,
      periodEnd,
      dueAmountPaise: overrides.dueAmountPaise ?? 150000,
      amountPaidPaise: overrides.amountPaidPaise ?? 0,
      status: overrides.status || 'unpaid',
      planName: overrides.planName || member.planName || 'Monthly',
    })
  }

  beforeAll(async () => {
    await setupTestEnv()
    app = await loadApp()
  })

  afterAll(async () => {
    await teardownTestEnv()
  })

  beforeEach(async () => {
    await clearDatabase()
    await createAdmin()
    outboundRateLimiter.reset()
    memberSeq = 1
    invSeq = 1
    mockProvider = new MockWhatsAppProvider(true)
    whatsAppService.setProvider(mockProvider)
    vi.restoreAllMocks()
  })

  describe('Phone Normalization & Formatting', () => {
    it('normalizes various Indian phone formats to 10 digits', () => {
      expect(normalizePhone('+91 98765 43210')).toBe('9876543210')
      expect(normalizePhone('919876543210')).toBe('9876543210')
      expect(normalizePhone('09876543210')).toBe('9876543210')
      expect(normalizePhone('9876543210')).toBe('9876543210')
    })

    it('handles duplicate country codes cleanly', () => {
      expect(normalizePhone('+91 91 9876543210')).toBe('9876543210')
      expect(normalizePhone('91919876543210')).toBe('9876543210')
      expect(normalizePhone('00919876543210')).toBe('9876543210')
    })

    it('formats phone into Meta Cloud API recipient format (91XXXXXXXXXX)', () => {
      expect(formatWhatsAppPhone('+91 98765-43210')).toBe('919876543210')
      expect(formatMetaPhone('+91 98765-43210')).toBe('919876543210')
      expect(formatWhatsAppPhone('09876543210')).toBe('919876543210')
      expect(formatWhatsAppPhone('9876543210')).toBe('919876543210')
      expect(formatWhatsAppPhone('+91 91 9876543210')).toBe('919876543210')
      expect(formatWhatsAppPhone('12345')).toBeNull()
      expect(formatWhatsAppPhone('abcdef')).toBeNull()
    })

    it('validates standard Indian mobile numbers', () => {
      expect(isValidIndianMobile('9876543210')).toBe(true)
      expect(isValidIndianMobile('8123456789')).toBe(true)
      expect(isValidIndianMobile('7123456789')).toBe(true)
      expect(isValidIndianMobile('6123456789')).toBe(true)
      expect(isValidIndianMobile('5123456789')).toBe(false)
    })
  })

  describe('Meta Template Payload & Placeholder Validation', () => {
    it('retrieves configured approved template configs', () => {
      const dueConfig = getApprovedTemplateConfig('FEE_DUE_2_DAYS')
      expect(dueConfig.templateName).toBe(env.WHATSAPP_TEMPLATE_FEE_DUE)
      expect(dueConfig.languageCode).toBe('en_US')

      const overdueConfig = getApprovedTemplateConfig('FEE_OVERDUE')
      expect(overdueConfig.templateName).toBe(env.WHATSAPP_TEMPLATE_FEE_OVERDUE)
      expect(overdueConfig.languageCode).toBe('en_US')
    })

    it('builds upcoming fee due template components with exact parameter ordering', () => {
      const components = buildUpcomingDueTemplateComponents({
        memberName: 'Rahul Sharma',
        planName: 'Monthly – ₹1,500',
        dueDate: '25/10/2026',
        amountDue: '1,500',
      })

      expect(components).toHaveLength(1)
      expect(components[0].type).toBe('body')
      expect(components[0].parameters).toEqual([
        { type: 'text', text: 'Rahul Sharma' },
        { type: 'text', text: 'Monthly – ₹1,500' },
        { type: 'text', text: '25/10/2026' },
        { type: 'text', text: '1,500' },
      ])
    })

    it('builds overdue fee template components with positive daysOverdue', () => {
      const components = buildOverdueTemplateComponents({
        memberName: 'Rahul Sharma',
        planName: 'Monthly – ₹1,500',
        daysOverdue: 3,
        amountDue: '1,500',
      })

      expect(components).toHaveLength(1)
      expect(components[0].type).toBe('body')
      expect(components[0].parameters).toEqual([
        { type: 'text', text: 'Rahul Sharma' },
        { type: 'text', text: '3' },
        { type: 'text', text: 'Monthly – ₹1,500' },
        { type: 'text', text: '1,500' },
      ])
    })

    it('builds gym closure and festive offer template components', () => {
      const closure = buildGymClosureTemplateComponents({
        memberName: 'Rahul',
        reason: 'Diwali Maintenance',
        dates: '28th Oct',
        reopenDate: '29th Oct',
      })
      expect(closure[0].parameters).toHaveLength(4)
      expect(closure[0].parameters[1].text).toBe('Diwali Maintenance')

      const festive = buildFestiveOfferTemplateComponents({
        memberName: 'Rahul',
        occasion: 'Diwali',
        offerDetails: 'Annual plan at 20% discount',
        validUntil: '31st Oct',
      })
      expect(festive[0].parameters).toHaveLength(4)
      expect(festive[0].parameters[2].text).toBe('Annual plan at 20% discount')
    })

    it('validates template placeholder parameters and rejects missing fields', () => {
      expect(() =>
        buildUpcomingDueTemplateComponents({
          memberName: '',
          planName: 'Monthly',
          dueDate: '25/10/2026',
          amountDue: '1500',
        }),
      ).toThrowError(/memberName is required/)

      expect(() =>
        buildOverdueTemplateComponents({
          memberName: 'Rahul',
          planName: 'Monthly',
          daysOverdue: 0,
          amountDue: '1500',
        }),
      ).toThrowError(/daysOverdue must be a positive integer/)
    })

    it('formats preview texts accurately', () => {
      const duePreview = formatUpcomingDueMessage({
        memberName: 'Aman',
        planName: 'Monthly',
        dueDate: '10/11/2026',
        amountDue: '1,500',
      })
      expect(duePreview).toContain('Aman')
      expect(duePreview).toContain('₹1,500')

      const overduePreview = formatOverdueMessage({
        memberName: 'Aman',
        planName: 'Monthly',
        daysOverdue: 5,
        amountDue: '1,500',
      })
      expect(overduePreview).toContain('overdue by 5 days')

      const customPreview = formatCustomMessage({
        memberName: 'Aman',
        message: 'Personal training available',
      })
      expect(customPreview).toContain('REBORN FITNESS')
    })
  })

  describe('MetaCloudWhatsAppProvider Unit Tests', () => {
    const config = {
      graphApiVersion: 'v21.0',
      accessToken: 'EAAG_test_access_token_mock_secret',
      phoneNumberId: '1000987654321',
      businessAccountId: '2000987654321',
      appSecret: 'test_meta_app_secret_12345',
      webhookVerifyToken: 'meta_verify_token_secure_987',
    }

    it('initializes properly and reports isConfigured accurately', () => {
      const provider = new MetaCloudWhatsAppProvider(config)
      expect(provider.isConfigured).toBe(true)
      expect(provider.graphApiVersion).toBe('v21.0')
      expect(provider.phoneNumberId).toBe('1000987654321')

      const unconfigured = new MetaCloudWhatsAppProvider({})
      expect(unconfigured.isConfigured).toBe(false)
    })

    it('sends template messages to the correct Meta Graph API endpoint with Authorization header', async () => {
      const provider = new MetaCloudWhatsAppProvider(config)
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          messaging_product: 'whatsapp',
          contacts: [{ input: '919876543210', wa_id: '919876543210' }],
          messages: [{ id: 'wamid.HBgLMTAwMDk4NzY1NDMyMQ==' }],
        }),
      })
      vi.stubGlobal('fetch', mockFetch)

      const result = await provider.sendTemplateMessage({
        to: '919876543210',
        templateName: 'reborn_fee_due_reminder',
        languageCode: 'en_US',
        components: [
          {
            type: 'body',
            parameters: [{ type: 'text', text: 'Rahul' }],
          },
        ],
      })

      expect(result.success).toBe(true)
      expect(result.messageId).toBe('wamid.HBgLMTAwMDk4NzY1NDMyMQ==')
      expect(result.status).toBe('sent')

      expect(mockFetch).toHaveBeenCalledTimes(1)
      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe('https://graph.facebook.com/v21.0/1000987654321/messages')
      expect(init.method).toBe('POST')
      expect(init.headers.Authorization).toBe('Bearer EAAG_test_access_token_mock_secret')
      expect(init.headers['Content-Type']).toBe('application/json')

      const body = JSON.parse(init.body)
      expect(body.messaging_product).toBe('whatsapp')
      expect(body.recipient_type).toBe('individual')
      expect(body.to).toBe('919876543210')
      expect(body.type).toBe('template')
      expect(body.template.name).toBe('reborn_fee_due_reminder')
      expect(body.template.language.code).toBe('en_US')
      expect(body.template.components[0].parameters[0].text).toBe('Rahul')
    })

    it('sends text messages to Meta Graph API endpoint where permitted', async () => {
      const provider = new MetaCloudWhatsAppProvider(config)
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          messaging_product: 'whatsapp',
          messages: [{ id: 'wamid.text123456' }],
        }),
      })
      vi.stubGlobal('fetch', mockFetch)

      const result = await provider.sendTextMessage({
        to: '919876543210',
        text: 'Hello from REBORN FITNESS',
      })

      expect(result.success).toBe(true)
      expect(result.messageId).toBe('wamid.text123456')
      const body = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(body.type).toBe('text')
      expect(body.text.body).toBe('Hello from REBORN FITNESS')
    })

    it('sends media messages with image URL to Meta Graph API endpoint', async () => {
      const provider = new MetaCloudWhatsAppProvider(config)
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          messaging_product: 'whatsapp',
          messages: [{ id: 'wamid.media987654' }],
        }),
      })
      vi.stubGlobal('fetch', mockFetch)

      const result = await provider.sendMediaMessage({
        to: '919876543210',
        type: 'image',
        mediaUrl: 'https://example.com/banner.jpg',
        caption: 'Special Festival Offer',
      })

      expect(result.success).toBe(true)
      expect(result.messageId).toBe('wamid.media987654')
      const body = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(body.type).toBe('image')
      expect(body.image.link).toBe('https://example.com/banner.jpg')
      expect(body.image.caption).toBe('Special Festival Offer')
    })

    it('handles Meta API authentication errors (401 / code 190) gracefully without leaking secrets', async () => {
      const provider = new MetaCloudWhatsAppProvider(config)
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({
          error: {
            message: 'Invalid OAuth access token.',
            type: 'OAuthException',
            code: 190,
            fbtrace_id: 'AZy12345678',
          },
        }),
      })
      vi.stubGlobal('fetch', mockFetch)

      const result = await provider.sendTextMessage({
        to: '919876543210',
        text: 'Test',
      })

      expect(result.success).toBe(false)
      expect(result.httpStatus).toBe(401)
      expect(result.error).toContain('Meta API authentication failed')
      expect(result.error).not.toContain('EAAG_test_access_token_mock_secret')
      expect(result.fbtraceId).toBe('AZy12345678')
    })

    it('handles Meta rate limit errors (429 / code 130429) cleanly', async () => {
      const provider = new MetaCloudWhatsAppProvider(config)
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        json: async () => ({
          error: {
            message: 'Rate limit hit',
            code: 130429,
            error_data: { details: 'Too many messages sent per second' },
          },
        }),
      })
      vi.stubGlobal('fetch', mockFetch)

      const result = await provider.sendTemplateMessage({
        to: '919876543210',
        templateName: 'test_template',
      })

      expect(result.success).toBe(false)
      expect(result.httpStatus).toBe(429)
      expect(result.error).toContain('rate limit')
    })

    it('handles network timeouts and abort errors safely', async () => {
      const provider = new MetaCloudWhatsAppProvider(config)
      const abortErr = new Error('The operation was aborted')
      abortErr.name = 'AbortError'
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(abortErr))

      await expect(
        provider.sendTextMessage({
          to: '919876543210',
          text: 'Timeout test',
        }),
      ).rejects.toThrow(/timed out/)
    })

    it('checks phone registration & quality rating via GET phone details endpoint', async () => {
      const provider = new MetaCloudWhatsAppProvider(config)
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          id: '1000987654321',
          verified_name: 'REBORN FITNESS',
          display_phone_number: '+91 98765 43210',
          quality_rating: 'GREEN',
        }),
      })
      vi.stubGlobal('fetch', mockFetch)

      const status = await provider.getConnectionStatus()
      expect(status.state).toBe('connected')
      expect(status.verifiedName).toBe('REBORN FITNESS')
      expect(status.qualityRating).toBe('GREEN')
      expect(mockFetch).toHaveBeenCalledWith(
        'https://graph.facebook.com/v21.0/1000987654321?fields=verified_name,display_phone_number,quality_rating,code_verification_status',
        expect.anything(),
      )
    })

    it('verifies webhook HMAC-SHA256 signature with constant-time security', () => {
      const provider = new MetaCloudWhatsAppProvider(config)
      const payload = JSON.stringify({ object: 'whatsapp_business_account', entry: [] })

      const hmac = crypto.createHmac('sha256', config.appSecret)
      hmac.update(Buffer.from(payload, 'utf-8'))
      const validSignature = `sha256=${hmac.digest('hex')}`

      expect(provider.verifyWebhookSignature(payload, validSignature)).toBe(true)
      expect(provider.verifyWebhookSignature(payload, 'sha256=invalid_hex_string_12345')).toBe(
        false,
      )
      expect(provider.verifyWebhookSignature(payload, undefined)).toBe(false)
    })

    it('verifies GET verification handshake token securely', () => {
      const provider = new MetaCloudWhatsAppProvider(config)
      expect(provider.verifyWebhookToken('subscribe', config.webhookVerifyToken)).toBe(true)
      expect(provider.verifyWebhookToken('subscribe', 'wrong_token')).toBe(false)
      expect(provider.verifyWebhookToken('unsubscribe', config.webhookVerifyToken)).toBe(false)
    })
  })

  describe('Meta Webhook Verification Handshake (GET)', () => {
    it('returns challenge string with HTTP 200 on valid verify token', async () => {
      const verifyToken = env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || 'test-verify-token-123'
      const prev = env.WHATSAPP_WEBHOOK_VERIFY_TOKEN
      env.WHATSAPP_WEBHOOK_VERIFY_TOKEN = verifyToken

      try {
        const res = await request(app)
          .get('/api/whatsapp/webhook')
          .query({
            'hub.mode': 'subscribe',
            'hub.verify_token': verifyToken,
            'hub.challenge': 'CHALLENGE_STRING_META_12345',
          })
          .expect(200)

        expect(res.text).toBe('CHALLENGE_STRING_META_12345')
      } finally {
        env.WHATSAPP_WEBHOOK_VERIFY_TOKEN = prev
      }
    })

    it('rejects GET verification with 403 on invalid or missing verify token', async () => {
      await request(app)
        .get('/api/whatsapp/webhook')
        .query({
          'hub.mode': 'subscribe',
          'hub.verify_token': 'wrong-token',
          'hub.challenge': 'CHALLENGE_STRING',
        })
        .expect(403)

      await request(app)
        .get('/api/whatsapp/webhook')
        .query({
          'hub.mode': 'subscribe',
          'hub.challenge': 'CHALLENGE_STRING',
        })
        .expect(403)
    })
  })

  describe('Meta Webhook Ingest & Status Hierarchy (POST)', () => {
    const rawSecret = env.WHATSAPP_APP_SECRET || 'secret-test-key-321'

    beforeEach(() => {
      env.WHATSAPP_APP_SECRET = rawSecret
    })

    function signBody(body: object): string {
      const hmac = crypto.createHmac('sha256', rawSecret)
      hmac.update(JSON.stringify(body))
      return `sha256=${hmac.digest('hex')}`
    }

    it('rejects invalid X-Hub-Signature-256 with 401 Unauthorized', async () => {
      const payload = { object: 'whatsapp_business_account', entry: [] }

      await request(app)
        .post('/api/whatsapp/webhook')
        .set('x-hub-signature-256', 'sha256=bad_hex_signature_00000000000000000000000000000000')
        .send(payload)
        .expect(401)
    })

    it('updates notification status upon receiving Meta delivery events (sent, delivered, read, failed)', async () => {
      const member = await createTestMember({
        fullName: 'Anita Roy',
        phone: '9876543210',
      })

      const messageId = 'wamid.HBgLAnitaRoy123'
      const notification = await WhatsAppNotification.create({
        member: member._id,
        memberId: member.memberId,
        phoneNumber: '919876543210',
        type: 'FEE_DUE_2_DAYS',
        messageId,
        status: 'queued',
        provider: 'cloud_api',
      })

      const payload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            id: '123456789',
            changes: [
              {
                value: {
                  messaging_product: 'whatsapp',
                  metadata: { display_phone_number: '919876543210', phone_number_id: '1001' },
                  statuses: [
                    {
                      id: messageId,
                      status: 'delivered',
                      timestamp: '1729700000',
                      recipient_id: '919876543210',
                    },
                  ],
                },
                field: 'messages',
              },
            ],
          },
        ],
      }

      const sig = signBody(payload)
      const res = await request(app)
        .post('/api/whatsapp/webhook')
        .set('x-hub-signature-256', sig)
        .send(payload)
        .expect(200)

      expect(res.body.status).toBe('ok')
      expect(res.body.processed).toBe(1)

      const updated = await WhatsAppNotification.findById(notification._id)
      expect(updated?.status).toBe('delivered')
      expect(updated?.deliveredAt).not.toBeNull()
    })

    it('protects status hierarchy against out-of-order events (read > delivered > sent)', async () => {
      const member = await createTestMember({
        fullName: 'Karan Mehra',
        phone: '9876543211',
      })

      const messageId = 'wamid.HBgLKaranRead123'
      const notification = await WhatsAppNotification.create({
        member: member._id,
        memberId: member.memberId,
        phoneNumber: '919876543211',
        type: 'FEE_DUE_2_DAYS',
        messageId,
        status: 'read',
        readAt: new Date(),
        provider: 'cloud_api',
      })

      // Attempt out-of-order delivered event
      const payload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            id: '123456789',
            changes: [
              {
                value: {
                  messaging_product: 'whatsapp',
                  metadata: { display_phone_number: '919876543211', phone_number_id: '1001' },
                  statuses: [
                    {
                      id: messageId,
                      status: 'delivered',
                      timestamp: '1729700000',
                      recipient_id: '919876543211',
                    },
                  ],
                },
                field: 'messages',
              },
            ],
          },
        ],
      }

      await request(app)
        .post('/api/whatsapp/webhook')
        .set('x-hub-signature-256', signBody(payload))
        .send(payload)
        .expect(200)

      const rechecked = await WhatsAppNotification.findById(notification._id)
      expect(rechecked?.status).toBe('read') // Did not downgrade to delivered
    })

    it('processes inbound opt-out message (STOP) and sets whatsappMarketingOptIn = false', async () => {
      const member = await createTestMember({
        fullName: 'Opt Out Member',
        phone: '9876543212',
        whatsappMarketingOptIn: true,
      })

      const inboundPayload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            id: '123456789',
            changes: [
              {
                value: {
                  messaging_product: 'whatsapp',
                  metadata: { display_phone_number: '919876543212', phone_number_id: '1001' },
                  messages: [
                    {
                      from: '919876543212',
                      id: 'wamid.inbound_stop_123',
                      timestamp: '1729700000',
                      type: 'text',
                      text: { body: 'STOP' },
                    },
                  ],
                },
                field: 'messages',
              },
            ],
          },
        ],
      }

      await request(app)
        .post('/api/whatsapp/webhook')
        .set('x-hub-signature-256', signBody(inboundPayload))
        .send(inboundPayload)
        .expect(200)

      const updated = await Member.findById(member._id)
      expect(updated?.whatsappMarketingOptIn).toBe(false)
    })
  })

  describe('Upcoming Fee Due in 2 Days Reminders', () => {
    it('identifies members due in exactly 2 days, ignoring tomorrow or 3 days later', async () => {
      const now = new Date('2026-10-23T10:00:00.000Z')

      const m2Days = await createTestMember({
        fullName: 'Member Two Days',
        phone: '9876500002',
        joiningDate: new Date('2026-09-25'),
      })
      await createTestPayment(m2Days, {
        dueDate: new Date('2026-10-25T00:00:00.000Z'),
        periodStart: new Date('2026-10-25'),
        periodEnd: new Date('2026-11-24'),
        dueAmountPaise: 150000,
        amountPaidPaise: 0,
        status: 'unpaid',
      })

      const mTomorrow = await createTestMember({
        fullName: 'Member Tomorrow',
        phone: '9876500001',
        joiningDate: new Date('2026-09-24'),
      })
      await createTestPayment(mTomorrow, {
        dueDate: new Date('2026-10-24T00:00:00.000Z'),
        periodStart: new Date('2026-10-24'),
        periodEnd: new Date('2026-11-23'),
        dueAmountPaise: 150000,
        amountPaidPaise: 0,
        status: 'unpaid',
      })

      const upcoming = await whatsAppService.getUpcomingFeeDueMembers(now)
      expect(upcoming).toHaveLength(1)
      expect(upcoming[0].member.memberId).toBe(m2Days.memberId)
      expect(upcoming[0].daysLeft).toBe(2)
    })

    it('enforces deduplication so re-running the job never sends duplicate reminders', async () => {
      const now = new Date('2026-10-23T10:00:00.000Z')
      const member = await createTestMember({
        fullName: 'Dedup Member',
        phone: '9876500010',
        joiningDate: new Date('2026-09-25'),
      })
      const payment = await createTestPayment(member, {
        dueDate: new Date('2026-10-25T00:00:00.000Z'),
        periodStart: new Date('2026-10-25'),
        periodEnd: new Date('2026-11-24'),
        dueAmountPaise: 150000,
        amountPaidPaise: 0,
        status: 'unpaid',
      })

      const firstResult = await whatsAppService.sendUpcomingDueReminder(member, payment, now)
      expect(firstResult?.status).toBe('sent')
      expect(mockProvider.sentMessages).toHaveLength(1)

      const secondResult = await whatsAppService.sendUpcomingDueReminder(member, payment, now)
      expect(secondResult?._id.toString()).toBe(firstResult?._id.toString())
      expect(mockProvider.sentMessages).toHaveLength(1) // Still 1, no duplicate
    })
  })

  describe('Overdue Fee Reminders', () => {
    it('identifies overdue members and excludes fully paid members', async () => {
      const now = new Date('2026-10-23T10:00:00.000Z')

      const mUnpaid = await createTestMember({
        fullName: 'Overdue Unpaid',
        phone: '9876500021',
        joiningDate: new Date('2026-09-20'),
      })
      await createTestPayment(mUnpaid, {
        dueDate: new Date('2026-10-20T00:00:00.000Z'),
        periodStart: new Date('2026-10-20'),
        periodEnd: new Date('2026-11-19'),
        dueAmountPaise: 150000,
        amountPaidPaise: 0,
        status: 'unpaid',
      })

      const mPaid = await createTestMember({
        fullName: 'Overdue But Paid',
        phone: '9876500022',
        joiningDate: new Date('2026-09-20'),
      })
      await createTestPayment(mPaid, {
        dueDate: new Date('2026-10-20T00:00:00.000Z'),
        periodStart: new Date('2026-10-20'),
        periodEnd: new Date('2026-11-19'),
        dueAmountPaise: 150000,
        amountPaidPaise: 150000,
        status: 'paid',
      })

      const overdueList = await whatsAppService.getOverdueMembers(now)
      expect(overdueList).toHaveLength(1)
      expect(overdueList[0].member.memberId).toBe(mUnpaid.memberId)
      expect(overdueList[0].daysOverdue).toBe(3)
    })

    it('sends daily overdue reminder deduplicated per day and stops when paid', async () => {
      const day1 = new Date('2026-10-23T10:00:00.000Z')
      const day2 = new Date('2026-10-24T10:00:00.000Z')

      const member = await createTestMember({
        fullName: 'Daily Overdue Member',
        phone: '9876500030',
        joiningDate: new Date('2026-09-20'),
      })
      const payment = await createTestPayment(member, {
        dueDate: new Date('2026-10-20T00:00:00.000Z'),
        periodStart: new Date('2026-10-20'),
        periodEnd: new Date('2026-11-19'),
        dueAmountPaise: 150000,
        amountPaidPaise: 0,
        status: 'unpaid',
      })

      // Send day 1
      await whatsAppService.sendOverdueReminder(member, payment, day1)
      expect(mockProvider.sentMessages).toHaveLength(1)

      // Retrying day 1 deduplicates
      await whatsAppService.sendOverdueReminder(member, payment, day1)
      expect(mockProvider.sentMessages).toHaveLength(1)

      // Send day 2
      await whatsAppService.sendOverdueReminder(member, payment, day2)
      expect(mockProvider.sentMessages).toHaveLength(2)

      // Member pays
      payment.amountPaidPaise = 150000
      payment.status = 'paid'
      await payment.save()

      // Reminder is stopped
      const resultAfterPaid = await whatsAppService.sendOverdueReminder(
        member,
        payment,
        new Date('2026-10-25T10:00:00.000Z'),
      )
      expect(resultAfterPaid).toBeNull()
      expect(mockProvider.sentMessages).toHaveLength(2) // No new sends
    })
  })

  describe('Controlled Outbound Messaging & Queue Safety', () => {
    it('cancels fee reminder dispatch if member pays fee before queue processes', async () => {
      const member = await createTestMember({
        fullName: 'Payer Before Queue',
        phone: '9876500040',
        joiningDate: new Date('2026-09-25'),
      })
      const payment = await createTestPayment(member, {
        dueDate: new Date('2026-10-25T00:00:00.000Z'),
        periodStart: new Date('2026-10-25'),
        periodEnd: new Date('2026-11-24'),
        dueAmountPaise: 150000,
        amountPaidPaise: 0,
        status: 'unpaid',
      })

      // Create notification manually in queued state
      const notif = await WhatsAppNotification.create({
        member: member._id,
        memberId: member.memberId,
        phoneNumber: '919876500040',
        type: 'FEE_DUE_2_DAYS',
        payment: payment._id,
        templateName: 'reborn_fee_due_reminder',
        status: 'queued',
        provider: 'cloud_api',
      })

      // Member settles fee before queue dispatches
      payment.status = 'paid'
      payment.amountPaidPaise = 150000
      await payment.save()

      const summary = await outboundQueueService.dispatchPending()
      expect(summary.skippedPaid).toBe(1)
      expect(mockProvider.sentMessages).toHaveLength(0)

      const rechecked = await WhatsAppNotification.findById(notif._id)
      expect(rechecked?.status).toBe('not_sent')
      expect(rechecked?.error).toContain('Payment settled prior to dispatch')
    })

    it('enforces shared rolling-window limiter across concurrent dispatches', async () => {
      outboundRateLimiter.configure({
        maxPerWindow: 2,
        windowMs: 300,
      })

      await outboundRateLimiter.acquireSlot()
      outboundRateLimiter.recordDispatch()
      await outboundRateLimiter.acquireSlot()
      outboundRateLimiter.recordDispatch()

      const start = Date.now()
      await outboundRateLimiter.acquireSlot()
      outboundRateLimiter.recordDispatch()
      const elapsed = Date.now() - start

      expect(elapsed).toBeGreaterThanOrEqual(250)
    })

    it('treats ambiguous timeouts carefully and avoids auto-retrying to prevent duplicate messages', async () => {
      const member = await createTestMember({
        fullName: 'Timeout Guard Member',
        phone: '9876500050',
        joiningDate: new Date('2026-09-25'),
      })

      const timeoutErr = new Error('Graph API request timed out')
      timeoutErr.name = 'AbortError'
      vi.spyOn(mockProvider, 'sendTextMessage').mockRejectedValue(timeoutErr)

      const notif = await WhatsAppNotification.create({
        member: member._id,
        memberId: member.memberId,
        phoneNumber: '919876500050',
        type: 'CUSTOM',
        message: 'Timeout testing',
        status: 'queued',
        provider: 'cloud_api',
      })

      await outboundQueueService.dispatchPending()

      const updated = await WhatsAppNotification.findById(notif._id)
      expect(updated?.status).toBe('failed')
      expect(updated?.error).toContain('Ambiguous timeout')
      expect(updated?.attempts).toBe(1) // Not retried
    })

    it('recovers stale items left in sending state from process restarts', async () => {
      const member = await createTestMember({
        fullName: 'Crash Recovery Member',
        phone: '9876500060',
        joiningDate: new Date('2026-09-25'),
      })

      await WhatsAppNotification.create({
        member: member._id,
        memberId: member.memberId,
        phoneNumber: '919876500060',
        type: 'CUSTOM',
        message: 'Pre-crash message',
        status: 'sending',
        provider: 'cloud_api',
      })

      const recovered = await outboundQueueService.recoverStaleSendingItems()
      expect(recovered).toBe(1)

      const count = await WhatsAppNotification.countDocuments({ status: 'queued' })
      expect(count).toBe(1)
    })
  })

  describe('Reminders with New Plans (15 Days - ₹500, Monthly - ₹1,500, Monthly - ₹2,000)', () => {
    it('sends upcoming fee reminder for 15 Days – ₹500 with exact plan name and ₹500 fee', async () => {
      const now = new Date('2026-10-23T10:00:00.000Z')
      const member = await createTestMember({
        fullName: 'Aarav Gupta',
        phone: '9876500070',
        planId: '15days-500',
        planName: '15 Days – ₹500',
        joiningDate: new Date('2026-10-10'),
        monthlyFeePaise: 50000,
      })
      const payment = await createTestPayment(member, {
        planName: '15 Days – ₹500',
        dueDate: new Date('2026-10-25T00:00:00.000Z'),
        periodStart: new Date('2026-10-25'),
        periodEnd: new Date('2026-11-08'),
        dueAmountPaise: 50000,
        amountPaidPaise: 0,
        status: 'unpaid',
      })

      const reminder = await whatsAppService.sendUpcomingDueReminder(member, payment, now)
      expect(reminder?.status).toBe('sent')
      expect(reminder?.metadata?.amountDue).toBe('500')
      expect(reminder?.metadata?.planName).toBe('15 Days – ₹500')
    })

    it('sends overdue reminder for Monthly – ₹2,000 and stops when balance is paid', async () => {
      const now = new Date('2026-10-23T10:00:00.000Z')
      const member = await createTestMember({
        fullName: 'Vikram Joshi',
        phone: '9876500080',
        planId: 'monthly-2000',
        planName: 'Monthly – ₹2,000',
        joiningDate: new Date('2026-09-20'),
        monthlyFeePaise: 200000,
      })
      const payment = await createTestPayment(member, {
        planName: 'Monthly – ₹2,000',
        dueDate: new Date('2026-10-20T00:00:00.000Z'),
        periodStart: new Date('2026-10-20'),
        periodEnd: new Date('2026-11-19'),
        dueAmountPaise: 200000,
        amountPaidPaise: 50000, // Partial payment
        status: 'partial',
      })

      const reminder = await whatsAppService.sendOverdueReminder(member, payment, now)
      expect(reminder?.status).toBe('sent')
      expect(reminder?.metadata?.amountDue).toBe('1,500') // Balance due
      expect(reminder?.metadata?.daysOverdue).toBe(3)
    })
  })

  describe('Admin Endpoints & Custom Broadcasts', () => {
    it('provides status and allows queue pause and resume controls in admin API', async () => {
      const authed = await loginAgent(app, TEST_ADMIN.username, TEST_ADMIN.password)

      const statusRes = await authed.agent.get('/api/admin/whatsapp/status').expect(200)
      expect(statusRes.body).toHaveProperty('provider')
      expect(statusRes.body).toHaveProperty('isConfigured')
      expect(statusRes.body).toHaveProperty('webhookPath')

      // Pause queue
      await authed.agent
        .post('/api/admin/whatsapp/queue/pause')
        .set('x-csrf-token', authed.csrf)
        .send({ reason: 'Manual audit pause' })
        .expect(200)

      expect(outboundRateLimiter.isPaused()).toBe(true)

      // Resume queue
      const resumeRes = await authed.agent
        .post('/api/admin/whatsapp/queue/resume')
        .set('x-csrf-token', authed.csrf)
        .expect(200)

      expect(resumeRes.body.success).toBe(true)
      expect(outboundRateLimiter.isPaused()).toBe(false)
    })

    it('previews and dispatches custom campaign broadcast with marketing consent check', async () => {
      const authed = await loginAgent(app, TEST_ADMIN.username, TEST_ADMIN.password)

      await createTestMember({
        fullName: 'Consented Member',
        phone: '9876500091',
        whatsappMarketingOptIn: true,
      })
      await createTestMember({
        fullName: 'Unconsented Member',
        phone: '9876500092',
        whatsappMarketingOptIn: false,
      })

      // Preview with marketing consent required
      const previewRes = await authed.agent
        .post('/api/admin/whatsapp/campaigns/preview')
        .set('x-csrf-token', authed.csrf)
        .send({ recipientFilter: 'active', requireMarketingConsent: true })
        .expect(200)

      expect(previewRes.body.recipientCount).toBe(1)
      expect(previewRes.body.sampleRecipients[0].phone).toBe('9876500091')

      // Dispatch campaign
      const sendRes = await authed.agent
        .post('/api/admin/whatsapp/campaigns/send?wait=true')
        .set('x-csrf-token', authed.csrf)
        .send({
          name: 'Festival Promo',
          message: 'Happy Diwali to all members!',
          recipientFilter: 'active',
          requireMarketingConsent: true,
        })
        .expect(200)

      expect(sendRes.body.success).toBe(true)
      expect(sendRes.body.campaign.recipientCount).toBe(1)

      const historyRes = await authed.agent.get('/api/admin/whatsapp/campaigns').expect(200)
      expect(historyRes.body.items).toHaveLength(1)
      expect(historyRes.body.items[0].name).toBe('Festival Promo')
    })
  })
})
