import { createContext, useContext } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type Lenis from 'lenis'

export type ScrollContextValue = [
  Lenis | null,
  Dispatch<SetStateAction<Lenis | null>>,
]

export const ScrollContext = createContext<ScrollContextValue | null>(null)

export function useScroll(): ScrollContextValue {
  const ctx = useContext(ScrollContext)
  if (!ctx) throw new Error('useScroll must be used inside <ScrollProvider>')
  return ctx
}