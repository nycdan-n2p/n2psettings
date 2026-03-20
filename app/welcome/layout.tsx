import type { Metadata } from "next";
import WelcomeShell from "./WelcomeShell";

export const metadata: Metadata = {
  title: "Welcome · net2phone Setup",
  description: "Guided setup for your net2phone account — Simple. Reliable. Flexible.",
};

export default function WelcomeLayout({ children }: { children: React.ReactNode }) {
  return <WelcomeShell>{children}</WelcomeShell>;
}
