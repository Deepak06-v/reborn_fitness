import type { WhatsAppTemplateComponent } from './whatsapp.types'

export const WHATSAPP_TEMPLATES = {
  FEE_DUE_2_DAYS: 'reborn_fee_due_reminder',
  FEE_OVERDUE: 'reborn_fee_overdue_reminder',
} as const

/**
 * Formats upcoming fee reminder message (2 days before due date).
 */
export function formatUpcomingDueMessage(params: {
  memberName: string
  planName: string
  dueDate: string
  amountDue: string
}): string {
  return `Hi ${params.memberName}, this is a friendly reminder from REBORN FITNESS. Your gym membership (${params.planName}) fee of ₹${params.amountDue} is due on ${params.dueDate}. Thank you!`
}

export const buildUpcomingDueFallbackText = formatUpcomingDueMessage

/**
 * Formats overdue fee reminder message.
 */
export function formatOverdueMessage(params: {
  memberName: string
  planName: string
  daysOverdue: number
  amountDue: string
}): string {
  return `Hi ${params.memberName}, your REBORN FITNESS membership fee of ₹${params.amountDue} (${params.planName}) is overdue by ${params.daysOverdue} day${params.daysOverdue === 1 ? '' : 's'}. Kindly complete your payment at the gym counter.`
}

export const buildOverdueFallbackText = formatOverdueMessage

/**
 * Formats gym closure announcement message.
 */
export function formatGymClosureMessage(params: {
  memberName: string
  reason: string
  dates: string
  reopenDate?: string
}): string {
  let msg = `Dear ${params.memberName}, REBORN FITNESS will remain closed on ${params.dates} due to ${params.reason}.`
  if (params.reopenDate) {
    msg += ` We will resume regular operations on ${params.reopenDate}.`
  }
  msg += ` Thank you for your understanding!`
  return msg
}

/**
 * Formats festival or promotional offer broadcast message.
 */
export function formatFestivalOfferMessage(params: {
  memberName: string
  occasion: string
  offerDetails: string
  validUntil: string
}): string {
  return `Happy ${params.occasion}, ${params.memberName}! Celebrate with REBORN FITNESS: ${params.offerDetails}. Offer valid until ${params.validUntil}. Visit the gym counter or contact us to claim!`
}

/**
 * Formats an arbitrary custom message broadcast.
 */
export function formatCustomMessage(params: {
  memberName?: string
  message: string
}): string {
  if (params.memberName) {
    return `Hi ${params.memberName},\n\n${params.message}\n\n— REBORN FITNESS`
  }
  return params.message
}

export function buildUpcomingDueTemplateComponents(params: {
  memberName: string
  planName: string
  dueDate: string
  amountDue: string
}): WhatsAppTemplateComponent[] {
  return [
    {
      type: 'body',
      parameters: [
        { type: 'text', text: params.memberName },
        { type: 'text', text: params.planName },
        { type: 'text', text: params.dueDate },
        { type: 'text', text: params.amountDue },
      ],
    },
  ]
}

export function buildOverdueTemplateComponents(params: {
  memberName: string
  planName: string
  daysOverdue: number
  amountDue: string
}): WhatsAppTemplateComponent[] {
  return [
    {
      type: 'body',
      parameters: [
        { type: 'text', text: params.memberName },
        { type: 'text', text: String(params.daysOverdue) },
        { type: 'text', text: params.planName },
        { type: 'text', text: params.amountDue },
      ],
    },
  ]
}
