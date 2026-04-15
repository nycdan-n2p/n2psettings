# Parity Gap Analysis — settings.net2phone.com vs Our App
**Audit Date:** March 11, 2026
**Method:** Full manual walkthrough of settings.net2phone.com — every nav section and sub-page captured.

---

## Overall Status: ~70% Parity

Most major sections exist in our app. The gaps fall into three buckets:
1. **Sub-pages / sub-tabs missing** inside pages that exist (highest priority — quickest wins)
2. **Full pages missing** that need to be built from scratch (medium effort)
3. **Stub pages** that exist but render minimal content (need fleshing out)

---

## GAPS BY SECTION

### 1. Phone Numbers
| Feature | Original | Ours | Status |
|---------|----------|------|--------|
| All Phone Numbers list | ✅ NUMBER, APPLICATION, ASSIGNED TO, search, ADD PHONE NUMBER | ✅ Exists (basic) | 🟡 Needs redesign to match columns |
| **Ports tab** | ✅ PROVIDER, REQUEST ID, NUMBERS, SUBMITTED ON, PORTED ON, STATUS + REQUEST A NEW PORT button | ❌ Not built | 🔴 Missing |

**Build plan:**
- Add a **Ports** tab to the phone-numbers page
- Table columns: PROVIDER, REQUEST ID, NUMBERS (linked), SUBMITTED ON, PORTED ON, STATUS
- "REQUEST A NEW PORT" button opens a modal/form
- API: `GET /accounts/{id}/ports` (need to discover via HAR)

---

### 2. SIP Trunking
| Sub-page | Original | Ours | Status |
|----------|----------|------|--------|
| Trunks list | ✅ NAME, REGISTRATION STATUS, CHANNELS, TRUNK CALLER ID, AUTHENTICATION | ✅ Partial | 🟡 |
| **Call History** | ✅ All Calls + Exports tabs; START TIME, TRUNK NAME, IP ADDRESS, END TIME, FROM, TO, OUTBOUND CALLER ID; Generate CSV | ❌ Missing | 🔴 |
| **Service Address** | ✅ LOCATION NAME, ADDRESS 1, ADDRESS 2, CITY/STATE/ZIP + ADD ADDRESS | ❌ Missing | 🔴 |
| **SIP Details** | ✅ Address/Port/Protocol table, Supported Codecs, STIR/SHAKEN, IP Whitelist | ❌ Missing | 🔴 |
| **Documentation** | ✅ Static links to FreePBX, ChanSIP, TLS, Yeastar, Grandstream, Allworx, 3CX guides | ❌ Missing | 🔴 |
| **Notifications** | ✅ Capacity Limit + Burst Notification sections; CONTACTS, TEAM MEMBERS, FREQUENCY, FORMAT, ACTION toggles | ❌ Missing | 🔴 |

**Build plan:**
- Add sub-nav to SIP Trunking: Trunks | Call History | Service Address | SIP Details | Documentation | Notifications
- SIP Trunking already fetches `fetchSIPServiceAddresses` — surface that data in the Service Address sub-page
- SIP Details: static display of server addresses/ports from API
- Call History: needs new API (probably `/accounts/{id}/sip-trunks/call-history` — discover via HAR)
- Notifications: needs API for trunk notification rules

---

