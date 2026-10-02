import type { NavLink } from '../types'

export const brand = {
  name: 'REBORN FITNESS',
  shortName: 'REBORN',
  headline: 'REBORN YOUR LIMITS',
  subheading:
    'Precision strength, biometric recovery, and elite human performance engineering.',
  statusLabel: 'OPEN 24/7',
  venueLine: 'District 04 Performance Campus',
  address: '1280 Foundry Street, Bay 7, Austin, TX 78702',
  mapsQuery: '1280 Foundry Street, Austin, TX 78702',
  mapsUrl:
    'https://www.google.com/maps/search/?api=1&query=1280+Foundry+Street+Austin+TX+78702',
  phoneDisplay: '+1 (512) 555-0188',
  phoneHref: 'tel:+15125550188',
  emailDisplay: 'telemetry@rebornfitness.io',
  emailHref: 'mailto:telemetry@rebornfitness.io',
  hoursLabel: 'Open Now — 24/7 Biometric Entry',
  dayPassCta: 'Book 1-Day VIP Trial Pass',
} as const

export const navLinks: NavLink[] = [
  { label: 'Trial Pass', href: '#trial-pass' },
  { label: 'Facilities', href: '#facilities' },
  { label: 'Memberships', href: '#memberships' },
  { label: 'Shop', href: '#shop' },
  { label: 'Location', href: '#location' },
]