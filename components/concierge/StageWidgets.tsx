"use client";

/**
 * StageWidget — dispatcher that renders the correct widget for the current
 * onboarding stage.  Each widget lives in its own file under ./widgets/.
 */

import { useConcierge } from "@/contexts/ConciergeContext";
import { WelcomeScrapeWidget }   from "./widgets/WelcomeScrapeWidget";
import { VerificationWidget }    from "./widgets/VerificationWidget";
import { CdrWidget }             from "./widgets/CdrWidget";
import { PortingWidget }         from "./widgets/PortingWidget";
import { UserIngestionWidget }   from "./widgets/UserIngestionWidget";
import { ArchitectureWidget }    from "./widgets/ArchitectureWidget";
import { CallRoutingWidget }     from "./widgets/CallRoutingWidget";
import { FinalBlueprintWidget }  from "./widgets/FinalBlueprintWidget";

interface StageWidgetsProps {
  onUserMessages: (msgs: string[]) => void;
  currentStage?: string;
}

export function StageWidget({ onUserMessages, currentStage }: StageWidgetsProps) {
  const { stage: contextStage } = useConcierge();
  const stage = currentStage ?? contextStage;

  switch (stage) {
    case "welcome_scrape":
      return <WelcomeScrapeWidget onMessages={onUserMessages} />;
    case "verification_holidays":
      return <VerificationWidget onMessages={onUserMessages} />;
    case "cdr_analysis":
      return <CdrWidget onMessages={onUserMessages} />;
    case "porting":
      return <PortingWidget onMessages={onUserMessages} />;
    case "user_ingestion":
      return <UserIngestionWidget onMessages={onUserMessages} />;
    case "architecture_hardware":
      return <ArchitectureWidget onMessages={onUserMessages} />;
    case "licensing":
      return <CallRoutingWidget onMessages={onUserMessages} />;
    case "final_blueprint":
      return <FinalBlueprintWidget onMessages={onUserMessages} />;
    default:
      return null;
  }
}

// Re-export shared primitives so other concierge components don't need to
// import from the internal widgets path.
export { CardShell, FixItButton, ValidationErrors } from "./widgets/shared";
