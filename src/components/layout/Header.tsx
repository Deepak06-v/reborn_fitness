import { useEffect, useState } from 'react'
import type Lenis from 'lenis'
import { Menu, ShoppingBag } from 'lucide-react'
import { cn } from '../../lib/utils'
import { brand, navLinks } from '../../data/site'
import { useScroll } from '../../context/ScrollContext'
import { useCart } from '../../hooks/useCart'
import { useScrollTo } from '../../hooks/useScrollTo'
import { LinkButton } from '../ui/Button'

interface HeaderProps {
  onOpenMenu: () => void
}

export function Header({ onOpenMenu }: HeaderProps) {
  const [lenis] = useScroll()
  const [condensed, setCondensed] = useState(false)
  const [active, setActive] = useState<string>(navLinks[0].href)
  const { count, openCart } = useCart()
  const scrollTo = useScrollTo()

  useEffect(() => {
    if (!lenis) return
    const onScroll = (instance: Lenis) => {
      setCondensed(instance.scroll > 40)
    }
    lenis.on('scroll', onScroll)
    onScroll(lenis)
    return () => {
      lenis.off('scroll', onScroll)
    }
  }, [lenis])

  // Active-section tracking via IntersectionObserver (works with or without Lenis)
  useEffect(() => {
    const sections = navLinks
      .map((link) => document.querySelector(link.href))
      .filter((el): el is Element => !!el)
    if (!sections.length) return

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
        if (visible?.target.id) setActive(`#${visible.target.id}`)
      },
      { rootMargin: '-45% 0px -50% 0px', threshold: [0, 0.2, 0.6] },
    )

    sections.forEach((section) => observer.observe(section))
    return () => observer.disconnect()
  }, [])

  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-[90] h-[var(--nav-h)] transition-colors duration-300 ease-out-expo',
        condensed ? 'border-b border-hairline bg-canvas/80 backdrop-blur-[16px]' : 'bg-transparent',
      )}
    >
      <div className="section-shell flex h-full items-center justify-between gap-4">
        <a
          href="#top"
          onClick={(event) => {
            event.preventDefault()
            scrollTo('#top')
          }}
          className="flex items-center gap-2.5"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded bg-accent/15 ring-1 ring-accent/40">
            <span className="telemetry-dot" aria-hidden="true" />
          </span>
          <span className="font-display text-sm font-bold uppercase tracking-[0.16em] text-white">
            {brand.shortName}
          </span>
        </a>

        <nav className="hidden items-center gap-1 lg:flex" aria-label="Primary">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={(event) => {
                event.preventDefault()
                scrollTo(link.href)
              }}
              aria-current={active === link.href ? 'page' : undefined}
              className={cn(
                'rounded-full px-3 py-2 font-mono text-[0.6875rem] uppercase tracking-[0.16em] transition-colors',
                active === link.href
                  ? 'bg-accent/10 text-accent'
                  : 'text-muted hover:text-white',
              )}
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <span className="hidden items-center gap-2 rounded-full border border-lime/30 bg-lime/5 px-3 py-1.5 sm:inline-flex">
            <span className="telemetry-dot" aria-hidden="true" />
            <span className="font-mono text-[0.625rem] uppercase tracking-[0.16em] text-lime">
              {brand.statusLabel}
            </span>
          </span>

          <button
            type="button"
            onClick={openCart}
            aria-label={`Open cart, ${count} item${count === 1 ? '' : 's'}`}
            className="relative flex h-11 w-11 items-center justify-center rounded-full border border-hairline text-white transition-colors hover:border-accent/40"
          >
            <ShoppingBag className="h-5 w-5" aria-hidden="true" />
            {count > 0 ? (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 font-mono text-[0.625rem] font-semibold text-canvas">
                {count}
              </span>
            ) : null}
          </button>

          <LinkButton
            href="#trial-pass"
            size="sm"
            className="hidden md:inline-flex"
            onClick={(event) => {
              event.preventDefault()
              scrollTo('#trial-pass')
            }}
          >
            {brand.dayPassCta}
          </LinkButton>

          <button
            type="button"
            onClick={onOpenMenu}
            aria-label="Open navigation menu"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-hairline text-white transition-colors hover:border-accent/40 lg:hidden"
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      </div>
    </header>
  )
}