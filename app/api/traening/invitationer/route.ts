import { NextResponse, type NextRequest } from "next/server";
import { storeConfigured } from "@/lib/store";
import { countSessions, deleteAllData } from "@/lib/traening-store";
import { createUser, deleteUser, isOwner, listUsers, renewToken, revokeUser } from "@/lib/traening-users";
import { cleanName } from "@/lib/traening/invite-core";

export const dynamic = "force-dynamic";

const fail = (error: string, status: number) => NextResponse.json({ ok: false, error }, { status });

/** Linket, den inviterede skal åbne. */
const linkFor = (req: NextRequest, token: string) => new URL(`/t/${token}`, req.nextUrl.origin).toString();

/** Kun ejeren (logget ind med Dispos-koden) må se og ændre invitationer. */
function guard(req: NextRequest) {
  if (!storeConfigured()) return fail("Lageret er ikke koblet på.", 503);
  if (!isOwner(req)) return fail("Kun Daniel kan styre invitationer.", 403);
  return null;
}

/** GET — alle inviterede med antal pas. */
export async function GET(req: NextRequest) {
  const g = guard(req);
  if (g) return g;
  try {
    const users = await listUsers();
    const counts = await Promise.all(users.map((u) => countSessions(u.id).catch(() => 0)));
    return NextResponse.json({
      ok: true,
      users: users.map((u, i) => ({ id: u.id, name: u.name, createdAt: u.createdAt, lastSeen: u.lastSeen ?? null, active: !!u.tokenHash, sessions: counts[i] })),
    });
  } catch (err) {
    console.error(err);
    return fail("Kunne ikke hente invitationer.", 502);
  }
}

/** POST — { name } laver en ny inviteret · { renew: id } laver et nyt link (det gamle stopper). */
export async function POST(req: NextRequest) {
  const g = guard(req);
  if (g) return g;
  let body: { name?: unknown; renew?: unknown };
  try {
    body = await req.json();
  } catch {
    return fail("Body er ikke gyldig JSON.", 400);
  }
  try {
    if (typeof body.renew === "string") {
      const r = await renewToken(body.renew);
      if (!r) return fail("Ukendt person.", 404);
      return NextResponse.json({ ok: true, name: r.user.name, link: linkFor(req, r.token) });
    }
    const name = cleanName(body.name);
    if (!name) return fail("Skriv et navn.", 422);
    const { user, token } = await createUser(name);
    return NextResponse.json({ ok: true, name: user.name, link: linkFor(req, token) });
  } catch (err) {
    console.error(err);
    return fail("Kunne ikke lave linket.", 502);
  }
}

/** DELETE ?id=…  fjerner adgang · &slet=1 sletter også personen og alle deres træningsdata. */
export async function DELETE(req: NextRequest) {
  const g = guard(req);
  if (g) return g;
  const id = req.nextUrl.searchParams.get("id");
  if (!id || !/^[a-f0-9]{6,32}$/.test(id)) return fail("Mangler id.", 400);
  try {
    if (req.nextUrl.searchParams.get("slet") === "1") {
      await deleteAllData(id);
      await deleteUser(id);
    } else await revokeUser(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return fail("Kunne ikke fjerne adgangen.", 502);
  }
}
