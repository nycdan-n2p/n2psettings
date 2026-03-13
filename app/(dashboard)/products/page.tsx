"use client";

import Link from "next/link";
import { PRODUCTS } from "@/lib/config/products";
import { INTEGRATIONS } from "@/lib/config/integrations";

export default function ProductsPage() {
  return (
    <div>
      <h1 className="text-2xl font-medium text-gray-900 mb-2">Products</h1>
      <p className="text-gray-600 mb-8">
        Select a product to manage its settings.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-12">
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

      <section>
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-4">
          Apps & Integrations
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {INTEGRATIONS.map((integration) => {
            const Logo = integration.Logo;
            return (
              <a
                key={integration.id}
                href={integration.href}
                target="_blank"
                rel="noreferrer"
                className="flex flex-col items-center gap-3 p-4 bg-white rounded-lg border border-[#dadce0] hover:border-[#1a73e8] hover:shadow-md transition-all group"
              >
                <span className="w-9 h-9 flex items-center justify-center [&>svg]:w-9 [&>svg]:h-9">
                  <Logo />
                </span>
                <span className="text-sm font-medium text-gray-700 group-hover:text-[#1a73e8] transition-colors text-center">
                  {integration.name}
                </span>
              </a>
            );
          })}
        </div>
      </section>
    </div>
  );
}
