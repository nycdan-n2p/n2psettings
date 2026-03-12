"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
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
} from "lucide-react";
import { Modal } from "@/components/settings/Modal";
import { TextInput } from "@/components/settings/TextInput";
import { Toggle } from "@/components/settings/Toggle";
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
    <div className="flex items-center gap-4 px-6 py-4 border-b border-gray-200/80">
      <div className="flex-shrink-0 w-12 h-12 rounded-full bg-[#e8f0fe] flex items-center justify-center overflow-hidden">
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- external avatar URL
          <img
            src={avatarUrl}
            alt=""
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="text-lg font-medium text-[#1a73e8]">
            {displayName.charAt(0) || "?"}
          </span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <h2 className="text-lg font-medium text-gray-900 truncate">
          Edit {displayName}
        </h2>
        <p className="text-sm text-gray-500 truncate">{user.email}</p>
      </div>
      <button
        onClick={onClose}
        className="p-2 rounded-full hover:bg-gray-100 text-gray-500 transition-colors"
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
      size="xl"
      headerContent={headerContent}
    >
      <div className="flex flex-col -mx-6 -mb-4">
        {/* Tabs - Google Material 3 style */}
        <div className="flex overflow-x-auto border-b border-gray-200/80">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`
                flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap
                border-b-2 -mb-px transition-colors
                ${
                  activeTab === id
                    ? "border-[#1a73e8] text-[#1a73e8]"
                    : "border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50/50"
                }
              `}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="px-6 py-5 min-h-[320px]">
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
    <div className="space-y-5">
      <div className="rounded-xl border border-gray-200/80 p-6 bg-gray-50/30">
        <p className="text-sm text-gray-600 mb-4">
          Drag and drop your avatar here, or browse to upload.
        </p>
        <p className="text-xs text-gray-500">
          Supported: .png, .jpg, .jpeg · Max size: 4 MB
        </p>
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
        <div className="pt-2">
          <button
            onClick={onSave}
            disabled={isSaving}
            className="px-4 py-2 bg-[#1a73e8] text-white text-sm font-medium rounded-lg hover:bg-[#1557b0] disabled:opacity-50 flex items-center gap-2"
          >
            {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
            Save changes
          </button>
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

  const toggleDept = (deptId: number) => {
    const next = new Set(selectedIds);
    if (next.has(deptId)) next.delete(deptId);
    else next.add(deptId);
    onUpdate({
      members: Array.from(next).map((id) => ({ id })),
    });
  };

  const roleId = (user as { roleId?: number }).roleId;
  const compDirEnabled = form.compDir?.enabled ?? ud.compDir?.enabled ?? false;

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Phone Number
        </label>
        <p className="text-sm text-gray-600">
          {(ud.lineNumber?.[0] ?? "—")} · Ext {(user as { extension?: string }).extension ?? "—"}
        </p>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Departments
        </label>
        <div className="flex flex-wrap gap-2">
          {departments.map((d) => (
            <button
              key={d.deptId}
              type="button"
              onClick={() => toggleDept(d.deptId)}
              className={`
                px-3 py-1.5 rounded-full text-sm font-medium
                ${
                  selectedIds.has(d.deptId)
                    ? "bg-[#1a73e8] text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }
              `}
            >
              {d.name}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Role
        </label>
        <div className="flex gap-2">
          {["User", "Admin"].map((r) => (
            <button
              key={r}
              type="button"
              className={`
                px-4 py-2 rounded-lg text-sm font-medium
                ${
                  (user.role?.toLowerCase() === r.toLowerCase() ||
                    (r === "Admin" && roleId === 1))
                    ? "bg-[#1a73e8] text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }
              `}
            >
              {r}
            </button>
          ))}
        </div>
      </div>
      <div className="flex items-center justify-between py-2">
        <div>
          <p className="text-sm font-medium text-gray-900">Company Directory</p>
          <p className="text-xs text-gray-500">
            When on, callers can reach you by name in the directory.
          </p>
        </div>
        <Toggle
          checked={compDirEnabled}
          onChange={(v) => onUpdate({ compDir: { enabled: v } })}
        />
      </div>
      <button
        onClick={onSave}
        disabled={isSaving || Object.keys(form).length === 0}
        className="px-4 py-2 bg-[#1a73e8] text-white text-sm font-medium rounded-lg hover:bg-[#1557b0] disabled:opacity-50"
      >
        {isSaving ? "Saving..." : "Save changes"}
      </button>
    </div>
  );
}

function LicensesTab({
  licenses,
}: {
  licenses: Array<{ code?: string; name?: string }>;
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        Licenses granted by your company admins.
      </p>
      <div className="rounded-lg border border-gray-200 divide-y divide-gray-100">
        {licenses.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-500">
            No licenses to display
          </p>
        ) : (
          licenses.map((l) => (
            <div
              key={l.code ?? l.name ?? ""}
              className="flex items-center gap-3 px-4 py-3"
            >
              <FileBarChart className="w-5 h-5 text-gray-400" />
              <span className="text-sm font-medium text-gray-900">
                {l.name ?? l.code ?? "License"}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function CallForwardingTab() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        Enable call forwarding and choose when and where to forward calls.
      </p>
      <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
        <p className="text-sm text-amber-800">
          Call forwarding configuration is managed at the account level. Contact
          your admin or use the main settings to configure forwarding rules.
        </p>
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
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-gray-900 mb-1">
          Ring Group Status
        </p>
        <div className="flex items-center gap-2">
          <span
            className={`w-2.5 h-2.5 rounded-full ${
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
      <div className="flex items-center justify-between py-2">
        <div>
          <p className="text-sm font-medium text-gray-900">Ring group calls</p>
          <p className="text-xs text-gray-500">
            Allow this user to receive ring group calls.
          </p>
        </div>
        <Toggle
          checked={ringGroupEnabled}
          onChange={(v) => onUpdate({ isRingGroupCallsEnabled: v })}
        />
      </div>
      <button
        onClick={onSave}
        disabled={isSaving || Object.keys(form).length === 0}
        className="px-4 py-2 bg-[#1a73e8] text-white text-sm font-medium rounded-lg hover:bg-[#1557b0] disabled:opacity-50"
      >
        {isSaving ? "Saving..." : "Save changes"}
      </button>
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
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Caller ID
        </label>
        <p className="text-sm text-gray-600">
          Your outbound calls will appear from this number.
        </p>
        <p className="mt-1 text-sm font-medium text-gray-900">
          {ud.callerId ?? ud.lineNumber?.[0] ?? "—"}
        </p>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Phone Rings
        </label>
        <p className="text-sm text-gray-600">
          All desk phones ring simultaneously.
        </p>
        <p className="mt-1 text-sm font-medium text-gray-900">
          {ud.sipDeviceRings ?? 3} Rings
        </p>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Desk Phones
        </label>
        {devices.length === 0 ? (
          <p className="text-sm text-gray-500">No desk phones assigned</p>
        ) : (
          <div className="space-y-2">
            {devices.map((d) => (
              <div
                key={d.macId}
                className="flex items-center justify-between rounded-lg border border-gray-200 p-3"
              >
                <span className="text-sm font-medium">
                  {d.deviceType?.name ?? d.displayName ?? d.macId}
                </span>
                {d.provisioningUrl && (
                  <a
                    href={d.provisioningUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-[#1a73e8] hover:underline"
                  >
                    Config
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
        <button
          type="button"
          className="mt-2 text-sm text-[#1a73e8] hover:underline"
        >
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
    <div className="space-y-6">
      <div className="flex items-center justify-between py-2">
        <div>
          <p className="text-sm font-medium text-gray-900">Voicemail</p>
          <p className="text-xs text-gray-500">
            When off, callers cannot leave voicemail if you miss their call.
          </p>
        </div>
        <Toggle
          checked={enabled}
          onChange={(v) => onUpdate({ voicemailEnabled: v })}
        />
      </div>
      <div className="flex items-center justify-between py-2">
        <div>
          <p className="text-sm font-medium text-gray-900">
            Voicemail-to-Email
          </p>
          <p className="text-xs text-gray-500">
            Email me when I get a new voicemail.
          </p>
        </div>
        <Toggle
          checked={emailNotify}
          onChange={(v) =>
            onUpdate({
              voicemailNotification: {
                ...form.voicemailNotification,
                ...vm,
                emailNotify: v,
              },
            })
          }
        />
      </div>
      {emailNotify && (
        <div className="pl-4 space-y-2 border-l-2 border-gray-200">
          <label className="flex items-center gap-2">
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
              className="rounded border-gray-300"
            />
            <span className="text-sm">Include Audio File Attachment</span>
          </label>
          <label className="flex items-center gap-2">
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
              className="rounded border-gray-300"
            />
            <span className="text-sm">Include Audio Transcript</span>
          </label>
          <label className="flex items-center gap-2">
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
              className="rounded border-gray-300"
            />
            <span className="text-sm">Include Caller Details</span>
          </label>
        </div>
      )}
      <button
        onClick={onSave}
        disabled={isSaving || Object.keys(form).length === 0}
        className="px-4 py-2 bg-[#1a73e8] text-white text-sm font-medium rounded-lg hover:bg-[#1557b0] disabled:opacity-50"
      >
        {isSaving ? "Saving..." : "Save changes"}
      </button>
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
    <div className="space-y-6">
      <p className="text-sm text-gray-600">
        Choose Default to use standard hold music, or Custom to upload your own.
      </p>
      <div className="space-y-2">
        <label className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50">
          <input
            type="radio"
            name="holdMusic"
            checked={!custom}
            onChange={() => onUpdate({ hasCustomMusicOnHold: false })}
            className="text-[#1a73e8]"
          />
          <span className="text-sm font-medium">Default Music on Hold</span>
        </label>
        <label className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50">
          <input
            type="radio"
            name="holdMusic"
            checked={custom}
            onChange={() => onUpdate({ hasCustomMusicOnHold: true })}
            className="text-[#1a73e8]"
          />
          <span className="text-sm font-medium">Custom Music on Hold</span>
        </label>
      </div>
      <button
        onClick={onSave}
        disabled={isSaving || Object.keys(form).length === 0}
        className="px-4 py-2 bg-[#1a73e8] text-white text-sm font-medium rounded-lg hover:bg-[#1557b0] disabled:opacity-50"
      >
        {isSaving ? "Saving..." : "Save changes"}
      </button>
    </div>
  );
}
