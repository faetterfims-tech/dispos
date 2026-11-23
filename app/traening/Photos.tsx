"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { BodyEntry } from "@/lib/traening/logic";
import { KINDS, VIEWS, daysBetween, defaultKind, pickComparison, type PhotoKind, type PhotoMeta, type PhotoView } from "@/lib/traening/photos-core";

/* ---------- Billeder: skalering og upload ---------- */

const bytesOf = (dataUrl: string) => Math.floor(((dataUrl.length - dataUrl.indexOf(",") - 1) * 3) / 4);

async function loadImage(file: File): Promise<CanvasImageSource & { width: number; height: number }> {
  try {
    // Respekterer telefonens rotation (EXIF).
    return await createImageBitmap(file, { imageOrientation: "from-image" } as ImageBitmapOptions);
  } catch {
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      return img;
    } finally {
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  }
}

function toJpeg(img: CanvasImageSource & { width: number; height: number }, maxSide: number, quality: number): string {
  const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Kunne ikke behandle billedet.");
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", quality);
}

/** Skaler billedet ned i telefonen, før det sendes (stort ca. 1280 px, lille ca. 320 px). */
export async function compressPhoto(file: File): Promise<{ full: string; thumb: string }> {
  const img = await loadImage(file);
  let side = 1280;
  let q = 0.82;
  let full = toJpeg(img, side, q);
  while (bytesOf(full) > 750_000 && q > 0.45) {
    q -= 0.1;
    side = Math.round(side * 0.88);
    full = toJpeg(img, side, q);
  }
  let thumb = toJpeg(img, 320, 0.72);
  if (bytesOf(thumb) > 70_000) thumb = toJpeg(img, 240, 0.6);
  return { full, thumb };
}

export async function uploadPhoto(file: File, meta: { date: string; kind: PhotoKind; view: PhotoView }): Promise<PhotoMeta> {
  const { full, thumb } = await compressPhoto(file);
  const res = await fetch("/api/traening/fotos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...meta, full, thumb }),
  });
  const body = await res.json();
  if (!res.ok || !body.ok) throw new Error(body.error ?? `Fejl ${res.status}`);
  return body.photo as PhotoMeta;
}

export const photoUrl = (id: string, size: "thumb" | "full") => `/api/traening/fotos?id=${id}&size=${size}`;

const fmtDate = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("da-DK", { day: "numeric", month: "short", year: "numeric" });
const kindName = (k: PhotoKind) => KINDS.find((x) => x.id === k)?.name ?? k;
const fmtKg = (kg: number) => (Number.isInteger(kg) ? String(kg) : kg.toFixed(1).replace(".", ","));

/** Kropsvægt tættest på en dato (højst 10 dage væk). */
function weightNear(body: BodyEntry[], date: string): number | null {
  let best: BodyEntry | null = null;
  for (const b of body) {
    if (!b.weightKg) continue;
    const d = Math.abs(daysBetween(b.date, date));
    if (d <= 10 && (!best || d < Math.abs(daysBetween(best.date, date)))) best = b;
  }
  return best?.weightKg ?? null;
}

/* ---------- Før og efter side om side ---------- */

export function Comparison({ photos, body }: { photos: PhotoMeta[]; body: BodyEntry[] }) {
  const pair = pickComparison(photos);
  if (!pair) return null;
  const days = daysBetween(pair.before.date, pair.after.date);
  const w1 = weightNear(body, pair.before.date);
  const w2 = weightNear(body, pair.after.date);
  return (
    <div className="tr-compare">
      <div className="tr-compare-grid">
        {[pair.before, pair.after].map((p, i) => (
          <figure key={p.id}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photoUrl(p.id, "full")} alt={`${i === 0 ? "Før" : "Nu"} ${fmtDate(p.date)}`} />
            <figcaption>
              <b>{i === 0 ? "Før" : "Nu"}</b> · {fmtDate(p.date)}
            </figcaption>
          </figure>
        ))}
      </div>
      <p className="small" style={{ margin: "0.5rem 0 0", textAlign: "center" }}>
        {days} dage imellem
        {w1 && w2 ? ` · ${w2 - w1 <= 0 ? "−" : "+"}${fmtKg(Math.abs(Math.round((w2 - w1) * 10) / 10))} kg` : ""}
      </p>
    </div>
  );
}

