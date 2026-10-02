# RAW HEAVY METAL GYM - Neo-Brutalist Web Application Specification

**Date:** 2026-10-02
**Status:** Approved for Implementation
**Stack:** Vite + React 18 + TypeScript + Tailwind CSS + GSAP + Lenis + Lucide React

---

## 1. Project Overview

### 1.1 Purpose
Build a high-converting, mobile-first, minimal Neo-Brutalist web application for "RAW HEAVY METAL GYM" that communicates raw training culture through stark visual design, smooth scroll-driven animations, and frictionless user interactions.

### 1.2 Success Criteria
- Lighthouse Performance > 90
- Mobile-first responsive (375px–430px primary)
- Smooth 60fps scroll animations via Lenis + GSAP
- Accessible (WCAG AA): focus states, reduced motion, semantic HTML
- Conversion-focused: clear CTAs, minimal friction to membership/merch purchase

### 1.3 Target Audience
Serious lifters, powerlifters, strength athletes seeking no-nonsense training environment. Design must feel authoritative, raw, and premium without being pretentious.

---

## 2. Architecture

### 2.1 Tech Stack
| Layer | Technology | Version |
|-------|------------|---------|
| Build | Vite | 5.x |
| Framework | React | 18.x |
| Language | TypeScript | 5.x |
| Styling | Tailwind CSS | 3.4.x |
| Animation | GSAP + ScrollTrigger | 3.12.x |
| Smooth Scroll | Lenis | 1.1.x |
| Icons | Lucide React | 0.4.x |
| Deployment | Vercel | - |

### 2.2 Project Structure
```
src/
├── components/
│   ├── ui/              # Reusable primitives (Button, Card, Badge, Input, Icon)
│   ├── layout/          # Header, Footer, MobileNavDrawer
│   ├── sections/        # Hero, Membership, Merch, Contact
│   ├── animations/      # ScrollReveal, StaggerText, Parallax
│   └── providers/       # ScrollProvider, CartProvider, UIProvider
├── hooks/
│   ├── useScrollAnimation.ts
│   ├── useCart.ts
│   ├── useMobileMenu.ts
│   └── useIntersectionObserver.ts
├── context/
│   ├── CartContext.tsx
│   └── UIContext.tsx
├── styles/
│   ├── tokens.css       # CSS custom properties (design tokens)
│   ├── globals.css      # Tailwind imports + global styles
│   └── animations.css   # Keyframe animations
├── utils/
│   ├── gsap-helpers.ts  # GSAP utility functions
│   ├── lenis-setup.ts   # Lenis initialization
│   └── formatters.ts    # Price, phone, etc.
├── data/
│   ├── membership.ts    # Membership tier data
│   ├── products.ts      # Merch product data
│   └── gym-info.ts      # Hours, address, specs
├── types/
│   └── index.ts         # TypeScript interfaces
├── App.tsx
├── main.tsx
└── vite-env.d.ts
```

### 2.3 Key Architectural Patterns

**Centralized ScrollProvider**
- Single Lenis instance initialized at app root
- GSAP ticker sync: `gsap.ticker.add((time) => lenis.raf(time * 1000))`
- Provides `lenis` instance via Context for components needing scroll control
- Handles cleanup: `ScrollTrigger.getAll().forEach(t => t.kill())` on unmount

**Context Providers at Root**
- `CartProvider`: Cart state (items, open/close, totals)
- `UIProvider`: Mobile menu, modal states, scroll lock coordination
- Both use `useReducer` for predictable state updates

**Animation Safety**
- All GSAP animations in `useEffect` with cleanup or `useGSAP` hook
- `gsap.matchMedia()` for responsive animation enabling/disabling
- `ScrollTrigger.batch()` for multiple similar elements

---

## 3. Design System

### 3.1 Color Palette (CSS Custom Properties)
```css
:root {
  --color-canvas: #0A0A0A;           /* Deep dark background */
  --color-surface: #121212;          /* Section backgrounds */
  --color-surface-elevated: #181818; /* Card backgrounds */
  --color-accent: #FFEE00;           /* Electric yellow - primary CTAs */
  --color-accent-hover: #E6D700;     /* Yellow hover state */
  --color-white: #FFFFFF;            /* High contrast headers */
  --color-muted: #888888;            /* Secondary text */
  --color-border: #262626;           /* Default borders */
  --color-border-hover: #FFEE00;     /* Hover border state */
}
```

