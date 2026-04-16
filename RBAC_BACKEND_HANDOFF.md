# RBAC — Backend Handoff & Security Review

**Document type:** Product Owner handoff + Security guidance  
**Frontend status:** Complete (UI, enforcement hooks, mock API)  
**Backend status:** Not started  
**Date:** April 2026

---

## 1. What Was Built on the Frontend

### New files

| File | Purpose |
|---|---|
| `lib/api/roles.ts` | TypeScript types + in-memory mock data. **This is the contract for the real API.** |
| `lib/hooks/useCurrentUserRole.ts` | Reads `bootstrap.user.role` and normalizes it to `SuperAdmin \| Admin \| Manager \| User` |
| `lib/hooks/usePagePermissions.ts` | Per-section view/edit permission matrix, client-side evaluated |
| `components/layout/RoleGuard.tsx` | Redirect wrapper — redirects users below `minRole` to dashboard |
| `app/(dashboard)/ucass/settings/roles/page.tsx` | Full RBAC management UI |

### What the UI does today

- **Roles & Permissions page** (`/ucass/settings/roles`): admins can view system roles, create/edit custom roles with a permission matrix and scope picker, assign users to roles.
- **Nav filtering**: nav items with `minRole: "Admin"` are hidden from Manager and User roles.
- **Page guards**: Bulk Operations, Trust Center, API Keys, Licenses, and Roles pages redirect non-Admins to `/ucass/dashboard`.
- **Team Members**: Role column shows colored badge. Add User modal has a nested product-category role picker.

### What is mocked (backed by in-memory arrays, not a real API)

Every function in `lib/api/roles.ts` — `fetchRoles`, `createRole`, `updateRole`, `deleteRole`, `fetchRoleAssignments`, `assignUserToRole`, `removeUserFromRole` — currently writes to module-level JavaScript arrays. **Data does not persist across page refreshes.** The shapes are final and ready to connect to real endpoints.

---

## 2. Database Schema Required

```sql
-- Roles catalog
CREATE TABLE roles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id  BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name        VARCHAR(120) NOT NULL,
  type        VARCHAR(16) NOT NULL CHECK (type IN ('system', 'custom')),
  base_role   VARCHAR(32) NOT NULL,           -- SuperAdmin | Admin | Manager | User
  description TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (account_id, name)
);

-- Permission matrix per role
CREATE TABLE role_permissions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id     UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  section     VARCHAR(64) NOT NULL,           -- matches PermissionSection enum
  can_view    BOOLEAN NOT NULL DEFAULT FALSE,
  can_edit    BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (role_id, section)
);

-- User ↔ Role assignments with optional scope
CREATE TABLE user_role_assignments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id  BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id     UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  scope_type  VARCHAR(32) NOT NULL DEFAULT 'all'
              CHECK (scope_type IN ('all', 'department', 'call_queue', 'ring_group', 'location')),
  scope_ids   JSONB NOT NULL DEFAULT '[]',    -- array of resource IDs
  assigned_by BIGINT REFERENCES users(id),
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, role_id)                   -- one assignment per role per user
);

-- Audit log (security requirement)
CREATE TABLE rbac_audit_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id  BIGINT NOT NULL,
  actor_id    BIGINT NOT NULL,                -- user who made the change
  action      VARCHAR(64) NOT NULL,           -- ROLE_CREATED | ROLE_UPDATED | ROLE_DELETED |
                                              -- USER_ASSIGNED | USER_REMOVED | PERMISSION_CHANGED
  target_type VARCHAR(32),                    -- role | user_assignment
  target_id   VARCHAR(128),
  old_value   JSONB,                          -- snapshot before change
  new_value   JSONB,                          -- snapshot after change
  ip_address  INET,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX ON rbac_audit_log (account_id, created_at DESC);
CREATE INDEX ON user_role_assignments (user_id);
CREATE INDEX ON user_role_assignments (account_id, scope_type);
```

### Seed data (system roles — insert once per account on account creation)

```sql
INSERT INTO roles (account_id, name, type, base_role, description) VALUES
  (:account_id, 'Super Admin', 'system', 'SuperAdmin', 'Full control over all settings and users.'),
  (:account_id, 'Admin',       'system', 'Admin',      'Manage users, locations, and platform settings.'),
  (:account_id, 'Manager',     'system', 'Manager',    'Manage teams within assigned departments. View-only.'),
  (:account_id, 'User',        'system', 'User',       'Basic access to personal features.');
-- Then insert role_permissions rows for each system role based on the matrix in
-- lib/hooks/usePagePermissions.ts (VIEW_MATRIX and EDIT_MATRIX).
```

---

## 3. API Endpoints Required

All endpoints are scoped to the authenticated account. The JWT must carry `accountId` and the caller's `userId`.

### Roles

