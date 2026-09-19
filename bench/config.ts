import { digest } from "../src/canonical.js";

export interface PriceWeight {
  input_per_million: number;
  output_per_million: number;
}
export interface FrozenEconomics {
  price_weights: Record<string, PriceWeight>;
  flagship_models: string[];
  margins: { weighted_cost: number; flagship_consumption: number };
  z: number;
}
export const ABLATIONS = ["full_policy", "without_review", "without_correction", "without_worker"] as const;
export type AblationId = (typeof ABLATIONS)[number];

export interface HarnessConfig {
  schema_revision: 1;
  harness_id: string;
  frozen_at: number;
  holdout_frozen: boolean;
  // B is recorded unavailable rather than fabricated when it is not reproducible.
  arms: { A: true; B: "available" | "unavailable"; C: true };
  itt: true;
  // Diagnostic ablations are frozen before holdout; full_policy is the qualifiable arm.
  ablations: AblationId[];
  strata: string[];
  quality_endpoints: string[];
  quality_margins: { critical_defects: number; min_completion: number };
  economics: FrozenEconomics;
  exclusion_rules: string[];
  max_retries_per_task: number;
  sizing_evidence_digest: string;
  statistical_plan_digest: string;
}

export const priceWeightsDigest = (weights: FrozenEconomics["price_weights"]): string => digest(weights);

export function configErrors(config: HarnessConfig): string[] {
  const errors: string[] = [];
  if (config.schema_revision !== 1) errors.push("INVALID_SCHEMA");
  if (!config.harness_id) errors.push("MISSING_HARNESS_ID");
  if (!config.holdout_frozen || !Number.isFinite(config.frozen_at)) errors.push("HOLDOUT_NOT_FROZEN");
  if (config.arms?.A !== true || config.arms?.C !== true) errors.push("REQUIRED_ARM_MISSING");
  if (config.arms?.B !== "available" && config.arms?.B !== "unavailable") errors.push("ARM_B_UNDECLARED");
  if (config.itt !== true) errors.push("ITT_REQUIRED");
  if (!Array.isArray(config.ablations) || !config.ablations.includes("full_policy") ||
    new Set(config.ablations).size !== config.ablations.length ||
    config.ablations.some((ablation) => !ABLATIONS.includes(ablation))) errors.push("ABLATIONS_UNDECLARED");
  if (!Array.isArray(config.strata) || config.strata.length === 0 || new Set(config.strata).size !== config.strata.length)
    errors.push("STRATA_UNDECLARED");
  if (!Array.isArray(config.quality_endpoints) || config.quality_endpoints.length === 0) errors.push("QUALITY_ENDPOINTS_UNDECLARED");
  if (!Number.isFinite(config.quality_margins?.critical_defects) || config.quality_margins.critical_defects < 0 ||
    !Number.isFinite(config.quality_margins?.min_completion) || config.quality_margins.min_completion < 0 ||
    config.quality_margins.min_completion > 1) errors.push("QUALITY_MARGINS_INVALID");
  const economics = config.economics;
  if (!economics || !economics.price_weights || Object.keys(economics.price_weights).length === 0 ||
    Object.values(economics.price_weights).some((weight) => !Number.isFinite(weight?.input_per_million) ||
      !Number.isFinite(weight?.output_per_million) || weight.input_per_million < 0 || weight.output_per_million < 0))
    errors.push("PRICE_WEIGHTS_INVALID");
  if (!economics?.flagship_models?.length) errors.push("FLAGSHIP_MODELS_UNDECLARED");
  if (!Number.isFinite(economics?.margins?.weighted_cost) || economics.margins.weighted_cost < 0 ||
    !Number.isFinite(economics?.margins?.flagship_consumption) || economics.margins.flagship_consumption < 0)
    errors.push("ECONOMIC_MARGINS_INVALID");
  if (!Number.isFinite(economics?.z) || economics.z <= 0) errors.push("STATISTICAL_PLAN_INVALID");
  if (!Array.isArray(config.exclusion_rules) || config.exclusion_rules.some((rule) =>
    /fail|denied|pending|timeout|takeover|regress|outlier|inconvenient/i.test(rule))) errors.push("POST_HOC_EXCLUSION_FORBIDDEN");
  if (!Number.isSafeInteger(config.max_retries_per_task) || config.max_retries_per_task < 0 || config.max_retries_per_task > 2)
    errors.push("RETRY_REGIME_INVALID");
  if (!config.sizing_evidence_digest) errors.push("SIZING_EVIDENCE_MISSING");
  if (!config.statistical_plan_digest) errors.push("STATISTICAL_PLAN_MISSING");
  return errors;
}
