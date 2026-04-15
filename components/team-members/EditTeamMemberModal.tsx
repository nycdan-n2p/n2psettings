"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useRef, useEffect } from "react";
import {
  User,
  Building2,
  FileBarChart,
  PhoneForwarded,
  Phone,
  Smartphone,
  Mail,
  Music2,
  X,
  Loader2,
  ChevronDown,
} from "lucide-react";
import { Modal } from "@/components/settings/Modal";
import { TextInput } from "@/components/settings/TextInput";
import { Toggle } from "@/components/settings/Toggle";
import { SettingsRow } from "@/components/settings/SettingsGroup";
import { Loader } from "@/components/ui/Loader";
import { useApp } from "@/contexts/AppContext";
import { qk } from "@/lib/query-keys";
import {
  fetchUser,
  updateUser,
  type TeamMember,
  type UserDetail,
  type UpdateUserPayload,
} from "@/lib/api/team-members";
import { fetchDepartments } from "@/lib/api/departments";
import { fetchDevices } from "@/lib/api/devices";

const TABS = [
  { id: "profile", label: "Profile", icon: User },
  { id: "company", label: "Company", icon: Building2 },
  { id: "licenses", label: "Licenses", icon: FileBarChart },
  { id: "call-forwarding", label: "Call Forwarding", icon: PhoneForwarded },
  { id: "call-options", label: "Call Options", icon: Phone },
  { id: "devices", label: "Devices", icon: Smartphone },
  { id: "voicemail", label: "Voicemail", icon: Mail },
  { id: "hold-music", label: "Hold Music", icon: Music2 },
] as const;

type TabId = (typeof TABS)[number]["id"];

interface EditTeamMemberModalProps {
  user: TeamMember | null;
  isOpen: boolean;
  onClose: () => void;
}

