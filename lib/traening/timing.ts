import type { Exercise } from "./program";

/**
 * Tid på en træning: aktiv (i et startet sæt eller opvarmningstimer),
 * pause (hvile op til REST_SEC efter hver aktiv periode) og spildtid (resten).
 */

export interface Interval {
  /** ms siden epoch */
  start: number;
  /** ms siden epoch; mangler mens perioden kører */
  end?: number;
}

export interface TimeSplit {
  totalSec: number;
  activeSec: number;
  restSec: number;
  idleSec: number;
}

/** Hvile, der tæller som pause og ikke spildtid (pauser er 1–2 min, lidt luft). */
export const REST_SEC = 150;

export function splitTime(startedAt: number, intervals: Interval[], now: number, restLimitSec = REST_SEC): TimeSplit {
  const end = Math.max(now, startedAt);
  // Klip til træningen, luk åbne perioder, sortér og flet overlap.
  const clipped = intervals
    .map((iv) => ({ start: Math.max(iv.start, startedAt), end: Math.min(iv.end ?? end, end) }))
    .filter((iv) => iv.end > iv.start)
    .sort((a, b) => a.start - b.start);
  const merged: { start: number; end: number }[] = [];
  for (const iv of clipped) {
    const last = merged[merged.length - 1];
    if (last && iv.start <= last.end) last.end = Math.max(last.end, iv.end);
    else merged.push({ ...iv });
  }

  const limit = restLimitSec * 1000;
  let active = 0;
  let rest = 0;
  let idle = 0;
  let cursor = startedAt;
  let afterActive = false;
  for (const iv of merged) {
    const gap = iv.start - cursor;
    if (afterActive) {
      rest += Math.min(gap, limit);
      idle += Math.max(0, gap - limit);
    } else idle += gap;
    active += iv.end - iv.start;
    cursor = iv.end;
    afterActive = true;
  }
  const tail = end - cursor;
  if (afterActive) {
    rest += Math.min(tail, limit);
    idle += Math.max(0, tail - limit);
  } else idle += tail;

  const s = (ms: number) => Math.round(ms / 1000);
  const totalSec = s(end - startedAt);
  const activeSec = s(active);
  const restSec = s(rest);
  return { totalSec, activeSec, restSec, idleSec: Math.max(0, totalSec - activeSec - restSec) };
}

/** 1:05 · 12:30 · 1:02:03 */
export function fmtDuration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const ss = String(sec % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

/** "45 min" · "1 t 5 min" · "40 sek" */
export function fmtMinutes(sec: number): string {
  if (sec < 60) return `${sec} sek`;
  const m = Math.round(sec / 60);
  return m >= 60 ? `${Math.floor(m / 60)} t ${m % 60} min` : `${m} min`;
}

/* ---------- Rytme og pause pr. øvelse ---------- */

export type PhaseName = "ned" | "op" | "hold" | "ud" | "ind";
export interface Phase {
  name: PhaseName;
  sec: number;
}

const NED_FOERST: Phase[] = [
  { name: "ned", sec: 2 },
  { name: "op", sec: 1 },
];
const OP_FOERST: Phase[] = [
  { name: "op", sec: 1 },
  { name: "ned", sec: 2 },
];
const OP_HOLD: Phase[] = [
  { name: "op", sec: 1 },
  { name: "hold", sec: 2 },
  { name: "ned", sec: 2 },
];
const UD_IND: Phase[] = [
  { name: "ud", sec: 2 },
  { name: "ind", sec: 2 },
];

/**
 * Rytme for én gentagelse. Langsom bremsende fase (2 sek) og hurtigere løft (1 sek).
 * Øvelser, der starter i bunden (fx curl, roning), begynder med OP. Øvelser med "klem i toppen" har HOLD.
 */
const TEMPO: Record<string, Phase[]> = {
  goblet: NED_FOERST, squat: NED_FOERST, armstraek: NED_FOERST, udfald: NED_FOERST, splitstol: NED_FOERST, bulgarsk: NED_FOERST,
  rdl: NED_FOERST, dips: NED_FOERST, skraapres: NED_FOERST, baenkpres: NED_FOERST, triceps: NED_FOERST, skulderarm: NED_FOERST, skraabaenk: NED_FOERST, flyes: NED_FOERST,
  roning: OP_FOERST, baandroning: OP_FOERST, skulderpres: OP_FOERST, pullups: OP_FOERST, chinups: OP_FOERST, curl: OP_FOERST,
  sideloeft: OP_FOERST, plankeroning: OP_FOERST, baandtraek: OP_FOERST, knaeloeft: OP_FOERST,
  hoftehaev: OP_HOLD, vaegthofte: OP_HOLD, hoftebenet: OP_HOLD, ytraek: OP_HOLD, ttraek: OP_HOLD,
  deadbug: UD_IND, vaegtdeadbug: UD_IND,
};

/** Rytmen for en øvelse. Null = ingen rytme (hold eller intervaller). */
export function tempoFor(ex: Exercise): Phase[] | null {
  if (ex.unit === "sek" || ex.unit === "runder" || ex.unit === "km") return null;
  return TEMPO[ex.id] ?? NED_FOERST;
}

/** Ben: længere pause. Mave og kropsstabilitet: kortere. */
const LEG_REST = new Set(["goblet", "squat", "rdl", "bulgarsk", "splitstol", "udfald"]);
const CORE_REST = new Set(["plankeroning", "vaegtdeadbug", "planke", "sideplanke", "deadbug", "bjergbestiger", "knaeloeft"]);

/**
 * Pause efter et sæt, i sekunder. Forskning peger på 1–2 min som bedst for muskelvækst,
 * med lidt længere til store benøvelser.
 */
export function restFor(ex: Exercise): number {
  if (ex.unit === "runder" || ex.unit === "km") return 0;
  if (LEG_REST.has(ex.id)) return 120;
  if (CORE_REST.has(ex.id)) return 60;
  return 90;
}

/** Hvor i rytmen er man efter `ms`: fase, hvor langt i fasen (0–1), sekunder tilbage, næste fase og antal hele gentagelser. */
export function tempoState(
  ms: number,
  phases: Phase[],
): { phase: PhaseName; index: number; progress: number; left: number; next: PhaseName; reps: number } {
  const cycle = phases.reduce((a, p) => a + p.sec, 0) * 1000;
  const t = Math.max(0, ms);
  let inCycle = t % cycle;
  let index = 0;
  while (index < phases.length - 1 && inCycle >= phases[index].sec * 1000) {
    inCycle -= phases[index].sec * 1000;
    index++;
  }
  const dur = phases[index].sec * 1000;
  return {
    phase: phases[index].name,
    index,
    progress: Math.min(1, inCycle / dur),
    left: Math.ceil((dur - inCycle) / 1000),
    next: phases[(index + 1) % phases.length].name,
    reps: Math.floor(t / cycle),
  };
}
