/**
 * Ren logik til personlige invitationslinks (testet i invite-core.test.ts).
 * Linket indeholder et tilfældigt token. Vi gemmer kun en hash af det.
 */
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/** Navnet på den cookie, der husker en inviteret på telefonen. */
export const TRAINING_COOKIE = "dispos_traening";
/** Browsere tillader højst ca. 400 dage. */
export const COOKIE_MAX_AGE = 400 * 24 * 3600;

export interface TrainingUser {
  id: string;
  name: string;
  /** ISO */
  createdAt: string;
  /** sha256 af det aktuelle token; mangler når adgangen er fjernet */
  tokenHash?: string;
  /** ISO — sidst set i appen */
  lastSeen?: string;
  owner?: boolean;
}

/** Dig selv (logget ind med Dispos-koden). Dine data ligger hvor de altid har ligget. */
export const OWNER: TrainingUser = { id: "owner", name: "Daniel", createdAt: "2026-11-17T00:00:00.000Z", owner: true };

export const newToken = () => randomBytes(24).toString("base64url");
export const newUserId = () => randomBytes(6).toString("hex");
export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

/** Et token ser rigtigt ud (inden vi spørger databasen). */
export const tokenLooksValid = (token: string) => /^[A-Za-z0-9_-]{20,64}$/.test(token);

export function cleanName(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const name = input.replace(/\s+/g, " ").trim().slice(0, 40);
  return name.length ? name : null;
}

/** Tjek Dispos-koden fra et Basic-auth-header (samme regel som middleware). */
export function isOwnerHeader(header: string | null, password: string | undefined): boolean {
  if (!password || !header?.startsWith("Basic ")) return false;
  try {
    const decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
    const given = Buffer.from(decoded.slice(decoded.indexOf(":") + 1));
    const want = Buffer.from(password);
    return given.length === want.length && timingSafeEqual(given, want);
  } catch {
    return false;
  }
}

/** Redis-præfiks for en brugers data. Ejeren bruger de oprindelige nøgler. */
export const keyPrefix = (userId: string) => (userId === OWNER.id ? "traening:" : `traening:u:${userId}:`);
