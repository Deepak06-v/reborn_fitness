import { ArrowRight, Flame, Plus, ShoppingBag } from 'lucide-react'
import { products } from '../../data/products'
import { useCart } from '../../hooks/useCart'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { SectionHeading } from '../ui/SectionHeading'
import { ScrollReveal } from '../animations/ScrollReveal'

export function Merch() {
  const { addItem, count, openCart } = useCart()

  return (
    <section
      id="shop"
      className="scroll-mt-[var(--nav-h)] border-t border-hairline bg-surface/30 py-20 sm:py-28"
    >
      <div className="section-shell">
        <SectionHeading
          eyebrow="Performance Fuel / 04"
          title="Curated gear & fuel drop"
          description="Small batch essentials built for the work. Restocked monthly, never warehoused for a year."
        />

        <ul className="mt-12 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {products.map((product, index) => (
            <ScrollReveal
              key={product.id}
              direction="rise"
              delay={index * 0.06}
            >
              <Card interactive className="flex h-full flex-col">
                <div className="relative aspect-square overflow-hidden rounded-t">
                  <img
                    src={product.image}
                    alt={product.name}
                    loading="lazy"
                    className="absolute inset-0 h-full w-full object-cover opacity-75 transition-transform duration-500 ease-out-expo hover:scale-105"
                  />
                  {product.limited ? (
                    <span className="absolute left-3 top-3 rounded-sm border border-accent bg-surface/90 px-2.5 py-1 font-mono text-[0.5625rem] font-bold uppercase tracking-[0.14em] text-accent shadow-[2px_2px_0px_0px_#262626]">
                      Limited drop
                    </span>
                  ) : null}
                </div>

                <div className="flex flex-1 flex-col p-4">
                  <h3 className="font-display text-xs font-semibold uppercase leading-snug tracking-[0.06em] text-white">
                    {product.name}
                  </h3>
                  <p className="mt-1.5 hidden text-xs leading-relaxed text-dim lg:block">
                    {product.description}
                  </p>

                  <div className="mt-3 flex items-center justify-between gap-2">
                    <span className="font-mono text-sm font-bold tracking-[0.06em] text-white">
                      ${product.price}
                    </span>
                    <button
                      type="button"
                      onClick={() => addItem(product.id)}
                      aria-label={`Quick add ${product.name} to cart`}
                      className="flex h-10 w-10 items-center justify-center rounded-md border border-accent bg-surface text-accent transition-all hover:bg-accent hover:text-canvas shadow-[2px_2px_0px_0px_#FFEE00] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
                    >
                      <Plus className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </Card>
            </ScrollReveal>
          ))}
        </ul>

        <div className="mt-8 flex justify-center">
          <Button
            variant="secondary"
            size="lg"
            onClick={openCart}
            className="w-full sm:w-auto"
          >
            <ShoppingBag className="h-4 w-4" aria-hidden="true" />
            View cart{count > 0 ? ` (${count})` : ''}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>

        <p className="mt-6 flex items-center justify-center gap-2 text-center font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-dim">
          <Flame className="h-3.5 w-3.5 text-lime" aria-hidden="true" />
          Members earn fuel points on every equipment order
        </p>
      </div>
    </section>
  )
}