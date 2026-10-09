import { useContext } from 'react'
import { ToastContext, type ToastValue } from './ToastProvider'

export function useToast(): ToastValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx
}
