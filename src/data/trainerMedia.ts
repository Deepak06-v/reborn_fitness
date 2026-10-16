/**
 * Trainer media assets from public/chandan/
 * All suitable photos/videos for the "Meet Your Trainer" carousel.
 * HEIC converted to browser-friendly formats. Graphics with heavy text excluded.
 */

export interface TrainerMediaItem {
  src: string
  alt: string
  type: 'image' | 'video'
  focalPoint?: string
}

export const trainerMedia: TrainerMediaItem[] = [
  { src: '/chandan/IMG_0247.JPEG', alt: 'Chandan at Reborn Fitness', type: 'image' },
  { src: '/chandan/IMG_0249.JPEG', alt: 'Chandan training at Reborn Fitness', type: 'image' },
  { src: '/chandan/IMG_0426.JPEG', alt: 'Chandan - Reborn Fitness trainer', type: 'image' },
  { src: '/chandan/IMG_0470.JPEG', alt: 'Reborn Fitness gym floor with Chandan', type: 'image' },
  { src: '/chandan/IMG_0513.JPEG', alt: 'Chandan training session', type: 'image' },
  { src: '/chandan/IMG_0534.JPEG', alt: 'Chandan training at Reborn Fitness', type: 'image' },
  { src: '/chandan/IMG_0742.JPEG', alt: 'Chandan - Trainer at Reborn Fitness', type: 'image' },
  { src: '/chandan/IMG_1439.JPEG', alt: 'Chandan with clients at Reborn Fitness', type: 'image' },
  { src: '/chandan/IMG_1467.JPEG', alt: 'Chandan training at Reborn Fitness', type: 'image' },
  { src: '/chandan/IMG_4711.MP4', alt: 'Chandan training video at Reborn Fitness', type: 'video' },
]
