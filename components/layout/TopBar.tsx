"use client";

import Link from "next/link";
import {
  Search,
  Bell,
  ChevronDown,
  User,
  LogOut,
  MessageCircle,
} from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { useAssistant } from "@/contexts/AssistantContext";
import { clearTokens } from "@/lib/auth";

export function TopBar() {
  const { bootstrap } = useApp();
  const { open: openAssistant } = useAssistant();

  const handleLogout = () => {
    clearTokens();
    window.location.href = "/login";
  };

  const userName =
    bootstrap?.user?.firstName && bootstrap?.user?.lastName
      ? `${bootstrap.user.firstName} ${bootstrap.user.lastName}`
      : bootstrap?.user?.email ?? "User";

  const unreadCount = bootstrap?.unreadVoicemailCount ?? 0;

  return (
    <header className="h-14 flex items-center justify-between px-4 bg-[#1a73e8] text-white shrink-0">
      <div className="flex items-center gap-6">
        <Link href="/products" prefetch={false} className="flex items-center gap-2 font-medium">
          <span className="text-lg font-semibold">net2phone</span>
          <span className="text-white/80 text-sm">Settings</span>
        </Link>
        <div className="hidden md:flex items-center gap-2 bg-white/20 rounded-md px-3 py-1.5 w-64">
          <Search className="w-4 h-4 text-white/80" />
          <input
            type="search"
            placeholder="Search..."
            className="bg-transparent border-none outline-none text-sm placeholder:text-white/70 w-full"
          />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm text-white/90 hidden sm:block">
          {bootstrap?.account?.company ?? "Account"}
        </span>
        <button
          onClick={openAssistant}
          className="p-2 rounded-full hover:bg-white/20 transition-colors"
          title="N2P Assistant"
          aria-label="Open assistant"
        >
          <MessageCircle className="w-5 h-5" />
        </button>
        <Link
          href="/ucass/voicemail"
          prefetch={false}
          className="relative p-2 rounded-full hover:bg-white/20 transition-colors"
          title="Voicemail"
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
          <div className="absolute right-0 top-full mt-1 py-1 w-48 bg-white rounded-md shadow-lg text-gray-900 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
            <div className="px-3 py-2 border-b border-gray-100">
              <p className="text-sm font-medium truncate">{userName}</p>
              <p className="text-xs text-gray-500 truncate">
                {bootstrap?.user?.email}
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-100"
            >
              <LogOut className="w-4 h-4" />
              Sign out
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
