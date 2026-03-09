"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { useState } from "react";
import { getNavForProduct } from "@/lib/config/nav";
import { getProductFromPath, PRODUCTS } from "@/lib/config/products";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  feature?: string;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

function NavGroupSection({ group }: { group: NavGroup }) {
  const pathname = usePathname();
  const { bootstrap } = useApp();
  const [expanded, setExpanded] = useState(true);

  const visibleItems = group.items.filter((item) => {
    if (!item.feature) return true;
    return bootstrap?.features?.[item.feature] !== false;
  });

  if (visibleItems.length === 0) return null;

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
        {group.label}
      </button>
      {expanded && (
        <div className="space-y-0.5">
          {visibleItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch={false}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                  isActive
                    ? "bg-[#e8f0fe] text-[#1a73e8] font-medium"
                    : "text-gray-700 hover:bg-[#e8eaed]"
                }`}
              >
                <Icon className="w-5 h-5 shrink-0" />
                {item.label}
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

  const ucassNavGroups = getNavForProduct("ucass");

  return (
    <aside className="w-64 shrink-0 bg-white border-r border-[#dadce0] overflow-y-auto">
      <nav className="p-3">
        <div className="mb-2">
          <p className="px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider">
            Apps
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
            Overview
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
            net2phone products
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
