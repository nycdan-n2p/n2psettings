/**
 * net2phone MCP tool definitions and handlers.
 *
 * Used by:
 *  - app/api/mcp/route.ts  (Vercel HTTP deployment)
 *  - n2p-mcp/src/index.ts  (local stdio deployment)
 *
 * Context passed per-request so the same code works in both cases.
 */

import axios, { type AxiosInstance } from "axios";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from "@modelcontextprotocol/sdk/types.js";

// ─── Context ──────────────────────────────────────────────────────────────────

export interface N2PMCPContext {
  /** net2phone Bearer token */
  token: string;
  /** Default UCaaS account ID */
  accountId?: number;
  /** Default SIP trunk account ID */
  sipClientId?: string;
  /** UCaaS client ID (for catalogs, e.g. JWT cid) */
  clientId?: number;
}

// ─── HTTP clients ─────────────────────────────────────────────────────────────

const V1_BASE  = "https://app.net2phone.com/api";
const V2_BASE  = "https://app.net2phone.com/api/v2";
const N2P_BASE = "https://api.n2p.io/v2";

function makeClient(baseURL: string, token: string): AxiosInstance {
  return axios.create({
    baseURL,
    headers: {
      "Content-Type": "application/json",
      "x-accept-version": "v1.1",
      "x-application-name": "Unite",
      Accept: "application/json, text/plain, */*",
      Authorization: `Bearer ${token}`,
    },
  });
}

// ─── Helper types ─────────────────────────────────────────────────────────────

type Args = Record<string, unknown>;

function num(a: Args, k: string): number  { return Number(a[k]); }
function str(a: Args, k: string): string  { return String(a[k]); }
function numOpt(a: Args, k: string): number | undefined { return a[k] !== undefined ? Number(a[k]) : undefined; }
function strOpt(a: Args, k: string): string | undefined { return a[k] !== undefined ? String(a[k]) : undefined; }

function resolveAccountId(args: Args, ctx: N2PMCPContext): number {
  const id = numOpt(args, "account_id") ?? ctx.accountId;
  if (!id) throw new Error("account_id is required (pass in args or set N2P_ACCOUNT_ID)");
  return id;
}
function resolveSipClientId(args: Args, ctx: N2PMCPContext): string {
  const id = strOpt(args, "sip_client_id") ?? ctx.sipClientId;
  if (!id) throw new Error("sip_client_id is required (pass in args or set N2P_SIP_CLIENT_ID)");
  return id;
}

function ok(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}
function errResult(e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);
  const axErr = e as { response?: { status?: number; data?: unknown } };
  const detail = axErr?.response?.data ? JSON.stringify(axErr.response.data) : undefined;
  return {
    content: [{ type: "text" as const, text: `Error: ${msg}${detail ? `\n${detail}` : ""}` }],
    isError: true,
  };
}

// ─── Tool definitions ─────────────────────────────────────────────────────────

