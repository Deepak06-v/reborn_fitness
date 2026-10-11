import { Fragment, type ReactNode } from 'react'
import { Pause, Play } from 'lucide-react'
import { cn } from '../../lib/utils'

export interface MarqueeItemArgs {
  /** True for the repeated copy that only exists to hide the loop seam. */
  duplicate: boolean
  index: number
}

interface MarqueeProps<T> {
  /** The base set of items. Rendered once per repetition. */
  items: T[]
  /** Renders a single card. `duplicate` cards should be hidden from a11y. */
  renderItem: (item: T, args: MarqueeItemArgs) => ReactNode
  /** Stable key per item (used across the repeated copies). */
  getKey: (item: T, index: number) => string
  /** When true the strip is a native scroller instead of an animating marquee. */
  reduced: boolean
  /** Tailwind animation utility for the moving track, e.g. `animate-marquee`. */
  animation: string
  /** Minimum number of cards per copy, so one copy always exceeds the viewport. */
  minItems?: number
  /** Pause the animation (e.g. a user toggle). Ignored when `reduced`. */
  paused?: boolean
  /** Accessible name for the strip. */
  ariaLabel?: string
  className?: string
}

/**
 * A single horizontal strip that loops seamlessly. It builds one "copy" (the
 * items repeated until they comfortably exceed the viewport), renders that copy
 * twice, and animates the track by `translateX(-50%)` via a Tailwind keyframe.
 * Because the second copy lands exactly where the first started, there is no
 * visible reset. Movement is pure CSS transforms — no timers, no per-frame
 * React state.
 *
 * Reduced-motion users get the identical content in a native, scrollable row
 * with no animation. Duplicate copies are marked `aria-hidden` by callers via
 * the `duplicate` flag so screen readers never hear the cards twice.
 */
export function Marquee<T>({
  items,
  renderItem,
  getKey,
  reduced,
  animation,
  minItems = 8,
  paused = false,
  ariaLabel,
  className,
}: MarqueeProps<T>) {
  if (items.length === 0) return null

  // Repeat the base set enough times that a single copy fills any viewport.
  const repeats = Math.max(1, Math.ceil(minItems / items.length))
  const sequence = Array.from({ length: repeats }, () => items).flat()

  const cards = reduced ? sequence : [...sequence, ...sequence]
  // Index at which the cards stop being the "primary" copy for screen readers.
  const duplicateFrom = reduced ? items.length : sequence.length

  return (
    <div
      className={cn(
        'marquee-frame',
        reduced && 'no-scrollbar touch-pan-x overflow-x-auto',
        className,
      )}
      aria-label={ariaLabel}
      role={ariaLabel ? 'group' : undefined}
      tabIndex={reduced ? 0 : undefined}
    >
      <div
        className={cn(
          'flex w-max',
          !reduced && 'marquee-track will-change-transform',
          !reduced && animation,
          !reduced && paused && 'is-paused',
        )}
      >
        {cards.map((item, index) => (
          <Fragment key={`${getKey(item, index)}-${index}`}>
            {renderItem(item, {
              duplicate: index >= duplicateFrom,
              index,
            })}
          </Fragment>
        ))}
      </div>
    </div>
  )
}

interface MarqueePauseButtonProps {
  paused: boolean
  onToggle: () => void
  className?: string
}

/**
 * Accessible control (WCAG 2.2.2) for the auto-moving strips. Only rendered for
 * motion-enabled users; reduced-motion users already get a still, scrollable row.
 */
export function MarqueePauseButton({
  paused,
  onToggle,
  className,
}: MarqueePauseButtonProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={paused}
      className={cn(
        'inline-flex min-h-[48px] shrink-0 items-center gap-2 rounded-md border border-hairline bg-surface px-5 font-display text-xs font-semibold uppercase tracking-[0.14em] text-muted transition-colors hover:border-accent hover:text-white',
        className,
      )}
    >
      {paused ? (
        <Play className="h-4 w-4 text-accent" aria-hidden="true" />
      ) : (
        <Pause className="h-4 w-4 text-accent" aria-hidden="true" />
      )}
      {paused ? 'Play gallery' : 'Pause gallery'}
    </button>
  )
}
