"use client";

import { useState } from "react";
import { Users, Building2, HardDrive, Plus } from "lucide-react";
import { useConcierge, type OnboardingUser } from "@/contexts/ConciergeContext";
import { CardShell, FixItButton } from "./shared";

type ArchStep = "departments" | "depts" | "assign" | "phones" | "hardphone_details";

export function deriveArchStep(config: { departments: string[]; assignmentsDone?: boolean; phoneType: string; hasHardphones: boolean }): ArchStep {
  if (config.hasHardphones) return "hardphone_details";
  if (config.phoneType) return "phones";
  if (config.assignmentsDone) return "phones";
  if (config.departments.length > 0) return "assign";
  return "departments";
}

export function ArchitectureWidget({ onMessages }: { onMessages: (msgs: string[]) => void }) {
  const { config, updateConfig } = useConcierge();
  const [step, setStep] = useState<ArchStep>(() => deriveArchStep(config));
  const [deptInput, setDeptInput] = useState("");
  const [depts, setDepts] = useState<string[]>(config.departments.length ? config.departments : []);
  const [users, setUsers] = useState<OnboardingUser[]>(config.users);
  const [phoneChoice, setPhoneChoice] = useState<"softphone" | "hardphone" | "both" | null>(
    config.phoneType !== "softphone" ? config.phoneType : null
  );

  const addDept = () => {
    const v = deptInput.trim();
    if (!v || depts.includes(v)) return;
    setDepts((d) => [...d, v]);
    setDeptInput("");
  };

  const handleDeptsNext = () => {
    const skipAssign = depts.length === 0 || config.users.length === 0;
    updateConfig({ departments: depts, assignmentsDone: skipAssign ? true : false });
    if (!skipAssign) {
      onMessages([`[arch] Departments: ${depts.join(", ")}`]);
      setStep("assign");
    } else {
      onMessages([`[arch] Departments: ${depts.length > 0 ? depts.join(", ") : "none"}`]);
      setStep("phones");
    }
  };

  const handleAssignNext = () => {
    updateConfig({ users, assignmentsDone: true });
    const summary = users.map((u) => `${u.firstName} ${u.lastName} \u2192 ${u.department || "Unassigned"}`).join("; ");
    onMessages([`[arch] User assignments: ${summary}`]);
    setStep("phones");
  };

  const handlePhoneChoice = (choice: "softphone" | "hardphone" | "both") => {
    setPhoneChoice(choice);
  };

  const handlePhonesNext = () => {
    if (!phoneChoice) return;
    const hasHW = phoneChoice === "hardphone" || phoneChoice === "both";
    updateConfig({ hasHardphones: hasHW, phoneType: phoneChoice });
    if (hasHW && config.users.length > 0) {
      onMessages([`[arch] Phone type: ${phoneChoice}`]);
      setStep("hardphone_details");
    } else {
      onMessages([`[arch] Departments: ${depts.join(", ") || "none"}. Phone type: ${phoneChoice}. Architecture complete.`]);
    }
  };

  const handleHardphoneNext = () => {
    updateConfig({ users });
    const summary = users.filter((u) => u.hardphoneModel).map((u) => `${u.firstName}: ${u.hardphoneModel}`).join(", ");
    onMessages([`[arch] Hardphone details: ${summary || "none specified"}. Architecture complete.`]);
  };

  // ── Step: Departments ────────────────────────────────────────────────────
  if (step === "departments") {
    return (
      <CardShell>
        <div className="space-y-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5" aria-hidden="true" /> Step 1 &mdash; Departments
          </p>
          <p className="text-xs text-gray-500">What departments does your team have? e.g. Sales, Support, Finance</p>
          <div className="flex gap-2">
            <input
              value={deptInput}
              onChange={(e) => setDeptInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addDept()}
              placeholder="e.g. Sales"
              aria-label="Department name"
              className="flex-1 px-2.5 py-1.5 text-sm border border-[#dadce0] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#1a73e8] bg-white"
            />
            <button onClick={addDept} className="px-3 py-1.5 bg-[#1a73e8] text-white rounded-lg text-sm hover:bg-[#1557b0]" aria-label="Add department">
              <Plus className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
          {depts.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {depts.map((d) => (
                <span key={d} className="flex items-center gap-1 pl-2.5 pr-1.5 py-1 bg-[#e8f0fe] text-[#1a73e8] rounded-full text-xs font-medium">
                  {d}
                  <button onClick={() => setDepts((ds) => ds.filter((x) => x !== d))} className="text-[#1a73e8] hover:text-red-500" aria-label={`Remove ${d}`}>
                    &times;
                  </button>
                </span>
              ))}
            </div>
          )}
          <button onClick={handleDeptsNext} disabled={depts.length === 0}
            className="w-full py-2 text-sm font-medium bg-[#1a73e8] text-white rounded-lg hover:bg-[#1557b0] disabled:opacity-40 transition-colors">
            Next
          </button>
          <FixItButton targetStage="user_ingestion" />
        </div>
      </CardShell>
    );
  }

  // ── Step: Assign users to departments ────────────────────────────────────
  if (step === "assign") {
    return (
      <CardShell>
        <div className="space-y-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5" aria-hidden="true" /> Step 2 &mdash; Assign Users to Departments
          </p>
          <div className="rounded-xl border border-[#e8eaed] overflow-hidden max-h-52 overflow-y-auto">
            {users.map((u, i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-2 border-b border-[#f1f3f4] last:border-0 bg-white">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-gray-800 truncate">{u.firstName} {u.lastName}</p>
                  <p className="text-xs text-gray-400 truncate">{u.email}</p>
                </div>
                <select
                  value={u.department ?? ""}
                  onChange={(e) => setUsers((us) => us.map((x, xi) => xi === i ? { ...x, department: e.target.value } : x))}
                  aria-label={`Department for ${u.firstName} ${u.lastName}`}
                  className="w-36 shrink-0 text-xs px-2 py-1.5 border border-[#dadce0] rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-[#1a73e8]"
                >
                  <option value="">&mdash; Unassigned &mdash;</option>
                  {depts.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
            ))}
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={() => setStep("departments")} className="px-3 py-2 text-sm text-gray-500 border border-[#dadce0] rounded-lg hover:bg-[#f8f9fa]">Back</button>
            <button onClick={handleAssignNext}
              className="flex-1 py-2 text-sm font-medium bg-[#1a73e8] text-white rounded-lg hover:bg-[#1557b0] transition-colors">
              Next
            </button>
          </div>
        </div>
      </CardShell>
    );
  }

  // ── Step: Phone type ─────────────────────────────────────────────────────
  if (step === "phones") {
    return (
      <CardShell>
        <div className="space-y-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
            <HardDrive className="w-3.5 h-3.5" aria-hidden="true" /> {depts.length > 0 && config.users.length > 0 ? "Step 3" : "Step 2"} &mdash; Phone Type
          </p>
          <p className="text-xs text-gray-500">How will your team take calls?</p>
          <div className="space-y-2">
            {([
              { value: "softphone" as const, label: "Softphone only", desc: "net2phone app on computer/mobile \u2014 no hardware needed" },
              { value: "hardphone" as const, label: "Physical desk phones", desc: "You\u2019ll need model and MAC address for each phone" },
              { value: "both" as const, label: "Both", desc: "Some users on desk phones, some on the app" },
            ]).map(({ value, label, desc }) => (
              <button key={value} onClick={() => handlePhoneChoice(value)}
                aria-pressed={phoneChoice === value}
                className={`w-full flex items-start gap-3 p-3 rounded-xl border text-left transition-all ${
                  phoneChoice === value ? "border-[#1a73e8] bg-[#e8f0fe]" : "border-[#dadce0] bg-white hover:bg-[#f8f9fa]"
                }`}>
                <div className={`w-4 h-4 rounded-full border-2 mt-0.5 shrink-0 flex items-center justify-center ${
                  phoneChoice === value ? "border-[#1a73e8]" : "border-[#dadce0]"
                }`}>
                  {phoneChoice === value && <div className="w-2 h-2 rounded-full bg-[#1a73e8]" />}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-800">{label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
                </div>
              </button>
            ))}
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={() => setStep(depts.length > 0 && config.users.length > 0 ? "assign" : "departments")}
              className="px-3 py-2 text-sm text-gray-500 border border-[#dadce0] rounded-lg hover:bg-[#f8f9fa]">Back</button>
            <button onClick={handlePhonesNext} disabled={!phoneChoice}
              className="flex-1 py-2 text-sm font-medium bg-[#1a73e8] text-white rounded-lg hover:bg-[#1557b0] disabled:opacity-40 transition-colors">
              {phoneChoice === "hardphone" || phoneChoice === "both" ? "Next" : "Continue"}
            </button>
          </div>
        </div>
      </CardShell>
    );
  }

  // ── Step: Hardphone details ──────────────────────────────────────────────
  return (
    <CardShell>
      <div className="space-y-3">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Hardphone Details</p>
        <p className="text-xs text-gray-500">Enter the model and MAC address for each desk phone. You can skip this and add them later.</p>
        <div className="rounded-xl border border-[#e8eaed] overflow-hidden max-h-52 overflow-y-auto">
          {users.map((u, i) => (
            <div key={i} className="flex items-center gap-2 px-3 py-2 border-b border-[#f1f3f4] last:border-0 bg-white">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-gray-800 truncate">{u.firstName} {u.lastName}</p>
                <p className="text-xs text-gray-400 truncate">{u.email}</p>
              </div>
              <input
                placeholder="Model (e.g. T46U)"
                value={u.hardphoneModel ?? ""}
                onChange={(e) => setUsers((us) => us.map((x, xi) => xi === i ? { ...x, hardphoneModel: e.target.value } : x))}
                aria-label={`Phone model for ${u.firstName}`}
                className="w-24 shrink-0 text-xs px-2 py-1.5 border border-[#dadce0] rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-[#1a73e8]"
              />
              <input
                placeholder="MAC address"
                value={u.macAddress ?? ""}
                onChange={(e) => setUsers((us) => us.map((x, xi) => xi === i ? { ...x, macAddress: e.target.value } : x))}
                aria-label={`MAC address for ${u.firstName}`}
                className="w-32 shrink-0 text-xs px-2 py-1.5 border border-[#dadce0] rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-[#1a73e8]"
              />
            </div>
          ))}
        </div>
        <div className="flex gap-2 pt-1">
          <button onClick={() => setStep("phones")} className="px-3 py-2 text-sm text-gray-500 border border-[#dadce0] rounded-lg hover:bg-[#f8f9fa]">Back</button>
          <button onClick={handleHardphoneNext}
            className="flex-1 py-2 text-sm font-medium bg-[#1a73e8] text-white rounded-lg hover:bg-[#1557b0] transition-colors">
            Continue
          </button>
        </div>
        <FixItButton targetStage="user_ingestion" />
      </div>
    </CardShell>
  );
}

