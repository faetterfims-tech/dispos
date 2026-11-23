/**
 * Login til dispos. Kører både i middleware (edge) og i API-ruter, så kun Web Crypto.
 *
 * Browsere logger ind på /login og får en cookie (dispos_auth), der huskes i 400 dage.
 * Cookien er en HMAC af DISPOS_PASSWORD — skiftes koden, bliver alle logget ud.
 * Scripts (Home Assistant, curl) kan stadig sende koden som Basic Auth.
 */

export const AUTH_COOKIE = "dispos_auth";
/** 400 dage er det maksimale, Chrome accepterer. */
export const AUTH_MAX_AGE = 400 * 24 * 60 * 60;

const enc = new TextEncoder();

export async function authToken(password: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(password), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode("dispos-login-v1"));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}

export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Koden fra en "Basic ..."-header (UTF-8, så æøå virker). Null hvis ingen/ugyldig. */
export function passwordFromBasic(header: string | null): string | null {
  if (!header?.startsWith("Basic ")) return null;
  try {
    const bin = atob(header.slice(6));
    const decoded = new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
    return decoded.slice(decoded.indexOf(":") + 1);
  } catch {
    return null;
  }
}

/** Basic-header med koden — så API'er, der kigger efter ejeren, virker uændret. */
export function basicHeader(password: string): string {
  const bytes = enc.encode(`dispos:${password}`);
  return "Basic " + btoa(Array.from(bytes, (b) => String.fromCharCode(b)).join(""));
}

/** Kun stier på egen side (ikke //andet-domæne). */
export function safeNext(next: unknown): string {
  return typeof next === "string" && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : "/";
}
