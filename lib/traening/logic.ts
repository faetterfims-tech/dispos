/**
 * Ren logik til træningsloggen (ingen afhængigheder, testet i logic.test.ts).
 */
import type { Exercise, Unit } from "./program";

export interface SetEntry {
  /** Vægt i kg. For kropsvægtsøvelser: ekstra vægt (oftest 0). */
  kg: number;
  /** Gentagelser, sekunder eller runder afhængigt af øvelsen. */
  reps: number;
}

export interface ExerciseLog {
  id: string;
  sets: SetEntry[];
}

export interface Session {
  id: string;
  /** ÅÅÅÅ-MM-DD */
  date: string;
  dayId: string;
  exercises: ExerciseLog[];
  note?: string;
  savedAt?: string;
}

export interface BodyEntry {
  /** ÅÅÅÅ-MM-DD */
  date: string;
  weightKg?: number;
  waistCm?: number;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const num = (v: unknown, max: number): number | null => {
  const n = typeof v === "string" ? Number(v.replace(",", ".")) : v;
  if (typeof n !== "number" || !Number.isFinite(n) || n < 0 || n > max) return null;
  return Math.round(n * 100) / 100;
};

/** Tjekker og renser et pas fra klienten. Returnerer null, hvis det ikke giver mening. */
export function sanitizeSession(input: unknown): Session | null {
  if (!input || typeof input !== "object") return null;
  const s = input as Record<string, unknown>;
  if (typeof s.id !== "string" || !/^[\w-]{1,64}$/.test(s.id)) return null;
  if (typeof s.date !== "string" || !DATE_RE.test(s.date)) return null;
  if (typeof s.dayId !== "string" || s.dayId.length > 40) return null;
  if (!Array.isArray(s.exercises)) return null;

  const exercises: ExerciseLog[] = [];
  for (const e of s.exercises.slice(0, 30)) {
    if (!e || typeof e !== "object") continue;
    const { id, sets } = e as Record<string, unknown>;
    if (typeof id !== "string" || id.length > 40 || !Array.isArray(sets)) continue;
    const clean: SetEntry[] = [];
    for (const set of sets.slice(0, 20)) {
      const kg = num((set as SetEntry)?.kg ?? 0, 500);
      const reps = num((set as SetEntry)?.reps, 3600);
      if (kg === null || reps === null || reps === 0) continue;
      clean.push({ kg, reps });
    }
    if (clean.length) exercises.push({ id, sets: clean });
  }
  if (!exercises.length) return null;

  const note = typeof s.note === "string" && s.note.trim() ? s.note.trim().slice(0, 500) : undefined;
  return { id: s.id, date: s.date, dayId: s.dayId, exercises, ...(note ? { note } : {}) };
}

export function sanitizeBody(input: unknown): BodyEntry | null {
  if (!input || typeof input !== "object") return null;
  const b = input as Record<string, unknown>;
  if (typeof b.date !== "string" || !DATE_RE.test(b.date)) return null;
  const weightKg = b.weightKg === undefined || b.weightKg === "" ? null : num(b.weightKg, 400);
  const waistCm = b.waistCm === undefined || b.waistCm === "" ? null : num(b.waistCm, 300);
  if (!weightKg && !waistCm) return null;
  return { date: b.date, ...(weightKg ? { weightKg } : {}), ...(waistCm ? { waistCm } : {}) };
}

const byDateDesc = (a: Session, b: Session) =>
  b.date.localeCompare(a.date) || (b.savedAt ?? "").localeCompare(a.savedAt ?? "");

/** Seneste gang øvelsen blev lavet (før en given dato, hvis angivet). */
export function lastLog(sessions: Session[], exerciseId: string, beforeDate?: string): { date: string; log: ExerciseLog } | null {
  for (const s of [...sessions].sort(byDateDesc)) {
    if (beforeDate && s.date >= beforeDate) continue;
    const log = s.exercises.find((e) => e.id === exerciseId);
    if (log) return { date: s.date, log };
  }
  return null;
}

/** Estimeret 1RM (Epley). Bruges kun som fremgangsmål, ikke som noget at teste. */
export const e1rm = (kg: number, reps: number) => (reps <= 1 ? kg : kg * (1 + reps / 30));

/** Ét tal pr. pas, der stiger, når man bliver stærkere. */
export function score(unit: Unit, log: ExerciseLog): number {
  switch (unit) {
    case "kg":
      return Math.max(...log.sets.map((s) => e1rm(s.kg, s.reps)));
    case "reps":
      // Kropsvægt: gentagelser i alt (ekstra vægt tæller som en bonus via e1rm-forholdet).
      return log.sets.reduce((sum, s) => sum + s.reps * (1 + s.kg / 30), 0);
    case "sek":
      return Math.max(...log.sets.map((s) => s.reps));
    case "runder":
      return log.sets.reduce((sum, s) => sum + s.reps, 0);
  }
}

export const scoreLabel: Record<Unit, string> = {
  kg: "Styrke: beregnet maks-løft (kg)",
  reps: "Antal i alt",
  sek: "Længste hold (sek)",
  runder: "Runder",
};

export function progressSeries(sessions: Session[], ex: Exercise): { date: string; value: number }[] {
  const out = new Map<string, number>();
  for (const s of sessions) {
    const log = s.exercises.find((e) => e.id === ex.id);
    if (!log) continue;
    const v = score(ex.unit, log);
    out.set(s.date, Math.max(out.get(s.date) ?? 0, v));
  }
  return [...out.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, value]) => ({ date, value: Math.round(value * 10) / 10 }));
}