export const N2P_TOOLS: Tool[] = [
  // ACCOUNT
  { name: "get_account", description: "Get account/company details", inputSchema: { type: "object", properties: { account_id: { type: "number" } } } },
  { name: "get_account_summary", description: "Get account overview: total DIDs, available numbers, max user seats", inputSchema: { type: "object", properties: { account_id: { type: "number" } } } },
  { name: "get_next_user_extension", description: "Get next available extension for a new user", inputSchema: { type: "object", properties: { account_id: { type: "number" } } } },
  { name: "get_available_phone_numbers", description: "List unassigned phone numbers available to assign to users", inputSchema: { type: "object", properties: { account_id: { type: "number" }, limit: { type: "number" }, client_id: { type: "number" } } } },
  { name: "assign_phone_to_user", description: "Assign a phone number to a user", inputSchema: { type: "object", required: ["user_id", "phone_number"], properties: { account_id: { type: "number" }, user_id: { type: "number" }, phone_number: { type: "string" } } } },

  // TEAM MEMBERS
  { name: "list_team_members", description: "List all team members / users", inputSchema: { type: "object", properties: { account_id: { type: "number" } } } },
  { name: "get_team_member", description: "Get a specific team member by user ID", inputSchema: { type: "object", required: ["user_id"], properties: { account_id: { type: "number" }, user_id: { type: "number" } } } },
  { name: "create_team_member", description: "Create a new team member", inputSchema: { type: "object", required: ["first_name","last_name","email","extension"], properties: { account_id: { type: "number" }, first_name: { type: "string" }, last_name: { type: "string" }, email: { type: "string" }, extension: { type: "string" }, role_id: { type: "number" }, dept_id: { type: "number" } } } },
  { name: "update_team_member", description: "Update a team member", inputSchema: { type: "object", required: ["user_id"], properties: { account_id: { type: "number" }, user_id: { type: "number" }, first_name: { type: "string" }, last_name: { type: "string" }, email: { type: "string" }, extension: { type: "string" } } } },
  { name: "delete_team_member", description: "Delete a team member", inputSchema: { type: "object", required: ["user_id"], properties: { account_id: { type: "number" }, user_id: { type: "number" } } } },
  { name: "search_team_members", description: "Search team members by name, email, or extension", inputSchema: { type: "object", required: ["query"], properties: { account_id: { type: "number" }, query: { type: "string" } } } },
  { name: "list_team_members_light", description: "List lightweight user records for dropdowns", inputSchema: { type: "object", properties: { account_id: { type: "number" } } } },

  // DEPARTMENTS
  { name: "list_departments", description: "List all departments", inputSchema: { type: "object", properties: { account_id: { type: "number" } } } },
  { name: "create_department", description: "Create a department", inputSchema: { type: "object", required: ["name"], properties: { account_id: { type: "number" }, name: { type: "string" }, extension: { type: "string" } } } },
  { name: "update_department", description: "Update a department", inputSchema: { type: "object", required: ["dept_id"], properties: { account_id: { type: "number" }, dept_id: { type: "number" }, name: { type: "string" }, extension: { type: "string" } } } },
  { name: "delete_department", description: "Delete a department", inputSchema: { type: "object", required: ["dept_id"], properties: { account_id: { type: "number" }, dept_id: { type: "number" } } } },

  // RING GROUPS
  { name: "list_ring_groups", description: "List all ring groups", inputSchema: { type: "object", properties: { account_id: { type: "number" } } } },
  { name: "get_ring_group", description: "Get ring group details", inputSchema: { type: "object", required: ["ring_group_id"], properties: { account_id: { type: "number" }, ring_group_id: { type: "string" } } } },
  { name: "create_ring_group", description: "Create a ring group", inputSchema: { type: "object", required: ["name"], properties: { account_id: { type: "number" }, name: { type: "string" }, extension: { type: "string" } } } },
  { name: "update_ring_group", description: "Update a ring group", inputSchema: { type: "object", required: ["ring_group_id"], properties: { account_id: { type: "number" }, ring_group_id: { type: "string" }, name: { type: "string" }, extension: { type: "string" } } } },
  { name: "delete_ring_group", description: "Delete a ring group", inputSchema: { type: "object", required: ["ring_group_id"], properties: { account_id: { type: "number" }, ring_group_id: { type: "string" } } } },
  { name: "add_user_to_ring_group", description: "Add a user to a ring group", inputSchema: { type: "object", required: ["ring_group_id","user_id"], properties: { account_id: { type: "number" }, ring_group_id: { type: "string" }, user_id: { type: "number" } } } },
  { name: "set_ring_group_members", description: "Replace all ring group members", inputSchema: { type: "object", required: ["ring_group_id","user_ids"], properties: { account_id: { type: "number" }, ring_group_id: { type: "string" }, user_ids: { type: "array", items: { type: "number" } } } } },

  // CALL QUEUES
  { name: "list_call_queues", description: "List all call queues", inputSchema: { type: "object", properties: { limit: { type: "number" } } } },
  { name: "get_call_queue", description: "Get call queue details", inputSchema: { type: "object", required: ["queue_id"], properties: { queue_id: { type: "string" }, account_id: { type: "number" } } } },
  { name: "create_call_queue", description: "Create a call queue", inputSchema: { type: "object", required: ["name"], properties: { account_id: { type: "number" }, name: { type: "string" }, extension: { type: "string" }, strategy: { type: "string" }, max_wait_time: { type: "number" } } } },
  { name: "update_call_queue", description: "Update a call queue", inputSchema: { type: "object", required: ["queue_id"], properties: { queue_id: { type: "string" }, display_name: { type: "string" }, max_capacity: { type: "number" }, max_wait_time_seconds: { type: "number" }, ring_strategy_type: { type: "string" } } } },
  { name: "delete_call_queue", description: "Delete a call queue", inputSchema: { type: "object", required: ["queue_id"], properties: { account_id: { type: "number" }, queue_id: { type: "string" } } } },
  { name: "add_agent_to_call_queue", description: "Add an agent to a call queue", inputSchema: { type: "object", required: ["queue_id","user_id"], properties: { account_id: { type: "number" }, queue_id: { type: "string" }, user_id: { type: "number" } } } },
  { name: "set_call_queue_agents", description: "Replace all call queue agents", inputSchema: { type: "object", required: ["queue_id","user_ids"], properties: { account_id: { type: "number" }, queue_id: { type: "string" }, user_ids: { type: "array", items: { type: "number" } } } } },

  // CALL QUEUE REPORTS
  { name: "get_agent_activity_report", description: "Agent activity report for a call queue (time-series per agent)", inputSchema: { type: "object", required: ["queue_id","start_date","end_date"], properties: { queue_id: { type: "string" }, start_date: { type: "string" }, end_date: { type: "string" }, interval_size: { type: "string", enum: ["quarter_of_hour","hour","day"] }, timezone: { type: "string" }, agent_ids: { type: "array", items: { type: "number" } } } } },
  { name: "get_queue_activity_report", description: "Queue-level aggregate activity report", inputSchema: { type: "object", required: ["queue_id","start_date","end_date"], properties: { queue_id: { type: "string" }, start_date: { type: "string" }, end_date: { type: "string" }, interval_size: { type: "string", enum: ["quarter_of_hour","hour","day"] }, iana_timezone_id: { type: "string" } } } },

  // SCHEDULES
  { name: "list_schedules", description: "List all schedules", inputSchema: { type: "object", properties: { account_id: { type: "number" } } } },
  { name: "list_timezones", description: "List available timezones", inputSchema: { type: "object", properties: {} } },
  { name: "create_schedule", description: "Create a schedule", inputSchema: { type: "object", required: ["name"], properties: { account_id: { type: "number" }, name: { type: "string" }, timezone: { type: "string" }, rules: { type: "array" } } } },
  { name: "update_schedule", description: "Update a schedule", inputSchema: { type: "object", required: ["schedule_id"], properties: { account_id: { type: "number" }, schedule_id: { type: "number" }, name: { type: "string" }, timezone: { type: "string" }, rules: { type: "array" } } } },
  { name: "delete_schedule", description: "Delete a schedule", inputSchema: { type: "object", required: ["schedule_id"], properties: { account_id: { type: "number" }, schedule_id: { type: "number" } } } },

  // PHONE NUMBERS
  { name: "list_phone_numbers", description: "List phone numbers", inputSchema: { type: "object", properties: { account_id: { type: "number" } } } },
  { name: "list_porting_requests", description: "List number porting requests", inputSchema: { type: "object", properties: { account_id: { type: "number" } } } },

  // DEVICES
  { name: "list_devices", description: "List all devices", inputSchema: { type: "object", properties: { account_id: { type: "number" } } } },
  { name: "list_device_orders", description: "List device orders", inputSchema: { type: "object", properties: { account_id: { type: "number" } } } },
  { name: "list_sip_registrations", description: "List SIP registration status for devices", inputSchema: { type: "object", properties: { account_id: { type: "number" } } } },
  { name: "list_device_templates", description: "List device configuration templates", inputSchema: { type: "object", properties: { account_id: { type: "number" } } } },
  { name: "reboot_device", description: "Reboot a device", inputSchema: { type: "object", required: ["device_id"], properties: { account_id: { type: "number" }, device_id: { type: "string" } } } },

  // VIRTUAL ASSISTANT
  { name: "list_virtual_assistants", description: "List virtual assistants / welcome menus", inputSchema: { type: "object", properties: { account_id: { type: "number" } } } },
  { name: "get_virtual_assistant", description: "Get a virtual assistant", inputSchema: { type: "object", required: ["menu_id"], properties: { account_id: { type: "number" }, menu_id: { type: "string" } } } },
  { name: "create_virtual_assistant", description: "Create a virtual assistant", inputSchema: { type: "object", required: ["name"], properties: { account_id: { type: "number" }, name: { type: "string" }, extension: { type: "string" } } } },
  { name: "delete_virtual_assistant", description: "Delete a virtual assistant", inputSchema: { type: "object", required: ["menu_id"], properties: { account_id: { type: "number" }, menu_id: { type: "string" } } } },

  // SPECIAL EXTENSIONS
  { name: "list_special_extensions", description: "List special extensions", inputSchema: { type: "object", properties: { account_id: { type: "number" } } } },
  { name: "create_special_extension", description: "Create a special extension", inputSchema: { type: "object", required: ["name","extension"], properties: { account_id: { type: "number" }, name: { type: "string" }, extension: { type: "string" }, type: { type: "string" } } } },
  { name: "delete_special_extension", description: "Delete a special extension", inputSchema: { type: "object", required: ["ext_id"], properties: { account_id: { type: "number" }, ext_id: { type: "string" } } } },

  // VIRTUAL FAX
  { name: "list_virtual_faxes", description: "List virtual fax lines", inputSchema: { type: "object", properties: { account_id: { type: "number" } } } },

  // CALL HISTORY
  { name: "list_call_history", description: "List call history", inputSchema: { type: "object", required: ["start_date"], properties: { account_id: { type: "number" }, user_id: { type: "number" }, start_date: { type: "string" }, limit: { type: "number" } } } },
  { name: "get_recording_url", description: "Get a call recording URL", inputSchema: { type: "object", required: ["call_id"], properties: { account_id: { type: "number" }, call_id: { type: "string" } } } },

  // CALL BLOCKING
  { name: "list_inbound_blocked", description: "List inbound blocked numbers", inputSchema: { type: "object", properties: {} } },
  { name: "list_outbound_blocked", description: "List outbound blocked numbers", inputSchema: { type: "object", properties: {} } },
  { name: "add_blocked_number", description: "Block a phone number", inputSchema: { type: "object", required: ["phone_number","direction"], properties: { phone_number: { type: "string" }, direction: { type: "string", enum: ["inbound","outbound"] }, note: { type: "string" } } } },
  { name: "delete_blocked_number", description: "Unblock a phone number", inputSchema: { type: "object", required: ["block_id","direction"], properties: { block_id: { type: "string" }, direction: { type: "string", enum: ["inbound","outbound"] } } } },

  // SIP TRUNKING
  { name: "list_sip_trunk_accounts", description: "List SIP trunk accounts for this user", inputSchema: { type: "object", properties: {} } },
  { name: "list_sip_trunks", description: "List SIP trunks", inputSchema: { type: "object", properties: { sip_client_id: { type: "string" }, page_size: { type: "number" } } } },
  { name: "get_sip_trunk", description: "Get a SIP trunk", inputSchema: { type: "object", required: ["trunk_id"], properties: { sip_client_id: { type: "string" }, trunk_id: { type: "string" } } } },
  { name: "get_sip_limits", description: "Get SIP channel limits", inputSchema: { type: "object", properties: { sip_client_id: { type: "string" } } } },
  { name: "list_sip_service_addresses", description: "List SIP E911 service addresses", inputSchema: { type: "object", properties: { sip_client_id: { type: "string" }, page_size: { type: "number" }, search_query: { type: "string" } } } },
  { name: "list_sip_phone_numbers", description: "List SIP trunk phone numbers", inputSchema: { type: "object", properties: { sip_client_id: { type: "string" }, page_size: { type: "number" } } } },
  { name: "list_sip_endpoints", description: "List SIP server endpoints (host/port/protocol)", inputSchema: { type: "object", properties: { sip_client_id: { type: "string" } } } },
  { name: "get_sip_notifications", description: "Get SIP trunk notification settings", inputSchema: { type: "object", properties: { sip_client_id: { type: "string" } } } },
  { name: "list_sip_call_history", description: "Search SIP trunk call detail records", inputSchema: { type: "object", properties: { sip_client_id: { type: "string" }, limit: { type: "number" }, after: { type: "string" }, sort_direction: { type: "string", enum: ["asc","desc"] } } } },
  { name: "get_sip_registration_summary", description: "Get SIP trunk registration status summary", inputSchema: { type: "object", properties: { sip_client_id: { type: "string" } } } },

  // DELEGATES
  { name: "list_delegates", description: "List call delegation assignments", inputSchema: { type: "object", properties: { account_id: { type: "number" } } } },
  { name: "add_delegate", description: "Add a delegate", inputSchema: { type: "object", required: ["delegator_id","delegate_id"], properties: { account_id: { type: "number" }, delegator_id: { type: "number" }, delegate_id: { type: "number" } } } },
  { name: "delete_delegate", description: "Remove a delegate", inputSchema: { type: "object", required: ["delegate_id"], properties: { account_id: { type: "number" }, delegate_id: { type: "number" } } } },

  // KARI'S LAW
  { name: "list_911_contacts", description: "List E911 / Kari's Law contacts", inputSchema: { type: "object", properties: { account_id: { type: "number" } } } },
  { name: "add_911_contact", description: "Add an E911 contact", inputSchema: { type: "object", required: ["name","phone_number"], properties: { account_id: { type: "number" }, name: { type: "string" }, phone_number: { type: "string" }, email: { type: "string" } } } },
  { name: "delete_911_contact", description: "Delete an E911 contact", inputSchema: { type: "object", required: ["contact_id"], properties: { account_id: { type: "number" }, contact_id: { type: "string" } } } },

  // 10DLC
  { name: "list_10dlc_brands", description: "List 10DLC SMS brands", inputSchema: { type: "object", properties: {} } },
  { name: "list_10dlc_campaigns", description: "List 10DLC SMS campaigns", inputSchema: { type: "object", properties: {} } },

  // WEBHOOKS
  { name: "list_webhooks", description: "List webhook subscriptions", inputSchema: { type: "object", required: ["user_id"], properties: { account_id: { type: "number" }, user_id: { type: "number" } } } },

  // OTHER
  { name: "list_tie_lines", description: "List SIP tie lines", inputSchema: { type: "object", properties: { account_id: { type: "number" } } } },
  { name: "list_music_options", description: "List music on hold options", inputSchema: { type: "object", properties: { account_id: { type: "number" } } } },
  { name: "list_licenses", description: "List account licenses", inputSchema: { type: "object", properties: { account_id: { type: "number" } } } },

  // ANALYTICS
  { name: "get_account_analytics", description: "Get account-level call analytics", inputSchema: { type: "object", required: ["preset"], properties: { account_id: { type: "number" }, preset: { type: "string", enum: ["today","7days","14days","month"] } } } },
  { name: "get_user_analytics", description: "Get per-user call analytics", inputSchema: { type: "object", required: ["preset"], properties: { account_id: { type: "number" }, preset: { type: "string", enum: ["today","7days","14days","month"] } } } },
  { name: "get_department_analytics", description: "Get per-department call analytics", inputSchema: { type: "object", required: ["preset"], properties: { account_id: { type: "number" }, preset: { type: "string", enum: ["today","7days","14days","month"] } } } },
  { name: "get_account_analytics_from_history", description: "Get call analytics from call history (works for today/short periods when preset API fails). Returns totalCalls, userRows (sorted by totalCalls, top caller first), busyTimesGrid.", inputSchema: { type: "object", required: ["days"], properties: { account_id: { type: "number" }, days: { type: "number" } } } },
  { name: "get_busy_times", description: "Get busy times heatmap: call volume by day of week and hour", inputSchema: { type: "object", required: ["days"], properties: { account_id: { type: "number" }, days: { type: "number" } } } },
  { name: "get_messaging_analytics", description: "Get SMS/MMS messaging analytics (placeholder - data not yet available)", inputSchema: { type: "object", properties: { account_id: { type: "number" }, days: { type: "number" } } } },

  // VOICEMAIL
  { name: "list_voicemails", description: "List voicemails for a user", inputSchema: { type: "object", required: ["user_id"], properties: { account_id: { type: "number" }, user_id: { type: "number" } } } },

  // SUPPORT KNOWLEDGE
  { name: "search_support", description: "Search net2phone support articles for product questions, how-to guides, and troubleshooting. Use when the user asks about features, setup, or how to do something.", inputSchema: { type: "object", required: ["query"], properties: { query: { type: "string", description: "Search query (e.g. 'call forwarding', 'web calling', 'voicemail setup')" } } } },
];

