import { useEffect, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { consultation } from '../../data/site'
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion'
import { LinkButton } from '../ui/Button'
import { cn } from '../../lib/utils'

/**
 * Mobile-only floating consultation CTA.
 *
 * It stays hidden over the hero (so it never spoils the opening composition),
 * slides in once the hero has scrolled away, and steps aside when the footer is
 * reached (the footer carries its own contact actions, so a floating bar there
 * would just cover content). Both transitions are driven by IntersectionObserver
 * — no scroll listeners, no per-frame React state.
 *
 * Hidden at `md` and up; desktop/tablet use the in-flow `ConsultationCta`
 * section and the header action instead.
 */
export function MobileConsultationBar() {
  const reduced = usePrefersReducedMotion()
  const [pastHero, setPastHero] = useState(false)
  const [atFooter, setAtFooter] = useState(false)

  useEffect(() => {
    const hero = document.getElementById('top')
    const footer = document.querySelector('footer')

    const heroObserver = hero
      ? new IntersectionObserver(([entry]) => setPastHero(!entry.isIntersecting))
      : null
    const footerObserver = footer
      ? new IntersectionObserver(([entry]) => setAtFooter(entry.isIntersecting))
      : null

    if (hero && heroObserver) heroObserver.observe(hero)
    if (footer && footerObserver) footerObserver.observe(footer)

    return () => {
      heroObserver?.disconnect()
      footerObserver?.disconnect()
    }
  }, [])

  const visible = pastHero && !atFooter

  return (
    <div
      className={cn(
        'fixed inset-x-0 bottom-0 z-[80] md:hidden',
        'transition-[transform,opacity] ease-out-expo',
        reduced ? 'duration-0' : 'duration-300',
        visible
          ? 'translate-y-0 opacity-100'
          : 'pointer-events-none translate-y-[150%] opacity-0',
      )}
    >
      <div className="relative px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3">
        <LinkButton
          href={consultation.url}
          target="_blank"
          rel="noopener noreferrer"
          variant="lime"
          size="lg"
          fullWidth
          tabIndex={visible ? undefined : -1}
          aria-hidden={!visible}
          className="border-accent bg-accent font-bold text-canvas shadow-[0_16px_34px_-12px_rgba(0,0,0,0.8)]"
        >
          {consultation.label}
          <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
        </LinkButton>
      </div>
    </div>
  )
}
