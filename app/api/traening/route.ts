import { NextResponse, type NextRequest } from "next/server";
import { storeConfigured } from "@/lib/store";
import { deleteBody, deleteSession, loadAll, saveBody, saveEquipment, saveNext, saveProfile, saveProgram, saveSession } from "@/lib/traening-store";
import { DAYS, isEquip, isProgramId } from "@/lib/traening/program";
import { currentUser } from "@/lib/traening-users";
import { isLevel, isSex } from "@/lib/traening/loads";
import { sanitizeBody, sanitizeSession } from "@/lib/traening/logic";

export const dynamic = "force-dynamic";

const fail = (error: string, status: number) => NextResponse.json({ ok: false, error }, { status });

const noAccess = () => fail("Linket virker ikke længere. Bed om et nyt.", 401);

/** GET /api/traening — alle pas og kropsmål for den, der er logget ind. */
export async function GET(req: NextRequest) {
  if (!storeConfigured()) return NextResponse.json({ configured: false, sessions: [], body: [], next: null, program: "udstyr", equipment: null, profile: null, me: { name: "Daniel", owner: true } });
  try {
    const user = await currentUser(req);
    if (!user) return noAccess();
    return NextResponse.json({ configured: true, me: { name: user.name, owner: !!user.owner }, ...(await loadAll(user.id)) });
  } catch (err) {
    console.error(err);
    return fail(err instanceof Error ? err.message : "Kunne ikke hente træningsloggen.", 502);
  }
}

/** POST /api/traening — { kind: "session", session } · { kind: "body", entry } · { kind: "next", dayId } (spring over) · { kind: "program", program } · { kind: "equipment", equipment } · { kind: "profile", level, sex, ramp? }. */
export async function POST(req: NextRequest) {
  if (!storeConfigured()) return fail("Lageret er ikke koblet på.", 503);
  const user = await currentUser(req);
  if (!user) return noAccess();
  let body: { kind?: string; session?: unknown; entry?: unknown; dayId?: unknown; program?: unknown; equipment?: unknown; level?: unknown; sex?: unknown; ramp?: unknown };
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
      await saveSession(user.id, saved);
      return NextResponse.json({ ok: true, session: saved });
    }
    if (body.kind === "body") {
      const b = sanitizeBody(body.entry);
      if (!b) return fail("Skriv vægt og/eller livvidde.", 422);
      await saveBody(user.id, b);
      return NextResponse.json({ ok: true, entry: b });
    }
    if (body.kind === "next") {
      if (typeof body.dayId !== "string" || !DAYS.some((d) => d.id === body.dayId)) return fail("Ukendt pas.", 422);
      const next = { dayId: body.dayId, setAt: new Date().toISOString() };
      await saveNext(user.id, next);
      return NextResponse.json({ ok: true, next });
    }
    if (body.kind === "profile") {
      if (!isLevel(body.level)) return fail("Vælg erfaring.", 422);
      const profile = { level: body.level, ...(isSex(body.sex) ? { sex: body.sex } : {}), ...(typeof body.ramp === "boolean" ? { ramp: body.ramp } : {}) };
      await saveProfile(user.id, profile);
      return NextResponse.json({ ok: true, profile });
    }
    if (body.kind === "equipment") {
      if (!Array.isArray(body.equipment) || body.equipment.length > 10) return fail("Ugyldigt udstyr.", 422);
      const equipment = [...new Set(body.equipment.filter(isEquip))];
      await saveEquipment(user.id, equipment);
      return NextResponse.json({ ok: true, equipment });
    }
    if (body.kind === "program") {
      if (!isProgramId(body.program)) return fail("Ukendt program.", 422);
      await saveProgram(user.id, body.program);
      return NextResponse.json({ ok: true, program: body.program });
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
  const user = await currentUser(req);
  if (!user) return noAccess();
  const p = req.nextUrl.searchParams;
  try {
    if (p.get("kind") === "session" && p.get("id")) await deleteSession(user.id, p.get("id")!);
    else if (p.get("kind") === "body" && p.get("date")) await deleteBody(user.id, p.get("date")!);
    else return fail("Mangler kind og id/date.", 400);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return fail("Kunne ikke slette.", 502);
  }
}