```
GET    /api/v1/accounts/{accountId}/roles
       → Role[]

GET    /api/v1/accounts/{accountId}/roles/{roleId}
       → Role

POST   /api/v1/accounts/{accountId}/roles
       Body: { name, description, baseRole, scope, permissions }
       → Role
       Auth: Admin+

PUT    /api/v1/accounts/{accountId}/roles/{roleId}
       Body: Partial<{ name, description, scope, permissions }>
       → Role
       Auth: Admin+, cannot mutate system roles

DELETE /api/v1/accounts/{accountId}/roles/{roleId}
       Auth: Admin+, fails with 409 if any users are assigned
```

### Role Assignments

```
GET    /api/v1/accounts/{accountId}/roles/{roleId}/assignments
       → RoleAssignment[]

POST   /api/v1/accounts/{accountId}/roles/{roleId}/assignments
       Body: { userId, scope: { type, ids[] } }
       → RoleAssignment
       Auth: Admin+

DELETE /api/v1/accounts/{accountId}/roles/{roleId}/assignments/{userId}
       Auth: Admin+
```

### Bootstrap change (critical)

The existing `GET /api/v1/accounts/{accountId}/users/{userId}` (called at login) must be updated to include the user's role assignments:

```json
{
  "userId": 123,
  "firstName": "Daniel",
  "role": "Admin",
  "roleAssignments": [
    {
      "roleId": "uuid",
      "roleName": "Admin",
      "baseRole": "Admin",
      "permissions": { "dashboard": { "view": true, "edit": true }, "..." },
      "scope": { "type": "all", "ids": [] }
    }
  ]
}
```

When `roleAssignments` is present, `useCurrentUserRole` and `usePagePermissions` will automatically use the richer data. The frontend swap is a one-liner — the hooks are already designed for it.

---

## 4. Frontend Swap (One-Line Change)

When the backend ships, open `lib/hooks/useCurrentUserRole.ts` and change:

```ts
// Before (today):
return normalizeRole(bootstrap?.user?.role ?? "User");

// After (when roleAssignments lands in bootstrap):
return (bootstrap?.user?.roleAssignments?.[0]?.baseRole as SystemRole) ?? "User";
```

And in `lib/api/roles.ts`, replace each mock function with a real `getApiClient()` call matching the endpoints above. The TypeScript shapes are identical — no component changes needed.

---

## 5. Coming Soon (Deferred to Phase 2)

