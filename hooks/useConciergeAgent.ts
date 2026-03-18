"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import type Anthropic from "@anthropic-ai/sdk";
import { useLocale as useNextIntlLocale } from "next-intl";
import {
  useConcierge,
  STAGE_ORDER,
  type ConciergeStage,
  type OnboardingData,
} from "@/contexts/ConciergeContext";
import { useAssistant } from "@/contexts/AssistantContext";
import { getAccessToken } from "@/lib/auth";
import {
  researchWebsite,
  checkLicensing,
  applyConfiguration,
  type ApplyStep,
} from "@/lib/api/concierge-backend";
import type { Message } from "@/components/concierge/MessageBubble";
import { truncateMessages } from "@/lib/utils/truncate-messages";
import { validateStageComplete } from "@/lib/utils/stage-guards";
import { trackEvent } from "@/lib/utils/analytics";
import { withRetry, isRetryableNetworkError } from "@/lib/utils/retry";

// ── Types ─────────────────────────────────────────────────────────────────────

type ApiMessage = Anthropic.MessageParam;

type ContentBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; tool_use_id: string; content: string };

interface ApiResponse {
  stop_reason: "end_turn" | "tool_use" | "max_tokens" | "stop_sequence";
  content: ContentBlock[];
  error?: string;
}

const TOOL_LABELS: Record<string, string> = {
  research_website:    "Researching your website",
  check_licensing:     "Checking license eligibility",
  apply_configuration: "Building your configuration",
  advance_stage:       "Moving to next step",
  update_config:       "Saving your information",
  get_account_summary: "Checking account capacity",
  get_next_extension:  "Getting next extension",
  create_schedule:     "Creating schedule",
  build_call_flow:     "Building call flow",
  search_support:      "Searching support articles",
};

