import { NextRequest, NextResponse } from "next/server";
import { executeN2PTool } from "@/lib/mcp/server";

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

/**
 * GET /api/validate-user-email?email=...
 * Returns { available: boolean, reason?: string }
 *
 * Uses search_team_members to check if the email already exists in the account.
 */
export async function GET(req: NextRequest) {
  const auth = req.headers.get("Authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const email = req.nextUrl.searchParams.get("email")?.trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ error: "email param required" }, { status: 400 });
  }

  const claims = decodeJwtPayload(token);
  const accountId = (() => {
    for (const k of ["aid", "accountId", "account_id", "AccountId", "account"]) {
      const v = claims[k];
      if (v !== undefined && v !== null) {
        const n = Number(v);
        if (!isNaN(n) && n > 0) return n;
      }
    }
    return null;
  })();

  if (!accountId) {
    return NextResponse.json({ error: "Token missing account ID" }, { status: 401 });
  }

  const ctx = { token, accountId };

  try {
    const result = await executeN2PTool("search_team_members", {
      account_id: accountId,
      query: email,
    }, ctx);

    // The API returns an array or object with items — check if email matches exactly
    const members = Array.isArray(result)
      ? result
      : Array.isArray((result as Record<string, unknown>)?.data)
        ? ((result as Record<string, unknown>).data as unknown[])
        : Array.isArray((result as Record<string, unknown>)?.items)
          ? ((result as Record<string, unknown>).items as unknown[])
          : [];

    const taken = members.some((m) => {
      const member = m as Record<string, unknown>;
      return (
        (member.email as string)?.toLowerCase() === email ||
        (member.user_email as string)?.toLowerCase() === email
      );
    });

    return NextResponse.json({ available: !taken });
  } catch (e) {
    // If the search fails (permissions, etc.) just return available=true with a note
    console.warn("[validate-user-email] search failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ available: true, warn: "Could not verify — proceeding optimistically" });
  }
}
