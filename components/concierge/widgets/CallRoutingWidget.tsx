"use client";

import { useState } from "react";
import { CheckSquare, Square, Plus, Trash2, Clock, Upload, Loader2, AlertCircle, ShieldCheck } from "lucide-react";
import { useConcierge, type MenuOption, type QueueStrategy } from "@/contexts/ConciergeContext";
import { checkLicensing } from "@/lib/api/concierge-backend";
import { getAccessToken } from "@/lib/auth";
import { CardShell, FixItButton } from "./shared";


type RoutingStep = "welcome_menu" | "routing_type" | "after_hours";

const STRATEGY_OPTIONS: { value: QueueStrategy; label: string }[] = [
  { value: "ring_all", label: "Ring All" },
  { value: "round_robin", label: "Round Robin" },
  { value: "longest_idle", label: "Longest Idle" },
  { value: "linear", label: "Linear" },
  { value: "fewest_calls", label: "Fewest Calls" },
];

const DEST_TYPES = ["department", "ring_group", "voicemail", "directory", "user"] as const;

export function deriveRoutingStep(config: { welcomeMenu: { configured?: boolean }; routingConfig: { groupName: string } }): RoutingStep {
  if (config.routingConfig.groupName) return "after_hours";
  if (config.welcomeMenu.configured) return "routing_type";
  return "welcome_menu";
}

