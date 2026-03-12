#!/usr/bin/env node
/**
 * net2phone MCP Server
 *
 * Exposes all net2phone UCaaS APIs as Model Context Protocol tools.
 *
 * Environment variables:
 *   N2P_ACCESS_TOKEN   — Bearer token (required)
 *   N2P_ACCOUNT_ID     — Default account ID (required for most tools)
 *   N2P_SIP_CLIENT_ID  — Default SIP trunk account ID (required for SIP tools)
 *
 * Base URLs:
 *   V1  → https://app.net2phone.com/api
 *   V2  → https://app.net2phone.com/api/v2  (call queues CRUD, 10DLC)
 *   N2P → https://api.n2p.io/v2             (SIP trunking, call queue reports)
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from "@modelcontextprotocol/sdk/types.js";
import axios, { type AxiosInstance } from "axios";

// ─── HTTP clients ─────────────────────────────────────────────────────────────

const V1_BASE  = process.env.N2P_API_V1_URL  ?? "https://app.net2phone.com/api";
const V2_BASE  = process.env.N2P_API_V2_URL  ?? "https://app.net2phone.com/api/v2";
const N2P_BASE = process.env.N2P_API_N2P_URL ?? "https://api.n2p.io/v2";

function makeClient(baseURL: string): AxiosInstance {
  return axios.create({
    baseURL,
    headers: {
      "Content-Type": "application/json",
      "x-accept-version": "v1.1",
      "x-application-name": "Unite",
      Accept: "application/json, text/plain, */*",
    },
  });
}

const v1  = makeClient(V1_BASE);
const v2  = makeClient(V2_BASE);
const n2p = makeClient(N2P_BASE);

/** Attach current Bearer token before every request */
function getToken(): string {
  const t = process.env.N2P_ACCESS_TOKEN;
  if (!t) throw new Error("N2P_ACCESS_TOKEN is not set");
  return t;
}

function authHeader() {
  return { Authorization: `Bearer ${getToken()}` };
}

/** Default IDs from env */
function defaultAccountId(override?: number): number {
  const id = override ?? Number(process.env.N2P_ACCOUNT_ID);
  if (!id) throw new Error("account_id is required (or set N2P_ACCOUNT_ID env var)");
  return id;
}