function newId() {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ── SSE stream consumer ─────────────────────────────────────────────────────

async function consumeStream(
  res: Response,
  onTextDelta: (text: string) => void
): Promise<ApiResponse> {
  if (!res.body) {
    const json = await res.json();
    if (json.error) return { stop_reason: "end_turn", content: [], error: json.error };
    return json as ApiResponse;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result: ApiResponse | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";

    for (const block of parts) {
      const dataLine = block
        .split("\n")
        .find((l) => l.startsWith("data: "));
      if (!dataLine) continue;
      try {
        const json = JSON.parse(dataLine.slice(6));
        if (json.type === "text_delta") {
          onTextDelta(json.text);
        } else if (json.type === "message_complete") {
          result = { stop_reason: json.stop_reason, content: json.content };
        } else if (json.type === "error") {
          result = { stop_reason: "end_turn", content: [], error: json.error };
        }
      } catch {
        // Skip malformed events
      }
    }
  }

  return result ?? { stop_reason: "end_turn", content: [], error: "Stream ended unexpectedly" };
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useConciergeAgent() {
  const locale = useNextIntlLocale();
  const {
    isOpen, stage, config,
    close, reset: contextReset, setTransitioning,
    advance, updateConfig,
  } = useConcierge();
  const { open: openAssistant } = useAssistant();

  const [messages, setMessages]       = useState<Message[]>([]);
  const [apiMessages, setApiMessages] = useState<ApiMessage[]>([]);
  const [isRunning, setIsRunning]     = useState(false);
  const [widgetStage, setWidgetStage] = useState<ConciergeStage>(stage);

  // Always-current refs — immune to stale closures
  const isRunningRef        = useRef(false);
  const apiMessagesRef      = useRef<ApiMessage[]>([]);
  const stageRef            = useRef(stage);
  const configRef           = useRef(config);
  const lastKickedStageRef  = useRef<ConciergeStage | null>(null);
  const pendingKickoffRef   = useRef<ConciergeStage | null>(null);
  // Set to true when apply_configuration succeeds so advance_stage no longer
  // triggers the "done" kickoff (handleApplySuccess handles the transition).
  const buildSucceededRef   = useRef(false);

  useEffect(() => { stageRef.current = stage; }, [stage]);
  useEffect(() => { configRef.current = config; }, [config]);
  useEffect(() => { apiMessagesRef.current = apiMessages; }, [apiMessages]);
  useEffect(() => { isRunningRef.current = isRunning; }, [isRunning]);

  // ── Tool execution ──────────────────────────────────────────────────────────

  const executeTool = useCallback(
    async (
      name: string,
      toolInput: Record<string, unknown>,
      loopState: { stage: ConciergeStage; config: OnboardingData }
    ): Promise<{
      result: unknown;
      loopState: { stage: ConciergeStage; config: OnboardingData };
    }> => {
      trackEvent("tool_executed", { tool: name, stage: loopState.stage });

      // ── advance_stage ─────────────────────────────────────────────────────
      if (name === "advance_stage") {
        // If the build already succeeded, handleApplySuccess owns the transition —
        // skip the redundant advance so we don't fire the "done" kickoff twice.
        if (buildSucceededRef.current) {
          return { result: { success: true, message: "Build complete — transition handled." }, loopState };
        }
        const validation = validateStageComplete(loopState.stage, loopState.config);
        if (!validation.valid) {
          trackEvent("validation_failed", { stage: loopState.stage, missing: validation.missing });
          return {
            result: { success: false, error: `Cannot advance: missing ${validation.missing.join(", ")}` },
            loopState,
          };
        }
        trackEvent("stage_completed", { stage: loopState.stage });
        advance();
        const nextIdx = Math.min(STAGE_ORDER.indexOf(loopState.stage) + 1, STAGE_ORDER.length - 1);
        const nextStage = STAGE_ORDER[nextIdx];
        trackEvent("stage_entered", { stage: nextStage });
        return {
          result: { success: true, message: toolInput.reason ?? "Advancing stage." },
          loopState: { ...loopState, stage: nextStage },
        };
      }

      // ── update_config ─────────────────────────────────────────────────────
      if (name === "update_config") {
        const patch = toolInput.patch as Partial<OnboardingData>;
        if (patch && typeof patch === "object") {
          updateConfig(patch);
          return {
            result: { success: true },
            loopState: { ...loopState, config: { ...loopState.config, ...patch } },
          };
        }
        return { result: { success: true }, loopState };
      }

      // ── research_website ──────────────────────────────────────────────────
      if (name === "research_website") {
        const data = await researchWebsite(toolInput.url as string);
        return { result: data, loopState };
      }

      // ── check_licensing ───────────────────────────────────────────────────
      if (name === "check_licensing") {
        const licToken = getAccessToken() ?? undefined;
        const ok = await checkLicensing(toolInput.feature as string, licToken);
        return { result: { eligible: ok, feature: toolInput.feature }, loopState };
      }

      // ── apply_configuration ───────────────────────────────────────────────
      if (name === "apply_configuration") {
        if (!toolInput.confirm) return { result: { success: false, error: "User did not confirm." }, loopState };
        const applyToken = getAccessToken();
        if (!applyToken) return { result: { success: false, error: "Not authenticated — please log in again." }, loopState };

        trackEvent("build_started", {});
        const buildBubbleId = newId();
        const buildLines: string[] = [];
        setMessages((prev) => [
          ...prev,
          { id: buildBubbleId, role: "concierge" as const, text: "\u{1f527} **Building your system\u2026**\n\n", isTyping: false },
        ]);

        const result = await applyConfiguration(configRef.current, applyToken, (step: ApplyStep) => {
          const icon = step.status === "ok" ? "\u2705" : step.status === "warn" ? "\u26a0\ufe0f" : "\u23ed\ufe0f";
          buildLines.push(`${icon} ${step.label}${step.detail ? ` \u2014 *${step.detail}*` : ""}`);
          setMessages((prev) =>
            prev.map((m) =>
              m.id === buildBubbleId
                ? { ...m, text: `\u{1f527} **Building your system\u2026**\n\n${buildLines.join("\n")}` }
                : m
            )
          );
        });

        const summary = result.success
          ? `\u2705 **Done!** ${result.okCount} item${result.okCount !== 1 ? "s" : ""} created${result.warnCount ? `, ${result.warnCount} warning${result.warnCount !== 1 ? "s" : ""}` : ""}.`
          : `\u274c **Build failed:** ${result.error ?? "Unknown error"}`;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === buildBubbleId
              ? { ...m, text: `\u{1f527} **Build results**\n\n${buildLines.join("\n")}\n\n${summary}` }
              : m
          )
        );

        trackEvent(result.success ? "build_completed" : "build_failed", {
          okCount: result.okCount,
          warnCount: result.warnCount,
        });
        return { result, loopState };
      }

      // ── Generic n2p tools ─────────────────────────────────────────────────
      const token = getAccessToken();
      if (!token) return { result: { error: "Not authenticated." }, loopState };

      const res = await withRetry(
        async () => {
          const r = await fetch("/api/n2p-tools", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ tool: name, input: toolInput }),
          });
          if (!r.ok && [502, 503, 504].includes(r.status)) {
            throw Object.assign(new Error(`HTTP ${r.status}`), { status: r.status });
          }
          return r;
        },
        { maxRetries: 2, shouldRetry: isRetryableNetworkError }
      );
      const json = await res.json();
      return { result: res.ok ? json.data : { error: json.error ?? "Tool failed" }, loopState };
    },
    [advance, updateConfig]
  );

  // ── Transition animation on successful apply ──────────────────────────────

  const handleApplySuccess = useCallback(() => {
    trackEvent("flow_completed", {});
    setTransitioning(true);
    setTimeout(() => {
      setTransitioning(false);
      close();
      openAssistant();
    }, 700);
  }, [setTransitioning, close, openAssistant]);

  // ── Agentic loop with streaming ───────────────────────────────────────────

  const driveLoop = useCallback(
    async (
      msgs: ApiMessage[],
      activeBubbleId: string,
      initialStage: ConciergeStage,
      initialConfig: OnboardingData
    ): Promise<ApiMessage[]> => {
      let loopState = { stage: initialStage, config: initialConfig };

      while (true) {
        let response: ApiResponse;
        try {
          const truncated = truncateMessages(msgs);
          const res = await withRetry(
            () =>
              fetch("/api/concierge-agent", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  messages: truncated,
                  stage: loopState.stage,
                  config: loopState.config,
                  locale,
                }),
              }),
            { maxRetries: 2, shouldRetry: isRetryableNetworkError }
          );

          let streamedText = "";
          response = await consumeStream(res, (textDelta) => {
            streamedText += textDelta;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === activeBubbleId ? { ...m, isTyping: false, text: streamedText } : m
              )
            );
          });
        } catch {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === activeBubbleId
                ? { ...m, isTyping: false, text: "Network error \u2014 please try again." }
                : m
            )
          );
          trackEvent("error_occurred", { error: "network_error" });
          return msgs;
        }

        if (response.error) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === activeBubbleId
                ? { ...m, isTyping: false, text: `Error: ${response.error}` }
                : m
            )
          );
          trackEvent("error_occurred", { error: response.error });
          return msgs;
        }

        const textContent = (response.content ?? [])
          .filter((b): b is { type: "text"; text: string } => b.type === "text")
          .map((b) => b.text)
          .join("");

        if (response.stop_reason === "end_turn" || response.stop_reason === "max_tokens") {
          const displayText = textContent || (response.stop_reason === "max_tokens" ? "_(response was cut off — please try again or rephrase your question)_" : "\u2026");
          setMessages((prev) =>
            prev.map((m) =>
              m.id === activeBubbleId
                ? { ...m, isTyping: false, text: displayText }
                : m
            )
          );
          return [
            ...msgs,
            { role: "assistant", content: response.content as Anthropic.ContentBlockParam[] },
          ];
        }

        if (response.stop_reason === "tool_use") {
          if (textContent) {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === activeBubbleId ? { ...m, isTyping: false, text: textContent } : m
              )
            );
          }

          const toolUseBlocks = (response.content ?? []).filter(
            (b): b is { type: "tool_use"; id: string; name: string; input: Record<string, unknown> } =>
              b.type === "tool_use"
          );

          const toolResults: { type: "tool_result"; tool_use_id: string; content: string }[] = [];

          for (const tool of toolUseBlocks) {
            const badgeId = newId();
            setMessages((prev) => [
              ...prev,
              { id: badgeId, role: "concierge" as const, text: `__tool__:${TOOL_LABELS[tool.name] ?? tool.name}` },
            ]);

            let toolResult: unknown;
            try {
              const out = await executeTool(tool.name, tool.input, loopState);
              toolResult = out.result;
              loopState = out.loopState;
            } catch (e) {
              toolResult = { error: e instanceof Error ? e.message : "Tool failed" };
              trackEvent("tool_failed", { tool: tool.name, error: String(e) });
            }

            setMessages((prev) =>
              prev.map((m) =>
                m.id === badgeId
                  ? { ...m, text: `__tool_done__:${TOOL_LABELS[tool.name] ?? tool.name}` }
                  : m
              )
            );

            if (tool.name === "apply_configuration") {
              const r = toolResult as { success: boolean };
              if (r?.success) {
                buildSucceededRef.current = true;
                handleApplySuccess();
              }
            }

            toolResults.push({
              type: "tool_result",
              tool_use_id: tool.id,
              content: JSON.stringify(toolResult),
            });
          }

          const nextBubbleId = newId();
          setMessages((prev) => {
            const cleaned = prev.filter((m) => !(m.isTyping && !m.text));
            return [...cleaned, { id: nextBubbleId, role: "concierge" as const, text: "", isTyping: true }];
          });

          // Truncate before appending new tool exchange to prevent msgs growing unboundedly
          const msgsWithAssistant = truncateMessages([
            ...msgs,
            { role: "assistant", content: response.content as Anthropic.ContentBlockParam[] },
          ]);
          msgs = [
            ...msgsWithAssistant,
            { role: "user", content: toolResults as Anthropic.ToolResultBlockParam[] },
          ];
          activeBubbleId = nextBubbleId;
          continue;
        }

        break;
      }
      return msgs;
    },
    [executeTool, handleApplySuccess]
  );

  // ── Core send ─────────────────────────────────────────────────────────────

  const sendMessage = useCallback(
    async (
      text: string,
      showUserBubble = true,
      overrideMessages?: ApiMessage[],
      overrideStage?: ConciergeStage
    ) => {
      if (isRunningRef.current) return;
      isRunningRef.current = true;
      setIsRunning(true);

      if (showUserBubble && text) {
        setMessages((prev) => [...prev, { id: newId(), role: "user" as const, text }]);
      }

      const bubbleId = newId();
      setMessages((prev) => [
        ...prev,
        { id: bubbleId, role: "concierge" as const, text: "", isTyping: true },
      ]);

      const base = overrideMessages ?? apiMessagesRef.current;
      const usedStage = overrideStage ?? stageRef.current;
      const nextMessages: ApiMessage[] = text
        ? [...base, { role: "user", content: text }]
        : base;

      const finalMessages = await driveLoop(nextMessages, bubbleId, usedStage, configRef.current);

      setApiMessages(finalMessages);
      isRunningRef.current = false;
      setIsRunning(false);
      setWidgetStage(stageRef.current);
      lastKickedStageRef.current = stageRef.current;

      const pending = pendingKickoffRef.current;
      pendingKickoffRef.current = null;
      if (pending && pending !== stageRef.current) {
        lastKickedStageRef.current = pending;
        const trigger = `[SYSTEM: The user has just entered the "${pending}" stage. Open this step naturally — introduce what you need and ask your first question. Do not say the internal stage name.]`;
        setTimeout(() => sendMessage(trigger, false, finalMessages, pending), 100);
        return;
      }
    },
    [driveLoop]
  );

  // ── Watch for stage changes ───────────────────────────────────────────────

  useEffect(() => {
    if (!isOpen) return;
    if (stage === lastKickedStageRef.current) return;

    if (isRunningRef.current) {
      pendingKickoffRef.current = stage;
    } else {
      lastKickedStageRef.current = stage;
      trackEvent("stage_entered", { stage });
      const trigger = `[SYSTEM: The user has just entered the "${stage}" stage. Open this step naturally — introduce what you need and ask your first question. Do not say the internal stage name.]`;
      sendMessage(trigger, false, apiMessagesRef.current, stage);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, isOpen]);

  // ── Reset ─────────────────────────────────────────────────────────────────

  const resetAgent = useCallback(() => {
    trackEvent("flow_reset", {});
    contextReset();
    setMessages([]);
    setApiMessages([]);
    setWidgetStage("welcome_scrape");
    lastKickedStageRef.current = null;
    pendingKickoffRef.current = null;
    isRunningRef.current = false;
    buildSucceededRef.current = false;
  }, [contextReset]);

  return { messages, isRunning, widgetStage, sendMessage, resetAgent };
}
