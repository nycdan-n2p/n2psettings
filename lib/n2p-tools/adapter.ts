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

    case "search_support":
      return { tool: "search_support", args: { query: input.query } };

    default:
      return { tool: anthropicTool, args: { ...base, ...camelToSnake(input) } };
  }
}
