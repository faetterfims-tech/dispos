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
