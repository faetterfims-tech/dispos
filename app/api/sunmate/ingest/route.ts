import { NextResponse, type NextRequest } from "next/server";
import { saveHours } from "@/lib/sunmate-store";
import { timelineToHours, type TimelinePoint } from "@/lib/solar/timeline";

export const dynamic = "force-dynamic";

/**
 * POST /api/sunmate/ingest — modtager SunMates /livedashboard-svar uændret.
 * Bruges af Home Assistant derhjemme, fordi SunMates Cloudflare blokerer kald
 * fra servere. Beskyttet af samme adgangskode som resten af dispos (middleware).
 */
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Body er ikke gyldig JSON." }, { status: 400 });
  }

  // Tål både hele svaret ({ error, data }) og kun data-delen.
  const root = (body as { data?: unknown })?.data ?? body;
  const data = root as {
    updated_at?: string;
    timeline?: TimelinePoint[];
    asset_info?: {
      asset_id?: string;
      battery?: { charged_today_kwh?: number | null; discharged_today_kwh?: number | null };
      solar?: { produced_today_kwh?: number | null };
    };
  };
  if (!Array.isArray(data?.timeline)) {
    return NextResponse.json({ ok: false, error: "Mangler timeline — er det svaret fra /livedashboard?" }, { status: 422 });
  }

  const totals = {
    produced_today_kwh: data.asset_info?.solar?.produced_today_kwh ?? null,
    charged_today_kwh: data.asset_info?.battery?.charged_today_kwh ?? null,
    discharged_today_kwh: data.asset_info?.battery?.discharged_today_kwh ?? null,
  };
  try {
    const hours = timelineToHours(data.timeline, totals);
    const saved = await saveHours(hours);
    return NextResponse.json({
      ok: true,
      assetId: data.asset_info?.asset_id ?? null,
      updatedAt: data.updated_at ?? null,
      timelinePoints: data.timeline.length,
      hoursSaved: saved,
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
