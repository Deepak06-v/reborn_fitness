import { useState } from 'react'
import {
  AlertTriangle,
  Check,
  Copy,
  Instagram,
  Mail,
  MapPin,
  Phone,
  Radio,
  UserRound,
} from 'lucide-react'
import { brand, social, trainer } from '../../data/site'
import { Button, LinkButton } from '../ui/Button'
import { Card } from '../ui/Card'
import { SectionHeading } from '../ui/SectionHeading'
import { ScrollReveal } from '../animations/ScrollReveal'

type CopyState = 'idle' | 'copied' | 'error'

/** Legacy fallback for browsers/environments without the async Clipboard API. */
function fallbackCopy(value: string): boolean {
  try {
    const el = document.createElement('textarea')
    el.value = value
    el.setAttribute('readonly', '')
    el.style.position = 'fixed'
    el.style.top = '-9999px'
    el.style.opacity = '0'
    document.body.appendChild(el)
    el.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(el)
    return ok
  } catch {
    return false
  }
}

export function Contact() {
  const [copyState, setCopyState] = useState<CopyState>('idle')

  const copyAddress = async () => {
    const value = brand.address
    try {
      if (!navigator.clipboard?.writeText) throw new Error('clipboard-unavailable')
      await navigator.clipboard.writeText(value)
      setCopyState('copied')
      window.setTimeout(() => setCopyState('idle'), 2000)
    } catch {
      const ok = fallbackCopy(value)
      setCopyState(ok ? 'copied' : 'error')
      window.setTimeout(() => setCopyState('idle'), 3000)
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
          title="Visit or get in touch"
          description="Find us in Hirekerur, Karnataka, or reach Chandan directly by phone, email or Instagram to plan your first session."
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
                {brand.venueLine}
              </div>
            </Card>

            <Card className="flex flex-col gap-3 p-6">
              <p className="label-telemetry">Quick actions</p>

              <div className="flex items-center gap-3 rounded border border-hairline p-4">
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent"
                  aria-hidden="true"
                >
                  <UserRound className="h-5 w-5" />
                </span>
                <div>
                  <p className="label-telemetry">Trainer / Contact</p>
                  <p className="font-display text-sm font-semibold uppercase tracking-[0.06em] text-white">
                    {trainer.name}
                  </p>
                </div>
              </div>

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

                <LinkButton
                  href={social.instagram.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  variant="secondary"
                  size="md"
                  className="justify-start"
                >
                  <Instagram className="h-4 w-4 text-accent" aria-hidden="true" />
                  Follow Us on Instagram
                </LinkButton>
              </div>

              <a
                href={brand.mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Open ${brand.address} in Google Maps`}
                className="mt-2 flex items-start gap-3 rounded border border-hairline p-4 transition-colors hover:border-accent/50"
              >
                <MapPin
                  className="mt-0.5 h-4 w-4 shrink-0 text-accent"
                  aria-hidden="true"
                />
                <span className="flex-1 text-sm leading-relaxed text-muted underline-offset-4 transition-colors hover:text-white">
                  {brand.address}
                </span>
              </a>

              <Button
                variant="ghost"
                onClick={copyAddress}
                aria-label="Copy gym address to clipboard"
              >
                {copyState === 'copied' ? (
                  <Check className="h-4 w-4 text-lime" aria-hidden="true" />
                ) : copyState === 'error' ? (
                  <AlertTriangle className="h-4 w-4 text-red-300" aria-hidden="true" />
                ) : (
                  <Copy className="h-4 w-4" aria-hidden="true" />
                )}
                {copyState === 'copied'
                  ? 'Address copied'
                  : copyState === 'error'
                    ? 'Copy failed'
                    : 'Copy address'}
              </Button>

              <p
                role="status"
                aria-live="polite"
                className="min-h-[1rem] text-xs text-red-300"
              >
                {copyState === 'error'
                  ? 'Copying was blocked by your browser. Select the address above and copy it manually.'
                  : ''}
              </p>
            </Card>
          </div>

          {/* Google Maps Embed — full-colour, address-based */}
          <ScrollReveal direction="right" className="flex h-full flex-col gap-4">
            <div className="relative min-h-[20rem] flex-1 w-full overflow-hidden rounded-lg border border-hairline bg-card sm:min-h-[24rem] lg:min-h-[26rem]">
              <iframe
                src={brand.mapsEmbedUrl}
                className="absolute inset-0 h-full w-full"
                style={{ border: 0 }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title={`Google Maps — ${brand.address}`}
              />
            </div>
            <LinkButton
              href={brand.mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              variant="primary"
              size="lg"
              fullWidth
            >
              OPEN IN GOOGLE MAPS
            </LinkButton>
          </ScrollReveal>
        </div>
      </div>
    </section>
  )
}
