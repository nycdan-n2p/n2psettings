"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Phone, Search, ChevronRight, X, Radio, Pencil, Trash2, Plus } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { qk } from "@/lib/query-keys";
import { Loader } from "@/components/ui/Loader";
import {
  fetchPhoneNumbers,
  fetchPhoneNumberStats,
  fetchCallerIdOptions,
  fetchAssignmentTargets,
  updatePhoneNumber,
  searchAvailableNumbers,
  swapPhoneNumber,
  formatPhoneNumber,
  type PhoneNumber,
  type CallerIdMode,
  type AssignDest,
  type DestType,
  type AvailableNumber,
} from "@/lib/api/phone-numbers";

// ── Destination type config ─────────────────────────────────────────────────

const DEST_LABELS: Record<DestType, string> = {
  user: "Team Members",
  department: "Departments",
  ringGroup: "Ring Groups",
  welcomeMenu: "Welcome Menus",
  specialExtension: "Special Extensions",
  callQueue: "Call Queue",
};

const DEST_COLORS: Record<DestType, string> = {
  user: "bg-blue-500",
  department: "bg-purple-500",
  ringGroup: "bg-green-500",
  welcomeMenu: "bg-orange-500",
  specialExtension: "bg-gray-400",
  callQueue: "bg-red-500",
};

function initials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

// ── Assignment picker dropdown ───────────────────────────────────────────────

