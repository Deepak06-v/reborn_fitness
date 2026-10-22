import type { WhatsAppTemplateComponent } from './whatsapp.types'

export const WHATSAPP_TEMPLATES = {
  FEE_DUE_2_DAYS: 'reborn_fee_due_reminder',
  FEE_OVERDUE: 'reborn_fee_overdue_reminder',
} as const

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

export function buildUpcomingDueFallbackText(params: {
  memberName: string
  planName: string
  dueDate: string
  amountDue: string
}): string {
  return `Hi ${params.memberName}, this is a friendly reminder from REBORN FITNESS. Your gym membership (${params.planName}) fee of ₹${params.amountDue} is due on ${params.dueDate}. Thank you!`
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

export function buildOverdueFallbackText(params: {
  memberName: string
  planName: string
  daysOverdue: number
  amountDue: string
}): string {
  return `Hi ${params.memberName}, your REBORN FITNESS membership fee of ₹${params.amountDue} (${params.planName}) is overdue by ${params.daysOverdue} day${params.daysOverdue === 1 ? '' : 's'}. Kindly complete your payment at the gym counter.`
}
