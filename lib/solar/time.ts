export const TIME_ZONE = "Europe/Copenhagen";

const partsFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function zonedParts(ms: number) {
  const out: Record<string, number> = {};
  for (const p of partsFormatter.formatToParts(new Date(ms))) {
    if (p.type !== "literal") out[p.type] = Number(p.value);
  }
  return out as { year: number; month: number; day: number; hour: number; minute: number; second: number };
}

/** Lokal dato i København, fx "2026-06-01". */
export function localDay(isoUtc: string): string {
  const p = zonedParts(Date.parse(isoUtc));
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

/** Lokal måned i København, fx "2026-06". */
export function localMonth(isoUtc: string): string {
  return localDay(isoUtc).slice(0, 7);
}

/** Forskel mellem lokal tid og UTC i ms på et givet tidspunkt. */
function offsetMs(ms: number): number {
  const p = zonedParts(ms);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(ms / 1000) * 1000;
}

/** Konverterer en lokal København-tid til UTC-millisekunder. */
export function copenhagenToUtc(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
): number {
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  const first = guess - offsetMs(guess);
  const second = guess - offsetMs(first);
  return second;
}

/** Runder et tidspunkt ned til hel time og returnerer ISO-nøglen. */
export function hourKey(ms: number): string {
  return new Date(Math.floor(ms / 3_600_000) * 3_600_000).toISOString();
}
