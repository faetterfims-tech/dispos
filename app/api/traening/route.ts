import { NextResponse, type NextRequest } from "next/server";
import { storeConfigured } from "@/lib/store";
import { deleteBody, deleteSession, loadAll, saveBody, saveSession } from "@/lib/traening-store";
import { sanitizeBody, sanitizeSession } from "@/lib/traening/logic";

export const dynamic = "force-dynamic";

const fail = (error: string, status: number) => NextResponse.json({ ok: false, error }, { status });

/** GET /api/traening — alle pas og kropsmål. */
export async function GET() {
  if (!storeConfigured()) return NextResponse.json({ configured: false, sessions: [], body: [] });
  try {
    return NextResponse.json({ configured: true, ...(await loadAll()) });
  } catch (err) {
    console.error(err);
    return fail(err instanceof Error ? err.message : "Kunne ikke hente træningsloggen.", 502);
  }
}

/** POST /api/traening — { kind: "session", session } eller { kind: "body", entry }. */
export async function POST(req: NextRequest) {
  if (!storeConfigured()) return fail("Lageret er ikke koblet på.", 503);
  let body: { kind?: string; session?: unknown; entry?: unknown };
  try {
    body = await req.json();
  } catch {
    return fail("Body er ikke gyldig JSON.", 400);
  }
  try {
    if (body.kind === "session") {
      const s = sanitizeSession(body.session);
      if (!s) return fail("Passet mangler dato eller sæt med gentagelser.", 422);
      const saved = { ...s, savedAt: new Date().toISOString() };
      await saveSession(saved);
      return NextResponse.json({ ok: true, session: saved });
    }
    if (body.kind === "body") {
      const b = sanitizeBody(body.entry);
      if (!b) return fail("Skriv vægt og/eller livvidde.", 422);
      await saveBody(b);
      return NextResponse.json({ ok: true, entry: b });
    }
    return fail("Ukendt kind.", 400);
  } catch (err) {
    console.error(err);
    return fail("Kunne ikke gemme.", 502);
  }
}

/** DELETE /api/traening?kind=session&id=… eller ?kind=body&date=… */
export async function DELETE(req: NextRequest) {
  if (!storeConfigured()) return fail("Lageret er ikke koblet på.", 503);
  const p = req.nextUrl.searchParams;
  try {
    if (p.get("kind") === "session" && p.get("id")) await deleteSession(p.get("id")!);
    else if (p.get("kind") === "body" && p.get("date")) await deleteBody(p.get("date")!);
    else return fail("Mangler kind og id/date.", 400);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return fail("Kunne ikke slette.", 502);
  }
}
