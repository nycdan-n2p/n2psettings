"use client";

import { useState, useEffect } from "react";
import {
  Phone, ArrowRight, CheckSquare, Square, Plus,
  Loader2, AlertCircle, SkipForward, ExternalLink,
  Calendar, Lock,
} from "lucide-react";
import { useConcierge } from "@/contexts/ConciergeContext";
import { useApp } from "@/contexts/AppContext";
import { fetchPhoneNumberStats } from "@/lib/api/onboarding";
import { getAccessToken } from "@/lib/auth";
import {
  validatePhoneNumber,
  validatePortingProvider,
  validatePortingAddress,
} from "@/lib/utils/validation";
import { CardShell, ValidationErrors, FixItButton } from "./shared";

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

export function PortingWidget({ onMessages }: { onMessages: (msgs: string[]) => void }) {
  const { config, updateConfig } = useConcierge();
  const { bootstrap } = useApp();
  const accountId = bootstrap?.account?.accountId ?? 0;
  const phones = config.scraped.phones;

  const [step, setStep] = useState<PortingStep>(phones.length > 0 ? "numbers" : "decide");
  const [selected, setSelected] = useState<Set<string>>(new Set(phones));
  const [phoneStats, setPhoneStats] = useState<{ maxPhoneNumbers: number; phoneNumbersInUse: number } | null>(null);

  useEffect(() => {
    if (!accountId) return;
    fetchPhoneNumberStats(accountId).then((s) => {
      if (s) setPhoneStats({ maxPhoneNumbers: s.maxPhoneNumbers, phoneNumbersInUse: s.phoneNumbersInUse });
    });
  }, [accountId]);

  const availableSlots = phoneStats
    ? Math.max(0, phoneStats.maxPhoneNumbers - phoneStats.phoneNumbersInUse)
    : null;
  const overLimit = availableSlots != null && selected.size > availableSlots;
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
    if (overLimit) {
      setValidationErrors([`Your plan allows up to ${availableSlots} number${availableSlots !== 1 ? "s" : ""}. You're trying to port ${selected.size}. Remove some or contact sales to increase your limit.`]);
      return;
    }
    setValidationErrors([]);
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
          <FixItButton targetStage="architecture_hardware" />
        </div>
      </CardShell>
    );
  }

  if (step === "numbers") {
    return (
      <CardShell>
        <div className="space-y-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Step 1 of 3 &mdash; Numbers to Port</p>
          {phones.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-sm text-gray-700">
                I found {phones.length === 1 ? "this number" : "these numbers"} on your website &mdash; want to port {phones.length === 1 ? "it" : "them"} to net2phone?
              </p>
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
              <p className="text-xs text-gray-400">Toggle to select/deselect. You can also add more numbers below.</p>
            </div>
          )}
          <div className="flex gap-2">
            <input value={manualNum} onChange={(e) => setManualNum(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addManual()}
              placeholder="Add another number, e.g. +12125551234"
              aria-label="Manual phone number"
              className="flex-1 px-3 py-2 text-sm border border-[#dadce0] rounded-lg focus:outline-none focus:border-[#1a73e8]" />
            <button onClick={addManual} className="px-3 py-2 bg-[#f1f3f4] border border-[#dadce0] rounded-lg hover:bg-[#e8eaed]" aria-label="Add number">
              <Plus className="w-4 h-4 text-gray-600" aria-hidden="true" />
            </button>
          </div>
          {phoneStats && (
            <p className="text-xs text-gray-600">
              Your plan: {phoneStats.phoneNumbersInUse} of {phoneStats.maxPhoneNumbers} numbers in use. You can port up to {availableSlots} more.
            </p>
          )}
          {overLimit && (
            <p className="flex items-center gap-1.5 text-xs text-amber-600" role="alert">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              Your plan allows up to {availableSlots} number{availableSlots !== 1 ? "s" : ""}. You&apos;re selecting {selected.size}. Remove some or contact sales to increase your limit.
            </p>
          )}
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
            <button onClick={handleSkip}
              className="px-3 py-2 text-sm text-gray-500 border border-[#dadce0] rounded-lg hover:bg-[#f8f9fa]">
              Skip porting
            </button>
            <button onClick={handleNumbersNext} disabled={selected.size === 0 || overLimit}
              className="flex-1 flex items-center justify-center gap-2 py-2 text-sm font-semibold bg-[#1a73e8] text-white rounded-lg hover:bg-[#1557b0] disabled:opacity-40 transition-colors">
              Port {selected.size} number{selected.size !== 1 ? "s" : ""} <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </CardShell>
    );
  }

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
