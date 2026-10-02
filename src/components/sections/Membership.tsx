import { useState } from 'react'
import { Check, Snowflake, Sparkles } from 'lucide-react'
import { ANNUAL_DISCOUNT, plans } from '../../data/plans'
import { cn } from '../../lib/utils'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { SectionHeading } from '../ui/SectionHeading'
import { ScrollReveal } from '../animations/ScrollReveal'
import { useScrollTo } from '../../hooks/useScrollTo'

type Cycle = 'monthly' | 'annual'

function formatPrice(monthlyPrice: number, cycle: Cycle) {
  if (cycle === 'monthly') return monthlyPrice
  return Math.round(monthlyPrice * (1 - ANNUAL_DISCOUNT))
}

export function Membership() {
  const [cycle, setCycle] = useState<Cycle>('monthly')
  const scrollTo = useScrollTo()

  return (
    <section
      id="memberships"
      className="scroll-mt-[var(--nav-h)] py-20 sm:py-28"
    >
      <div className="section-shell">
        <SectionHeading
          eyebrow="Subscriptions / 03"
          title="Pick your output tier"
          description="Three access levels, one standard: instrumented training with no guesswork. Switch or pause from the app at any time."
          align="center"
          className="mx-auto items-center"
        />

        <div className="mt-10 flex justify-center">
          <div
            role="group"
            aria-label="Billing cycle"
            className="inline-flex items-center gap-1 rounded-full border border-hairline bg-card/80 p-1.5 backdrop-blur-[16px]"
          >
            {(['monthly', 'annual'] as Cycle[]).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setCycle(option)}
                aria-pressed={cycle === option}
                className={cn(
                  'flex min-h-[48px] items-center gap-2 rounded-full px-5 font-display text-xs font-semibold uppercase tracking-[0.14em] transition-colors',
                  cycle === option
                    ? 'bg-accent text-canvas'
                    : 'text-muted hover:text-white',
                )}
              >
                {option}
                {option === 'annual' ? (
                  <span
                    className={cn(
                      'font-mono text-[0.625rem] tracking-[0.1em]',
                      cycle === option ? 'text-canvas/70' : 'text-lime',
                    )}
                  >
                    Save 20%
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        </div>

        <ul className="mt-10 grid gap-5 md:grid-cols-3">
          {plans.map((plan, index) => {
            const price = formatPrice(plan.monthlyPrice, cycle)
            const isDayPass = plan.id === 'day'
            const suffix = isDayPass ? '/ day' : '/ mo'

            return (
              <ScrollReveal key={plan.id} direction="rise" delay={index * 0.08}>
                <Card
                  interactive
                  className={cn(
                    'flex h-full flex-col p-6 sm:p-7',
                    plan.featured &&
                      'border-accent/70 bg-card/90 shadow-glow-sm',
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-display text-lg font-bold uppercase tracking-[0.02em] text-white">
                      {plan.name}
                    </h3>
                    {plan.featured ? (
                      <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-accent px-3 py-1 font-mono text-[0.625rem] uppercase tracking-[0.14em] text-canvas">
                        <Sparkles className="h-3 w-3" aria-hidden="true" />
                        Most popular
                      </span>
                    ) : null}
                  </div>

                  <p className="mt-2 text-sm leading-relaxed text-muted">
                    {plan.blurb}
                  </p>

                  <p className="mt-6 flex items-baseline gap-1.5">
                    <span className="font-display text-4xl font-bold tracking-[-0.03em] text-white">
                      ${price}
                    </span>
                    <span className="font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-dim">
                      {cycle === 'annual' && !isDayPass ? '/ mo, billed annually' : suffix}
                    </span>
                  </p>

                  <ul className="mt-6 flex flex-1 flex-col gap-3">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-3">
                        <span
                          className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-lime/15"
                          aria-hidden="true"
                        >
                          <Check className="h-3.5 w-3.5 text-lime" />
                        </span>
                        <span className="text-sm leading-relaxed text-muted">
                          {feature}
                        </span>
                      </li>
                    ))}
                  </ul>

                  <Button
                    variant={plan.featured ? 'primary' : 'secondary'}
                    size="lg"
                    fullWidth
                    className="mt-7"
                    onClick={() => scrollTo('#trial-pass')}
                  >
                    {isDayPass ? 'Claim day pass' : 'Start membership'}
                  </Button>
                </Card>
              </ScrollReveal>
            )
          })}
        </ul>

        <p className="mt-6 flex items-center justify-center gap-2 text-center font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-dim">
          <Snowflake className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
          Recovery suite access included from the Athlete tier upward
        </p>
      </div>
    </section>
  )
}