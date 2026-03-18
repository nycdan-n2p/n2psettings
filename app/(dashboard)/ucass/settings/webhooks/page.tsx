"use client";
import { useTranslations } from "next-intl";

import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2, Plus, Webhook as WebhookIcon, Copy, Check, ExternalLink } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { qk } from "@/lib/query-keys";
import {
  fetchWebhooks,
  fetchWebhookEventTypes,
  createWebhook,
  deleteWebhook,
  type Webhook,
  type CreateWebhookPayload,
} from "@/lib/api/webhooks";
import { fetchTeamMembers } from "@/lib/api/team-members";
import { Modal } from "@/components/settings/Modal";

// ── Character-counted input ──────────────────────────────────────────────────

function CountedInput({
  label,
  value,
  onChange,
  max,
  placeholder,
  required,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  max: number;
  placeholder?: string;
  required?: boolean;
  type?: "text" | "url";
}) {
  return (
    <div className="mb-5">
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value.slice(0, max))}
        placeholder={placeholder}
        required={required}
        className="w-full px-3 py-2 border border-[#dadce0] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#1a73e8] focus:border-transparent"
      />
      <p className="text-right text-xs text-gray-400 mt-0.5">{value.length} / {max}</p>
    </div>
  );
}

function CountedTextarea({
  label,
  value,
  onChange,
  max,
  placeholder,
  optional,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  max: number;
  placeholder?: string;
  optional?: boolean;
}) {
  return (
    <div className="mb-5">
      <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5">
        {label}
        {optional && <span className="text-xs font-normal text-gray-400">Optional</span>}
      </label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value.slice(0, max))}
        placeholder={placeholder}
        rows={3}
        className="w-full px-3 py-2 border border-[#dadce0] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#1a73e8] focus:border-transparent resize-y"
      />
      <p className="text-right text-xs text-gray-400 mt-0.5">{value.length} / {max}</p>
    </div>
  );
}

// ── Radio group helper ───────────────────────────────────────────────────────

function RadioGroup<T extends string>({
  name,
  value,
  onChange,
  options,
}: {
  name: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; description?: string }[];
}) {
  return (
    <div className="space-y-3">
      {options.map((opt) => (
        <label key={opt.value} className="flex items-start gap-3 cursor-pointer group">
          <input
            type="radio"
            name={name}
            value={opt.value}
            checked={value === opt.value}
            onChange={() => onChange(opt.value)}
            className="mt-0.5 accent-[#1a73e8]"
          />
          <div>
            <span className="text-sm font-medium text-gray-800">{opt.label}</span>
            {opt.description && (
              <p className="text-xs text-gray-500 mt-0.5">{opt.description}</p>
            )}
          </div>
        </label>
      ))}
    </div>
  );
}

// ── Secret key badge ─────────────────────────────────────────────────────────