function AssignmentPicker({
  phoneNumber,
  accountId,
  onSave,
}: {
  phoneNumber: PhoneNumber;
  accountId: number;
  onSave: (dest: AssignDest | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [submenu, setSubmenu] = useState<DestType | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const { data: targets, isLoading } = useQuery({
    queryKey: ["phone-assign-targets", accountId],
    queryFn: () => fetchAssignmentTargets(accountId),
    staleTime: 5 * 60 * 1000,
    enabled: !!accountId,
  });

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setSubmenu(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const currentLabel = phoneNumber.routesTo ?? "Unassigned";
  const currentExt = phoneNumber.extension ? ` ${phoneNumber.extension}` : "";
  const currentType = (phoneNumber.routeType ?? null) as DestType | null;

  const select = (dest: AssignDest | null) => {
    onSave(dest);
    setOpen(false);
    setSubmenu(null);
  };

  const destTypes: DestType[] = ["user", "department", "ringGroup", "welcomeMenu", "specialExtension", "callQueue"];

  return (
    <div ref={ref} className="relative inline-block">
      {/* Trigger */}
      <button
        onClick={() => { setOpen(!open); setSubmenu(null); }}
        className="flex items-center gap-2 min-w-[180px] px-3 py-1.5 border border-[#dadce0] rounded-lg bg-white hover:bg-gray-50 text-sm transition-colors"
      >
        {currentType ? (
          <span className={`w-6 h-6 rounded-full ${DEST_COLORS[currentType]} flex items-center justify-center text-white text-[10px] font-bold shrink-0`}>
            {initials(currentLabel)}
          </span>
        ) : (
          <span className="w-6 h-6 rounded-full bg-gray-200 shrink-0" />
        )}
        <span className="flex-1 text-left text-gray-800 truncate">{currentLabel}{currentExt}</span>
        <ChevronRight className={`w-3.5 h-3.5 text-gray-400 transition-transform ${open ? "rotate-90" : ""}`} />
      </button>

      {open && (
        <div className="absolute z-50 top-full left-0 mt-1 w-64 bg-white rounded-xl border border-[#dadce0] shadow-lg overflow-hidden">
          {isLoading ? (
            <div className="px-4 py-3 text-xs text-gray-400">Loading…</div>
          ) : (
            <div className="flex">
              {/* Main menu */}
              <div className="flex-1">
                {/* Currently assigned item if any */}
                {currentType && phoneNumber.routesTo && (
                  <button
                    onClick={() => select({ id: phoneNumber.routeToId!, name: phoneNumber.routesTo!, extension: phoneNumber.extension, type: currentType })}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-gray-50 border-b border-[#f1f3f4] text-sm"
                  >
                    <span className={`w-6 h-6 rounded-full ${DEST_COLORS[currentType]} flex items-center justify-center text-white text-[10px] font-bold shrink-0`}>
                      {initials(phoneNumber.routesTo)}
                    </span>
                    <span className="flex-1 text-left text-gray-800 font-medium truncate">{phoneNumber.routesTo}</span>
                    {phoneNumber.extension && <span className="text-xs text-gray-400">{phoneNumber.extension}</span>}
                    <span className="w-4 h-4 rounded-full bg-[#1a73e8] flex items-center justify-center">
                      <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 12 12"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </span>
                  </button>
                )}

                {/* Categories */}
                {destTypes.map((dt) => {
                  const items = targets?.[dt === "user" ? "users" : dt === "department" ? "departments" : dt === "ringGroup" ? "ringGroups" : dt === "welcomeMenu" ? "welcomeMenus" : dt === "specialExtension" ? "specialExtensions" : "callQueues"] ?? [];
                  const hasItems = items.length > 0;
                  return (
                    <button
                      key={dt}
                      onMouseEnter={() => hasItems ? setSubmenu(dt) : undefined}
                      onClick={() => hasItems ? setSubmenu(dt === submenu ? null : dt) : undefined}
                      disabled={!hasItems}
                      className={`w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-gray-50 text-sm transition-colors ${!hasItems ? "opacity-40 cursor-not-allowed" : ""} ${submenu === dt ? "bg-blue-50" : ""}`}
                    >
                      <span className={`w-6 h-6 rounded-full ${DEST_COLORS[dt]} flex items-center justify-center text-white text-[10px] font-bold shrink-0`}>
                        {DEST_LABELS[dt][0]}
                      </span>
                      <span className="flex-1 text-left text-gray-800">{DEST_LABELS[dt]}</span>
                      {hasItems && <ChevronRight className="w-3.5 h-3.5 text-gray-400" />}
                    </button>
                  );
                })}

                {/* Unassigned */}
                <button
                  onClick={() => select(null)}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-gray-50 text-sm border-t border-[#f1f3f4]"
                >
                  <span className="w-6 h-6 rounded-full bg-gray-200 shrink-0" />
                  <span className="text-gray-500">Unassigned</span>
                </button>
              </div>

              {/* Submenu */}
              {submenu && (
                <div className="w-52 border-l border-[#f1f3f4] max-h-64 overflow-y-auto">
                  {(targets?.[submenu === "user" ? "users" : submenu === "department" ? "departments" : submenu === "ringGroup" ? "ringGroups" : submenu === "welcomeMenu" ? "welcomeMenus" : submenu === "specialExtension" ? "specialExtensions" : "callQueues"] ?? []).map((item) => (
                    <button
                      key={item.id}
                      onClick={() => select(item)}
                      className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-blue-50 text-sm text-left transition-colors"
                    >
                      <span className={`w-6 h-6 rounded-full ${DEST_COLORS[submenu]} flex items-center justify-center text-white text-[10px] font-bold shrink-0`}>
                        {initials(item.name)}
                      </span>
                      <span className="flex-1 text-gray-800 truncate">{item.name}</span>
                      {item.extension && <span className="text-xs text-gray-400 shrink-0">{item.extension}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Caller ID Modal ──────────────────────────────────────────────────────────

function CallerIdModal({
  phoneNumber,
  accountId,
  onClose,
}: {
  phoneNumber: PhoneNumber;
  accountId: number;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const num = phoneNumber.number ?? phoneNumber.phoneNumber ?? "";
  const formatted = formatPhoneNumber(num);

  const { data: opts, isLoading } = useQuery({
    queryKey: qk.phoneNumbers.callerId(accountId, num),
    queryFn: () => fetchCallerIdOptions(accountId, num),
    enabled: !!num,
  });

  const [nameMode, setNameMode] = useState<CallerIdMode>(opts?.callerIdName?.mode ?? "none");
  const [nameValue, setNameValue] = useState(opts?.callerIdName?.value ?? "");
  const [numMode, setNumMode] = useState<CallerIdMode>(opts?.callerIdNumber?.mode ?? "none");
  const [numValue, setNumValue] = useState(opts?.callerIdNumber?.value ?? "");

  // Sync state when opts load
  useEffect(() => {
    if (opts) {
      setNameMode(opts.callerIdName.mode);
      setNameValue(opts.callerIdName.value);
      setNumMode(opts.callerIdNumber.mode);
      setNumValue(opts.callerIdNumber.value);
    }
  }, [opts]);

  const mutation = useMutation({
    mutationFn: () =>
      updatePhoneNumber(accountId, num, {
        ...phoneNumber,
        callerIdName: { mode: nameMode, value: nameMode === "none" ? "" : nameValue },
        callerIdNumber: { mode: numMode, value: numMode === "none" ? "" : numValue },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.phoneNumbers.all(accountId) });
      queryClient.invalidateQueries({ queryKey: qk.phoneNumbers.callerId(accountId, num) });
      onClose();
    },
  });

  // Preview computation
  const EXAMPLE_NAME = "STARK, TONY";
  const EXAMPLE_NUM = "201-555-1212";
  const previewName = (() => {
    if (nameMode === "none") return EXAMPLE_NAME;
    if (nameMode === "prefix") return `${nameValue} ${EXAMPLE_NAME}`;
    if (nameMode === "suffix") return `${EXAMPLE_NAME} ${nameValue}`;
    if (nameMode === "replace") return nameValue || EXAMPLE_NAME;
    return EXAMPLE_NAME;
  })();
  const previewNum = (() => {
    if (numMode === "none") return EXAMPLE_NUM;
    if (numMode === "prefix") return `${numValue}${EXAMPLE_NUM}`;
    if (numMode === "suffix") return `${EXAMPLE_NUM}${numValue}`;
    if (numMode === "replace") return numValue || EXAMPLE_NUM;
    return EXAMPLE_NUM;
  })();

  const MODES: { value: CallerIdMode; label: string; desc: string }[] = [
    { value: "prefix", label: "Prefix", desc: "Adds something before the caller ID" },
    { value: "suffix", label: "Suffix", desc: "Adds something after the caller ID" },
    { value: "replace", label: "Replace", desc: "Replaces the caller ID with something" },
    { value: "none", label: "None", desc: "Do not modify the incoming caller ID" },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start gap-4 px-6 pt-6 pb-4 border-b border-[#e8eaed]">
          <div className="w-14 h-14 rounded-full bg-[#e3f2fd] flex items-center justify-center shrink-0">
            <Phone className="w-7 h-7 text-[#1565c0]" fill="currentColor" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-semibold text-[#202124]">Caller ID For Calls To {formatted}</h2>
            <p className="text-sm text-gray-500 mt-1">
              Customizing the caller ID details for incoming calls to {formatted} can help you distinguish between calls based on their origin.
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12"><Loader variant="inline" label="Loading caller ID settings…" /></div>
        ) : (
          <div className="px-6 py-5 space-y-6">
            {/* Incoming caller ID name */}
            <CallerIdSection
              title="Incoming caller ID name"
              modes={MODES.map((m) => ({ ...m, desc: m.desc.replace("caller ID", "caller ID name") }))}
              selectedMode={nameMode}
              value={nameValue}
              onChange={(mode, val) => { setNameMode(mode); setNameValue(val); }}
              placeholder="e.g. Sales Department"
              hint="Alphanumeric (A-Z, 0-9) and spaces. No special characters"
              inputType="text"
            />

            {/* Incoming caller ID number */}
            <CallerIdSection
              title="Incoming caller ID"
              modes={MODES}
              selectedMode={numMode}
              value={numValue}
              onChange={(mode, val) => { setNumMode(mode); setNumValue(val); }}
              placeholder="e.g 15"
              hint="Numeric only (0-9) and spaces. No special characters"
              inputType="tel"
            />

            {/* Preview */}
            <div>
              <h3 className="text-lg font-semibold text-[#202124] mb-3">Preview</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-semibold text-[#202124] mb-1">Original</p>
                  <p className="text-sm text-[#3c4043]">{EXAMPLE_NUM}</p>
                  <p className="text-sm text-[#3c4043]">{EXAMPLE_NAME}</p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#202124] mb-1">Transformed to</p>
                  <p className="text-sm text-[#3c4043]">{previewNum}</p>
                  <p className="text-sm text-[#3c4043]">{previewName}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 border-t border-[#e8eaed] justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 border border-[#dadce0] rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="px-5 py-2 text-sm font-medium bg-[#1a73e8] text-white rounded-lg hover:bg-[#1557b0] disabled:opacity-50 transition-colors"
          >
            {mutation.isPending ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

function CallerIdSection({
  title,
  modes,
  selectedMode,
  value,
  onChange,
  placeholder,
  hint,
  inputType,
}: {
  title: string;
  modes: { value: CallerIdMode; label: string; desc: string }[];
  selectedMode: CallerIdMode;
  value: string;
  onChange: (mode: CallerIdMode, value: string) => void;
  placeholder: string;
  hint: string;
  inputType: string;
}) {
  return (
    <div>
      <h3 className="text-lg font-semibold text-[#202124] mb-3">{title}</h3>
      <div className="space-y-2.5">
        {modes.map((m) => (
          <label key={m.value} className="flex items-center gap-3 cursor-pointer group">
            <div
              onClick={() => onChange(m.value, value)}
              className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                selectedMode === m.value ? "border-[#1a73e8]" : "border-[#9aa0a6] group-hover:border-[#5f6368]"
              }`}
            >
              {selectedMode === m.value && <div className="w-2.5 h-2.5 rounded-full bg-[#1a73e8]" />}
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-medium text-[#202124]">{m.label}</span>
              <span className="text-sm text-gray-500">{m.desc}</span>
            </div>
          </label>
        ))}
      </div>

      {selectedMode !== "none" && (
        <div className="mt-3 space-y-1.5">
          <label className="block text-sm text-gray-500">
            {title.replace("Incoming ", "")} modification
          </label>
          <input
            type={inputType}
            value={value}
            onChange={(e) => onChange(selectedMode, e.target.value)}
            placeholder={placeholder}
            className="w-full px-3 py-2.5 text-sm border border-[#dadce0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1a73e8] bg-white"
          />
          <p className="text-xs text-gray-400">{hint}</p>
        </div>
      )}
    </div>
  );
}

// ── Edit Number Modal ────────────────────────────────────────────────────────

function EditNumberModal({
  phoneNumber,
  accountId,
  onClose,
}: {
  phoneNumber: PhoneNumber;
  accountId: number;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const num = phoneNumber.number ?? phoneNumber.phoneNumber ?? "";
  const formatted = formatPhoneNumber(num);

  const [areaCode, setAreaCode] = useState("");
  const [numberType, setNumberType] = useState<"local" | "tollFree">("local");
  const [searched, setSearched] = useState(false);
  const [selected, setSelected] = useState<AvailableNumber | null>(null);
  const [results, setResults] = useState<AvailableNumber[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");

  const swapMutation = useMutation({
    mutationFn: () => swapPhoneNumber(accountId, num, selected!.number),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.phoneNumbers.all(accountId) });
      onClose();
    },
  });

  const handleSearch = async () => {
    if (!areaCode.trim()) return;
    setSearching(true);
    setSearchError("");
    setSelected(null);
    setSearched(false);
    try {
      const data = await searchAvailableNumbers(accountId, areaCode.trim(), numberType);
      setResults(data);
      setSearched(true);
      if (data.length === 0) setSearchError("No numbers found for this area code. Try another.");
    } catch {
      setSearchError("Failed to search numbers. Please try again.");
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-4 px-6 pt-6 pb-5">
          <div className="w-14 h-14 rounded-full bg-[#e3f2fd] flex items-center justify-center shrink-0">
            <Phone className="w-7 h-7 text-[#1565c0]" fill="currentColor" />
          </div>
          <h2 className="flex-1 text-xl font-bold text-[#202124]">Edit {formatted}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 pb-6 space-y-5">
          {/* Change to label */}
          <div>
            <p className="text-sm text-gray-500 mb-2">Change to</p>

            {/* Number type toggle */}
            <div className="flex rounded-full border border-[#dadce0] p-0.5 mb-3 w-fit">
              {(["local", "tollFree"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => { setNumberType(t); setSearched(false); setResults([]); setSelected(null); }}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    numberType === t
                      ? "bg-[#1a73e8] text-white shadow-sm"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  {t === "local" ? "Local" : "Toll Free"}
                </button>
              ))}
            </div>

            {/* Area code search */}
            <div className="flex gap-2">
              <input
                type="text"
                value={areaCode}
                onChange={(e) => setAreaCode(e.target.value.replace(/\D/g, "").slice(0, 3))}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder="By area code: eg. 516, 718.."
                className="flex-1 px-3 py-2.5 text-sm border-b border-[#dadce0] focus:outline-none focus:border-[#1a73e8] bg-transparent placeholder-gray-400 transition-colors"
                maxLength={3}
              />
              <button
                onClick={handleSearch}
                disabled={!areaCode.trim() || searching}
                className="px-3 py-2 text-[#1a73e8] hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-40"
              >
                {searching ? (
                  <div className="w-4 h-4 border-2 border-[#1a73e8] border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {/* Search error */}
          {searchError && (
            <p className="text-sm text-red-500">{searchError}</p>
          )}

          {/* Results list */}
          {searched && results.length > 0 && (
            <div className="border border-[#dadce0] rounded-xl overflow-hidden max-h-48 overflow-y-auto">
              {results.map((r) => (
                <button
                  key={r.number}
                  onClick={() => setSelected(selected?.number === r.number ? null : r)}
                  className={`w-full flex items-center justify-between px-4 py-3 text-sm hover:bg-gray-50 border-b border-[#f1f3f4] last:border-0 transition-colors ${
                    selected?.number === r.number ? "bg-blue-50" : ""
                  }`}
                >
                  <span className="font-medium text-[#202124]">{formatPhoneNumber(r.number.replace(/^\+1/, ""))}</span>
                  <div className="flex items-center gap-2">
                    {r.rateCenter && <span className="text-xs text-gray-400">{r.rateCenter}</span>}
                    {selected?.number === r.number && (
                      <span className="w-5 h-5 rounded-full bg-[#1a73e8] flex items-center justify-center">
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 12 12"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}

          {swapMutation.isError && (
            <p className="text-sm text-red-500">Failed to change number. Please try again.</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 pb-6 justify-start">
          <button
            onClick={() => swapMutation.mutate()}
            disabled={!selected || swapMutation.isPending}
            className={`px-6 py-2.5 text-sm font-bold rounded-full transition-colors ${
              selected && !swapMutation.isPending
                ? "bg-[#1a73e8] text-white hover:bg-[#1557b0]"
                : "bg-gray-200 text-gray-400 cursor-not-allowed"
            }`}
          >
            {swapMutation.isPending ? "CHANGING…" : "CHANGE"}
          </button>
          <button
            onClick={onClose}
            className="px-6 py-2.5 text-sm font-bold text-gray-600 hover:text-gray-900 transition-colors"
          >
            CANCEL
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function PhoneNumbersPage() {
  const { bootstrap } = useApp();
  const accountId = bootstrap?.account?.accountId ?? 0;
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [callerIdTarget, setCallerIdTarget] = useState<PhoneNumber | null>(null);
  const [editTarget, setEditTarget] = useState<PhoneNumber | null>(null);

  const { data: numbers = [], isLoading } = useQuery({
    queryKey: qk.phoneNumbers.all(accountId),
    queryFn: () => fetchPhoneNumbers(accountId),
    enabled: !!accountId,
    staleTime: 2 * 60 * 1000,
  });

  const { data: stats } = useQuery({
    queryKey: qk.phoneNumbers.stats(accountId),
    queryFn: () => fetchPhoneNumberStats(accountId),
    enabled: !!accountId,
  });

  const assignMutation = useMutation({
    mutationFn: ({ number, dest }: { number: PhoneNumber; dest: AssignDest | null }) => {
      const payload: Partial<PhoneNumber> = {
        ...number,
        routeToId: dest?.id ? Number(dest.id) : null,
        routesTo: dest?.name ?? null,
        routeType: dest ? (dest.type === "user" ? "user" : dest.type === "department" ? "department" : dest.type === "ringGroup" ? "ringGroup" : dest.type === "welcomeMenu" ? "welcomeMenu" : dest.type === "specialExtension" ? "specialExtension" : "callQueue") : null,
        extension: dest?.extension ?? number.extension,
      };
      return updatePhoneNumber(accountId, number.number, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.phoneNumbers.all(accountId) });
    },
  });

  const handleAssign = useCallback((number: PhoneNumber, dest: AssignDest | null) => {
    assignMutation.mutate({ number, dest });
  }, [assignMutation]);

  const filtered = numbers.filter((n) => {
    const q = search.toLowerCase();
    return (
      !q ||
      (n.number ?? "").includes(q) ||
      formatPhoneNumber(n.number ?? "").includes(q) ||
      (n.routesTo ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#202124] uppercase tracking-wide">Phone Numbers</h1>
          {stats && (
            <p className="text-sm text-gray-500 mt-1">
              {stats.phoneNumbersInUse} of {stats.maxPhoneNumbers} numbers in use
            </p>
          )}
        </div>
        <button className="relative flex items-center gap-2 px-5 py-2.5 bg-[#1a73e8] text-white text-sm font-semibold rounded-full hover:bg-[#1557b0] transition-colors shadow-sm">
          <Plus className="w-4 h-4" />
          ADD PHONE NUMBER
          {stats && stats.unUsedPhones > 0 && (
            <span className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
              {stats.unUsedPhones}
            </span>
          )}
        </button>
      </div>

      {/* Search + table card */}
      <div className="bg-white rounded-xl border border-[#e8eaed] shadow-sm overflow-hidden">
        {/* Search bar */}
        <div className="px-5 py-4 border-b border-[#e8eaed]">
          <div className="relative max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search"
              className="w-full pl-9 pr-3 py-2 text-sm border border-[#dadce0] rounded-full bg-[#f1f3f4] focus:outline-none focus:ring-2 focus:ring-[#1a73e8] focus:bg-white transition-colors"
            />
          </div>
        </div>

        {/* Column headers */}
        <div className="grid grid-cols-[1fr_260px_auto_auto] items-center px-5 py-2.5 bg-gray-50 border-b border-[#e8eaed]">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Number</p>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Assignment</p>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider px-4">Caller ID</p>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Actions</p>
        </div>

        {/* Rows */}
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader variant="inline" label="Loading phone numbers…" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-5 py-12 text-center text-gray-500 text-sm">
            {search ? "No numbers match your search." : "No phone numbers found."}
          </div>
        ) : (
          <div className="divide-y divide-[#f1f3f4]">
              {filtered.map((num) => (
                <PhoneNumberRow
                  key={num.number}
                  phoneNumber={num}
                  accountId={accountId}
                  onAssign={(dest) => handleAssign(num, dest)}
                  onCallerIdClick={() => setCallerIdTarget(num)}
                  onEditClick={() => setEditTarget(num)}
                />
            ))}
          </div>
        )}
      </div>

      {/* Caller ID modal */}
      {callerIdTarget && (
        <CallerIdModal
          phoneNumber={callerIdTarget}
          accountId={accountId}
          onClose={() => setCallerIdTarget(null)}
        />
      )}

      {/* Edit number modal */}
      {editTarget && (
        <EditNumberModal
          phoneNumber={editTarget}
          accountId={accountId}
          onClose={() => setEditTarget(null)}
        />
      )}
    </div>
  );
}

function PhoneNumberRow({
  phoneNumber,
  accountId,
  onAssign,
  onCallerIdClick,
  onEditClick,
}: {
  phoneNumber: PhoneNumber;
  accountId: number;
  onAssign: (dest: AssignDest | null) => void;
  onCallerIdClick: () => void;
  onEditClick: () => void;
}) {
  const num = phoneNumber.number ?? phoneNumber.phoneNumber ?? "";
  const formatted = formatPhoneNumber(num);

  return (
    <div className="grid grid-cols-[1fr_260px_auto_auto] items-center px-5 py-3.5 hover:bg-gray-50/80 transition-colors group">
      {/* Number */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-[#e3f2fd] flex items-center justify-center shrink-0">
          <Phone className="w-4 h-4 text-[#1565c0]" fill="currentColor" />
        </div>
        <span className="text-sm font-medium text-[#202124]">{formatted}</span>
      </div>

      {/* Assignment dropdown */}
      <div>
        <AssignmentPicker
          phoneNumber={phoneNumber}
          accountId={accountId}
          onSave={onAssign}
        />
      </div>

      {/* Set incoming caller ID */}
      <div className="px-4">
        <button
          onClick={onCallerIdClick}
          className="flex items-center gap-1.5 text-sm text-[#1a73e8] hover:underline font-medium whitespace-nowrap"
        >
          Set incoming caller ID
        </button>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={onCallerIdClick}
          className="w-8 h-8 rounded-full border border-[#dadce0] flex items-center justify-center text-gray-400 hover:text-[#1a73e8] hover:border-[#1a73e8] transition-colors"
          title="Caller ID settings"
        >
          <Radio className="w-4 h-4" />
        </button>
        <button
          onClick={onEditClick}
          className="w-8 h-8 rounded-full border border-[#dadce0] flex items-center justify-center text-gray-400 hover:text-[#1a73e8] hover:border-[#1a73e8] transition-colors"
          title="Edit"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button
          className="w-8 h-8 rounded-full border border-[#dadce0] flex items-center justify-center text-gray-400 hover:text-red-500 hover:border-red-400 transition-colors"
          title="Delete"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
