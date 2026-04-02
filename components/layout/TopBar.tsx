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
    <header className="h-14 flex items-center justify-between px-3 sm:px-4 text-gray-800 shrink-0 gap-2 bg-[#F6F6F9]">
      <div className="flex items-center gap-2 sm:gap-6 min-w-0">
        <button
          onClick={toggleMobile}
          className="hidden"
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
          <div className="absolute right-0 top-full mt-1 py-1 w-56 bg-white rounded-md shadow-lg text-gray-900 z-50">
            <div className="px-3 py-2 border-b border-gray-100">
              <p className="text-sm font-medium truncate">{userName}</p>
              <p className="text-xs text-gray-500 truncate">
                {bootstrap?.user?.email}
              </p>
            </div>
            <div className="border-b border-gray-100">
              <p className="px-3 pt-2 pb-1 text-xs font-medium text-gray-400 uppercase tracking-wide">
                {te("appsIntegrations")}
              </p>
              <div className="grid grid-cols-3 gap-1 px-2 pb-2">
                {INTEGRATIONS.map((integration) => {
                  const Logo = integration.Logo;
                  return (
                    <a
                      key={integration.id}
                      href={integration.href}
                      target="_blank"
                      rel="noreferrer"
                      className="flex flex-col items-center gap-1.5 p-2 rounded-md hover:bg-gray-50 transition-colors"
                    >
                      <span className="w-8 h-8 flex items-center justify-center [&>svg]:w-8 [&>svg]:h-8 shrink-0">
                        <Logo />
                      </span>
                      <span className="text-xs font-medium text-gray-700 truncate w-full text-center">
                        {integration.name}
                      </span>
                    </a>
                  );
                })}
              </div>
            </div>
            <div className="border-b border-gray-100 px-3 py-2">
              <p className="px-2 pb-1 text-xs font-medium text-gray-400 uppercase tracking-wide">
                Language
              </p>
              <div className="space-y-1">
                {locales.map((l) => (
                  <button
                    key={l}
                    onClick={() => setLocale(l)}
                    className={`w-full text-left text-sm -mx-2 px-2 py-1.5 rounded transition-colors ${
                      l === locale
                        ? "bg-gray-100 text-gray-900 font-medium"
                        : "text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    {localeNames[l]}
                  </button>
                ))}
              </div>
            </div>
            <div className="border-b border-gray-100 px-3 py-2 space-y-1">
              <p className="px-2 pb-1 text-xs font-medium text-gray-400 uppercase tracking-wide">
                {te("help")}
              </p>
              <button
                onClick={() => { openConcierge(); (document.activeElement as HTMLElement)?.blur(); }}
                className="w-full flex items-center gap-2 text-sm text-gray-700 hover:bg-gray-50 -mx-2 px-2 py-1.5 rounded text-left"
              >
                <Sparkles className="w-4 h-4 shrink-0 text-[#5b21b6]" />
                {te("setupWizard")}
              </button>
              <button
                onClick={() => { openAssistant(); (document.activeElement as HTMLElement)?.blur(); }}
                className="w-full flex items-center gap-2 text-sm text-gray-700 hover:bg-gray-50 -mx-2 px-2 py-1.5 rounded text-left"
              >
                <Bot className="w-4 h-4 shrink-0" />
                {t("assistantTitle")}
              </button>
              <a
                href="https://support.net2phone.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-gray-700 hover:bg-gray-50 -mx-2 px-2 py-1.5 rounded"
              >
                <HelpCircle className="w-4 h-4 shrink-0" />
                {t("helpSupport")}
              </a>
            </div>
            <div className="border-b border-gray-100 px-3 py-2 space-y-1">
              <a
                href="https://www.net2phone.com/terms-of-service"
                target="_blank"
                rel="noopener noreferrer"
                className="block text-sm text-gray-700 hover:bg-gray-50 -mx-2 px-2 py-1 rounded"
              >
                {te("termsOfService")}
              </a>
              <a
                href="https://www.net2phone.com/privacy-policy"
                target="_blank"
                rel="noopener noreferrer"
                className="block text-sm text-gray-700 hover:bg-gray-50 -mx-2 px-2 py-1 rounded"
              >
                {te("privacyPolicy")}
              </a>
            </div>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-100"
            >
              <LogOut className="w-4 h-4" />
              {t("logOut")}
            </button>
          </div>
          )}
        </div>
      </div>
    </header>
  );
}