function SecretKeyBadge({ secretKey }: { secretKey?: string }) {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(async () => {
    if (!secretKey) return;
    await navigator.clipboard.writeText(secretKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [secretKey]);

  if (!secretKey) return null;
  return (
    <div className="flex items-center gap-2 mt-1">
      <code className="text-xs font-mono bg-gray-100 px-2 py-1 rounded text-gray-700 truncate max-w-[200px]">
        {secretKey}
      </code>
      <button
        onClick={copy}
        className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
        title="Copy secret key"
      >
        {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
      </button>
    </div>
  );
}

// ── Add Webhook Modal ────────────────────────────────────────────────────────

interface AddWebhookModalProps {
  isOpen: boolean;
  onClose: () => void;
  accountId: number;
  userId: number;
  eventTypes: string[];
}

function AddWebhookModal({ isOpen, onClose, accountId, userId, eventTypes }: AddWebhookModalProps) {
  const t = useTranslations("webhooksPage");
  const qc = useQueryClient();

  const [name, setName]               = useState("");
  const [url, setUrl]                 = useState("");
  const [description, setDescription] = useState("");
  const [eventsMode, setEventsMode]   = useState<"all" | "specific">("all");
  const [selectedEvents, setSelectedEvents] = useState<Set<string>>(new Set());
  const [usersMode, setUsersMode]     = useState<"all" | "specific">("all");
  const [selectedUsers, setSelectedUsers] = useState<Set<number>>(new Set());

  const { data: teamMembers = [] } = useQuery({
    queryKey: ["team-members", accountId],
    queryFn: () => fetchTeamMembers(accountId),
    enabled: isOpen && usersMode === "specific",
  });

  const mutation = useMutation({
    mutationFn: (payload: CreateWebhookPayload) =>
      createWebhook(accountId, userId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.webhooks.all(accountId, userId) });
      handleClose();
    },
  });

  function handleClose() {
    setName(""); setUrl(""); setDescription("");
    setEventsMode("all"); setSelectedEvents(new Set());
    setUsersMode("all"); setSelectedUsers(new Set());
    onClose();
  }

  function toggleEvent(et: string) {
    setSelectedEvents((prev) => {
      const next = new Set(prev);
      if (next.has(et)) { next.delete(et); } else { next.add(et); }
      return next;
    });
  }

  function toggleUser(uid: number) {
    setSelectedUsers((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) { next.delete(uid); } else { next.add(uid); }
      return next;
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    mutation.mutate({
      name,
      url,
      description: description || undefined,
      eventTypes: eventsMode === "all" ? ["*"] : Array.from(selectedEvents),
      userScope: usersMode,
      specificUserIds: usersMode === "specific" ? Array.from(selectedUsers) : undefined,
    });
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={t("addTitle")} size="lg">
      <form onSubmit={handleSubmit}>

        {/* Name */}
        <CountedInput
          label="Name"
          value={name}
          onChange={setName}
          max={100}
          placeholder="Webhook 1"
          required
        />

        {/* Destination URL */}
        <CountedInput
          label="Destination URL"
          value={url}
          onChange={setUrl}
          max={200}
          placeholder="https://example.com/webhook"
          required
          type="url"
        />

        {/* Description */}
        <CountedTextarea
          label="Description"
          value={description}
          onChange={setDescription}
          max={200}
          placeholder="What does this webhook do?"
          optional
        />

        {/* Events */}
        <div className="mb-5">
          <h3 className="text-base font-semibold text-gray-900 mb-1">Events</h3>
          <p className="text-sm text-gray-500 mb-3">
            Select which events should trigger this webhook.
          </p>
          <RadioGroup
            name="events-mode"
            value={eventsMode}
            onChange={setEventsMode}
            options={[
              { value: "all", label: t("allEvents") },
              { value: "specific", label: "Specific Events" },
            ]}
          />
          {eventsMode === "specific" && (
            <div className="mt-3 ml-7 space-y-2 max-h-48 overflow-y-auto border border-[#e8eaed] rounded-md p-3 bg-gray-50">
              {eventTypes.length === 0 && (
                <p className="text-sm text-gray-400">No event types available.</p>
              )}
              {eventTypes.map((et) => (
                <label key={et} className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedEvents.has(et)}
                    onChange={() => toggleEvent(et)}
                    className="accent-[#1a73e8] rounded"
                  />
                  <span className="text-sm text-gray-700">{et}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Users */}
        <div className="mb-5">
          <h3 className="text-base font-semibold text-gray-900 mb-1">Users</h3>
          <p className="text-sm text-gray-500 mb-3">
            Configure this webhook so that it&rsquo;s limited to events triggered by specific users.
          </p>
          <RadioGroup
            name="users-mode"
            value={usersMode}
            onChange={setUsersMode}
            options={[
              { value: "all", label: t("entireCompany") },
              { value: "specific", label: "Specific Team Members" },
            ]}
          />
          {usersMode === "specific" && (
            <div className="mt-3 ml-7 space-y-2 max-h-48 overflow-y-auto border border-[#e8eaed] rounded-md p-3 bg-gray-50">
              {teamMembers.length === 0 && (
                <p className="text-sm text-gray-400">Loading team members…</p>
              )}
              {teamMembers.map((m) => (
                <label key={m.userId} className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedUsers.has(m.userId)}
                    onChange={() => toggleUser(m.userId)}
                    className="accent-[#1a73e8] rounded"
                  />
                  <span className="text-sm text-gray-700">
                    {m.firstName} {m.lastName}
                    <span className="text-gray-400 ml-1">ext. {m.extension}</span>
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Secret key notice */}
        <div className="flex items-start gap-2.5 rounded-md bg-blue-50 border border-blue-100 px-3 py-3 mb-6">
          <span className="text-blue-500 mt-0.5 shrink-0">ⓘ</span>
          <p className="text-xs text-blue-700">
            <strong>Secret key</strong> will be auto-generated once the webhook is added.
            Use it to verify the authenticity of incoming payloads by comparing{" "}
            <code className="font-mono">X-Webhook-Signature</code> headers.
          </p>
        </div>

        {mutation.isError && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2 mb-4">
            Failed to create webhook. Please check the URL and try again.
          </p>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={mutation.isPending || !name.trim() || !url.trim() || (eventsMode === "specific" && selectedEvents.size === 0)}
            className="px-4 py-2 text-sm font-medium text-white bg-[#1a73e8] rounded-md hover:bg-[#1557b0] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {mutation.isPending ? t("adding") : t("addButton")}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ── Delete confirm modal ──────────────────────────────────────────────────────

function DeleteModal({
  webhook,
  onConfirm,
  onCancel,
  isPending,
}: {
  webhook: Webhook;
  onConfirm: () => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const t = useTranslations("webhooksPage");
  return (
    <Modal isOpen onClose={onCancel} title={t("deleteTitle")}>
      <p className="text-sm text-gray-600 mb-1">
        Are you sure you want to delete{" "}
        <strong>{webhook.name ?? webhook.url}</strong>?
      </p>
      <p className="text-sm text-gray-500 mb-6">
        This will immediately stop all event deliveries to this endpoint.
      </p>
      <div className="flex justify-end gap-2">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          disabled={isPending}
          className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50"
        >
          {isPending ? t("deleting") : t("common_delete")}
        </button>
      </div>
    </Modal>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function WebhooksPage() {
  const t = useTranslations("webhooksPage");
  const { bootstrap } = useApp();
  const accountId = bootstrap?.account?.accountId ?? 0;
  const userId    = bootstrap?.user?.userId ?? 0;
  const qc = useQueryClient();

  const [addOpen, setAddOpen]           = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Webhook | null>(null);

  const { data: webhooks = [], isLoading } = useQuery({
    queryKey: qk.webhooks.all(accountId, userId),
    queryFn:  () => fetchWebhooks(accountId, userId),
    enabled:  !!accountId && !!userId,
  });

  const { data: eventTypes = [] } = useQuery({
    queryKey: qk.webhooks.eventTypes(accountId, userId),
    queryFn:  () => fetchWebhookEventTypes(accountId, userId),
    enabled:  !!accountId && !!userId,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteWebhook(accountId, userId, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.webhooks.all(accountId, userId) });
      setDeleteTarget(null);
    },
  });

  function eventsLabel(wh: Webhook) {
    const types = wh.eventTypes ?? [];
    if (types.includes("*") || types.length === 0) return t("allEvents");
    if (types.length <= 2) return types.join(", ");
    return `${types.slice(0, 2).join(", ")} +${types.length - 2} more`;
  }

  function usersLabel(wh: Webhook) {
    if (!wh.userScope || wh.userScope === "all") return t("entireCompany");
    const count = wh.specificUserIds?.length ?? 0;
    return `${count} team member${count !== 1 ? "s" : ""}`;
  }

  return (
    <div className="max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-medium text-gray-900">{t("title")}</h1>
          <p className="text-sm text-gray-500 mt-1">
            Receive real-time HTTP POST notifications when events occur in your account.{" "}
            <a
              href="https://support.net2phone.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#1a73e8] hover:underline inline-flex items-center gap-0.5"
            >
              Learn more <ExternalLink className="w-3 h-3" />
            </a>
          </p>
        </div>
        <button
          onClick={() => setAddOpen(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-[#1a73e8] text-white rounded-md hover:bg-[#1557b0] text-sm font-medium shrink-0"
        >
          <Plus className="w-4 h-4" />
          Add Webhook
        </button>
      </div>

      {/* Webhook list */}
      {isLoading ? (
        <div className="py-12 text-center text-gray-400 text-sm">Loading…</div>
      ) : webhooks.length === 0 ? (
        <div className="py-16 flex flex-col items-center gap-3 text-center border-2 border-dashed border-[#e8eaed] rounded-xl">
          <div className="w-12 h-12 bg-[#e8f0fe] rounded-full flex items-center justify-center">
            <WebhookIcon className="w-6 h-6 text-[#1a73e8]" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-700">No webhooks configured</p>
            <p className="text-xs text-gray-400 mt-0.5">Add a webhook to start receiving event notifications.</p>
          </div>
          <button
            onClick={() => setAddOpen(true)}
            className="mt-1 px-4 py-2 text-sm font-medium text-[#1a73e8] border border-[#1a73e8] rounded-md hover:bg-[#e8f0fe] transition-colors"
          >
            Add your first webhook
          </button>
        </div>
      ) : (
        <div className="divide-y divide-[#e8eaed] border border-[#e8eaed] rounded-xl overflow-hidden">
          {webhooks.map((wh, i) => (
            <div key={wh.id ?? i} className="flex items-start justify-between px-5 py-4 bg-white hover:bg-[#f8f9fa] transition-colors group">
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-8 h-8 rounded-full bg-[#e8f0fe] flex items-center justify-center shrink-0 mt-0.5">
                  <WebhookIcon className="w-4 h-4 text-[#1a73e8]" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {wh.name ?? "Unnamed webhook"}
                  </p>
                  <a
                    href={wh.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-[#1a73e8] hover:underline truncate block max-w-sm"
                  >
                    {wh.url}
                  </a>
                  {wh.description && (
                    <p className="text-xs text-gray-500 mt-0.5 truncate max-w-sm">{wh.description}</p>
                  )}
                  <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-[#e8f0fe] text-[#1a73e8] font-medium">
                      {eventsLabel(wh)}
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-600">
                      {usersLabel(wh)}
                    </span>
                  </div>
                  {wh.secretKey && <SecretKeyBadge secretKey={wh.secretKey} />}
                </div>
              </div>
              <button
                onClick={() => setDeleteTarget(wh)}
                className="p-1.5 rounded-full text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100 shrink-0 ml-4"
                title="Delete webhook"
                aria-label="Delete webhook"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add modal */}
      <AddWebhookModal
        isOpen={addOpen}
        onClose={() => setAddOpen(false)}
        accountId={accountId}
        userId={userId}
        eventTypes={eventTypes}
      />

      {/* Delete confirm */}
      {deleteTarget && (
        <DeleteModal
          webhook={deleteTarget}
          onConfirm={() => deleteTarget.id !== undefined && deleteMutation.mutate(deleteTarget.id)}
          onCancel={() => setDeleteTarget(null)}
          isPending={deleteMutation.isPending}
        />
      )}
    </div>
  );
}
