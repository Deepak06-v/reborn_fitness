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

## WhatsApp Notifications (Official Meta WhatsApp Cloud API)

REBORN FITNESS includes a native WhatsApp Notification Module integrated directly into the operations console, powered exclusively by **Meta's official WhatsApp Business Platform Cloud API** via Meta Graph API (`v26.0`).

All legacy third-party gateways (Waporta, Evolution API, Baileys) have been removed.

### Key Capabilities

- **Official Meta Cloud API Provider**: Direct communication with `https://graph.facebook.com/{GRAPH_API_VERSION}/{PHONE_NUMBER_ID}/messages` authenticated by Bearer access tokens.
- **Approved Meta Template Messaging**: Business-initiated notifications outside the 24-hour customer care window use Meta-approved templates with strictly ordered parameters and international recipient formatting:
  - `reborn_fee_due_reminder`: Sent 2 days before monthly fee due date.
  - `reborn_fee_overdue_reminder`: Sent for overdue monthly fees.
  - `reborn_gym_closure`: Sent for holiday or operational maintenance closures.
  - `reborn_festive_offer`: Promotional offers sent only to members with explicit marketing consent.
- **Real-Time Payment Re-Check**: Before dispatching queued fee/overdue reminders, the queue worker re-verifies the member's current billing state against MongoDB. If the member paid in the interim, the message is cancelled as `skipped_paid`.
- **Marketing Consent & Inbound Opt-Outs**:
  - Promotional campaigns require explicit consent (`whatsappMarketingOptIn: true`).
  - Webhooks capture inbound member replies; keywords like `STOP`, `UNSUBSCRIBE`, or `CANCEL` immediately flag the member as opted out (`whatsappMarketingOptIn = false`) and log an audit note.
- **Meta Webhook Verification & Delivery State Machine**:
  - `GET /api/whatsapp/webhook`: Challenge verification handshake (`hub.challenge`).
  - `POST /api/whatsapp/webhook`: HMAC-SHA256 signature verification (`X-Hub-Signature-256`) against raw body bytes using `WHATSAPP_APP_SECRET`.
  - Monotonic status progression (`queued` → `sent` → `delivered` → `read`, or terminal `failed`). Out-of-order and duplicate webhook events are safely handled.
- **MongoDB-Backed Outbound Queue**:
  - Persistent queue recovers uncompleted jobs after server restarts.
  - Rate limiting (rolling window cap e.g. 15 msgs / 60s) and batch cooldown pacing.
  - Bounded retries with exponential backoff on transient network failures.
  - Automatic queue suspension on HTTP 429 rate limit or quota responses.
- **Admin Console Operations**:
  - Dedicated WhatsApp Notifications page under `/admin/whatsapp`.
  - Real-time diagnostic checks (credentials, phone number verification, webhook status).
  - Queue pause, resume, and clear controls.
  - Delivery status history, search, and filter.
  - Safe default: `WHATSAPP_ENABLED=false` until explicitly enabled by the owner.

---

### Backend Environment Configuration

Add the following variables to `server/.env` (or your Render dashboard):

