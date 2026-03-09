"use client";

import { useQuery } from "@tanstack/react-query";
import { useApp } from "@/contexts/AppContext";
import { fetchAccountAnalytics, fetchUserAnalyticsSummary, lastNDays } from "@/lib/api/analytics";
import { Phone, Users, Building2, Hash, PhoneCall, ListOrdered, Voicemail } from "lucide-react";
import Link from "next/link";

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  href?: string;
  icon: React.ComponentType<{ className?: string }>;
  color?: string;
}

function StatCard({ label, value, sub, href, icon: Icon, color = "text-[#1a73e8]" }: StatCardProps) {
  const inner = (
    <div className="bg-white rounded-lg border border-[#dadce0] p-5 flex items-start gap-4 hover:shadow-sm transition-shadow">
      <div className={`mt-0.5 ${color}`}>
        <Icon className="w-6 h-6" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-500">{label}</p>
        <p className="text-2xl font-semibold text-gray-900 mt-0.5">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );

  return href ? (
    <Link href={href} prefetch={false} className="block">
      {inner}
    </Link>
  ) : (
    inner
  );
}

export default function DashboardPage() {
  const { bootstrap } = useApp();
  const account = bootstrap?.account;
  const user = bootstrap?.user;
  const plans = bootstrap?.plans ?? [];
  const licenses = bootstrap?.licenses ?? [];
  const unread = bootstrap?.unreadVoicemailCount ?? 0;

  const range = lastNDays(7);

  const { data: accountStats } = useQuery({
    queryKey: ["analytics-account", account?.accountId, "7d"],
    queryFn: () => fetchAccountAnalytics(account!.accountId, range),
    enabled: !!account?.accountId,
    staleTime: 5 * 60 * 1000,
  });

  const { data: userSummary } = useQuery({
    queryKey: ["analytics-users-summary", account?.accountId, "7d"],
    queryFn: () => fetchUserAnalyticsSummary(account!.accountId, range),
    enabled: !!account?.accountId,
    staleTime: 5 * 60 * 1000,
  });

  const plan = plans[0];
  const planLabel = plan
    ? `${(plan.planName ?? plan.name ?? "Plan")} — $${plan.planFee ?? "?"}/mo`
    : "—";
  const nextBilling = plan?.nextBillingDate
    ? new Date(plan.nextBillingDate as string).toLocaleDateString()
    : null;

  const activeUserCount = account?.maxUsers ? `/ ${account.maxUsers} max` : "";

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-medium text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">
          {account?.company ?? "Your account"} · Last 7 days
        </p>
      </div>

      {/* Call analytics */}
      {accountStats && (
        <div className="mb-8">
          <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">
            Call Activity (7 days)
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="Total Calls"
              value={accountStats.totalCalls ?? "—"}
              icon={Phone}
              href="/ucass/call-history"
            />
            <StatCard
              label="Answered"
              value={accountStats.answeredCalls ?? "—"}
              icon={PhoneCall}
              color="text-green-600"
              href="/ucass/call-history"
            />
            <StatCard
              label="Missed"
              value={accountStats.missedCalls ?? "—"}
              icon={Phone}
              color="text-red-500"
              href="/ucass/call-history"
            />
            <StatCard
              label="Unread Voicemails"
              value={unread}
              icon={Voicemail}
              color="text-orange-500"
              href="/ucass/voicemail"
            />
          </div>
        </div>
      )}

      {/* Account overview */}
      <div className="mb-8">
        <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">
          Account
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Team Members"
            value={userSummary?.totalCalls !== undefined ? user ? "Active" : "—" : "—"}
            sub={activeUserCount}
            icon={Users}
            href="/ucass/team-members"
          />
          <StatCard
            label="Plan"
            value={planLabel}
            sub={nextBilling ? `Next billing: ${nextBilling}` : undefined}
            icon={ListOrdered}
          />
          <StatCard
            label="Phone Numbers"
            value="View all"
            sub="DIDs and extensions"
            icon={Hash}
            href="/ucass/phone-numbers"
          />
          <StatCard
            label="Departments"
            value="View all"
            sub="Call routing groups"
            icon={Building2}
            href="/ucass/departments"
          />
        </div>
      </div>

      {/* License overview */}
      {licenses.length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">
            Licenses
          </h2>
          <div className="bg-white rounded-lg border border-[#dadce0] overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-[#f8f9fa]">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">License</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Qty</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700">Status</th>
                </tr>
              </thead>
              <tbody>
                {licenses.map((lic, i) => (
                  <tr key={i} className="border-t border-[#dadce0]">
                    <td className="px-4 py-3 text-gray-900">{lic.name ?? lic.licenseCode ?? lic.code ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {lic.unlimited ? "Unlimited" : (lic.quantity ?? "—")}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Active
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Quick links */}
      <div>
        <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">
          Quick Access
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {[
            { href: "/ucass/team-members", label: "Team Members" },
            { href: "/ucass/departments", label: "Departments" },
            { href: "/ucass/ring-groups", label: "Ring Groups" },
            { href: "/ucass/call-queues", label: "Call Queues" },
            { href: "/ucass/phone-numbers", label: "Phone Numbers" },
            { href: "/ucass/devices", label: "Devices" },
            { href: "/ucass/settings/number-porting", label: "Number Porting" },
            { href: "/ucass/settings/delegates", label: "Delegates" },
          ].map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              prefetch={false}
              className="px-4 py-3 bg-white border border-[#dadce0] rounded-lg text-sm text-gray-700 hover:bg-[#f8f9fa] hover:border-[#1a73e8] transition-colors"
            >
              {label} →
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
