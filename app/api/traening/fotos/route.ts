import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { storeConfigured } from "@/lib/store";
import { deletePhoto, getPhoto, listPhotos, savePhoto } from "@/lib/traening-store";
import { currentUser } from "@/lib/traening-users";
import { MAX_FULL_BYTES, MAX_THUMB_BYTES, isKind, isView, parseImageDataUrl, type PhotoMeta } from "@/lib/traening/photos-core";

export const dynamic = "force-dynamic";

const fail = (error: string, status: number) => NextResponse.json({ ok: false, error }, { status });
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const ID_RE = /^[a-f0-9]{16}$/;

/**
 * GET /api/traening/fotos            → liste over egne billeder
 * GET /api/traening/fotos?id=…&size= → selve billedet (thumb eller full)
 * Billederne er private: kun den, der er logget ind, kan se sine egne.
 */
export async function GET(req: NextRequest) {
  if (!storeConfigured()) return NextResponse.json({ ok: true, photos: [] });
  const user = await currentUser(req);
  if (!user) return fail("Ingen adgang.", 401);
  const id = req.nextUrl.searchParams.get("id");
  try {
    if (!id) return NextResponse.json({ ok: true, photos: await listPhotos(user.id) });
    if (!ID_RE.test(id)) return fail("Ukendt billede.", 400);
    const size = req.nextUrl.searchParams.get("size") === "full" ? "full" : "thumb";
    const b64 = await getPhoto(user.id, id, size);
    if (!b64) return fail("Billedet findes ikke.", 404);
    return new NextResponse(Buffer.from(b64, "base64"), {
      headers: {
        "Content-Type": "image/jpeg",
        // Id'et ændrer sig aldrig for et billede, så browseren må gemme det — men kun privat.
        "Cache-Control": "private, max-age=31536000, immutable",
      },
    });
  } catch (err) {
    console.error(err);
    return fail("Kunne ikke hente billeder.", 502);
  }
}

/** POST { date, kind, view, full, thumb } — full/thumb er data-URL'er (JPEG/WebP), skaleret ned i browseren. */
export async function POST(req: NextRequest) {
  if (!storeConfigured()) return fail("Databasen er ikke koblet på.", 503);
  const user = await currentUser(req);
  if (!user) return fail("Ingen adgang.", 401);
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail("Body er ikke gyldig JSON.", 400);
  }
  const full = parseImageDataUrl(body.full, MAX_FULL_BYTES);
  const thumb = parseImageDataUrl(body.thumb, MAX_THUMB_BYTES);
  if (!full || !thumb) return fail("Billedet er ugyldigt eller for stort.", 422);
  if (typeof body.date !== "string" || !DATE_RE.test(body.date)) return fail("Ugyldig dato.", 422);
  if (!isKind(body.kind) || !isView(body.view)) return fail("Vælg type og vinkel.", 422);
  const meta: PhotoMeta = { id: randomBytes(8).toString("hex"), date: body.date, kind: body.kind, view: body.view, savedAt: new Date().toISOString() };
  try {
    await savePhoto(user.id, meta, full.base64, thumb.base64);
    return NextResponse.json({ ok: true, photo: meta });
  } catch (err) {
    console.error(err);
    return fail("Kunne ikke gemme billedet.", 502);
  }
}

/** DELETE ?id=… */
export async function DELETE(req: NextRequest) {
  if (!storeConfigured()) return fail("Databasen er ikke koblet på.", 503);
  const user = await currentUser(req);
  if (!user) return fail("Ingen adgang.", 401);
  const id = req.nextUrl.searchParams.get("id");
  if (!id || !ID_RE.test(id)) return fail("Ukendt billede.", 400);
  try {
    await deletePhoto(user.id, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return fail("Kunne ikke slette.", 502);
  }
}
