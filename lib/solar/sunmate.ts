import { copenhagenToUtc, hourKey } from "./time";

/**
 * Anlægsdata pr. time fra SunMate (eller et andet anlæg).
 * `undefined` = kilden har ikke feltet; `null` = feltet findes, men værdien mangler.
 */
export interface SystemHour {
  start: string;
  pvKWh: number | null;
  chargeKWh?: number | null;
  dischargeKWh?: number | null;
}

export interface SystemDataSource {
  /** Henter anlægsdata for perioden [from, to). */
  fetchHours(from: Date, to: Date): Promise<SystemHour[]>;
}

/*
 * SunMate-API: endpoints er endnu ikke kendt. Når de er fundet, implementeres
 * en SystemDataSource her og kaldes fra /api/solceller. Indtil da indlæses
 * data som CSV i browseren via parseSystemCsv.
 */

const COLUMN_ALIASES: Record<"time" | "pv" | "charge" | "discharge" | "battery", string[]> = {
  time: ["time", "timestamp", "start", "date", "datetime", "tid", "tidspunkt", "dato"],
  pv: ["pv", "production", "solar", "pvkwh", "produktion", "sol", "solproduktion"],
  charge: ["charge", "charged", "batterycharge", "chargekwh", "opladning", "opladet", "batteriopladning"],
  discharge: ["discharge", "discharged", "batterydischarge", "dischargekwh", "afladning", "afladet", "batteriafladning"],
  battery: ["battery", "batteri", "batterykwh"],
};

function normalizeHeader(h: string): string {
  return h
    .toLowerCase()
    .replace(/\(.*?\)|\[.*?\]/g, "")
    .replace(/[^a-zæøå0-9]/g, "");
}

function findColumn(headers: string[], key: keyof typeof COLUMN_ALIASES): number {
  const aliases = COLUMN_ALIASES[key];
  // Eksakt match først, derefter "starter med".
  let idx = headers.findIndex((h) => aliases.includes(h) || aliases.includes(h.replace(/kwh$/, "")));
  if (idx === -1) idx = headers.findIndex((h) => aliases.some((a) => h.startsWith(a)));
  return idx;
}

function parseNumber(raw: string | undefined, danish: boolean): number | null {
  if (raw == null) return null;
  const s = raw.trim();
  if (s === "") return null;
  // Dansk format (semikolon-separeret fil): "1.234,5" → 1234.5. Engelsk: "1234.5".
  const normalized = danish ? s.replace(/\./g, "").replace(",", ".") : s;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

/** Tolker et tidspunkt. ISO med zone bruges som det er; uden zone antages dansk tid. */
export function parseTimestamp(raw: string): number | null {
  const s = raw.trim().replace(/^"|"$/g, "");
  if (/[zZ]$|[+-]\d{2}:?\d{2}$/.test(s)) {
    const t = Date.parse(s);
    return Number.isFinite(t) ? t : null;
  }
  // 2026-06-01 10:00 / 2026-06-01T10:00
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2}))?/);
  if (m) return copenhagenToUtc(+m[1], +m[2], +m[3], m[4] ? +m[4] : 0, m[5] ? +m[5] : 0);
  // 01-06-2026 10:00 / 01.06.2026 10:00
  m = s.match(/^(\d{1,2})[-./](\d{1,2})[-./](\d{4})(?:[ T](\d{1,2}):(\d{2}))?/);
  if (m) return copenhagenToUtc(+m[3], +m[2], +m[1], m[4] ? +m[4] : 0, m[5] ? +m[5] : 0);
  return null;
}

export interface CsvParseResult {
  hours: SystemHour[];
  hasBattery: boolean;
  rows: number;
  skippedRows: number;
  /** Faktor værdierne er ganget med (0,001 hvis filen var i Wh). */
  unitFactor: number;
}

/**
 * Læser en CSV med anlægsdata. Kolonnerne findes ud fra navnet:
 *   tid, produktion, opladning, afladning   (eller ét signeret "batteri": + = afladning)
 * Data med kortere interval end en time (fx 5 eller 15 min) summeres til timer.
 * Værdierne skal være energi (kWh eller Wh) pr. interval — ikke effekt (W).
 */
