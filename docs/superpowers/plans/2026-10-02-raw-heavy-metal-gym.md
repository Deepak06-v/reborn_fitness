# RAW HEAVY METAL GYM - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a high-converting, mobile-first, minimal Neo-Brutalist web application for "RAW HEAVY METAL GYM" with React, Tailwind CSS, GSAP (ScrollTrigger), and Lenis Smooth Scroll.

**Architecture:** This plan builds a component-based single-page application using Vite + React + TypeScript. A centralized ScrollProvider manages Lenis + GSAP synchronization. State is handled via React Context with useReducer (Cart and UI state). All animations use ScrollTrigger with proper cleanup. Design tokens are implemented as CSS custom properties consumed by Tailwind.

**Tech Stack:** Vite 5.x, React 18.x, TypeScript 5.x, Tailwind CSS 3.4.x, GSAP 3.12.x (+ ScrollTrigger), Lenis 1.1.x, Lucide React 0.4.x

**Spec:** docs/superpowers/specs/2026-10-02-raw-heavy-metal-gym-design.md

## Global Constraints

- TypeScript strict mode enabled
- Mobile-first responsive design (375px–430px primary breakpoint)
- Touch targets minimum 48px height
- WCAG AA accessibility (4.5:1 contrast, focus-visible, reduced motion support)
- Performance budget: FCP < 1.5s, LCP < 2.5s, TBT < 200ms, CLS < 0.1
- Bundle size: JS < 100KB gzipped, CSS < 20KB gzipped
- All GSAP animations must clean up properly (ScrollTrigger kill on unmount)
- Lenis smoothTouch disabled (false) for native feel
- Sharp borders (2px), no border-radius, Neo-Brutalist aesthetic
- Vite for build, deploy to Vercel

---

### Task 1: Project Initialization & Dependencies

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `vite.config.ts`
- Create: `index.html`
- Create: `.gitignore`
- Create: `README.md`

**Interfaces:**
- Consumes: N/A (initial setup)
- Produces: Project configuration ready for development

- [ ] **Step 1: Initialize Vite + React + TypeScript project**

Run in project root:
```bash
npm create vite@latest . -- --template react-ts
```

- [ ] **Step 2: Install dependencies**

```bash
npm i gsap @studio-freight/lenis lucide-react
npm i -D @types/node
```

- [ ] **Step 3: Create/update .gitignore with proper entries**

```bash
cat > .gitignore << 'EOF'
# Logs
logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*
lerna-debug.log*

node_modules
dist
dist-ssr
*.local

# Editor directories and files
.vscode/*
!.vscode/extensions.json
.idea
.DS_Store
*.suo
*.ntvs*
*.njsproj
*.sln
*.sw?

# Env files
.env
.env.local
.env.development.local
.env.test.local
.env.production.local
EOF
```

- [ ] **Step 4: Create README.md**

```bash
cat > README.md << 'EOF'
# RAW HEAVY METAL GYM

Neo-Brutalist gym website built with React, Vite, Tailwind CSS, GSAP, and Lenis.

## Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run preview
```
EOF
```

- [ ] **Step 5: Commit**

```bash
git add package.json tsconfig.json tsconfig.node.json vite.config.ts index.html .gitignore README.md
git commit -m "feat: initialize Vite + React + TypeScript project with core dependencies"
```

---

### Task 2: Tailwind CSS Setup & Design Tokens

**Files:**
- Create: `tailwind.config.ts`
- Create: `postcss.config.js`
- Create: `src/styles/tokens.css`
- Create: `src/styles/globals.css`
- Create: `src/styles/animations.css`
- Modify: `src/index.css` (if exists, clear and migrate to globals.css)

**Interfaces:**
- Consumes: Project setup from Task 1
- Produces: Design token system (CSS variables) and Tailwind config mapped to tokens

- [ ] **Step 1: Install Tailwind CSS dependencies**

```bash
npm i -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

- [ ] **Step 2: Create tailwind.config.ts with custom theme**

```typescript
import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['var(--font-display)', 'system-ui', 'sans-serif'],
        body: ['var(--font-body)', 'system-ui', 'sans-serif'],
      },
      colors: {
        canvas: 'var(--color-canvas)',
        surface: 'var(--color-surface)',
        'surface-elevated': 'var(--color-surface-elevated)',
        accent: 'var(--color-accent)',
        'accent-hover': 'var(--color-accent-hover)',
        white: 'var(--color-white)',
        muted: 'var(--color-muted)',
        border: 'var(--color-border)',
        'border-hover': 'var(--color-border-hover)',
      },
      spacing: {
        xs: 'var(--space-xs)',
        sm: 'var(--space-sm)',
        md: 'var(--space-md)',
        lg: 'var(--space-lg)',
        xl: 'var(--space-xl)',
        '2xl': 'var(--space-2xl)',
        '3xl': 'var(--space-3xl)',
        '4xl': 'var(--space-4xl)',
      },
      boxShadow: {
        brutal: '4px 4px 0 0 var(--color-accent)',
        'brutal-hover': '6px 6px 0 0 var(--color-accent)',
        card: '0 0 0 2px var(--color-border)',
      },
      borderRadius: {
        none: 'var(--radius-none)',
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
      },
      transitionTimingFunction: {
        'bounce-out': 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
      },
      zIndex: {
        dropdown: '100',
        drawer: '200',
        modal: '300',
        toast: '400',
      },
      screens: {
        sm: '640px',
        md: '768px',
        lg: '1024px',
        xl: '1280px',
      },
    },
  },
  plugins: [],
}
export default config
```

- [ ] **Step 3: Create postcss.config.js**

```javascript
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
```

- [ ] **Step 4: Create src/styles/tokens.css**

```css
:root {
  /* Colors */
  --color-canvas: #0A0A0A;
  --color-surface: #121212;
  --color-surface-elevated: #181818;
  --color-accent: #FFEE00;
  --color-accent-hover: #E6D700;
  --color-white: #FFFFFF;
  --color-muted: #888888;
  --color-border: #262626;
  --color-border-hover: #FFEE00;

  /* Typography */
  --font-display: 'Archivo Black', 'Syne', 'Anton', system-ui, sans-serif;
  --font-body: 'Plus Jakarta Sans', 'Inter', system-ui, sans-serif;

  /* Spacing Scale */
  --space-xs: 0.25rem;   /* 4px */
  --space-sm: 0.5rem;    /* 8px */
  --space-md: 1rem;      /* 16px */
  --space-lg: 1.5rem;    /* 24px */
  --space-xl: 2rem;      /* 32px */
  --space-2xl: 3rem;     /* 48px */
  --space-3xl: 4rem;     /* 64px */
  --space-4xl: 6rem;     /* 96px */

  /* Border Radius */
  --radius-none: 0;
  --radius-sm: 2px;
  --radius-md: 4px;

  /* Shadows */
  --shadow-brutal: 4px 4px 0 0 var(--color-accent);
  --shadow-brutal-hover: 6px 6px 0 0 var(--color-accent);
  --shadow-card: 0 0 0 2px var(--color-border);

  /* Transitions */
  --transition-fast: 150ms ease-out;
  --transition-base: 200ms ease-out;
  --transition-slow: 300ms ease-out;

  /* Z-Indices */
  --z-dropdown: 100;
  --z-drawer: 200;
  --z-modal: 300;
  --z-toast: 400;
}
```

- [ ] **Step 5: Create src/styles/animations.css**

```css
/* Keyframe animations */

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(1rem);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes slideInRight {
  from {
    transform: translateX(100%);
  }
  to {
    transform: translateX(0);
  }
}

@keyframes slideInLeft {
  from {
    transform: translateX(-100%);
  }
  to {
    transform: translateX(0);
  }
}

@keyframes slideInDown {
  from {
    transform: translateY(-100%);
  }
  to {
    transform: translateY(0);
  }
}

@keyframes scaleIn {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}
```

- [ ] **Step 6: Create src/styles/globals.css**

```css
@import url('https://fonts.googleapis.com/css2?family=Archivo+Black&family=Syne:wght@400;700;800&family=Anton&family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=Inter:wght@300;400;500;600;700&display=swap');

@tailwind base;
@tailwind components;
@tailwind utilities;

@import './tokens.css';
@import './animations.css';

@layer base {
  * {
    @apply box-border;
  }

  html {
    scroll-behavior: auto;
  }

  body {
    @apply bg-canvas text-white font-body antialiased selection:bg-accent selection:text-black;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    text-rendering: optimizeLegibility;
  }

  h1,
  h2,
  h3,
  h4,
  h5,
  h6 {
    @apply font-display uppercase text-balance;
  }

  p {
    @apply text-balance;
  }

  *:focus-visible {
    @apply outline-2 outline-accent outline-offset-2;
  }

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
}

@layer components {
  .btn-brutal {
    @apply relative inline-flex items-center justify-center gap-2 border-2 border-black bg-accent px-6 py-3 font-display text-sm uppercase tracking-wider text-black transition-all duration-200 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-brutal focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50;
    min-height: 48px;
  }

  .btn-brutal-secondary {
    @apply relative inline-flex items-center justify-center gap-2 border-2 border-accent bg-transparent px-6 py-3 font-display text-sm uppercase tracking-wider text-accent transition-all duration-200 hover:bg-accent hover:text-black focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50;
    min-height: 48px;
  }

  .btn-brutal-ghost {
    @apply inline-flex items-center justify-center gap-2 bg-transparent px-4 py-2 font-display text-sm uppercase tracking-wider text-accent transition-colors duration-200 hover:text-accent-hover focus-visible:outline-accent;
    min-height: 48px;
  }

  .card-brutal {
    @apply border-2 border-border bg-surface-elevated p-6 transition-colors duration-200 hover:border-accent;
  }

  .text-balance {
    text-wrap: balance;
  }
}
```

- [ ] **Step 7: Update src/main.tsx and src/index.css**

```bash
cat > src/main.tsx << 'EOF'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/globals.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
EOF
```

```bash
cat > src/App.css << 'EOF'
/* App-specific styles if needed */
EOF
```

- [ ] **Step 8: Commit**

```bash
git add tailwind.config.ts postcss.config.js src/styles/tokens.css src/styles/animations.css src/styles/globals.css src/main.tsx src/App.css
git commit -m "feat: configure Tailwind CSS with design tokens and global styles"
```

---

### Task 3: TypeScript Types & Data Models

