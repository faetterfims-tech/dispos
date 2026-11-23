import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE, authToken, basicHeader, passwordFromBasic, safeEqual } from "@/lib/auth";

/**
 * Hele dispos er låst bag én adgangskode (DISPOS_PASSWORD).
 * Browsere logger ind på /login og huskes med en cookie (se lib/auth.ts) —
 * det virker også, når dispos er installeret som app på hjemmeskærmen.
 * Scripts (Home Assistant, curl) kan stadig sende koden som Basic Auth.
 * Uden DISPOS_PASSWORD er siden lukket — så den aldrig ved et uheld står åben.
 *
 * Undtagelse: træningsappen kan deles via personlige links (/t/<token>).
 * Linket sætter en cookie, og med den kommer man ind i /traening og
 * /api/traening — men intet andet. Selve tjekket af cookien sker i API'et.
 */

/** Samme navn som TRAINING_COOKIE i lib/traening/invite-core.ts (kan ikke importeres i edge). */
const TRAINING_COOKIE = "dispos_traening";

const isTrainingPath = (path: string) => path === "/traening" || path.startsWith("/traening/") || path === "/api/traening";

/** Sider der skal kunne nås uden login. */
const isPublicPath = (path: string) => path === "/login" || path === "/api/login" || path.startsWith("/t/");

export async function middleware(req: NextRequest) {
  const password = process.env.DISPOS_PASSWORD;
  if (!password) {
    return new NextResponse("DISPOS_PASSWORD er ikke sat i Vercel → Settings → Environment Variables.", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const path = req.nextUrl.pathname;
  if (isPublicPath(path)) return NextResponse.next();

  // Scripts: koden som Basic Auth.
  const given = passwordFromBasic(req.headers.get("authorization"));
  if (given !== null && safeEqual(given, password)) return NextResponse.next();

  // Browser: login-cookien. Vi sætter Basic-headeren på forespørgslen, så API'er,
  // der genkender ejeren på den (fx træningsappen), virker uændret.
  const cookie = req.cookies.get(AUTH_COOKIE)?.value;
  if (cookie && safeEqual(cookie, await authToken(password))) {
    const headers = new Headers(req.headers);
    headers.set("authorization", basicHeader(password));
    return NextResponse.next({ request: { headers } });
  }

  // Inviterede (cookie fra linket) må kun komme ind i træningsappen.
  if (isTrainingPath(path) && req.cookies.get(TRAINING_COOKIE)?.value) {
    // Sørg for at en falsk/forkert Basic-header ikke følger med videre.
    const headers = new Headers(req.headers);
    headers.delete("authorization");
    return NextResponse.next({ request: { headers } });
  }

  if (path.startsWith("/api/")) {
    return NextResponse.json({ error: "Log ind på dispos først." }, { status: 401 });
  }

  const login = new URL("/login", req.nextUrl.origin);
  if (path !== "/") login.searchParams.set("next", path + req.nextUrl.search);
  return NextResponse.redirect(login, 303);
}

export const config = {
  // Filer, der skal kunne hentes uden login: app-manifest, ikoner, service worker og offline-side.
  matcher: [
    "/((?!_next/static|_next/image|favicon.svg|manifest.webmanifest|sw.js|offline.html|apple-touch-icon.png|icons/).*)",
  ],
};
