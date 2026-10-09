import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { adminApi } from '../api'
import type { AdminUser } from '../types'

export type AuthStatus = 'loading' | 'authenticated' | 'anonymous'

export interface AdminAuthValue {
  admin: AdminUser | null
  status: AuthStatus
  login: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const AdminAuthContext = createContext<AdminAuthValue | null>(null)

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState<AdminUser | null>(null)
  const [status, setStatus] = useState<AuthStatus>('loading')

  useEffect(() => {
    let active = true
    adminApi
      .me()
      .then((user) => {
        if (!active) return
        setAdmin(user)
        setStatus('authenticated')
      })
      .catch(() => {
        if (!active) return
        setAdmin(null)
        setStatus('anonymous')
      })
    return () => {
      active = false
    }
  }, [])

  const login = useCallback(async (username: string, password: string) => {
    const user = await adminApi.login(username, password)
    setAdmin(user)
    setStatus('authenticated')
  }, [])

  const logout = useCallback(async () => {
    try {
      await adminApi.logout()
    } finally {
      setAdmin(null)
      setStatus('anonymous')
    }
  }, [])

  const value = useMemo<AdminAuthValue>(
    () => ({ admin, status, login, logout }),
    [admin, status, login, logout],
  )

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>
}

export { AdminAuthContext }
