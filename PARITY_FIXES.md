# Functional Parity Fixes

**Compared:** `settings.net2phone.com` (live) vs our codebase
**Focus:** Feature functionality only — not UI/UX

---

## Current State Summary

| Page | Status | Create | Edit | Delete |
|------|--------|--------|------|--------|
| Team Members | Stub (read-only) | ✗ | ✗ | ✗ |
| Departments | Partial (read-only) | ✗ | ✗ | ✗ |
| Ring Groups | Partial (read-only) | ✗ | ✗ | ✗ |
| Call Queues | Partial (read-only) | ✗ | ✗ | ✗ |
| Schedules | Stub (read-only) | ✗ | ✗ | ✗ |
| Phone Numbers | Stub (read-only) | ✗ | ✗ | ✗ |
| Devices | Stub (read-only) | ✗ | ✗ | ✗ |
| Special Extensions | Stub (read-only) | ✗ | ✗ | ✗ |
| Virtual Assistant | Stub (read-only) | ✗ | ✗ | ✗ |
| Virtual Fax | ✅ Real | ✅ | ✅ | ✅ |
| Call Blocking | ✅ Real | ✅ | ✗ | ✅ |
| Delegates | ✅ Real | ✅ | ✅ | ✅ |
| Voicemail Settings | ✅ Real (toggle settings only) | — | ✅ | — |
| Calls / Call History | Partial (view only) | ✗ | ✗ | ✗ |
| Analytics | Missing page | — | — | — |
| Company Profile | Missing page | — | — | — |
| Directory | Missing page | — | — | — |
| Music Options | Missing page | — | — | — |
| API Setup | Missing page | — | — | — |
| 911 Contacts | Missing page | — | — | — |
| SSO | Missing page | — | — | — |
| Licenses | Missing page | — | — | — |
| 2FA | Missing page | — | — | — |
| Messaging Registration (10DLC) | Stub (UI only, no API call) | ✗ | ✗ | ✗ |

---

## Fix List (Priority Order)

---

### 1. Team Members — Full CRUD (HIGH)

Currently read-only list. Live site supports create, edit, delete.

**API endpoints needed** (already mapped in HAR):
- `POST /accounts/{accountId}/users` — create user
- `PUT /accounts/{accountId}/users/{userId}` — edit user (name, email, extension, role)
- `DELETE /accounts/{accountId}/users/{userId}` — delete user
- `POST /accounts/{accountId}/users/bulk` — bulk CSV import

**What to build:**
- "Add Team Member" modal: first name, last name, email, extension, role, department, phone number assignment
- Edit modal: same fields, pre-populated
- Delete with confirm dialog
- "Export CSV" button that calls `GET /accounts/{accountId}/users?format=csv`
- Bulk upload: CSV file picker → parse → `POST /accounts/{accountId}/users/bulk`

**Relevant lib file:** `lib/api/team-members.ts`

Add:
```ts
createUser(accountId, payload)        // POST /accounts/{accountId}/users
updateUser(accountId, userId, payload) // PUT /accounts/{accountId}/users/{userId}
deleteUser(accountId, userId)         // DELETE /accounts/{accountId}/users/{userId}
bulkCreateUsers(accountId, rows)      // POST /accounts/{accountId}/users/bulk
```

---

### 2. Ring Groups — Full CRUD (HIGH)

Currently read-only list. Live site supports create, edit members, toggle signed-in status.

**API endpoints needed:**
- `POST /accounts/{accountId}/ringgroups` — create ring group
- `PUT /accounts/{accountId}/ringgroups/{ringGroupId}` — update name/settings
- `DELETE /accounts/{accountId}/ringgroups/{ringGroupId}` — delete ring group
- `GET /accounts/{accountId}/ringgroups/{ringGroupId}/members` — list members
- `PUT /accounts/{accountId}/ringgroups/{ringGroupId}/members` — set members (array of userIds)

**What to build:**
- "Add Ring Group" modal: name, extension
- Edit modal: name, member management (add/remove users from list)
- Delete with confirm dialog
- Member list with add/remove inline actions

**Relevant lib file:** `lib/api/ring-groups.ts` — already has `fetchRingGroups`, `addUserToRingGroup`. Add `createRingGroup`, `updateRingGroup`, `deleteRingGroup`, `setRingGroupMembers`.

