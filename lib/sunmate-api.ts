import "server-only";
import type { DayTotals, TimelinePoint } from "./solar/timeline";

/**
 * SunMate Customer API. Kræver et Personal API Token med rettighederne
 * assets:read og live_dashboard:read (SunMate → Integrations → Manage API Tokens).
 * API'et har ingen historik — kun dagens tidslinje. Derfor samles den løbende.
 */
const BASE = "https://portal.sunmate.io/api/customer/v1";

export class SunMateError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

function token(): string {
  const t = (process.env.SUNMATE_API_TOKEN ?? "")
    .trim()
    .replace(/^["']|["']$/g, "")
    .replace(/^Bearer\s+/i, "")
    .trim();
  if (!t) throw new SunMateError(500, "SUNMATE_API_TOKEN er ikke sat i Vercel.");
  return t;
}

const MESSAGES: Record<number, string> = {
  401: "SunMate afviser tokenet. Opret et nyt under Integrations → Manage API Tokens.",
  403: "SunMate afviser tokenets rettigheder til dette kald.",
  429: "For mange kald til SunMate. Prøv igen om lidt.",
  503: "SunMate er midlertidigt utilgængelig.",
};

async function get<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(BASE + path);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token()}`,
      Accept: "application/json",
      // Cloudflare foran SunMate udfordrer anonyme klienter; identificér os.
      "User-Agent": "dispos/1.0 (+https://dispos.dk; personal SunMate API client)",
      "Accept-Language": "da-DK,da;q=0.9,en;q=0.8",
    },
    cache: "no-store",
  });
  if (!res.ok) {
    let detail = "";
    try {
      const text = await res.text();
      try {
        const body = JSON.parse(text);
        detail = body?.message ?? body?.error ?? JSON.stringify(body).slice(0, 200);
      } catch {
        detail = text.slice(0, 200);
      }
    } catch {
      /* ingen body */
    }
    if (/just a moment|cf-chl|challenge-platform/i.test(detail) || res.headers.get("cf-mitigated")) {
      throw new SunMateError(
        res.status,
        `SunMates Cloudflare-beskyttelse blokerer kald fra dispos' server [${path}]. SunMate skal undtage /api/customer/v1 fra bot-tjekket.`,
      );
    }
    const base = MESSAGES[res.status] ?? `SunMate svarede ${res.status}`;
    throw new SunMateError(res.status, `${base} [${path} → ${res.status}${detail ? `: ${detail}` : ""}]`);
  }
  return res.json() as Promise<T>;
}

interface AssetList {
  data: { assets: { asset_info: { asset_id: string; asset_name?: string; asset_type?: string } }[] };
}

/**
 * Inverter-ID'er der skal prøves, i rækkefølge. SUNMATE_ASSET_ID må indeholde
 * flere kommaseparerede kandidater (fx serienummer og System ID); ellers slås
 * den første inverter op via /assets/list.
 */
/** Daniels Deye-inverter: serienummer og SunMate System ID (fra "Mine Invertere"). Ikke hemmelige. */
const KNOWN_ASSET_IDS = ["2409044532", "076d8534-e95d-4be1-a724-ba8445ea8d5f"];

export async function getAssetIds(): Promise<string[]> {
  const fixed = [...(process.env.SUNMATE_ASSET_ID ?? "").split(","), ...KNOWN_ASSET_IDS]
    .map((s) => s.trim())
    .filter((s, i, all) => s && all.indexOf(s) === i);
  if (fixed.length > 0) return fixed;
  const res = await get<AssetList>("/assets/list");
  const inverter = res.data.assets.find((a) => a.asset_info.asset_type === "inverter") ?? res.data.assets[0];
  if (!inverter) throw new SunMateError(404, "Fandt ingen inverter på SunMate-kontoen.");
  return [inverter.asset_info.asset_id];
}

interface LiveDashboard {
  data: {
    updated_at?: string;
    asset_info: {
      battery?: { charged_today_kwh?: number | null; discharged_today_kwh?: number | null };
      solar?: { produced_today_kwh?: number | null };
    };
    timeline: TimelinePoint[];
  };
}

export async function getTodayTimeline(): Promise<{
  assetId: string;
  updatedAt: string | null;
  timeline: TimelinePoint[];
  totals: DayTotals;
}> {
  const ids = await getAssetIds();
  let res: LiveDashboard | null = null;
  let assetId = ids[0];
  const errors: string[] = [];
  for (const id of ids) {
    try {
      res = await get<LiveDashboard>("/livedashboard", { asset_id: id });
      assetId = id;
      break;
    } catch (err) {
      // 403/404/422 kan betyde forkert ID — prøv næste kandidat.
      if (err instanceof SunMateError && [403, 404, 422].includes(err.status) && ids.length > 1) {
        errors.push(`${id}: ${err.message}`);
        continue;
      }
      throw err;
    }
  }
  if (!res) throw new SunMateError(403, `Ingen af inverter-ID'erne virkede. ${errors.join(" | ")}`);
  const info = res.data.asset_info ?? {};
  return {
    assetId,
    updatedAt: res.data.updated_at ?? null,
    timeline: res.data.timeline ?? [],
    totals: {
      produced_today_kwh: info.solar?.produced_today_kwh ?? null,
      charged_today_kwh: info.battery?.charged_today_kwh ?? null,
      discharged_today_kwh: info.battery?.discharged_today_kwh ?? null,
    },
  };
}