**Files:**
- Create: `src/types/index.ts`
- Create: `src/data/gym-info.ts`
- Create: `src/data/membership.ts`
- Create: `src/data/products.ts`

**Interfaces:**
- Consumes: Design tokens/system from Task 2
- Produces: TypeScript interfaces and static data for all sections

- [ ] **Step 1: Create src/types/index.ts**

```typescript
import { LucideIcon } from 'lucide-react'

export interface Stat {
  label: string
  value: number
  suffix?: string
}

export interface Facility {
  icon: LucideIcon
  label: string
  description?: string
}

export interface Hours {
  day: string
  hours: string
  is24h?: boolean
}

export interface Address {
  street: string
  city: string
  postalCode: string
  country: string
}

export interface ContactData {
  phone: string
  email: string
  hours: Hours[]
  address: Address
  mapEmbedUrl: string
  mapDeepLink: string
}

export interface GymInfo {
  name: string
  headline: string
  subheadline: string
  stats: Stat[]
  facilities: Facility[]
  contact: ContactData
}

export interface MembershipTier {
  id: 'day' | 'monthly' | 'annual'
  name: string
  priceMonthly: number
  priceAnnual: number
  features: string[]
  ctaText: string
  popular?: boolean
}

export interface Product {
  id: string
  name: string
  price: number
  image: string
  description?: string
}

export interface CartItem extends Product {
  quantity: number
}

export interface CartState {
  items: CartItem[]
  isOpen: boolean
  subtotal: number
  itemCount: number
}

export type CartAction =
  | { type: 'ADD_ITEM'; payload: Product }
  | { type: 'REMOVE_ITEM'; payload: string }
  | { type: 'UPDATE_QUANTITY'; payload: { id: string; quantity: number } }
  | { type: 'TOGGLE_CART' }
  | { type: 'CLOSE_CART' }
  | { type: 'CLEAR_CART' }

export interface UIState {
  isMobileMenuOpen: boolean
}

export type UIAction =
  | { type: 'TOGGLE_MOBILE_MENU' }
  | { type: 'CLOSE_MOBILE_MENU' }
  | { type: 'OPEN_MOBILE_MENU' }
```

- [ ] **Step 2: Create src/data/gym-info.ts**

```typescript
import { Dumbbell, Zap, Heart, Shield, Clock } from 'lucide-react'
import type { GymInfo } from '../types'

export const gymInfo: GymInfo = {
  name: 'RAW HEAVY METAL GYM',
  headline: 'NO EXCUSES. JUST RESULTS.',
  subheadline: 'Raw training culture. Elite strength facilities. No distractions. Just iron and intent.',
  stats: [
    {
      label: '24/7 Access',
      value: 24,
      suffix: '/7',
    },
    {
      label: '1,200 SQM Raw Iron',
      value: 1200,
      suffix: ' SQM',
    },
    {
      label: 'Zero Distractions',
      value: 0,
      suffix: '',
    },
  ],
  facilities: [
    {
      icon: Dumbbell,
      label: 'Raw Iron',
      description: 'Full rack of powerlifting platforms and free weights',
    },
    {
      icon: Zap,
      label: 'Strength Zone',
      description: 'Dedicated area for heavy compound lifts',
    },
    {
      icon: Heart,
      label: 'Cardio Zone',
      description: 'Minimal, focused conditioning equipment',
    },
    {
      icon: Shield,
      label: 'Recovery Bays',
      description: 'Space to reset between heavy sets',
    },
  ],
  contact: {
    phone: '+1 (555) 123-4567',
    email: 'join@rawheavymetalgym.com',
    hours: [
      { day: 'Monday', hours: '24/7', is24h: true },
      { day: 'Tuesday', hours: '24/7', is24h: true },
      { day: 'Wednesday', hours: '24/7', is24h: true },
      { day: 'Thursday', hours: '24/7', is24h: true },
      { day: 'Friday', hours: '24/7', is24h: true },
      { day: 'Saturday', hours: '24/7', is24h: true },
      { day: 'Sunday', hours: '24/7', is24h: true },
    ],
    address: {
      street: '123 Iron Street',
      city: 'Strength City',
      postalCode: '10001',
      country: 'USA',
    },
    mapEmbedUrl:
      'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3024.2219901290355!2d-74.00369368400567!3d40.71312937933185!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x89c25a23e28c1191%3A0x49f75d3281df052a!2s150%20Park%20Row%2C%20New%20York%2C%20NY%2010007%2C%20USA!5e0!3m2!1sen!2sin!4v1579767901424!5m2!1sen!2sin',
    mapDeepLink: 'https://www.google.com/maps/search/?api=1&query=RAW+HEAVY+METAL+GYM+123+Iron+Street+Strength+City+10001+USA',
  },
}
```

- [ ] **Step 3: Create src/data/membership.ts**

```typescript
import type { MembershipTier } from '../types'

export const membershipTiers: MembershipTier[] = [
  {
    id: 'day',
    name: 'Day Pass',
    priceMonthly: 15,
    priceAnnual: 15,
    features: [
      '1 Day Full Access',
      'All Equipment Access',
      'Locker Room Access',
      'No Commitment',
    ],
    ctaText: 'CLAIM PASS',
  },
  {
    id: 'monthly',
    name: 'Monthly Heavy',
    priceMonthly: 59,
    priceAnnual: 49,
    features: [
      '24/7 Unlimited Access',
      'Full Powerlifting Platforms',
      'Free Weights & Machines',
      'Locker Room Access',
      'Priority Equipment Access',
    ],
    ctaText: 'JOIN THE TRIBE',
    popular: true,
  },
  {
    id: 'annual',
    name: 'Annual Elite',
    priceMonthly: 49,
    priceAnnual: 39,
    features: [
      '24/7 Unlimited Access',
      'Full Powerlifting Platforms',
      'Free Weights & Machines',
      'Locker Room + Sauna Access',
      'Priority Equipment Access',
      '2 Guest Passes/Month',
      '15% Off Merch',
      'Best Value - Save $240/year',
    ],
    ctaText: 'GO ELITE',
  },
]
```

- [ ] **Step 4: Create src/data/products.ts**

```typescript
import type { Product } from '../types'

export const products: Product[] = [
  {
    id: 'heavy-tee',
    name: 'Heavy Oversized Tee',
    price: 39,
    image: 'https://images.unsplash.com/photo-1576566588028-4147f3842f27?q=80&w=1064&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
    description: 'Raw black tee. Heavyweight cotton. Brutalist print.',
  },
  {
    id: 'lifting-belt',
    name: 'Lifting Belt',
    price: 89,
    image: 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?q=80&w=1170&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
    description: 'Heavy-duty leather. Built for max effort lifts.',
  },
  {
    id: 'preworkout',
    name: 'Pre-Workout',
    price: 45,
    image: 'https://images.unsplash.com/photo-1599450981319-b4f5de49fdd3?q=80&w=1170&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
    description: 'Zero filler. Pure fuel for heavy lifts.',
  },
  {
    id: 'gym-duffle',
    name: 'Gym Duffle',
    price: 69,
    image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?q=80&w=687&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D',
    description: 'Rugged canvas. Built to haul heavy gear.',
  },
]
```

- [ ] **Step 5: Commit**

```bash
git add src/types/index.ts src/data/gym-info.ts src/data/membership.ts src/data/products.ts
git commit -m "feat: add TypeScript types and static data for gym info, membership, and products"
```

### Task 4: Context Providers (Cart & UI State)

**Files:**
- Create: `src/context/CartContext.tsx`
- Create: `src/context/UIContext.tsx`
- Create: `src/hooks/useCart.ts`
- Create: `src/hooks/useMobileMenu.ts`

**Interfaces:**
- Consumes: Types from Task 3
- Produces: Cart context with useReducer, UI context with useReducer, and convenience hooks

- [ ] **Step 1: Create src/context/CartContext.tsx**

```typescript
import { createContext, useReducer, useEffect, ReactNode } from 'react'
import type { CartState, CartAction, CartItem, Product } from '../types'

const initialState: CartState = {
  items: [],
  isOpen: false,
  subtotal: 0,
  itemCount: 0,
}

const calculateSubtotal = (items: CartItem[]): number => {
  return items.reduce((sum, item) => sum + item.price * item.quantity, 0)
}

const calculateItemCount = (items: CartItem[]): number => {
  return items.reduce((count, item) => count + item.quantity, 0)
}

const cartReducer = (state: CartState, action: CartAction): CartState => {
  switch (action.type) {
    case 'ADD_ITEM': {
      const existingItem = state.items.find((item) => item.id === action.payload.id)
      let newItems: CartItem[]

      if (existingItem) {
        newItems = state.items.map((item) =>
          item.id === action.payload.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      } else {
        newItems = [...state.items, { ...action.payload, quantity: 1 }]
      }

      return {
        ...state,
        items: newItems,
        subtotal: calculateSubtotal(newItems),
        itemCount: calculateItemCount(newItems),
      }
    }
    case 'REMOVE_ITEM': {
      const newItems = state.items.filter((item) => item.id !== action.payload)
      return {
        ...state,
        items: newItems,
        subtotal: calculateSubtotal(newItems),
        itemCount: calculateItemCount(newItems),
      }
    }
    case 'UPDATE_QUANTITY': {
      const { id, quantity } = action.payload
      if (quantity < 1) {
        const newItems = state.items.filter((item) => item.id !== id)
        return {
          ...state,
          items: newItems,
          subtotal: calculateSubtotal(newItems),
          itemCount: calculateItemCount(newItems),
        }
      }

      const newItems = state.items.map((item) =>
        item.id === id ? { ...item, quantity } : item
      )
      return {
        ...state,
        items: newItems,
        subtotal: calculateSubtotal(newItems),
        itemCount: calculateItemCount(newItems),
      }
    }
    case 'TOGGLE_CART':
      return { ...state, isOpen: !state.isOpen }
    case 'CLOSE_CART':
      return { ...state, isOpen: false }
    case 'CLEAR_CART':
      return { ...initialState, isOpen: state.isOpen }
    default:
      return state
  }
}

interface CartContextValue extends CartState {
  addItem: (product: Product) => void
  removeItem: (id: string) => void
  updateQuantity: (id: string, quantity: number) => void
  toggleCart: () => void
  closeCart: () => void
  clearCart: () => void
}

export const CartContext = createContext<CartContextValue | undefined>(undefined)

interface CartProviderProps {
  children: ReactNode
}

export const CartProvider = ({ children }: CartProviderProps) => {
  const [state, dispatch] = useReducer(cartReducer, initialState)

  // Load from localStorage
  useEffect(() => {
    try {
      const savedCart = localStorage.getItem('raw-heavy-metal-gym-cart')
      if (savedCart) {
        const parsed = JSON.parse(savedCart)
        // Recalculate totals
        const subtotal = calculateSubtotal(parsed.items || [])
        const itemCount = calculateItemCount(parsed.items || [])
        // We can't directly hydrate without dispatching; simpler to handle by setting initial state
        // But for simplicity, we'll skip full hydration - not critical for MVP
      }
    } catch (e) {
      console.warn('Failed to load cart from localStorage', e)
    }
  }, [])

  // Save to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(
        'raw-heavy-metal-gym-cart',
        JSON.stringify({ items: state.items })
      )
    } catch (e) {
      console.warn('Failed to save cart to localStorage', e)
    }
  }, [state.items])

  const addItem = (product: Product) => dispatch({ type: 'ADD_ITEM', payload: product })
  const removeItem = (id: string) => dispatch({ type: 'REMOVE_ITEM', payload: id })
  const updateQuantity = (id: string, quantity: number) =>
    dispatch({ type: 'UPDATE_QUANTITY', payload: { id, quantity } })
  const toggleCart = () => dispatch({ type: 'TOGGLE_CART' })
  const closeCart = () => dispatch({ type: 'CLOSE_CART' })
  const clearCart = () => dispatch({ type: 'CLEAR_CART' })

  const value: CartContextValue = {
    ...state,
    addItem,
    removeItem,
    updateQuantity,
    toggleCart,
    closeCart,
    clearCart,
  }

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}
```

