import crypto from 'node:crypto'
import request from 'supertest'
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
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
import { MockWhatsAppProvider } from '../src/services/whatsapp/mock-whatsapp.provider'
import { formatMetaPhone, normalizePhone, isValidIndianMobile } from '../src/utils/phone'
import { runWhatsAppReminders } from '../src/services/whatsappScheduler'
import type { Express } from 'express'

describe('WhatsApp Notification Module', () => {
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
  })

  describe('Phone Normalization & Formatting', () => {
    it('normalizes various Indian phone formats to 10 digits', () => {
      expect(normalizePhone('+91 98765 43210')).toBe('9876543210')
      expect(normalizePhone('919876543210')).toBe('9876543210')
      expect(normalizePhone('09876543210')).toBe('9876543210')
      expect(normalizePhone('9876543210')).toBe('9876543210')
    })

    it('formats phone into Meta WhatsApp format (91XXXXXXXXXX)', () => {
      expect(formatMetaPhone('+91 98765-43210')).toBe('919876543210')
      expect(formatMetaPhone('09876543210')).toBe('919876543210')
      expect(formatMetaPhone('9876543210')).toBe('919876543210')
      expect(formatMetaPhone('12345')).toBeNull()
      expect(formatMetaPhone('abcdef')).toBeNull()
    })

    it('validates standard Indian mobile numbers', () => {
      expect(isValidIndianMobile('9876543210')).toBe(true)
      expect(isValidIndianMobile('8123456789')).toBe(true)
      expect(isValidIndianMobile('7123456789')).toBe(true)
      expect(isValidIndianMobile('6123456789')).toBe(true)
      expect(isValidIndianMobile('5123456789')).toBe(false)
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
        fullName: 'Akash Patel',
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
        fullName: 'Dedup Tester',
        phone: '9876543213',
        planId: 'monthly',
        planName: 'Monthly',
        monthlyFeePaise: 100000,
        joiningDate: new Date('2026-08-01T00:00:00+05:30'),
        status: 'active',
      })
      const payment = await MonthlyPayment.create({
        member: member._id,
        memberId: member.memberId,
        invoiceNumber: 'INV-TEST-0004',
        billingMonth: '2026-10',
        dueDate: day2Date,
        dueAmountPaise: 100000,
        amountPaidPaise: 0,
        status: 'unpaid',
      })

      // First run
      const notif1 = await whatsAppService.sendUpcomingDueReminder(member, payment, now)
      expect(notif1).not.toBeNull()
      expect(notif1?.status).toBe('sent')
      expect(mockProvider.sentMessages).toHaveLength(1)

      // Second run (simulating scheduler re-execution)
      const notif2 = await whatsAppService.sendUpcomingDueReminder(member, payment, now)
      expect(notif2?._id.toString()).toBe(notif1?._id.toString())
      expect(mockProvider.sentMessages).toHaveLength(1) // Still exactly 1!
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

      // Paid overdue date member (already paid)
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

    it('sends daily overdue reminder deduplicated per day, allowing next day', async () => {
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

  describe('Webhook Endpoint', () => {
    it('verifies GET webhook handshake with correct verify token', async () => {
      // Simulate configured verify token
      const oldToken = process.env.WHATSAPP_VERIFY_TOKEN
      process.env.WHATSAPP_VERIFY_TOKEN = 'my_test_secret_token'

      const resValid = await request(app)
        .get('/api/whatsapp/webhook')
        .query({
          'hub.mode': 'subscribe',
          'hub.verify_token': 'my_test_secret_token',
          'hub.challenge': '1158201444',
        })
        .expect(200)

      expect(resValid.text).toBe('1158201444')

      await request(app)
        .get('/api/whatsapp/webhook')
        .query({
          'hub.mode': 'subscribe',
          'hub.verify_token': 'wrong_token',
          'hub.challenge': '1158201444',
        })
        .expect(403)

      process.env.WHATSAPP_VERIFY_TOKEN = oldToken
    })

    it('updates notification status upon receiving webhook events (sent, delivered, read, failed)', async () => {
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
        messageId: 'wamid.HBgLMTE1ODI=',
        status: 'sent',
      })

      // 1. Delivered event
      const payloadDelivered = {
        object: 'whatsapp_business_account',
        entry: [
          {
            id: '123456789',
            changes: [
              {
                field: 'messages',
                value: {
                  messaging_product: 'whatsapp',
                  metadata: { display_phone_number: '123', phone_number_id: '456' },
                  statuses: [
                    {
                      id: 'wamid.HBgLMTE1ODI=',
                      status: 'delivered',
                      timestamp: '1729584000',
                      recipient_id: '919876543217',
                    },
                  ],
                },
              },
            ],
          },
        ],
      }

      await request(app).post('/api/whatsapp/webhook').send(payloadDelivered).expect(200)

      const updatedDelivered = await WhatsAppNotification.findById(notif._id)
      expect(updatedDelivered?.status).toBe('delivered')
      expect(updatedDelivered?.deliveredAt).not.toBeNull()

      // 2. Read event
      const payloadRead = {
        object: 'whatsapp_business_account',
        entry: [
          {
            id: '123456789',
            changes: [
              {
                field: 'messages',
                value: {
                  messaging_product: 'whatsapp',
                  metadata: { display_phone_number: '123', phone_number_id: '456' },
                  statuses: [
                    {
                      id: 'wamid.HBgLMTE1ODI=',
                      status: 'read',
                      timestamp: '1729584100',
                      recipient_id: '919876543217',
                    },
                  ],
                },
              },
            ],
          },
        ],
      }

      await request(app).post('/api/whatsapp/webhook').send(payloadRead).expect(200)

      const updatedRead = await WhatsAppNotification.findById(notif._id)
      expect(updatedRead?.status).toBe('read')
      expect(updatedRead?.readAt).not.toBeNull()
    })
  })

  describe('Admin Endpoints & Custom Broadcasts', () => {
    it('provides status, lists upcoming and overdue, and executes custom campaign', async () => {
      const { agent, csrf } = await loginAgent(app, TEST_ADMIN.username, TEST_ADMIN.password)

      // 1. WhatsApp status
      const statusRes = await agent.get('/api/admin/whatsapp/status').expect(200)
      expect(statusRes.body).toHaveProperty('isConfigured')

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
    })
  })
})
