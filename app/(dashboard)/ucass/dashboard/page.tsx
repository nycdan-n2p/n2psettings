"use client";

import { useQuery } from "@tanstack/react-query";
import { useApp } from "@/contexts/AppContext";
import { fetchAccountAnalytics, lastNDays } from "@/lib/api/analytics";
import { fetchCallStatsFromHistory } from "@/lib/api/call-history";
import { fetchTeamMembers } from "@/lib/api/team-members";
import { fetchDepartments } from "@/lib/api/departments";
import { fetchPhoneNumbers } from "@/lib/api/phone-numbers";
import { qk } from "@/lib/query-keys";
import { Phone, Users, Building2, Hash, PhoneCall, ListOrdered, Voicemail } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  href?: string;
  icon: React.ComponentType<{ className?: string }>;
  color?: string;
  compact?: boolean;
}

function StatCard({ label, value, sub, href, icon: Icon, color = "text-[#1a73e8]", compact = false }: StatCardProps) {
  const inner = (
    <div className={`bg-[#F9F9FB] rounded-[20px] p-4 ${compact ? "h-[84px]" : "h-[104px]"} flex items-start gap-2.5 hover:shadow-sm transition-shadow`}>
      <div className={`mt-0.5 ${color}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0 h-full flex flex-col">
        <p className="text-[13px] text-gray-500">{label}</p>
        <p className={`font-semibold text-gray-900 mt-0.5 leading-tight ${compact ? "text-[20px]" : "text-[22px]"}`}>{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-auto leading-tight">{sub}</p>}
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

function PlanCard({
  label,
  planName,
  planFee,
  nextBilling,
}: {
  label: string;
  planName: string;
  planFee: string | number;
  nextBilling?: string | null;
}) {
  return (
    <div className="bg-[#F9F9FB] rounded-[20px] p-4 h-[104px] flex items-start gap-2">
      <div className="mt-0.5 text-[#1a73e8]">
        <ListOrdered className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0 h-full flex flex-col">
        <p className="text-[13px] text-gray-500">{label}</p>
        <p className="text-[17px] leading-[1.1] font-semibold text-gray-900 mt-0.5 truncate">{planName}</p>
        <p className="text-[12px] font-semibold text-gray-900 mt-1">${planFee}/mo</p>
        {nextBilling && <p className="text-[10px] text-gray-400 mt-auto leading-tight truncate">{nextBilling}</p>}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { bootstrap } = useApp();
  const t = useTranslations("dashboard");
  const account = bootstrap?.account;
  const user = bootstrap?.user;
  const plans = bootstrap?.plans ?? [];
  const licenses = bootstrap?.licenses ?? [];
  const unread = bootstrap?.unreadVoicemailCount ?? 0;

  const range = lastNDays(7);

  const { data: accountStats } = useQuery({
    queryKey: qk.analytics.account(account?.accountId ?? 0, "7d"),
    queryFn: async () => {
      try {
        const stats = await fetchAccountAnalytics(account!.accountId, range);
        if (
          (stats.totalCalls ?? 0) > 0 ||
          (stats.answeredCalls ?? 0) > 0 ||
          (stats.missedCalls ?? 0) > 0
        ) {
          return stats;
        }
      } catch {
        /* analytics API may 404 */
      }
      try {
        return await fetchCallStatsFromHistory(account!.accountId, user?.userId ?? null);
      } catch {
        /* callhistorysummaryv2 may 500 — return empty stats */
        return { totalCalls: 0, answeredCalls: 0, missedCalls: 0 };
      }
    },
    enabled: !!account?.accountId,
    staleTime: 5 * 60 * 1000,
  });

  const { data: teamMembers } = useQuery({
    queryKey: qk.teamMembers.list(account?.accountId ?? 0),
    queryFn: () => fetchTeamMembers(account!.accountId),
    enabled: !!account?.accountId,
    staleTime: 5 * 60 * 1000,
  });

  const { data: departments } = useQuery({
    queryKey: qk.departments.list(account?.accountId ?? 0),
    queryFn: () => fetchDepartments(account!.accountId),
    enabled: !!account?.accountId,
    staleTime: 5 * 60 * 1000,
  });

  const { data: phoneNumbers } = useQuery({
    queryKey: qk.phoneNumbers.all(account?.accountId ?? 0),
    queryFn: () => fetchPhoneNumbers(account!.accountId),
    enabled: !!account?.accountId,
    staleTime: 5 * 60 * 1000,
  });

  const plan = plans[0];
  const nextBilling = plan?.nextBillingDate
    ? new Date(plan.nextBillingDate as string).toLocaleDateString()
    : null;

  const memberCount = teamMembers?.length ?? null;
  const deptCount = departments?.length ?? null;
  const phoneCount = phoneNumbers?.length ?? null;
  const maxUsers = account?.maxUsers;
  const teamMembersSub = maxUsers != null && memberCount != null ? `${memberCount} / ${maxUsers} max` : maxUsers != null ? `— / ${maxUsers} max` : memberCount != null ? `${memberCount} members` : undefined;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-medium text-gray-900">{t("title")}</h1>
        <p className="text-sm text-gray-500 mt-1">
          {account?.company ?? "Your account"} · Last 7 days
        </p>
      </div>

      {/* Call analytics */}
      <div className="mb-8">
        <h2 className="text-sm font-medium text-gray-500 mb-3">
          {t("callActivity")}
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard
            label={t("totalCalls")}
            value={accountStats?.totalCalls ?? "—"}
            icon={Phone}
            href="/ucass/call-history"
            compact
          />
          <StatCard
            label={t("answered")}
            value={accountStats?.answeredCalls ?? "—"}
            icon={PhoneCall}
            color="text-green-600"
            href="/ucass/call-history"
            compact
          />
          <StatCard
            label={t("missed")}
            value={accountStats?.missedCalls ?? "—"}
            icon={Phone}
            color="text-red-500"
            href="/ucass/call-history"
            compact
          />
          <StatCard
            label={t("unreadVoicemails")}
            value={unread}
            icon={Voicemail}
            color="text-orange-500"
            href="/ucass/voicemail"
            compact
          />
        </div>
      </div>

      {/* Account overview */}
      <div className="mb-8">
        <h2 className="text-sm font-medium text-gray-500 mb-3">
          {t("account")}
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard
            label={t("teamMembers")}
            value={memberCount ?? "—"}
            sub={teamMembersSub}
            icon={Users}
            href="/ucass/team-members"
          />
          <PlanCard
            label={t("plan")}
            planName={plan?.planName ?? plan?.name ?? "—"}
            planFee={plan?.planFee ?? "?"}
            nextBilling={nextBilling ? `${t("nextBilling")}: ${nextBilling}` : null}
          />
          <StatCard
            label={t("phoneNumbers")}
            value={phoneCount ?? "—"}
            sub="DIDs and extensions"
            icon={Hash}
            href="/ucass/phone-numbers"
          />
          <StatCard
            label={t("departments")}
            value={deptCount ?? "—"}
            sub="Call routing groups"
            icon={Building2}
            href="/ucass/departments"
          />
        </div>
      </div>

      {/* License overview */}
      {licenses.length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-medium text-gray-500 mb-3">
            Licenses
          </h2>
          <div className="rounded-lg bg-white">
           <div className="overflow-x-auto">
            <table className="n2p-table w-full text-sm">
              <thead>
                <tr>
                  <th>License</th>
                  <th>Qty</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {licenses.map((lic, i) => (
                  <tr key={i}>
                    <td>{lic.name ?? lic.licenseCode ?? lic.code ?? "—"}</td>
                    <td>
                      {lic.unlimited ? "Unlimited" : (lic.quantity ?? "—")}
                    </td>
                    <td>
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
        </div>
      )}

      {/* Quick links */}
      <div>
        <h2 className="text-sm font-medium text-gray-500 mb-3">
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
              className="block px-4 py-3 bg-[#F9F9FB] rounded-[20px] text-sm text-gray-700 hover:scale-[1.02] transition-transform"
            >
              {label} →
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
