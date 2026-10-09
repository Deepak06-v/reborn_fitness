import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAdminAuth } from '../auth/useAdminAuth'
import { Spinner } from './ui'

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { status } = useAdminAuth()
  const location = useLocation()

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center gap-3 bg-canvas">
        <Spinner />
        <span className="font-mono text-xs uppercase tracking-[0.18em] text-dim">
          Verifying session…
        </span>
      </div>
    )
  }

  if (status === 'anonymous') {
    return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />
  }

  return <>{children}</>
}
