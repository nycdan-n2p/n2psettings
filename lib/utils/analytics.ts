export type EventName =
  | "flow_started"
  | "stage_entered"
  | "stage_completed"
  | "stage_skipped"
  | "flow_completed"
  | "flow_abandoned"
  | "flow_reset"
  | "tool_executed"
  | "tool_failed"
  | "build_started"
  | "build_completed"
  | "build_failed"
  | "error_occurred"
  | "validation_failed";

export interface AnalyticsEvent {
  name: EventName;
  data: Record<string, unknown>;
  timestamp: number;
  sessionId: string;
}

/**
 * Analytics destination plug-in.
 *
 * By default events are collected in-memory (useful for `getFlowMetrics()`).
 * To ship events to a real analytics service, set a custom destination:
 *
 *   import { setAnalyticsDestination } from "@/lib/utils/analytics";
 *   // PostHog example:
 *   setAnalyticsDestination((event) => posthog.capture(event.name, event.data));
 *   // Segment example:
 *   setAnalyticsDestination((event) => analytics.track(event.name, event.data));
 *   // Custom webhook example:
 *   setAnalyticsDestination((event) => fetch("/api/analytics", { method: "POST", body: JSON.stringify(event) }));
 */
type AnalyticsDestination = (event: AnalyticsEvent) => void;

let destination: AnalyticsDestination | null = null;

export function setAnalyticsDestination(fn: AnalyticsDestination) {
  destination = fn;
}

let sessionId = typeof crypto !== "undefined"
  ? crypto.randomUUID()
  : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const events: AnalyticsEvent[] = [];

export function trackEvent(name: EventName, data?: Record<string, unknown>) {
  const event: AnalyticsEvent = {
    name,
    data: data ?? {},
    timestamp: Date.now(),
    sessionId,
  };
  events.push(event);

  // Forward to the configured destination (PostHog, Segment, custom webhook, etc.)
  if (destination) {
    try { destination(event); } catch { /* never let analytics break the app */ }
  }

  if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
    console.info(`[analytics] ${name}`, event.data);
  }
}

export function getEvents(): AnalyticsEvent[] {
  return [...events];
}

export function getEventsSince(timestamp: number): AnalyticsEvent[] {
  return events.filter((e) => e.timestamp >= timestamp);
}

export function clearEvents() {
  events.length = 0;
}

export function resetSession() {
  clearEvents();
  sessionId = typeof crypto !== "undefined"
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function getFlowMetrics() {
  const started = events.find((e) => e.name === "flow_started");
  const completed = events.find((e) => e.name === "flow_completed");
  const stagesCompleted = events.filter((e) => e.name === "stage_completed");
  const errors = events.filter(
    (e) => e.name === "error_occurred" || e.name === "tool_failed"
  );

  return {
    sessionId,
    durationMs: started && completed ? completed.timestamp - started.timestamp : null,
    stagesCompleted: stagesCompleted.length,
    errorCount: errors.length,
    totalEvents: events.length,
  };
}
