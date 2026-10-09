import { Check, Gift, Instagram, Sparkles, Tag } from 'lucide-react'
import type { Plan } from '../../types'
import { plans } from '../../data/plans'
import { brand, social } from '../../data/site'
import { cn } from '../../lib/utils'
import { LinkButton } from '../ui/Button'
import { Card } from '../ui/Card'
import { SectionHeading } from '../ui/SectionHeading'
import { ScrollReveal } from '../animations/ScrollReveal'

function inr(value: number) {
  return `₹${value.toLocaleString('en-IN')}`
}

/**
 * Honest enquiry link: opens the member's mail client pre-filled with the plan
 * they are asking about. No payment is taken on the website.
 */
function enquiryHref(plan: Plan) {
  const priceLine = plan.saving
    ? `Offer price ${inr(plan.offerPrice)} (regular ${inr(
        plan.regularPrice,
      )}, save ${inr(plan.saving)}), duration ${plan.duration}.`
    : `Price ${inr(plan.offerPrice)}, duration ${plan.duration}.`
  const subject = `Membership enquiry: ${plan.name}`
  const body = `Hi Chandan,\n\nI'm interested in the ${plan.name} plan. ${priceLine}\n\nPlease share the next steps to join.\n\nThanks!`
  return `${brand.emailHref}?subject=${encodeURIComponent(
    subject,
  )}&body=${encodeURIComponent(body)}`
}

export function Membership() {
  return (
    <section id="memberships" className="scroll-mt-[var(--nav-h)] py-20 sm:py-28">
      <div className="section-shell">
        <SectionHeading
          eyebrow="Memberships / 03"
          title="Simple membership plans"
          description="Four straightforward packages with clear pricing in Indian Rupees. Longer plans include a genuine discount — ask us about any of them."
          align="center"
          className="mx-auto items-center"
        />

        <ul className="mt-10 grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
          {plans.map((plan, index) => (
            <ScrollReveal key={plan.id} direction="rise" delay={index * 0.08}>
              <Card
                interactive
                className={cn(
                  'flex h-full flex-col p-6 transition-all sm:p-7',
                  plan.featured &&
                    'border-2 border-accent bg-surface shadow-[4px_4px_0px_0px_#FFEE00]',
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-display text-lg font-bold uppercase tracking-[0.02em] text-white">
                    {plan.name}
                  </h3>
                  <span className="shrink-0 rounded-sm border border-hairline px-2.5 py-1 font-mono text-[0.625rem] uppercase tracking-[0.12em] text-muted">
                    {plan.duration}
                  </span>
                </div>

                {plan.featured || plan.badge ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {plan.featured ? (
                      <span className="flex items-center gap-1.5 rounded-sm bg-accent px-3 py-1 font-mono text-[0.625rem] font-bold uppercase tracking-[0.14em] text-canvas">
                        <Sparkles className="h-3 w-3 fill-canvas" aria-hidden="true" />
                        Most popular
                      </span>
                    ) : null}
                    {plan.badge ? (
                      <span className="flex items-center gap-1.5 rounded-sm border border-accent/50 px-3 py-1 font-mono text-[0.625rem] font-bold uppercase tracking-[0.14em] text-accent">
                        <Gift className="h-3 w-3" aria-hidden="true" />
                        {plan.badge}
                      </span>
                    ) : null}
                  </div>
                ) : null}

                <p className="mt-3 text-sm leading-relaxed text-muted">
                  {plan.blurb}
                </p>

                <div className="mt-6">
                  <p className="flex items-baseline gap-1.5">
                    <span className="font-display text-4xl font-bold tracking-[-0.03em] text-white">
                      {inr(plan.offerPrice)}
                    </span>
                    <span className="font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-dim">
                      / {plan.duration}
                    </span>
                  </p>

                  {plan.saving ? (
                    <p className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm text-dim line-through">
                        {inr(plan.regularPrice)}
                      </span>
                      <span className="flex items-center gap-1 font-mono text-[0.6875rem] font-bold uppercase tracking-[0.12em] text-accent">
                        <Tag className="h-3 w-3" aria-hidden="true" />
                        Save {inr(plan.saving)}
                      </span>
                    </p>
                  ) : (
                    <p className="mt-2 font-mono text-[0.6875rem] uppercase tracking-[0.12em] text-dim">
                      No contract — pay for one month
                    </p>
                  )}
                </div>

                <ul className="mt-6 flex flex-1 flex-col gap-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3">
                      <span
                        className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-sm bg-accent/20"
                        aria-hidden="true"
                      >
                        <Check className="h-3.5 w-3.5 text-accent" />
                      </span>
                      <span className="text-sm leading-relaxed text-muted">
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>

                <LinkButton
                  href={enquiryHref(plan)}
                  variant={plan.featured ? 'primary' : 'secondary'}
                  size="lg"
                  fullWidth
                  className="mt-7"
                  aria-label={`Enquire about the ${plan.name} membership plan`}
                >
                  Enquire About This Plan
                </LinkButton>
              </Card>
            </ScrollReveal>
          ))}
        </ul>

        <div className="mt-8 flex flex-col items-center justify-center gap-3 text-center">
          <p className="max-w-[52ch] text-sm leading-relaxed text-muted">
            Prices reflect the current in-gym offers. Message us on Instagram for
            the latest updates and to get started.
          </p>
          <LinkButton
            href={social.instagram.url}
            target="_blank"
            rel="noopener noreferrer"
            variant="secondary"
            size="lg"
          >
            <Instagram className="h-4 w-4 text-accent" aria-hidden="true" />
            Follow Us on Instagram
          </LinkButton>
        </div>
      </div>
    </section>
  )
}
