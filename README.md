# net2phone Settings App

A Google Admin–style settings console for net2phone UCaaS, built with Next.js 14. Manages team members, call routing, phone numbers, devices, 10DLC/SMS registration, 911 contacts, and more.

## Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Data:** TanStack Query (React Query) & TanStack Table
- **Icons:** Lucide React
- **Charts:** Recharts
- **HTTP:** Axios (with OAuth2 token refresh)
- **AI:** Anthropic SDK (N2P Assistant), MCP (Model Context Protocol)

## Features

### Overview
- **Dashboard** — Account analytics, team/department counts, phone number summary, call stats
- **Analytics** — Call history–derived analytics, user/department breakdowns

### Communications
- **Calls** — Call history with CDR, playback, voicemail integration, AI call analysis
- **Voicemail** — Voicemail list, playback, detail modal
- **Call History** — Full CDR history with filters and export

### Organization
- **Company** — Company directory (feature-gated)
- **Team Members** — CRUD, departments, extensions, devices
- **Departments** — CRUD, call forwarding rules, features

### Call Routing
- **Virtual Assistant** — Welcome menus (auto-attendants), greetings, TTS, routing
- **Ring Groups** — CRUD, members, overflow, schedules
- **Call Queues** — CRUD, agents, reports (agent activity, queue activity)
- **Agent** — AI agent (placeholder)

### Resources
- **Phone Numbers** — List, search, assignment
- **Devices** — Devices, extensions, SIP registrations, templates, orders, reboot
- **Device Management** — Device provisioning
- **Schedules** — Time-based schedules
- **Special Extensions** — Custom extensions
- **Virtual Fax** — Fax numbers CRUD

### Integrations
- **SIP Trunking** — Trunk accounts, trunks, limits, service addresses, phone numbers
- **SIP Tie-Lines** — Tie-line configuration
- **Webhooks/API** — Webhook configuration, event types
- **API Setup** — Auth API setup

