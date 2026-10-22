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
import { EvolutionWhatsAppProvider } from '../src/services/whatsapp/evolution-whatsapp.provider'
import { MockWhatsAppProvider } from '../src/services/whatsapp/mock-whatsapp.provider'
import {
  formatEvolutionPhone,
  formatMetaPhone,
  normalizePhone,
  isValidIndianMobile,
} from '../src/utils/phone'
import {
  formatUpcomingDueMessage,
  formatOverdueMessage,
  formatGymClosureMessage,
  formatFestivalOfferMessage,
  formatCustomMessage,
} from '../src/services/whatsapp/whatsapp.templates'
import type { Express } from 'express'

describe('WhatsApp Notification Module (Evolution API)', () => {
  let app: Express
  let mockProvider: MockWhatsAppProvider

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

    it('formats phone into Evolution WhatsApp recipient format (91XXXXXXXXXX)', () => {
      expect(formatEvolutionPhone('+91 98765-43210')).toBe('919876543210')
      expect(formatEvolutionPhone('09876543210')).toBe('919876543210')
      expect(formatEvolutionPhone('9876543210')).toBe('919876543210')
      expect(formatEvolutionPhone('+91 91 9876543210')).toBe('919876543210')
      expect(formatEvolutionPhone('12345')).toBeNull()
      expect(formatEvolutionPhone('abcdef')).toBeNull()
      // Backwards-compatible alias check
      expect(formatMetaPhone('9876543210')).toBe('919876543210')
    })

    it('validates standard Indian mobile numbers', () => {
      expect(isValidIndianMobile('9876543210')).toBe(true)
      expect(isValidIndianMobile('8123456789')).toBe(true)
      expect(isValidIndianMobile('7123456789')).toBe(true)
      expect(isValidIndianMobile('6123456789')).toBe(true)
      expect(isValidIndianMobile('5123456789')).toBe(false)
    })
  })

  describe('Message Formatting Utilities', () => {
    it('formats upcoming due reminder text', () => {
      const msg = formatUpcomingDueMessage({
        memberName: 'Rahul',
        planName: 'Monthly – ₹1,500',
        dueDate: '24/10/2026',
        amountDue: '1,500',
      })
      expect(msg).toContain('Rahul')
      expect(msg).toContain('Monthly – ₹1,500')
      expect(msg).toContain('₹1,500')
      expect(msg).toContain('24/10/2026')
    })

    it('formats overdue fee reminder text', () => {
      const msg = formatOverdueMessage({
        memberName: 'Anita',
        planName: '15 Days – ₹500',
        daysOverdue: 3,
        amountDue: '500',
      })
      expect(msg).toContain('Anita')
      expect(msg).toContain('3 days')
      expect(msg).toContain('₹500')
    })

    it('formats gym closure announcements and festival offers', () => {
      const closure = formatGymClosureMessage({
        memberName: 'Vikram',
        reason: 'Maintenance',
        dates: 'Sunday, 25th Oct',
        reopenDate: 'Monday, 26th Oct',
      })
      expect(closure).toContain('Maintenance')
      expect(closure).toContain('Sunday, 25th Oct')

      const festival = formatFestivalOfferMessage({
        memberName: 'Vikram',
        occasion: 'Diwali',
        offerDetails: 'Get 2 months free on annual plans',
        validUntil: 'Nov 15',
      })
      expect(festival).toContain('Diwali')
      expect(festival).toContain('Get 2 months free')

      const custom = formatCustomMessage({
        memberName: 'Vikram',
        message: 'Personal training slots now open!',
      })
      expect(custom).toContain('Personal training slots now open!')
    })
  })

  describe('EvolutionWhatsAppProvider Unit Tests', () => {
    it('initializes properly and reports isConfigured correctly', () => {
      const valid = new EvolutionWhatsAppProvider({
        apiUrl: 'http://localhost:8080/',
        apiKey: 'secret_key',
        instanceName: 'reborn-fitness',
      })
      expect(valid.isConfigured).toBe(true)

      const incomplete = new EvolutionWhatsAppProvider({
        apiUrl: '',
        apiKey: '',
        instanceName: 'reborn-fitness',
      })
      expect(incomplete.isConfigured).toBe(false)
    })

    it('sends text messages to the correct Evolution endpoint with apikey header', async () => {
      const provider = new EvolutionWhatsAppProvider({
        apiUrl: 'http://localhost:8080/',
        apiKey: 'test-api-key',
        instanceName: 'reborn-fitness',
      })

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            key: { id: 'evo_msg_123', remoteJid: '919876543210@s.whatsapp.net' },
            status: 'PENDING',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )

      const result = await provider.sendTextMessage({
        to: '919876543210',
        text: 'Your fee is due in two days.',
      })

      expect(result.success).toBe(true)
      expect(result.messageId).toBe('evo_msg_123')
      expect(result.status).toBe('sent')

      expect(fetchSpy).toHaveBeenCalledTimes(1)
      const [calledUrl, calledInit] = fetchSpy.mock.calls[0]
      expect(calledUrl).toBe('http://localhost:8080/message/sendText/reborn-fitness')
      expect((calledInit?.headers as Record<string, string>)?.apikey).toBe('test-api-key')
      expect(JSON.parse(calledInit?.body as string)).toEqual({
        number: '919876543210',
        text: 'Your fee is due in two days.',
      })
    })

    it('handles Evolution API error responses gracefully without exposing secrets', async () => {
      const provider = new EvolutionWhatsAppProvider({
        apiUrl: 'http://localhost:8080',
        apiKey: 'secret_key_never_leak',
        instanceName: 'reborn-fitness',
      })

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: 'Instance not connected to WhatsApp',
            status: 400,
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } },
        ),
      )

      const result = await provider.sendTextMessage({
        to: '919876543210',
        text: 'Test reminder',
      })

      expect(result.success).toBe(false)
      expect(result.status).toBe('failed')
      expect(result.error).toContain('Instance not connected')
      expect(result.error).not.toContain('secret_key_never_leak')
    })

    it('handles network errors and timeouts safely', async () => {
      const provider = new EvolutionWhatsAppProvider({
        apiUrl: 'http://localhost:8080',
        apiKey: 'test_key',
        instanceName: 'reborn-fitness',
        requestTimeoutMs: 50,
      })

      vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('ECONNREFUSED'))

      const result = await provider.sendTextMessage({
        to: '919876543210',
        text: 'Test message',
      })

      expect(result.success).toBe(false)
      expect(result.status).toBe('failed')
      expect(result.error).toContain('ECONNREFUSED')
    })

    it('sends media messages with image and caption to Evolution endpoint', async () => {
      const provider = new EvolutionWhatsAppProvider({
        apiUrl: 'http://localhost:8080',
        apiKey: 'test-api-key',
        instanceName: 'reborn-fitness',
      })

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            key: { id: 'evo_media_456' },
            status: 'PENDING',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )

      const result = await provider.sendMediaMessage({
        to: '919876543210',
        type: 'image',
        mediaUrl: 'https://images.example.com/promo.jpg',
        caption: 'Diwali Special Offer!',
      })

      expect(result.success).toBe(true)
      expect(result.messageId).toBe('evo_media_456')
      expect(fetchSpy).toHaveBeenCalledWith(
        'http://localhost:8080/message/sendMedia/reborn-fitness',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            number: '919876543210',
            mediatype: 'image',
            media: 'https://images.example.com/promo.jpg',
            caption: 'Diwali Special Offer!',
          }),
        }),
      )
    })

    it('resolves local uploads to base64 Data URIs and guards against path traversal', async () => {
      const provider = new EvolutionWhatsAppProvider({
        apiUrl: 'http://localhost:8080',
        apiKey: 'test_key',
        instanceName: 'reborn-fitness',
      })

      // Create a temporary test image in public/uploads/whatsapp
      const uploadDir = path.resolve(process.cwd(), 'public', 'uploads', 'whatsapp')
      if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true })
      const testFile = path.join(uploadDir, 'test_sample.png')
      fs.writeFileSync(testFile, Buffer.from('fake-png-data'))

      try {
        const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
          new Response(JSON.stringify({ key: { id: 'evo_media_789' } }), { status: 200 }),
        )

        const result = await provider.sendMediaMessage({
          to: '919876543210',
          type: 'image',
          mediaUrl: '/uploads/whatsapp/test_sample.png',
          caption: 'Sample photo',
        })

        expect(result.success).toBe(true)
        const calledBody = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string)
        expect(calledBody.media).toContain('data:image/png;base64,')

        // Test directory traversal prevention
        const traversalResult = await provider.sendMediaMessage({
          to: '919876543210',
          type: 'image',
          mediaUrl: '/uploads/whatsapp/../../../../etc/passwd',
          caption: 'Exploit attempt',
        })
        expect(traversalResult.success).toBe(false)
        expect(traversalResult.error).toContain('Media attachment could not be read')
      } finally {
        if (fs.existsSync(testFile)) fs.unlinkSync(testFile)
      }
    })

    it('checks instance connection state accurately (connected, disconnected, unreachable)', async () => {
      const provider = new EvolutionWhatsAppProvider({
        apiUrl: 'http://localhost:8080',
        apiKey: 'test_key',
        instanceName: 'reborn-fitness',
      })

      // 1. Connected ('open')
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ instance: { state: 'open' } }), { status: 200 }),
      )
      const res1 = await provider.getConnectionStatus()
      expect(res1.state).toBe('connected')

      // 2. Disconnected ('close')
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ instance: { state: 'close' } }), { status: 200 }),
      )
      const res2 = await provider.getConnectionStatus()
      expect(res2.state).toBe('disconnected')

      // 3. 401 Unauthorized -> unreachable
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
      )
      const res3 = await provider.getConnectionStatus()
      expect(res3.state).toBe('unreachable')

      // 4. Fetch throws network error
      vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network offline'))
      const res4 = await provider.getConnectionStatus()
      expect(res4.state).toBe('unreachable')
    })

    it('verifies webhook shared secrets with constant-time equality', () => {
      const provider = new EvolutionWhatsAppProvider({
        apiUrl: 'http://localhost:8080',
        apiKey: 'test_key',
        instanceName: 'reborn-fitness',
        webhookSecret: 'super-secure-shared-secret-12345',
      })

      expect(provider.verifyWebhookSecret('super-secure-shared-secret-12345')).toBe(true)
      expect(provider.verifyWebhookSecret('wrong-secret')).toBe(false)
      expect(provider.verifyWebhookSecret('')).toBe(false)
      expect(provider.verifyWebhookSecret(undefined)).toBe(false)
    })
  })

  describe('Upcoming Fee Due in 2 Days Reminders', () => {
    it('identifies members due in exactly 2 days, ignoring tomorrow or 3 days later', async () => {
      const now = new Date()
      const day2Date = new Date(`${istDay(2)}T00:00:00+05:30`)
      const day1Date = new Date(`${istDay(1)}T00:00:00+05:30`)
      const day3Date = new Date(`${istDay(3)}T00:00:00+05:30`)

      // Member 1: due in 2 days
      const m1 = await Member.create({
        memberId: 'RBF-0001',
        fullName: 'Rahul Sharma',
        phone: '9876543210',
        planId: 'monthly',
        planName: 'Monthly Fitness',
        monthlyFeePaise: 150000,
        joiningDate: new Date('2026-08-01T00:00:00+05:30'),
        status: 'active',
      })
      await MonthlyPayment.create({
        member: m1._id,
        memberId: m1.memberId,
        invoiceNumber: 'INV-TEST-0001',
        billingMonth: '2026-10',
        dueDate: day2Date,
        dueAmountPaise: 150000,
        amountPaidPaise: 0,
        status: 'unpaid',
      })

      // Member 2: due tomorrow (1 day)
      const m2 = await Member.create({
        memberId: 'RBF-0002',
        fullName: 'Aman Verma',
        phone: '9876543211',
        planId: 'monthly',
        planName: 'Monthly Fitness',
        monthlyFeePaise: 150000,
        joiningDate: new Date('2026-08-01T00:00:00+05:30'),
        status: 'active',
      })
      await MonthlyPayment.create({
        member: m2._id,
        memberId: m2.memberId,
        invoiceNumber: 'INV-TEST-0002',
        billingMonth: '2026-10',
        dueDate: day1Date,
        dueAmountPaise: 150000,
        amountPaidPaise: 0,
        status: 'unpaid',
      })

      // Member 3: due in 3 days
      const m3 = await Member.create({
        memberId: 'RBF-0003',
        fullName: 'Priya Singh',
        phone: '9876543212',
        planId: 'monthly',
        planName: 'Monthly Fitness',
        monthlyFeePaise: 150000,
        joiningDate: new Date('2026-08-01T00:00:00+05:30'),
        status: 'active',
      })
      await MonthlyPayment.create({
        member: m3._id,
        memberId: m3.memberId,
        invoiceNumber: 'INV-TEST-0003',
        billingMonth: '2026-10',
        dueDate: day3Date,
        dueAmountPaise: 150000,
        amountPaidPaise: 0,
        status: 'unpaid',
      })

      const upcoming = await whatsAppService.getUpcomingFeeDueMembers(now)
      expect(upcoming).toHaveLength(1)
      expect(upcoming[0].member.memberId).toBe('RBF-0001')
      expect(upcoming[0].daysLeft).toBe(2)
    })

    it('enforces deduplication so re-running the job never sends duplicate reminders', async () => {
      const now = new Date()
      const day2Date = new Date(`${istDay(2)}T00:00:00+05:30`)

      const member = await Member.create({
        memberId: 'RBF-0004',
        fullName: 'Suresh Kumar',
        phone: '9876543213',
        planId: 'monthly',
        planName: 'Monthly Fitness',
        monthlyFeePaise: 150000,
        joiningDate: new Date('2026-08-01T00:00:00+05:30'),
        status: 'active',
      })
      const payment = await MonthlyPayment.create({
        member: member._id,
        memberId: member.memberId,
        invoiceNumber: 'INV-TEST-0004',
        billingMonth: '2026-10',
        dueDate: day2Date,
        dueAmountPaise: 150000,
        amountPaidPaise: 0,
        status: 'unpaid',
      })

      // First run sends message
      const res1 = await whatsAppService.sendUpcomingDueReminder(member, payment, now)
      expect(res1?.status).toBe('sent')
      expect(mockProvider.sentMessages).toHaveLength(1)

      // Second run detects existing dedupKey and returns existing record without sending again
      const res2 = await whatsAppService.sendUpcomingDueReminder(member, payment, now)
      expect(res2?._id.toString()).toBe(res1?._id.toString())
      expect(mockProvider.sentMessages).toHaveLength(1)
    })
  })

  describe('Overdue Fee Reminders', () => {
    it('identifies overdue members and excludes fully paid members', async () => {
      const now = new Date()
      const overdueDate = new Date(`${istDay(-3)}T00:00:00+05:30`)

      // Unpaid overdue member
      const m1 = await Member.create({
        memberId: 'RBF-0005',
        fullName: 'Overdue Member',
        phone: '9876543214',
        planId: 'monthly',
        planName: 'Monthly',
        monthlyFeePaise: 100000,
        joiningDate: new Date('2026-08-01T00:00:00+05:30'),
        status: 'active',
      })
      await MonthlyPayment.create({
        member: m1._id,
        memberId: m1.memberId,
        invoiceNumber: 'INV-TEST-0005',
        billingMonth: '2026-09',
        dueDate: overdueDate,
        dueAmountPaise: 100000,
        amountPaidPaise: 0,
        status: 'unpaid',
      })

      // Paid member with past due date
      const m2 = await Member.create({
        memberId: 'RBF-0006',
        fullName: 'Paid Member',
        phone: '9876543215',
        planId: 'monthly',
        planName: 'Monthly',
        monthlyFeePaise: 100000,
        joiningDate: new Date('2026-08-01T00:00:00+05:30'),
        status: 'active',
      })
      await MonthlyPayment.create({
        member: m2._id,
        memberId: m2.memberId,
        invoiceNumber: 'INV-TEST-0006',
        billingMonth: '2026-09',
        dueDate: overdueDate,
        dueAmountPaise: 100000,
        amountPaidPaise: 100000,
        status: 'paid',
      })

      const overdue = await whatsAppService.getOverdueMembers(now)
      expect(overdue).toHaveLength(1)
      expect(overdue[0].member.memberId).toBe('RBF-0005')
      expect(overdue[0].daysOverdue).toBe(3)
    })

    it('sends daily overdue reminder deduplicated per day, allowing next day and stopping when paid', async () => {
      const today = new Date('2026-10-22T10:00:00+05:30')
      const tomorrow = new Date('2026-10-23T10:00:00+05:30')
      const overdueDate = new Date('2026-10-18T00:00:00+05:30')

      const member = await Member.create({
        memberId: 'RBF-0007',
        fullName: 'Daily Overdue Member',
        phone: '9876543216',
        planId: 'monthly',
        planName: 'Monthly',
        monthlyFeePaise: 100000,
        joiningDate: new Date('2026-08-01T00:00:00+05:30'),
        status: 'active',
      })
      const payment = await MonthlyPayment.create({
        member: member._id,
        memberId: member.memberId,
        invoiceNumber: 'INV-TEST-0007',
        billingMonth: '2026-09',
        dueDate: overdueDate,
        dueAmountPaise: 100000,
        amountPaidPaise: 0,
        status: 'unpaid',
      })

      // Run on Oct 22
      await whatsAppService.sendOverdueReminder(member, payment, today)
      expect(mockProvider.sentMessages).toHaveLength(1)

      // Re-run on Oct 22 (deduplicated)
      await whatsAppService.sendOverdueReminder(member, payment, today)
      expect(mockProvider.sentMessages).toHaveLength(1)

      // Run on Oct 23 (allowed)
      await whatsAppService.sendOverdueReminder(member, payment, tomorrow)
      expect(mockProvider.sentMessages).toHaveLength(2)

      // If member pays, further reminders stop
      payment.amountPaidPaise = 100000
      payment.status = 'paid'
      await payment.save()

      const dayAfter = new Date('2026-10-24T10:00:00+05:30')
      const stopped = await whatsAppService.sendOverdueReminder(member, payment, dayAfter)
      expect(stopped).toBeNull()
      expect(mockProvider.sentMessages).toHaveLength(2)
    })
  })

  describe('Evolution Webhook Endpoint & Status Mapping', () => {
    it('verifies GET webhook endpoint connectivity', async () => {
      const res = await request(app).get('/api/whatsapp/evolution-webhook').expect(200)
      expect(res.body.status).toBe('ok')
    })

    it('enforces shared-secret validation when configured and rejects invalid secrets', async () => {
      const oldSecret = process.env.EVOLUTION_WEBHOOK_SECRET
      process.env.EVOLUTION_WEBHOOK_SECRET = 'secret_webhook_token_999'

      // Missing or wrong secret -> 401
      await request(app)
        .post('/api/whatsapp/evolution-webhook')
        .send({ event: 'CONNECTION_UPDATE', data: { state: 'open' } })
        .expect(401)

      await request(app)
        .post('/api/whatsapp/evolution-webhook')
        .set('x-webhook-secret', 'wrong_token')
        .send({ event: 'CONNECTION_UPDATE', data: { state: 'open' } })
        .expect(401)

      // Correct secret in header -> 200
      const validRes = await request(app)
        .post('/api/whatsapp/evolution-webhook')
        .set('x-webhook-secret', 'secret_webhook_token_999')
        .send({ event: 'CONNECTION_UPDATE', data: { state: 'open' } })
        .expect(200)

      expect(validRes.body.status).toBe('ok')
      if (oldSecret) {
        process.env.EVOLUTION_WEBHOOK_SECRET = oldSecret
      } else {
        delete process.env.EVOLUTION_WEBHOOK_SECRET
      }
    })

    it('updates notification status upon receiving Evolution webhook events (sent, delivered, read, failed)', async () => {
      const member = await Member.create({
        memberId: 'RBF-0008',
        fullName: 'Webhook Test Member',
        phone: '9876543217',
        planId: 'monthly',
        monthlyFeePaise: 100000,
        joiningDate: new Date('2026-08-01T00:00:00+05:30'),
        status: 'active',
      })

      const notif = await WhatsAppNotification.create({
        member: member._id,
        memberId: member.memberId,
        phoneNumber: '919876543217',
        type: 'CUSTOM',
        messageId: 'evo_msg_key_101',
        status: 'sent',
      })

      // 1. Evolution DELIVERY_ACK event
      const payloadDelivered = {
        event: 'messages.update',
        instance: 'reborn-fitness',
        data: [
          {
            key: { id: 'evo_msg_key_101', remoteJid: '919876543217@s.whatsapp.net' },
            update: { status: 'DELIVERY_ACK' },
            messageTimestamp: 1729584000,
          },
        ],
      }

      await request(app).post('/api/whatsapp/evolution-webhook').send(payloadDelivered).expect(200)

      const updatedDelivered = await WhatsAppNotification.findById(notif._id)
      expect(updatedDelivered?.status).toBe('delivered')
      expect(updatedDelivered?.deliveredAt).not.toBeNull()

      // 2. Evolution READ event
      const payloadRead = {
        event: 'MESSAGES_UPDATE',
        instance: 'reborn-fitness',
        data: {
          keyId: 'evo_msg_key_101',
          status: 'READ',
          messageTimestamp: 1729584100,
        },
      }

      await request(app).post('/api/whatsapp/evolution-webhook').send(payloadRead).expect(200)

      const updatedRead = await WhatsAppNotification.findById(notif._id)
      expect(updatedRead?.status).toBe('read')
      expect(updatedRead?.readAt).not.toBeNull()
    })

    it('protects status hierarchy against out-of-order events and prevents campaign stat double-counting', async () => {
      const { agent, csrf } = await loginAgent(app, TEST_ADMIN.username, TEST_ADMIN.password)

      const member = await Member.create({
        memberId: 'RBF-0009',
        fullName: 'Hierarchy Member',
        phone: '9876543219',
        planId: 'monthly',
        monthlyFeePaise: 100000,
        joiningDate: new Date('2026-08-01T00:00:00+05:30'),
        status: 'active',
      })

      const campaign = await WhatsAppCampaign.create({
        name: 'Hierarchy Test Campaign',
        message: 'Important message',
        recipientFilter: 'all',
        recipientCount: 1,
        stats: { sent: 1, delivered: 0, read: 0, failed: 0 },
        status: 'completed',
        createdBy: member._id,
      })

      const notif = await WhatsAppNotification.create({
        member: member._id,
        memberId: member.memberId,
        phoneNumber: '919876543219',
        type: 'CUSTOM',
        campaign: campaign._id,
        messageId: 'evo_hierarchy_msg_1',
        status: 'sent',
      })

      // 1. Deliver message
      await request(app)
        .post('/api/whatsapp/evolution-webhook')
        .send({
          event: 'messages.update',
          data: [{ key: { id: 'evo_hierarchy_msg_1' }, update: { status: 'DELIVERY_ACK' } }],
        })
        .expect(200)

      let c = await WhatsAppCampaign.findById(campaign._id)
      expect(c?.stats.delivered).toBe(1)

      // 2. Duplicate DELIVERED event (should NOT increment campaign stats again)
      await request(app)
        .post('/api/whatsapp/evolution-webhook')
        .send({
          event: 'messages.update',
          data: [{ key: { id: 'evo_hierarchy_msg_1' }, update: { status: 'DELIVERY_ACK' } }],
        })
        .expect(200)

      c = await WhatsAppCampaign.findById(campaign._id)
      expect(c?.stats.delivered).toBe(1) // Still 1!

      // 3. Mark READ
      await request(app)
        .post('/api/whatsapp/evolution-webhook')
        .send({
          event: 'messages.update',
          data: [{ key: { id: 'evo_hierarchy_msg_1' }, update: { status: 'READ' } }],
        })
        .expect(200)

      c = await WhatsAppCampaign.findById(campaign._id)
      expect(c?.stats.read).toBe(1)

      // 4. Delayed out-of-order SENT or DELIVERED event must NOT downgrade READ status
      await request(app)
        .post('/api/whatsapp/evolution-webhook')
        .send({
          event: 'send.message',
          data: [{ key: { id: 'evo_hierarchy_msg_1' }, status: 'SERVER_ACK' }],
        })
        .expect(200)

      const finalNotif = await WhatsAppNotification.findById(notif._id)
      expect(finalNotif?.status).toBe('read') // Kept as 'read'
    })
  })

  describe('Admin Endpoints & Custom Broadcasts', () => {
    it('provides status, lists upcoming and overdue, and executes custom campaign', async () => {
      const { agent, csrf } = await loginAgent(app, TEST_ADMIN.username, TEST_ADMIN.password)

      // 1. WhatsApp status reports Evolution provider information
      const statusRes = await agent.get('/api/admin/whatsapp/status').expect(200)
      expect(statusRes.body).toHaveProperty('provider', 'evolution')
      expect(statusRes.body).toHaveProperty('instanceName')
      expect(statusRes.body).toHaveProperty('connectionState')

      // Create test members
      await Member.create({
        memberId: 'RBF-0010',
        fullName: 'Broadcast Recipient 1',
        phone: '9876543218',
        planId: 'monthly',
        monthlyFeePaise: 100000,
        joiningDate: new Date('2026-08-01T00:00:00+05:30'),
        status: 'active',
      })
      await Member.create({
        memberId: 'RBF-0011',
        fullName: 'Broadcast Recipient 2',
        phone: '9876543219',
        planId: 'monthly',
        monthlyFeePaise: 100000,
        joiningDate: new Date('2026-08-01T00:00:00+05:30'),
        status: 'active',
      })

      // 2. Preview campaign recipients
      const previewRes = await agent
        .post('/api/admin/whatsapp/campaigns/preview')
        .set('x-csrf-token', csrf)
        .send({ recipientFilter: 'active' })
        .expect(200)

      expect(previewRes.body.recipientCount).toBe(2)

      // 3. Send campaign
      const sendRes = await agent
        .post('/api/admin/whatsapp/campaigns/send')
        .set('x-csrf-token', csrf)
        .send({
          name: 'Gym Holiday Announcement',
          message: 'The gym will remain closed on Diwali.',
          recipientFilter: 'active',
        })
        .expect(200)

      expect(sendRes.body.success).toBe(true)
      expect(sendRes.body.campaign.recipientCount).toBe(2)

      // 4. Check campaign list
      const campaignsRes = await agent.get('/api/admin/whatsapp/campaigns').expect(200)
      expect(campaignsRes.body.items).toHaveLength(1)
      expect(campaignsRes.body.items[0].name).toBe('Gym Holiday Announcement')

      // 5. Check history list
      const historyRes = await agent.get('/api/admin/whatsapp/history').expect(200)
      expect(historyRes.body.items.length).toBeGreaterThanOrEqual(2)
    })
  })

  describe('Reminders with New Plans (15 Days - ₹500, Monthly - ₹1,500, Monthly - ₹2,000)', () => {
    it('sends upcoming fee reminder for 15 Days – ₹500 with exact plan name and ₹500 fee', async () => {
      const now = new Date()
      const day2Date = new Date(`${istDay(2)}T00:00:00+05:30`)

      const member = await Member.create({
        memberId: 'RBF-0020',
        fullName: 'Vikram 15-Day',
        phone: '9876543220',
        planId: '15days-500',
        planName: '15 Days – ₹500',
        monthlyFeePaise: 50000,
        planDurationMonths: 0,
        planDurationDays: 15,
        joiningDate: new Date('2026-10-01T00:00:00+05:30'),
        status: 'active',
      })
      const payment = await MonthlyPayment.create({
        member: member._id,
        memberId: member.memberId,
        invoiceNumber: 'INV-TEST-0020',
        billingMonth: '2026-10',
        planId: '15days-500',
        planName: '15 Days – ₹500',
        durationDays: 15,
        dueDate: day2Date,
        dueAmountPaise: 50000,
        amountPaidPaise: 0,
        status: 'unpaid',
      })

      const upcoming = await whatsAppService.getUpcomingFeeDueMembers(now)
      const found = upcoming.find((u) => u.member.memberId === 'RBF-0020')
      expect(found).toBeDefined()
      expect(found?.payment.dueAmountPaise).toBe(50000)

      const notif = await whatsAppService.sendUpcomingDueReminder(member, payment, now)
      expect(notif).not.toBeNull()
      expect(notif?.message).toContain('₹500')
      expect(notif?.message).toContain('15 Days – ₹500')
    })

    it('sends overdue reminder for Monthly – ₹2,000 and stops when balance is paid', async () => {
      const now = new Date()
      const overdueDate = new Date(`${istDay(-3)}T00:00:00+05:30`)

      const member = await Member.create({
        memberId: 'RBF-0021',
        fullName: 'Anita 2000',
        phone: '9876543221',
        planId: 'monthly-2000',
        planName: 'Monthly – ₹2,000',
        monthlyFeePaise: 200000,
        planDurationMonths: 1,
        joiningDate: new Date('2026-08-01T00:00:00+05:30'),
        status: 'active',
      })
      const payment = await MonthlyPayment.create({
        member: member._id,
        memberId: member.memberId,
        invoiceNumber: 'INV-TEST-0021',
        billingMonth: '2026-09',
        planId: 'monthly-2000',
        planName: 'Monthly – ₹2,000',
        durationMonths: 1,
        dueDate: overdueDate,
        dueAmountPaise: 200000,
        amountPaidPaise: 0,
        status: 'unpaid',
      })

      // 1. Should be in overdue list
      let overdue = await whatsAppService.getOverdueMembers(now)
      let found = overdue.find((o) => o.member.memberId === 'RBF-0021')
      expect(found).toBeDefined()
      expect(found?.payment.dueAmountPaise).toBe(200000)

      // 2. Send reminder
      const notif = await whatsAppService.sendOverdueReminder(member, payment, now)
      expect(notif).not.toBeNull()
      expect(notif?.message).toContain('₹2,000')
      expect(notif?.message).toContain('Monthly – ₹2,000')

      // 3. Mark payment fully paid
      payment.amountPaidPaise = 200000
      payment.status = 'paid'
      await payment.save()

      // 4. Overdue check excludes paid bill
      overdue = await whatsAppService.getOverdueMembers(now)
      found = overdue.find((o) => o.member.memberId === 'RBF-0021')
      expect(found).toBeUndefined()
    })
  })
})
