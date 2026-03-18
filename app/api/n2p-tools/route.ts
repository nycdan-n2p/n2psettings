import { NextRequest, NextResponse } from "next/server";
import { executeN2PTool } from "@/lib/mcp/server";
import { adaptForMCP, type AdaptResult } from "@/lib/n2p-tools/adapter";
import { claimsFromAuthHeader, tokenFromAuthHeader } from "@/lib/server/jwt";
import {
  extractArray,
  safeN2PCreatedUser,
  isN2PRingGroup,
  isN2PCallQueue,
  isN2PDepartment,
  isRecord,
} from "@/lib/server/type-guards";

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("Authorization");
  const token = tokenFromAuthHeader(authHeader);
  if (!token) {
    return NextResponse.json({ error: "Missing or invalid Authorization header" }, { status: 401 });
  }

  const claims = claimsFromAuthHeader(authHeader);
  const accountId = claims?.accountId ?? null;
  const clientId = claims?.clientId ?? null;
  const sipClientId = claims?.sipClientId ?? null;

  if (!accountId) {
    return NextResponse.json({ error: "Token missing account ID (aid)" }, { status: 401 });
  }

  let body: { tool: string; input: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { tool: anthropicTool, input } = body;
  if (!anthropicTool || typeof anthropicTool !== "string") {
    return NextResponse.json({ error: "Missing or invalid 'tool' field" }, { status: 400 });
  }

  const ctx = {
    token,
    accountId,
    clientId: clientId ?? undefined,
    sipClientId: sipClientId ?? undefined,
  };

  const adapted: AdaptResult = adaptForMCP(anthropicTool, input ?? {}, ctx);

  if (adapted.composite === "create_user_with_phone") {
    try {
      const raw = await executeN2PTool(adapted.tool, adapted.args as Record<string, unknown>, ctx);
      const created = safeN2PCreatedUser(raw);
      let phoneAssigned = false;
      const phoneNumber = typeof input?.phoneNumber === "string" ? input.phoneNumber : undefined;
      if (phoneNumber && created?.userId) {
        try {
          await executeN2PTool("assign_phone_to_user", {
            account_id: accountId,
            user_id: created.userId,
            phone_number: phoneNumber,
          }, ctx);
          phoneAssigned = true;
        } catch {
          // non-fatal
        }
      }
      return NextResponse.json({
        data: {
          success: true,
          userId: created?.userId,
          name: created ? `${created.firstName ?? ""} ${created.lastName ?? ""}`.trim() : undefined,
          extension: created?.extension ?? (typeof input?.extension === "string" ? input.extension : undefined),
          phoneAssigned,
          phoneNumber: phoneNumber ?? null,
        },
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Tool failed";
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  if (anthropicTool === "get_user_call_stats") {
    try {
      const raw = await executeN2PTool(adapted.tool, adapted.args as Record<string, unknown>, ctx);
      const rows = Array.isArray(raw) ? raw : (isRecord(raw) && Array.isArray(raw.users) ? raw.users : []);
      const userId = typeof input?.userId === "number" ? input.userId : undefined;
      const row = (rows as Array<Record<string, unknown>>).find(
        (r) => r.userId === userId || r.user_id === userId
      );
      const days = (input?.days as number) ?? 30;
      if (!row) {
        return NextResponse.json({
          data: {
            userId: input?.userId,
            name: input?.userName ?? "Unknown",
            period: `Last ${days} days`,
            note: "No call data found for this user in the selected period.",
          },
        });
      }
      return NextResponse.json({
        data: {
          userId: input?.userId,
          name: (input?.userName as string) ?? row.name ?? "User",
          period: `Last ${days} days`,
          totalCalls: row.totalCalls ?? row.total_calls ?? 0,
          answeredCalls: row.answeredCalls ?? row.answered_calls ?? 0,
          missedCalls: row.missedCalls ?? row.missed_calls ?? 0,
          avgDurationSec: row.avgDuration ?? row.avg_duration ?? 0,
        },
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Tool failed";
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  if (anthropicTool === "search_users") {
    try {
      const raw = await executeN2PTool(adapted.tool, adapted.args as Record<string, unknown>, ctx);
      const results = Array.isArray(raw) ? raw : [];
      const mapped = results.slice(0, 10).map((u: Record<string, unknown>) => ({
        userId: u.userId ?? u.user_id,
        name: `${u.firstName ?? u.first_name ?? ""} ${u.lastName ?? u.last_name ?? ""}`.trim(),
        email: u.email,
        extension: u.extension,
        role: u.role,
      }));
      return NextResponse.json({ data: mapped });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Tool failed";
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  if (anthropicTool === "get_next_extension") {
    try {
      const raw = await executeN2PTool(adapted.tool, adapted.args as Record<string, unknown>, ctx);
      const nextExtension = isRecord(raw) && typeof raw.nextExtension === "string" ? raw.nextExtension : undefined;
      return NextResponse.json({ data: { nextExtension } });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Tool failed";
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  if (anthropicTool === "list_ring_groups") {
    try {
      const raw = await executeN2PTool(adapted.tool, adapted.args as Record<string, unknown>, ctx);
      const groups = extractArray(raw);
      const mapped = groups.filter(isN2PRingGroup).map((g) => ({
        id: g.id,
        name: g.name,
        extension: g.extension,
        memberCount: Array.isArray(g.lines) ? g.lines.length : 0,
      }));
      return NextResponse.json({ data: mapped });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Tool failed";
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  if (anthropicTool === "list_call_queues") {
    try {
      const raw = await executeN2PTool(adapted.tool, adapted.args as Record<string, unknown>, ctx);
      const items = extractArray(raw);
      const mapped = items.filter(isN2PCallQueue).map((q) => ({
        id: q.id,
        name: q.name ?? q.display_name,
        extension: q.extension,
        agentCount: q.agents_count ?? (Array.isArray(q.agents) ? q.agents.length : 0),
      }));
      return NextResponse.json({ data: mapped });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Tool failed";
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  if (anthropicTool === "list_departments") {
    try {
      const raw = await executeN2PTool(adapted.tool, adapted.args as Record<string, unknown>, ctx);
      const depts = extractArray(raw);
      const mapped = depts.filter(isN2PDepartment).map((d) => ({
        deptId: d.deptId ?? d.dept_id,
        name: d.name,
        extension: d.extension,
      }));
      return NextResponse.json({ data: mapped });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Tool failed";
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  if (anthropicTool === "create_user") {
    try {
      const raw = await executeN2PTool(adapted.tool, adapted.args as Record<string, unknown>, ctx);
      const created = safeN2PCreatedUser(raw);
      return NextResponse.json({
        data: {
          success: true,
          userId: created?.userId,
          name: created ? `${created.firstName ?? ""} ${created.lastName ?? ""}`.trim() : undefined,
          extension: created?.extension ?? (typeof input?.extension === "string" ? input.extension : undefined),
          phoneAssigned: false,
          phoneNumber: null,
        },
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Tool failed";
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  try {
    const data = await executeN2PTool(adapted.tool, adapted.args as Record<string, unknown>, ctx);
    return NextResponse.json({ data });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Tool failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
