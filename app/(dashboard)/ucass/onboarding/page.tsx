"use client";
import { useTranslations } from "next-intl";
import { Sparkles, MessageCircle } from "lucide-react";
import { useConcierge } from "@/contexts/ConciergeContext";
import { useAssistant } from "@/contexts/AssistantContext";

export default function OnboardingPage() {
  const { open: openConcierge } = useConcierge();
  const { open: openAssistant } = useAssistant();
  const t = useTranslations("onboardingPage");

  const features = [t("feature1"), t("feature2"), t("feature3"), t("feature4")];

  return (
    <div className="max-w-lg mx-auto py-12">
      <div className="text-center mb-10">
        <div className="w-16 h-16 rounded-full bg-[#e8f0fe] flex items-center justify-center mx-auto mb-5">
          <Sparkles className="w-8 h-8 text-[#1a73e8]" />
        </div>
        <h1 className="text-2xl font-medium text-gray-900 mb-2">{t("title")}</h1>
        <p className="text-gray-500 text-sm leading-relaxed">{t("subtitle")}</p>
      </div>

      <div className="bg-white border border-[#dadce0] rounded-2xl p-6 mb-4 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-[#1a73e8] flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <h2 className="text-base font-semibold text-gray-900 mb-1">{t("guidedSetupTitle")}</h2>
            <p className="text-sm text-gray-500 mb-4">{t("guidedSetupDesc")}</p>
            <ul className="space-y-1.5 mb-5">
              {features.map((item) => (
                <li key={item} className="flex items-center gap-2 text-sm text-gray-600">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#1a73e8] shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
            <button
              onClick={openConcierge}
              className="w-full flex items-center justify-center gap-2 px-5 py-2.5 bg-[#1a73e8] text-white text-sm font-medium rounded-lg hover:bg-[#1557b0] transition-colors"
            >
              <Sparkles className="w-4 h-4" />
              {t("startButton")}
            </button>
          </div>
        </div>
      </div>

      <div className="bg-[#f8f9fa] border border-[#e8eaed] rounded-2xl p-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-white border border-[#e8eaed] flex items-center justify-center shrink-0">
            <MessageCircle className="w-4 h-4 text-gray-600" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-800">{t("assistantTitle")}</p>
            <p className="text-xs text-gray-400 mt-0.5">{t("assistantDesc")}</p>
          </div>
          <button
            onClick={openAssistant}
            className="shrink-0 px-3 py-1.5 border border-[#dadce0] text-sm font-medium text-gray-700 rounded-lg hover:bg-white hover:border-[#1a73e8] hover:text-[#1a73e8] transition-colors"
          >
            {t("openButton")}
          </button>
        </div>
      </div>
    </div>
  );
}
