import type { SystemHour } from "./sunmate";
import { hourKey } from "./time";

/** Ét punkt fra SunMates /livedashboard-tidslinje. Effekter i watt. */
export interface TimelinePoint {
  datetime: string;
  solar_w: number | null;
  /** Positiv = oplader, negativ = aflader. */
  battery_w: number | null;
}

/** SunMates egne dagstotaler indtil nu (kWh). */
export interface DayTotals {
  produced_today_kwh?: number | null;
  charged_today_kwh?: number | null;
  discharged_today_kwh?: number | null;
}

/** Huller større end dette mellem to målinger betyder "ukendt" for timen. */
const MAX_GAP_MS = 20 * 60_000;
const HOUR = 3_600_000;

interface Acc {
  pv: number;
  chg: number;
  dis: number;
  /** Millisekunder af timen, der er dækket af målinger. */
  covered: number;
}

/**
 * Regner tidslinjens watt-målinger om til kWh pr. hel time (trapezmetoden).
 * Kun timer, der er helt afsluttede og dækket af målinger, returneres.
 * Er dagstotaler kendt, skaleres timerne, så summen passer med SunMates egne
 * kWh-tællere (inverterens tællere er mere præcise end stikprøverne).
 */
export function timelineToHours(points: TimelinePoint[], totals?: DayTotals): SystemHour[] {
  const pts = points
    .map((p) => ({ t: Date.parse(p.datetime), pv: p.solar_w, bat: p.battery_w }))
    .filter((p) => Number.isFinite(p.t))
    .sort((a, b) => a.t - b.t);
  if (pts.length < 2) return [];

  const hours = new Map<number, Acc>();
  const acc = (h: number) => {
    let a = hours.get(h);
    if (!a) {
      a = { pv: 0, chg: 0, dis: 0, covered: 0 };
      hours.set(h, a);
    }
    return a;
  };
  let sumPv = 0;
  let sumChg = 0;
  let sumDis = 0;

  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const dt = b.t - a.t;
    if (dt <= 0 || dt > MAX_GAP_MS) continue;
    if (a.pv == null || b.pv == null || a.bat == null || b.bat == null) continue;

    const pvW = (a.pv + b.pv) / 2;
    const batW = (a.bat + b.bat) / 2;
    // Fordel intervallet på de timer, det dækker.
    let s = a.t;
    while (s < b.t) {
      const h = Math.floor(s / HOUR) * HOUR;
      const e = Math.min(b.t, h + HOUR);
      const kh = (e - s) / HOUR / 1000; // kWh pr. W
      const x = acc(h);
      const pv = Math.max(0, pvW) * kh;
      const chg = Math.max(0, batW) * kh;
      const dis = Math.max(0, -batW) * kh;
      x.pv += pv;
      x.chg += chg;
      x.dis += dis;
      x.covered += e - s;
      sumPv += pv;
      sumChg += chg;
      sumDis += dis;
      s = e;
    }
  }

  const factor = (total: number | null | undefined, sum: number) => {
    if (total == null || !(sum > 0.5)) return 1;
    const f = total / sum;
    return f > 0.7 && f < 1.3 ? f : 1; // urimelig forskel → stol på målingerne
  };
  const fPv = factor(totals?.produced_today_kwh, sumPv);
  const fChg = factor(totals?.charged_today_kwh, sumChg);
  const fDis = factor(totals?.discharged_today_kwh, sumDis);

  const lastT = pts[pts.length - 1].t;
  const out: SystemHour[] = [];
  for (const [h, x] of [...hours.entries()].sort((p, q) => p[0] - q[0])) {
    if (h + HOUR > lastT) continue; // timen er ikke slut endnu
    if (x.covered < HOUR * 0.9) continue; // for store huller i målingerne
    out.push({
      start: hourKey(h),
      pvKWh: round(x.pv * fPv),
      chargeKWh: round(x.chg * fChg),
      dischargeKWh: round(x.dis * fDis),
    });
  }
  return out;
}

const round = (v: number) => Math.round(v * 10_000) / 10_000;
