import { NextResponse, type NextRequest } from "next/server";
import { loadHours } from "@/lib/sunmate-store";
import { storeConfigured } from "@/lib/store";

export const dynamic = "force-dynamic";

/** GET /api/sunmate/hours?from=…&to=… — gemte anlægsdata pr. time. */
export async function GET(req: NextRequest) {
  const from = new Date(req.nextUrl.searchParams.get("from") ?? "");
  const to = new Date(req.nextUrl.searchParams.get("to") ?? Date.now());
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from >= to) {
    return NextResponse.json({ error: "Ugyldig periode." }, { status: 400 });
  }
  if (!storeConfigured()) {
    return NextResponse.json({ configured: false, hours: [] });
  }
  try {
    const hours = await loadHours(from, to);
    return NextResponse.json({ configured: true, hours });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
