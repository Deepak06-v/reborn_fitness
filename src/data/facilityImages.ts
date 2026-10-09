/**
 * Real photographs of the Reborn Fitness facility used by the "Inside Reborn
 * Fitness" gallery (`src/components/sections/Zones.tsx`).
 *
 * HOW TO ADD A PHOTO
 *   1. Save the file under `public/` (the uploads currently live in
 *      `public/images/zones/zone-0X/`).
 *   2. Add an entry below with the real public path, e.g.
 *      `{ src: '/images/zones/zone-01/gym-03.jpeg', alt: '...' }`.
 *
 * `alt` should describe what is in the photo. `focalPoint` is optional and maps
 * to `object-position` for shots whose subject is off-centre.
 */
export interface FacilityPhoto {
  /** Public path, e.g. `/images/zones/zone-01/gym-01.jpeg`. */
  src: string
  /** Descriptive alternative text for screen readers. */
  alt: string
  /** Optional short caption, shown only when provided. */
  caption?: string
  /** Optional `object-position`, e.g. `'50% 30%'`. */
  focalPoint?: string
}

export const facilityPhotos: FacilityPhoto[] = [
  {
    src: '/images/zones/zone-01/gym-01.jpeg',
    alt: 'Inside Reborn Fitness',
  },
  {
    src: '/images/zones/zone-01/gym-02.jpeg',
    alt: 'Reborn Fitness training floor',
  },
  {
    src: '/images/zones/zone-02/gym-01.jpeg',
    alt: 'Reborn Fitness training area',
  },
  {
    src: '/images/zones/zone-03/gym-01.jpeg',
    alt: 'Reborn Fitness facility',
  },
  {
    src: '/images/zones/zone-04/gym-01.jpeg',
    alt: 'Reborn Fitness gym floor',
  },
]
