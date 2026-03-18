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
  type MenuOption,
  type QueueStrategy,
} from "@/contexts/ConciergeContext";
import {
  parseCSV,
  checkLicensing,
} from "@/lib/api/concierge-backend";
import { getAccessToken } from "@/lib/auth";
import {
  validateUrl,
  validateUser,
  validatePortingProvider,
  validatePortingAddress,
  validatePhoneNumber,
} from "@/lib/utils/validation";

// ── Shared ────────────────────────────────────────────────────────────────────

function FixItButton({ targetStage, label = "Wait, let\u2019s fix that" }: { targetStage: ConciergeStage; label?: string }) {
  const { setStage } = useConcierge();
  return (
    <button
      onClick={() => setStage(targetStage)}
      className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-[#1a73e8] transition-colors mt-3"
    >
      <RefreshCw className="w-3 h-3" aria-hidden="true" /> {label}
    </button>
  );
}

function CardShell({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`mx-4 mb-4 bg-[#f8f9fa] border border-[#e8eaed] rounded-2xl p-5 ${className}`} role="region">
      {children}
    </div>
  );
}

function ValidationErrors({ errors }: { errors: string[] }) {
  if (errors.length === 0) return null;
  return (
    <div className="space-y-1" role="alert">
      {errors.map((e, i) => (
        <p key={i} className="flex items-center gap-1.5 text-xs text-red-600">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" /> {e}
        </p>
      ))}
    </div>
  );
}

// ── 1. Welcome / Scrape ───────────────────────────────────────────────────────

