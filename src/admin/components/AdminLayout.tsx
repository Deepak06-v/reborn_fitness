import { useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  CalendarClock,
  LayoutDashboard,
  LogOut,
  Menu,
  Users,
  X,
} from 'lucide-react'
import { cn } from '../../lib/utils'
import { useAdminAuth } from '../auth/useAdminAuth'

const navItems = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/members', label: 'Members', icon: Users, end: false },
  { to: '/admin/payments', label: 'Payments', icon: CalendarClock, end: false },
]

export function AdminLayout() {
  const { admin, logout } = useAdminAuth()
  const navigate = useNavigate()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  const handleLogout = async () => {
    await logout()
    navigate('/admin/login', { replace: true })
  }

  const nav = (
    <nav className="flex flex-1 flex-col gap-1">
      {navItems.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          onClick={() => setMobileNavOpen(false)}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 rounded-md px-3 py-2.5 font-display text-xs font-semibold uppercase tracking-[0.12em] transition-colors',
              isActive
                ? 'bg-accent text-canvas'
                : 'text-muted hover:bg-white/5 hover:text-white',
            )
          }
        >
          <item.icon className="h-4 w-4" aria-hidden="true" />
          {item.label}
        </NavLink>
      ))}
    </nav>
  )

  const sidebarInner = (
    <div className="flex h-full flex-col gap-6 p-5">
      <div>
        <p className="font-display text-lg font-bold uppercase tracking-tight text-white">
          Reborn<span className="text-accent">.</span>
        </p>
        <p className="label-telemetry mt-1">Operations Console</p>
      </div>
      {nav}
      <div className="space-y-3 border-t border-hairline pt-4">
        <Link
          to="/"
          className="flex items-center gap-2 font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-dim transition-colors hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          Back to site
        </Link>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-body text-sm text-white">{admin?.username}</p>
            <p className="font-mono text-[0.625rem] uppercase tracking-[0.14em] text-dim">
              {admin?.role}
            </p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            aria-label="Sign out"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-hairline text-muted transition-colors hover:border-accent/40 hover:text-white"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-canvas lg:flex">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-r border-hairline bg-surface lg:block">
        {sidebarInner}
      </aside>

      {/* Mobile top bar */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-hairline bg-surface px-4 py-3 lg:hidden">
        <p className="font-display text-base font-bold uppercase tracking-tight text-white">
          Reborn<span className="text-accent">.</span>
        </p>
        <button
          type="button"
          onClick={() => setMobileNavOpen((open) => !open)}
          aria-label="Toggle navigation"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-hairline text-muted"
        >
          {mobileNavOpen ? (
            <X className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Menu className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
      </div>

      {/* Mobile drawer */}
      {mobileNavOpen ? (
        <div className="fixed inset-0 z-20 bg-canvas pt-[3.25rem] lg:hidden">
          {sidebarInner}
        </div>
      ) : null}

      <main className="min-w-0 flex-1 px-4 py-6 sm:px-8 sm:py-10">
        <div className="mx-auto w-full max-w-6xl">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
