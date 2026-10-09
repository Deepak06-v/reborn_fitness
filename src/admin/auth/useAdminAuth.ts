import { useContext } from 'react'
import { AdminAuthContext, type AdminAuthValue } from './AuthContext'

export function useAdminAuth(): AdminAuthValue {
  const ctx = useContext(AdminAuthContext)
  if (!ctx) throw new Error('useAdminAuth must be used inside <AdminAuthProvider>')
  return ctx
}