function defaultSipClientId(override?: string | number): string | number {
  const id = override ?? process.env.N2P_SIP_CLIENT_ID;
  if (!id) throw new Error("sip_client_id is required (or set N2P_SIP_CLIENT_ID env var)");
  return id;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ok(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

function err(e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);
  // axios error details
  const axErr = e as { response?: { status?: number; data?: unknown } };
  const detail = axErr?.response?.data ? JSON.stringify(axErr.response.data) : undefined;
  return { content: [{ type: "text" as const, text: `Error: ${msg}${detail ? `\n${detail}` : ""}` }], isError: true };
}

type Args = Record<string, unknown>;

function num(a: Args, k: string): number { return Number(a[k]); }
function str(a: Args, k: string): string { return String(a[k]); }
function numOpt(a: Args, k: string): number | undefined { return a[k] !== undefined ? Number(a[k]) : undefined; }
function strOpt(a: Args, k: string): string | undefined { return a[k] !== undefined ? String(a[k]) : undefined; }

// ─── Tool definitions ─────────────────────────────────────────────────────────

const TOOLS: Tool[] = [
  // ── ACCOUNT ────────────────────────────────────────────────────────────────
  {
    name: "get_account",
    description: "Get account/company details including name, address, timezone",
    inputSchema: {
      type: "object",
      properties: { account_id: { type: "number", description: "Account ID (uses N2P_ACCOUNT_ID if omitted)" } },
    },
  },

  // ── TEAM MEMBERS ───────────────────────────────────────────────────────────
  {
    name: "list_team_members",
    description: "List all team members / users in an account",
    inputSchema: {
      type: "object",
      properties: { account_id: { type: "number" } },
    },
  },
  {
    name: "get_team_member",
    description: "Get details for a specific team member by user ID",
    inputSchema: {
      type: "object",
      required: ["user_id"],
      properties: {
        account_id: { type: "number" },
        user_id: { type: "number", description: "User ID" },
      },
    },
  },
  {
    name: "create_team_member",
    description: "Create a new team member (user)",
    inputSchema: {
      type: "object",
      required: ["first_name", "last_name", "email", "extension"],
      properties: {
        account_id: { type: "number" },
        first_name: { type: "string" },
        last_name: { type: "string" },
        email: { type: "string" },
        extension: { type: "string" },
        role_id: { type: "number" },
        dept_id: { type: "number" },
        phone_number: { type: "string" },
      },
    },
  },
  {
    name: "update_team_member",
    description: "Update a team member. Supports profile, company, voicemail, call options, and hold music.",
    inputSchema: {
      type: "object",
      required: ["user_id"],
      properties: {
        account_id: { type: "number" },
        user_id: { type: "number" },
        first_name: { type: "string" },
        last_name: { type: "string" },
        email: { type: "string" },
        extension: { type: "string" },
        role_id: { type: "number" },
        dept_id: { type: "number" },
        members: { type: "array", items: { type: "object", properties: { id: { type: "number" } } } },
        voicemail_enabled: { type: "boolean" },
        voicemail_notification: {
          type: "object",
          properties: {
            email_notify: { type: "boolean" },
            email_include_vm: { type: "boolean" },
            email_transcribe: { type: "boolean" },
            email_include_caller_details: { type: "boolean" },
          },
        },
        comp_dir_enabled: { type: "boolean" },
        is_ring_group_calls_enabled: { type: "boolean" },
        has_custom_music_on_hold: { type: "boolean" },
        sip_device_rings: { type: "number" },
        caller_id: { type: "string" },
        line_number: { type: "array", items: { type: "string" } },
      },
    },
  },
  {
    name: "delete_team_member",
    description: "Delete a team member by user ID",
    inputSchema: {
      type: "object",
      required: ["user_id"],
      properties: {
        account_id: { type: "number" },
        user_id: { type: "number" },
      },
    },
  },
  {
    name: "search_team_members",
    description: "Search team members by name, email, or extension",
    inputSchema: {
      type: "object",
      required: ["query"],
      properties: {
        account_id: { type: "number" },
        query: { type: "string", description: "Search query (name, email, or extension)" },
      },
    },
  },
  {
    name: "list_team_members_light",
    description: "List lightweight user records (id, name, extension) — good for populating dropdowns",
    inputSchema: {
      type: "object",
      properties: { account_id: { type: "number" } },
    },
  },

  // ── DEPARTMENTS ────────────────────────────────────────────────────────────
  {
    name: "list_departments",
    description: "List all departments in an account",
    inputSchema: {
      type: "object",
      properties: { account_id: { type: "number" } },
    },
  },
  {
    name: "create_department",
    description: "Create a new department",
    inputSchema: {
      type: "object",
      required: ["name"],
      properties: {
        account_id: { type: "number" },
        name: { type: "string" },
        extension: { type: "string" },
      },
    },
  },
  {
    name: "update_department",
    description: "Update a department",
    inputSchema: {
      type: "object",
      required: ["dept_id"],
      properties: {
        account_id: { type: "number" },
        dept_id: { type: "number" },
        name: { type: "string" },
        extension: { type: "string" },
      },
    },
  },
  {
    name: "delete_department",
    description: "Delete a department",
    inputSchema: {
      type: "object",
      required: ["dept_id"],
      properties: {
        account_id: { type: "number" },
        dept_id: { type: "number" },
      },
    },
  },

  // ── RING GROUPS ────────────────────────────────────────────────────────────
  {
    name: "list_ring_groups",
    description: "List all ring groups in an account",
    inputSchema: {
      type: "object",
      properties: { account_id: { type: "number" } },
    },
  },
  {
    name: "get_ring_group",
    description: "Get detail for a specific ring group",
    inputSchema: {
      type: "object",
      required: ["ring_group_id"],
      properties: {
        account_id: { type: "number" },
        ring_group_id: { type: "string" },
      },
    },
  },
  {
    name: "create_ring_group",
    description: "Create a new ring group",
    inputSchema: {
      type: "object",
      required: ["name"],
      properties: {
        account_id: { type: "number" },
        name: { type: "string" },
        extension: { type: "string" },
      },
    },
  },
  {
    name: "update_ring_group",
    description: "Update a ring group name or extension",
    inputSchema: {
      type: "object",
      required: ["ring_group_id"],
      properties: {
        account_id: { type: "number" },
        ring_group_id: { type: "string" },
        name: { type: "string" },
        extension: { type: "string" },
      },
    },
  },
  {
    name: "delete_ring_group",
    description: "Delete a ring group",
    inputSchema: {
      type: "object",
      required: ["ring_group_id"],
      properties: {
        account_id: { type: "number" },
        ring_group_id: { type: "string" },
      },
    },
  },
  {
    name: "add_user_to_ring_group",
    description: "Add a user to a ring group",
    inputSchema: {
      type: "object",
      required: ["ring_group_id", "user_id"],
      properties: {
        account_id: { type: "number" },
        ring_group_id: { type: "string" },
        user_id: { type: "number" },
      },
    },
  },
  {
    name: "set_ring_group_members",
    description: "Replace all members of a ring group with the given user IDs",
    inputSchema: {
      type: "object",
      required: ["ring_group_id", "user_ids"],
      properties: {
        account_id: { type: "number" },
        ring_group_id: { type: "string" },
        user_ids: { type: "array", items: { type: "number" } },
      },
    },
  },

  // ── CALL QUEUES ────────────────────────────────────────────────────────────
  {
    name: "list_call_queues",
    description: "List all call queues",
    inputSchema: {
      type: "object",
      properties: { limit: { type: "number", default: 100 } },
    },
  },
  {
    name: "get_call_queue",
    description: "Get details for a specific call queue",
    inputSchema: {
      type: "object",
      required: ["queue_id"],
      properties: {
        queue_id: { type: "string" },
        account_id: { type: "number" },
      },
    },
  },
  {
    name: "create_call_queue",
    description: "Create a new call queue",
    inputSchema: {
      type: "object",
      required: ["name"],
      properties: {
        account_id: { type: "number" },
        name: { type: "string" },
        extension: { type: "string" },
        strategy: { type: "string", enum: ["ring_all", "round_robin", "least_recent", "fewest_calls", "random"] },
        max_wait_time: { type: "number", description: "Max wait time in seconds" },
      },
    },
  },
  {
    name: "update_call_queue",
    description: "Update a call queue's settings",
    inputSchema: {
      type: "object",
      required: ["queue_id"],
      properties: {
        queue_id: { type: "string" },
        display_name: { type: "string" },
        max_capacity: { type: "number" },
        max_wait_time_seconds: { type: "number" },
        ring_strategy_type: { type: "string", enum: ["ring_all", "round_robin", "least_recent", "fewest_calls", "random"] },
      },
    },
  },
  {
    name: "delete_call_queue",
    description: "Delete a call queue",
    inputSchema: {
      type: "object",
      required: ["queue_id"],
      properties: {
        account_id: { type: "number" },
        queue_id: { type: "string" },
      },
    },
  },
  {
    name: "add_agent_to_call_queue",
    description: "Add a user as an agent to a call queue",
    inputSchema: {
      type: "object",
      required: ["queue_id", "user_id"],
      properties: {
        account_id: { type: "number" },
        queue_id: { type: "string" },
        user_id: { type: "number" },
      },
    },
  },
  {
    name: "set_call_queue_agents",
    description: "Replace all agents in a call queue",
    inputSchema: {
      type: "object",
      required: ["queue_id", "user_ids"],
      properties: {
        account_id: { type: "number" },
        queue_id: { type: "string" },
        user_ids: { type: "array", items: { type: "number" } },
      },
    },
  },

  // ── CALL QUEUE REPORTS ─────────────────────────────────────────────────────
  {
    name: "get_agent_activity_report",
    description: "Generate an agent activity report for a call queue. Returns time-series data per agent.",
    inputSchema: {
      type: "object",
      required: ["queue_id", "start_date", "end_date"],
      properties: {
        queue_id: { type: "string", description: "Call queue ID" },
        start_date: { type: "string", description: "ISO 8601 start date/time with timezone, e.g. 2026-03-01T00:00:00-07:00" },
        end_date: { type: "string", description: "ISO 8601 end date/time with timezone" },
        interval_size: { type: "string", enum: ["quarter_of_hour", "hour", "day"], default: "hour" },
        timezone: { type: "string", description: "IANA timezone, e.g. US/Eastern", default: "US/Eastern" },
        agent_ids: { type: "array", items: { type: "number" }, description: "Filter by specific agent user IDs (omit for all)" },
      },
    },
  },
  {
    name: "get_queue_activity_report",
    description: "Generate a queue activity report for a call queue. Returns aggregate call stats per interval.",
    inputSchema: {
      type: "object",
      required: ["queue_id", "start_date", "end_date"],
      properties: {
        queue_id: { type: "string", description: "Call queue ID" },
        start_date: { type: "string", description: "ISO 8601 start date/time with timezone" },
        end_date: { type: "string", description: "ISO 8601 end date/time with timezone" },
        interval_size: { type: "string", enum: ["quarter_of_hour", "hour", "day"], default: "hour" },
        iana_timezone_id: { type: "string", description: "IANA timezone, e.g. US/Mountain", default: "US/Eastern" },
      },
    },
  },

  // ── SCHEDULES ──────────────────────────────────────────────────────────────
  {
    name: "list_schedules",
    description: "List all schedules in an account",
    inputSchema: {
      type: "object",
      properties: { account_id: { type: "number" } },
    },
  },
  {
    name: "list_timezones",
    description: "List all available timezones",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "create_schedule",
    description: "Create a new schedule",
    inputSchema: {
      type: "object",
      required: ["name"],
      properties: {
        account_id: { type: "number" },
        name: { type: "string" },
        timezone: { type: "string", description: "Timezone abbreviation, e.g. EST" },
        rules: {
          type: "array",
          description: "Schedule rules",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              days: {
                type: "object",
                properties: {
                  weekDays: { type: "array", items: { type: "number" }, description: "1=Sun, 2=Mon, ... 7=Sat" },
                  dates: { type: "array", items: { type: "string" } },
                  isRange: { type: "boolean" },
                },
              },
              time: {
                type: "object",
                properties: {
                  start: { type: "string", description: "e.g. 09:00 AM" },
                  end: { type: "string", description: "e.g. 05:00 PM" },
                },
              },
            },
          },
        },
      },
    },
  },
  {
    name: "update_schedule",
    description: "Update an existing schedule",
    inputSchema: {
      type: "object",
      required: ["schedule_id"],
      properties: {
        account_id: { type: "number" },
        schedule_id: { type: "number" },
        name: { type: "string" },
        timezone: { type: "string" },
        rules: { type: "array" },
      },
    },
  },
  {
    name: "delete_schedule",
    description: "Delete a schedule",
    inputSchema: {
      type: "object",
      required: ["schedule_id"],
      properties: {
        account_id: { type: "number" },
        schedule_id: { type: "number" },
      },
    },
  },

  // ── PHONE NUMBERS ──────────────────────────────────────────────────────────
  {
    name: "list_phone_numbers",
    description: "List all phone numbers assigned to an account",
    inputSchema: {
      type: "object",
      properties: { account_id: { type: "number" } },
    },
  },
  {
    name: "list_porting_requests",
    description: "List number porting requests (port-ins) for an account",
    inputSchema: {
      type: "object",
      properties: { account_id: { type: "number" } },
    },
  },

  // ── DEVICES ────────────────────────────────────────────────────────────────
  {
    name: "list_devices",
    description: "List all devices for an account",
    inputSchema: {
      type: "object",
      properties: { account_id: { type: "number" } },
    },
  },
  {
    name: "list_device_orders",
    description: "List device orders for an account",
    inputSchema: {
      type: "object",
      properties: { account_id: { type: "number" } },
    },
  },
  {
    name: "list_sip_registrations",
    description: "List SIP registration status for devices",
    inputSchema: {
      type: "object",
      properties: { account_id: { type: "number" } },
    },
  },
  {
    name: "list_device_templates",
    description: "List device configuration templates",
    inputSchema: {
      type: "object",
      properties: { account_id: { type: "number" } },
    },
  },
  {
    name: "reboot_device",
    description: "Reboot a device",
    inputSchema: {
      type: "object",
      required: ["device_id"],
      properties: {
        account_id: { type: "number" },
        device_id: { type: "string" },
      },
    },
  },

  // ── VIRTUAL ASSISTANT (WELCOME MENUS) ──────────────────────────────────────
  {
    name: "list_virtual_assistants",
    description: "List all virtual assistants / welcome menus",
    inputSchema: {
      type: "object",
      properties: { account_id: { type: "number" } },
    },
  },
  {
    name: "get_virtual_assistant",
    description: "Get details for a virtual assistant / welcome menu",
    inputSchema: {
      type: "object",
      required: ["menu_id"],
      properties: {
        account_id: { type: "number" },
        menu_id: { type: "string" },
      },
    },
  },
  {
    name: "create_virtual_assistant",
    description: "Create a new virtual assistant / welcome menu",
    inputSchema: {
      type: "object",
      required: ["name"],
      properties: {
        account_id: { type: "number" },
        name: { type: "string" },
        extension: { type: "string" },
      },
    },
  },
  {
    name: "delete_virtual_assistant",
    description: "Delete a virtual assistant / welcome menu",
    inputSchema: {
      type: "object",
      required: ["menu_id"],
      properties: {
        account_id: { type: "number" },
        menu_id: { type: "string" },
      },
    },
  },

  // ── SPECIAL EXTENSIONS ─────────────────────────────────────────────────────
  {
    name: "list_special_extensions",
    description: "List all special extensions",
    inputSchema: {
      type: "object",
      properties: { account_id: { type: "number" } },
    },
  },
  {
    name: "create_special_extension",
    description: "Create a new special extension",
    inputSchema: {
      type: "object",
      required: ["name", "extension"],
      properties: {
        account_id: { type: "number" },
        name: { type: "string" },
        extension: { type: "string" },
        type: { type: "string" },
      },
    },
  },
  {
    name: "update_special_extension",
    description: "Update a special extension",
    inputSchema: {
      type: "object",
      required: ["ext_id"],
      properties: {
        account_id: { type: "number" },
        ext_id: { type: "string" },
        name: { type: "string" },
        extension: { type: "string" },
      },
    },
  },
  {
    name: "delete_special_extension",
    description: "Delete a special extension",
    inputSchema: {
      type: "object",
      required: ["ext_id"],
      properties: {
        account_id: { type: "number" },
        ext_id: { type: "string" },
      },
    },
  },

  // ── VIRTUAL FAX ────────────────────────────────────────────────────────────
  {
    name: "list_virtual_faxes",
    description: "List all virtual fax lines",
    inputSchema: {
      type: "object",
      properties: { account_id: { type: "number" } },
    },
  },
  {
    name: "create_virtual_fax",
    description: "Create a new virtual fax",
    inputSchema: {
      type: "object",
      required: ["name"],
      properties: {
        account_id: { type: "number" },
        name: { type: "string" },
        phone_number: { type: "string" },
        email: { type: "string" },
      },
    },
  },
  {
    name: "delete_virtual_fax",
    description: "Delete a virtual fax",
    inputSchema: {
      type: "object",
      required: ["fax_id"],
      properties: {
        account_id: { type: "number" },
        fax_id: { type: "string" },
      },
    },
  },

  // ── CALL HISTORY ───────────────────────────────────────────────────────────
  {
    name: "list_call_history",
    description: "List call history for an account or specific user",
    inputSchema: {
      type: "object",
      required: ["start_date"],
      properties: {
        account_id: { type: "number" },
        user_id: { type: "number", description: "Filter by user ID (omit for all)" },
        start_date: { type: "string", description: "Start date in YYYY-MM-DD format" },
        limit: { type: "number", default: 100 },
      },
    },
  },
  {
    name: "get_recording_url",
    description: "Get the audio URL for a call recording",
    inputSchema: {
      type: "object",
      required: ["call_id"],
      properties: {
        account_id: { type: "number" },
        call_id: { type: "string" },
      },
    },
  },

  // ── CALL BLOCKING ──────────────────────────────────────────────────────────
  {
    name: "list_inbound_blocked",
    description: "List inbound blocked phone numbers",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "list_outbound_blocked",
    description: "List outbound blocked phone numbers",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "add_blocked_number",
    description: "Add a phone number to the block list",
    inputSchema: {
      type: "object",
      required: ["phone_number", "direction"],
      properties: {
        phone_number: { type: "string", description: "Phone number to block, e.g. +13055551234" },
        direction: { type: "string", enum: ["inbound", "outbound"] },
        note: { type: "string" },
      },
    },
  },
  {
    name: "delete_blocked_number",
    description: "Remove a phone number from the block list",
    inputSchema: {
      type: "object",
      required: ["block_id", "direction"],
      properties: {
        block_id: { type: "string" },
        direction: { type: "string", enum: ["inbound", "outbound"] },
      },
    },
  },

  // ── SIP TRUNKING ───────────────────────────────────────────────────────────
  {
    name: "list_sip_trunks",
    description: "List SIP trunks for a trunk account",
    inputSchema: {
      type: "object",
      properties: {
        sip_client_id: { type: "string", description: "SIP trunk account ID (uses N2P_SIP_CLIENT_ID if omitted)" },
        page_size: { type: "number", default: 100 },
      },
    },
  },
  {
    name: "get_sip_trunk",
    description: "Get details for a specific SIP trunk",
    inputSchema: {
      type: "object",
      required: ["trunk_id"],
      properties: {
        sip_client_id: { type: "string" },
        trunk_id: { type: "string" },
      },
    },
  },
  {
    name: "get_sip_limits",
    description: "Get channel capacity / limits for a SIP trunk account",
    inputSchema: {
      type: "object",
      properties: {
        sip_client_id: { type: "string" },
      },
    },
  },
  {
    name: "list_sip_service_addresses",
    description: "List E911 service addresses for a SIP trunk account",
    inputSchema: {
      type: "object",
      properties: {
        sip_client_id: { type: "string" },
        page_size: { type: "number", default: 50 },
        search_query: { type: "string" },
      },
    },
  },
  {
    name: "list_sip_phone_numbers",
    description: "List phone numbers assigned to a SIP trunk account",
    inputSchema: {
      type: "object",
      properties: {
        sip_client_id: { type: "string" },
        page_size: { type: "number", default: 100 },
      },
    },
  },
  {
    name: "list_sip_endpoints",
    description: "List SIP server endpoints / connection details (host, port, protocol) for a trunk account",
    inputSchema: {
      type: "object",
      properties: {
        sip_client_id: { type: "string" },
      },
    },
  },
  {
    name: "get_sip_notifications",
    description: "Get notification settings for a SIP trunk account",
    inputSchema: {
      type: "object",
      properties: {
        sip_client_id: { type: "string" },
      },
    },
  },
  {
    name: "list_sip_call_history",
    description: "Search SIP trunk call detail records (CDR). Returns paginated call history with from/to numbers, duration, result.",
    inputSchema: {
      type: "object",
      properties: {
        sip_client_id: { type: "string" },
        limit: { type: "number", default: 25, description: "Number of records to return" },
        after: { type: "string", description: "Pagination cursor (from previous response)" },
        sort_direction: { type: "string", enum: ["asc", "desc"], default: "desc" },
        sort_by: { type: "string", default: "$.start_time" },
      },
    },
  },
  {
    name: "get_sip_registration_summary",
    description: "Get registration status summary for all SIP trunks in a trunk account",
    inputSchema: {
      type: "object",
      properties: {
        sip_client_id: { type: "string" },
      },
    },
  },

  // ── DELEGATES ──────────────────────────────────────────────────────────────
  {
    name: "list_delegates",
    description: "List delegation assignments for an account",
    inputSchema: {
      type: "object",
      properties: { account_id: { type: "number" } },
    },
  },
  {
    name: "add_delegate",
    description: "Add a delegate (user A answers calls for user B)",
    inputSchema: {
      type: "object",
      required: ["delegator_id", "delegate_id"],
      properties: {
        account_id: { type: "number" },
        delegator_id: { type: "number", description: "User who delegates their calls" },
        delegate_id: { type: "number", description: "User who will answer on behalf" },
      },
    },
  },
  {
    name: "delete_delegate",
    description: "Remove a delegate assignment",
    inputSchema: {
      type: "object",
      required: ["delegate_id"],
      properties: {
        account_id: { type: "number" },
        delegate_id: { type: "number" },
      },
    },
  },

  // ── KARI'S LAW / E911 CONTACTS ─────────────────────────────────────────────
  {
    name: "list_911_contacts",
    description: "List Kari's Law / E911 notification contacts",
    inputSchema: {
      type: "object",
      properties: { account_id: { type: "number" } },
    },
  },
  {
    name: "add_911_contact",
    description: "Add a Kari's Law / E911 notification contact",
    inputSchema: {
      type: "object",
      required: ["name", "phone_number"],
      properties: {
        account_id: { type: "number" },
        name: { type: "string" },
        phone_number: { type: "string" },
        email: { type: "string" },
      },
    },
  },
  {
    name: "delete_911_contact",
    description: "Delete a Kari's Law / E911 contact",
    inputSchema: {
      type: "object",
      required: ["contact_id"],
      properties: {
        account_id: { type: "number" },
        contact_id: { type: "string" },
      },
    },
  },

  // ── 10DLC ──────────────────────────────────────────────────────────────────
  {
    name: "list_10dlc_brands",
    description: "List 10DLC registered brands for SMS",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "list_10dlc_campaigns",
    description: "List 10DLC SMS campaigns",
    inputSchema: { type: "object", properties: {} },
  },

  // ── WEBHOOKS ───────────────────────────────────────────────────────────────
  {
    name: "list_webhooks",
    description: "List webhook subscriptions",
    inputSchema: {
      type: "object",
      required: ["user_id"],
      properties: {
        account_id: { type: "number" },
        user_id: { type: "number" },
      },
    },
  },
  {
    name: "list_webhook_event_types",
    description: "List available webhook event types",
    inputSchema: {
      type: "object",
      required: ["user_id"],
      properties: {
        account_id: { type: "number" },
        user_id: { type: "number" },
      },
    },
  },

  // ── TIE LINES ──────────────────────────────────────────────────────────────
  {
    name: "list_tie_lines",
    description: "List SIP tie lines for an account",
    inputSchema: {
      type: "object",
      properties: { account_id: { type: "number" } },
    },
  },

  // ── MUSIC ON HOLD ──────────────────────────────────────────────────────────
  {
    name: "list_music_options",
    description: "List music on hold options for an account",
    inputSchema: {
      type: "object",
      properties: { account_id: { type: "number" } },
    },
  },

  // ── LICENSES ───────────────────────────────────────────────────────────────
  {
    name: "list_licenses",
    description: "List licenses for an account (Huddle, Virtual Fax, Call Queue Agent, Ultimate, etc.)",
    inputSchema: {
      type: "object",
      properties: { account_id: { type: "number" } },
    },
  },

  // ── ANALYTICS ──────────────────────────────────────────────────────────────
  {
    name: "get_account_analytics",
    description: "Get call analytics summary for the whole account",
    inputSchema: {
      type: "object",
      required: ["preset"],
      properties: {
        account_id: { type: "number" },
        preset: { type: "string", enum: ["today", "7days", "14days", "month"], description: "Time preset" },
      },
    },
  },
  {
    name: "get_user_analytics",
    description: "Get per-user call analytics",
    inputSchema: {
      type: "object",
      required: ["preset"],
      properties: {
        account_id: { type: "number" },
        preset: { type: "string", enum: ["today", "7days", "14days", "month"] },
      },
    },
  },
  {
    name: "get_department_analytics",
    description: "Get per-department call analytics",
    inputSchema: {
      type: "object",
      required: ["preset"],
      properties: {
        account_id: { type: "number" },
        preset: { type: "string", enum: ["today", "7days", "14days", "month"] },
      },
    },
  },

  // ── VOICEMAIL ──────────────────────────────────────────────────────────────
  {
    name: "list_voicemails",
    description: "List voicemails for a user",
    inputSchema: {
      type: "object",
      required: ["user_id"],
      properties: {
        account_id: { type: "number" },
        user_id: { type: "number" },
      },
    },
  },

  // ── BULK OPERATIONS ────────────────────────────────────────────────────────
  {
    name: "list_bulk_operations",
    description: "List bulk load / bulk provisioning operations",
    inputSchema: {
      type: "object",
      properties: { account_id: { type: "number" } },
    },
  },
];

