/**
 * Kalorieforbrug pr. træning — et ærligt interval, ud fra den træning, der faktisk er lavet.
 *
 * Kun aktiv træning tæller: tiden i sættene, pauserne mellem dem (højst den foreskrevne pause)
 * og opvarmningen. Spildtid tæller ikke med.
 *
 *   kcal ≈ MET × kropsvægt (kg) × timer   (brutto, inkl. hvileforbrænding)
 *
 * MET i selve sættet (2024 Adult Compendium of Physical Activities):
 *   Vægte:        5,0 (02052, squat/dødløft moderat) – 6,0 (02050, styrketræning hårdt)
 *   Kropsvægt:    3,8 (02022, armbøjninger/udfald moderat) – 6,5 (02057, kropsvægt høj intensitet)
 *   Mave/planke:  2,8 (02024, planke/mavebøjninger let) – 3,8 (02022)
 *   Bjergbestiger og intervaller i arbejdstiden: 7,5 (02020, burpees m.m. hårdt) – 8,8 (01305, HIIT)
 *   Opvarmning:   2,8 – 3,5 (02030, rygøvelser op og ned fra gulvet)
 *   Pauser:       1,5 – 2,0 (antagelse: stå/gå roligt)
 *   Gåtur/løbetur: MET ud fra den målte fart (se cardio.ts).
 */
import { dayById, exerciseById, type Exercise } from "./program";
import type { Session } from "./logic";
import { restFor, tempoFor } from "./timing";
import { DEFAULT_KMH, cardioMet, isCardio, kmhOf } from "./cardio";

export type WorkoutKind = "vaegte" | "kropsvaegt" | "kondition";

/** Antaget kropsvægt, hvis den ikke er skrevet ind. */
export const DEFAULT_BODY_KG = 75;

const CORE = new Set(["planke", "sideplanke", "deadbug"]);
const VIGOROUS = new Set(["bjergbestiger", "intervaller"]);

/** MET i selve arbejdet for en øvelse. */
export function workMet(ex: Exercise): { low: number; high: number } {
  if (VIGOROUS.has(ex.id)) return { low: 7.5, high: 8.8 };
  if (CORE.has(ex.id)) return { low: 2.8, high: 3.8 };
  if (ex.unit === "kg") return { low: 5.0, high: 6.0 };
  return { low: 3.8, high: 6.5 };
}
const REST_MET = { low: 1.5, high: 2.0 };
const WARMUP_MET = { low: 2.8, high: 3.5 };

export function kindOf(dayId: string): WorkoutKind {
  const d = dayById(dayId);
  if (!d || d.exercises.some((e) => e.unit === "runder" || e.unit === "km")) return "kondition";
  return d.program === "udstyr" ? "vaegte" : "kropsvaegt";
}

/** Sekunder i arbejde for ét sæt: målt tid, ellers ud fra antal og rytme. */
export function setWorkSec(ex: Exercise, set: { reps: number; sec?: number }): number {
  if (ex.unit === "runder") return set.reps * 30; // 30 sek hårdt pr. runde
  if (ex.unit === "km") return set.sec && set.sec > 0 ? set.sec : (set.reps / (isCardio(ex.id) ? DEFAULT_KMH[ex.id] : 5)) * 3600;
  if (set.sec && set.sec > 0) return set.sec;
  if (ex.unit === "sek") return set.reps;
  const cycle = (tempoFor(ex) ?? [{ sec: 3 }]).reduce((a, p) => a + p.sec, 0);
  return set.reps * cycle;
}

export interface CalorieInput {
  bodyKg?: number;
  exercises: { ex: Exercise; sets: { reps: number; sec?: number }[] }[];
  /** Pauser mellem sæt i sekunder (målt). Mangler: den foreskrevne pause pr. sæt. */
  restSec?: number;
  /** Opvarmning i sekunder (målt med timeren). */
  warmupSec?: number;
}

export interface CalorieRange {
  low: number;
  high: number;
  /** Kropsvægten var et gæt. */
  guessedWeight: boolean;
}

const round10 = (n: number) => Math.max(0, Math.round(n / 10) * 10);

export function estimateCalories(input: CalorieInput): CalorieRange {
  const kg = input.bodyKg && input.bodyKg > 30 ? input.bodyKg : DEFAULT_BODY_KG;
  let low = 0;
  let high = 0;
  let guessedRest = 0;
  for (const { ex, sets } of input.exercises) {
    for (const s of sets) {
      const sec = setWorkSec(ex, s);
      const h = sec / 3600;
      // Ture: MET ud fra farten, ±10 %.
      const met = ex.unit === "km" && isCardio(ex.id) ? cardioMet(ex.id, kmhOf(s.reps, sec)) : 0;
      const m = met ? { low: met * 0.9, high: met * 1.1 } : workMet(ex);
      low += m.low * kg * h;
      high += m.high * kg * h;
    }
    // Intervaller: 30 sek pause pr. runde. Andre: den foreskrevne pause mellem sættene.
    guessedRest += ex.unit === "km" ? 0 : ex.unit === "runder" ? sets.reduce((a, s) => a + s.reps * 30, 0) : Math.max(0, sets.length - 1) * restFor(ex);
  }
  const restH = (input.restSec ?? guessedRest) / 3600;
  const warmH = (input.warmupSec ?? 0) / 3600;
  low += (REST_MET.low * restH + WARMUP_MET.low * warmH) * kg;
  high += (REST_MET.high * restH + WARMUP_MET.high * warmH) * kg;
  return { low: round10(low), high: round10(Math.max(high, low)), guessedWeight: !(input.bodyKg && input.bodyKg > 30) };
}

export function sessionCalories(s: Session, bodyKg?: number): CalorieRange {
  const exercises = s.exercises.flatMap((e) => {
    const ex = exerciseById(e.id);
    return ex ? [{ ex, sets: e.sets }] : [];
  });
  // Med ur: opvarmning = aktiv tid, der ikke er sæt (opvarmningstimeren).
  let warmupSec: number | undefined;
  if (s.time) {
    const setSec = exercises.reduce((a, { ex, sets }) => a + sets.reduce((b, x) => b + (x.sec ?? 0), 0) * (ex.unit === "runder" ? 0 : 1), 0);
    warmupSec = Math.max(0, s.time.activeSec - setSec);
  }
  // Ture: kun selve turen tæller (pauser undervejs er allerede trukket fra).
  if (exercises.some(({ ex }) => ex.unit === "km")) return estimateCalories({ bodyKg, exercises, restSec: 0, warmupSec: 0 });
  return estimateCalories({ bodyKg, exercises, restSec: s.time?.restSec, warmupSec });
}

export const fmtRange = (r: { low: number; high: number }) =>
  r.low === r.high ? `ca. ${r.low.toLocaleString("da-DK")} kcal` : `ca. ${r.low.toLocaleString("da-DK")}–${r.high.toLocaleString("da-DK")} kcal`;
