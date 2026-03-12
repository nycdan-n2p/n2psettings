"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DataTable } from "@/components/tables/DataTable";
import { useApp } from "@/contexts/AppContext";
import { qk, lightKeys } from "@/lib/query-keys";
import { Loader } from "@/components/ui/Loader";
import {
  fetchDepartments,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  assignUserToDepartment,
  unassignUserFromDepartment,
  fetchDepartmentFeatures,
  updateDepartmentFeature,
  type Department,
  type CreateDepartmentPayload,
  type DepartmentMember,
} from "@/lib/api/departments";
import { fetchPhoneNumbers } from "@/lib/api/phone-numbers";
import { fetchUsersLight } from "@/lib/api/ring-groups";
import type { ColumnDef } from "@tanstack/react-table";
import { Modal } from "@/components/settings/Modal";
import { TextInput } from "@/components/settings/TextInput";
import { ConfirmDialog } from "@/components/settings/ConfirmDialog";
import { Pencil, Trash2, Phone, ChevronDown, Plus, X } from "lucide-react";

const EMPTY_FORM: CreateDepartmentPayload = { name: "", extension: "" };

function formatPhoneDisplay(num: string): string {
  const digits = num.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) {
    const area = digits.slice(1, 4);
    const mid = digits.slice(4, 7);
    const last = digits.slice(7);
    return `(${area}) ${mid}-${last}`;
  }
  if (digits.length === 10) {
    const area = digits.slice(0, 3);
    const mid = digits.slice(3, 6);
    const last = digits.slice(6);
    return `(${area}) ${mid}-${last}`;
  }
  return num;
}

// ── Toggle ────────────────────────────────────────────────────────────────────
function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none ${
        checked ? "bg-[#1a73e8]" : "bg-gray-300"
      }`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${checked ? "translate-x-6" : "translate-x-1"}`} />
    </button>
  );
}

// ── Add Member Row ──────────────────────────────────────────────────────────────
function AddMemberRow({
  users,
  currentMembers,
  onAdd,
}: {
  users: Array<{ userId: number; firstName: string; lastName: string; extension?: string }>;
  currentMembers: DepartmentMember[];
  onAdd: (userId: number) => void;
}) {
  const [selectedId, setSelectedId] = useState("");
  const currentIds = new Set(currentMembers.map((m) => m.userId));
  const available = users.filter((u) => !currentIds.has(u.userId));

  return (
    <div className="flex gap-2 items-center mt-2.5">
      <select
        value={selectedId}
        onChange={(e) => setSelectedId(e.target.value)}
        className="flex-1 px-2 py-1.5 border border-[#dadce0] rounded-md text-sm bg-white"
      >
        <option value="">Select team member…</option>
        {available.map((u) => (
          <option key={u.userId} value={String(u.userId)}>
            {u.firstName} {u.lastName}
            {u.extension ? ` · ${u.extension}` : ""}
          </option>
        ))}
      </select>
      <button
        onClick={() => {
          if (!selectedId) return;
          onAdd(Number(selectedId));
          setSelectedId("");
        }}
        disabled={!selectedId}
        className="flex items-center gap-1 px-3 py-1.5 bg-[#1a73e8] text-white rounded-md text-sm hover:bg-[#1557b0] disabled:opacity-40 shrink-0"
      >
        <Plus className="w-3.5 h-3.5" /> Add
      </button>
    </div>
  );
}

