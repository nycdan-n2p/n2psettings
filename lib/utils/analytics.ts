type EventName =
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

interface AnalyticsEvent {
  name: EventName;
  data: Record<string, unknown>;
  timestamp: number;
  sessionId: string;
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
