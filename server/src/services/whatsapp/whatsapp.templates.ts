import { env } from '../../config/env'
import { WhatsAppError } from './whatsapp.errors'
import type { WhatsAppTemplateComponent } from './whatsapp.types'

export type WhatsAppTemplateType =
  | 'FEE_DUE_2_DAYS'
  | 'FEE_OVERDUE'
  | 'GYM_CLOSURE'
  | 'FESTIVE_OFFER'

export interface ApprovedTemplateConfig {
  templateName: string
  languageCode: string
}

/**
 * Retrieves the configured approved Meta template name and language code for a message type.
 * Throws a typed configuration error if the template name has not been configured.
 */
export function getApprovedTemplateConfig(type: WhatsAppTemplateType): ApprovedTemplateConfig {
  let templateName = ''
  let languageCode = 'en_US'

  switch (type) {
    case 'FEE_DUE_2_DAYS':
      templateName = env.WHATSAPP_TEMPLATE_FEE_DUE
      languageCode = env.WHATSAPP_TEMPLATE_FEE_DUE_LANG || 'en_US'
      break
    case 'FEE_OVERDUE':
      templateName = env.WHATSAPP_TEMPLATE_FEE_OVERDUE
      languageCode = env.WHATSAPP_TEMPLATE_FEE_OVERDUE_LANG || 'en_US'
      break
    case 'GYM_CLOSURE':
      templateName = env.WHATSAPP_TEMPLATE_GYM_CLOSURE
      languageCode = env.WHATSAPP_TEMPLATE_GYM_CLOSURE_LANG || 'en_US'
      break
    case 'FESTIVE_OFFER':
      templateName = env.WHATSAPP_TEMPLATE_FESTIVE_OFFER
      languageCode = env.WHATSAPP_TEMPLATE_FESTIVE_OFFER_LANG || 'en_US'
      break
    default:
      throw WhatsAppError.templateNotConfigured(String(type))
  }

  if (!templateName || templateName.trim() === '') {
    throw WhatsAppError.templateNotConfigured(type)
  }

  return {
    templateName: templateName.trim(),
    languageCode: languageCode.trim(),
  }
}

export const WHATSAPP_TEMPLATES = {
  FEE_DUE_2_DAYS: env.WHATSAPP_TEMPLATE_FEE_DUE || 'reborn_fee_due_reminder',
  FEE_OVERDUE: env.WHATSAPP_TEMPLATE_FEE_OVERDUE || 'reborn_fee_overdue_reminder',
  GYM_CLOSURE: env.WHATSAPP_TEMPLATE_GYM_CLOSURE || 'reborn_gym_closure',
  FESTIVE_OFFER: env.WHATSAPP_TEMPLATE_FESTIVE_OFFER || 'reborn_festive_offer',
} as const

/**
 * Formats upcoming fee reminder preview text (2 days before due date).
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
 * Formats overdue fee reminder preview text.
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
 * Formats gym closure announcement preview text.
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
 * Formats festival or promotional offer broadcast preview text.
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

/**
 * Builds Meta-compliant body component parameters for upcoming fee reminder.
 * Expected Meta placeholder mapping:
 * {{1}} = memberName
 * {{2}} = planName
 * {{3}} = dueDate
 * {{4}} = amountDue
 */
export function buildUpcomingDueTemplateComponents(params: {
  memberName: string
  planName: string
  dueDate: string
  amountDue: string
}): WhatsAppTemplateComponent[] {
  if (!params.memberName?.trim()) {
    throw WhatsAppError.invalidTemplateParameter('memberName is required for upcoming fee template')
  }
  if (!params.planName?.trim()) {
    throw WhatsAppError.invalidTemplateParameter('planName is required for upcoming fee template')
  }
  if (!params.dueDate?.trim()) {
    throw WhatsAppError.invalidTemplateParameter('dueDate is required for upcoming fee template')
  }
  if (!params.amountDue?.trim()) {
    throw WhatsAppError.invalidTemplateParameter('amountDue is required for upcoming fee template')
  }

  return [
    {
      type: 'body',
      parameters: [
        { type: 'text', text: params.memberName.trim() },
        { type: 'text', text: params.planName.trim() },
        { type: 'text', text: params.dueDate.trim() },
        { type: 'text', text: params.amountDue.trim() },
      ],
    },
  ]
}

