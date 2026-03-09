import type { LucideIcon } from "lucide-react";
import {
  Phone,
  Bot,
  Video,
  GraduationCap,
  Headphones,
} from "lucide-react";

export type ProductId = "ucass" | "agent" | "huddle" | "coach" | "ucontact";

export interface Product {
  id: ProductId;
  name: string;
  shortName: string;
  description: string;
  icon: LucideIcon;
  basePath: string;
  envUrlKey?: keyof {
    N2P_HUDDLE_URL?: string;
    N2P_AI_AGENT_URL?: string;
    N2P_COACH_URL?: string;
  };
}

export const PRODUCTS: Product[] = [
  {
    id: "ucass",
    name: "UCaaS",
    shortName: "Unite",
    description: "Unified communications — calls, voicemail, routing, devices",
    icon: Phone,
    basePath: "/ucass",
  },
  {
    id: "agent",
    name: "AI Agent",
    shortName: "Agent",
    description: "AI assistant for calls and messaging",
    icon: Bot,
    basePath: "/agent",
    envUrlKey: "N2P_AI_AGENT_URL",
  },
  {
    id: "huddle",
    name: "Huddle",
    shortName: "Video",
    description: "Video conferencing and collaboration",
    icon: Video,
    basePath: "/huddle",
    envUrlKey: "N2P_HUDDLE_URL",
  },
  {
    id: "coach",
    name: "Coach",
    shortName: "Coach",
    description: "AI coaching and analytics",
    icon: GraduationCap,
    basePath: "/coach",
    envUrlKey: "N2P_COACH_URL",
  },
  {
    id: "ucontact",
    name: "Ucontact",
    shortName: "Ucontact",
    description: "Contact center and workforce management",
    icon: Headphones,
    basePath: "/ucontact",
  },
];

export function getProductById(id: ProductId): Product | undefined {
  return PRODUCTS.find((p) => p.id === id);
}

export function getProductFromPath(pathname: string): ProductId {
  const segment = pathname.split("/")[1];
  if (segment && PRODUCTS.some((p) => p.id === segment)) {
    return segment as ProductId;
  }
  // /products or other paths default to ucass for sidebar
  return "ucass";
}