```env
# --- Provider selection: mock (tests/dev) or cloud_api (production) ---
WHATSAPP_PROVIDER=cloud_api
# Keep false until credentials, webhook verification, and templates are verified!
WHATSAPP_ENABLED=false

# Meta Graph API version
WHATSAPP_GRAPH_API_VERSION=v26.0

# Meta Cloud API Credentials (obtain from Meta Developer Portal / Business Manager)
WHATSAPP_ACCESS_TOKEN=your-meta-system-user-access-token
WHATSAPP_PHONE_NUMBER_ID=your-meta-phone-number-id
WHATSAPP_BUSINESS_ACCOUNT_ID=your-meta-business-account-id
WHATSAPP_APP_SECRET=your-meta-app-secret

# Webhook Verification Token & Path
WHATSAPP_WEBHOOK_VERIFY_TOKEN=your-custom-webhook-verify-token
WHATSAPP_WEBHOOK_PATH=/api/whatsapp/webhook

# Approved Meta Message Templates
WHATSAPP_TEMPLATE_FEE_DUE=reborn_fee_due_reminder
WHATSAPP_TEMPLATE_FEE_DUE_LANG=en_US
WHATSAPP_TEMPLATE_FEE_OVERDUE=reborn_fee_overdue_reminder
WHATSAPP_TEMPLATE_FEE_OVERDUE_LANG=en_US
WHATSAPP_TEMPLATE_GYM_CLOSURE=reborn_gym_closure
WHATSAPP_TEMPLATE_GYM_CLOSURE_LANG=en_US
WHATSAPP_TEMPLATE_FESTIVE_OFFER=reborn_festive_offer
WHATSAPP_TEMPLATE_FESTIVE_OFFER_LANG=en_US

# Sequential queue batching and cooldown pacing
WHATSAPP_QUEUE_BATCH_SIZE=5
WHATSAPP_QUEUE_BATCH_COOLDOWN_MS=5000
WHATSAPP_MESSAGE_DELAY_MS=1500

# Rolling-window rate limiter settings (safe conservative limit, e.g. 15 msgs / 60s)
WHATSAPP_RATE_LIMIT_MAX_PER_WINDOW=15
WHATSAPP_RATE_LIMIT_WINDOW_MS=60000
WHATSAPP_MAX_RETRIES=3

# Broadcast campaign inter-message pacing (default: 4000 ms)
WHATSAPP_CAMPAIGN_DELAY_MS=4000
```

---

### Meta WhatsApp Cloud API Setup Guide

Follow these steps to set up Meta Cloud API for REBORN FITNESS:

