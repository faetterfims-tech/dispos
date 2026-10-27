import "server-only";
import type { MeterHour } from "./solar/merge";
import { fillSellPrices, type SellPriceInput } from "./solar/sellprice";

/**
 * Klient til Min Strøm Consumer API (kræver Min Strøm Plus).
 * Docs: https://docs.minstroem.app/llms.txt
 *
 * Alle tider er UTC. Manglende rækker betyder "ukendt", ikke nul.
 * Grænser: 60 kald/min, 2.000/dag. Timedata max 366 dage pr. kald.
 */
const BASE = "https://api.minstroem.app/consumer/v1";
const MAX_RANGE_DAYS = 360; // lidt under 366 for at undgå range_too_large efter udvidelse

export class MinStromError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

function apiKey(): string {
  // Tål indsat mellemrum, linjeskift, anførselstegn eller et "Bearer "-præfiks.
  const key = (process.env.MINSTROEM_API_KEY ?? "")
    .trim()
    .replace(/^["']|["']$/g, "")
    .replace(/^Bearer\s+/i, "")
    .trim();
  if (!key) throw new MinStromError(500, "missing_key", "MINSTROEM_API_KEY er ikke sat i Vercel.");
  return key;
}

const DANISH: Record<string, string> = {
  invalid_token: "Min Strøm afviser API-nøglen. Opret en ny nøgle i Min Strøm-appen og læg den i MINSTROEM_API_KEY i Vercel.",
  credential_expired: "API-nøglen er udløbet. Opret en ny i Min Strøm-appen og opdatér MINSTROEM_API_KEY i Vercel.",
  plus_required: "API'et kræver et aktivt Min Strøm Plus-abonnement.",
  forbidden: "Nøglen har ikke adgang til denne adresse.",
  range_too_large: "Perioden er for lang til ét kald.",
  rate_limited: "For mange kald til Min Strøm lige nu. Prøv igen om et minut.",
  upstream_unavailable: "Min Strøm kan ikke hente data lige nu. Prøv igen senere.",
};

async function get<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(BASE + path);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey()}`, Accept: "application/json" },
    // Historiske data ændrer sig sjældent; cache en time.
    next: { revalidate: 3600 },
  });
  if (!res.ok) {
    let code = res.status === 401 ? "invalid_token" : "http_error";
    let detail = "";
    try {
      const text = await res.text();
      try {
        const body = JSON.parse(text);
        code = body?.error?.code ?? body?.code ?? code;
        detail = body?.error?.message ?? body?.message ?? "";
      } catch {
        detail = text.slice(0, 200);
      }
    } catch {
      /* ingen body */
    }
    const message = DANISH[code] ?? `Min Strøm svarede ${res.status}${detail ? `: ${detail}` : ""}`;
    throw new MinStromError(res.status, code, `${message} (${code})`);
  }
  return res.json() as Promise<T>;
}

interface Address {
  id: string;
  label?: string | null;
  formattedAddress?: string | null;
  capabilities?: Record<string, boolean>;
}

interface Series<T> {
  data: T[];
}

interface CostRow {
  start: string;
  energyKWh: number | null;
  totalPricePerKWh: number | null;
  totalCost: number | null;
}

interface RevenueRow {
  start: string;
  energyKWh: number | null;
  totalPricePerKWh: number | null;
  netRevenue: number | null;
}

interface PriceRow {
  start: string;
  totalPricePerKWh: number | null;
  variableChargesPerKWh: number | null;
}

export async function getAddress(): Promise<Address> {
  const res = await get<Series<Address>>("/me/addresses");
  const wanted = process.env.MINSTROEM_ADDRESS_ID?.toLowerCase();
  const addr = wanted ? res.data.find((a) => a.id.toLowerCase() === wanted) : res.data[0];
  if (!addr) throw new MinStromError(404, "no_address", "Fandt ingen adresse på Min Strøm-kontoen.");
  return addr;
}

/** Deler [from, to) i bidder, så hvert kald holder sig under grænsen. */
function chunks(from: Date, to: Date): [Date, Date][] {
  const out: [Date, Date][] = [];
  let a = from;
  while (a < to) {
    const b = new Date(Math.min(to.getTime(), a.getTime() + MAX_RANGE_DAYS * 86_400_000));
    out.push([a, b]);
    a = b;
  }
  return out;
}

const key = (iso: string) => new Date(iso).toISOString();

/**
 * Henter køb, salg og priser time for time og fletter dem.
 * Købspris: den faktiske afregningspris fra udgiftsdata, ellers timeprisen.
 * Salgspris: den faktiske fra indtægtsdata, ellers estimeret (se sellprice.ts).
 */
export async function getMeterHours(from: Date, to: Date) {
  const address = await getAddress();
  const base = `/me/addresses/${address.id}`;

  const rows = new Map<string, SellPriceInput>();
  const row = (start: string) => {
    const k = key(start);
    let r = rows.get(k);
    if (!r) {
      r = { start: k, importKWh: null, exportKWh: null, buyPrice: null, sellPrice: null, variableCharges: null };
      rows.set(k, r);
    }
    return r;
  };

  for (const [a, b] of chunks(from, to)) {
    const range = { from: a.toISOString(), to: b.toISOString() };
    const [costs, revenue, prices] = await Promise.all([
      get<Series<CostRow>>(`${base}/consumption-costs`, { ...range, aggregation: "hour" }),
      get<Series<RevenueRow>>(`${base}/solar-export-revenue`, { ...range, aggregation: "hour" }),
      get<Series<PriceRow>>(`${base}/prices`, { ...range, resolution: "hour" }),
    ]);
    for (const p of prices.data) {
      const r = row(p.start);
      r.buyPrice = p.totalPricePerKWh;
      r.variableCharges = p.variableChargesPerKWh;
    }
    for (const c of costs.data) {
      const r = row(c.start);
      r.importKWh = c.energyKWh;
      if (c.totalPricePerKWh != null) r.buyPrice = c.totalPricePerKWh;
    }
    for (const e of revenue.data) {
      const r = row(e.start);
      r.exportKWh = e.energyKWh;
      if (e.totalPricePerKWh != null && (e.energyKWh ?? 0) > 0) r.sellPrice = e.totalPricePerKWh;
    }
  }

  const sorted = [...rows.values()].sort((a, b) => a.start.localeCompare(b.start));
  const filled = fillSellPrices(sorted);
  const hours: MeterHour[] = filled.hours.map((h) => ({
    start: h.start,
    importKWh: h.importKWh,
    exportKWh: h.exportKWh,
    buyPrice: h.buyPrice,
    sellPrice: h.sellPrice,
    sellPriceEstimated: h.sellPriceEstimated,
  }));

  return {
    address: { id: address.id, label: address.formattedAddress ?? address.label ?? null },
    hours,
    sellPriceMethod: filled.method,
    sellPriceFee: filled.fee,
  };
}