---

### 3. Departments — Full CRUD (HIGH)

Currently read-only list.

**API endpoints needed:**
- `POST /accounts/{accountId}/departments` — create
- `PUT /accounts/{accountId}/departments/{deptId}` — update name/extension
- `DELETE /accounts/{accountId}/departments/{deptId}` — delete

**What to build:**
- "Add Department" modal: name, extension number
- Edit modal: same fields
- Delete with confirm dialog
- Member count display (already returned by `fetchDepartments`)

**Relevant lib file:** `lib/api/departments.ts` — already has `fetchDepartments`, `assignUserToDepartment`. Add `createDepartment`, `updateDepartment`, `deleteDepartment`.

---

### 4. Call Queues — Full CRUD (HIGH)

Currently read-only list. Live supports full queue management.

**API endpoints needed:**
- `POST /accounts/{accountId}/callqueues` — create
- `PUT /accounts/{accountId}/callqueues/{queueId}` — update settings
- `DELETE /accounts/{accountId}/callqueues/{queueId}` — delete
- `PUT /accounts/{accountId}/callqueues/{queueId}/agents` — set agent list

**What to build:**
- "Add Call Queue" modal: name, extension, max wait time, strategy (round-robin, etc.)
- Edit modal: same fields + agent management
- Delete with confirm dialog

**Relevant lib file:** `lib/api/call-queues.ts` — already has `fetchCallQueues`, `addUserToCallQueue`. Add `createCallQueue`, `updateCallQueue`, `deleteCallQueue`, `setQueueAgents`.

---

### 5. Schedules — Full CRUD (HIGH)

Currently read-only list. Live supports creating and editing time-based schedules.

**API endpoints needed:**
- `POST /accounts/{accountId}/schedules` — create schedule
- `PUT /accounts/{accountId}/schedules/{scheduleId}` — update
- `DELETE /accounts/{accountId}/schedules/{scheduleId}` — delete

**What to build:**
- "Add Schedule" modal: name, days of week checkboxes, start time, end time, time zone
- Edit modal: same fields pre-populated
- Delete with confirm dialog
- "Used By" display — which ring groups/queues reference this schedule

**Relevant lib file:** `lib/api/schedules.ts` — currently has `fetchSchedules` only. Add `createSchedule`, `updateSchedule`, `deleteSchedule`.

---

### 6. Devices — Full CRUD (MEDIUM)

Currently read-only list. Live site supports adding desk phones and removing devices.

**API endpoints needed:**
- `POST /accounts/{accountId}/devices` — provision device (MAC address + model)
- `PUT /accounts/{accountId}/devices/{deviceId}` — update label/user assignment
- `DELETE /accounts/{accountId}/devices/{deviceId}` — delete/unprovision

**What to build:**
- "Add Desk Phone" modal: MAC address, model selector, display name, assigned user
- Edit modal: display name, assigned user
- Delete with confirm dialog

**Relevant lib file:** `lib/api/devices.ts` — currently has `fetchDevices` only. Add `createDevice`, `updateDevice`, `deleteDevice`.

---

### 7. Special Extensions — Full CRUD (MEDIUM)

Currently read-only list. Live site shows Fax, Paging, Ringer types with add/delete.

**API endpoints needed:**
- `POST /accounts/{accountId}/specialextensions` — create (type, name, extension)
- `PUT /accounts/{accountId}/specialextensions/{extId}` — update
- `DELETE /accounts/{accountId}/specialextensions/{extId}` — delete

**What to build:**
- "Add Special Extension" modal: type (Fax/Paging/Ringer), name, extension number, assign phone number
- Edit modal: same fields
- Delete with confirm dialog

**Relevant lib file:** `lib/api/special-extensions.ts` — currently has `fetchSpecialExtensions` only. Add `createSpecialExtension`, `updateSpecialExtension`, `deleteSpecialExtension`.

---

### 8. Call History — Mine/Company Toggle + CSV Export (MEDIUM)

Currently shows calls but missing two key functional features.

**What to build:**
- **Mine/Company toggle**: pass `userId` param for "Mine" vs omit for "Company" (all accounts)
  - `fetchCallHistory(accountId, userId, ...)` already accepts userId — just expose the toggle in the UI
