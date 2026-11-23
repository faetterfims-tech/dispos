import "server-only";
import type { BodyEntry, NextPointer, Session } from "./traening/logic";
import { keyPrefix } from "./traening/invite-core";
import { isEquip, isProgramId, type Equip, type ProgramId } from "./traening/program";
import { isLevel, isSex, type Profile } from "./traening/loads";
import { del, get, hdel, hgetall, hset, set } from "./store";
import type { PhotoMeta } from "./traening/photos-core";

/**
 * Data pr. bruger i Upstash Redis:
 *   <præfiks>sessions → { id: Session-JSON }
 *   <præfiks>body     → { dato: BodyEntry-JSON }
 *   <præfiks>meta     → { next: NextPointer-JSON, program: "udstyr" | "kropsvaegt", equipment: Equip[]-JSON, profile: Profile-JSON }
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

export async function loadAll(userId: string): Promise<{ sessions: Session[]; body: BodyEntry[]; next: NextPointer | null; program: ProgramId; equipment: Equip[] | null; profile: Profile | null }> {
  const k = keys(userId);
  const [s, b, m] = await Promise.all([hgetall(k.sessions), hgetall(k.body), hgetall(k.meta)]);
  let next: NextPointer | null = null;
  try {
    next = m.next ? (JSON.parse(m.next) as NextPointer) : null;
  } catch {
    next = null;
  }
  let equipment: Equip[] | null = null;
  try {
    const parsed = m.equipment ? (JSON.parse(m.equipment) as unknown[]) : null;
    equipment = Array.isArray(parsed) ? parsed.filter(isEquip) : null;
  } catch {
    equipment = null;
  }
  let profile: Profile | null = null;
  try {
    const p = m.profile ? (JSON.parse(m.profile) as Record<string, unknown>) : null;
    profile = p && isLevel(p.level) ? { level: p.level, ...(isSex(p.sex) ? { sex: p.sex } : {}) } : null;
  } catch {
    profile = null;
  }
  return {
    next,
    equipment,
    profile,
    program: isProgramId(m.program) ? m.program : "udstyr",
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
  const photos = await listPhotos(userId).catch(() => []);
  for (const ph of photos) await deletePhoto(userId, ph.id).catch(() => {});
  await del(k.sessions, k.body, k.meta, photoKeys(userId).list);
}

/* ---------- Fremgangsbilleder ----------
 *   <præfiks>photos         → { id: PhotoMeta-JSON }
 *   <præfiks>photo:<id>     → base64 (stort billede)
 *   <præfiks>thumb:<id>     → base64 (lille billede til oversigten)
 */
const photoKeys = (userId: string, id = "") => {
  const p = keyPrefix(userId);
  return { list: `${p}photos`, full: `${p}photo:${id}`, thumb: `${p}thumb:${id}` };
};

export async function listPhotos(userId: string): Promise<PhotoMeta[]> {
  return parseAll<PhotoMeta>(await hgetall(photoKeys(userId).list)).sort((a, b) => a.date.localeCompare(b.date) || a.savedAt.localeCompare(b.savedAt));
}

export async function savePhoto(userId: string, meta: PhotoMeta, fullBase64: string, thumbBase64: string): Promise<void> {
  const k = photoKeys(userId, meta.id);
  await set(k.full, fullBase64);
  await set(k.thumb, thumbBase64);
  await hset(k.list, { [meta.id]: JSON.stringify(meta) });
}

export async function getPhoto(userId: string, id: string, size: "full" | "thumb"): Promise<string | null> {
  const k = photoKeys(userId, id);
  return get(size === "full" ? k.full : k.thumb);
}

export async function deletePhoto(userId: string, id: string): Promise<void> {
  const k = photoKeys(userId, id);
  await hdel(k.list, id);
  await del(k.full, k.thumb);
}
export const saveProgram = (userId: string, program: ProgramId) => hset(keys(userId).meta, { program });
export const saveEquipment = (userId: string, equipment: Equip[]) => hset(keys(userId).meta, { equipment: JSON.stringify(equipment) });
export const saveProfile = (userId: string, profile: Profile) => hset(keys(userId).meta, { profile: JSON.stringify(profile) });
