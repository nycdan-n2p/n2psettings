"use client";

import { useState, useEffect } from "react";
import { X, Download, Trash2 } from "lucide-react";
import { AudioPlayer } from "@/components/ui/AudioPlayer";
import {
  fetchVoicemailAudioUrl,
  fetchVoicemailDetail,
  type VoicemailItem,
} from "@/lib/api/voicemails";

interface VoicemailDetailModalProps {
  voicemail: VoicemailItem;
  accountId: number;
  userId: number;
  onClose: () => void;
  onDeleted?: () => void;
}

export function VoicemailDetailModal({
  voicemail,
  accountId,
  userId,
  onClose,
}: VoicemailDetailModalProps) {
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const voicemailId = voicemail.voicemailId;
  const fromLabel = voicemail.from?.callerId ?? voicemail.from?.number ?? "Unknown";

  useEffect(() => {
    if (!voicemailId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([
      fetchVoicemailAudioUrl(voicemailId, accountId, userId),
      fetchVoicemailDetail(accountId, userId, voicemailId),
    ]).then(([url, detail]) => {
      if (cancelled) return;
      setAudioUrl(url ?? detail?.audioUrl ?? null);
      setTranscript(detail?.transcript ?? null);
      setLoading(false);
      if (!url && !detail?.audioUrl) {
        setError("Audio not available for this voicemail.");
      }
    });

    return () => {
      cancelled = true;
    };
  }, [voicemailId, accountId, userId]);

  const handleDownload = () => {
    if (audioUrl) {
      const a = document.createElement("a");
      a.href = audioUrl;
      a.download = `voicemail-${voicemailId}.mp3`;
      a.click();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-4">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden
      />
      <div
        className="modal-surface relative z-10 w-full max-w-lg bg-white rounded-t-[34px] rounded-b-none shadow-xl mx-4 h-[calc(100vh-1rem)] overflow-hidden flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-labelledby="vm-modal-title"
      >
        <div className="modal-header flex items-center justify-between px-6 py-4">
          <h2 id="vm-modal-title" className="text-lg font-medium text-gray-900">
            Voice Mail From {fromLabel}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-gray-100 text-gray-500"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="modal-body bg-white px-6 py-4 overflow-auto flex-1 space-y-4">
          {/* Playback controls - always visible */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2">Play</h3>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <AudioPlayer src={audioUrl} />
              </div>
            <div className="flex gap-2">
              <button
                onClick={handleDownload}
                disabled={!audioUrl || loading}
                className="p-2 rounded-md hover:bg-gray-100 text-gray-600 disabled:opacity-50"
                title="Download"
              >
                <Download className="w-5 h-5" />
              </button>
              <button
                className="p-2 rounded-md hover:bg-gray-100 text-gray-600"
                title="Delete"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
            </div>
          </div>

          {loading && (
            <p className="text-sm text-gray-500">Loading audio...</p>
          )}
          {error && (
            <p className="text-sm text-amber-600">{error}</p>
          )}

          {/* Transcript - always visible */}
          <div className="mt-4">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Transcript</h3>
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 min-h-[120px]">
              {transcript ? (
                <p className="text-sm text-gray-800 whitespace-pre-wrap">{transcript}</p>
              ) : (
                <p className="text-sm text-gray-500 italic">
                  {loading ? "Loading transcript..." : "Transcript not available. Enable voicemail transcription in settings."}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
