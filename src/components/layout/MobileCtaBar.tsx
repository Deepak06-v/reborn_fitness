import { Zap } from 'lucide-react'
import { useScrollTo } from '../../hooks/useScrollTo'

/** Thumb-accessible conversion bar, mobile only. */
export function MobileCtaBar() {
  const scrollTo = useScrollTo()

  return (
    <div className="fixed inset-x-0 bottom-0 z-[95] border-t border-hairline bg-canvas p-3 lg:hidden">
      <div className="section-shell flex items-center justify-center">
        <button
          type="button"
          onClick={() => scrollTo('#trial-pass')}
          className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-md border-2 border-accent bg-accent px-5 font-display text-xs font-bold uppercase tracking-[0.14em] text-canvas shadow-[4px_4px_0px_0px_#262626] transition-transform active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
        >
          <Zap className="h-4 w-4 fill-canvas" aria-hidden="true" />
          BOOK 1-DAY VIP PASS
        </button>
      </div>
    </div>
  )
}