import {
  ListOrdered,
  Cable,
  Printer,
  PhoneOff,
  FolderOpen,
  Globe,
  Users,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

export interface FeatureMarketingInfo {
  title: string;
  tagline: string;
  description: string;
  benefits: string[];
  planLabel: string;
  icon: LucideIcon;
  /** Tailwind color key used for accent styling */
  color: "blue" | "purple" | "green" | "orange" | "teal" | "rose";
}

/**
 * Keys match the exact flag Names returned by GET /api/features.
 * Only end-user-facing features that should show a marketing/upsell page
 * when locked are listed here. Internal implementation flags are omitted.
 */
export const FEATURE_MARKETING: Record<string, FeatureMarketingInfo> = {
  CallQueue: {
    title: "Call Center Essentials",
    tagline: "Transform your phone system into a full-featured contact center.",
    description:
      "Call Center Essentials gives your team intelligent call queuing, real-time supervisor tools, and performance analytics — everything you need to deliver exceptional customer experiences at scale.",
    benefits: [
      "Smart call queues with priority routing and overflow rules",
      "Live wallboard with real-time agent & queue metrics",
      "Supervisor panel to monitor, whisper, and barge in on calls",
      "Detailed queue analytics and SLA reporting",
      "Wrap-up time, dispositions, and agent availability controls",
    ],
    planLabel: "Call Center Essentials Add-on",
    icon: ListOrdered,
    color: "blue",
  },

  CallQueuesManagement: {
    title: "Call Queues Management",
    tagline: "Advanced queue controls for high-volume contact centers.",
    description:
      "Call Queues Management gives supervisors full control over queue settings, agent assignments, overflow behavior, and real-time queue health.",
    benefits: [
      "Multi-queue management from a single dashboard",
      "Dynamic agent assignment with skill-based routing",
      "Overflow and fallback destination configuration",
      "Queue hold music and estimated wait time announcements",
      "Historical reporting with abandonment rates and SLA tracking",
    ],
    planLabel: "Call Center Essentials Add-on",
    icon: ListOrdered,
    color: "blue",
  },

  SipTrunkingManagement: {
    title: "SIP Trunking",
    tagline: "Connect your existing PBX or on-premise infrastructure to the cloud.",
    description:
      "SIP Trunking lets you leverage your current hardware investment while gaining the reliability and cost savings of net2phone's carrier-grade network. Scale channels up or down without new hardware.",
    benefits: [
      "Unlimited inbound channels with burstable capacity",
      "Competitive per-minute rates on domestic & international calls",
      "Geo-redundant failover for maximum uptime",
      "Simple configuration with any standards-based PBX",
      "Detailed CDR reports and real-time usage monitoring",
    ],
    planLabel: "SIP Trunking Add-on",
    icon: Cable,
    color: "teal",
  },

  IsVirtualFaxEnabled: {
    title: "Virtual Fax",
    tagline: "Send and receive faxes digitally — no machine required.",
    description:
      "Virtual Fax lets your team send and receive faxes directly from the web portal or via email, eliminating paper and physical hardware while keeping your existing fax numbers.",
    benefits: [
      "Send and receive faxes from any browser or email client",
      "Keep your existing fax numbers or get new ones instantly",
      "Automatic email delivery of incoming faxes as PDFs",
      "Full fax history with download and resend capabilities",
      "No fax machine, no toner, no paper jams",
    ],
    planLabel: "Virtual Fax Add-on",
    icon: Printer,
    color: "purple",
  },

  CallBlocking: {
    title: "Call Blocking",
    tagline: "Stop unwanted calls before they reach your team.",
    description:
      "Call Blocking lets you block specific numbers, entire area codes, or suspicious caller patterns — protecting your team's time and ensuring only legitimate callers get through.",
    benefits: [
      "Block individual numbers or entire area codes instantly",
      "Inbound and outbound blocking controls",
      "Shared block list across all team members",
      "Anonymous caller blocking with one click",
      "Full audit log of blocked call attempts",
    ],
    planLabel: "Included with net2phone",
    icon: PhoneOff,
    color: "rose",
  },

  CompanyDirectory: {
    title: "Company Directory",
    tagline: "Let callers find any team member by name, instantly.",
    description:
      "The Company Directory gives callers a self-service way to reach any team member by spelling their name — no operator needed. It updates automatically as your team grows.",
    benefits: [
      "Dial-by-name directory for all active team members",
      "Search by first or last name — your choice",
      "Custom greeting to set the right first impression",
      "Auto-synced with your team member roster",
      "Accessible from your main phone menu or as a direct extension",
    ],
    planLabel: "Included with net2phone",
    icon: FolderOpen,
    color: "green",
  },

  InternationalCalling: {
    title: "International Calling",
    tagline: "Reach customers and partners anywhere in the world.",
    description:
      "International Calling gives your team the ability to dial any country at competitive per-minute rates — without worrying about unexpected charges or coverage gaps.",
    benefits: [
      "Coverage in 180+ countries with carrier-grade quality",
      "Competitive per-minute rates with no hidden fees",
      "Per-user calling controls and spending limits",
      "Detailed international CDR in call history",
      "Caller ID presentation options per destination",
    ],
    planLabel: "International Calling Add-on",
    icon: Globe,
    color: "orange",
  },

  CustomerDelegateManagement: {
    title: "Account Delegation",
    tagline: "Empower trusted partners to manage your account on your behalf.",
    description:
      "Account Delegation lets you grant resellers, IT admins, or managed service providers controlled access to administer your account — with full audit trail and revoke-at-any-time control.",
    benefits: [
      "Grant admin access to external partners without sharing credentials",
      "Granular permission scoping per delegate",
      "Full audit log of all delegate actions",
      "Revoke access instantly from the dashboard",
      "Multi-account support for managed service providers",
    ],
    planLabel: "Included with net2phone",
    icon: Users,
    color: "blue",
  },

  AIProcessing: {
    title: "AI-Powered Features",
    tagline: "Let AI do the heavy lifting — smarter calls, faster insights.",
    description:
      "AI Processing unlocks voicemail transcription, post-call summaries, sentiment analysis, and automated follow-up suggestions — turning every call into actionable intelligence.",
    benefits: [
      "Voicemail-to-text transcription delivered by email",
      "Post-call AI summaries with key action items",
      "Sentiment analysis across call recordings",
      "AI-powered follow-up email drafts",
      "Conversation search across your entire call history",
    ],
    planLabel: "AI Add-on",
    icon: Sparkles,
    color: "purple",
  },
};

export function hasMarketingContent(featureName: string): boolean {
  return featureName in FEATURE_MARKETING;
}
