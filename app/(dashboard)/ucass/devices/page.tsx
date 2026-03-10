"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DataTable } from "@/components/tables/DataTable";
import { useApp } from "@/contexts/AppContext";
import { Loader } from "@/components/ui/Loader";
import {
  fetchDevices,
  createDevice,
  updateDevice,
  deleteDevice,
  type Device,
  type CreateDevicePayload,
} from "@/lib/api/devices";
import type { ColumnDef } from "@tanstack/react-table";
import { Modal } from "@/components/settings/Modal";
import { TextInput } from "@/components/settings/TextInput";
import { ConfirmDialog } from "@/components/settings/ConfirmDialog";
import { Pencil, Trash2 } from "lucide-react";

export default function DevicesPage() {
  const { bootstrap } = useApp();
  const accountId = bootstrap?.account?.accountId ?? 0;
  const queryClient = useQueryClient();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Device | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Device | null>(null);
  const [formMac, setFormMac] = useState("");
  const [formDisplay, setFormDisplay] = useState("");
  const [formTypeId, setFormTypeId] = useState("");

  const { data: devices = [], isLoading } = useQuery({
    queryKey: ["devices", accountId],
    queryFn: () => fetchDevices(accountId),
    enabled: !!accountId,
  });

  const addMutation = useMutation({
    mutationFn: (payload: CreateDevicePayload) => createDevice(accountId, payload),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["devices", accountId] }); closeModal(); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ macId, payload }: { macId: string; payload: Partial<CreateDevicePayload> }) =>
      updateDevice(accountId, macId, payload),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["devices", accountId] }); closeModal(); },
  });

  const deleteMutation = useMutation({
    mutationFn: (macId: string) => deleteDevice(accountId, macId),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["devices", accountId] }); setDeleteTarget(null); },
  });

  const openAddModal = () => { setEditing(null); setFormMac(""); setFormDisplay(""); setFormTypeId(""); setModalOpen(true); };
  const openEditModal = (d: Device) => { setEditing(d); setFormMac(d.macId); setFormDisplay(d.displayName ?? ""); setFormTypeId(d.deviceType?.id ? String(d.deviceType.id) : ""); setModalOpen(true); };
  const closeModal = () => { setModalOpen(false); setEditing(null); setFormMac(""); setFormDisplay(""); setFormTypeId(""); };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editing) {
      updateMutation.mutate({ macId: editing.macId, payload: { displayName: formDisplay || undefined } });
    } else {
      const payload: CreateDevicePayload = { macId: formMac, displayName: formDisplay || undefined, deviceTypeId: formTypeId ? Number(formTypeId) : undefined };
      addMutation.mutate(payload);
    }
  };

  const isMutating = addMutation.isPending || updateMutation.isPending;

  const columns: ColumnDef<Device>[] = [
    { accessorKey: "macId", header: "MAC Address" },
    { id: "model", header: "Model", cell: ({ row }) => row.original.deviceType?.name ?? "—" },
    { id: "displayName", header: "Display Name", cell: ({ row }) => (row.original.displayName as string | undefined) ?? "—" },
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
          <h1 className="text-2xl font-medium text-gray-900">Devices</h1>
          <p className="text-sm text-gray-500 mt-1">{devices.length} devices</p>
        </div>
        <button onClick={openAddModal} className="px-4 py-2 bg-[#1a73e8] text-white rounded-md hover:bg-[#1557b0] text-sm font-medium">Add Device</button>
      </div>
      {isLoading ? <div className="py-12 flex justify-center"><Loader variant="inline" label="Loading devices..." /></div> : (
        <DataTable columns={columns} data={devices} searchPlaceholder="Search devices..." />
      )}
      <Modal isOpen={modalOpen} onClose={closeModal} title={editing ? "Edit Device" : "Add Device"}>
        <form onSubmit={handleSubmit}>
          {!editing && <TextInput label="MAC Address" value={formMac} onChange={setFormMac} placeholder="e.g. AA:BB:CC:DD:EE:FF" required />}
          <TextInput label="Display Name" value={formDisplay} onChange={setFormDisplay} placeholder="e.g. Reception Desk" />
          {!editing && <TextInput label="Device Type ID" value={formTypeId} onChange={setFormTypeId} placeholder="Optional" type="number" />}
          {(addMutation.isError || updateMutation.isError) && (
            <p className="text-sm text-red-600 mb-2">{((addMutation.error || updateMutation.error) as Error)?.message ?? "Failed to save"}</p>
          )}
          <div className="flex justify-end gap-2 mt-4">
            <button type="button" onClick={closeModal} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200">Cancel</button>
            <button type="submit" disabled={isMutating} className="px-4 py-2 text-sm font-medium text-white bg-[#1a73e8] rounded-md hover:bg-[#1557b0] disabled:opacity-50">{isMutating ? "Saving..." : editing ? "Save" : "Add"}</button>
          </div>
        </form>
      </Modal>
      <ConfirmDialog isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.macId)} title="Remove Device" message={`Remove device ${deleteTarget?.macId}?`} />
    </div>
  );
}
