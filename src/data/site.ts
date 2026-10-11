import type { NavLink } from '../types'

/** Single source of truth for the gym's physical address. */
const address = 'Mulgund complex, Chikkerur road, Hirekerur, Karnataka 581111'
const mapsQuery = address
const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapsQuery)}`
const mapsEmbedUrl = `https://maps.google.com/maps?q=${encodeURIComponent(mapsQuery)}&output=embed`

/** Reality-check flag: supplied email had an obvious domain typo, corrected here. */
export const emailNeedsVerification = true

export const brand = {
  name: 'REBORN FITNESS',
  shortName: 'REBORN',
  headline: 'REBORN YOUR LIMITS',
  subheading:
    'Strength training and personal coaching at the heart of Hirekerur, Karnataka.',
  statusLabel: 'OPEN 24/7',
  venueLine: 'Hirekerur, Karnataka',
  address,
  mapsQuery,
  mapsUrl,
  mapsEmbedUrl,
  phoneDisplay: '+91 8277568550',
  phoneHref: 'tel:+918277568550',
  emailDisplay: 'Chandankumar143chandu@gmail.com',
  emailHref: 'mailto:Chandankumar143chandu@gmail.com',
  hoursLabel: 'OPEN NOW — 24/7 ACCESS',
} as const

/**
 * The site's primary conversion action. Consultation is handled entirely by an
 * external Google Forms responder link — there is no backend or custom form.
 */
export const consultation = {
  label: 'Book Your Free Consultation',
  microcopy: 'Start your fitness journey with a free consultation.',
  url: 'https://docs.google.com/forms/d/e/1FAIpQLSf5smvwwt0vaWPdyVkrsWwP5WulREMaxzDeEI8FOzrICunkPQ/viewform',
} as const

/** The real trainer / point of contact for the gym. */
export const trainer = {
  name: 'Chandan',
  role: 'Trainer & Gym Contact',
} as const

/**
 * Verified social profiles only. Do not add placeholder or unverified accounts —
 * the public site links exclusively to destinations listed here.
 */
export const social = {
  instagram: {
    label: 'Instagram',
    handle: '@rebornfitness.india',
    url: 'https://www.instagram.com/rebornfitness.india/',
  },
} as const

export const navLinks: NavLink[] = [
  { label: 'Facilities', href: '#facilities' },
  { label: '3D Tour', href: '#gym-tour' },
  { label: 'Memberships', href: '#memberships' },
  { label: 'Location', href: '#location' },
]
