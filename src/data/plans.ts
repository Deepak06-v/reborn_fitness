import type { Plan } from '../types'

/**
 * The four real REBORN FITNESS membership offers.
 * All values are whole Indian Rupees (INR).
 */
export const plans: Plan[] = [
  {
    id: 'monthly',
    name: 'Monthly',
    duration: '1 month',
    regularPrice: 1000,
    offerPrice: 1000,
    featured: false,
    blurb: 'Full access for a single month — a low-commitment way to start.',
    features: ['1 month of full gym access', 'Start on any date'],
  },
  {
    id: 'three-months',
    name: '3 Months',
    duration: '3 months',
    regularPrice: 3000,
    offerPrice: 2700,
    saving: 300,
    featured: false,
    blurb: 'Three months of training with a discounted offer price.',
    features: ['3 months of full gym access', 'Save ₹300 on the offer price'],
  },
  {
    id: 'six-months',
    name: '6 Months',
    duration: '6 months',
    regularPrice: 6000,
    offerPrice: 5000,
    saving: 1000,
    featured: true,
    blurb: 'Our most popular package — half a year of consistent training.',
    features: ['6 months of full gym access', 'Save ₹1,000 on the offer price'],
  },
  {
    id: 'yearly',
    name: '1 Year',
    duration: '13 months total',
    regularPrice: 12000,
    offerPrice: 10000,
    saving: 2000,
    badge: '1 MONTH FREE',
    featured: false,
    blurb: 'A full year plus one bonus month free — the best overall value.',
    features: [
      '13 months of full gym access',
      'Includes 1 bonus month free',
      'Save ₹2,000 on the offer price',
    ],
  },
]
