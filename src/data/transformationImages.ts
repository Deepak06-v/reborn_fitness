/**
 * Real client transformation photographs shown in the endless "Real Results"
 * marquee (`src/components/sections/TransformationShowcase.tsx`).
 *
 * HOW TO ADD A PHOTO
 *   1. Save the file under `public/transformation/`.
 *   2. Add an entry below with the real public path, e.g.
 *      `{ src: '/transformation/name.jpeg', alt: '...' }`.
 *
 * Paths are stored exactly as they exist on disk (they may contain spaces and
 * parentheses). The showcase runs `encodeURI` over each `src` at render time, so
 * URLs are always resolved correctly without hand-encoding them here.
 *
 * `alt` should describe what is in the photo. `focalPoint` is optional and maps
 * to `object-position` for shots whose subject is off-centre.
 */
export interface TransformationPhoto {
  /** Public path, e.g. `/transformation/name.jpeg`. */
  src: string
  /** Descriptive alternative text for screen readers. */
  alt: string
  /** Optional `object-position`, e.g. `'50% 30%'`. */
  focalPoint?: string
}

const ALT = 'REBORN FITNESS transformation'

export const transformationPhotos: TransformationPhoto[] = [
  { src: '/transformation/WhatsApp Image 2026-10-10 at 09.46.10 (1).jpeg', alt: ALT },
  { src: '/transformation/WhatsApp Image 2026-10-10 at 09.46.10.jpeg', alt: ALT },
  { src: '/transformation/WhatsApp Image 2026-10-10 at 09.46.11 (1).jpeg', alt: ALT },
  { src: '/transformation/WhatsApp Image 2026-10-10 at 09.46.11.jpeg', alt: ALT },
  { src: '/transformation/WhatsApp Image 2026-10-10 at 09.46.12.jpeg', alt: ALT },
  { src: '/transformation/WhatsApp Image 2026-10-10 at 09.46.14 (1).jpeg', alt: ALT },
  { src: '/transformation/WhatsApp Image 2026-10-10 at 09.46.14 (2).jpeg', alt: ALT },
  { src: '/transformation/WhatsApp Image 2026-10-10 at 09.46.14.jpeg', alt: ALT },
]