### 3.2 Typography
| Role | Font | Fallback | Usage |
|------|------|----------|-------|
| Display | Archivo Black | Syne, Anton, system-ui | Headlines, hero text, stats |
| Body | Plus Jakarta Sans | Inter, system-ui | Body copy, UI labels, prices |

### 3.3 Spacing Scale
```css
--space-xs: 0.25rem;   /* 4px */
--space-sm: 0.5rem;    /* 8px */
--space-md: 1rem;      /* 16px */
--space-lg: 1.5rem;    /* 24px */
--space-xl: 2rem;      /* 32px */
--space-2xl: 3rem;     /* 48px */
--space-3xl: 4rem;     /* 64px */
--space-4xl: 6rem;     /* 96px */
```

### 3.4 Shadows & Borders
```css
--shadow-brutal: 4px 4px 0 0 var(--color-accent);
--shadow-brutal-hover: 6px 6px 0 0 var(--color-accent);
--shadow-card: 0 0 0 2px var(--color-border);

/* All borders: 2px solid, sharp corners (0 radius) */
```

### 3.5 Tailwind Integration
All tokens mapped to Tailwind utilities via `tailwind.config.ts`:
- Custom colors: `bg-canvas`, `bg-surface`, `bg-surface-elevated`, `text-accent`, `border-border`
- Custom fonts: `font-display`, `font-body`
- Custom shadows: `shadow-brutal`, `shadow-brutal-hover`
- Custom spacing scale using CSS variables

---

## 4. Components Specification

### 4.1 UI Primitives (`components/ui/`)

#### Button
```tsx
interface ButtonProps {
  variant: 'primary' | 'secondary' | 'ghost';
  size: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  asChild?: boolean; // For use with Link
}
```
- **Primary**: Yellow bg (`#FFEE00`), black text, 2px black border, `shadow-brutal`, hover: `translate(-2px, -2px)` + `shadow-brutal-hover`
- **Secondary**: Transparent, 2px yellow border, yellow text, hover: yellow bg
- **Ghost**: Text only, yellow underline on hover
- All: `font-display`, uppercase, sharp corners

#### Card
```tsx
interface CardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean; // Enables border transition to yellow
}
```
- Background: `var(--color-surface-elevated)`
- Border: `2px solid var(--color-border)`
- Hover: Border color transitions to `var(--color-accent)` over 200ms

#### Badge
```tsx
interface BadgeProps {
  children: React.ReactNode;
  variant: 'popular' | 'new' | 'sale';
}
```
- **Popular**: Yellow bg, black text, `font-display`, uppercase
- **New**: White bg, black text
- **Sale**: Red accent (if needed)

### 4.2 Layout Components (`components/layout/`)

#### Header
- Fixed position, `top-0 left-0 right-0`, `z-50`
- Background: `rgba(10, 10, 10, 0.9)` with `backdrop-blur-sm`
- Desktop: Logo left, nav center, cart + mobile menu trigger right
- Mobile: Logo left, hamburger right (opens MobileNavDrawer)
- Logo: "RAW" in display font, "HEAVY METAL GYM" in body font

#### MobileNavDrawer
- Full-screen fixed overlay, `z-[200]`
- Animates in: `translateY(-100%)` → `translateY(0)`, 400ms `expo.out`
- Staggered nav link reveal (0.08s stagger)
- Contains: Nav links, contact info, social icons, close button
- Body scroll locked via `lenis.stop()` when open

#### Footer
- Minimal: Logo, hours summary, social links (Instagram, YouTube), copyright
- Border-top: `2px solid var(--color-border)`
- Padding: `py-3xl` (mobile), `py-4xl` (desktop)

### 4.3 Section Components (`components/sections/`)

#### Hero (`sections/Hero.tsx`)
```tsx
// Data from data/gym-info.ts
interface HeroData {
  headline: string;        // "NO EXCUSES. JUST RESULTS."
  subheadline: string;     // 2-line statement
  stats: Stat[];           // 3 stats with animated counters
  facilities: Facility[];  // Equipment highlights
}
```
- **Headline**: Split into lines, `StaggerText` reveal (lines, 0.08s stagger)
- **Subheadline**: Fade-up reveal, delayed 0.2s after headline
- **Stats Grid**: 3 columns (mobile: stacked), each with `Counter` animation on scroll
- **Facilities**: Grid of cards with icon + label, hover border transition