/** Mindste spring på justerbare håndvægte er typisk ca. 2 kg. */
export const KG_STEP = 2;

/** Hvad skal der stå i felterne i dag, og hvad er målet — ud fra sidste gang. */
export function suggest(ex: Exercise, last: ExerciseLog | null): { sets: SetEntry[]; hint: string } {
  const [lo, hi] = ex.target;
  if (!last || !last.sets.length) {
    const startKg = ex.unit === "kg" ? 0 : 0;
    return {
      sets: Array.from({ length: ex.sets }, () => ({ kg: startKg, reps: ex.unit === "kg" ? lo : 0 })),
      hint:
        ex.unit === "kg"
          ? `Første gang: find en vægt, hvor du kan tage ${lo}–${hi} gange, og hvor de sidste føles hårde.`
          : "Første gang: skriv ned, hvad du kan, så har du noget at slå næste gang.",
    };
  }

  const prev = last.sets;
  const fill = (kg: number, reps: number) => Array.from({ length: Math.max(ex.sets, prev.length) }, (_, i) => ({ kg, reps: prev[i]?.reps ?? reps }));

  switch (ex.unit) {
    case "kg": {
      const topKg = Math.max(...prev.map((s) => s.kg));
      const atTop = prev.filter((s) => s.kg === topKg);
      if (atTop.length >= Math.min(ex.sets, prev.length) && atTop.every((s) => s.reps >= hi)) {
        return {
          sets: Array.from({ length: Math.max(ex.sets, prev.length) }, () => ({ kg: topKg + KG_STEP, reps: lo })),
          hint: `Alle sæt nåede ${hi} sidst. Gå op til ${fmtKg(topKg + KG_STEP)} kg, og start forfra på ${lo}.`,
        };
      }
      if (atTop.some((s) => s.reps < lo) && topKg > KG_STEP) {
        return { sets: fill(topKg, lo), hint: `Under ${lo} gange sidst. Bliv på ${fmtKg(topKg)} kg (eller gå lidt ned), og byg op igen.` };
      }
      return { sets: fill(topKg, lo).map((s) => ({ ...s, reps: Math.min(hi, s.reps + 1) })), hint: `Bliv på ${fmtKg(topKg)} kg, og tag 1 gang mere i hvert sæt.` };
    }
    case "reps": {
      const total = prev.reduce((s, x) => s + x.reps, 0);
      return { sets: fill(prev[0]?.kg ?? 0, lo).map((s) => ({ ...s, reps: s.reps + 1 })), hint: `Sidst ${total} i alt. Prøv at slå det med bare 1–2.` };
    }
    case "sek": {
      const best = Math.max(...prev.map((s) => s.reps));
      return { sets: fill(0, best).map(() => ({ kg: 0, reps: Math.min(best + 5, 180) })), hint: `Længste hold sidst: ${best} sek. Gå efter ${best + 5}.` };
    }
    case "runder": {
      const r = prev.reduce((s, x) => s + x.reps, 0);
      const next = Math.min(r + 1, hi);
      return { sets: [{ kg: 0, reps: next }], hint: r >= hi ? `${r} runder sidst. Tag dem hårdere i stedet for flere.` : `${r} runder sidst. Prøv ${next}.` };
    }
  }
}

