import type { HourData } from "./types";
import type { SystemHour } from "./sunmate";

/** Data pr. time fra Min Strøm, som API-ruten returnerer dem. */
export interface MeterHour {
  start: string;
  importKWh: number | null;
  exportKWh: number | null;
  buyPrice: number | null;
  sellPrice: number | null;
  sellPriceEstimated?: boolean;
}

/**
 * Kompakt format til overførsel: flere års timer som objekter bliver for store
 * til et serversvar (Vercel tillader ca. 4,5 MB). Én række pr. time:
 * [timer siden 1970 (UTC), købt, solgt, købspris, salgspris, salgspris estimeret 0/1]
 */
export type PackedHour = [number, number | null, number | null, number | null, number | null, 0 | 1];

const r4 = (v: number | null) => (v == null ? null : Math.round(v * 10_000) / 10_000);

export function packHours(hours: MeterHour[]): PackedHour[] {
  return hours.map((h) => [
    Math.round(Date.parse(h.start) / 3_600_000),
    r4(h.importKWh),
    r4(h.exportKWh),
    r4(h.buyPrice),
    r4(h.sellPrice),
    h.sellPriceEstimated ? 1 : 0,
  ]);
}

export function unpackHours(rows: PackedHour[]): MeterHour[] {
  return rows.map(([t, imp, exp, buy, sell, est]) => ({
    start: new Date(t * 3_600_000).toISOString(),
    importKWh: imp,
    exportKWh: exp,
    buyPrice: buy,
    sellPrice: sell,
    sellPriceEstimated: est === 1 ? true : undefined,
  }));
}

/** Fletter måledata og anlægsdata på den absolutte timestart (UTC). */
export function mergeHours(meter: MeterHour[], system: SystemHour[] | null): HourData[] {
  const sys = new Map((system ?? []).map((s) => [s.start, s]));
  return meter.map((m) => {
    const s = sys.get(m.start);
    if (!system) return { ...m };
    return {
      ...m,
      pvKWh: s ? s.pvKWh : null,
      chargeKWh: s ? s.chargeKWh : null,
      dischargeKWh: s ? s.dischargeKWh : null,
    };
  });
}
