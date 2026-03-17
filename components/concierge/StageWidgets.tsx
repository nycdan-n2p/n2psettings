"use client";

import { useState, useRef } from "react";
import {
  Globe, ArrowRight, CheckSquare, Square, Upload, Plus,
  Trash2, Phone, Users, Building2, HardDrive, ShieldCheck,
  RefreshCw, Loader2, AlertCircle,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  useConcierge,
  type OnboardingUser,
  type ConciergeStage,
} from "@/contexts/ConciergeContext";
import {
  researchWebsite,
  parseCSV,
  checkLicensing,
  applyConfiguration,
  type ScrapedWebsiteData,
} from "@/lib/api/concierge-backend";

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
  const { updateConfig, advance, config } = useConcierge();
  const [name, setName]         = useState(config.name);
  const [url, setUrl]           = useState(config.websiteUrl);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");

  const handleSubmit = async () => {
    if (!name.trim() || !url.trim()) { setError("Please enter both your name and website."); return; }
    setError("");
    setLoading(true);
    onMessages([`${name.trim()} · ${url.trim()}`]);
    try {
      const data: ScrapedWebsiteData = await researchWebsite(url.trim());
      updateConfig({
        name: name.trim(),
        companyName: data.companyName ?? name.trim(),
        websiteUrl: url.trim(),
        scraped: {
          location:  data.location,
          timezone:  data.timezone,
          hours:     data.hours,
          phones:    data.phones,
          address:   data.address,
        },
      });
      advance();
    } catch {
      setError("Couldn't reach that website. Please try again.");
    } finally {
      setLoading(false);
    }
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
          disabled={loading || !name.trim() || !url.trim()}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#1a73e8] text-white text-sm font-medium rounded-lg hover:bg-[#1557b0] disabled:opacity-50 transition-colors"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
          {loading ? "Researching your website…" : "Let's Go"}
        </button>
      </div>
    </CardShell>
  );
}

// ── 2. Verification & Holidays ────────────────────────────────────────────────

function VerificationWidget({ onMessages }: { onMessages: (msgs: string[]) => void }) {
  const { config, updateConfig, advance } = useConcierge();
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
      // Holidays are fetched lazily in the overlay based on location; store intent
      updateConfig({ holidays: [{ date: "__auto__", name: "__auto__" }] });
    } else {
      onMessages(["No, skip holidays"]);
      updateConfig({ holidays: [] });
    }
    advance();
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

