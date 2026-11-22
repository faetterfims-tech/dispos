import { NextResponse, type NextRequest } from "next/server";
import { storeConfigured } from "@/lib/store";
import { userByToken } from "@/lib/traening-users";
import { COOKIE_MAX_AGE, TRAINING_COOKIE } from "@/lib/traening/invite-core";

export const dynamic = "force-dynamic";

const page = (title: string, text: string, status: number) =>
  new NextResponse(
    `<!doctype html><html lang="da"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
<style>body{font-family:system-ui,sans-serif;background:#f6f5f2;color:#171614;display:grid;place-items:center;min-height:100vh;margin:0;padding:1.5rem;text-align:center}div{max-width:26rem}h1{font-size:1.5rem}p{color:#5b5953;line-height:1.5}</style>
</head><body><div><h1>${title}</h1><p>${text}</p></div></body></html>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } },
  );

/**
 * /t/<token> — personligt invitationslink. Gyldigt link: husk personen i en
 * cookie og send direkte ind i træningsappen. Resten af dispos kræver stadig koden.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!storeConfigured()) return page("Ikke klar endnu", "Træningsappen er ikke sat op endnu.", 503);
  const user = await userByToken(token).catch(() => null);
  if (!user) return page("Linket virker ikke", "Linket er ugyldigt eller er blevet erstattet af et nyt. Bed Daniel om et nyt link.", 404);

  const res = NextResponse.redirect(new URL("/traening", req.nextUrl.origin), 303);
  res.cookies.set(TRAINING_COOKIE, token, {
    httpOnly: true,
    secure: req.nextUrl.protocol === "https:",
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
  res.headers.set("Referrer-Policy", "no-referrer");
  return res;
}
