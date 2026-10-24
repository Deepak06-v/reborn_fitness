import { useEffect, useState } from 'react'
import { Activity, Instagram, MapPin, Phone, Radio, Snowflake, Waves } from 'lucide-react'
import { brand, social } from '../../data/site'
import { useScrollTo } from '../../hooks/useScrollTo'
import { LinkButton } from '../ui/Button'
import { StaggerText } from '../animations/StaggerText'
import { ScrollReveal } from '../animations/ScrollReveal'
import { cn } from '../../lib/utils'

/**
 * Quick-contact actions shown under the hero's "See Inside the Gym" button.
 * Instagram and Maps open in a new tab; Call uses the `tel:` protocol so mobile
 * devices launch the native dialler. All targets come from the site config —
 * nothing is hardcoded here.
 */
const quickContacts = [
  {
    href: social.instagram.url,
    label: 'Instagram',
    ariaLabel: 'Instagram',
    icon: Instagram,
    external: true,
  },
  {
    href: brand.phoneHref,
    label: 'Call',
    ariaLabel: 'Call the gym',
    icon: Phone,
    external: false,
  },
  {
    href: brand.mapsUrl,
    label: 'Maps',
    ariaLabel: 'Open location in Google Maps',
    icon: MapPin,
    external: true,
  },
] as const

const liveStats = [
  { id: 'occ', label: 'Live occupancy', icon: Activity, unit: '%' },
  { id: 'hypoxia', label: 'Atmospheric hypoxia', icon: Waves, unit: '' },
  { id: 'access', label: '24/7 biometric access', icon: Radio, unit: '' },
  { id: 'cryo', label: 'Cryo bay status', icon: Snowflake, unit: '' },
]

interface HeroProps {
  /** When true, the pre-loader has exited and the stagger reveal should fire. */
  preloaderDone?: boolean
}

export function Hero({ preloaderDone = true }: HeroProps) {
  const scrollTo = useScrollTo()
  const [occupancy, setOccupancy] = useState(34)
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 768 : false,
  )

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Simulated live telemetry feed so the banner reads as a live instrument
  useEffect(() => {
    const id = window.setInterval(() => {
      setOccupancy((current) => {
        const next = current + Math.round((Math.random() - 0.5) * 8)
        return Math.min(72, Math.max(18, next))
      })
    }, 3800)
    return () => window.clearInterval(id)
  }, [])

  return (
    <section
      id="top"
      className="relative flex min-h-[100svh] items-center overflow-hidden pb-16 pt-[calc(var(--nav-h)+3rem)]"
    >
      {/* ────────── Responsive Background Exercise Video (Single DOM Render) ────────── */}
      <video
        key={isMobile ? 'hero-mobile' : 'hero-desktop'}
        src={isMobile ? './exercise-bg-mobile.mp4' : './exercise-bg-desktop.mp4'}
        autoPlay
        loop
        muted
        playsInline
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full object-cover mix-blend-luminosity"
      />

      {/* Cinematic dark gradient mask over both videos */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#050505]/80 via-[#050505]/60 to-[#050505]"
      />

      {/* atmospheric telemetry backdrop (grid) */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(38,38,38,0.4)_1px,transparent_1px),linear-gradient(90deg,rgba(38,38,38,0.4)_1px,transparent_1px)] bg-[size:72px_72px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]" />
      </div>

      <div className="section-shell relative w-full">
        <div className="flex flex-col gap-10">
          <ScrollReveal direction="fade" className="flex items-center gap-3">
            <span className="telemetry-dot bg-accent" aria-hidden="true" />
            <p className="label-telemetry text-accent">
              {brand.statusLabel} · {brand.venueLine}
            </p>
          </ScrollReveal>

          <h1 className="display-xl max-w-[16ch] text-white">
            <span className="mb-3 block font-mono text-xs font-semibold uppercase tracking-[0.2em] text-accent sm:text-sm">
              Fitness and Strength Training in Hirekerur
            </span>
            {preloaderDone ? (
              <StaggerText lines={['REBORN YOUR', 'LIMITS']} />
            ) : (
              <span className="invisible">REBORN YOUR LIMITS</span>
            )}
          </h1>

          <ScrollReveal direction="rise" delay={0.1}>
            <p className="max-w-[46ch] text-base leading-relaxed text-muted sm:text-lg">
              {brand.subheading}
            </p>
          </ScrollReveal>

          {/* Live telemetry banner */}
          <ul
            className="-mx-5 flex snap-row gap-3 overflow-x-auto px-5 no-scrollbar sm:mx-0 sm:flex-wrap sm:px-0"
            aria-label="Live facility telemetry"
          >
            {liveStats.map((stat) => (
              <li key={stat.id} className="snap-item shrink-0">
                <div className="flex h-full min-h-[52px] items-center gap-3 rounded-md border border-hairline bg-surface px-4">
                  <span className="flex h-7 w-7 items-center justify-center rounded-sm bg-accent/15 text-accent">
                    <stat.icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span className="flex flex-col">
                    <span className="font-mono text-[0.625rem] uppercase tracking-[0.16em] text-dim">
                      {stat.label}
                    </span>
                    <span className="font-mono text-[0.75rem] font-bold uppercase tracking-[0.12em] text-white">
                      {stat.id === 'occ'
                        ? `${occupancy}${stat.unit}`
                        : stat.id === 'cryo'
                          ? '4 / 4 FREE'
                          : stat.id === 'hypoxia'
                            ? 'ACTIVE'
                            : 'ENABLED'}
                    </span>
                  </span>
                </div>
              </li>
            ))}
          </ul>

          <ScrollReveal
            direction="rise"
            delay={0.16}
            className="flex flex-col gap-3 sm:flex-row sm:items-center"
          >
            <LinkButton
              href="#facilities"
              size="lg"
              variant="secondary"
              onClick={(event) => {
                event.preventDefault()
                scrollTo('#facilities')
              }}
            >
              See Inside the Gym
            </LinkButton>
          </ScrollReveal>

          <ScrollReveal direction="rise" delay={0.2}>
            <ul className="flex flex-wrap items-center gap-2.5 sm:gap-3">
              {quickContacts.map((contact) => (
                <li key={contact.label}>
                  <a
                    href={contact.href}
                    aria-label={contact.ariaLabel}
                    {...(contact.external
                      ? { target: '_blank', rel: 'noopener noreferrer' }
                      : {})}
                    className={cn(
                      'group inline-flex min-h-[44px] items-center gap-2 rounded-md border border-hairline bg-surface px-3.5 font-display text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-muted transition-colors',
                      'hover:border-accent hover:text-white focus-visible:border-accent active:bg-accent/10',
                    )}
                  >
                    <contact.icon
                      className="h-4 w-4 text-accent transition-colors group-hover:text-accent"
                      aria-hidden="true"
                    />
                    {contact.label}
                  </a>
                </li>
              ))}
            </ul>
          </ScrollReveal>
        </div>
      </div>
    </section>
  )
}