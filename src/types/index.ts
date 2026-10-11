export interface NavLink {
  label: string
  href: string
}

export interface Plan {
  id: string
  name: string
  /** Human-readable plan duration, e.g. "3 months" or "13 months total". */
  duration: string
  /** Regular (undiscounted) price in whole INR. */
  regularPrice: number
  /** Offer price in whole INR (equals regularPrice when there is no discount). */
  offerPrice: number
  /** Amount saved in whole INR versus the regular price; omit when not discounted. */
  saving?: number
  /** Optional promotional label, e.g. "1 MONTH FREE". */
  badge?: string
  blurb: string
  featured: boolean
  features: string[]
}

export interface Coach {
  id: string
  name: string
  role: string
  focus: string
  /** Optional real photograph. When absent the UI renders a branded placeholder. */
  image?: string
  bio: string
  certifications?: string[]
}

export interface LiveStat {
  id: string
  label: string
  value: string
  live: boolean
}