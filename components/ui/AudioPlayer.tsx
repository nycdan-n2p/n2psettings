"use client";

interface AudioPlayerProps {
  src?: string | null;
  className?: string;
}

export function AudioPlayer({ src, className = "" }: AudioPlayerProps) {
  if (!src) {
    return (
      <div className={`text-sm text-gray-500 ${className}`}>
        Audio not available.
      </div>
    );
  }

  return (
    <audio
      controls
      src={src}
      className={`n2p-audio-player w-full h-[var(--control-height)] rounded-[var(--control-radius)] ${className}`}
    >
      Your browser does not support the audio element.
    </audio>
  );
}
