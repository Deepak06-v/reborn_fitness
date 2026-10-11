import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AdminApp } from './admin/AdminApp'
import { ScrollProvider } from './providers/ScrollProvider'
import './styles/globals.css'

const isAdminRoute = window.location.pathname.startsWith('/admin')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isAdminRoute ? (
      <BrowserRouter>
        <AdminApp />
      </BrowserRouter>
    ) : (
      <ScrollProvider>
        <App />
      </ScrollProvider>
    )}
  </StrictMode>,
)
