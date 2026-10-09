# REBORN FITNESS

Mobile-first, motion-driven marketing and booking site for a 24/7 biometric
performance gym — plus a private admin console for running the business
(members, monthly fees, payments and finances).

The public site is a React + TypeScript + Tailwind single page (GSAP ScrollTrigger
and Lenis smooth scroll sharing one requestAnimationFrame loop). The admin
console lives under `/admin` and talks to a separate Node/Express + MongoDB API
in [`server/`](./server).

## Stack

**Frontend**

- **React 18** + TypeScript (strict, `noUnusedLocals`, `noUnusedParameters`)
- **react-router-dom** for the `/admin` console
- **Vite 5** build with manual vendor chunks
- **Tailwind CSS 3** driven by RGB-channel tokens (`rgb(var(--color-x) / <alpha-value>)`)
- **GSAP 3** + `ScrollTrigger`, **Lenis**, **lucide-react**, **react-qr-code**

**Backend** (`server/`)

- **Node + Express 4** + **TypeScript**, compiled with `tsc` and run via `tsx` in dev
- **MongoDB** with **Mongoose 8**
- **express-session** (MongoDB-backed store in production) + **bcryptjs**
- **zod** request validation, **helmet**, rate limiting, double-submit CSRF
- **vitest** + **supertest** + **mongodb-memory-server** for tests

## Project layout

```
reborn/
├─ src/                 # public marketing site
│  ├─ admin/            # /admin console (routes, pages, components, api client)
│  └─ ...               # sections, ui, context, hooks
├─ server/              # admin API (independent package)
│  ├─ src/{config,models,middleware,services,routes,validation,utils}
│  ├─ src/bootstrap/admin.ts   # automatic admin bootstrap on startup
│  └─ tests/
├─ vite.config.ts       # dev proxy: /api -> http://localhost:4000
└─ package.json
```

## Getting started

### Prerequisites

- Node 18+ (developed on Node 24)
- A MongoDB instance (local `mongod`, Docker, or MongoDB Atlas) for running the API.
  Tests do **not** need one — they spin up `mongodb-memory-server`.

### Install

```bash
npm run install:all      # installs root + server dependencies
# or: npm install && npm --prefix server install
```

### Configure the API

```bash
cp server/.env.example server/.env
```

Fill in `server/.env` (see the file for descriptions):

| Variable | Purpose |
| --- | --- |
| `MONGODB_URI` | MongoDB connection string |
| `SESSION_SECRET` | 32+ byte random string used to sign session cookies |
| `CORS_ORIGINS` | Comma-separated allowed origins for credentialed CORS |
| `COOKIE_SECURE` | `true` behind HTTPS so cookies are `Secure` |
| `SESSION_TTL_HOURS` | Session lifetime in hours |
| `PORT` | API port (default `4000`) |
| `ADMIN_USERNAME` | Admin login username (min 3 chars; required in production) |
| `ADMIN_PASSWORD` | Admin login password (min 12 chars; required in production) |

Never commit the real `.env` — only `.env.example` is tracked.

### Create the first admin

There is **no public admin registration**. The admin account is created
automatically the first time the API starts with `ADMIN_USERNAME` and
`ADMIN_PASSWORD` set. Set them in `server/.env`:

```bash
ADMIN_USERNAME=owner
ADMIN_PASSWORD=choose-a-strong-password   # min 12 chars
```

The account is created with role `superadmin` and `active: true`, and the
password is stored only as a bcrypt hash. Bootstrap is idempotent: on every
later start the existing account is detected and **left unchanged**, so
re-deploying never resets the password and never creates duplicates. In
production both variables are required — the API refuses to start without them.

Local development can run without them (bootstrap is skipped). Credentials are
never printed to the console.

### Run in development

```bash
npm run dev:full     # starts Vite (:5173) + the API (:4000) together
```

Vite proxies `/api` to `http://localhost:4000`, so the cookie-based session works
same-origin in the browser. Individual processes:

```bash
npm run dev          # frontend only
npm run dev:server   # API only (tsx watch)
```

Open the marketing site at `http://localhost:5173` and the console at
`http://localhost:5173/admin`.

### Build & run for production

```bash
npm run build          # frontend -> dist/
npm run build:server   # API -> server/dist/
npm run start:server   # node server/dist/server.js
```

Serve `dist/` behind a reverse proxy and route `/api/*` to the API (same origin),
or host the API separately and set `CORS_ORIGINS` accordingly.

