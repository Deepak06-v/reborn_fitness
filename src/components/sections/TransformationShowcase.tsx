import { useState } from 'react'
import { ArrowRight } from 'lucide-react'
import {
  transformationPhotos,
  type TransformationPhoto,
} from '../../data/transformationImages'
import { consultation } from '../../data/site'
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion'
import { Marquee, MarqueePauseButton } from '../ui/Marquee'
import { LinkButton } from '../ui/Button'
import { SectionHeading } from '../ui/SectionHeading'
import { ScrollReveal } from '../animations/ScrollReveal'

export function TransformationShowcase() {
  const reduced = usePrefersReducedMotion()
  const [userPaused, setUserPaused] = useState(false)

  // Nothing to showcase yet — fail quietly rather than render an empty strip.
  if (transformationPhotos.length === 0) return null

  return (
    <section
      id="transformations"
      className="scroll-mt-[var(--nav-h)] border-t border-hairline py-20 sm:py-28"
    >
      <div className="section-shell">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <SectionHeading
            eyebrow="Real Results"
            title="Your Transformation Starts Here."
            description="Every transformation starts with a decision. Tell us your goal and take the first step with a free consultation."
          />

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
          items={transformationPhotos}
          reduced={reduced}
          animation="animate-marquee-reverse"
          minItems={12}
          paused={userPaused}
          ariaLabel="Client transformations"
          getKey={(photo) => photo.src}
          renderItem={(photo, { duplicate, index }) => (
            <TransformationCard
              photo={photo}
              duplicate={duplicate}
              eager={index < 8}
            />
          )}
        />
      </div>

      <div className="section-shell mt-12 sm:mt-16">
        <div className="flex flex-col items-center gap-5 text-center">
          <ScrollReveal direction="rise">
            <p className="max-w-[46ch] text-sm leading-relaxed text-muted sm:text-base">
              See what&apos;s possible when you train with purpose.
            </p>
          </ScrollReveal>

          <ScrollReveal direction="rise" delay={0.08}>
            <LinkButton
              href={consultation.url}
              target="_blank"
              rel="noopener noreferrer"
              variant="secondary"
              size="lg"
              className="group"
            >
              {consultation.label}
              <ArrowRight
                className="h-4 w-4 transition-transform duration-200 ease-out-expo group-hover:translate-x-1"
                aria-hidden="true"
              />
            </LinkButton>
          </ScrollReveal>
        </div>
      </div>
    </section>
  )
}

interface TransformationCardProps {
  photo: TransformationPhoto
  duplicate: boolean
  eager: boolean
}

function TransformationCard({
  photo,
  duplicate,
  eager,
}: TransformationCardProps) {
  const [failed, setFailed] = useState(false)

  return (
    <figure
      aria-hidden={duplicate || undefined}
      className="m-0 w-[10.5rem] shrink-0 px-1.5 sm:w-[13.5rem] sm:px-2 lg:w-[15.5rem]"
    >
      <div className="relative aspect-[3/4] overflow-hidden rounded-md border border-hairline bg-card-alt shadow-lift">
        {failed ? (
          <div className="absolute inset-0 flex items-center justify-center bg-[radial-gradient(120%_120%_at_50%_0%,rgb(var(--color-card-alt))_0%,rgb(var(--color-canvas))_70%)]">
            <span className="font-display text-[0.625rem] font-semibold uppercase tracking-[0.24em] text-dim">
              Reborn Fitness
            </span>
          </div>
        ) : (
          <img
            src={encodeURI(photo.src)}
            alt={duplicate ? '' : photo.alt}
            loading={eager ? 'eager' : 'lazy'}
            decoding="async"
            onError={() => setFailed(true)}
            style={photo.focalPoint ? { objectPosition: photo.focalPoint } : undefined}
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}
      </div>
    </figure>
  )
}
