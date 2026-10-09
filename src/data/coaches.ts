import type { Coach } from '../types'

/**
 * Real staff only. REBORN FITNESS has one provided trainer / point of contact.
 * Do not add fictional coaches, certifications, or photographs of people who
 * are not confirmed staff.
 */
export const coaches: Coach[] = [
  {
    id: 'chandan',
    name: 'Chandan',
    role: 'Trainer & Gym Contact',
    focus: 'Training and membership guidance',
    image: '/trainer_chandan.jpeg',
    bio: 'Chandan is your point of contact at REBORN FITNESS. Reach out to plan your training, book a session, or ask about any of the membership plans.',
  },
]
