"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { Exercise } from "@/lib/traening/program";
import { stepFor } from "@/lib/traening/loads";
import { fmtDuration, restFor, tempoFor, tempoState } from "@/lib/traening/timing";
import { useWakeLock } from "./device";

/** Det, timeren skal vide om et sæt. */
export interface TimerRow {
  kg: string;
  reps: string;
  done?: boolean;
  startedAt?: number;
}

/** Hvor man er i forløbet: i et sæt, ved at skrive antal, eller i pause. */
export type Flow =
  | { kind: "set"; exId: string; i: number }
  | { kind: "confirm"; exId: string; i: number; counted: number }
  | { kind: "rest"; until: number; afterExId: string; hidden?: boolean };

/** Næste sæt, der ikke er lavet: først i samme øvelse, ellers i de næste. */
export function nextSet(exercises: Exercise[], sets: Record<string, TimerRow[]>, fromExId: string): { ex: Exercise; i: number } | null {
  const start = Math.max(0, exercises.findIndex((e) => e.id === fromExId));
  const order = [...exercises.slice(start), ...exercises.slice(0, start)];
  for (const ex of order) {
    const i = (sets[ex.id] ?? []).findIndex((r) => !r.done && !r.startedAt);
    if (i >= 0) return { ex, i };
  }
  return null;
}

const toNum = (s: string) => Number(s.replace(",", "."));
const fmtKg = (kg: number) => (Number.isInteger(kg) ? String(kg) : kg.toFixed(1).replace(".", ","));

const COLORS = { ned: "#2a6fd6", op: "#1f8a5b", hold: "#b7791f", pause: "#5b5953", klar: "#1f8a5b" };