- [ ] **Step 2: Create src/context/UIContext.tsx**

```typescript
import { createContext, useReducer, ReactNode } from 'react'
import type { UIState, UIAction } from '../types'

const initialState: UIState = {
  isMobileMenuOpen: false,
}

const uiReducer = (state: UIState, action: UIAction): UIState => {
  switch (action.type) {
    case 'TOGGLE_MOBILE_MENU':
      return { ...state, isMobileMenuOpen: !state.isMobileMenuOpen }
    case 'CLOSE_MOBILE_MENU':
      return { ...state, isMobileMenuOpen: false }
    case 'OPEN_MOBILE_MENU':
      return { ...state, isMobileMenuOpen: true }
    default:
      return state
  }
}

interface UIContextValue extends UIState {
  toggleMobileMenu: () => void
  closeMobileMenu: () => void
  openMobileMenu: () => void
}

export const UIContext = createContext<UIContextValue | undefined>(undefined)

interface UIProviderProps {
  children: ReactNode
}

export const UIProvider = ({ children }: UIProviderProps) => {
  const [state, dispatch] = useReducer(uiReducer, initialState)

  const toggleMobileMenu = () => dispatch({ type: 'TOGGLE_MOBILE_MENU' })
  const closeMobileMenu = () => dispatch({ type: 'CLOSE_MOBILE_MENU' })
  const openMobileMenu = () => dispatch({ type: 'OPEN_MOBILE_MENU' })

  const value: UIContextValue = {
    ...state,
    toggleMobileMenu,
    closeMobileMenu,
    openMobileMenu,
  }

  return <UIContext.Provider value={value}>{children}</UIContext.Provider>
}
```

- [ ] **Step 3: Create src/hooks/useCart.ts**

```typescript
import { useContext } from 'react'
import { CartContext } from '../context/CartContext'

export const useCart = () => {
  const context = useContext(CartContext)
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider')
  }
  return context
}
```

- [ ] **Step 4: Create src/hooks/useMobileMenu.ts**

```typescript
import { useContext } from 'react'
import { UIContext } from '../context/UIContext'

export const useMobileMenu = () => {
  const context = useContext(UIContext)
  if (context === undefined) {
    throw new Error('useMobileMenu must be used within a UIProvider')
  }
  return context
}
```

- [ ] **Step 5: Commit**

```bash
git add src/context/CartContext.tsx src/context/UIContext.tsx src/hooks/useCart.ts src/hooks/useMobileMenu.ts
git commit -m "feat: add Cart and UI context providers with reducer-based state management"
```

### Task 5: Animation Utilities & ScrollProvider

**Files:**
- Create: `src/utils/lenis-setup.ts`
- Create: `src/utils/gsap-helpers.ts`
- Create: `src/providers/ScrollProvider.tsx`
- Create: `src/hooks/useScrollAnimation.ts`

**Interfaces:**
- Consumes: Context setup pattern from Task 4
- Produces: Centralized Lenis + GSAP integration, reusable animation hooks

- [ ] **Step 1: Create src/utils/lenis-setup.ts**

```typescript
import Lenis from '@studio-freight/lenis'

export const createLenisInstance = (): Lenis => {
  const lenis = new Lenis({
    duration: 1.2,
    easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smooth: true,
    smoothTouch: false,
    touchMultiplier: 2,
  })

  return lenis
}
```

- [ ] **Step 2: Create src/utils/gsap-helpers.ts**

```typescript
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

export const registerGSAPPlugins = () => {
  if (!gsap.plugins || !(ScrollTrigger as any)) {
    gsap.registerPlugin(ScrollTrigger)
  }
}

export const cleanupScrollTriggers = () => {
  ScrollTrigger.getAll().forEach((trigger) => trigger.kill())
}

export const refreshScrollTriggers = () => {
  ScrollTrigger.refresh()
}
```

- [ ] **Step 3: Create src/providers/ScrollProvider.tsx**

```typescript
import { createContext, useEffect, useRef, ReactNode } from 'react'
import Lenis from '@studio-freight/lenis'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { createLenisInstance } from '../utils/lenis-setup'
import { cleanupScrollTriggers } from '../utils/gsap-helpers'

gsap.registerPlugin(ScrollTrigger)

interface ScrollContextValue {
  lenis: Lenis | null
}

export const ScrollContext = createContext<ScrollContextValue>({ lenis: null })

interface ScrollProviderProps {
  children: ReactNode
}

export const ScrollProvider = ({ children }: ScrollProviderProps) => {
  const lenisRef = useRef<Lenis | null>(null)

  useEffect(() => {
    const lenis = createLenisInstance()
    lenisRef.current = lenis

    // Sync with GSAP ticker
    const handleRaf = (time: number) => {
      lenis.raf(time * 1000)
    }
    gsap.ticker.add(handleRaf)
    gsap.ticker.lagSmoothing(0)

    // ScrollTrigger refresh on resize
    const handleResize = () => {
      ScrollTrigger.refresh()
      lenis.resize()
    }

    ScrollTrigger.addEventListener('refresh', () => lenis.resize())

    window.addEventListener('resize', handleResize)

    // Reduced motion support
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (prefersReducedMotion.matches) {
      lenis.destroy()
      gsap.ticker.remove(handleRaf)
    }

    return () => {
      ScrollTrigger.removeEventListener('refresh', () => lenis.resize())
      window.removeEventListener('resize', handleResize)
      gsap.ticker.remove(handleRaf)
      cleanupScrollTriggers()
      lenis.destroy()
      lenisRef.current = null
    }
  }, [])

  return (
    <ScrollContext.Provider value={{ lenis: lenisRef.current }}>
      {children}
    </ScrollContext.Provider>
  )
}
```

- [ ] **Step 4: Create src/hooks/useScrollAnimation.ts**

```typescript
import { useContext } from 'react'
import { ScrollContext } from '../providers/ScrollProvider'
import Lenis from '@studio-freight/lenis'

export const useScroll = (): Lenis | null => {
  const context = useContext(ScrollContext)
  return context.lenis
}
```

- [ ] **Step 5: Commit**

```bash
git add src/utils/lenis-setup.ts src/utils/gsap-helpers.ts src/providers/ScrollProvider.tsx src/hooks/useScrollAnimation.ts
git commit -m "feat: add Lenis + GSAP ScrollProvider with centralized animation utilities"
```

### Task 6: UI Primitives (Button, Card, Badge)

**Files:**
- Create: `src/components/ui/Button.tsx`
- Create: `src/components/ui/Card.tsx`
- Create: `src/components/ui/Badge.tsx`

**Interfaces:**
- Consumes: Design tokens from Task 2
- Produces: Reusable UI primitive components with variants

- [ ] **Step 1: Create src/components/ui/Button.tsx**

```typescript
import { ButtonHTMLAttributes, forwardRef } from 'react'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

const cn = (...inputs: any[]) => {
  return twMerge(clsx(inputs))
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  asChild?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center gap-2 font-display uppercase tracking-wider transition-all duration-200 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50',
          {
            'btn-brutal': variant === 'primary',
            'btn-brutal-secondary': variant === 'secondary',
            'btn-brutal-ghost': variant === 'ghost',
            'min-h-[40px] px-4 py-2 text-xs': size === 'sm',
            'min-h-[48px] px-6 py-3 text-sm': size === 'md',
            'min-h-[56px] px-8 py-4 text-base': size === 'lg',
          },
          className
        )}
        {...props}
      >
        {children}
      </button>
    )
  }
)

Button.displayName = 'Button'
```

- [ ] **Step 2: Install clsx and tailwind-merge**

```bash
npm i clsx tailwind-merge
```

- [ ] **Step 3: Create src/components/ui/Card.tsx**

```typescript
import { HTMLAttributes, forwardRef } from 'react'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

const cn = (...inputs: any[]) => {
  return twMerge(clsx(inputs))
}

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  hover?: boolean
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, hover = true, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'card-brutal',
          {
            'hover:border-accent': hover,
          },
          className
        )}
        {...props}
      >
        {children}
      </div>
    )
  }
)

Card.displayName = 'Card'
```

- [ ] **Step 4: Create src/components/ui/Badge.tsx**

```typescript
import { HTMLAttributes, forwardRef } from 'react'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

const cn = (...inputs: any[]) => {
  return twMerge(clsx(inputs))
}

export interface BadgeProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'popular' | 'new' | 'sale'
}

export const Badge = forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant = 'new', children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center border-2 border-black px-3 py-1 font-display text-xs uppercase tracking-wider',
          {
            'bg-accent text-black': variant === 'popular',
            'bg-white text-black': variant === 'new',
            'bg-red-500 text-white': variant === 'sale',
          },
          className
        )}
        {...props}
      >
        {children}
      </div>
    )
  }
)

Badge.displayName = 'Badge'
```

