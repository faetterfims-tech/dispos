import "server-only";
import type { BodyEntry, NextPointer, Session } from "./traening/logic";
import { keyPrefix } from "./traening/invite-core";
import { del, hdel, hgetall, hset } from "./store";

/**
 * Data pr. bruger i Upstash Redis:
 *   <præfiks>sessions → { id: Session-JSON }
 *   <præfiks>body     → { dato: BodyEntry-JSON }
 *   <præfiks>meta     → { next: NextPointer-JSON }
 * Præfikset er "traening:" for ejeren og "traening:u:<id>:" for inviterede.
 */
const keys = (userId: string) => {
  const p = keyPrefix(userId);
  return { sessions: `${p}sessions`, body: `${p}body`, meta: `${p}meta` };
};

function parseAll<T>(hash: Record<string, string>): T[] {
  const out: T[] = [];
  for (const v of Object.values(hash)) {
    try {
      out.push(JSON.parse(v) as T);
    } catch {
      /* spring ødelagte felter over */
    }
  }
  return out;
}

export async function loadAll(userId: string): Promise<{ sessions: Session[]; body: BodyEntry[]; next: NextPointer | null }> {
  const k = keys(userId);
  const [s, b, m] = await Promise.all([hgetall(k.sessions), hgetall(k.body), hgetall(k.meta)]);
  let next: NextPointer | null = null;
  try {
    next = m.next ? (JSON.parse(m.next) as NextPointer) : null;
  } catch {
    next = null;
  }
  return {
    next,
    sessions: parseAll<Session>(s).sort((a, b) => b.date.localeCompare(a.date)),
    body: parseAll<BodyEntry>(b).sort((a, b) => a.date.localeCompare(b.date)),
  };
}

export const saveSession = (userId: string, s: Session) => hset(keys(userId).sessions, { [s.id]: JSON.stringify(s) });
export const deleteSession = (userId: string, id: string) => hdel(keys(userId).sessions, id);
export const saveBody = (userId: string, b: BodyEntry) => hset(keys(userId).body, { [b.date]: JSON.stringify(b) });
export const deleteBody = (userId: string, date: string) => hdel(keys(userId).body, date);
export const saveNext = (userId: string, p: NextPointer) => hset(keys(userId).meta, { next: JSON.stringify(p) });

/** Antal gemte pas (til oversigten over inviterede). */
export async function countSessions(userId: string): Promise<number> {
  return Object.keys(await hgetall(keys(userId).sessions)).length;
}

/** Slet alle data for en inviteret (aldrig ejeren). */
export async function deleteAllData(userId: string): Promise<void> {
  if (userId === "owner") throw new Error("Ejerens data slettes ikke herfra.");
  const k = keys(userId);
  await del(k.sessions, k.body, k.meta);
}
