"use client";

import { useTranslations } from "next-intl";
import { Plus_Jakarta_Sans } from "next/font/google";
import { useConcierge } from "@/contexts/ConciergeContext";
import { WelcomeAgentAvatar } from "@/components/welcome/WelcomeAgentAvatar";

const welcomeFont = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

export default function WelcomePage() {
  const t = useTranslations("welcomeLanding");
  const { open, isOpen } = useConcierge();

  return (
    <div
      className={`${welcomeFont.className} min-h-screen relative overflow-hidden text-[#0f172a]`}
    >
      {/* Atmospheric gradient — net2phone-adjacent cool tones + soft warmth */}
      <div
        className="absolute inset-0 bg-gradient-to-b from-[#e8f4fc] via-[#f5f0fa] to-[#fce8f0] opacity-90"
        aria-hidden="true"
      />
      <div
        className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(56,189,248,0.25),transparent)]"
        aria-hidden="true"
      />
      <div
        className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_100%_100%,rgba(236,72,153,0.12),transparent)]"
        aria-hidden="true"
      />

      <div className="relative z-10 min-h-screen flex flex-col">
        <header className="shrink-0 px-6 sm:px-10 pt-8 pb-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <WelcomeAgentAvatar size={44} />
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#64748b]">
                {t("badge")}
              </p>
              <p className="text-lg font-extrabold tracking-tight text-[#0f172a]">net2phone</p>
            </div>
          </div>
          <div
            className="hidden sm:block h-px flex-1 max-w-[120px] mx-4 bg-gradient-to-r from-cyan-400 via-violet-500 to-fuchsia-500 rounded-full opacity-80"
            aria-hidden="true"
          />
        </header>

        <main className="flex-1 flex flex-col items-center justify-center px-6 sm:px-10 pb-24 sm:pb-32">
          <div className="max-w-2xl w-full text-center space-y-6 motion-safe:animate-[welcomeFade_0.8s_ease-out_both]">
            {/* Account confirmed pill */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold">
              <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <circle cx="8" cy="8" r="7.5" stroke="currentColor" strokeWidth="1" />
                <path d="M5 8.5l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {t("confirmedLabel")}
            </div>

            <h1 className="text-4xl sm:text-5xl md:text-[3.25rem] font-extrabold tracking-tight leading-[1.08] text-[#0f172a]">
              {t("headlinePrefix")}{" "}
              <span className="bg-gradient-to-r from-sky-500 via-violet-600 to-fuchsia-500 bg-clip-text text-transparent">
                {t("headlineAccent")}
              </span>
            </h1>

            <p className="text-sm sm:text-base text-[#475569] max-w-md mx-auto leading-relaxed">
              {t("subcopy")}
            </p>

            <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => open()}
                className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-2xl text-sm font-bold text-white bg-gradient-to-r from-[#1a73e8] via-[#6366f1] to-[#a855f7] shadow-lg shadow-indigo-500/25 hover:shadow-xl hover:shadow-indigo-500/30 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
              >
                <WelcomeAgentAvatar size={28} />
                {t("ctaOpen")}
              </button>
              {!isOpen && (
                <p className="text-xs text-[#64748b]">{t("ctaHint")}</p>
              )}
            </div>
          </div>

          <div className="mt-16 sm:mt-20 w-full max-w-xl">
            <div
              className="rounded-3xl border border-white/60 bg-white/40 backdrop-blur-md p-6 sm:p-8 shadow-[0_20px_60px_-15px_rgba(15,23,42,0.12)]"
            >
              <p className="text-xs font-bold uppercase tracking-wider text-[#64748b] mb-3">
                {t("cardTitle")}
              </p>
              <ul className="space-y-2.5 text-left text-sm text-[#334155]">
                <li className="flex gap-2">
                  <span className="text-sky-500 font-bold shrink-0">01</span>
                  {t("step1")}
                </li>
                <li className="flex gap-2">
                  <span className="text-violet-500 font-bold shrink-0">02</span>
                  {t("step2")}
                </li>
                <li className="flex gap-2">
                  <span className="text-fuchsia-500 font-bold shrink-0">03</span>
                  {t("step3")}
                </li>
              </ul>
            </div>
          </div>
        </main>

        <footer className="shrink-0 px-6 py-6 text-center text-[11px] text-[#94a3b8]">
          {t("footer")}
        </footer>
      </div>
    </div>
  );
}
