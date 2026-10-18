import { useContext } from 'react'
import { AdminAuthContext, type AdminAuthValue } from './AuthContext'
import type { AdminRole } from '../types'

// 'owner' and 'superadmin' are Owner-level. 'admin' maps to Staff (restricted).
export const isOwnerRole = (role?: AdminRole | null): boolean =>
  role === 'owner' || role === 'superadmin'

export function useAdminAuth(): AdminAuthValue & { isOwner: boolean } {
  const ctx = useContext(AdminAuthContext)
  if (!ctx) throw new Error('useAdminAuth must be used inside <AdminAuthProvider>')
  const isOwner = isOwnerRole(ctx.admin?.role)
  return { ...ctx, isOwner }
}
