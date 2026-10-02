import { useState } from 'react'
import { Gauge, Thermometer, Users } from 'lucide-react'
import { zones } from '../../data/zones'
import { cn } from '../../lib/utils'
import { Card } from '../ui/Card'
import { SectionHeading } from '../ui/SectionHeading'
import { ScrollReveal } from '../animations/ScrollReveal'

export function Zones() {
  const [activeId, setActiveId] = useState(zones[0].id)
  const activeZone = zones.find((zone) => zone.id === activeId) ?? zones[0]

  return (
    <section
      id="facilities"
      className="scroll-mt-[var(--nav-h)] border-t border-hairline bg-surface/30 py-20 sm:py-28"
    >
      <div className="section-shell">
        <SectionHeading
          eyebrow="Facility Telemetry / 02"
          title="Four zones. One instrumented floor."
          description="Every rack, treadmill, plunge tank and turf lane is tracked against your recovery baseline. Tap a zone to read its load, climate and live spec sheet."
        />

        {/* Horizontal swipeable tab rail on mobile, wrapped row on desktop */}
        <div
          role="tablist"
          aria-label="Facility zones"
          className="-mx-5 mt-10 flex snap-row gap-2 overflow-x-auto px-5 pb-2 no-scrollbar sm:mx-0 sm:flex-wrap sm:px-0"
        >
          {zones.map((zone) => {
            const selected = zone.id === activeId
            return (
              <button
                key={zone.id}
                type="button"
                role="tab"
                id={`tab-${zone.id}`}
                aria-selected={selected}
                aria-controls={`panel-${zone.id}`}
                onClick={() => setActiveId(zone.id)}
                className={cn(
                  'snap-item flex min-h-[52px] shrink-0 items-center gap-2.5 rounded-full border px-5 transition-colors',
                  selected
                    ? 'border-accent/60 bg-accent/10 text-white'
                    : 'border-hairline text-muted hover:border-accent/40 hover:text-white',
                )}
              >
                <span
                  className={cn(
                    'font-mono text-[0.6875rem] tracking-[0.16em]',
                    selected ? 'text-accent' : 'text-dim',
                  )}
                >
                  {zone.code}
                </span>
                <span className="whitespace-nowrap font-display text-xs font-semibold uppercase tracking-[0.08em]">
                  {zone.name}
                </span>
              </button>
            )
          })}
        </div>

        <ScrollReveal
          key={activeZone.id}
          direction="rise"
          className="mt-8"
        >
          <Card
            role="tabpanel"
            id={`panel-${activeZone.id}`}
            aria-labelledby={`tab-${activeZone.id}`}
            className="overflow-hidden"
          >
            <div className="grid lg:grid-cols-2">
              <div className="relative aspect-[4/3] overflow-hidden lg:aspect-auto lg:min-h-[26rem]">
                <img
                  key={activeZone.image}
                  src={activeZone.image}
                  alt={activeZone.name}
                  loading="lazy"
                  className="absolute inset-0 h-full w-full object-cover opacity-70"
                />
                <div
                  aria-hidden="true"
                  className="absolute inset-0 bg-gradient-to-t from-card via-card/30 to-transparent lg:bg-gradient-to-r"
                />
                <span className="absolute left-5 top-5 rounded-full border border-accent/40 bg-canvas/70 px-3 py-1.5 font-mono text-[0.625rem] uppercase tracking-[0.16em] text-accent backdrop-blur-[16px]">
                  {activeZone.code}
                </span>
              </div>

              <div className="flex flex-col gap-6 p-6 sm:p-8">
                <div>
                  <h3 className="display-lg text-[1.75rem]">
                    {activeZone.name}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">
                    {activeZone.tagline}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Metric
                    icon={Thermometer}
                    label="Zone climate"
                    value={activeZone.temperature}
                  />
                  <Metric
                    icon={Users}
                    label="Live capacity"
                    value={activeZone.capacity}
                  />
                </div>

                <ul className="flex flex-col gap-3">
                  {activeZone.specs.map((spec) => (
                    <li
                      key={spec}
                      className="flex items-start gap-3 text-sm text-muted"
                    >
                      <span
                        className="mt-[0.55rem] h-1.5 w-1.5 shrink-0 rounded-full bg-accent"
                        aria-hidden="true"
                      />
                      {spec}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Card>
        </ScrollReveal>

        {/* Quick spec strip for every zone */}
        <div className="-mx-5 mt-4 flex snap-row gap-3 overflow-x-auto px-5 no-scrollbar sm:mx-0 sm:grid sm:grid-cols-2 sm:px-0 lg:grid-cols-4">
          {zones.map((zone) => (
            <ScrollReveal
              key={zone.id}
              direction="scale"
              as="article"
              className="snap-item shrink-0 sm:shrink"
            >
              <Card
                interactive
                onClick={() => setActiveId(zone.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    setActiveId(zone.id)
                  }
                }}
                role="button"
                tabIndex={0}
                aria-label={`Show ${zone.name} zone details`}
                className="w-[15rem] cursor-pointer p-5 sm:w-auto"
              >
                <span className="font-mono text-[0.625rem] uppercase tracking-[0.16em] text-dim">
                  {zone.code}
                </span>
                <h3 className="mt-2 font-display text-sm font-semibold uppercase tracking-[0.06em] text-white">
                  {zone.name}
                </h3>
                <p className="mt-2 flex items-center gap-2 font-mono text-[0.6875rem] uppercase tracking-[0.12em] text-accent">
                  <Gauge className="h-3.5 w-3.5" aria-hidden="true" />
                  {zone.capacity}
                </p>
              </Card>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  )
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Gauge
  label: string
  value: string
}) {
  return (
    <div className="rounded border border-hairline p-4">
      <span className="flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
        <span className="label-telemetry">{label}</span>
      </span>
      <span className="mt-2 block font-mono text-sm uppercase tracking-[0.1em] text-white">
        {value}
      </span>
    </div>
  )
}