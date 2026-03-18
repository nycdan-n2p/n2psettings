"use client";

import { useState, useRef } from "react";
import {
  Globe, ArrowRight, CheckSquare, Square, Upload, Plus,
  Trash2, Phone, Users, Building2, HardDrive, ShieldCheck,
  RefreshCw, Loader2, AlertCircle, SkipForward, ExternalLink,
  Calendar, Lock,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  useConcierge,
  type OnboardingUser,
  type ConciergeStage,
} from "@/contexts/ConciergeContext";
import {
  parseCSV,
  checkLicensing,
} from "@/lib/api/concierge-backend";
import { getAccessToken } from "@/lib/auth";

// ── Shared ────────────────────────────────────────────────────────────────────

function FixItButton({ targetStage, label = "Wait, let's fix that" }: { targetStage: ConciergeStage; label?: string }) {
  const { setStage } = useConcierge();
  return (
    <button
      onClick={() => setStage(targetStage)}
      className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-[#1a73e8] transition-colors mt-3"
    >
      <RefreshCw className="w-3 h-3" /> {label}
    </button>
  );
}

function CardShell({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`mx-4 mb-4 bg-[#f8f9fa] border border-[#e8eaed] rounded-2xl p-5 ${className}`}>
      {children}
    </div>
  );
}

// ── 1. Welcome / Scrape ───────────────────────────────────────────────────────

function WelcomeScrapeWidget({ onMessages }: { onMessages: (msgs: string[]) => void }) {
  const { config } = useConcierge();
  const [name, setName] = useState(config.name);
  const [url, setUrl]   = useState(config.websiteUrl);
  const [error, setError] = useState("");

  // Widget is just a structured input helper.
  // The AI handles research_website → update_config → advance_stage.
  const handleSubmit = () => {
    if (!name.trim() || !url.trim()) { setError("Please enter both your name and website."); return; }
    setError("");
    onMessages([`${name.trim()} · ${url.trim()}`]);
  };

  return (
    <CardShell>
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Your Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Jane Smith"
            className="w-full px-3 py-2 text-sm border border-[#dadce0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1a73e8] bg-white"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Company Website</label>
          <div className="relative">
            <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              placeholder="https://yourcompany.com"
              className="w-full pl-9 pr-3 py-2 text-sm border border-[#dadce0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1a73e8] bg-white"
            />
          </div>
        </div>
        {error && (
          <p className="flex items-center gap-1.5 text-xs text-red-600">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {error}
          </p>
        )}
        <button
          onClick={handleSubmit}
          disabled={!name.trim() || !url.trim()}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#1a73e8] text-white text-sm font-medium rounded-lg hover:bg-[#1557b0] disabled:opacity-50 transition-colors"
        >
          <ArrowRight className="w-4 h-4" />
          Let&apos;s Go
        </button>
      </div>
    </CardShell>
  );
}

// ── 2. Verification & Holidays ────────────────────────────────────────────────

