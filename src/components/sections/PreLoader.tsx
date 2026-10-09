import { useCallback, useEffect, useRef, useState } from 'react'
import { gsap } from 'gsap'

interface PreLoaderProps {
  onComplete: () => void
}

/**
 * Grace period added on top of the video's own duration before the
 * "stuck playback" fallback is allowed to fire.
 */
const PLAYBACK_GRACE_MS = 4000

/**
 * Generous fallback used only while the real duration is still unknown
 * (e.g. metadata never loads because the media is broken).
 */
const METADATA_FAILURE_TIMEOUT_MS = 20000

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

/**
 * Full-screen pre-loader splash sequence.
 *
 * Plays the platform-appropriate logo animation (`logo-anim-mobile.mp4` on
 * phones, `logo-anim-desktop.mp4` otherwise) centred on a Pitch Black
 * (#050505) overlay.
 *
 * Completion is driven by the video's natural `onEnded` event: once playback
 * finishes, a GSAP timeline scales the video down slightly and fades the
 * overlay out, then unmounts via the `onComplete` callback.
 *
 * A fallback timer exists ONLY to unstick genuinely failed or stalled
 * playback. It is sized from the video's real duration (metadata) plus a
 * grace period and will never cut off a video that is still actively
 * playing. Reduced-motion visitors skip the intro immediately.
 */
export function PreLoader({ onComplete }: PreLoaderProps) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [visible, setVisible] = useState(true)
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 768 : false,
  )

  // Single completion guard: onEnded, the fallback timer, playback errors and
  // cleanup can never trigger more than one exit animation / onComplete call.
  const hasTriggered = useRef(false)
  const timelineRef = useRef<gsap.core.Timeline | null>(null)
  const fallbackTimerRef = useRef<number | null>(null)

  // Keep the latest onComplete without changing handler identities.
  const onCompleteRef = useRef(onComplete)
  useEffect(() => {
    onCompleteRef.current = onComplete
  }, [onComplete])

  const clearFallback = useCallback(() => {
    if (fallbackTimerRef.current !== null) {
      window.clearTimeout(fallbackTimerRef.current)
      fallbackTimerRef.current = null
    }
  }, [])

  const triggerExit = useCallback(() => {
    if (hasTriggered.current) return
    hasTriggered.current = true
    clearFallback()

    const overlay = overlayRef.current
    const video = videoRef.current

    const finish = () => {
      setVisible(false)
      onCompleteRef.current()
    }

    // No overlay, or reduced-motion: reveal immediately without animating.
    if (!overlay || prefersReducedMotion()) {
      finish()
      return
    }

    timelineRef.current?.kill()

    const tl = gsap.timeline({ onComplete: finish })
    timelineRef.current = tl

    // Scale video down slightly first.
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

    // Fade entire overlay.
    tl.to(
      overlay,
      {
        opacity: 0,
        duration: 0.7,
        ease: 'power2.inOut',
      },
      video ? '-=0.3' : 0,
    )
  }, [clearFallback])

  // Fallback watchdog: only unstick failed/stalled playback. If the video is
  // still actively progressing, reschedule instead of overriding it.
  const runFallback = useCallback(() => {
    fallbackTimerRef.current = null
    if (hasTriggered.current) return

    const video = videoRef.current
    const stillPlaying =
      !!video &&
      !video.ended &&
      !video.paused &&
      video.readyState >= 2 &&
      Number.isFinite(video.duration) &&
      video.duration - video.currentTime > 0.25

    if (stillPlaying) {
      const remaining =
        (video.duration - video.currentTime) * 1000 + PLAYBACK_GRACE_MS
      fallbackTimerRef.current = window.setTimeout(
        runFallback,
        Math.max(remaining, PLAYBACK_GRACE_MS),
      )
      return
    }

    triggerExit()
  }, [triggerExit])

  const scheduleFallback = useCallback(
    (delay: number) => {
      clearFallback()
      fallbackTimerRef.current = window.setTimeout(
        runFallback,
        Math.max(delay, 0),
      )
    },
    [clearFallback, runFallback],
  )

  // Once real duration metadata is known, size the fallback from it instead of
  // the generic "metadata never arrived" timeout.
  const handleLoadedMetadata = useCallback(() => {
    if (hasTriggered.current) return
    const duration = videoRef.current?.duration
    if (duration && Number.isFinite(duration) && duration > 0) {
      scheduleFallback(duration * 1000 + PLAYBACK_GRACE_MS)
    }
  }, [scheduleFallback])

  // Track viewport so the correct source is selected (and re-selected on
  // resize / orientation change).
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Completion setup: reduced-motion reveals immediately; everyone else gets a
  // generous fallback until duration metadata arrives.
  useEffect(() => {
    if (prefersReducedMotion()) {
      triggerExit()
      return
    }
    scheduleFallback(METADATA_FAILURE_TIMEOUT_MS)
  }, [triggerExit, scheduleFallback])

  // Best-effort autoplay + a single user-gesture retry if the browser rejects
  // it. This never calls onComplete on its own.
  useEffect(() => {
    const video = videoRef.current
    if (!video || hasTriggered.current || prefersReducedMotion()) return

    const attemptPlay = () => {
      const result = video.play()
      if (result && typeof result.catch === 'function') {
        result.catch(() => {
          // Autoplay rejected — the gesture retry below may recover it.
        })
      }
    }

    attemptPlay()

    const retryOnGesture = () => {
      if (hasTriggered.current) return
      const result = video.play()
      if (result && typeof result.catch === 'function') {
        result.catch(() => {
          // Still rejected; fallback will reveal the page.
        })
      }
    }

    window.addEventListener('pointerdown', retryOnGesture, true)
    window.addEventListener('touchstart', retryOnGesture, true)
    window.addEventListener('keydown', retryOnGesture, true)

    return () => {
      window.removeEventListener('pointerdown', retryOnGesture, true)
      window.removeEventListener('touchstart', retryOnGesture, true)
      window.removeEventListener('keydown', retryOnGesture, true)
    }
  }, [isMobile])

  // Cleanup timers and any in-flight timeline on unmount.
  useEffect(() => {
    return () => {
      clearFallback()
      timelineRef.current?.kill()
      timelineRef.current = null
    }
  }, [clearFallback])

  if (!visible) return null

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden bg-[#050505]"
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
        preload="auto"
        onEnded={triggerExit}
        onError={triggerExit}
        onLoadedMetadata={handleLoadedMetadata}
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
