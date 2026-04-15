/**
 * Maps Anthropic tool names + camelCase input to MCP tool names + snake_case args.
 * Used by app/api/n2p-tools to translate onboarding-agent tool calls.
 */

function daysToPreset(days: number): "today" | "7days" | "14days" | "month" {
  if (days <= 1) return "today";
  if (days <= 7) return "7days";
  if (days <= 14) return "14days";
  return "month";
}

function camelToSnake(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    const snake = k.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
    out[snake] = v;
  }
  return out;
}

export interface AdaptResult {
  tool: string;
  args: Record<string, unknown>;
  /** If true, adapter handles create_user + assign_phone as a composite (two MCP calls) */
  composite?: "create_user_with_phone";
}

/**
 * Map Anthropic tool name + input to MCP tool name + snake_case args.
 * Returns { tool, args } or { composite: "create_user_with_phone" } for special handling.
 */
export function adaptForMCP(
  anthropicTool: string,
  input: Record<string, unknown>,
  ctx: { accountId?: number; clientId?: number; sipClientId?: string }
): AdaptResult {
  const aid = ctx.accountId;
  const base = aid !== undefined ? { account_id: aid } : {};

  switch (anthropicTool) {
    case "get_account_summary":
      return { tool: "get_account_summary", args: { ...base } };

    case "get_next_extension":
      return { tool: "get_next_user_extension", args: { ...base } };

    case "get_available_numbers": {
      const args: Record<string, unknown> = { ...base };
      if (input.limit !== undefined) args.limit = input.limit;
      if (ctx.clientId !== undefined) args.client_id = ctx.clientId;
      return { tool: "get_available_phone_numbers", args };
    }

    case "search_users":
      return {
        tool: "search_team_members",
        args: { ...base, query: input.query },
      };

    case "create_user": {
      if (input.phoneNumber) {
        return {
          composite: "create_user_with_phone",
          tool: "create_team_member",
          args: {
            ...base,
            first_name: input.firstName,
            last_name: input.lastName,
            email: input.email,
            extension: input.extension,
            role_id: input.role === "admin" ? 2 : 1,
          },
        };
      }
      return {
        tool: "create_team_member",
        args: {
          ...base,
          first_name: input.firstName,
          last_name: input.lastName,
          email: input.email,
          extension: input.extension,
          role_id: input.role === "admin" ? 2 : 1,
        },
      };
    }

    case "list_ring_groups":
      return { tool: "list_ring_groups", args: { ...base } };

    case "get_ring_group":
      return {
        tool: "get_ring_group",
        args: { ...base, ring_group_id: input.ringGroupId },
      };

    case "add_user_to_ring_group":
      return {
        tool: "add_user_to_ring_group",
        args: {
          ...base,
          ring_group_id: input.ringGroupId,
          user_id: input.userId,
        },
      };

    case "list_call_queues":
      return { tool: "list_call_queues", args: { ...base } };

    case "add_user_to_call_queue":
      return {
        tool: "add_agent_to_call_queue",
        args: {
          ...base,
          queue_id: input.queueId,
          user_id: input.userId,
        },
      };

    case "list_departments":
      return { tool: "list_departments", args: { ...base } };

    case "assign_user_to_department":
      return {
        tool: "update_team_member",
        args: {
          ...base,
          user_id: input.userId,
          dept_id: input.deptId,
        },
      };

    case "get_user_call_stats": {
      const days = (input.days as number) ?? 30;
      return {
        tool: "get_user_analytics",
        args: {
          ...base,
          user_id: input.userId,
          preset: daysToPreset(days),
        },
      };
    }

    case "get_account_call_stats": {
      const days = (input.days as number) ?? 30;
      return {
        tool: "get_account_analytics",
        args: { ...base, preset: daysToPreset(days) },
      };
    }

    case "create_ring_group":
      return { tool: "create_ring_group", args: { ...base, name: input.name } };

    case "set_ring_group_members":
      return {
        tool: "set_ring_group_members",
        args: { ...base, ring_group_id: input.ringGroupId, user_ids: input.userIds },
      };

    case "set_ring_group_tiers":
      return {
        tool: "set_ring_group_tiers",
        args: { ...base, ring_group_id: input.ringGroupId, tiers: input.tiers },
      };

    case "create_call_queue":
      return { tool: "create_call_queue", args: { ...base, name: input.name } };

    case "set_call_queue_agents":
      return {
        tool: "set_call_queue_agents",
        args: { ...base, queue_id: input.queueId, user_ids: input.userIds },
      };

    case "update_call_queue": {
      const qArgs: Record<string, unknown> = { ...base, queue_id: input.queueId };
      if (input.ring_strategy_type) qArgs.ring_strategy_type = input.ring_strategy_type;
      if (input.max_wait_time_seconds !== undefined) qArgs.max_wait_time_seconds = input.max_wait_time_seconds;
      if (input.max_capacity !== undefined) qArgs.max_capacity = input.max_capacity;
      return { tool: "update_call_queue", args: qArgs };
    }

    case "create_department":
      return { tool: "create_department", args: { ...base, name: input.name } };

    case "list_virtual_assistants":
      return { tool: "list_virtual_assistants", args: { ...base } };

    case "create_virtual_assistant":
      return { tool: "create_virtual_assistant", args: { ...base, name: input.name } };

    case "update_virtual_assistant":
      return {
        tool: "update_virtual_assistant",
        args: {
          ...base,
          menu_id: input.menuId || input.virtualAssistantId,
          ...(input.name ? { name: input.name } : {}),
          ...(input.settings ? { settings: input.settings } : {}),
        },
      };

    case "generate_tts_greeting":
      return {
        tool: "generate_tts_greeting",
        args: { ...base, virtual_assistant_id: input.virtualAssistantId, text: input.text },
      };

    case "set_menu_options":
      return {
        tool: "set_menu_options",
        args: { ...base, virtual_assistant_id: input.virtualAssistantId, options: input.options },
      };

    case "list_licenses":
      return { tool: "list_licenses", args: { ...base } };

    case "search_support":
      return { tool: "search_support", args: { query: input.query } };

    case "create_schedule": {
      const args: Record<string, unknown> = { ...base, name: input.name };
      if (input.timezone) args.timezone = input.timezone;
      if (input.rules) args.rules = input.rules;
      return { tool: "create_schedule", args };
    }

    case "build_call_flow": {
      const args: Record<string, unknown> = { ...base };
      if (input.mainNumber !== undefined) args.main_number = input.mainNumber;
      if (input.workHours !== undefined) args.work_hours = input.workHours;
      if (input.afterHours !== undefined) args.after_hours = input.afterHours;
      if (input.noAnswer !== undefined) args.no_answer = input.noAnswer;
      return { tool: "build_call_flow", args };
    }

    default:
      return { tool: anthropicTool, args: { ...base, ...camelToSnake(input) } };
  }
}
