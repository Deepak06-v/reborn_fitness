import { useState } from 'react'
import { CartDrawer } from './components/cart/CartDrawer'
import { Footer } from './components/layout/Footer'
import { Header } from './components/layout/Header'
import { MobileCtaBar } from './components/layout/MobileCtaBar'
import { MobileNavDrawer } from './components/layout/MobileNavDrawer'
import { Coaches } from './components/sections/Coaches'
import { Contact } from './components/sections/Contact'
import { Faq } from './components/sections/Faq'
import { Hero } from './components/sections/Hero'
import { Membership } from './components/sections/Membership'
import { Merch } from './components/sections/Merch'
import { PreLoader } from './components/sections/PreLoader'
import { TrialPass } from './components/sections/TrialPass'
import { Zones } from './components/sections/Zones'
import { useScrollTo } from './hooks/useScrollTo'

export default function App() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [requestedCoachId, setRequestedCoachId] = useState<string | null>(null)
  const [preloaderDone, setPreloaderDone] = useState(false)
  const scrollTo = useScrollTo()

  const bookWithCoach = (coachId: string) => {
    setRequestedCoachId(coachId)
    scrollTo('#trial-pass')
  }

  return (
    <div className="relative min-h-screen bg-canvas">
      {/* Section 0: Pre-loader splash sequence */}
      {!preloaderDone && (
        <PreLoader onComplete={() => setPreloaderDone(true)} />
      )}

      <a
        href="#trial-pass"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[200] focus:rounded-full focus:bg-accent focus:px-5 focus:py-3 focus:font-display focus:text-xs focus:uppercase focus:tracking-[0.14em] focus:text-canvas"
      >
        Skip to booking
      </a>

      <Header onOpenMenu={() => setMenuOpen(true)} />

      <main>
        <Hero preloaderDone={preloaderDone} />
        <TrialPass requestedCoachId={requestedCoachId} />
        <Zones />
        <Membership />
        <Merch />
        <Coaches onBookWithCoach={bookWithCoach} />
        <Contact />
        <Faq />
      </main>

      <Footer />

      <MobileCtaBar />
      <MobileNavDrawer open={menuOpen} onClose={() => setMenuOpen(false)} />
      <CartDrawer />
    </div>
  )
}