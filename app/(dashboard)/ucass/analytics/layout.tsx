"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart2, Users, ListOrdered } from "lucide-react";

const ANALYTICS_NAV = [
  { href: "/ucass/analytics", label: "Overview", icon: BarChart2 },
  { href: "/ucass/analytics/agent-activity-report", label: "Agent Activity Report", icon: Users },
  { href: "/ucass/analytics/queue-activity-report", label: "Queue Activity Report", icon: ListOrdered },
];

export default function AnalyticsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="flex gap-8">
      <aside className="w-56 shrink-0">
        <div className="sticky top-6">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Analytics
          </p>
          <nav className="space-y-0.5">
            {ANALYTICS_NAV.map((item) => {
              const isActive = pathname === item.href || (item.href !== "/ucass/analytics" && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-[#1a73e8] text-white"
                      : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                  }`}
                >
                  <item.icon className="w-4 h-4 shrink-0" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </aside>
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}
