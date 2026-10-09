import { useEffect, useMemo, useRef, useState } from 'react'
import { Pause, Play } from 'lucide-react'
import { facilityPhotos, type FacilityPhoto } from '../../data/facilityImages'
import { cn } from '../../lib/utils'

/** One animated copy must repeat at least this many cards so it always exceeds the viewport. */
const COPY_MIN_ITEMS = 8
/** Start row two from a different photo so the two rows never look identical. */
const ROW_TWO_OFFSET = 2

function rotate<T>(items: T[], by: number): T[] {
  if (items.length === 0) return items
  const offset = ((by % items.length) + items.length) % items.length
  return [...items.slice(offset), ...items.slice(0, offset)]
}

/**
 * Build one seamless "copy" of the marquee track: the photos rotated by `offset`
 * and repeated until the copy is comfortably wider than any viewport. The track
 * renders this copy twice and animates `translateX(-50%)`, so the loop point
 * always lands exactly on the start of the second copy.
 */
function buildSequence(offset: number): FacilityPhoto[] {
  const rotated = rotate(facilityPhotos, offset)
  const reps = Math.max(1, Math.ceil(COPY_MIN_ITEMS / rotated.length))
  return Array.from({ length: reps }, () => rotated).flat()
}

export function Zones() {
  const [reduced, setReduced] = useState(false)
  const [userPaused, setUserPaused] = useState(false)
  const [interacting, setInteracting] = useState(false)
  const resumeTimer = useRef<number | undefined>(undefined)

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => setReduced(query.matches)
    sync()
    query.addEventListener('change', sync)
    return () => query.removeEventListener('change', sync)
  }, [])

  useEffect(
    () => () => {
      if (resumeTimer.current) window.clearTimeout(resumeTimer.current)
    },
    [],
  )

  const rowOne = useMemo(() => buildSequence(0), [])
  const rowTwo = useMemo(() => buildSequence(ROW_TWO_OFFSET), [])

  const paused = !reduced && (userPaused || interacting)

  const handleInteractStart = () => setInteracting(true)
  const handleInteractEnd = () => {
    if (resumeTimer.current) window.clearTimeout(resumeTimer.current)
    resumeTimer.current = window.setTimeout(() => setInteracting(false), 2200)
  }

  return (
    <section
      id="facilities"
      className="scroll-mt-[var(--nav-h)] border-t border-hairline bg-surface/30 py-20 sm:py-28"
    >
      <div className="section-shell">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <span className="h-px w-8 bg-accent/60" aria-hidden="true" />
              <p className="label-telemetry text-accent">Inside Reborn Fitness</p>
            </div>
            <h2 className="display-lg max-w-[20ch] text-balance">
              Built to move. Made to perform.
            </h2>
          </div>

          {!reduced ? (
            <button
              type="button"
              onClick={() => setUserPaused((value) => !value)}
              aria-pressed={userPaused}
              className="mb-1 inline-flex min-h-[48px] shrink-0 items-center gap-2 rounded-md border border-hairline bg-surface px-5 font-display text-xs font-semibold uppercase tracking-[0.14em] text-muted transition-colors hover:border-accent hover:text-white"
            >
              {userPaused ? (
                <Play className="h-4 w-4 text-accent" aria-hidden="true" />
              ) : (
                <Pause className="h-4 w-4 text-accent" aria-hidden="true" />
              )}
              {userPaused ? 'Play gallery' : 'Pause gallery'}
            </button>
          ) : null}
        </div>

        <div className="mt-10 flex flex-col gap-8 sm:gap-10">
          <MarqueeRow
            label="Row 01 · Moving left"
            photos={rowOne}
            reduced={reduced}
            paused={paused}
            variant="left"
            onInteractStart={handleInteractStart}
            onInteractEnd={handleInteractEnd}
          />
          <MarqueeRow
            label="Row 02 · Moving right"
            photos={rowTwo}
            reduced={reduced}
            paused={paused}
            variant="right"
            onInteractStart={handleInteractStart}
            onInteractEnd={handleInteractEnd}
            className="hidden md:block"
          />
        </div>
      </div>
    </section>
  )
}

interface MarqueeRowProps {
  label: string
  photos: FacilityPhoto[]
  reduced: boolean
  paused: boolean
  variant: 'left' | 'right'
  onInteractStart: () => void
  onInteractEnd: () => void
  className?: string
}

function MarqueeRow({
  label,
  photos,
  reduced,
  paused,
  variant,
  onInteractStart,
  onInteractEnd,
  className,
}: MarqueeRowProps) {
  // Animated rows duplicate the copy so `translateX(-50%)` loops seamlessly.
  // Reduced-motion rows render a single copy and scroll natively instead.
  const cards = reduced ? photos : [...photos, ...photos]

  return (
    <div className={cn(className)}>
      <p className="mb-3 font-mono text-[0.625rem] uppercase tracking-[0.2em] text-dim">
        {label}
      </p>

      <div
        className={cn(
          'gallery-row -mx-5 sm:-mx-8',
          reduced
            ? 'no-scrollbar touch-pan-x overflow-x-auto'
            : 'touch-pan-y overflow-hidden',
        )}
        onPointerDown={reduced ? undefined : onInteractStart}
        onPointerUp={reduced ? undefined : onInteractEnd}
        onPointerCancel={reduced ? undefined : onInteractEnd}
        onPointerLeave={reduced ? undefined : onInteractEnd}
      >
        <div
          className={cn(
            'flex w-max',
            !reduced && 'marquee-track will-change-transform',
            !reduced && variant === 'left' && 'animate-marquee',
            !reduced && variant === 'right' && 'animate-marquee-reverse',
            paused && 'is-paused',
          )}
        >
          {cards.map((photo, index) => (
            <PhotoCard
              key={`${variant}-${photo.src}-${index}`}
              photo={photo}
              eager={index < 3}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function PhotoCard({
  photo,
  eager,
}: {
  photo: FacilityPhoto
  eager: boolean
}) {
  const [failed, setFailed] = useState(false)

  return (
    <figure className="m-0 w-[85vw] max-w-[22rem] shrink-0 px-1.5 sm:w-[24rem] sm:max-w-none sm:px-2 lg:w-[30rem]">
      <div className="relative aspect-[4/3] overflow-hidden rounded-md border border-hairline bg-card-alt sm:aspect-[3/2]">
        {failed ? (
          <div className="absolute inset-0 flex items-center justify-center bg-[radial-gradient(120%_120%_at_50%_0%,rgb(var(--color-card-alt))_0%,rgb(var(--color-canvas))_70%)]">
            <span className="font-display text-[0.6875rem] font-semibold uppercase tracking-[0.24em] text-dim">
              Reborn Fitness
            </span>
          </div>
        ) : (
          <img
            src={photo.src}
            alt={photo.alt}
            loading={eager ? 'eager' : 'lazy'}
            decoding="async"
            onError={() => setFailed(true)}
            style={photo.focalPoint ? { objectPosition: photo.focalPoint } : undefined}
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}

        {photo.caption && !failed ? (
          <figcaption className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-canvas/85 to-transparent p-4 font-mono text-[0.625rem] uppercase tracking-[0.16em] text-white/90">
            {photo.caption}
          </figcaption>
        ) : null}
      </div>
    </figure>
  )
}
