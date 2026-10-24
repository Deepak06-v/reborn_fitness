import { ArrowRight, CalendarCheck, ShieldCheck, Timer } from 'lucide-react'
import { consultation } from '../../data/site'
import { LinkButton } from '../ui/Button'
import { ScrollReveal } from '../animations/ScrollReveal'

const reassurances = [
  { icon: Timer, label: 'Takes about 2 minutes' },
  { icon: CalendarCheck, label: 'Flexible timings' },
  { icon: ShieldCheck, label: 'No payment required' },
]

/**
 * The website's primary conversion block. Sits directly after the hero so it is
 * the first action a visitor can take once they understand what REBORN FITNESS
 * is. The highlight treatment mirrors the featured membership card / primary
 * button (accent border + hard offset shadow) so it reads as native to the site.
 */
export function ConsultationCta() {
  return (
    <section
      id="consultation"
      className="scroll-mt-[var(--nav-h)] border-t border-hairline bg-surface/30 py-16 sm:py-24"
    >
      <div className="section-shell">
        <ScrollReveal direction="rise">
          <div className="relative overflow-hidden rounded-lg border-2 border-accent bg-surface p-8 shadow-[6px_6px_0px_0px_#FFEE00] sm:p-12 lg:p-14">
            <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-accent/10 blur-3xl" aria-hidden="true" />

            <div className="relative flex flex-col items-center gap-6 text-center">
              <div className="flex items-center gap-3">
                <span className="h-px w-8 bg-accent/60" aria-hidden="true" />
                <p className="label-telemetry text-accent">Free Consultation</p>
                <span className="h-px w-8 bg-accent/60" aria-hidden="true" />
              </div>

              <h2 className="display-lg max-w-[20ch] text-balance">
                Free Fitness Consultation: Your First Step Is Free
              </h2>

              <p className="max-w-[52ch] text-sm leading-relaxed text-muted sm:text-base">
                {consultation.microcopy} Tell us your goals and we&apos;ll map out
                the right plan for you.
              </p>

              <LinkButton
                href={consultation.url}
                target="_blank"
                rel="noopener noreferrer"
                variant="lime"
                size="lg"
                className="group mt-1 w-full px-8 text-center shadow-[6px_6px_0px_0px_#FFEE00] sm:w-auto"
              >
                {consultation.label}
                <ArrowRight
                  className="h-4 w-4 transition-transform duration-200 ease-out-expo group-hover:translate-x-1"
                  aria-hidden="true"
                />
              </LinkButton>

              <ul className="mt-1 flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
                {reassurances.map((item) => (
                  <li
                    key={item.label}
                    className="flex items-center gap-2 font-mono text-[0.625rem] uppercase tracking-[0.14em] text-dim"
                  >
                    <item.icon className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
                    {item.label}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  )
}
