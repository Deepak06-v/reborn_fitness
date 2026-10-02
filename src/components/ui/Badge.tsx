import { forwardRef, type HTMLAttributes } from 'react'
import { cn } from '../../lib/utils'

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: 'lime' | 'accent' | 'neutral' | 'white'
}

const tones = {
  lime: 'border-lime/40 bg-lime/10 text-lime',
  accent: 'border-accent/40 bg-accent/10 text-accent',
  neutral: 'border-hairline bg-white/5 text-muted',
  white: 'border-white/20 bg-white/10 text-white',
}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(function Badge(
  { tone = 'neutral', className, children, ...rest },
  ref,
) {
  return (
    <span
      ref={ref}
      className={cn(
        'inline-flex items-center gap-2 rounded-full border px-3 py-1 font-mono text-[0.6875rem] uppercase tracking-[0.16em]',
        tones[tone],
        className,
      )}
      {...rest}
    >
      {children}
    </span>
  )
})