export function CallRoutingWidget({ onMessages }: { onMessages: (msgs: string[]) => void }) {
  const { config, updateConfig } = useConcierge();

  const [step, setStep] = useState<RoutingStep>(() => deriveRoutingStep(config));

  // Welcome menu state
  const [menuEnabled, setMenuEnabled] = useState(config.welcomeMenu.enabled);
  const [greetingType, setGreetingType] = useState<"tts" | "upload" | "none">(config.welcomeMenu.greetingType || "tts");
  const defaultGreeting = `Thank you for calling ${config.companyName || "our company"}. ${config.departments.length > 0 ? config.departments.map((d, i) => `Press ${i + 1} for ${d}`).join(". ") + "." : "Please hold while we connect you."}`;
  const [greetingText, setGreetingText] = useState(config.welcomeMenu.greetingText || defaultGreeting);
  const [menuOptions, setMenuOptions] = useState<MenuOption[]>(
    config.welcomeMenu.menuOptions.length > 0
      ? config.welcomeMenu.menuOptions
      : config.departments.map((d, i) => ({ key: String(i + 1), destinationType: "department" as const, destinationName: d }))
  );
  const [extDialing, setExtDialing] = useState(config.welcomeMenu.allowExtensionDialing ?? true);
  const [playWait, setPlayWait] = useState(config.welcomeMenu.playWaitMessage ?? true);
  const [barging, setBarging] = useState(config.welcomeMenu.allowBargingThrough ?? true);

  // Routing type state
  const [routingChoice, setRoutingChoice] = useState<"ring_groups" | "call_queues">(config.routingType);
  const [checking, setChecking] = useState(false);
  const [eligible, setEligible] = useState<boolean | null>(null);
  const [groupName, setGroupName] = useState(config.routingConfig.groupName || `${config.companyName || "Main"} Team`);
  const [ringStrategy, setRingStrategy] = useState<QueueStrategy>(config.routingConfig.ringStrategy);
  const [maxWaitTime, setMaxWaitTime] = useState(config.routingConfig.maxWaitTime || 300);
  const [maxCapacity, setMaxCapacity] = useState(config.routingConfig.maxCapacity || 10);
  const [tiered, setTiered] = useState(config.routingConfig.tiers.length > 1);
  const [tiers, setTiers] = useState<{ userEmails: string[]; rings: number }[]>(
    config.routingConfig.tiers.length > 0
      ? config.routingConfig.tiers
      : [{ userEmails: config.users.map((u) => u.email ?? "").filter((e): e is string => e !== ""), rings: 3 }]
  );

  // Schedule state
  const hasBusinessHours = Object.keys(config.scraped.hours).length > 0;
  const [scheduleType, setScheduleType] = useState<"24_7" | "business_hours" | "custom">(
    config.routingConfig.scheduleType || "24_7"
  );
  const [customDays, setCustomDays] = useState<number[]>(
    config.routingConfig.customSchedule?.weekDays ?? [1, 2, 3, 4, 5]
  );
  const [customStart, setCustomStart] = useState(config.routingConfig.customSchedule?.start ?? "09:00");
  const [customEnd, setCustomEnd] = useState(config.routingConfig.customSchedule?.end ?? "17:00");

  // After-hours state
  const [afterAction, setAfterAction] = useState(config.afterHours.action);
  const [afterGreeting, setAfterGreeting] = useState(config.afterHours.greetingText ?? "");
  const [afterForwardNum, setAfterForwardNum] = useState(config.afterHours.forwardNumber ?? "");

  const addMenuOption = () => {
    const nextKey = String(menuOptions.length + 1);
    setMenuOptions((o) => [...o, { key: nextKey, destinationType: "department", destinationName: "" }]);
  };

  const removeMenuOption = (idx: number) => {
    setMenuOptions((o) => o.filter((_, i) => i !== idx));
  };

  const updateMenuOption = (idx: number, patch: Partial<MenuOption>) => {
    setMenuOptions((o) => o.map((item, i) => i === idx ? { ...item, ...patch } : item));
  };

  const addTier = () => {
    setTiers((t) => [...t, { userEmails: [], rings: 3 }]);
  };

  const removeTier = (idx: number) => {
    setTiers((t) => t.filter((_, i) => i !== idx));
  };

  const handleRoutingChoice = async (type: "ring_groups" | "call_queues") => {
    setRoutingChoice(type);
    if (type === "call_queues") {
      setChecking(true);
      const ok = await checkLicensing("call_queues", getAccessToken() ?? undefined);
      setEligible(ok);
      setChecking(false);
    } else {
      setEligible(true);
    }
  };

  // Step handlers
  const handleMenuNext = () => {
    const menu = {
      enabled: menuEnabled,
      greetingType: menuEnabled ? greetingType : "none" as const,
      greetingText: menuEnabled && greetingType === "tts" ? greetingText : "",
      menuOptions: menuEnabled ? menuOptions.filter((o) => o.destinationName.trim()) : [],
      allowExtensionDialing: extDialing,
      playWaitMessage: playWait,
      allowBargingThrough: barging,
      configured: true,
    };
    updateConfig({ welcomeMenu: menu });
    const feats = [extDialing && "ext-dialing", playWait && "wait-msg", barging && "barging"].filter(Boolean).join(", ");
    const summary = menuEnabled
      ? `[routing] Welcome menu enabled. Greeting: ${greetingType}${greetingType === "tts" ? ` "${greetingText.slice(0, 50)}..."` : ""}. Options: ${menu.menuOptions.map((o) => `${o.key}\u2192${o.destinationName}`).join(", ")}. Features: ${feats || "none"}`
      : "[routing] Welcome menu disabled.";
    onMessages([summary]);
    setStep("routing_type");
  };

  const handleRoutingNext = () => {
    const rc = {
      groupName,
      scheduleType,
      customSchedule: scheduleType === "custom" ? { name: `${groupName} Hours`, weekDays: customDays, start: customStart, end: customEnd } : undefined,
      tiers: routingChoice === "ring_groups" ? (tiered ? tiers : [{ userEmails: config.users.map((u) => u.email ?? "").filter((e): e is string => e !== ""), rings: 3 }]) : [],
      ringStrategy: routingChoice === "call_queues" ? ringStrategy : "ring_all" as QueueStrategy,
      maxWaitTime: routingChoice === "call_queues" ? maxWaitTime : 0,
      maxCapacity: routingChoice === "call_queues" ? maxCapacity : 0,
    };
    updateConfig({ routingType: routingChoice, licensingVerified: eligible === true, routingConfig: rc });
    const label = routingChoice === "ring_groups" ? "Ring Groups" : "Call Queues";
    const schedLabel = scheduleType === "24_7" ? "24/7" : scheduleType === "business_hours" ? "Business hours" : `Custom (${customStart}-${customEnd})`;
    const detail = routingChoice === "call_queues"
      ? ` (${STRATEGY_OPTIONS.find((s) => s.value === ringStrategy)?.label}, max wait ${maxWaitTime}s, capacity ${maxCapacity})`
      : tiered ? ` (${tiers.length} tiers)` : " (Ring All)";
    onMessages([`[routing] Routing: ${label} "${groupName}"${detail}. Schedule: ${schedLabel}`]);
    setStep("after_hours");
  };

  const handleAfterHoursNext = () => {
    const ah = {
      action: afterAction,
      ...(afterAction === "greeting" && { greetingText: afterGreeting }),
      ...(afterAction === "forward" && { forwardNumber: afterForwardNum }),
    };
    updateConfig({ afterHours: ah });
    const desc = afterAction === "voicemail" ? "Voicemail" : afterAction === "greeting" ? `Custom greeting: "${afterGreeting.slice(0, 40)}..."` : `Forward to ${afterForwardNum}`;
    onMessages([`[routing] After-hours: ${desc}. Call routing setup complete.`]);
  };

  // ── Sub-step: Welcome Menu ─────────────────────────────────────────────────
  if (step === "welcome_menu") {
    return (
      <CardShell>
        <div className="space-y-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Step 1 of 3 &mdash; Welcome Menu</p>
          <p className="text-xs text-gray-500">An auto-attendant greets callers and routes them via key presses (Press 1 for Sales, etc.).</p>

          <div className="flex gap-2">
            <button onClick={() => setMenuEnabled(true)} aria-pressed={menuEnabled}
              className={`flex-1 py-2 text-sm font-medium rounded-lg border transition-all ${menuEnabled ? "border-[#1a73e8] bg-[#e8f0fe] text-[#1a73e8]" : "border-[#dadce0] text-gray-600 hover:bg-[#f8f9fa]"}`}>
              Yes, use a welcome menu
            </button>
            <button onClick={() => setMenuEnabled(false)} aria-pressed={!menuEnabled}
              className={`flex-1 py-2 text-sm font-medium rounded-lg border transition-all ${!menuEnabled ? "border-[#1a73e8] bg-[#e8f0fe] text-[#1a73e8]" : "border-[#dadce0] text-gray-600 hover:bg-[#f8f9fa]"}`}>
              No, skip
            </button>
          </div>

          {menuEnabled && (
            <>
              {/* Greeting type */}
              <div>
                <p className="text-xs font-medium text-gray-600 mb-1.5">Greeting</p>
                <div className="flex gap-2">
                  {([
                    { value: "tts" as const, label: "Text-to-Speech" },
                    { value: "upload" as const, label: "Upload Custom" },
                    { value: "none" as const, label: "No Greeting" },
                  ]).map(({ value, label }) => (
                    <button key={value} onClick={() => setGreetingType(value)}
                      aria-pressed={greetingType === value}
                      className={`flex-1 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                        greetingType === value ? "border-[#1a73e8] bg-[#e8f0fe] text-[#1a73e8]" : "border-[#dadce0] text-gray-600 hover:bg-[#f8f9fa]"
                      }`}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              {greetingType === "tts" && (
                <div>
                  <label htmlFor="greeting-text" className="block text-xs font-medium text-gray-600 mb-1">Greeting Text</label>
                  <textarea
                    id="greeting-text"
                    value={greetingText}
                    onChange={(e) => setGreetingText(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 text-sm border border-[#dadce0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1a73e8] bg-white resize-none"
                  />
                  <p className="text-xs text-gray-400 mt-1">We&apos;ll generate audio from this text when your system is built.</p>
                </div>
              )}
              {greetingType === "upload" && (
                <div className="rounded-lg border-2 border-dashed border-[#dadce0] px-4 py-3 text-center">
                  <Upload className="w-5 h-5 mx-auto text-gray-400 mb-1" aria-hidden="true" />
                  <p className="text-xs text-gray-500">Custom greeting upload will be available after setup is built.</p>
                </div>
              )}

              {/* Menu Options (DTMF) */}
              <div>
                <p className="text-xs font-medium text-gray-600 mb-2">Menu Options (DTMF keys)</p>
                <div className="space-y-2">
                  {menuOptions.map((opt, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        value={opt.key}
                        onChange={(e) => updateMenuOption(i, { key: e.target.value })}
                        className="w-10 px-2 py-1.5 text-sm text-center border border-[#dadce0] rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-[#1a73e8]"
                        maxLength={1}
                        aria-label={`Key for option ${i + 1}`}
                      />
                      <select
                        value={opt.destinationType}
                        onChange={(e) => updateMenuOption(i, { destinationType: e.target.value as MenuOption["destinationType"] })}
                        aria-label={`Destination type for option ${i + 1}`}
                        className="w-28 text-xs px-2 py-1.5 border border-[#dadce0] rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-[#1a73e8]"
                      >
                        {DEST_TYPES.map((t) => <option key={t} value={t}>{t.replace("_", " ")}</option>)}
                      </select>
                      <input
                        value={opt.destinationName}
                        onChange={(e) => updateMenuOption(i, { destinationName: e.target.value })}
                        placeholder="e.g. Sales"
                        aria-label={`Destination name for option ${i + 1}`}
                        className="flex-1 px-2.5 py-1.5 text-sm border border-[#dadce0] rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-[#1a73e8]"
                      />
                      <button onClick={() => removeMenuOption(i)} className="text-gray-300 hover:text-red-500" aria-label={`Remove option ${i + 1}`}>
                        <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  ))}
                </div>
                <button onClick={addMenuOption} className="flex items-center gap-1.5 text-xs text-[#1a73e8] hover:underline mt-2">
                  <Plus className="w-3 h-3" aria-hidden="true" /> Add option
                </button>
              </div>

              {/* Business features */}
              <div>
                <p className="text-xs font-medium text-gray-600 mb-2">Menu Settings</p>
                <div className="space-y-2">
                  {([
                    { key: "extDialing" as const, label: "Allow Extension Dialing", desc: "Callers can dial an extension directly", checked: extDialing, set: setExtDialing },
                    { key: "playWait" as const, label: "Play \"Please wait while we connect your call\"", desc: "Play a hold message before connecting", checked: playWait, set: setPlayWait },
                    { key: "barging" as const, label: "Allow Barging Through", desc: "Allow callers to interrupt the greeting", checked: barging, set: setBarging },
                  ]).map(({ key, label, desc, checked, set }) => (
                    <label key={key} className="flex items-start gap-2.5 cursor-pointer">
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={checked}
                        onClick={() => set(!checked)}
                        className="mt-0.5 shrink-0"
                      >
                        {checked
                          ? <CheckSquare className="w-4 h-4 text-[#1a73e8]" aria-hidden="true" />
                          : <Square className="w-4 h-4 text-gray-400" aria-hidden="true" />}
                      </button>
                      <div>
                        <p className="text-xs font-medium text-gray-700">{label}</p>
                        <p className="text-xs text-gray-400">{desc}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </>
          )}

          <button onClick={handleMenuNext}
            className="w-full py-2 text-sm font-medium bg-[#1a73e8] text-white rounded-lg hover:bg-[#1557b0] transition-colors">
            Next
          </button>
          <FixItButton targetStage="architecture_hardware" />
        </div>
      </CardShell>
    );
  }

  // ── Sub-step: Routing Type ─────────────────────────────────────────────────
  if (step === "routing_type") {
    return (
      <CardShell>
        <div className="space-y-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Step 2 of 3 &mdash; Routing Type</p>

          <div className="space-y-2" role="radiogroup" aria-label="Routing type">
            {([
              { value: "ring_groups" as const, label: "Ring Groups", desc: "Included with all plans. Rings members simultaneously or in tiers." },
              { value: "call_queues" as const, label: "Call Queues", desc: "Requires license. Callers wait in line. Multiple ring strategies." },
            ]).map(({ value, label, desc }) => (
              <button key={value} onClick={() => handleRoutingChoice(value)}
                role="radio" aria-checked={routingChoice === value}
                className={`w-full flex items-start gap-3 p-3 rounded-xl border text-left transition-all ${
                  routingChoice === value ? "border-[#1a73e8] bg-[#e8f0fe]" : "border-[#dadce0] bg-white hover:bg-[#f8f9fa]"
                }`}>
                <div className={`w-4 h-4 rounded-full border-2 mt-0.5 shrink-0 flex items-center justify-center ${
                  routingChoice === value ? "border-[#1a73e8]" : "border-[#dadce0]"
                }`}>
                  {routingChoice === value && <div className="w-2 h-2 rounded-full bg-[#1a73e8]" />}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-800">{label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
                </div>
              </button>
            ))}
          </div>

          {routingChoice === "call_queues" && checking && (
            <p className="flex items-center gap-2 text-xs text-gray-500" role="status">
              <Loader2 className="w-3.5 h-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" /> Checking license&hellip;
            </p>
          )}
          {routingChoice === "call_queues" && eligible === false && !checking && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800" role="alert">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <p className="font-semibold">Call Queue license not found</p>
                <p className="mt-0.5">Contact your net2phone account manager to add this feature, or use Ring Groups instead.</p>
              </div>
            </div>
          )}
          {routingChoice === "call_queues" && eligible === true && !checking && (
            <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-xl text-xs text-green-800" role="status">
              <ShieldCheck className="w-4 h-4 shrink-0" aria-hidden="true" />
              <p className="font-semibold">Call Queue license verified</p>
            </div>
          )}

          {/* Group/Queue name */}
          <div>
            <label htmlFor="group-name" className="block text-xs font-medium text-gray-600 mb-1">
              {routingChoice === "ring_groups" ? "Ring Group Name" : "Call Queue Name"}
            </label>
            <input id="group-name" value={groupName} onChange={(e) => setGroupName(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-[#dadce0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1a73e8] bg-white" />
          </div>

          {/* Ring Group specific: tiered or ring all */}
          {routingChoice === "ring_groups" && (
            <div className="space-y-2">
              <div className="flex gap-2">
                <button onClick={() => setTiered(false)} aria-pressed={!tiered}
                  className={`flex-1 py-2 text-xs font-medium rounded-lg border ${!tiered ? "border-[#1a73e8] bg-[#e8f0fe] text-[#1a73e8]" : "border-[#dadce0] text-gray-600 hover:bg-[#f8f9fa]"}`}>
                  Ring All (simultaneous)
                </button>
                <button onClick={() => setTiered(true)} aria-pressed={tiered}
                  className={`flex-1 py-2 text-xs font-medium rounded-lg border ${tiered ? "border-[#1a73e8] bg-[#e8f0fe] text-[#1a73e8]" : "border-[#dadce0] text-gray-600 hover:bg-[#f8f9fa]"}`}>
                  Tiered (escalation)
                </button>
              </div>
              {tiered && (
                <div className="space-y-2">
                  {tiers.map((tier, ti) => (
                    <div key={ti} className="p-3 bg-white border border-[#e8eaed] rounded-xl space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-gray-600">Tier {ti + 1}</p>
                        {tiers.length > 1 && (
                          <button onClick={() => removeTier(ti)} className="text-gray-300 hover:text-red-500" aria-label={`Remove tier ${ti + 1}`}>
                            <Trash2 className="w-3 h-3" aria-hidden="true" />
                          </button>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-gray-500 shrink-0">Rings:</label>
                        <input type="number" min={1} max={20} value={tier.rings}
                          onChange={(e) => setTiers((ts) => ts.map((t, i) => i === ti ? { ...t, rings: parseInt(e.target.value) || 3 } : t))}
                          aria-label={`Rings for tier ${ti + 1}`}
                          className="w-16 px-2 py-1 text-sm text-center border border-[#dadce0] rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-[#1a73e8]" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Members:</p>
                        <div className="flex flex-wrap gap-1">
                          {config.users.map((u) => {
                            const userEmail = u.email ?? "";
                            const inTier = userEmail ? tier.userEmails.includes(userEmail) : false;
                            return (
                              <button key={u.email ?? `${u.firstName}-${u.lastName}`} onClick={() => {
                                if (!userEmail) return;
                                setTiers((ts) => ts.map((t, i) => {
                                  if (i !== ti) return t;
                                  const emails: string[] = inTier ? t.userEmails.filter((e) => e !== userEmail) : [...t.userEmails, userEmail];
                                  return { ...t, userEmails: emails };
                                }));
                              }}
                                aria-pressed={inTier}
                                className={`px-2 py-0.5 text-xs rounded-full border transition-all ${inTier ? "border-[#1a73e8] bg-[#e8f0fe] text-[#1a73e8]" : "border-[#dadce0] text-gray-500 hover:bg-[#f8f9fa]"}`}>
                                {u.firstName} {u.lastName.charAt(0)}.
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ))}
                  <button onClick={addTier} className="flex items-center gap-1.5 text-xs text-[#1a73e8] hover:underline">
                    <Plus className="w-3 h-3" aria-hidden="true" /> Add tier
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Call Queue specific: strategy, wait, capacity */}
          {routingChoice === "call_queues" && eligible !== false && (
            <div className="space-y-2">
              <div>
                <label htmlFor="queue-strategy" className="block text-xs font-medium text-gray-600 mb-1">Ring Strategy</label>
                <select id="queue-strategy" value={ringStrategy} onChange={(e) => setRingStrategy(e.target.value as QueueStrategy)}
                  className="w-full px-3 py-2 text-sm border border-[#dadce0] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#1a73e8]">
                  {STRATEGY_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label htmlFor="max-wait" className="block text-xs font-medium text-gray-600 mb-1">Max Wait (sec)</label>
                  <input id="max-wait" type="number" min={30} max={3600} value={maxWaitTime}
                    onChange={(e) => setMaxWaitTime(parseInt(e.target.value) || 300)}
                    className="w-full px-3 py-2 text-sm border border-[#dadce0] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#1a73e8]" />
                </div>
                <div>
                  <label htmlFor="max-cap" className="block text-xs font-medium text-gray-600 mb-1">Max Capacity</label>
                  <input id="max-cap" type="number" min={1} max={100} value={maxCapacity}
                    onChange={(e) => setMaxCapacity(parseInt(e.target.value) || 10)}
                    className="w-full px-3 py-2 text-sm border border-[#dadce0] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#1a73e8]" />
                </div>
              </div>
            </div>
          )}

          {/* Schedule / Time Blocks */}
          <div>
            <p className="text-xs font-medium text-gray-600 mb-1.5 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" aria-hidden="true" /> Schedule (Time Blocks)
            </p>
            <p className="text-xs text-gray-400 mb-2">When should this {routingChoice === "ring_groups" ? "ring group" : "queue"} be active?</p>
            <div className="space-y-2">
              {([
                { value: "24_7" as const, label: "24/7 — Always active", desc: "Calls ring every day, all day (system default)" },
                ...(hasBusinessHours ? [{ value: "business_hours" as const, label: "Business hours from website", desc: `Use the hours we scraped: ${Object.entries(config.scraped.hours).slice(0, 2).map(([d, h]) => `${d}: ${h}`).join(", ")}${Object.keys(config.scraped.hours).length > 2 ? "..." : ""}` }] : []),
                { value: "custom" as const, label: "Custom schedule", desc: "Set specific days and hours" },
              ]).map(({ value, label, desc }) => (
                <button key={value} onClick={() => setScheduleType(value)}
                  aria-pressed={scheduleType === value}
                  className={`w-full flex items-start gap-3 p-3 rounded-xl border text-left transition-all ${
                    scheduleType === value ? "border-[#1a73e8] bg-[#e8f0fe]" : "border-[#dadce0] bg-white hover:bg-[#f8f9fa]"
                  }`}>
                  <div className={`w-4 h-4 rounded-full border-2 mt-0.5 shrink-0 flex items-center justify-center ${
                    scheduleType === value ? "border-[#1a73e8]" : "border-[#dadce0]"
                  }`}>
                    {scheduleType === value && <div className="w-2 h-2 rounded-full bg-[#1a73e8]" />}
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-800">{label}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
                  </div>
                </button>
              ))}
            </div>
            {scheduleType === "custom" && (
              <div className="mt-3 p-3 bg-white border border-[#e8eaed] rounded-xl space-y-2">
                <div>
                  <p className="text-xs font-medium text-gray-600 mb-1">Days</p>
                  <div className="flex gap-1">
                    {(["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]).map((day, i) => (
                      <button key={day} onClick={() => setCustomDays((d) => d.includes(i) ? d.filter((x) => x !== i) : [...d, i].sort())}
                        aria-pressed={customDays.includes(i)}
                        className={`w-9 h-8 text-xs font-medium rounded-lg border transition-all ${
                          customDays.includes(i) ? "border-[#1a73e8] bg-[#e8f0fe] text-[#1a73e8]" : "border-[#dadce0] text-gray-500 hover:bg-[#f8f9fa]"
                        }`}>
                        {day}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label htmlFor="sched-start" className="block text-xs font-medium text-gray-600 mb-1">Start</label>
                    <input id="sched-start" type="time" value={customStart} onChange={(e) => setCustomStart(e.target.value)}
                      className="w-full px-2 py-1.5 text-sm border border-[#dadce0] rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-[#1a73e8]" />
                  </div>
                  <div>
                    <label htmlFor="sched-end" className="block text-xs font-medium text-gray-600 mb-1">End</label>
                    <input id="sched-end" type="time" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)}
                      className="w-full px-2 py-1.5 text-sm border border-[#dadce0] rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-[#1a73e8]" />
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-2 pt-1">
            <button onClick={() => setStep("welcome_menu")} className="px-3 py-2 text-sm text-gray-500 border border-[#dadce0] rounded-lg hover:bg-[#f8f9fa]">Back</button>
            <button onClick={handleRoutingNext}
              disabled={checking || (routingChoice === "call_queues" && eligible === false) || !groupName.trim()}
              className="flex-1 py-2 text-sm font-medium bg-[#1a73e8] text-white rounded-lg hover:bg-[#1557b0] disabled:opacity-40 transition-colors">
              Next
            </button>
          </div>
        </div>
      </CardShell>
    );
  }

  // ── Sub-step: After-hours ──────────────────────────────────────────────────
  return (
    <CardShell>
      <div className="space-y-3">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Step 3 of 3 &mdash; After-Hours Behavior</p>
        <p className="text-xs text-gray-500">What should happen when someone calls outside business hours?</p>

        <div className="space-y-2" role="radiogroup" aria-label="After-hours action">
          {([
            { value: "voicemail" as const, label: "Go to voicemail", desc: "Most common. Callers leave a message." },
            { value: "greeting" as const, label: "Play a custom greeting", desc: "A recorded message with no voicemail option." },
            { value: "forward" as const, label: "Forward to a number", desc: "Route to a mobile or answering service." },
          ]).map(({ value, label, desc }) => (
            <button key={value} onClick={() => setAfterAction(value)}
              role="radio" aria-checked={afterAction === value}
              className={`w-full flex items-start gap-3 p-3 rounded-xl border text-left transition-all ${
                afterAction === value ? "border-[#1a73e8] bg-[#e8f0fe]" : "border-[#dadce0] bg-white hover:bg-[#f8f9fa]"
              }`}>
              <div className={`w-4 h-4 rounded-full border-2 mt-0.5 shrink-0 flex items-center justify-center ${
                afterAction === value ? "border-[#1a73e8]" : "border-[#dadce0]"
              }`}>
                {afterAction === value && <div className="w-2 h-2 rounded-full bg-[#1a73e8]" />}
              </div>
              <div>
                <p className="text-sm font-medium text-gray-800">{label}</p>
                <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
              </div>
            </button>
          ))}
        </div>

        {afterAction === "greeting" && (
          <div>
            <label htmlFor="after-greeting" className="block text-xs font-medium text-gray-600 mb-1">Greeting Text</label>
            <textarea id="after-greeting" value={afterGreeting} onChange={(e) => setAfterGreeting(e.target.value)}
              rows={2} placeholder="e.g. We are currently closed. Please call back during business hours."
              className="w-full px-3 py-2 text-sm border border-[#dadce0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1a73e8] bg-white resize-none" />
          </div>
        )}

        {afterAction === "forward" && (
          <div>
            <label htmlFor="after-forward" className="block text-xs font-medium text-gray-600 mb-1">Forward To Number</label>
            <input id="after-forward" type="tel" value={afterForwardNum} onChange={(e) => setAfterForwardNum(e.target.value)}
              placeholder="+1 (555) 123-4567"
              className="w-full px-3 py-2 text-sm border border-[#dadce0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1a73e8] bg-white" />
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <button onClick={() => setStep("routing_type")} className="px-3 py-2 text-sm text-gray-500 border border-[#dadce0] rounded-lg hover:bg-[#f8f9fa]">Back</button>
          <button onClick={handleAfterHoursNext}
            disabled={(afterAction === "greeting" && !afterGreeting.trim()) || (afterAction === "forward" && !afterForwardNum.trim())}
            className="flex-1 py-2 text-sm font-medium bg-[#1a73e8] text-white rounded-lg hover:bg-[#1557b0] disabled:opacity-40 transition-colors">
            Continue
          </button>
        </div>
        <FixItButton targetStage="architecture_hardware" />
      </div>
    </CardShell>
  );
}

