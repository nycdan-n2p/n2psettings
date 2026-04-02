"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost";
type ButtonSize = "sm" | "md";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
};

export function Button({
  variant = "secondary",
  size = "md",
  icon,
  className = "",
  children,
  ...props
}: ButtonProps) {
  const base =
    "inline-flex items-center justify-center gap-2 font-medium transition-colors rounded-[var(--control-radius)] disabled:opacity-50 disabled:cursor-not-allowed";
  const bySize = size === "sm" ? "px-3 py-1.5 text-sm" : "px-4 py-2 text-sm";
  const byVariant =
    variant === "primary"
      ? "bg-black text-white hover:bg-gray-900"
      : variant === "ghost"
      ? "bg-transparent text-gray-700 hover:bg-[#F6F6F9]"
      : "bg-[#F6F6F9] text-gray-700 hover:bg-[#eeeff4]";

  return (
    <button className={`${base} ${bySize} ${byVariant} ${className}`} {...props}>
      {icon}
      {children}
    </button>
  );
}