export const fmtKg = (kg: number) => (Number.isInteger(kg) ? String(kg) : kg.toFixed(1).replace(".", ","));

/** Mandag i ugen for en ÅÅÅÅ-MM-DD-dato. */
export function weekStart(date: string): string {
  const d = new Date(`${date}T12:00:00Z`);
  const dow = (d.getUTCDay() + 6) % 7; // 0 = mandag
  d.setUTCDate(d.getUTCDate() - dow);
  return d.toISOString().slice(0, 10);
}

/** Antal pas pr. uge, nyeste først. */
export function sessionsPerWeek(sessions: Session[]): { week: string; count: number }[] {
  const m = new Map<string, number>();
  for (const s of sessions) m.set(weekStart(s.date), (m.get(weekStart(s.date)) ?? 0) + 1);
  return [...m.entries()].sort(([a], [b]) => b.localeCompare(a)).map(([week, count]) => ({ week, count }));
}

/** 1 = mandag … 7 = søndag. */
export function isoWeekday(date: string): number {
  const d = new Date(`${date}T12:00:00Z`).getUTCDay();
  return d === 0 ? 7 : d;
}

/** Samlet løftet vægt (kg × gentagelser) i et pas — kun vægtøvelser. */
export function volume(session: Session, unitOf: (id: string) => Unit | undefined): number {
  let v = 0;
  for (const e of session.exercises) {
    if (unitOf(e.id) !== "kg") continue;
    for (const s of e.sets) v += s.kg * s.reps;
  }
  return Math.round(v);
}

/* ---------- Rækkefølge i stedet for ugedage ---------- */

/** Et "spring over": det pas, man har valgt at fortsætte med, og hvornår. */
export interface NextPointer {
  dayId: string;
  /** ISO-tidspunkt */
  setAt: string;
}

/** Passet efter `dayId` i rækken (starter forfra efter det sidste). */
export function nextInOrder(dayId: string, order: string[], steps = 1): string {
  if (!order.length) return dayId;
  const i = order.indexOf(dayId);
  const start = i < 0 ? -1 : i;
  return order[(((start + steps) % order.length) + order.length) % order.length];
}

/** Senest gemte pas (efter hvornår det blev gemt, ellers dato). */
export function latestSession(sessions: Session[]): Session | null {
  let best: Session | null = null;
  for (const s of sessions) {
    const key = s.savedAt ?? `${s.date}T00:00:00.000Z`;
    const bestKey = best ? (best.savedAt ?? `${best.date}T00:00:00.000Z`) : "";
    if (!best || key > bestKey) best = s;
  }
  return best;
}

/**
 * Hvilket pas står for tur? Det efter det senest gemte — medmindre man har
 * trykket "spring over" efter det, så gælder det valgte.
 */
export function upNext(sessions: Session[], pointer: NextPointer | null, order: string[]): string {
  const last = latestSession(sessions);
  const lastKey = last ? (last.savedAt ?? `${last.date}T00:00:00.000Z`) : "";
  if (pointer && order.includes(pointer.dayId) && pointer.setAt > lastKey) return pointer.dayId;
  if (!last) return order[0];
  return nextInOrder(last.dayId, order);
}