// ─── Tool handlers ────────────────────────────────────────────────────────────

async function handleTool(name: string, args: Args): Promise<ReturnType<typeof ok>> {
  const h = authHeader();

  // ACCOUNT
  if (name === "get_account") {
    const id = defaultAccountId(numOpt(args, "account_id"));
    const res = await v1.get(`/accounts/${id}`, { headers: h });
    return ok(res.data?.data ?? res.data);
  }

  // TEAM MEMBERS
  if (name === "list_team_members") {
    const id = defaultAccountId(numOpt(args, "account_id"));
    const res = await v1.get(`/accounts/${id}/users`, { headers: h, params: { includeLineNumbersFlag: "Y", includeDepartmentUser: true } });
    return ok(res.data?.data ?? res.data);
  }
  if (name === "get_team_member") {
    const id = defaultAccountId(numOpt(args, "account_id"));
    const res = await v1.get(`/accounts/${id}/users/${num(args, "user_id")}`, { headers: h });
    return ok(res.data?.data ?? res.data);
  }
  if (name === "create_team_member") {
    const id = defaultAccountId(numOpt(args, "account_id"));
    const payload = { firstName: args.first_name, lastName: args.last_name, email: args.email, extension: args.extension, roleId: args.role_id, deptId: args.dept_id, phoneNumber: args.phone_number };
    const res = await v1.post(`/accounts/${id}/users`, payload, { headers: h });
    return ok(res.data?.data ?? res.data);
  }
  if (name === "update_team_member") {
    const id = defaultAccountId(numOpt(args, "account_id"));
    const payload: Record<string, unknown> = {};
    if (args.first_name !== undefined) payload.firstName = args.first_name;
    if (args.last_name !== undefined) payload.lastName = args.last_name;
    if (args.email !== undefined) payload.email = args.email;
    if (args.extension !== undefined) payload.extension = args.extension;
    if (args.role_id !== undefined) payload.roleId = args.role_id;
    if (args.dept_id !== undefined) payload.deptId = args.dept_id;
    if (args.voicemail_enabled !== undefined) payload.voicemailEnabled = args.voicemail_enabled;
    if (args.voicemail_notification !== undefined) {
      const vn = args.voicemail_notification as Record<string, boolean>;
      payload.voicemailNotification = {
        emailNotify: vn.email_notify,
        emailIncludeVM: vn.email_include_vm,
        emailTranscribe: vn.email_transcribe,
        emailIncludeCallerDetails: vn.email_include_caller_details,
      };
    }
    if (args.comp_dir_enabled !== undefined) payload.compDir = { enabled: args.comp_dir_enabled };
    if (args.is_ring_group_calls_enabled !== undefined) payload.isRingGroupCallsEnabled = args.is_ring_group_calls_enabled;
    if (args.has_custom_music_on_hold !== undefined) payload.hasCustomMusicOnHold = args.has_custom_music_on_hold;
    if (args.sip_device_rings !== undefined) payload.sipDeviceRings = args.sip_device_rings;
    if (args.caller_id !== undefined) payload.callerId = args.caller_id;
    if (args.line_number !== undefined) payload.lineNumber = args.line_number;
    if (args.members !== undefined) payload.members = (args.members as Array<{ id: number }>).map((m) => ({ id: m.id }));
    const res = await v1.put(`/accounts/${id}/users/${num(args, "user_id")}`, payload, { headers: h });
    return ok(res.data?.data ?? res.data);
  }
  if (name === "delete_team_member") {
    const id = defaultAccountId(numOpt(args, "account_id"));
    await v1.delete(`/accounts/${id}/users/${num(args, "user_id")}`, { headers: h });
    return ok({ success: true });
  }
  if (name === "search_team_members") {
    const id = defaultAccountId(numOpt(args, "account_id"));
    const res = await v1.get(`/accounts/${id}/users`, { headers: h, params: { includeLineNumbersFlag: "Y", includeDepartmentUser: true } });
    const all = res.data?.data ?? [];
    const q = str(args, "query").toLowerCase();
    const filtered = Array.isArray(all) ? all.filter((u: Record<string, string>) =>
      (u.firstName ?? "").toLowerCase().includes(q) ||
      (u.lastName ?? "").toLowerCase().includes(q) ||
      `${u.firstName} ${u.lastName}`.toLowerCase().includes(q) ||
      (u.email ?? "").toLowerCase().includes(q) ||
      (u.extension ?? "").includes(q)
    ) : [];
    return ok(filtered);
  }
  if (name === "list_team_members_light") {
    const id = defaultAccountId(numOpt(args, "account_id"));
    const res = await v1.get(`/accounts/${id}/users/light`, { headers: h, params: { skip: 0, take: 500 } });
    return ok(res.data?.data?.items ?? res.data);
  }

  // DEPARTMENTS
  if (name === "list_departments") {
    const id = defaultAccountId(numOpt(args, "account_id"));
    const res = await v1.get(`/accounts/${id}/departments`, { headers: h });
    return ok(res.data?.data ?? res.data);
  }
  if (name === "create_department") {
    const id = defaultAccountId(numOpt(args, "account_id"));
    const res = await v1.post(`/accounts/${id}/departments`, { name: args.name, extension: args.extension }, { headers: h });
    return ok(res.data?.data ?? res.data);
  }
  if (name === "update_department") {
    const id = defaultAccountId(numOpt(args, "account_id"));
    const payload: Record<string, unknown> = {};
    if (args.name) payload.name = args.name;
    if (args.extension) payload.extension = args.extension;
    const res = await v1.put(`/accounts/${id}/departments/${num(args, "dept_id")}`, payload, { headers: h });
    return ok(res.data?.data ?? res.data);
  }
  if (name === "delete_department") {
    const id = defaultAccountId(numOpt(args, "account_id"));
    await v1.delete(`/accounts/${id}/departments/${num(args, "dept_id")}`, { headers: h });
    return ok({ success: true });
  }

  // RING GROUPS
  if (name === "list_ring_groups") {
    const id = defaultAccountId(numOpt(args, "account_id"));
    const res = await v1.get(`/account/${id}/ringGroups`, { headers: h });
    return ok(res.data?.data ?? res.data);
  }
  if (name === "get_ring_group") {
    const id = defaultAccountId(numOpt(args, "account_id"));
    const res = await v1.get(`/account/${id}/ringGroups/${str(args, "ring_group_id")}`, { headers: h });
    return ok(res.data?.data ?? res.data);
  }
  if (name === "create_ring_group") {
    const id = defaultAccountId(numOpt(args, "account_id"));
    const res = await v1.post(`/account/${id}/ringGroups`, { name: args.name, extension: args.extension }, { headers: h });
    return ok(res.data?.data ?? res.data);
  }
  if (name === "update_ring_group") {
    const id = defaultAccountId(numOpt(args, "account_id"));
    const rgId = str(args, "ring_group_id");
    const current = await v1.get(`/account/${id}/ringGroups/${rgId}`, { headers: h });
    const merged = { ...current.data?.data, ...(args.name ? { name: args.name } : {}), ...(args.extension ? { extension: args.extension } : {}) };
    const res = await v1.put(`/account/${id}/ringGroups/${rgId}`, merged, { headers: h });
    return ok(res.data?.data ?? res.data);
  }
  if (name === "delete_ring_group") {
    const id = defaultAccountId(numOpt(args, "account_id"));
    await v1.delete(`/account/${id}/ringGroups/${str(args, "ring_group_id")}`, { headers: h });
    return ok({ success: true });
  }
  if (name === "add_user_to_ring_group") {
    const id = defaultAccountId(numOpt(args, "account_id"));
    const rgId = str(args, "ring_group_id");
    const current = await v1.get(`/account/${id}/ringGroups/${rgId}`, { headers: h });
    const rg = current.data?.data ?? {};
    const lines: Array<{ lineId: string; status: string }> = Array.isArray(rg.lines) ? rg.lines : [];
    const lineId = String(num(args, "user_id"));
    if (!lines.some((l) => l.lineId === lineId)) {
      lines.push({ lineId, status: "active" });
    }
    const res = await v1.put(`/account/${id}/ringGroups/${rgId}`, { ...rg, lines }, { headers: h });
    return ok(res.data?.data ?? res.data);
  }
  if (name === "set_ring_group_members") {
    const id = defaultAccountId(numOpt(args, "account_id"));
    const rgId = str(args, "ring_group_id");
    const current = await v1.get(`/account/${id}/ringGroups/${rgId}`, { headers: h });
    const rg = current.data?.data ?? {};
    const lines = (args.user_ids as number[]).map((uid) => ({ lineId: String(uid), status: "active" }));
    const res = await v1.put(`/account/${id}/ringGroups/${rgId}`, { ...rg, lines }, { headers: h });
    return ok(res.data?.data ?? res.data);
  }

  // CALL QUEUES
  if (name === "list_call_queues") {
    const res = await v2.get("/call-queues", { headers: h, params: { limit: num(args, "limit") || 100 } });
    return ok(res.data?.items ?? res.data);
  }
  if (name === "get_call_queue") {
    const res = await v2.get(`/call-queues/${str(args, "queue_id")}`, { headers: h });
    return ok(res.data);
  }
  if (name === "create_call_queue") {
    const id = defaultAccountId(numOpt(args, "account_id"));
    const res = await v1.post(`/accounts/${id}/callqueues`, { name: args.name, extension: args.extension, strategy: args.strategy, max_wait_time: args.max_wait_time }, { headers: h });
    return ok(res.data?.data ?? res.data);
  }
  if (name === "update_call_queue") {
    const payload: Record<string, unknown> = {};
    if (args.display_name) payload.display_name = args.display_name;
    if (args.max_capacity !== undefined) payload.max_capacity = args.max_capacity;
    if (args.max_wait_time_seconds !== undefined) payload.max_wait_time_seconds = args.max_wait_time_seconds;
    if (args.ring_strategy_type) payload.ring_strategy = { type: args.ring_strategy_type };
    const res = await v2.patch(`/call-queues/${str(args, "queue_id")}`, payload, { headers: h });
    return ok(res.data);
  }
  if (name === "delete_call_queue") {
    const id = defaultAccountId(numOpt(args, "account_id"));
    await v1.delete(`/accounts/${id}/callqueues/${str(args, "queue_id")}`, { headers: h });
    return ok({ success: true });
  }
  if (name === "add_agent_to_call_queue") {
    const id = defaultAccountId(numOpt(args, "account_id"));
    const res = await v1.post(`/accounts/${id}/callqueues/${str(args, "queue_id")}/agents`, { userId: num(args, "user_id") }, { headers: h });
    return ok(res.data?.data ?? res.data);
  }
  if (name === "set_call_queue_agents") {
    const id = defaultAccountId(numOpt(args, "account_id"));
    const agents = (args.user_ids as number[]).map((uid) => ({ userId: uid }));
    const res = await v1.put(`/accounts/${id}/callqueues/${str(args, "queue_id")}/agents`, { agents }, { headers: h });
    return ok(res.data?.data ?? res.data);
  }

  // CALL QUEUE REPORTS
  if (name === "get_agent_activity_report") {
    const body: Record<string, unknown> = {
      start_date: str(args, "start_date"),
      end_date: str(args, "end_date"),
      interval_size: strOpt(args, "interval_size") ?? "hour",
      timezone: strOpt(args, "timezone") ?? "US/Eastern",
    };
    if (args.agent_ids) body.agent_ids = args.agent_ids;
    const res = await n2p.post(`/call-queues/${str(args, "queue_id")}/agents-report`, body, { headers: h });
    return ok(res.data);
  }
  if (name === "get_queue_activity_report") {
    const body = {
      start_date: str(args, "start_date"),
      end_date: str(args, "end_date"),
      interval_size: strOpt(args, "interval_size") ?? "hour",
      iana_timezone_id: strOpt(args, "iana_timezone_id") ?? "US/Eastern",
    };
    const res = await n2p.post(`/call-queues/${str(args, "queue_id")}/queue-report`, body, { headers: h });
    return ok(res.data);
  }

  // SCHEDULES
  if (name === "list_schedules") {
    const id = defaultAccountId(numOpt(args, "account_id"));
    const res = await v1.get(`/accounts/${id}/schedules`, { headers: h, params: { skip: 0, take: 500, order: 1 } });
    return ok(res.data?.data ?? res.data);
  }
  if (name === "list_timezones") {
    const res = await v1.get("/timezones", { headers: h });
    return ok(res.data?.data ?? res.data);
  }
  if (name === "create_schedule") {
    const id = defaultAccountId(numOpt(args, "account_id"));
    const res = await v1.post(`/accounts/${id}/schedules`, { name: args.name, timezone: args.timezone, rules: args.rules }, { headers: h });
    return ok(res.data?.data ?? res.data);
  }
  if (name === "update_schedule") {
    const id = defaultAccountId(numOpt(args, "account_id"));
    const payload: Record<string, unknown> = {};
    if (args.name) payload.name = args.name;
    if (args.timezone) payload.timezone = args.timezone;
    if (args.rules) payload.rules = args.rules;
    const res = await v1.put(`/accounts/${id}/schedules/${num(args, "schedule_id")}`, payload, { headers: h });
    return ok(res.data?.data ?? res.data);
  }
  if (name === "delete_schedule") {
    const id = defaultAccountId(numOpt(args, "account_id"));
    await v1.delete(`/accounts/${id}/schedules/${num(args, "schedule_id")}`, { headers: h });
    return ok({ success: true });
  }

  // PHONE NUMBERS
  if (name === "list_phone_numbers") {
    const id = defaultAccountId(numOpt(args, "account_id"));
    const res = await v1.get(`/accounts/${id}/phonenumbers`, { headers: h });
    return ok(res.data?.data ?? res.data);
  }
  if (name === "list_porting_requests") {
    const id = defaultAccountId(numOpt(args, "account_id"));
    const res = await v1.get(`/accounts/${id}/porting/onboards`, { headers: h });
    return ok(res.data?.data ?? res.data);
  }

  // DEVICES
  if (name === "list_devices") {
    const id = defaultAccountId(numOpt(args, "account_id"));
    const res = await v1.get(`/accounts/${id}/devices`, { headers: h });
    return ok(res.data?.data ?? res.data);
  }
  if (name === "list_device_orders") {
    const id = defaultAccountId(numOpt(args, "account_id"));
    const res = await v1.get(`/accounts/${id}/devices/orders`, { headers: h });
    return ok(res.data?.data ?? res.data);
  }
  if (name === "list_sip_registrations") {
    const id = defaultAccountId(numOpt(args, "account_id"));
    const res = await v1.get(`/accounts/${id}/sip-registrations`, { headers: h });
    return ok(res.data?.data ?? res.data);
  }
  if (name === "list_device_templates") {
    const id = defaultAccountId(numOpt(args, "account_id"));
    const res = await v1.get(`/accounts/${id}/devices/templates`, { headers: h });
    return ok(res.data?.data ?? res.data);
  }
  if (name === "reboot_device") {
    const id = defaultAccountId(numOpt(args, "account_id"));
    const res = await v1.post(`/accounts/${id}/devices/${str(args, "device_id")}/reboot`, {}, { headers: h });
    return ok(res.data?.data ?? res.data);
  }

  // VIRTUAL ASSISTANT
  if (name === "list_virtual_assistants") {
    const id = defaultAccountId(numOpt(args, "account_id"));
    const res = await v1.get(`/accounts/${id}/menus`, { headers: h });
    return ok(res.data?.data ?? res.data);
  }
  if (name === "get_virtual_assistant") {
    const id = defaultAccountId(numOpt(args, "account_id"));
    const res = await v1.get(`/accounts/${id}/menus/${str(args, "menu_id")}`, { headers: h });
    return ok(res.data?.data ?? res.data);
  }
  if (name === "create_virtual_assistant") {
    const id = defaultAccountId(numOpt(args, "account_id"));
    const res = await v1.post(`/accounts/${id}/menus`, { name: args.name, extension: args.extension }, { headers: h });
    return ok(res.data?.data ?? res.data);
  }
  if (name === "delete_virtual_assistant") {
    const id = defaultAccountId(numOpt(args, "account_id"));
    await v1.delete(`/accounts/${id}/menus/${str(args, "menu_id")}`, { headers: h });
    return ok({ success: true });
  }

  // SPECIAL EXTENSIONS
  if (name === "list_special_extensions") {
    const id = defaultAccountId(numOpt(args, "account_id"));
    const res = await v1.get(`/accounts/${id}/special-extensions`, { headers: h });
    return ok(res.data?.data ?? res.data);
  }
  if (name === "create_special_extension") {
    const id = defaultAccountId(numOpt(args, "account_id"));
    const res = await v1.post(`/accounts/${id}/special-extensions`, { name: args.name, extension: args.extension, type: args.type }, { headers: h });
    return ok(res.data?.data ?? res.data);
  }
  if (name === "update_special_extension") {
    const id = defaultAccountId(numOpt(args, "account_id"));
    const payload: Record<string, unknown> = {};
    if (args.name) payload.name = args.name;
    if (args.extension) payload.extension = args.extension;
    const res = await v1.put(`/accounts/${id}/special-extensions/${str(args, "ext_id")}`, payload, { headers: h });
    return ok(res.data?.data ?? res.data);
  }
  if (name === "delete_special_extension") {
    const id = defaultAccountId(numOpt(args, "account_id"));
    await v1.delete(`/accounts/${id}/special-extensions/${str(args, "ext_id")}`, { headers: h });
    return ok({ success: true });
  }

  // VIRTUAL FAX
  if (name === "list_virtual_faxes") {
    const id = defaultAccountId(numOpt(args, "account_id"));
    const res = await v1.get(`/accounts/${id}/virtualfax`, { headers: h });
    return ok(res.data?.data ?? res.data);
  }
  if (name === "create_virtual_fax") {
    const id = defaultAccountId(numOpt(args, "account_id"));
    const res = await v1.post(`/accounts/${id}/virtualfax`, { name: args.name, phoneNumber: args.phone_number, email: args.email }, { headers: h });
    return ok(res.data?.data ?? res.data);
  }
  if (name === "delete_virtual_fax") {
    const id = defaultAccountId(numOpt(args, "account_id"));
    await v1.delete(`/accounts/${id}/virtualfax/${str(args, "fax_id")}`, { headers: h });
    return ok({ success: true });
  }

  // CALL HISTORY
  if (name === "list_call_history") {
    const id = defaultAccountId(numOpt(args, "account_id"));
    const userId = numOpt(args, "user_id");
    const params: Record<string, unknown> = { startDate: str(args, "start_date"), limit: args.limit ?? 100 };
    if (userId) params.userId = userId;
    const res = await v1.get(`/accounts/${id}/callHistory`, { headers: h, params });
    return ok(res.data?.data ?? res.data);
  }
  if (name === "get_recording_url") {
    const id = defaultAccountId(numOpt(args, "account_id"));
    const res = await v1.get(`/accounts/${id}/callHistory/${str(args, "call_id")}/recording`, { headers: h });
    return ok(res.data?.data ?? res.data);
  }

  // CALL BLOCKING
  if (name === "list_inbound_blocked") {
    const res = await v1.get("/callBlocking/inbound", { headers: h });
    return ok(res.data?.data ?? res.data);
  }
  if (name === "list_outbound_blocked") {
    const res = await v1.get("/callBlocking/outbound", { headers: h });
    return ok(res.data?.data ?? res.data);
  }
  if (name === "add_blocked_number") {
    const dir = str(args, "direction");
    const res = await v1.post(`/callBlocking/${dir}`, { phoneNumber: args.phone_number, note: args.note }, { headers: h });
    return ok(res.data?.data ?? res.data);
  }
  if (name === "delete_blocked_number") {
    const dir = str(args, "direction");
    await v1.delete(`/callBlocking/${dir}/${str(args, "block_id")}`, { headers: h });
    return ok({ success: true });
  }

  // SIP TRUNKING
  if (name === "list_sip_trunks") {
    const cid = defaultSipClientId(strOpt(args, "sip_client_id"));
    const res = await n2p.get(`/sip-trunk-accounts/${cid}/trunks`, { headers: h, params: { page_size: args.page_size ?? 100 } });
    return ok(res.data?.items ?? res.data);
  }
  if (name === "get_sip_trunk") {
    const cid = defaultSipClientId(strOpt(args, "sip_client_id"));
    const res = await n2p.get(`/sip-trunk-accounts/${cid}/trunks/${str(args, "trunk_id")}`, { headers: h });
    return ok(res.data);
  }
  if (name === "get_sip_limits") {
    const cid = defaultSipClientId(strOpt(args, "sip_client_id"));
    const res = await n2p.get(`/sip-trunk-accounts/${cid}/limits`, { headers: h });
    return ok(res.data);
  }
  if (name === "list_sip_service_addresses") {
    const cid = defaultSipClientId(strOpt(args, "sip_client_id"));
    const res = await n2p.get(`/sip-trunk-accounts/${cid}/service-addresses`, { headers: h, params: { page_size: args.page_size ?? 50, search_query: args.search_query ?? "" } });
    return ok(res.data?.items ?? res.data);
  }
  if (name === "list_sip_phone_numbers") {
    const cid = defaultSipClientId(strOpt(args, "sip_client_id"));
    const res = await n2p.get(`/sip-trunk-accounts/${cid}/phone-numbers`, { headers: h, params: { page_size: args.page_size ?? 100 } });
    return ok(res.data?.items ?? res.data);
  }
  if (name === "list_sip_endpoints") {
    const cid = defaultSipClientId(strOpt(args, "sip_client_id"));
    const res = await n2p.get(`/sip-trunk-accounts/${cid}/endpoints`, { headers: h });
    return ok(res.data);
  }
  if (name === "get_sip_notifications") {
    const cid = defaultSipClientId(strOpt(args, "sip_client_id"));
    const res = await n2p.get(`/sip-trunk-accounts/${cid}/notifications`, { headers: h });
    return ok(res.data);
  }
  if (name === "list_sip_call_history") {
    const cid = defaultSipClientId(strOpt(args, "sip_client_id"));
    const body = {
      after: args.after ?? null,
      limit: args.limit ?? 25,
      sort: [{ by: strOpt(args, "sort_by") ?? "$.start_time", direction: strOpt(args, "sort_direction") ?? "desc" }],
    };
    const res = await n2p.post(`/sip-trunk-accounts/${cid}/call-detail-records:search`, body, { headers: h });
    return ok(res.data);
  }
  if (name === "get_sip_registration_summary") {
    const cid = defaultSipClientId(strOpt(args, "sip_client_id"));
    const res = await n2p.get(`/sip-trunk-accounts/${cid}/trunks/-/registration-summary:batch-get`, { headers: h });
    return ok(res.data);
  }

  // DELEGATES
  if (name === "list_delegates") {
    const id = defaultAccountId(numOpt(args, "account_id"));
    const res = await v1.get(`/accounts/${id}/delegates`, { headers: h });
    return ok(res.data?.data ?? res.data);
  }
  if (name === "add_delegate") {
    const id = defaultAccountId(numOpt(args, "account_id"));
    const res = await v1.post(`/accounts/${id}/delegates`, { delegatorId: num(args, "delegator_id"), delegateId: num(args, "delegate_id") }, { headers: h });
    return ok(res.data?.data ?? res.data);
  }
  if (name === "delete_delegate") {
    const id = defaultAccountId(numOpt(args, "account_id"));
    await v1.delete(`/accounts/${id}/delegates/${num(args, "delegate_id")}`, { headers: h });
    return ok({ success: true });
  }

  // KARI'S LAW
  if (name === "list_911_contacts") {
    const id = defaultAccountId(numOpt(args, "account_id"));
    const res = await v1.get(`/accounts/${id}/karisLaw`, { headers: h });
    return ok(res.data?.data ?? res.data);
  }
  if (name === "add_911_contact") {
    const id = defaultAccountId(numOpt(args, "account_id"));
    const res = await v1.post(`/accounts/${id}/karisLaw`, { name: args.name, phoneNumber: args.phone_number, email: args.email }, { headers: h });
    return ok(res.data?.data ?? res.data);
  }
  if (name === "delete_911_contact") {
    const id = defaultAccountId(numOpt(args, "account_id"));
    await v1.delete(`/accounts/${id}/karisLaw/${str(args, "contact_id")}`, { headers: h });
    return ok({ success: true });
  }

  // 10DLC
  if (name === "list_10dlc_brands") {
    const res = await v2.get("/messaging/brands", { headers: h });
    return ok(res.data?.data ?? res.data?.items ?? res.data);
  }
  if (name === "list_10dlc_campaigns") {
    const res = await v2.get("/messaging/campaigns", { headers: h });
    return ok(res.data?.data ?? res.data?.items ?? res.data);
  }

  // WEBHOOKS
  if (name === "list_webhooks") {
    const id = defaultAccountId(numOpt(args, "account_id"));
    const uid = num(args, "user_id");
    const res = await v1.get(`/accounts/${id}/users/${uid}/webhooks`, { headers: h });
    return ok(res.data?.data ?? res.data);
  }
  if (name === "list_webhook_event_types") {
    const id = defaultAccountId(numOpt(args, "account_id"));
    const uid = num(args, "user_id");
    const res = await v1.get(`/accounts/${id}/users/${uid}/webhooks/eventTypes`, { headers: h });
    return ok(res.data?.data ?? res.data);
  }

  // TIE LINES
  if (name === "list_tie_lines") {
    const id = defaultAccountId(numOpt(args, "account_id"));
    const res = await v1.get(`/accounts/${id}/sipTieLines`, { headers: h });
    return ok(res.data?.data ?? res.data);
  }

  // MUSIC ON HOLD
  if (name === "list_music_options") {
    const id = defaultAccountId(numOpt(args, "account_id"));
    const res = await v1.get(`/accounts/${id}/musicOptions`, { headers: h });
    return ok(res.data?.data ?? res.data);
  }

  // LICENSES
  if (name === "list_licenses") {
    const id = defaultAccountId(numOpt(args, "account_id"));
    const res = await v1.get(`/accounts/${id}/licenses`, { headers: h });
    return ok(res.data?.data ?? res.data);
  }

  // ANALYTICS
  if (name === "get_account_analytics") {
    const id = defaultAccountId(numOpt(args, "account_id"));
    const res = await v1.get(`/accounts/${id}/analytics`, { headers: h, params: { preset: str(args, "preset") } });
    return ok(res.data?.data ?? res.data);
  }
  if (name === "get_user_analytics") {
    const id = defaultAccountId(numOpt(args, "account_id"));
    const res = await v1.get(`/accounts/${id}/analytics/users`, { headers: h, params: { preset: str(args, "preset") } });
    return ok(res.data?.data ?? res.data);
  }
  if (name === "get_department_analytics") {
    const id = defaultAccountId(numOpt(args, "account_id"));
    const res = await v1.get(`/accounts/${id}/analytics/departments`, { headers: h, params: { preset: str(args, "preset") } });
    return ok(res.data?.data ?? res.data);
  }

  // VOICEMAIL
  if (name === "list_voicemails") {
    const id = defaultAccountId(numOpt(args, "account_id"));
    const res = await v1.get(`/accounts/${id}/users/${num(args, "user_id")}/voicemails`, { headers: h });
    return ok(res.data?.data ?? res.data);
  }

  // BULK OPERATIONS
  if (name === "list_bulk_operations") {
    const id = defaultAccountId(numOpt(args, "account_id"));
    const res = await v1.get(`/accounts/${id}/bulkLoad`, { headers: h });
    return ok(res.data?.data ?? res.data);
  }

  throw new Error(`Unknown tool: ${name}`);
}

// ─── MCP Server setup ─────────────────────────────────────────────────────────

const server = new Server(
  {
    name: "n2p-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS,
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;
  try {
    return await handleTool(name, args as Args);
  } catch (e) {
    return err(e);
  }
});

// ─── Start ────────────────────────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
