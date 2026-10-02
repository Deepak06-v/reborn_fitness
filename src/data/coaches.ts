import type { Coach } from '../types'

export const coaches: Coach[] = [
  {
    id: 'kovalenko',
    name: 'Dmytro Kovalenko',
    certifications: ['CSCS', 'IPF Level 3', 'UEFA B'],
    focus: 'Absolute strength & meet prep',
    image:
      'https://images.unsplash.com/photo-1567013127542-490d757e51fc?auto=format&fit=crop&w=900&q=80',
    bio: 'Two-time national platform champion running the heavy iron block. Sleds, low reps, long levers.',
  },
  {
    id: 'reyes',
    name: 'Alina Reyes',
    certifications: ['NSCA-CPT', 'Precision Nutrition L1'],
    focus: 'Metabolic conditioning & body comp',
    image:
      'https://images.unsplash.com/photo-1594381898411-846e7d193883?auto=format&fit=crop&w=900&q=80',
    bio: 'Engineers zone-2 volume and aerobic base work without wrecking your recovery.',
  },
  {
    id: 'osei',
    name: 'Kwabena Osei',
    certifications: ['USAW Level 2', 'CSCS'],
    focus: 'Olympic lifting & athletic power',
    image:
      'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?auto=format&fit=crop&w=900&q=80',
    bio: 'Former national-level hammer thrower. Bar speed first, everything else second.',
  },
  {
    id: 'tanaka',
    name: 'Mei Tanaka',
    certifications: ['NASM-CPT', 'FRCms'],
    focus: 'Hypertrophy & connective tissue',
    image:
      'https://images.unsplash.com/photo-1541530313592-79c0f3b6518d?auto=format&fit=crop&w=900&q=80',
    bio: 'Trauma-informed hypertrophy programming that respects your joints and your calendar.',
  },
]