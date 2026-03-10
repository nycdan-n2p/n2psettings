"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DataTable } from "@/components/tables/DataTable";
import { useApp } from "@/contexts/AppContext";
import { Loader } from "@/components/ui/Loader";
import {
  fetchSchedules,
  createSchedule,
  updateSchedule,
  deleteSchedule,
  type Schedule,
  type CreateSchedulePayload,
} from "@/lib/api/schedules";
import type { ColumnDef } from "@tanstack/react-table";
import { Modal } from "@/components/settings/Modal";
import { TextInput } from "@/components/settings/TextInput";
import { ConfirmDialog } from "@/components/settings/ConfirmDialog";
import { Pencil, Trash2 } from "lucide-react";

const TIMEZONES = [
  "America/New_York", "America/Chicago", "America/Denver",
  "America/Los_Angeles", "America/Toronto", "America/Vancouver",
  "America/Sao_Paulo", "Europe/London", "Europe/Madrid",
  "America/Argentina/Buenos_Aires",
];

const EMPTY_FORM: CreateSchedulePayload = { name: "", timezone: "America/New_York" };

function usedByCount(s: Schedule): number {
  const u = s.used;
  if (!u) return 0;
  return (u.users?.length ?? 0) + (u.departments?.length ?? 0) + (u.welcomeMenus?.length ?? 0) + (u.ringGroups?.length ?? 0);
}

export default function SchedulesPage() {
  const { bootstrap } = useApp();
  const accountId = bootstrap?.account?.accountId ?? 0;
  const queryClient = useQueryClient();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Schedule | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Schedule | null>(null);
  const [form, setForm] = useState<CreateSchedulePayload>({ ...EMPTY_FORM });

  const { data: schedules = [], isLoading } = useQuery({
    queryKey: ["schedules", accountId],
    queryFn: () => fetchSchedules(accountId),
    enabled: !!accountId,
  });

  const addMutation = useMutation({
    mutationFn: (payload: CreateSchedulePayload) => createSchedule(accountId, payload),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["schedules", accountId] }); closeModal(); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<CreateSchedulePayload> }) =>
      updateSchedule(accountId, id, payload),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["schedules", accountId] }); closeModal(); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteSchedule(accountId, id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["schedules", accountId] }); setDeleteTarget(null); },
  });

  const openAddModal = () => { setEditing(null); setForm({ ...EMPTY_FORM }); setModalOpen(true); };
  const openEditModal = (s: Schedule) => { setEditing(s); setForm({ name: s.name, timezone: s.timezone ?? "America/New_York" }); setModalOpen(true); };
  const closeModal = () => { setModalOpen(false); setEditing(null); setForm({ ...EMPTY_FORM }); };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editing) { updateMutation.mutate({ id: editing.id, payload: form }); }
    else { addMutation.mutate(form); }
  };

  const isMutating = addMutation.isPending || updateMutation.isPending;

  const columns: ColumnDef<Schedule>[] = [
    { accessorKey: "name", header: "Name" },
    { accessorKey: "type", header: "Type", cell: ({ row }) => row.original.type ?? "—" },
    { accessorKey: "timezone", header: "Timezone", cell: ({ row }) => row.original.timezone ?? "—" },
    { id: "usedBy", header: "Used By", cell: ({ row }) => { const c = usedByCount(row.original); return c > 0 ? `${c} item${c !== 1 ? "s" : ""}` : "—"; } },
    {
      id: "actions", header: "",
      cell: ({ row }) => (
        <div className="flex gap-2">
          <button onClick={() => openEditModal(row.original)} className="p-1.5 rounded hover:bg-gray-100 text-gray-600" title="Edit"><Pencil className="w-4 h-4" /></button>
          <button onClick={() => setDeleteTarget(row.original)} className="p-1.5 rounded hover:bg-red-50 text-red-600" title="Delete"><Trash2 className="w-4 h-4" /></button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-medium text-gray-900">Schedules</h1>
          <p className="text-sm text-gray-500 mt-1">{schedules.length} schedules</p>
        </div>
        <button onClick={openAddModal} className="px-4 py-2 bg-[#1a73e8] text-white rounded-md hover:bg-[#1557b0] text-sm font-medium">Add Schedule</button>
      </div>
      {isLoading ? <div className="py-12 flex justify-center"><Loader variant="inline" label="Loading schedules..." /></div> : (
        <DataTable columns={columns} data={schedules} searchPlaceholder="Search schedules..." />
      )}
      <Modal isOpen={modalOpen} onClose={closeModal} title={editing ? "Edit Schedule" : "Add Schedule"}>
        <form onSubmit={handleSubmit}>
          <TextInput label="Name" value={form.name} onChange={(v) => setForm((f) => ({ ...f, name: v }))} placeholder="e.g. Business Hours" required />
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Timezone</label>
            <select value={form.timezone ?? ""} onChange={(e) => setForm((f) => ({ ...f, timezone: e.target.value }))} className="w-full px-3 py-2 border border-[#dadce0] rounded-md text-sm">
              {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
            </select>
          </div>
          {(addMutation.isError || updateMutation.isError) && (
            <p className="text-sm text-red-600 mb-2">{((addMutation.error || updateMutation.error) as Error)?.message ?? "Failed to save"}</p>
          )}
          <div className="flex justify-end gap-2 mt-4">
            <button type="button" onClick={closeModal} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200">Cancel</button>
            <button type="submit" disabled={isMutating} className="px-4 py-2 text-sm font-medium text-white bg-[#1a73e8] rounded-md hover:bg-[#1557b0] disabled:opacity-50">{isMutating ? "Saving..." : editing ? "Save" : "Add"}</button>
          </div>
        </form>
      </Modal>
      <ConfirmDialog isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)} title="Delete Schedule" message={`Delete schedule "${deleteTarget?.name}"?`} />
    </div>
  );
}
