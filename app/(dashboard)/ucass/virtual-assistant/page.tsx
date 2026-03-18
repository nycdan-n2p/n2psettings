"use client";
import { useTranslations } from "next-intl";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DataTable } from "@/components/tables/DataTable";
import { useApp } from "@/contexts/AppContext";
import { qk } from "@/lib/query-keys";
import { Loader } from "@/components/ui/Loader";
import {
  fetchVirtualAssistants,
  createVirtualAssistant,
  deleteVirtualAssistant,
  type WelcomeMenu,
  type CreateWelcomeMenuPayload,
} from "@/lib/api/virtual-assistant";
import { fetchAccountNumbers } from "@/lib/api/onboarding";
import type { ColumnDef } from "@tanstack/react-table";
import { Modal } from "@/components/settings/Modal";
import { TextInput } from "@/components/settings/TextInput";
import { ConfirmDialog } from "@/components/settings/ConfirmDialog";
import { Pencil, Phone, Play, Trash2 } from "lucide-react";

function formatPhone(num: string): string {
  const d = (num || "").replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("1")) {
    return `(${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
  }
  if (d.length === 10) {
    return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  }
  return num || "—";
}

const EMPTY_FORM: CreateWelcomeMenuPayload = { name: "", extension: "", languageCode: "en" };

const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
  { value: "pt", label: "Portuguese" },
];

export default function VirtualAssistantPage() {
  const t = useTranslations("virtualAssistantPage");
  const { bootstrap } = useApp();
  const accountId = bootstrap?.account?.accountId ?? 0;
  const queryClient = useQueryClient();
  const router = useRouter();

  const [modalOpen, setModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<WelcomeMenu | null>(null);
  const [form, setForm] = useState<CreateWelcomeMenuPayload>({ ...EMPTY_FORM });

  const { data: menus = [], isLoading } = useQuery({
    queryKey: qk.welcomeMenus.list(accountId),
    queryFn: () => fetchVirtualAssistants(accountId),
    enabled: !!accountId,
  });

  const { data: accountNumbers = [] } = useQuery({
    queryKey: qk.phoneNumbers.all(accountId),
    queryFn: () => fetchAccountNumbers(accountId),
    enabled: !!accountId,
  });

  const numbersByMenuId = useMemo(() => {
    const map = new Map<number, { phoneNumber: string; routesTo?: string }[]>();
    for (const n of accountNumbers) {
      const rt = String(n.routeType ?? "").toLowerCase();
      const isWelcomeMenu = rt === "welcomemenu" || rt === "welcome_menu" || rt.includes("welcome");
      if (!isWelcomeMenu) continue;
      const menuId = n.routeToId;
      if (menuId == null) continue;
      const id = typeof menuId === "number" ? menuId : parseInt(String(menuId), 10);
      if (isNaN(id)) continue;
      const arr = map.get(id) ?? [];
      arr.push({
        phoneNumber: n.phoneNumber ?? "",
        routesTo: n.routesTo ?? undefined,
      });
      map.set(id, arr);
    }
    return map;
  }, [accountNumbers]);

  const addMutation = useMutation({
    mutationFn: (payload: CreateWelcomeMenuPayload) => createVirtualAssistant(accountId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.welcomeMenus.all(accountId) });
      closeModal();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteVirtualAssistant(accountId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.welcomeMenus.all(accountId) });
      setDeleteTarget(null);
    },
  });

  const openAddModal = () => { setForm({ ...EMPTY_FORM }); setModalOpen(true); };
  const closeModal = () => { setModalOpen(false); setForm({ ...EMPTY_FORM }); };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addMutation.mutate(form);
  };

  const columns: ColumnDef<WelcomeMenu>[] = [
    {
      id: "name",
      header: t("colName"),
      accessorFn: (r) => r.name ?? "",
      cell: ({ row }) => {
        const m = row.original;
        return (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-[#1a73e8] text-white flex items-center justify-center text-xs font-semibold shrink-0">
              W
            </div>
            <span className="font-medium text-gray-900">{m.name ?? "—"}</span>
          </div>
        );
      },
    },
    { accessorKey: "extension", header: t("colExt"), cell: ({ row }) => row.original.extension ?? "—" },
    {
      id: "numbersAssigned",
      header: t("colNumbers"),
      cell: ({ row }) => {
        const m = row.original;
        const numbers = numbersByMenuId.get(m.id) ?? [];
        if (numbers.length === 0) {
          return <span className="text-gray-400">{t("unassigned")}</span>;
        }
        const first = numbers[0];
        return (
          <div className="flex items-center gap-2">
            <Phone className="w-4 h-4 text-[#1a73e8] shrink-0" />
            <div className="min-w-0">
              <span className="text-gray-900">{formatPhone(first.phoneNumber)}</span>
              <span className="text-xs text-gray-500 ml-1 truncate block">
                {first.routesTo ?? m.name ?? ""}{m.extension ? ` • ${m.extension}` : ""}
              </span>
            </div>
            {numbers.length > 1 && (
              <span className="shrink-0 px-1.5 py-0.5 text-xs font-medium bg-gray-200 text-gray-600 rounded-full">
                {numbers.length}+
              </span>
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
            onClick={() => router.push(`/ucass/virtual-assistant/${row.original.id}`)}
            className="p-1.5 rounded-full border border-gray-200 hover:bg-gray-100 text-gray-600"
            title="Play"
          >
            <Play className="w-4 h-4" />
          </button>
          <button
            onClick={() => router.push(`/ucass/virtual-assistant/${row.original.id}`)}
            className="p-1.5 rounded-full border border-gray-200 hover:bg-gray-100 text-gray-600"
            title="Edit"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={() => setDeleteTarget(row.original)}
            className="p-1.5 rounded-full border border-gray-200 hover:bg-red-50 text-red-600"
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
      <h1 className="text-2xl font-bold text-gray-900 mb-4">WELCOME MENUS</h1>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <span className="text-sm text-gray-600">Total: {menus.length}</span>
        <button
          onClick={openAddModal}
          className="px-4 py-2 bg-[#1a73e8] text-white rounded-md hover:bg-[#1557b0] text-sm font-medium"
        >
          ADD WELCOME MENU
        </button>
      </div>

      {isLoading ? (
        <div className="py-12 flex justify-center"><Loader variant="inline" label={t("loading")} /></div>
      ) : (
        <DataTable columns={columns} data={menus} searchPlaceholder={t("search")} />
      )}

      <Modal isOpen={modalOpen} onClose={closeModal} title={t("addTitle")}>
        <form onSubmit={handleSubmit}>
          <TextInput
            label="Name"
            value={form.name}
            onChange={(v) => setForm((f) => ({ ...f, name: v }))}
            placeholder="e.g. Main Menu"
            required
          />
          <TextInput
            label="Extension"
            value={form.extension ?? ""}
            onChange={(v) => setForm((f) => ({ ...f, extension: v }))}
            placeholder="e.g. 4000"
          />
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Language</label>
            <select
              value={form.languageCode ?? "en"}
              onChange={(e) => setForm((f) => ({ ...f, languageCode: e.target.value }))}
              className="w-full px-3 py-2 border border-[#dadce0] rounded-md text-sm"
            >
              {LANGUAGES.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
            </select>
          </div>
          {addMutation.isError && (
            <p className="text-sm text-red-600 mb-2">{(addMutation.error as Error)?.message ?? t("failedToSave")}</p>
          )}
          <div className="flex justify-end gap-2 mt-4">
            <button type="button" onClick={closeModal} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200">Cancel</button>
            <button type="submit" disabled={addMutation.isPending} className="px-4 py-2 text-sm font-medium text-white bg-[#1a73e8] rounded-md hover:bg-[#1557b0] disabled:opacity-50">
              {addMutation.isPending ? t("creating") : t("addButton")}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        title={t("deleteTitle")}
        message={`Delete welcome menu "${deleteTarget?.name}"?`}
      />
    </div>
  );
}
