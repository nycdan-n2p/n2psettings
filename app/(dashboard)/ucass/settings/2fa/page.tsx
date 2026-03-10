"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useApp } from "@/contexts/AppContext";
import { getApiClient } from "@/lib/api-client";
import { Loader } from "@/components/ui/Loader";

interface TfaSettings {
  required: boolean;
  methods?: string[];
}

async function fetchTfaSettings(accountId: number): Promise<TfaSettings> {
  const api = await getApiClient();
  const res = await api.get<{ data?: TfaSettings }>(`/accounts/${accountId}/twofactorauthentication`);
  return (res.data.data ?? { required: false }) as TfaSettings;
}
async function updateTfaSettings(accountId: number, payload: TfaSettings): Promise<TfaSettings> {
  const api = await getApiClient();
  const res = await api.put<{ data: TfaSettings }>(`/accounts/${accountId}/twofactorauthentication`, payload);
  return res.data.data;
}

export default function TwoFactorPage() {
  const { bootstrap } = useApp();
  const accountId = bootstrap?.account?.accountId ?? 0;
  const [required, setRequired] = useState(false);
  const [saved, setSaved] = useState(false);

  const { data: settings, isLoading } = useQuery({
    queryKey: ["2fa-settings", accountId],
    queryFn: () => fetchTfaSettings(accountId),
    enabled: !!accountId,
  });

  useEffect(() => { if (settings) setRequired(settings.required); }, [settings]);

  const mutation = useMutation({
    mutationFn: (payload: TfaSettings) => updateTfaSettings(accountId, payload),
    onSuccess: () => { setSaved(true); setTimeout(() => setSaved(false), 2500); },
  });

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-medium text-gray-900">Two-Factor Authentication</h1>
        <p className="text-sm text-gray-500 mt-1">Require 2FA for all users on your account.</p>
      </div>
      {isLoading ? <div className="py-8 flex justify-center"><Loader variant="inline" label="Loading 2FA settings..." /></div> : (
        <div className="max-w-lg">
          <div className="bg-white rounded-lg border border-[#dadce0] p-5 mb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">Require 2FA for all users</p>
                <p className="text-xs text-gray-500 mt-0.5">Users will be prompted to set up 2FA on their next login</p>
              </div>
              <button type="button" onClick={() => setRequired((r) => !r)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${required ? "bg-[#1a73e8]" : "bg-gray-300"}`}>
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${required ? "translate-x-6" : "translate-x-1"}`} />
              </button>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => mutation.mutate({ required })} disabled={mutation.isPending}
              className="px-4 py-2 bg-[#1a73e8] text-white rounded-md hover:bg-[#1557b0] text-sm font-medium disabled:opacity-50">
              {mutation.isPending ? "Saving..." : "Save"}
            </button>
            {saved && <span className="text-sm text-green-600">Saved!</span>}
            {mutation.isError && <span className="text-sm text-red-600">{(mutation.error as Error)?.message ?? "Failed to save"}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
