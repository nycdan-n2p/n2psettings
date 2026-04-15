"use client";
import { useTranslations } from "next-intl";

import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useApp } from "@/contexts/AppContext";
import { Loader } from "@/components/ui/Loader";
import { SegmentedTabs } from "@/components/ui/SegmentedTabs";
import { Button } from "@/components/ui/Button";
import {
  fetchDeviceTemplates,
  type DeviceTemplate,
} from "@/lib/api/devices";
import { Modal } from "@/components/settings/Modal";
import { ConfirmDialog } from "@/components/settings/ConfirmDialog";
import {
  Settings2,
  LayoutGrid,
  Search,
  Plus,
  Eye,
  Copy,
  Pencil,
  Trash2,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

// ── Constants ─────────────────────────────────────────────────────────────────
const PAGE_SIZE = 10;

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Classify a template as company-default, company-custom, or personal */
function templateCategory(t: DeviceTemplate): "default" | "company" | "personal" {
  if (t.isDefault) return "default";
  if (t.isCompany) return "company";
  return "personal";
}

// ── Sub-components ────────────────────────────────────────────────────────────

interface TemplateBadgeProps {
  template: DeviceTemplate;
}
function TemplateBadge({ template }: TemplateBadgeProps) {
  const cat = templateCategory(template);
  if (cat === "default") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-[#5f6368] bg-[#f1f3f4] px-2 py-0.5 rounded-full">
        <Settings2 className="w-3 h-3" /> System Default
      </span>
    );
  }
  return null;
}

