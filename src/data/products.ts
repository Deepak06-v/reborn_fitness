import type { Product } from '../types'

export const products: Product[] = [
  {
    id: 'hoodie',
    name: 'Reborn Oversized Heavyweight Hoodie',
    description: '420gsm loopback cotton, embroidered telemetry mark.',
    price: 75,
    image:
      'https://images.unsplash.com/photo-1556821840-3a63f95609a7?auto=format&fit=crop&w=900&q=80',
    limited: true,
  },
  {
    id: 'flask',
    name: 'Hydro-Pro Insulated Flask 1.2L',
    description: 'Vacuum-sealed steel, 24h cold, fits every rack cup holder.',
    price: 42,
    image:
      'https://images.unsplash.com/photo-1602143407151-7111542de6e8?auto=format&fit=crop&w=900&q=80',
    limited: true,
  },
  {
    id: 'fuel',
    name: 'Kinetic Pre-Workout / Intra-Fuel',
    description: 'Blood-flow and carbohydrate blend, 30 servings.',
    price: 55,
    image:
      'https://images.unsplash.com/photo-1593095948071-474c5cc2989d?auto=format&fit=crop&w=900&q=80',
    limited: false,
  },
  {
    id: 'straps',
    name: 'Heavy Grain Lifting Straps',
    description: 'Cut-and-stitched cowhide for heavy pulls.',
    price: 28,
    image:
      'https://images.unsplash.com/photo-1590487988256-9ed24133863e?auto=format&fit=crop&w=900&q=80',
    limited: false,
  },
]