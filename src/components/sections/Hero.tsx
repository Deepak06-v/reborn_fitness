import { useEffect, useState } from 'react'
import { Activity, ArrowRight, Radio, Snowflake, Waves } from 'lucide-react'
import { brand } from '../../data/site'
import { useScrollTo } from '../../hooks/useScrollTo'
import { LinkButton } from '../ui/Button'
import { StaggerText } from '../animations/StaggerText'
import { ScrollReveal } from '../animations/ScrollReveal'

const liveStats = [
  { id: 'occ', label: 'Live occupancy', icon: Activity, unit: '%' },
  { id: 'hypoxia', label: 'Atmospheric hypoxia', icon: Waves, unit: '' },
  { id: 'access', label: '24/7 biometric access', icon: Radio, unit: '' },
  { id: 'cryo', label: 'Cryo bay status', icon: Snowflake, unit: '' },
]

export function Hero() {
  const scrollTo = useScrollTo()
  const [occupancy, setOccupancy] = useState(34)

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
      {/* atmospheric telemetry backdrop */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 left-1/2 h-[38rem] w-[38rem] -translate-x-1/2 rounded-full bg-accent/10 blur-[140px]" />
        <div className="absolute bottom-0 right-0 h-[26rem] w-[26rem] rounded-full bg-lime/5 blur-[130px]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(39,39,42,0.35)_1px,transparent_1px),linear-gradient(90deg,rgba(39,39,42,0.35)_1px,transparent_1px)] bg-[size:72px_72px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_72%)]" />
      </div>

      <div className="section-shell relative w-full">
        <div className="flex flex-col gap-10">
          <ScrollReveal direction="fade" className="flex items-center gap-3">
            <span className="telemetry-dot" aria-hidden="true" />
            <p className="label-telemetry text-lime">
              {brand.statusLabel} · {brand.venueLine}
            </p>
          </ScrollReveal>

          <h1 className="display-xl max-w-[15ch]">
            <StaggerText lines={['REBORN YOUR', 'LIMITS']} />
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
                <div className="flex h-full min-h-[56px] items-center gap-3 rounded-full border border-hairline bg-card/80 px-4 backdrop-blur-[16px]">
                  <span
                    className={
                      stat.id === 'cryo'
                        ? 'flex h-8 w-8 items-center justify-center rounded-full bg-accent/10 text-accent'
                        : 'flex h-8 w-8 items-center justify-center rounded-full bg-lime/10 text-lime'
                    }
                  >
                    <stat.icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span className="flex flex-col">
                    <span className="font-mono text-[0.625rem] uppercase tracking-[0.16em] text-dim">
                      {stat.label}
                    </span>
                    <span className="font-mono text-[0.75rem] uppercase tracking-[0.12em] text-white">
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
              href="#trial-pass"
              size="lg"
              onClick={(event) => {
                event.preventDefault()
                scrollTo('#trial-pass')
              }}
            >
              Claim 1-Day VIP Pass
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </LinkButton>

            <LinkButton
              href="#facilities"
              size="lg"
              variant="secondary"
              onClick={(event) => {
                event.preventDefault()
                scrollTo('#facilities')
              }}
            >
              Explore Telemetry & Zones
            </LinkButton>
          </ScrollReveal>
        </div>
      </div>
    </section>
  )
}