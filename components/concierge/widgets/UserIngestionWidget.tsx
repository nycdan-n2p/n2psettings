"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Users, Upload, Plus, Trash2, Loader2, AlertCircle, CheckCircle2, XCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useConcierge, type OnboardingUser } from "@/contexts/ConciergeContext";
import { parseCSV } from "@/lib/api/concierge-backend";
import { validateUser } from "@/lib/utils/validation";
import { CardShell, ValidationErrors, FixItButton } from "./shared";

type EmailStatus = "idle" | "checking" | "available" | "taken" | "warn";

export function useEmailValidation(email: string, debounceMs = 600) {
  const [status, setStatus] = useState<EmailStatus>("idle");
  const [hint, setHint] = useState("");

  const validate = useCallback(async (addr: string) => {
    const trimmed = addr.trim().toLowerCase();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setStatus("idle");
      setHint("");
      return;
    }
    setStatus("checking");
    setHint("");
    try {
      const { getAccessToken } = await import("@/lib/auth");
      const token = getAccessToken();
      if (!token) { setStatus("idle"); return; }
      const res = await fetch(`/api/validate-user-email?email=${encodeURIComponent(trimmed)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) { setStatus("idle"); return; }
      const json = await res.json() as { available: boolean; warn?: string };
      if (json.warn) { setStatus("warn"); setHint(json.warn); }
      else if (json.available) { setStatus("available"); setHint(""); }
      else { setStatus("taken"); setHint("Email already registered in this account"); }
    } catch {
      setStatus("idle");
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => validate(email), debounceMs);
    return () => clearTimeout(t);
  }, [email, debounceMs, validate]);

  return { status, hint };
}

export function EmailBadge({ status, hint }: { status: EmailStatus; hint: string }) {
  const t = useTranslations("concierge");
  if (status === "idle") return null;
  if (status === "checking") return (
    <span className="inline-flex items-center gap-1 text-xs text-gray-400">
      <Loader2 className="w-3 h-3 animate-spin motion-reduce:animate-none" aria-hidden="true" /> {t("users.emailChecking")}
    </span>
  );
  if (status === "available") return (
    <span className="inline-flex items-center gap-1 text-xs text-[#34a853]" role="status">
      <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" /> {t("users.emailAvailable")}
    </span>
  );
  if (status === "taken") return (
    <span className="inline-flex items-center gap-1 text-xs text-red-600" role="alert">
      <XCircle className="w-3.5 h-3.5" aria-hidden="true" /> {t("users.emailTaken")}
    </span>
  );
  if (status === "warn") return (
    <span className="inline-flex items-center gap-1 text-xs text-amber-600" role="status" title={hint}>
      <AlertCircle className="w-3 h-3" aria-hidden="true" /> {t("users.emailUnverified")}
    </span>
  );
  return null;
}

// Sub-component: inline-editable user row with live email validation
export function UserRow({ user, index, onUpdate, onRemove }: {
  user: OnboardingUser;
  index: number;
  onUpdate: (i: number, field: keyof OnboardingUser, value: string) => void;
  onRemove: (i: number) => void;
}) {
  const [emailInput, setEmailInput] = useState(user.email ?? "");
  const { status, hint } = useEmailValidation(emailInput, 400);

  const inputCls = (hasValue: boolean) =>
    `w-full px-2 py-1 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-[#1a73e8] bg-white ${
      hasValue ? "border-[#dadce0] text-gray-700" : "border-amber-300 bg-amber-50 text-amber-800 placeholder:text-amber-400"
    }`;

  const t = useTranslations("concierge");
  return (
    <tr className="bg-white group">
      <td>
        <input
          value={user.firstName}
          onChange={(e) => onUpdate(index, "firstName", e.target.value)}
          placeholder={t("users.firstName")}
          aria-label={`First name for row ${index + 1}`}
          className={inputCls(!!user.firstName)}
        />
      </td>
      <td>
        <input
          value={user.lastName ?? ""}
          onChange={(e) => onUpdate(index, "lastName", e.target.value)}
          placeholder={t("users.lastName")}
          aria-label={`Last name for row ${index + 1}`}
          className={inputCls(!!user.lastName)}
        />
      </td>
      <td className="w-[14%]">
        <input
          value={user.extension ?? ""}
          onChange={(e) => onUpdate(index, "extension", e.target.value)}
          placeholder={t("users.extension")}
          aria-label={`Extension for row ${index + 1}`}
          className={inputCls(true)}
        />
      </td>
      <td>
        <div className="flex items-center gap-1.5">
          <input
            value={emailInput}
            onChange={(e) => {
              setEmailInput(e.target.value);
              onUpdate(index, "email", e.target.value);
            }}
            placeholder="email@company.com"
            aria-label={`Email for row ${index + 1}`}
            className={`${inputCls(!!emailInput)} ${
              status === "taken" ? "!border-red-400 !bg-red-50" :
              status === "available" ? "!border-[#34a853]" : ""
            }`}
          />
          <span className="shrink-0"><EmailBadge status={status} hint={hint} /></span>
        </div>
      </td>
      <td className="text-right">
        <button
          onClick={() => onRemove(index)}
          className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
          aria-label={`Remove ${user.firstName} ${user.lastName}`}
        >
          <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
      </td>
    </tr>
  );
}

export function UserIngestionWidget({ onMessages }: { onMessages: (msgs: string[]) => void }) {
  const t = useTranslations("concierge");
  const { config, updateConfig } = useConcierge();
  // "choose" → pick method; "edit" → editable table (both manual and post-CSV)
  const [mode, setMode]     = useState<"choose" | "edit">(config.users.length ? "edit" : "choose");
  const [users, setUsers]   = useState<OnboardingUser[]>(config.users.length ? config.users : []);
  const [newFirst, setNewFirst] = useState("");
  const [newLast, setNewLast]   = useState("");
  const [newExt, setNewExt]     = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [csvLoading, setCsvLoading] = useState(false);
  const [csvError, setCsvError]     = useState("");
  const [csvJustImported, setCsvJustImported] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const { status: newEmailStatus, hint: newEmailHint } = useEmailValidation(newEmail, 600);

  const updateUser = (i: number, field: keyof OnboardingUser, value: string) => {
    setUsers((prev) => prev.map((u, idx) => idx === i ? { ...u, [field]: value } : u));
  };

  const removeUser = (i: number) => setUsers((prev) => prev.filter((_, idx) => idx !== i));

  const addRow = () => {
    const v = validateUser({ firstName: newFirst, lastName: newLast, email: newEmail });
    if (!v.valid) { setValidationErrors(v.errors); return; }
    if (newEmailStatus === "taken") {
      setValidationErrors([t("users.takenError")]);
      return;
    }
    setValidationErrors([]);
    setUsers((u) => [
      ...u,
      {
        firstName: newFirst.trim(),
        lastName: newLast.trim(),
        email: newEmail.trim(),
        ...(newExt.trim() ? { extension: newExt.trim() } : {}),
      },
    ]);
    setNewFirst(""); setNewLast(""); setNewExt(""); setNewEmail("");
  };

  const handleCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvLoading(true);
    setCsvError("");
    try {
      const parsed = await parseCSV(file);
      setUsers(parsed);
      updateConfig({ users: parsed }); // Persist immediately so users survive widget unmount (e.g. when AI runs)
      setCsvJustImported(true);
      setCsvLoading(false);
      setMode("edit"); // go straight to editable table
    } catch (err) {
      setCsvError(err instanceof Error ? err.message : "Failed to parse CSV");
      setCsvLoading(false);
    }
    // reset input so same file can be re-uploaded
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleConfirm = () => {
    // If the user filled in the input row but didn't click "Add person", flush it now
    let finalUsers = users;
    if (newFirst.trim() && newEmail.trim()) {
      const v = validateUser({ firstName: newFirst, lastName: newLast, email: newEmail });
      if (!v.valid) { setValidationErrors(v.errors); return; }
      if (newEmailStatus === "taken") { setValidationErrors([t("users.takenError")]); return; }
      const pending: OnboardingUser = {
        firstName: newFirst.trim(),
        lastName: newLast.trim(),
        email: newEmail.trim(),
        ...(newExt.trim() ? { extension: newExt.trim() } : {}),
      };
      finalUsers = [...users, pending];
      setUsers(finalUsers);
      setNewFirst(""); setNewLast(""); setNewExt(""); setNewEmail("");
      setValidationErrors([]);
    }
    if (finalUsers.length === 0) return;
    setCsvJustImported(false);
    updateConfig({ users: finalUsers });
    const list = finalUsers.map((u) =>
      `${u.firstName} ${u.lastName ?? ""} <${u.email ?? ""}>${u.department ? ` [${u.department}]` : ""}`
    ).join("; ");
    onMessages([`[form] ${finalUsers.length} user${finalUsers.length !== 1 ? "s" : ""} confirmed: ${list}. Please call update_config with these users then advance_stage.`]);
  };

  const missingFields = users.filter((u) => !u.firstName || !u.email);
  const addDisabled = !newFirst.trim() || !newEmail.trim() || newEmailStatus === "checking" || newEmailStatus === "taken";
  // Confirm is enabled if: the table has users OR the input row has a valid pending entry
  const pendingValid = newFirst.trim() && newEmail.trim() && newEmailStatus !== "taken" && newEmailStatus !== "checking";
  const confirmEnabled = (users.length > 0 && missingFields.length === 0) || (users.length === 0 && !!pendingValid);

  if (mode === "choose") {
    return (
      <CardShell>
        <p className="text-sm text-gray-600 mb-3">{t("users.howToAdd")}</p>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setMode("edit")}
            className="flex flex-col items-center gap-2 p-4 border border-[#dadce0] rounded-[16px] hover:border-[#1a73e8] hover:bg-[#e8f0fe] transition-all group"
          >
            <Users className="w-6 h-6 text-gray-400 group-hover:text-[#1a73e8]" aria-hidden="true" />
            <span className="text-sm font-medium text-gray-700 group-hover:text-[#1a73e8]">{t("users.manualEntry")}</span>
          </button>
          <button
            onClick={() => fileRef.current?.click()}
            className="flex flex-col items-center gap-2 p-4 border border-[#dadce0] rounded-[16px] hover:border-[#1a73e8] hover:bg-[#e8f0fe] transition-all group"
          >
            {csvLoading
              ? <Loader2 className="w-6 h-6 animate-spin text-[#1a73e8]" aria-hidden="true" />
              : <Upload className="w-6 h-6 text-gray-400 group-hover:text-[#1a73e8]" aria-hidden="true" />}
            <span className="text-sm font-medium text-gray-700 group-hover:text-[#1a73e8]">{t("users.uploadCsv")}</span>
          </button>
        </div>
        {csvError && (
          <p className="flex items-center gap-1.5 text-xs text-red-600 mt-2" role="alert">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" /> {csvError}
          </p>
        )}
        <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleCSV} aria-label="Upload CSV file" />
        <FixItButton targetStage="cdr_analysis" />
      </CardShell>
    );
  }

  // "edit" mode — single unified editable table for both manual and CSV-imported users
  return (
    <CardShell>
      {csvJustImported && users.length > 0 && (
        <p className="flex items-center gap-1.5 text-sm text-[#1a73e8] mb-3" role="status">
          <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
          {t("users.foundFromCsv", { count: users.length })}
        </p>
      )}
      <p className="text-xs text-gray-500 mb-2">{t("users.extensionHelper")}</p>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{t("users.teamMembers")}</p>
        <button
          onClick={() => fileRef.current?.click()}
          className="flex items-center gap-1 text-xs text-[#1a73e8] hover:underline"
        >
          {csvLoading
            ? <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
            : <Upload className="w-3 h-3" aria-hidden="true" />}
          {t("users.importCsv")}
        </button>
      </div>
      <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleCSV} aria-label="Upload CSV file" />

      {users.length > 0 && (
        <>
          {missingFields.length > 0 && (
            <p className="flex items-start gap-1.5 text-xs text-amber-600 mb-2" role="alert">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden="true" />
              {t("users.missingEmailsCount", { count: missingFields.length })}
            </p>
          )}
          {users.length > 0 && users.every((u) => !(u.extension && String(u.extension).trim())) && (
            <p className="flex items-start gap-1.5 text-xs text-blue-800 bg-blue-50 border border-blue-100 rounded-lg px-2.5 py-2 mb-2" role="status">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-blue-600" aria-hidden="true" />
              {t("users.extensionsMissingBanner")}
            </p>
          )}
          <div className="mb-3 rounded-[16px] overflow-hidden border border-[#e8eaed]">
            <table className="n2p-table w-full text-xs" aria-label="Team members">
              <thead>
                <tr>
                  <th className="w-[18%]">{t("users.firstName")}</th>
                  <th className="w-[18%]">{t("users.lastName")}</th>
                  <th className="w-[12%]">{t("users.extension")}</th>
                  <th>{t("users.emailAddress")}</th>
                  <th className="w-6"><span className="sr-only">{t("common.remove")}</span></th>
                </tr>
              </thead>
              <tbody>
                {users.map((u, i) => (
                  <UserRow key={i} user={u} index={i} onUpdate={updateUser} onRemove={removeUser} />
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Add new row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-1">
        <input placeholder={t("users.firstName")} value={newFirst} onChange={(e) => setNewFirst(e.target.value)}
          aria-label="New user first name"
          className="px-2.5 py-1.5 text-sm border border-[#dadce0] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#1a73e8] bg-white" />
        <input placeholder={t("users.lastName")} value={newLast} onChange={(e) => setNewLast(e.target.value)}
          aria-label="New user last name"
          className="px-2.5 py-1.5 text-sm border border-[#dadce0] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#1a73e8] bg-white" />
        <input placeholder={t("users.extension")} value={newExt} onChange={(e) => setNewExt(e.target.value)}
          aria-label="New user extension"
          className="px-2.5 py-1.5 text-sm border border-[#dadce0] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#1a73e8] bg-white sm:col-span-1 col-span-2" />
        <input placeholder={t("users.emailAddress")} value={newEmail}
          onChange={(e) => { setNewEmail(e.target.value); setValidationErrors([]); }}
          onKeyDown={(e) => e.key === "Enter" && addRow()}
          aria-label="New user email"
          className={`px-2.5 py-1.5 text-sm border rounded-lg focus:outline-none focus:ring-1 focus:ring-[#1a73e8] bg-white ${
            newEmailStatus === "taken" ? "border-red-400" : newEmailStatus === "available" ? "border-[#34a853]" : "border-[#dadce0]"
          }`} />
      </div>
      <div className="flex items-center justify-between mb-2 min-h-[1.25rem]">
        <ValidationErrors errors={validationErrors} />
        <EmailBadge status={newEmailStatus} hint={newEmailHint} />
      </div>

      <button onClick={addRow} disabled={addDisabled}
        className="flex items-center gap-1.5 text-sm text-[#1a73e8] hover:underline disabled:opacity-40 mb-4">
        <Plus className="w-3.5 h-3.5" aria-hidden="true" /> {t("users.addPerson")}
      </button>

      <button onClick={handleConfirm} disabled={!confirmEnabled}
        className="w-full py-2 text-sm font-medium bg-[#1a73e8] text-white rounded-lg hover:bg-[#1557b0] disabled:opacity-40 transition-colors"
        title={!confirmEnabled && missingFields.length > 0 ? t("users.missingEmails") : undefined}
      >
        {t("users.confirmUsers", { count: users.length + (pendingValid ? 1 : 0) })}
      </button>
      {users.length === 0 && !pendingValid && (
        <p className="text-xs text-center text-amber-600 mt-1.5">{t("users.teamRequired")}</p>
      )}
      {missingFields.length > 0 && users.length > 0 && (
        <p className="text-xs text-center text-gray-400 mt-1.5">{t("users.missingEmails")}</p>
      )}
      <FixItButton targetStage="cdr_analysis" />
    </CardShell>
  );
}

