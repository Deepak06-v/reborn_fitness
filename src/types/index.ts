export interface NavLink {
  label: string
  href: string
}

export interface GoalOption {
  id: string
  label: string
}

export interface DaySlot {
  id: string
  label: string
  detail: string
}

export interface BookingSelection {
  goalId: string
  dayId: string
  slotId: string
  name: string
  phone: string
  email: string
  wantsCoach: boolean
  coachId: string | null
}

export interface IssuedPass {
  bookingRef: string
  entryCode: string
  issuedAt: Date
  dayLabel: string
  slotLabel: string
  goalLabel: string
  guestName: string
  coachName: string | null
}

export interface Zone {
  id: string
  code: string
  name: string
  tagline: string
  image: string
  temperature: string
  capacity: string
  specs: string[]
}

export interface Plan {
  id: string
  name: string
  monthlyPrice: number
  blurb: string
  featured: boolean
  features: string[]
}

export interface Product {
  id: string
  name: string
  description: string
  price: number
  image: string
  limited: boolean
}

export interface CartItem {
  productId: string
  quantity: number
}

export interface Coach {
  id: string
  name: string
  certifications: string[]
  focus: string
  image: string
  bio: string
}

export interface FaqEntry {
  question: string
  answer: string
}

export interface LiveStat {
  id: string
  label: string
  value: string
  live: boolean
}