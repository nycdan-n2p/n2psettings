import type { ProductId } from "./products";
import {
  LayoutDashboard,
  Phone,
  Building2,
  Users,
  Network,
  PhoneCall,
  ListOrdered,
  Bot,
  Hash,
  Smartphone,
  Clock,
  Star,
  Cable,
  Link2,
  Webhook,
  Settings,
  FolderOpen,
  Shield,
  AlertTriangle,
  UserPlus,
  FileBarChart,
  Truck,
  Package,
  BarChart2,
  Printer,
  Music,
  KeyRound,
  PhoneOff,
} from "lucide-react";

interface NavItem {
  href?: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  feature?: string;
  /** If set, clicking opens the assistant side panel instead of navigating */
  action?: "openAssistant";
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

function ucassNav(base: string): NavGroup[] {
  return [
    {
      label: "Overview",
      items: [
        { href: `${base}/dashboard`, label: "Dashboard", icon: LayoutDashboard },
        { href: `${base}/analytics`, label: "Analytics", icon: BarChart2 },
      ],
    },
    {
      label: "Communications",
      items: [
        { href: `${base}/calls`, label: "Call History", icon: Phone },
        { href: `${base}/virtual-fax`, label: "Virtual Fax", icon: Printer, feature: "IsVirtualFaxEnabled" },
      ],
    },
    {
      label: "Organization",
      items: [
        { href: `${base}/company`, label: "Company", icon: Building2 },
        { href: `${base}/team-members`, label: "Team Members", icon: Users },
        { href: `${base}/departments`, label: "Departments", icon: Network },
        { href: `${base}/settings/company-directory`, label: "Company Directory", icon: FolderOpen, feature: "CompanyDirectory" },
        { href: `${base}/settings/delegates`, label: "Delegates", icon: UserPlus, feature: "CustomerDelegateManagement" },
      ],
    },
    {
      label: "Call Routing",
      items: [
        { href: `${base}/virtual-assistant`, label: "Virtual Assistant", icon: PhoneCall },
        { href: `${base}/ring-groups`, label: "Ring Groups", icon: Users },
        { href: `${base}/call-queues`, label: "Call Queues", icon: ListOrdered, feature: "CallQueue" },
        { href: `${base}/schedules`, label: "Schedules", icon: Clock },
        { href: `${base}/special-extensions`, label: "Special Extensions", icon: Star },
      ],
    },
    {
      label: "Resources",
      items: [
        { href: `${base}/phone-numbers`, label: "Phone Numbers", icon: Hash },
        { href: `${base}/devices`, label: "Devices", icon: Smartphone },
        { href: `${base}/devices/management`, label: "Device Management", icon: Settings },
        { href: `${base}/call-blocking`, label: "Call Blocking", icon: PhoneOff, feature: "CallBlocking" },
      ],
    },
    {
      label: "Integrations",
      items: [
        { href: `${base}/sip-trunking`, label: "SIP Trunking", icon: Cable, feature: "SipTrunkingManagement" },
        { href: `${base}/sip-tie-lines`, label: "SIP Tie-Lines", icon: Link2 },
        { href: `${base}/settings/webhooks`, label: "Webhooks", icon: Webhook },
        { href: `${base}/settings/api-setup`, label: "API Keys", icon: KeyRound },
      ],
    },
    {
      label: "Compliance",
      items: [
        { href: `${base}/settings/911-contacts`, label: "Emergency Settings", icon: AlertTriangle },
        { href: `${base}/settings/trust-center`, label: "Trust Center", icon: Shield },
      ],
    },
    {
      label: "Settings",
      items: [
        { href: `${base}/settings/voicemail`, label: "Voicemail Settings", icon: Settings },
        { href: `${base}/settings/music-options`, label: "Music Options", icon: Music },
        { href: `${base}/settings/licenses`, label: "Licenses", icon: FileBarChart },
        { href: `${base}/settings/number-porting`, label: "Number Porting", icon: Truck },
        { href: `${base}/settings/bulk-operations`, label: "Bulk Operations", icon: Package },
      ],
    },
  ];
}

function agentNav(base: string): NavGroup[] {
  return [{ label: "AI Agent", items: [{ href: `${base}`, label: "Overview", icon: Bot }, { href: `${base}/settings`, label: "Settings", icon: Settings }] }];
}
function huddleNav(base: string): NavGroup[] {
  return [{ label: "Huddle", items: [{ href: `${base}`, label: "Overview", icon: LayoutDashboard }, { href: `${base}/settings`, label: "Settings", icon: Settings }] }];
}
function coachNav(base: string): NavGroup[] {
  return [{ label: "Coach", items: [{ href: `${base}`, label: "Overview", icon: LayoutDashboard }, { href: `${base}/settings`, label: "Settings", icon: Settings }] }];
}
function ucontactNav(base: string): NavGroup[] {
  return [{ label: "uContact", items: [{ href: `${base}`, label: "Overview", icon: LayoutDashboard }, { href: `${base}/settings`, label: "Settings", icon: Settings }] }];
}

export function getNavForProduct(productId: ProductId): NavGroup[] {
  const bases: Record<ProductId, string> = {
    ucass: "/ucass", agent: "/agent", huddle: "/huddle", coach: "/coach", ucontact: "/ucontact",
  };
  const base = bases[productId];
  switch (productId) {
    case "ucass": return ucassNav(base);
    case "agent": return agentNav(base);
    case "huddle": return huddleNav(base);
    case "coach": return coachNav(base);
    case "ucontact": return ucontactNav(base);
    default: return ucassNav("/ucass");
  }
}
