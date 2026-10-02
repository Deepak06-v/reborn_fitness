import { useState } from 'react'
import { Check, Copy, Mail, MapPin, Phone, Radio } from 'lucide-react'
import { brand } from '../../data/site'
import { cn } from '../../lib/utils'
import { Button, LinkButton } from '../ui/Button'
import { Card } from '../ui/Card'
import { SectionHeading } from '../ui/SectionHeading'
import { ScrollReveal } from '../animations/ScrollReveal'

export function Contact() {
  const [copied, setCopied] = useState(false)

  const copyAddress = async () => {
    try {
      await navigator.clipboard.writeText(brand.address)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  return (
    <section
      id="location"
      className="scroll-mt-[var(--nav-h)] border-t border-hairline bg-surface/30 py-20 sm:py-28"
    >
      <div className="section-shell">
        <SectionHeading
          eyebrow="Location / 06"
          title="Find the campus"
          description="Biometric entry is live around the clock. Call ahead if you want a guide waiting at the turnstile for your session."
        />

        <div className="mt-12 grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="flex flex-col gap-5">
            <Card interactive className="p-6">
              <p className="flex items-center gap-2.5 font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-lime">
                <span className="telemetry-dot" aria-hidden="true" />
                {brand.hoursLabel}
              </p>
              <div className="mt-4 flex items-center gap-2 font-mono text-[0.625rem] uppercase tracking-[0.16em] text-dim">
                <Radio className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
                Door telemetry reporting normal
              </div>
            </Card>

            <Card className="flex flex-col gap-3 p-6">
              <p className="label-telemetry">Quick actions</p>

              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
                <LinkButton
                  href={brand.phoneHref}
                  variant="secondary"
                  size="md"
                  className="justify-start"
                >
                  <Phone className="h-4 w-4" aria-hidden="true" />
                  {brand.phoneDisplay}
                </LinkButton>

                <LinkButton
                  href={brand.emailHref}
                  variant="secondary"
                  size="md"
                  className="justify-start"
                >
                  <Mail className="h-4 w-4" aria-hidden="true" />
                  {brand.emailDisplay}
                </LinkButton>
              </div>

              <div className="mt-2 flex items-start gap-3 rounded border border-hairline p-4">
                <MapPin
                  className="mt-0.5 h-4 w-4 shrink-0 text-accent"
                  aria-hidden="true"
                />
                <p className="flex-1 text-sm leading-relaxed text-muted">
                  {brand.address}
                </p>
              </div>

              <Button variant="ghost" onClick={copyAddress}>
                {copied ? (
                  <Check className="h-4 w-4 text-lime" aria-hidden="true" />
                ) : (
                  <Copy className="h-4 w-4" aria-hidden="true" />
                )}
                {copied ? 'Address copied' : 'Copy address'}
              </Button>
            </Card>
          </div>

          {/* Dark map container with glowing venue pin */}
          <ScrollReveal direction="right">
            <div className="relative h-full min-h-[22rem] overflow-hidden rounded-lg border border-hairline bg-surface">
              <img
                src="https://images.unsplash.com/photo-1552832230-c0197dd311b5?auto=format&fit=crop&w=1400&q=80"
                alt=""
                aria-hidden="true"
                loading="lazy"
                className="absolute inset-0 h-full w-full object-cover opacity-25 saturate-0"
              />
              <div
                aria-hidden="true"
                className="absolute inset-0 bg-[linear-gradient(rgba(39,39,42,0.5)_1px,transparent_1px),linear-gradient(90deg,rgba(39,39,42,0.5)_1px,transparent_1px)] bg-[size:56px_56px]"
              />
              <div
                aria-hidden="true"
                className="absolute inset-0 bg-gradient-to-t from-surface via-surface/60 to-surface/20"
              />

              <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 p-6">
                <span className="relative flex h-16 w-16 items-center justify-center">
                  <span
                    aria-hidden="true"
                    className="absolute inset-0 animate-dot-pulse rounded-full bg-accent/30 blur-lg"
                  />
                  <span
                    className="relative flex h-11 w-11 items-center justify-center rounded-full bg-canvas/80 ring-2 ring-accent"
                  >
                    <MapPin className="h-5 w-5 text-accent" aria-hidden="true" />
                  </span>
                </span>

                <div className="text-center">
                  <p className="font-display text-lg font-bold uppercase tracking-[0.06em] text-white">
                    {brand.name}
                  </p>
                  <p className="mt-1 font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-accent">
                    {brand.venueLine}
                  </p>
                  <p
                    className={cn(
                      'mt-3 max-w-xs font-mono text-[0.625rem] uppercase leading-relaxed tracking-[0.12em] text-dim',
                    )}
                  >
                    {brand.address}
                  </p>
                </div>

                <LinkButton
                  href={brand.mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  size="lg"
                >
                  Open in Google Maps
                </LinkButton>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </div>
    </section>
  )
}