/**
 * Builds Meta-compliant body component parameters for overdue fee reminder.
 * Expected Meta placeholder mapping:
 * {{1}} = memberName
 * {{2}} = daysOverdue
 * {{3}} = planName
 * {{4}} = amountDue
 */
export function buildOverdueTemplateComponents(params: {
  memberName: string
  planName: string
  daysOverdue: number
  amountDue: string
}): WhatsAppTemplateComponent[] {
  if (!params.memberName?.trim()) {
    throw WhatsAppError.invalidTemplateParameter('memberName is required for overdue fee template')
  }
  if (typeof params.daysOverdue !== 'number' || params.daysOverdue < 1) {
    throw WhatsAppError.invalidTemplateParameter('daysOverdue must be a positive integer')
  }
  if (!params.planName?.trim()) {
    throw WhatsAppError.invalidTemplateParameter('planName is required for overdue fee template')
  }
  if (!params.amountDue?.trim()) {
    throw WhatsAppError.invalidTemplateParameter('amountDue is required for overdue fee template')
  }

  return [
    {
      type: 'body',
      parameters: [
        { type: 'text', text: params.memberName.trim() },
        { type: 'text', text: String(Math.floor(params.daysOverdue)) },
        { type: 'text', text: params.planName.trim() },
        { type: 'text', text: params.amountDue.trim() },
      ],
    },
  ]
}

/**
 * Builds Meta-compliant body component parameters for gym closure announcements.
 * Expected Meta placeholder mapping:
 * {{1}} = memberName
 * {{2}} = reason
 * {{3}} = dates
 * {{4}} = reopenDate
 */
export function buildGymClosureTemplateComponents(params: {
  memberName: string
  reason: string
  dates: string
  reopenDate?: string
}): WhatsAppTemplateComponent[] {
  if (!params.memberName?.trim()) {
    throw WhatsAppError.invalidTemplateParameter('memberName is required for closure template')
  }
  if (!params.reason?.trim()) {
    throw WhatsAppError.invalidTemplateParameter('reason is required for closure template')
  }
  if (!params.dates?.trim()) {
    throw WhatsAppError.invalidTemplateParameter('dates is required for closure template')
  }

  return [
    {
      type: 'body',
      parameters: [
        { type: 'text', text: params.memberName.trim() },
        { type: 'text', text: params.reason.trim() },
        { type: 'text', text: params.dates.trim() },
        { type: 'text', text: (params.reopenDate || 'soon').trim() },
      ],
    },
  ]
}

/**
 * Builds Meta-compliant body component parameters for festive and promotional offers.
 * Expected Meta placeholder mapping:
 * {{1}} = memberName
 * {{2}} = occasion
 * {{3}} = offerDetails
 * {{4}} = validUntil
 */
export function buildFestiveOfferTemplateComponents(params: {
  memberName: string
  occasion: string
  offerDetails: string
  validUntil: string
}): WhatsAppTemplateComponent[] {
  if (!params.memberName?.trim()) {
    throw WhatsAppError.invalidTemplateParameter('memberName is required for festive template')
  }
  if (!params.occasion?.trim()) {
    throw WhatsAppError.invalidTemplateParameter('occasion is required for festive template')
  }
  if (!params.offerDetails?.trim()) {
    throw WhatsAppError.invalidTemplateParameter('offerDetails is required for festive template')
  }
  if (!params.validUntil?.trim()) {
    throw WhatsAppError.invalidTemplateParameter('validUntil is required for festive template')
  }

  return [
    {
      type: 'body',
      parameters: [
        { type: 'text', text: params.memberName.trim() },
        { type: 'text', text: params.occasion.trim() },
        { type: 'text', text: params.offerDetails.trim() },
        { type: 'text', text: params.validUntil.trim() },
      ],
    },
  ]
}
