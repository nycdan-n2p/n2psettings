"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useRef, useEffect } from "react";
import {
  Search,
  Bell,
  ChevronDown,
  User,
  LogOut,
  MessageCircle,
  Bot,
  HelpCircle,
  Sparkles,
  Menu,
  X,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useApp } from "@/contexts/AppContext";
import { useAssistant } from "@/contexts/AssistantContext";
import { useConcierge } from "@/contexts/ConciergeContext";
import { useSidebar } from "@/contexts/SidebarContext";
import { useLocaleContext } from "@/contexts/LocaleContext";
import { clearTokens } from "@/lib/auth";
import { INTEGRATIONS } from "@/lib/config/integrations";

export function TopBar() {
  const t = useTranslations("topbar");
  const te = useTranslations("topbarExtra");
  const { bootstrap } = useApp();
  const { open: openAssistant } = useAssistant();
  const { open: openConcierge } = useConcierge();
  const { toggleMobile } = useSidebar();
  const { locale, locales, localeNames, setLocale } = useLocaleContext();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!userMenuOpen) return;
    const close = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) setUserMenuOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [userMenuOpen]);

  const handleLogout = () => {
    clearTokens();
    window.location.href = "/login";
  };

  const userName =
    bootstrap?.user?.firstName && bootstrap?.user?.lastName
      ? `${bootstrap.user.firstName} ${bootstrap.user.lastName}`
      : bootstrap?.user?.email ?? t("account");

  const unreadCount = bootstrap?.unreadVoicemailCount ?? 0;

  return (
    <header className="h-14 flex items-center justify-between px-3 sm:px-4 text-gray-800 shrink-0 gap-2 bg-[#F9F9FB]">
      <div className="flex items-center gap-2 sm:gap-6 min-w-0">
        <button
          onClick={toggleMobile}
          className="inline-flex md:hidden p-2 rounded-[var(--control-radius)] hover:bg-[#e5e7eb] transition-colors"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <Link href="/products" prefetch={false} className="flex items-center gap-1.5 sm:gap-2 font-medium min-w-0">
          <Image
            src="/net2phone-icon.png"
            alt=""
            aria-hidden="true"
            width={32}
            height={32}
            className="w-8 h-8 shrink-0"
          />
          <span className="text-base sm:text-lg font-semibold truncate">net2phone</span>
          <span className="text-gray-500 text-xs sm:text-sm hidden sm:inline">{t("products")}</span>
        </Link>
        <div className="topbar-search-shell hidden md:flex items-center gap-2 bg-[#e5e7eb] rounded-[var(--control-radius)] px-3 py-1.5 w-64 ml-4">
          <Search className="w-4 h-4 text-gray-500" />
          <input
            type="search"
            placeholder={t("searchPlaceholder")}
            className="topbar-search-input bg-transparent border-none outline-none text-sm placeholder:text-gray-500 w-full"
          />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={openConcierge}
          className="p-2 rounded-full hover:bg-[#e5e7eb] transition-colors"
          title={te("setupWizard")}
          aria-label={te("setupWizard")}
        >
          <Sparkles className="w-5 h-5" />
        </button>
        <button
          onClick={openAssistant}
          className="p-2 rounded-full hover:bg-[#e5e7eb] transition-colors"
          title={t("assistantTitle")}
          aria-label={t("openAssistant")}
        >
          <MessageCircle className="w-5 h-5" />
        </button>
        <Link
          href="/ucass/voicemail"
          prefetch={false}
          className="relative p-2 rounded-full hover:bg-[#e5e7eb] transition-colors"
          title={t("notifications")}
        >
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 min-w-[18px] h-[18px] flex items-center justify-center bg-red-500 text-xs font-medium rounded-full px-1">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Link>
        <div className="relative" ref={userMenuRef}>
          <button
            onClick={() => setUserMenuOpen((o) => !o)}
            className="flex items-center gap-2 p-2 rounded-full hover:bg-[#e5e7eb] transition-colors"
            aria-expanded={userMenuOpen}
            aria-haspopup="true"
          >
            <div className="w-8 h-8 rounded-full bg-[#e5e7eb] flex items-center justify-center">
              <User className="w-4 h-4" />
            </div>
            <ChevronDown className="w-4 h-4" />
          </button>
          {userMenuOpen && (
          <div className="absolute right-0 top-full mt-2 w-[300px] max-w-[calc(100vw-20px)] rounded-[18px] border border-[rgba(167,167,190,0.08)] bg-[#f3f4f6] p-2 shadow-[0_12px_28px_rgba(17,24,39,0.16)] text-gray-900 z-50">
            <div className="rounded-[16px] border border-white bg-[#ffffff] p-2">
              <div className="flex items-center justify-between gap-2 pb-2">
                <div className="min-w-0 flex items-center gap-2">
                  <div className="w-9 h-9 rounded-full overflow-hidden bg-[#e5e7eb] flex items-center justify-center shrink-0">
                    <User className="w-4 h-4 text-gray-600" />
                  </div>
                  <p className="text-sm font-semibold leading-tight truncate">{userName}</p>
                </div>
                <button
                  onClick={() => setUserMenuOpen(false)}
                  className="p-1 rounded-full text-gray-900 hover:bg-[#f3f4f6] transition-colors"
                  aria-label="Close menu"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <button
                onClick={handleLogout}
                className="w-full h-[40px] rounded-[12px] border border-[#e5e7eb] bg-white hover:bg-[#f8fafc] transition-colors px-2.5 flex items-center gap-2 text-sm font-medium text-left"
              >
                <LogOut className="w-3.5 h-3.5 shrink-0" />
                {t("logOut")}
              </button>
            </div>

            <div className="mt-2 rounded-[16px] border border-white bg-[#ffffff] px-2.5 py-2">
              <p className="text-xs font-medium text-gray-500">{te("appsIntegrations")}</p>
              <div className="mt-2 grid grid-cols-4 gap-x-1.5 gap-y-1.5">
                {INTEGRATIONS.map((integration) => {
                  const Logo = integration.Logo;
                  return (
                    <a
                      key={integration.id}
                      href={integration.href}
                      target="_blank"
                      rel="noreferrer"
                      className="flex flex-col items-center gap-1 rounded-lg p-1 hover:bg-gray-50 transition-colors"
                    >
                      <span className="w-9 h-9 flex items-center justify-center [&>svg]:w-9 [&>svg]:h-9 shrink-0">
                        <Logo />
                      </span>
                      <span className="w-full text-center text-[10px] leading-tight text-gray-900 whitespace-nowrap truncate">
                        {integration.name}
                      </span>
                    </a>
                  );
                })}
              </div>
            </div>

            <div className="mt-2 rounded-[16px] border border-white bg-[#ffffff] px-2.5 py-2 space-y-1.5">
              <p className="text-xs font-medium text-gray-500">Language</p>
              <select
                value={locale}
                onChange={(e) => setLocale(e.target.value)}
                className="w-full rounded-[12px] border border-[#e5e7eb] bg-white px-2.5 py-1.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#111827]/15"
                aria-label="Select language"
              >
                {locales.map((l) => (
                  <option key={l} value={l}>
                    {localeNames[l]}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-2 rounded-[16px] border border-white bg-[#ffffff] px-2.5 py-2 space-y-0.5">
              <p className="text-xs font-medium text-gray-500">{te("help")}</p>
              <button
                onClick={() => { openConcierge(); (document.activeElement as HTMLElement)?.blur(); }}
                className="w-full flex items-center gap-2 text-sm text-gray-700 hover:bg-gray-50 px-2 py-1.5 rounded text-left"
              >
                <Sparkles className="w-4 h-4 shrink-0 text-[#5b21b6]" />
                {te("setupWizard")}
              </button>
              <button
                onClick={() => { openAssistant(); (document.activeElement as HTMLElement)?.blur(); }}
                className="w-full flex items-center gap-2 text-sm text-gray-700 hover:bg-gray-50 px-2 py-1.5 rounded text-left"
              >
                <Bot className="w-4 h-4 shrink-0" />
                {t("assistantTitle")}
              </button>
              <a
                href="https://support.net2phone.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-gray-700 hover:bg-gray-50 px-2 py-1.5 rounded"
              >
                <HelpCircle className="w-4 h-4 shrink-0" />
                {t("helpSupport")}
              </a>
            </div>

            <div className="mt-2 rounded-[16px] border border-white bg-[#ffffff] px-2.5 py-2 space-y-0.5">
              <a
                href="https://www.net2phone.com/terms-of-service"
                target="_blank"
                rel="noopener noreferrer"
                className="block text-sm text-gray-700 hover:bg-gray-50 px-2 py-1.5 rounded"
              >
                {te("termsOfService")}
              </a>
              <a
                href="https://www.net2phone.com/privacy-policy"
                target="_blank"
                rel="noopener noreferrer"
                className="block text-sm text-gray-700 hover:bg-gray-50 px-2 py-1.5 rounded"
              >
                {te("privacyPolicy")}
              </a>
            </div>
          </div>
          )}
        </div>
      </div>
    </header>
  );
}
