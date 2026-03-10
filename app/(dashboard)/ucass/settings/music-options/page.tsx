"use client";

import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApp } from "@/contexts/AppContext";
import { qk } from "@/lib/query-keys";
import { getApiClient } from "@/lib/api-client";
import { Loader } from "@/components/ui/Loader";
import { ConfirmDialog } from "@/components/settings/ConfirmDialog";
import { Trash2, Upload, Music } from "lucide-react";

interface MusicOption {
  id: number;
  name: string;
  fileName?: string;
  isDefault?: boolean;
}

async function fetchMusicOptions(accountId: number): Promise<MusicOption[]> {
  const api = await getApiClient();
  const res = await api.get<{ data?: MusicOption[] }>(`/accounts/${accountId}/musicoptions`);
  return Array.isArray(res.data.data) ? res.data.data : [];
}
async function uploadMusicOption(accountId: number, file: File, name: string): Promise<MusicOption> {
  const api = await getApiClient();
  const form = new FormData();
  form.append("file", file);
  form.append("name", name);
  const res = await api.post<{ data: MusicOption }>(`/accounts/${accountId}/musicoptions`, form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data.data;
}
async function deleteMusicOption(accountId: number, id: number): Promise<void> {
  const api = await getApiClient();
  await api.delete(`/accounts/${accountId}/musicoptions/${id}`);
}

export default function MusicOptionsPage() {
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
    mutationFn: ({ file, name }: { file: File; name: string }) => uploadMusicOption(accountId, file, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.musicOptions.all(accountId) });
      setSelectedFile(null);
      setUploadName("");
      if (fileRef.current) fileRef.current.value = "";
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteMusicOption(accountId, id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: qk.musicOptions.all(accountId) }); setDeleteTarget(null); },
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
        <h1 className="text-2xl font-medium text-gray-900">Music Options</h1>
        <p className="text-sm text-gray-500 mt-1">Upload and manage music-on-hold audio files.</p>
      </div>

      {/* Upload form */}
      <div className="bg-white rounded-lg border border-[#dadce0] p-5 mb-6">
        <h2 className="text-sm font-medium text-gray-700 mb-3">Upload Audio File</h2>
        <form onSubmit={handleUpload} className="flex items-end gap-3">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input value={uploadName} onChange={(e) => setUploadName(e.target.value)} placeholder="e.g. Jazz Loop"
              className="w-full px-3 py-2 border border-[#dadce0] rounded-md text-sm" required />
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">File (.mp3, .wav)</label>
            <input ref={fileRef} type="file" accept=".mp3,.wav,.ogg" onChange={handleFileChange}
              className="w-full text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-sm file:font-medium file:bg-[#e8f0fe] file:text-[#1a73e8] hover:file:bg-[#d2e3fc]" />
          </div>
          <button type="submit" disabled={!selectedFile || !uploadName || uploadMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-[#1a73e8] text-white rounded-md hover:bg-[#1557b0] text-sm font-medium disabled:opacity-50">
            <Upload className="w-4 h-4" />
            {uploadMutation.isPending ? "Uploading..." : "Upload"}
          </button>
        </form>
        {uploadMutation.isError && <p className="text-sm text-red-600 mt-2">{(uploadMutation.error as Error)?.message ?? "Upload failed"}</p>}
      </div>

      {/* List */}
      <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">Uploaded Files</h2>
      {isLoading ? (
        <div className="py-8 flex justify-center"><Loader variant="inline" label="Loading music options..." /></div>
      ) : options.length === 0 ? (
        <p className="text-sm text-gray-500">No audio files uploaded yet.</p>
      ) : (
        <div className="bg-white rounded-lg border border-[#dadce0] divide-y divide-[#dadce0]">
          {options.map((opt) => (
            <div key={opt.id} className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3">
                <Music className="w-4 h-4 text-gray-400 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-gray-900">{opt.name}</p>
                  {opt.fileName && <p className="text-xs text-gray-400">{opt.fileName}</p>}
                </div>
                {opt.isDefault && <span className="ml-2 px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-700">Default</span>}
              </div>
              {!opt.isDefault && (
                <button onClick={() => setDeleteTarget(opt)} className="p-1.5 rounded hover:bg-red-50 text-red-600"><Trash2 className="w-4 h-4" /></button>
              )}
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)} title="Delete Music Option" message={`Delete "${deleteTarget?.name}"?`} />
    </div>
  );
}