### Settings
- **Voicemail Settings** — Voicemail configuration
- **Music Options** — Hold music CRUD
- **Company Directory** — Directory settings (feature-gated)
- **911 Contacts** — Emergency notification numbers (Kari's Law)
- **Licenses** — License management
- **Trust Center** — 10DLC (Messaging Registration Center), SSO, 2FA, security
- **Kari's Law** — Emergency call notification (feature-gated)
- **Delegates** — Delegate management
- **Number Porting** — Port requests, status, wizard
- **Bulk Operations** — Bulk load status

### Help & Assistant
- **N2P Assistant** — AI assistant (profile dropdown)
- **Help and support** — Links (profile dropdown)

## APIs Used

The app uses three API bases, proxied via Next.js routes:

| Base | URL | Proxy | Used for |
|------|-----|-------|----------|
| **V1** | `app.net2phone.com/api` | `/api/proxy` | Most resources: accounts, users, departments, ring groups, call queues, devices, schedules, voicemail, webhooks, etc. |
| **V2** | `api.n2p.io/v2` | `/api/proxy-v2` | 10DLC campaign registry (brands, campaigns, verticals, opt-out) |
| **N2P** | `api.n2p.io/v2` | `/api/proxy-n2p` | SIP trunking, SIP registrations |
| **Auth** | `auth.net2phone.com/api` | `/api/proxy-auth` | Auth, 2FA, API setup |

### API → Page Mapping

| Page | API Module | Endpoints |
|------|------------|-----------|
| **Dashboard** | `analytics`, `call-history`, `team-members`, `departments`, `phone-numbers` | Account analytics, call stats, counts |
| **Analytics** | `analytics-from-history`, `call-history` | Call history, analytics |
| **Calls** | `call-history`, `voicemails` | CDR, recordings, voicemail |
| **Call History** | `call-history` | CDR list |
| **Voicemail** | `voicemails` | Voicemail list, playback |
| **Team Members** | `team-members`, `departments` | Users CRUD |
| **Departments** | `departments`, `phone-numbers`, `ring-groups` | Departments CRUD, call forwarding |
| **Virtual Assistant** | `virtual-assistant`, `onboarding` | Menus, greetings, TTS |
| **Ring Groups** | `ring-groups` | Ring groups CRUD |
| **Call Queues** | `call-queues`, `virtual-assistant` | Queues CRUD, reports |
| **Phone Numbers** | `phone-numbers` | Account numbers |
| **Devices** | `devices` | Devices, extensions, SIP reg, templates |
| **Schedules** | `schedules` | Schedules CRUD |
| **Special Extensions** | `special-extensions`, `onboarding` | Special extensions CRUD |
| **Virtual Fax** | `virtual-fax` | Fax numbers CRUD |
| **SIP Trunking** | `sip-trunking` | Trunks, limits, addresses (api.n2p.io) |
| **SIP Tie-Lines** | `tie-lines` | Tie lines |
| **Call Blocking** | `call-blocking` | Inbound/outbound block lists |
| **Webhooks** | `webhooks` | Webhooks, event types |
| **911 Contacts** | `karis-law` | `karisLawSettings` CRUD |
| **Kari's Law** | `karis-law` | Same as 911 |
| **Trust Center** | `10dlc` | Brands, campaigns, verticals, opt-out (api.n2p.io) |
| **SSO** | — | Embedded iframe `auth.net2phone.com/saml/settings/{clientId}` |
| **Delegates** | `delegates` | Delegates CRUD |
| **Number Porting** | `porting` | Onboards, sign links |
| **Bulk Operations** | `bulk-load` | Bulk load status |
| **Music Options** | `music-options` | Music options CRUD |
| **Voicemail Settings** | `api-client` | Direct API |
| **Company Directory** | `api-client` | Direct API |
| **API Setup** | `api-client` (auth) | Auth API |

### Key API Endpoints (by module)

- **karis-law:** `GET/POST/PATCH/DELETE /accounts/{id}/karisLawSettings`
- **10dlc:** `GET /campaign-registry-brands`, `-campaigns`, `-verticals`, `-campaigns/-/opt-out-entries`; `POST/PATCH/DELETE` for brands
- **sip-trunking:** `GET sip-trunk-accounts`, `sip-trunk-accounts/{id}/trunks`, `limits`, etc. (api.n2p.io)
- **call-queues:** `GET/POST/PATCH/DELETE /call-queues` (v2); reports via `POST` to api.n2p.io

## Setup

1. Install dependencies:

```bash
npm install
```

2. Run the dev server:

```bash
npm run dev
```

3. Open [http://localhost:3000](http://localhost:3000).

4. **Login:** Paste your OAuth2 refresh token on the login page. Obtain it from [app.net2phone.com](https://app.net2phone.com): DevTools → Application → Local Storage → `n2p_refresh_token`.

**If you get `invalid_grant`:** The token may be expired or revoked. Log in again at app.net2phone.com, then copy a fresh `n2p_refresh_token` from Local Storage. Avoid extra spaces or line breaks when pasting.

## Environment

API URLs are loaded from `public/env.json`. Defaults point to production:

| Variable | Default |
|----------|---------|
| `N2P_API_URL` | https://app.net2phone.com/ |
| `N2P_API_V2_URL` | https://api.n2p.io/v2 |
| `N2P_API_AUTH_URL` | https://auth.net2phone.com |
| `N2P_API_PROFILE_SETTINGS` | https://profile.prod.n2p.io |
| `N2P_HUDDLE_URL` | https://huddle.net2phone.com |
| `N2P_WALLBOARD_URL` | https://wallboard.net2phone.com/ |
| `N2P_AI_AGENT_URL` | https://agent.net2phone.com |
| `N2P_COACH_URL` | https://coachai.net2phone.com |

## MCP Server

The `n2p-mcp` package exposes net2phone APIs as MCP tools for AI agents (e.g. Claude Desktop). See [n2p-mcp/README.md](n2p-mcp/README.md) for setup and available tools (62+ tools for team members, departments, ring groups, call queues, 10DLC, 911, SIP trunking, etc.).

## API Reference

See the n2p-settings-api-map for full endpoint documentation.
