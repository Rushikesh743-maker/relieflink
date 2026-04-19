/**
 * NGO Matching Engine — matchNGO()
 *
 * Pure, deterministic ranking. No I/O, no DB calls.
 * Caller is responsible for fetching candidate NGOs (e.g. via $geoNear)
 * and passing their current `load.current` value.
 *
 * Returns the best match plus a ranked fallback list for escalation.
 */

import type { RequestType } from "./models";

export interface GeoLocation {
  lat: number;
  lng: number;
}

export interface MatchableRequest {
  type: RequestType;
  location: GeoLocation;
  /** Optional secondary needs that broaden capability matching. */
  secondaryTypes?: RequestType[];
}

export interface MatchableNGO {
  id: string;
  name: string;
  location: GeoLocation;
  capabilities: RequestType[];
  load: { current: number; capacity: number };
  active?: boolean;
}

export interface MatchWeights {
  distance: number;
  capability: number;
  load: number;
  /** Distance (km) at which the distance score reaches 0. */
  maxDistanceKm: number;
}

export interface ScoredNGO {
  ngo: MatchableNGO;
  score: number; // 0..1
  distanceKm: number;
  capabilityScore: number; // 0..1
  loadScore: number; // 0..1 (1 = empty, 0 = full)
  reason: string;
}

export interface MatchResult {
  best: ScoredNGO | null;
  fallbacks: ScoredNGO[];
  rejected: Array<{ ngo: MatchableNGO; reason: string }>;
}

export const DEFAULT_MATCH_WEIGHTS: MatchWeights = {
  distance: 0.45,
  capability: 0.35,
  load: 0.2,
  maxDistanceKm: 25,
};

/* --------------------------------- Math --------------------------------- */

const R_KM = 6371;
const toRad = (d: number) => (d * Math.PI) / 180;

/** Haversine great-circle distance in kilometers. */
export function haversineKm(a: GeoLocation, b: GeoLocation): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

const clamp01 = (n: number) => (Number.isNaN(n) ? 0 : Math.max(0, Math.min(1, n)));

/* ------------------------------- Sub-scores ----------------------------- */

function distanceScore(distKm: number, max: number): number {
  if (max <= 0) return 0;
  return clamp01(1 - distKm / max);
}

function capabilityScore(req: MatchableRequest, ngo: MatchableNGO): number {
  const caps = new Set(ngo.capabilities);
  if (!caps.has(req.type)) return 0; // primary capability is mandatory for matching
  const secondary = req.secondaryTypes ?? [];
  if (secondary.length === 0) return 1;
  const overlap = secondary.filter((t) => caps.has(t)).length;
  // 0.7 floor for matching primary, scaled up by secondary coverage
  return clamp01(0.7 + 0.3 * (overlap / secondary.length));
}

function loadScore(ngo: MatchableNGO): number {
  if (ngo.load.capacity <= 0) return 0;
  const free = ngo.load.capacity - ngo.load.current;
  return clamp01(free / ngo.load.capacity);
}

/* --------------------------------- API ---------------------------------- */

/**
 * Score and rank NGOs for a single request.
 *
 * Mandatory filters applied before scoring:
 *   - ngo.active !== false
 *   - ngo.load.current < ngo.load.capacity
 *   - ngo.capabilities includes request.type
 *
 * @returns best match and ranked fallback list (escalation order).
 */
export function matchNGO(
  request: MatchableRequest,
  ngos: MatchableNGO[],
  weights: MatchWeights = DEFAULT_MATCH_WEIGHTS,
): MatchResult {
  const rejected: MatchResult["rejected"] = [];
  const candidates: ScoredNGO[] = [];

  const totalWeight = weights.distance + weights.capability + weights.load || 1;

  for (const ngo of ngos) {
    if (ngo.active === false) {
      rejected.push({ ngo, reason: "inactive" });
      continue;
    }
    if (ngo.load.current >= ngo.load.capacity) {
      rejected.push({ ngo, reason: "at_capacity" });
      continue;
    }
    const capScore = capabilityScore(request, ngo);
    if (capScore === 0) {
      rejected.push({ ngo, reason: "missing_capability" });
      continue;
    }

    const distKm = haversineKm(request.location, ngo.location);
    if (distKm > weights.maxDistanceKm) {
      rejected.push({ ngo, reason: "out_of_range" });
      continue;
    }

    const distScore = distanceScore(distKm, weights.maxDistanceKm);
    const ldScore = loadScore(ngo);

    const score =
      (distScore * weights.distance + capScore * weights.capability + ldScore * weights.load) /
      totalWeight;

    candidates.push({
      ngo,
      score: Number(clamp01(score).toFixed(4)),
      distanceKm: Number(distKm.toFixed(3)),
      capabilityScore: Number(capScore.toFixed(4)),
      loadScore: Number(ldScore.toFixed(4)),
      reason: explain(distKm, capScore, ldScore),
    });
  }

  candidates.sort((a, b) => b.score - a.score);

  return {
    best: candidates[0] ?? null,
    fallbacks: candidates.slice(1, 5), // top 4 escalation targets
    rejected,
  };
}

function explain(distKm: number, capScore: number, loadFree: number): string {
  const parts: string[] = [];
  parts.push(`${distKm.toFixed(1)}km away`);
  parts.push(capScore === 1 ? "full capability match" : "partial capability match");
  parts.push(loadFree > 0.6 ? "low load" : loadFree > 0.3 ? "moderate load" : "near capacity");
  return parts.join(" · ");
}
