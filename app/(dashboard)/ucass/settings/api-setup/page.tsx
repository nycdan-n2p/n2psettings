"use client";
import { useTranslations } from "next-intl";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApp } from "@/contexts/AppContext";
import { qk } from "@/lib/query-keys";
import { getAuthApiClient } from "@/lib/api-client";
import { Loader } from "@/components/ui/Loader";
import { Copy, Trash2, Key, Plus, CheckCircle2, AlertTriangle, ShieldCheck } from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────
interface ApiKeyScope {
  id: number;
  name: string;
  displayName: string;
}

interface ApiKeyListItem {
  id: number;
  catalogId: number;
  name: string;
  usageType: number;
  subjectId: string;
  created: string;
  scopes: string[];
}

interface ApiKeyCreated extends ApiKeyListItem {
  key: string; // only returned at creation time
}

// ── API functions ─────────────────────────────────────────────────────────────
async function fetchApiKeys(): Promise<ApiKeyListItem[]> {
  const api = await getAuthApiClient();
  const res = await api.get<ApiKeyListItem[]>("/settings/api-keys");
  return Array.isArray(res.data) ? res.data : [];
}

async function fetchScopes(): Promise<ApiKeyScope[]> {
  const api = await getAuthApiClient();
  const res = await api.get<ApiKeyScope[]>("/scopes/public");
  return Array.isArray(res.data) ? res.data : [];
}

async function createApiKey(payload: { name: string; scopes: string[] }): Promise<ApiKeyCreated> {
  const api = await getAuthApiClient();
  const res = await api.post<ApiKeyCreated>("/settings/api-keys", payload);
  return res.data;
}

