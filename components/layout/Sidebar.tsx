"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { useApp } from "@/contexts/AppContext";
import { useAssistant } from "@/contexts/AssistantContext";
import { useState } from "react";
import { getNavForProduct } from "@/lib/config/nav";
import { getProductFromPath, PRODUCTS } from "@/lib/config/products";

const NAV_GROUP_KEYS: Record<string, string> = {
  "Overview": "groups.overview",
  "Communications": "groups.communications",
  "Organization": "groups.organization",
  "Call Routing": "groups.callRouting",
  "Resources": "groups.resources",
  "Integrations": "groups.integrations",
  "Compliance": "groups.compliance",
  "Settings": "groups.settings",
  "Help & Support": "groups.helpSupport",
  "AI Agent": "groups.aiAgent",
  "Huddle": "groups.huddle",
  "Coach": "groups.coach",
  "Ucontact": "groups.ucontact",
};

const NAV_ITEM_KEYS: Record<string, string> = {
  "Dashboard": "items.dashboard",
  "Analytics": "items.analytics",
  "Call History": "items.callHistory",
  "Virtual Fax": "items.virtualFax",
  "Company": "items.company",
  "Team Members": "items.teamMembers",
  "Departments": "items.departments",
  "Company Directory": "items.companyDirectory",
  "Delegates": "items.delegates",
  "Virtual Assistant": "items.virtualAssistant",
  "Ring Groups": "items.ringGroups",
  "Call Queues": "items.callQueues",
  "Schedules": "items.schedules",
  "Special Extensions": "items.specialExtensions",
  "Phone Numbers": "items.phoneNumbers",
  "Devices": "items.devices",
  "Device Management": "items.deviceManagement",
  "Call Blocking": "items.callBlocking",
  "SIP Trunking": "items.sipTrunking",
  "SIP Tie-Lines": "items.sipTieLines",
  "Webhooks": "items.webhooks",
  "API Keys": "items.apiKeys",
  "Emergency Settings": "items.emergencySettings",
  "Trust Center": "items.trustCenter",
  "Voicemail Settings": "items.voicemailSettings",
  "Music Options": "items.musicOptions",
  "Licenses": "items.licenses",
  "Number Porting": "items.numberPorting",
  "Bulk Operations": "items.bulkOperations",
  "Overview": "items.overview",
  "Settings": "items.settings",
};

interface NavItem {
  href?: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  feature?: string;
  action?: "openAssistant";
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

function NavGroupSection({ group }: { group: NavGroup }) {
  const pathname = usePathname();
  const { bootstrap } = useApp();
  const { open: openAssistant } = useAssistant();
  const [expanded, setExpanded] = useState(true);
  const t = useTranslations("nav");
  const tAny = t as unknown as (key: string) => string;

  const visibleItems = group.items.filter((item) => {
    if (!item.feature) return true;
    return bootstrap?.features?.[item.feature] !== false;
  });

  if (visibleItems.length === 0) return null;

  const groupLabel = NAV_GROUP_KEYS[group.label]
    ? tAny(NAV_GROUP_KEYS[group.label])
    : group.label;

  const itemLabel = (label: string) =>
    NAV_ITEM_KEYS[label] ? tAny(NAV_ITEM_KEYS[label]) : label;

  return (
    <div className="mb-1">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider hover:bg-[#e8eaed] rounded-md"
      >
        {expanded ? (
          <ChevronDown className="w-4 h-4" />
        ) : (
          <ChevronRight className="w-4 h-4" />
        )}
        {groupLabel}
      </button>
      {expanded && (
        <div className="space-y-0.5">
          {visibleItems.map((item) => {
            const Icon = item.icon;
            if (item.action === "openAssistant") {
              return (
                <button
                  key={item.label}
                  onClick={openAssistant}
                  className="flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors text-gray-700 hover:bg-[#e8eaed] w-full text-left"
                >
                  <Icon className="w-5 h-5 shrink-0" />
                  {itemLabel(item.label)}
                </button>
              );
            }
            if (item.href?.startsWith("http")) {
              return (
                <a
                  key={item.href}
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors text-gray-700 hover:bg-[#e8eaed]"
                >
                  <Icon className="w-5 h-5 shrink-0" />
                  {itemLabel(item.label)}
                </a>
              );
            }
            const href = item.href!;
            const isActive = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                prefetch={false}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                  isActive
                    ? "bg-[#e8f0fe] text-[#1a73e8] font-medium"
                    : "text-gray-700 hover:bg-[#e8eaed]"
                }`}
              >
                <Icon className="w-5 h-5 shrink-0" />
                {itemLabel(item.label)}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const productId = getProductFromPath(pathname);
  const [productsExpanded, setProductsExpanded] = useState(true);
  const uniteExpanded = productId === "ucass";
  const t = useTranslations("nav");

  const ucassNavGroups = getNavForProduct("ucass");

  return (
    <aside className="w-64 shrink-0 bg-white border-r border-[#dadce0] overflow-y-auto">
      <nav className="p-3">
        <div className="mb-2">
          <p className="px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider">
            {t("sidebar.apps")}
          </p>
          <Link
            href="/products"
            prefetch={false}
            className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
              pathname === "/products"
                ? "bg-[#e8f0fe] text-[#1a73e8] font-medium"
                : "text-gray-700 hover:bg-[#e8eaed]"
            }`}
          >
            {t("items.overview")}
          </Link>
        </div>

        <div className="mb-1">
          <button
            onClick={() => setProductsExpanded(!productsExpanded)}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider hover:bg-[#e8eaed] rounded-md"
          >
            {productsExpanded ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
            {t("sidebar.products")}
          </button>

          {productsExpanded && (
            <div className="mt-0.5 space-y-0.5">
              {PRODUCTS.map((product) => {
                const Icon = product.icon;
                const isActive = productId === product.id;
                const href =
                  product.id === "ucass"
                    ? "/ucass/dashboard"
                    : product.basePath;

                if (product.id === "ucass") {
                  return (
                    <div key={product.id}>
                      <Link
                        href={href}
                        prefetch={false}
                        className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                          isActive
                            ? "bg-[#e8f0fe] text-[#1a73e8] font-medium"
                            : "text-gray-700 hover:bg-[#e8eaed]"
                        }`}
                      >
                        <Icon className="w-5 h-5 shrink-0" />
                        {product.shortName}
                        {uniteExpanded ? (
                          <ChevronDown className="w-4 h-4 ml-auto" />
                        ) : (
                          <ChevronRight className="w-4 h-4 ml-auto" />
                        )}
                      </Link>
                      {uniteExpanded && (
                        <div className="ml-4 mt-0.5 border-l border-gray-200 pl-2">
                          {ucassNavGroups.map((group) => (
                            <NavGroupSection key={group.label} group={group} />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                }

                return (
                  <Link
                    key={product.id}
                    href={href}
                    prefetch={false}
                    className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                      isActive
                        ? "bg-[#e8f0fe] text-[#1a73e8] font-medium"
                        : "text-gray-700 hover:bg-[#e8eaed]"
                    }`}
                  >
                    <Icon className="w-5 h-5 shrink-0" />
                    {product.shortName}
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </nav>
    </aside>
  );
}
