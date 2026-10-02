import type { ReactNode } from 'react'
import { cn } from '../../lib/utils'
import { ScrollReveal } from '../animations/ScrollReveal'

interface SectionHeadingProps {
  eyebrow: string
  title: ReactNode
  description?: string
  align?: 'left' | 'center'
  className?: string
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = 'left',
  className,
}: SectionHeadingProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-4',
        align === 'center' && 'items-center text-center',
        className,
      )}
    >
      <ScrollReveal direction="fade" className="flex items-center gap-3">
        <span className="h-px w-8 bg-accent/60" aria-hidden="true" />
        <p className="label-telemetry text-accent">{eyebrow}</p>
      </ScrollReveal>

      <ScrollReveal direction="rise">
        <h2 className="display-lg max-w-[18ch] text-balance">{title}</h2>
      </ScrollReveal>

      {description ? (
        <ScrollReveal direction="rise" delay={0.08}>
          <p
            className={cn(
              'max-w-[54ch] text-sm leading-relaxed text-muted',
              align === 'center' && 'mx-auto',
            )}
          >
            {description}
          </p>
        </ScrollReveal>
      ) : null}
    </div>
  )
}