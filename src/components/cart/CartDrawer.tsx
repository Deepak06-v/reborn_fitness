import { useEffect, useRef, useState } from 'react'
import { gsap } from 'gsap'
import { Minus, Plus, ShoppingBag, Trash2, X } from 'lucide-react'
import { useCart } from '../../hooks/useCart'
import { cn } from '../../lib/utils'
import { Button } from '../ui/Button'

function formatCurrency(value: number) {
  return `$${value.toFixed(2)}`
}

export function CartDrawer() {
  const { isOpen, closeCart, lines, subtotal, count, increment, decrement, removeItem } =
    useCart()
  const [mounted, setMounted] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (isOpen) setMounted(true)
  }, [isOpen])

  useEffect(() => {
    if (!mounted) return
    const el = panelRef.current
    if (!el) return

    const ctx = gsap.context(() => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        gsap.set(el, { xPercent: isOpen ? 0 : '100%' })
        return
      }
      gsap.to(el, {
        xPercent: isOpen ? 0 : '100%',
        duration: 0.5,
        ease: 'expo.out',
        onComplete: () => {
          if (!isOpen) setMounted(false)
        },
      })
    }, el)

    return () => ctx.revert()
  }, [isOpen, mounted])

  useEffect(() => {
    if (!isOpen) return
    const restore = document.activeElement as HTMLElement | null
    closeRef.current?.focus()

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeCart()
    }
    document.addEventListener('keydown', onKey)

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previousOverflow
      restore?.focus?.()
    }
  }, [isOpen, closeCart])

  if (!mounted) return null

  return (
    <div className="fixed inset-0 z-[115]">
      <div
        className="absolute inset-0 bg-canvas/85 backdrop-blur-sm"
        onClick={closeCart}
        aria-hidden="true"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Shopping cart"
        className="absolute inset-y-0 right-0 flex w-full max-w-sm flex-col border-l border-accent/20 bg-surface/95 backdrop-blur-[16px]"
      >
        <div className="flex items-center justify-between border-b border-hairline p-5">
          <span className="flex items-center gap-2.5">
            <ShoppingBag className="h-4 w-4 text-accent" aria-hidden="true" />
            <h2 className="font-display text-sm font-bold uppercase tracking-[0.16em] text-white">
              Your cart
            </h2>
            <span className="font-mono text-[0.6875rem] text-dim">
              [{count}]
            </span>
          </span>
          <button
            ref={closeRef}
            type="button"
            onClick={closeCart}
            aria-label="Close cart"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-hairline text-muted transition-colors hover:border-accent/40 hover:text-white"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {lines.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
            <ShoppingBag
              className="h-8 w-8 text-dim"
              aria-hidden="true"
            />
            <p className="text-sm text-muted">Your cart is empty.</p>
            <Button variant="ghost" onClick={closeCart}>
              Continue shopping
            </Button>
          </div>
        ) : (
          <>
            <ul className="flex-1 overflow-y-auto p-5">
              {lines.map(({ product, quantity }) => (
                <li
                  key={product.id}
                  className="flex gap-4 border-b border-hairline py-4 first:pt-0"
                >
                  <img
                    src={product.image}
                    alt=""
                    loading="lazy"
                    className="h-20 w-20 shrink-0 rounded border border-hairline object-cover opacity-80"
                  />
                  <div className="flex flex-1 flex-col">
                    <p className="font-display text-xs font-semibold uppercase leading-snug tracking-[0.06em] text-white">
                      {product.name}
                    </p>
                    <p className="mt-1 font-mono text-xs text-muted">
                      {formatCurrency(product.price)}
                    </p>

                    <div className="mt-auto flex items-center justify-between gap-2 pt-3">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => decrement(product.id)}
                          aria-label={`Decrease ${product.name} quantity`}
                          className="flex h-9 w-9 items-center justify-center rounded-md border border-hairline text-muted transition-colors hover:border-accent hover:text-white"
                        >
                          <Minus className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                        <span className="w-6 text-center font-mono text-sm text-white">
                          {quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => increment(product.id)}
                          aria-label={`Increase ${product.name} quantity`}
                          className="flex h-9 w-9 items-center justify-center rounded-md border border-hairline text-muted transition-colors hover:border-accent hover:text-white"
                        >
                          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => removeItem(product.id)}
                        aria-label={`Remove ${product.name}`}
                        className="flex h-9 w-9 items-center justify-center rounded-md border border-hairline text-dim transition-colors hover:border-red-400/50 hover:text-red-300"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            <div className="border-t border-hairline p-5">
              <dl className="flex items-baseline justify-between">
                <dt className="label-telemetry">Subtotal</dt>
                <dd className="font-display text-2xl font-bold tracking-[-0.02em] text-white">
                  {formatCurrency(subtotal)}
                </dd>
              </dl>
              <p className="mt-2 text-xs text-dim">
                Taxes and local delivery are calculated at checkout.
              </p>
              <Button
                size="lg"
                fullWidth
                className="mt-4"
                onClick={closeCart}
              >
                Proceed to checkout
              </Button>
              <p
                className={cn(
                  'mt-3 text-center font-mono text-[0.625rem] uppercase tracking-[0.14em] text-dim',
                )}
              >
                Secure biometric checkout
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}