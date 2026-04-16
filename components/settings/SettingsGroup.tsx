"use client";

interface SettingsGroupProps {
  title: string;
  description?: string;
  children: React.ReactNode;
}

export function SettingsGroup({
  title,
  description,
  children,
}: SettingsGroupProps) {
  return (
    <div className="border border-[#dadce0] rounded-lg bg-white p-6 mb-6">
      <h2 className="text-lg font-medium text-gray-900 mb-2">{title}</h2>
      {description && (
        <p className="text-sm text-gray-600 mb-4">{description}</p>
      )}
      <div className="space-y-4">{children}</div>
    </div>
  );
}

interface SettingsRowProps {
  label: string;
  description?: string;
  children: React.ReactNode;
  controlLeading?: boolean;
}

export function SettingsRow({ label, description, children, controlLeading = false }: SettingsRowProps) {
  return (
    <div className="flex flex-col gap-2 py-4 px-4 sm:px-6 border-b border-[#f1f3f4] last:border-0">
      <div className={`flex items-start gap-3 ${controlLeading ? "" : "sm:items-center sm:justify-between"}`}>
        {controlLeading && <div className="shrink-0 mt-0.5">{children}</div>}
        <div>
          <p className="font-medium text-gray-900">{label}</p>
          {description && (
            <p className="text-sm text-gray-500 mt-0.5">{description}</p>
          )}
        </div>
        {!controlLeading && <div className="shrink-0">{children}</div>}
      </div>
    </div>
  );
}
