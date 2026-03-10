"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApp } from "@/contexts/AppContext";
import { qk } from "@/lib/query-keys";
import { getApiClient, type V1Response } from "@/lib/api-client";
import { CollapsibleSection } from "@/components/settings/CollapsibleSection";
import { SettingsRow } from "@/components/settings/SettingsGroup";
import { Loader } from "@/components/ui/Loader";
import { Toggle } from "@/components/settings/Toggle";

interface VoicemailSettings {
  emailNotify?: boolean;
  emailIncludeVoicemail?: boolean;
  emailTranscribe?: boolean;
  emailIncludeCallerDetails?: boolean;
  emailRestrictChanges?: boolean;
}

export default function VoicemailSettingsPage() {
  const { bootstrap } = useApp();
  const accountId = bootstrap?.account?.accountId ?? 0;
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: qk.voicemailSettings.all(accountId),
    queryFn: async () => {
      const api = await getApiClient();
      const res = await api.get<V1Response<VoicemailSettings>>(
        `/accounts/${accountId}/voicemailSettings`
      );
      return res.data.data;
    },
    enabled: !!accountId,
  });

  const updateMutation = useMutation({
    mutationFn: async (payload: Partial<VoicemailSettings>) => {
      const api = await getApiClient();
      const res = await api.put<V1Response<VoicemailSettings>>(
        `/accounts/${accountId}/voicemailSettings`,
        payload
      );
      return res.data.data;
    },
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey: qk.voicemailSettings.all(accountId) });
      const prev = queryClient.getQueryData<VoicemailSettings>(["voicemail-settings", accountId]);
      queryClient.setQueryData(["voicemail-settings", accountId], { ...prev, ...payload });
      return { prev };
    },
    onError: (_err, _payload, context) => {
      if (context?.prev) {
        queryClient.setQueryData(["voicemail-settings", accountId], context.prev);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: qk.voicemailSettings.all(accountId) });
    },
  });

  const handleToggle = (key: keyof VoicemailSettings, value: boolean) => {
    const payload = { ...settings, [key]: value };
    updateMutation.mutate(payload);
  };

  return (
    <div>
      <h1 className="text-2xl font-medium text-gray-900 mb-6">
        Voicemail Settings
      </h1>
      <p className="text-gray-600 mb-6">
        Configure voicemail notification preferences.
      </p>
      {isLoading ? (
        <div className="py-12 flex justify-center">
          <Loader variant="inline" label="Loading settings..." />
        </div>
      ) : (
        <CollapsibleSection
          title="Email Notifications"
          subtitle="Control how voicemail notifications are sent"
          defaultExpanded
        >
          <SettingsRow
            label="Email notify"
            description="Send email when new voicemail arrives"
          >
            <Toggle
              checked={settings?.emailNotify ?? false}
              onChange={(v) => handleToggle("emailNotify", v)}
              disabled={updateMutation.isPending}
            />
          </SettingsRow>
          <SettingsRow
            label="Include voicemail in email"
            description="Attach voicemail audio to notification"
          >
            <Toggle
              checked={settings?.emailIncludeVoicemail ?? false}
              onChange={(v) => handleToggle("emailIncludeVoicemail", v)}
              disabled={updateMutation.isPending}
            />
          </SettingsRow>
          <SettingsRow
            label="Transcribe voicemail"
            description="Include transcription in email"
          >
            <Toggle
              checked={settings?.emailTranscribe ?? false}
              onChange={(v) => handleToggle("emailTranscribe", v)}
              disabled={updateMutation.isPending}
            />
          </SettingsRow>
          <SettingsRow
            label="Include caller details"
            description="Show caller information in email"
          >
            <Toggle
              checked={settings?.emailIncludeCallerDetails ?? false}
              onChange={(v) => handleToggle("emailIncludeCallerDetails", v)}
              disabled={updateMutation.isPending}
            />
          </SettingsRow>
        </CollapsibleSection>
      )}
    </div>
  );
}
