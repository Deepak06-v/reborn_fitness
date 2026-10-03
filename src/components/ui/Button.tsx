import { forwardRef, type AnchorHTMLAttributes, type ButtonHTMLAttributes } from 'react'
import { cn } from '../../lib/utils'

type Variant = 'primary' | 'secondary' | 'ghost' | 'lime'
type Size = 'sm' | 'md' | 'lg'

interface BaseProps {
  variant?: Variant
  size?: Size
  fullWidth?: boolean
  className?: string
  children: React.ReactNode
}

type ButtonProps = BaseProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof BaseProps>

type LinkButtonProps = BaseProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof BaseProps>

const variantClasses: Record<Variant, string> = {
  primary:
    'border border-accent bg-surface text-white shadow-[4px_4px_0px_0px_#FFEE00] hover:bg-accent hover:text-canvas active:translate-x-[4px] active:translate-y-[4px] active:shadow-none',
  secondary:
    'border border-hairline bg-surface text-white hover:border-accent',
  ghost:
    'border border-hairline bg-transparent text-muted hover:border-accent hover:text-white',
  lime: 'border border-accent bg-surface text-white shadow-[4px_4px_0px_0px_#FFEE00] hover:bg-accent hover:text-canvas active:translate-x-[4px] active:translate-y-[4px] active:shadow-none',
}

const sizeClasses: Record<Size, string> = {
  sm: 'min-h-[48px] px-4 py-2 text-[0.6875rem]',
  md: 'min-h-[48px] px-5 py-3 text-xs',
  lg: 'min-h-[56px] px-7 py-4 text-sm',
}

function classes(
  variant: Variant,
  size: Size,
  fullWidth: boolean | undefined,
  className: string | undefined,
) {
  return cn(
    'inline-flex select-none items-center justify-center gap-2 rounded-md font-display font-semibold uppercase tracking-[0.14em] transition-all duration-200 ease-out-expo disabled:pointer-events-none disabled:opacity-50',
    variantClasses[variant],
    sizeClasses[size],
    fullWidth && 'w-full',
    className,
  )
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', fullWidth, className, children, type, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type ?? 'button'}
      className={classes(variant, size, fullWidth, className)}
      {...rest}
    >
      {children}
    </button>
  )
})

export const LinkButton = forwardRef<HTMLAnchorElement, LinkButtonProps>(
  function LinkButton(
    { variant = 'primary', size = 'md', fullWidth, className, children, ...rest },
    ref,
  ) {
    return (
      <a
        ref={ref}
        className={classes(variant, size, fullWidth, className)}
        {...rest}
      >
        {children}
      </a>
    )
  },
)