export function EditTeamMemberModal({
  user,
  isOpen,
  onClose,
}: EditTeamMemberModalProps) {
  const { bootstrap } = useApp();
  const accountId = bootstrap?.account?.accountId ?? 0;
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabId>("profile");
  const [form, setForm] = useState<Partial<UpdateUserPayload>>({});

  const { data: userDetail, isLoading } = useQuery({
    queryKey: ["user", accountId, user?.userId],
    queryFn: () => fetchUser(accountId, user!.userId),
    enabled: !!accountId && !!user?.userId && isOpen,
  });

  const { data: departments = [] } = useQuery({
    queryKey: qk.departments.list(accountId),
    queryFn: () => fetchDepartments(accountId),
    enabled: !!accountId && isOpen,
  });

  const { data: devices = [] } = useQuery({
    queryKey: ["devices", accountId],
    queryFn: () => fetchDevices(accountId),
    enabled: !!accountId && isOpen && activeTab === "devices",
  });

  const updateMutation = useMutation({
    mutationFn: (payload: UpdateUserPayload) =>
      updateUser(accountId, user!.userId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.teamMembers.all(accountId) });
      queryClient.invalidateQueries({
        queryKey: ["user", accountId, user?.userId],
      });
    },
  });

  const applyForm = (updates: Partial<UpdateUserPayload>) => {
    setForm((f) => ({ ...f, ...updates }));
  };

  const saveCurrentTab = () => {
    if (!form || Object.keys(form).length === 0) return;
    updateMutation.mutate(form);
    setForm({});
  };

  const userDevices = devices.filter(
    (d) => d.assignedUser?.userId === user?.userId || d.userId === user?.userId
  );
  const accountLicenses = bootstrap?.licenses ?? [];

  if (!user) return null;

  const displayName = `${user.firstName} ${user.lastName}`.trim() || "Team Member";
  const avatarUrl = (userDetail as UserDetail)?.avatars?.find(
    (a) => a.size === "120" || a.size === "200"
  )?.url;

  const headerContent = (
    <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-[#dadce0] bg-white min-w-0">
      <div className="flex items-center gap-3 min-w-0 flex-1 overflow-hidden">
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-white border border-[#e5e7eb] flex items-center justify-center overflow-hidden">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- external avatar URL
            <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="text-sm font-medium text-gray-600">
              {displayName.charAt(0) || "?"}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1 overflow-hidden">
          <h2 className="text-base font-medium text-gray-900 truncate">
            Edit {displayName}
          </h2>
          <p className="text-sm text-gray-500 truncate block">{user.email}</p>
        </div>
      </div>
      <button
        onClick={onClose}
        className="p-2 rounded-full hover:bg-white text-gray-500 transition-colors shrink-0"
        aria-label="Close"
      >
        <X className="w-5 h-5" />
      </button>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title=""
      size="2xl"
      headerContent={headerContent}
    >
      <div className="flex flex-col min-h-[320px]">
        {/* Tabs - scrollable when needed, visible scrollbar */}
        <div
          className="flex overflow-x-auto overflow-y-hidden border-b border-[#dadce0] bg-white -mx-6 px-6 min-w-0"
          style={{ backgroundColor: "#ffffff" }}
        >
          <div className="flex min-w-max">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                style={{ backgroundColor: "#ffffff" }}
                className={`
                  flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap
                  border-b-2 -mb-px transition-colors shrink-0
                  ${
                    activeTab === id
                      ? "border-[#1a73e8] text-[#1a73e8] bg-white"
                      : "border-transparent text-gray-600 hover:text-gray-900 hover:bg-white"
                  }
                `}
              >
                <Icon className="w-4 h-4 flex-shrink-0 opacity-70" />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab content */}
        <div className="py-6 min-h-[280px] bg-white overflow-hidden">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader variant="inline" label="Loading..." />
            </div>
          ) : (
            <>
              {activeTab === "profile" && (
                <ProfileTab
                  user={userDetail ?? user}
                  form={form}
                  onUpdate={applyForm}
                  onSave={saveCurrentTab}
                  isSaving={updateMutation.isPending}
                />
              )}
              {activeTab === "company" && (
                <CompanyTab
                  user={userDetail ?? user}
                  departments={departments}
                  form={form}
                  onUpdate={applyForm}
                  onSave={saveCurrentTab}
                  isSaving={updateMutation.isPending}
                />
              )}
              {activeTab === "licenses" && (
                <LicensesTab licenses={accountLicenses} />
              )}
              {activeTab === "call-forwarding" && <CallForwardingTab />}
              {activeTab === "call-options" && (
                <CallOptionsTab
                  user={userDetail ?? user}
                  form={form}
                  onUpdate={applyForm}
                  onSave={saveCurrentTab}
                  isSaving={updateMutation.isPending}
                />
              )}
              {activeTab === "devices" && (
                <DevicesTab
                  user={userDetail ?? user}
                  devices={userDevices}
                />
              )}
              {activeTab === "voicemail" && (
                <VoicemailTab
                  user={userDetail ?? user}
                  form={form}
                  onUpdate={applyForm}
                  onSave={saveCurrentTab}
                  isSaving={updateMutation.isPending}
                />
              )}
              {activeTab === "hold-music" && (
                <HoldMusicTab
                  user={userDetail ?? user}
                  form={form}
                  onUpdate={applyForm}
                  onSave={saveCurrentTab}
                  isSaving={updateMutation.isPending}
                />
              )}
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}

// ─── Tab components ─────────────────────────────────────────────────────────

function ProfileTab({
  user,
  form,
  onUpdate,
  onSave,
  isSaving,
}: {
  user: UserDetail | TeamMember;
  form: Partial<UpdateUserPayload>;
  onUpdate: (u: Partial<UpdateUserPayload>) => void;
  onSave: () => void;
  isSaving: boolean;
}) {
  const hasChanges =
    form.firstName !== undefined ||
    form.lastName !== undefined ||
    form.email !== undefined;

  return (
    <div className="border border-[#dadce0] rounded-lg bg-white overflow-hidden">
      <div className="px-6 py-4 space-y-6">
        <div className="border border-dashed border-[#dadce0] rounded-lg p-6 bg-white">
          <p className="text-sm text-gray-600">Drag and drop your avatar here, or browse to upload.</p>
          <p className="text-xs text-gray-500 mt-1">Supported: .png, .jpg, .jpeg · Max size: 4 MB</p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <TextInput
            label="First Name"
            value={form.firstName ?? user.firstName ?? ""}
            onChange={(v) => onUpdate({ firstName: v })}
            placeholder="First name"
          />
          <TextInput
            label="Last Name"
            value={form.lastName ?? user.lastName ?? ""}
            onChange={(v) => onUpdate({ lastName: v })}
            placeholder="Last name"
          />
        </div>
        <TextInput
          label="Email"
          value={form.email ?? user.email ?? ""}
          onChange={(v) => onUpdate({ email: v })}
          type="email"
          placeholder="user@example.com"
        />
        {hasChanges && (
          <button
            onClick={onSave}
            disabled={isSaving}
            className="px-4 py-2 bg-[#1a73e8] text-white text-sm font-medium rounded-lg hover:bg-[#1557b0] disabled:opacity-50 flex items-center gap-2"
          >
            {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
            Save changes
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Department dropdown (schedules-style) ────────────────────────────────────
function DepartmentSelect({
  departments,
  selectedIds,
  onSelect,
}: {
  departments: Array<{ deptId: number; name: string }>;
  selectedIds: Set<number>;
  onSelect: (ids: number[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; flip: boolean } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const count = selectedIds.size;

  const handleToggle = () => {
    if (!open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const flip = window.innerHeight - rect.bottom < 340 && rect.top > 340;
      setPos({ top: flip ? rect.top - 8 : rect.bottom + 8, left: rect.left, flip });
    }
    setOpen((o) => !o);
  };

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (
        buttonRef.current && !buttonRef.current.contains(e.target as Node) &&
        panelRef.current && !panelRef.current.contains(e.target as Node)
      ) setOpen(false);
    };
    const closeOnScroll = () => setOpen(false);
    document.addEventListener("mousedown", close);
    window.addEventListener("scroll", closeOnScroll, true);
    return () => {
      document.removeEventListener("mousedown", close);
      window.removeEventListener("scroll", closeOnScroll, true);
    };
  }, [open]);

  const toggle = (deptId: number) => {
    const next = new Set(selectedIds);
    if (next.has(deptId)) next.delete(deptId);
    else next.add(deptId);
    onSelect(Array.from(next));
  };

  return (
    <div className="inline-block w-full max-w-full">
      <button
        ref={buttonRef}
        type="button"
        onClick={handleToggle}
        className="flex items-center gap-2 px-3 py-2 text-sm border border-[#dadce0] rounded-lg bg-white hover:bg-[#f8f9fa] text-left w-full min-w-0 max-w-full"
      >
        <span className="flex-1 truncate text-gray-700 min-w-0">
          {count === 0
            ? "No departments"
            : `${count} department${count !== 1 ? "s" : ""} selected`}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-gray-500 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && pos && (
        <div
          ref={panelRef}
          style={{
            position: "fixed",
            top: pos.flip ? undefined : pos.top,
            bottom: pos.flip ? window.innerHeight - pos.top : undefined,
            left: pos.left,
            zIndex: 9999,
          }}
          className="w-72 max-h-64 bg-white rounded-lg shadow-lg border border-[#dadce0] overflow-hidden"
        >
          <div className="px-3 py-2 border-b border-[#f1f3f4] bg-[#f8f9fa]">
            <span className="text-xs font-medium text-gray-600">
              Select departments
            </span>
          </div>
          <div className="max-h-48 overflow-y-auto py-1">
            {departments.map((d) => (
              <label
                key={d.deptId}
                className="flex items-center gap-2 px-3 py-2 hover:bg-[#f8f9fa] cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selectedIds.has(d.deptId)}
                  onChange={() => toggle(d.deptId)}
                  className="rounded border-[#dadce0] text-[#1a73e8] focus:ring-[#1a73e8]"
                />
                <span className="text-sm text-gray-700 truncate">{d.name}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CompanyTab({
  user,
  departments,
  form,
  onUpdate,
  onSave,
  isSaving,
}: {
  user: UserDetail | TeamMember;
  departments: Array<{ deptId: number; name: string }>;
  form: Partial<UpdateUserPayload>;
  onUpdate: (u: Partial<UpdateUserPayload>) => void;
  onSave: () => void;
  isSaving: boolean;
}) {
  const ud = user as UserDetail;
  const memberIds = ud.members?.map((m) => m.id) ?? [];
  const selectedIds = new Set(
    form.members?.map((m) => m.id) ?? memberIds
  );

  const roleId = form.roleId ?? (user as { roleId?: number }).roleId;
  const isAdmin =
    user.role?.toLowerCase() === "admin" || roleId === 2;
  const compDirEnabled = form.compDir?.enabled ?? ud.compDir?.enabled ?? false;

  const phoneDisplay = `${ud.lineNumber?.[0] ?? "—"} · Ext ${(user as { extension?: string }).extension ?? "—"}`;
  return (
    <div className="border border-[#dadce0] rounded-lg bg-white divide-y divide-[#f1f3f4] overflow-hidden">
      <div className="px-6 py-4">
        <p className="text-xs font-medium text-gray-500 mb-1">Phone Number</p>
        <p className="text-sm text-gray-900 break-all min-w-0">
          {phoneDisplay}
        </p>
      </div>
      <div className="px-6 py-4">
        <p className="text-xs font-medium text-gray-500 mb-2">Departments</p>
        <DepartmentSelect
          departments={departments}
          selectedIds={selectedIds}
          onSelect={(ids) => onUpdate({ members: ids.map((id) => ({ id })) })}
        />
      </div>
      <div className="px-6 py-4">
        <p className="text-xs font-medium text-gray-500 mb-2">Role</p>
        <div className="flex gap-0.5 p-0.5 bg-white border border-[#e5e7eb] rounded-lg w-fit">
          {(["User", "Admin"] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => onUpdate({ roleId: r === "Admin" ? 2 : 1 })}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                (r === "Admin" && isAdmin) || (r === "User" && !isAdmin)
                  ? "bg-white text-[#1a73e8]"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>
      <SettingsRow
        label="Company Directory"
        description="When on, callers can reach you by name in the directory."
        controlLeading
      >
        <Toggle
          checked={compDirEnabled}
          onChange={(v) => onUpdate({ compDir: { enabled: v } })}
        />
      </SettingsRow>
      <div className="px-6 py-4">
        <button
          onClick={onSave}
          disabled={isSaving || Object.keys(form).length === 0}
          className="px-4 py-2 bg-[#1a73e8] text-white text-sm font-medium rounded-lg hover:bg-[#1557b0] disabled:opacity-50"
        >
          {isSaving ? "Saving..." : "Save changes"}
        </button>
      </div>
    </div>
  );
}

function LicensesTab({
  licenses,
}: {
  licenses: Array<{ code?: string; name?: string }>;
}) {
  return (
    <div className="border border-[#dadce0] rounded-lg bg-white overflow-hidden">
      <div className="px-6 py-4 border-b border-[#f1f3f4]">
        <p className="text-sm text-gray-600">Licenses granted by your company admins.</p>
      </div>
      <div className="divide-y divide-[#f1f3f4]">
        {licenses.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-500">No licenses to display</p>
        ) : (
          licenses.map((l) => (
            <div key={l.code ?? l.name ?? ""} className="flex items-center gap-3 px-6 py-4">
              <FileBarChart className="w-5 h-5 text-gray-400 shrink-0" />
              <span className="text-sm text-gray-900 min-w-0 truncate">{l.name ?? l.code ?? "License"}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function CallForwardingTab() {
  return (
    <div className="border border-[#dadce0] rounded-lg bg-white overflow-hidden">
      <div className="px-6 py-4">
        <p className="text-sm text-gray-600 mb-4">
          Enable call forwarding and choose when and where to forward calls.
        </p>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm text-amber-800">
            Call forwarding configuration is managed at the account level. Contact
            your admin or use the main settings to configure forwarding rules.
          </p>
        </div>
      </div>
    </div>
  );
}

function CallOptionsTab({
  user,
  form,
  onUpdate,
  onSave,
  isSaving,
}: {
  user: UserDetail | TeamMember;
  form: Partial<UpdateUserPayload>;
  onUpdate: (u: Partial<UpdateUserPayload>) => void;
  onSave: () => void;
  isSaving: boolean;
}) {
  const ud = user as UserDetail;
  const ringGroupEnabled =
    form.isRingGroupCallsEnabled ?? ud.isRingGroupCallsEnabled ?? false;

  return (
    <div className="border border-[#dadce0] rounded-lg bg-white divide-y divide-[#f1f3f4] overflow-hidden">
      <div className="px-6 py-4">
        <p className="text-xs font-medium text-gray-500 mb-1">Ring Group Status</p>
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={`w-2 h-2 rounded-full shrink-0 ${
              ringGroupEnabled ? "bg-green-500" : "bg-gray-300"
            }`}
          />
          <span className="text-sm text-gray-700">
            {ringGroupEnabled
              ? "Signed in to all ring groups"
              : "Not signed in to ring groups"}
          </span>
        </div>
      </div>
      <SettingsRow
        label="Ring group calls"
        description="Allow this user to receive ring group calls."
        controlLeading
      >
        <Toggle
          checked={ringGroupEnabled}
          onChange={(v) => onUpdate({ isRingGroupCallsEnabled: v })}
        />
      </SettingsRow>
      <div className="px-6 py-4">
        <button
          onClick={onSave}
          disabled={isSaving || Object.keys(form).length === 0}
          className="px-4 py-2 bg-[#1a73e8] text-white text-sm font-medium rounded-lg hover:bg-[#1557b0] disabled:opacity-50"
        >
          {isSaving ? "Saving..." : "Save changes"}
        </button>
      </div>
    </div>
  );
}

function DevicesTab({
  user,
  devices,
}: {
  user: UserDetail | TeamMember;
  devices: Array<{
    macId: string;
    displayName?: string;
    provisioningUrl?: string;
    deviceType?: { name?: string };
  }>;
}) {
  const ud = user as UserDetail;

  return (
    <div className="border border-[#dadce0] rounded-lg bg-white divide-y divide-[#f1f3f4] overflow-hidden">
      <div className="px-6 py-4">
        <p className="text-xs font-medium text-gray-500 mb-1">Caller ID</p>
        <p className="text-sm text-gray-600">
          Your outbound calls will appear from this number.
        </p>
        <p className="mt-1 text-sm font-medium text-gray-900 break-all min-w-0">
          {ud.callerId ?? ud.lineNumber?.[0] ?? "—"}
        </p>
      </div>
      <div className="px-6 py-4">
        <p className="text-xs font-medium text-gray-500 mb-1">Phone Rings</p>
        <p className="text-sm text-gray-600">All desk phones ring simultaneously.</p>
        <p className="mt-1 text-sm font-medium text-gray-900">
          {ud.sipDeviceRings ?? 3} Rings
        </p>
      </div>
      <div className="px-6 py-4">
        <p className="text-xs font-medium text-gray-500 mb-2">Desk Phones</p>
        {devices.length === 0 ? (
          <p className="text-sm text-gray-500">No desk phones assigned</p>
        ) : (
          <div className="space-y-2">
            {devices.map((d) => (
              <div
                key={d.macId}
                className="flex items-center justify-between gap-4 rounded-lg border border-[#dadce0] p-3 bg-white min-w-0"
              >
                <span className="text-sm text-gray-900 truncate min-w-0">
                  {d.deviceType?.name ?? d.displayName ?? d.macId}
                </span>
                {d.provisioningUrl && (
                  <a
                    href={d.provisioningUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-[#1a73e8] hover:underline shrink-0"
                  >
                    Config
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
        <button type="button" className="mt-2 text-sm text-[#1a73e8] hover:underline font-medium">
          Add Desk Phone
        </button>
      </div>
    </div>
  );
}

function VoicemailTab({
  user,
  form,
  onUpdate,
  onSave,
  isSaving,
}: {
  user: UserDetail | TeamMember;
  form: Partial<UpdateUserPayload>;
  onUpdate: (u: Partial<UpdateUserPayload>) => void;
  onSave: () => void;
  isSaving: boolean;
}) {
  const ud = user as UserDetail;
  const vm = ud.voicemailNotification ?? {};
  const enabled = form.voicemailEnabled ?? ud.voicemailEnabled ?? false;
  const emailNotify =
    form.voicemailNotification?.emailNotify ?? vm.emailNotify ?? false;
  const emailIncludeVM =
    form.voicemailNotification?.emailIncludeVM ?? vm.emailIncludeVM ?? false;
  const emailTranscribe =
    form.voicemailNotification?.emailTranscribe ?? vm.emailTranscribe ?? false;
  const emailIncludeCaller =
    form.voicemailNotification?.emailIncludeCallerDetails ??
    vm.emailIncludeCallerDetails ??
    false;

  return (
    <div className="border border-[#dadce0] rounded-lg bg-white divide-y divide-[#f1f3f4] overflow-hidden">
      <SettingsRow
        label="Voicemail"
        description="When off, callers cannot leave voicemail if you miss their call."
        controlLeading
      >
        <Toggle checked={enabled} onChange={(v) => onUpdate({ voicemailEnabled: v })} />
      </SettingsRow>
      <SettingsRow
        label="Voicemail-to-Email"
        description="Email me when I get a new voicemail."
        controlLeading
      >
        <Toggle
          checked={emailNotify}
          onChange={(v) =>
            onUpdate({
              voicemailNotification: { ...form.voicemailNotification, ...vm, emailNotify: v },
            })
          }
        />
      </SettingsRow>
      {emailNotify && (
        <div className="px-6 py-4 space-y-3 bg-white">
          <p className="text-xs font-medium text-gray-500">Email options</p>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={emailIncludeVM}
              onChange={(e) =>
                onUpdate({
                  voicemailNotification: {
                    ...form.voicemailNotification,
                    ...vm,
                    emailIncludeVM: e.target.checked,
                  },
                })
              }
              className="rounded border-[#dadce0] text-[#1a73e8]"
            />
            <span className="text-sm text-gray-700">Include Audio File Attachment</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={emailTranscribe}
              onChange={(e) =>
                onUpdate({
                  voicemailNotification: {
                    ...form.voicemailNotification,
                    ...vm,
                    emailTranscribe: e.target.checked,
                  },
                })
              }
              className="rounded border-[#dadce0] text-[#1a73e8]"
            />
            <span className="text-sm text-gray-700">Include Audio Transcript</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={emailIncludeCaller}
              onChange={(e) =>
                onUpdate({
                  voicemailNotification: {
                    ...form.voicemailNotification,
                    ...vm,
                    emailIncludeCallerDetails: e.target.checked,
                  },
                })
              }
              className="rounded border-[#dadce0] text-[#1a73e8]"
            />
            <span className="text-sm text-gray-700">Include Caller Details</span>
          </label>
        </div>
      )}
      <div className="px-6 py-4">
        <button
          onClick={onSave}
          disabled={isSaving || Object.keys(form).length === 0}
          className="px-4 py-2 bg-[#1a73e8] text-white text-sm font-medium rounded-lg hover:bg-[#1557b0] disabled:opacity-50"
        >
          {isSaving ? "Saving..." : "Save changes"}
        </button>
      </div>
    </div>
  );
}

function HoldMusicTab({
  user,
  form,
  onUpdate,
  onSave,
  isSaving,
}: {
  user: UserDetail | TeamMember;
  form: Partial<UpdateUserPayload>;
  onUpdate: (u: Partial<UpdateUserPayload>) => void;
  onSave: () => void;
  isSaving: boolean;
}) {
  const ud = user as UserDetail;
  const custom = form.hasCustomMusicOnHold ?? ud.hasCustomMusicOnHold ?? false;

  return (
    <div className="border border-[#dadce0] rounded-lg bg-white divide-y divide-[#f1f3f4] overflow-hidden">
      <div className="px-6 py-4">
        <p className="text-sm text-gray-600 mb-4">
          Choose Default to use standard hold music, or Custom to upload your own.
        </p>
        <div className="space-y-2">
          <label className="flex items-center gap-3 p-3 rounded-lg border border-[#dadce0] cursor-pointer hover:bg-white">
            <input
              type="radio"
              name="holdMusic"
              checked={!custom}
              onChange={() => onUpdate({ hasCustomMusicOnHold: false })}
              className="text-[#1a73e8]"
            />
            <span className="text-sm text-gray-900">Default Music on Hold</span>
          </label>
          <label className="flex items-center gap-3 p-3 rounded-lg border border-[#dadce0] cursor-pointer hover:bg-white">
            <input
              type="radio"
              name="holdMusic"
              checked={custom}
              onChange={() => onUpdate({ hasCustomMusicOnHold: true })}
              className="text-[#1a73e8]"
            />
            <span className="text-sm text-gray-900">Custom Music on Hold</span>
          </label>
        </div>
      </div>
      <div className="px-6 py-4">
        <button
          onClick={onSave}
          disabled={isSaving || Object.keys(form).length === 0}
          className="px-4 py-2 bg-[#1a73e8] text-white text-sm font-medium rounded-lg hover:bg-[#1557b0] disabled:opacity-50"
        >
          {isSaving ? "Saving..." : "Save changes"}
        </button>
      </div>
    </div>
  );
}
