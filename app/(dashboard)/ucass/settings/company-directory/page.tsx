"use client";
import { useTranslations } from "next-intl";

import { useRef, useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApp } from "@/contexts/AppContext";
import { qk } from "@/lib/query-keys";
import { getApiClient, type V1Response } from "@/lib/api-client";
import { FeatureGate } from "@/components/feature-gate/FeatureGate";
import { Button } from "@/components/ui/Button";
import { Upload, RotateCcw } from "lucide-react";
import { AudioPlayer } from "@/components/ui/AudioPlayer";

// ── Types ─────────────────────────────────────────────────────────────────────
interface CompDirGreeting {
  audioContent?: string;
  audioType?: string;
  defaultFile?: boolean;
}

interface CompDirData {
  greeting?: CompDirGreeting;
  searchByLastName?: boolean;
}

// ── Audio Player ──────────────────────────────────────────────────────────────
function GreetingPlayer({ audioContent }: { audioContent?: string }) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!audioContent) return;
    try {
      const bytes = Uint8Array.from(atob(audioContent), (c) => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: "audio/wav" });
      const url = URL.createObjectURL(blob);
      setBlobUrl(url);
      return () => URL.revokeObjectURL(url);
    } catch {
      // invalid base64 — ignore
    }
  }, [audioContent]);

  return <AudioPlayer src={blobUrl} />;
}

// ── Main Page ─────────────────────────────────────────────────────────────────
function CompanyDirectoryContent() {
  const t = useTranslations("companyDirectoryPage");
  const { bootstrap } = useApp();
  const accountId = bootstrap?.account?.accountId ?? 0;
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [searchByLast, setSearchByLast] = useState<boolean | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const { data: settings, isLoading } = useQuery({
    queryKey: qk.companyDir.all(accountId),
    queryFn: async () => {
      const api = await getApiClient();
      const res = await api.get<V1Response<CompDirData>>(
        `/accounts/${accountId}/compDir`
      );
      return res.data.data;
    },
    enabled: !!accountId,
  });

  useEffect(() => {
    if (settings?.searchByLastName !== undefined) {
      setSearchByLast(settings.searchByLastName);
    }
  }, [settings?.searchByLastName]);

  const searchMutation = useMutation({
    mutationFn: async (searchByLastName: boolean) => {
      const api = await getApiClient();
      return api.put<V1Response<string>>(
        `/accounts/${accountId}/dirSearch`,
        { searchByLastName }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.companyDir.all(accountId) });
    },
  });

  const greetingMutation = useMutation({
    mutationFn: async (payload: CompDirGreeting) => {
      const api = await getApiClient();
      return api.put<V1Response<CompDirData>>(
        `/accounts/${accountId}/compDir`,
        { greeting: payload }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.companyDir.all(accountId) });
      setUploadError(null);
    },
    onError: (err: unknown) => {
      setUploadError(err instanceof Error ? err.message : t("uploadError"));
    },
  });

  const handleSearchChange = (byLastName: boolean) => {
    setSearchByLast(byLastName);
    searchMutation.mutate(byLastName);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = "";
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64 = btoa(binary);
      await greetingMutation.mutateAsync({
        audioContent: base64,
        audioType: "CDG",
        defaultFile: false,
      });
    } catch {
      // error set by mutation onError
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleReturnToDefault = () => {
    greetingMutation.mutate({ audioType: "CDG", defaultFile: true });
  };

  const isDefault = settings?.greeting?.defaultFile !== false;
  const isSaving = searchMutation.isPending || greetingMutation.isPending || uploading;

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-medium text-gray-900">{t("title")}</h1>
        <p className="text-sm text-gray-500 mt-1">{t("subtitle")}</p>
      </div>

      {isLoading ? (
        <div className="py-8 text-sm text-gray-400">{t("loading")}</div>
      ) : (
        <div className="bg-white divide-y divide-[#e5e7eb]">

          {/* ── Greeting ─────────────────────────────────────────────── */}
          <section className="px-5 py-4 space-y-3">
              <h2 className="text-base font-semibold text-gray-900">{t("greetingTitle")}</h2>
              <p className="text-xs text-gray-500">
                {isDefault ? t("playingDefault") : t("playingCustom")}
              </p>

              <GreetingPlayer audioContent={settings?.greeting?.audioContent} />

              <div className="flex items-center gap-4 pt-1">
                <Button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={isSaving}
                  variant="secondary"
                  size="sm"
                  icon={<Upload className="w-3.5 h-3.5" />}
                >
                  {uploading ? t("uploading") : t("changeGreeting")}
                </Button>

                {!isDefault && (
                  <button
                    type="button"
                    onClick={handleReturnToDefault}
                    disabled={isSaving}
                    className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 hover:underline disabled:opacity-50"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    {t("returnToDefault")}
                  </button>
                )}
              </div>

              {uploadError && (
                <p className="text-xs text-red-600">{uploadError}</p>
              )}

              <input
                ref={fileRef}
                type="file"
                accept=".wav,.mp3,.ogg"
                onChange={handleFileChange}
                className="hidden"
              />
          </section>

          {/* ── Team Member Lookup ───────────────────────────────────── */}
          <section className="px-5 py-4">
              <h2 className="text-base font-semibold text-gray-900 mb-4">{t("lookupTitle")}</h2>
              <p className="text-sm text-gray-600 mb-4">{t("lookupDescription")}</p>

              <div className="space-y-3">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="radio"
                    name="searchPref"
                    checked={searchByLast === true}
                    onChange={() => handleSearchChange(true)}
                    disabled={searchMutation.isPending}
                    className="accent-[#1a73e8] w-4 h-4"
                  />
                  <span className="text-sm text-gray-800 group-hover:text-gray-900">
                    {t("byLastName")}
                  </span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="radio"
                    name="searchPref"
                    checked={searchByLast === false}
                    onChange={() => handleSearchChange(false)}
                    disabled={searchMutation.isPending}
                    className="accent-[#1a73e8] w-4 h-4"
                  />
                  <span className="text-sm text-gray-800 group-hover:text-gray-900">
                    {t("byFirstName")}
                  </span>
                </label>
              </div>

              {searchMutation.isPending && (
                <p className="text-xs text-gray-400 mt-3">{t("saving")}</p>
              )}
          </section>

        </div>
      )}
    </div>
  );
}

export default function CompanyDirectoryPage() {
  return (
    <FeatureGate feature="CompanyDirectory">
      <CompanyDirectoryContent />
    </FeatureGate>
  );
}
