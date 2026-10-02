import { useCallback } from 'react'
import { useScroll } from '../context/ScrollContext'

const NAV_OFFSET = -80

export function useScrollTo() {
  const [lenis] = useScroll()

  return useCallback(
    (target: string) => {
      if (lenis) {
        lenis.scrollTo(target, { offset: NAV_OFFSET, duration: 1.2 })
        return
      }
      const el = document.querySelector(target)
      if (el) el.scrollIntoView({ behavior: 'auto', block: 'start' })
    },
    [lenis],
  )
}