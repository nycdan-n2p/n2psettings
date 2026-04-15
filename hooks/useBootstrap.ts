"use client";

import { useApp } from "@/contexts/AppContext";

export function useBootstrap() {
  return useApp();
}
