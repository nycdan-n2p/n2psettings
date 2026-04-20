# Roles & Permissions — Product Requirements

**Document type:** Product Requirements Document (PRD)  
**Status:** Ready for review  
**Version:** 1.0  
**Date:** April 2026  
**Author:** Product / Frontend  

---

## 1. Overview

This document defines requirements for the Role-Based Access Control (RBAC) system in the n2p Settings portal. The system controls what each user can see and do within the platform, ranging from a basic end-user with personal feature access only, up to a Super Admin with full configuration rights.

The frontend implementation is complete. This document captures the agreed behavior so it can be reviewed, approved, and used as the acceptance baseline for backend implementation.

---

## 2. Goals

- Give account administrators full control over what each user can access in the platform.
- Prevent lower-privileged users from viewing or modifying settings they are not authorized for.
- Support custom roles so organizations can define access profiles that don't map exactly to a system role.
- Scope a user's access to a subset of the account (e.g., a single department or call queue) without creating a new role.
- Produce a complete audit trail of every permission change.

## 3. Non-Goals (Phase 1)

The following are **explicitly out of scope** for Phase 1:

- Server-side data filtering by scope (e.g., a Manager seeing only their queue's call records in API responses).
- Multi-role per user (the data model supports it; the UI shows one role per user today).
- An audit log viewer page.
- SSO role mapping (SAML/OIDC group → n2p role).

These are tracked as Phase 2 and Phase 3 work in the rollout plan.

---

## 4. System Roles

There are four built-in (system) roles. They are created automatically when a new account is provisioned and **cannot be modified or deleted**.

| Role | Description | Who it's for |
|---|---|---|
| **Super Admin** | Full control over all system configuration, settings, and users. | Typically one IT owner per account. |
| **Admin** | Manage users, locations, and most platform settings. Cannot manage SIP trunking or number porting. | IT admins, office managers. |
| **Manager** | View most settings within their assigned departments. Cannot edit anything. | Team leads, supervisors. |
| **User** | Personal features only: voicemail, call history, company directory, and their own devices. | All standard employees. |

### Role hierarchy

```
SuperAdmin  >  Admin  >  Manager  >  User
```

A user may never assign another user a role higher than their own.

---

## 5. Permission Matrix

The matrix below defines the default view and edit access for each system role across every section of the platform.

**Legend:** `View` = can open the page / section. `Edit` = can make changes (create, update, delete). `—` = no access.

### 5.1 Personal & Communication

| Section | SuperAdmin | Admin | Manager | User |
|---|---|---|---|---|
| Dashboard | View + Edit | View + Edit | View | View |
| Call History | View + Edit | View + Edit | View | View |
| Virtual Fax | View + Edit | View + Edit | View | View |
| Company Directory | View + Edit | View + Edit | View | View |
| Voicemail Settings | View + Edit | View + Edit | View | **View + Edit** ¹ |
| Devices | View + Edit | View + Edit | View | View |

> ¹ Users can edit their own voicemail settings only. The backend must enforce that a User can only `PUT /voicemail-settings/{userId}` where `userId` matches their own JWT claim.

### 5.2 Analytics & Reporting

| Section | SuperAdmin | Admin | Manager | User |
|---|---|---|---|---|
| Analytics | View + Edit | View + Edit | View | — |

### 5.3 Team Management

| Section | SuperAdmin | Admin | Manager | User |
|---|---|---|---|---|
| Team Members | View + Edit | View + Edit | View ² | — |
| Departments | View + Edit | View + Edit | View ² | — |
| Company (org settings) | View + Edit | View + Edit | — | — |
| Delegates | View + Edit | View + Edit | — | — |

> ² Managers see only the departments (and members of those departments) that are explicitly assigned to them. See §7 Scoping.

### 5.4 Routing & Telephony

| Section | SuperAdmin | Admin | Manager | User |
|---|---|---|---|---|
| Virtual Assistant | View + Edit | View + Edit | View | — |
| Ring Groups | View + Edit | View + Edit | View | — |
| Call Queues | View + Edit | View + Edit | View | — |
| Schedules | View + Edit | View + Edit | View | — |
| Phone Numbers | View + Edit | View + Edit | View | — |
| Special Extensions | View + Edit | View + Edit | — | — |
| Music Options | View + Edit | View + Edit | View | — |

### 5.5 Device & Network

| Section | SuperAdmin | Admin | Manager | User |
|---|---|---|---|---|
| Device Management | View + Edit | View + Edit | — | — |
| Call Blocking | View + Edit | View + Edit | — | — |
| SIP Trunking | View + Edit | View only ³ | — | — |
| SIP Tie Lines | View + Edit | View + Edit | — | — |
| Emergency Settings | View + Edit | View + Edit | — | — |

> ³ Admins can view SIP trunk configuration but cannot create, modify, or delete trunks. Only Super Admins can edit trunks.

### 5.6 Developer & Integration

| Section | SuperAdmin | Admin | Manager | User |
|---|---|---|---|---|
| Webhooks | View + Edit | View + Edit | — | — |
| API Keys | View + Edit | View + Edit | — | — |

### 5.7 Billing & Compliance

| Section | SuperAdmin | Admin | Manager | User |
|---|---|---|---|---|
| Trust Center | View + Edit | View + Edit | — | — |
| Licenses | View + Edit | View + Edit | — | — |
| Number Porting | View + Edit | View only ⁴ | — | — |

> ⁴ Admins can view porting requests but cannot submit or cancel them. Only Super Admins can initiate number ports.

### 5.8 Administration

| Section | SuperAdmin | Admin | Manager | User |
|---|---|---|---|---|
| Bulk Operations | View + Edit | View + Edit | — | — |
| Roles & Permissions | View + Edit | View + Edit | — | — |

---

## 6. Custom Roles

Admins and Super Admins can create custom roles to meet organizational needs that don't map exactly to a system role.

### 6.1 Custom role attributes

| Attribute | Description |
|---|---|
| **Name** | Required. Max 120 characters. Must be unique within the account. |
| **Description** | Optional free text. |
| **Base role** | Required. One of `SuperAdmin`, `Admin`, `Manager`, `User`. Determines the starting permission set and the role's position in the hierarchy. |
| **Permission overrides** | The admin can toggle view and edit access on/off for each section, within the limits of the base role (see §6.2). |
| **Scope** | Optional. Restrict this role to a subset of the account (see §7). |

### 6.2 Custom role permission constraints

Custom roles cannot exceed the permissions of the role that created them:

- An Admin creating a custom role cannot grant that role Super Admin-only permissions (e.g., SIP trunking edit, number porting edit).
- A Super Admin can create a custom role with any permission up to and including their own.
- These checks must be enforced on the backend; the frontend enforces them in the UI as a UX aid, not a security control.

### 6.3 Custom role lifecycle

- Custom roles can be **edited** at any time by an Admin+.
- Custom roles can be **deleted** only if no users are currently assigned to that role. A role with active assignments returns an error (`409 Conflict`) on delete.
- **System roles cannot be edited or deleted** under any circumstances. This is enforced server-side regardless of what the client sends.

---

## 7. Scoping

Scoping restricts a role assignment so that a user with that role can only act on a defined subset of the account's resources.

### 7.1 Supported scope types

| Scope type | Description |
|---|---|
| `all` | No restriction — user sees the full account. Default for all system roles. |
| `department` | User can only see and manage the listed department IDs. |
| `call_queue` | User can only see and manage the listed call queue IDs. *(Phase 2)* |
| `ring_group` | User can only see and manage the listed ring group IDs. *(Phase 2)* |

### 7.2 Phase 1 behavior

In Phase 1, `department` scoping is active for the Manager role:

- A Manager is assigned one or more departments at the time of user assignment.
- On the **Team Members** page, the Manager sees only the members of their assigned departments.
- On the **Departments** page, the Manager sees only their assigned departments.
- All other sections that the Manager can view (call queues, ring groups, etc.) show the full account data in Phase 1. Filtering those by scope is a Phase 2 requirement.

`call_queue` and `ring_group` scope types are stored in the data model but not enforced in API responses until Phase 2.

---

## 8. Role Management UI

The Roles & Permissions page is located at `/settings/roles` and is accessible to Admin and Super Admin users only. Non-admins navigating to this URL are redirected to the dashboard.

### 8.1 Roles list view

- Displays all system roles and custom roles for the account.
- For each role: name, type badge (System / Custom), base role, member count, description.
- System roles show a lock icon and cannot be edited or deleted via the UI.
- Actions available for custom roles: Edit, Delete.
- "New Role" button opens the create role flow (Admin+ only).

### 8.2 Role detail / edit

- Full permission matrix shown as a section-by-section toggle grid.
- Scope picker: dropdown for scope type + a multi-select of resource IDs.
- Validation: name required, base role required.
- Save updates the role in place; all users assigned to this role will reflect the new permissions on their next request.

### 8.3 Assigning users to roles

- The role detail page shows a "Members" tab listing all users assigned to this role.
- Admin+ can add a user from the account's user list.
- When assigning, the admin can optionally set a scope override for that specific user (overrides the role-level scope).
- Admin+ can remove a user from a role from this tab.
- A user can also be assigned a role from the **Team Members** page (the Role column / Add User modal).

### 8.4 Role column in Team Members

- Each row in the team members table shows the user's current role as a colored badge.
- Clicking the badge (Admin+ only) opens an inline role-change dropdown.
- The Add User modal includes a role picker as part of the invite flow.

---

## 9. Navigation & Page Guards

### 9.1 Nav filtering

Navigation items are hidden from users below the required minimum role:

| Nav item | Minimum role to see |
|---|---|
| All nav items not listed below | User |
| Analytics | Manager |
| Bulk Operations | Admin |
| Trust Center | Admin |
| API Keys | Admin |
| Licenses | Admin |
| Roles & Permissions | Admin |

Hiding a nav item is a UX convenience. Users who navigate directly to a hidden URL are handled by page guards (§9.2).

### 9.2 Page guards

The following pages redirect users below the minimum role to `/dashboard`:

| Page | Minimum role |
|---|---|
| `/settings/roles` | Admin |
| `/settings/bulk-operations` | Admin |
| `/settings/trust-center` | Admin |
| `/settings/api-keys` | Admin |
| `/settings/licenses` | Admin |

All other pages that have "no access" in the permission matrix (§5) also redirect, not show an empty/error state.

---

## 10. Audit Log

Every write operation on RBAC data must be recorded. This is a compliance requirement.

### 10.1 Audited events

| Event | Trigger |
|---|---|
| `ROLE_CREATED` | A new custom role is created |
| `ROLE_UPDATED` | A role's name, description, or permissions are changed |
| `ROLE_DELETED` | A custom role is deleted |
| `USER_ASSIGNED` | A user is assigned to a role |
| `USER_REMOVED` | A user is removed from a role |
| `PERMISSION_CHANGED` | A specific permission toggle is changed on a role |

### 10.2 Audit record fields

Each record must capture:

- Actor user ID and account ID
- Actor IP address and user agent
- Event type
- Target type and target ID (role ID or assignment ID)
- Full before-state (JSON snapshot)
- Full after-state (JSON snapshot)
- Server timestamp

Every listed RBAC event must produce a complete audit record containing all fields defined above. No RBAC write may complete without a corresponding audit record being guaranteed.

---

## 11. Security Requirements

> These requirements are **mandatory** before the feature is considered production-ready. Frontend enforcement is UX only; all security controls must exist independently on the backend.

### 11.1 Authentication

- All RBAC endpoints require a valid, non-expired JWT.
- JWTs must be short-lived (≤ 1 hour).
- Logging out must invalidate the refresh token server-side.

### 11.2 Authorization

For every API request the backend must verify all of the following, independently:

1. **Account isolation** — `accountId` in the URL must match `accountId` in the JWT. Never trust the URL parameter alone.
2. **Role check** — the caller's role must meet the minimum required for the operation (e.g., Manager calling `POST /roles` → `403 Forbidden`).
3. **Scope check** — if the caller has a scoped assignment, API responses must be filtered to only the scoped resource IDs.
4. **System role immutability** — `PUT` or `DELETE` on a role where `type = 'system'` must return `403`.
5. **No self-escalation** — a user cannot assign themselves or anyone else a role higher than their own current role.
6. **Own-data only for Users** — a User can only modify their own voicemail settings, not another user's.

### 11.3 New user defaults

Users created via the add-user flow must default to the `User` role (lowest privilege). The role assignment is always an explicit, separate action.

### 11.4 Rate limiting

| Endpoint | Limit |
|---|---|
| `POST /roles` | 10 req/min per account |
| `PUT /roles/:id` | 20 req/min per account |
| `POST /roles/:id/assignments` | 30 req/min per account |
| `DELETE *` (any RBAC delete) | 10 req/min per account |

---

## 12. Acceptance Criteria

The feature is complete when all of the following are true:

### Roles UI
- [ ] System roles (Super Admin, Admin, Manager, User) are displayed and cannot be edited or deleted.
- [ ] Admin+ can create a custom role with a name, description, base role, and permission overrides.
- [ ] Admin+ can edit a custom role's name, description, and permission overrides.
- [ ] Deleting a custom role with active user assignments returns an error; the role is not deleted.
- [ ] Deleting a custom role with no assignments succeeds.

### Permissions enforcement
- [ ] A User navigating to `/settings/roles` is redirected to the dashboard.
- [ ] A Manager navigating to `/settings/roles` is redirected to the dashboard.
- [ ] A User does not see the Analytics nav item.
- [ ] A Manager does see the Analytics nav item but does not see edit controls on the Analytics page.
- [ ] A User can edit their own voicemail settings.
- [ ] A User cannot edit another user's voicemail settings (API returns `403`).
- [ ] A Manager assigned to Department A does not see Team Members from Department B.

### Security
- [ ] A Manager calling `POST /roles` (directly via API) receives `403 Forbidden`.
- [ ] An Admin calling `PUT /roles/{system-role-id}` receives `403 Forbidden`.
- [ ] A user in Account 100 calling `GET /accounts/200/roles` receives `403 Forbidden`.
- [ ] An Admin attempting to create a custom role with Super Admin-only permissions (SIP trunking edit) receives `403`.
- [ ] A newly created user defaults to the User role.

### Audit log
- [ ] Creating, editing, or deleting a role produces an audit log entry with before/after snapshots.
- [ ] Assigning or removing a user from a role produces an audit log entry.

### Data persistence
- [ ] Custom roles, permission overrides, and user assignments persist across page refreshes and browser sessions.
- [ ] Role changes take effect for a user on their next API request (no manual logout required).

---

## 13. Rollout Plan

### Phase 1 — Foundation (current sprint)
- [x] Frontend UI complete
- [ ] Database schema: `roles`, `role_permissions`, `user_role_assignments`, `rbac_audit_log`
- [ ] System roles seeded on account creation
- [ ] CRUD endpoints for roles and assignments
- [ ] Bootstrap payload updated to include `roleAssignments[]`
- [ ] One-line frontend swap to consume real data

### Phase 2 — Enforcement
- [ ] All existing API endpoints filter responses by `scope_ids` server-side
- [ ] Redis permission cache with invalidation on role change
- [ ] Audit log viewer page
- [ ] Call queue and ring group scope types active

### Phase 3 — Advanced
- [ ] Multi-role per user (frontend already supports the data shape)
- [ ] Per-user scope override in the assignment flow
- [ ] SSO role mapping (SAML/OIDC group → n2p role)

---

## 14. Open Questions

| # | Question | Owner | Status |
|---|---|---|---|
| 1 | Does the current JWT contain `accountId` as a claim? If not, this must be added before any RBAC enforcement is possible. | Backend | Open |
| 2 | Is there a Redis cluster available for the permission cache? | Infra | Open |
| 3 | What is the current `role` field in the users table — foreign key or plain string? | Backend | Open |
| 4 | Are refresh tokens stored server-side and revocable today? | Backend | Open |
| 5 | Who owns the account-level feature flag (`RolesAndPermissions`) that enables this page? | Platform | Open |
| 6 | Should the audit log be exposed to Super Admins in the UI in Phase 1, or deferred to Phase 2? | Product | Open |
