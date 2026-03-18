import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import os from "os";

const STATE_DIR = path.join(os.tmpdir(), "n2p-onboarding-state");

function getAccountIdFromToken(req: NextRequest): string | null {
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const token = auth.slice(7);
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = payload + "=".repeat((4 - (payload.length % 4)) % 4);
    const claims = JSON.parse(Buffer.from(padded, "base64").toString());
    const aid = claims.aid ?? claims.accountId ?? claims.account_id;
    return aid ? String(aid) : null;
  } catch {
    return null;
  }
}

async function ensureDir() {
  try { await fs.mkdir(STATE_DIR, { recursive: true }); } catch { /* exists */ }
}

function filePath(accountId: string): string {
  const safe = accountId.replace(/[^a-zA-Z0-9_-]/g, "");
  return path.join(STATE_DIR, `${safe}.json`);
}

export async function GET(req: NextRequest) {
  const accountId = getAccountIdFromToken(req);
  if (!accountId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await ensureDir();
  try {
    const data = await fs.readFile(filePath(accountId), "utf-8");
    return NextResponse.json(JSON.parse(data));
  } catch {
    return NextResponse.json({ stage: null, config: null });
  }
}

export async function PUT(req: NextRequest) {
  const accountId = getAccountIdFromToken(req);
  if (!accountId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { stage: string; config: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  await ensureDir();
  try {
    await fs.writeFile(
      filePath(accountId),
      JSON.stringify({ ...body, updatedAt: Date.now() }),
      "utf-8"
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[onboarding-state] Write failed:", err);
    return NextResponse.json({ error: "Failed to save state" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const accountId = getAccountIdFromToken(req);
  if (!accountId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await ensureDir();
  try { await fs.unlink(filePath(accountId)); } catch { /* not found */ }
  return NextResponse.json({ ok: true });
}
