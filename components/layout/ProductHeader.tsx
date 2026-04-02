"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { getProductById, type ProductId } from "@/lib/config/products";

interface ProductHeaderProps {
  productId: ProductId;
  title?: string;
  status?: string;
  children?: React.ReactNode;
}

const PRODUCT_ICON_SRC: Record<ProductId, string> = {
  ucass: "/sidebar-icons/unite.svg",
  agent: "/sidebar-icons/agent.svg",
  huddle: "/sidebar-icons/huddle.svg",
  coach: "/sidebar-icons/coach.svg",
  ucontact: "/sidebar-icons/ucontact.svg",
};

export function ProductHeader({
  productId,
  title,
  status,
  children,
}: ProductHeaderProps) {
  const tc = useTranslations("common");
  const product = getProductById(productId);
  const displayTitle = title ?? product?.name ?? "Product";

  return (
    <div className="bg-white rounded-lg border border-[#dadce0] p-4 mb-6">
      <div className="flex items-start gap-4">
        <Image
          src={PRODUCT_ICON_SRC[productId]}
          alt=""
          aria-hidden="true"
          width={48}
          height={48}
          className="w-12 h-12 rounded-[10px] shrink-0"
        />
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-medium text-gray-900">{displayTitle}</h2>
          {status && (
            <p className="text-sm text-gray-600 mt-0.5">
              {tc("status")}: {status}
            </p>
          )}
          {children}
        </div>
      </div>
    </div>
  );
}
