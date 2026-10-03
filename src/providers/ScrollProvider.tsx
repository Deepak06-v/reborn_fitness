import { useEffect, useState, type ReactNode } from 'react'
import Lenis from 'lenis'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { ScrollContext } from '../context/ScrollContext'

gsap.registerPlugin(ScrollTrigger)

export function ScrollProvider({ children }: { children: ReactNode }) {
  const [lenisInstance, setLenisInstance] = useState<Lenis | null>(null)

  useEffect(() => {
    // Zero-lag mobile optimization: ignore address-bar resize jumps
    ScrollTrigger.config({ ignoreMobileResize: true })

    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches

    if (prefersReducedMotion) return

    // Detect if window.innerWidth < 768 or touch events are present
    const isTouchOrMobile =
      typeof window !== 'undefined' &&
      (window.innerWidth < 768 ||
        'ontouchstart' in window ||
        navigator.maxTouchPoints > 0)

    // DISABLE Lenis smooth scrolling on mobile. Allow native OS GPU-accelerated touch scrolling.
    if (isTouchOrMobile) return

    const lenis = new Lenis({
      duration: 1.1,
      smoothWheel: true,
      syncTouch: false,
    })
    setLenisInstance(lenis)

    // Lenis drives the GSAP ticker so both engines share one rAF loop
    lenis.on('scroll', ScrollTrigger.update)

    const raf = (time: number) => lenis.raf(time * 1000)
    gsap.ticker.add(raf)
    gsap.ticker.lagSmoothing(0)

    return () => {
      gsap.ticker.remove(raf)
      lenis.off('scroll', ScrollTrigger.update)
      lenis.destroy()
      setLenisInstance(null)
    }
  }, [])

  return (
    <ScrollContext.Provider value={[lenisInstance, setLenisInstance]}>
      {children}
    </ScrollContext.Provider>
  )
}