#### Membership (`sections/Membership.tsx`)
```tsx
// Data from data/membership.ts
interface MembershipTier {
  id: 'day' | 'monthly' | 'annual';
  name: string;
  priceMonthly: number;
  priceAnnual: number;
  features: string[];
  ctaText: string;
  popular?: boolean;
}
```
- **Billing Toggle**: Monthly/Annual switch (Context-driven), shows savings badge on Annual
- **Cards**: 3 columns desktop, horizontal scroll-snap mobile
- **Popular Tier**: Yellow border, "MOST POPULAR" badge, elevated shadow
- **Feature List**: Check icons (Lucide `Check`), muted text
- **CTA**: Primary button, full-width on mobile

#### Merch (`sections/Merch.tsx`)
```tsx
// Data from data/products.ts
interface Product {
  id: string;
  name: string;
  price: number;
  image: string;
  description?: string;
}
```
- **Carousel**: CSS scroll-snap horizontal (mobile), CSS Grid (desktop ≥768px)
- **Product Card**: Image (aspect-square), name, price, "QUICK ADD" button
- **CartDrawer**: Slide-in from right (300ms `expo.out`), backdrop, quantity selectors, subtotal, checkout CTA
- **Cart State**: Managed via `CartContext`, persists to localStorage

#### Contact (`sections/Contact.tsx`)
```tsx
// Data from data/gym-info.ts
interface ContactData {
  phone: string;           // Click-to-call tel:
  email: string;           // mailto:
  hours: Hours[];          // Day + hours, with "24/7" indicator
  address: Address;        // Street, city, postal, country
  mapEmbedUrl: string;     // Google Maps iframe src
  mapDeepLink: string;     // https://maps.google.com/?q=...
}
```
- **Contact Bar**: 3 buttons (Call, Email, Maps) - full-width mobile, inline desktop
- **Hours**: List with live "OPEN NOW (24/7)" green dot indicator
- **Map**: Iframe embed (dark mode styled via URL params), 16:9 aspect
- **Deep Link Button**: "OPEN IN GOOGLE MAPS" - opens native maps app
- **Address**: Display + copy-to-clipboard button with toast confirmation

### 4.4 Animation Components (`components/animations/`)

#### ScrollReveal
```tsx
interface ScrollRevealProps {
  children: React.ReactNode;
  variant: 'fade-up' | 'scale-in' | 'slide-left' | 'slide-right';
  delay?: number;
  duration?: number;
  className?: string;
}
```
- Wraps content in `div` with `ref`
- Creates `ScrollTrigger` on mount, kills on unmount
- Variants map to GSAP `from` values

#### StaggerText
```tsx
interface StaggerTextProps {
  children: string;
  split: 'lines' | 'words' | 'chars';
  stagger?: number;        // Default 0.08
  className?: string;
  tag?: 'h1' | 'h2' | 'p' | 'span';
}
```
- Splits text into spans (lines/words/chars)
- Each span: `opacity: 0, y: '100%'` → `opacity: 1, y: 0`
- Uses `gsap.utils.toArray` + `gsap.timeline` with stagger

#### Parallax
```tsx
interface ParallaxProps {
  children: React.ReactNode;
  speed?: number;          // 0.1 - 0.5
  className?: string;
}
```
- Background moves slower than scroll
- `gsap.to(element, { yPercent: -speed * 100, scrollTrigger: { scrub: true } })`

---

## 5. Data Models

### 5.1 TypeScript Interfaces (`types/index.ts`)
```typescript
export interface MembershipTier {
  id: 'day' | 'monthly' | 'annual';
  name: string;
  priceMonthly: number;
  priceAnnual: number;
  features: string[];
  ctaText: string;
  popular?: boolean;
}

export interface Product {
  id: string;
  name: string;
  price: number;
  image: string;
  description?: string;
}

export interface CartItem extends Product {
  quantity: number;
}

export interface CartState {
  items: CartItem[];
  isOpen: boolean;
  addItem: (product: Product) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  toggleCart: () => void;
  clearCart: () => void;
  subtotal: number;
  itemCount: number;
}

export interface UIState {
  isMobileMenuOpen: boolean;
  toggleMobileMenu: () => void;
  closeMobileMenu: () => void;
}

export interface GymInfo {
  name: string;
  headline: string;
  subheadline: string;
  stats: Stat[];
  facilities: Facility[];
  contact: ContactData;
}

export interface Stat {
  label: string;
  value: number;
  suffix?: string;
}

export interface Facility {
  icon: keyof typeof LucideIcons;
  label: string;
  description?: string;
}

export interface Hours {
  day: string;
  hours: string;
  is24h?: boolean;
}

export interface Address {
  street: string;
  city: string;
  postalCode: string;
  country: string;
}

export interface ContactData {
  phone: string;
  email: string;
  hours: Hours[];
  address: Address;
  mapEmbedUrl: string;
  mapDeepLink: string;
}
```

