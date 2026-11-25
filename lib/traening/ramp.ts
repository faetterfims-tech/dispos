/**
 * Rolig opstart: færre sæt de første uger, afhængigt af erfaring.
 *
 * Grundlag:
 * - ACSM anbefalede i 1998 1 sæt pr. øvelse til begyndere, og det virker de første måneder. Flere sæt giver mere på sigt
 *   (ACSM 2009, Progression Models in Resistance Training).
 * - Ømhed kommer mest fra uvant træning. Et første pas med få sæt beskytter næsten lige så godt mod ømhed bagefter som et
 *   hårdt pas ("repeated bout effect", Nosaka m.fl. 2001; Howatson m.fl. 2007).
 * - Begyndere bør stoppe med god margin (ca. 3 gentagelser i reserve), til teknikken sidder.
 *
 * Ny: 3 uger (2 · 2 · alle minus 1 sæt). Lidt erfaren: 2 uger (2 · alle minus 1). Øvet: ingen opstart, med mindre man vælger den.
 */
import type { Exercise } from "./program";
import type { Level, Profile } from "./loads";

export interface RampWeek {
  /** Positivt tal: højst så mange sæt. -1: ét sæt mindre end programmet. */
  sets: number;
  /** Højst så mange intervalrunder. */
  rounds: number;
  /** Gentagelser i reserve ("stop når du kunne tage x mere"). */
  reserve: string;
}

export const RAMP_PLAN: Record<Level, RampWeek[]> = {
  ny: [
    { sets: 2, rounds: 6, reserve: "3–4" },
    { sets: 2, rounds: 8, reserve: "3" },
    { sets: -1, rounds: 10, reserve: "2–3" },
  ],
  lidt: [
    { sets: 2, rounds: 8, reserve: "3" },
    { sets: -1, rounds: 10, reserve: "2–3" },
  ],
  oevet: [],
};

/** Planen, hvis man selv slår opstart til som øvet. */
const OPT_IN_PLAN = RAMP_PLAN.lidt;

export interface Ramp extends RampWeek {
  /** 1-baseret */
  week: number;
  weeks: number;
}

/** Er opstart slået til (valgt, eller som standard ud fra erfaring)? */
export const rampEnabled = (profile: Profile | null | undefined) => profile?.ramp ?? (profile?.level ?? "ny") !== "oevet";

export function planFor(profile: Profile | null | undefined): RampWeek[] {
  if (!rampEnabled(profile)) return [];
  const plan = RAMP_PLAN[profile?.level ?? "ny"];
  return plan.length ? plan : OPT_IN_PLAN;
}

const dayNum = (iso: string) => Math.floor(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / 86_400_000);

/** Opstarten for en given dato, regnet fra første gemte træning. null = fuldt program. */
export function rampFor(profile: Profile | null | undefined, sessions: { date: string }[], date: string): Ramp | null {
  const plan = planFor(profile);
  if (!plan.length) return null;
  const first = sessions.reduce<string | null>((min, s) => (!min || s.date < min ? s.date : min), null);
  const idx = first && first < date ? Math.floor((dayNum(date) - dayNum(first)) / 7) : 0;
  if (idx >= plan.length) return null;
  return { ...plan[idx], week: idx + 1, weeks: plan.length };
}

/** Antal sæt for en øvelse under opstart. */
export function rampSets(ex: Exercise, ramp: Ramp | null): number {
  if (!ramp || ex.unit === "km") return ex.sets;
  const n = ramp.sets > 0 ? ramp.sets : ex.sets + ramp.sets;
  return Math.max(Math.min(2, ex.sets), Math.min(ex.sets, n));
}

/** Hvor længe opstarten varer for et erfaringsniveau (uger). */
export const rampWeeks = (level: Level) => (RAMP_PLAN[level].length || OPT_IN_PLAN.length);