// ── Department Edit Modal (full edit) ────────────────────────────────────────────
function DepartmentEditModal({
  department,
  isOpen,
  onClose,
  onSuccess,
  onDelete,
}: {
  department: Department;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  onDelete: () => void;
}) {
  const { bootstrap } = useApp();
  const accountId = bootstrap?.account?.accountId ?? 0;
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"department" | "callOptions" | "voicemail">("department");
  const [name, setName] = useState(department.name);
  const [members, setMembers] = useState<DepartmentMember[]>(department.members ?? []);

  useEffect(() => {
    setName(latestDept.name);
    setMembers(latestDept.members ?? []);
  }, [latestDept]);

  const { data: departmentsList = [] } = useQuery({
    queryKey: qk.departments.list(accountId),
    queryFn: () => fetchDepartments(accountId),
    enabled: !!accountId && isOpen,
  });
  const latestDept = departmentsList.find((d) => d.deptId === department.deptId) ?? department;

  const { data: features = [] } = useQuery({
    queryKey: qk.departments.features(accountId, department.deptId),
    queryFn: () => fetchDepartmentFeatures(accountId, department.deptId),
    enabled: !!accountId && !!department.deptId && isOpen,
  });

  const { data: phoneNumbers = [] } = useQuery({
    queryKey: qk.phoneNumbers.all(accountId),
    queryFn: () => fetchPhoneNumbers(accountId),
    enabled: !!accountId && isOpen,
  });

  const { data: usersLight = [] } = useQuery({
    queryKey: lightKeys.users(accountId),
    queryFn: () => fetchUsersLight(accountId),
    enabled: !!accountId && isOpen,
  });

  const updateMutation = useMutation({
    mutationFn: (payload: Partial<CreateDepartmentPayload>) =>
      updateDepartment(accountId, department.deptId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.departments.all(accountId) });
      onSuccess();
    },
  });

  const recordMutation = useMutation({
    mutationFn: (active: boolean) =>
      updateDepartmentFeature(accountId, department.deptId, "record", active),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.departments.features(accountId, department.deptId) });
      queryClient.invalidateQueries({ queryKey: qk.departments.all(accountId) });
    },
  });

  const assignMutation = useMutation({
    mutationFn: (userId: number) => assignUserToDepartment(accountId, userId, department.deptId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.departments.all(accountId) });
      queryClient.invalidateQueries({ queryKey: lightKeys.users(accountId) });
      queryClient.invalidateQueries({ queryKey: qk.teamMembers.all(accountId) });
      // Refresh members from departments list
      queryClient.invalidateQueries({ queryKey: qk.departments.list(accountId) });
    },
  });

  const unassignMutation = useMutation({
    mutationFn: (userId: number) => unassignUserFromDepartment(accountId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.departments.all(accountId) });
      queryClient.invalidateQueries({ queryKey: lightKeys.users(accountId) });
      queryClient.invalidateQueries({ queryKey: qk.teamMembers.all(accountId) });
      queryClient.invalidateQueries({ queryKey: qk.departments.list(accountId) });
    },
  });

  const recording = features.find((f) => f.id === "record")?.active ?? false;

  const deptNumbers = phoneNumbers.filter(
    (pn) =>
      (pn.routeToId === department.deptId || pn.deptId === department.deptId) &&
      (pn.routeType === "department" || pn.routeType === "Department")
  );
  const lineNumbers = deptNumbers.length > 0
    ? deptNumbers.map((pn) => pn.phoneNumber)
    : (department.lineNumber ?? []);

  const handleSaveName = () => {
    if (name.trim() && name !== department.name) {
      updateMutation.mutate({ name: name.trim() });
    }
  };

  const handleAddMember = (userId: number) => {
    assignMutation.mutate(userId);
    const u = usersLight.find((x) => x.userId === userId);
    if (u) setMembers((m) => [...m, { userId: u.userId, firstName: u.firstName, lastName: u.lastName, extension: u.extension }]);
  };

  const handleRemoveMember = (userId: number) => {
    unassignMutation.mutate(userId);
    setMembers((m) => m.filter((x) => x.userId !== userId));
  };

  const handleToggleRecording = (v: boolean) => {
    recordMutation.mutate(v);
  };

  const TABS = [
    { id: "department" as const, label: "Department" },
    { id: "callOptions" as const, label: "Call Options" },
    { id: "voicemail" as const, label: "Voicemail" },
  ];

  const initials = (department.name ?? "")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="" size="lg">
      <div className="flex items-center gap-3 px-1 pb-4 border-b border-[#dadce0]">
        <div className="w-10 h-10 rounded-full bg-[#1a73e8] text-white flex items-center justify-center text-sm font-semibold shrink-0">
          {initials || "—"}
        </div>
        <h2 className="text-lg font-medium text-gray-900">{department.name}</h2>
      </div>

      <div className="flex gap-2 border-b border-[#dadce0] mt-4 -mb-px">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === t.id
                ? "border-[#1a73e8] text-[#1a73e8]"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="pt-5">
        {activeTab === "department" && (
          <div className="space-y-5">
            <div className="grid grid-cols-[1fr_120px] gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Department Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onBlur={handleSaveName}
                  className="w-full px-3 py-2 border border-[#dadce0] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#1a73e8]"
                  placeholder="e.g. Product Management"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Ext Auto</label>
                <input
                  type="text"
                  value={department.extension ?? "—"}
                  readOnly
                  className="w-full px-3 py-2 border border-[#dadce0] rounded-md text-sm bg-gray-50 text-gray-500 cursor-not-allowed"
                />
              </div>
            </div>

            {lineNumbers.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone Number</label>
                <div className="flex flex-wrap gap-2">
                  {lineNumbers.slice(0, 3).map((num, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 rounded-md text-sm text-gray-700"
                    >
                      <Phone className="w-3.5 h-3.5 text-gray-500" />
                      {formatPhoneDisplay(num)} · {department.extension}
                    </div>
                  ))}
                  {lineNumbers.length > 3 && (
                    <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-100 rounded-md text-sm text-gray-600">
                      {lineNumbers.length - 3}+ <ChevronDown className="w-3.5 h-3.5" />
                    </div>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Manage phone numbers in{" "}
                  <Link href="/ucass/phone-numbers" className="text-[#1a73e8] hover:underline">
                    Phone Numbers
                  </Link>
                </p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Team Members Optional</label>
              <div className="flex flex-wrap gap-2">
                {members.map((m) => {
                  const label = [m.firstName, m.lastName].filter(Boolean).join(" ");
                  const ext = m.extension ? ` ${m.extension}` : "";
                  return (
                    <span
                      key={m.userId}
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#e8f0fe] text-[#1a73e8] rounded-md text-sm"
                    >
                      {label}
                      {ext}
                      <button
                        type="button"
                        onClick={() => handleRemoveMember(m.userId)}
                        className="p-0.5 rounded hover:bg-[#1a73e8]/20"
                        aria-label="Remove"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  );
                })}
              </div>
              <AddMemberRow
                users={usersLight}
                currentMembers={members}
                onAdd={handleAddMember}
              />
            </div>

            <div className="flex items-start justify-between gap-4 py-3 border-t border-[#dadce0]">
              <div>
                <h4 className="text-sm font-medium text-gray-900">Call Recording</h4>
                <p className="text-xs text-gray-500 mt-0.5">
                  Records all of the department incoming and outgoing calls, to all of its phone numbers.
                </p>
              </div>
              <Toggle
                checked={recording}
                onChange={handleToggleRecording}
              />
            </div>

            {(updateMutation.isError || recordMutation.isError || assignMutation.isError || unassignMutation.isError) && (
              <p className="text-sm text-red-600">
                {((updateMutation.error || recordMutation.error || assignMutation.error || unassignMutation.error) as Error)?.message ?? "Failed to save"}
              </p>
            )}

            <div className="flex justify-between items-center pt-4 border-t border-[#dadce0]">
              <button
                type="button"
                onClick={onDelete}
                className="px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 rounded-md"
              >
                Delete
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => { handleSaveName(); onClose(); }}
                  className="px-4 py-2 text-sm font-medium text-white bg-[#1a73e8] rounded-md hover:bg-[#1557b0]"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === "callOptions" && (
          <div className="py-4 text-sm text-gray-500">
            Call options for this department. Additional settings coming soon.
          </div>
        )}

        {activeTab === "voicemail" && (
          <div className="py-4 text-sm text-gray-500">
            Voicemail settings for this department. Coming soon.
          </div>
        )}
      </div>
    </Modal>
  );
}

export default function DepartmentsPage() {
  const { bootstrap } = useApp();
  const accountId = bootstrap?.account?.accountId ?? 0;
  const queryClient = useQueryClient();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Department | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Department | null>(null);
  const [form, setForm] = useState<CreateDepartmentPayload>({ ...EMPTY_FORM });

  const { data: departments = [], isLoading } = useQuery({
    queryKey: qk.departments.list(accountId),
    queryFn: () => fetchDepartments(accountId),
    enabled: !!accountId,
  });

  const addMutation = useMutation({
    mutationFn: (payload: CreateDepartmentPayload) => createDepartment(accountId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.departments.all(accountId) });
      closeModal();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ deptId, payload }: { deptId: number; payload: Partial<CreateDepartmentPayload> }) =>
      updateDepartment(accountId, deptId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.departments.all(accountId) });
      closeModal();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (deptId: number) => deleteDepartment(accountId, deptId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.departments.all(accountId) });
      setDeleteTarget(null);
      closeModal();
    },
  });

  const openAddModal = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM });
    setModalOpen(true);
  };

  const openEditModal = (d: Department) => {
    setEditing(d);
    setForm({ name: d.name, extension: d.extension ?? "" });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditing(null);
    setForm({ ...EMPTY_FORM });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editing) {
      updateMutation.mutate({ deptId: editing.deptId, payload: form });
    } else {
      addMutation.mutate(form);
    }
  };

  const isMutating = addMutation.isPending || updateMutation.isPending;

  const columns: ColumnDef<Department>[] = [
    {
      id: "department",
      header: "Department",
      accessorFn: (row) => row.name,
      cell: ({ row }) => {
        const initials = (row.original.name ?? "")
          .split(" ")
          .map((w) => w[0])
          .join("")
          .toUpperCase()
          .slice(0, 2);
        return (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-[#1a73e8] text-white flex items-center justify-center text-xs font-semibold shrink-0">
              {initials || "—"}
            </div>
            <span className="font-medium text-gray-900">{row.original.name}</span>
          </div>
        );
      },
    },
    { accessorKey: "extension", header: "Ext", cell: ({ row }) => row.original.extension ?? "—" },
    {
      id: "teamMembers",
      header: "Team Members",
      accessorFn: (row) => row.memberCount ?? 0,
      cell: ({ row }) => {
        const count = row.original.memberCount ?? 0;
        return (
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-800">
              {count} {count === 1 ? "member" : "members"}
            </span>
            {count > 0 && (
              <button
                onClick={() => openEditModal(row.original)}
                className="text-sm text-[#1a73e8] hover:underline"
              >
                View
              </button>
            )}
          </div>
        );
      },
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <div className="flex gap-2">
          <button
            onClick={() => openEditModal(row.original)}
            className="p-1.5 rounded hover:bg-gray-100 text-gray-600"
            title="Edit"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={() => setDeleteTarget(row.original)}
            className="p-1.5 rounded hover:bg-red-50 text-red-600"
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Departments</h1>
          <p className="text-sm text-gray-500 mt-1">
            Total: <strong>{departments.length}</strong>
          </p>
        </div>
        <button
          onClick={openAddModal}
          className="px-4 py-2 bg-[#1a73e8] text-white rounded-md hover:bg-[#1557b0] text-sm font-medium"
        >
          Add Department
        </button>
      </div>

      {isLoading ? (
        <div className="py-12 flex justify-center">
          <Loader variant="inline" label="Loading departments..." />
        </div>
      ) : (
        <DataTable columns={columns} data={departments} searchPlaceholder="Search" />
      )}

      {/* Add modal: simple form */}
      <Modal isOpen={modalOpen && !editing} onClose={closeModal} title="Add Department">
        <form onSubmit={handleSubmit}>
          <TextInput
            label="Name"
            value={form.name}
            onChange={(v) => setForm((f) => ({ ...f, name: v }))}
            placeholder="e.g. Sales"
            required
          />
          <TextInput
            label="Extension"
            value={form.extension ?? ""}
            onChange={(v) => setForm((f) => ({ ...f, extension: v }))}
            placeholder="e.g. 3000"
          />
          {(addMutation.isError || updateMutation.isError) && (
            <p className="text-sm text-red-600 mb-2">
              {((addMutation.error || updateMutation.error) as Error)?.message ?? "Failed to save"}
            </p>
          )}
          <div className="flex justify-end gap-2 mt-4">
            <button
              type="button"
              onClick={closeModal}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isMutating}
              className="px-4 py-2 text-sm font-medium text-white bg-[#1a73e8] rounded-md hover:bg-[#1557b0] disabled:opacity-50"
            >
              {isMutating ? "Saving..." : "Add"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit modal: full department edit */}
      {editing && (
        <DepartmentEditModal
          department={editing}
          isOpen={modalOpen}
          onClose={closeModal}
          onSuccess={closeModal}
          onDelete={() => setDeleteTarget(editing)}
        />
      )}

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.deptId)}
        title="Delete Department"
        message={`Delete department "${deleteTarget?.name}"? Members will be unassigned.`}
      />
    </div>
  );
}
