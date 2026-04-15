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
      ? "w-10 h-10"
      : variant === "button"
        ? "w-4 h-4"
        : "w-8 h-8";

  const strokeWidth = variant === "button" ? 2 : 2.5;

  const isButton = variant === "button";

  return (
    <div
      className={`flex items-center justify-center ${className}`}
      role="status"
      aria-label={label ?? "Loading"}
    >
      <div className={size}>
        <svg
          className="w-full h-full animate-spin text-gray-400"
          style={{ animationDuration: "0.8s" }}
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
          />
        </svg>
      </div>
    </div>
  );
}
