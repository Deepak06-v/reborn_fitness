import { Footer } from './components/layout/Footer'
import { Header } from './components/layout/Header'
import { MobileConsultationBar } from './components/layout/MobileConsultationBar'
import { PreLoader } from './components/sections/PreLoader'
import { Hero } from './components/sections/Hero'
import { Trainer } from './components/sections/Trainer'
import { Zones } from './components/sections/Zones'
import { GymTour } from './components/sections/GymTour'
import { Membership } from './components/sections/Membership'
import { TransformationShowcase } from './components/sections/TransformationShowcase'
import { Contact } from './components/sections/Contact'
import { ConsultationCta } from './components/sections/ConsultationCta'
import { ScrollProvider } from './providers/ScrollProvider'

export default function App() {
  return (
    <ScrollProvider>
      <PreLoader />
      <div className="relative flex min-h-screen flex-col bg-canvas">
        <Header />
        <main className="flex-1">
          <Hero />
          <ConsultationCta />
          <Zones />
          <GymTour />
          <Membership />
          <Trainer />
          <TransformationShowcase />
          <Contact />
        </main>
        <Footer />
        <MobileConsultationBar />
      </div>
    </ScrollProvider>
  )
}
