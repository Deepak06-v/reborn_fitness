# REBORN FITNESS

Mobile-first, motion-driven marketing site for a 24/7 biometric
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
- **GSAP 3** + `ScrollTrigger`, **Lenis**, **lucide-react**

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
| `BILLING_RECONCILE_INTERVAL_MINUTES` | How often the recurring-billing job runs (default `360`) |
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

#### Deploying the frontend on Vercel

The frontend is a client-side React (React Router) SPA, so deep links such as
`/admin` must be rewritten to `index.html` for the router to render them.
`vercel.json` does this and also proxies `/api/*` to the Render backend:

- **SPA fallback** — any path that is not a static asset is served `index.html`,
  so directly opening `/admin`, `/admin/login`, `/admin/members`, etc. loads the
  SPA instead of a 404.
- **API proxy** — `/api/*` is rewritten to `https://reborn-fitness.onrender.com/api/*`.
  Because the browser always talks to the frontend origin, the session and CSRF
  cookies work normally (no CORS, no `SameSite` changes), and the admin console
  keeps using its relative `/api/admin/...` calls unchanged.

Vercel settings for this repository:

- **Framework Preset:** Vite
- **Build Command:** `npm run build`
- **Output Directory:** `dist`
- **Install Command:** `npm install`

No dashboard rewrites are required — the rules live in `vercel.json`.

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

The recurring-billing scheduler runs inside the API process, so no external cron
is needed. Reconciliation is also triggered on admin reads, so a suspended or
restarted Render instance self-heals on the next request. Tune the interval with
`BILLING_RECONCILE_INTERVAL_MINUTES` (default `360`); the job is idempotent, so
running it more often is harmless.

## Admin console

Reachable at `/admin`. There is intentionally **no link from the public site**.

- **Dashboard** — collections, expected, outstanding and overdue totals for a month,
  a six-month expected-vs-collected trend, status breakdown, recent payments and the
  overdue member list.
- **Members** — search by name/ID/phone, filter by member or payment status, sort,
  paginate, create/edit, activate/deactivate (records are never deleted).
- **Member detail** — profile, lifetime billed/paid/outstanding, full payment history.
- **Payments** — every member's billing periods are created and maintained
  automatically (no manual generation), filter/search across all periods or a
  single month, record full/partial payments, void mistaken entries with a reason
  (optional replacement), and export the current view to CSV.

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

### Automatic billing

Billing periods are created and maintained by the backend — there is **no manual
"generate" action**. Adding a member issues their first period from their joining
date and plan; a reconciliation job then chains each later period forward from the
membership start using the plan duration (monthly/quarterly/half-yearly/yearly).

- **Anchored cycles** — the joining day is the anchor. If a later month is shorter
  the period is clamped to that month's last day, then the anchor day resumes
  (e.g. joining on the 31st bills `2026-02-28`, then `2026-03-31`).
- **Idempotent & restart-safe** — a unique `{ member, billingMonth }` index plus an
  in-flight guard mean overlapping runs and restarts never duplicate bills, and a
  missed run is backfilled on the next pass. No unlimited future bills are created:
  only periods whose start date has arrived.
- **Runs on demand and on a schedule** — reconciliation runs on every payments,
  members and dashboard read (so the console is always current without relying on
  client timers), plus a background interval job
  (`BILLING_RECONCILE_INTERVAL_MINUTES`) started on boot.
- **Immutable history** — the plan price is snapshotted per period, so a later plan
  change only affects the next unissued period and never rewrites issued bills.
- **Membership vs payment status** — deactivating a member stops new bills and never
  deletes history; `status` is stored as `unpaid | partial | paid` while the
  **`due_soon`/`overdue` state is derived live** in IST: unpaid and due more than
  7 calendar days out → **unpaid**; due within the next 7 days (including today) →
  **due soon**; due date passed with a balance → **overdue**.
- **Billing policy** — active members are billed the full plan price per period
  (**no proration**); inactive members are never billed further.

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
| `GET` | `/payments` | billing periods (all, or one `month`) + totals |
| `GET` | `/payments/export` | CSV of the filtered view |
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
automatic recurring billing (anchored month-end cycles, idempotency, concurrency,
inactive-member handling, fee-change snapshots), full/partial payments,
overpayment rejection, live due-state derivation, collection-by-payment-date,
and history-preserving corrections. The suite uses `mongodb-memory-server`, so no
external database is required.

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
- Drawers and admin dialogs expose `role="dialog"`, `aria-modal`,
  Escape to close, initial focus, and focus restoration
- `prefers-reduced-motion: reduce` skips all GSAP tweens
- Skip link, live-region telemetry labels, visible focus rings

## WhatsApp Notifications & Meta Cloud API Setup

REBORN FITNESS includes a native WhatsApp Notification Admin Module integrated directly into the operations console.