function WelcomeScrapeWidget({ onMessages }: { onMessages: (msgs: string[]) => void }) {
  const { config } = useConcierge();
  const [name, setName] = useState(config.name);
  const [url, setUrl]   = useState(config.websiteUrl);
  const [errors, setErrors] = useState<string[]>([]);

  const handleSubmit = () => {
    const errs: string[] = [];
    if (!name.trim()) errs.push("Please enter your name.");
    if (!url.trim()) errs.push("Please enter your company website.");
    else if (!validateUrl(url.trim())) errs.push("Please enter a valid website URL.");
    if (errs.length) { setErrors(errs); return; }
    setErrors([]);
    onMessages([`${name.trim()} \u00b7 ${url.trim()}`]);
  };

  return (
    <CardShell>
      <div className="space-y-3">
        <div>
          <label htmlFor="welcome-name" className="block text-xs font-medium text-gray-600 mb-1">Your Name</label>
          <input
            id="welcome-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Jane Smith"
            className="w-full px-3 py-2 text-sm border border-[#dadce0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1a73e8] bg-white"
          />
        </div>
        <div>
          <label htmlFor="welcome-url" className="block text-xs font-medium text-gray-600 mb-1">Company Website</label>
          <div className="relative">
            <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" aria-hidden="true" />
            <input
              id="welcome-url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              placeholder="https://yourcompany.com"
              className="w-full pl-9 pr-3 py-2 text-sm border border-[#dadce0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1a73e8] bg-white"
            />
          </div>
        </div>
        <ValidationErrors errors={errors} />
        <button
          onClick={handleSubmit}
          disabled={!name.trim() || !url.trim()}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#1a73e8] text-white text-sm font-medium rounded-lg hover:bg-[#1557b0] disabled:opacity-50 transition-colors"
        >
          <ArrowRight className="w-4 h-4" aria-hidden="true" />
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
    updateConfig({
      scraped: { ...scraped, hours: editHours, timezone: editTimezone, location: editLocation },
    });
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
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="verify-location" className="block text-xs font-medium text-gray-600 mb-1">Location</label>
            <input
              id="verify-location"
              value={editLocation}
              onChange={(e) => setEditLocation(e.target.value)}
              className="w-full px-2.5 py-1.5 text-sm border border-[#dadce0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1a73e8] bg-white"
            />
          </div>
          <div>
            <label htmlFor="verify-timezone" className="block text-xs font-medium text-gray-600 mb-1">Timezone</label>
            <input
              id="verify-timezone"
              value={editTimezone}
              onChange={(e) => setEditTimezone(e.target.value)}
              className="w-full px-2.5 py-1.5 text-sm border border-[#dadce0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1a73e8] bg-white"
            />
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Business Hours</p>
          <div className="space-y-1.5 bg-white border border-[#e8eaed] rounded-xl overflow-hidden">
            {days.map((day) => (
              <div key={day} className="flex items-center gap-3 px-3 py-1.5 border-b border-[#f1f3f4] last:border-0">
                <span className="text-xs font-medium text-gray-700 w-24 shrink-0">{day}</span>
                <input
                  value={editHours[day]}
                  onChange={(e) => setEditHours((h) => ({ ...h, [day]: e.target.value }))}
                  aria-label={`${day} hours`}
                  className="flex-1 text-xs px-2 py-1 border border-[#dadce0] rounded focus:outline-none focus:ring-1 focus:ring-[#1a73e8] bg-white"
                />
              </div>
            ))}
          </div>
        </div>

        {scraped.phones.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Phone Numbers Found
            </p>
            <div className="flex flex-wrap gap-2">
              {scraped.phones.map((p) => (
                <span key={p} className="flex items-center gap-1.5 px-2.5 py-1 bg-[#e8f0fe] text-[#1a73e8] rounded-full text-xs font-medium">
                  <Phone className="w-3 h-3" aria-hidden="true" /> {p}
                </span>
              ))}
            </div>
          </div>
        )}

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
  opts?: { placeholder?: string; required?: boolean; type?: string; id?: string }
) {
  return (
    <div className="space-y-1">
      <label htmlFor={opts?.id} className="block text-xs font-medium text-gray-600">
        {label}{opts?.required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <input
        id={opts?.id}
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

  const [providerName, setProviderName]     = useState(config.portingQueue.providerName);
  const [accountNumber, setAccountNumber]   = useState(config.portingQueue.accountNumber);
  const [providerBtn, setProviderBtn]       = useState(config.portingQueue.providerBtn);
  const [pin, setPin]                       = useState(config.portingQueue.pin);
  const [targetDate, setTargetDate]         = useState(config.portingQueue.targetPortDate || (() => {
    const d = new Date(); d.setDate(d.getDate() + 30);
    return d.toISOString().split("T")[0];
  })());

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
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
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
    if (!n) return;
    if (!validatePhoneNumber(n)) {
      setValidationErrors(["Please enter a valid phone number (10\u201315 digits)."]);
      return;
    }
    setValidationErrors([]);
    setSelected((s) => { const next = new Set(s); next.add(n); return next; });
    setManualNum("");
  };

  const handleSkip = () => {
    updateConfig({ portingQueue: { ...config.portingQueue, skipped: true, numbers: [] } });
    onMessages(["Skip porting \u2014 I don\u2019t have numbers to port right now or will handle it later."]);
  };

  const handleNumbersNext = () => {
    if (selected.size === 0) return;
    updateConfig({ portingQueue: { ...config.portingQueue, numbers: Array.from(selected) } });
    setStep("provider");
  };

  const handleProviderNext = () => {
    const v = validatePortingProvider({ providerName, accountNumber, providerBtn, pin });
    if (!v.valid) { setValidationErrors(v.errors); return; }
    setValidationErrors([]);
    updateConfig({ portingQueue: { ...config.portingQueue, providerName, accountNumber, providerBtn, pin, targetPortDate: targetDate } });
    setStep("address");
  };

  const handleSubmit = async () => {
    const v = validatePortingAddress({ firstName, lastName, email, address1, city, state: stateAbbr, zip });
    if (!v.valid) { setValidationErrors(v.errors); return; }
    setValidationErrors([]);
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
              <Phone className="w-4 h-4" aria-hidden="true" /> Yes, I have numbers to port
            </button>
            <button
              onClick={handleSkip}
              className="flex items-center justify-center gap-2 py-2.5 text-sm font-medium text-gray-600 bg-[#f8f9fa] border border-[#dadce0] rounded-xl hover:bg-[#f1f3f4] transition-colors"
            >
              <SkipForward className="w-4 h-4" aria-hidden="true" /> Skip &mdash; I&apos;ll handle this later
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
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Step 1 of 3 &mdash; Numbers to Port</p>
          {phones.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs text-gray-500">Found on your website:</p>
              {phones.map((p) => (
                <button key={p} onClick={() => toggle(p)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg border text-left transition-all ${selected.has(p) ? "border-[#1a73e8] bg-[#e8f0fe]" : "border-[#dadce0] bg-white hover:bg-[#f8f9fa]"}`}
                  aria-pressed={selected.has(p)}
                >
                  {selected.has(p) ? <CheckSquare className="w-4 h-4 text-[#1a73e8] shrink-0" aria-hidden="true" /> : <Square className="w-4 h-4 text-gray-300 shrink-0" aria-hidden="true" />}
                  <Phone className="w-3.5 h-3.5 text-gray-500 shrink-0" aria-hidden="true" />
                  <span className="text-sm font-medium text-gray-800">{p}</span>
                </button>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <input value={manualNum} onChange={(e) => setManualNum(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addManual()}
              placeholder="Add a number manually, e.g. +12125551234"
              aria-label="Manual phone number"
              className="flex-1 px-3 py-2 text-sm border border-[#dadce0] rounded-lg focus:outline-none focus:border-[#1a73e8]" />
            <button onClick={addManual} className="px-3 py-2 bg-[#f1f3f4] border border-[#dadce0] rounded-lg hover:bg-[#e8eaed]" aria-label="Add number">
              <Plus className="w-4 h-4 text-gray-600" aria-hidden="true" />
            </button>
          </div>
          <ValidationErrors errors={validationErrors} />
          {selected.size > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {Array.from(selected).filter((p) => !phones.includes(p)).map((p) => (
                <span key={p} className="flex items-center gap-1 px-2 py-0.5 text-xs bg-[#e8f0fe] text-[#1a73e8] rounded-full">
                  {p}
                  <button onClick={() => toggle(p)} className="text-[#1a73e8] hover:text-[#1557b0]" aria-label={`Remove ${p}`}>&times;</button>
                </span>
              ))}
            </div>
          )}
          <div className="flex gap-2 pt-1">
            <button onClick={() => setStep("decide")} className="px-3 py-2 text-sm text-gray-500 border border-[#dadce0] rounded-lg hover:bg-[#f8f9fa]">Back</button>
            <button onClick={handleNumbersNext} disabled={selected.size === 0}
              className="flex-1 flex items-center justify-center gap-2 py-2 text-sm font-semibold bg-[#1a73e8] text-white rounded-lg hover:bg-[#1557b0] disabled:opacity-40 transition-colors">
              Next <ArrowRight className="w-4 h-4" aria-hidden="true" />
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
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Step 2 of 3 &mdash; Current Provider Details</p>
          <p className="text-xs text-gray-500">Find these on your current phone bill.</p>
          <div className="grid grid-cols-2 gap-2">
            {field("Provider / Carrier name", providerName, setProviderName, { placeholder: "e.g. Verizon", required: true, id: "port-provider" })}
            {field("Account number", accountNumber, setAccountNumber, { placeholder: "Your acct # with them", required: true, id: "port-acct" })}
            {field("Billing Telephone Number (BTN)", providerBtn, setProviderBtn, { placeholder: "+1 main billing number", required: true, id: "port-btn" })}
            {field("PIN / Passcode", pin, setPin, { placeholder: "Transfer PIN", required: true, type: "password", id: "port-pin" })}
          </div>
          <div className="space-y-1">
            <label htmlFor="port-date" className="flex items-center gap-1.5 text-xs font-medium text-gray-600">
              <Calendar className="w-3.5 h-3.5" aria-hidden="true" /> Target Port Date<span className="text-red-500">*</span>
            </label>
            <input id="port-date" type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)}
              min={new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0]}
              className="w-full px-3 py-2 text-sm border border-[#dadce0] rounded-lg focus:outline-none focus:border-[#1a73e8]" />
            <p className="text-xs text-gray-400">Porting typically takes 2&ndash;4 weeks. Select a date at least 2 weeks out.</p>
          </div>
          <ValidationErrors errors={validationErrors} />
          <div className="flex gap-2 pt-1">
            <button onClick={() => { setValidationErrors([]); setStep("numbers"); }} className="px-3 py-2 text-sm text-gray-500 border border-[#dadce0] rounded-lg hover:bg-[#f8f9fa]">Back</button>
            <button onClick={handleProviderNext} disabled={!providerName || !accountNumber || !providerBtn || !pin}
              className="flex-1 flex items-center justify-center gap-2 py-2 text-sm font-semibold bg-[#1a73e8] text-white rounded-lg hover:bg-[#1557b0] disabled:opacity-40 transition-colors">
              Next <ArrowRight className="w-4 h-4" aria-hidden="true" />
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
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Step 3 of 3 &mdash; Billing Contact &amp; Address</p>
          <p className="text-xs text-gray-500">Must match the address on your current phone bill.</p>
          <div className="grid grid-cols-2 gap-2">
            {field("First name", firstName, setFirstName, { required: true, id: "addr-fn" })}
            {field("Last name", lastName, setLastName, { required: true, id: "addr-ln" })}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {field("Email", email, setEmail, { required: true, type: "email", id: "addr-email" })}
            {field("Phone", contactPhone, setContactPhone, { placeholder: "+1...", id: "addr-phone" })}
          </div>
          {field("Company name", companyName, setCompanyName, { required: true, id: "addr-co" })}
          {field("Address line 1", address1, setAddress1, { required: true, id: "addr-1" })}
          {field("Address line 2", address2, setAddress2, { placeholder: "Suite, floor, etc. (optional)", id: "addr-2" })}
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-1">{field("State", stateAbbr, setStateAbbr, { placeholder: "CO", required: true, id: "addr-st" })}</div>
            <div className="col-span-1">{field("City", city, setCity, { required: true, id: "addr-city" })}</div>
            <div className="col-span-1">{field("ZIP", zip, setZip, { required: true, id: "addr-zip" })}</div>
          </div>
          <ValidationErrors errors={validationErrors} />
          {submitError && (
            <p className="flex items-center gap-1.5 text-xs text-red-600" role="alert">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" /> {submitError}
            </p>
          )}
          <div className="flex gap-2 pt-1">
            <button onClick={() => { setValidationErrors([]); setStep("provider"); }} className="px-3 py-2 text-sm text-gray-500 border border-[#dadce0] rounded-lg hover:bg-[#f8f9fa]">Back</button>
            <button onClick={handleSubmit} disabled={!firstName || !lastName || !email || !address1 || !city || !stateAbbr || !zip}
              className="flex-1 flex items-center justify-center gap-2 py-2 text-sm font-semibold bg-[#1a73e8] text-white rounded-lg hover:bg-[#1557b0] disabled:opacity-40 transition-colors">
              Submit Porting Request <ArrowRight className="w-4 h-4" aria-hidden="true" />
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
        <div className="flex flex-col items-center gap-3 py-4" role="status">
          <Loader2 className="w-7 h-7 text-[#1a73e8] animate-spin motion-reduce:animate-none" aria-hidden="true" />
          <p className="text-sm font-medium text-gray-700">Submitting porting request&hellip;</p>
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
            <Phone className="w-4 h-4 text-green-600" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-800">Porting request submitted!</p>
            <p className="text-xs text-gray-500">{selected.size} number{selected.size !== 1 ? "s" : ""} queued for porting</p>
          </div>
        </div>
        {signUrl ? (
          <div className="rounded-xl border border-[#e8eaed] bg-[#f8f9fa] p-3 space-y-2">
            <p className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5" aria-hidden="true" /> Sign your Letter of Authorization (LOA)
            </p>
            <p className="text-xs text-gray-500">You must sign the LOA to authorize the number transfer. Opens in a new tab.</p>
            <a href={signUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 py-2.5 text-sm font-semibold bg-[#1a73e8] text-white rounded-lg hover:bg-[#1557b0] transition-colors">
              Sign LOA <ExternalLink className="w-4 h-4" aria-hidden="true" />
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
  const [csvError, setCsvError]     = useState("");
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const addManual = () => {
    const v = validateUser({ firstName: newFirst, lastName: newLast, email: newEmail });
    if (!v.valid) { setValidationErrors(v.errors); return; }
    setValidationErrors([]);
    setUsers((u) => [...u, { firstName: newFirst.trim(), lastName: newLast.trim(), email: newEmail.trim() }]);
    setNewFirst(""); setNewLast(""); setNewEmail("");
  };

  const handleCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvLoading(true);
    setCsvError("");
    try {
      const parsed = await parseCSV(file);
      setUsers(parsed);
      setCsvLoading(false);
      setMode("confirm");
    } catch (err) {
      setCsvError(err instanceof Error ? err.message : "Failed to parse CSV");
      setCsvLoading(false);
    }
  };

  const handleConfirm = () => {
    updateConfig({ users });
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
            <Users className="w-6 h-6 text-gray-400 group-hover:text-[#1a73e8]" aria-hidden="true" />
            <span className="text-sm font-medium text-gray-700 group-hover:text-[#1a73e8]">Manual Entry</span>
          </button>
          <button
            onClick={() => fileRef.current?.click()}
            className="flex flex-col items-center gap-2 p-4 border border-[#dadce0] rounded-xl hover:border-[#1a73e8] hover:bg-[#e8f0fe] transition-all group"
          >
            {csvLoading
              ? <Loader2 className="w-6 h-6 animate-spin text-[#1a73e8]" aria-hidden="true" />
              : <Upload className="w-6 h-6 text-gray-400 group-hover:text-[#1a73e8]" aria-hidden="true" />}
            <span className="text-sm font-medium text-gray-700 group-hover:text-[#1a73e8]">Upload CSV</span>
          </button>
        </div>
        {csvError && (
          <p className="flex items-center gap-1.5 text-xs text-red-600 mt-2" role="alert">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" /> {csvError}
          </p>
        )}
        <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleCSV} aria-label="Upload CSV file" />
        <FixItButton targetStage="porting" />
      </CardShell>
    );
  }

  if (mode === "manual") {
    return (
      <CardShell>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Add Team Members</p>

        {users.length > 0 && (
          <div className="mb-3 rounded-xl overflow-hidden border border-[#e8eaed]">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-[#f8f9fa]">
                  <th className="px-3 py-2 text-left font-semibold text-gray-500">Name</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-500">Email</th>
                  <th className="px-2 py-2"><span className="sr-only">Remove</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f1f3f4]">
                {users.map((u, i) => (
                  <tr key={i} className="bg-white">
                    <td className="px-3 py-2 text-gray-700">{u.firstName} {u.lastName}</td>
                    <td className="px-3 py-2 text-gray-500">{u.email}</td>
                    <td className="px-2 py-2">
                      <button onClick={() => setUsers((u2) => u2.filter((_, idx) => idx !== i))} className="text-gray-300 hover:text-red-500" aria-label={`Remove ${u.firstName} ${u.lastName}`}>
                        <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="grid grid-cols-3 gap-2 mb-2">
          <input placeholder="First name" value={newFirst} onChange={(e) => setNewFirst(e.target.value)}
            aria-label="First name"
            className="px-2.5 py-1.5 text-sm border border-[#dadce0] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#1a73e8] bg-white" />
          <input placeholder="Last name" value={newLast} onChange={(e) => setNewLast(e.target.value)}
            aria-label="Last name"
            className="px-2.5 py-1.5 text-sm border border-[#dadce0] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#1a73e8] bg-white" />
          <input placeholder="Email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addManual()}
            aria-label="Email"
            className="px-2.5 py-1.5 text-sm border border-[#dadce0] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#1a73e8] bg-white" />
        </div>
        <ValidationErrors errors={validationErrors} />
        <button onClick={addManual} disabled={!newFirst.trim() || !newEmail.trim()}
          className="flex items-center gap-1.5 text-sm text-[#1a73e8] hover:underline disabled:opacity-40 mb-3">
          <Plus className="w-3.5 h-3.5" aria-hidden="true" /> Add person
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
        {users.length} users parsed from CSV &mdash; confirm to continue
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
      `${u.firstName} ${u.lastName} \u2192 ${u.department || "Unassigned"}${u.hardphoneModel ? ` (${u.hardphoneModel})` : ""}`
    ).join("; ");
    onMessages([`Departments: ${depts.join(", ")}. Hardphones: ${hasPhones ? "Yes" : "No"}. Users: ${userSummary}`]);
  };

  return (
    <CardShell>
      <div className="space-y-4">
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5" aria-hidden="true" /> Departments
          </p>
          <div className="flex gap-2 mb-2">
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
        </div>

        {depts.length > 0 && users.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" aria-hidden="true" /> Assign Users to Departments
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
          </div>
        )}

        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
            <HardDrive className="w-3.5 h-3.5" aria-hidden="true" /> Physical Desk Phones?
          </p>
          <div className="flex gap-2">
            {[true, false].map((v) => (
              <button key={String(v)} onClick={() => setHasPhones(v)}
                aria-pressed={hasPhones === v}
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

// ── 6. Call Routing (replaces Licensing) ──────────────────────────────────────

type RoutingStep = "welcome_menu" | "routing_type" | "after_hours";

const STRATEGY_OPTIONS: { value: QueueStrategy; label: string }[] = [
  { value: "ring_all", label: "Ring All" },
  { value: "round_robin", label: "Round Robin" },
  { value: "longest_idle", label: "Longest Idle" },
  { value: "linear", label: "Linear" },
  { value: "fewest_calls", label: "Fewest Calls" },
];

const DEST_TYPES = ["department", "ring_group", "voicemail", "directory", "user"] as const;

function deriveRoutingStep(config: { welcomeMenu: { configured?: boolean }; routingConfig: { groupName: string } }): RoutingStep {
  if (config.routingConfig.groupName) return "after_hours";
  if (config.welcomeMenu.configured) return "routing_type";
  return "welcome_menu";
}

function CallRoutingWidget({ onMessages }: { onMessages: (msgs: string[]) => void }) {
  const { config, updateConfig } = useConcierge();

  const [step, setStep] = useState<RoutingStep>(() => deriveRoutingStep(config));

  // Welcome menu state
  const [menuEnabled, setMenuEnabled] = useState(config.welcomeMenu.enabled);
  const defaultGreeting = `Thank you for calling ${config.companyName || "our company"}. ${config.departments.length > 0 ? config.departments.map((d, i) => `Press ${i + 1} for ${d}`).join(". ") + "." : "Please hold while we connect you."}`;
  const [greetingText, setGreetingText] = useState(config.welcomeMenu.greetingText || defaultGreeting);
  const [menuOptions, setMenuOptions] = useState<MenuOption[]>(
    config.welcomeMenu.menuOptions.length > 0
      ? config.welcomeMenu.menuOptions
      : config.departments.map((d, i) => ({ key: String(i + 1), destinationType: "department" as const, destinationName: d }))
  );

  // Routing type state
  const [routingChoice, setRoutingChoice] = useState<"ring_groups" | "call_queues">(config.routingType);
  const [checking, setChecking] = useState(false);
  const [eligible, setEligible] = useState<boolean | null>(null);
  const [groupName, setGroupName] = useState(config.routingConfig.groupName || `${config.companyName || "Main"} Team`);
  const [ringStrategy, setRingStrategy] = useState<QueueStrategy>(config.routingConfig.ringStrategy);
  const [maxWaitTime, setMaxWaitTime] = useState(config.routingConfig.maxWaitTime || 300);
  const [maxCapacity, setMaxCapacity] = useState(config.routingConfig.maxCapacity || 10);
  const [tiered, setTiered] = useState(config.routingConfig.tiers.length > 1);
  const [tiers, setTiers] = useState(
    config.routingConfig.tiers.length > 0
      ? config.routingConfig.tiers
      : [{ userEmails: config.users.map((u) => u.email), rings: 3 }]
  );

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
      greetingText: menuEnabled ? greetingText : "",
      menuOptions: menuEnabled ? menuOptions.filter((o) => o.destinationName.trim()) : [],
      configured: true,
    };
    updateConfig({ welcomeMenu: menu });
    const summary = menuEnabled
      ? `[routing] Welcome menu enabled. Greeting: "${greetingText.slice(0, 60)}..." Options: ${menu.menuOptions.map((o) => `${o.key}\u2192${o.destinationName}`).join(", ")}`
      : "[routing] Welcome menu disabled.";
    onMessages([summary]);
    setStep("routing_type");
  };

  const handleRoutingNext = () => {
    const rc = {
      groupName,
      tiers: routingChoice === "ring_groups" ? (tiered ? tiers : [{ userEmails: config.users.map((u) => u.email), rings: 3 }]) : [],
      ringStrategy: routingChoice === "call_queues" ? ringStrategy : "ring_all" as QueueStrategy,
      maxWaitTime: routingChoice === "call_queues" ? maxWaitTime : 0,
      maxCapacity: routingChoice === "call_queues" ? maxCapacity : 0,
    };
    updateConfig({ routingType: routingChoice, licensingVerified: eligible === true, routingConfig: rc });
    const label = routingChoice === "ring_groups" ? "Ring Groups" : "Call Queues";
    const detail = routingChoice === "call_queues"
      ? ` (${STRATEGY_OPTIONS.find((s) => s.value === ringStrategy)?.label}, max wait ${maxWaitTime}s, capacity ${maxCapacity})`
      : tiered ? ` (${tiers.length} tiers)` : " (Ring All)";
    onMessages([`[routing] Routing: ${label} "${groupName}"${detail}`]);
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
              <div>
                <label htmlFor="greeting-text" className="block text-xs font-medium text-gray-600 mb-1">Greeting Text</label>
                <textarea
                  id="greeting-text"
                  value={greetingText}
                  onChange={(e) => setGreetingText(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 text-sm border border-[#dadce0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1a73e8] bg-white resize-none"
                />
              </div>
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
                            const inTier = tier.userEmails.includes(u.email);
                            return (
                              <button key={u.email} onClick={() => {
                                setTiers((ts) => ts.map((t, i) => {
                                  if (i !== ti) return t;
                                  const emails = inTier ? t.userEmails.filter((e) => e !== u.email) : [...t.userEmails, u.email];
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

// ── 7. Final Blueprint ────────────────────────────────────────────────────────

function FinalBlueprintWidget({
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

// ── Exports ───────────────────────────────────────────────────────────────────

interface StageWidgetsProps {
  onUserMessages: (msgs: string[]) => void;
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
      return <CallRoutingWidget onMessages={onUserMessages} />;
    case "final_blueprint":
      return <FinalBlueprintWidget onMessages={onUserMessages} />;
    default:
      return null;
  }
}
