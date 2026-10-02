import type { Zone } from '../types'

export const zones: Zone[] = [
  {
    id: 'iron',
    code: 'Z-01',
    name: 'Heavy Iron & Custom Racks',
    tagline: 'Competition-spec platforms under telemetry-lit ceilings.',
    image:
      'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=1200&q=80',
    temperature: '20.5°C',
    capacity: '12 athletes',
    specs: [
      'Eleiko competition plates & calibrated bars',
      'Custom monolitlifts and specialty racks',
      'Concentric and pin squat stations',
      'Westside power racks, 6 stations',
    ],
  },
  {
    id: 'telemetry',
    code: 'Z-02',
    name: 'Biometric Cardio Telemetry',
    tagline: 'Every rep streamed to your recovery baseline.',
    image:
      'https://images.unsplash.com/photo-1571902943202-507ec2618e8f?auto=format&fit=crop&w=1200&q=80',
    temperature: '21.0°C',
    capacity: '18 athletes',
    specs: [
      'Woodway 4Front treadmills with gait sensing',
      'AssaultBike and WattBike with live cadence display',
      'Heart-rate, power and lactate telemetry mirrors',
      'Zone-2 heart rate cap enforced on screens',
    ],
  },
  {
    id: 'recovery',
    code: 'Z-03',
    name: 'Cryo & Athletic Recovery',
    tagline: 'Contrast therapy stack for accelerated readiness.',
    image:
      'https://images.unsplash.com/photo-1591343395902-1adcb454c4e2?auto=format&fit=crop&w=1200&q=80',
    temperature: '6°C',
    capacity: '8 athletes',
    specs: [
      'Infrared sauna cabins with bench heating',
      'Cold plunge tanks held at 6°C',
      'Normatec compression boots, full sets',
      'Breathwork and HRV recovery lounge',
    ],
  },
  {
    id: 'kinetic',
    code: 'Z-04',
    name: 'Functional Kinetic Studio',
    tagline: 'Turf, sled, and rings for athletic output.',
    image:
      'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=1200&q=80',
    temperature: '22.0°C',
    capacity: '16 athletes',
    specs: [
      '60m indoor turf track with sprint gates',
      'Weighted and unweighted sled tracks',
      'Competition kettlebells, 8 – 32kg',
      'Gymnastic rings and pull-up rig wall',
    ],
  },
]