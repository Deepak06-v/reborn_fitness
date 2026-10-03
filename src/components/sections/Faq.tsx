import { useState } from 'react'
import { HelpCircle, Minus, Plus } from 'lucide-react'
import { faqs } from '../../data/faqs'
import { cn } from '../../lib/utils'
import { SectionHeading } from '../ui/SectionHeading'
import { ScrollReveal } from '../animations/ScrollReveal'

export function Faq() {
  const [openIndex, setOpenIndex] = useState<number | null>(0)

  return (
    <section className="py-20 sm:py-28">
      <div className="section-shell">
        <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
          <SectionHeading
            eyebrow="Proof / 07"
            title="Questions before you book"
            description="Everything athletes ask on the first visit. Still unsure? Call the front desk and we will walk you through your exact session."
          />

          <div className="flex flex-col gap-3">
            {faqs.map((faq, index) => {
              const open = openIndex === index
              return (
                <ScrollReveal key={faq.question} direction="rise" delay={index * 0.05}>
                  <div
                    className={cn(
                      'overflow-hidden rounded-md border bg-surface transition-all duration-200',
                      open ? 'border-accent shadow-[3px_3px_0px_0px_#FFEE00]' : 'border-hairline',
                    )}
                  >
                    <h3>
                      <button
                        type="button"
                        onClick={() => setOpenIndex(open ? null : index)}
                        aria-expanded={open}
                        aria-controls={`faq-panel-${index}`}
                        id={`faq-trigger-${index}`}
                        className="flex min-h-[64px] w-full items-center justify-between gap-4 px-5 py-4 text-left"
                      >
                        <span className="flex items-start gap-3">
                          <HelpCircle
                            className={cn(
                              'mt-0.5 h-4 w-4 shrink-0 transition-colors',
                              open ? 'text-accent' : 'text-dim',
                            )}
                            aria-hidden="true"
                          />
                          <span
                            className={cn(
                              'font-display text-sm font-semibold uppercase leading-snug tracking-[0.04em] transition-colors',
                              open ? 'text-white' : 'text-muted',
                            )}
                          >
                            {faq.question}
                          </span>
                        </span>
                        <span
                          className={cn(
                            'flex h-8 w-8 shrink-0 items-center justify-center rounded-md border transition-colors',
                            open
                              ? 'border-accent bg-accent text-canvas font-bold'
                              : 'border-hairline text-dim',
                          )}
                          aria-hidden="true"
                        >
                          {open ? (
                            <Minus className="h-4 w-4" />
                          ) : (
                            <Plus className="h-4 w-4" />
                          )}
                        </span>
                      </button>
                    </h3>

                    <div
                      id={`faq-panel-${index}`}
                      role="region"
                      aria-labelledby={`faq-trigger-${index}`}
                      hidden={!open}
                      className="px-5 pb-5 pl-12"
                    >
                      <p className="text-sm leading-relaxed text-muted">
                        {faq.answer}
                      </p>
                    </div>
                  </div>
                </ScrollReveal>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}