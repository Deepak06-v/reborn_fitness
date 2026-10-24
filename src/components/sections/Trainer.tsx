import { useEffect, useRef, useState, useCallback } from 'react'
import { Instagram } from 'lucide-react'
import { gsap } from 'gsap'
import { coaches } from '../../data/coaches'
import { trainerMedia } from '../../data/trainerMedia'
import { social } from '../../data/site'
import { LinkButton } from '../ui/Button'
import { Card } from '../ui/Card'
import { SectionHeading } from '../ui/SectionHeading'
import { ScrollReveal } from '../animations/ScrollReveal'
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion'

const AUTO_ADVANCE_MS = 5500

export function Trainer() {
  const coach = coaches[0]
  const reduced = usePrefersReducedMotion()
  const [activeIndex, setActiveIndex] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const trackRef = useRef<HTMLDivElement>(null)
  const sectionRef = useRef<HTMLElement>(null)
  const autoAdvanceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const total = trainerMedia.length
  const mediaItems = trainerMedia

  const clearAutoAdvance = useCallback(() => {
    if (autoAdvanceRef.current) {
      clearTimeout(autoAdvanceRef.current)
      autoAdvanceRef.current = null
    }
  }, [])

  const goToSlide = useCallback(
    (index: number) => {
      const nextIndex = (index + total) % total
      setActiveIndex(nextIndex)
      clearAutoAdvance()
    },
    [clearAutoAdvance, total],
  )

  const goToNext = useCallback(() => {
    goToSlide(activeIndex + 1)
  }, [activeIndex, goToSlide])

  const goToPrev = useCallback(() => {
    goToSlide(activeIndex - 1)
  }, [activeIndex, goToSlide])

  const scheduleAutoAdvance = useCallback(() => {
    if (reduced || isPaused || isDragging || total <= 1) {
      clearAutoAdvance()
      return
    }
    clearAutoAdvance()
    autoAdvanceRef.current = setTimeout(() => {
      setActiveIndex((prev) => (prev + 1) % total)
    }, AUTO_ADVANCE_MS)
  }, [clearAutoAdvance, isDragging, isPaused, reduced, total])

  useEffect(() => {
    scheduleAutoAdvance()
    return () => clearAutoAdvance()
  }, [activeIndex, isPaused, isDragging, reduced, total, scheduleAutoAdvance, clearAutoAdvance])

  useEffect(() => {
    if (!trackRef.current) return
    const track = trackRef.current
    const slideWidth = track.clientWidth
    if (reduced) {
      gsap.set(track, { x: 0 })
    } else {
      gsap.to(track, {
        x: -activeIndex * slideWidth,
        duration: 0.9,
        ease: 'power4.out',
      })
    }
  }, [activeIndex, reduced])

  useEffect(() => {
    if (!trackRef.current) return
    const track = trackRef.current
    const handleResize = () => {
      const slideWidth = track.clientWidth
      if (reduced) {
        gsap.set(track, { x: 0 })
      } else {
        gsap.set(track, { x: -activeIndex * slideWidth })
      }
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [activeIndex, reduced])

  useEffect(() => {
    if (reduced) return
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        setIsPaused(true)
      } else if (document.visibilityState === 'visible') {
        setIsPaused(false)
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [reduced])

  useEffect(() => {
    const track = trackRef.current
    if (!track) return
    let isDraggingLocal = false
    let startX = 0

    const handleTouchStart = (e: TouchEvent) => {
      isDraggingLocal = true
      setIsDragging(true)
      startX = e.touches[0].clientX
      clearAutoAdvance()
    }

    const handleTouchMove = (e: TouchEvent) => {
      if (!isDraggingLocal) return
      e.preventDefault()
      const currentX = e.touches[0].clientX
      const delta = currentX - startX
      const slideWidth = track.clientWidth
      const currentPos = -activeIndex * slideWidth
      gsap.set(track, { x: currentPos + delta })
    }

    const handleTouchEnd = (e: TouchEvent) => {
      if (!isDraggingLocal) return
      isDraggingLocal = false
      setIsDragging(false)
      const delta = e.changedTouches[0].clientX - startX
      const threshold = 50
      if (Math.abs(delta) > threshold) {
        if (delta < 0) {
          goToNext()
        } else {
          goToPrev()
        }
      } else {
        const slideWidth = track.clientWidth
        gsap.to(track, {
          x: -activeIndex * slideWidth,
          duration: 0.3,
          ease: 'power2.out',
        })
      }
    }

    track.addEventListener('touchstart', handleTouchStart, { passive: true })
    track.addEventListener('touchmove', handleTouchMove, { passive: false })
    track.addEventListener('touchend', handleTouchEnd)
    track.addEventListener('touchcancel', handleTouchEnd)

    return () => {
      track.removeEventListener('touchstart', handleTouchStart)
      track.removeEventListener('touchmove', handleTouchMove)
      track.removeEventListener('touchend', handleTouchEnd)
      track.removeEventListener('touchcancel', handleTouchEnd)
    }
  }, [activeIndex, clearAutoAdvance, goToNext, goToPrev])

  useEffect(() => {
    return () => {
      clearAutoAdvance()
    }
  }, [clearAutoAdvance])

  return (
    <section id="trainer" ref={sectionRef} className="scroll-mt-[var(--nav-h)] py-20 sm:py-28">
      <div className="section-shell">
        <SectionHeading
          eyebrow="Your Trainer / 05"
          title="Meet Your Trainer"
          description="REBORN FITNESS is run by Chandan, your point of contact for training, sessions and memberships."
        />

        <div className="mt-12 grid gap-6 lg:grid-cols-[minmax(0,0.32fr)_minmax(0,0.68fr)] lg:items-start lg:gap-8 xl:gap-10">
          <ScrollReveal direction="left" className="lg:self-start">
            <Card className="flex h-full flex-col gap-5 p-5 sm:p-6 lg:p-7">
              <div className="relative flex aspect-[4/5] w-full items-center justify-center overflow-hidden rounded border border-hairline bg-gradient-to-b from-accent/10 to-surface sm:mx-auto sm:max-w-[280px] lg:mx-0 lg:max-w-[320px]">
                {coach.image ? (
                  <img
                    src={coach.image}
                    alt={`${coach.name} - Fitness Trainer and Coach at REBORN FITNESS`}
                    loading="lazy"
                    className="absolute inset-0 h-full w-full object-contain"
                  />
                ) : (
                  <span className="flex flex-col items-center gap-2 p-4 text-center">
                    <span
                      className="font-display text-6xl font-bold leading-none text-accent"
                      aria-hidden="true"
                    >
                      {coach.name.charAt(0)}
                    </span>
                    <span className="font-mono text-[0.5625rem] uppercase tracking-[0.18em] text-dim">
                      Photo coming soon
                    </span>
                  </span>
                )}
              </div>

              <div className="flex flex-1 flex-col">
                <h3 className="font-display text-xl font-bold uppercase tracking-[0.04em] text-white">
                  {coach.name}
                </h3>
                <p className="mt-1 font-mono text-[0.625rem] uppercase tracking-[0.14em] text-accent">
                  {coach.role}
                </p>
                <p className="mt-2.5 text-sm leading-relaxed text-muted">
                  {coach.bio}
                </p>

                <div className="mt-auto flex flex-col gap-2 pt-5 sm:flex-row">
                  <LinkButton
                    href={social.instagram.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    variant="secondary"
                    fullWidth
                  >
                    <Instagram className="h-4 w-4 text-accent" aria-hidden="true" />
                    Instagram
                  </LinkButton>
                </div>
              </div>
            </Card>
          </ScrollReveal>

          <ScrollReveal direction="right" className="lg:self-start">
            <div
              className="group relative flex flex-col overflow-hidden rounded-md border border-hairline bg-surface"
              onMouseEnter={() => setIsPaused(true)}
              onMouseLeave={() => setIsPaused(false)}
              onFocus={() => setIsPaused(true)}
              onBlur={() => setIsPaused(false)}
            >
              <div className="relative aspect-[4/3] w-full overflow-hidden bg-black sm:aspect-[16/10] lg:aspect-[16/9]">
                <div ref={trackRef} className="flex h-full w-full will-change-transform">
                  {mediaItems.map((item, index) => (
                    <div
                      key={item.src + index}
                      className="relative h-full w-full shrink-0"
                      aria-hidden={index !== activeIndex}
                    >
                      {item.type === 'video' ? (
                        <video
                          src={item.src}
                          muted
                          playsInline
                          loop
                          autoPlay={!reduced}
                          className="absolute inset-0 h-full w-full object-contain"
                          ref={(el) => {
                            if (!el) return
                            if (index === activeIndex && !reduced) {
                              el.play().catch(() => {})
                            } else {
                              el.pause()
                            }
                          }}
                        />
                      ) : (
                        <img
                          src={item.src}
                          alt={item.alt}
                          loading={index < 2 ? 'eager' : 'lazy'}
                          decoding="async"
                          className="absolute inset-0 h-full w-full object-contain"
                          style={item.focalPoint ? { objectPosition: item.focalPoint } : undefined}
                        />
                      )}
                    </div>
                  ))}
                </div>

                {total > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={goToPrev}
                      className="absolute left-3 top-1/2 z-10 -translate-y-1/2 rounded-full border border-hairline bg-black/60 p-2 text-white shadow-sm transition-all hover:bg-black/80 focus:outline-none focus:ring-2 focus:ring-accent/70 focus:ring-offset-2 focus:ring-offset-canvas sm:left-4 sm:p-3"
                      aria-label="Previous trainer photo"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="h-4 w-4 sm:h-5 sm:w-5"
                      >
                        <path d="m15 18-6-6 6-6" />
                      </svg>
                    </button>

                    <button
                      type="button"
                      onClick={goToNext}
                      className="absolute right-3 top-1/2 z-10 -translate-y-1/2 rounded-full border border-hairline bg-black/60 p-2 text-white shadow-sm transition-all hover:bg-black/80 focus:outline-none focus:ring-2 focus:ring-accent/70 focus:ring-offset-2 focus:ring-offset-canvas sm:right-4 sm:p-3"
                      aria-label="Next trainer photo"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="h-4 w-4 sm:h-5 sm:w-5"
                      >
                        <path d="m9 18 6-6-6-6" />
                      </svg>
                    </button>
                  </>
                )}

                <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/70 via-black/40 to-transparent p-4 sm:p-5">
                  <div className="flex items-center justify-center gap-1.5 sm:gap-2">
                    {mediaItems.map((_, index) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => goToSlide(index)}
                        className={`h-1.5 rounded-full transition-all sm:h-2 ${
                          index === activeIndex
                            ? 'w-6 bg-accent sm:w-8'
                            : 'w-2 bg-white/40 hover:bg-white/60 sm:w-2.5'
                        }`}
                        aria-label={`Go to slide ${index + 1}`}
                        aria-current={index === activeIndex}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </div>
    </section>
  )
}
