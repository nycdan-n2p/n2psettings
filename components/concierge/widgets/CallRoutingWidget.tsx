"use client";

import { useState } from "react";
import { CheckSquare, Square, Plus, Trash2, Clock, Upload, Loader2, AlertCircle, ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { useConcierge, type MenuOption, type QueueStrategy } from "@/contexts/ConciergeContext";
import { checkLicensing } from "@/lib/api/concierge-backend";
import { getAccessToken } from "@/lib/auth";
import { CardShell, FixItButton } from "./shared";


type RoutingStep = "welcome_menu" | "routing_type" | "after_hours";

const STRATEGY_KEYS = ["ring_all", "round_robin", "longest_idle", "linear", "fewest_calls"] as const;

const DEST_TYPES = ["department", "ring_group", "voicemail", "directory", "user"] as const;

export function deriveRoutingStep(config: { welcomeMenu: { configured?: boolean }; routingConfig: { groupName: string } }): RoutingStep {
  if (config.routingConfig.groupName) return "after_hours";
  if (config.welcomeMenu.configured) return "routing_type";
  return "welcome_menu";
}

export function CallRoutingWidget({ onMessages }: { onMessages: (msgs: string[]) => void }) {
  const t = useTranslations("concierge");
  const tCommon = useTranslations("common");
  const tAny = t as unknown as (k: string) => string;
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
  const [ringStrategy, setRingStrategy] = useState<QueueStrategy>(config.routingConfig.ringStrategy as QueueStrategy);
  const [maxWaitTime] = useState(config.routingConfig.maxWaitTime || 300);
  const [maxCapacity] = useState(config.routingConfig.maxCapacity || 10);
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
    const filteredOptions = menuEnabled ? menuOptions.filter((o) => o.destinationName.trim()) : [];
    if (menuEnabled && filteredOptions.length === 0) {
      return; // Block: require at least one option when menu is enabled
    }
    const menu = {
      enabled: menuEnabled,
      greetingType: menuEnabled ? greetingType : "none" as const,
      greetingText: menuEnabled && greetingType === "tts" ? greetingText : "",
      menuOptions: filteredOptions,
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
      ? ` (${ringStrategy}, max wait ${maxWaitTime}s, capacity ${maxCapacity})`
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
    const greetingOptions = [
      { value: "tts" as const, key: "routing.textToSpeech" },
      { value: "upload" as const, key: "routing.uploadCustom" },
      { value: "none" as const, key: "common.no" },
    ] as const;
    return (
      <CardShell>
        <div className="space-y-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{t("routing.welcomeMenuTitle")}</p>

          <div className="flex gap-2">
            <button onClick={() => setMenuEnabled(true)} aria-pressed={menuEnabled}
              className={`flex-1 py-2 text-sm font-medium rounded-lg border transition-all ${menuEnabled ? "border-[#1a73e8] bg-[#e8f0fe] text-[#1a73e8]" : "border-[#dadce0] text-gray-600 hover:bg-[#f8f9fa]"}`}>
              {tCommon("yes")}
            </button>
            <button onClick={() => setMenuEnabled(false)} aria-pressed={!menuEnabled}
              className={`flex-1 py-2 text-sm font-medium rounded-lg border transition-all ${!menuEnabled ? "border-[#1a73e8] bg-[#e8f0fe] text-[#1a73e8]" : "border-[#dadce0] text-gray-600 hover:bg-[#f8f9fa]"}`}>
              {tCommon("no")}
            </button>
          </div>

          {menuEnabled && (
            <>
              {/* Greeting type */}
              <div>
                <p className="text-xs font-medium text-gray-600 mb-1.5">{t("routing.greetingMethodLabel")}</p>
                <div className="flex gap-2">
                  {greetingOptions.map(({ value, key }) => (
                    <button key={value} onClick={() => setGreetingType(value)}
                      aria-pressed={greetingType === value}
                      className={`flex-1 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                        greetingType === value ? "border-[#1a73e8] bg-[#e8f0fe] text-[#1a73e8]" : "border-[#dadce0] text-gray-600 hover:bg-[#f8f9fa]"
                      }`}>
                      {tAny(key)}
                    </button>
                  ))}
                </div>
              </div>
              {greetingType === "tts" && (
                <div>
                  <label htmlFor="greeting-text" className="block text-xs font-medium text-gray-600 mb-1">{t("routing.greetingTextLabel")}</label>
                  <textarea
                    id="greeting-text"
                    value={greetingText}
                    onChange={(e) => setGreetingText(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 text-sm border border-[#dadce0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1a73e8] bg-white resize-none"
                  />
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
                <p className="text-xs font-medium text-gray-600 mb-2">{t("routing.menuOptionsTitle")}</p>
                <div className="space-y-2">
                  {menuOptions.map((opt, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        value={opt.key}
                        onChange={(e) => updateMenuOption(i, { key: e.target.value })}
                        className="w-10 px-2 py-1.5 text-sm text-center border border-[#dadce0] rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-[#1a73e8]"
                        maxLength={1}
                        aria-label={`${t("routing.keyLabel")} ${i + 1}`}
                      />
                      <select
                        value={opt.destinationType}
                        onChange={(e) => updateMenuOption(i, { destinationType: e.target.value as MenuOption["destinationType"] })}
                        aria-label={`${t("routing.destinationTypeLabel")} ${i + 1}`}
                        className="w-28 text-xs px-2 py-1.5 border border-[#dadce0] rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-[#1a73e8]"
                      >
                        {DEST_TYPES.map((dt) => <option key={dt} value={dt}>{dt.replace("_", " ")}</option>)}
                      </select>
                      <input
                        value={opt.destinationName}
                        onChange={(e) => updateMenuOption(i, { destinationName: e.target.value })}
                        placeholder={t("routing.destinationPlaceholder")}
                        aria-label={`${t("routing.destinationNameLabel")} ${i + 1}`}
                        className="flex-1 px-2.5 py-1.5 text-sm border border-[#dadce0] rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-[#1a73e8]"
                      />
                      <button onClick={() => removeMenuOption(i)} className="text-gray-300 hover:text-red-500" aria-label={`${tCommon("remove")} ${i + 1}`}>
                        <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  ))}
                </div>
                <button onClick={addMenuOption} className="flex items-center gap-1.5 text-xs text-[#1a73e8] hover:underline mt-2">
                  <Plus className="w-3 h-3" aria-hidden="true" /> {t("routing.addMenuOption")}
                </button>
              </div>

              {/* Business features */}
              <div>
                <div className="space-y-2">
                  {([
                    { key: "extDialing" as const, labelKey: "routing.allowExtensionDialing", checked: extDialing, set: setExtDialing },
                    { key: "playWait" as const, labelKey: "routing.playHoldMessage", checked: playWait, set: setPlayWait },
                    { key: "barging" as const, labelKey: "routing.allowBarging", checked: barging, set: setBarging },
                  ]).map(({ key, labelKey, checked, set }) => (
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
                      <p className="text-xs font-medium text-gray-700">{tAny(labelKey)}</p>
                    </label>
                  ))}
                </div>
              </div>
            </>
          )}

          {menuEnabled && menuOptions.filter((o) => o.destinationName.trim()).length === 0 && (
            <p className="text-xs text-amber-600" role="alert">
              Add at least one menu option (e.g. Press 1 → Sales) or disable the welcome menu.
            </p>
          )}
          <button
            onClick={handleMenuNext}
            disabled={menuEnabled && menuOptions.filter((o) => o.destinationName.trim()).length === 0}
            className="w-full py-2 text-sm font-medium bg-[#1a73e8] text-white rounded-lg hover:bg-[#1557b0] disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
            {tCommon("next")}
          </button>
          <FixItButton targetStage="verification_holidays" />
        </div>
      </CardShell>
    );
  }

  // ── Sub-step: Routing Type ─────────────────────────────────────────────────
  if (step === "routing_type") {
    const routingOptions = [
      { value: "ring_groups" as const, labelKey: "routing.ringGroupsOption", descKey: "routing.ringGroupsDesc" },
      { value: "call_queues" as const, labelKey: "routing.callQueuesOption", descKey: "routing.callQueuesDesc" },
    ] as const;
    return (
      <CardShell>
        <div className="space-y-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{t("routing.routingTypeTitle")}</p>

          <div className="space-y-2" role="radiogroup" aria-label={t("routing.routingTypeTitle")}>
            {routingOptions.map(({ value, labelKey, descKey }) => (
              <button key={value} onClick={() => handleRoutingChoice(value)}
                role="radio" aria-checked={routingChoice === value}
                className={`w-full flex items-start gap-3 p-3 rounded-[16px] border text-left transition-all ${
                  routingChoice === value ? "border-[#1a73e8] bg-[#e8f0fe]" : "border-[#dadce0] bg-white hover:bg-[#f8f9fa]"
                }`}>
                <div className={`w-4 h-4 rounded-full border-2 mt-0.5 shrink-0 flex items-center justify-center ${
                  routingChoice === value ? "border-[#1a73e8]" : "border-[#dadce0]"
                }`}>
                  {routingChoice === value && <div className="w-2 h-2 rounded-full bg-[#1a73e8]" />}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-800">{tAny(labelKey)}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{tAny(descKey)}</p>
                </div>
              </button>
            ))}
          </div>

          {routingChoice === "call_queues" && checking && (
            <p className="flex items-center gap-2 text-xs text-gray-500" role="status">
              <Loader2 className="w-3.5 h-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" /> {t("routing.checkingLicense")}
            </p>
          )}
          {routingChoice === "call_queues" && eligible === false && !checking && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-[16px] text-xs text-amber-800" role="alert">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
              <p>{t("routing.licenseNotEligible")}</p>
            </div>
          )}
          {routingChoice === "call_queues" && eligible === true && !checking && (
            <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-[16px] text-xs text-green-800" role="status">
              <ShieldCheck className="w-4 h-4 shrink-0" aria-hidden="true" />
              <p>{t("routing.licenseOk")}</p>
            </div>
          )}

          {/* Group/Queue name */}
          <div>
            <label htmlFor="group-name" className="block text-xs font-medium text-gray-600 mb-1">
              {routingChoice === "ring_groups" ? t("routing.ringGroupsOption") : t("routing.callQueuesOption")} {t("routing.groupNameLabel")}
            </label>
            <input id="group-name" value={groupName} onChange={(e) => setGroupName(e.target.value)}
              placeholder={t("routing.groupNamePlaceholder")}
              className="w-full px-3 py-2 text-sm border border-[#dadce0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1a73e8] bg-white" />
          </div>

          {/* Ring Group specific: tiered or ring all */}
          {routingChoice === "ring_groups" && (
            <div className="space-y-2">
              <div className="flex gap-2">
                <button onClick={() => setTiered(false)} aria-pressed={!tiered}
                  className={`flex-1 py-2 text-xs font-medium rounded-lg border ${!tiered ? "border-[#1a73e8] bg-[#e8f0fe] text-[#1a73e8]" : "border-[#dadce0] text-gray-600 hover:bg-[#f8f9fa]"}`}>
                  {t("routing.strategyLabel")}
                </button>
                <button onClick={() => setTiered(true)} aria-pressed={tiered}
                  className={`flex-1 py-2 text-xs font-medium rounded-lg border ${tiered ? "border-[#1a73e8] bg-[#e8f0fe] text-[#1a73e8]" : "border-[#dadce0] text-gray-600 hover:bg-[#f8f9fa]"}`}>
                  {t("routing.tiersTitle")}
                </button>
              </div>
              {tiered && (
                <div className="space-y-2">
                  {tiers.map((tier, ti) => (
                    <div key={ti} className="p-3 bg-white border border-[#e8eaed] rounded-[16px] space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-gray-600">{t("routing.tier", { n: ti + 1 })}</p>
                        {tiers.length > 1 && (
                          <button onClick={() => removeTier(ti)} className="text-gray-300 hover:text-red-500" aria-label={`${tCommon("remove")} tier ${ti + 1}`}>
                            <Trash2 className="w-3 h-3" aria-hidden="true" />
                          </button>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-gray-500 shrink-0">{t("routing.tierRingsLabel")}:</label>
                        <input type="number" min={1} max={20} value={tier.rings}
                          onChange={(e) => setTiers((ts) => ts.map((tr, i) => i === ti ? { ...tr, rings: parseInt(e.target.value) || 3 } : tr))}
                          aria-label={`Rings for tier ${ti + 1}`}
                          className="w-16 px-2 py-1 text-sm text-center border border-[#dadce0] rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-[#1a73e8]" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">{t("routing.tierUsersLabel")}:</p>
                        <div className="flex flex-wrap gap-1">
                          {config.users.map((u) => {
                            const userEmail = u.email ?? "";
                            const inTier = userEmail ? tier.userEmails.includes(userEmail) : false;
                            return (
                              <button key={u.email ?? `${u.firstName}-${u.lastName}`} onClick={() => {
                                if (!userEmail) return;
                                setTiers((ts) => ts.map((tr, i) => {
                                  if (i !== ti) return tr;
                                  const emails: string[] = inTier ? tr.userEmails.filter((e) => e !== userEmail) : [...tr.userEmails, userEmail];
                                  return { ...tr, userEmails: emails };
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
                    <Plus className="w-3 h-3" aria-hidden="true" /> {t("routing.addTier")}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Call Queue specific: strategy, wait, capacity */}
          {routingChoice === "call_queues" && eligible !== false && (
            <div className="space-y-2">
              <div>
                <label htmlFor="queue-strategy" className="block text-xs font-medium text-gray-600 mb-1">{t("routing.strategyLabel")}</label>
                <select id="queue-strategy" value={ringStrategy} onChange={(e) => setRingStrategy(e.target.value as QueueStrategy)}
                  className="w-full px-3 py-2 text-sm border border-[#dadce0] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#1a73e8]">
                  {STRATEGY_KEYS.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
                </select>
              </div>
            </div>
          )}

          {/* Schedule / Time Blocks */}
          <div>
            <p className="text-xs font-medium text-gray-600 mb-1.5 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" aria-hidden="true" /> {t("routing.scheduleLabel")}
            </p>
            <div className="space-y-2">
              {([
                { value: "24_7" as const, label: "24/7" },
                ...(hasBusinessHours ? [{ value: "business_hours" as const, label: `${t("routing.scheduleLabel")} ↗` }] : []),
                { value: "custom" as const, label: t("routing.newSchedule") },
              ]).map(({ value, label }) => (
                <button key={value} onClick={() => setScheduleType(value)}
                  aria-pressed={scheduleType === value}
                  className={`w-full flex items-start gap-3 p-3 rounded-[16px] border text-left transition-all ${
                    scheduleType === value ? "border-[#1a73e8] bg-[#e8f0fe]" : "border-[#dadce0] bg-white hover:bg-[#f8f9fa]"
                  }`}>
                  <div className={`w-4 h-4 rounded-full border-2 mt-0.5 shrink-0 flex items-center justify-center ${
                    scheduleType === value ? "border-[#1a73e8]" : "border-[#dadce0]"
                  }`}>
                    {scheduleType === value && <div className="w-2 h-2 rounded-full bg-[#1a73e8]" />}
                  </div>
                  <p className="text-xs font-medium text-gray-800">{label}</p>
                </button>
              ))}
            </div>
            {scheduleType === "custom" && (
              <div className="mt-3 p-3 bg-white border border-[#e8eaed] rounded-[16px] space-y-2">
                <div className="flex gap-1 flex-wrap">
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
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <input id="sched-start" type="time" value={customStart} onChange={(e) => setCustomStart(e.target.value)}
                      className="w-full px-2 py-1.5 text-sm border border-[#dadce0] rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-[#1a73e8]" />
                  </div>
                  <div>
                    <input id="sched-end" type="time" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)}
                      className="w-full px-2 py-1.5 text-sm border border-[#dadce0] rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-[#1a73e8]" />
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-2 pt-1">
            <button onClick={() => setStep("welcome_menu")} className="px-3 py-2 text-sm text-gray-500 border border-[#dadce0] rounded-lg hover:bg-[#f8f9fa]">{tCommon("back")}</button>
            <button onClick={handleRoutingNext}
              disabled={checking || (routingChoice === "call_queues" && eligible === false) || !groupName.trim()}
              className="flex-1 py-2 text-sm font-medium bg-[#1a73e8] text-white rounded-lg hover:bg-[#1557b0] disabled:opacity-40 transition-colors">
              {tCommon("next")}
            </button>
          </div>
        </div>
      </CardShell>
    );
  }

  // ── Sub-step: After-hours ──────────────────────────────────────────────────
  const afterOptions = [
    { value: "voicemail" as const, labelKey: "routing.voicemail" },
    { value: "greeting" as const, labelKey: "routing.playGreeting" },
    { value: "forward" as const, labelKey: "routing.afterHoursTitle" },
  ] as const;
  return (
    <CardShell>
      <div className="space-y-3">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{t("routing.afterHoursTitle")}</p>

        <div className="space-y-2" role="radiogroup" aria-label={t("routing.afterHoursAction")}>
          {afterOptions.map(({ value, labelKey }) => (
            <button key={value} onClick={() => setAfterAction(value)}
              role="radio" aria-checked={afterAction === value}
              className={`w-full flex items-start gap-3 p-3 rounded-[16px] border text-left transition-all ${
                afterAction === value ? "border-[#1a73e8] bg-[#e8f0fe]" : "border-[#dadce0] bg-white hover:bg-[#f8f9fa]"
              }`}>
              <div className={`w-4 h-4 rounded-full border-2 mt-0.5 shrink-0 flex items-center justify-center ${
                afterAction === value ? "border-[#1a73e8]" : "border-[#dadce0]"
              }`}>
                {afterAction === value && <div className="w-2 h-2 rounded-full bg-[#1a73e8]" />}
              </div>
              <p className="text-sm font-medium text-gray-800">{tAny(labelKey)}</p>
            </button>
          ))}
        </div>

        {afterAction === "greeting" && (
          <div>
            <label htmlFor="after-greeting" className="block text-xs font-medium text-gray-600 mb-1">{t("routing.afterHoursGreeting")}</label>
            <textarea id="after-greeting" value={afterGreeting} onChange={(e) => setAfterGreeting(e.target.value)}
              rows={2} placeholder={t("routing.afterHoursPlaceholder")}
              className="w-full px-3 py-2 text-sm border border-[#dadce0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1a73e8] bg-white resize-none" />
          </div>
        )}

        {afterAction === "forward" && (
          <div>
            <label htmlFor="after-forward" className="block text-xs font-medium text-gray-600 mb-1">{t("routing.afterHoursAction")}</label>
            <input id="after-forward" type="tel" value={afterForwardNum} onChange={(e) => setAfterForwardNum(e.target.value)}
              placeholder="+1 (555) 123-4567"
              className="w-full px-3 py-2 text-sm border border-[#dadce0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1a73e8] bg-white" />
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <button onClick={() => setStep("routing_type")} className="px-3 py-2 text-sm text-gray-500 border border-[#dadce0] rounded-lg hover:bg-[#f8f9fa]">{tCommon("back")}</button>
          <button onClick={handleAfterHoursNext}
            disabled={(afterAction === "greeting" && !afterGreeting.trim()) || (afterAction === "forward" && !afterForwardNum.trim())}
            className="flex-1 py-2 text-sm font-medium bg-[#1a73e8] text-white rounded-lg hover:bg-[#1557b0] disabled:opacity-40 transition-colors">
            {t("routing.finishRouting")}
          </button>
        </div>
        <FixItButton targetStage="verification_holidays" />
      </div>
    </CardShell>
  );
}