export default function SetTimer({
  flow,
  exercises,
  sets,
  onFlow,
  onStartSet,
  onStartNow,
  onFinishSet,
  onEdit,
  beep,
  initSound,
  sound,
  onSound,
}: {
  flow: Flow;
  exercises: Exercise[];
  sets: Record<string, TimerRow[]>;
  onFlow: (f: Flow | null) => void;
  onStartSet: (exId: string, i: number) => void;
  onStartNow: (exId: string, i: number) => void;
  onFinishSet: () => void;
  onEdit: (exId: string, i: number, patch: { kg?: string; reps?: string }) => void;
  beep: (freq: number, ms: number) => void;
  initSound: () => void;
  sound: boolean;
  onSound: (on: boolean) => void;
}) {
  // Tikker for at tegne igen; selve tiden læses direkte, så den aldrig er forældet.
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 200);
    return () => clearInterval(t);
  }, []);
  const now = Date.now();
  useWakeLock(true);

  const lastCue = useRef<string>("");
  const say = (freq: number, ms: number) => {
    if (sound) beep(freq, ms);
  };

  /* ----- Bip ----- */
  const ex = flow.kind === "rest" ? null : exercises.find((e) => e.id === flow.exId);
  const row = flow.kind === "rest" || !ex ? null : (sets[ex.id] ?? [])[flow.i];
  const tempo = ex ? tempoFor(ex) : null;
  const elapsed = row?.startedAt ? now - row.startedAt : 0;
  /** Sekunder tilbage af nedtællingen før sættet (0 = sættet er i gang). */
  const countdown = flow.kind === "set" && elapsed < 0 ? Math.min(5, Math.ceil(-elapsed / 1000)) : 0;
  const tState = tempo && flow.kind === "set" && countdown === 0 ? tempoState(elapsed, tempo) : null;
  const restLeft = flow.kind === "rest" ? Math.ceil((flow.until - now) / 1000) : 0;

  useEffect(() => {
    if (flow.kind === "set" && countdown > 0) {
      const key = `cd-${countdown}`;
      if (key !== lastCue.current) {
        lastCue.current = key;
        say(countdown <= 3 ? 660 : 520, 120);
      }
    }
    if (flow.kind === "set" && tState) {
      const key = `${tState.reps}-${tState.phase}`;
      if (key !== lastCue.current) {
        lastCue.current = key;
        say(tState.phase === "ned" ? 440 : 880, tState.phase === "ned" ? 160 : 110);
      }
    }
    if (flow.kind === "rest") {
      const key = `rest-${Math.max(restLeft, 0)}`;
      if (key !== lastCue.current) {
        lastCue.current = key;
        if (restLeft > 0 && restLeft <= 3) say(660, 120);
        if (restLeft === 0) {
          say(880, 400);
          try {
            navigator.vibrate?.(300);
          } catch {
            /* ikke understøttet */
          }
        }
      }
    }
  });

  /* ----- Pause ----- */
  if (flow.kind === "rest") {
    if (flow.hidden) return null;
    const next = nextSet(exercises, sets, flow.afterExId);
    const ready = restLeft <= 0;
    const nextRow = next ? sets[next.ex.id][next.i] : null;
    return (
      <div className="tr-timer" style={{ "--c": ready ? COLORS.klar : COLORS.pause } as CSSProperties} role="dialog" aria-label="Pause">
        <div className="tr-timer-top">
          <span>Pause</span>
          <button className="tr-timer-x" onClick={() => onFlow({ ...flow, hidden: true })} aria-label="Skjul">
            ✕
          </button>
        </div>
        <div className="tr-timer-mid">
          {next ? (
            <>
              <div className="tr-timer-sub">{ready ? "Klar til næste sæt" : "Hvil, og træk vejret roligt"}</div>
              <div className="tr-timer-big" aria-live="polite">
                {ready ? "💪" : fmtDuration(restLeft)}
              </div>
              <div className="tr-timer-title">{next.ex.name}</div>
              <div className="tr-timer-sub">
                Sæt {next.i + 1} af {sets[next.ex.id].length}
                {nextRow && (next.ex.unit === "kg" && nextRow.kg ? ` · ${nextRow.kg} kg` : "")}
                {nextRow?.reps ? ` · ${nextRow.reps} ${next.ex.unit === "sek" ? "sek" : "gange"}` : ""}
              </div>
            </>
          ) : (
            <>
              <div className="tr-timer-big" style={{ fontSize: "5rem" }}>
                🎉
              </div>
              <div className="tr-timer-title">Alle sæt er lavet</div>
              <div className="tr-timer-sub">Tryk “Gem træningen” nederst.</div>
            </>
          )}
        </div>
        <div className="tr-timer-buttons">
          {next ? (
            <>
              <button
                className={ready ? "tr-timer-main" : "tr-timer-skip"}
                onClick={() => {
                  initSound();
                  onStartSet(next.ex.id, next.i);
                  onFlow({ kind: "set", exId: next.ex.id, i: next.i });
                }}
              >
                {ready ? `▶ Start sæt ${next.i + 1}` : "Start alligevel"}
              </button>
              {!ready ? (
                <button className="tr-timer-skip" onClick={() => onFlow({ ...flow, until: flow.until + 30_000 })}>
                  +30 sek
                </button>
              ) : (
                <button className="tr-timer-skip" onClick={() => onFlow(null)}>
                  Luk
                </button>
              )}
            </>
          ) : (
            <button className="tr-timer-main" onClick={() => onFlow(null)}>
              Luk
            </button>
          )}
        </div>
      </div>
    );
  }

  if (!ex || !row) return null;
  const total = (sets[ex.id] ?? []).length;
  const target = `${ex.unit === "kg" && row.kg ? `${row.kg} kg · ` : ""}${row.reps ? `${row.reps} ${ex.unit === "sek" ? "sek" : "gange"}` : "så mange du kan"}`;

  /* ----- Skriv antal ----- */
  if (flow.kind === "confirm") return <Confirm key={`${ex.id}-${flow.i}`} ex={ex} row={row} i={flow.i} counted={flow.counted} onEdit={onEdit} onDone={(skipRest) => {
    const rest = restFor(ex);
    if (skipRest || rest <= 0) onFlow(null);
    else onFlow({ kind: "rest", until: Date.now() + rest * 1000, afterExId: ex.id });
  }} />;

  /* ----- Nedtælling før sættet ----- */
  if (flow.kind === "set" && countdown > 0) {
    return (
      <div className="tr-timer" style={{ "--c": COLORS.pause } as CSSProperties} role="dialog" aria-label="Gør klar">
        <div className="tr-timer-top">
          <span>
            {ex.name} · sæt {flow.i + 1} af {total}
          </span>
          <button className="tr-timer-x" onClick={() => onFlow(null)} aria-label="Skjul timeren">
            ✕
          </button>
        </div>
        <div className="tr-timer-mid">
          <div className="tr-timer-sub">Mål: {target}</div>
          <div className="tr-timer-big" aria-live="polite">
            {countdown}
          </div>
          <div className="tr-timer-title">Stil dig klar</div>
        </div>
        <div className="tr-timer-buttons">
          <button className="tr-timer-main" onClick={() => onStartNow(ex.id, flow.i)}>
            Start nu
          </button>
          <button className="tr-timer-skip" onClick={() => onSound(!sound)} aria-pressed={sound}>
            {sound ? "🔊 Lyd" : "🔇 Lyd"}
          </button>
        </div>
      </div>
    );
  }

  /* ----- I sættet ----- */
  const color = tState ? COLORS[tState.phase] : COLORS.hold;
  return (
    <div className="tr-timer" style={{ "--c": color } as CSSProperties} role="dialog" aria-label="Sæt i gang">
      <div className="tr-timer-top">
        <span>
          {ex.name} · sæt {flow.i + 1} af {total}
        </span>
        <button className="tr-timer-x" onClick={() => onFlow(null)} aria-label="Skjul timeren (sættet kører videre)">
          ✕
        </button>
      </div>
      <div className="tr-timer-mid">
        <div className="tr-timer-sub">Mål: {target}</div>
        {tState ? (
          <>
            <div className="tr-timer-phase">{tState.phase === "ned" ? "NED" : "OP"}</div>
            <div className="tr-timer-title">Gentagelse {tState.reps + 1}</div>
            <div className="tr-timer-sub">
              {tempo!.down} sek ned · {tempo!.up} sek op · {fmtDuration(Math.floor(elapsed / 1000))}
            </div>
          </>
        ) : (
          <>
            <div className="tr-timer-big" aria-live="polite">
              {fmtDuration(Math.max(0, Math.floor(elapsed / 1000)))}
            </div>
            <div className="tr-timer-title">Hold</div>
          </>
        )}
      </div>
      <div className="tr-timer-buttons">
        <button
          className="tr-timer-main"
          onClick={() => {
            const counted = tState ? tState.reps : Math.max(0, Math.floor(elapsed / 1000));
            onFinishSet();
            onFlow({ kind: "confirm", exId: ex.id, i: flow.i, counted });
          }}
        >
          ✓ Færdig
        </button>
        <button className="tr-timer-skip" onClick={() => onSound(!sound)} aria-pressed={sound}>
          {sound ? "🔊 Lyd" : "🔇 Lyd"}
        </button>
      </div>
    </div>
  );
}

