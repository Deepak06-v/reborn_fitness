import { useState } from 'react'
import { Footer } from './components/layout/Footer'
import { Header } from './components/layout/Header'
import { MobileConsultationBar } from './components/layout/MobileConsultationBar'
import { MobileNavDrawer } from './components/layout/MobileNavDrawer'
import { Coaches } from './components/sections/Coaches'
import { ConsultationCta } from './components/sections/ConsultationCta'
import { Contact } from './components/sections/Contact'
import { GymTour } from './components/sections/GymTour'
import { Hero } from './components/sections/Hero'
import { Membership } from './components/sections/Membership'
import { PreLoader } from './components/sections/PreLoader'
import { TransformationShowcase } from './components/sections/TransformationShowcase'
import { Zones } from './components/sections/Zones'

export default function App() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [preloaderDone, setPreloaderDone] = useState(false)

  return (
    <div className="relative min-h-screen bg-canvas">
      {/* Section 0: Pre-loader splash sequence */}
      {!preloaderDone && (
        <PreLoader onComplete={() => setPreloaderDone(true)} />
      )}

      <a
        href="#memberships"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[200] focus:rounded-full focus:bg-accent focus:px-5 focus:py-3 focus:font-display focus:text-xs focus:uppercase focus:tracking-[0.14em] focus:text-canvas"
      >
        Skip to memberships
      </a>

      <Header onOpenMenu={() => setMenuOpen(true)} />

      <main>
        <Hero preloaderDone={preloaderDone} />
        <ConsultationCta />
        <Zones />
        <GymTour />
        <Membership />
        <Coaches />
        <TransformationShowcase />
        <Contact />
      </main>

      <Footer />

      <MobileConsultationBar />

      <MobileNavDrawer open={menuOpen} onClose={() => setMenuOpen(false)} />
    </div>
  )
}