export function parseSystemCsv(text: string): CsvParseResult {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length < 2) throw new Error("Filen er tom eller har kun en overskrift.");

  const sep = [";", ",", "\t"].sort(
    (a, b) => lines[0].split(b).length - lines[0].split(a).length,
  )[0];
  const danish = sep === ";";
  const rawHeaders = lines[0].split(sep).map((h) => h.trim().replace(/^"|"$/g, ""));
  const headers = rawHeaders.map(normalizeHeader);

  const iTime = findColumn(headers, "time");
  const iPv = findColumn(headers, "pv");
  const iChg = findColumn(headers, "charge");
  const iDis = findColumn(headers, "discharge");
  const iBat = iChg === -1 && iDis === -1 ? findColumn(headers, "battery") : -1;

  // Dagsfiler (én række pr. dato uden klokkeslæt) kan ikke bruges til timeberegningen.
  const sample = lines.slice(1, 6).map((l) => (l.split(sep)[iTime] ?? "").trim().replace(/^"|"$/g, ""));
  if (iTime !== -1 && sample.length > 0 && sample.every((v) => /^\d{4}-\d{2}-\d{2}$|^\d{1,2}[-./]\d{1,2}[-./]\d{4}$/.test(v))) {
    throw new Error(
      "Filen har kun ét tal pr. dag. Beregningen kræver tal pr. time — vælg time/interval, når du eksporterer fra SunMate.",
    );
  }
  if (iTime === -1) throw new Error(`Fandt ingen tidskolonne. Overskrifter: ${rawHeaders.join(", ")}`);
  if (iPv === -1) throw new Error(`Fandt ingen produktionskolonne. Overskrifter: ${rawHeaders.join(", ")}`);

  const isWh = [iPv, iChg, iDis, iBat]
    .filter((i) => i !== -1)
    .some((i) => /(^|[^k])wh/i.test(rawHeaders[i]) && !/kwh/i.test(rawHeaders[i]));
  const unitFactor = isWh ? 0.001 : 1;
  const hasBattery = iChg !== -1 || iDis !== -1 || iBat !== -1;

  const byHour = new Map<string, SystemHour>();
  let skipped = 0;

  for (const line of lines.slice(1)) {
    const cells = line.split(sep).map((c) => c.trim().replace(/^"|"$/g, ""));
    const t = parseTimestamp(cells[iTime] ?? "");
    if (t == null) {
      skipped += 1;
      continue;
    }
    const key = hourKey(t);
    const pv = parseNumber(cells[iPv], danish);
    let chg: number | null | undefined = iChg !== -1 ? parseNumber(cells[iChg], danish) : undefined;
    let dis: number | null | undefined = iDis !== -1 ? parseNumber(cells[iDis], danish) : undefined;
    if (iBat !== -1) {
      const b = parseNumber(cells[iBat], danish);
      chg = b == null ? null : b < 0 ? -b : 0;
      dis = b == null ? null : b > 0 ? b : 0;
    }
    if (hasBattery) {
      // Mangler kun én af de to i en fil, der har begge, er rækken ufuldstændig.
      if (iChg !== -1 && iDis === -1) dis = 0;
      if (iDis !== -1 && iChg === -1) chg = 0;
    }

    const prev = byHour.get(key);
    const add = (a: number | null | undefined, b: number | null | undefined) =>
      a === undefined && b === undefined ? undefined : a == null || b == null ? null : a + b;
    const scaled = (v: number | null | undefined) => (v == null ? v : v * unitFactor);

    if (!prev) {
      byHour.set(key, {
        start: key,
        pvKWh: scaled(pv) ?? null,
        chargeKWh: scaled(chg),
        dischargeKWh: scaled(dis),
      });
    } else {
      prev.pvKWh = add(prev.pvKWh, scaled(pv)) ?? null;
      prev.chargeKWh = add(prev.chargeKWh, scaled(chg));
      prev.dischargeKWh = add(prev.dischargeKWh, scaled(dis));
    }
  }

  // Batterifelter skal være eksplicit null (ukendt), ikke undefined, når filen har batteri.
  const hours = [...byHour.values()].sort((a, b) => a.start.localeCompare(b.start));
  if (hasBattery) {
    for (const h of hours) {
      if (h.chargeKWh === undefined) h.chargeKWh = null;
      if (h.dischargeKWh === undefined) h.dischargeKWh = null;
    }
  }

  return { hours, hasBattery, rows: lines.length - 1, skippedRows: skipped, unitFactor };
}