// ─── Raw tool execution (for API route) ─────────────────────────────────────────

/**
 * Execute an N2P tool and return raw data. Throws on error.
 * Used by app/api/n2p-tools and by handleN2PTool (which wraps in MCP content).
 */
export async function executeN2PTool(
  name: string,
  args: Args,
  ctx: N2PMCPContext
): Promise<unknown> {
  const v1 = makeClient(V1_BASE, ctx.token);
  const v2 = makeClient(V2_BASE, ctx.token);
  const n2p = makeClient(N2P_BASE, ctx.token);

  const unwrap = <T>(d: T): T => {
    const v = d as { data?: T };
    return (v?.data !== undefined ? v.data : d) as T;
  };

  // ACCOUNT
  if (name === "get_account") {
    const id = resolveAccountId(args, ctx);
    const res = await v1.get(`/accounts/${id}`);
    return unwrap(res.data);
  }

  // get_account_summary: merge account + phonenumbers/stats (assistant-specific)
  if (name === "get_account_summary") {
    const id = resolveAccountId(args, ctx);
    const [acctRes, statsRes] = await Promise.all([
      v1.get(`/accounts/${id}`),
      v1.get(`/accounts/${id}/phonenumbers/stats`).catch(() => ({ data: null })),
    ]);
    const acct = unwrap(acctRes.data) as Record<string, unknown>;
    const stats = statsRes.data ? unwrap(statsRes.data) as Record<string, unknown> : null;
    return {
      totalDIDs: stats?.maxPhoneNumbers ?? "unknown",
      inUse: stats?.phoneNumbersInUse ?? "unknown",
      available: stats?.unUsedPhones ?? "unknown",
      maxUserSeats: acct?.maxUsers ?? "unknown",
      company: acct?.company,
    };
  }

  // get_next_user_extension: max(extensions)+1, fallback "200"
  if (name === "get_next_user_extension") {
    const id = resolveAccountId(args, ctx);
    const res = await v1.get(`/accounts/${id}/users`, {
      params: { includeLineNumbersFlag: "N", includeDepartmentUser: false },
    });
    const users = Array.isArray(unwrap(res.data)) ? unwrap(res.data) as Array<{ extension?: string }> : [];
    const extensions = users
      .map((u) => parseInt(String(u?.extension ?? "0"), 10))
      .filter((n) => !isNaN(n) && n > 0);
    const next = extensions.length === 0 ? 200 : Math.max(...extensions) + 1;
    return { nextExtension: String(next) };
  }

  // get_available_phone_numbers: unassigned account DIDs + catalog overflow
  if (name === "get_available_phone_numbers") {
    const id = resolveAccountId(args, ctx);
    const limit = numOpt(args, "limit") ?? 8;
    const res = await v1.get(`/accounts/${id}/phonenumbers`);
    const acctNums = Array.isArray(unwrap(res.data)) ? unwrap(res.data) as Array<{ phoneNumber?: string; userId?: number; deptId?: number; routeType?: string }> : [];
    const unassigned = acctNums.filter((n) => {
      const rt = String(n.routeType ?? "").toLowerCase();
      return !n.userId && !n.deptId && rt !== "user" && rt !== "department";
    });
    let catNums: Array<{ phoneNumber?: string; forbiddenAsCallerId?: boolean }> = [];
    const catalogClientId = numOpt(args, "client_id") ?? ctx.clientId;
    if (catalogClientId) {
      try {
        const catRes = await v1.get(`/catalogs/${catalogClientId}/phone-numbers`);
        catNums = Array.isArray(unwrap(catRes.data)) ? unwrap(catRes.data) as typeof catNums : [];
      } catch {
        // ignore
      }
    }
    const acctSet = new Set(acctNums.map((n) => n.phoneNumber));
    const catOnly = catNums.filter((n) => !n.forbiddenAsCallerId && !acctSet.has(n.phoneNumber));
    const pool = [...unassigned, ...catOnly].slice(0, limit);
    if (pool.length === 0) {
      return { available: 0, numbers: [], note: "No available numbers found on this account." };
    }
    return {
      available: pool.length,
      numbers: pool.map((n) => {
        const raw = n.phoneNumber ?? "";
        const d = raw.replace(/\D/g, "");
        let formatted = raw;
        if (d.length === 11 && d.startsWith("1")) formatted = `+1 (${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
        else if (d.length === 10) formatted = `+1 (${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
        return { phoneNumber: raw, formatted };
      }),
    };
  }

  // assign_phone_to_user: PATCH user with lineNumber
  if (name === "assign_phone_to_user") {
    const id = resolveAccountId(args, ctx);
    const userId = num(args, "user_id");
    const phone = str(args, "phone_number").replace(/^\+/, "");
    await v1.patch(`/accounts/${id}/users/${userId}`, { lineNumber: [phone] });
    return { success: true };
  }

  // TEAM MEMBERS
  if (name === "list_team_members") {
    const id = resolveAccountId(args, ctx);
    const res = await v1.get(`/accounts/${id}/users`, { params: { includeLineNumbersFlag: "Y", includeDepartmentUser: true } });
    return unwrap(res.data);
  }
  if (name === "get_team_member") {
    const id = resolveAccountId(args, ctx);
    const res = await v1.get(`/accounts/${id}/users/${num(args, "user_id")}`);
    return unwrap(res.data);
  }
  if (name === "create_team_member") {
    const id = resolveAccountId(args, ctx);
    const res = await v1.post(`/accounts/${id}/users`, { firstName: args.first_name, lastName: args.last_name, email: args.email, extension: args.extension, roleId: args.role_id, deptId: args.dept_id });
    return unwrap(res.data);
  }
  if (name === "update_team_member") {
    const id = resolveAccountId(args, ctx);
    const payload: Args = {};
    if (args.first_name) payload.firstName = args.first_name;
    if (args.last_name)  payload.lastName  = args.last_name;
    if (args.email)      payload.email     = args.email;
    if (args.extension)  payload.extension = args.extension;
    if (args.role_id)    payload.roleId    = args.role_id;
    if (args.dept_id)    payload.deptId    = args.dept_id;
    const res = await v1.put(`/accounts/${id}/users/${num(args, "user_id")}`, payload);
    return unwrap(res.data);
  }
  if (name === "delete_team_member") {
    const id = resolveAccountId(args, ctx);
    await v1.delete(`/accounts/${id}/users/${num(args, "user_id")}`);
    return { success: true };
  }
  if (name === "search_team_members") {
    const id = resolveAccountId(args, ctx);
    const res = await v1.get(`/accounts/${id}/users`, { params: { includeLineNumbersFlag: "Y", includeDepartmentUser: true } });
    const all = Array.isArray(unwrap(res.data)) ? unwrap(res.data) as Array<Record<string, string>> : [];
    const q = str(args, "query").toLowerCase();
    const filtered = all.filter((u) =>
      `${u.firstName ?? ""} ${u.lastName ?? ""}`.toLowerCase().includes(q) ||
      (u.email ?? "").toLowerCase().includes(q) ||
      (u.extension ?? "").includes(q)
    );
    return filtered;
  }
  if (name === "list_team_members_light") {
    const id = resolveAccountId(args, ctx);
    const res = await v1.get(`/accounts/${id}/users/light`, { params: { skip: 0, take: 500 } });
    const d = res.data as { data?: { items?: unknown[] } };
    return d?.data?.items ?? res.data;
  }

  // DEPARTMENTS
  if (name === "list_departments") {
    const id = resolveAccountId(args, ctx);
    const res = await v1.get(`/accounts/${id}/departments`);
    return unwrap(res.data);
  }
  if (name === "create_department") {
    const id = resolveAccountId(args, ctx);
    const res = await v1.post(`/accounts/${id}/departments`, { name: args.name, extension: args.extension });
    return unwrap(res.data);
  }
  if (name === "update_department") {
    const id = resolveAccountId(args, ctx);
    const payload: Args = {};
    if (args.name)      payload.name      = args.name;
    if (args.extension) payload.extension = args.extension;
    const res = await v1.put(`/accounts/${id}/departments/${num(args, "dept_id")}`, payload);
    return unwrap(res.data);
  }
  if (name === "delete_department") {
    const id = resolveAccountId(args, ctx);
    await v1.delete(`/accounts/${id}/departments/${num(args, "dept_id")}`);
    return { success: true };
  }

  // RING GROUPS
  if (name === "list_ring_groups") {
    const id = resolveAccountId(args, ctx);
    const res = await v1.get(`/account/${id}/ringGroups`);
    return unwrap(res.data);
  }
  if (name === "get_ring_group") {
    const id = resolveAccountId(args, ctx);
    const res = await v1.get(`/account/${id}/ringGroups/${str(args, "ring_group_id")}`);
    return unwrap(res.data);
  }
  if (name === "create_ring_group") {
    const id = resolveAccountId(args, ctx);
    const res = await v1.post(`/account/${id}/ringGroups`, { name: args.name, extension: args.extension });
    return unwrap(res.data);
  }
  if (name === "update_ring_group") {
    const id = resolveAccountId(args, ctx);
    const rgId = str(args, "ring_group_id");
    const cur = await v1.get(`/account/${id}/ringGroups/${rgId}`);
    const merged = { ...cur.data?.data, ...(args.name ? { name: args.name } : {}), ...(args.extension ? { extension: args.extension } : {}) };
    const res = await v1.put(`/account/${id}/ringGroups/${rgId}`, merged);
    return unwrap(res.data);
  }
  if (name === "delete_ring_group") {
    const id = resolveAccountId(args, ctx);
    await v1.delete(`/account/${id}/ringGroups/${str(args, "ring_group_id")}`);
    return { success: true };
  }
  if (name === "add_user_to_ring_group") {
    const id = resolveAccountId(args, ctx);
    const rgId = str(args, "ring_group_id");
    const cur = await v1.get(`/account/${id}/ringGroups/${rgId}`);
    const rg = cur.data?.data ?? {};
    const lines: Array<{ lineId: string; status: string }> = Array.isArray(rg.lines) ? rg.lines : [];
    const lineId = String(num(args, "user_id"));
    if (!lines.some((l) => l.lineId === lineId)) lines.push({ lineId, status: "active" });
    const res = await v1.put(`/account/${id}/ringGroups/${rgId}`, { ...rg, lines });
    return unwrap(res.data);
  }
  if (name === "set_ring_group_members") {
    const id = resolveAccountId(args, ctx);
    const rgId = str(args, "ring_group_id");
    const cur = await v1.get(`/account/${id}/ringGroups/${rgId}`);
    const lines = (args.user_ids as number[]).map((uid) => ({ lineId: String(uid), status: "active" }));
    const res = await v1.put(`/account/${id}/ringGroups/${rgId}`, { ...cur.data?.data, lines });
    return unwrap(res.data);
  }

  // CALL QUEUES
  if (name === "list_call_queues") {
    const res = await v2.get("/call-queues", { params: { limit: args.limit ?? 100 } });
    return res.data?.items ?? res.data;
  }
  if (name === "get_call_queue") {
    const res = await v2.get(`/call-queues/${str(args, "queue_id")}`);
    return res.data;
  }
  if (name === "create_call_queue") {
    const id = resolveAccountId(args, ctx);
    const res = await v1.post(`/accounts/${id}/callqueues`, { name: args.name, extension: args.extension, strategy: args.strategy, max_wait_time: args.max_wait_time });
    return unwrap(res.data);
  }
  if (name === "update_call_queue") {
    const payload: Args = {};
    if (args.display_name)         payload.display_name     = args.display_name;
    if (args.max_capacity)         payload.max_capacity     = args.max_capacity;
    if (args.max_wait_time_seconds) payload.max_wait_time_seconds = args.max_wait_time_seconds;
    if (args.ring_strategy_type)   payload.ring_strategy    = { type: args.ring_strategy_type };
    const res = await v2.patch(`/call-queues/${str(args, "queue_id")}`, payload);
    return res.data;
  }
  if (name === "delete_call_queue") {
    const id = resolveAccountId(args, ctx);
    await v1.delete(`/accounts/${id}/callqueues/${str(args, "queue_id")}`);
    return { success: true };
  }
  if (name === "add_agent_to_call_queue") {
    const id = resolveAccountId(args, ctx);
    const res = await v1.post(`/accounts/${id}/callqueues/${str(args, "queue_id")}/agents`, { userId: num(args, "user_id") });
    return unwrap(res.data);
  }
  if (name === "set_call_queue_agents") {
    const id = resolveAccountId(args, ctx);
    const res = await v1.put(`/accounts/${id}/callqueues/${str(args, "queue_id")}/agents`, { agents: (args.user_ids as number[]).map((uid) => ({ userId: uid })) });
    return unwrap(res.data);
  }

  // CALL QUEUE REPORTS
  if (name === "get_agent_activity_report") {
    const body: Args = { start_date: str(args, "start_date"), end_date: str(args, "end_date"), interval_size: strOpt(args, "interval_size") ?? "hour", timezone: strOpt(args, "timezone") ?? "US/Eastern" };
    if (args.agent_ids) body.agent_ids = args.agent_ids;
    const res = await n2p.post(`/call-queues/${str(args, "queue_id")}/agents-report`, body);
    return res.data;
  }
  if (name === "get_queue_activity_report") {
    const res = await n2p.post(`/call-queues/${str(args, "queue_id")}/queue-report`, { start_date: str(args, "start_date"), end_date: str(args, "end_date"), interval_size: strOpt(args, "interval_size") ?? "hour", iana_timezone_id: strOpt(args, "iana_timezone_id") ?? "US/Eastern" });
    return res.data;
  }

  // SCHEDULES
  if (name === "list_schedules") {
    const id = resolveAccountId(args, ctx);
    const res = await v1.get(`/accounts/${id}/schedules`, { params: { skip: 0, take: 500, order: 1 } });
    return unwrap(res.data);
  }
  if (name === "list_timezones") {
    const res = await v1.get("/timezones");
    return unwrap(res.data);
  }
  if (name === "create_schedule") {
    const id = resolveAccountId(args, ctx);
    const res = await v1.post(`/accounts/${id}/schedules`, { name: args.name, timezone: args.timezone, rules: args.rules });
    return unwrap(res.data);
  }
  if (name === "update_schedule") {
    const id = resolveAccountId(args, ctx);
    const payload: Args = {};
    if (args.name)     payload.name     = args.name;
    if (args.timezone) payload.timezone = args.timezone;
    if (args.rules)    payload.rules    = args.rules;
    const res = await v1.put(`/accounts/${id}/schedules/${num(args, "schedule_id")}`, payload);
    return unwrap(res.data);
  }
  if (name === "delete_schedule") {
    const id = resolveAccountId(args, ctx);
    await v1.delete(`/accounts/${id}/schedules/${num(args, "schedule_id")}`);
    return { success: true };
  }

  // PHONE NUMBERS
  if (name === "list_phone_numbers") {
    const id = resolveAccountId(args, ctx);
    const res = await v1.get(`/accounts/${id}/phonenumbers`);
    return unwrap(res.data);
  }
  if (name === "list_porting_requests") {
    const id = resolveAccountId(args, ctx);
    const res = await v1.get(`/accounts/${id}/porting/onboards`);
    return unwrap(res.data);
  }

  // DEVICES
  if (name === "list_devices") {
    const id = resolveAccountId(args, ctx);
    const res = await v1.get(`/accounts/${id}/devices`);
    return unwrap(res.data);
  }
  if (name === "list_device_orders") {
    const id = resolveAccountId(args, ctx);
    const res = await v1.get(`/accounts/${id}/devices/orders`);
    return unwrap(res.data);
  }
  if (name === "list_sip_registrations") {
    const id = resolveAccountId(args, ctx);
    const res = await v1.get(`/accounts/${id}/sip-registrations`);
    return unwrap(res.data);
  }
  if (name === "list_device_templates") {
    const id = resolveAccountId(args, ctx);
    const res = await v1.get(`/accounts/${id}/devices/templates`);
    return unwrap(res.data);
  }
  if (name === "reboot_device") {
    const id = resolveAccountId(args, ctx);
    const res = await v1.post(`/accounts/${id}/devices/${str(args, "device_id")}/reboot`, {});
    return unwrap(res.data);
  }

  // VIRTUAL ASSISTANT
  if (name === "list_virtual_assistants") {
    const id = resolveAccountId(args, ctx);
    const res = await v1.get(`/accounts/${id}/menus`);
    return unwrap(res.data);
  }
  if (name === "get_virtual_assistant") {
    const id = resolveAccountId(args, ctx);
    const res = await v1.get(`/accounts/${id}/menus/${str(args, "menu_id")}`);
    return unwrap(res.data);
  }
  if (name === "create_virtual_assistant") {
    const id = resolveAccountId(args, ctx);
    const res = await v1.post(`/accounts/${id}/menus`, { name: args.name, extension: args.extension });
    return unwrap(res.data);
  }
  if (name === "delete_virtual_assistant") {
    const id = resolveAccountId(args, ctx);
    await v1.delete(`/accounts/${id}/menus/${str(args, "menu_id")}`);
    return { success: true };
  }

  // SPECIAL EXTENSIONS
  if (name === "list_special_extensions") {
    const id = resolveAccountId(args, ctx);
    const res = await v1.get(`/accounts/${id}/special-extensions`);
    return unwrap(res.data);
  }
  if (name === "create_special_extension") {
    const id = resolveAccountId(args, ctx);
    const res = await v1.post(`/accounts/${id}/special-extensions`, { name: args.name, extension: args.extension, type: args.type });
    return unwrap(res.data);
  }
  if (name === "delete_special_extension") {
    const id = resolveAccountId(args, ctx);
    await v1.delete(`/accounts/${id}/special-extensions/${str(args, "ext_id")}`);
    return { success: true };
  }

  // VIRTUAL FAX
  if (name === "list_virtual_faxes") {
    const id = resolveAccountId(args, ctx);
    const res = await v1.get(`/accounts/${id}/virtualfax`);
    return unwrap(res.data);
  }

  // CALL HISTORY
  if (name === "list_call_history") {
    const id = resolveAccountId(args, ctx);
    const params: Args = { startDate: str(args, "start_date"), limit: args.limit ?? 100 };
    if (args.user_id) params.userId = args.user_id;
    const res = await v1.get(`/accounts/${id}/callHistory`, { params });
    return unwrap(res.data);
  }
  if (name === "get_recording_url") {
    const id = resolveAccountId(args, ctx);
    const res = await v1.get(`/accounts/${id}/callHistory/${str(args, "call_id")}/recording`);
    return unwrap(res.data);
  }

  // CALL BLOCKING
  if (name === "list_inbound_blocked") {
    const res = await v1.get("/callBlocking/inbound");
    return unwrap(res.data);
  }
  if (name === "list_outbound_blocked") {
    const res = await v1.get("/callBlocking/outbound");
    return unwrap(res.data);
  }
  if (name === "add_blocked_number") {
    const dir = str(args, "direction");
    const res = await v1.post(`/callBlocking/${dir}`, { phoneNumber: args.phone_number, note: args.note });
    return unwrap(res.data);
  }
  if (name === "delete_blocked_number") {
    await v1.delete(`/callBlocking/${str(args, "direction")}/${str(args, "block_id")}`);
    return { success: true };
  }

  // SIP TRUNKING
  if (name === "list_sip_trunk_accounts") {
    const res = await n2p.get("/sip-trunk-accounts");
    const d = res.data;
    return Array.isArray(d) ? d : (d as { items?: unknown[] })?.items ?? d;
  }
  if (name === "list_sip_trunks") {
    const cid = resolveSipClientId(args, ctx);
    const res = await n2p.get(`/sip-trunk-accounts/${cid}/trunks`, { params: { page_size: args.page_size ?? 100 } });
    return res.data?.items ?? res.data;
  }
  if (name === "get_sip_trunk") {
    const cid = resolveSipClientId(args, ctx);
    const res = await n2p.get(`/sip-trunk-accounts/${cid}/trunks/${str(args, "trunk_id")}`);
    return res.data;
  }
  if (name === "get_sip_limits") {
    const cid = resolveSipClientId(args, ctx);
    const res = await n2p.get(`/sip-trunk-accounts/${cid}/limits`);
    return res.data;
  }
  if (name === "list_sip_service_addresses") {
    const cid = resolveSipClientId(args, ctx);
    const res = await n2p.get(`/sip-trunk-accounts/${cid}/service-addresses`, { params: { page_size: args.page_size ?? 50, search_query: args.search_query ?? "" } });
    return res.data?.items ?? res.data;
  }
  if (name === "list_sip_phone_numbers") {
    const cid = resolveSipClientId(args, ctx);
    const res = await n2p.get(`/sip-trunk-accounts/${cid}/phone-numbers`, { params: { page_size: args.page_size ?? 100 } });
    return res.data?.items ?? res.data;
  }
  if (name === "list_sip_endpoints") {
    const cid = resolveSipClientId(args, ctx);
    const res = await n2p.get(`/sip-trunk-accounts/${cid}/endpoints`);
    return res.data;
  }
  if (name === "get_sip_notifications") {
    const cid = resolveSipClientId(args, ctx);
    const res = await n2p.get(`/sip-trunk-accounts/${cid}/notifications`);
    return res.data;
  }
  if (name === "list_sip_call_history") {
    const cid = resolveSipClientId(args, ctx);
    const body = { after: args.after ?? null, limit: args.limit ?? 25, sort: [{ by: "$.start_time", direction: strOpt(args, "sort_direction") ?? "desc" }] };
    const res = await n2p.post(`/sip-trunk-accounts/${cid}/call-detail-records:search`, body);
    return res.data;
  }
  if (name === "get_sip_registration_summary") {
    const cid = resolveSipClientId(args, ctx);
    const res = await n2p.get(`/sip-trunk-accounts/${cid}/trunks/-/registration-summary:batch-get`);
    return res.data;
  }

  // DELEGATES
  if (name === "list_delegates") {
    const id = resolveAccountId(args, ctx);
    const res = await v1.get(`/accounts/${id}/delegates`);
    return unwrap(res.data);
  }
  if (name === "add_delegate") {
    const id = resolveAccountId(args, ctx);
    const res = await v1.post(`/accounts/${id}/delegates`, { delegatorId: num(args, "delegator_id"), delegateId: num(args, "delegate_id") });
    return unwrap(res.data);
  }
  if (name === "delete_delegate") {
    const id = resolveAccountId(args, ctx);
    await v1.delete(`/accounts/${id}/delegates/${num(args, "delegate_id")}`);
    return { success: true };
  }

  // KARI'S LAW
  if (name === "list_911_contacts") {
    const id = resolveAccountId(args, ctx);
    const res = await v1.get(`/accounts/${id}/karisLaw`);
    return unwrap(res.data);
  }
  if (name === "add_911_contact") {
    const id = resolveAccountId(args, ctx);
    const res = await v1.post(`/accounts/${id}/karisLaw`, { name: args.name, phoneNumber: args.phone_number, email: args.email });
    return unwrap(res.data);
  }
  if (name === "delete_911_contact") {
    const id = resolveAccountId(args, ctx);
    await v1.delete(`/accounts/${id}/karisLaw/${str(args, "contact_id")}`);
    return { success: true };
  }

  // 10DLC
  if (name === "list_10dlc_brands") {
    const res = await v2.get("/messaging/brands");
    return res.data?.data ?? res.data?.items ?? res.data;
  }
  if (name === "list_10dlc_campaigns") {
    const res = await v2.get("/messaging/campaigns");
    return res.data?.data ?? res.data?.items ?? res.data;
  }

  // WEBHOOKS
  if (name === "list_webhooks") {
    const id = resolveAccountId(args, ctx);
    const res = await v1.get(`/accounts/${id}/users/${num(args, "user_id")}/webhooks`);
    return unwrap(res.data);
  }

  // OTHER
  if (name === "list_tie_lines") {
    const id = resolveAccountId(args, ctx);
    const res = await v1.get(`/accounts/${id}/sipTieLines`);
    return unwrap(res.data);
  }
  if (name === "list_music_options") {
    const id = resolveAccountId(args, ctx);
    const res = await v1.get(`/accounts/${id}/musicOptions`);
    return unwrap(res.data);
  }
  if (name === "list_licenses") {
    const id = resolveAccountId(args, ctx);
    const res = await v1.get(`/accounts/${id}/licenses`);
    return unwrap(res.data);
  }

  // ANALYTICS
  if (name === "get_account_analytics") {
    const id = resolveAccountId(args, ctx);
    const res = await v1.get(`/accounts/${id}/analytics`, { params: { preset: str(args, "preset") } });
    return unwrap(res.data);
  }
  if (name === "get_user_analytics") {
    const id = resolveAccountId(args, ctx);
    const res = await v1.get(`/accounts/${id}/analytics/users`, { params: { preset: str(args, "preset") } });
    return unwrap(res.data);
  }
  if (name === "get_department_analytics") {
    const id = resolveAccountId(args, ctx);
    const res = await v1.get(`/accounts/${id}/analytics/departments`, { params: { preset: str(args, "preset") } });
    return unwrap(res.data);
  }

  // VOICEMAIL
  if (name === "list_voicemails") {
    const id = resolveAccountId(args, ctx);
    const res = await v1.get(`/accounts/${id}/users/${num(args, "user_id")}/voicemails`);
    return unwrap(res.data);
  }

  // SUPPORT KNOWLEDGE (static JSON, no N2P API)
  if (name === "search_support") {
    const query = str(args, "query").toLowerCase().trim();
    if (!query) return { results: [], note: "Empty query." };
    const { readFileSync } = await import("fs");
    const { join } = await import("path");
    let articles: Array<{ title: string; url: string; summary: string; keywords?: string }>;
    try {
      const p = join(process.cwd(), "data", "support-knowledge.json");
      const raw = readFileSync(p, "utf-8");
      articles = JSON.parse(raw) as typeof articles;
    } catch {
      return { results: [], note: "Support knowledge base not available." };
    }
    const terms = query.split(/\s+/).filter(Boolean);
    const scored = articles.map((a) => {
      const text = `${a.title} ${a.summary} ${a.keywords ?? ""}`.toLowerCase();
      let score = 0;
      for (const t of terms) {
        if (text.includes(t)) score += 1;
        if (a.title.toLowerCase().includes(t)) score += 2;
      }
      return { ...a, score };
    });
    const top = scored.filter((s) => s.score > 0).sort((a, b) => b.score - a.score).slice(0, 5);
    return { results: top.map(({ title, url, summary }) => ({ title, url, summary })) };
  }

  throw new Error(`Unknown tool: ${name}`);
}

// ─── MCP wrapper (handleN2PTool) ──────────────────────────────────────────────

export async function handleN2PTool(name: string, args: Args, ctx: N2PMCPContext) {
  try {
    const data = await executeN2PTool(name, args, ctx);
    return ok(data);
  } catch (e) {
    return errResult(e);
  }
}

// ─── Server factory ───────────────────────────────────────────────────────────

/**
 * Creates a configured MCP Server instance bound to the given context.
 * Transport is wired up separately (stdio for local, HTTP for Vercel).
 */
export function createN2PMCPServer(ctx: N2PMCPContext): Server {
  const server = new Server(
    { name: "n2p-mcp", version: "1.0.0" },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: N2P_TOOLS }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args = {} } = request.params;
    try {
      return await handleN2PTool(name, args as Args, ctx);
    } catch (e) {
      return errResult(e);
    }
  });

  return server;
}
