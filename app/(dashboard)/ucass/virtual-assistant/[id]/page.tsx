"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApp } from "@/contexts/AppContext";
import { Loader } from "@/components/ui/Loader";
import { TextInput } from "@/components/settings/TextInput";
import {
  fetchWelcomeMenuDetail,
  updateWelcomeMenuDetail,
  fetchMenusLight,
  fetchUsersLightForMenu,
  fetchDeptsLightForMenu,
  fetchRingGroupsForMenu,
  fetchSpecialExtensionsLight,
  uploadMenuGreeting,
  type WelcomeMenuDetail,
  type MenuOption,
  type MenuOptionDestination,
  type DestinationType,
} from "@/lib/api/virtual-assistant";
import { ArrowLeft, Plus, Trash2, Upload } from "lucide-react";

const DTMF_KEYS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "#"];

const DEST_TYPES: { value: DestinationType; label: string }[] = [
  { value: "user", label: "User" },
  { value: "department", label: "Department" },
  { value: "menu", label: "Welcome Menu" },
  { value: "ringgroup", label: "Ring Group" },
  { value: "queue", label: "Call Queue" },
  { value: "special", label: "Special Extension" },
  { value: "voicemail", label: "Voicemail" },
  { value: "directory", label: "Company Directory" },
];

export default function WelcomeMenuEditPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { bootstrap } = useApp();
  const accountId = bootstrap?.account?.accountId ?? 0;
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [saveError, setSaveError] = useState<string | null>(null);
  const [greetingFile, setGreetingFile] = useState<File | null>(null);
  const [uploadingGreeting, setUploadingGreeting] = useState(false);

  // ─── Form state ────────────────────────────────────────────────────────
  const [name, setName] = useState("");
  const [settings, setSettings] = useState({
    allowExtensionDialing: true,
    playWaitMessage: false,
    allowBargingThrough: false,
  });
  const [menuOptions, setMenuOptions] = useState<MenuOption[]>([]);
  const [noSelectionDest, setNoSelectionDest] = useState<MenuOptionDestination>({ type: "menu" });

  // ─── Queries ───────────────────────────────────────────────────────────
  const { data: menu, isLoading } = useQuery({
    queryKey: ["welcome-menu-detail", accountId, id],
    queryFn: () => fetchWelcomeMenuDetail(accountId, id),
    enabled: !!accountId && !!id,
  });

  const { data: menusLight = [] } = useQuery({
    queryKey: ["menus-light", accountId],
    queryFn: () => fetchMenusLight(accountId),
    enabled: !!accountId,
  });

  const { data: usersLight = [] } = useQuery({
    queryKey: ["users-light-menu", accountId],
    queryFn: () => fetchUsersLightForMenu(accountId),
    enabled: !!accountId,
  });

  const { data: deptsLight = [] } = useQuery({
    queryKey: ["depts-light-menu", accountId],
    queryFn: () => fetchDeptsLightForMenu(accountId),
    enabled: !!accountId,
  });

  const { data: ringGroupsLight = [] } = useQuery({
    queryKey: ["ring-groups-light-menu", accountId],
    queryFn: () => fetchRingGroupsForMenu(accountId),
    enabled: !!accountId,
  });

  const { data: specialExtsLight = [] } = useQuery({
    queryKey: ["special-exts-light", accountId],
    queryFn: () => fetchSpecialExtensionsLight(accountId),
    enabled: !!accountId,
  });

  // ─── Seed form from fetched data ───────────────────────────────────────
  useEffect(() => {
    if (!menu) return;
    setName(menu.name);
    if (menu.settings) {
      setSettings({
        allowExtensionDialing: menu.settings.allowExtensionDialing ?? true,
        playWaitMessage: menu.settings.playWaitMessage ?? false,
        allowBargingThrough: menu.settings.allowBargingThrough ?? false,
      });
    }
    if (menu.menuOptions) setMenuOptions(menu.menuOptions);
    if (menu.noSelectionDestination) setNoSelectionDest(menu.noSelectionDestination);
    else setNoSelectionDest({ type: "menu", id: menu.id });
  }, [menu]);

  // ─── Save mutation ─────────────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: (payload: Partial<WelcomeMenuDetail>) =>
      updateWelcomeMenuDetail(accountId, id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["welcome-menu-detail", accountId, id] });
      queryClient.invalidateQueries({ queryKey: ["virtual-assistant", accountId] });
      setSaveError(null);
    },
    onError: (e: Error) => setSaveError(e.message ?? "Failed to save"),
  });

  const handleSave = () => {
    if (!menu) return;
    saveMutation.mutate({
      ...menu,
      name,
      settings,
      menuOptions,
      noSelectionDestination: noSelectionDest,
    });
  };

  const handleGreetingUpload = async (file: File) => {
    setUploadingGreeting(true);
    try {
      await uploadMenuGreeting(accountId, id, file);
      setGreetingFile(file);
    } catch (e) {
      setSaveError((e as Error).message ?? "Failed to upload greeting");
    } finally {
      setUploadingGreeting(false);
    }
  };

  // ─── Menu option helpers ───────────────────────────────────────────────
  const addOption = () => {
    const usedKeys = new Set(menuOptions.map((o) => o.key));
    const nextKey = DTMF_KEYS.find((k) => !usedKeys.has(k));
    if (!nextKey) return;
    setMenuOptions((prev) => [
      ...prev,
      { key: nextKey, destination: { type: "menu", id: Number(id) }, enabled: true },
    ]);
  };

  const removeOption = (idx: number) => {
    setMenuOptions((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateOption = (idx: number, updates: Partial<MenuOption>) => {
    setMenuOptions((prev) => prev.map((o, i) => (i === idx ? { ...o, ...updates } : o)));
  };

  const updateOptionDest = (idx: number, destUpdates: Partial<MenuOptionDestination>) => {
    setMenuOptions((prev) =>
      prev.map((o, i) =>
        i === idx ? { ...o, destination: { ...(o.destination ?? { type: "menu" }), ...destUpdates } } : o
      )
    );
  };

  // ─── Destination options for dropdowns ────────────────────────────────
  function getDestOptions(type: DestinationType) {
    switch (type) {
      case "user":
        return usersLight.map((u) => ({
          id: u.userId,
          label: `${u.firstName} ${u.lastName}${u.extension ? ` (${u.extension})` : ""}`,
        }));
      case "department":
        return deptsLight.map((d) => ({
          id: d.deptId,
          label: `${d.name}${d.extension ? ` (${d.extension})` : ""}`,
        }));
      case "menu":
        return menusLight.map((m) => ({
          id: m.id,
          label: `${m.name}${m.extension ? ` ${m.extension}` : ""}`,
        }));
      case "ringgroup":
        return ringGroupsLight.map((r) => ({
          id: r.id,
          label: `${r.name}${r.extension ? ` (${r.extension})` : ""}`,
        }));
      case "special":
        return specialExtsLight.map((s) => ({
          id: s.id,
          label: `${s.name}${s.extension ? ` (${s.extension})` : ""}`,
        }));
      default:
        return [];
    }
  }

  const needsId = (type: DestinationType) =>
    !["voicemail", "directory"].includes(type);

  if (isLoading) {
    return <div className="py-12 flex justify-center"><Loader variant="inline" label="Loading welcome menu..." /></div>;
  }

  if (!menu) {
    return <div className="py-12 text-center text-gray-500">Welcome menu not found.</div>;
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="p-1.5 rounded hover:bg-gray-100 text-gray-500">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-medium text-gray-900">{menu.name}</h1>
          <p className="text-sm text-gray-500 mt-0.5">Welcome Menu {menu.extension ? `· Ext ${menu.extension}` : ""}</p>
        </div>
      </div>

      {saveError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-600">{saveError}</div>
      )}

      <div className="max-w-2xl space-y-6">
        {/* ── Basic Info ── */}
        <section className="p-5 border border-gray-200 rounded-lg">
          <h2 className="text-base font-medium text-gray-900 mb-4">Basic Information</h2>
          <TextInput
            label="Name"
            value={name}
            onChange={setName}
            placeholder="e.g. Main Menu"
            required
          />
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Extension</label>
            <input
              type="text"
              value={menu.extension ?? ""}
              disabled
              className="w-full px-3 py-2 border border-[#dadce0] rounded-md text-sm bg-gray-50 text-gray-500"
            />
            <p className="text-xs text-gray-400 mt-1">Extension is auto-assigned</p>
          </div>
        </section>

        {/* ── Menu Settings ── */}
        <section className="p-5 border border-gray-200 rounded-lg">
          <h2 className="text-base font-medium text-gray-900 mb-4">Menu Options</h2>
          <div className="space-y-3">
            {(
              [
                { key: "allowExtensionDialing", label: "Allow Extension Dialing", desc: "Callers can dial an extension directly" },
                { key: "playWaitMessage", label: 'Play "Please wait while we connect your call"', desc: "Play a hold message before connecting" },
                { key: "allowBargingThrough", label: "Allow Barging Through", desc: "Allow callers to interrupt the greeting" },
              ] as const
            ).map(({ key, label, desc }) => (
              <label key={key} className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings[key]}
                  onChange={(e) => setSettings((s) => ({ ...s, [key]: e.target.checked }))}
                  className="mt-0.5 accent-[#1a73e8] w-4 h-4"
                />
                <div>
                  <p className="text-sm font-medium text-gray-700">{label}</p>
                  <p className="text-xs text-gray-500">{desc}</p>
                </div>
              </label>
            ))}
          </div>
        </section>

        {/* ── No Selection (Timeout) ── */}
        <section className="p-5 border border-gray-200 rounded-lg">
          <h2 className="text-base font-medium text-gray-900 mb-1">No Selection (Required)</h2>
          <p className="text-xs text-gray-500 mb-4">Where to forward callers who don&apos;t press any key</p>
          <DestinationPicker
            dest={noSelectionDest}
            destTypes={DEST_TYPES}
            getOptions={getDestOptions}
            needsId={needsId}
            onChange={setNoSelectionDest}
          />
        </section>

        {/* ── Key Options ── */}
        <section className="p-5 border border-gray-200 rounded-lg">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-medium text-gray-900">Key Options</h2>
            <button
              onClick={addOption}
              disabled={menuOptions.length >= DTMF_KEYS.length}
              className="flex items-center gap-1.5 text-sm text-[#1a73e8] hover:underline disabled:opacity-40"
            >
              <Plus className="w-4 h-4" /> Add Option
            </button>
          </div>

          {menuOptions.length === 0 && (
            <p className="text-sm text-gray-400 italic">No key options configured. Add one above.</p>
          )}

          <div className="space-y-3">
            {menuOptions.map((opt, idx) => (
              <div key={idx} className="flex gap-2 items-start p-3 bg-gray-50 rounded-lg border border-gray-100">
                {/* Key selector */}
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Key</label>
                  <select
                    value={opt.key}
                    onChange={(e) => updateOption(idx, { key: e.target.value })}
                    className="px-2 py-1.5 border border-[#dadce0] rounded-md text-sm w-16"
                  >
                    {DTMF_KEYS.map((k) => (
                      <option
                        key={k}
                        value={k}
                        disabled={menuOptions.some((o, i) => i !== idx && o.key === k)}
                      >
                        {k}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Destination */}
                <div className="flex-1">
                  <label className="block text-xs text-gray-500 mb-1">Forward Calls To</label>
                  <DestinationPicker
                    dest={opt.destination ?? { type: "menu" }}
                    destTypes={DEST_TYPES}
                    getOptions={getDestOptions}
                    needsId={needsId}
                    onChange={(d) => updateOptionDest(idx, d)}
                  />
                </div>

                {/* Remove */}
                <button
                  onClick={() => removeOption(idx)}
                  className="mt-5 p-1.5 text-red-400 hover:text-red-600"
                  title="Remove"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* ── Greeting ── */}
        <section className="p-5 border border-gray-200 rounded-lg">
          <h2 className="text-base font-medium text-gray-900 mb-4">Greeting</h2>
          <p className="text-sm text-gray-500 mb-4">Upload a custom greeting audio file (.mp3, .m4a, .wav — max 20 MB)</p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".mp3,.m4a,.wav"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleGreetingUpload(f);
            }}
          />
          {greetingFile ? (
            <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-md">
              <Upload className="w-4 h-4 text-green-600" />
              <span className="text-sm text-green-700">{greetingFile.name} — uploaded successfully</span>
            </div>
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingGreeting}
              className="flex flex-col items-center justify-center w-full border-2 border-dashed border-gray-300 rounded-lg p-6 hover:border-[#1a73e8] hover:bg-blue-50 transition-colors cursor-pointer disabled:opacity-50"
            >
              <Upload className="w-6 h-6 text-gray-400 mb-2" />
              <span className="text-sm text-gray-600">{uploadingGreeting ? "Uploading..." : "Drag & Drop or click to Browse File"}</span>
              <span className="text-xs text-gray-400 mt-1">Supported: .mp3, .m4a, .wav | Max size: 20 MB</span>
            </button>
          )}
        </section>

        {/* Save button */}
        <div className="flex justify-end pb-8">
          <button
            onClick={handleSave}
            disabled={saveMutation.isPending}
            className="px-6 py-2 bg-[#1a73e8] text-white rounded-md text-sm font-medium hover:bg-[#1557b0] disabled:opacity-50"
          >
            {saveMutation.isPending ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Reusable destination picker ───────────────────────────────────────────

interface DestinationPickerProps {
  dest: MenuOptionDestination;
  destTypes: { value: DestinationType; label: string }[];
  getOptions: (type: DestinationType) => { id: string | number; label: string }[];
  needsId: (type: DestinationType) => boolean;
  onChange: (d: MenuOptionDestination) => void;
}

function DestinationPicker({ dest, destTypes, getOptions, needsId, onChange }: DestinationPickerProps) {
  const options = getOptions(dest.type);

  return (
    <div className="flex gap-2 flex-wrap">
      <select
        value={dest.type}
        onChange={(e) => onChange({ type: e.target.value as DestinationType })}
        className="px-2 py-1.5 border border-[#dadce0] rounded-md text-sm"
      >
        {destTypes.map((t) => (
          <option key={t.value} value={t.value}>{t.label}</option>
        ))}
      </select>

      {needsId(dest.type) && (
        <select
          value={dest.id !== undefined ? String(dest.id) : ""}
          onChange={(e) => onChange({ ...dest, id: e.target.value })}
          className="flex-1 min-w-[160px] px-2 py-1.5 border border-[#dadce0] rounded-md text-sm"
        >
          <option value="">Select...</option>
          {options.map((o) => (
            <option key={o.id} value={String(o.id)}>{o.label}</option>
          ))}
        </select>
      )}
    </div>
  );
}
