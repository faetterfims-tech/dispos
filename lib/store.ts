import "server-only";

/**
 * Minimal klient til Upstash Redis via REST (ingen ekstra pakker).
 * Variablerne sættes automatisk, når Upstash forbindes til projektet i Vercel
 * (Storage → Upstash for Redis). Både KV_* og UPSTASH_* navne understøttes.
 */
function config() {
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    throw new Error("Lageret er ikke koblet på: forbind Upstash for Redis til projektet i Vercel → Storage.");
  }
  return { url: url.replace(/\/$/, ""), token };
}

export function storeConfigured(): boolean {
  return Boolean(
    (process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL) &&
      (process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN),
  );
}

async function command<T>(cmd: (string | number)[]): Promise<T> {
  const { url, token } = config();
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(cmd),
    cache: "no-store",
  });
  const body = (await res.json()) as { result?: T; error?: string };
  if (!res.ok || body.error) throw new Error(`Lagerfejl: ${body.error ?? res.status}`);
  return body.result as T;
}

/** Sætter flere felter i en hash. */
export async function hset(key: string, fields: Record<string, string>): Promise<void> {
  const flat = Object.entries(fields).flat();
  if (flat.length === 0) return;
  await command(["HSET", key, ...flat]);
}

/** Henter en hel hash som objekt. */
export async function hgetall(key: string): Promise<Record<string, string>> {
  const arr = await command<string[] | null>(["HGETALL", key]);
  const out: Record<string, string> = {};
  if (!arr) return out;
  for (let i = 0; i < arr.length; i += 2) out[arr[i]] = arr[i + 1];
  return out;
}

export async function set(key: string, value: string): Promise<void> {
  await command(["SET", key, value]);
}
