import { NextResponse, type NextRequest } from "next/server";

/**
 * Hele dispos er låst bag én adgangskode (DISPOS_PASSWORD).
 * Browseren spørger én gang og husker det. Brugernavnet er ligegyldigt.
 * Uden DISPOS_PASSWORD er siden lukket — så den aldrig ved et uheld står åben.
 */
export function middleware(req: NextRequest) {
  const password = process.env.DISPOS_PASSWORD;
  if (!password) {
    return new NextResponse("DISPOS_PASSWORD er ikke sat i Vercel → Settings → Environment Variables.", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const header = req.headers.get("authorization");
  if (header?.startsWith("Basic ")) {
    try {
      const decoded = atob(header.slice(6));
      const given = decoded.slice(decoded.indexOf(":") + 1);
      if (safeEqual(given, password)) return NextResponse.next();
    } catch {
      /* ugyldig base64 */
    }
  }

  return new NextResponse("Adgangskode påkrævet", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="dispos", charset="UTF-8"' },
  });
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.svg).*)"],
};
