"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApp } from "@/contexts/AppContext";
import { qk } from "@/lib/query-keys";
import { getApiClient } from "@/lib/api-client";
import { DataTable } from "@/components/tables/DataTable";
import { Modal } from "@/components/settings/Modal";
import { TextInput } from "@/components/settings/TextInput";
import { ConfirmDialog } from "@/components/settings/ConfirmDialog";
import { Loader } from "@/components/ui/Loader";
import { Pencil, Trash2 } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";

interface E911Contact {
  id: number;
  name: string;
  phone: string;
  email?: string;
}

async function fetchE911Contacts(accountId: number): Promise<E911Contact[]> {
  const api = await getApiClient();
  const res = await api.get<{ data?: E911Contact[] }>(`/accounts/${accountId}/e911contacts`);
  return Array.isArray(res.data.data) ? res.data.data : [];
}
async function createE911Contact(accountId: number, payload: Omit<E911Contact, "id">): Promise<E911Contact> {
  const api = await getApiClient();
  const res = await api.post<{ data: E911Contact }>(`/accounts/${accountId}/e911contacts`, payload);
  return res.data.data;
}
async function updateE911Contact(accountId: number, id: number, payload: Partial<Omit<E911Contact, "id">>): Promise<E911Contact> {
  const api = await getApiClient();
  const res = await api.put<{ data: E911Contact }>(`/accounts/${accountId}/e911contacts/${id}`, payload);
  return res.data.data;
}
async function deleteE911Contact(accountId: number, id: number): Promise<void> {
  const api = await getApiClient();
  await api.delete(`/accounts/${accountId}/e911contacts/${id}`);
}

const EMPTY = { name: "", phone: "", email: "" };

export default function E911ContactsPage() {
  const { bootstrap } = useApp();
  const accountId = bootstrap?.account?.accountId ?? 0;
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<E911Contact | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<E911Contact | null>(null);
  const [form, setForm] = useState(EMPTY);

  const { data: contacts = [], isLoading } = useQuery({
    queryKey: qk.e911.all(accountId),
    queryFn: () => fetchE911Contacts(accountId),
    enabled: !!accountId,
  });

  const addMutation = useMutation({
    mutationFn: (p: typeof EMPTY) => createE911Contact(accountId, p),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: qk.e911.all(accountId) }); closeModal(); },
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: typeof EMPTY }) => updateE911Contact(accountId, id, payload),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: qk.e911.all(accountId) }); closeModal(); },
  });
  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteE911Contact(accountId, id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: qk.e911.all(accountId) }); setDeleteTarget(null); },
  });

  const openAdd = () => { setEditing(null); setForm(EMPTY); setModalOpen(true); };
  const openEdit = (c: E911Contact) => { setEditing(c); setForm({ name: c.name, phone: c.phone, email: c.email ?? "" }); setModalOpen(true); };
  const closeModal = () => { setModalOpen(false); setEditing(null); setForm(EMPTY); };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editing) updateMutation.mutate({ id: editing.id, payload: form });
    else addMutation.mutate(form);
  };

  const columns: ColumnDef<E911Contact>[] = [
    { accessorKey: "name", header: "Name" },
    { accessorKey: "phone", header: "Phone" },
    { id: "email", header: "Email", cell: ({ row }) => row.original.email ?? "—" },
    {
      id: "actions", header: "",
      cell: ({ row }) => (
        <div className="flex gap-2">
          <button onClick={() => openEdit(row.original)} className="p-1.5 rounded hover:bg-gray-100 text-gray-600"><Pencil className="w-4 h-4" /></button>
          <button onClick={() => setDeleteTarget(row.original)} className="p-1.5 rounded hover:bg-red-50 text-red-600"><Trash2 className="w-4 h-4" /></button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-medium text-gray-900">911 Contacts</h1>
          <p className="text-sm text-gray-500 mt-1">Emergency notification contacts for your account.</p>
        </div>
        <button onClick={openAdd} className="px-4 py-2 bg-[#1a73e8] text-white rounded-md hover:bg-[#1557b0] text-sm font-medium">Add Contact</button>
      </div>
      {isLoading ? <div className="py-12 flex justify-center"><Loader variant="inline" label="Loading contacts..." /></div> : (
        <DataTable columns={columns} data={contacts} searchPlaceholder="Search contacts..." />
      )}
      <Modal isOpen={modalOpen} onClose={closeModal} title={editing ? "Edit 911 Contact" : "Add 911 Contact"}>
        <form onSubmit={handleSubmit}>
          <TextInput label="Name" value={form.name} onChange={(v) => setForm((f) => ({ ...f, name: v }))} placeholder="Full name" required />
          <TextInput label="Phone" value={form.phone} onChange={(v) => setForm((f) => ({ ...f, phone: v }))} type="tel" placeholder="+1 (555) 000-0000" required />
          <TextInput label="Email" value={form.email} onChange={(v) => setForm((f) => ({ ...f, email: v }))} type="email" placeholder="contact@example.com" />
          <div className="flex justify-end gap-2 mt-4">
            <button type="button" onClick={closeModal} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200">Cancel</button>
            <button type="submit" disabled={addMutation.isPending || updateMutation.isPending} className="px-4 py-2 text-sm font-medium text-white bg-[#1a73e8] rounded-md hover:bg-[#1557b0] disabled:opacity-50">
              {(addMutation.isPending || updateMutation.isPending) ? "Saving..." : editing ? "Save" : "Add"}
            </button>
          </div>
        </form>
      </Modal>
      <ConfirmDialog isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)} title="Remove 911 Contact" message={`Remove ${deleteTarget?.name} from emergency contacts?`} />
    </div>
  );
}
