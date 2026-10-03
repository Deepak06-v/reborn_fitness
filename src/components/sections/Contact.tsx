import { useState } from 'react'
import { Check, Copy, Mail, MapPin, Phone, Radio } from 'lucide-react'
import { brand } from '../../data/site'
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

          {/* Google Maps Embed */}
          <ScrollReveal direction="right" className="flex h-full flex-col gap-4">
            <div className="relative flex-1 min-h-[22rem] w-full overflow-hidden rounded-lg border border-hairline bg-zinc-900">
              <iframe
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3153.835434509374!2d-122.4194155846816!3d37.77492957975903!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x8085809c6c8f4459%3A0xb10ed6d9b5050f14!2sSan%20Francisco%2C%20CA!5e0!3m2!1sen!2sus!4v1611111111111!5m2!1sen!2sus"
                className="absolute inset-0 h-full w-full opacity-80 mix-blend-luminosity invert grayscale contrast-125 hue-rotate-180"
                style={{ border: 0 }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title="Google Maps Location"
              />
            </div>
            <LinkButton
              href={brand.mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              size="lg"
              fullWidth
            >
              Open in Google Maps
            </LinkButton>
          </ScrollReveal>
        </div>
      </div>
    </section>
  )
}