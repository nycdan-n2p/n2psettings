import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import os from "os";
import { claimsFromAuthHeader } from "@/lib/server/jwt";

const STATE_DIR = path.join(os.tmpdir(), "n2p-onboarding-state");

function getAccountIdFromToken(req: NextRequest): string | null {
  const accountId = claimsFromAuthHeader(req.headers.get("Authorization"))?.accountId;
  return accountId ? String(accountId) : null;
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

  let body: { stage: string; config: Record<string, unknown>; clientVersion?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  await ensureDir();

  const fp = filePath(accountId);

  // Optimistic locking: if the client sends a `clientVersion` (the `updatedAt`
  // timestamp it last read), reject the write if a newer version already exists
  // on disk. This prevents a stale background save from overwriting fresh data.
  if (body.clientVersion !== undefined) {
    try {
      const existing = JSON.parse(await fs.readFile(fp, "utf-8")) as { updatedAt?: number };
      if (existing.updatedAt && existing.updatedAt > body.clientVersion) {
        return NextResponse.json(
          { error: "Conflict — a newer version of this state exists.", serverVersion: existing.updatedAt },
          { status: 409 }
        );
      }
    } catch {
      // File doesn't exist yet — write is safe.
    }
  }

  const now = Date.now();
  try {
    // Write to a temp file then rename for an atomic swap, avoiding partial writes.
    const tmpPath = fp + ".tmp";
    await fs.writeFile(tmpPath, JSON.stringify({ ...body, updatedAt: now }), "utf-8");
    await fs.rename(tmpPath, fp);
    return NextResponse.json({ ok: true, updatedAt: now });
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