The first start creates the admin account from `ADMIN_USERNAME`/`ADMIN_PASSWORD`
(see [Create the first admin](#create-the-first-admin)); later starts leave it
untouched.

#### Deploying the API on Render

The API is a self-contained package in `server/`, so point the service at that
directory. `typescript` and the `@types/*` compiler dependencies live in
`dependencies`, so a production install (`npm install --omit=dev`) can still
build.

- **Root Directory:** `server`
- **Build Command:** `npm install && npm run build`
- **Start Command:** `npm start`
- **Environment:** `NODE_ENV=production`, `MONGODB_URI`, `SESSION_SECRET`,
  `CORS_ORIGINS`, `COOKIE_SECURE=true`, `SESSION_TTL_HOURS`, `ADMIN_USERNAME`,
  `ADMIN_PASSWORD`

From the repository root, the equivalent is:

```bash
npm run build:server   # or: npm --prefix server run build
npm run start:server   # or: npm --prefix server run start
```

## Admin console

Reachable at `/admin`. There is intentionally **no link from the public site**.

- **Dashboard** — collections, expected, outstanding and overdue totals for a month,
  a six-month expected-vs-collected trend, status breakdown, recent payments and the
  overdue member list.
- **Members** — search by name/ID/phone, filter by member or payment status, sort,
  paginate, create/edit, activate/deactivate (records are never deleted).
- **Member detail** — profile, lifetime billed/paid/outstanding, full payment history.
- **Payments** — generate monthly dues, filter/search the month's bills, record
  full/partial payments, void mistaken entries with a reason (optional replacement),
  and export the current view to CSV.

### Auth & security model

- Session cookie (`httpOnly`, `sameSite: lax`, `secure` when `COOKIE_SECURE=true`),
  stored in MongoDB in production, regenerated on login.
- Passwords hashed with **bcryptjs**; login responses are intentionally generic.
- **Double-submit CSRF**: a readable `reborn.csrf` cookie mirrors `req.session.csrf`;
  the client echoes it in the `x-csrf-token` header on every mutating request.
- Login rate limiting plus a global API limiter; `helmet` security headers.
- Corrections **never erase history** — entries are marked voided with who/when/why.

### Data conventions

- **Money is stored as integer paise**; the UI converts to ₹ for display.
- Dates are formatted in **Asia/Kolkata**; billing months are `YYYY-MM`.
- A unique index on `{ member, billingMonth }` guarantees one bill per member per month.
- The due amount is snapshotted at generation time, so later fee changes never rewrite
  historical bills.
- `status` is stored as `unpaid | partial | paid`; **`overdue` is derived live**
  (balance > 0 and due date in the past) rather than persisted.
- **Billing policy:** active members who joined before the end of the billing month are
  billed at the full monthly fee — **no proration**; inactive members are never billed.

### API endpoints

All admin routes are prefixed with `/api/admin` and require a session unless noted.

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/api/health` | public health check |
| `GET` | `/auth/csrf` | seeds the CSRF cookie/token |
| `POST` | `/auth/login` · `/auth/logout` | session lifecycle |
| `GET` | `/auth/me` | current admin |
| `GET` | `/members` | search/filter/sort/paginate |
| `POST` `PATCH` | `/members` · `/members/:id` | create / update |
| `POST` | `/members/:id/activate` · `/deactivate` | status changes |
| `GET` | `/members/:id` | profile + payment history + summary |
| `GET` | `/payments` | month's bills + totals |
| `GET` | `/payments/export` | CSV of the filtered view |
| `POST` | `/payments/generate-month` | create the month's bills |
| `GET` | `/payments/:id` | bill detail with entries |
| `POST` | `/payments/:id/entries` | record a payment |
| `POST` | `/payments/:id/corrections` | void/correct an entry |
| `GET` | `/dashboard` | metrics for a month |

## Scripts

**Root**

```bash
npm run dev          # Vite dev server (:5173)
npm run dev:server   # API dev server (:4000)
npm run dev:full     # both concurrently
npm run build        # tsc -b + vite build
npm run build:server # compile the API to server/dist
npm run start:server # run the compiled API
npm run lint         # eslint, zero warnings tolerated
npm run test:server  # run the API test suite
npm run preview      # serve dist/
```

**server/** — `npm --prefix server run <script>`: `dev`, `build`, `start`,
`typecheck`, `test`, `test:watch`.

## Testing

```bash
npm run test:server
```

Covers authentication and CSRF, member CRUD/validation/duplicate detection,
billing generation (no proration, excludes future joiners, never duplicates),
full/partial payments, overpayment rejection, live overdue derivation, fee-change
snapshots, collection-by-payment-date, and history-preserving corrections. The
suite uses `mongodb-memory-server`, so no external database is required.

## Design tokens

| Token | Value | Use |
| --- | --- | --- |
| `--color-canvas` | `#050505` | Pitch-black base layer |
| `--color-surface` / `--color-card` | `#121212` | Surfaces and cards |
| `--color-card-alt` | `#181818` | Alternating card layer |
| `--color-hairline` | `#262626` | 1px borders |
| `--color-accent` / `--color-lime` | `#FFEE00` | Electric-yellow CTAs, telemetry, focus |
| `--color-muted` / `--color-dim` | `#A3A3A3` / `#737373` | Secondary / tertiary text |

Fonts: **Space Grotesk** (display), **Inter** (body), **JetBrains Mono** (telemetry).

## Accessibility & motion

- Scroll locking falls back to `body { overflow: hidden }` when reduced motion
  disables Lenis
- Drawers, the pass modal and admin dialogs expose `role="dialog"`, `aria-modal`,
  Escape to close, initial focus, and focus restoration
- `prefers-reduced-motion: reduce` skips all GSAP tweens
- Skip link, live-region telemetry labels, visible focus rings
