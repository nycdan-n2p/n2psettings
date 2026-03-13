"use client";

import Link from "next/link";
import { PRODUCTS } from "@/lib/config/products";

export default function ProductsPage() {
  return (
    <div>
      <h1 className="text-2xl font-medium text-gray-900 mb-2">Products</h1>
      <p className="text-gray-600 mb-8">
        Select a product to manage its settings.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {PRODUCTS.map((product) => {
          const Icon = product.icon;
          const href =
            product.id === "ucass"
              ? "/ucass/dashboard"
              : product.basePath;

          return (
            <Link
              key={product.id}
              href={href}
              prefetch={false}
              className="group block p-6 bg-white rounded-lg border border-[#dadce0] hover:border-[#1a73e8] hover:shadow-md transition-all"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-lg bg-[#e8f0fe] flex items-center justify-center group-hover:bg-[#1a73e8]/10 transition-colors">
                  <Icon className="w-6 h-6 text-[#1a73e8]" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-gray-900 group-hover:text-[#1a73e8] transition-colors">
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
