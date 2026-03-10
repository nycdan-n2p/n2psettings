"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useApp } from "@/contexts/AppContext";
import { qk } from "@/lib/query-keys";
import { getApiClient } from "@/lib/api-client";
import { Loader } from "@/components/ui/Loader";
import { TextInput } from "@/components/settings/TextInput";

interface SsoConfig {
  enabled: boolean;
  entityId?: string;
  ssoUrl?: string;
  certificate?: string;
  forceSSO?: boolean;
}

async function fetchSsoConfig(accountId: number): Promise<SsoConfig> {
  const api = await getApiClient();
  const res = await api.get<{ data?: SsoConfig }>(`/accounts/${accountId}/sso`);
  return (res.data.data ?? { enabled: false }) as SsoConfig;
}
async function updateSsoConfig(accountId: number, payload: SsoConfig): Promise<SsoConfig> {
  const api = await getApiClient();
  const res = await api.put<{ data: SsoConfig }>(`/accounts/${accountId}/sso`, payload);
  return res.data.data;
}

export default function SsoPage() {
  const { bootstrap } = useApp();
  const accountId = bootstrap?.account?.accountId ?? 0;
  const [form, setForm] = useState<SsoConfig>({ enabled: false });
  const [saved, setSaved] = useState(false);

  const { data: config, isLoading } = useQuery({
    queryKey: qk.sso.all(accountId),
    queryFn: () => fetchSsoConfig(accountId),
    enabled: !!accountId,
  });

  useEffect(() => { if (config) setForm(config); }, [config]);

  const mutation = useMutation({
    mutationFn: (payload: SsoConfig) => updateSsoConfig(accountId, payload),
    onSuccess: () => { setSaved(true); setTimeout(() => setSaved(false), 2500); },
  });

  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); mutation.mutate(form); };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-medium text-gray-900">Single Sign-On</h1>
        <p className="text-sm text-gray-500 mt-1">Configure SAML-based SSO for your account.</p>
      </div>
      {isLoading ? <div className="py-8 flex justify-center"><Loader variant="inline" label="Loading SSO config..." /></div> : (
        <form onSubmit={handleSubmit} className="max-w-lg">
          <div className="bg-white rounded-lg border border-[#dadce0] p-5 mb-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm font-medium text-gray-900">Enable SSO</p>
                <p className="text-xs text-gray-500 mt-0.5">Allow users to sign in with your identity provider</p>
              </div>
              <button type="button" onClick={() => setForm((f) => ({ ...f, enabled: !f.enabled }))}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.enabled ? "bg-[#1a73e8]" : "bg-gray-300"}`}>
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${form.enabled ? "translate-x-6" : "translate-x-1"}`} />
              </button>
            </div>
            {form.enabled && (
              <div className="border-t border-[#dadce0] pt-4 space-y-0">
                <TextInput label="Entity ID" value={form.entityId ?? ""} onChange={(v) => setForm((f) => ({ ...f, entityId: v }))} placeholder="https://your-idp.com/entity" />
                <TextInput label="SSO URL" value={form.ssoUrl ?? ""} onChange={(v) => setForm((f) => ({ ...f, ssoUrl: v }))} placeholder="https://your-idp.com/sso" />
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Certificate (PEM)</label>
                  <textarea value={form.certificate ?? ""} onChange={(e) => setForm((f) => ({ ...f, certificate: e.target.value }))}
                    placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
                    rows={5} className="w-full px-3 py-2 border border-[#dadce0] rounded-md text-sm font-mono resize-y" />
                </div>
                <div className="flex items-center gap-3">
                  <input type="checkbox" id="force-sso" checked={form.forceSSO ?? false} onChange={(e) => setForm((f) => ({ ...f, forceSSO: e.target.checked }))} className="rounded" />
                  <label htmlFor="force-sso" className="text-sm text-gray-700">Force SSO for all users (disable password login)</label>
                </div>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button type="submit" disabled={mutation.isPending}
              className="px-4 py-2 bg-[#1a73e8] text-white rounded-md hover:bg-[#1557b0] text-sm font-medium disabled:opacity-50">
              {mutation.isPending ? "Saving..." : "Save Configuration"}
            </button>
            {saved && <span className="text-sm text-green-600">Saved!</span>}
            {mutation.isError && <span className="text-sm text-red-600">{(mutation.error as Error)?.message ?? "Failed to save"}</span>}
          </div>
        </form>
      )}
    </div>
  );
}
