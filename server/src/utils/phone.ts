/** Strips formatting, country code (91) and trunk prefix (0) from a phone number. */
export function normalizePhone(input: string): string {
  let digits = input.replace(/\D/g, '')
  // Strip leading international double-zero if present
  if (digits.startsWith('00')) digits = digits.slice(2)
  // Strip duplicate or multiple leading 91 country-code prefixes until standard 10-digit length
  while (digits.length > 10 && digits.startsWith('91')) {
    digits = digits.slice(2)
  }
  // Strip trunk prefix '0' if 11 digits
  if (digits.length === 11 && digits.startsWith('0')) {
    digits = digits.slice(1)
  }
  return digits
}

export function isValidPhone(normalized: string): boolean {
  return /^\d{10}$/.test(normalized)
}

/** Validates that a 10-digit normalized number is a valid Indian mobile number (starts with 6-9). */
export function isValidIndianMobile(normalized: string): boolean {
  return /^[6-9]\d{9}$/.test(normalized)
}

/**
 * Converts any phone input (+91 98765 43210, 09876543210, 9876543210, +91 91 9876543210)
 * to Evolution API's expected recipient format: digits only with country code, no '+', e.g. "919876543210".
 * Returns null if the phone is not a valid 10-digit number.
 */
export function formatEvolutionPhone(input: string): string | null {
  const digits = normalizePhone(input)
  if (!isValidPhone(digits)) return null
  return `91${digits}`
}

export const formatWhatsAppPhone = formatEvolutionPhone

/** @deprecated Use formatEvolutionPhone or formatWhatsAppPhone */
export const formatMetaPhone = formatEvolutionPhone

