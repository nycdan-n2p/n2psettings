"use client";

import React from "react";
import { CheckCircle2, Lock, Mail } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import {
  FEATURE_MARKETING,
  hasMarketingContent,
  type FeatureMarketingInfo,
} from "@/lib/config/feature-marketing";

// ── Colour maps ───────────────────────────────────────────────────────────────
const BG: Record<FeatureMarketingInfo["color"], string> = {
  blue:   "bg-blue-50",
  purple: "bg-purple-50",
  green:  "bg-emerald-50",
  orange: "bg-orange-50",
  teal:   "bg-gradient-to-br from-blue-50 to-rose-50",
  rose:   "bg-rose-50",
};
const ICON_BG: Record<FeatureMarketingInfo["color"], string> = {
  blue:   "bg-blue-100",
  purple: "bg-purple-100",
  green:  "bg-emerald-100",
  orange: "bg-orange-100",
  teal:   "bg-gradient-to-br from-blue-100 to-rose-100",
  rose:   "bg-rose-100",
};
const ICON_TEXT: Record<FeatureMarketingInfo["color"], string> = {
  blue:   "text-blue-600",
  purple: "text-purple-600",
  green:  "text-emerald-600",
  orange: "text-orange-600",
  teal:   "text-blue-600",
  rose:   "text-rose-600",
};
const BADGE_BG: Record<FeatureMarketingInfo["color"], string> = {
  blue:   "bg-blue-100 text-blue-700",
  purple: "bg-purple-100 text-purple-700",
  green:  "bg-emerald-100 text-emerald-700",
  orange: "bg-orange-100 text-orange-700",
  teal:   "bg-gradient-to-r from-blue-100 to-rose-100 text-rose-700",
  rose:   "bg-rose-100 text-rose-700",
};
const BTN: Record<FeatureMarketingInfo["color"], string> = {
  blue:   "bg-blue-600 hover:bg-blue-700",
  purple: "bg-purple-600 hover:bg-purple-700",
  green:  "bg-emerald-600 hover:bg-emerald-700",
  orange: "bg-orange-600 hover:bg-orange-700",
  teal:   "bg-gradient-to-r from-blue-600 to-rose-500 hover:from-blue-700 hover:to-rose-600",
  rose:   "bg-rose-600 hover:bg-rose-700",
};
const CHECK_TEXT: Record<FeatureMarketingInfo["color"], string> = {
  blue:   "text-blue-500",
  purple: "text-purple-500",
  green:  "text-emerald-500",
  orange: "text-orange-500",
  teal:   "text-rose-500",
  rose:   "text-rose-500",
};

// ── Upsell page ───────────────────────────────────────────────────────────────
function FeatureUpsellPage({ info }: { info: FeatureMarketingInfo }) {
  const { color } = info;
  const Icon = info.icon;

  return (
    <div className="max-w-2xl">
      {/* Hero card */}
      <div className={`rounded-[20px] border border-gray-200 overflow-hidden mb-6`}>
        {/* Gradient header strip */}
        <div
          className="h-2 w-full"
          style={{ background: "linear-gradient(to right, #0d1b4b, #5b21b6, #c026d3, #e91e8c)" }}
        />

        <div className={`${BG[color]} px-8 py-8`}>
          <div className="flex items-start gap-5">
            <div className={`w-14 h-14 rounded-[20px] ${ICON_BG[color]} flex items-center justify-center shrink-0`}>
              <Icon className={`w-7 h-7 ${ICON_TEXT[color]}`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-xl font-semibold text-gray-900">{info.title}</h1>
                <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${BADGE_BG[color]}`}>
                  <Lock className="w-3 h-3" />
                  Not included in your plan
                </span>
              </div>
              <p className="text-base text-gray-600 leading-relaxed">{info.tagline}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Description + benefits */}
      <div className="bg-white rounded-[20px] border border-gray-200 px-8 py-7 mb-6">
        <p className="text-sm text-gray-600 leading-relaxed mb-6">{info.description}</p>

        <h2 className="text-sm font-semibold text-gray-800 mb-4">What&apos;s included:</h2>
        <ul className="space-y-3">
          {info.benefits.map((benefit) => (
            <li key={benefit} className="flex items-start gap-3">
              <CheckCircle2 className={`w-4 h-4 mt-0.5 shrink-0 ${CHECK_TEXT[color]}`} />
              <span className="text-sm text-gray-700">{benefit}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Plan + CTA */}
      <div className="bg-white rounded-[20px] border border-gray-200 px-8 py-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-xs text-gray-500 mb-0.5">Available as</p>
            <p className="text-sm font-medium text-gray-900">{info.planLabel}</p>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="mailto:sales@net2phone.com?subject=Upgrade%20Inquiry"
              className={`flex items-center gap-2 px-5 py-2.5 ${BTN[color]} text-white rounded-lg text-sm font-medium transition-colors`}
            >
              <Mail className="w-4 h-4" />
              Contact Sales to Upgrade
            </a>
            <a
              href="https://net2phone.com"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Learn More
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── FeatureGate wrapper ───────────────────────────────────────────────────────

interface FeatureGateProps {
  /** Feature flag name from GET /api/features e.g. "CallQueue" */
  feature: string;
  children: React.ReactNode;
}

/**
 * Wraps page content with a feature flag check.
 * - If the feature flag is true (or not yet loaded): renders children normally.
 * - If the feature flag is false AND marketing content exists: renders the upsell page.
 * - If the feature flag is false AND no marketing content: still renders children
 *   (internal/infrastructure flags should not block UI).
 */
export function FeatureGate({ feature, children }: FeatureGateProps) {
  const { bootstrap } = useApp();

  // While loading bootstrap, render children optimistically (avoids flash)
  if (!bootstrap) return <>{children}</>;

  const flagValue = bootstrap.features?.[feature];

  // Feature is enabled or flag is unknown — render normally
  if (flagValue !== false) return <>{children}</>;

  // Feature is off — show upsell if we have marketing content
  if (hasMarketingContent(feature)) {
    return <FeatureUpsellPage info={FEATURE_MARKETING[feature]} />;
  }

  // No marketing content for this flag — render children anyway
  return <>{children}</>;
}
