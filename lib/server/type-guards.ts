/**
 * Runtime type guards for API response shapes.
 *
 * Use these instead of `as SomeType` casts when handling data from external
 * APIs (n2p, Anthropic).  They validate at runtime and give TypeScript the
 * correct type without bypassing the type checker.
 */

// ── Generic helpers ───────────────────────────────────────────────────────────

export function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function isArray(v: unknown): v is unknown[] {
  return Array.isArray(v);
}

/** Extract an array from an API response regardless of nesting shape. */
export function extractArray(v: unknown): unknown[] {
  if (Array.isArray(v)) return v;
  if (isRecord(v)) {
    if (Array.isArray(v.data))  return v.data  as unknown[];
    if (Array.isArray(v.items)) return v.items as unknown[];
    if (Array.isArray(v.users)) return v.users as unknown[];
  }
  return [];
}

// ── n2p API shapes ────────────────────────────────────────────────────────────

export interface N2PUser {
  userId?: number;
  user_id?: number;
  firstName?: string;
  first_name?: string;
  lastName?: string;
  last_name?: string;
  email?: string;
  extension?: string;
  role?: string;
}

export function isN2PUser(v: unknown): v is N2PUser {
  return isRecord(v);
}

export function safeN2PUser(v: unknown): N2PUser {
  return isN2PUser(v) ? v : {};
}

export interface N2PCreatedUser {
  userId?: number;
  firstName?: string;
  lastName?: string;
  extension?: string;
}

export function isN2PCreatedUser(v: unknown): v is N2PCreatedUser {
  return isRecord(v) && (v.userId === undefined || typeof v.userId === "number");
}

export function safeN2PCreatedUser(v: unknown): N2PCreatedUser {
  return isN2PCreatedUser(v) ? v : {};
}

export interface N2PRingGroup {
  id?: number | string;
  name?: string;
  extension?: string;
  lines?: unknown[];
}

export function isN2PRingGroup(v: unknown): v is N2PRingGroup {
  return isRecord(v);
}

export interface N2PCallQueue {
  id?: number | string;
  name?: string;
  display_name?: string;
  extension?: string;
  agents_count?: number;
  agents?: unknown[];
}

export function isN2PCallQueue(v: unknown): v is N2PCallQueue {
  return isRecord(v);
}

export interface N2PDepartment {
  deptId?: number | string;
  dept_id?: number | string;
  name?: string;
  extension?: string;
}

export function isN2PDepartment(v: unknown): v is N2PDepartment {
  return isRecord(v);
}

// ── Anthropic response shapes ─────────────────────────────────────────────────

export interface AnthropicTextBlock {
  type: "text";
  text: string;
}

export function isAnthropicTextBlock(v: unknown): v is AnthropicTextBlock {
  return isRecord(v) && v.type === "text" && typeof v.text === "string";
}

export function extractAnthropicText(content: unknown[]): string {
  const block = content.find(isAnthropicTextBlock);
  return block?.text?.trim() ?? "";
}
