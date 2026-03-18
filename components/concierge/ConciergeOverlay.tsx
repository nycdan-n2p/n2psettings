"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { X, Sparkles, RotateCcw, Send, Loader2 } from "lucide-react";
import type Anthropic from "@anthropic-ai/sdk";
import { useConcierge, STAGE_ORDER, type ConciergeStage } from "@/contexts/ConciergeContext";
import { useAssistant } from "@/contexts/AssistantContext";
import { getAccessToken } from "@/lib/auth";
import {
  researchWebsite,
  checkLicensing,
  applyConfiguration,
} from "@/lib/api/concierge-backend";
import { ProgressBar } from "./ProgressBar";
import { MessageBubble, type Message } from "./MessageBubble";
import { StageWidget } from "./StageWidgets";

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

let msgCounter = 0;
function newId() { return `msg-${++msgCounter}-${Date.now()}`; }

// ── Main overlay ──────────────────────────────────────────────────────────────

export function ConciergeOverlay() {
  const {
    isOpen, isTransitioning, stage, config,
    close, reset, setTransitioning, advance, updateConfig,
  } = useConcierge();
  const { open: openAssistant } = useAssistant();

  // ── Render state ────────────────────────────────────────────────────────────
  const [displayMessages, setDisplayMessages] = useState<Message[]>([]);
  const [apiMessages, setApiMessages]         = useState<ApiMessage[]>([]);
  const [input, setInput]                     = useState("");
  const [isRunning, setIsRunning]             = useState(false);
  // widgetStage lags behind the real stage until the AI finishes responding
  const [widgetStage, setWidgetStage]         = useState<ConciergeStage>(stage);

  // ── Refs — always-current values, no stale-closure risk ─────────────────────
  const isRunningRef        = useRef(false);
  const apiMessagesRef      = useRef<ApiMessage[]>([]);
  const stageRef            = useRef(stage);
  const configRef           = useRef(config);
  const lastKickedStageRef  = useRef<ConciergeStage | null>(null);
  // Stores a stage that needs its intro fired once the current loop finishes
  const pendingKickoffRef   = useRef<ConciergeStage | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLInputElement>(null);

  // ── Keep refs in sync with state ────────────────────────────────────────────
  useEffect(() => { stageRef.current = stage; }, [stage]);
  useEffect(() => { configRef.current = config; }, [config]);
  useEffect(() => { apiMessagesRef.current = apiMessages; }, [apiMessages]);
  useEffect(() => {
    isRunningRef.current = isRunning;
  }, [isRunning]);

  // ── Auto-scroll ─────────────────────────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [displayMessages]);

  // ── Tool execution ───────────────────────────────────────────────────────────
  // Returns the tool result AND any in-loop state mutations (loopStage, loopConfig)
  const executeTool = useCallback(
    async (
      name: string,
      toolInput: Record<string, unknown>,
      loopState: { stage: ConciergeStage; config: typeof config }
    ): Promise<{ result: unknown; loopState: { stage: ConciergeStage; config: typeof config } }> => {
      if (name === "advance_stage") {
        advance();
        const nextIdx = Math.min(
          STAGE_ORDER.indexOf(loopState.stage) + 1,
          STAGE_ORDER.length - 1
        );
        const nextStage = STAGE_ORDER[nextIdx];
        return {
          result: { success: true, message: toolInput.reason ?? "Advancing stage." },
          loopState: { ...loopState, stage: nextStage },
        };
      }

      if (name === "update_config") {
        const patch = toolInput.patch as Partial<typeof config>;
        if (patch && typeof patch === "object") {
          updateConfig(patch);
          return {
            result: { success: true },
            loopState: { ...loopState, config: { ...loopState.config, ...patch } },
          };
        }
        return { result: { success: true }, loopState };
      }

      if (name === "research_website") {
        const data = await researchWebsite(toolInput.url as string);
        return { result: data, loopState };
      }

      if (name === "check_licensing") {
        const licToken = getAccessToken() ?? undefined;
        const ok = await checkLicensing(toolInput.feature as string, licToken);
        return { result: { eligible: ok, feature: toolInput.feature }, loopState };
      }

      if (name === "apply_configuration") {
        if (!toolInput.confirm) return { result: { success: false, error: "User did not confirm." }, loopState };
        const applyToken = getAccessToken();
        if (!applyToken) return { result: { success: false, error: "Not authenticated — please log in again." }, loopState };
        const result = await applyConfiguration(configRef.current, applyToken);
        return { result, loopState };
      }

      // net2phone account tools
      const token = getAccessToken();
      if (!token) return { result: { error: "Not authenticated." }, loopState };

      const res = await fetch("/api/n2p-tools", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ tool: name, input: toolInput }),
      });
      const json = await res.json();
      return { result: res.ok ? json.data : { error: json.error ?? "Tool failed" }, loopState };
    },
    [advance, updateConfig]
  );

  // ── handleApplySuccess — defined before driveLoop so it can be referenced ───
  const handleApplySuccess = useCallback(() => {
    setTransitioning(true);
    setTimeout(() => {
      setTransitioning(false);
      close();
      openAssistant();
    }, 700);
  }, [setTransitioning, close, openAssistant]);

  // ── Agentic loop ─────────────────────────────────────────────────────────────
  const driveLoop = useCallback(
    async (
      messages: ApiMessage[],
      activeBubbleId: string,
      initialStage: ConciergeStage,
      initialConfig: typeof config
    ): Promise<ApiMessage[]> => {
      // Use mutable loop-local state so advance_stage/update_config immediately
      // reflect in the next API call — no React re-render dependency
      let loopState = { stage: initialStage, config: initialConfig };

      while (true) {
        let response: ApiResponse;
        try {
          const res = await fetch("/api/concierge-agent", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              messages,
              stage:  loopState.stage,
              config: loopState.config,
            }),
          });
          response = await res.json();
        } catch {
          setDisplayMessages((prev) =>
            prev.map((m) =>
              m.id === activeBubbleId
                ? { ...m, isTyping: false, text: "Network error — please try again." }
                : m
            )
          );
          return messages;
        }

        if (response.error) {
          setDisplayMessages((prev) =>
            prev.map((m) =>
              m.id === activeBubbleId
                ? { ...m, isTyping: false, text: `Error: ${response.error}` }
                : m
            )
          );
          return messages;
        }

        const textContent = (response.content ?? [])
          .filter((b): b is { type: "text"; text: string } => b.type === "text")
          .map((b) => b.text)
          .join("");

        if (response.stop_reason === "end_turn") {
          setDisplayMessages((prev) =>
            prev.map((m) =>
              m.id === activeBubbleId
                ? { ...m, isTyping: false, text: textContent || "…" }
                : m
            )
          );
          return [
            ...messages,
            { role: "assistant", content: response.content as Anthropic.ContentBlockParam[] },
          ];
        }

        if (response.stop_reason === "tool_use") {
          // Show any text the AI included before calling tools
          if (textContent) {
            setDisplayMessages((prev) =>
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
            setDisplayMessages((prev) => [
              ...prev,
              { id: badgeId, role: "concierge" as const, text: `__tool__:${TOOL_LABELS[tool.name] ?? tool.name}` },
            ]);

            let toolResult: unknown;
            try {
              const out = await executeTool(tool.name, tool.input, loopState);
              toolResult  = out.result;
              loopState   = out.loopState; // update stage/config for next API call
            } catch (e) {
              toolResult = { error: e instanceof Error ? e.message : "Tool failed" };
            }

            setDisplayMessages((prev) =>
              prev.map((m) =>
                m.id === badgeId
                  ? { ...m, text: `__tool_done__:${TOOL_LABELS[tool.name] ?? tool.name}` }
                  : m
              )
            );

            // Kick off transition animation if apply succeeded
            if (tool.name === "apply_configuration") {
              const r = toolResult as { success: boolean };
              if (r?.success) handleApplySuccess();
            }

            toolResults.push({
              type: "tool_result",
              tool_use_id: tool.id,
              content: JSON.stringify(toolResult),
            });
          }

          // Create next AI bubble — purge ALL empty typing bubbles first
          const nextBubbleId = newId();
          setDisplayMessages((prev) => {
            const cleaned = prev.filter((m) => !(m.isTyping && !m.text));
            return [...cleaned, { id: nextBubbleId, role: "concierge" as const, text: "", isTyping: true }];
          });

          messages = [
            ...messages,
            { role: "assistant", content: response.content as Anthropic.ContentBlockParam[] },
            { role: "user", content: toolResults as Anthropic.ToolResultBlockParam[] },
          ];
          activeBubbleId = nextBubbleId;
          continue;
        }

        break;
      }
      return messages;
    },
    [executeTool, handleApplySuccess]
  );

  // ── Core send — uses refs for guard so there is NEVER a stale-closure race ──
  const sendMessage = useCallback(
    async (
      text: string,
      showUserBubble = true,
      overrideMessages?: ApiMessage[],
      overrideStage?: ConciergeStage
    ) => {
      // Use ref — never stale, prevents concurrent loops
      if (isRunningRef.current) return;
      isRunningRef.current = true;
      setIsRunning(true);

      if (showUserBubble && text) {
        setDisplayMessages((prev) => [
          ...prev,
          { id: newId(), role: "user" as const, text },
        ]);
      }

      const bubbleId = newId();
      setDisplayMessages((prev) => [
        ...prev,
        { id: bubbleId, role: "concierge" as const, text: "", isTyping: true },
      ]);

      const base      = overrideMessages ?? apiMessagesRef.current;
      const usedStage = overrideStage   ?? stageRef.current;
      const nextMessages: ApiMessage[] = text
        ? [...base, { role: "user", content: text }]
        : base;

      // Always pass the latest config via ref
      const finalMessages = await driveLoop(nextMessages, bubbleId, usedStage, configRef.current);

      setApiMessages(finalMessages);
      isRunningRef.current = false;
      setIsRunning(false);

      // Show widget for the stage we actually ended up on
      setWidgetStage(stageRef.current);

      // The loop may have called advance_stage internally and already responded
      // in the new stage's context — that response IS the stage intro, so mark
      // it as kicked-off to prevent a duplicate intro message.
      lastKickedStageRef.current = stageRef.current;

      // Only fire a pending kickoff if it targets a stage BEYOND where the loop ended
      // (i.e., another advance happened after the loop, not inside it).
      const pending = pendingKickoffRef.current;
      pendingKickoffRef.current = null;
      if (pending && pending !== stageRef.current) {
        lastKickedStageRef.current = pending;
        const trigger = `[SYSTEM: The user has just entered the "${pending}" stage. Open this step naturally — introduce what you need and ask your first question. Do not say the internal stage name.]`;
        setTimeout(() => sendMessage(trigger, false, finalMessages, pending), 100);
        return;
      }

      setTimeout(() => inputRef.current?.focus(), 50);
    },
    [driveLoop]
  );

  // ── Watch for stage changes — schedule kickoff without triggering concurrent loops
  useEffect(() => {
    if (!isOpen) return;
    if (stage === lastKickedStageRef.current) return;

    if (isRunningRef.current) {
      // Loop is running — schedule the kickoff for when it finishes
      pendingKickoffRef.current = stage;
    } else {
      // Loop is idle — fire immediately
      lastKickedStageRef.current = stage;
      const trigger = `[SYSTEM: The user has just entered the "${stage}" stage. Open this step naturally — introduce what you need and ask your first question. Do not say the internal stage name.]`;
      sendMessage(trigger, false, apiMessagesRef.current, stage);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, isOpen]);

  // ── Reset ────────────────────────────────────────────────────────────────────
  const handleReset = () => {
    reset();
    setDisplayMessages([]);
    setApiMessages([]);
    setInput("");
    setWidgetStage("welcome_scrape");
    lastKickedStageRef.current = null;
    pendingKickoffRef.current  = null;
    isRunningRef.current       = false;
  };

  if (!isOpen) return null;

  const isDone    = stage === "done";
  const stageIdx  = STAGE_ORDER.indexOf(stage);

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/50 z-40 transition-opacity duration-500 ${
          isTransitioning ? "opacity-0" : "opacity-100"
        }`}
        aria-hidden
      />

      {/* Card */}
      <div className="fixed z-50 inset-0 flex items-center justify-center pointer-events-none">
        <div
          className={`
            w-full max-w-2xl mx-4 bg-white rounded-2xl shadow-2xl flex flex-col
            max-h-[90vh] pointer-events-auto
            transition-all duration-700 ease-in-out
            ${isTransitioning
              ? "translate-x-[calc(50vw_-_80px)] scale-[0.35] opacity-0"
              : "translate-x-0 scale-100 opacity-100"
            }
          `}
          style={{ transformOrigin: "center center" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#e8eaed] bg-white rounded-t-2xl shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-[#1a73e8] flex items-center justify-center shadow-sm">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-gray-900">Setup Concierge</h2>
                <p className="text-xs text-gray-400">
                  Step {Math.min(stageIdx + 1, 7)} of 7
                  {config.companyName ? ` · ${config.companyName}` : ""}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={handleReset} className="p-1.5 rounded-full hover:bg-[#f1f3f4] text-gray-400 transition-colors" title="Start over">
                <RotateCcw className="w-4 h-4" />
              </button>
              <button onClick={close} className="p-1.5 rounded-full hover:bg-[#f1f3f4] text-gray-400 transition-colors" aria-label="Close">
                <X className="w-[18px] h-[18px]" />
              </button>
            </div>
          </div>

          {/* Progress bar */}
          {!isDone && <ProgressBar currentStage={stage} />}

          {/* Messages */}
          <div className="flex-1 min-h-0 overflow-y-auto">
            <div className="flex flex-col px-4 py-4">
              {displayMessages.map((msg) => {
                if (msg.role === "concierge" && msg.text.startsWith("__tool")) {
                  const done  = msg.text.startsWith("__tool_done__");
                  const label = msg.text.replace(/^__tool(?:_done)?__:/, "");
                  return (
                    <div key={msg.id} className="flex justify-center mb-3">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs border ${
                        done
                          ? "bg-green-50 border-green-100 text-green-700"
                          : "bg-blue-50 border-blue-100 text-blue-600"
                      }`}>
                        {done ? `✓ ${label}` : <><Loader2 className="w-3 h-3 animate-spin" />{label}…</>}
                      </span>
                    </div>
                  );
                }
                return <MessageBubble key={msg.id} message={msg} />;
              })}

              {/* Widget — hidden while AI is running; stage locked to widgetStage */}
              {!isDone && !isRunning && (
                <div className="mt-1">
                  <StageWidget
                    currentStage={widgetStage}
                    onUserMessages={(msgs) => {
                      // Include actual submitted data in the message so the AI stores it
                      const text = Array.isArray(msgs) ? msgs.join(" · ") : String(msgs);
                      sendMessage(text);
                    }}
                  />
                </div>
              )}

              <div ref={bottomRef} />
            </div>
          </div>

          {/* Input bar */}
          {!isDone && (
            <div className="px-4 py-3 border-t border-[#e8eaed] bg-white rounded-b-2xl shrink-0 flex items-center gap-2">
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); const t = input.trim(); if (t) { setInput(""); sendMessage(t); } } }}
                placeholder={isRunning ? "Concierge is thinking…" : "Ask a question or type your answer…"}
                disabled={isRunning}
                className="flex-1 text-sm text-gray-900 placeholder-gray-400 bg-transparent focus:outline-none disabled:opacity-50"
                autoFocus
              />
              <button
                onClick={() => { const t = input.trim(); if (t) { setInput(""); sendMessage(t); } }}
                disabled={!input.trim() || isRunning}
                className="w-8 h-8 rounded-full bg-[#1a73e8] text-white flex items-center justify-center hover:bg-[#1557b0] disabled:opacity-40 transition-colors shrink-0"
              >
                {isRunning
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <Send className="w-3.5 h-3.5" />
                }
              </button>
            </div>
          )}

          {/* Done footer */}
          {isDone && (
            <div className="px-5 py-4 border-t border-[#e8eaed] bg-[#f8f9fa] rounded-b-2xl shrink-0">
              <button
                onClick={() => { close(); openAssistant(); }}
                className="w-full py-2.5 text-sm font-medium bg-[#1a73e8] text-white rounded-xl hover:bg-[#1557b0] transition-colors"
              >
                Open Settings Sidekick →
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
