import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE, AUTH_MAX_AGE, authToken, safeEqual, safeNext } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** POST /api/login — formularen på /login. Rigtig kode: cookie og videre. */
export async function POST(req: NextRequest) {
  const password = process.env.DISPOS_PASSWORD;
  const form = await req.formData().catch(() => null);
  const given = String(form?.get("password") ?? "");
  const next = safeNext(form?.get("next"));
  const origin = req.nextUrl.origin;

  if (!password || !safeEqual(given, password)) {
    // Lille pause gør det langsomt at gætte koden.
    await new Promise((r) => setTimeout(r, 800));
    const back = new URL("/login", origin);
    back.searchParams.set("fejl", "1");
    if (next !== "/") back.searchParams.set("next", next);
    return NextResponse.redirect(back, 303);
  }

  const res = NextResponse.redirect(new URL(next, origin), 303);
  res.cookies.set(AUTH_COOKIE, await authToken(password), {
    httpOnly: true,
    secure: req.nextUrl.protocol === "https:",
    sameSite: "lax",
    path: "/",
    maxAge: AUTH_MAX_AGE,
  });
  return res;
}
