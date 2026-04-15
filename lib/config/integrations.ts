import type { ComponentType } from "react";
import {
  WallboardsLogo,
  SupervisorLogo,
  HuddleLogo,
  RconLogo,
  Net2phoneLogo,
  UcontactLogo,
} from "@/components/integrations/IntegrationLogos";

export interface Integration {
  id: string;
  name: string;
  href: string;
  Logo: ComponentType<{ className?: string }>;
}

export const INTEGRATIONS: Integration[] = [
  {
    id: "wallboards",
    name: "Wallboards",
    href: "https://wallboard.net2phone.com",
    Logo: WallboardsLogo,
  },
  {
    id: "supervisor",
    name: "Supervisor",
    href: "https://supervisor.net2phone.com",
    Logo: SupervisorLogo,
  },
  {
    id: "huddle",
    name: "Huddle",
    href: "https://huddle.net2phone.com",
    Logo: HuddleLogo,
  },
  {
    id: "rcon",
    name: "Rcon",
    href: "https://rcon.net2phone.com",
    Logo: RconLogo,
  },
  {
    id: "net2phone",
    name: "net2phone",
    href: "https://app.net2phone.com",
    Logo: Net2phoneLogo,
  },
  {
    id: "ucontact",
    name: "uContact",
    href: "https://demox-eng.ucontactcloud.com/",
    Logo: UcontactLogo,
  },
];
