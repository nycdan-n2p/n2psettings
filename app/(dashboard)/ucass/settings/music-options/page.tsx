"use client";
import { useTranslations } from "next-intl";

import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApp } from "@/contexts/AppContext";
import { qk } from "@/lib/query-keys";
import { Loader } from "@/components/ui/Loader";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/settings/ConfirmDialog";
import {
  Trash2, Upload, Music, Sparkles, Play, Pause,
  CheckCircle2, AlertTriangle, X,
} from "lucide-react";

// ── Types & API ───────────────────────────────────────────────────────────────
import {
  fetchMusicOptions,
  uploadMusicOption,
  deleteMusicOption,
  type MusicOption,
} from "@/lib/api/music-options";

// ── AI generation result shape ─────────────────────────────────────────────────
interface MusicGenResult {
  id?: string;
  audioUrl: string;
  audioBase64?: string;
  imageUrl?: string | null;
  title: string;
}

// ── ElevenLabs AI Generator panel ─────────────────────────────────────────────
function MusicGenerator({
  accountId,
  onUploaded,
}: {
  accountId: number;
  onUploaded: () => void;
}) {
  const t = useTranslations("musicOptionsPage");
  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState("instrumental, corporate, upbeat");
  const [instrumental, setInstrumental] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [result, setResult] = useState<MusicGenResult | null>(null);
  const [uploadName, setUploadName] = useState("");
  const [done, setDone] = useState(false);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const blobUrlRef = useRef<string | null>(null);

  async function handleGenerate() {
    if (!prompt.trim()) return;
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
    setGenerating(true);
    setGenError(null);
    setResult(null);
    setDone(false);
    setUploadError(null);

    try {
      const res = await fetch("/api/generate-moh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, style, instrumental }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Generation failed");
      const r = data as MusicGenResult;
      setResult(r);
      setUploadName(r.title || prompt.slice(0, 40));
    } catch (err: unknown) {
      setGenError(err instanceof Error ? err.message : "Failed to generate music");
    } finally {
      setGenerating(false);
    }
  }

  function handlePlayPause() {
    const audio = audioRef.current;
    if (!audio || !result) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      // Use blob URL for playback (avoids CSP issues with long data URLs)
      if (result.audioBase64) {
        if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
        const bin = atob(result.audioBase64);
        const arr = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
        const blob = new Blob([arr], { type: "audio/mpeg" });
        blobUrlRef.current = URL.createObjectURL(blob);
        audio.src = blobUrlRef.current;
      } else {
        audio.src = result.audioUrl;
      }
      audio.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
      audio.onended = () => setPlaying(false);
    }
  }

  async function handleUploadToLibrary() {
    if (!result || !uploadName.trim()) return;
    setUploading(true);
    setUploadError(null);

    try {
      // 1. Create File from base64 (ElevenLabs returns inline) or proxy-download URL
      let file: File;
      if (result.audioBase64) {
        const bin = atob(result.audioBase64);
        const arr = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
        const blob = new Blob([arr], { type: "audio/mpeg" });
        file = new File([blob], `${uploadName.replace(/\s+/g, "-")}.mp3`, {
          type: "audio/mpeg",
        });
      } else {
        const dlRes = await fetch(
          `/api/generate-moh?url=${encodeURIComponent(result.audioUrl)}`
        );
        if (!dlRes.ok) throw new Error(`Download failed: ${dlRes.status}`);
        const blob = await dlRes.blob();
        file = new File([blob], `${uploadName.replace(/\s+/g, "-")}.mp3`, {
          type: blob.type || "audio/mpeg",
        });
      }

      // 2. Upload to music options library
      await uploadMusicOption(accountId, file, uploadName);
      setDone(true);
      setResult(null);
      setPrompt("");
      setPlaying(false);
      onUploaded();
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : t("upload"));
    } finally {
      setUploading(false);
    }
  }

  function handleReset() {
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
    setResult(null);
    setDone(false);
    setGenError(null);
    setUploadError(null);
    setPlaying(false);
  }

  return (
    <div className="rounded-[16px] mb-6">
      {/* Header */}
      <div className="flex items-center gap-2 pb-4">
        <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
          <Sparkles className="w-4 h-4 text-purple-600" />
        </div>
        <div className="flex items-baseline gap-2">
          <h2 className="text-sm font-semibold text-gray-900">Generate AI Music</h2>
          <p className="text-xs text-gray-400">Powered by ElevenLabs · ~15 seconds</p>
        </div>
      </div>

      <div className="divide-y divide-[#e5e7eb]">
      {/* Success state */}
      {done && (
        <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg px-4 py-3 mt-4">
          <div className="flex items-center gap-2 text-sm text-green-800">
            <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
            Music uploaded to library successfully!
          </div>
          <button
            onClick={handleReset}
            className="text-xs text-green-700 underline hover:no-underline"
          >
            Generate another
          </button>
        </div>
      )}

      {!done && (
        <>
          <div className="py-4">
          {/* Prompt */}
          <div className="mb-4">
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Describe the music <span className="text-gray-400 font-normal">(required)</span>
            </label>
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder='e.g. "Upbeat jazz music for a professional phone queue, no vocals"'
              className="w-full px-3 py-2 border border-[#dadce0] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
              onKeyDown={(e) => e.key === "Enter" && !result && handleGenerate()}
            />
          </div>

          {/* Style + Instrumental row */}
          <div className="flex gap-3 mb-4">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Style / genre tags
              </label>
              <input
                type="text"
                value={style}
                onChange={(e) => setStyle(e.target.value)}
                placeholder="jazz, relaxing, piano, ambient"
                className="w-full px-3 py-1.5 border border-[#dadce0] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
              />
            </div>
            <div className="flex items-end pb-0.5">
              <label className="flex items-center gap-2 text-xs font-medium text-gray-600 cursor-pointer select-none whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={instrumental}
                  onChange={(e) => setInstrumental(e.target.checked)}
                  className="accent-purple-600"
                />
                Instrumental only
              </label>
            </div>
          </div>
          </div>

          {/* Generation error */}
          {genError && (
            <div className="py-4">
              <div className="flex items-start gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                {genError}
              </div>
            </div>
          )}

          {/* Result preview */}
          {result && (
            <div className="py-4">
            <div className="bg-purple-50 border border-purple-200 rounded-[16px] p-3">
              <div className="flex items-center gap-3 mb-3">
                {result.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={result.imageUrl}
                    alt=""
                    className="w-12 h-12 rounded-lg object-cover shrink-0"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-purple-900 truncate">{result.title}</p>
                  <p className="text-xs text-purple-500 truncate">
                    {result.audioUrl.startsWith("data:") ? "AI-generated" : result.audioUrl.split("?")[0].split("/").pop()}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handlePlayPause}
                    className="w-9 h-9 flex items-center justify-center rounded-full bg-purple-600 text-white hover:bg-purple-700"
                    title={playing ? "Pause" : "Preview"}
                  >
                    {playing
                      ? <Pause className="w-4 h-4" />
                      : <Play className="w-4 h-4 ml-0.5" />
                    }
                  </button>
                  <button
                    type="button"
                    onClick={handleReset}
                    className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-purple-100 text-purple-400"
                    title="Discard"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Name + upload */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={uploadName}
                  onChange={(e) => setUploadName(e.target.value)}
                  placeholder="Name for library (required)"
                  className="flex-1 px-3 py-1.5 border border-purple-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-400"
                />
                <button
                  type="button"
                  onClick={handleUploadToLibrary}
                  disabled={uploading || !uploadName.trim()}
                  className="flex items-center gap-2 px-4 py-1.5 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50 whitespace-nowrap"
                >
                  {uploading ? (
                    <>
                      <span className="animate-spin inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full" />
                      Uploading…
                    </>
                  ) : (
                    <>
                      <Upload className="w-3.5 h-3.5" />
                      Add to Library
                    </>
                  )}
                </button>
              </div>

              {uploadError && (
                <p className="text-xs text-red-600 mt-1.5">{uploadError}</p>
              )}
            </div>
            </div>
          )}

          <div className="pt-4 pb-4 border-b border-[#e5e7eb]">
          {/* Hidden audio element */}
          <audio ref={audioRef} onEnded={() => setPlaying(false)} className="hidden" />

          {/* Generate button (shown when no result yet) */}
          {!result && (
            <button
              type="button"
              onClick={handleGenerate}
              disabled={generating || !prompt.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50"
            >
              {generating ? (
                <>
                  <span className="animate-spin inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full" />
                  Generating… (~15 sec)
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  Generate Music
                </>
              )}
            </button>
          )}

          {/* Re-generate link after a result */}
          {result && !uploading && (
            <button
              type="button"
              onClick={handleGenerate}
              disabled={generating || !prompt.trim()}
              className="text-xs text-purple-600 hover:underline disabled:opacity-50"
            >
              {generating ? t("generating") : t("regenerate")}
            </button>
          )}
          </div>
        </>
      )}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function MusicOptionsPage() {
  const t = useTranslations("musicOptionsPage");
  const { bootstrap } = useApp();
  const accountId = bootstrap?.account?.accountId ?? 0;
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadName, setUploadName] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MusicOption | null>(null);

  const { data: options = [], isLoading } = useQuery({
    queryKey: qk.musicOptions.all(accountId),
    queryFn: () => fetchMusicOptions(accountId),
    enabled: !!accountId,
  });

  const uploadMutation = useMutation({
    mutationFn: ({ file, name }: { file: File; name: string }) =>
      uploadMusicOption(accountId, file, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.musicOptions.all(accountId) });
      setSelectedFile(null);
      setUploadName("");
      if (fileRef.current) fileRef.current.value = "";
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteMusicOption(accountId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.musicOptions.all(accountId) });
      setDeleteTarget(null);
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setSelectedFile(file);
    if (file && !uploadName) setUploadName(file.name.replace(/\.[^.]+$/, ""));
  };

  const handleUpload = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedFile && uploadName) uploadMutation.mutate({ file: selectedFile, name: uploadName });
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-medium text-gray-900">{t("title")}</h1>
        <p className="text-sm text-gray-500 mt-1">
          Upload and manage music-on-hold audio files for your call queues.
        </p>
      </div>

      {/* AI Generator */}
      <MusicGenerator
        accountId={accountId}
        onUploaded={() =>
          queryClient.invalidateQueries({ queryKey: qk.musicOptions.all(accountId) })
        }
      />

      {/* Manual upload */}
      <div className="rounded-[16px] p-5 mb-6">
        <h2 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
          <Upload className="w-4 h-4 text-gray-400" />
          Upload Audio File
        </h2>
        <form onSubmit={handleUpload} className="flex items-end gap-3 flex-wrap">
          <div className="flex-1 min-w-[160px]">
            <label className="block text-xs font-medium text-gray-600 mb-1">Name</label>
            <input
              value={uploadName}
              onChange={(e) => setUploadName(e.target.value)}
              placeholder="e.g. Jazz Loop"
              className="w-full px-3 py-2 border border-[#dadce0] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#1a73e8]"
              required
            />
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-medium text-gray-600 mb-1">
              File (.mp3, .wav)
            </label>
            <input
              ref={fileRef}
              type="file"
              accept=".mp3,.wav,.ogg"
              onChange={handleFileChange}
              className="w-full text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-sm file:font-medium file:bg-[#e8f0fe] file:text-[#1a73e8] hover:file:bg-[#d2e3fc]"
            />
          </div>
          <Button
            type="submit"
            variant="primary"
            disabled={!selectedFile || !uploadName || uploadMutation.isPending}
          >
            <Upload className="w-4 h-4" />
            {uploadMutation.isPending ? t("uploading") : "Upload"}
          </Button>
        </form>
        {uploadMutation.isError && (
          <p className="text-sm text-red-600 mt-2">
            {(uploadMutation.error as Error)?.message ?? t("upload")}
          </p>
        )}
      </div>

      {/* Library list */}
      <div className="border-t border-[#e5e7eb] pt-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <Music className="w-4 h-4 text-gray-400" />
          Library ({options.length})
        </h2>
      </div>
      {isLoading ? (
        <div className="py-8 flex justify-center">
          <Loader variant="inline" label={t("loading")} />
        </div>
      ) : options.length === 0 ? (
        <div className="py-4 space-y-1">
          <p className="text-sm text-gray-400">
            No audio files yet. Generate one with AI or upload a file above.
          </p>
          <p className="text-xs text-gray-400">
            If uploads fail with 404, the Music Options API may not be available for this account.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-[16px] border border-gray-200 divide-y divide-gray-100">
          {options.map((opt) => (
            <div key={opt.id} className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                  <Music className="w-4 h-4 text-gray-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">{opt.name}</p>
                  {opt.fileName && (
                    <p className="text-xs text-gray-400">{opt.fileName}</p>
                  )}
                </div>
                {opt.isDefault && (
                  <span className="ml-2 px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-700">
                    Default
                  </span>
                )}
              </div>
              {!opt.isDefault && (
                <button
                  onClick={() => setDeleteTarget(opt)}
                  className="p-1.5 rounded hover:bg-red-50 text-red-400 hover:text-red-600 transition-colors"
                  title={t("common_delete")}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        title={t("deleteTitle")}
        message={`Delete "${deleteTarget?.name}"? It will no longer be available as hold music.`}
      />
    </div>
  );
}