| Feature | Blocker |
|---|---|
| Location / Site scoping | Site entity does not exist in DB or API |
| Scoped data filtering (see only your queue's data) | API responses need to filter by `scope_ids` server-side |
| Multi-role per user (UI shows one) | Frontend ready; needs `roleAssignments[]` array from API |
| Audit log page | Needs `rbac_audit_log` table + `GET /audit-log` endpoint |
| Per-user scope override | Needs `user_role_assignments.scope_ids` wired end-to-end |

---

## 6. Security Review

### 6.1 What the current frontend enforcement IS and IS NOT

> **Critical:** Everything the frontend does today is **UX only, not security.**

| What frontend does | What it means for security |
|---|---|
| Hides nav items for low-privilege users | User can still navigate directly via URL |
| `RoleGuard` redirects non-Admins | A User can bypass by disabling JavaScript |
| `usePagePermissions` hides edit buttons | API calls are still accepted without backend enforcement |
| Role picker in Add User modal | `roleId` is sent to the API — the API must validate it |

**None of this is a defect** — client-side enforcement is standard UX practice. The defect would be if the backend does not enforce the same rules independently.

### 6.2 Required backend security controls

#### Authentication
- All RBAC endpoints must require a valid, non-expired JWT.
- JWTs must be short-lived (≤ 1 hour). Refresh tokens must be stored server-side and revocable.
- Logging out must invalidate the refresh token in the database, not just clear the client cookie.

#### Authorization (the most important section)
Every API endpoint must independently verify:

1. **Account isolation**: `accountId` in the URL must match `accountId` in the JWT claim. Never trust the URL alone.
2. **Role check**: The caller's role (from `user_role_assignments`) must meet the minimum required for the operation. A Manager calling `POST /roles` must receive `403 Forbidden`.
3. **Scope check**: When a Manager with `scope_type = call_queue, scope_ids = [42]` calls `GET /call-queues`, the response must only contain queue 42. The frontend filter is cosmetic; the backend filter is the actual security boundary.
4. **System role immutability**: `PUT /roles/{id}` must return `403` if `roles.type = 'system'`. Never rely on the UI to prevent this.
5. **Self-privilege escalation**: A user must never be able to assign themselves a higher role than their current role. Validate: `assigningUser.baseRole ≥ targetRole.baseRole`.

#### Broken Object Level Authorization (BOLA / IDOR)
This is the most common vulnerability in multi-tenant systems. Example attack:

```
Attacker is Admin of account 100.
They call: GET /api/v1/accounts/200/roles
If the backend only checks "is user an Admin?" without checking account ownership,
they can read — or modify — another tenant's roles.
```

**Every query must include `WHERE account_id = :accountId_from_jwt`** — not from the URL parameter.

#### Audit log requirements
Every write operation on RBAC data (role created/modified/deleted, user assigned/removed, permission changed) must write to `rbac_audit_log` synchronously, not as a background job. The log must include:
- Actor's user ID and IP address
- Before/after snapshots of the changed data
- Timestamp (server time, not client time)

This is both a compliance requirement and your forensic trail if a privilege escalation incident occurs.

#### JWT claims vs. database lookup
There are two patterns for runtime permission checks:

| Pattern | Pros | Cons |
|---|---|---|
| **Embed permissions in JWT** | Fast — no DB hit per request | Stale — if you change a role, old tokens still have old permissions until they expire |
| **Look up permissions from DB on every request** | Always fresh | Slower — adds a DB query per API call (mitigate with Redis cache, TTL ~5 min) |

**Recommendation:** Embed only `userId`, `accountId`, and `baseRole` in the JWT. Look up the full permission matrix from a Redis cache keyed by `userId`. Invalidate the cache entry whenever a role assignment changes. This gives you fast lookups and immediate revocation.

### 6.3 Privilege escalation scenarios to test

| Scenario | Expected result |
|---|---|
| Manager calls `POST /roles` | `403 Forbidden` |
| Admin tries to create a `SuperAdmin` role | `403 Forbidden` (only SuperAdmin can grant SuperAdmin) |
| Admin assigns a user to a role in a different account | `403 Forbidden` |
| User navigates directly to `/ucass/settings/roles` | Redirect to dashboard (frontend) + API returns `403` on any roles fetch |
| Manager scoped to Queue 42 calls `GET /call-queues` | Returns only Queue 42, not all queues |
| Deleted user's JWT is still valid (within TTL) | Session should be invalidated — check refresh token table |
| User changes their own `roleId` via direct API call | `403 Forbidden` — users cannot self-modify role assignments |

### 6.4 Rate limiting

The RBAC management endpoints are low-traffic by nature. Rate-limit them tightly:

```
POST /roles            → 10 req/min per account
PUT  /roles/:id        → 20 req/min per account
POST /roles/:id/assignments → 30 req/min per account
DELETE *               → 10 req/min per account
```

Bulk role assignment attacks (e.g., scripted privilege escalation) should be caught here.

### 6.5 Input validation

| Field | Validation |
|---|---|
| `role.name` | Max 120 chars, strip HTML, no control characters |
| `permissions` object | Validate every key against the known `PermissionSection` enum — reject unknown keys |
| `scope.ids` | Must be valid resource IDs belonging to the same account — validate each ID with a DB lookup |
| `userId` in assignment | Must belong to `account_id` from JWT — never trust client-provided accountId |

### 6.6 Least privilege defaults

New users created via `POST /accounts/{id}/users` must default to the `User` role (lowest privilege). Never default to Admin. The role assignment must be an explicit additional step.

System roles must be immutable server-side. If an attacker can modify the `Admin` system role to grant `can_edit: true` on `roles_permissions`, they gain full control. Guard: `WHERE type = 'system'` must cause a `403` on any PUT/PATCH.

---

## 7. Recommended Rollout Sequence

```
Phase 1 — Foundation (current sprint)
  [x] Frontend UI complete (this PR)
  [ ] DB schema: roles, role_permissions, user_role_assignments, rbac_audit_log
  [ ] Seed system roles on account creation
  [ ] CRUD endpoints for roles and assignments
  [ ] Bootstrap returns roleAssignments[]
  [ ] One-line frontend swap to use real data

Phase 2 — Enforcement
  [ ] All existing API endpoints check scope_ids server-side
  [ ] Redis permission cache with invalidation on role change
  [ ] Audit log page (frontend + endpoint)
  [ ] Location/Site entity + scope type

Phase 3 — Advanced
  [ ] Multi-role per user (frontend already supports it)
  [ ] Per-user scope override in assignment
  [ ] Role template marketplace (clone from preset)
  [ ] SSO role mapping (SAML/OIDC group → n2p role)
```

---

## 8. Questions for the Backend Team

1. **Does the current JWT contain `accountId` as a claim?** If not, this must be added before any RBAC enforcement is possible.
2. **Is there a Redis cluster available?** Needed for permission cache + rate limiting.
3. **What is the current user `role` field in the DB?** Is it a foreign key to a roles table, or a plain string? This determines migration complexity.
4. **Are refresh tokens stored server-side and revocable today?** If not, role changes won't take effect until token expiry.
5. **Who is the authoritative system for account-level feature flags** (`bootstrap.features`)? The `RolesAndPermissions` flag needs to be added there to enable the page for eligible tenants.
