"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApp } from "@/contexts/AppContext";
import { qk } from "@/lib/query-keys";
import { getApiClient, type V1Response } from "@/lib/api-client";
import { CollapsibleSection } from "@/components/settings/CollapsibleSection";
import { SettingsRow } from "@/components/settings/SettingsGroup";
import { Toggle } from "@/components/settings/Toggle";

interface CompanyDirectory {
  enabled?: boolean;
  greeting?: { audioContent?: string };
}

export default function CompanyDirectoryPage() {
  const { bootstrap } = useApp();
  const accountId = bootstrap?.account?.accountId ?? 0;
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: qk.companyDir.all(accountId),
    queryFn: async () => {
      const api = await getApiClient();
      const res = await api.get<V1Response<CompanyDirectory>>(
        `/accounts/${accountId}/compDir`
      );
      return res.data.data;
    },
    enabled: !!accountId,
  });

  const updateMutation = useMutation({
    mutationFn: async (payload: Partial<CompanyDirectory>) => {
      const api = await getApiClient();
      const res = await api.put<V1Response<CompanyDirectory>>(
        `/accounts/${accountId}/compDir`,
        payload
      );
      return res.data.data;
    },
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey: qk.companyDir.all(accountId) });
      const prev = queryClient.getQueryData<CompanyDirectory>(["company-directory", accountId]);
      queryClient.setQueryData(["company-directory", accountId], { ...prev, ...payload });
      return { prev };
    },
    onError: (_err, _payload, context) => {
      if (context?.prev) {
        queryClient.setQueryData(["company-directory", accountId], context.prev);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: qk.companyDir.all(accountId) });
    },
  });

  const handleToggle = (enabled: boolean) => {
    updateMutation.mutate({ enabled });
  };

  return (
    <div>
      <h1 className="text-2xl font-medium text-gray-900 mb-6">
        Company Directory
      </h1>
      <p className="text-gray-600 mb-6">
        Configure the company directory menu and greeting.
      </p>
      {isLoading ? (
        <div className="py-8 text-gray-500">Loading...</div>
      ) : (
        <CollapsibleSection
          title="Directory Settings"
          subtitle="Company directory configuration"
          defaultExpanded
        >
          <SettingsRow
            label="Enable company directory"
            description="Allow callers to reach the company directory menu"
          >
            <Toggle
              checked={settings?.enabled ?? false}
              onChange={handleToggle}
              disabled={updateMutation.isPending}
            />
          </SettingsRow>
        </CollapsibleSection>
      )}
    </div>
  );
}
