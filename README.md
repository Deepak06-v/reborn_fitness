# REBORN FITNESS

Mobile-first, motion-driven marketing and booking site for a 24/7 biometric
performance gym. React + TypeScript + Tailwind CSS, with GSAP ScrollTrigger and
Lenis smooth scroll sharing a single requestAnimationFrame loop.

## Stack

- **React 18** + TypeScript (strict, `noUnusedLocals`, `noUnusedParameters`)
- **Vite 5** build with manual vendor chunks
- **Tailwind CSS 3** driven by RGB-channel tokens (`rgb(var(--color-x) / <alpha-value>)`)
- **GSAP 3** + `ScrollTrigger` for reveals, stagger and counters
- **Lenis** for inertia scrolling on desktop and touch
- **lucide-react** icons
- **react-qr-code** for the digital trial-pass QR

## Design tokens

| Token | Value | Use |
| --- | --- | --- |
| `--color-canvas` | `#09090b` | Obsidian base layer |
| `--color-surface` | `#131315` | Dark obsidian surface |
| `--color-card` / `--color-card-alt` | `#18181b` / `#201f22` | 80% glass cards, 16px blur |
| `--color-hairline` | `#27272a` | 1px borders, lift to accent at 40% |
| `--color-accent` | `#00f2fe` | Electric cyan CTAs and telemetry |
| `--color-lime` | `#39ff14` | Live status, achievement tags |
| `--color-muted` / `--color-dim` | `#a1a1aa` / `#71717a` | Specs text |

Radii follow the brief: `0.25rem` cards, `0.5rem` hero panels, `9999px` pills.
Glows: `0 0 24px -4px` for both cyan and lime.

## Sections

1. **Hero telemetry** — staggered headline, live occupancy feed, dual CTAs
2. **1-Day VIP Trial booking engine** — goal chips, day/time windows, validation,
   QR pass modal with booking ref, entry code and `.ics` calendar export
3. **Facility zones** — swipeable tab rail, per-zone specs, climate and capacity
4. **Memberships** — monthly/annual toggle (−20%), three tiers, lime checks
5. **Merch & fuel drop** — four products, quick add, glass cart drawer with subtotal
6. **Coaches** — certifications, focus, deep-links into the booking engine
7. **Location** — live status, `tel:`/`mailto:` actions, copy address, dark map
   container with glowing pin and Google Maps deep link
8. **FAQ** — accessible accordion

Mobile shell adds a sticky header with a pulsing `OPEN 24/7` lime dot, a
full-screen nav drawer, and a fixed thumb-reachable CTA bar. Every interactive
control is at least 48px.

## Scripts

```bash
npm run dev      # dev server on :5173
npm run build    # tsc -b + vite build
npm run lint     # eslint, zero warnings tolerated
npm run preview  # serve dist
```

## Accessibility & motion

- Scroll locking falls back to `body { overflow: hidden }` when reduced motion
  disables Lenis
- Drawers and the pass modal expose `role="dialog"`, `aria-modal`, Escape to
  close, initial focus, and focus restoration
- `prefers-reduced-motion: reduce` skips all GSAP tweens; counters and counters'
  final values render without animation
- Skip link, live-region telemetry labels, visible focus rings