function PortingWidget({ onMessages }: { onMessages: (msgs: string[]) => void }) {
  const { config, updateConfig, advance } = useConcierge();
  const phones = config.scraped.phones;
  const [selected, setSelected] = useState<Set<string>>(new Set(phones));

  const toggle = (p: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(p)) { n.delete(p); } else { n.add(p); }
      return n;
    });

  const handleContinue = () => {
    const numbers = Array.from(selected);
    updateConfig({
      portingQueue: {
        numbers,
        companyName: config.companyName,
        address: config.scraped.address,
      },
    });
    onMessages([numbers.length ? `Port ${numbers.length} number${numbers.length !== 1 ? "s" : ""}: ${numbers.join(", ")}` : "Skip porting for now"]);
    advance();
  };

  return (
    <CardShell>
      <div className="space-y-3">
        <p className="text-xs text-gray-500">Select the numbers you want to port to net2phone:</p>
        {phones.length === 0 ? (
          <p className="text-sm text-gray-400 italic">No numbers were found on the website.</p>
        ) : (
          <div className="space-y-2">
            {phones.map((p) => (
              <button
                key={p}
                onClick={() => toggle(p)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-all ${
                  selected.has(p)
                    ? "border-[#1a73e8] bg-[#e8f0fe]"
                    : "border-[#dadce0] bg-white hover:bg-[#f8f9fa]"
                }`}
              >
                {selected.has(p)
                  ? <CheckSquare className="w-4 h-4 text-[#1a73e8] shrink-0" />
                  : <Square className="w-4 h-4 text-gray-300 shrink-0" />}
                <Phone className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                <span className="text-sm font-medium text-gray-800">{p}</span>
              </button>
            ))}
          </div>
        )}
        <div className="flex gap-2 pt-1">
          <button
            onClick={handleContinue}
            className="flex-1 py-2 text-sm font-medium bg-[#1a73e8] text-white rounded-lg hover:bg-[#1557b0] transition-colors"
          >
            {selected.size > 0 ? `Port ${selected.size} Number${selected.size !== 1 ? "s" : ""}` : "Skip Porting"}
          </button>
        </div>
        <FixItButton targetStage="verification_holidays" />
      </div>
    </CardShell>
  );
}

// ── 4. User Ingestion ─────────────────────────────────────────────────────────

function UserIngestionWidget({ onMessages }: { onMessages: (msgs: string[]) => void }) {
  const { config, updateConfig, advance } = useConcierge();
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
    onMessages([`Uploaded CSV: ${parsed.length} users`]);
  };

  const handleConfirm = () => {
    updateConfig({ users });
    onMessages([`${users.length} user${users.length !== 1 ? "s" : ""} added`]);
    advance();
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
  const { config, updateConfig, advance } = useConcierge();
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
    onMessages([`${depts.length} department${depts.length !== 1 ? "s" : ""}: ${depts.join(", ")}. Hardphones: ${hasPhones ? "Yes" : "No"}`]);
    advance();
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

        {/* Assign users to depts */}
        {depts.length > 0 && users.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" /> Assign Users to Departments
            </p>
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {users.map((u, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-xs text-gray-700 w-36 truncate shrink-0">{u.firstName} {u.lastName}</span>
                  <select
                    value={u.department ?? ""}
                    onChange={(e) => setUsers((us) => us.map((x, xi) => xi === i ? { ...x, department: e.target.value } : x))}
                    className="flex-1 text-xs px-2 py-1 border border-[#dadce0] rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-[#1a73e8]"
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
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Model & MAC Address</p>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {users.map((u, i) => (
                <div key={i} className="grid grid-cols-[1fr_auto_auto] gap-2 items-center">
                  <span className="text-xs text-gray-700 truncate">{u.firstName} {u.lastName}</span>
                  <input
                    placeholder="Model (e.g. T46U)"
                    value={u.hardphoneModel ?? ""}
                    onChange={(e) => setUsers((us) => us.map((x, xi) => xi === i ? { ...x, hardphoneModel: e.target.value } : x))}
                    className="w-28 text-xs px-2 py-1 border border-[#dadce0] rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-[#1a73e8]"
                  />
                  <input
                    placeholder="MAC (xx:xx:xx…)"
                    value={u.macAddress ?? ""}
                    onChange={(e) => setUsers((us) => us.map((x, xi) => xi === i ? { ...x, macAddress: e.target.value } : x))}
                    className="w-36 text-xs px-2 py-1 border border-[#dadce0] rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-[#1a73e8]"
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
  const { config, updateConfig, advance } = useConcierge();
  const [choice, setChoice]   = useState<"ring_groups" | "call_queues">(config.routingType);
  const [checking, setChecking] = useState(false);
  const [eligible, setEligible] = useState<boolean | null>(null);

  const handleChoice = async (type: "ring_groups" | "call_queues") => {
    setChoice(type);
    if (type === "call_queues") {
      setChecking(true);
      const ok = await checkLicensing("call_queues");
      setEligible(ok);
      setChecking(false);
    } else {
      setEligible(true);
    }
  };

  const handleContinue = () => {
    updateConfig({ routingType: choice, licensingVerified: eligible === true });
    onMessages([`Routing: ${choice === "ring_groups" ? "Ring Groups" : "Call Queues"}`]);
    advance();
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
  onApply,
}: {
  onMessages: (msgs: string[]) => void;
  onApply: () => void;
}) {
  const { config, updateConfig, advance } = useConcierge();
  const [applying, setApplying] = useState(false);
  const [error, setError]       = useState("");

  const handleConfirm = async () => {
    setError("");
    setApplying(true);
    onMessages(["Confirm & Build"]);
    try {
      const result = await applyConfiguration(config);
      if (result.success) {
        updateConfig({});
        advance();
        onApply();
      } else {
        setError(result.error ?? "Something went wrong. Please try again.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setApplying(false);
    }
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
        {error && (
          <p className="flex items-center gap-1.5 text-xs text-red-600">
            <AlertCircle className="w-3.5 h-3.5" /> {error}
          </p>
        )}
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
  onApply: () => void;
  /** Explicit stage to render — defaults to context stage if omitted. */
  currentStage?: string;
}

export function StageWidget({ onUserMessages, onApply, currentStage }: StageWidgetsProps) {
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
      return <FinalBlueprintWidget onMessages={onUserMessages} onApply={onApply} />;
    default:
      return null;
  }
}
