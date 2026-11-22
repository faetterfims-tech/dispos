"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { DAYS, EXERCISES, RYG_OPVARMNING, dayById, exerciseById, videoUrl, type Day, type Exercise, type Unit } from "@/lib/traening/program";
import {
  fmtKg,
  lastLog,
  nextInOrder,
  upNext,
  progressSeries,
  scoreLabel,
  sessionsPerWeek,
  suggest,
  volume,
  weekStart,
  type BodyEntry,
  type NextPointer,
  type Session,
} from "@/lib/traening/logic";
import LineChart from "./LineChart";
import WarmupTimer from "./WarmupTimer";
import { fmtDuration, fmtMinutes, splitTime, type Interval } from "@/lib/traening/timing";

type Tab = "traen" | "fremgang" | "krop" | "historik" | "inviter";
interface SetDraft {
  kg: string;
  reps: string;
  done?: boolean;
  /** ms — sættet er i gang (▶ trykket, ✓ ikke endnu). */
  startedAt?: number;
  /** Sættets varighed i sekunder. */
  sec?: number;
}
interface WorkoutInterval extends Interval {
  kind: "set" | "opvarmning";
}
/** Uret for dagens træning. */
interface Workout {
  startedAt: number;
  intervals: WorkoutInterval[];
}
interface Draft {
  date: string;
  dayId: string;
  sets: Record<string, SetDraft[]>;
  warmup?: boolean[];
  workout?: Workout;
  note: string;
}
interface Data {
  configured: boolean;
  sessions: Session[];
  body: BodyEntry[];
  next: NextPointer | null;
  /** Hvem er logget ind (ejeren eller en inviteret). */
  me?: { name: string; owner: boolean };
}

const STORAGE = { draft: "dispos.traening.draft.v3", local: "dispos.traening.local" };

function load<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}
function save(key: string, value: unknown) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* blokeret — så lever det kun i denne session */
  }
}

/** Lokal dato som ÅÅÅÅ-MM-DD (uden at være afhængig af browserens sprogdata). */
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const fmtDate = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("da-DK", { weekday: "short", day: "numeric", month: "short" });
const fmtLong = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("da-DK", { weekday: "long", day: "numeric", month: "long" });
const toNum = (s: string) => Number(s.replace(",", "."));
const newId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
const addDays = (d: string, n: number) => {
  const x = new Date(`${d}T12:00:00Z`);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
};

/** Overskrift på tal-feltet. */
const COUNT_LABEL: Record<Unit, string> = { kg: "antal", reps: "antal", sek: "sekunder", runder: "runder" };
const WEEKDAYS = ["Man", "Tir", "Ons", "Tor", "Fre", "Lør", "Søn"];

/** Passene i den rækkefølge, de tages. Der er ingen faste ugedage. */
const ORDER = DAYS.map((d) => d.id);

function buildDraft(date: string, dayId: string, sessions: Session[]): Draft {
  const day = dayById(dayId) ?? DAYS[0];
  const sets: Record<string, SetDraft[]> = {};
  for (const ex of day.exercises) {
    const last = lastLog(sessions, ex.id, date);
    sets[ex.id] = suggest(ex, last?.log ?? null).sets.map((s) => ({
      kg: ex.unit === "kg" && s.kg ? fmtKg(s.kg) : "",
      reps: s.reps ? String(s.reps) : "",
      done: false,
    }));
  }
  return { date, dayId: day.id, sets, warmup: RYG_OPVARMNING.map(() => false), note: "" };
}

function fmtSets(ex: Exercise | undefined, sets: { kg: number; reps: number }[]) {
  if (!ex) return sets.map((s) => `${s.kg} kg × ${s.reps}`).join(" · ");
  if (ex.unit === "kg") return sets.map((s) => `${fmtKg(s.kg)} kg × ${s.reps}`).join(" · ");
  if (ex.unit === "reps") return sets.map((s) => (s.kg ? `${s.reps} (+${fmtKg(s.kg)} kg)` : `${s.reps}`)).join(" · ") + " gange";
  if (ex.unit === "sek") return sets.map((s) => `${s.reps} sek`).join(" · ");
  return `${sets.reduce((a, s) => a + s.reps, 0)} runder`;
}

