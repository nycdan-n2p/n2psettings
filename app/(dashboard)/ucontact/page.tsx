"use client";

import { ProductHeader } from "@/components/layout/ProductHeader";

export default function UcontactProductPage() {
  return (
    <div>
      <ProductHeader
        productId="ucontact"
        status="Coming soon"
      />
      <p className="text-gray-600 mb-6">
        Contact center and workforce management settings.
      </p>

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h2 className="text-lg font-medium text-gray-900">Ucontact Settings</h2>
        </div>
        <div className="px-6 py-6">
          <p className="text-sm text-gray-600 mb-4">
            Contact center settings will be available here. Configure queues, agents, and workforce management.
          </p>
          <p className="text-sm text-gray-500">
            Coming soon.
          </p>
        </div>
      </div>
    </div>
  );
}