- **Generate CSV**: call `GET /v2/accounts/{accountId}/cdrs?format=csv&startDate=...&endDate=...` and trigger browser download
- **Date range picker**: currently hardcoded to last 7 days — expose as a date range selector

**File:** `app/(dashboard)/ucass/calls/page.tsx` and `lib/api/call-history.ts`

Add to `lib/api/call-history.ts`:
```ts
exportCallHistoryCsv(accountId, userId?, startDate, endDate): Promise<Blob>
```

---

### 9. Virtual Assistant (Welcome Menus/IVR) — Full CRUD (MEDIUM)

Currently read-only list. Live site supports creating IVR menus with digit-key mappings.

**API endpoints needed:**
- `POST /accounts/{accountId}/virtualreceptionists` — create menu
- `PUT /accounts/{accountId}/virtualreceptionists/{id}` — update name/options
- `DELETE /accounts/{accountId}/virtualreceptionists/{id}` — delete
- Key mappings: `PUT /accounts/{accountId}/virtualreceptionists/{id}/options` — set digit→action mapping (e.g., press 1 → ring group X)

**What to build:**
- "Add Welcome Menu" modal: name, greeting audio (upload or TTS), timeout behavior
- Edit modal with digit-key option builder (key 0–9 → route to user/ring group/queue/extension)
- Delete with confirm dialog

**File:** `lib/api/virtual-assistant.ts` — currently has `fetchVirtualAssistants` only.

---

### 10. Analytics Page — Create Page (MEDIUM)

Live site has a top-level Analytics page with call stats and per-user breakdowns.

**What to build:**
- `app/(dashboard)/ucass/analytics/page.tsx` — new page
- Reuse existing `lib/api/analytics.ts` functions: `fetchAccountAnalytics`, `fetchUserAnalytics`, `fetchUserAnalyticsSummary`, `fetchDepartmentAnalytics`
- Date range selector (preset: Today, 7 days, 30 days, custom)
- Account-level totals: total calls, answered, missed, average duration
- Per-user breakdown table: user name, calls made, calls received, missed, avg duration

---

### 11. 911 Contacts — Create Page (MEDIUM)

Live site has a Settings → 911 Contacts page for managing emergency notification contacts.

**API endpoints needed:**
- `GET /accounts/{accountId}/e911contacts`
- `POST /accounts/{accountId}/e911contacts`
- `PUT /accounts/{accountId}/e911contacts/{contactId}`
- `DELETE /accounts/{accountId}/e911contacts/{contactId}`

**What to build:**
- New page: `app/(dashboard)/ucass/settings/911-contacts/page.tsx`
- Table of contacts with name, phone, email
- Add/edit/delete contact modal
- Add `lib/api/e911-contacts.ts` with full CRUD

---

### 12. Music Options — Create Page (MEDIUM)

Live site allows uploading and managing music-on-hold audio files.

**API endpoints needed:**
- `GET /accounts/{accountId}/musicoptions`
- `POST /accounts/{accountId}/musicoptions` (multipart upload)
- `DELETE /accounts/{accountId}/musicoptions/{id}`

**What to build:**
- New page: `app/(dashboard)/ucass/settings/music-options/page.tsx`
- List of uploaded audio files
- Upload button (file input → multipart POST)
- Delete per file
- Add `lib/api/music-options.ts`

---

### 13. Licenses — Create Page (MEDIUM)

Live site has a Settings → Licenses page showing active licenses with seat counts.

**Data source:** Already available in bootstrap (`bootstrap.licenses`).

**What to build:**
- New page: `app/(dashboard)/ucass/settings/licenses/page.tsx`
- Table: License name, quantity, unlimited flag, status
- Read-only for now (license purchasing handled externally)

---

### 14. API Setup — Create Page (LOW)

Live site has Settings → API Setup with API key and webhook configuration.

**API endpoints needed:**
- `GET /accounts/{accountId}/apikeys` — list keys
- `POST /accounts/{accountId}/apikeys` — generate new key
- `DELETE /accounts/{accountId}/apikeys/{keyId}` — revoke key

