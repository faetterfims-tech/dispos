import "server-only";
import type { NextRequest } from "next/server";
import { hdel, hget, hgetall, hset } from "./store";
import { OWNER, TRAINING_COOKIE, hashToken, isOwnerHeader, newToken, newUserId, tokenLooksValid, type TrainingUser } from "./traening/invite-core";

/** traening:users → { id: TrainingUser-JSON } · traening:tokens → { sha256(token): id } */
const USERS = "traening:users";
const TOKENS = "traening:tokens";

const parse = (v: string | null | undefined): TrainingUser | null => {
  if (!v) return null;
  try {
    return JSON.parse(v) as TrainingUser;
  } catch {
    return null;
  }
};

export const isOwner = (req: NextRequest) => isOwnerHeader(req.headers.get("authorization"), process.env.DISPOS_PASSWORD);

/** Find en inviteret ud fra token. Null hvis linket ikke (længere) virker. */
export async function userByToken(token: string): Promise<TrainingUser | null> {
  if (!tokenLooksValid(token)) return null;
  const hash = hashToken(token);
  const id = await hget(TOKENS, hash);
  if (!id) return null;
  const user = parse(await hget(USERS, id));
  if (!user || user.tokenHash !== hash) return null;
  return user;
}

/** Hvem kalder? Ejeren (Dispos-koden) eller en inviteret (cookie fra linket). */
export async function currentUser(req: NextRequest): Promise<TrainingUser | null> {
  if (isOwner(req)) return OWNER;
  const token = req.cookies.get(TRAINING_COOKIE)?.value;
  if (!token) return null;
  const user = await userByToken(token);
  if (user) {
    // "Sidst set" — højst én gang i timen, så vi ikke skriver ved hvert kald.
    const now = new Date();
    if (!user.lastSeen || now.getTime() - Date.parse(user.lastSeen) > 3600_000) {
      await hset(USERS, { [user.id]: JSON.stringify({ ...user, lastSeen: now.toISOString() }) }).catch(() => {});
    }
  }
  return user;
}

export async function listUsers(): Promise<TrainingUser[]> {
  return Object.values(await hgetall(USERS))
    .map((v) => parse(v))
    .filter((u): u is TrainingUser => !!u)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/** Ny inviteret. Returnerer brugeren og det token, der skal i linket (vises kun én gang). */
export async function createUser(name: string): Promise<{ user: TrainingUser; token: string }> {
  const token = newToken();
  const user: TrainingUser = { id: newUserId(), name, createdAt: new Date().toISOString(), tokenHash: hashToken(token) };
  await hset(USERS, { [user.id]: JSON.stringify(user) });
  await hset(TOKENS, { [user.tokenHash!]: user.id });
  return { user, token };
}

/** Nyt link til en eksisterende inviteret. Det gamle link holder op med at virke. */
export async function renewToken(id: string): Promise<{ user: TrainingUser; token: string } | null> {
  const user = parse(await hget(USERS, id));
  if (!user) return null;
  if (user.tokenHash) await hdel(TOKENS, user.tokenHash);
  const token = newToken();
  const next = { ...user, tokenHash: hashToken(token) };
  await hset(USERS, { [id]: JSON.stringify(next) });
  await hset(TOKENS, { [next.tokenHash]: id });
  return { user: next, token };
}

/** Fjern adgang: linket virker ikke længere. Træningsdata bevares, til de evt. slettes. */
export async function revokeUser(id: string): Promise<void> {
  const user = parse(await hget(USERS, id));
  if (!user) return;
  if (user.tokenHash) await hdel(TOKENS, user.tokenHash);
  const rest: TrainingUser = { ...user };
  delete rest.tokenHash;
  await hset(USERS, { [id]: JSON.stringify(rest) });
}

/** Slet brugeren helt (efter fjernet adgang). */
export async function deleteUser(id: string): Promise<void> {
  const user = parse(await hget(USERS, id));
  if (user?.tokenHash) await hdel(TOKENS, user.tokenHash);
  await hdel(USERS, id);
}
