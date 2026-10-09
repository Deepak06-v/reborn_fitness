import {
  createContext,
  useCallback,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react'
import { cn } from '../../lib/utils'

export type ToastTone = 'success' | 'error' | 'info'

interface ToastItem {
  id: number
  message: string
  tone: ToastTone
}

export interface ToastValue {
  notify: (message: string, tone?: ToastTone) => void
}

const ToastContext = createContext<ToastValue | null>(null)

const toneStyles: Record<ToastTone, string> = {
  success: 'border-lime/40 bg-lime/10 text-lime',
  error: 'border-red-500/40 bg-red-500/10 text-red-300',
  info: 'border-accent/40 bg-accent/10 text-accent',
}

const toneIcons: Record<ToastTone, typeof Info> = {
  success: CheckCircle2,
  error: AlertTriangle,
  info: Info,
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const remove = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const notify = useCallback(
    (message: string, tone: ToastTone = 'info') => {
      const id = Date.now() + Math.floor(Math.random() * 1000)
      setToasts((current) => [...current, { id, message, tone }])
      window.setTimeout(() => remove(id), 5000)
    },
    [remove],
  )

  const value = useMemo<ToastValue>(() => ({ notify }), [notify])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed bottom-4 right-4 z-[300] flex w-[min(92vw,24rem)] flex-col gap-2"
      >
        {toasts.map((toast) => {
          const Icon = toneIcons[toast.tone]
          return (
            <div
              key={toast.id}
              className={cn(
                'pointer-events-auto flex items-start gap-3 rounded-md border px-4 py-3 font-body text-sm shadow-lift backdrop-blur-[12px]',
                toneStyles[toast.tone],
              )}
            >
              <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="flex-1 text-white/90">{toast.message}</span>
              <button
                type="button"
                onClick={() => remove(toast.id)}
                aria-label="Dismiss notification"
                className="text-muted transition-colors hover:text-white"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export { ToastContext }
