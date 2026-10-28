import { NextResponse, type NextRequest } from "next/server";
import { getMeterHours, MinStromError } from "@/lib/minstrom";
import { packHours } from "@/lib/solar/merge";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** GET /api/solceller?from=2025-08-01&to=2026-10-27 — måledata time for time fra Min Strøm. */
export async function GET(req: NextRequest) {
  const fromParam = req.nextUrl.searchParams.get("from");
  const toParam = req.nextUrl.searchParams.get("to");
  const from = fromParam ? new Date(fromParam) : null;
  const to = toParam ? new Date(toParam) : new Date();

  if (!from || Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from >= to) {
    return NextResponse.json({ error: "Ugyldig periode. Brug ?from=ÅÅÅÅ-MM-DD&to=ÅÅÅÅ-MM-DD." }, { status: 400 });
  }
  if (to.getTime() - from.getTime() > 6 * 366 * 86_400_000) {
    return NextResponse.json({ error: "Perioden må højst være seks år." }, { status: 400 });
  }

  try {
    const { hours, ...rest } = await getMeterHours(from, to);
    return NextResponse.json({ ...rest, packed: packHours(hours) });
  } catch (err) {
    if (err instanceof MinStromError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.code === "missing_key" ? 500 : 502 });
    }
    console.error(err);
    return NextResponse.json({ error: "Uventet fejl ved hentning fra Min Strøm." }, { status: 500 });
  }
}