### 3. Company — Missing Sub-pages
| Sub-page | Original URL | Ours | Status |
|----------|-------------|------|--------|
| Team Members | `/company/teammembers` | ✅ `/ucass/team-members` | ✅ |
| Departments | `/company/departments` | ✅ `/ucass/departments` | ✅ |
| Ring Groups | `/company/ringgroups` | ✅ `/ucass/ring-groups` | 🟡 Missing Team Members Status tab |
| Welcome Menus | `/company/welcomemenus` | ✅ `/ucass/virtual-assistant` | 🟡 Check feature parity |
| Special Extensions | `/company/specialextensions` | ✅ `/ucass/special-extensions` | 🟡 Check |
| Phone Numbers | `/company/phone-numbers` | ✅ `/ucass/phone-numbers` | ✅ (shared) |
| Ports | `/company/ports` | ❌ | 🔴 (same as Phone Numbers > Ports) |
| Virtual Fax | `/company/virtual-fax` | ✅ `/ucass/virtual-fax` | ✅ |
| Directory | `/company/directory` | ✅ `/ucass/settings/company-directory` | 🟡 (in Settings, not Company nav) |
| Blocked Callers | `/company/call-blocking` | 🟡 `/ucass/call-blocking` | 🟡 Our page has inbound/outbound tabs — need to verify it covers individual number blocking |
| Call Blocking Rules | `/company/call-blocking-rules` | ❌ Not separate | 🔴 **Missing rule-based blocking** |
| Devices | `/company/devices` | ✅ `/ucass/devices` | ✅ |
| Device Management | `/company/device-management` | ✅ `/ucass/devices/management` | ✅ |
| Delegation | `/company/delegation` | ✅ `/ucass/settings/delegates` | 🟡 (in Settings, not Company) |
| **Company Profile** | `/company/companyprofile` — Name, Country, Address, Timezone, Apply TZ, SAVE | ❌ Not built | 🔴 Missing |

**Build plan:**
- **Ring Groups:** Add "Team Members Status" tab showing each member's sign-in/out status across ring groups
- **Call Blocking Rules:** Build `/ucass/call-blocking-rules` (or tab within call-blocking) — RULE NAME, TYPE (Inbound/Outbound), BLOCKED NUMBERS, DAYS, TIME, ASSIGNEES + ADD BLOCKING RULE
- **Company Profile:** Build `/ucass/settings/company-profile` — Company Name, Country, Office Address fields, Timezone dropdown, "Apply Time Zone on all Team Members" checkbox, SAVE button

---

### 4. Call Queues — Missing Sub-pages
| Sub-page | Original | Ours | Status |
|----------|----------|------|--------|
| Queues list | ✅ EXT, NAME, RINGING RULES, ASSIGNED, MAX CALLS IN, MAX WAIT TIME | ✅ | 🟡 Check column parity |
| **Agent Activity Report** | ✅ `beta` — filters: Call Queue, Agent, Interval + Time Period chips + GENERATE REPORT | ❌ Not built | 🔴 Missing |
| **Queue Activity Report** | ✅ `beta` — filters: Call Queue, Interval + Time Period chips + GENERATE REPORT | ❌ Not built | 🔴 Missing |

**Build plan:**
- Add `/ucass/call-queues/agent-activity-report` — Select Queue dropdown, Agent dropdown (All Agents), Interval dropdown, Time Period chips (Today/Yesterday/Last 7 days/Week to date/Last week/Month to date/Last month/Custom Date Range), GENERATE REPORT button
- Add `/ucass/call-queues/queue-activity-report` — Select Queue dropdown, Interval dropdown, same Time Period chips, GENERATE REPORT button
- Add sub-nav to Call Queues section linking all 3 pages
- Add to nav.ts under "Call Routing" section

---

### 5. Settings — Stub Pages Needing Content
| Page | Lines | Original | Status |
|------|-------|----------|--------|
| Licenses | 46 lines | License cards grid: Huddle, Salesforce Integration, Virtual Fax, Call Queue Agent, Call Queue Supervisor, Additional Devices, Ultimate, WhatsApp, Coach Seat — each with No. of Licenses, In Use, Left, Add/Remove Member link | 🔴 Stub — needs full cards UI |
| 10DLC | 140 lines | 3 tabs: **Brands** (BRAND ID, BRAND, LEGAL NAME, TYPE, VERTICAL, STATUS, REGISTERED ON), **Campaigns**, **Opt Out List** | 🟡 Likely only has Brands tab |
| SSO | 99 lines | Single sign-on config | 🟡 Check |
| **Terms & Policies** | ❌ Not in our nav | Static links/text | 🔴 Missing page entirely |

**Build plan:**
- **Licenses:** Replace stub with license card grid. API: `GET /accounts/{id}/licenses` (need HAR). Each card: icon, name, description, No. of Licenses, Licenses In Use, Licenses Left, "Add / Remove Team Member" link for applicable types
- **10DLC:** Confirm/add Campaigns tab (CAMPAIGN ID, USE CASE, STATUS, BRAND, REGISTERED ON) and Opt Out List tab (phone numbers opted out of SMS)
- **Terms & Policies:** Add static page with links to net2phone ToS and Privacy Policy (low priority)