---

## 6. Animation Specifications

### 6.1 Lenis Configuration
```typescript
const lenis = new Lenis({
  duration: 1.2,
  easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
  smooth: true,
  smoothTouch: false,
  touchMultiplier: 2,
});
```

### 6.2 Section Reveal Animations
| Variant | From | To | Duration | Ease |
|---------|------|-----|----------|------|
| fade-up | `{ opacity: 0, y: 60 }` | `{ opacity: 1, y: 0 }` | 1.0s | `power3.out` |
| scale-in | `{ opacity: 0, scale: 0.95 }` | `{ opacity: 1, scale: 1 }` | 0.8s | `power2.out` |
| slide-left | `{ opacity: 0, x: -60 }` | `{ opacity: 1, x: 0 }` | 1.0s | `power3.out` |

- Trigger: `top 85%`
- ToggleActions: `play none none reverse`
- Delay: `index * 0.1` for sequential sections

### 6.3 Staggered Text
- Split: Lines (headlines), Words (subheadlines)
- Stagger: 0.08s (lines), 0.04s (words)
- Per-element: `{ opacity: 0, y: '100%' }` → `{ opacity: 1, y: '0%' }`
- Duration: 1.2s, Ease: `expo.out`

### 6.4 Counter Animation
- Target: Stat value
- Duration: 2.0s
- Ease: `power2.out`
- Snap: `{ value: 1 }` for integer steps
- Trigger: `top 90%`, once: true

### 6.5 Hover Interactions (CSS)
```css
/* Buttons */
.btn-brutal:hover {
  transform: translate(-2px, -2px);
  box-shadow: var(--shadow-brutal-hover);
}

/* Cards */
.card-brutal:hover {
  border-color: var(--color-accent);
}

/* Product Images */
.product-image:hover {
  transform: scale(1.02);
}
```

### 6.6 Drawer Animations
| Drawer | Enter | Exit | Duration | Ease |
|--------|-------|------|----------|------|
| Cart | `x: '100%'` → `x: 0` | `x: 0` → `x: '100%'` | 300ms | `expo.out` / `expo.in` |
| Mobile Nav | `y: '-100%'` → `y: 0` | `y: 0` → `y: '-100%'` | 400ms | `expo.out` / `expo.in` |

- Backdrop: `opacity: 0` → `opacity: 1` (200ms)
- Body scroll lock: `lenis.stop()` on open, `lenis.start()` on close

### 6.7 Performance Optimizations
- `will-change: transform, opacity` on animated elements
- `ScrollTrigger.batch()` for stat counters, facility cards
- `gsap.matchMedia()` - disable parallax/complex animations on mobile (<768px)
- Reduced motion: `@media (prefers-reduced-motion: reduce)` disables all GSAP animations
- Cleanup: All ScrollTriggers killed in provider unmount

---

## 7. Responsive Breakpoints

| Breakpoint | Width | Usage |
|------------|-------|-------|
| Base (mobile) | 375px - 639px | Primary design target |
| sm | 640px | Large phones |
| md | 768px | Tablets - grid layouts activate |
| lg | 1024px | Desktop - full navigation |
| xl | 1280px | Large desktop - max container |

### Mobile-First Patterns
- **Navigation**: Hamburger → Full-screen drawer
- **Membership**: Horizontal scroll-snap cards
- **Merch**: Horizontal scroll-snap carousel
- **Hero Stats**: Stacked vertical
- **Contact**: Full-width action buttons
- **Touch Targets**: Minimum 48px height

---

## 8. Accessibility

### 8.1 Requirements
- Semantic HTML5: `header`, `nav`, `main`, `section`, `footer`, `article`
- Focus-visible: 2px yellow outline, 2px offset
- Color contrast: All text ≥ 4.5:1 (yellow on black = 19:1, white on black = 21:1)
- Reduced motion: Respect `prefers-reduced-motion`
- ARIA labels: Icon buttons, drawers, form inputs
- Keyboard navigation: All interactive elements reachable

