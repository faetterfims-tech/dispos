import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** POST /api/logout — glem login-cookien på denne enhed. */
export async function POST(req: NextRequest) {
  const res = NextResponse.redirect(new URL("/login", req.nextUrl.origin), 303);
  res.cookies.delete(AUTH_COOKIE);
  return res;
}
