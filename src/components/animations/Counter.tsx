import { useLayoutEffect, useRef, useState } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

interface CounterProps {
  value: number
  suffix?: string
  prefix?: string
  decimals?: number
  duration?: number
  className?: string
}

/**
 * Telemetry counter. Renders the final value on the server / for no-JS and
 * reduced-motion visitors, then ticks up once the element scrolls into view.
 */
export function Counter({
  value,
  suffix = '',
  prefix = '',
  decimals = 0,
  duration = 1.8,
  className,
}: CounterProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const [display, setDisplay] = useState(`${prefix}${value.toFixed(decimals)}${suffix}`)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return

    const final = `${prefix}${value.toFixed(decimals)}${suffix}`

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setDisplay(final)
      gsap.set(el, { clearProps: 'all' })
      return
    }

    const proxy = { n: 0 }
    const ctx = gsap.context(() => {
      gsap.to(proxy, {
        n: value,
        duration,
        ease: 'power2.out',
        scrollTrigger: { trigger: el, start: 'top 92%', once: true },
        onUpdate: () => setDisplay(`${prefix}${proxy.n.toFixed(decimals)}${suffix}`),
        onComplete: () => setDisplay(final),
      })
    }, el)

    return () => ctx.revert()
  }, [value, prefix, suffix, decimals, duration])

  return (
    <span ref={ref} className={className}>
      {display}
    </span>
  )
}