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

/** Hvile, der tæller som pause og ikke spildtid (programmet siger 1–1½ min, lidt luft). */
export const REST_SEC = 120;

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
