import type { OnboardingData, ConciergeStage } from "@/contexts/ConciergeContext";

export interface StageValidation {
  valid: boolean;
  missing: string[];
}

/**
 * Validate that the required data for a stage has been collected
 * before allowing the AI to advance to the next stage.
 */
export function validateStageComplete(
  stage: ConciergeStage,
  config: OnboardingData
): StageValidation {
  const missing: string[] = [];

  switch (stage) {
    case "welcome_scrape":
      if (!config.name) missing.push("name");
      if (!config.websiteUrl) missing.push("website URL");
      break;

    case "verification_holidays":
      if (!config.scraped.timezone) missing.push("timezone");
      break;

    case "porting":
      break;

    case "user_ingestion":
      break;

    case "architecture_hardware":
      if (!config.phoneType) missing.push("phone type");
      break;

    case "licensing":
      if (!config.routingType) missing.push("routing type");
      break;

    case "final_blueprint":
      break;

    default:
      break;
  }

  return { valid: missing.length === 0, missing };
}
