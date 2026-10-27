import type { CalculationResult, HourData, MeterOnlyResult, PeriodResult } from "./types";
import { localDay, localMonth } from "./time";

/**
 * Tolerance for måleunøjagtighed. Et beregnet husforbrug under -TOLERANCE kWh
 * betyder at tallene ikke hænger sammen (fx tidsforskydning mellem kilderne).
 */
const TOLERANCE_KWH = 0.05;

function emptyPeriod(key: string): PeriodResult {
  return {
    key,
    hours: 0,
    loadKWh: 0,
    pvKWh: 0,
    importKWh: 0,
    exportKWh: 0,
    chargeKWh: 0,
    dischargeKWh: 0,
    actualCost: 0,
    noSystemCost: 0,
    solarOnlyCost: 0,
    totalSaving: 0,
    solarSaving: 0,
    batterySaving: 0,
    directSolarKWh: 0,
    estimatedSellHours: 0,
  };
}

function isNum(v: number | null | undefined): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

interface HourScenario {
  load: number;
  pv: number;
  imp: number;
  exp: number;
  chg: number;
  dis: number;
  actual: number;
  noSystem: number;
  solarOnly: number;
  directSolar: number;
  sellEstimated: boolean;
}

/**
 * Regner én time igennem. Returnerer null, hvis timen mangler noget af det,
 * scenarierne kræver — så alle scenarier altid sammenlignes over præcis de
 * samme timer.
 *
 *   husforbrug        = import + sol + afladning − eksport − opladning
 *   faktisk           = import × købspris − eksport × salgspris
 *   uden anlæg        = husforbrug × købspris
 *   kun sol (uden bat) = (husforbrug − sol) × købspris, hvis positivt
 *                      ellers (husforbrug − sol) × salgspris (dvs. indtægt)
 *
 * Batteritab ligger i (opladning − afladning) og tæller derfor ikke som
 * husforbrug — det er en omkostning ved batteriet, som det skal være.
 */
export function calculateHour(h: HourData): HourScenario | "inconsistent" | null {
  const { importKWh: imp, exportKWh: exp, buyPrice: buy, sellPrice: sell } = h;
  const pv = h.pvKWh;
  const chg = h.chargeKWh ?? 0;
  const dis = h.dischargeKWh ?? 0;
  if (!isNum(imp) || !isNum(exp) || !isNum(buy) || !isNum(sell) || !isNum(pv)) return null;
  // Batteridata er påkrævet, men en kilde uden batteri må gerne udelade det.
  if (h.chargeKWh === null || h.dischargeKWh === null) return null;

  let load = imp + pv + dis - exp - chg;
  if (load < -TOLERANCE_KWH) return "inconsistent";
  if (load < 0) load = 0;

  const actual = imp * buy - exp * sell;
  const noSystem = load * buy;
  const net = load - pv;
  const solarOnly = net >= 0 ? net * buy : net * sell;

  return {
    load,
    pv,
    imp,
    exp,
    chg,
    dis,
    actual,
    noSystem,
    solarOnly,
    directSolar: Math.min(load, pv),
    sellEstimated: Boolean(h.sellPriceEstimated),
  };
}

function addTo(p: PeriodResult, s: HourScenario) {
  p.hours += 1;
  p.loadKWh += s.load;
  p.pvKWh += s.pv;
  p.importKWh += s.imp;
  p.exportKWh += s.exp;
  p.chargeKWh += s.chg;
  p.dischargeKWh += s.dis;
  p.actualCost += s.actual;
  p.noSystemCost += s.noSystem;
  p.solarOnlyCost += s.solarOnly;
  p.directSolarKWh += s.directSolar;
  if (s.sellEstimated) p.estimatedSellHours += 1;
}

function finish(p: PeriodResult): PeriodResult {
  p.totalSaving = p.noSystemCost - p.actualCost;
  p.solarSaving = p.noSystemCost - p.solarOnlyCost;
  p.batterySaving = p.solarOnlyCost - p.actualCost;
  return p;
}

/** Nøgletal der kan regnes alene ud fra Min Strøm. */
export function meterOnly(hours: HourData[]): MeterOnlyResult {
  let n = 0;
  let imp = 0;
  let exp = 0;
  let impCost = 0;
  let expRev = 0;
  let buySum = 0;
  let buyN = 0;
  let sellSum = 0;
  let sellN = 0;

  for (const h of hours) {
    if (isNum(h.buyPrice)) {
      buySum += h.buyPrice;
      buyN += 1;
    }
    if (isNum(h.sellPrice)) {
      sellSum += h.sellPrice;
      sellN += 1;
    }
    if (!isNum(h.importKWh) && !isNum(h.exportKWh)) continue;
    n += 1;
    if (isNum(h.importKWh) && isNum(h.buyPrice)) {
      imp += h.importKWh;
      impCost += h.importKWh * h.buyPrice;
    }
    if (isNum(h.exportKWh) && isNum(h.sellPrice) && !h.sellPriceEstimated) {
      exp += h.exportKWh;
      expRev += h.exportKWh * h.sellPrice;
    }
  }

  return {
    hours: n,
    importKWh: imp,
    exportKWh: exp,
    importCost: impCost,
    exportRevenue: expRev,
    netCost: impCost - expRev,
    avgPaidBuyPrice: imp > 0 ? impCost / imp : null,
    avgMarketBuyPrice: buyN > 0 ? buySum / buyN : null,
    avgPaidSellPrice: exp > 0 ? expRev / exp : null,
    avgMarketSellPrice: sellN > 0 ? sellSum / sellN : null,
  };
}

export function calculate(hours: HourData[]): CalculationResult {
  const total = emptyPeriod("total");
  const months = new Map<string, PeriodResult>();
  const days = new Map<string, PeriodResult>();
  const inconsistentHours: string[] = [];
  let missingSystemHours = 0;

  for (const h of hours) {
    const s = calculateHour(h);
    if (s === "inconsistent") {
      inconsistentHours.push(h.start);
      continue;
    }
    if (s === null) {
      const meterComplete = isNum(h.importKWh) && isNum(h.exportKWh) && isNum(h.buyPrice);
      if (meterComplete) missingSystemHours += 1;
      continue;
    }
    const m = localMonth(h.start);
    const d = localDay(h.start);
    if (!months.has(m)) months.set(m, emptyPeriod(m));
    if (!days.has(d)) days.set(d, emptyPeriod(d));
    addTo(total, s);
    addTo(months.get(m)!, s);
    addTo(days.get(d)!, s);
  }

  const sortByKey = (a: PeriodResult, b: PeriodResult) => a.key.localeCompare(b.key);
  return {
    hasSystemData: total.hours > 0,
    total: finish(total),
    months: [...months.values()].map(finish).sort(sortByKey),
    days: [...days.values()].map(finish).sort(sortByKey),
    meterOnly: meterOnly(hours),
    inconsistentHours,
    missingSystemHours,
  };
}

/**
 * Tilbagebetalingstid i år ud fra besparelsen i perioden.
 * Besparelsen skaleres op til et helt år; med under et års data er det et
 * groft skøn, fordi sommer og vinter sparer meget forskelligt.
 */
export function paybackYears(
  investment: number,
  savingInPeriod: number,
  periodDays: number,
): number | null {
  if (!(investment > 0) || !(periodDays > 0)) return null;
  const perYear = (savingInPeriod / periodDays) * 365;
  if (!(perYear > 0)) return null;
  return investment / perYear;
}
