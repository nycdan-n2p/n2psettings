# net2phone Settings App

A Google Admin–style settings console for net2phone, built with Next.js 14.

## Features

- **Card-based home page** — Expandable sections for Team Members, Billing, Phone Numbers, etc.
- **Left sidebar navigation** — Grouped nav with icons (Overview, Communications, Organization, Call Routing, Resources, Integrations, Settings)
- **Data tables** — Team Members, Departments, Ring Groups, Call Queues, Phone Numbers, Devices, Schedules, and more
- **Settings pages** — Voicemail, Company Directory, Security, Kari's Law, Delegates, Webhooks, 10DLC, Number Porting, Bulk Operations
- **OAuth2 authentication** — Token refresh flow with net2phone auth

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

4. **Login**: Paste your OAuth2 refresh token on the login page. Obtain it via the net2phone OAuth2 flow (`client_id=unite.webapp`, `grant_type=refresh_token`).

## Environment

API URLs are loaded from `public/env.json`. Defaults point to production:

- `N2P_API_URL`: https://app.net2phone.com/
- `N2P_API_V2_URL`: https://api.n2p.io/v2
- `N2P_API_AUTH_URL`: https://auth.net2phone.com

## API Reference

See the n2p-settings-api-map for full endpoint documentation.

## Tech Stack

- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- TanStack Query & Table
- Lucide React (icons)