interface TemplateRowProps {
  template: DeviceTemplate;
  onView: (t: DeviceTemplate) => void;
  onClone: (t: DeviceTemplate) => void;
  onEdit: (t: DeviceTemplate) => void;
  onDelete: (t: DeviceTemplate) => void;
  onReboot: (t: DeviceTemplate) => void;
}
function TemplateRow({ template, onView, onClone, onEdit, onDelete, onReboot }: TemplateRowProps) {
  const t = useTranslations("deviceManagementPage");
  const [hovered, setHovered] = useState(false);
  const cat = templateCategory(template);
  const isDefault = cat === "default";

  return (
    <tr
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Icon + Name */}
      <td>
        <div className="flex items-center gap-3 min-w-0">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isDefault ? "bg-[#e8eaed]" : "bg-[#e8f0fe]"}`}>
          {isDefault
            ? <Settings2 className="w-4 h-4 text-[#5f6368]" />
            : <LayoutGrid className="w-4 h-4 text-[#1a73e8]" />
          }
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-900 truncate">
              {template.name}
            </span>
            <TemplateBadge template={template} />
          </div>
          {template.id && (
            <span className="text-xs text-gray-400">ID: {template.id}</span>
          )}
        </div>
        </div>
      </td>

      {/* Device Type */}
      <td className="w-[220px]">
        <span className="text-sm text-gray-700">
          {template.deviceName ?? "—"}
        </span>
      </td>

      {/* Device Count */}
      <td className="w-[180px] text-center">
        {template.deviceCount != null && template.deviceCount > 0 ? (
          <button className="text-sm text-[#1a73e8] hover:underline font-medium">
            {template.deviceCount} device{template.deviceCount !== 1 ? "s" : ""}
          </button>
        ) : (
          <span className="text-sm text-gray-400">—</span>
        )}
      </td>

      {/* Reboot */}
      <td className="w-[120px]">
        <div className="flex justify-center">
        <button
          onClick={() => onReboot(template)}
          title={t("rebootAllTooltip")}
          className={`p-1.5 rounded-md transition-all ${
            hovered
              ? "text-[#5f6368] hover:bg-[#e8eaed] hover:text-gray-900"
              : "text-transparent"
          }`}
        >
          <RotateCcw className="w-4 h-4" />
        </button>
        </div>
      </td>

      {/* Actions */}
      <td className="w-[180px]">
        <div className="flex items-center justify-end gap-1">
        <button
          onClick={() => onView(template)}
          title={t("viewTooltip")}
          className={`p-1.5 rounded-md transition-all ${
            hovered
              ? "text-[#1a73e8] hover:bg-[#e8f0fe]"
              : "text-transparent"
          }`}
        >
          <Eye className="w-4 h-4" />
        </button>
        {!isDefault && (
          <>
            <button
              onClick={() => onClone(template)}
              title={t("cloneTooltip")}
              className={`p-1.5 rounded-md transition-all ${
                hovered
                  ? "text-[#5f6368] hover:bg-[#e8eaed] hover:text-gray-900"
                  : "text-transparent"
              }`}
            >
              <Copy className="w-4 h-4" />
            </button>
            <button
              onClick={() => onEdit(template)}
              title={t("editTooltip")}
              className={`p-1.5 rounded-md transition-all ${
                hovered
                  ? "text-[#5f6368] hover:bg-[#e8eaed] hover:text-gray-900"
                  : "text-transparent"
              }`}
            >
              <Pencil className="w-4 h-4" />
            </button>
            <button
              onClick={() => onDelete(template)}
              title={t("deleteTooltip")}
              className={`p-1.5 rounded-md transition-all ${
                hovered
                  ? "text-red-400 hover:bg-red-50 hover:text-red-600"
                  : "text-transparent"
              }`}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </>
        )}
        </div>
      </td>
    </tr>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function DeviceManagementPage() {
  const t = useTranslations("deviceManagementPage");
  const { bootstrap } = useApp();
  const accountId = bootstrap?.account?.accountId ?? 0;
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<"company" | "personal">("company");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);

  // Modal states
  const [viewTemplate, setViewTemplate] = useState<DeviceTemplate | null>(null);
  const [editTemplate, setEditTemplate] = useState<DeviceTemplate | null>(null);
  const [cloneTarget, setCloneTarget] = useState<DeviceTemplate | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeviceTemplate | null>(null);
  const [rebootTarget, setRebootTarget] = useState<DeviceTemplate | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  // New template form state
  const [newTemplateName, setNewTemplateName] = useState("");

  // ── Data ──────────────────────────────────────────────────────────────────
  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["device-templates", accountId],
    queryFn: () => fetchDeviceTemplates(accountId),
    enabled: !!accountId,
    staleTime: 2 * 60 * 1000,
  });

  // Split into company (default + company-custom) and personal
  const { companyTemplates, personalTemplates } = useMemo(() => {
    const company: DeviceTemplate[] = [];
    const personal: DeviceTemplate[] = [];
    for (const t of templates) {
      if (t.isCompany || t.isDefault) {
        company.push(t);
      } else {
        personal.push(t);
      }
    }
    // Sort: defaults first, then alphabetical
    company.sort((a, b) => {
      if (a.isDefault && !b.isDefault) return -1;
      if (!a.isDefault && b.isDefault) return 1;
      return String(a.name).localeCompare(String(b.name));
    });
    personal.sort((a, b) => String(a.name).localeCompare(String(b.name)));
    return { companyTemplates: company, personalTemplates: personal };
  }, [templates]);

  const activeList = activeTab === "company" ? companyTemplates : personalTemplates;

  const filtered = useMemo(() => {
    if (!search.trim()) return activeList;
    const q = search.toLowerCase();
    return activeList.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        (t.deviceName ?? "").toLowerCase().includes(q)
    );
  }, [activeList, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  // Reset page when tab or search changes
  const handleTabChange = (tab: "company" | "personal") => {
    setActiveTab(tab);
    setPage(0);
    setSearch("");
  };

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleRebootConfirm = () => {
    // Actual reboot-all for a template would need a separate API call
    setRebootTarget(null);
  };

  const handleDeleteConfirm = () => {
    // Would call deleteDeviceTemplate API
    setDeleteTarget(null);
    queryClient.invalidateQueries({ queryKey: ["device-templates", accountId] });
  };

  const handleCloneConfirm = () => {
    // Would call cloneDeviceTemplate API
    setCloneTarget(null);
    queryClient.invalidateQueries({ queryKey: ["device-templates", accountId] });
  };

  return (
    <div>
      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-medium text-gray-900">{t("title")}</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage provisioning templates for desk phones and other devices.
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#1a73e8] text-white text-sm font-medium rounded-md hover:bg-[#1557b0] transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Template
        </button>
      </div>

      {/* ── Tabs ─────────────────────────────────────────────────────────── */}
      <div className="mb-4">
        <SegmentedTabs
          value={activeTab}
          onChange={handleTabChange}
          className="w-full max-w-[760px]"
          options={(["company", "personal"] as const).map((tab) => {
            const count = tab === "company" ? companyTemplates.length : personalTemplates.length;
            const label = tab === "company" ? t("tabCompany") : t("tabPersonal");
            return {
              value: tab,
              label: (
                <span className="inline-flex items-center gap-2 whitespace-nowrap">
                  {label}
                  <span className="text-xs rounded-full px-1.5 py-0.5 bg-[rgba(167,167,190,0.2)] text-gray-700">
                    {isLoading ? "…" : count}
                  </span>
                </span>
              ),
            };
          })}
        />
      </div>

      {isLoading ? (
        <div className="py-12 flex justify-center">
          <Loader variant="inline" label={t("loading")} />
        </div>
      ) : (
        <>
          {/* ── Search ────────────────────────────────────────────────────── */}
          <div className="flex items-center gap-3 mb-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <input
                type="text"
                placeholder={t("search")}
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                className="w-full pl-9 pr-3 py-2 text-sm border border-[#dadce0] rounded-full focus:outline-none focus:ring-2 focus:ring-[#1a73e8] focus:border-transparent bg-white"
              />
            </div>
            {search && (
              <span className="text-xs text-gray-500">
                {filtered.length} result{filtered.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>

          {/* ── Table ─────────────────────────────────────────────────────── */}
          {filtered.length === 0 ? (
            <div className="py-16 text-center text-gray-400">
              <LayoutGrid className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm font-medium text-gray-500">
                {search ? t("noTemplatesSearch") : t("noTemplates")}
              </p>
              {!search && (
                <p className="text-xs text-gray-400 mt-1">
                  Add a template to start provisioning devices.
                </p>
              )}
            </div>
          ) : (
            <div className="rounded-lg bg-white">
              <div className="overflow-x-auto">
                <table className="n2p-table w-full text-sm">
                  <thead>
                    <tr>
                      <th>{t("colTemplateName")}</th>
                      <th>{t("colDeviceType")}</th>
                      <th className="text-center">{t("colAssignedDevices")}</th>
                      <th className="text-center">{t("colReboot")}</th>
                      <th className="text-right">{t("colActions")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginated.map((template) => (
                      <TemplateRow
                        key={String(template.id)}
                        template={template}
                        onView={setViewTemplate}
                        onClone={setCloneTarget}
                        onEdit={setEditTemplate}
                        onDelete={setDeleteTarget}
                        onReboot={setRebootTarget}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Pagination ─────────────────────────────────────────────────── */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-xs text-gray-500">
                Showing {page * PAGE_SIZE + 1}–
                {Math.min((page + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="p-1.5 rounded-md text-gray-600 hover:bg-[#e8eaed] disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                  const pageIdx = totalPages <= 7 ? i : page < 4 ? i : page > totalPages - 4 ? totalPages - 7 + i : page - 3 + i;
                  return (
                    <button
                      key={pageIdx}
                      onClick={() => setPage(pageIdx)}
                      className={`w-8 h-8 text-xs rounded-md transition-colors ${
                        page === pageIdx
                          ? "bg-[#1a73e8] text-white font-medium"
                          : "text-gray-600 hover:bg-[#e8eaed]"
                      }`}
                    >
                      {pageIdx + 1}
                    </button>
                  );
                })}
                <button
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="p-1.5 rounded-md text-gray-600 hover:bg-[#e8eaed] disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── View Template Modal ───────────────────────────────────────────── */}
      <Modal
        isOpen={!!viewTemplate}
        title={viewTemplate?.name ?? ""}
        onClose={() => setViewTemplate(null)}
      >
        {viewTemplate && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1">Template name</p>
                <p className="text-gray-900">{viewTemplate.name}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1">Device type</p>
                <p className="text-gray-900">{viewTemplate.deviceName ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1">Device count</p>
                <p className="text-gray-900">{viewTemplate.deviceCount ?? 0} device{viewTemplate.deviceCount !== 1 ? "s" : ""}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1">Type</p>
                <p className="text-gray-900">
                  {viewTemplate.isDefault ? t("systemDefault") : viewTemplate.isCompany ? "Company" : "Personal"}
                </p>
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <Button
                onClick={() => setViewTemplate(null)}
                variant="secondary"
              >
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Edit Template Modal ───────────────────────────────────────────── */}
      <Modal
        isOpen={!!editTemplate}
        title={editTemplate ? `Edit Template: ${editTemplate.name}` : "Edit Template"}
        onClose={() => setEditTemplate(null)}
      >
        {editTemplate && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Template Name
              </label>
              <input
                type="text"
                defaultValue={editTemplate.name}
                className="w-full px-3 py-2 text-sm border border-[#dadce0] rounded-md focus:outline-none focus:ring-2 focus:ring-[#1a73e8]"
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button
                onClick={() => setEditTemplate(null)}
                variant="secondary"
              >
                Cancel
              </Button>
              <button
                onClick={() => setEditTemplate(null)}
                className="px-4 py-2 text-sm font-medium text-white bg-[#1a73e8] hover:bg-[#1557b0] rounded-md transition-colors"
              >
                Save Changes
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Add Template Modal ────────────────────────────────────────────── */}
      <Modal
        isOpen={showAddModal}
        title={t("addTemplate")}
        onClose={() => { setShowAddModal(false); setNewTemplateName(""); }}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Template Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Executive Phone Template"
              value={newTemplateName}
              onChange={(e) => setNewTemplateName(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-[#dadce0] rounded-md focus:outline-none focus:ring-2 focus:ring-[#1a73e8]"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Template Type
            </label>
            <select className="w-full px-3 py-2 text-sm border border-[#dadce0] rounded-md focus:outline-none focus:ring-2 focus:ring-[#1a73e8] bg-white">
              <option value="personal">{t("optPersonal")}</option>
              <option value="company">{t("optCompany")}</option>
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button
              onClick={() => { setShowAddModal(false); setNewTemplateName(""); }}
              variant="secondary"
            >
              Cancel
            </Button>
            <button
              disabled={!newTemplateName.trim()}
              onClick={() => {
                // Would call createDeviceTemplate API
                setShowAddModal(false);
                setNewTemplateName("");
                queryClient.invalidateQueries({ queryKey: ["device-templates", accountId] });
              }}
              className="px-4 py-2 text-sm font-medium text-white bg-[#1a73e8] hover:bg-[#1557b0] rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Create Template
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Clone Confirm Dialog ──────────────────────────────────────────── */}
      <ConfirmDialog
        isOpen={!!cloneTarget}
        title={t("cloneTemplate")}
        message={cloneTarget ? `Clone "${cloneTarget.name}"? A copy will be created that you can customize.` : ""}
        confirmLabel={t("clone")}
        variant="default"
        onConfirm={handleCloneConfirm}
        onClose={() => setCloneTarget(null)}
      />

      {/* ── Reboot Confirm Dialog ─────────────────────────────────────────── */}
      <ConfirmDialog
        isOpen={!!rebootTarget}
        title={t("rebootAllTitle")}
        message={rebootTarget ? `Reboot all devices using the "${rebootTarget.name}" template? This will temporarily interrupt service on ${rebootTarget.deviceCount ?? 0} device${rebootTarget.deviceCount !== 1 ? "s" : ""}.` : ""}
        confirmLabel={t("rebootAllConfirm")}
        variant="danger"
        onConfirm={handleRebootConfirm}
        onClose={() => setRebootTarget(null)}
      />

      {/* ── Delete Confirm Dialog ─────────────────────────────────────────── */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        title={t("deleteTemplate")}
        message={deleteTarget ? `Are you sure you want to delete "${deleteTarget.name}"? This action cannot be undone.` : ""}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleDeleteConfirm}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}
