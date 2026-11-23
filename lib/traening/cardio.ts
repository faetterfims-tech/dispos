/**
 * Gåture og løbeture: distance, fart og forbrænding.
 *
 * MET ud fra farten (2024 Adult Compendium of Physical Activities, pacompendium.com):
 *   Gang, plant underlag (17151–17231):
 *     < 3,2 km/t 2,3 · 3,2–3,9 km/t 2,8 · 4,0 km/t 3,0 · 4,5–5,5 km/t 3,8 ·
 *     5,6–6,3 km/t 4,8 · 6,4–7,1 km/t 5,5 · 7,2–7,9 km/t 7,0 · 8,0–8,9 km/t 8,5
 *   Løb (Compendium): 6,4 km/t 6,0 · 9,7–10,1 km/t 9,3 (2024) · 12,9 km/t 11,8 · 16,1 km/t 14,5 · 19,3 km/t 19,0
 * Imellem punkterne interpoleres lineært ud fra midten af hvert interval.
 * Forbrænding: kcal ≈ MET × kropsvægt × timer (brutto, som resten af appen). Intervallet er ±10 %,
 * fordi folk bruger forskellig energi ved samme fart, og GPS-distancen ikke er helt præcis.
 */

export type CardioId = "gaatur" | "loebetur";
export const CARDIO_IDS: CardioId[] = ["gaatur", "loebetur"];
export const isCardio = (id: string): id is CardioId => (CARDIO_IDS as string[]).includes(id);

/** [km/t, MET] — midten af hvert interval i Compendium. */
const WALK: [number, number][] = [
  [2.4, 2.3],
  [3.5, 2.8],
  [4.0, 3.0],
  [5.0, 3.8],
  [6.0, 4.8],
  [6.8, 5.5],
  [7.6, 7.0],
  [8.5, 8.5],
];
const RUN: [number, number][] = [
  [6.4, 6.0],
  [9.9, 9.3],
  [12.9, 11.8],
  [16.1, 14.5],
  [19.3, 19.0],
];

function interpolate(table: [number, number][], x: number): number {
  if (x <= table[0][0]) return table[0][1];
  for (let i = 1; i < table.length; i++) {
    const [x1, y1] = table[i];
    if (x <= x1) {
      const [x0, y0] = table[i - 1];
      return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
    }
  }
  return table[table.length - 1][1];
}

/** MET for en tur ved en gennemsnitsfart (km/t). Går man rigtig langsomt "løb", regnes det som gang. */
export function cardioMet(id: CardioId, kmh: number): number {
  if (!Number.isFinite(kmh) || kmh <= 0) return id === "loebetur" ? 6.0 : 3.0;
  if (id === "loebetur" && kmh >= 6.4) return interpolate(RUN, kmh);
  return interpolate(WALK, kmh);
}

/** Antaget fart, hvis tiden mangler. */
export const DEFAULT_KMH: Record<CardioId, number> = { gaatur: 5, loebetur: 9 };

export const kmhOf = (km: number, sec: number) => (sec > 0 ? km / (sec / 3600) : 0);

export interface CardioCalories {
  low: number;
  high: number;
  met: number;
  kmh: number;
}

export function cardioCalories(id: CardioId, km: number, sec: number | undefined, bodyKg: number): CardioCalories {
  const s = sec && sec > 0 ? sec : (km / DEFAULT_KMH[id]) * 3600;
  const kmh = kmhOf(km, s);
  const met = cardioMet(id, kmh);
  const kcal = met * bodyKg * (s / 3600);
  return { low: kcal * 0.9, high: kcal * 1.1, met, kmh };
}

/* ---------- Formatering ---------- */

export const fmtKm = (km: number) => km.toFixed(km < 10 ? 2 : 1).replace(".", ",");
export const fmtKmh = (kmh: number) => kmh.toFixed(1).replace(".", ",");
/** Tempo som min:sek pr. km. */
export function fmtPace(km: number, sec: number): string {
  if (km <= 0.01 || sec <= 0) return "–";
  const p = Math.round(sec / km);
  if (p > 60 * 60) return "–";
  return `${Math.floor(p / 60)}:${String(p % 60).padStart(2, "0")}`;
}

/* ---------- GPS-spor ---------- */

export interface GeoPoint {
  lat: number;
  lon: number;
  /** Nøjagtighed i meter. */
  acc: number;
  /** ms */
  t: number;
}

/** Afstand i meter mellem to punkter (haversine). */
export function haversine(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const R = 6_371_000;
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Dårligere end dette (meter) bruges ikke. */
export const MAX_ACCURACY = 30;
/** Højeste realistiske fart (km/t) — hurtigere spring er GPS-støj. */
export const MAX_KMH: Record<CardioId, number> = { gaatur: 12, loebetur: 30 };

export interface Track {
  /** Meter i alt. */
  meters: number;
  /** Sidste godkendte punkt. */
  last: GeoPoint | null;
  /** De seneste godkendte punkter (til aktuel fart). */
  recent: { t: number; m: number }[];
}

export const emptyTrack = (): Track => ({ meters: 0, last: null, recent: [] });

/**
 * Læg et GPS-punkt til sporet. Unøjagtige punkter springes over. Små flyt gemmes ikke som nyt punkt,
 * så de lægges sammen til næste (ellers tæller GPS-støj, mens man står stille).
 * Et hul (fx skærmen var slukket) bliver til en lige linje — lidt for kort, aldrig for langt.
 */
export function addPoint(track: Track, p: GeoPoint, id: CardioId): Track {
  if (!Number.isFinite(p.lat) || !Number.isFinite(p.lon) || p.acc > MAX_ACCURACY) return track;
  if (!track.last) return { ...track, last: p, recent: [{ t: p.t, m: track.meters }] };
  const d = haversine(track.last, p);
  const minMove = Math.max(5, Math.min(p.acc, track.last.acc) * 0.6);
  if (d < minMove) return track;
  const dt = (p.t - track.last.t) / 1000;
  if (dt <= 0) return track;
  if ((d / dt) * 3.6 > MAX_KMH[id]) return track;
  const meters = track.meters + d;
  const recent = [...track.recent, { t: p.t, m: meters }].filter((r) => p.t - r.t <= 60_000);
  return { meters, last: p, recent };
}

/** Aktuel fart (km/t) ud fra det sidste minut. 0, hvis man står stille eller mangler data. */
export function currentKmh(track: Track, now: number): number {
  const r = track.recent;
  if (r.length < 2 || now - r[r.length - 1].t > 20_000) return 0;
  const a = r[0];
  const b = r[r.length - 1];
  return b.t > a.t ? ((b.m - a.m) / ((b.t - a.t) / 1000)) * 3.6 : 0;
}

/* ---------- Ur med pause ---------- */

export interface TourClock {
  startedAt: number;
  /** ms holdt pause i alt (afsluttede pauser). */
  pausedMs: number;
  /** Sat, mens der holdes pause. */
  pausedAt?: number;
}

export const elapsedSec = (c: TourClock, now: number) =>
  Math.max(0, Math.round((now - c.startedAt - c.pausedMs - (c.pausedAt ? now - c.pausedAt : 0)) / 1000));
