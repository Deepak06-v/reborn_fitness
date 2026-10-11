import { useState } from 'react'
import { facilityPhotos, type FacilityPhoto } from '../../data/facilityImages'
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion'
import { Marquee, MarqueePauseButton } from '../ui/Marquee'

export function Zones() {
  const reduced = usePrefersReducedMotion()
  const [userPaused, setUserPaused] = useState(false)

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
            <MarqueePauseButton
              paused={userPaused}
              onToggle={() => setUserPaused((value) => !value)}
              className="mb-1"
            />
          ) : null}
        </div>
      </div>

      {/* Full-bleed single strip. Clipped locally so the page never overflows. */}
      <div className="relative mt-10 overflow-hidden sm:mt-12">
        <Marquee
          items={facilityPhotos}
          reduced={reduced}
          animation="animate-marquee"
          minItems={8}
          paused={userPaused}
          ariaLabel="Inside Reborn Fitness gallery"
          getKey={(photo) => photo.src}
          renderItem={(photo, { duplicate, index }) => (
            <PhotoCard photo={photo} duplicate={duplicate} eager={index < 3} />
          )}
        />
      </div>
    </section>
  )
}

interface PhotoCardProps {
  photo: FacilityPhoto
  duplicate: boolean
  eager: boolean
}

function PhotoCard({ photo, duplicate, eager }: PhotoCardProps) {
  const [failed, setFailed] = useState(false)

  return (
    <figure
      aria-hidden={duplicate || undefined}
      className="m-0 w-[94vw] max-w-[23rem] shrink-0 px-1.5 sm:w-[27rem] sm:max-w-none sm:px-2 lg:w-[34rem]"
    >
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
            alt={duplicate ? '' : photo.alt}
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
