import { forwardRef, type HTMLAttributes } from 'react'
import { cn } from '../../lib/utils'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  interactive?: boolean
}

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { interactive = false, className, children, ...rest },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn(
        'rounded bg-card/80 backdrop-blur-[16px] transition-colors duration-300 ease-out-expo',
        'border border-hairline',
        interactive &&
          'hover:border-accent/40 hover:bg-card/90 focus-within:border-accent/40',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  )
})