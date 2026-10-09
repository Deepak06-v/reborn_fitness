import type { ReactNode } from 'react'
import { Loader2, X } from 'lucide-react'
import { cn } from '../../lib/utils'
import { paymentStatusLabel, paymentStatusTone } from '../format'
import type { MemberStatus, PaymentStatus } from '../types'

export function Spinner({ className }: { className?: string }) {
  return (
    <Loader2
      className={cn('h-5 w-5 animate-spin text-accent', className)}
      aria-hidden="true"
    />
  )
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string
  title: string
  description?: string
  actions?: ReactNode
}) {
  return (
    <div className="flex flex-col gap-4 border-b border-hairline pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow ? (
          <p className="label-telemetry mb-2 text-accent">{eyebrow}</p>
        ) : null}
        <h1 className="font-display text-2xl font-bold uppercase tracking-tight text-white sm:text-3xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-2 max-w-2xl font-body text-sm text-muted">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  )
}

export function Panel({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('rounded-lg border border-hairline bg-surface', className)}>
      {children}
    </div>
  )
}

export function StatCard({
  label,
  value,
  hint,
  tone = 'default',
  icon,
}: {
  label: string
  value: ReactNode
  hint?: string
  tone?: 'default' | 'accent' | 'lime' | 'danger'
  icon?: ReactNode
}) {
  const valueTone = {
    default: 'text-white',
    accent: 'text-accent',
    lime: 'text-lime',
    danger: 'text-red-400',
  }[tone]
  return (
    <Panel className="p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="label-telemetry">{label}</p>
        {icon ? <span className="text-dim">{icon}</span> : null}
      </div>
      <p className={cn('mt-3 font-display text-3xl font-bold tracking-tight', valueTone)}>
        {value}
      </p>
      {hint ? <p className="mt-2 font-mono text-xs text-dim">{hint}</p> : null}
    </Panel>
  )
}

export function StatusBadge({ status }: { status: PaymentStatus }) {
  const tones = {
    lime: 'border-lime/40 bg-lime/10 text-lime',
    accent: 'border-accent/40 bg-accent/10 text-accent',
    neutral: 'border-hairline bg-white/5 text-muted',
    danger: 'border-red-500/40 bg-red-500/10 text-red-300',
  }
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-1 font-mono text-[0.625rem] uppercase tracking-[0.14em]',
        tones[paymentStatusTone[status]],
      )}
    >
      {paymentStatusLabel[status]}
    </span>
  )
}

export function MemberStatusBadge({ status }: { status: MemberStatus }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[0.625rem] uppercase tracking-[0.14em]',
        status === 'active'
          ? 'border-lime/40 bg-lime/10 text-lime'
          : 'border-hairline bg-white/5 text-dim',
      )}
    >
      <span
        className={cn(
          'h-1.5 w-1.5 rounded-full',
          status === 'active' ? 'bg-lime' : 'bg-dim',
        )}
      />
      {status === 'active' ? 'Active' : 'Inactive'}
    </span>
  )
}

export function EmptyState({
  title,
  description,
  icon,
}: {
  title: string
  description?: string
  icon?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      {icon ? <span className="text-dim">{icon}</span> : null}
      <p className="font-display text-lg font-semibold uppercase tracking-tight text-white">
        {title}
      </p>
      {description ? (
        <p className="max-w-sm font-body text-sm text-muted">{description}</p>
      ) : null}
    </div>
  )
}

export function AdminModal({
  open,
  onClose,
  title,
  description,
  children,
  size = 'md',
}: {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: ReactNode
  size?: 'md' | 'lg' | 'xl'
}) {
  if (!open) return null
  const widths = { md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }
  return (
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center overflow-y-auto bg-canvas/80 p-0 backdrop-blur-sm sm:items-center sm:p-6"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          'relative my-auto w-full rounded-lg border border-hairline bg-surface p-6 shadow-lift',
          widths[size],
        )}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close dialog"
          className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full border border-hairline text-muted transition-colors hover:border-accent/40 hover:text-white"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
        <h2 className="pr-10 font-display text-xl font-bold uppercase tracking-tight text-white">
          {title}
        </h2>
        {description ? (
          <p className="mt-2 font-body text-sm text-muted">{description}</p>
        ) : null}
        <div className="mt-5">{children}</div>
      </div>
    </div>
  )
}

export function FieldError({ message }: { message?: string | null }) {
  if (!message) return null
  return <p className="mt-1 font-body text-xs text-red-400">{message}</p>
}
