"use client";
import { useTranslations } from "next-intl";

import Link from "next/link";
import Image from "next/image";
import { PRODUCTS } from "@/lib/config/products";

const PRODUCT_ICON_SRC: Record<string, string> = {
  ucass: "/sidebar-icons/unite.svg",
  agent: "/sidebar-icons/agent.svg",
  huddle: "/sidebar-icons/huddle.svg",
  coach: "/sidebar-icons/coach.svg",
  ucontact: "/sidebar-icons/ucontact.svg",
};

export default function ProductsPage() {
  const t = useTranslations("productsPage");
  return (
    <div>
      <h1 className="text-2xl font-medium text-gray-900 mb-2">{t("title")}</h1>
      <p className="text-gray-600 mb-8">{t("subtitle")}</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {PRODUCTS.map((product) => {
          const iconSrc = PRODUCT_ICON_SRC[product.id];
          const href =
            product.id === "ucass"
              ? "/ucass/dashboard"
              : product.basePath;

          return (
            <Link
              key={product.id}
              href={href}
              prefetch={false}
              className="group block p-6 bg-[#F6F6F9] rounded-[20px] shadow-sm hover:scale-[1.02] transition-transform"
            >
              <div className="flex items-start gap-4">
                <Image
                  src={iconSrc}
                  alt=""
                  aria-hidden="true"
                  width={36}
                  height={36}
                  className="w-9 h-9 rounded-[8px] self-start mt-0.5 shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-gray-900 transition-colors">
                    {product.name}
                  </h3>
                  <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">
                    {product.description}
                  </p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
