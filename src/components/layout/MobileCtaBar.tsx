import { Zap } from 'lucide-react'
import { brand } from '../../data/site'
import { useScrollTo } from '../../hooks/useScrollTo'

/** Thumb-accessible conversion bar, mobile only. */
export function MobileCtaBar() {
  const scrollTo = useScrollTo()

  return (
    <div className="fixed inset-x-0 bottom-0 z-[95] border-t border-accent/20 bg-canvas/90 backdrop-blur-[16px] lg:hidden">
      <div className="section-shell flex items-center gap-3 py-3">
        <button
          type="button"
          onClick={() => scrollTo('#trial-pass')}
          className="flex min-h-[52px] flex-1 items-center justify-center gap-2 rounded-full bg-accent px-5 font-display text-xs font-bold uppercase tracking-[0.14em] text-canvas shadow-glow transition-transform active:scale-[0.98]"
        >
          <Zap className="h-4 w-4" aria-hidden="true" />
          {brand.dayPassCta}
        </button>
      </div>
    </div>
  )
}