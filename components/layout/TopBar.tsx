"use client";

import Link from "next/link";
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
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useApp } from "@/contexts/AppContext";
import { useAssistant } from "@/contexts/AssistantContext";
import { useConcierge } from "@/contexts/ConciergeContext";
import { clearTokens } from "@/lib/auth";
import { INTEGRATIONS } from "@/lib/config/integrations";
import { LocaleSelector } from "@/components/ui/LocaleSelector";

export function TopBar() {
  const t = useTranslations("topbar");
  const { bootstrap } = useApp();
  const { open: openAssistant } = useAssistant();
  const { open: openConcierge } = useConcierge();

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
    <header className="h-14 flex items-center justify-between px-4 bg-[#1a73e8] text-white shrink-0">
      <div className="flex items-center gap-6">
        <Link href="/products" prefetch={false} className="flex items-center gap-2 font-medium">
          <span className="text-lg font-semibold">net2phone</span>
          <span className="text-white/80 text-sm">{t("products")}</span>
        </Link>
        <div className="hidden md:flex items-center gap-2 bg-white/20 rounded-md px-3 py-1.5 w-64">
          <Search className="w-4 h-4 text-white/80" />
          <input
            type="search"
            placeholder={t("searchPlaceholder")}
            className="bg-transparent border-none outline-none text-sm placeholder:text-white/70 w-full"
          />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm text-white/90 hidden sm:block">
          {bootstrap?.account?.company ?? t("account")}
        </span>
        <LocaleSelector />
        <button
          onClick={openConcierge}
          className="p-2 rounded-full hover:bg-white/20 transition-colors"
          title="Setup Wizard"
          aria-label="Open setup wizard"
        >
          <Sparkles className="w-5 h-5" />
        </button>
        <button
          onClick={openAssistant}
          className="p-2 rounded-full hover:bg-white/20 transition-colors"
          title={t("assistantTitle")}
          aria-label={t("openAssistant")}
        >
          <MessageCircle className="w-5 h-5" />
        </button>
        <Link
          href="/ucass/voicemail"
          prefetch={false}
          className="relative p-2 rounded-full hover:bg-white/20 transition-colors"
          title={t("notifications")}
        >
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 min-w-[18px] h-[18px] flex items-center justify-center bg-red-500 text-xs font-medium rounded-full px-1">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Link>
        <div className="relative group">
          <button className="flex items-center gap-2 p-2 rounded-full hover:bg-white/20 transition-colors">
            <div className="w-8 h-8 rounded-full bg-white/30 flex items-center justify-center">
              <User className="w-4 h-4" />
            </div>
            <ChevronDown className="w-4 h-4" />
          </button>
          <div className="absolute right-0 top-full mt-1 py-1 w-56 bg-white rounded-md shadow-lg text-gray-900 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
            <div className="px-3 py-2 border-b border-gray-100">
              <p className="text-sm font-medium truncate">{userName}</p>
              <p className="text-xs text-gray-500 truncate">
                {bootstrap?.user?.email}
              </p>
            </div>
            <div className="border-b border-gray-100">
              <p className="px-3 pt-2 pb-1 text-xs font-medium text-gray-400 uppercase tracking-wide">
                Apps &amp; Integrations
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
            <div className="border-b border-gray-100 px-3 py-2 space-y-1">
              <p className="px-2 pb-1 text-xs font-medium text-gray-400 uppercase tracking-wide">
                Help
              </p>
              <button
                onClick={() => { openConcierge(); (document.activeElement as HTMLElement)?.blur(); }}
                className="w-full flex items-center gap-2 text-sm text-gray-700 hover:bg-gray-50 -mx-2 px-2 py-1.5 rounded text-left"
              >
                <Sparkles className="w-4 h-4 shrink-0 text-[#1a73e8]" />
                Setup Wizard
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
                Terms of Service
              </a>
              <a
                href="https://www.net2phone.com/privacy-policy"
                target="_blank"
                rel="noopener noreferrer"
                className="block text-sm text-gray-700 hover:bg-gray-50 -mx-2 px-2 py-1 rounded"
              >
                Privacy Policy
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
        </div>
      </div>
    </header>
  );
}
