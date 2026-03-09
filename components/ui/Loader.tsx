"use client";

interface LoaderProps {
  variant?: "full" | "inline" | "button";
  label?: string;
  className?: string;
}

export function Loader({
  variant = "inline",
  label,
  className = "",
}: LoaderProps) {
  const size =
    variant === "full"
      ? "w-16 h-16"
      : variant === "button"
        ? "w-5 h-5"
        : "w-12 h-12";

  const strokeWidth = variant === "button" ? 2 : 3;

  const isButton = variant === "button";

  return (
    <div
      className={`flex flex-col items-center justify-center ${isButton ? "gap-0" : "gap-4"} ${className}`}
      role="status"
      aria-label={label ?? "Loading"}
    >
      <div className={`${size} relative`}>
        {/* Subtle pulsing glow behind spinner */}
        <div className="absolute inset-0 -m-2 rounded-full bg-[#1a73e8]/15 animate-loader-pulse" />
        {/* Spinning ring */}
        <svg
          className="relative w-full h-full animate-spin"
          style={{ animationDuration: "0.9s" }}
          viewBox="0 0 50 50"
        >
          <circle
            cx="25"
            cy="25"
            r="20"
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray="80 120"
            className="text-[#1a73e8]"
          />
        </svg>
      </div>
      {label && variant !== "button" && (
        <span className="text-sm font-medium text-gray-500 animate-pulse">
          {label}
        </span>
      )}
    </div>
  );
}
