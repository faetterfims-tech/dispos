/**
 * Kalorieforbrug pr. træning — et ærligt interval, ikke ét præcist tal.
 *
 * Bygger på 2024 Adult Compendium of Physical Activities (MET-værdier):
 *   kcal ≈ MET × kropsvægt (kg) × timer
 * MET-værdierne gælder for hele træningstiden inkl. pauser. Tallet er brutto,
 * dvs. inklusive de ca. 1 kcal/kg/time, kroppen bruger i hvile alligevel.
 *
 *   02054  3,5  Styrketræning, flere øvelser, 8–15 gentagelser
 *   02052  5,0  Styrketræning, squat, dødløft m.m., moderat
 *   02055  5,8  Styrketræning i supersæt/kredsløb (korte pauser)
 *   02056  3,0  Kropsvægtsøvelser (squat, udfald, armbøjninger), generelt
 *   02022  3,8  Kropsvægtsøvelser, moderat
 *   02020  7,5  Kropsvægt hårdt (burpees, sprællemænd)
 *   01305  8,8  Intervaltræning (HIIT)
 *   02024  2,8  Planke, mavebøjninger, let (opvarmningen)
 */
import { dayById } from "./program";
import type { Session } from "./logic";

export type WorkoutKind = "vaegte" | "kropsvaegt" | "kondition";

const MET = {
  vaegte: { low: 3.5, high: 5.0, dense: 5.8 },
  kropsvaegt: { low: 3.0, high: 3.8, dense: 5.0 },
  hiitWork: { low: 7.5, high: 8.8 },
  hiitRest: 2.0,
  opvarmning: 2.8,
};

/** Antaget kropsvægt, hvis den ikke er skrevet ind. */
export const DEFAULT_BODY_KG = 75;

export function kindOf(dayId: string): WorkoutKind {
  const d = dayById(dayId);
  if (!d || d.exercises.some((e) => e.unit === "runder")) return "kondition";
  return d.program === "udstyr" ? "vaegte" : "kropsvaegt";
}

export interface CalorieInput {
  kind: WorkoutKind;
  bodyKg?: number;
  /** Samlet tid i sekunder (fra start til gem). */
  totalSec: number;
  /** Aktiv tid (i sæt) i sekunder, hvis kendt. */
  activeSec?: number;
  /** Intervaller: antal runder à 30 sek hårdt / 30 sek pause. */
  rounds?: number;
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
  const h = Math.max(0, input.totalSec) / 3600;
  let low: number;
  let high: number;

  if (input.kind === "kondition") {
    const work = ((input.rounds ?? 0) * 30) / 3600;
    const rest = ((input.rounds ?? 0) * 30) / 3600;
    const other = Math.max(0, h - work - rest); // opvarmning, nedkøling, gåtur
    low = (MET.hiitWork.low * work + MET.hiitRest * rest + 3.0 * other) * kg;
    high = (MET.hiitWork.high * work + MET.hiitRest * rest + 3.5 * other) * kg;
  } else {
    const m = MET[input.kind];
    // Tæt træning (meget aktiv tid i forhold til total) løfter den øvre grænse mod kredsløbs-niveau.
    const density = input.activeSec && input.totalSec > 0 ? Math.min(1, input.activeSec / input.totalSec) : 0;
    const top = density >= 0.4 ? m.dense : m.high + (m.dense - m.high) * Math.max(0, (density - 0.2) / 0.2);
    low = m.low * kg * h;
    high = top * kg * h;
  }
  return { low: round10(low), high: round10(Math.max(high, low)), guessedWeight: !(input.bodyKg && input.bodyKg > 30) };
}

/** Skøn over tid for et pas uden ur: ca. 45 sek pr. sæt + pause, plus 7 min opvarmning. */
function guessTotalSec(s: Session): number {
  const sets = s.exercises.reduce((n, e) => n + e.sets.length, 0);
  return sets * (45 + 90) + 7 * 60;
}

export function sessionCalories(s: Session, bodyKg?: number): CalorieRange {
  const kind = kindOf(s.dayId);
  if (kind === "kondition") {
    const rounds = s.exercises.find((e) => e.id === "intervaller")?.sets.reduce((n, x) => n + x.reps, 0) ?? 0;
    const totalSec = s.time?.totalSec ?? rounds * 60 + 10 * 60;
    return estimateCalories({ kind, bodyKg, totalSec, rounds });
  }
  return estimateCalories({ kind, bodyKg, totalSec: s.time?.totalSec ?? guessTotalSec(s), activeSec: s.time?.activeSec });
}

export const fmtRange = (r: { low: number; high: number }) =>
  r.low === r.high ? `ca. ${r.low.toLocaleString("da-DK")} kcal` : `ca. ${r.low.toLocaleString("da-DK")}–${r.high.toLocaleString("da-DK")} kcal`;
