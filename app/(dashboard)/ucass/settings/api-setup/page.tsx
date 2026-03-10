"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApp } from "@/contexts/AppContext";
import { qk } from "@/lib/query-keys";
import { getApiClient } from "@/lib/api-client";
import { Loader } from "@/components/ui/Loader";
import { Copy, Eye, EyeOff, RefreshCw, Trash2 } from "lucide-react";

interface ApiKey {
  id: string;
  key: string;
  name?: string;
  createdAt?: string;
}

async function fetchApiKeys(accountId: number): Promise<ApiKey[]> {
  const api = await getApiClient();
  const res = await api.get<{ data?: ApiKey[] }>(`/accounts/${accountId}/apikeys`);
  return Array.isArray(res.data.data) ? res.data.data : [];
}
async function generateApiKey(accountId: number, name?: string): Promise<ApiKey> {
  const api = await getApiClient();
  const res = await api.post<{ data: ApiKey }>(`/accounts/${accountId}/apikeys`, { name });
  return res.data.data;
}
async function revokeApiKey(accountId: number, keyId: string): Promise<void> {
  const api = await getApiClient();
  await api.delete(`/accounts/${accountId}/apikeys/${keyId}`);
}

export default function ApiSetupPage() {
  const { bootstrap } = useApp();
  const accountId = bootstrap?.account?.accountId ?? 0;
  const queryClient = useQueryClient();
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState<string | null>(null);
  const [newKeyName, setNewKeyName] = useState("");

  const { data: keys = [], isLoading } = useQuery({
    queryKey: qk.apiKeys.all(accountId),
    queryFn: () => fetchApiKeys(accountId),
    enabled: !!accountId,
  });

  const generateMutation = useMutation({
    mutationFn: () => generateApiKey(accountId, newKeyName || undefined),
    onSuccess: (newKey) => {
      queryClient.invalidateQueries({ queryKey: qk.apiKeys.all(accountId) });
      setNewKeyName("");
      setRevealed((prev) => { const next = new Set(prev); next.add(newKey.id); return next; });
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => revokeApiKey(accountId, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.apiKeys.all(accountId) }),
  });

  const toggleReveal = (id: string) => {
    setRevealed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const copyKey = async (key: string, id: string) => {
    await navigator.clipboard.writeText(key);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const maskKey = (key: string) => key.slice(0, 8) + "••••••••••••••••" + key.slice(-4);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-medium text-gray-900">API Setup</h1>
        <p className="text-sm text-gray-500 mt-1">Manage API keys for programmatic access to your account.</p>
      </div>

      {/* Generate new key */}
      <div className="bg-white rounded-lg border border-[#dadce0] p-5 mb-6">
        <h2 className="text-sm font-medium text-gray-700 mb-3">Generate New API Key</h2>
        <div className="flex gap-3">
          <input value={newKeyName} onChange={(e) => setNewKeyName(e.target.value)} placeholder="Key name (optional)" className="flex-1 px-3 py-2 border border-[#dadce0] rounded-md text-sm" />
          <button onClick={() => generateMutation.mutate()} disabled={generateMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-[#1a73e8] text-white rounded-md hover:bg-[#1557b0] text-sm font-medium disabled:opacity-50">
            <RefreshCw className="w-4 h-4" />
            {generateMutation.isPending ? "Generating..." : "Generate Key"}
          </button>
        </div>
        {generateMutation.isError && <p className="text-sm text-red-600 mt-2">{(generateMutation.error as Error)?.message ?? "Failed to generate key"}</p>}
      </div>

      {/* Key list */}
      {isLoading ? (
        <div className="py-8 flex justify-center"><Loader variant="inline" label="Loading API keys..." /></div>
      ) : keys.length === 0 ? (
        <p className="text-sm text-gray-500">No API keys yet.</p>
      ) : (
        <div className="bg-white rounded-lg border border-[#dadce0] divide-y divide-[#dadce0]">
          {keys.map((k) => (
            <div key={k.id} className="flex items-center justify-between px-4 py-3">
              <div className="flex-1 min-w-0 mr-4">
                {k.name && <p className="text-sm font-medium text-gray-900 mb-0.5">{k.name}</p>}
                <code className="text-xs font-mono text-gray-600 break-all">
                  {revealed.has(k.id) ? k.key : maskKey(k.key)}
                </code>
                {k.createdAt && <p className="text-xs text-gray-400 mt-0.5">Created {new Date(k.createdAt).toLocaleDateString()}</p>}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => toggleReveal(k.id)} className="p-1.5 rounded hover:bg-gray-100 text-gray-600" title={revealed.has(k.id) ? "Hide" : "Reveal"}>
                  {revealed.has(k.id) ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
                <button onClick={() => copyKey(k.key, k.id)} className="p-1.5 rounded hover:bg-gray-100 text-gray-600" title="Copy">
                  <Copy className="w-4 h-4" />
                </button>
                {copied === k.id && <span className="text-xs text-green-600 ml-1">Copied!</span>}
                <button onClick={() => revokeMutation.mutate(k.id)} disabled={revokeMutation.isPending} className="p-1.5 rounded hover:bg-red-50 text-red-600 ml-1">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