### 8.2 Implementation
```css
/* Focus visible */
*:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

---

## 9. Google Maps Integration

### 9.1 Approach: Embed Iframe (No API Key)
```html
<iframe
  src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d...
    &style=feature:all|element:geometry|color:0x0a0a0a
    &style=feature:all|element:labels.text.fill|color:0xffffff
    &style=feature:all|element:labels.text.stroke|color:0x0a0a0a"
  width="100%"
  height="400"
  style="border: 2px solid var(--color-border);"
  allowfullscreen=""
  loading="lazy"
  referrerpolicy="no-referrer-when-downgrade"
></iframe>
```

### 9.2 Deep Link Button
```tsx
<a
  href="https://www.google.com/maps/search/?api=1&query=RAW+HEAVY+METAL+GYM+[ADDRESS]"
  target="_blank"
  rel="noopener noreferrer"
  className="btn-brutal"
>
  OPEN IN GOOGLE MAPS
</a>
```

---

## 10. Performance Budget

| Metric | Target |
|--------|--------|
| First Contentful Paint | < 1.5s |
| Largest Contentful Paint | < 2.5s |
| Total Blocking Time | < 200ms |
| Cumulative Layout Shift | < 0.1 |
| JavaScript Bundle (gzipped) | < 100KB |
| CSS Bundle (gzipped) | < 20KB |
| Lighthouse Performance | > 90 |

### Optimization Strategies
- Vite code splitting: Vendor chunk, route-based chunks (if multi-page)
- Image optimization: WebP, proper sizing, `loading="lazy"` below fold
- Font loading: `font-display: swap`, preload display font
- GSAP: Register only needed plugins (`ScrollTrigger`, `SplitText` if used)
- Lenis: Lightweight (~3KB), no heavy dependencies

---

## 11. Deployment (Vercel)

### 11.1 Build Configuration
```json
// vercel.json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite",
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ],
  "headers": [
    {
      "source": "/assets/(.*)",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }
      ]
    }
  ]
}
```

### 11.2 Environment Variables
- `VITE_GYM_ADDRESS` - For map deep link
- `VITE_GYM_PHONE` - For tel: links
- `VITE_GYM_EMAIL` - For mailto: links
- `VITE_MAP_EMBED_URL` - Google Maps iframe src

---

## 12. Implementation Phases

### Phase 1: Foundation (Day 1)
- Vite + React + TypeScript + Tailwind setup
- Design tokens (CSS variables + Tailwind config)
- Global styles, base components (Button, Card, Badge)
- ScrollProvider with Lenis + GSAP integration

### Phase 2: Layout & Navigation (Day 1-2)
- Header, Footer, MobileNavDrawer
- UIContext for mobile menu state
- Responsive navigation patterns

### Phase 3: Hero Section (Day 2)
- Staggered headline animation
- Stat counters with scroll-triggered count-up
- Facility highlights grid

### Phase 4: Membership Section (Day 2-3)
- Pricing cards with billing toggle
- Monthly/Annual price switching
- Feature lists, CTA buttons

### Phase 5: Merch Section (Day 3)
- Product carousel (scroll-snap mobile, grid desktop)
- CartDrawer with quantity management
- CartContext with localStorage persistence

### Phase 6: Contact Section (Day 3-4)
- Contact action buttons (tel:, mailto:, maps)
- Hours display with live status
- Google Maps iframe embed
- Address copy-to-clipboard

### Phase 7: Polish & Optimization (Day 4)
- Accessibility audit
- Performance optimization
- Cross-browser testing
- Vercel deployment configuration

---

## 13. Open Questions / Future Enhancements

1. **Analytics**: Add Plausible/GA4 for conversion tracking?
2. **CMS**: Content managed via headless CMS (Sanity, Contentful) or static files?
3. **Auth**: Member portal for class booking, check-in history?
4. **Payments**: Stripe integration for actual membership/merch purchases?
5. **i18n**: Multi-language support needed?
6. **PWA**: Offline support, install prompt?

---

## 14. Approval

**Design Review:** ✅ Approved
**Architecture Review:** ✅ Approved
**Component Design Review:** ✅ Approved
**Animation Design Review:** ✅ Approved
**Design Tokens Review:** ✅ Approved

**Next Step:** Invoke `writing-plans` skill to create detailed implementation plan.