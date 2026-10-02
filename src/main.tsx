import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { ScrollProvider } from './providers/ScrollProvider'
import { CartProvider } from './context/CartContext'
import './styles/globals.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ScrollProvider>
      <CartProvider>
        <App />
      </CartProvider>
    </ScrollProvider>
  </StrictMode>,
)