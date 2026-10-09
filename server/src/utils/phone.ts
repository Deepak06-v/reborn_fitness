/** Strips formatting, country code (91) and trunk prefix (0) from a phone number. */
export function normalizePhone(input: string): string {
  let digits = input.replace(/\D/g, '')
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2)
  if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1)
  return digits
}

export function isValidPhone(normalized: string): boolean {
  return /^\d{10,12}$/.test(normalized)
}
