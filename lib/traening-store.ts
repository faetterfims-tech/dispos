import "server-only";
import type { BodyEntry, NextPointer, Session } from "./traening/logic";
import { hdel, hgetall, hset } from "./store";

/** traening:sessions → { id: Session-JSON } · traening:body → { dato: BodyEntry-JSON } */
const SESSIONS = "traening:sessions";
const BODY = "traening:body";
/** traening:meta → { next: NextPointer-JSON } */
const META = "traening:meta";

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

export async function loadAll(): Promise<{ sessions: Session[]; body: BodyEntry[]; next: NextPointer | null }> {
  const [s, b, m] = await Promise.all([hgetall(SESSIONS), hgetall(BODY), hgetall(META)]);
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

export const saveSession = (s: Session) => hset(SESSIONS, { [s.id]: JSON.stringify(s) });
export const deleteSession = (id: string) => hdel(SESSIONS, id);
export const saveBody = (b: BodyEntry) => hset(BODY, { [b.date]: JSON.stringify(b) });
export const deleteBody = (date: string) => hdel(BODY, date);
export const saveNext = (p: NextPointer) => hset(META, { next: JSON.stringify(p) });
