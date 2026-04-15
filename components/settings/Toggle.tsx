"use client";

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

export function Toggle({ checked, onChange, disabled }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`
        relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full overflow-hidden
        transition-colors duration-200 ease-out
        focus:outline-none focus:ring-2 focus:ring-[#111827]/20 focus:ring-offset-2
        disabled:cursor-not-allowed disabled:opacity-50
        ${checked ? "bg-black" : "bg-[#cfd3db]"}
      `}
    >
      <span
        className={`
          pointer-events-none absolute top-[2px] left-[2px] h-5 w-5 rounded-full
          bg-white border border-[#e5e7eb] transition-transform duration-200 ease-out
          ${checked ? "translate-x-5" : "translate-x-0"}
        `}
      />
    </button>
  );
}
