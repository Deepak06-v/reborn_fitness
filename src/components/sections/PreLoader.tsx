import { useEffect, useRef, useState } from 'react'
import { gsap } from 'gsap'

interface PreLoaderProps {
  onComplete: () => void
}

/**
 * Full-screen pre-loader splash sequence.
 *
 * Plays `logo-anim.mp4` centred on an Obsidian Black (#09090b) overlay.
 * When the video ends (or after a safety timeout) a GSAP timeline
 * scales the video down slightly & fades the overlay to opacity 0,
 * then unmounts via the onComplete callback.
 */
export function PreLoader({ onComplete }: PreLoaderProps) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [visible, setVisible] = useState(true)
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 768 : false,
  )
  const hasTriggered = useRef(false)

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const triggerExit = () => {
    if (hasTriggered.current) return
    hasTriggered.current = true

    const overlay = overlayRef.current
    const video = videoRef.current

    if (!overlay) {
      onComplete()
      return
    }

    // Respect reduced-motion: skip animation
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setVisible(false)
      onComplete()
      return
    }

    const tl = gsap.timeline({
      onComplete: () => {
        setVisible(false)
        onComplete()
      },
    })

    // Scale video down slightly first
    if (video) {
      tl.to(
        video,
        {
          scale: 0.85,
          duration: 0.6,
          ease: 'power3.inOut',
        },
        0,
      )
    }

    // Fade entire overlay
    tl.to(
      overlay,
      {
        opacity: 0,
        duration: 0.7,
        ease: 'power2.inOut',
      },
      video ? '-=0.3' : 0,
    )
  }

  useEffect(() => {
    // Safety timeout: even if the video never loads/plays, exit after 5s
    const safetyTimer = window.setTimeout(() => {
      triggerExit()
    }, 5000)

    return () => window.clearTimeout(safetyTimer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!visible) return null

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#050505]"
      aria-hidden="true"
    >
      {/* Subtle radial glow behind the logo video */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-1/2 h-[28rem] w-[28rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/8 blur-[120px]" />
      </div>

      {/* Conditionally render ONLY ONE landing animation video based on isMobile */}
      <video
        key={isMobile ? 'mobile-anim' : 'desktop-anim'}
        ref={videoRef}
        src={isMobile ? './logo-anim-mobile.mp4' : './logo-anim-desktop.mp4'}
        autoPlay
        muted
        playsInline
        onEnded={triggerExit}
        className="absolute inset-0 z-10 h-full w-full scale-[1.15] object-contain mix-blend-lighten [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_70%)]"
      />

      {/* Hard vignette to guarantee edges blend into the Pitch Black background */}
      <div className="pointer-events-none absolute inset-0 z-20 shadow-[inset_0_0_120px_80px_#050505]" />

      {/* Scan-line aesthetic overlay */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute inset-x-0 h-[2px] animate-scan-line bg-accent/15" />
      </div>

      {/* Fallback text for when the video doesn't load */}
      <noscript>
        <span className="absolute font-display text-xl font-bold uppercase tracking-[0.2em] text-white">
          REBORN FITNESS
        </span>
      </noscript>
    </div>
  )
}
