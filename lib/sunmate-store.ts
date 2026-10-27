import "server-only";
import type { SystemHour } from "./solar/sunmate";
import { localMonth } from "./solar/time";
import { hgetall, hset, set } from "./store";

/** Én hash pr. måned: sunmate:2026-10 → { "2026-10-27T10:00:00.000Z": "[pv,opl,afl]" } */
const monthKey = (m: string) => `sunmate:${m}`;

export async function saveHours(hours: SystemHour[]): Promise<number> {
  const byMonth = new Map<string, Record<string, string>>();
  for (const h of hours) {
    const m = localMonth(h.start);
    if (!byMonth.has(m)) byMonth.set(m, {});
    byMonth.get(m)![h.start] = JSON.stringify([h.pvKWh, h.chargeKWh ?? null, h.dischargeKWh ?? null]);
  }
  for (const [m, fields] of byMonth) await hset(monthKey(m), fields);
  await set("sunmate:last-run", new Date().toISOString());
  return hours.length;
}

function monthsBetween(from: Date, to: Date): string[] {
  const out: string[] = [];
  // Gå én dag ad gangen er unødvendigt; gå måned for måned i dansk tid med lidt margin.
  const start = localMonth(new Date(from.getTime() - 86_400_000).toISOString());
  const end = localMonth(new Date(to.getTime() + 86_400_000).toISOString());
  let [y, m] = start.split("-").map(Number);
  const [ey, em] = end.split("-").map(Number);
  while (y < ey || (y === ey && m <= em)) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
}

export async function loadHours(from: Date, to: Date): Promise<SystemHour[]> {
  const out: SystemHour[] = [];
  for (const m of monthsBetween(from, to)) {
    const hash = await hgetall(monthKey(m));
    for (const [start, raw] of Object.entries(hash)) {
      const t = Date.parse(start);
      if (t < from.getTime() || t >= to.getTime()) continue;
      try {
        const [pv, chg, dis] = JSON.parse(raw) as [number | null, number | null, number | null];
        out.push({ start, pvKWh: pv, chargeKWh: chg, dischargeKWh: dis });
      } catch {
        /* beskadiget felt — spring over */
      }
    }
  }
  return out.sort((a, b) => a.start.localeCompare(b.start));
}