function VerificationWidget({ onMessages }: { onMessages: (msgs: string[]) => void }) {
  const { config, updateConfig } = useConcierge();
  const { scraped } = config;

  const [editHours, setEditHours] = useState<Record<string, string>>(scraped.hours);
  const [editTimezone, setEditTimezone] = useState(scraped.timezone);
  const [editLocation, setEditLocation] = useState(scraped.location);

  const handleHolidayChoice = (yes: boolean) => {
    // Persist any edits made in the form before sending to AI
    updateConfig({
      scraped: { ...scraped, hours: editHours, timezone: editTimezone, location: editLocation },
    });
    // Let the AI call update_config (holidays) + advance_stage — no direct advance() here
    if (yes) {
      onMessages(["Yes, load public holidays"]);
    } else {
      onMessages(["No, skip holidays"]);
    }
  };

  const days = Object.keys(editHours);

  return (
    <CardShell>
      <div className="space-y-4">
        {/* Location + Timezone row */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Location</label>
            <input
              value={editLocation}
              onChange={(e) => setEditLocation(e.target.value)}
              className="w-full px-2.5 py-1.5 text-sm border border-[#dadce0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1a73e8] bg-white"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Timezone</label>
            <input
              value={editTimezone}
              onChange={(e) => setEditTimezone(e.target.value)}
              className="w-full px-2.5 py-1.5 text-sm border border-[#dadce0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1a73e8] bg-white"
            />
          </div>
        </div>

        {/* Business Hours */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Business Hours</p>
          <div className="space-y-1.5 bg-white border border-[#e8eaed] rounded-xl overflow-hidden">
            {days.map((day) => (
              <div key={day} className="flex items-center gap-3 px-3 py-1.5 border-b border-[#f1f3f4] last:border-0">
                <span className="text-xs font-medium text-gray-700 w-24 shrink-0">{day}</span>
                <input
                  value={editHours[day]}
                  onChange={(e) => setEditHours((h) => ({ ...h, [day]: e.target.value }))}
                  className="flex-1 text-xs px-2 py-1 border border-[#dadce0] rounded focus:outline-none focus:ring-1 focus:ring-[#1a73e8] bg-white"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Phone numbers found */}
        {scraped.phones.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Phone Numbers Found
            </p>
            <div className="flex flex-wrap gap-2">
              {scraped.phones.map((p) => (
                <span key={p} className="flex items-center gap-1.5 px-2.5 py-1 bg-[#e8f0fe] text-[#1a73e8] rounded-full text-xs font-medium">
                  <Phone className="w-3 h-3" /> {p}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Holiday question */}
        <div className="pt-2 border-t border-[#f1f3f4]">
          <p className="text-sm font-medium text-gray-800 mb-3">
            Should I auto-load public holidays into your schedule?
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => handleHolidayChoice(true)}
              className="flex-1 py-2 text-sm font-medium border border-[#1a73e8] text-[#1a73e8] rounded-lg hover:bg-[#e8f0fe] transition-colors"
            >
              Yes, load holidays
            </button>
            <button
              onClick={() => handleHolidayChoice(false)}
              className="flex-1 py-2 text-sm font-medium border border-[#dadce0] text-gray-600 rounded-lg hover:bg-[#f1f3f4] transition-colors"
            >
              Skip for now
            </button>
          </div>
        </div>
      </div>
    </CardShell>
  );
}

// ── 3. Porting ────────────────────────────────────────────────────────────────

type PortingStep = "decide" | "numbers" | "provider" | "address" | "submitting" | "done";

function field(
  label: string,
  value: string,
  onChange: (v: string) => void,
  opts?: { placeholder?: string; required?: boolean; type?: string }
) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-medium text-gray-600">
        {label}{opts?.required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <input
        type={opts?.type ?? "text"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={opts?.placeholder ?? ""}
        className="w-full px-3 py-2 text-sm border border-[#dadce0] rounded-lg focus:outline-none focus:border-[#1a73e8] bg-white"
      />
    </div>
  );
}

function PortingWidget({ onMessages }: { onMessages: (msgs: string[]) => void }) {
  const { config, updateConfig } = useConcierge();
  const phones = config.scraped.phones;

  const [step, setStep] = useState<PortingStep>("decide");
  const [selected, setSelected] = useState<Set<string>>(new Set(phones));
  const [manualNum, setManualNum] = useState("");

  // Provider details
  const [providerName, setProviderName]     = useState(config.portingQueue.providerName);
  const [accountNumber, setAccountNumber]   = useState(config.portingQueue.accountNumber);
  const [providerBtn, setProviderBtn]       = useState(config.portingQueue.providerBtn);
  const [pin, setPin]                       = useState(config.portingQueue.pin);
  const [targetDate, setTargetDate]         = useState(config.portingQueue.targetPortDate || (() => {
    const d = new Date(); d.setDate(d.getDate() + 30);
    return d.toISOString().split("T")[0];
  })());

  // Contact / billing address
  const existing = config.portingQueue.contact;
  const [firstName, setFirstName]   = useState(existing.firstName || config.name.split(" ")[0] || "");
  const [lastName, setLastName]     = useState(existing.lastName  || config.name.split(" ").slice(1).join(" ") || "");
  const [email, setEmail]           = useState(existing.email);
  const [contactPhone, setContactPhone] = useState(existing.phone);
  const [companyName, setCompanyName]   = useState(existing.companyName || config.companyName);
  const [address1, setAddress1]         = useState(existing.address1);
  const [address2, setAddress2]         = useState(existing.address2);
  const [city, setCity]                 = useState(existing.city);
  const [stateAbbr, setStateAbbr]       = useState(existing.state);
  const [zip, setZip]                   = useState(existing.zip);

  const [submitError, setSubmitError] = useState("");
  const [signUrl, setSignUrl]         = useState(config.portingQueue.signLink ?? "");
  const [onboardId, setOnboardId]     = useState(config.portingQueue.onboardId);

  const toggle = (p: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(p)) { n.delete(p); } else { n.add(p); }
      return n;
    });

  const addManual = () => {
    const n = manualNum.trim().replace(/\s+/g, "");
    if (n) { setSelected((s) => { const next = new Set(s); next.add(n); return next; }); setManualNum(""); }
  };

  const handleSkip = () => {
    updateConfig({ portingQueue: { ...config.portingQueue, skipped: true, numbers: [] } });
    onMessages(["Skip porting — I don't have numbers to port right now or will handle it later."]);
  };

  const handleNumbersNext = () => {
    if (selected.size === 0) return;
    updateConfig({ portingQueue: { ...config.portingQueue, numbers: Array.from(selected) } });
    setStep("provider");
  };

  const handleProviderNext = () => {
    if (!providerName || !accountNumber || !providerBtn || !pin) return;
    updateConfig({ portingQueue: { ...config.portingQueue, providerName, accountNumber, providerBtn, pin, targetPortDate: targetDate } });
    setStep("address");
  };

  const handleSubmit = async () => {
    if (!firstName || !lastName || !email || !address1 || !city || !stateAbbr || !zip) return;
    setStep("submitting");
    setSubmitError("");

    const contact = { firstName, lastName, email, phone: contactPhone, companyName, address1, address2, city, state: stateAbbr, zip };
    updateConfig({ portingQueue: { ...config.portingQueue, contact } });

    const token = getAccessToken();
    if (!token) { setSubmitError("Not authenticated."); setStep("address"); return; }

    try {
      const res = await fetch("/api/porting", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          numbers: Array.from(selected),
          providerName, accountNumber, providerBtn, pin,
          targetPortDate: targetDate,
          contact,
          onboardId,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setSubmitError(json.error ?? "Submission failed");
        setStep("address");
        return;
      }
      const data = json.data as { onboardId?: number; signUrl?: string; status?: string };
      setOnboardId(data.onboardId);
      setSignUrl(data.signUrl ?? "");
      updateConfig({
        portingQueue: {
          ...config.portingQueue,
          contact,
          onboardId: data.onboardId,
          signLink: data.signUrl ?? "",
          status: data.status,
        },
      });
      setStep("done");
      onMessages([
        `[porting-done] Porting request submitted for ${selected.size} number${selected.size !== 1 ? "s" : ""}: ${Array.from(selected).join(", ")}. Status: ${data.status ?? "Submitted"}. Sign link: ${data.signUrl ?? "not available"}. Please call advance_stage.`,
      ]);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Submission failed");
      setStep("address");
    }
  };

  // ── Step: decide ──────────────────────────────────────────────────────────
  if (step === "decide") {
    return (
      <CardShell>
        <div className="space-y-3">
          <p className="text-sm font-medium text-gray-700">Do you have existing numbers to port to net2phone?</p>
          <p className="text-xs text-gray-500">Porting transfers your current phone numbers. It takes 2&ndash;4 weeks and requires your provider&apos;s account details and a signed Letter of Authorization.</p>
          <div className="flex flex-col gap-2 pt-1">
            <button
              onClick={() => setStep("numbers")}
              className="flex items-center justify-center gap-2 py-2.5 text-sm font-semibold bg-[#1a73e8] text-white rounded-xl hover:bg-[#1557b0] transition-colors"
            >
              <Phone className="w-4 h-4" /> Yes, I have numbers to port
            </button>
            <button
              onClick={handleSkip}
              className="flex items-center justify-center gap-2 py-2.5 text-sm font-medium text-gray-600 bg-[#f8f9fa] border border-[#dadce0] rounded-xl hover:bg-[#f1f3f4] transition-colors"
            >
              <SkipForward className="w-4 h-4" /> Skip &mdash; I&apos;ll handle this later
            </button>
          </div>
          <FixItButton targetStage="verification_holidays" />
        </div>
      </CardShell>
    );
  }

  // ── Step: numbers ──────────────────────────────────────────────────────────
  if (step === "numbers") {
    return (
      <CardShell>
        <div className="space-y-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Step 1 of 3 — Numbers to Port</p>
          {phones.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs text-gray-500">Found on your website:</p>
              {phones.map((p) => (
                <button key={p} onClick={() => toggle(p)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg border text-left transition-all ${selected.has(p) ? "border-[#1a73e8] bg-[#e8f0fe]" : "border-[#dadce0] bg-white hover:bg-[#f8f9fa]"}`}
                >
                  {selected.has(p) ? <CheckSquare className="w-4 h-4 text-[#1a73e8] shrink-0" /> : <Square className="w-4 h-4 text-gray-300 shrink-0" />}
                  <Phone className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                  <span className="text-sm font-medium text-gray-800">{p}</span>
                </button>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <input value={manualNum} onChange={(e) => setManualNum(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addManual()}
              placeholder="Add a number manually, e.g. +12125551234"
              className="flex-1 px-3 py-2 text-sm border border-[#dadce0] rounded-lg focus:outline-none focus:border-[#1a73e8]" />
            <button onClick={addManual} className="px-3 py-2 bg-[#f1f3f4] border border-[#dadce0] rounded-lg hover:bg-[#e8eaed]">
              <Plus className="w-4 h-4 text-gray-600" />
            </button>
          </div>
          {selected.size > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {Array.from(selected).filter((p) => !phones.includes(p)).map((p) => (
                <span key={p} className="flex items-center gap-1 px-2 py-0.5 text-xs bg-[#e8f0fe] text-[#1a73e8] rounded-full">
                  {p}
                  <button onClick={() => toggle(p)} className="text-[#1a73e8] hover:text-[#1557b0]">×</button>
                </span>
              ))}
            </div>
          )}
          <div className="flex gap-2 pt-1">
            <button onClick={() => setStep("decide")} className="px-3 py-2 text-sm text-gray-500 border border-[#dadce0] rounded-lg hover:bg-[#f8f9fa]">Back</button>
            <button onClick={handleNumbersNext} disabled={selected.size === 0}
              className="flex-1 flex items-center justify-center gap-2 py-2 text-sm font-semibold bg-[#1a73e8] text-white rounded-lg hover:bg-[#1557b0] disabled:opacity-40 transition-colors">
              Next <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </CardShell>
    );
  }

  // ── Step: provider ─────────────────────────────────────────────────────────
  if (step === "provider") {
    return (
      <CardShell>
        <div className="space-y-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Step 2 of 3 — Current Provider Details</p>
          <p className="text-xs text-gray-500">Find these on your current phone bill.</p>
          <div className="grid grid-cols-2 gap-2">
            {field("Provider / Carrier name", providerName, setProviderName, { placeholder: "e.g. Verizon", required: true })}
            {field("Account number", accountNumber, setAccountNumber, { placeholder: "Your acct # with them", required: true })}
            {field("Billing Telephone Number (BTN)", providerBtn, setProviderBtn, { placeholder: "+1 main billing number", required: true })}
            {field("PIN / Passcode", pin, setPin, { placeholder: "Transfer PIN", required: true, type: "password" })}
          </div>
          <div className="space-y-1">
            <label className="flex items-center gap-1.5 text-xs font-medium text-gray-600">
              <Calendar className="w-3.5 h-3.5" /> Target Port Date<span className="text-red-500">*</span>
            </label>
            <input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)}
              min={new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0]}
              className="w-full px-3 py-2 text-sm border border-[#dadce0] rounded-lg focus:outline-none focus:border-[#1a73e8]" />
            <p className="text-xs text-gray-400">Porting typically takes 2–4 weeks. Select a date at least 2 weeks out.</p>
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={() => setStep("numbers")} className="px-3 py-2 text-sm text-gray-500 border border-[#dadce0] rounded-lg hover:bg-[#f8f9fa]">Back</button>
            <button onClick={handleProviderNext} disabled={!providerName || !accountNumber || !providerBtn || !pin}
              className="flex-1 flex items-center justify-center gap-2 py-2 text-sm font-semibold bg-[#1a73e8] text-white rounded-lg hover:bg-[#1557b0] disabled:opacity-40 transition-colors">
              Next <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </CardShell>
    );
  }

  // ── Step: address ──────────────────────────────────────────────────────────
  if (step === "address") {
    return (
      <CardShell>
        <div className="space-y-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Step 3 of 3 — Billing Contact & Address</p>
          <p className="text-xs text-gray-500">Must match the address on your current phone bill.</p>
          <div className="grid grid-cols-2 gap-2">
            {field("First name", firstName, setFirstName, { required: true })}
            {field("Last name", lastName, setLastName, { required: true })}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {field("Email", email, setEmail, { required: true, type: "email" })}
            {field("Phone", contactPhone, setContactPhone, { placeholder: "+1..." })}
          </div>
          {field("Company name", companyName, setCompanyName, { required: true })}
          {field("Address line 1", address1, setAddress1, { required: true })}
          {field("Address line 2", address2, setAddress2, { placeholder: "Suite, floor, etc. (optional)" })}
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-1">{field("State", stateAbbr, setStateAbbr, { placeholder: "CO", required: true })}</div>
            <div className="col-span-1">{field("City", city, setCity, { required: true })}</div>
            <div className="col-span-1">{field("ZIP", zip, setZip, { required: true })}</div>
          </div>
          {submitError && (
            <p className="flex items-center gap-1.5 text-xs text-red-600">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {submitError}
            </p>
          )}
          <div className="flex gap-2 pt-1">
            <button onClick={() => setStep("provider")} className="px-3 py-2 text-sm text-gray-500 border border-[#dadce0] rounded-lg hover:bg-[#f8f9fa]">Back</button>
            <button onClick={handleSubmit} disabled={!firstName || !lastName || !email || !address1 || !city || !stateAbbr || !zip}
              className="flex-1 flex items-center justify-center gap-2 py-2 text-sm font-semibold bg-[#1a73e8] text-white rounded-lg hover:bg-[#1557b0] disabled:opacity-40 transition-colors">
              Submit Porting Request <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </CardShell>
    );
  }

  // ── Step: submitting ───────────────────────────────────────────────────────
  if (step === "submitting") {
    return (
      <CardShell>
        <div className="flex flex-col items-center gap-3 py-4">
          <Loader2 className="w-7 h-7 text-[#1a73e8] animate-spin" />
          <p className="text-sm font-medium text-gray-700">Submitting porting request…</p>
        </div>
      </CardShell>
    );
  }

  // ── Step: done ─────────────────────────────────────────────────────────────
  return (
    <CardShell>
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center shrink-0">
            <Phone className="w-4 h-4 text-green-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-800">Porting request submitted!</p>
            <p className="text-xs text-gray-500">{selected.size} number{selected.size !== 1 ? "s" : ""} queued for porting</p>
          </div>
        </div>
        {signUrl ? (
          <div className="rounded-xl border border-[#e8eaed] bg-[#f8f9fa] p-3 space-y-2">
            <p className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5" /> Sign your Letter of Authorization (LOA)
            </p>
            <p className="text-xs text-gray-500">You must sign the LOA to authorize the number transfer. Opens in a new tab.</p>
            <a href={signUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 py-2.5 text-sm font-semibold bg-[#1a73e8] text-white rounded-lg hover:bg-[#1557b0] transition-colors">
              Sign LOA <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        ) : (
          <p className="text-xs text-gray-500">You&apos;ll receive an email with the LOA link shortly.</p>
        )}
        {onboardId && (
          <p className="text-xs text-gray-400">Onboard ID: {onboardId}</p>
        )}
      </div>
    </CardShell>
  );
}

// ── 4. User Ingestion ─────────────────────────────────────────────────────────

function UserIngestionWidget({ onMessages }: { onMessages: (msgs: string[]) => void }) {
  const { config, updateConfig } = useConcierge();
  const [mode, setMode]             = useState<"choose" | "manual" | "csv" | "confirm">("choose");
  const [users, setUsers]           = useState<OnboardingUser[]>(config.users.length ? config.users : []);
  const [newFirst, setNewFirst]     = useState("");
  const [newLast, setNewLast]       = useState("");
  const [newEmail, setNewEmail]     = useState("");
  const [csvLoading, setCsvLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const addManual = () => {
    if (!newFirst.trim() || !newEmail.trim()) return;
    setUsers((u) => [...u, { firstName: newFirst.trim(), lastName: newLast.trim(), email: newEmail.trim() }]);
    setNewFirst(""); setNewLast(""); setNewEmail("");
  };

  const handleCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvLoading(true);
    const parsed = await parseCSV(file);
    setUsers(parsed);
    setCsvLoading(false);
    setMode("confirm");
  };

  const handleConfirm = () => {
    // Persist locally so the AI receives the latest users in its config snapshot
    updateConfig({ users });
    // Send rich message so AI can save + advance without asking again
    const list = users.map((u) =>
      `${u.firstName} ${u.lastName} <${u.email}>${u.department ? ` [${u.department}]` : ""}`
    ).join("; ");
    onMessages([`[form] ${users.length} user${users.length !== 1 ? "s" : ""} confirmed: ${list}. Please call update_config with these users then advance_stage.`]);
  };

  if (mode === "choose") {
    return (
      <CardShell>
        <p className="text-sm text-gray-600 mb-3">How would you like to add your team?</p>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setMode("manual")}
            className="flex flex-col items-center gap-2 p-4 border border-[#dadce0] rounded-xl hover:border-[#1a73e8] hover:bg-[#e8f0fe] transition-all group"
          >
            <Users className="w-6 h-6 text-gray-400 group-hover:text-[#1a73e8]" />
            <span className="text-sm font-medium text-gray-700 group-hover:text-[#1a73e8]">Manual Entry</span>
          </button>
          <button
            onClick={() => fileRef.current?.click()}
            className="flex flex-col items-center gap-2 p-4 border border-[#dadce0] rounded-xl hover:border-[#1a73e8] hover:bg-[#e8f0fe] transition-all group"
          >
            {csvLoading
              ? <Loader2 className="w-6 h-6 animate-spin text-[#1a73e8]" />
              : <Upload className="w-6 h-6 text-gray-400 group-hover:text-[#1a73e8]" />}
            <span className="text-sm font-medium text-gray-700 group-hover:text-[#1a73e8]">Upload CSV</span>
          </button>
        </div>
        <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleCSV} />
        <FixItButton targetStage="porting" />
      </CardShell>
    );
  }

  if (mode === "manual") {
    return (
      <CardShell>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Add Team Members</p>

        {/* Existing users table */}
        {users.length > 0 && (
          <div className="mb-3 rounded-xl overflow-hidden border border-[#e8eaed]">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-[#f8f9fa]">
                  <th className="px-3 py-2 text-left font-semibold text-gray-500">Name</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-500">Email</th>
                  <th className="px-2 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f1f3f4]">
                {users.map((u, i) => (
                  <tr key={i} className="bg-white">
                    <td className="px-3 py-2 text-gray-700">{u.firstName} {u.lastName}</td>
                    <td className="px-3 py-2 text-gray-500">{u.email}</td>
                    <td className="px-2 py-2">
                      <button onClick={() => setUsers((u2) => u2.filter((_, idx) => idx !== i))} className="text-gray-300 hover:text-red-500">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Add row */}
        <div className="grid grid-cols-3 gap-2 mb-2">
          <input placeholder="First name" value={newFirst} onChange={(e) => setNewFirst(e.target.value)}
            className="px-2.5 py-1.5 text-sm border border-[#dadce0] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#1a73e8] bg-white" />
          <input placeholder="Last name" value={newLast} onChange={(e) => setNewLast(e.target.value)}
            className="px-2.5 py-1.5 text-sm border border-[#dadce0] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#1a73e8] bg-white" />
          <input placeholder="Email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addManual()}
            className="px-2.5 py-1.5 text-sm border border-[#dadce0] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#1a73e8] bg-white" />
        </div>
        <button onClick={addManual} disabled={!newFirst.trim() || !newEmail.trim()}
          className="flex items-center gap-1.5 text-sm text-[#1a73e8] hover:underline disabled:opacity-40 mb-3">
          <Plus className="w-3.5 h-3.5" /> Add person
        </button>

        <button onClick={handleConfirm} disabled={users.length === 0}
          className="w-full py-2 text-sm font-medium bg-[#1a73e8] text-white rounded-lg hover:bg-[#1557b0] disabled:opacity-40 transition-colors">
          Continue with {users.length} user{users.length !== 1 ? "s" : ""}
        </button>
        <FixItButton targetStage="porting" />
      </CardShell>
    );
  }

  // CSV confirm
  return (
    <CardShell>
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
        {users.length} users parsed from CSV — confirm to continue
      </p>
      <div className="rounded-xl overflow-hidden border border-[#e8eaed] mb-4 max-h-60 overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-[#f8f9fa]">
            <tr>
              <th className="px-3 py-2 text-left font-semibold text-gray-500">Name</th>
              <th className="px-3 py-2 text-left font-semibold text-gray-500">Email</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f1f3f4]">
            {users.map((u, i) => (
              <tr key={i} className="bg-white">
                <td className="px-3 py-2 text-gray-700">{u.firstName} {u.lastName}</td>
                <td className="px-3 py-2 text-gray-500">{u.email}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button onClick={handleConfirm}
        className="w-full py-2 text-sm font-medium bg-[#1a73e8] text-white rounded-lg hover:bg-[#1557b0] transition-colors">
        Confirm {users.length} Users
      </button>
      <FixItButton targetStage="porting" />
    </CardShell>
  );
}

// ── 5. Architecture & Hardware ────────────────────────────────────────────────

function ArchitectureWidget({ onMessages }: { onMessages: (msgs: string[]) => void }) {
  const { config, updateConfig } = useConcierge();
  const [deptInput, setDeptInput]       = useState("");
  const [depts, setDepts]               = useState<string[]>(config.departments.length ? config.departments : []);
  const [hasPhones, setHasPhones]       = useState<boolean | null>(config.hasHardphones || null);
  const [users, setUsers]               = useState<OnboardingUser[]>(config.users);

  const addDept = () => {
    const v = deptInput.trim();
    if (!v || depts.includes(v)) return;
    setDepts((d) => [...d, v]);
    setDeptInput("");
  };

  const handleContinue = () => {
    updateConfig({ departments: depts, hasHardphones: !!hasPhones, users });
    const userSummary = users.map((u) =>
      `${u.firstName} ${u.lastName} → ${u.department || "Unassigned"}${u.hardphoneModel ? ` (${u.hardphoneModel})` : ""}`
    ).join("; ");
    // Let AI call advance_stage — no direct advance() to avoid race with driveLoop
    onMessages([`Departments: ${depts.join(", ")}. Hardphones: ${hasPhones ? "Yes" : "No"}. Users: ${userSummary}`]);
  };

  return (
    <CardShell>
      <div className="space-y-4">
        {/* Departments */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5" /> Departments
          </p>
          <div className="flex gap-2 mb-2">
            <input
              value={deptInput}
              onChange={(e) => setDeptInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addDept()}
              placeholder="e.g. Sales"
              className="flex-1 px-2.5 py-1.5 text-sm border border-[#dadce0] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#1a73e8] bg-white"
            />
            <button onClick={addDept} className="px-3 py-1.5 bg-[#1a73e8] text-white rounded-lg text-sm hover:bg-[#1557b0]">
              <Plus className="w-4 h-4" />
            </button>
          </div>
          {depts.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {depts.map((d) => (
                <span key={d} className="flex items-center gap-1 pl-2.5 pr-1.5 py-1 bg-[#e8f0fe] text-[#1a73e8] rounded-full text-xs font-medium">
                  {d}
                  <button onClick={() => setDepts((ds) => ds.filter((x) => x !== d))} className="text-[#1a73e8] hover:text-red-500">
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Assign users to depts — each user gets their own row with name + dropdown */}
        {depts.length > 0 && users.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" /> Assign Users to Departments
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
                    className="w-36 shrink-0 text-xs px-2 py-1.5 border border-[#dadce0] rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-[#1a73e8]"
                  >
                    <option value="">— Unassigned —</option>
                    {depts.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Hardphones */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
            <HardDrive className="w-3.5 h-3.5" /> Physical Desk Phones?
          </p>
          <div className="flex gap-2">
            {[true, false].map((v) => (
              <button key={String(v)} onClick={() => setHasPhones(v)}
                className={`flex-1 py-2 text-sm font-medium rounded-lg border transition-all ${
                  hasPhones === v
                    ? "border-[#1a73e8] bg-[#e8f0fe] text-[#1a73e8]"
                    : "border-[#dadce0] text-gray-600 hover:bg-[#f8f9fa]"
                }`}>
                {v ? "Yes, we have hardphones" : "No, softphones only"}
              </button>
            ))}
          </div>
        </div>

        {/* Hardphone config per user */}
        {hasPhones && users.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Hardphone Details</p>
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
                    className="w-24 shrink-0 text-xs px-2 py-1.5 border border-[#dadce0] rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-[#1a73e8]"
                  />
                  <input
                    placeholder="MAC address"
                    value={u.macAddress ?? ""}
                    onChange={(e) => setUsers((us) => us.map((x, xi) => xi === i ? { ...x, macAddress: e.target.value } : x))}
                    className="w-32 shrink-0 text-xs px-2 py-1.5 border border-[#dadce0] rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-[#1a73e8]"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        <button onClick={handleContinue} disabled={hasPhones === null}
          className="w-full py-2 text-sm font-medium bg-[#1a73e8] text-white rounded-lg hover:bg-[#1557b0] disabled:opacity-40 transition-colors">
          Continue
        </button>
        <FixItButton targetStage="user_ingestion" />
      </div>
    </CardShell>
  );
}

// ── 6. Licensing ──────────────────────────────────────────────────────────────

function LicensingWidget({ onMessages }: { onMessages: (msgs: string[]) => void }) {
  const { config, updateConfig } = useConcierge();
  const [choice, setChoice]   = useState<"ring_groups" | "call_queues">(config.routingType);
  const [checking, setChecking] = useState(false);
  const [eligible, setEligible] = useState<boolean | null>(null);

  const handleChoice = async (type: "ring_groups" | "call_queues") => {
    setChoice(type);
    if (type === "call_queues") {
      setChecking(true);
      const ok = await checkLicensing("call_queues", getAccessToken() ?? undefined);
      setEligible(ok);
      setChecking(false);
    } else {
      setEligible(true);
    }
  };

  const handleContinue = () => {
    updateConfig({ routingType: choice, licensingVerified: eligible === true });
    // Let AI call advance_stage — no direct advance() to avoid race with driveLoop
    onMessages([`Routing: ${choice === "ring_groups" ? "Ring Groups" : "Call Queues"}`]);
  };

  return (
    <CardShell>
      <div className="space-y-3">
        <p className="text-xs text-gray-500">Select how inbound calls should be routed to your team:</p>
        <div className="space-y-2">
          {([
            { value: "ring_groups" as const, label: "Ring Groups", desc: "Included with all plans. Rings all members simultaneously." },
            { value: "call_queues" as const, label: "Call Queues", desc: "Requires Call Queue license. Callers wait in line." },
          ]).map(({ value, label, desc }) => (
            <button key={value} onClick={() => handleChoice(value)}
              className={`w-full flex items-start gap-3 p-3 rounded-xl border text-left transition-all ${
                choice === value ? "border-[#1a73e8] bg-[#e8f0fe]" : "border-[#dadce0] bg-white hover:bg-[#f8f9fa]"
              }`}>
              <div className={`w-4 h-4 rounded-full border-2 mt-0.5 shrink-0 flex items-center justify-center ${
                choice === value ? "border-[#1a73e8]" : "border-[#dadce0]"
              }`}>
                {choice === value && <div className="w-2 h-2 rounded-full bg-[#1a73e8]" />}
              </div>
              <div>
                <p className="text-sm font-medium text-gray-800">{label}</p>
                <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
              </div>
            </button>
          ))}
        </div>

        {/* License check result */}
        {choice === "call_queues" && (
          <div>
            {checking && (
              <p className="flex items-center gap-2 text-xs text-gray-500">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Checking license eligibility…
              </p>
            )}
            {eligible === false && !checking && (
              <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Call Queue license not found</p>
                  <p className="mt-0.5">Contact your net2phone account manager to add this feature.</p>
                </div>
              </div>
            )}
            {eligible === true && !checking && (
              <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-xl text-xs text-green-800">
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <p className="font-semibold">Call Queue license verified</p>
              </div>
            )}
          </div>
        )}

        <button onClick={handleContinue} disabled={checking || (choice === "call_queues" && eligible === false)}
          className="w-full py-2 text-sm font-medium bg-[#1a73e8] text-white rounded-lg hover:bg-[#1557b0] disabled:opacity-40 transition-colors">
          Continue
        </button>
        <FixItButton targetStage="architecture_hardware" />
      </div>
    </CardShell>
  );
}

// ── 7. Final Blueprint ────────────────────────────────────────────────────────

function FinalBlueprintWidget({
  onMessages,
}: {
  onMessages: (msgs: string[]) => void;
}) {
  const { config } = useConcierge();
  const [applying, setApplying] = useState(false);

  // Widget just sends "Confirm & Build" — the AI calls apply_configuration({ confirm: true })
  // which triggers the handleApplySuccess transition in the overlay (no double-apply).
  const handleConfirm = () => {
    setApplying(true);
    onMessages(["Confirm & Build"]);
    // applying spinner stays until the widgetStage changes (AI finishes)
  };

  // Build blueprint markdown
  const hoursRows = Object.entries(config.scraped.hours)
    .map(([day, hrs]) => `| ${day} | ${hrs} |`)
    .join("\n");

  const usersRows = config.users
    .map((u) => `| ${u.firstName} ${u.lastName} | ${u.email} | ${u.department ?? "—"} |`)
    .join("\n");

  const blueprint = `
## ${config.companyName || "Your Company"} — Setup Blueprint

| Field | Value |
|---|---|
| Location | ${config.scraped.location} |
| Timezone | ${config.scraped.timezone} |
| Routing Type | ${config.routingType === "ring_groups" ? "Ring Groups" : "Call Queues"} |
| Departments | ${config.departments.join(", ") || "—"} |
| Users | ${config.users.length} |
| Numbers to Port | ${config.portingQueue.numbers.length || "—"} |
| Holidays | ${config.holidays.length > 0 && config.holidays[0]?.date !== "__auto__" ? config.holidays.length : config.holidays.length > 0 ? "Auto-loaded" : "None"} |

### Business Hours

| Day | Hours |
|---|---|
${hoursRows}

### Team Members

| Name | Email | Department |
|---|---|---|
${usersRows || "| — | — | — |"}
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
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Building your system…</>
            : <><ShieldCheck className="w-4 h-4" /> Confirm &amp; Build</>}
        </button>
        <FixItButton targetStage="licensing" label="Go back and change something" />
      </div>
    </CardShell>
  );
}

// ── Exports ───────────────────────────────────────────────────────────────────

interface StageWidgetsProps {
  onUserMessages: (msgs: string[]) => void;
  /** Explicit stage to render — defaults to context stage if omitted. */
  currentStage?: string;
}

export function StageWidget({ onUserMessages, currentStage }: StageWidgetsProps) {
  const { stage: contextStage } = useConcierge();
  const stage = currentStage ?? contextStage;

  switch (stage) {
    case "welcome_scrape":
      return <WelcomeScrapeWidget onMessages={onUserMessages} />;
    case "verification_holidays":
      return <VerificationWidget onMessages={onUserMessages} />;
    case "porting":
      return <PortingWidget onMessages={onUserMessages} />;
    case "user_ingestion":
      return <UserIngestionWidget onMessages={onUserMessages} />;
    case "architecture_hardware":
      return <ArchitectureWidget onMessages={onUserMessages} />;
    case "licensing":
      return <LicensingWidget onMessages={onUserMessages} />;
    case "final_blueprint":
      return <FinalBlueprintWidget onMessages={onUserMessages} />;
    default:
      return null;
  }
}
