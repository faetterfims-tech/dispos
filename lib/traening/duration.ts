/**
 * Hvor lang tid tager passet? Regnet ud fra de sæt, der faktisk står på (så færre sæt under opstart giver kortere tid).
 *
 * Pr. sæt: arbejdstid ud fra rytmen (setWorkSec) og midten af målet. Mellem sæt: pausen fra restFor.
 * Pr. øvelse: 1 min til at finde vægte og stille op. Intervaller: 5 min opvarmning + 1 min pr. runde.
 */
import type { Exercise } from "./program";
import { setWorkSec } from "./calories";
import { restFor } from "./timing";

export const SETUP_SEC = 60;
export const INTERVAL_WARMUP_SEC = 5 * 60;

export interface PlanItem {
  ex: Exercise;
  /** Antal sæt. */
  sets: number;
  /** Planlagt antal pr. sæt (gentagelser, sekunder, runder). Mangler: midten af målet. */
  reps?: number;
}

export function estimateSec(items: PlanItem[], warmupSec = 0): number {
  let sec = warmupSec;
  for (const { ex, sets, reps } of items) {
    if (sets <= 0 || ex.unit === "km") continue;
    const n = reps && reps > 0 ? reps : Math.round((ex.target[0] + ex.target[1]) / 2);
    if (ex.unit === "runder") {
      sec += INTERVAL_WARMUP_SEC + sets * n * 60;
      continue;
    }
    sec += SETUP_SEC + sets * setWorkSec(ex, { reps: n }) + Math.max(0, sets - 1) * restFor(ex);
  }
  return sec;
}

/** "ca. 30–35 min": ±8 %, rundet til nærmeste 5 min (mindst 5 min spænd). */
export function fmtEstimate(sec: number): string {
  const min = sec / 60;
  const lo = Math.max(5, Math.round((min * 0.92) / 5) * 5);
  const hi = Math.max(lo + 5, Math.round((min * 1.08) / 5) * 5);
  return `ca. ${lo}–${hi} min`;
}