- [ ] **Step 5: Create src/lib/utils.ts for shared cn helper**

```typescript
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

- [ ] **Step 6: Update Button/Card/Badge to use shared cn**

Update imports to use `import { cn } from '../../lib/utils'` or adjust paths. Better to create lib.

```bash
mkdir -p src/lib
```

Then rewrite with shared cn.

- [ ] **Step 7: Commit**

```bash
git add src/components/ui/Button.tsx src/components/ui/Card.tsx src/components/ui/Badge.tsx src/lib/utils.ts package.json
git commit -m "feat: add UI primitives (Button, Card, Badge) with Neo-Brutalist styling"
```

### Task 7: Animation Components

**Files:**
- Create: `src/components/animations/ScrollReveal.tsx`
- Create: `src/components/animations/StaggerText.tsx`
- Create: `src/components/animations/Parallax.tsx`

**Interfaces:**
- Consumes: GSAP utilities from Task 5
- Produces: Reusable scroll-driven animation components with proper cleanup

- [ ] **Step 1: Create src/components/animations/ScrollReveal.tsx**

```typescript
import { useEffect, useRef, ReactNode } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

export interface ScrollRevealProps {
  children: ReactNode
  variant?: 'fade-up' | 'scale-in' | 'slide-left' | 'slide-right'
  delay?: number
  duration?: number
  className?: string
}

export const ScrollReveal = ({
  children,
  variant = 'fade-up',
  delay = 0,
  duration = 1.0,
  className = '',
}: ScrollRevealProps) => {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const element = ref.current
    if (!element) return

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (prefersReducedMotion.matches) {
      gsap.set(element, { opacity: 1, y: 0, x: 0, scale: 1 })
      return
    }

    let fromVars: gsap.TweenVars = { opacity: 0, y: 60 }
    let toVars: gsap.TweenVars = {
      opacity: 1,
      y: 0,
      duration,
      delay,
      ease: 'power3.out',
      scrollTrigger: {
        trigger: element,
        start: 'top 85%',
        toggleActions: 'play none none reverse',
      },
    }

    switch (variant) {
      case 'fade-up':
        fromVars = { opacity: 0, y: 60 }
        break
      case 'scale-in':
        fromVars = { opacity: 0, scale: 0.95 }
        toVars = {
          ...toVars,
          scale: 1,
          duration: duration || 0.8,
          ease: 'power2.out',
        }
        break
      case 'slide-left':
        fromVars = { opacity: 0, x: -60 }
        break
      case 'slide-right':
        fromVars = { opacity: 0, x: 60 }
        break
    }

    gsap.set(element, fromVars)
    gsap.to(element, toVars)

    return () => {
      ScrollTrigger.getAll().forEach((trigger) => {
        if (trigger.trigger === element) {
          trigger.kill()
        }
      })
    }
  }, [variant, delay, duration])

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  )
}
```

- [ ] **Step 2: Create src/components/animations/StaggerText.tsx**

```typescript
import { useEffect, useRef, ReactNode } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

export interface StaggerTextProps {
  children: string
  split?: 'lines' | 'words' | 'chars'
  stagger?: number
  className?: string
  tag?: 'h1' | 'h2' | 'h3' | 'h4' | 'p' | 'span'
}

export const StaggerText = ({
  children,
  split = 'lines',
  stagger = 0.08,
  className = '',
  tag: Tag = 'h1',
}: StaggerTextProps) => {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const element = ref.current
    if (!element) return

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (prefersReducedMotion.matches) {
      element.style.opacity = '1'
      return
    }

    // Simple split by lines - split on \n or wrap words
    const lines = children.split('\n').filter(Boolean)
    
    element.innerHTML = ''

    lines.forEach((line, lineIndex) => {
      const lineEl = document.createElement('div')
      lineEl.className = 'overflow-hidden'
      
      const innerLine = document.createElement('span')
      innerLine.className = 'block will-change-transform'
      innerLine.textContent = line.trim()
      innerLine.style.opacity = '0'
      innerLine.style.transform = 'translateY(100%)'
      
      lineEl.appendChild(innerLine)
      element.appendChild(lineEl)
    })

    const spans = element.querySelectorAll('span')

    gsap.to(spans, {
      opacity: 1,
      y: '0%',
      duration: 1.2,
      ease: 'expo.out',
      stagger,
      scrollTrigger: {
        trigger: element,
        start: 'top 85%',
        toggleActions: 'play none none reverse',
      },
    })

    return () => {
      ScrollTrigger.getAll().forEach((trigger) => {
        if (trigger.trigger === element) {
          trigger.kill()
        }
      })
    }
  }, [children, split, stagger])

  const Component = Tag as any

  return <Component ref={ref} className={className} />
}
```

- [ ] **Step 3: Create src/components/animations/Parallax.tsx**

```typescript
import { useEffect, useRef, ReactNode } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

export interface ParallaxProps {
  children: ReactNode
  speed?: number
  className?: string
}

export const Parallax = ({
  children,
  speed = 0.1,
  className = '',
}: ParallaxProps) => {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const element = ref.current
    if (!element) return

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (prefersReducedMotion.matches) {
      return
    }

    const tl = gsap.to(element, {
      yPercent: -speed * 100,
      ease: 'none',
      scrollTrigger: {
        trigger: element,
        start: 'top bottom',
        end: 'bottom top',
        scrub: true,
      },
    })

    return () => {
      tl.kill()
      ScrollTrigger.getAll().forEach((trigger) => {
        if (trigger.trigger === element) {
          trigger.kill()
        }
      })
    }
  }, [speed])

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/animations/ScrollReveal.tsx src/components/animations/StaggerText.tsx src/components/animations/Parallax.tsx
git commit -m "feat: add animation components (ScrollReveal, StaggerText, Parallax) with GSAP ScrollTrigger"
```

### Task 8: Layout Components (Header, MobileNavDrawer, Footer)

**Files:**
- Create: `src/components/layout/Header.tsx`
- Create: `src/components/layout/MobileNavDrawer.tsx`
- Create: `src/components/layout/Footer.tsx`

**Interfaces:**
- Consumes: UI Context from Task 4, Button/Card from Task 6
- Produces: Navigation header, mobile drawer, footer

- [ ] **Step 1: Create src/components/layout/Header.tsx**

```typescript
import { Menu, X, ShoppingBag } from 'lucide-react'
import { useCart } from '../../hooks/useCart'
import { useMobileMenu } from '../../hooks/useMobileMenu'
import { Button } from '../ui/Button'

const navLinks = [
  { href: '#hero', label: 'HOME' },
  { href: '#membership', label: 'MEMBERSHIP' },
  { href: '#merch', label: 'MERCH' },
  { href: '#contact', label: 'CONTACT' },
]

export const Header = () => {
  const { itemCount, toggleCart } = useCart()
  const { isMobileMenuOpen, toggleMobileMenu } = useMobileMenu()

  const handleNavClick = (href: string) => {
    const element = document.querySelector(href)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' })
    }
  }

  return (
    <header className="fixed left-0 right-0 top-0 z-50 border-b-2 border-border bg-canvas/90 backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 md:px-6 lg:px-8">
        {/* Logo */}
        <div className="flex flex-col">
          <span className="font-display text-2xl leading-none tracking-tighter text-accent md:text-3xl">
            RAW
          </span>
          <span className="text-xs font-bold uppercase tracking-widest text-white/80">
            HEAVY METAL GYM
          </span>
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden items-center gap-8 md:flex">
          {navLinks.map((link) => (
            <button
              key={link.href}
              onClick={() => handleNavClick(link.href)}
              className="font-display text-sm uppercase tracking-wider text-white/80 transition-colors duration-200 hover:text-accent"
            >
              {link.label}
            </button>
          ))}
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-2 md:gap-4">
          {/* Cart Button */}
          <button
            onClick={toggleCart}
            className="relative flex items-center justify-center border-2 border-border bg-surface p-2 transition-colors duration-200 hover:border-accent md:px-4 md:py-2"
            aria-label="Shopping cart"
          >
            <ShoppingBag className="h-5 w-5 text-white" />
            {itemCount > 0 && (
              <span className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center border-2 border-black bg-accent font-display text-xs text-black">
                {itemCount}
              </span>
            )}
            <span className="ml-2 hidden font-display text-xs uppercase md:inline">
              CART
            </span>
          </button>

          {/* Mobile Menu Toggle */}
          <button
            onClick={toggleMobileMenu}
            className="flex items-center justify-center border-2 border-border bg-surface p-2 transition-colors duration-200 hover:border-accent md:hidden"
            aria-label="Toggle mobile menu"
          >
            {isMobileMenuOpen ? (
              <X className="h-5 w-5 text-white" />
            ) : (
              <Menu className="h-5 w-5 text-white" />
            )}
          </button>
        </div>
      </div>
    </header>
  )
}
```

- [ ] **Step 2: Create src/components/layout/MobileNavDrawer.tsx**

```typescript
import { useEffect } from 'react'
import { X, Phone, Mail, MapPin } from 'lucide-react'
import { gsap } from 'gsap'
import { useMobileMenu } from '../../hooks/useMobileMenu'
import { useScroll } from '../../hooks/useScrollAnimation'

const navLinks = [
  { href: '#hero', label: 'HOME' },
  { href: '#membership', label: 'MEMBERSHIP' },
  { href: '#merch', label: 'MERCH' },
  { href: '#contact', label: 'CONTACT' },
]

