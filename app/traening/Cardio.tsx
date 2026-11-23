"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { Exercise } from "@/lib/traening/program";
import {
  addPoint,
  currentKmh,
  elapsedSec,
  emptyTrack,
  fmtKm,
  fmtKmh,
  fmtPace,
  isCardio,
  kmhOf,
  type CardioId,
  type TourClock,
  type Track,
} from "@/lib/traening/cardio";
import { fmtDuration } from "@/lib/traening/timing";
import { useWakeLock } from "./device";

const TOUR_KEY = "dispos.traening.tur";

interface SavedTour {
  exId: CardioId;
  clock: TourClock;
  track: Track;
}

function loadTour(): SavedTour | null {
  try {
    const raw = localStorage.getItem(TOUR_KEY);
    return raw ? (JSON.parse(raw) as SavedTour) : null;
  } catch {
    return null;
  }
}
function saveTour(t: SavedTour | null) {
  try {
    if (t) localStorage.setItem(TOUR_KEY, JSON.stringify(t));
    else localStorage.removeItem(TOUR_KEY);
  } catch {
    /* ok */
  }
}

const toNum = (s: string) => Number(s.replace(",", "."));

export interface TourRow {
  reps: string;
  sec?: number;
  done?: boolean;
  /** Tekst i minut-feltet, mens man skriver. */
  min?: string;
}

/** Kortet for en gåtur/løbetur: start med GPS, eller skriv distance og tid selv. */
export function TourCard({
  ex,
  row,
  isToday,
  color,
  index,
  lastText,
  hint,
  onPatch,
  onStart,
  onFinish,
  onCancel,
}: {
  ex: Exercise;
  row: TourRow;
  isToday: boolean;
  color: string;
  index: number;
  lastText?: string;
  hint: string;
  onPatch: (p: Partial<TourRow>) => void;
  /** Turen starter (dagens ur startes). */
  onStart: () => void;
  onFinish: (km: number, sec: number) => void;
  onCancel: () => void;
}) {
  const id = isCardio(ex.id) ? ex.id : "gaatur";
  const [open, setOpen] = useState(false);
  /** Skjult, men turen kører videre (GPS måler stadig). */
  const [hidden, setHidden] = useState(false);
  // En tur, der var i gang (fx hvis appen blev lukket), fortsætter.
  useEffect(() => {
    if (loadTour()?.exId === id) setOpen(true);
  }, [id]);

  const km = toNum(row.reps);
  const minText = row.min ?? (row.sec ? String(Math.round(row.sec / 60)) : "");
  const sec = row.sec ?? 0;
  const valid = Number.isFinite(km) && km > 0;
  const done = !!row.done;

  return (
    <div className={`card tr-ex${done ? " complete" : ""}`}>
      <div className="tr-ex-head">
        <span className="tr-num" style={{ background: done ? "var(--good)" : color }}>
          {done ? "✓" : index + 1}
        </span>
        <div>
          <div className="tr-ex-name">{ex.name}</div>
          <span className="tr-chip">{ex.muscles}</span>
        </div>
      </div>
      <p className="tr-ex-how">{ex.how}</p>

      <div className="tr-goal">
        <div>
          <span className="tr-goal-label">Mål</span>
          {ex.target[0]}–{ex.target[1]} km
        </div>
        {lastText && (
          <div>
            <span className="tr-goal-label">Sidst</span>
            {lastText}
          </div>
        )}
        <div className="tr-goal-hint">👉 {hint}</div>
      </div>

      {done ? (
        <div className="tr-tour-result">
          <div className="tr-tour-stats">
            <div>
              <b>{fmtKm(km)}</b>
              <span>km</span>
            </div>
            <div>
              <b>{sec ? fmtDuration(sec) : "–"}</b>
              <span>tid</span>
            </div>
            <div>
              <b>{sec ? fmtKmh(kmhOf(km, sec)) : "–"}</b>
              <span>km/t</span>
            </div>
            {id === "loebetur" && (
              <div>
                <b>{sec ? fmtPace(km, sec) : "–"}</b>
                <span>min/km</span>
              </div>
            )}
          </div>
          <button className="tr-link" onClick={() => onPatch({ done: false })}>
            Ret eller fortryd
          </button>
        </div>
      ) : (
        <>
          {open ? (
            <button className="tr-timer-start" onClick={() => setHidden(false)}>
              ⏱ Turen er i gang · vis
            </button>
          ) : (
            isToday && (
              <button
                className="tr-timer-start"
                onClick={() => {
                  onStart();
                  setHidden(false);
                  setOpen(true);
                }}
              >
                ▶ Start turen (måler med GPS)
              </button>
            )
          )}
          <div className="tr-tour-manual">
            <span className="small">{isToday ? "Eller skriv selv (fx fra dit ur):" : "Skriv distance og tid:"}</span>
            <div className="tr-tour-fields">
              <label>
                <span>Distance (km)</span>
                <input inputMode="decimal" placeholder="fx 4,5" value={row.reps} onChange={(e) => onPatch({ reps: e.target.value })} />
              </label>
              <label>
                <span>Tid (min)</span>
                <input
                  inputMode="numeric"
                  placeholder="fx 45"
                  value={minText}
                  onChange={(e) => {
                    const m = toNum(e.target.value);
                    onPatch({ min: e.target.value, sec: Number.isFinite(m) && m > 0 ? Math.round(m * 60) : undefined });
                  }}
                />
              </label>
            </div>
            {valid && sec > 0 && (
              <span className="small">
                {fmtKmh(kmhOf(km, sec))} km/t{id === "loebetur" ? ` · ${fmtPace(km, sec)} min/km` : ""}
              </span>
            )}
            <button className="secondary" disabled={!valid} onClick={() => onPatch({ done: true })}>
              ✓ Turen er gået
            </button>
          </div>
        </>
      )}

      {ex.tip && <p className="tr-tip">💡 {ex.tip}</p>}

      {open && (
        <TourTracker
          id={id}
          title={ex.name}
          hidden={hidden}
          onClose={() => setHidden(true)}
          onFinish={(k, s) => {
            setOpen(false);
            onFinish(k, s);
          }}
          onCancel={() => {
            setOpen(false);
            onCancel();
          }}
        />
      )}
    </div>
  );
}

