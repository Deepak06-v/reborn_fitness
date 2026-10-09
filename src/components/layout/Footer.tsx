import { Instagram } from 'lucide-react'
import { brand, navLinks, social, trainer } from '../../data/site'
import { useScrollTo } from '../../hooks/useScrollTo'

export function Footer() {
  const scrollTo = useScrollTo()

  return (
    <footer className="border-t border-hairline bg-surface/40 pb-[calc(var(--bar-h)+2rem)] pt-14 lg:pb-14">
      <div className="section-shell flex flex-col gap-10">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-sm">
            <div className="flex items-center gap-3">
              <img
                src="./logo.png"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = './logo.svg'
                }}
                alt="REBORN FITNESS"
                className="h-10 w-10 rounded-md border border-hairline bg-surface p-1 object-contain"
              />
              <div>
                <span className="font-display text-base font-bold uppercase tracking-[0.16em] text-white">
                  {brand.name}
                </span>
                <p className="font-mono text-[0.625rem] uppercase tracking-[0.16em] text-accent">
                  {brand.venueLine}
                </p>
              </div>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-muted">
              {brand.subheading}
            </p>
          </div>

          <nav
            className="flex flex-col gap-2"
            aria-label="Footer"
          >
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={(event) => {
                  event.preventDefault()
                  scrollTo(link.href)
                }}
                className="min-h-[44px] font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-dim transition-colors hover:text-accent"
              >
                {link.label}
              </a>
            ))}
          </nav>

          <div className="flex flex-col gap-3">
            <p className="font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-dim">
              Trainer / Contact · <span className="text-muted">{trainer.name}</span>
            </p>
            <a
              href={brand.phoneHref}
              className="min-h-[44px] font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-dim transition-colors hover:text-accent"
            >
              {brand.phoneDisplay}
            </a>
            <a
              href={brand.emailHref}
              className="min-h-[44px] font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-dim transition-colors hover:text-accent"
            >
              {brand.emailDisplay}
            </a>
            <a
              href={social.instagram.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-flex min-h-[44px] items-center gap-2 font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-dim transition-colors hover:text-accent"
            >
              <Instagram className="h-4 w-4" aria-hidden="true" />
              Follow Us on Instagram
            </a>
          </div>
        </div>

        <div className="rule" />

        <div className="flex flex-col gap-2 text-[0.6875rem] text-dim sm:flex-row sm:items-center sm:justify-between">
          <p className="font-mono uppercase tracking-[0.16em]">
            {brand.address}
          </p>
          <p className="font-mono uppercase tracking-[0.16em]">
            © {new Date().getFullYear()} {brand.name}
          </p>
        </div>
      </div>
    </footer>
  )
}