async function deleteApiKey(keyId: number): Promise<void> {
  const api = await getAuthApiClient();
  await api.delete(`/settings/api-keys/${keyId}`);
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function ApiSetupPage() {
  const t = useTranslations("apiSetupPage");
  const { bootstrap } = useApp();
  const accountId = bootstrap?.account?.accountId ?? 0;
  const queryClient = useQueryClient();

  const [newKeyName, setNewKeyName] = useState("");
  const [selectedScopes, setSelectedScopes] = useState<string[]>(["public_api.v2"]);
  const [justCreated, setJustCreated] = useState<ApiKeyCreated | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ApiKeyListItem | null>(null);

  const { data: keys = [], isLoading: keysLoading, error: keysError } = useQuery({
    queryKey: qk.apiKeys.all(accountId),
    queryFn: fetchApiKeys,
    enabled: !!accountId,
  });

  const { data: scopes = [], isLoading: scopesLoading } = useQuery({
    queryKey: ["auth-scopes"],
    queryFn: fetchScopes,
    enabled: !!accountId,
    staleTime: 1000 * 60 * 30, // scopes don't change often
  });

  const createMutation = useMutation({
    mutationFn: createApiKey,
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: qk.apiKeys.all(accountId) });
      setJustCreated(created);
      setNewKeyName("");
      setSelectedScopes(["public_api.v2"]);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteApiKey(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.apiKeys.all(accountId) });
      setDeleteTarget(null);
    },
  });

  const copyToClipboard = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const toggleScope = (scope: string) => {
    setSelectedScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]
    );
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-medium text-gray-900">API Setup</h1>
        <p className="text-sm text-gray-500 mt-1">
          Create and manage API keys for programmatic access to your net2phone account.
        </p>
      </div>

      {/* One-time key reveal banner */}
      {justCreated && (
        <div className="mb-6 bg-green-50 border border-green-300 rounded-[16px] p-5">
          <div className="flex items-start gap-3 mb-3">
            <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-green-800">API key created — copy it now!</p>
              <p className="text-xs text-green-700 mt-0.5">
                This key will <strong>not</strong> be shown again. Store it somewhere safe.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-white border border-green-200 rounded-lg px-4 py-2.5">
            <code className="flex-1 text-xs font-mono text-gray-800 break-all select-all">
              {justCreated.key}
            </code>
            <button
              onClick={() => copyToClipboard(justCreated.key, "new")}
              className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-md text-xs font-medium hover:bg-green-700"
            >
              <Copy className="w-3.5 h-3.5" />
              {copiedId === "new" ? t("copied") : t("copy")}
            </button>
          </div>
          <button
            onClick={() => setJustCreated(null)}
            className="text-xs text-green-700 underline mt-2"
          >
            I&apos;ve saved it, dismiss
          </button>
        </div>
      )}

      {/* Create new key */}
      <div className="rounded-[16px] p-5 mb-6">
        <h2 className="text-sm font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <Plus className="w-4 h-4 text-gray-400" />
          Create New API Key
        </h2>

        <div className="mb-4">
          <label className="block text-xs font-medium text-gray-600 mb-1.5">Key name</label>
          <input
            type="text"
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            placeholder="e.g. my-integration-key"
            className="w-full px-3 py-2 border border-[#dadce0] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#1a73e8]"
          />
        </div>

        {!scopesLoading && scopes.length > 0 && (
          <div className="mb-4">
            <label className="block text-xs font-medium text-gray-600 mb-2">Permission scopes</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {scopes.map((scope) => (
                <label
                  key={scope.name}
                  className={`flex items-start gap-2.5 px-3 py-2 rounded-[16px] cursor-pointer transition-colors ${
                    selectedScopes.includes(scope.name)
                      ? "bg-[#eceef4]"
                      : "bg-[#F9F9FB] hover:bg-[#f1f3f8]"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedScopes.includes(scope.name)}
                    onChange={() => toggleScope(scope.name)}
                    className="mt-0.5 accent-[#1a73e8]"
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-800">{scope.displayName}</p>
                    <p className="text-xs text-gray-400 font-mono">{scope.name}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>
        )}

        {createMutation.isError && (
          <div className="flex items-center gap-2 mb-3 text-sm text-red-600">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {(createMutation.error as Error)?.message ?? t("createError")}
          </div>
        )}

        <button
          onClick={() => createMutation.mutate({ name: newKeyName, scopes: selectedScopes })}
          disabled={createMutation.isPending || !newKeyName.trim() || selectedScopes.length === 0}
          className="flex items-center gap-2 px-4 py-2 bg-[#1a73e8] text-white rounded-md hover:bg-[#1557b0] text-sm font-medium disabled:opacity-50"
        >
          {createMutation.isPending ? <Loader variant="button" /> : <Key className="w-4 h-4" />}
          {createMutation.isPending ? t("creating") : t("createButton")}
        </button>
      </div>

      {/* Existing keys */}
      <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
        <ShieldCheck className="w-4 h-4 text-gray-400" />
        Existing Keys
      </h2>

      {keysLoading ? (
        <div className="py-8 flex justify-center">
          <Loader variant="inline" label={t("loading")} />
        </div>
      ) : keysError ? (
        <div className="flex items-center gap-2 text-sm text-red-600 py-4">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {(keysError as Error)?.message ?? t("loadError")}
        </div>
      ) : keys.length === 0 ? (
        <p className="text-sm text-gray-400 py-4">No API keys yet. Create one above.</p>
      ) : (
        <div className="bg-white rounded-[16px] border border-gray-200 divide-y divide-gray-100">
          {keys.map((k) => (
            <div key={k.id} className="flex items-start gap-4 px-5 py-4">
              <Key className="w-4 h-4 text-gray-300 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">{k.name}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Created {new Date(k.created).toLocaleDateString()} · ID {k.id}
                </p>
                {k.scopes.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {k.scopes.map((s) => (
                      <span
                        key={s}
                        className="text-xs px-2 py-0.5 bg-[#e8f0fe] text-[#1a73e8] rounded-full font-mono"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <button
                onClick={() => setDeleteTarget(k)}
                disabled={deleteMutation.isPending}
                className="p-1.5 rounded hover:bg-red-50 text-red-400 hover:text-red-600 transition-colors shrink-0"
                title="Revoke key"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Delete confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[16px] shadow-xl max-w-sm w-full p-6">
            <div className="flex items-start gap-3 mb-4">
              <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-gray-900">Revoke API key?</p>
                <p className="text-sm text-gray-500 mt-1">
                  &quot;{deleteTarget.name}&quot; will be permanently revoked. Any integrations using
                  this key will stop working immediately.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteMutation.mutate(deleteTarget.id)}
                disabled={deleteMutation.isPending}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50"
              >
                {deleteMutation.isPending ? t("revoking") : t("revokeButton")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