type GpsState = "soeger" | "ok" | "afvist" | "mangler";

/** Fuld skærm, mens man går/løber: tid, distance og fart. */
function TourTracker({ id, title, hidden, onFinish, onCancel, onClose }: { id: CardioId; title: string; hidden: boolean; onFinish: (km: number, sec: number) => void; onCancel: () => void; onClose: () => void }) {
  const [tour, setTour] = useState<SavedTour>(() => {
    const saved = loadTour();
    return saved?.exId === id ? saved : { exId: id, clock: { startedAt: Date.now(), pausedMs: 0 }, track: emptyTrack() };
  });
  const tourRef = useRef(tour);
  tourRef.current = tour;
  const [gps, setGps] = useState<GpsState>("soeger");
  const [acc, setAcc] = useState<number | null>(null);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [, setTick] = useState(0);
  const paused = !!tour.clock.pausedAt;

  useWakeLock(true);

  useEffect(() => {
    saveTour(tour);
  }, [tour]);

  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (paused) return;
    if (!("geolocation" in navigator)) {
      setGps("mangler");
      return;
    }
    const watch = navigator.geolocation.watchPosition(
      (pos) => {
        setGps("ok");
        setAcc(Math.round(pos.coords.accuracy));
        setTour((cur) => {
          if (cur.clock.pausedAt) return cur;
          const track = addPoint(cur.track, { lat: pos.coords.latitude, lon: pos.coords.longitude, acc: pos.coords.accuracy, t: Date.now() }, cur.exId);
          return track === cur.track ? cur : { ...cur, track };
        });
      },
      (err) => setGps(err.code === err.PERMISSION_DENIED ? "afvist" : "soeger"),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20_000 },
    );
    return () => navigator.geolocation.clearWatch(watch);
  }, [paused]);

  const now = Date.now();
  const sec = elapsedSec(tour.clock, now);
  const km = tour.track.meters / 1000;
  const cur = paused ? 0 : currentKmh(tour.track, now);
  const avg = kmhOf(km, sec);

  const togglePause = () =>
    setTour((t) => {
      const n = Date.now();
      if (t.clock.pausedAt) return { ...t, clock: { ...t.clock, pausedMs: t.clock.pausedMs + (n - t.clock.pausedAt), pausedAt: undefined }, track: { ...t.track, last: null, recent: [] } };
      return { ...t, clock: { ...t.clock, pausedAt: n } };
    });

  const finish = () => {
    const t = tourRef.current;
    saveTour(null);
    onFinish(Math.round((t.track.meters / 1000) * 100) / 100, elapsedSec(t.clock, Date.now()));
  };
  const cancel = () => {
    saveTour(null);
    onCancel();
  };

  const gpsText =
    gps === "afvist"
      ? "Appen må ikke bruge din placering. Tillad det i telefonens indstillinger, eller skriv distancen selv bagefter."
      : gps === "mangler"
        ? "Telefonen kan ikke give appen din placering. Skriv distancen selv bagefter."
        : gps === "soeger"
          ? "Søger GPS…"
          : `GPS ±${acc ?? "?"} m${acc && acc > 30 ? " (for unøjagtig — venter på bedre signal)" : ""}`;

  return (
    <div className="tr-timer" style={{ "--c": paused ? "#6b7280" : id === "loebetur" ? "#c43d6b" : "#1f8a5b" } as CSSProperties} role="dialog" aria-label={title} hidden={hidden}>
      <div className="tr-timer-top">
        <span>{title}</span>
        <button className="tr-timer-x" onClick={onClose} aria-label="Skjul (turen kører videre)">
          ✕
        </button>
      </div>
      <div className="tr-timer-mid">
        <div className="tr-timer-sub">{paused ? "Pause" : "I gang"}</div>
        <div className="tr-timer-big tr-tour-km" aria-live="polite">
          {fmtKm(km)}
          <span className="tr-tour-unit"> km</span>
        </div>
        <div className="tr-timer-title">{fmtDuration(sec)}</div>
        <div className="tr-tour-live">
          <div>
            <b>{cur ? fmtKmh(cur) : "–"}</b>
            <span>km/t nu</span>
          </div>
          <div>
            <b>{km > 0.05 ? fmtKmh(avg) : "–"}</b>
            <span>km/t i snit</span>
          </div>
          {id === "loebetur" && (
            <div>
              <b>{km > 0.05 ? fmtPace(km, sec) : "–"}</b>
              <span>min/km</span>
            </div>
          )}
        </div>
        <div className="tr-timer-sub">{gpsText}</div>
        <div className="tr-timer-sub tr-tour-note">Hold appen åben. Skærmen bliver tændt, mens turen kører. Slukker den alligevel, regnes stykket som en lige linje.</div>
      </div>
      <div className="tr-timer-buttons">
        {confirmEnd ? (
          <>
            <button className="tr-timer-main" onClick={finish}>
              ✓ Ja, afslut turen
            </button>
            <button className="tr-timer-skip" onClick={() => setConfirmEnd(false)}>
              Fortsæt
            </button>
            <button className="tr-timer-skip" onClick={cancel}>
              Slet turen
            </button>
          </>
        ) : (
          <>
            <button className="tr-timer-main" onClick={() => setConfirmEnd(true)}>
              Afslut turen
            </button>
            <button className="tr-timer-skip" onClick={togglePause}>
              {paused ? "▶ Fortsæt" : "⏸ Pause"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
