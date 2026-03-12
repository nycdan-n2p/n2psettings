/**
 * Centralized React Query key factory.
 *
 * Rules:
 *  1. Every domain gets its own namespace object.
 *  2. Keys always start with a stable string domain, then accountId, then
 *     any sub-resource identifiers.  This ensures invalidateQueries({ queryKey:
 *     qk.ringGroups.all(accountId) }) correctly busts every ring-group query.
 *  3. Use `as const` so TypeScript infers readonly tuple types.
 *
 * Usage:
 *   import { qk } from "@/lib/query-keys";
 *
 *   // in useQuery:
 *   queryKey: qk.ringGroups.list(accountId)
 *
 *   // invalidate the whole domain:
 *   queryClient.invalidateQueries({ queryKey: qk.ringGroups.all(accountId) })
 */

// ─── Shared light-list keys (one canonical key, shared across pages) ────────

export const lightKeys = {
  users:       (accountId: number) => ["light", accountId, "users"]       as const,
  departments: (accountId: number) => ["light", accountId, "departments"] as const,
  menus:       (accountId: number) => ["light", accountId, "menus"]       as const,
  ringGroups:  (accountId: number) => ["light", accountId, "ring-groups"] as const,
  specialExts: (accountId: number) => ["light", accountId, "special-exts"] as const,
};

// ─── Domain key factories ────────────────────────────────────────────────────

export const qk = {

  // Ring Groups
  ringGroups: {
    all:      (accountId: number)                         => ["ring-groups", accountId]                          as const,
    list:     (accountId: number)                         => ["ring-groups", accountId, "list"]                  as const,
    detail:   (accountId: number, id: string | number)   => ["ring-groups", accountId, "detail", id]            as const,
    features: (accountId: number, id: string | number)   => ["ring-groups", accountId, "features", id]          as const,
  },

  // Departments
  departments: {
    all:           (accountId: number)                         => ["departments", accountId]                      as const,
    list:          (accountId: number)                         => ["departments", accountId, "list"]              as const,
    features:      (accountId: number, deptId: number)       => ["departments", accountId, "features", deptId]  as const,
    callForwardRules: (accountId: number, deptId: number)     => ["departments", accountId, "callForwardRules", deptId] as const,
  },

  // Team Members
  teamMembers: {
    all:  (accountId: number)                           => ["team-members", accountId]           as const,
    list: (accountId: number)                           => ["team-members", accountId, "list"]   as const,
  },

  // Call Queues
  callQueues: {
    all:    (accountId: number)                           => ["call-queues", accountId]                        as const,
    list:   (accountId: number)                           => ["call-queues", accountId, "list"]                as const,
    detail: (accountId: number, id: string | number)     => ["call-queues", accountId, "detail", id]          as const,
  },

  // Schedules
  schedules: {
    all:  (accountId: number)                           => ["schedules", accountId]              as const,
    list: (accountId: number)                           => ["schedules", accountId, "list"]      as const,
  },

  // Devices
  devices: {
    all:  (accountId: number)                           => ["devices", accountId]                as const,
    list: (accountId: number)                           => ["devices", accountId, "list"]        as const,
  },

  // Special Extensions
  specialExtensions: {
    all:  (accountId: number)                           => ["special-extensions", accountId]     as const,
    list: (accountId: number)                           => ["special-extensions", accountId, "list"] as const,
  },

  // Virtual Assistant / Welcome Menus
  welcomeMenus: {
    all:    (accountId: number)                         => ["welcome-menus", accountId]                        as const,
    list:   (accountId: number)                         => ["welcome-menus", accountId, "list"]                as const,
    detail: (accountId: number, id: string | number)   => ["welcome-menus", accountId, "detail", id]          as const,
  },

  // Call History
  callHistory: {
    all:  (accountId: number)                           => ["call-history", accountId]           as const,
    list: (accountId: number, userId: number | null, startDate: string) =>
                                                           ["call-history", accountId, userId, startDate] as const,
  },

  // Voicemails
  voicemails: {
    all:  (accountId: number, userId: number)           => ["voicemails", accountId, userId]     as const,
  },

  // Analytics
  analytics: {
    account: (accountId: number, preset: string)        => ["analytics", accountId, "account", preset]  as const,
    users:   (accountId: number, preset: string)        => ["analytics", accountId, "users",   preset]  as const,
    depts:   (accountId: number, preset: string)        => ["analytics", accountId, "depts",   preset]  as const,
    fromHistory: (accountId: number, preset: string, direction: string) =>
      ["analytics", accountId, "from-history", preset, direction] as const,
  },

  // Phone Numbers
  phoneNumbers: {
    all:  (accountId: number)                           => ["phone-numbers", accountId]          as const,
  },

  // Call Blocking
  callBlocking: {
    all:  ()                                            => ["call-blocking"]                     as const,
    list: (direction: string)                           => ["call-blocking", direction]           as const,
  },

  // Settings
  e911:          { all: (accountId: number)             => ["e911-contacts", accountId]          as const },
  apiKeys:       { all: (accountId: number)             => ["api-keys", accountId]               as const },
  sso:           { all: (accountId: number)             => ["sso-config", accountId]             as const },
  twoFa:         { all: (accountId: number)             => ["2fa-settings", accountId]           as const },
  musicOptions:  { all: (accountId: number)             => ["music-options", accountId]          as const },
  delegates:     { all: (accountId: number)             => ["delegates", accountId]              as const },
  voicemailSettings: { all: (accountId: number)         => ["voicemail-settings", accountId]     as const },
  webhooks: {
    all:        (accountId: number, userId: number) => ["webhooks", accountId, userId]        as const,
    eventTypes: (accountId: number, userId: number) => ["webhook-event-types", accountId, userId] as const,
  },
  virtualFax:    { all: (accountId: number)             => ["virtual-fax", accountId]            as const },
  tieLines:      { all: (accountId: number)             => ["tie-lines", accountId]              as const },
  karis:         { all: (accountId: number)             => ["karis-law", accountId]              as const },
  companyDir:    { all: (accountId: number)             => ["company-directory", accountId]      as const },
  bulkOps:       { all: (accountId: number)             => ["bulk-load", accountId]              as const },
  porting:       { all: (accountId: number)             => ["porting", accountId]                as const },

  // SIP Trunking — sipAccounts uses the bearer token (no id), sub-resources use the SIP account id
  sipAccounts:   { all: ()                              => ["sip-trunk-accounts"]                as const },
  sipTrunks:     { all: (clientId: string)              => ["sip-trunks", clientId]              as const },
  sipLimits:     { all: (clientId: string)              => ["sip-limits", clientId]              as const },
  sipAddresses:  { all: (clientId: string)              => ["sip-service-addresses", clientId]   as const },
  sipNumbers:    { all: (clientId: string)              => ["sip-phone-numbers", clientId]       as const },

  // 10DLC
  dlcBrands:    { all: ()                               => ["10dlc-brands"]                      as const },
  dlcCampaigns: { all: ()                               => ["10dlc-campaigns"]                   as const },

  // Dashboard analytics summary (separate from full analytics)
  dashboardSummary: {
    account: (accountId: number, preset: string)        => ["analytics", accountId, "account", preset] as const,
    users:   (accountId: number, preset: string)        => ["analytics", accountId, "users-summary", preset] as const,
  },
};
