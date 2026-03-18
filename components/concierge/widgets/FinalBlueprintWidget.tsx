"use client";

import { useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useConcierge } from "@/contexts/ConciergeContext";
import { CardShell, FixItButton } from "./shared";


export function FinalBlueprintWidget({
  onMessages,
}: {
  onMessages: (msgs: string[]) => void;
}) {
  const { config } = useConcierge();
  const [applying, setApplying] = useState(false);

  const handleConfirm = () => {
    setApplying(true);
    onMessages(["Confirm & Build"]);
  };

  const hoursRows = Object.entries(config.scraped.hours)
    .map(([day, hrs]) => `| ${day} | ${hrs} |`)
    .join("\n");

  const usersRows = config.users
    .map((u) => `| ${u.firstName} ${u.lastName} | ${u.email} | ${u.department ?? "\u2014"} |`)
    .join("\n");

  const routingLabel = config.routingType === "ring_groups" ? "Ring Groups" : "Call Queues";
  const routingDetail = config.routingConfig.groupName
    ? `${routingLabel}: ${config.routingConfig.groupName}`
    : routingLabel;

  const menuRows = config.welcomeMenu.enabled && config.welcomeMenu.menuOptions.length > 0
    ? config.welcomeMenu.menuOptions.map((o) => `| ${o.key} | ${o.destinationType} | ${o.destinationName} |`).join("\n")
    : "";

  const afterHoursLabel = config.afterHours.action === "voicemail" ? "Voicemail"
    : config.afterHours.action === "greeting" ? "Custom greeting"
    : config.afterHours.forwardNumber ? `Forward to ${config.afterHours.forwardNumber}` : "Forward";

  const blueprint = `
## ${config.companyName || "Your Company"} \u2014 Setup Blueprint

| Field | Value |
|---|---|
| Location | ${config.scraped.location} |
| Timezone | ${config.scraped.timezone} |
| Routing | ${routingDetail} |
| Welcome Menu | ${config.welcomeMenu.enabled ? "Enabled" : "Disabled"} |
| After-Hours | ${afterHoursLabel} |
| Departments | ${config.departments.join(", ") || "\u2014"} |
| Users | ${config.users.length} |
| Numbers to Port | ${config.portingQueue.numbers.length || "\u2014"} |
| Holidays | ${config.holidays.length > 0 && config.holidays[0]?.date !== "__auto__" ? config.holidays.length : config.holidays.length > 0 ? "Auto-loaded" : "None"} |

### Business Hours

| Day | Hours |
|---|---|
${hoursRows}
${config.welcomeMenu.enabled && menuRows ? `
### Welcome Menu

| Key | Type | Destination |
|---|---|---|
${menuRows}

**Greeting:** ${config.welcomeMenu.greetingText.slice(0, 120)}${config.welcomeMenu.greetingText.length > 120 ? "..." : ""}` : ""}
${config.routingType === "call_queues" ? `
### Call Queue Settings

| Setting | Value |
|---|---|
| Strategy | ${config.routingConfig.ringStrategy.replace("_", " ")} |
| Max Wait | ${config.routingConfig.maxWaitTime}s |
| Max Capacity | ${config.routingConfig.maxCapacity} |` : ""}
${config.routingType === "ring_groups" && config.routingConfig.tiers.length > 1 ? `
### Ring Group Tiers

${config.routingConfig.tiers.map((t, i) => `| Tier ${i + 1} | ${t.userEmails.length} member(s), ${t.rings} rings |`).join("\n")}` : ""}

### Team Members

| Name | Email | Department |
|---|---|---|
${usersRows || "| \u2014 | \u2014 | \u2014 |"}
`.trim();

  return (
    <CardShell className="!p-0 overflow-hidden">
      <div className="px-5 py-4 border-b border-[#e8eaed] bg-[#f8f9fa]">
        <p className="text-sm font-semibold text-gray-800">Your Setup Blueprint</p>
        <p className="text-xs text-gray-500 mt-0.5">Review everything below before we build it out.</p>
      </div>
      <div className="px-5 py-4 max-h-72 overflow-y-auto prose prose-sm max-w-none [&_table]:w-full [&_table]:text-xs [&_th]:bg-[#f8f9fa] [&_th]:px-3 [&_th]:py-1.5 [&_th]:text-left [&_th]:font-semibold [&_th]:text-gray-600 [&_td]:px-3 [&_td]:py-1.5 [&_td]:border-t [&_td]:border-[#f1f3f4] [&_table]:border [&_table]:border-[#e8eaed] [&_table]:rounded-lg [&_table]:overflow-hidden [&_h2]:text-base [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-gray-700">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{blueprint}</ReactMarkdown>
      </div>
      <div className="px-5 py-4 border-t border-[#e8eaed] space-y-2">
        <button onClick={handleConfirm} disabled={applying}
          className="w-full flex items-center justify-center gap-2 py-3 text-sm font-semibold bg-[#1a73e8] text-white rounded-xl hover:bg-[#1557b0] disabled:opacity-50 transition-colors">
          {applying
            ? <><Loader2 className="w-4 h-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> Building your system&hellip;</>
            : <><ShieldCheck className="w-4 h-4" aria-hidden="true" /> Confirm &amp; Build</>}
        </button>
        <FixItButton targetStage="licensing" label="Go back to call routing" />
      </div>
    </CardShell>
  );
}