**What to build:**
- New page: `app/(dashboard)/ucass/settings/api-setup/page.tsx`
- Show current API key(s) with masked display + "Reveal" toggle
- "Generate New Key" button with confirmation
- Copy-to-clipboard
- Add `lib/api/api-keys.ts`

---

### 15. SSO / 2FA — Wire to Real Endpoints (LOW)

Currently `settings/security/page.tsx` just has external links. Live site has actual SSO config and 2FA enforcement settings in-page.

**What to build:**
- SSO: `app/(dashboard)/ucass/settings/sso/page.tsx` — SAML config form (entity ID, SSO URL, certificate)
- 2FA: `app/(dashboard)/ucass/settings/2fa/page.tsx` — enable/disable 2FA requirement for account, list enrolled users

---

### 16. 10DLC / Messaging Registration — Wire API Calls (LOW)

Currently `settings/10dlc/page.tsx` shows Add Brand button but `onSubmit` does `preventDefault` only — form never calls the API.

**Fix in `app/(dashboard)/ucass/settings/10dlc/page.tsx`:**
- Wire the Add Brand form to `POST /accounts/{accountId}/messaging/brands`
- Wire the Add Campaign form to `POST /accounts/{accountId}/messaging/campaigns`
- Add `lib/api/messaging.ts` with `createBrand`, `fetchBrands`, `createCampaign`, `fetchCampaigns`, `deleteCampaign`

---

### 17. Company Profile — Create Page (LOW)

Live site has a Company Profile page for editing company name, address, timezone.

**API endpoint:** `PUT /accounts/{accountId}` — already used in bootstrap

**What to build:**
- New page: `app/(dashboard)/ucass/company/page.tsx` (currently just a placeholder)
- Form: company name, address, timezone, main number, caller ID name
- Save button that calls `PUT /accounts/{accountId}`

---

### 18. Directory — Create Page (LOW)

Live site has a Company Directory page listing users with their public directory status.

**Already gated by feature flag** `CompanyDirectory` (wired in nav.ts).

**API endpoint:** `GET /accounts/{accountId}/users?directory=true`

**What to build:**
- New page: `app/(dashboard)/ucass/settings/company-directory/page.tsx` (file exists but check if it's a stub)
- Table: user, extension, included/excluded toggle
- Toggle calls `PUT /accounts/{accountId}/users/{userId}` with `{directoryEnabled: bool}`

---

## Quick Wins (can be done in one sitting)

These are small fixes that unblock real functionality with minimal work:

1. **Call History CSV export** — one new API function + one button
2. **Call History Mine/Company toggle** — just pass/omit userId, already supported
3. **Licenses page** — data already in bootstrap, just render it
4. **Company Profile page** — PUT endpoint already exists, just build the form
5. **10DLC form wiring** — just remove `preventDefault` and call the API
6. **Schedules create/delete** — API is simple, modal already exists as pattern from Delegates/VirtualFax

---

## API Functions Still Needed (lib/api/ additions)

| File | Functions to Add |
|------|-----------------|
| `team-members.ts` | `createUser`, `updateUser`, `deleteUser`, `bulkCreateUsers`, `exportUsersCsv` |
| `ring-groups.ts` | `createRingGroup`, `updateRingGroup`, `deleteRingGroup`, `setRingGroupMembers` |
| `departments.ts` | `createDepartment`, `updateDepartment`, `deleteDepartment` |
| `call-queues.ts` | `createCallQueue`, `updateCallQueue`, `deleteCallQueue`, `setQueueAgents` |
| `schedules.ts` | `createSchedule`, `updateSchedule`, `deleteSchedule` |
| `devices.ts` | `createDevice`, `updateDevice`, `deleteDevice` |
| `special-extensions.ts` | `createSpecialExtension`, `updateSpecialExtension`, `deleteSpecialExtension` |
| `virtual-assistant.ts` | `createVirtualAssistant`, `updateVirtualAssistant`, `deleteVirtualAssistant`, `setMenuOptions` |
| `call-history.ts` | `exportCallHistoryCsv` |
| `e911-contacts.ts` | New file — full CRUD |
| `music-options.ts` | New file — full CRUD + file upload |
| `api-keys.ts` | New file — list, generate, revoke |
| `messaging.ts` | `createBrand`, `createCampaign`, `deleteCampaign` (wire existing fetch fns) |
