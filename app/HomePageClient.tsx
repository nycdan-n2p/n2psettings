"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { hasAuth } from "@/lib/auth";
import { Loader } from "@/components/ui/Loader";

export default function HomePageClient() {
  const router = useRouter();

  useEffect(() => {
    if (hasAuth()) {
      router.replace("/products");
    } else {
      router.replace("/login");
    }
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8f9fa]">
      <Loader variant="full" label="Redirecting..." />
    </div>
  );
}
