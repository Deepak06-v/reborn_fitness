import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { cn } from '../../lib/utils'

gsap.registerPlugin(ScrollTrigger)

type Direction = 'rise' | 'fade' | 'left' | 'right' | 'scale'

interface ScrollRevealProps {
  children: ReactNode
  direction?: Direction
  delay?: number
  duration?: number
  className?: string
  as?: 'div' | 'li' | 'section' | 'article'
}

const fromVars: Record<Direction, gsap.TweenVars> = {
  rise: { y: 32, autoAlpha: 0 },
  fade: { autoAlpha: 0 },
  left: { x: -40, autoAlpha: 0 },
  right: { x: 40, autoAlpha: 0 },
  scale: { scale: 0.94, autoAlpha: 0 },
}

export function ScrollReveal({
  children,
  direction = 'rise',
  delay = 0,
  duration = 0.9,
  className,
  as = 'div',
}: ScrollRevealProps) {
  const ref = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      gsap.set(el, { clearProps: 'all' })
      return
    }

    const ctx = gsap.context(() => {
      gsap.from(el, {
        ...fromVars[direction],
        duration,
        delay,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: el,
          start: 'top 88%',
          once: true,
        },
      })
    }, el)

    return () => ctx.revert()
  }, [direction, delay, duration])

  // `as` only selects the rendered element, so the ref keeps its div shape
  const Tag = as as 'div'

  return (
    <Tag ref={ref} className={cn(className)}>
      {children}
    </Tag>
  )
}