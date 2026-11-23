/**
 * Vægtforslag: startgæt ud fra profil, testsæt første gang og justering
 * ud fra hvor mange gange man nåede. Ren logik — testet i loads.test.ts.
 *
 * Tallene er bevidst forsigtige gæt. Testsættet og progressionen retter dem
 * hurtigt til, så de passer til den enkelte.
 */
import type { Exercise } from "./program";

export type Level = "ny" | "lidt" | "oevet";
export type Sex = "mand" | "kvinde";

export interface Profile {
  level: Level;
  sex?: Sex;
}

export interface LoadContext {
  /** Kropsvægt i kg (seneste måling). */
  bodyKg?: number;
  profile?: Profile;
}

export const LEVELS: { id: Level; name: string; hint: string }[] = [
  { id: "ny", name: "Ny", hint: "Har ikke trænet styrke før, eller ikke i lang tid" },
  { id: "lidt", name: "Lidt erfaring", hint: "Har trænet af og til" },
  { id: "oevet", name: "Øvet", hint: "Træner styrke fast" },
];

export const isLevel = (v: unknown): v is Level => v === "ny" || v === "lidt" || v === "oevet";
export const isSex = (v: unknown): v is Sex => v === "mand" || v === "kvinde";

/**
 * Startvægt pr. håndvægt (eller den ene håndvægt) som andel af kropsvægten
 * for en ny mand til ca. 10 gange med lidt i overskud. upper = overkrop.
 */
const RATIOS: Record<string, { ratio: number; upper: boolean }> = {
  goblet: { ratio: 0.15, upper: false },
  rdl: { ratio: 0.12, upper: false },
  bulgarsk: { ratio: 0.06, upper: false },
  roning: { ratio: 0.12, upper: true },
  skulderpres: { ratio: 0.07, upper: true },
  curl: { ratio: 0.06, upper: true },
  skraapres: { ratio: 0.1, upper: true },
  baenkpres: { ratio: 0.1, upper: true },
  sideloeft: { ratio: 0.025, upper: true },
  triceps: { ratio: 0.07, upper: true },
};

const LEVEL_FACTOR: Record<Level, number> = { ny: 1, lidt: 1.3, oevet: 1.7 };
/** Kvinder er i snit relativt stærkere i benene end i overkroppen. Ukendt: lidt forsigtigt. */
const sexFactor = (sex: Sex | undefined, upper: boolean) => (sex === "kvinde" ? (upper ? 0.55 : 0.75) : sex === "mand" ? 1 : 0.85);

/** Antaget kropsvægt, hvis den ikke er skrevet ind. */
export const DEFAULT_BODY_KG = 75;

/** Spring på håndvægte: 1 kg for de lette, ellers 2 kg. */
export const stepFor = (kg: number) => (kg < 6 ? 1 : 2);

/** Rund ned til en vægt, man typisk kan stille håndvægte på (aldrig under 1 kg). */
export function roundKg(kg: number): number {
  if (!Number.isFinite(kg) || kg <= 1) return 1;
  return kg < 6 ? Math.max(1, Math.round(kg)) : Math.max(6, Math.floor(kg / 2) * 2);
}

/** Startgæt i kg for en øvelse med vægt. */
export function startWeight(ex: Exercise, ctx: LoadContext = {}): number {
  const r = RATIOS[ex.id] ?? { ratio: 0.08, upper: true };
  const body = ctx.bodyKg && ctx.bodyKg > 30 ? ctx.bodyKg : DEFAULT_BODY_KG;
  const level = ctx.profile?.level ?? "ny";
  return roundKg(body * r.ratio * LEVEL_FACTOR[level] * sexFactor(ctx.profile?.sex, r.upper));
}

/** Estimeret maks (Epley), med loft over antal, da formlen bliver upræcis ved mange gentagelser. */
const e1rm = (kg: number, reps: number) => kg * (1 + Math.min(reps, 30) / 30);

/** Vægten, der passer til `targetReps`, når man klarede `reps` med `kg`. */
export function weightForReps(kg: number, reps: number, targetReps: number): number {
  if (kg <= 0) return 0;
  if (reps <= 0) return roundKg(kg * 0.7);
  return roundKg(e1rm(kg, reps) / (1 + targetReps / 30));
}

/** Det antal, arbejdssættene sigter efter: lidt over bunden af intervallet, så der er plads til at blive bedre. */
export const workingReps = (ex: Exercise) => Math.min(ex.target[1], ex.target[0] + 2);

/**
 * Efter testsættet: hvad resten af sættene skal være.
 * Ligger testen inden for målet, beholdes vægten.
 */
export function afterTest(ex: Exercise, testKg: number, testReps: number): { kg: number; reps: number; note: string } {
  const [lo, hi] = ex.target;
  const reps = workingReps(ex);
  switch (ex.unit) {
    case "kg": {
      if (testKg <= 0) return { kg: 0, reps, note: "Skriv vægten i testsættet, så kan appen beregne resten." };
      if (testReps > lo && testReps <= hi + 1)
        return { kg: testKg, reps, note: `Testsæt: ${fmt(testKg)} kg × ${testReps} rammer målet. Bliv på ${fmt(testKg)} kg, og gå efter ${reps} gange.` };
      const kg = weightForReps(testKg, testReps, reps);
      const dir = kg > testKg ? "op til" : kg < testKg ? "ned til" : "på";
      return { kg, reps, note: `Testsæt: ${fmt(testKg)} kg × ${testReps}. Gå ${dir} ${fmt(kg)} kg i resten, og gå efter ${reps} gange.` };
    }
    case "reps": {
      const r = Math.max(1, Math.round(testReps * 0.8));
      return { kg: 0, reps: r, note: `Du nåede ${testReps}. Gå efter ${r} i resten af sættene, så du kan holde formen.` };
    }
    case "sek": {
      const s = Math.max(10, Math.round((testReps * 0.8) / 5) * 5);
      return { kg: 0, reps: s, note: `Du holdt ${testReps} sek. Gå efter ${s} sek i resten.` };
    }
    default:
      return { kg: 0, reps: testReps, note: "" };
  }
}

const fmt = (kg: number) => (Number.isInteger(kg) ? String(kg) : kg.toFixed(1).replace(".", ","));
