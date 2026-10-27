import { NextResponse } from "next/server";
import { getTodayTimeline, SunMateError } from "@/lib/sunmate-api";
import { saveHours } from "@/lib/sunmate-store";
import { timelineToHours } from "@/lib/solar/timeline";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Henter dagens tidslinje fra SunMate, regner den om til hele timer og gemmer dem.
 * Kaldes af GitHub Actions ca. hver halve time (.github/workflows/sunmate.yml).
 * Kan kaldes igen og igen — samme time overskrives bare med nyere tal.
 */
export async function GET() {
  try {
    const { assetId, updatedAt, timeline, totals } = await getTodayTimeline();
    const hours = timelineToHours(timeline, totals);
    const saved = await saveHours(hours);
    return NextResponse.json({
      ok: true,
      assetId,
      updatedAt,
      timelinePoints: timeline.length,
      firstPoint: timeline[0]?.datetime ?? null,
      lastPoint: timeline[timeline.length - 1]?.datetime ?? null,
      hoursSaved: saved,
      totals,
    });
  } catch (err) {
    const status = err instanceof SunMateError ? 502 : 500;
    const message = err instanceof Error ? err.message : String(err);
    console.error("sunmate/collect:", message);
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