### Key Features
- **Upcoming Fee Reminders**: Identifies active members whose fee is due in exactly 2 days (IST). Runs automatically and deduplicates per member per due date cycle.
- **Overdue Reminders**: Runs daily for unpaid members. Stops automatically once payment is marked paid. Deduplicates per member per calendar day.
- **Custom Broadcast Messages**: Targeted broadcasts (All members, Active only, Overdue only, Plan filter) with optional photo/media attachment, recipient count preview, and pre-send confirmation safeguard.
- **Official Meta Cloud API Provider**: Provider abstraction with mock/safe fallback mode when credentials are not configured.
- **Delivery Tracking Webhook**: Receives Meta webhook callbacks for `sent`, `delivered`, `read`, and `failed` states, protected by `X-Hub-Signature-256` HMAC validation.

### Meta Setup & Production Activation Guide

Follow these steps to configure production WhatsApp Cloud API credentials:

#### 1. Meta Developer App Setup
1. Log in to [Meta for Developers](https://developers.facebook.com/).
2. Click **My Apps** > **Create App**.
3. Select **Other** as the use case > choose **Business** type.
4. Name your app (e.g. `Reborn Fitness Automation`) and associate it with your Meta Business Account.
5. In the App Dashboard, click **Set up** on the **WhatsApp** tile.

#### 2. WhatsApp Business Account (WABA) & Phone Number ID
1. In the WhatsApp Getting Started page, locate your test/production credentials:
   - **Phone Number ID**: Numeric ID associated with your gym's WhatsApp number.
   - **WhatsApp Business Account ID (WABA ID)**: Numeric ID of your WABA.
2. In production, add and verify your gym's official phone number under **WhatsApp** > **Configuration** > **Phone numbers**.

#### 3. System User & Permanent Production Access Token
1. Go to [Meta Business Settings](https://business.facebook.com/settings).
2. Navigate to **Users** > **System Users** and click **Add**.
3. Assign the **Admin** role to the system user (e.g. `reborn-backend-system-user`).
4. Click **Generate New Token**, select your WhatsApp App, and choose permissions:
   - `whatsapp_business_messaging`
   - `whatsapp_business_management`
5. Set token expiration to **Permanent** (Never expires). Copy this token — this is your `WHATSAPP_ACCESS_TOKEN`.

#### 4. App Secret & Webhook Verify Token
1. In Meta Developer App, go to **App Settings** > **Basic** > view **App Secret**. This is your `WHATSAPP_APP_SECRET`.
2. Choose a custom secure string for `WHATSAPP_VERIFY_TOKEN` (e.g. a random 32-character string).

#### 5. Webhook Configuration
1. In Meta Developer App under **WhatsApp** > **Configuration**, locate the **Webhook** section.
2. Click **Edit**:
   - **Callback URL**: `https://<your-render-domain>/api/whatsapp/webhook`
   - **Verify Token**: Must match `WHATSAPP_VERIFY_TOKEN`.
3. Click **Verify and Save**.
4. In Webhook fields, click **Manage** and subscribe to:
   - `messages` (delivers delivery receipts, status updates, and errors).

#### 6. Message Template Setup in WhatsApp Manager
In the [WhatsApp Manager](https://business.facebook.com/wa/manage/home/):
1. Create Template 1 — **Fee Due in 2 Days**:
   - Name: `reborn_fee_due_reminder`
   - Category: `UTILITY`
   - Language: `en` (or `en_US`)
   - Body format:
     `Hi {{1}}, this is a friendly reminder from REBORN FITNESS. Your gym membership ({{2}}) fee of ₹{{3}} is due on {{4}}. Thank you!`
2. Create Template 2 — **Fee Overdue**:
   - Name: `reborn_fee_overdue_reminder`
   - Category: `UTILITY`
   - Language: `en` (or `en_US`)
   - Body format:
     `Hi {{1}}, your REBORN FITNESS membership fee of ₹{{2}} ({{3}}) is overdue by {{4}} days. Kindly complete your payment at the gym counter.`
3. Submit templates for Meta approval (usually approved within minutes).

#### 7. Render Environment Variables
Add these environment variables to your backend service in Render:

```env
WHATSAPP_ENABLED=true
WHATSAPP_API_VERSION=v21.0
WHATSAPP_PHONE_NUMBER_ID=your_meta_phone_number_id
WHATSAPP_WABA_ID=your_whatsapp_business_account_id
WHATSAPP_ACCESS_TOKEN=your_permanent_system_user_token
WHATSAPP_VERIFY_TOKEN=your_custom_webhook_verify_token
WHATSAPP_APP_SECRET=your_meta_app_secret
WHATSAPP_WEBHOOK_PATH=/api/whatsapp/webhook
```

When deployed with these variables, the WhatsApp integration will automatically switch from mock mode to live Meta API delivery.

