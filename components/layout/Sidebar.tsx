"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { ChevronDown, ChevronRight, Lock, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useApp } from "@/contexts/AppContext";
import { useAssistant } from "@/contexts/AssistantContext";
import { useSidebar } from "@/contexts/SidebarContext";
import { useState, useEffect, useRef } from "react";
import { getNavForProduct } from "@/lib/config/nav";
import { getProductFromPath, PRODUCTS } from "@/lib/config/products";

const PRODUCT_ICON_SRC: Record<string, string> = {
  ucass: "/sidebar-icons/unite.svg",
  agent: "/sidebar-icons/agent.svg",
  huddle: "/sidebar-icons/huddle.svg",
  coach: "/sidebar-icons/coach.svg",
  ucontact: "/sidebar-icons/ucontact.svg",
};

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
  "uContact": "groups.ucontact",
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
  const t = useTranslations("nav");
  const tAny = t as unknown as (key: string) => string;

  // All items are shown; locked ones get a visual indicator and still navigate
  // to their page (which renders the FeatureGate upsell content).
  const visibleItems = group.items;

  if (visibleItems.length === 0) return null;

  const isLocked = (item: NavItem) =>
    !!item.feature && bootstrap?.features?.[item.feature] === false;

  const groupLabel = NAV_GROUP_KEYS[group.label]
    ? tAny(NAV_GROUP_KEYS[group.label])
    : group.label;

  const itemLabel = (label: string) =>
    NAV_ITEM_KEYS[label] ? tAny(NAV_ITEM_KEYS[label]) : label;

  return (
    <div className="mb-1">
      <div className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-gray-400 uppercase tracking-wider">
        {groupLabel}
      </div>
      <div className="space-y-0.5">
        {visibleItems.map((item) => {
          if (item.action === "openAssistant") {
            return (
              <button
                key={item.label}
                onClick={openAssistant}
                className="flex items-center gap-3 px-3 py-2 rounded-[var(--control-radius)] text-sm transition-colors text-gray-700 hover:bg-[rgba(167,167,190,0.10)] w-full text-left"
              >
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
                className="flex items-center gap-3 px-3 py-2 rounded-[var(--control-radius)] text-sm transition-colors text-gray-700 hover:bg-[rgba(167,167,190,0.10)]"
              >
                {itemLabel(item.label)}
              </a>
            );
          }
          const href = item.href!;
          const isActive = pathname === href || pathname.startsWith(`${href}/`);
          const locked = isLocked(item);
          return (
            <Link
              key={href}
              href={href}
              prefetch={false}
              className={`flex items-center gap-3 px-3 py-2 rounded-[var(--control-radius)] text-sm transition-colors ${
                isActive
                  ? "bg-[rgba(167,167,190,0.10)] text-gray-900 font-medium"
                  : locked
                  ? "text-gray-400 hover:bg-[rgba(167,167,190,0.10)] hover:text-gray-600"
                  : "text-gray-700 hover:bg-[rgba(167,167,190,0.10)]"
              }`}
            >
              <span className="flex-1 min-w-0 truncate">{itemLabel(item.label)}</span>
              {locked && (
                <Lock className="w-3 h-3 shrink-0 text-gray-400" />
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const productId = getProductFromPath(pathname);
  const [uniteExpanded, setUniteExpanded] = useState(pathname.startsWith("/ucass"));
  const wasUcassRef = useRef(pathname.startsWith("/ucass"));
  const t = useTranslations("nav");
  const { mobileOpen, setMobileOpen } = useSidebar();

  const ucassNavGroups = getNavForProduct("ucass");

  // Close mobile sidebar on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname, setMobileOpen]);

  useEffect(() => {
    const isUcass = pathname.startsWith("/ucass");
    if (isUcass && !wasUcassRef.current) {
      setUniteExpanded(true);
    } else if (!isUcass) {
      setUniteExpanded(false);
    }
    wasUcassRef.current = isUcass;
  }, [pathname]);

  const navContent = (
    <nav className="p-3">
      <div className="mb-2">
        <Link
          href="/products"
          prefetch={false}
          className={`flex items-center gap-3 px-3 py-2 rounded-[var(--control-radius)] text-sm transition-colors ${
            pathname === "/products"
              ? "bg-[rgba(167,167,190,0.10)] text-gray-900 font-medium"
              : "text-gray-700 hover:bg-[rgba(167,167,190,0.10)]"
          }`}
        >
          {t("items.overview")}
        </Link>
      </div>

      <div className="mb-1">
        <div className="mt-0.5 space-y-0.5">
            {PRODUCTS.map((product) => {
              const isActive =
                product.id === "ucass"
                  ? pathname.startsWith("/ucass")
                  : pathname.startsWith(`/${product.id}`);
              const href =
                product.id === "ucass"
                  ? "/ucass/dashboard"
                  : product.basePath;
              const iconSrc = PRODUCT_ICON_SRC[product.id];

              if (product.id === "ucass") {
                return (
                  <div key={product.id}>
                    <Link
                      href={href}
                      prefetch={false}
                      onClick={(e) => {
                        if (pathname.startsWith("/ucass")) {
                          e.preventDefault();
                          setUniteExpanded((v) => !v);
                        }
                      }}
                      className={`flex items-center gap-3 px-3 py-2 rounded-[var(--control-radius)] text-sm transition-colors ${
                        isActive
                          ? "bg-[rgba(167,167,190,0.10)] text-gray-900 font-medium"
                          : "text-gray-700 hover:bg-[rgba(167,167,190,0.10)]"
                      }`}
                    >
                      <Image
                        src={iconSrc}
                        alt=""
                        aria-hidden="true"
                        width={20}
                        height={20}
                        className="w-5 h-5 shrink-0 rounded-[6px]"
                      />
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
                  className={`flex items-center gap-3 px-3 py-2 rounded-[var(--control-radius)] text-sm transition-colors ${
                    isActive
                      ? "bg-[rgba(167,167,190,0.10)] text-gray-900 font-medium"
                      : "text-gray-700 hover:bg-[rgba(167,167,190,0.10)]"
                  }`}
                >
                  <Image
                    src={iconSrc}
                    alt=""
                    aria-hidden="true"
                    width={20}
                    height={20}
                    className="w-5 h-5 shrink-0 rounded-[6px]"
                  />
                  {product.shortName}
                </Link>
              );
            })}
        </div>
      </div>
    </nav>
  );

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar: drawer on mobile, static on desktop */}
      <aside
        className={`
          w-64 h-full shrink-0 bg-[#F6F6F9] overflow-y-auto
          fixed lg:static inset-y-0 left-0 top-14 lg:top-0 z-50 lg:z-auto
          transform transition-transform duration-200 ease-out
          ${mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        `}
      >
        <div className="flex items-center justify-between px-3 py-3 lg:hidden">
          <span className="text-sm font-medium text-gray-700">Menu</span>
          <button
            onClick={() => setMobileOpen(false)}
            className="p-2 rounded-[var(--control-radius)] hover:bg-[rgba(167,167,190,0.10)] text-gray-600"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        {navContent}
      </aside>
    </>
  );
}
