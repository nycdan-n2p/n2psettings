"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { getAccessToken } from "@/lib/auth";
import { Bot, Send, Loader2, RotateCcw, Paperclip } from "lucide-react";
import type Anthropic from "@anthropic-ai/sdk";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

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

interface DisplayMessage {
  id: string;
  role: "user" | "assistant" | "tool";
  text: string;
  isLoading?: boolean;
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function formatPhone(raw: string) {
  const d = raw.replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("1"))
    return `+1 (${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
  if (d.length === 10)
    return `+1 (${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  return raw;
}

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/[^a-z]/g, ""));
  return lines.slice(1).map((line) => {
    const vals = line.split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
    return Object.fromEntries(headers.map((h, i) => [h, vals[i] ?? ""]));
  });
}

function csvRowToUser(row: Record<string, string>) {
  return {
    firstName: row.firstname ?? row.first ?? row.fname ?? "",
    lastName: row.lastname ?? row.last ?? row.lname ?? "",
    email: row.email ?? row.emailaddress ?? "",
    role: (row.role ?? "user") as "user" | "admin",
    timeZone: row.timezone ?? row.tz ?? "",
    phoneNumber: row.phone ?? row.phonenumber ?? row.did ?? "",
  };
}

const TOOL_LABELS: Record<string, string> = {
  get_account_summary: "Checking account capacity",
  get_next_extension: "Getting next available extension",
  get_available_numbers: "Fetching available phone numbers",
  search_users: "Searching users",
  create_user: "Creating user account",
  list_ring_groups: "Loading ring groups",
  get_ring_group: "Loading ring group details",
  create_ring_group: "Creating ring group",
  add_user_to_ring_group: "Adding user to ring group",
  set_ring_group_members: "Setting ring group members",
  set_ring_group_tiers: "Configuring ring group tiers",
  list_call_queues: "Loading call queues",
  create_call_queue: "Creating call queue",
  add_user_to_call_queue: "Adding user to call queue",
  set_call_queue_agents: "Setting call queue agents",
  update_call_queue: "Updating call queue settings",
  list_departments: "Loading departments",
  create_department: "Creating department",
  assign_user_to_department: "Assigning user to department",
  list_virtual_assistants: "Loading welcome menus",
  create_virtual_assistant: "Creating welcome menu",
  generate_tts_greeting: "Generating greeting audio",
  set_menu_options: "Setting menu options",
  list_licenses: "Checking licenses",
  get_user_call_stats: "Fetching call statistics",
  get_account_call_stats: "Fetching account analytics",
  search_support: "Searching support articles",
  create_schedule: "Creating schedule",
  build_call_flow: "Building call flow",
};

function getOnboardingData(): Record<string, unknown> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("n2p_concierge_state");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.config ?? null;
  } catch {
    return null;
  }
}

function buildOnboardingSummary(config: Record<string, unknown>): string | undefined {
  if (!config) return undefined;
  const lines: string[] = [];
  if (config.companyName) lines.push(`Company: ${config.companyName}`);
  const scraped = config.scraped as Record<string, unknown> | undefined;
  if (scraped?.timezone) lines.push(`Timezone: ${scraped.timezone}`);
  if (scraped?.location) lines.push(`Location: ${scraped.location}`);
  const users = config.users as Array<Record<string, string>> | undefined;
  lines.push(`Users created: ${users?.length ?? 0}`);
  const depts = config.departments as string[] | undefined;
  lines.push(`Departments: ${depts?.length ? depts.join(", ") : "none"}`);
  const routing = config.routingType as string | undefined;
  const rc = config.routingConfig as Record<string, unknown> | undefined;
  lines.push(`Routing: ${routing === "call_queues" ? "Call Queues" : "Ring Groups"}${rc?.groupName ? ` ("${rc.groupName}")` : ""}`);
  const wm = config.welcomeMenu as Record<string, unknown> | undefined;
  lines.push(`Welcome menu: ${wm?.enabled ? "enabled" : "not set up"}`);
  const ah = config.afterHours as Record<string, unknown> | undefined;
  lines.push(`After-hours: ${ah?.action ?? "voicemail"}`);
  const pq = config.portingQueue as Record<string, unknown> | undefined;
  const portNums = pq?.numbers as string[] | undefined;
  lines.push(`Porting: ${pq?.skipped ? "skipped" : portNums?.length ? `${portNums.length} number(s)` : "not configured"}`);
  const holidays = config.holidays as Array<unknown> | undefined;
  lines.push(`Holidays: ${holidays?.length ? `${holidays.length} loaded` : "none"}`);
  const phoneType = config.phoneType as string | undefined;
  lines.push(`Phone type: ${phoneType ?? "softphone"}`);
  return lines.join("\n");
}