/* ---------- Billeder under Fremgang ---------- */

export function PhotosSection({
  photos,
  body,
  onAdded,
  onDeleted,
}: {
  photos: PhotoMeta[];
  body: BodyEntry[];
  onAdded: (p: PhotoMeta) => void;
  onDeleted: (id: string) => void;
}) {
  const [kind, setKind] = useState<PhotoKind>(defaultKind(photos));
  const [view, setView] = useState<PhotoView>("forfra");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState<PhotoMeta | null>(null);
  const [armed, setArmed] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => setKind(defaultKind(photos)), [photos.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setErr(null);
    try {
      const d = new Date();
      const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      onAdded(await uploadPhoto(file, { date, kind, view }));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Kunne ikke gemme billedet.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  const del = async (id: string) => {
    try {
      const res = await fetch(`/api/traening/fotos?id=${id}`, { method: "DELETE" });
      const b = await res.json();
      if (!res.ok || !b.ok) throw new Error(b.error ?? "Kunne ikke slette.");
      onDeleted(id);
      setOpen(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Kunne ikke slette.");
    }
  };

  const newest = [...photos].reverse();

  return (
    <div className="card">
      <h2>📷 Billeder</h2>
      <p className="small" style={{ marginTop: 0 }}>
        Tag et billede hver 2. uge: samme sted, samme lys og samme tøj, gerne både forfra og fra siden. Billederne er private, så det er kun dig, der kan se
        dem.
      </p>

      <Comparison photos={photos} body={body} />

      <div className="tr-field-label">Type</div>
      <div className="tr-choice">
        {KINDS.map((k) => (
          <button key={k.id} aria-pressed={kind === k.id} onClick={() => setKind(k.id)}>
            {k.name}
          </button>
        ))}
      </div>
      <div className="tr-field-label">Vinkel</div>
      <div className="tr-choice">
        {VIEWS.map((v) => (
          <button key={v.id} aria-pressed={view === v.id} onClick={() => setView(v.id)}>
            {v.name}
          </button>
        ))}
      </div>
      <label className={`tr-photo-btn${busy ? " busy" : ""}`}>
        {busy ? "Gemmer billedet…" : "📷 Tag eller vælg billede"}
        <input ref={input} type="file" accept="image/*" disabled={busy} onChange={(e) => onFile(e.target.files?.[0])} hidden />
      </label>
      {err && <div className="notice error" style={{ marginTop: "0.6rem" }}>{err}</div>}

      {newest.length > 0 && (
        <div className="tr-photo-grid">
          {newest.map((p) => (
            <button key={p.id} className="tr-photo-thumb" onClick={() => { setOpen(p); setArmed(false); }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photoUrl(p.id, "thumb")} alt={`${kindName(p.kind)} ${fmtDate(p.date)}`} loading="lazy" />
              <span>
                {kindName(p.kind)} · {new Date(`${p.date}T12:00:00`).toLocaleDateString("da-DK", { day: "numeric", month: "short" })}
              </span>
            </button>
          ))}
        </div>
      )}

      {open && (
        <div className="tr-photo-viewer" role="dialog" aria-label="Billede" onClick={() => setOpen(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photoUrl(open.id, "full")} alt="" onClick={(e) => e.stopPropagation()} />
          <div className="tr-photo-viewer-bar" onClick={(e) => e.stopPropagation()}>
            <span>
              {kindName(open.kind)} · {VIEWS.find((v) => v.id === open.view)?.name} · {fmtDate(open.date)}
            </span>
            <span style={{ display: "flex", gap: "0.5rem" }}>
              <button className={`secondary small-btn${armed ? " danger" : ""}`} onClick={() => (armed ? del(open.id) : setArmed(true))}>
                {armed ? "Tryk igen for at slette" : "Slet"}
              </button>
              <button className="small-btn" onClick={() => setOpen(null)}>
                Luk
              </button>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Pop-ups ---------- */

function Modal({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  return (
    <div className="tr-modal-backdrop" onClick={onClose}>
      <div className="tr-modal" role="dialog" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

/** Dukker op en gang imellem: før og nu side om side. */
export function CompareModal({ photos, body, onClose, onSeeAll }: { photos: PhotoMeta[]; body: BodyEntry[]; onClose: () => void; onSeeAll: () => void }) {
  return (
    <Modal onClose={onClose}>
      <h2 style={{ marginTop: 0 }}>Se din fremgang 💪</h2>
      <p className="small" style={{ marginTop: 0 }}>
        Fremgang er svær at se i spejlet fra dag til dag. Her er dit første og dit nyeste billede.
      </p>
      <Comparison photos={photos} body={body} />
      <div className="tr-modal-buttons">
        <button onClick={onSeeAll}>Se alle billeder</button>
        <button className="secondary" onClick={onClose}>
          Luk
        </button>
      </div>
    </Modal>
  );
}

/** Efter en gemt træning: mind om vægt, mål og billede, når det er tid. */
export function AfterSaveModal({
  summary,
  bodyDue,
  photoDue,
  photos,
  daysSinceBody,
  daysSincePhoto,
  onBody,
  onPhotoAdded,
  onClose,
}: {
  summary: { kcal: { low: number; high: number }; sets: number; totalSec?: number; activeSec?: number; tour?: { km: number; sec?: number } };
  bodyDue: boolean;
  photoDue: boolean;
  photos: PhotoMeta[];
  daysSinceBody: number | null;
  daysSincePhoto: number | null;
  onBody: () => void;
  onPhotoAdded: (p: PhotoMeta) => void;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setErr(null);
    try {
      const d = new Date();
      const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      onPhotoAdded(await uploadPhoto(file, { date, kind: defaultKind(photos), view: "forfra" }));
      setDone(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Kunne ikke gemme billedet.");
    } finally {
      setBusy(false);
    }
  };
  const since = (n: number | null, what: string) => (n === null ? `Du har ikke ${what} endnu.` : `Sidst for ${n} dage siden.`);
  return (
    <Modal onClose={onClose}>
      <h2 style={{ marginTop: 0 }}>Godt gået! 💪</h2>
      <div className="tr-summary">
        {summary.tour ? (
          <>
            <div>
              <b>{summary.tour.km.toFixed(2).replace(".", ",")} km</b>
              <span>distance</span>
            </div>
            {summary.tour.sec ? (
              <div>
                <b>{Math.round(summary.tour.sec / 60)} min</b>
                <span>{(summary.tour.km / (summary.tour.sec / 3600)).toFixed(1).replace(".", ",")} km/t</span>
              </div>
            ) : null}
          </>
        ) : (
          <div>
            <b>{summary.sets}</b>
            <span>sæt</span>
          </div>
        )}
        {summary.totalSec && !summary.tour ? (
          <div>
            <b>{Math.round(summary.totalSec / 60)} min</b>
            <span>i alt{summary.activeSec ? ` · ${Math.round(summary.activeSec / 60)} aktiv` : ""}</span>
          </div>
        ) : null}
        <div>
          <b>
            🔥 {summary.kcal.low === summary.kcal.high ? `ca. ${summary.kcal.low}` : `${summary.kcal.low}–${summary.kcal.high}`}
          </b>
          <span>kcal (skøn)</span>
        </div>
      </div>
      {(bodyDue || photoDue) && (
        <p className="small" style={{ margin: "0.8rem 0 0" }}>
          Det er tid til at følge op:
        </p>
      )}
      {bodyDue && (
        <div className="tr-due">
          <div>
            <b>⚖️ Vej og mål dig</b>
            <span className="small">{since(daysSinceBody, "vejet dig")}</span>
          </div>
          <button onClick={onBody}>Skriv vægt og mål</button>
        </div>
      )}
      {photoDue && (
        <div className="tr-due">
          <div>
            <b>📷 Tag et fremgangsbillede</b>
            <span className="small">{done ? "Gemt ✓" : since(daysSincePhoto, "taget et billede")}</span>
          </div>
          {!done && (
            <label className={`tr-photo-btn small${busy ? " busy" : ""}`}>
              {busy ? "Gemmer…" : "Tag billede"}
              <input type="file" accept="image/*" disabled={busy} onChange={(e) => onFile(e.target.files?.[0])} hidden />
            </label>
          )}
        </div>
      )}
      {err && <div className="notice error">{err}</div>}
      <div className="tr-modal-buttons">
        <button className="secondary" onClick={onClose}>
          {done || (!bodyDue && !photoDue) ? "Luk" : "Ikke nu"}
        </button>
      </div>
    </Modal>
  );
}