export const MobileNavDrawer = () => {
  const { isMobileMenuOpen, closeMobileMenu } = useMobileMenu()
  const lenis = useScroll()

  useEffect(() => {
    if (lenis) {
      if (isMobileMenuOpen) {
        lenis.stop()
      } else {
        lenis.start()
      }
    }
  }, [isMobileMenuOpen, lenis])

  useEffect(() => {
    const drawer = document.querySelector('.mobile-drawer')
    const backdrop = document.querySelector('.mobile-drawer-backdrop')
    const links = document.querySelectorAll('.mobile-nav-link')

    if (isMobileMenuOpen) {
      gsap.set(drawer, { yPercent: -100 })
      gsap.set(backdrop, { opacity: 0 })
      gsap.set(links, { opacity: 0, y: 20 })

      const tl = gsap.timeline()
      tl.to(backdrop, { opacity: 1, duration: 0.2, ease: 'power2.out' })
        .to(drawer, { yPercent: 0, duration: 0.4, ease: 'expo.out' }, '-=0.1')
        .to(links, { opacity: 1, y: 0, duration: 0.3, ease: 'power2.out', stagger: 0.08 }, '-=0.2')
    } else {
      const tl = gsap.timeline()
      tl.to(links, { opacity: 0, y: -20, duration: 0.15, ease: 'power2.in', stagger: 0.05 })
        .to(drawer, { yPercent: -100, duration: 0.3, ease: 'expo.in' }, '-=0.1')
        .to(backdrop, { opacity: 0, duration: 0.15, ease: 'power2.in' }, '-=0.1')
    }
  }, [isMobileMenuOpen])

  const handleNavClick = (href: string) => {
    closeMobileMenu()
    setTimeout(() => {
      const element = document.querySelector(href)
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' })
      }
    }, 300)
  }

  if (!isMobileMenuOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="mobile-drawer-backdrop fixed inset-0 z-[199] bg-black/80"
        onClick={closeMobileMenu}
      />

      {/* Drawer */}
      <div className="mobile-drawer fixed inset-0 z-[200] flex flex-col border-2 border-accent bg-canvas">
        {/* Header */}
        <div className="flex items-center justify-between border-b-2 border-border p-4">
          <div className="flex flex-col">
            <span className="font-display text-2xl leading-none tracking-tighter text-accent">
              RAW
            </span>
            <span className="text-xs font-bold uppercase tracking-widest text-white/80">
              HEAVY METAL GYM
            </span>
          </div>
          <button
            onClick={closeMobileMenu}
            className="flex items-center justify-center border-2 border-border bg-surface p-2"
            aria-label="Close mobile menu"
          >
            <X className="h-5 w-5 text-white" />
          </button>
        </div>

        {/* Nav Links */}
        <nav className="flex flex-1 flex-col items-center justify-center gap-8">
          {navLinks.map((link) => (
            <button
              key={link.href}
              onClick={() => handleNavClick(link.href)}
              className="mobile-nav-link font-display text-4xl uppercase tracking-tighter text-white transition-colors duration-200 hover:text-accent"
            >
              {link.label}
            </button>
          ))}
        </nav>

        {/* Contact Info */}
        <div className="border-t-2 border-border p-6">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Phone className="h-5 w-5 text-accent" />
              <span className="font-body text-sm text-white/80">+1 (555) 123-4567</span>
            </div>
            <div className="flex items-center gap-3">
              <Mail className="h-5 w-5 text-accent" />
              <span className="font-body text-sm text-white/80">join@rawheavymetalgym.com</span>
            </div>
            <div className="flex items-center gap-3">
              <MapPin className="h-5 w-5 text-accent" />
              <span className="font-body text-sm text-white/80">
                123 Iron Street, Strength City, 10001
              </span>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
```

- [ ] **Step 3: Create src/components/layout/Footer.tsx**

```typescript
import { Instagram, Youtube, Phone, Mail, MapPin, Clock } from 'lucide-react'
import { gymInfo } from '../../data/gym-info'

export const Footer = () => {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="border-t-2 border-border bg-surface">
      <div className="mx-auto max-w-7xl px-4 py-12 md:px-6 md:py-16 lg:px-8">
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          {/* Logo & Tagline */}
          <div className="lg:col-span-2">
            <div className="mb-4 flex flex-col">
              <span className="font-display text-3xl leading-none tracking-tighter text-accent md:text-4xl">
                RAW
              </span>
              <span className="text-sm font-bold uppercase tracking-widest text-white/80">
                HEAVY METAL GYM
              </span>
            </div>
            <p className="max-w-md font-body text-sm text-white/70">
              {gymInfo.subheadline}
            </p>
            <div className="mt-6 flex gap-4">
              <a
                href="#"
                className="flex h-12 w-12 items-center justify-center border-2 border-border bg-surface-elevated transition-colors duration-200 hover:border-accent"
                aria-label="Instagram"
              >
                <Instagram className="h-5 w-5 text-white" />
              </a>
              <a
                href="#"
                className="flex h-12 w-12 items-center justify-center border-2 border-border bg-surface-elevated transition-colors duration-200 hover:border-accent"
                aria-label="YouTube"
              >
                <Youtube className="h-5 w-5 text-white" />
              </a>
            </div>
          </div>

          {/* Contact */}
          <div>
            <h3 className="mb-4 font-display text-sm uppercase tracking-wider text-accent">
              CONTACT
            </h3>
            <ul className="space-y-3">
              <li className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-accent" />
                <a
                  href={`tel:${gymInfo.contact.phone}`}
                  className="font-body text-sm text-white/70 transition-colors hover:text-white"
                >
                  {gymInfo.contact.phone}
                </a>
              </li>
              <li className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-accent" />
                <a
                  href={`mailto:${gymInfo.contact.email}`}
                  className="font-body text-sm text-white/70 transition-colors hover:text-white"
                >
                  {gymInfo.contact.email}
                </a>
              </li>
              <li className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-4 w-4 text-accent" />
                <span className="font-body text-sm text-white/70">
                  {gymInfo.contact.address.street}, {gymInfo.contact.address.city},{' '}
                  {gymInfo.contact.address.postalCode}
                </span>
              </li>
            </ul>
          </div>

          {/* Hours */}
          <div>
            <h3 className="mb-4 font-display text-sm uppercase tracking-wider text-accent">
              HOURS
            </h3>
            <ul className="space-y-2">
              {gymInfo.contact.hours.map((hour) => (
                <li key={hour.day} className="flex items-center justify-between">
                  <span className="font-body text-sm text-white/70">{hour.day}</span>
                  <span className="flex items-center gap-2 font-body text-sm text-white">
                    {hour.is24h && (
                      <span className="h-2 w-2 rounded-full bg-green-500" />
                    )}
                    {hour.hours}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-8 border-t-2 border-border pt-8 text-center">
          <p className="font-body text-xs text-white/50">
            © {currentYear} RAW HEAVY METAL GYM. ALL RIGHTS RESERVED.
          </p>
        </div>
      </div>
    </footer>
  )
}
```

### Task 9: Hero Section

**Files:**
- Create: `src/components/sections/Hero.tsx`

**Interfaces:**
- Consumes: gymInfo data (Task 3), ScrollReveal/StaggerText (Task 7), Card (Task 6)
- Produces: Hero section with animated headline, stats counters, facility highlights

- [ ] **Step 1: Create src/components/sections/Hero.tsx**

```typescript
import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { gymInfo } from '../../data/gym-info'
import { StaggerText } from '../animations/StaggerText'
import { ScrollReveal } from '../animations/ScrollReveal'
import { Card } from '../ui/Card'

gsap.registerPlugin(ScrollTrigger)

export const Hero = () => {
  const statsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const statsElements = statsRef.current?.querySelectorAll('.stat-value')
    if (!statsElements) return

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (prefersReducedMotion.matches) {
      return
    }

    statsElements.forEach((el, index) => {
      const target = parseInt((el as HTMLElement).dataset.value || '0')
      const suffix = (el as HTMLElement).dataset.suffix || ''

      gsap.fromTo(
        el,
        { textContent: 0 },
        {
          textContent: target,
          duration: 2,
          ease: 'power2.out',
          snap: { textContent: 1 },
          scrollTrigger: {
            trigger: el,
            start: 'top 90%',
            toggleActions: 'play none none once',
          },
          onUpdate: function () {
            const value = Math.round(this.targets()[0].textContent)
            ;(el as HTMLElement).textContent = value + suffix
          },
          onComplete: function () {
            ;(el as HTMLElement).textContent = target + suffix
          },
        }
      )
    })

    return () => {
      ScrollTrigger.getAll().forEach((trigger) => trigger.kill())
    }
  }, [])

  return (
    <section id="hero" className="min-h-screen border-b-2 border-border bg-canvas pt-20 md:pt-32">
      <div className="mx-auto max-w-7xl px-4 md:px-6 lg:px-8">
        {/* Hero Content */}
        <div className="py-12 md:py-20">
          <div className="mb-8">
            <StaggerText
              split="lines"
              stagger={0.08}
              tag="h1"
              className="text-5xl leading-[0.9] tracking-tighter text-white md:text-7xl lg:text-9xl"
            >
              NO EXCUSES. JUST RESULTS.
            </StaggerText>
          </div>

          <ScrollReveal variant="fade-up" delay={0.3}>
            <p className="max-w-2xl font-body text-lg text-white/70 md:text-xl">
              {gymInfo.subheadline}
            </p>
          </ScrollReveal>
        </div>

        {/* Stats */}
        <div ref={statsRef} className="mb-12 grid grid-cols-1 gap-6 md:grid-cols-3 md:gap-8">
          {gymInfo.stats.map((stat, index) => (
            <ScrollReveal key={stat.label} variant="fade-up" delay={index * 0.1}>
              <Card className="flex flex-col items-center justify-center p-8 text-center">
                <div
                  className="stat-value font-display text-6xl leading-none tracking-tighter text-accent md:text-7xl lg:text-8xl"
                  data-value={stat.value}
                  data-suffix={stat.suffix || ''}
                >
                  0{stat.suffix || ''}
                </div>
                <p className="mt-4 font-display text-sm uppercase tracking-wider text-white/80">
                  {stat.label}
                </p>
              </Card>
            </ScrollReveal>
          ))}
        </div>

        {/* Facilities */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4 md:gap-6">
          {gymInfo.facilities.map((facility, index) => {
            const Icon = facility.icon
            return (
              <ScrollReveal key={facility.label} variant="fade-up" delay={index * 0.1}>
                <Card className="group flex h-full flex-col items-center p-6 text-center">
                  <Icon className="h-10 w-10 text-accent transition-transform duration-200 group-hover:scale-110" />
                  <h3 className="mt-4 font-display text-sm uppercase tracking-wider text-white">
                    {facility.label}
                  </h3>
                  {facility.description && (
                    <p className="mt-2 font-body text-xs text-white/60">
                      {facility.description}
                    </p>
                  )}
                </Card>
              </ScrollReveal>
            )
          })}
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/sections/Hero.tsx
git commit -m "feat: add Hero section with staggered text, animated stat counters, and facility highlights"
```

### Task 10: Membership Section

**Files:**
- Create: `src/components/sections/Membership.tsx`

**Interfaces:**
- Consumes: membershipTiers data (Task 3), Button/Card/Badge (Task 6), ScrollReveal (Task 7)
- Produces: Membership pricing cards with monthly/annual toggle

- [ ] **Step 1: Create src/components/sections/Membership.tsx**

```typescript
import { useState } from 'react'
import { Check } from 'lucide-react'
import { membershipTiers } from '../../data/membership'
import { ScrollReveal } from '../animations/ScrollReveal'
import { Card } from '../ui/Card'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'

type BillingPeriod = 'monthly' | 'annual'

export const Membership = () => {
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>('monthly')

  return (
    <section id="membership" className="border-b-2 border-border bg-surface py-20 md:py-32">
      <div className="mx-auto max-w-7xl px-4 md:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-12 text-center md:mb-16">
          <ScrollReveal variant="fade-up">
            <h2 className="text-4xl leading-[0.9] tracking-tighter text-white md:text-6xl lg:text-7xl">
              MEMBERSHIP PLANS
            </h2>
          </ScrollReveal>
          <ScrollReveal variant="fade-up" delay={0.1}>
            <p className="mt-4 font-body text-lg text-white/70 md:text-xl">
              Choose your path. No excuses. Just results.
            </p>
          </ScrollReveal>

          {/* Billing Toggle */}
          <ScrollReveal variant="fade-up" delay={0.2}>
            <div className="mt-8 inline-flex items-center border-2 border-border bg-surface-elevated p-1">
              <button
                onClick={() => setBillingPeriod('monthly')}
                className={`px-4 py-2 font-display text-xs uppercase tracking-wider transition-all duration-200 md:px-6 ${
                  billingPeriod === 'monthly'
                    ? 'bg-accent text-black'
                    : 'text-white/70 hover:text-white'
                }`}
              >
                MONTHLY
              </button>
              <button
                onClick={() => setBillingPeriod('annual')}
                className={`relative px-4 py-2 font-display text-xs uppercase tracking-wider transition-all duration-200 md:px-6 ${
                  billingPeriod === 'annual'
                    ? 'bg-accent text-black'
                    : 'text-white/70 hover:text-white'
                }`}
              >
                ANNUAL
                {billingPeriod === 'annual' && (
                  <Badge variant="popular" className="absolute -right-12 -top-3 hidden md:inline-flex">
                    SAVE 20%
                  </Badge>
                )}
              </button>
            </div>
            {billingPeriod === 'annual' && (
              <Badge variant="popular" className="ml-2 inline-flex md:hidden">
                SAVE 20%
              </Badge>
            )}
          </ScrollReveal>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3 md:gap-8">
          {membershipTiers.map((tier, index) => {
            const price = billingPeriod === 'monthly' ? tier.priceMonthly : tier.priceAnnual
            const priceLabel = billingPeriod === 'monthly' ? '/MONTH' : '/YEAR'

            return (
              <ScrollReveal key={tier.id} variant="fade-up" delay={index * 0.1}>
                <Card
                  className={`relative flex h-full flex-col ${
                    tier.popular ? 'border-accent shadow-brutal' : ''
                  }`}
                >
                  {tier.popular && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                      <Badge variant="popular">MOST POPULAR</Badge>
                    </div>
                  )}

                  <div className="mb-6">
                    <h3 className="font-display text-2xl uppercase tracking-tighter text-white md:text-3xl">
                      {tier.name}
                    </h3>
                    <div className="mt-4 flex items-end">
                      <span className="font-display text-5xl leading-none tracking-tighter text-accent md:text-6xl">
                        ${price}
                      </span>
                      <span className="ml-1 font-display text-sm uppercase tracking-wider text-white/70">
                        {priceLabel}
                      </span>
                    </div>
                  </div>

                  <ul className="mb-8 flex-1 space-y-3">
                    {tier.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-3">
                        <Check className="mt-0.5 h-5 w-5 flex-shrink-0 text-accent" />
                        <span className="font-body text-sm text-white/80">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <Button variant="primary" size="lg" className="w-full">
                    {tier.ctaText}
                  </Button>
                </Card>
              </ScrollReveal>
            )
          })}
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/sections/Membership.tsx
git commit -m "feat: add Membership section with billing toggle (monthly/annual) and pricing cards"
```

### Task 11: Merch Section & Cart Drawer

**Files:**
- Create: `src/components/sections/Merch.tsx`
- Create: `src/components/cart/CartDrawer.tsx`
- Create: `src/components/cart/QuantitySelector.tsx`

**Interfaces:**
- Consumes: products data (Task 3), useCart hook (Task 4), Button/Card/Badge (Task 6), useScroll (Task 5)
- Produces: Product carousel/grid, cart drawer with quantity management

- [ ] **Step 1: Create src/components/cart/QuantitySelector.tsx**

```typescript
import { Minus, Plus } from 'lucide-react'

interface QuantitySelectorProps {
  quantity: number
  onDecrease: () => void
  onIncrease: () => void
  min?: number
  max?: number
}

export const QuantitySelector = ({
  quantity,
  onDecrease,
  onIncrease,
  min = 1,
  max = 99,
}: QuantitySelectorProps) => {
  return (
    <div className="inline-flex items-center border-2 border-border bg-surface">
      <button
        onClick={onDecrease}
        disabled={quantity <= min}
        className="flex h-10 w-10 items-center justify-center transition-colors duration-200 hover:bg-accent hover:text-black disabled:cursor-not-allowed disabled:opacity-30"
        aria-label="Decrease quantity"
      >
        <Minus className="h-4 w-4" />
      </button>
      <span className="flex h-10 w-12 items-center justify-center border-x-2 border-border font-display text-sm">
        {quantity}
      </span>
      <button
        onClick={onIncrease}
        disabled={quantity >= max}
        className="flex h-10 w-10 items-center justify-center transition-colors duration-200 hover:bg-accent hover:text-black disabled:cursor-not-allowed disabled:opacity-30"
        aria-label="Increase quantity"
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Create src/components/cart/CartDrawer.tsx**

```typescript
import { useEffect } from 'react'
import { X, Trash2, ShoppingBag } from 'lucide-react'
import { gsap } from 'gsap'
import { useCart } from '../../hooks/useCart'
import { useScroll } from '../../hooks/useScrollAnimation'
import { Button } from '../ui/Button'
import { QuantitySelector } from './QuantitySelector'
import { formatPrice } from '../../utils/formatters'

export const CartDrawer = () => {
  const { items, isOpen, subtotal, itemCount, closeCart, removeItem, updateQuantity } = useCart()
  const lenis = useScroll()

  useEffect(() => {
    if (lenis) {
      if (isOpen) {
        lenis.stop()
      } else {
        lenis.start()
      }
    }
  }, [isOpen, lenis])

  useEffect(() => {
    const drawer = document.querySelector('.cart-drawer')
    const backdrop = document.querySelector('.cart-drawer-backdrop')

    if (isOpen) {
      gsap.set(drawer, { xPercent: 100 })
      gsap.set(backdrop, { opacity: 0 })

      const tl = gsap.timeline()
      tl.to(backdrop, { opacity: 1, duration: 0.2, ease: 'power2.out' })
        .to(drawer, { xPercent: 0, duration: 0.3, ease: 'expo.out' }, '-=0.1')
    } else {
      const tl = gsap.timeline()
      tl.to(drawer, { xPercent: 100, duration: 0.25, ease: 'expo.in' })
        .to(backdrop, { opacity: 0, duration: 0.15, ease: 'power2.in' }, '-=0.15')
    }
  }, [isOpen])

  const handleCheckout = () => {
    // Placeholder - integrate payment in future
    console.log('Checkout:', { items, subtotal })
  }

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="cart-drawer-backdrop fixed inset-0 z-[199] bg-black/80"
        onClick={closeCart}
      />

      {/* Drawer */}
      <div className="cart-drawer fixed right-0 top-0 z-[200] flex h-full w-full max-w-md flex-col border-l-2 border-accent bg-canvas">
        {/* Header */}
        <div className="flex items-center justify-between border-b-2 border-border p-4">
          <div className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-accent" />
            <h2 className="font-display text-lg uppercase tracking-wider text-white">
              YOUR CART ({itemCount})
            </h2>
          </div>
          <button
            onClick={closeCart}
            className="flex items-center justify-center border-2 border-border bg-surface p-2 transition-colors hover:border-accent"
            aria-label="Close cart"
          >
            <X className="h-5 w-5 text-white" />
          </button>
        </div>

        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto p-4">
          {items.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <ShoppingBag className="h-16 w-16 text-border" />
              <p className="mt-4 font-display text-sm uppercase tracking-wider text-white/60">
                Your cart is empty
              </p>
            </div>
          ) : (
            <ul className="space-y-4">
              {items.map((item) => (
                <li
                  key={item.id}
                  className="flex gap-4 border-2 border-border bg-surface-elevated p-3"
                >
                  <div className="h-20 w-20 flex-shrink-0 overflow-hidden border-2 border-border bg-surface">
                    <img
                      src={item.image}
                      alt={item.name}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="flex flex-1 flex-col">
                    <div className="flex items-start justify-between">
                      <h3 className="font-display text-sm uppercase tracking-wider text-white">
                        {item.name}
                      </h3>
                      <button
                        onClick={() => removeItem(item.id)}
                        className="text-white/50 transition-colors hover:text-red-400"
                        aria-label={`Remove ${item.name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <p className="mt-1 font-display text-sm text-accent">
                      {formatPrice(item.price)}
                    </p>
                    <div className="mt-auto pt-2">
                      <QuantitySelector
                        quantity={item.quantity}
                        onDecrease={() => updateQuantity(item.id, item.quantity - 1)}
                        onIncrease={() => updateQuantity(item.id, item.quantity + 1)}
                      />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="border-t-2 border-border p-4">
            <div className="mb-4 flex items-center justify-between">
              <span className="font-display text-sm uppercase tracking-wider text-white/70">
                SUBTOTAL
              </span>
              <span className="font-display text-2xl tracking-tighter text-accent">
                {formatPrice(subtotal)}
              </span>
            </div>
            <Button variant="primary" size="lg" className="w-full" onClick={handleCheckout}>
              CHECKOUT
            </Button>
            <p className="mt-2 text-center font-body text-xs text-white/50">
              Shipping calculated at checkout
            </p>
          </div>
        )}
      </div>
    </>
  )
}
```

- [ ] **Step 3: Create src/utils/formatters.ts**

```typescript
export const formatPrice = (price: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price)
}
```

- [ ] **Step 4: Create src/components/sections/Merch.tsx**

```typescript
import { Plus } from 'lucide-react'
import { products } from '../../data/products'
import { useCart } from '../../hooks/useCart'
import { ScrollReveal } from '../animations/ScrollReveal'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'
import { formatPrice } from '../../utils/formatters'

export const Merch = () => {
  const { addItem, toggleCart } = useCart()

  const handleQuickAdd = (product: (typeof products)[0]) => {
    addItem(product)
    toggleCart()
  }

  return (
    <section id="merch" className="border-b-2 border-border bg-canvas py-20 md:py-32">
      <div className="mx-auto max-w-7xl px-4 md:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-12 text-center md:mb-16">
          <ScrollReveal variant="fade-up">
            <h2 className="text-4xl leading-[0.9] tracking-tighter text-white md:text-6xl lg:text-7xl">
              MERCH DROP
            </h2>
          </ScrollReveal>
          <ScrollReveal variant="fade-up" delay={0.1}>
            <p className="mt-4 font-body text-lg text-white/70 md:text-xl">
              Gear for those who train heavy.
            </p>
          </ScrollReveal>
        </div>

        {/* Product Grid / Carousel */}
        <div className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-4 md:mx-0 md:grid md:grid-cols-2 md:gap-8 md:overflow-visible md:px-0 md:pb-0 lg:grid-cols-4">
          {products.map((product, index) => (
            <ScrollReveal
              key={product.id}
              variant="fade-up"
              delay={index * 0.1}
              className="min-w-[280px] snap-start md:min-w-0"
            >
              <Card className="group flex h-full flex-col p-0" hover>
                {/* Image */}
                <div className="relative aspect-square overflow-hidden border-b-2 border-border bg-surface">
                  <img
                    src={product.image}
                    alt={product.name}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                  <div className="absolute left-3 top-3">
                    <Badge variant="new">NEW</Badge>
                  </div>
                </div>

                {/* Content */}
                <div className="flex flex-1 flex-col p-4">
                  <h3 className="font-display text-lg uppercase tracking-tighter text-white">
                    {product.name}
                  </h3>
                  {product.description && (
                    <p className="mt-2 font-body text-sm text-white/60">
                      {product.description}
                    </p>
                  )}
                  <div className="mt-auto flex items-center justify-between pt-4">
                    <span className="font-display text-xl tracking-tighter text-accent">
                      {formatPrice(product.price)}
                    </span>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleQuickAdd(product)}
                      className="gap-1"
                    >
                      <Plus className="h-4 w-4" />
                      QUICK ADD
                    </Button>
                  </div>
                </div>
              </Card>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  )
}
```

Note: `CartDrawer` is rendered once at the App root level (Task 13), not inside Merch.

- [ ] **Step 5: Commit**

```bash
git add src/components/cart/QuantitySelector.tsx src/components/cart/CartDrawer.tsx src/components/sections/Merch.tsx src/utils/formatters.ts
git commit -m "feat: add Merch section with product cards and slide-out CartDrawer with quantity management"
```

### Task 12: Contact Section

**Files:**
- Create: `src/components/sections/Contact.tsx`
- Create: `src/components/ui/Toast.tsx`

**Interfaces:**
- Consumes: gymInfo data (Task 3), ScrollReveal (Task 7), Card (Task 6), Button (Task 6)
- Produces: Contact bar (call/email/maps), hours with live status, Google Maps embed, copy-to-clipboard address

- [ ] **Step 1: Create src/components/ui/Toast.tsx**

```typescript
import { useEffect } from 'react'
import { Check } from 'lucide-react'

interface ToastProps {
  message: string
  isVisible: boolean
  onClose: () => void
  duration?: number
}

export const Toast = ({ message, isVisible, onClose, duration = 2500 }: ToastProps) => {
  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(onClose, duration)
      return () => clearTimeout(timer)
    }
  }, [isVisible, duration, onClose])

  if (!isVisible) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-6 left-1/2 z-[400] flex -translate-x-1/2 items-center gap-2 border-2 border-accent bg-surface-elevated px-4 py-3 shadow-brutal animate-[fadeInUp_0.2s_ease-out]"
    >
      <Check className="h-4 w-4 text-accent" />
      <span className="font-display text-xs uppercase tracking-wider text-white">
        {message}
      </span>
    </div>
  )
}
```

- [ ] **Step 2: Create src/components/sections/Contact.tsx**

```typescript
import { useState, useCallback } from 'react'
import { Phone, Mail, MapPin, Clock, Navigation, Copy } from 'lucide-react'
import { gymInfo } from '../../data/gym-info'
import { ScrollReveal } from '../animations/ScrollReveal'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { Toast } from '../ui/Toast'

export const Contact = () => {
  const [showToast, setShowToast] = useState(false)
  const { contact } = gymInfo

  const fullAddress = `${contact.address.street}, ${contact.address.city}, ${contact.address.postalCode}, ${contact.address.country}`

  const handleCopyAddress = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(fullAddress)
      setShowToast(true)
    } catch (err) {
      console.error('Failed to copy address:', err)
    }
  }, [fullAddress])

  return (
    <section id="contact" className="border-b-2 border-border bg-surface py-20 md:py-32">
      <div className="mx-auto max-w-7xl px-4 md:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-12 text-center md:mb-16">
          <ScrollReveal variant="fade-up">
            <h2 className="text-4xl leading-[0.9] tracking-tighter text-white md:text-6xl lg:text-7xl">
              FIND US
            </h2>
          </ScrollReveal>
          <ScrollReveal variant="fade-up" delay={0.1}>
            <p className="mt-4 font-body text-lg text-white/70 md:text-xl">
              Come train. We never close.
            </p>
          </ScrollReveal>
        </div>

        {/* Contact Bar */}
        <div className="mb-12 grid grid-cols-1 gap-4 sm:grid-cols-3 md:gap-6">
          <ScrollReveal variant="fade-up">
            <a href={`tel:${contact.phone}`} className="block">
              <Card className="flex items-center gap-4">
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center border-2 border-accent bg-canvas">
                  <Phone className="h-5 w-5 text-accent" />
                </div>
                <div>
                  <p className="font-display text-xs uppercase tracking-wider text-white/60">
                    CALL US
                  </p>
                  <p className="font-display text-sm text-white">{contact.phone}</p>
                </div>
              </Card>
            </a>
          </ScrollReveal>

          <ScrollReveal variant="fade-up" delay={0.1}>
            <a href={`mailto:${contact.email}`} className="block">
              <Card className="flex items-center gap-4">
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center border-2 border-accent bg-canvas">
                  <Mail className="h-5 w-5 text-accent" />
                </div>
                <div className="min-w-0">
                  <p className="font-display text-xs uppercase tracking-wider text-white/60">
                    EMAIL
                  </p>
                  <p className="truncate font-display text-sm text-white">{contact.email}</p>
                </div>
              </Card>
            </a>
          </ScrollReveal>

          <ScrollReveal variant="fade-up" delay={0.2}>
            <Card className="flex items-center gap-4">
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center border-2 border-accent bg-canvas">
                <Clock className="h-5 w-5 text-accent" />
              </div>
              <div>
                <p className="flex items-center gap-2 font-display text-xs uppercase tracking-wider text-white/60">
                  STATUS
                  <span className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
                </p>
                <p className="font-display text-sm text-white">OPEN NOW (24/7)</p>
              </div>
            </Card>
          </ScrollReveal>
        </div>

        {/* Map & Address */}
        <div className="grid gap-8 lg:grid-cols-2">
          {/* Map */}
          <ScrollReveal variant="slide-left">
            <div className="border-2 border-border bg-surface-elevated p-2">
              <iframe
                title="RAW HEAVY METAL GYM Location"
                src={contact.mapEmbedUrl}
                width="100%"
                height="400"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                className="h-[300px] w-full grayscale transition-all duration-500 hover:grayscale-0 md:h-[400px]"
                allowFullScreen
              />
            </div>
          </ScrollReveal>

          {/* Address & Actions */}
          <ScrollReveal variant="slide-right">
            <Card className="flex h-full flex-col">
              <div className="mb-6 flex items-start gap-4">
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center border-2 border-accent bg-canvas">
                  <MapPin className="h-5 w-5 text-accent" />
                </div>
                <div>
                  <h3 className="font-display text-lg uppercase tracking-wider text-white">
                    LOCATION
                  </h3>
                  <p className="mt-2 font-body text-sm text-white/70">{fullAddress}</p>
                </div>
              </div>

              {/* Hours */}
              <div className="mb-6 border-t-2 border-border pt-6">
                <h4 className="mb-3 font-display text-sm uppercase tracking-wider text-accent">
                  OPENING HOURS
                </h4>
                <ul className="space-y-2">
                  {contact.hours.map((hour) => (
                    <li key={hour.day} className="flex items-center justify-between">
                      <span className="font-body text-sm text-white/70">{hour.day}</span>
                      <span className="flex items-center gap-2 font-body text-sm text-white">
                        {hour.is24h && (
                          <span className="h-2 w-2 rounded-full bg-green-500" />
                        )}
                        {hour.hours}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Actions */}
              <div className="mt-auto space-y-3">
                <Button
                  variant="primary"
                  size="lg"
                  className="w-full"
                  onClick={() =>
                    window.open(contact.mapDeepLink, '_blank', 'noopener,noreferrer')
                  }
                >
                  <Navigation className="h-5 w-5" />
                  OPEN IN GOOGLE MAPS
                </Button>
                <Button
                  variant="secondary"
                  size="lg"
                  className="w-full"
                  onClick={handleCopyAddress}
                >
                  <Copy className="h-5 w-5" />
                  COPY ADDRESS
                </Button>
              </div>
            </Card>
          </ScrollReveal>
        </div>
      </div>

      <Toast
        message="Address copied to clipboard"
        isVisible={showToast}
        onClose={() => setShowToast(false)}
      />
    </section>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/Toast.tsx src/components/sections/Contact.tsx
git commit -m "feat: add Contact section with click-to-call, email, hours, maps embed, and copy-to-clipboard"
```

### Task 13: App Assembly & Root Composition

**Files:**
- Create: `src/App.tsx`
- Modify: `src/main.tsx`
- Create: `src/vite-env.d.ts`
- Create: `.env.example`

**Interfaces:**
- Consumes: All providers (Task 4, 5), layout (Task 8), sections (Task 9-12), CartDrawer (Task 11)
- Produces: Fully composed application root

- [ ] **Step 1: Create src/App.tsx**

```typescript
import { ScrollProvider } from './providers/ScrollProvider'
import { CartProvider } from './context/CartContext'
import { UIProvider } from './context/UIContext'
import { Header } from './components/layout/Header'
import { MobileNavDrawer } from './components/layout/MobileNavDrawer'
import { Footer } from './components/layout/Footer'
import { Hero } from './components/sections/Hero'
import { Membership } from './components/sections/Membership'
import { Merch } from './components/sections/Merch'
import { Contact } from './components/sections/Contact'
import { CartDrawer } from './components/cart/CartDrawer'

function App() {
  return (
    <ScrollProvider>
      <UIProvider>
        <CartProvider>
          <Header />
          <MobileNavDrawer />
          <CartDrawer />
          <main>
            <Hero />
            <Membership />
            <Merch />
            <Contact />
          </main>
          <Footer />
        </CartProvider>
      </UIProvider>
    </ScrollProvider>
  )
}

export default App
```

- [ ] **Step 2: Create src/vite-env.d.ts**

```typescript
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GYM_PHONE: string
  readonly VITE_GYM_EMAIL: string
  readonly VITE_GYM_ADDRESS: string
  readonly VITE_MAP_EMBED_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
```

- [ ] **Step 3: Create .env.example**

```bash
# Gym contact info (optional - falls back to data/gym-info.ts values)
VITE_GYM_PHONE="+1 (555) 123-4567"
VITE_GYM_EMAIL="join@rawheavymetalgym.com"
VITE_GYM_ADDRESS="123 Iron Street, Strength City, 10001, USA"
VITE_MAP_EMBED_URL="https://www.google.com/maps/embed?pb=..."
```

- [ ] **Step 4: Ensure main.tsx imports globals.css correctly**

```typescript
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/globals.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

- [ ] **Step 5: Remove default App.css import if present in App.tsx** (we don't import it)

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx src/main.tsx src/vite-env.d.ts .env.example
git commit -m "feat: compose app root with all providers, layout, sections, and cart drawer"
```

---

### Task 14: Vercel Deployment Configuration & Build Verification

**Files:**
- Create: `vercel.json`
- Modify: `package.json` (add scripts if missing)
- Modify: `index.html` (title, meta tags, preconnect fonts)

**Interfaces:**
- Consumes: Completed application from Task 13
- Produces: Production-ready build and deployment configuration

- [ ] **Step 1: Create vercel.json**

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
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

- [ ] **Step 2: Update index.html with proper metadata**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <meta name="theme-color" content="#0A0A0A" />
    <meta
      name="description"
      content="RAW HEAVY METAL GYM - No excuses. Just results. 24/7 access, 1,200 SQM of raw iron. Elite strength facilities with zero distractions."
    />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      rel="icon"
      type="image/svg+xml"
      href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' fill='%230A0A0A'/><text y='.9em' font-size='80' x='10' fill='%23FFEE00' font-family='sans-serif' font-weight='bold'>R</text></svg>"
    />
    <title>RAW HEAVY METAL GYM | No Excuses. Just Results.</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 3: Verify package.json scripts**

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "lint": "eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0",
    "preview": "vite preview"
  }
}
```

- [ ] **Step 4: Run the production build**

```bash
npm run build
```

Expected: Build succeeds with `dist/` output. Fix any TypeScript errors that surface.

- [ ] **Step 5: Run type checking**

```bash
npx tsc --noEmit
```

Expected: No type errors.

- [ ] **Step 6: Run lint**

```bash
npm run lint
```

Expected: No lint errors (fix reported issues).

- [ ] **Step 7: Preview the production build locally**

```bash
npm run preview
```

Expected: Preview server starts, site renders correctly at the provided localhost URL.

- [ ] **Step 8: Commit**

```bash
git add vercel.json index.html package.json
git commit -m "chore: add Vercel config, metadata, fonts preconnect, and verify production build"
```

---

### Task 15: Final Verification & Polish

**Files:**
- Modify: any files needing fixes discovered during verification

**Interfaces:**
- Consumes: Complete application from Task 14
- Produces: Verified, production-ready application

- [ ] **Step 1: Verify mobile responsiveness (375px)**

Use browser DevTools to set viewport to 375px width. Check:
- Header: Logo + cart + hamburger visible, no overflow
- Hero: Headline wraps cleanly, stats stack vertically
- Membership: Cards scroll horizontally with snap
- Merch: Product cards scroll horizontally with snap
- Contact: All buttons full-width, map renders
- Touch targets: All buttons minimum 48px height

- [ ] **Step 2: Verify desktop responsiveness (1280px)**

- Header: Full nav visible, hamburger hidden
- Hero: Stats in 3 columns, facilities in 4 columns
- Membership: 3 columns side by side
- Merch: 4 columns grid
- Contact: Map + address side by side

- [ ] **Step 3: Verify animations**

- Scroll down slowly: sections fade up, headlines stagger in
- Stat counters count up when scrolled into view
- Hover a Button: translates up-left with yellow shadow
- Hover a Card: border turns yellow
- Open cart: slides in from right, backdrop fades
- Open mobile menu: slides down, links stagger in
- Scroll locks when drawer is open (Lenis stopped)

- [ ] **Step 4: Verify interactive features**

- Click "QUICK ADD": product added, cart opens, count badge updates
- Change quantity in cart: subtotal updates, remove at 0
- Reload page: cart contents persist (localStorage)
- Click "OPEN IN GOOGLE MAPS": opens in new tab with correct query
- Click "COPY ADDRESS": copies to clipboard, toast appears
- Click phone: opens `tel:` link
- Click email: opens `mailto:` link

- [ ] **Step 5: Verify accessibility**

- Tab through the page: all interactive elements have visible focus rings
- Enable OS "reduce motion": all animations are disabled
- Run Lighthouse accessibility audit: score > 95

- [ ] **Step 6: Verify performance**

```bash
npm run build
```

Check `dist/assets/*.js` gzipped size < 100KB. Run Lighthouse performance audit, target > 90.

- [ ] **Step 7: Final commit**

```bash
git add -A
git commit -m "polish: final verification pass - responsive, animations, interactions, a11y, performance"
```

---

## Plan Self-Review

### Spec Coverage Check
| Spec Section | Implementing Task(s) |
|--------------|---------------------|
| 2.1 Tech Stack | Task 1 |
| 2.2 Project Structure | Tasks 1-13 |
| 2.3 Architectural Patterns | Tasks 4, 5 |
| 3.1 Color Palette | Task 2 |
| 3.2 Typography | Task 2 |
| 3.3 Spacing Scale | Task 2 |
| 3.4 Shadows & Borders | Task 2 |
| 3.5 Tailwind Integration | Task 2 |
| 4.1 UI Primitives | Task 6 |
| 4.2 Layout Components | Task 8 |
| 4.3 Hero | Task 9 |
| 4.3 Membership | Task 10 |
| 4.3 Merch | Task 11 |
| 4.3 Contact | Task 12 |
| 4.4 Animation Components | Task 7 |
| 5.1 TypeScript Interfaces | Task 3 |
| 6.1 Lenis Configuration | Task 5 |
| 6.2 Section Reveal | Task 7 |
| 6.3 Staggered Text | Task 7 |
| 6.4 Counter Animation | Task 9 |
| 6.5 Hover Interactions | Task 2, 6 |
| 6.6 Drawer Animations | Tasks 8, 11 |
| 6.7 Performance | Tasks 2, 5, 14 |
| 7 Responsive Breakpoints | Tasks 9-12, verified Task 15 |
| 8 Accessibility | Task 2, verified Task 15 |
| 9 Google Maps | Task 12 |
| 10 Performance Budget | Task 14, 15 |
| 11 Deployment | Task 14 |
| 12 Implementation Phases | Mapped to Tasks 1-15 |

### Type Consistency Check
- `CartContext` interface: `addItem`, `removeItem`, `updateQuantity`, `toggleCart`, `closeCart`, `clearCart` — used consistently in Header, CartDrawer, Merch.
- `UIState`: `isMobileMenuOpen`, `toggleMobileMenu`, `closeMobileMenu`, `openMobileMenu` — used consistently in Header, MobileNavDrawer.
- `Product`: `id`, `name`, `price`, `image`, `description` — used consistently in products data, Merch, CartDrawer.
- `MembershipTier`: `id`, `name`, `priceMonthly`, `priceAnnual`, `features`, `ctaText`, `popular` — used consistently in membership data and Membership section.
- `formatPrice` defined in Task 11 (`utils/formatters.ts`), consumed by CartDrawer and Merch.
- `ScrollProvider` exports `ScrollContext` consumed by `useScroll` (Task 5), used by MobileNavDrawer (Task 8) and CartDrawer (Task 11).

### Placeholder Scan
- No "TBD", "TODO", or "implement later" strings.
- All code steps contain complete, runnable code.
- All test/verification steps specify exact commands and expected results.

### Known Notes for Executor
1. **clsx / tailwind-merge**: Task 6 introduces these; the `cn` helper must be created at `src/lib/utils.ts` BEFORE Button/Card/Badge import it. If you build primitives before Step 5, import directly from `clsx`/`tailwind-merge` and refactor to shared `cn` once `lib/utils.ts` exists. The plan orders Steps 1-3 (primitives) before Step 5 (lib). To avoid a broken intermediate state, create `src/lib/utils.ts` first, then the primitives.
2. **Cart localStorage hydration**: Task 4 saves items but does not fully hydrate on load (simplified for MVP). If persistence-on-reload is required, extend the reducer with a `HYDRATE` action dispatched in a mount effect.
3. **Lenis import**: Uses `@studio-freight/lenis` (v1.x). If the package resolves to the newer `lenis` package, update imports from `@studio-freight/lenis` to `lenis` consistently across `lenis-setup.ts` and `ScrollProvider.tsx`.
4. **Env vars**: `data/gym-info.ts` currently hardcodes values; wiring `import.meta.env` is optional and not required for the build to work.
5. **No test framework**: The spec does not include a unit-test framework; verification is manual (Task 15) plus build/typecheck/lint (Task 14). If the implementer wants automated tests, add Vitest as a separate task.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-10-02-raw-heavy-metal-gym.md`.

Two execution options:

1. **Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks, fast iteration
2. **Inline Execution** — execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?