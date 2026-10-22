/** Strips formatting, country code (91) and trunk prefix (0) from a phone number. */
export function normalizePhone(input: string): string {
  let digits = input.replace(/\D/g, '')
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2)
  if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1)
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
 * Converts any phone input (+91 98765 43210, 09876543210, 9876543210)
 * to Meta's expected recipient format: digits only with country code, no '+', e.g. "919876543210".
 * Returns null if the phone is not a valid 10-digit number.
 */
export function formatMetaPhone(input: string): string | null {
  const digits = normalizePhone(input)
  if (!isValidPhone(digits)) return null
  return `91${digits}`
}

