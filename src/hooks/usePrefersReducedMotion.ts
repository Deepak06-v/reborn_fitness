import { useEffect, useState } from 'react'

/**
 * Tracks the user's `prefers-reduced-motion` setting and re-renders when it
 * changes. Consumers use this to disable non-essential motion (e.g. the endless
 * image marquees fall back to a native horizontal scroller).
 */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => setReduced(query.matches)
    sync()
    query.addEventListener('change', sync)
    return () => query.removeEventListener('change', sync)
  }, [])

  return reduced
}
