import { env } from '../config/env'
import { reconcileAllBilling } from './billing'
import { whatsAppService } from './whatsapp/whatsapp.service'

export interface WhatsAppJobSummary {
  upcomingProcessed: number
  overdueProcessed: number
}

let isJobRunning = false

/**
 * Runs the daily WhatsApp reminders for upcoming fees (due in 2 days) and overdue fees.
 * Safe against race conditions and duplicates via atomic dedup keys.
 */
export async function runWhatsAppReminders(now: Date = new Date()): Promise<WhatsAppJobSummary> {
  if (isJobRunning) {
    return { upcomingProcessed: 0, overdueProcessed: 0 }
  }

  isJobRunning = true
  try {
    // 1. Reconcile billing so current period and due dates are up to date
    await reconcileAllBilling(now, { force: true }).catch((err) => {
      // eslint-disable-next-line no-console
      console.error('[whatsapp-scheduler] billing reconciliation failed before reminders:', err)
    })

    // 2. Process upcoming due (due in 2 days)
    const upcomingMembers = await whatsAppService.getUpcomingFeeDueMembers(now)
    let upcomingProcessed = 0
    for (const item of upcomingMembers) {
      try {
        await whatsAppService.sendUpcomingDueReminder(item.member, item.payment, now)
        upcomingProcessed += 1
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error(`[whatsapp-scheduler] Failed upcoming reminder for ${item.member.memberId}:`, err)
      }
    }

    // 3. Process overdue members (unpaid + overdue)
    const overdueMembers = await whatsAppService.getOverdueMembers(now)
    let overdueProcessed = 0
    for (const item of overdueMembers) {
      try {
        await whatsAppService.sendOverdueReminder(item.member, item.payment, now)
        overdueProcessed += 1
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error(`[whatsapp-scheduler] Failed overdue reminder for ${item.member.memberId}:`, err)
      }
    }

    return {
      upcomingProcessed,
      overdueProcessed,
    }
  } finally {
    isJobRunning = false
  }
}

let schedulerTimer: ReturnType<typeof setInterval> | null = null

/**
 * Starts the in-process WhatsApp notification scheduler.
 * Runs every hour to check whether the daily reminder cycle needs execution.
 * Deduplication in WhatsAppService ensures exactly 1 send per member per due date or day.
 */
export function startWhatsAppScheduler(intervalMinutes = 60): void {
  if (env.isTest || schedulerTimer) return

  // Run initial check
  runWhatsAppReminders(new Date()).catch((err) => {
    // eslint-disable-next-line no-console
    console.error('[whatsapp-scheduler] Initial run failed:', err)
  })

  schedulerTimer = setInterval(() => {
    runWhatsAppReminders(new Date()).catch((err) => {
      // eslint-disable-next-line no-console
      console.error('[whatsapp-scheduler] Recurring run failed:', err)
    })
  }, intervalMinutes * 60_000)

  if (typeof schedulerTimer.unref === 'function') {
    schedulerTimer.unref()
  }
}

export function stopWhatsAppScheduler(): void {
  if (schedulerTimer) {
    clearInterval(schedulerTimer)
    schedulerTimer = null
  }
}
