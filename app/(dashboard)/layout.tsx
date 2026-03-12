"use client";

import { TopBar } from "@/components/layout/TopBar";
import { Sidebar } from "@/components/layout/Sidebar";
import { AssistantSidePanel } from "@/components/assistant/AssistantSidePanel";
import { AssistantProvider } from "@/contexts/AssistantContext";
import { Loader } from "@/components/ui/Loader";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { useApp } from "@/contexts/AppContext";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { hasAuth } from "@/lib/auth";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  const { loading, error } = useApp();
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && !loading && !hasAuth()) {
      router.push("/login");
      return;
    }
  }, [mounted, loading, router]);

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8f9fa]">
        <Loader variant="full" label="Loading..." />
      </div>
    );
  }

  if (!hasAuth()) {
    return null;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8f9fa]">
        <Loader variant="full" label="Loading..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8f9fa]">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-[#1a73e8] text-white rounded-md hover:bg-[#1557b0]"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <AssistantProvider>
      <div className="min-h-screen flex flex-col bg-[#f8f9fa]">
        <TopBar />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar />
          <main className="flex-1 overflow-auto p-6">
            <ErrorBoundary>{children}</ErrorBoundary>
          </main>
        </div>
        <AssistantSidePanel />
      </div>
    </AssistantProvider>
  );
}