/** Efter sættet: skriv hvor mange (og evt. vægten), før pausen starter. */
function Confirm({
  ex,
  row,
  i,
  counted,
  onEdit,
  onDone,
}: {
  ex: Exercise;
  row: TimerRow;
  i: number;
  counted: number;
  onEdit: (exId: string, i: number, patch: { kg?: string; reps?: string }) => void;
  onDone: (skipRest: boolean) => void;
}) {
  const planned = row.reps ? toNum(row.reps) : 0;
  const [reps, setReps] = useState(ex.unit === "sek" ? counted : planned || counted || 0);
  const [kg, setKg] = useState(row.kg ? toNum(row.kg) : 0);
  const step = stepFor(kg);
  const save = (skipRest: boolean) => {
    onEdit(ex.id, i, { reps: String(Math.max(0, reps)), ...(ex.unit === "kg" ? { kg: fmtKg(Math.max(0, kg)) } : {}) });
    onDone(skipRest);
  };
  const unit = ex.unit === "sek" ? "sekunder" : "gange";
  return (
    <div className="tr-timer" style={{ "--c": "#171614" } as CSSProperties} role="dialog" aria-label="Hvor mange nåede du">
      <div className="tr-timer-top">
        <span>
          {ex.name} · sæt {i + 1}
        </span>
      </div>
      <div className="tr-timer-mid">
        <div className="tr-timer-title">Hvor mange nåede du?</div>
        <div className="tr-stepper">
          <button onClick={() => setReps((r) => Math.max(0, r - 1))} aria-label="En mindre">
            −
          </button>
          <span className="tr-stepper-value">
            {reps}
            <small>{unit}</small>
          </span>
          <button onClick={() => setReps((r) => r + 1)} aria-label="En mere">
            +
          </button>
        </div>
        {ex.unit !== "sek" && counted > 0 && counted !== reps && (
          <button className="tr-link tr-link-light" onClick={() => setReps(counted)}>
            Rytmen talte {counted}. Brug det
          </button>
        )}
        {ex.unit === "kg" && (
          <>
            <div className="tr-timer-sub" style={{ marginTop: "1rem" }}>
              Vægt
            </div>
            <div className="tr-stepper small">
              <button onClick={() => setKg((k) => Math.max(0, k - step))} aria-label="Mindre vægt">
                −
              </button>
              <span className="tr-stepper-value">
                {fmtKg(kg)}
                <small>kg</small>
              </span>
              <button onClick={() => setKg((k) => k + stepFor(k + 0.1))} aria-label="Mere vægt">
                +
              </button>
            </div>
          </>
        )}
      </div>
      <div className="tr-timer-buttons">
        <button className="tr-timer-main" onClick={() => save(false)}>
          Gem og hold pause
        </button>
        <button className="tr-timer-skip" onClick={() => save(true)}>
          Uden pause
        </button>
      </div>
    </div>
  );
}
