import { useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Lock, ShieldCheck } from 'lucide-react'
import { ApiError } from '../api'
import { useAdminAuth } from '../auth/useAdminAuth'
import { Spinner } from '../components/ui'

export function AdminLogin() {
  const { status, login } = useAdminAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const from = (location.state as { from?: string } | null)?.from ?? '/admin'

  if (status === 'authenticated') {
    return <Navigate to="/admin" replace />
  }

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await login(username.trim(), password)
      navigate(from, { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to sign in. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="font-display text-2xl font-bold uppercase tracking-tight text-white">
            Reborn<span className="text-accent">.</span>
          </p>
          <p className="label-telemetry mt-2">Operations Console</p>
        </div>

        <div className="rounded-lg border border-hairline bg-surface p-6 shadow-lift">
          <div className="mb-5 flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full border border-accent/30 bg-accent/10 text-accent">
              <Lock className="h-4 w-4" aria-hidden="true" />
            </span>
            <div>
              <h1 className="font-display text-lg font-bold uppercase tracking-tight text-white">
                Sign in
              </h1>
              <p className="font-body text-xs text-muted">Private access only</p>
            </div>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="admin-username"
                className="label-telemetry mb-1.5 block"
              >
                Username
              </label>
              <input
                id="admin-username"
                name="username"
                autoComplete="username"
                required
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                className="w-full rounded-md border border-hairline bg-canvas px-3 py-2.5 font-body text-sm text-white outline-none transition-colors focus:border-accent"
              />
            </div>

            <div>
              <label
                htmlFor="admin-password"
                className="label-telemetry mb-1.5 block"
              >
                Password
              </label>
              <input
                id="admin-password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-md border border-hairline bg-canvas px-3 py-2.5 font-body text-sm text-white outline-none transition-colors focus:border-accent"
              />
            </div>

            {error ? (
              <p
                role="alert"
                className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 font-body text-xs text-red-300"
              >
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2 rounded-md border border-accent bg-accent px-4 py-3 font-display text-xs font-semibold uppercase tracking-[0.14em] text-canvas transition-colors hover:bg-accent/90 disabled:pointer-events-none disabled:opacity-60"
            >
              {submitting ? <Spinner className="text-canvas" /> : null}
              {submitting ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p className="mt-5 flex items-center gap-2 font-mono text-[0.625rem] uppercase tracking-[0.14em] text-dim">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            Sessions are encrypted and rate limited
          </p>
        </div>
      </div>
    </div>
  )
}