#### Step 1: Create a Meta App
1. Go to [developers.facebook.com](https://developers.facebook.com) and log in with your Meta Business account.
2. Click **My Apps** > **Create App**.
3. Select **Other** > **Business** as the app type.
4. Name your app (e.g., `REBORN FITNESS Notifications`) and connect your Meta Business Portfolio.
5. In the App Dashboard, scroll to **WhatsApp** and click **Set up**.

#### Step 2: Configure Business Phone Number
1. Under **WhatsApp** > **API Setup**:
   - In development/sandbox mode, you can test with Meta's Test Phone Number and register test recipient numbers.
   - In production, add your gym's official phone number under **Step 5: Add a phone number**.
   - Complete SMS/voice OTP verification.
2. Note your **Phone Number ID** and **WhatsApp Business Account ID (WABA ID)**.

#### Step 3: Generate a Permanent System User Token
> **Critical**: Do NOT use the temporary 24-hour User Access Token from the API Setup page in production.
1. In [Meta Business Suite](https://business.facebook.com), navigate to **Settings** > **Users** > **System Users**.
2. Click **Add** to create an Admin System User (e.g., `reborn-api-service`).
3. Under **Assigned Assets**, assign your WhatsApp Business Account with **Full Control** (Manage WhatsApp account).
4. Click **Generate New Token**:
   - App: Select `REBORN FITNESS Notifications`.
   - Token expiration: **Never**.
   - Permissions: Select `whatsapp_business_messaging` and `whatsapp_business_management`.
5. Copy the generated token immediately into `WHATSAPP_ACCESS_TOKEN`.
6. From **App Settings** > **Basic** in Developer Dashboard, copy the **App Secret** into `WHATSAPP_APP_SECRET`.

#### Step 4: Create and Submit Message Templates for Approval
In [WhatsApp Manager](https://business.facebook.com/wa/manage/message-templates/):
1. **Fee Due Reminder** (`reborn_fee_due_reminder`):
   - Category: `UTILITY` | Language: `en_US`
   - Body: `Hello {{1}}, this is a friendly reminder from REBORN FITNESS that your gym membership fee of {{2}} for the month of {{3}} is due on {{4}}. Please ensure timely payment to maintain uninterrupted access.`
2. **Fee Overdue Reminder** (`reborn_fee_overdue_reminder`):
   - Category: `UTILITY` | Language: `en_US`
   - Body: `Hello {{1}}, your gym membership fee of {{2}} for the month of {{3}} was due on {{4}} and is currently overdue. Please clear your dues at the desk or online to keep your membership active.`
3. **Gym Closure Announcement** (`reborn_gym_closure`):
   - Category: `UTILITY` | Language: `en_US`
   - Body: `Important Notice from REBORN FITNESS: The gym will remain closed from {{1}} to {{2}} due to {{3}}. Regular operations resume on {{4}}. We regret any inconvenience caused.`
4. **Festive Offer / Promotion** (`reborn_festive_offer`):
   - Category: `MARKETING` | Language: `en_US`
   - Body: `Exclusive Offer from REBORN FITNESS! Dear {{1}}, celebrate {{2}} with {{3}} off on our annual memberships. Offer valid until {{4}}. Visit our desk to claim!`

Wait for Meta's review and approval (typically a few minutes to hours for utility templates).

#### Step 5: Configure the Webhook
1. In Meta Developer Dashboard > **WhatsApp** > **Configuration**:
2. Click **Edit** next to Webhook:
   - **Callback URL**: `https://<your-render-service>.onrender.com/api/whatsapp/webhook`
   - **Verify Token**: Any secret string you choose (must match `WHATSAPP_WEBHOOK_VERIFY_TOKEN`).
3. Click **Verify and Save**. Meta will issue a `GET` request with `hub.challenge`.
4. In Webhook Fields, find **`messages`** and click **Subscribe**.

#### Step 6: Render Backend Deployment
1. Open your Render dashboard for the `reborn-fitness-server` service.
2. In **Environment**, configure:
   - `WHATSAPP_PROVIDER=cloud_api`
   - `WHATSAPP_GRAPH_API_VERSION=v26.0`
   - `WHATSAPP_ACCESS_TOKEN=<Permanent System User Token>`
   - `WHATSAPP_PHONE_NUMBER_ID=<Phone Number ID>`
   - `WHATSAPP_BUSINESS_ACCOUNT_ID=<WABA ID>`
   - `WHATSAPP_APP_SECRET=<App Secret>`
   - `WHATSAPP_WEBHOOK_VERIFY_TOKEN=<Verify Token>`
   - `WHATSAPP_WEBHOOK_PATH=/api/whatsapp/webhook`
   - `WHATSAPP_ENABLED=false` (start with false!)
3. Trigger a manual deploy.

---

### Owner Pre-Launch Checklist

Before toggling `WHATSAPP_ENABLED=true` on production:

1. [ ] **Meta Business Verification**: Ensure the Business Portfolio is verified in Meta Business Manager.
2. [ ] **Payment Method Added**: Confirm a valid credit/debit card is added to the WhatsApp Business Account for Meta conversation tier billing.
3. [ ] **Templates Approved**: Verify in WhatsApp Manager that `reborn_fee_due_reminder`, `reborn_fee_overdue_reminder`, `reborn_gym_closure`, and `reborn_festive_offer` have status **Approved** (Green).
4. [ ] **Webhook Active**: Confirm the Meta Developer App shows `Webhook Verified` with active subscription to `messages`.
5. [ ] **Admin Diagnostics Clean**: Open `/admin/whatsapp` in the REBORN FITNESS console. Check that:
   - Provider displays **Meta Cloud API**.
   - Phone Number ID and WABA ID match.
   - Status shows Connected / Configured.
6. [ ] **Single Test Send**: Send a single test template to the gym owner's personal verified number. Confirm:
   - Message arrives on WhatsApp.
   - Delivery webhook changes status from `queued` → `sent` → `delivered` → `read` in the admin log.
7. [ ] **Marketing Opt-In Hygiene**: Verify that promotional messages are only targeted to members who have given express consent (`whatsappMarketingOptIn`).
8. [ ] **Enable Live Messaging**: Set `WHATSAPP_ENABLED=true` in Render environment variables and save.

