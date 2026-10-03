import { useLayoutEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

interface StaggerTextProps {
  /** Lines of the headline; each is revealed as its own masked child. */
  lines: string[]
  className?: string
  lineClassName?: string
  stagger?: number
}

export function StaggerText({
  lines,
  className,
  lineClassName,
  stagger = 0.12,
}: StaggerTextProps) {
  const ref = useRef<HTMLSpanElement>(null)

  useLayoutEffect(() => {
    const root = ref.current
    if (!root) return

    const targets = root.querySelectorAll('[data-line]')
    if (!targets.length) return

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      gsap.set(targets, { clearProps: 'all' })
      return
    }

    const ctx = gsap.context(() => {
      gsap.from(targets, {
        yPercent: 110,
        autoAlpha: 0,
        duration: 1,
        ease: 'expo.out',
        stagger,
        scrollTrigger: { trigger: root, start: 'top 90%', once: true },
      })
    }, root)

    return () => ctx.revert()
  }, [lines, stagger])

  return (
    <span ref={ref} className={className}>
      <span className="sr-only">{lines.join(' ')}</span>
      <span aria-hidden="true">
        {lines.map((line) => (
          <span key={line} className="block overflow-hidden pb-[0.08em]">
            <span data-line className={lineClassName ?? 'block'}>
              {line}
            </span>
          </span>
        ))}
      </span>
    </span>
  )
}
