import type { Plan } from '../types'

export const ANNUAL_DISCOUNT = 0.2

export const plans: Plan[] = [
  {
    id: 'day',
    name: 'Reborn Day Pass',
    monthlyPrice: 25,
    blurb: 'One full day of unrestricted floor access plus a recovery session.',
    featured: false,
    features: [
      'Full facility access for the day',
      'Locker and towel service included',
      'One cryo or compression recovery session',
      'Full telemetry dashboard access',
    ],
  },
  {
    id: 'athlete',
    name: 'Athlete Monthly',
    monthlyPrice: 89,
    blurb: 'The full biometric membership for consistent daily training.',
    featured: true,
    features: [
      '24/7 biometric key tag entry',
      'One guest pass every month',
      'Cryo and sauna access included',
      '1-on-1 monthly performance assessment',
      'Full app metrics sync',
    ],
  },
  {
    id: 'elite',
    name: 'Elite Performance',
    monthlyPrice: 149,
    blurb: 'Coached output and unlimited recovery for serious competitors.',
    featured: false,
    features: [
      'Everything in Athlete Monthly',
      'Unlimited cryo and infrared sauna',
      'Dedicated coach consultation monthly',
      'Priority class booking',
      'VIP locker and gear concierge',
    ],
  },
]