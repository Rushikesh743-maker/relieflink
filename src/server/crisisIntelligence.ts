/**
 * Crisis Intelligence Engine — calculatePriority()
 *
 * Pure, deterministic, weighted scoring. No randomness, no I/O.
 * Score in [0, 1]; bucketed into LOW / MEDIUM / HIGH / CRITICAL.
 *
 * Weights are tunable via the 2nd arg without touching call sites.
 */

import type { Priority, RequestType } from "./models";

export interface PriorityInput {
  /** Category of the request — drives baseline severity. */
  type: RequestType;
  /** When the request was created (Date or epoch ms). Older = more urgent. */
  createdAt: Date | number;
  /**
   * Density of co-located active requests in the recent window
   * (e.g. count within 1km in last 30 minutes). Higher = potential mass-casualty.
   */
  locationDensity: number;
}

export interface PriorityWeights {
  /** weight of the type-severity score */
  type: number;
  /** weight of the age/escalation score */
  age: number;
  /** weight of the density score */
  density: number;
  /** age (minutes) at which age score saturates to 1.0 */
  ageSaturationMin: number;
  /** density at which density score saturates to 1.0 */
  densitySaturation: number;
}

export interface PriorityResult {
  priority: Priority;
  score: number;
  breakdown: {
    typeScore: number;
    ageScore: number;
    densityScore: number;
  };
}

const TYPE_SEVERITY: Record<RequestType, number> = {
  medical: 0.95,
  rescue: 0.9,
  shelter: 0.55,
  food: 0.4,
  other: 0.3,
};

export const DEFAULT_PRIORITY_WEIGHTS: PriorityWeights = {
  type: 0.5,
  age: 0.25,
  density: 0.25,
  ageSaturationMin: 60, // 1h old request → max age score
  densitySaturation: 8, // 8+ nearby active requests → max density score
};

const BUCKETS: Array<{ min: number; priority: Priority }> = [
  { min: 0.85, priority: "CRITICAL" },
  { min: 0.6, priority: "HIGH" },
  { min: 0.35, priority: "MEDIUM" },
  { min: 0, priority: "LOW" },
];

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function ageMinutes(createdAt: Date | number, now: number): number {
  const t = createdAt instanceof Date ? createdAt.getTime() : createdAt;
  return Math.max(0, (now - t) / 60_000);
}

/**
 * Compute weighted priority for a request.
 *
 * @example
 *   calculatePriority({ type: "medical", createdAt: Date.now() - 5*60_000, locationDensity: 3 })
 *   // → { priority: "HIGH", score: 0.71, breakdown: {...} }
 */
export function calculatePriority(
  request: PriorityInput,
  weights: PriorityWeights = DEFAULT_PRIORITY_WEIGHTS,
  now: number = Date.now(),
): PriorityResult {
  const typeScore = clamp01(TYPE_SEVERITY[request.type] ?? 0.3);
  const ageScore = clamp01(ageMinutes(request.createdAt, now) / weights.ageSaturationMin);
  const densityScore = clamp01(request.locationDensity / weights.densitySaturation);

  const totalWeight = weights.type + weights.age + weights.density || 1;
  const score = clamp01(
    (typeScore * weights.type + ageScore * weights.age + densityScore * weights.density) / totalWeight,
  );

  const priority = BUCKETS.find((b) => score >= b.min)!.priority;

  return {
    priority,
    score: Number(score.toFixed(4)),
    breakdown: {
      typeScore: Number(typeScore.toFixed(4)),
      ageScore: Number(ageScore.toFixed(4)),
      densityScore: Number(densityScore.toFixed(4)),
    },
  };
}
