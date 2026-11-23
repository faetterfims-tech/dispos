/**
 * Fremgangsbilleder: typer, tjek af billeddata og påmindelser.
 * Ren logik — testet i photos-core.test.ts.
 */

export type PhotoKind = "foer" | "undervejs" | "efter";
export type PhotoView = "forfra" | "side";

export interface PhotoMeta {
  id: string;
  /** ÅÅÅÅ-MM-DD */
  date: string;
  kind: PhotoKind;
  view: PhotoView;
  /** ISO */
  savedAt: string;
}

export const KINDS: { id: PhotoKind; name: string }[] = [
  { id: "foer", name: "Før" },
  { id: "undervejs", name: "Undervejs" },
  { id: "efter", name: "Efter" },
];
export const VIEWS: { id: PhotoView; name: string }[] = [
  { id: "forfra", name: "Forfra" },
  { id: "side", name: "Fra siden" },
];

export const isKind = (v: unknown): v is PhotoKind => v === "foer" || v === "undervejs" || v === "efter";
export const isView = (v: unknown): v is PhotoView => v === "forfra" || v === "side";

/** Grænser for billeddata (base64 i en data-URL). Klienten skalerer ned, så de holdes langt under. */
export const MAX_FULL_BYTES = 900_000;
export const MAX_THUMB_BYTES = 80_000;

/** Tjek en data-URL med JPEG/WebP og returnér de rå bytes som base64. Null hvis den ikke er gyldig eller for stor. */
export function parseImageDataUrl(input: unknown, maxBytes: number): { mime: "image/jpeg" | "image/webp"; base64: string } | null {
  if (typeof input !== "string") return null;
  const m = /^data:(image\/jpeg|image\/webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(input);
  if (!m) return null;
  const bytes = Math.floor((m[2].length * 3) / 4);
  if (bytes > maxBytes || bytes < 100) return null;
  return { mime: m[1] as "image/jpeg" | "image/webp", base64: m[2] };
}

const DAY = 86_400_000;
export const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / DAY);

/** Hvor ofte appen minder om at veje sig og tage billeder (dage). */
export const BODY_EVERY = 7;
export const PHOTO_EVERY = 14;
/** Hvor ofte sammenligningen dukker op (dage), og hvor langt der mindst skal være mellem billederne. */
export const COMPARE_EVERY = 14;
export const COMPARE_MIN_SPAN = 14;

/** Er det tid til en påmindelse? `last` er seneste dato (eller null). */
export const isDue = (last: string | null, today: string, every: number) => !last || daysBetween(last, today) >= every;

/**
 * To billeder at sammenligne: det første og det nyeste fra samme vinkel (forfra foretrækkes).
 * Null hvis der ikke er mindst `minSpan` dage imellem.
 */
export function pickComparison(photos: PhotoMeta[], minSpan = COMPARE_MIN_SPAN): { before: PhotoMeta; after: PhotoMeta } | null {
  for (const view of ["forfra", "side"] as PhotoView[]) {
    const list = photos.filter((p) => p.view === view).sort((a, b) => a.date.localeCompare(b.date) || a.savedAt.localeCompare(b.savedAt));
    if (list.length < 2) continue;
    const before = list.find((p) => p.kind === "foer") ?? list[0];
    const after = list[list.length - 1];
    if (after.id !== before.id && daysBetween(before.date, after.date) >= minSpan) return { before, after };
  }
  return null;
}

/** Næste billedtype: første billede er "Før", ellers "Undervejs". */
export const defaultKind = (photos: PhotoMeta[]): PhotoKind => (photos.length === 0 ? "foer" : "undervejs");