function getInitialMessage(onboardingConfig: Record<string, unknown> | null): DisplayMessage {
  if (onboardingConfig && onboardingConfig.companyName) {
    const users = (onboardingConfig.users as Array<unknown>)?.length ?? 0;
    const company = onboardingConfig.companyName as string;
    return {
      id: "init",
      role: "assistant",
      text: `Welcome back! I\u2019m the N2P Sidekick. I can see you just finished setting up **${company}** through the onboarding concierge.\n\nI have all the same capabilities and more \u2014 I can create users, ring groups, call queues, welcome menus, departments, and full call flows.\n\n${users === 0 ? "I notice you haven\u2019t added any team members yet \u2014 want to start there?" : "What would you like to work on next?"}`,
    };
  }
  return {
    id: "init",
    role: "assistant",
    text: "Hi! I\u2019m the N2P Sidekick. I can:\n\n\u2022 Create users, ring groups, call queues, departments\n\u2022 Set up welcome menus with greetings and DTMF routing\n\u2022 Build complete call flows (work hours, after-hours, overflow)\n\u2022 Assign phone numbers and manage your team\n\u2022 Pull call stats and analytics\n\u2022 Bulk-create users from a CSV (click the \uD83D\uDCCE icon)\n\nWhat would you like to do?",
  };
}

function UserBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-end mb-3">
      <div className="max-w-[75%] bg-[#1a73e8] text-white rounded-[20px] rounded-tr-sm px-4 py-2.5 text-sm whitespace-pre-wrap">
        {text}
      </div>
    </div>
  );
}

