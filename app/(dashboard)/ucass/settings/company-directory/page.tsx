"use client";
import { useTranslations } from "next-intl";

import { useRef, useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApp } from "@/contexts/AppContext";
import { qk } from "@/lib/query-keys";
import { getApiClient, type V1Response } from "@/lib/api-client";
import { FeatureGate } from "@/components/feature-gate/FeatureGate";
import { Play, Pause, Upload, RotateCcw } from "lucide-react";

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
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
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

  const handlePlayPause = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !blobUrl) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      if (!audio.src || audio.src !== blobUrl) audio.src = blobUrl;
      audio.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    }
  }, [playing, blobUrl]);

  const handleTimeUpdate = () => {
    const audio = audioRef.current;
    if (!audio) return;
    setCurrentTime(audio.currentTime);
    setProgress(audio.duration ? (audio.currentTime / audio.duration) * 100 : 0);
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) setDuration(audioRef.current.duration);
  };

  const handleEnded = () => setPlaying(false);

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || !audio.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    audio.currentTime = ratio * audio.duration;
  };

  const fmt = (s: number) => {
    if (!isFinite(s) || s < 0) return "00:00";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  };

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={handlePlayPause}
        disabled={!blobUrl}
        className="w-9 h-9 flex items-center justify-center rounded-full bg-[#1a73e8] text-white hover:bg-[#1557b0] disabled:opacity-40 shrink-0 transition-colors"
      >
        {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
      </button>

      <div
        className="flex-1 h-1.5 bg-gray-200 rounded-full cursor-pointer relative"
        onClick={handleSeek}
      >
        <div
          className="absolute inset-y-0 left-0 bg-[#1a73e8] rounded-full transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>

      <span className="text-xs text-gray-500 tabular-nums shrink-0 w-24 text-right">
        {fmt(currentTime)} / {fmt(duration)}
      </span>

      <audio
        ref={audioRef}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
        className="hidden"
      />
    </div>
  );
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
        <div className="space-y-6">

          {/* ── Greeting ─────────────────────────────────────────────── */}
          <div className="bg-white rounded-[16px] border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-900">{t("greetingTitle")}</h2>
            </div>

            <div className="px-5 py-4 space-y-3">
              <p className="text-xs text-gray-500">
                {isDefault ? t("playingDefault") : t("playingCustom")}
              </p>

              <GreetingPlayer audioContent={settings?.greeting?.audioContent} />

              <div className="flex items-center gap-4 pt-1">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={isSaving}
                  className="flex items-center gap-1.5 text-sm text-[#1a73e8] hover:underline disabled:opacity-50"
                >
                  <Upload className="w-3.5 h-3.5" />
                  {uploading ? t("uploading") : t("changeGreeting")}
                </button>

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
            </div>
          </div>

          {/* ── Team Member Lookup ───────────────────────────────────── */}
          <div className="bg-white rounded-[16px] border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-900">{t("lookupTitle")}</h2>
            </div>

            <div className="px-5 py-4">
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
            </div>
          </div>

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
