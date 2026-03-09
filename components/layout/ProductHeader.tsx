"use client";

import { getProductById, type ProductId } from "@/lib/config/products";

interface ProductHeaderProps {
  productId: ProductId;
  title?: string;
  status?: string;
  children?: React.ReactNode;
}

export function ProductHeader({
  productId,
  title,
  status,
  children,
}: ProductHeaderProps) {
  const product = getProductById(productId);
  const Icon = product?.icon;
  const displayTitle = title ?? product?.name ?? "Product";

  return (
    <div className="bg-white rounded-lg border border-[#dadce0] p-4 mb-6">
      <div className="flex items-start gap-4">
        {Icon && (
          <div className="w-12 h-12 rounded-lg bg-[#e8f0fe] flex items-center justify-center shrink-0">
            <Icon className="w-6 h-6 text-[#1a73e8]" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-medium text-gray-900">{displayTitle}</h2>
          {status && (
            <p className="text-sm text-gray-600 mt-0.5">
              Status: {status}
            </p>
          )}
          {children}
        </div>
      </div>
    </div>
  );
}
