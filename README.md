# net2phone Settings App

A Google Admin–style settings console for net2phone UCaaS, built with Next.js 14. Manages team members, call routing, phone numbers, devices, SMS/10DLC registration, 911 contacts, and more — plus an AI-driven onboarding concierge that activates new accounts from a branded welcome landing page through full system configuration.

---

## Table of Contents

1. [Tech Stack](#tech-stack)
2. [Features](#features)
3. [The Concierge — AI Onboarding Agent](#the-concierge--ai-onboarding-agent)
4. [Welcome Landing Page (`/welcome`)](#welcome-landing-page-welcome)
5. [Internationalization (i18n)](#internationalization-i18n)
6. [API Routes](#api-routes)
7. [Proxy Architecture](#proxy-architecture)
8. [MCP Server](#mcp-server)
9. [Local Development](#local-development)
10. [Environment Variables](#environment-variables)
11. [Deployment (Vercel)](#deployment-vercel)
12. [Security](#security)
13. [Known Limitations](#known-limitations)

---

## Tech Stack

| Layer | Library |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Data fetching | TanStack Query (React Query) |
| Tables | TanStack Table |
| Icons | Lucide React |
| Charts | Recharts |
| HTTP client | Axios (OAuth2 token refresh) |
| AI model | Anthropic Claude (`claude-sonnet-4-6`, `claude-haiku-4-5`) |
| AI streaming | Server-Sent Events (SSE) |
| AI context | Model Context Protocol (MCP) via `lib/mcp/server.ts` |
| Markdown rendering | `react-markdown` + `remark-gfm` |
| Internationalization | `next-intl` (locale routing, `useTranslations`, `NextIntlClientProvider`) |

---

## Features

### Overview
- **Dashboard** — Account analytics, team/department counts, phone number summary, call stats
- **Analytics** — Call history-derived analytics, user/department breakdowns

### Communications
- **Calls** — Call history with CDR, playback, voicemail integration, AI call analysis
- **Voicemail** — Voicemail list, playback, detail modal
- **Call History** — Full CDR history with filters and export

### Organization
- **Team Members** — CRUD, departments, extensions, devices
- **Departments** — CRUD, call forwarding rules, features
- **Company** — Company directory (feature-gated)

### Call Routing
- **Virtual Assistant** — Welcome menus (auto-attendants), greetings, TTS, routing
- **Ring Groups** — CRUD, members, overflow, tier rings, schedules
- **Call Queues** — CRUD, agents, reports (agent activity, queue activity)

### Resources
- **Phone Numbers** — List, search, assignment
- **Devices** — Devices, extensions, SIP registrations, templates, orders, reboot
- **Device Management** — Device provisioning
- **Schedules** — Time-based schedules with national holiday auto-import (USA, Canada, CALA)
- **Special Extensions** — Custom extensions
- **Virtual Fax** — Fax numbers CRUD

### Integrations
- **SIP Trunking** — Trunk accounts, trunks, limits, service addresses, phone numbers
- **SIP Tie-Lines** — Tie-line configuration
- **Webhooks / API** — Full webhook management: name, destination URL, description, event filtering (All / Specific), user scoping (Entire Company / Specific Team Members), secret key display with copy, create + delete via API
- **API Setup** — Auth API setup

### Settings
- **Voicemail Settings** — Voicemail configuration
- **Music Options** — Hold music CRUD
- **Company Directory** — Directory settings (feature-gated)
- **911 Contacts** — Emergency notification numbers (Kari's Law)
- **Licenses** — License management
- **Trust Center** — 10DLC (Messaging Registration Center), SSO, 2FA, security
- **Delegates** — Delegate management
- **Number Porting** — Port requests, status, wizard
- **Bulk Operations** — Bulk load status

---

## The Concierge — AI Onboarding Agent

The Concierge is an AI-powered conversational onboarding agent that guides new accounts through the entire setup process. It uses Anthropic Claude via SSE streaming and calls the same MCP tools the settings UI uses — so every step results in real data written to the net2phone backend.

### Onboarding Stages

| # | Stage key | What happens |
|---|---|---|
| 1 | `welcome_scrape` | Collects admin name + website URL; Claude scrapes the website to extract company name, hours, timezone, phone numbers, and description |
| 2 | `verification_holidays` | Admin reviews and corrects scraped data; optionally auto-loads national holidays |
| 3 | `cdr_analysis` | *(Optional)* Admin uploads a CDR CSV; a dedicated Claude agent analyzes it to extract users, extensions, numbers, call patterns, and recommends ring group / call queue / after-hours configuration |
| 4 | `porting` | Multi-step porting wizard: select numbers, enter current provider details, submit contact/billing address, receive LOA signing link |
| 5 | `user_ingestion` | Add team members manually or upload a CSV; live email validation against the net2phone account prevents duplicate users |
| 6 | `architecture_hardware` | Sequential sub-steps: define departments → assign users → choose phone type → configure hardphone details and MAC addresses |
| 7 | `licensing` | Comprehensive call routing setup: welcome menu (greeting, TTS, menu options, extension dialing, barge, hold message) → ring group or call queue (strategy, tiers, rings, schedule) → after-hours configuration |
| 8 | `final_blueprint` | Markdown summary of the full configuration; one-click "Confirm & Build" applies everything via MCP tools with a live step-by-step progress display |

### Key Technical Details

- **AI loop:** `hooks/useConciergeAgent.ts` drives the Claude tool-use loop. The AI controls all stage transitions via an `advance_stage` tool — widgets never advance the stage directly.
- **Streaming:** `app/api/concierge-agent/route.ts` uses the Anthropic streaming SDK and writes SSE events to the client so responses appear token-by-token.
- **State persistence:** Onboarding state is saved to the server on every stage change (`app/api/onboarding-state/route.ts`) with optimistic locking. `localStorage` provides a fast in-memory fallback.
- **Configuration application:** `lib/api/concierge-backend.ts` calls MCP tools to create users, departments, ring groups, call queues, schedules, welcome menus, and after-hours routing.
- **CDR analysis:** `app/api/analyze-cdr/route.ts` sends the uploaded CSV to `claude-sonnet-4-6` and returns structured JSON (agents, numbers, queues, insights, recommendations) that pre-populates later stages.
- **Stage guards:** `lib/utils/stage-guards.ts` prevents the AI from advancing a stage until all required fields are collected.
- **Retry logic:** `lib/utils/retry.ts` wraps all MCP calls with exponential backoff.
- **Conversation truncation:** `lib/utils/truncate-messages.ts` keeps the message history within Claude's context window.
- **Analytics:** `lib/utils/analytics.ts` tracks flow events. Wire a real destination (PostHog, Segment, custom webhook) with one call to `setAnalyticsDestination(fn)`.
- **Locale-aware AI:** The active locale is sent with every request to `/api/concierge-agent`; the system prompt instructs Claude to respond in the user's language.

### Widget Files

Each onboarding stage has its own component under `components/concierge/widgets/`:

```
components/concierge/
├── ConciergeOverlay.tsx      # Chat UI shell, message bubbles, input
├── StageWidgets.tsx          # Thin dispatcher (50 lines)
├── widgets/
│   ├── shared.tsx            # CardShell, FixItButton, ValidationErrors
│   ├── WelcomeScrapeWidget.tsx
│   ├── VerificationWidget.tsx
│   ├── CdrWidget.tsx
│   ├── PortingWidget.tsx
│   ├── UserIngestionWidget.tsx
│   ├── ArchitectureWidget.tsx
│   ├── CallRoutingWidget.tsx
│   └── FinalBlueprintWidget.tsx
├── MessageBubble.tsx
├── ProgressBar.tsx
└── ErrorBoundary (via components/ui/ErrorBoundary.tsx)
```

---

## Welcome Landing Page (`/welcome`)

New accounts receive an email with a link to **`https://n2psettings.vercel.app/welcome`** after purchasing. This is the first touchpoint with the product.

### User flow

```
Email link → /welcome
  → (if not signed in) /login?returnUrl=/welcome → /welcome
  → User clicks "Start Setup"
  → Concierge overlay opens (welcome mode)
  → Onboarding flow (8 stages)
  → Flow complete → /ucass/onboarding (settings hub)
```

### Page design

- **Net2phone branded** — pastel blue→violet→pink gradient background, `Plus_Jakarta_Sans` typeface, gradient-accent CTA button
- **"Account confirmed" pill** — green checkmark signals the paid account is ready
- **Headline:** *"Let's get your phone system live."*
- **Steps card** — briefly explains what the assistant will do (learn business info → set up team/routing → activate)
- **Language selector** — globe icon + locale code in the top-right header; sets `NEXT_LOCALE` cookie and reloads; supports EN / ES / PT-BR / FR-CA
- **No auto-open** — assistant only opens when the user clicks "Start Setup"

### Concierge welcome mode

When the overlay is open on `/welcome`, it switches to a wider, more polished shell:

| Feature | Default (dashboard) | Welcome mode |
|---|---|---|
| Panel width | `max-w-2xl` | `max-w-3xl` |
| Header | Blue icon + title | Gradient avatar + gradient hairline |
| Backdrop | Click to dismiss | Non-dismissible (pointer-events-none) |
| Progress bar | Solid blue | Blue→violet→fuchsia gradient |
| Done CTA | "Close" | "Open Settings & continue →" → `/ucass/onboarding` |

### Key files

```
app/welcome/
├── page.tsx          # Landing UI — headline, steps card, CTA
├── layout.tsx        # Metadata (title/description)
└── WelcomeShell.tsx  # Auth gate + AssistantProvider + ConciergeProvider

components/welcome/
└── WelcomeAgentAvatar.tsx   # SVG agent mark (slate + blue gradient)
```

---

## Internationalization (i18n)

The app ships with full multi-language support powered by [`next-intl`](https://next-intl-docs.vercel.app/).

### Supported Locales

| Locale | Language | Market |
|---|---|---|
| `en` | English | USA, global (default) |
| `es` | Spanish | CALA (Latin America) |
| `fr-CA` | French (Canadian) | Canada |
| `pt-BR` | Portuguese (Brazilian) | Brazil |

### How It Works

**Locale detection order:**
1. `NEXT_LOCALE` cookie — set when the user picks a language from the selector
2. Browser `Accept-Language` header
3. Default locale (`en`)

**Routing strategy:** `"never"` prefix — locale is determined solely by cookie or `Accept-Language` header; URLs are **never** rewritten with a locale segment. All routes remain at their canonical paths (`/ucass/...`) for every language. This avoids 404s that would otherwise occur if the middleware redirected to `/es/ucass/...` paths that have no corresponding pages in the app directory.

**Key files:**

```
i18n/
├── config.ts       # Locale list, default locale, lang tags
├── request.ts      # Server-side getRequestConfig (loads messages per locale)
└── routing.ts      # defineRouting with localePrefix: "never"

messages/
├── en.json         # English (base / source of truth)
├── es.json         # Spanish
├── fr-CA.json      # French Canadian
└── pt-BR.json      # Brazilian Portuguese

middleware.ts       # next-intl middleware (locale detection + URL rewriting)
contexts/LocaleContext.tsx   # Client-side locale state + setLocale() helper
components/ui/LocaleSelector.tsx  # Globe icon dropdown in the TopBar
```

**String coverage:** All message files include translations for:
- Common UI primitives (`common.*`)
- Auth / login page (`login.*`, `auth.*`)
- Top navigation groups and items (`nav.*`)
- TopBar controls (`topbar.*`)
- The full Concierge agent UI — all 8 stages, all widget labels, error messages, placeholders (`concierge.*`)
- Welcome landing page (`welcomeLanding.*`)
- Sidekick / N2P Assistant (`assistant.*`)
- Schedules, Ring Groups, Team Members sections
- Error boundary and error pages (`errors.*`)
- Language picker labels (`locale.*`)

**Adding a new locale:**
1. Add the locale code to `i18n/config.ts` → `locales` array.
2. Create `messages/<locale>.json` (copy `en.json` as a base).
3. That's it — the middleware, routing, and `LocaleSelector` pick it up automatically.

**AI language support:** The user's active locale is forwarded to `/api/concierge-agent` with every request. The system prompt instructs Claude to respond **only** in that language, so the entire onboarding conversation (including AI-generated summaries, tables, and confirmations) matches the user's selected language.

---

## API Routes

| Route | Method(s) | Auth required | Description |
|---|---|---|---|
| `/api/concierge-agent` | POST | Yes | SSE-streaming Claude agent; drives the onboarding conversation |
| `/api/analyze-cdr` | POST | Yes | CDR CSV → Claude analysis → structured JSON |
| `/api/research-website` | POST | No | Scrapes a website using Claude and extracts business info |
| `/api/n2p-tools` | POST | Yes | Executes any MCP tool against the net2phone backend |
| `/api/onboarding-state` | GET / PUT / DELETE | Yes | Server-side persistence for onboarding state (with optimistic locking) |
| `/api/porting` | GET / POST | Yes | Submit and track number porting requests |
| `/api/validate-user-email` | GET | Yes | Real-time email availability check against the account's team members |
| `/api/proxy/[...path]` | ALL | Forwarded | Proxies to `app.net2phone.com/api` |
| `/api/proxy-v2/[...path]` | ALL | Forwarded | Proxies to `app.net2phone.com/api/v2` |
| `/api/proxy-n2p/[...path]` | ALL | Forwarded | Proxies to `api.n2p.io/v2` |
| `/api/proxy-auth/[...path]` | ALL | Forwarded | Proxies to `auth.net2phone.com/api` |

---

## Proxy Architecture

The app proxies all net2phone API calls through Next.js server routes so credentials never leave the server and the browser only talks to the same origin.

```
Browser → /api/proxy/[...path]       → app.net2phone.com/api
Browser → /api/proxy-v2/[...path]    → app.net2phone.com/api/v2
Browser → /api/proxy-n2p/[...path]   → api.n2p.io/v2
Browser → /api/proxy-auth/[...path]  → auth.net2phone.com/api
```

All proxy routes validate path segments before forwarding (blocks `../` traversal and unsafe characters).

---

## MCP Server

`lib/mcp/server.ts` exposes 60+ net2phone API operations as MCP tools. The `lib/n2p-tools/adapter.ts` maps Anthropic tool calls to the correct MCP tool + argument shape.

Available tool categories:
- Team members — create, search, update, assign phone
- Departments — create, list, assign members
- Ring groups — create, update, add members, set schedule
- Call queues — create, update, add agents
- Schedules — create, add time blocks, load holidays
- Virtual assistant — create/update, set menu options, TTS greeting
- Phone numbers — list, assign
- Users — get next extension
- Devices — list, assign
- Licenses — check eligibility

The MCP server is also compatible with Claude Desktop. See `n2p-mcp/README.md` for setup.

---

## Local Development

### Prerequisites

- Node.js 18+
- An active net2phone account with admin access
- Anthropic API key (for the Concierge and CDR analysis)

### Steps

```bash
# 1. Install dependencies
npm install

# 2. Create environment file
cp .env.example .env.local
# Fill in the required values (see Environment Variables below)

# 3. Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

**Login:** Paste your OAuth2 refresh token on the login page. Obtain it from [app.net2phone.com](https://app.net2phone.com): DevTools → Application → Local Storage → `n2p_refresh_token`.

**Testing the welcome flow:** Navigate to `http://localhost:3000/welcome`. If not signed in you'll be redirected to `/login?returnUrl=/welcome`, then back to the landing. Click "Start Setup" to open the onboarding assistant.

> If you get `invalid_grant`, the token may be expired. Log back in at app.net2phone.com and copy a fresh `n2p_refresh_token`.

### Changing the UI language locally

The language picker (globe icon in the top bar) switches the locale at runtime and sets a `NEXT_LOCALE` cookie — no URL change occurs. To test a specific locale without the UI, set the cookie directly in DevTools → Application → Cookies → `NEXT_LOCALE` (values: `en`, `es`, `fr-CA`, `pt-BR`), then reload.

---

## Environment Variables

Create `.env.local` with the following:

```bash
# ── Required ─────────────────────────────────────────────────────────────────

# Anthropic API key — used by the Concierge agent and CDR analyzer
ANTHROPIC_API_KEY=sk-ant-...

# ── net2phone API base URLs (defaults point to production) ────────────────────

N2P_API_URL=https://app.net2phone.com/
N2P_API_V2_URL=https://app.net2phone.com/api/v2
N2P_API_AUTH_URL=https://auth.net2phone.com
N2P_API_N2P_URL=https://api.n2p.io/v2

# ── Optional ──────────────────────────────────────────────────────────────────

# AI Music-on-Hold (ElevenLabs) — Music Options & Call Queue hold music
# N2P_API_ELEVEN_LABS=your_elevenlabs_api_key
# BLOB_READ_WRITE_TOKEN=... (Vercel Blob — for call-queue hold music URLs)

# Linked product URLs shown in the top navigation
N2P_API_PROFILE_SETTINGS=https://profile.prod.n2p.io
N2P_HUDDLE_URL=https://huddle.net2phone.com
N2P_WALLBOARD_URL=https://wallboard.net2phone.com/
N2P_AI_AGENT_URL=https://agent.net2phone.com
N2P_COACH_URL=https://coachai.net2phone.com
```

> **Production (Vercel):** Set these in the Vercel dashboard under **Project → Settings → Environment Variables**. After changing `ANTHROPIC_API_KEY`, redeploy for the change to take effect.

---

## Deployment (Vercel)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

The project is a standard Next.js 14 App Router app and deploys to Vercel with zero configuration.

**Important note on onboarding state storage:** `app/api/onboarding-state/route.ts` currently writes to `os.tmpdir()`, which is ephemeral on Vercel's serverless platform. For production multi-user deployments, replace the file-based store with **Vercel KV** (Redis). The GET/PUT/DELETE handler interface is self-contained and is a simple swap.

---

## Security

The following security controls are in place:

### HTTP Headers (`next.config.mjs`)
- `Content-Security-Policy` — restricts scripts, styles, connects, and frame-ancestors
- `Strict-Transport-Security` — enforces HTTPS for 1 year including subdomains
- `X-Frame-Options: SAMEORIGIN` — prevents clickjacking
- `X-Content-Type-Options: nosniff` — blocks MIME sniffing
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy` — disables camera, microphone, geolocation, payment

### Authentication
- All AI-calling routes (`/api/concierge-agent`, `/api/analyze-cdr`, `/api/n2p-tools`, etc.) require a valid `Bearer` token
- JWT claims are decoded server-side via `lib/server/jwt.ts` — no client-visible secrets

### SSRF Protection
- `lib/server/ssrf-guard.ts` — blocks private IP ranges, loopback, AWS/GCP metadata endpoints, and non-HTTP schemes before any server-side fetch of a user-supplied URL
- Applied to `/api/research-website`

### Proxy Path Validation
- `lib/server/proxy-guard.ts` — rejects path traversal sequences (`../`) and unsafe characters in all 4 proxy routes

### Rate Limiting
- In-memory sliding-window rate limiter (`lib/server/rate-limit.ts`) applied per client IP:
  - `concierge-agent` — 30 requests / minute
  - `analyze-cdr` — 10 requests / minute
  - `research-website` — 20 requests / minute
- For multi-instance production deployments, replace the in-memory store with **Upstash Redis** (`@upstash/ratelimit`) — a drop-in swap

### Input Validation
- `lib/utils/validation.ts` — validates emails, phone numbers, MAC addresses, URLs, user objects, porting provider/address
- `concierge-agent` route enforces a 200-message cap and 2 MB body size limit
- `analyze-cdr` route enforces a 5 MB body size limit
- CDR content is truncated to 40,000 characters before being sent to the AI

### Concurrency
- `onboarding-state` writes use an optimistic locking scheme (`clientVersion` timestamp comparison) and atomic file rename to prevent partial writes and stale overwrites

---

## Known Limitations

| Area | Limitation |
|---|---|
| Onboarding state | Stored in `os.tmpdir()` — ephemeral on Vercel; swap to Vercel KV for production |
| Rate limiting | In-memory per-instance — does not share counts across Vercel function instances; swap to Upstash Redis |
| Analytics | Events are collected locally and logged to console; wire `setAnalyticsDestination()` to PostHog or Segment |
| CDR file size | Truncated to 40,000 characters (~800 rows) before AI analysis |
| Porting LOA | Sign URL is provided by the net2phone API; the signing flow is external |
| Onboarding legacy route | `/api/onboarding-agent` is a non-streaming legacy route; `/api/concierge-agent` is the active route |
| i18n — AI content | Claude's responses are language-instructed via system prompt; output quality depends on Claude's multilingual capability for edge-case phrasing |
| i18n — date/time | Dates and times are formatted in English regardless of locale; full `Intl.DateTimeFormat` integration is a future improvement |
| i18n — phone validation | Phone number regex is generic; `libphonenumber-js` per-locale validation is a future improvement |
