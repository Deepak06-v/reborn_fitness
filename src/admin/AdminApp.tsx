import { Navigate, Route, Routes } from 'react-router-dom'
import { AdminAuthProvider } from './auth/AuthContext'
import { ToastProvider } from './components/ToastProvider'
import { ProtectedRoute } from './components/ProtectedRoute'
import { AdminLayout } from './components/AdminLayout'
import { AdminLogin } from './pages/AdminLogin'
import { AdminDashboard } from './pages/AdminDashboard'
import { MembersPage } from './pages/MembersPage'
import { MemberDetailsPage } from './pages/MemberDetailsPage'
import { PaymentsPage } from './pages/PaymentsPage'

export function AdminApp() {
  return (
    <AdminAuthProvider>
      <ToastProvider>
        <Routes>
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <AdminLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<AdminDashboard />} />
            <Route path="members" element={<MembersPage />} />
            <Route path="members/:id" element={<MemberDetailsPage />} />
            <Route path="payments" element={<PaymentsPage />} />
            <Route path="*" element={<Navigate to="/admin" replace />} />
          </Route>
        </Routes>
      </ToastProvider>
    </AdminAuthProvider>
  )
}