---

### 6. Missing from Our Nav Entirely
| Feature | Original Location | Build Priority |
|---------|------------------|---------------|
| Company Profile | Settings > Company Profile | High |
| SIP Trunking sub-pages | SIP Trunking section | High |
| Call Queue Reports | Call Queues > Reports | High |
| Phone Number Porting | Phone Numbers > Ports | Medium |
| Call Blocking Rules | Company > Call Blocking | Medium |
| Ring Groups Team Member Status | Ring Groups > Team Members Status tab | Medium |
| Terms & Policies | Settings > Terms & Policies | Low |

---

## WHAT WE HAVE THAT ORIGINAL DOESN'T
(These are our enhancements/additions — keep as-is)

| Our Feature | Notes |
|-------------|-------|
| N2P Assistant / Onboarding | AI-powered onboarding wizard |
| Calendar | Schedule/event management |
| AI Agent | Chatbot/virtual agent configuration |
| Security settings | Password policy, session management |
| Kari's Law / 911 page | More detailed than original's 911 Contacts |
| Webhooks (separate from API Setup) | Original combines into one page |

---

## PRIORITIZED BUILD PLAN

### Sprint 1 — Quick Wins (each ~2-4 hours)
1. **Phone Numbers > Ports tab** — Add tab to existing phone-numbers page. Discover API via HAR capture.
2. **Call Queue Agent Activity Report** — Form-based report page, no data API needed initially (just UI with GENERATE REPORT).
3. **Call Queue Queue Activity Report** — Same pattern.
4. **Company Profile** — Simple form page with name, address, timezone fields.

### Sprint 2 — Medium Effort (each ~4-8 hours)
5. **Ring Groups > Team Members Status tab** — Add second tab showing member sign-in status per ring group.
6. **Call Blocking Rules page** — Rule-based blocking (separate from individual number blocking).
7. **Licenses page** — Replace stub with proper card grid UI, wire up real API data.
8. **10DLC Campaigns + Opt Out List tabs** — Add two more tabs to the existing 10DLC page.

### Sprint 3 — Larger Effort (each ~1-2 days)
9. **SIP Trunking sub-navigation** — Refactor the single SIP Trunking page into 6 sub-pages with sub-nav. Most data fetching already exists (trunks, service addresses) — just need to surface it properly. Need HAR for Call History and Notifications APIs.
10. **SIP Trunking > Call History** — Separate page with All Calls/Exports tabs, date filtering, Generate CSV.
11. **SIP Trunking > Notifications** — Capacity Limit + Burst notification management with team member selectors.

### Sprint 4 — Polish
12. **Phone Numbers column parity** — Add APPLICATION and ASSIGNED TO columns to phone numbers table.
13. **Terms & Policies** — Static page with links (very low effort, very low value).

---

## COLUMN/FEATURE PARITY NOTES (Existing Pages Needing Polish)

| Our Page | Missing Columns/Features vs Original |
|----------|--------------------------------------|
| Phone Numbers | Missing: APPLICATION column, ASSIGNED TO with avatar; ADD PHONE NUMBER button styling |
| Ring Groups | Missing: TIME BLOCKS column shows schedule name linked; Team Members Status tab |
| Call Queues list | Check: RINGING RULES, MAX CALLS ALLOWED IN, MAX WAITING TIME PER columns |
| Devices | ✅ Already redesigned with SIP status, orders tab |
| Schedules | ✅ Already redesigned with Used By popover |
| Call History | ✅ Already redesigned |
| Voicemail | ✅ Already redesigned |

---

## API Discovery Needed (capture HAR for these)
- Phone Number Porting requests: `GET /accounts/{id}/ports` or similar
- SIP Trunk Call History: `GET /accounts/{id}/sip-trunks/call-history`
- SIP Trunk Notifications: `GET /accounts/{id}/sip-trunks/notifications`
- Call Queue Activity Reports: `GET /accounts/{id}/call-queues/reports/*`
- Agent Activity Reports: `GET /accounts/{id}/call-queues/agent-reports/*`
- License management: `GET /accounts/{id}/licenses`