export default function TrainingLog() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("traen");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  /** Linket virker ikke længere (adgang fjernet eller nyt link lavet). */
  const [denied, setDenied] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/traening", { cache: "no-store" });
        const body = (await res.json()) as Data & { error?: string };
        if (res.status === 401) {
          setDenied(body.error ?? "Linket virker ikke længere.");
          return;
        }
        if (!res.ok) throw new Error(body.error ?? `Fejl ${res.status}`);
        if (!body.configured) {
          const local = load<{ sessions: Session[]; body: BodyEntry[]; next?: NextPointer | null }>(STORAGE.local);
          setData({ configured: false, sessions: local?.sessions ?? [], body: local?.body ?? [], next: local?.next ?? null });
        } else setData({ ...body, next: body.next ?? null });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Kunne ikke hente loggen.");
        const local = load<{ sessions: Session[]; body: BodyEntry[]; next?: NextPointer | null }>(STORAGE.local);
        setData({ configured: false, sessions: local?.sessions ?? [], body: local?.body ?? [], next: local?.next ?? null });
      }
    })();
  }, []);

  // Start: en igangværende træning fra i dag, ellers dagens pas.
  useEffect(() => {
    if (!data || draft) return;
    const saved = load<Draft>(STORAGE.draft);
    if (saved && saved.date === today() && dayById(saved.dayId)) setDraft(saved);
    else {
      const d = today();
      setDraft(buildDraft(d, upNext(data.sessions, data.next, ORDER), data.sessions));
    }
  }, [data, draft]);

  useEffect(() => {
    if (draft) save(STORAGE.draft, draft);
  }, [draft]);

  const persistLocal = useCallback((next: Data) => {
    if (!next.configured) save(STORAGE.local, { sessions: next.sessions, body: next.body, next: next.next });
  }, []);

  const showFlash = (msg: string) => {
    setFlash(msg);
    setTimeout(() => setFlash(null), 3500);
  };

  async function api(method: "POST" | "DELETE", body?: unknown, query?: string) {
    const res = await fetch(`/api/traening${query ?? ""}`, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = await res.json();
    if (!res.ok || !json.ok) throw new Error(json.error ?? `Fejl ${res.status}`);
    return json;
  }

  async function saveSession() {
    if (!draft || !data) return;
    const day = dayById(draft.dayId);
    if (!day) return;
    const session: Session = {
      id: newId(),
      date: draft.date,
      dayId: draft.dayId,
      note: draft.note.trim() || undefined,
      time: draft.workout
        ? (() => {
            const now = Date.now();
            const split = splitTime(draft.workout.startedAt, draft.workout.intervals, now);
            return { startedAt: new Date(draft.workout.startedAt).toISOString(), endedAt: new Date(now).toISOString(), ...split };
          })()
        : undefined,
      exercises: day.exercises
        .map((ex) => ({
          id: ex.id,
          sets: (draft.sets[ex.id] ?? [])
            .filter((s) => s.done)
            .map((s) => ({ kg: s.kg ? toNum(s.kg) : 0, reps: toNum(s.reps), ...(s.sec ? { sec: s.sec } : {}) }))
            .filter((s) => Number.isFinite(s.kg) && Number.isFinite(s.reps) && s.reps > 0),
        }))
        .filter((e) => e.sets.length),
    };
    if (!session.exercises.length) {
      setError("Skriv antal ved de sæt, du har lavet (og tryk ✓), før du gemmer.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const saved: Session = data.configured ? (await api("POST", { kind: "session", session })).session : { ...session, savedAt: new Date().toISOString() };
      const next = { ...data, sessions: [saved, ...data.sessions] };
      setData(next);
      persistLocal(next);
      save(STORAGE.draft, null);
      setDraft(buildDraft(today(), nextInOrder(saved.dayId, ORDER), next.sessions));
      showFlash("Træningen er gemt. Godt gået! 💪");
      setTab("historik");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kunne ikke gemme.");
    } finally {
      setSaving(false);
    }
  }

  /** Spring det nuværende pas over: næste i rækken står så for tur. */
  async function skipPass() {
    if (!draft || !data) return;
    const dayId = nextInOrder(draft.dayId, ORDER);
    setError(null);
    try {
      const pointer: NextPointer = data.configured ? (await api("POST", { kind: "next", dayId })).next : { dayId, setAt: new Date().toISOString() };
      const next = { ...data, next: pointer };
      setData(next);
      persistLocal(next);
      setDraft(buildDraft(today(), dayId, data.sessions));
      showFlash(`Sprunget over. Næste pas er ${dayById(dayId)?.name ?? dayId}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kunne ikke springe over.");
    }
  }

  async function removeSession(id: string) {
    if (!data) return;
    try {
      if (data.configured) await api("DELETE", undefined, `?kind=session&id=${encodeURIComponent(id)}`);
      const next = { ...data, sessions: data.sessions.filter((s) => s.id !== id) };
      setData(next);
      persistLocal(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kunne ikke slette.");
    }
  }

  async function saveBodyEntry(entry: { date: string; weightKg: string; waistCm: string }) {
    if (!data) return false;
    const clean: BodyEntry = {
      date: entry.date,
      ...(entry.weightKg ? { weightKg: toNum(entry.weightKg) } : {}),
      ...(entry.waistCm ? { waistCm: toNum(entry.waistCm) } : {}),
    };
    if (!clean.weightKg && !clean.waistCm) {
      setError("Skriv din vægt og/eller dit mål om maven.");
      return false;
    }
    setError(null);
    try {
      const saved: BodyEntry = data.configured ? (await api("POST", { kind: "body", entry: clean })).entry : clean;
      const merged = { ...(data.body.find((b) => b.date === saved.date) ?? {}), ...saved };
      const next = { ...data, body: [...data.body.filter((b) => b.date !== saved.date), merged].sort((a, b) => a.date.localeCompare(b.date)) };
      setData(next);
      persistLocal(next);
      showFlash("Gemt");
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kunne ikke gemme.");
      return false;
    }
  }

  async function removeBody(date: string) {
    if (!data) return;
    try {
      if (data.configured) await api("DELETE", undefined, `?kind=body&date=${date}`);
      const next = { ...data, body: data.body.filter((b) => b.date !== date) };
      setData(next);
      persistLocal(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kunne ikke slette.");
    }
  }

  if (denied)
    return (
      <div className="card">
        <h2>Ingen adgang</h2>
        <p className="small" style={{ marginBottom: 0 }}>
          {denied} Hvis du har fået et nyt link, så åbn det igen.
        </p>
      </div>
    );
  if (!data || !draft) return <p className="muted">Henter…</p>;

  const owner = data.me?.owner ?? true;
  const tabs: [Tab, string, string][] = [
    ["traen", "🏋️", "Træn"],
    ["fremgang", "📈", "Fremgang"],
    ["krop", "⚖️", "Vægt"],
    ["historik", "🗓️", "Tidligere"],
    ...(owner && data.configured ? ([["inviter", "👥", "Inviter"]] as [Tab, string, string][]) : []),
  ];

  return (
    <div className="tr stack">
      {data.me && !data.me.owner && <p className="tr-hello">Hej {data.me.name} 👋</p>}
      <div className="tr-tabs" role="tablist" style={{ gridTemplateColumns: `repeat(${tabs.length}, 1fr)` }}>
        {tabs.map(([id, icon, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>
            <span aria-hidden>{icon}</span>
            {label}
          </button>
        ))}
      </div>

      {!data.configured && <div className="notice">Databasen er ikke koblet på, så det gemmes kun på denne telefon.</div>}
      {error && <div className="notice error">{error}</div>}
      {flash && <div className="notice good">{flash}</div>}

      {tab === "traen" && (
        <TrainTab
          draft={draft}
          sessions={data.sessions}
          saving={saving}
          onChange={setDraft}
          update={(fn) => setDraft((d) => (d ? fn(d) : d))}
          onPick={(date, dayId) => setDraft(buildDraft(date, dayId, data.sessions))}
          onSave={saveSession}
          onSkip={skipPass}
          upNextId={upNext(data.sessions, data.next, ORDER)}
        />
      )}
      {tab === "fremgang" && <ProgressTab sessions={data.sessions} body={data.body} />}
      {tab === "krop" && <BodyTab body={data.body} onSave={saveBodyEntry} onDelete={removeBody} />}
      {tab === "historik" && <HistoryTab sessions={data.sessions} onDelete={removeSession} />}
      {tab === "inviter" && owner && <InviteTab />}
    </div>
  );
}

/* ---------- Træn ---------- */

/**
 * Hvilket pas en dag har: det trænede, hvis man har trænet, ellers det, der
 * står for tur (i dag) og dem derefter (kommende dage). Tidligere dage uden træning: ingen.
 */
function passForDate(date: string, sessions: Session[], upNextId: string): { day: Day | undefined; trained: boolean } {
  const trainedDay = sessions.find((s) => s.date === date);
  if (trainedDay) return { day: dayById(trainedDay.dayId), trained: true };
  const t = today();
  if (date < t) return { day: undefined, trained: false };
  const todayTrained = sessions.some((s) => s.date === t);
  const ahead = Math.round((new Date(`${date}T12:00:00Z`).getTime() - new Date(`${t}T12:00:00Z`).getTime()) / 86_400_000);
  return { day: dayById(nextInOrder(upNextId, ORDER, todayTrained ? ahead - 1 : ahead)), trained: false };
}

function WeekStrip({ sessions, selected, upNextId, onPick }: { sessions: Session[]; selected: string; upNextId: string; onPick: (date: string) => void }) {
  const monday = weekStart(today());
  return (
    <div className="tr-week">
      {WEEKDAYS.map((label, i) => {
        const date = addDays(monday, i);
        const { day, trained } = passForDate(date, sessions, upNextId);
        const isToday = date === today();
        const future = date > today();
        return (
          <button
            key={date}
            className={`tr-weekday${date === selected ? " selected" : ""}${isToday ? " today" : ""}${future ? " future" : ""}`}
            onClick={() => onPick(date)}
            style={{ "--c": day?.color ?? "#9b988f" } as CSSProperties}
            aria-label={`${label}: ${day?.name ?? "fri"}${trained ? ", trænet" : ""}`}
          >
            <span className="tr-weekday-label">{label}</span>
            <span className={`tr-dot${trained ? " done" : ""}${day ? " has-pass" : ""}`}>{trained ? "✓" : new Date(`${date}T12:00:00`).getDate()}</span>
            <span className="tr-weekday-pass">{day?.short ?? "fri"}</span>
          </button>
        );
      })}
    </div>
  );
}

export function TrainTab({
  draft,
  sessions,
  saving,
  onChange,
  onPick,
  onSave,
  onSkip,
  upNextId,
  update,
}: {
  draft: Draft;
  sessions: Session[];
  saving: boolean;
  onChange: (d: Draft) => void;
  /** Ændring ud fra den nyeste kladde (sikkert ved flere ændringer lige efter hinanden). */
  update: (fn: (d: Draft) => Draft) => void;
  onPick: (date: string, dayId: string) => void;
  onSave: () => void;
  onSkip: () => void;
  upNextId: string;
}) {
  const day = dayById(draft.dayId) ?? DAYS[0];
  const nextDay = dayById(nextInOrder(day.id, ORDER));
  const total = day.exercises.reduce((n, ex) => n + (draft.sets[ex.id]?.length ?? 0), 0);
  const doneSets = day.exercises.reduce((n, ex) => n + (draft.sets[ex.id]?.filter((s) => s.done).length ?? 0), 0);
  const warm = draft.warmup ?? RYG_OPVARMNING.map(() => false);
  /** En kommende dag, man kigger på. Rører ikke dagens igangværende træning. */
  const [preview, setPreview] = useState<string | null>(null);
  /** Åben timer: "all" = hele opvarmningen, tal = én øvelse. */
  const [timer, setTimer] = useState<"all" | number | null>(null);

  const isToday = draft.date === today();
  const workout = draft.workout;
  /** I dag: felterne er låst, til man trykker Start. Efterregistrering er altid åben. */
  const locked = isToday && !workout;

  // Uret tikker hvert sekund, mens træningen kører.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!workout) return;
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [workout]);
  const split = workout ? splitTime(workout.startedAt, workout.intervals, Date.now()) : null;
  const anyRunning = Object.values(draft.sets).some((rows) => rows.some((r) => r.startedAt && !r.done));

  const startWorkout = () => update((d) => (d.workout ? d : { ...d, workout: { startedAt: Date.now(), intervals: [] } }));
  const cancelWorkout = () =>
    update((d) => {
      const rest: Draft = { ...d };
      delete rest.workout;
      const sets: Record<string, SetDraft[]> = {};
      for (const [k, rows] of Object.entries(d.sets)) sets[k] = rows.map((r) => ({ ...r, startedAt: undefined }));
      return { ...rest, sets };
    });

  /** Luk igangværende sæt (markér som lavet) og deres tidsperioder. */
  const closeRunning = (d: Draft, now: number): Draft => {
    const sets: Record<string, SetDraft[]> = {};
    for (const [k, rows] of Object.entries(d.sets))
      sets[k] = rows.map((r) => (r.startedAt && !r.done ? { ...r, done: true, startedAt: undefined, sec: Math.round((now - r.startedAt) / 1000) } : r));
    const intervals = (d.workout?.intervals ?? []).map((iv) => (iv.kind === "set" && iv.end === undefined ? { ...iv, end: now } : iv));
    return { ...d, sets, workout: d.workout ? { ...d.workout, intervals } : d.workout };
  };

  const startSet = (exId: string, i: number) =>
    update((d) => {
      const now = Date.now();
      const base = d.workout ? d : { ...d, workout: { startedAt: now, intervals: [] } };
      const c = closeRunning(base, now);
      const rows = [...(c.sets[exId] ?? [])];
      rows[i] = { ...rows[i], startedAt: now, done: false, sec: undefined };
      return { ...c, sets: { ...c.sets, [exId]: rows }, workout: { ...c.workout!, intervals: [...c.workout!.intervals, { start: now, kind: "set" }] } };
    });
  const finishSet = () => update((d) => closeRunning(d, Date.now()));
  const undoSet = (exId: string, i: number) =>
    update((d) => {
      const rows = [...(d.sets[exId] ?? [])];
      rows[i] = { ...rows[i], done: false, sec: undefined, startedAt: undefined };
      return { ...d, sets: { ...d.sets, [exId]: rows } };
    });

  const warmupRunning = (running: boolean) =>
    update((d) => {
      const now = Date.now();
      const w = d.workout ?? { startedAt: now, intervals: [] };
      const intervals = running
        ? [...w.intervals.map((iv) => (iv.end === undefined ? { ...iv, end: now } : iv)), { start: now, kind: "opvarmning" as const }]
        : w.intervals.map((iv) => (iv.kind === "opvarmning" && iv.end === undefined ? { ...iv, end: now } : iv));
      return { ...(running ? closeRunning(d, now) : d), workout: { ...w, intervals } };
    });

  const pickDate = (date: string) => {
    if (date > today()) {
      setPreview(date);
      return;
    }
    setPreview(null);
    // En tidligere dag: efterregistrér det samme pas på den dato.
    if (date !== draft.date) onPick(date, draft.dayId);
  };

  if (preview) {
    return (
      <>
        <WeekStrip sessions={sessions} selected={preview} upNextId={upNextId} onPick={pickDate} />
        <PreviewDay date={preview} day={passForDate(preview, sessions, upNextId).day ?? DAYS[0]} sessions={sessions} onBack={() => setPreview(null)} />
      </>
    );
  }

  const setRow = (exId: string, i: number, patch: Partial<SetDraft>) => {
    const rows = [...(draft.sets[exId] ?? [])];
    rows[i] = { ...rows[i], ...patch };
    onChange({ ...draft, sets: { ...draft.sets, [exId]: rows } });
  };
  const addRow = (exId: string) => {
    const rows = draft.sets[exId] ?? [];
    const lastRow = rows[rows.length - 1] ?? { kg: "", reps: "" };
    onChange({ ...draft, sets: { ...draft.sets, [exId]: [...rows, { kg: lastRow.kg, reps: lastRow.reps, done: false }] } });
  };
  const removeRow = (exId: string) => {
    const rows = (draft.sets[exId] ?? []).slice(0, -1);
    onChange({ ...draft, sets: { ...draft.sets, [exId]: rows } });
  };

  return (
    <>
      <WeekStrip sessions={sessions} selected={draft.date} upNextId={upNextId} onPick={pickDate} />

      <div className="tr-hero" style={{ "--c": day.color } as CSSProperties}>
        <div className="tr-hero-date">{isToday ? (workout ? "I gang" : "Dit næste pas") : `Efterregistrering · ${fmtLong(draft.date)}`}</div>
        <div className="tr-hero-title">{day.name}</div>
        <div className="tr-hero-meta">
          {day.exercises.length === 1 ? "1 øvelse" : `${day.exercises.length} øvelser`} · {day.minutes}
        </div>
        <div className="tr-progress" aria-label={`${doneSets} af ${total} sæt lavet`}>
          <div style={{ width: `${total ? (doneSets / total) * 100 : 0}%` }} />
        </div>
        <div className="tr-hero-meta">
          {doneSets} af {total} sæt lavet
        </div>
        {locked && (
          <button className="tr-start" onClick={startWorkout}>
            ▶ Start dagens træning
          </button>
        )}
        {workout && split && (
          <div className="tr-clock">
            <div className="tr-clock-big">⏱ {fmtDuration(split.totalSec)}</div>
            {doneSets === 0 && (
              <button className="tr-link tr-link-light" onClick={cancelWorkout}>
                Fortryd start
              </button>
            )}
          </div>
        )}
        {doneSets === 0 && !workout && isToday && nextDay && (
          <button className="tr-skip" onClick={onSkip}>
            Spring over → {nextDay.name}
          </button>
        )}
        <select className="tr-hero-select" value={draft.dayId} onChange={(e) => onPick(draft.date, e.target.value)} aria-label="Skift pas">
          {DAYS.map((d) => (
            <option key={d.id} value={d.id}>
              Skift pas: {d.name}
            </option>
          ))}
        </select>
      </div>

      <div className="tr-how card">
        <strong>Sådan gør du</strong>
        <span className="small">
          Tryk <b>Start dagens træning</b>, så starter uret. Tryk <b>▶</b>, når du går i gang med et sæt, og <b>✓</b>, når det er færdigt. Ret
          tallene, hvis det gik anderledes end foreslået. Hold 1–1½ min pause mellem sættene. Holder du fri en dag, venter det samme pas til
          næste gang.
        </span>
      </div>

      {day.warmup && (
        <div className="card tr-warmup">
          <div className="tr-ex-head">
            <span className="tr-num" style={{ background: "#b7791f" }}>
              ★
            </span>
            <div>
              <div className="tr-ex-name">Først: opvarmning af ryggen</div>
              <span className="tr-chip">ca. 7 min · styrker lænden</span>
            </div>
          </div>
          <button
            className="tr-timer-start"
            onClick={() => {
              if (isToday) startWorkout();
              setTimer("all");
            }}
          >
            ▶ Start hele opvarmningen med timer
          </button>
          {timer !== null && (
            <WarmupTimer
              only={timer === "all" ? undefined : timer}
              onItemDone={(item) => {
                const next = [...warm];
                next[item] = true;
                onChange({ ...draft, warmup: next });
              }}
              onRunningChange={(running) => {
                if (isToday) warmupRunning(running);
              }}
              onClose={() => setTimer(null)}
            />
          )}
          {RYG_OPVARMNING.map((w, i) => (
            <label key={w.name} className={`tr-check${warm[i] ? " done" : ""}`}>
              <input
                type="checkbox"
                disabled={locked}
                checked={warm[i] ?? false}
                onChange={(e) => {
                  const next = [...warm];
                  next[i] = e.target.checked;
                  onChange({ ...draft, warmup: next });
                }}
              />
              <span>
                <b>{w.name}</b> · {w.dose}
                <span className="small">{w.how}</span>
                <span className="tr-warm-actions">
                  <button
                    className="tr-warm-timer"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (isToday) startWorkout();
                      setTimer(i);
                    }}
                  >
                    ⏱ Timer
                  </button>
                  <a className="tr-video" href={videoUrl(w.aka)} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
                    ▶ Se hvordan
                  </a>
                </span>
              </span>
            </label>
          ))}
        </div>
      )}

      {day.exercises.map((ex, idx) => {
        const last = lastLog(sessions, ex.id, draft.date);
        const tip = suggest(ex, last?.log ?? null);
        const rows = draft.sets[ex.id] ?? [];
        const showKg = ex.unit === "kg";
        const allDone = rows.length > 0 && rows.every((r) => r.done);
        return (
          <div key={ex.id} className={`card tr-ex${allDone ? " complete" : ""}`}>
            <div className="tr-ex-head">
              <span className="tr-num" style={{ background: allDone ? "var(--good)" : day.color }}>
                {allDone ? "✓" : idx + 1}
              </span>
              <div>
                <div className="tr-ex-name">{ex.name}</div>
                <span className="tr-chip">{ex.muscles}</span>
              </div>
            </div>

            <p className="tr-ex-how">{ex.how}</p>
            {ex.aka && (
              <a className="tr-video" href={videoUrl(ex.aka)} target="_blank" rel="noreferrer">
                ▶ Se hvordan
              </a>
            )}

            <div className="tr-goal">
              <div>
                <span className="tr-goal-label">Mål</span>
                {ex.unit === "runder"
                  ? `${ex.target[0]}–${ex.target[1]} runder`
                  : `${ex.sets} sæt à ${ex.target[0]}–${ex.target[1]} ${ex.unit === "sek" ? "sekunder" : "gange"}`}
              </div>
              {last && (
                <div>
                  <span className="tr-goal-label">Sidst</span>
                  {fmtSets(ex, last.log.sets)} <span className="small">({fmtDate(last.date)})</span>
                </div>
              )}
              <div className="tr-goal-hint">👉 {tip.hint}</div>
            </div>

            <div className={`tr-sets${locked ? " locked" : ""}`}>
              <div className={`tr-set-row tr-set-head${showKg ? "" : " no-kg"}`}>
                <span>Sæt</span>
                {showKg && <span>kg</span>}
                <span>{COUNT_LABEL[ex.unit]}</span>
                <span>{isToday ? "▶ / ✓" : "Lavet"}</span>
              </div>
              {rows.map((r, i) => (
                <div key={i} className={`tr-set-row${showKg ? "" : " no-kg"}${r.done ? " done" : ""}`}>
                  <span className="tr-set-no">{i + 1}</span>
                  {showKg && (
                    <input
                      inputMode="decimal"
                      placeholder="kg"
                      value={r.kg}
                      disabled={locked}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => setRow(ex.id, i, { kg: e.target.value })}
                      aria-label={`Sæt ${i + 1}, kg`}
                    />
                  )}
                  <input
                    inputMode="numeric"
                    placeholder="0"
                    value={r.reps}
                    disabled={locked}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => setRow(ex.id, i, { reps: e.target.value })}
                    aria-label={`Sæt ${i + 1}, ${COUNT_LABEL[ex.unit]}`}
                  />
                  {!isToday ? (
                    <button
                      className={`tr-done${r.done ? " on" : ""}`}
                      onClick={() => setRow(ex.id, i, { done: !r.done })}
                      aria-pressed={!!r.done}
                      aria-label={`Sæt ${i + 1} lavet`}
                    >
                      ✓
                    </button>
                  ) : r.done ? (
                    <button className="tr-done on" onClick={() => undoSet(ex.id, i)} aria-label={`Sæt ${i + 1} lavet. Tryk for at fortryde`}>
                      ✓{r.sec ? <span className="tr-done-sec">{fmtDuration(r.sec)}</span> : null}
                    </button>
                  ) : r.startedAt ? (
                    <button className="tr-done running" onClick={finishSet} aria-label={`Sæt ${i + 1} i gang. Tryk når det er færdigt`}>
                      <span className="tr-done-sec">{fmtDuration(Math.max(0, Math.round((Date.now() - r.startedAt) / 1000)))}</span>✓
                    </button>
                  ) : (
                    <button className="tr-done" disabled={locked} onClick={() => startSet(ex.id, i)} aria-label={`Start sæt ${i + 1}`}>
                      ▶
                    </button>
                  )}
                </div>
              ))}
              <div className="tr-set-actions">
                <button className="secondary small-btn" disabled={locked} onClick={() => addRow(ex.id)}>
                  + Ekstra sæt
                </button>
                {rows.length > 1 && (
                  <button className="tr-link" disabled={locked} onClick={() => removeRow(ex.id)}>
                    Fjern sidste sæt
                  </button>
                )}
              </div>
            </div>

            {ex.tip && <p className="tr-tip">💡 {ex.tip}</p>}
          </div>
        );
      })}

      <div className="card">
        <label className="field">
          Noter (valgfrit)
          <textarea rows={2} value={draft.note} onChange={(e) => onChange({ ...draft, note: e.target.value })} placeholder="Fx ondt i ryggen, masser af energi…" />
        </label>
      </div>

      <div className="tr-savebar">
        {split && (
          <div className="tr-split" aria-label="Tidsforbrug">
            <span className="tr-split-total">⏱ {fmtDuration(split.totalSec)}</span>
            <span className="tr-split-a">Aktiv {fmtDuration(split.activeSec)}</span>
            <span className="tr-split-r">Pause {fmtDuration(split.restSec)}</span>
            <span className="tr-split-i">Spild {fmtDuration(split.idleSec)}</span>
          </div>
        )}
        {locked ? (
          <button className="save-btn" onClick={startWorkout}>
            ▶ Start dagens træning
          </button>
        ) : (
          <button className="save-btn" onClick={onSave} disabled={saving || doneSets === 0}>
            {saving ? "Gemmer…" : doneSets === 0 ? (isToday ? (anyRunning ? "Tryk ✓ ved sættet, når det er færdigt" : "Tryk ▶ for at starte dit første sæt") : "Tryk ✓ ved dine sæt for at gemme") : `Gem træningen (${doneSets} sæt)`}
          </button>
        )}
      </div>
    </>
  );
}

/* ---------- Kig frem ---------- */

function relDay(date: string) {
  const diff = Math.round((new Date(`${date}T12:00:00Z`).getTime() - new Date(`${today()}T12:00:00Z`).getTime()) / 86_400_000);
  if (diff === 1) return `I morgen · ${fmtLong(date)}`;
  return fmtLong(date);
}

export function PreviewDay({ date, day, sessions, onBack }: { date: string; day: Day; sessions: Session[]; onBack: () => void }) {
  const back = (
    <button className="secondary" style={{ width: "100%" }} onClick={onBack}>
      ← Tilbage til dit næste pas
    </button>
  );

  return (
    <>
      <div className="tr-hero" style={{ "--c": day.color } as CSSProperties}>
        <div className="tr-hero-date">{relDay(date)}</div>
        <div className="tr-hero-title">{day.name}</div>
        <div className="tr-hero-meta">
          {day.exercises.length === 1 ? "1 øvelse" : `${day.exercises.length} øvelser`} · {day.minutes}
        </div>
        <div className="tr-hero-note">Hvis du træner hver dag frem til da. Holder du fri en dag, rykker passene bare en dag.</div>
      </div>

      {day.warmup && (
        <div className="card tr-warmup">
          <div className="tr-ex-head">
            <span className="tr-num" style={{ background: "#b7791f" }}>
              ★
            </span>
            <div>
              <div className="tr-ex-name">Først: opvarmning af ryggen</div>
              <span className="tr-chip">{RYG_OPVARMNING.map((w) => w.name).join(" · ")}</span>
            </div>
          </div>
        </div>
      )}

      {day.exercises.map((ex, idx) => {
        const last = lastLog(sessions, ex.id, date);
        const tip = suggest(ex, last?.log ?? null);
        return (
          <div key={ex.id} className="card tr-ex">
            <div className="tr-ex-head">
              <span className="tr-num" style={{ background: day.color }}>
                {idx + 1}
              </span>
              <div>
                <div className="tr-ex-name">{ex.name}</div>
                <span className="tr-chip">{ex.muscles}</span>
              </div>
            </div>
            <p className="tr-ex-how">{ex.how}</p>
            {ex.aka && (
              <a className="tr-video" href={videoUrl(ex.aka)} target="_blank" rel="noreferrer">
                ▶ Se hvordan
              </a>
            )}
            <div className="tr-goal">
              <div>
                <span className="tr-goal-label">Mål</span>
                {ex.unit === "runder"
                  ? `${ex.target[0]}–${ex.target[1]} runder`
                  : `${ex.sets} sæt à ${ex.target[0]}–${ex.target[1]} ${ex.unit === "sek" ? "sekunder" : "gange"}`}
              </div>
              {last && (
                <div>
                  <span className="tr-goal-label">Sidst</span>
                  {fmtSets(ex, last.log.sets)} <span className="small">({fmtDate(last.date)})</span>
                </div>
              )}
              <div className="tr-goal-hint">👉 {tip.hint}</div>
            </div>
            {ex.tip && <p className="tr-tip">💡 {ex.tip}</p>}
          </div>
        );
      })}
      {back}
    </>
  );
}

/* ---------- Fremgang ---------- */

function ProgressTab({ sessions, body }: { sessions: Session[]; body: BodyEntry[] }) {
  const used = useMemo(() => EXERCISES.filter((e) => sessions.some((s) => s.exercises.some((x) => x.id === e.id))), [sessions]);
  const [exId, setExId] = useState<string>(used[0]?.id ?? "");
  const ex = exerciseById(exId) ?? used[0];

  const week = weekStart(today());
  const perWeek = sessionsPerWeek(sessions);
  const thisWeek = perWeek.find((w) => w.week === week)?.count ?? 0;
  const weights = body.filter((b) => b.weightKg);
  const waists = body.filter((b) => b.waistCm);
  const dW = weights.length > 1 ? weights[weights.length - 1].weightKg! - weights[0].weightKg! : null;
  const dWaist = waists.length > 1 ? waists[waists.length - 1].waistCm! - waists[0].waistCm! : null;
  const signed = (n: number, unit: string) => `${n > 0 ? "+" : n < 0 ? "−" : "±"}${fmtKg(Math.abs(Math.round(n * 10) / 10))} ${unit}`;

  const series = ex ? progressSeries(sessions, ex) : [];
  const change = series.length > 1 ? (series[series.length - 1].value / series[0].value - 1) * 100 : null;

  return (
    <>
      <div className="kpis">
        <div className="card kpi">
          <div className="value">{thisWeek} af 6</div>
          <div className="label">Træninger denne uge</div>
        </div>
        <div className="card kpi">
          <div className="value">{sessions.length}</div>
          <div className="label">Træninger i alt</div>
        </div>
        <div className="card kpi">
          <div className="value">{dW === null ? "–" : signed(dW, "kg")}</div>
          <div className="label">Vægt siden start</div>
        </div>
        <div className="card kpi">
          <div className="value">{dWaist === null ? "–" : signed(dWaist, "cm")}</div>
          <div className="label">Om maven siden start</div>
        </div>
      </div>

      <div className="card">
        <h2>Bliver du stærkere?</h2>
        {used.length === 0 ? (
          <p className="small">Gem din første træning, så kan du følge med her.</p>
        ) : (
          <>
            <select value={ex?.id} onChange={(e) => setExId(e.target.value)} style={{ width: "100%", marginBottom: "0.75rem" }}>
              {used.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
            {ex && (
              <>
                <p className="small" style={{ marginTop: 0 }}>
                  {scoreLabel[ex.unit]}
                  {change !== null && (
                    <>
                      {" · "}
                      <strong style={{ color: change >= 0 ? "var(--good)" : "var(--bad)" }}>
                        {change >= 0 ? "+" : "−"}
                        {Math.abs(change).toFixed(0)} %
                      </strong>{" "}
                      siden første gang
                    </>
                  )}
                </p>
                <LineChart points={series} unit={ex.unit === "kg" ? "kg" : COUNT_LABEL[ex.unit]} />
              </>
            )}
          </>
        )}
      </div>
    </>
  );
}

/* ---------- Vægt og mål ---------- */

function BodyTab({
  body,
  onSave,
  onDelete,
}: {
  body: BodyEntry[];
  onSave: (e: { date: string; weightKg: string; waistCm: string }) => Promise<boolean>;
  onDelete: (date: string) => void;
}) {
  const [form, setForm] = useState({ date: today(), weightKg: "", waistCm: "" });
  const weights = body.filter((b) => b.weightKg).map((b) => ({ date: b.date, value: b.weightKg! }));
  const waists = body.filter((b) => b.waistCm).map((b) => ({ date: b.date, value: b.waistCm! }));

  return (
    <>
      <div className="card">
        <h2>Vej og mål dig</h2>
        <p className="small" style={{ marginTop: 0 }}>
          Én gang om ugen er nok: om morgenen, før du spiser. Mål om maven i højde med navlen. Det mål viser bedre end vægten, om maven bliver
          mindre, fordi du samtidig tager muskler på.
        </p>
        <div className="controls">
          <label className="field">
            Dato
            <input type="date" value={form.date} max={today()} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </label>
          <label className="field">
            Vægt (kg)
            <input inputMode="decimal" className="short" value={form.weightKg} onChange={(e) => setForm({ ...form, weightKg: e.target.value })} placeholder="85" />
          </label>
          <label className="field">
            Om maven (cm)
            <input inputMode="decimal" className="short" value={form.waistCm} onChange={(e) => setForm({ ...form, waistCm: e.target.value })} placeholder="100" />
          </label>
          <button
            onClick={async () => {
              if (await onSave(form)) setForm({ ...form, weightKg: "", waistCm: "" });
            }}
          >
            Gem
          </button>
        </div>
      </div>

      <div className="card">
        <h2>Vægt</h2>
        <LineChart points={weights} unit="kg" />
      </div>
      <div className="card">
        <h2>Om maven</h2>
        <LineChart points={waists} unit="cm" color="var(--series-2)" />
      </div>

      {body.length > 0 && (
        <div className="card table-wrap">
          <table>
            <thead>
              <tr>
                <th>Dato</th>
                <th>Vægt</th>
                <th>Om maven</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {[...body].reverse().map((b) => (
                <tr key={b.date}>
                  <td>{fmtDate(b.date)}</td>
                  <td>{b.weightKg ? `${fmtKg(b.weightKg)} kg` : "–"}</td>
                  <td>{b.waistCm ? `${fmtKg(b.waistCm)} cm` : "–"}</td>
                  <td>
                    <ConfirmDelete onConfirm={() => onDelete(b.date)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

/* ---------- Tidligere træninger ---------- */

export function HistoryTab({ sessions, onDelete }: { sessions: Session[]; onDelete: (id: string) => void }) {
  if (!sessions.length) return <p className="muted">Ingen træninger endnu. Gå til “Træn”, og gem din første.</p>;
  const sorted = [...sessions].sort((a, b) => b.date.localeCompare(a.date) || (b.savedAt ?? "").localeCompare(a.savedAt ?? ""));
  return (
    <>
      {sorted.map((s) => {
        const day: Day | undefined = dayById(s.dayId);
        const vol = volume(s, (id) => exerciseById(id)?.unit);
        return (
          <details key={s.id} className="card tr-hist" style={{ "--c": day?.color ?? "var(--accent)" } as CSSProperties}>
            <summary>
              <span className="tr-hist-bar" />
              <span>
                <strong>{day?.name ?? s.dayId}</strong>
                <span className="small">
                  {fmtDate(s.date)} · {s.exercises.length} {s.exercises.length === 1 ? "øvelse" : "øvelser"}
                  {vol ? ` · ${vol.toLocaleString("da-DK")} kg løftet i alt` : ""}
                </span>
              </span>
            </summary>
            <ul className="history-list">
              {s.exercises.map((e) => (
                <li key={e.id}>
                  <strong>{exerciseById(e.id)?.name ?? e.id}:</strong> {fmtSets(exerciseById(e.id), e.sets)}
                </li>
              ))}
            </ul>
            {s.time && (
              <div className="tr-hist-time">
                <span>⏱ {fmtMinutes(s.time.totalSec)} i alt</span>
                <span className="tr-split-a">Aktiv {fmtMinutes(s.time.activeSec)}</span>
                <span className="tr-split-r">Pause {fmtMinutes(s.time.restSec)}</span>
                <span className="tr-split-i">Spild {fmtMinutes(s.time.idleSec)}</span>
              </div>
            )}
            {s.note && <p className="small">📝 {s.note}</p>}
            <ConfirmDelete label="Slet træning" onConfirm={() => onDelete(s.id)} />
          </details>
        );
      })}
    </>
  );
}

/* ---------- Inviter (kun ejeren) ---------- */

interface Invitee {
  id: string;
  name: string;
  createdAt: string;
  lastSeen: string | null;
  active: boolean;
  sessions: number;
}

function InviteTab() {
  const [users, setUsers] = useState<Invitee[] | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [fresh, setFresh] = useState<{ name: string; link: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/traening/invitationer", { cache: "no-store" });
      const body = await res.json();
      if (!res.ok || !body.ok) throw new Error(body.error ?? `Fejl ${res.status}`);
      setUsers(body.users);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Kunne ikke hente invitationer.");
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  async function post(payload: unknown) {
    setBusy(true);
    setErr(null);
    setCopied(false);
    try {
      const res = await fetch("/api/traening/invitationer", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const body = await res.json();
      if (!res.ok || !body.ok) throw new Error(body.error ?? `Fejl ${res.status}`);
      setFresh({ name: body.name, link: body.link });
      setName("");
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Kunne ikke lave linket.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string, full: boolean) {
    setErr(null);
    try {
      const res = await fetch(`/api/traening/invitationer?id=${id}${full ? "&slet=1" : ""}`, { method: "DELETE" });
      const body = await res.json();
      if (!res.ok || !body.ok) throw new Error(body.error ?? `Fejl ${res.status}`);
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Kunne ikke fjerne adgangen.");
    }
  }

  const share = async () => {
    if (!fresh) return;
    const text = `Hej ${fresh.name}! Her er dit link til træningsappen. Åbn det på din telefon, så er du logget ind:`;
    try {
      if (navigator.share) await navigator.share({ title: "Træning", text, url: fresh.link });
      else {
        await navigator.clipboard.writeText(`${text} ${fresh.link}`);
        setCopied(true);
      }
    } catch {
      /* annulleret */
    }
  };
  const copy = async () => {
    if (!fresh) return;
    try {
      await navigator.clipboard.writeText(fresh.link);
      setCopied(true);
    } catch {
      setErr("Kunne ikke kopiere. Tryk og hold på linket i stedet.");
    }
  };

  return (
    <>
      <div className="card">
        <h2>Inviter en ven</h2>
        <p className="small" style={{ marginTop: 0 }}>
          Hver person får sit eget link og sin egen private log med samme program som dig. Med linket kommer de kun ind i træningsappen, ikke
          i resten af dispos.
        </p>
        <div className="controls">
          <label className="field" style={{ flex: 1, minWidth: 160 }}>
            Navn
            <input inputMode="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Fx Mor" maxLength={40} />
          </label>
          <button disabled={busy || !name.trim()} onClick={() => post({ name })}>
            {busy ? "Laver…" : "Lav link"}
          </button>
        </div>
      </div>

      {err && <div className="notice error">{err}</div>}

      {fresh && (
        <div className="card tr-invite-fresh">
          <strong>Link til {fresh.name}</strong>
          <p className="small" style={{ margin: "0.3rem 0 0.6rem" }}>
            Send det kun til {fresh.name}. Det vises kun nu, men du kan altid lave et nyt.
          </p>
          <div className="tr-invite-link">{fresh.link}</div>
          <div className="tr-set-actions" style={{ marginTop: "0.7rem" }}>
            <button onClick={share}>📤 Del</button>
            <button className="secondary" onClick={copy}>
              {copied ? "✓ Kopieret" : "Kopiér"}
            </button>
          </div>
        </div>
      )}

      <div className="card">
        <h2>Inviterede</h2>
        {users === null ? (
          <p className="small">Henter…</p>
        ) : users.length === 0 ? (
          <p className="small">Ingen endnu.</p>
        ) : (
          <div className="tr-invitees">
            {users.map((u) => (
              <div key={u.id} className={`tr-invitee${u.active ? "" : " inactive"}`}>
                <div>
                  <strong>{u.name}</strong>
                  <span className="small">
                    {u.active ? "Har adgang" : "Ingen adgang"} · {u.sessions} {u.sessions === 1 ? "træning" : "træninger"}
                    {u.lastSeen ? ` · sidst set ${fmtDate(u.lastSeen.slice(0, 10))}` : " · har ikke åbnet linket endnu"}
                  </span>
                </div>
                <div className="tr-set-actions">
                  <button className="secondary small-btn" disabled={busy} onClick={() => post({ renew: u.id })}>
                    {u.active ? "Nyt link" : "Giv adgang igen"}
                  </button>
                  {u.active ? (
                    <ConfirmDelete label="Fjern adgang" onConfirm={() => remove(u.id, false)} />
                  ) : (
                    <ConfirmDelete label="Slet helt" onConfirm={() => remove(u.id, true)} />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        <p className="small" style={{ marginBottom: 0 }}>
          Et link kan åbnes på flere enheder. “Nyt link” erstatter det gamle (fx hvis det er blevet delt med andre), og personen skal så åbne det
          nye. “Fjern adgang” lukker linket, men gemmer træningerne. “Slet helt” sletter personen og alle deres træninger.
        </p>
      </div>
    </>
  );
}

function ConfirmDelete({ onConfirm, label = "Slet" }: { onConfirm: () => void; label?: string }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 3000);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <button className={`secondary small-btn${armed ? " danger" : ""}`} onClick={() => (armed ? onConfirm() : setArmed(true))}>
      {armed ? "Tryk igen for at slette" : label}
    </button>
  );
}
