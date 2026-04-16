"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost";
type ButtonSize = "sm" | "md";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
};

type ButtonStyleOptions = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
};

export function getButtonClasses({
  variant = "secondary",
  size = "md",
  className = "",
}: ButtonStyleOptions = {}) {
  const base =
    "inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-colors rounded-[var(--control-radius)] disabled:opacity-50 disabled:cursor-not-allowed";
  const bySize = size === "sm" ? "px-3 py-1.5 text-sm" : "px-4 py-2 text-sm";
  const byVariant =
    variant === "primary"
      ? "bg-black text-white hover:bg-gray-900"
      : variant === "ghost"
      ? "bg-transparent text-gray-700 hover:bg-[#F9F9FB]"
      : "bg-[#F9F9FB] text-gray-700 hover:bg-[#eeeff4]";

  return `${base} ${bySize} ${byVariant} ${className}`.trim();
}

export function Button({
  variant = "secondary",
  size = "md",
  icon,
  className = "",
  children,
  ...props
}: ButtonProps) {
  return (
    <button className={getButtonClasses({ variant, size, className })} {...props}>
      {icon}
      {children}
    </button>
  );
}
