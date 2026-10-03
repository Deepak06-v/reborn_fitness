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
        'rounded-md bg-surface transition-all duration-200 ease-out-expo',
        'border border-hairline',
        interactive &&
          'hover:border-accent focus-within:border-accent',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  )
})