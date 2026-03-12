import { NextRequest, NextResponse } from "next/server";
import { executeN2PTool } from "@/lib/mcp/server";
import { adaptForMCP, type AdaptResult } from "@/lib/n2p-tools/adapter";

function decodeJwtPayload(token: string): Record<string, unknown> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return {};
    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = payload + "=".repeat((4 - (payload.length % 4)) % 4);
    return JSON.parse(Buffer.from(padded, "base64").toString("utf-8")) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function pickNumber(claims: Record<string, unknown>, ...keys: string[]): number | null {
  for (const k of keys) {
    const v = claims[k];
    if (v !== undefined && v !== null) {
      const n = Number(v);
      if (!isNaN(n) && n > 0) return n;
    }
  }
  return null;
}

function pickString(claims: Record<string, unknown>, ...keys: string[]): string | null {
  for (const k of keys) {
    const v = claims[k];
    if (typeof v === "string" && v) return v;
  }
  return null;
}

export async function POST(req: NextRequest) {
  const auth = req.headers.get("Authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) {
    return NextResponse.json({ error: "Missing or invalid Authorization header" }, { status: 401 });
  }

  const claims = decodeJwtPayload(token);
  const accountId = pickNumber(claims, "aid", "accountId", "account_id", "AccountId", "account");
  const clientId = pickNumber(claims, "cid", "clientId", "client_id", "ClientId");
  const sipClientId = pickString(claims, "sipClientId", "sip_client_id");

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
      const created = await executeN2PTool(adapted.tool, adapted.args as Record<string, unknown>, ctx) as {
        userId?: number;
        firstName?: string;
        lastName?: string;
        extension?: string;
      };
      let phoneAssigned = false;
      const phoneNumber = input?.phoneNumber as string | undefined;
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
          name: created ? `${created.firstName} ${created.lastName}` : undefined,
          extension: created?.extension ?? input?.extension,
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
      const rows = Array.isArray(raw) ? raw : (raw as { users?: unknown[] })?.users ?? [];
      const userId = input?.userId as number | undefined;
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
      const raw = await executeN2PTool(adapted.tool, adapted.args as Record<string, unknown>, ctx) as { nextExtension?: string };
      return NextResponse.json({ data: { nextExtension: raw?.nextExtension } });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Tool failed";
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  if (anthropicTool === "list_ring_groups") {
    try {
      const raw = await executeN2PTool(adapted.tool, adapted.args as Record<string, unknown>, ctx);
      const groups = Array.isArray(raw) ? raw : [];
      const mapped = groups.map((g: Record<string, unknown>) => ({
        id: g.id,
        name: g.name,
        extension: g.extension,
        memberCount: Array.isArray(g.lines) ? (g.lines as unknown[]).length : 0,
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
      const items = Array.isArray(raw) ? raw : (raw as { items?: unknown[] })?.items ?? [];
      const mapped = items.map((q: Record<string, unknown>) => ({
        id: q.id,
        name: q.name ?? q.display_name,
        extension: q.extension,
        agentCount: q.agents_count ?? (Array.isArray(q.agents) ? (q.agents as unknown[]).length : 0),
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
      const depts = Array.isArray(raw) ? raw : [];
      const mapped = depts.map((d: Record<string, unknown>) => ({
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
      const created = await executeN2PTool(adapted.tool, adapted.args as Record<string, unknown>, ctx) as {
        userId?: number;
        firstName?: string;
        lastName?: string;
        extension?: string;
      };
      return NextResponse.json({
        data: {
          success: true,
          userId: created?.userId,
          name: created ? `${created.firstName} ${created.lastName}` : undefined,
          extension: created?.extension ?? input?.extension,
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