function AssistantBubble({ text, isLoading }: { text: string; isLoading?: boolean }) {
  return (
    <div className="flex items-start gap-2.5 mb-3">
      <div className="w-7 h-7 rounded-full bg-[#1a73e8] flex items-center justify-center flex-shrink-0 mt-0.5">
        <Bot className="w-3.5 h-3.5 text-white" />
      </div>
      <div className="max-w-[80%] bg-white border border-[#dadce0] rounded-[20px] rounded-tl-sm px-4 py-2.5 text-sm text-gray-800 shadow-sm">
        {isLoading ? (
          <span className="flex items-center gap-1.5 text-gray-400">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Thinking…
          </span>
        ) : (
          <div className="prose prose-sm max-w-none
            prose-p:my-1 prose-p:leading-relaxed
            prose-ul:my-1 prose-ul:pl-4
            prose-ol:my-1 prose-ol:pl-4
            prose-li:my-0.5
            prose-strong:font-semibold prose-strong:text-gray-900
            prose-table:text-xs prose-table:border-collapse
            prose-th:border prose-th:border-gray-200 prose-th:bg-gray-50 prose-th:px-2 prose-th:py-1 prose-th:text-left prose-th:font-medium
            prose-td:border prose-td:border-gray-200 prose-td:px-2 prose-td:py-1
            prose-code:bg-gray-100 prose-code:px-1 prose-code:rounded prose-code:text-xs prose-code:font-mono
            prose-headings:font-semibold prose-headings:text-gray-900 prose-h3:text-sm prose-h3:mt-2">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}

function ToolBadge({ text, done }: { text: string; done?: boolean }) {
  return (
    <div className="flex justify-center mb-2">
      <span
        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs border ${
          done
            ? "bg-green-50 border-green-100 text-green-700"
            : "bg-blue-50 border-blue-100 text-blue-600"
        }`}
      >
        {done ? (
          "✓ " + text
        ) : (
          <>
            <Loader2 className="w-3 h-3 animate-spin" />
            {text}…
          </>
        )}
      </span>
    </div>
  );
}

export function AssistantChat({ compact = false }: { compact?: boolean }) {
  const onboardingConfig = useRef(getOnboardingData());
  const onboardingSummary = useRef(buildOnboardingSummary(onboardingConfig.current ?? {}));

  const [displayMessages, setDisplayMessages] = useState<DisplayMessage[]>(() => [
    getInitialMessage(onboardingConfig.current),
  ]);
  const [apiMessages, setApiMessages] = useState<ApiMessage[]>([]);
  const [input, setInput] = useState("");
  const [isAgentRunning, setIsAgentRunning] = useState(false);

  const chatContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = chatContainerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [displayMessages]);

  const executeTool = useCallback(
    async (name: string, toolInput: Record<string, unknown>): Promise<unknown> => {
      const token = getAccessToken();
      if (!token) {
        return { error: "Not authenticated. Please log in again." };
      }
      const res = await fetch("/api/n2p-tools", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ tool: name, input: toolInput }),
      });
      const json = await res.json();
      if (res.status === 401) {
        return { error: "Session expired. Please log in again." };
      }
      if (res.status >= 400) {
        return { error: json.error ?? "Tool failed" };
      }
      return json.data;
    },
    []
  );

  const driveLoop = useCallback(
    async (messages: ApiMessage[], activeBubbleId: string): Promise<ApiMessage[]> => {
      while (true) {
        let response: ApiResponse;
        try {
          const res = await fetch("/api/onboarding-agent", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              messages,
              onboardingSummary: onboardingSummary.current,
            }),
          });
          response = await res.json();
        } catch {
          setDisplayMessages((prev) =>
            prev.map((m) =>
              m.id === activeBubbleId
                ? { ...m, isLoading: false, text: "Network error. Please try again." }
                : m
            )
          );
          return messages;
        }

        if (response.error) {
          setDisplayMessages((prev) =>
            prev.map((m) =>
              m.id === activeBubbleId
                ? { ...m, isLoading: false, text: `Error: ${response.error}` }
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
                ? { ...m, isLoading: false, text: textContent || "Done." }
                : m
            )
          );
          return [
            ...messages,
            { role: "assistant", content: response.content as Anthropic.ContentBlockParam[] },
          ];
        }

        if (response.stop_reason === "tool_use") {
          if (textContent) {
            setDisplayMessages((prev) =>
              prev.map((m) =>
                m.id === activeBubbleId ? { ...m, isLoading: false, text: textContent } : m
              )
            );
          }

          const toolUseBlocks = (response.content ?? []).filter(
            (
              b
            ): b is {
              type: "tool_use";
              id: string;
              name: string;
              input: Record<string, unknown>;
            } => b.type === "tool_use"
          );

          const toolResults: {
            type: "tool_result";
            tool_use_id: string;
            content: string;
          }[] = [];

          for (const tool of toolUseBlocks) {
            const badgeId = uid();
            setDisplayMessages((prev) => [
              ...prev,
              { id: badgeId, role: "tool", text: TOOL_LABELS[tool.name] ?? tool.name },
            ]);

            let result: unknown;
            try {
              result = await executeTool(tool.name, tool.input);
            } catch (e) {
              result = { error: e instanceof Error ? e.message : "Tool failed" };
            }

            setDisplayMessages((prev) =>
              prev.map((m) =>
                m.id === badgeId
                  ? { ...m, text: (TOOL_LABELS[tool.name] ?? tool.name) + " ✓" }
                  : m
              )
            );

            toolResults.push({
              type: "tool_result",
              tool_use_id: tool.id,
              content: JSON.stringify(result),
            });
          }

          const nextBubbleId = uid();
          setDisplayMessages((prev) => {
            const withoutEmpty = prev.filter(
              (m) => !(m.id === activeBubbleId && m.isLoading && !m.text)
            );
            return [
              ...withoutEmpty,
              { id: nextBubbleId, role: "assistant", text: "", isLoading: true },
            ];
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
    [executeTool]
  );

  const sendMessage = useCallback(
    async (text: string, showUserBubble = true) => {
      if (!text.trim() || isAgentRunning) return;
      setIsAgentRunning(true);

      if (showUserBubble) {
        setDisplayMessages((prev) => [...prev, { id: uid(), role: "user", text }]);
      }

      const bubbleId = uid();
      setDisplayMessages((prev) => [
        ...prev,
        { id: bubbleId, role: "assistant", text: "", isLoading: true },
      ]);

      const nextMessages: ApiMessage[] = [...apiMessages, { role: "user", content: text }];
      const finalMessages = await driveLoop(nextMessages, bubbleId);
      setApiMessages(finalMessages);
      setIsAgentRunning(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    },
    [apiMessages, driveLoop, isAgentRunning]
  );

  const handleSend = () => {
    const text = input.trim();
    if (!text) return;
    setInput("");
    sendMessage(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const rows = parseCsv(text);
      if (rows.length === 0) {
        setDisplayMessages((prev) => [
          ...prev,
          {
            id: uid(),
            role: "assistant",
            text: "Couldn't parse that CSV. Make sure it has headers: firstName, lastName, email (and optionally role, timezone, phone).",
          },
        ]);
        return;
      }
      const users = rows.map(csvRowToUser).filter((u) => u.firstName && u.email);
      if (users.length === 0) {
        setDisplayMessages((prev) => [
          ...prev,
          {
            id: uid(),
            role: "assistant",
            text: "No valid rows found. CSV must have at least firstName and email columns.",
          },
        ]);
        return;
      }

      const summary = users
        .map((u, i) => `${i + 1}. ${u.firstName} ${u.lastName} — ${u.email}${u.phoneNumber ? ` (${formatPhone(u.phoneNumber)})` : ""}`)
        .join("\n");

      const agentMessage = `I uploaded a CSV with ${users.length} user${users.length > 1 ? "s" : ""}:\n${summary}\n\nPlease create all of them. For each person, use get_next_extension to suggest an extension. If a phone number is listed in the CSV, assign it; otherwise skip phone number assignment.`;

      setDisplayMessages((prev) => [
        ...prev,
        { id: uid(), role: "user", text: `📎 CSV uploaded: ${users.length} user${users.length > 1 ? "s" : ""}` },
      ]);

      sendMessage(agentMessage, false);
    };
    reader.readAsText(file);
  };

  const handleReset = () => {
    onboardingConfig.current = getOnboardingData();
    onboardingSummary.current = buildOnboardingSummary(onboardingConfig.current ?? {});
    setDisplayMessages([getInitialMessage(onboardingConfig.current)]);
    setApiMessages([]);
    setInput("");
    inputRef.current?.focus();
  };

  return (
    <div className={`flex flex-col ${compact ? "h-full min-h-0 overflow-hidden" : "h-[calc(100vh-8rem)]"}`}>
      {!compact && (
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-medium text-gray-900">N2P Sidekick</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Create users · Ring groups · Call queues · Welcome menus · Departments · Call flows
            </p>
          </div>
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            New session
          </button>
        </div>
      )}

      <div
        ref={chatContainerRef}
        className={`flex-1 overflow-y-auto bg-white ${compact ? "rounded-none" : "rounded-t-xl border border-[#dadce0] border-b-0"} px-4 py-5`}
      >
        {displayMessages.map((msg) => {
          if (msg.role === "user") return <UserBubble key={msg.id} text={msg.text} />;
          if (msg.role === "tool") {
            const done = msg.text.endsWith(" ✓");
            return <ToolBadge key={msg.id} text={done ? msg.text.slice(0, -2) : msg.text} done={done} />;
          }
          return <AssistantBubble key={msg.id} text={msg.text} isLoading={msg.isLoading} />;
        })}
      </div>

      <div className={`bg-white ${compact ? "border-t border-gray-200" : "border border-[#dadce0] rounded-b-xl"} px-4 py-3 flex items-center gap-2 shadow-sm`}>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={handleCsvUpload}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isAgentRunning}
          title="Upload CSV of users"
          className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-[#1a73e8] hover:bg-blue-50 disabled:opacity-40 transition-colors flex-shrink-0"
        >
          <Paperclip className="w-4 h-4" />
        </button>

        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isAgentRunning ? "Working…" : "Add users, check stats, manage ring groups…"}
          disabled={isAgentRunning}
          autoFocus={compact}
          className="flex-1 bg-transparent text-sm text-gray-900 placeholder-gray-400 focus:outline-none disabled:opacity-50"
        />

        <button
          onClick={handleSend}
          disabled={!input.trim() || isAgentRunning}
          className="w-8 h-8 rounded-full bg-[#1a73e8] text-white flex items-center justify-center hover:bg-[#1557b0] disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex-shrink-0"
        >
          {isAgentRunning ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-3.5 h-3.5" />
          )}
        </button>
      </div>
    </div>
  );
}
