import { useEffect, useRef, useState } from 'react'
import { gsap } from 'gsap'
import { X, Instagram } from 'lucide-react'
import { brand, navLinks, social } from '../../data/site'
import { useScroll } from '../../context/ScrollContext'
import { useScrollTo } from '../../hooks/useScrollTo'
import { cn } from '../../lib/utils'

interface MobileNavDrawerProps {
  open: boolean
  onClose: () => void
}

const drawX = (open: boolean) => (open ? 0 : '-100%')

export function MobileNavDrawer({ open, onClose }: MobileNavDrawerProps) {
  const [mounted, setMounted] = useState(false)
  const [active, setActive] = useState(navLinks[0].href)
  const panelRef = useRef<HTMLDivElement>(null)
  const linkRefs = useRef<Array<HTMLAnchorElement | null>>([])
  const [lenis] = useScroll()
  const scrollTo = useScrollTo()

  useEffect(() => {
    if (open) setMounted(true)
  }, [open])

  useEffect(() => {
    if (!mounted) return

    const prefersReduced = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches

    const el = panelRef.current
    if (!el) return

    const ctx = gsap.context(() => {
      if (prefersReduced) {
        gsap.set(el, { xPercent: open ? 0 : -100 })
        gsap.set(linkRefs.current, { autoAlpha: open ? 1 : 0, y: open ? 0 : 18 })
        return
      }

      gsap.to(el, {
        xPercent: drawX(open),
        duration: 0.55,
        ease: 'expo.out',
        onComplete: () => {
          if (!open) setMounted(false)
        },
      })
      gsap.to(linkRefs.current, {
        autoAlpha: open ? 1 : 0,
        y: open ? 0 : 18,
        duration: 0.4,
        delay: open ? 0.2 : 0,
        stagger: open ? 0.06 : 0,
        ease: 'power3.out',
      })
    }, el)

    return () => ctx.revert()
  }, [open, mounted])

  // Scroll lock + keyboard escape + initial focus
  useEffect(() => {
    if (!open) return

    setActive(navLinks[0].href)
    const restore = document.activeElement as HTMLElement | null
    linkRefs.current[0]?.focus()

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)

    if (lenis) {
      lenis.stop()
    } else {
      document.body.style.overflow = 'hidden'
    }

    return () => {
      document.removeEventListener('keydown', onKey)
      if (lenis) {
        lenis.start()
      } else {
        document.body.style.overflow = ''
      }
      restore?.focus?.()
    }
  }, [open, lenis, onClose])

  if (!mounted) return null

  return (
    <div className="fixed inset-0 z-[110] lg:hidden">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Site navigation"
        className="absolute inset-0 bg-canvas/90 backdrop-blur-sm"
        onClick={onClose}
      />

      <div
        ref={panelRef}
        className={cn(
          'absolute inset-y-0 left-0 flex w-[86%] max-w-sm flex-col',
          'border-r border-accent/20 bg-surface/95 p-6 backdrop-blur-[16px]',
        )}
      >
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2.5">
            <img
              src="./logo.png"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = './logo.svg'
              }}
              alt="REBORN FITNESS"
              className="h-7 w-7 rounded-sm border border-hairline bg-surface p-0.5 object-contain"
            />
            <span className="font-display text-sm font-bold uppercase tracking-[0.16em] text-white">
              {brand.name}
            </span>
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation menu"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-hairline text-white transition-colors hover:border-accent/40"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <nav className="mt-10 flex flex-col gap-1" aria-label="Mobile">
          {navLinks.map((link, index) => (
            <a
              key={link.href}
              ref={(el) => {
                linkRefs.current[index] = el
              }}
              href={link.href}
              onClick={(event) => {
                event.preventDefault()
                scrollTo(link.href)
                onClose()
              }}
              className={cn(
                'flex min-h-[56px] items-center justify-between rounded px-3 font-display text-lg font-semibold uppercase tracking-[0.04em] transition-colors',
                active === link.href
                  ? 'bg-accent/10 text-accent'
                  : 'text-white hover:bg-white/5',
              )}
            >
              {link.label}
              <span className="font-mono text-[0.625rem] tracking-[0.2em] text-dim">
                0{index + 1}
              </span>
            </a>
          ))}
        </nav>

        <div className="rule my-6" />

        <div className="flex flex-col gap-3 text-sm">
          <a
            href={brand.phoneHref}
            className="font-mono text-[0.75rem] uppercase tracking-[0.14em] text-muted transition-colors hover:text-accent"
          >
            {brand.phoneDisplay}
          </a>
          <a
            href={brand.emailHref}
            className="font-mono text-[0.75rem] uppercase tracking-[0.14em] text-muted transition-colors hover:text-accent"
          >
            {brand.emailDisplay}
          </a>
          <a
            href={social.instagram.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 font-mono text-[0.75rem] uppercase tracking-[0.14em] text-muted transition-colors hover:text-accent"
          >
            <Instagram className="h-4 w-4" aria-hidden="true" />
            Follow Us on Instagram
          </a>
        </div>

        <p className="mt-auto flex items-center gap-2 font-mono text-[0.625rem] uppercase tracking-[0.16em] text-lime">
          <span className="telemetry-dot" aria-hidden="true" />
          {brand.statusLabel}
        </p>
      </div>
    </div>
  )
}