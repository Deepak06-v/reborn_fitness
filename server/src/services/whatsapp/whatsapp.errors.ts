export class WhatsAppError extends Error {
  statusCode: number
  code: string
  details?: unknown

  constructor(message: string, statusCode = 500, code = 'WHATSAPP_ERROR', details?: unknown) {
    super(message)
    this.name = 'WhatsAppError'
    this.statusCode = statusCode
    this.code = code
    this.details = details
  }

  static notConfigured(
    message = 'WhatsApp integration is not configured. Please add Meta Cloud API credentials.',
  ): WhatsAppError {
    return new WhatsAppError(message, 503, 'WHATSAPP_NOT_CONFIGURED')
  }

  static invalidRecipient(message = 'Invalid recipient phone number'): WhatsAppError {
    return new WhatsAppError(message, 400, 'WHATSAPP_INVALID_RECIPIENT')
  }

  static signatureFailed(message = 'Invalid webhook signature'): WhatsAppError {
    return new WhatsAppError(message, 401, 'WHATSAPP_INVALID_SIGNATURE')
  }

  static templateNotConfigured(templateType: string): WhatsAppError {
    return new WhatsAppError(
      `Approved Meta WhatsApp template for "${templateType}" is not configured.`,
      400,
      'WHATSAPP_TEMPLATE_NOT_CONFIGURED',
    )
  }

  static invalidTemplateParameter(message: string): WhatsAppError {
    return new WhatsAppError(message, 400, 'WHATSAPP_INVALID_TEMPLATE_PARAM')
  }

  static rateLimitExceeded(message = 'Meta WhatsApp Graph API rate limit exceeded'): WhatsAppError {
    return new WhatsAppError(message, 429, 'WHATSAPP_RATE_LIMIT_EXCEEDED')
  }

  static authFailed(message = 'Meta WhatsApp API authentication failed'): WhatsAppError {
    return new WhatsAppError(message, 401, 'WHATSAPP_AUTH_FAILED')
  }
}
