"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DataTable } from "@/components/tables/DataTable";
import { useApp } from "@/contexts/AppContext";
import { qk } from "@/lib/query-keys";
import { Loader } from "@/components/ui/Loader";
import {
  fetchTeamMembers,
  createUser,
  updateUser,
  deleteUser,
  exportUsersCsv,
  type TeamMember,
  type CreateUserPayload,
} from "@/lib/api/team-members";
import { fetchDepartments } from "@/lib/api/departments";
import type { ColumnDef } from "@tanstack/react-table";
import { Modal } from "@/components/settings/Modal";
import { TextInput } from "@/components/settings/TextInput";
import { ConfirmDialog } from "@/components/settings/ConfirmDialog";
import { Pencil, Trash2, Download, Music2 } from "lucide-react";

const EMPTY_FORM: CreateUserPayload = {
  firstName: "",
  lastName: "",
  email: "",
  extension: "",
  roleId: undefined,
  deptId: undefined,
  password: "",
};

export default function TeamMembersPage() {
  const { bootstrap } = useApp();
  const accountId = bootstrap?.account?.accountId ?? 0;
  const queryClient = useQueryClient();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<TeamMember | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TeamMember | null>(null);
  const [form, setForm] = useState<CreateUserPayload>({ ...EMPTY_FORM });

  const { data: users = [], isLoading } = useQuery({
    queryKey: qk.teamMembers.list(accountId),
    queryFn: () => fetchTeamMembers(accountId),
    enabled: !!accountId,
  });

  const { data: departments = [] } = useQuery({
    queryKey: qk.departments.list(accountId),
    queryFn: () => fetchDepartments(accountId),
    enabled: !!accountId,
  });

  const addMutation = useMutation({
    mutationFn: (payload: CreateUserPayload) => createUser(accountId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.teamMembers.all(accountId) });
      closeModal();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ userId, payload }: { userId: number; payload: Partial<CreateUserPayload> }) =>
      updateUser(accountId, userId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.teamMembers.all(accountId) });
      closeModal();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (userId: number) => deleteUser(accountId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.teamMembers.all(accountId) });
      setDeleteTarget(null);
    },
  });

  const openAddModal = () => {
    setEditingUser(null);
    setForm({ ...EMPTY_FORM });
    setModalOpen(true);
  };

  const openEditModal = (u: TeamMember) => {
    setEditingUser(u);
    setForm({
      firstName: u.firstName,
      lastName: u.lastName,
      email: u.email,
      extension: u.extension,
      deptId: u.deptId,
      password: "",
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingUser(null);
    setForm({ ...EMPTY_FORM });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { ...form };
    if (!payload.password) delete payload.password;
    if (editingUser) {
      updateMutation.mutate({ userId: editingUser.userId, payload });
    } else {
      addMutation.mutate(payload);
    }
  };

  const handleExportCsv = async () => {
    try {
      const blob = await exportUsersCsv(accountId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "team-members.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      const headers = ["First Name", "Last Name", "Email", "Extension", "Status", "Role"];
      const rows = users.map((u) => [u.firstName, u.lastName, u.email, u.extension, u.status, u.role]);
      const csv = [headers, ...rows].map((r) => r.map((v) => `"${v ?? ""}"`).join(",")).join("\n");
      const csvBlob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(csvBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "team-members.csv";
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const isMutating = addMutation.isPending || updateMutation.isPending;

  const columns: ColumnDef<TeamMember>[] = [
    {
      id: "name",
      header: "Name",
      accessorFn: (row) => `${row.firstName} ${row.lastName}`,
      cell: ({ row }) => (
        <p className="font-medium text-gray-900">
          {row.original.firstName} {row.original.lastName}
        </p>
      ),
    },
    { accessorKey: "extension", header: "Ext" },
    { accessorKey: "email", header: "Email" },
    {
      id: "department",
      header: "Department",
      accessorFn: (row) => row.departments ?? "",
      cell: ({ row }) => (
        <span className={row.original.departments ? "text-gray-900" : "text-gray-400"}>
          {row.original.departments ?? "None"}
        </span>
      ),
    },
    {
      id: "ringGroup",
      header: "Ring Group Status",
      cell: ({ row }) =>
        row.original.ringGroupStatus ? (
          <span className="inline-flex items-center gap-1.5 text-green-700 text-sm">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            {row.original.ringGroupStatus}
          </span>
        ) : (
          <span className="text-gray-400">—</span>
        ),
    },
    {
      id: "directory",
      header: "Directory",
      cell: ({ row }) =>
        row.original.directoryEnabled ? (
          <span className="inline-flex items-center gap-1.5 text-green-700 text-sm">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            Included
          </span>
        ) : (
          <span className="text-gray-400">—</span>
        ),
    },
    {
      id: "musicOnHold",
      header: "Music on Hold",
      cell: ({ row }) => (
        <span className="inline-flex items-center gap-1.5 text-sm">
          <Music2 className="w-3.5 h-3.5 text-gray-400" />
          {row.original.musicOnHold ?? "Default"}
        </span>
      ),
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
          <h1 className="text-2xl font-medium text-gray-900">Team Members</h1>
          <p className="text-sm text-gray-500 mt-1">{users.length} members</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExportCsv}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-[#dadce0] rounded-md hover:bg-gray-50"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
          <button
            onClick={openAddModal}
            className="px-4 py-2 bg-[#1a73e8] text-white rounded-md hover:bg-[#1557b0] text-sm font-medium"
          >
            Add Team Member
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="py-12 flex justify-center">
          <Loader variant="inline" label="Loading team members..." />
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={users}
          searchKey="email"
          searchPlaceholder="Search by name, email, or extension..."
        />
      )}

      <Modal
        isOpen={modalOpen}
        onClose={closeModal}
        title={editingUser ? "Edit Team Member" : "Add Team Member"}
      >
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-2 gap-3">
            <TextInput
              label="First Name"
              value={form.firstName}
              onChange={(v) => setForm((f) => ({ ...f, firstName: v }))}
              placeholder="First name"
              required
            />
            <TextInput
              label="Last Name"
              value={form.lastName}
              onChange={(v) => setForm((f) => ({ ...f, lastName: v }))}
              placeholder="Last name"
              required
            />
          </div>
          <TextInput
            label="Email"
            value={form.email}
            onChange={(v) => setForm((f) => ({ ...f, email: v }))}
            type="email"
            placeholder="user@example.com"
            required
          />
          <TextInput
            label="Extension"
            value={form.extension}
            onChange={(v) => setForm((f) => ({ ...f, extension: v }))}
            placeholder="e.g. 1001"
            required
          />
          {!editingUser && (
            <TextInput
              label="Password"
              value={form.password ?? ""}
              onChange={(v) => setForm((f) => ({ ...f, password: v }))}
              type="password"
              placeholder="Temporary password"
            />
          )}
          {departments.length > 0 && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Department
              </label>
              <select
                value={form.deptId ?? ""}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    deptId: e.target.value ? Number(e.target.value) : undefined,
                  }))
                }
                className="w-full px-3 py-2 border border-[#dadce0] rounded-md text-sm"
              >
                <option value="">None</option>
                {departments.map((d) => (
                  <option key={d.deptId} value={d.deptId}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          {(addMutation.isError || updateMutation.isError) && (
            <p className="text-sm text-red-600 mb-2">
              {((addMutation.error || updateMutation.error) as Error)?.message ?? "Failed to save user"}
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
              {isMutating ? "Saving..." : editingUser ? "Save" : "Add"}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.userId)}
        title="Delete Team Member"
        message={`Remove ${deleteTarget?.firstName} ${deleteTarget?.lastName} from the account? This cannot be undone.`}
      />
    </div>
  );
}
