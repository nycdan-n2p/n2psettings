"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApp } from "@/contexts/AppContext";
import { qk } from "@/lib/query-keys";
import { getAuthApiClient } from "@/lib/api-client";
import { Button } from "@/components/ui/Button";
import { Loader } from "@/components/ui/Loader";
import { Toggle } from "@/components/settings/Toggle";

/** Auth API: GET /api/2fa/details returns user MFA info; may include catalog-level required flag */
interface MfaDetails {
  catalogMfaRequired?: boolean;
  enabled?: boolean;
  required?: boolean;
  [key: string]: unknown;
}

/** Auth API: PUT /api/2fa/catalogs/{catalogId}/toggle */
async function fetchMfaDetails(): Promise<MfaDetails> {
  const api = await getAuthApiClient();
  const res = await api.get<MfaDetails>("/2fa/details");
  return res.data ?? {};
}

async function toggleCatalogMfa(catalogId: number, enabled: boolean): Promise<unknown> {
  const api = await getAuthApiClient();
  const res = await api.put(`/2fa/catalogs/${catalogId}/toggle`, { enabled });
  return res.data;
}

export function TwoFactorSection() {
  const { bootstrap } = useApp();
  const queryClient = useQueryClient();
  const catalogId = bootstrap?.account?.clientId ?? 0;
  const [required, setRequired] = useState(false);
  const [saved, setSaved] = useState(false);

  const { data: details, isLoading } = useQuery({
    queryKey: qk.twoFa.all(catalogId),
    queryFn: fetchMfaDetails,
    enabled: !!catalogId,
  });

  useEffect(() => {
    if (details) {
      const v = details.catalogMfaRequired ?? details.required ?? details.enabled ?? false;
      setRequired(v);
    }
  }, [details]);

  const mutation = useMutation({
    mutationFn: (enabled: boolean) => toggleCatalogMfa(catalogId, enabled),
    onSuccess: () => {
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      queryClient.invalidateQueries({ queryKey: qk.twoFa.all(catalogId) });
    },
  });

  const handleSave = () => mutation.mutate(required);

  if (!catalogId) {
    return (
      <p className="text-sm text-gray-500">Unable to load 2FA settings. Please sign in again.</p>
    );
  }

  if (isLoading) {
    return (
      <div className="py-8 flex justify-center">
        <Loader variant="inline" label="Loading 2FA settings..." />
      </div>
    );
  }

  return (
    <div className="max-w-lg">
      <div className="flex items-center gap-3 mb-4">
        <Toggle checked={required} onChange={setRequired} />
        <div>
          <p className="text-base font-medium text-gray-900">Require 2FA for all users</p>
          <p className="text-xs text-gray-500 mt-0.5">Users will be prompted to set up 2FA on their next login</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Button
          onClick={handleSave}
          disabled={mutation.isPending}
          variant="primary"
        >
          {mutation.isPending ? "Saving..." : "Save"}
        </Button>
        {saved && <span className="text-sm text-green-600">Saved!</span>}
        {mutation.isError && (
          <span className="text-sm text-red-600">{(mutation.error as Error)?.message ?? "Failed to save"}</span>
        )}
      </div>
      <p className="text-xs text-gray-500 mt-3">
        To reset 2FA for a specific user or change your own 2FA method, use the settings in your profile.
      </p>
    </div>
  );
}
