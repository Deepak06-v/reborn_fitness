/**
 * All monetary values are stored and computed as integer paise (1 rupee = 100
 * paise) to avoid floating-point rounding errors in financial arithmetic.
 */

export function rupeesToPaise(rupees: number): number {
  return Math.round(rupees * 100)
}

export function paiseToRupees(paise: number): number {
  return paise / 100
}

const inrFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})

export function formatINR(paise: number): string {
  return inrFormatter.format(paise / 100)
}
