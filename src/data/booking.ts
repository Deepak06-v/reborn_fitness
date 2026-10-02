import type { GoalOption, DaySlot } from '../types'

export const goals: GoalOption[] = [
  { id: 'strength', label: 'Strength / Powerlifting' },
  { id: 'conditioning', label: 'Biometric Conditioning' },
  { id: 'hypertrophy', label: 'Hypertrophy' },
  { id: 'recovery', label: 'Athletic Recovery' },
]

/** Fixed-window slots; the engine resolves the concrete date from the chosen day. */
export const daySlots: DaySlot[] = [
  { id: 'morning', label: 'Morning', detail: '05:00 – 11:00' },
  { id: 'evening', label: 'Evening', detail: '16:00 – 22:00' },
]

export const goalLabels: Record<string, string> = Object.fromEntries(
  goals.map((goal) => [goal.id, goal.label]),
)