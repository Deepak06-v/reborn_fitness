import { useEffect, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '../../lib/utils'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  eyebrow?: string
  children: ReactNode
  className?: string
}

export function Modal({
  open,
  onClose,
  title,
  eyebrow,
  children,
  className,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const restoreRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!open) return

    restoreRef.current = document.activeElement as HTMLElement | null
    closeRef.current?.focus()

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
      restoreRef.current?.focus?.()
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[120] flex items-end justify-center overflow-y-auto bg-canvas/85 p-0 backdrop-blur-sm sm:items-center sm:p-6"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        data-print-ticket
        className={cn(
          'relative my-auto w-full max-w-md rounded-lg border border-accent/30 bg-surface/95 p-6 shadow-lift backdrop-blur-[16px]',
          className,
        )}
      >
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Close dialog"
          className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full border border-hairline text-muted transition-colors hover:border-accent/40 hover:text-white print:hidden"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>

        {eyebrow ? (
          <p className="label-telemetry mb-3 pr-12 text-accent">{eyebrow}</p>
        ) : null}

        <h2 className="display-lg pr-10">{title}</h2>

        <div className="mt-5">{children}</div>
      </div>
    </div>
  )
}