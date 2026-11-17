"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { DAYS, EXERCISES, dayById, exerciseById, type Exercise, type Unit } from "@/lib/traening/program";
import {
  fmtKg,
  isoWeekday,
  lastLog,
  progressSeries,
  scoreLabel,
  sessionsPerWeek,
  suggest,
  volume,
  weekStart,
  type BodyEntry,
  type Session,
} from "@/lib/traening/logic";
import LineChart from "./LineChart";

type Tab = "traen" | "fremgang" | "krop" | "historik";
interface SetDraft {
  kg: string;
  reps: string;
}
interface Draft {
  date: string;
  dayId: string;
  sets: Record<string, SetDraft[]>;
  note: string;
}
interface Data {
  configured: boolean;
  sessions: Session[];
  body: BodyEntry[];
}

const STORAGE = { draft: "dispos.traening.draft", local: "dispos.traening.local" };

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

const today = () => new Date().toLocaleDateString("sv-SE");
const fmtDate = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("da-DK", { weekday: "short", day: "numeric", month: "short" });
const toNum = (s: string) => Number(s.replace(",", "."));
const newId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

const UNIT_LABEL: Record<Unit, string> = { kg: "gent.", reps: "gent.", sek: "sek", runder: "runder" };

function dayForDate(date: string) {
  const wd = isoWeekday(date);
  return DAYS.find((d) => d.weekday === wd) ?? null;
}

function buildDraft(date: string, dayId: string, sessions: Session[]): Draft {
  const day = dayById(dayId) ?? DAYS[0];
  const sets: Record<string, SetDraft[]> = {};
  for (const ex of day.exercises) {
    const last = lastLog(sessions, ex.id, date);
    sets[ex.id] = suggest(ex, last?.log ?? null).sets.map((s) => ({
      kg: ex.unit === "kg" || (ex.unit === "reps" && s.kg) ? (s.kg ? fmtKg(s.kg) : "") : "",
      reps: s.reps ? String(s.reps) : "",
    }));
  }
  return { date, dayId: day.id, sets, note: "" };
}

function fmtSets(ex: Exercise | undefined, sets: { kg: number; reps: number }[]) {
  if (!ex) return sets.map((s) => `${s.kg}×${s.reps}`).join(", ");
  if (ex.unit === "kg") return sets.map((s) => `${fmtKg(s.kg)}×${s.reps}`).join(", ");
  if (ex.unit === "reps") return sets.map((s) => (s.kg ? `${s.reps} (+${fmtKg(s.kg)} kg)` : String(s.reps))).join(", ");
  if (ex.unit === "sek") return sets.map((s) => `${s.reps}s`).join(", ");
  return `${sets.reduce((a, s) => a + s.reps, 0)} runder`;
}

export default function TrainingLog() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("traen");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  // Hent data
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/traening", { cache: "no-store" });
        const body = (await res.json()) as Data & { error?: string };
        if (!res.ok) throw new Error(body.error ?? `Fejl ${res.status}`);
        if (!body.configured) {
          const local = load<{ sessions: Session[]; body: BodyEntry[] }>(STORAGE.local);
          setData({ configured: false, sessions: local?.sessions ?? [], body: local?.body ?? [] });
        } else setData(body);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Kunne ikke hente loggen.");
        const local = load<{ sessions: Session[]; body: BodyEntry[] }>(STORAGE.local);
        setData({ configured: false, sessions: local?.sessions ?? [], body: local?.body ?? [] });
      }
    })();
  }, []);

  // Start-kladde: gemt kladde, ellers dagens program
  useEffect(() => {
    if (!data || draft) return;
    const saved = load<Draft>(STORAGE.draft);
    if (saved && saved.date === today() && dayById(saved.dayId)) setDraft(saved);
    else {
      const d = today();
      setDraft(buildDraft(d, (dayForDate(d) ?? DAYS[0]).id, data.sessions));
    }
  }, [data, draft]);

  useEffect(() => {
    if (draft) save(STORAGE.draft, draft);
  }, [draft]);

  const persistLocal = useCallback((next: Data) => {
    if (!next.configured) save(STORAGE.local, { sessions: next.sessions, body: next.body });
  }, []);

  const showFlash = (msg: string) => {
    setFlash(msg);
    setTimeout(() => setFlash(null), 3000);
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
      exercises: day.exercises
        .map((ex) => ({
          id: ex.id,
          sets: (draft.sets[ex.id] ?? [])
            .map((s) => ({ kg: s.kg ? toNum(s.kg) : 0, reps: toNum(s.reps) }))
            .filter((s) => Number.isFinite(s.kg) && Number.isFinite(s.reps) && s.reps > 0),
        }))
        .filter((e) => e.sets.length),
    };
    if (!session.exercises.length) {
      setError("Udfyld mindst ét sæt med gentagelser.");
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
      const nextDate = today();
      const nextDay = dayForDate(nextDate);
      setDraft(buildDraft(nextDate, nextDay && nextDay.id !== draft.dayId ? nextDay.id : draft.dayId, next.sessions));
      showFlash("Pas gemt 💪");
      setTab("historik");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kunne ikke gemme.");
    } finally {
      setSaving(false);
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
    if (!data) return;
    const clean: BodyEntry = {
      date: entry.date,
      ...(entry.weightKg ? { weightKg: toNum(entry.weightKg) } : {}),
      ...(entry.waistCm ? { waistCm: toNum(entry.waistCm) } : {}),
    };
    if (!clean.weightKg && !clean.waistCm) {
      setError("Skriv vægt og/eller livvidde.");
      return;
    }
    setError(null);
    try {
      const saved: BodyEntry = data.configured ? (await api("POST", { kind: "body", entry: clean })).entry : clean;
      const merged = { ...(data.body.find((b) => b.date === saved.date) ?? {}), ...saved };
      const next = { ...data, body: [...data.body.filter((b) => b.date !== saved.date), merged].sort((a, b) => a.date.localeCompare(b.date)) };
      setData(next);
      persistLocal(next);
      showFlash("Mål gemt");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kunne ikke gemme.");
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

  if (!data || !draft) return <p className="muted">Henter…</p>;

  return (
    <div className="stack">
      <div className="tabs" role="tablist">
        {(
          [
            ["traen", "Træn"],
            ["fremgang", "Fremgang"],
            ["krop", "Krop"],
            ["historik", "Historik"],
          ] as [Tab, string][]
        ).map(([id, label]) => (
          <button key={id} aria-pressed={tab === id} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>

      {!data.configured && <div className="notice">Lageret er ikke koblet på, så loggen gemmes kun i denne browser.</div>}
      {error && <div className="notice error">{error}</div>}
      {flash && <div className="notice good">{flash}</div>}

      {tab === "traen" && (
        <TrainTab
          draft={draft}
          sessions={data.sessions}
          saving={saving}
          onChange={setDraft}
          onPickDay={(dayId) => setDraft(buildDraft(draft.date, dayId, data.sessions))}
          onSave={saveSession}
        />
      )}
      {tab === "fremgang" && <ProgressTab sessions={data.sessions} body={data.body} />}
      {tab === "krop" && <BodyTab body={data.body} onSave={saveBodyEntry} onDelete={removeBody} />}
      {tab === "historik" && <HistoryTab sessions={data.sessions} onDelete={removeSession} />}
    </div>
  );
}

/* ---------- Træn ---------- */

function TrainTab({
  draft,
  sessions,
  saving,
  onChange,
  onPickDay,
  onSave,
}: {
  draft: Draft;
  sessions: Session[];
  saving: boolean;
  onChange: (d: Draft) => void;
  onPickDay: (dayId: string) => void;
  onSave: () => void;
}) {
  const day = dayById(draft.dayId) ?? DAYS[0];
  const planned = dayForDate(draft.date);

  const setRow = (exId: string, i: number, patch: Partial<SetDraft>) => {
    const rows = [...(draft.sets[exId] ?? [])];
    rows[i] = { ...rows[i], ...patch };
    onChange({ ...draft, sets: { ...draft.sets, [exId]: rows } });
  };
  const addRow = (exId: string) => {
    const rows = draft.sets[exId] ?? [];
    const lastRow = rows[rows.length - 1] ?? { kg: "", reps: "" };
    onChange({ ...draft, sets: { ...draft.sets, [exId]: [...rows, { ...lastRow }] } });
  };
  const removeRow = (exId: string, i: number) => {
    const rows = (draft.sets[exId] ?? []).filter((_, j) => j !== i);
    onChange({ ...draft, sets: { ...draft.sets, [exId]: rows } });
  };

  return (
    <>
      <div className="card controls">
        <label className="field">
          Dato
          <input type="date" value={draft.date} max={today()} onChange={(e) => e.target.value && onChange({ ...draft, date: e.target.value })} />
        </label>
        <label className="field" style={{ flex: 1, minWidth: 180 }}>
          Pas
          <select value={draft.dayId} onChange={(e) => onPickDay(e.target.value)}>
            {DAYS.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
                {planned?.id === d.id ? " (dagens)" : ""}
              </option>
            ))}
          </select>
        </label>
        {!planned && <p className="small" style={{ width: "100%", margin: 0 }}>Søndag er hviledag i programmet, men du kan sagtens logge alligevel.</p>}
      </div>

      {day.exercises.map((ex) => {
        const last = lastLog(sessions, ex.id, draft.date);
        const tip = suggest(ex, last?.log ?? null);
        const rows = draft.sets[ex.id] ?? [];
        const showKg = ex.unit === "kg" || ex.unit === "reps";
        return (
          <div key={ex.id} className="card exercise">
            <div className="exercise-head">
              <strong>{ex.name}</strong>
              <span className="small">
                {ex.unit === "runder" ? `${ex.target[0]}–${ex.target[1]} runder` : `${ex.sets} × ${ex.target[0]}–${ex.target[1]} ${UNIT_LABEL[ex.unit]}`}
              </span>
            </div>
            {last && (
              <p className="small last">
                Sidst ({fmtDate(last.date)}): {fmtSets(ex, last.log.sets)}
              </p>
            )}
            <p className="hint">{tip.hint}</p>
            {ex.tip && <p className="small">{ex.tip}</p>}

            <div className="sets">
              <div className="set-row set-head small">
                <span>Sæt</span>
                {showKg ? <span>{ex.unit === "kg" ? "kg" : "+kg"}</span> : <span />}
                <span>{UNIT_LABEL[ex.unit]}</span>
                <span />
              </div>
              {rows.map((r, i) => (
                <div key={i} className="set-row">
                  <span className="set-no">{i + 1}</span>
                  {showKg ? (
                    <input
                      inputMode="decimal"
                      placeholder={ex.unit === "kg" ? "kg" : "0"}
                      value={r.kg}
                      onChange={(e) => setRow(ex.id, i, { kg: e.target.value })}
                      aria-label={`Sæt ${i + 1} kg`}
                    />
                  ) : (
                    <span />
                  )}
                  <input
                    inputMode="numeric"
                    placeholder="0"
                    value={r.reps}
                    onChange={(e) => setRow(ex.id, i, { reps: e.target.value })}
                    aria-label={`Sæt ${i + 1} ${UNIT_LABEL[ex.unit]}`}
                  />
                  <button className="icon secondary" onClick={() => removeRow(ex.id, i)} aria-label={`Fjern sæt ${i + 1}`}>
                    ×
                  </button>
                </div>
              ))}
              <button className="secondary small-btn" onClick={() => addRow(ex.id)}>
                + sæt
              </button>
            </div>
          </div>
        );
      })}

      <div className="card">
        <label className="field">
          Note (valgfri)
          <textarea rows={2} value={draft.note} onChange={(e) => onChange({ ...draft, note: e.target.value })} placeholder="Fx ondt i skulderen, god energi…" />
        </label>
      </div>

      <button className="save-btn" onClick={onSave} disabled={saving}>
        {saving ? "Gemmer…" : "Gem træning"}
      </button>
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
  const last4 = perWeek.filter((w) => w.week < week).slice(0, 4);
  const avg = last4.length ? last4.reduce((a, w) => a + w.count, 0) / last4.length : null;
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
          <div className="value">{thisWeek} / 6</div>
          <div className="label">Pas denne uge</div>
        </div>
        <div className="card kpi">
          <div className="value">{avg === null ? "–" : avg.toLocaleString("da-DK", { maximumFractionDigits: 1 })}</div>
          <div className="label">Pas pr. uge (sidste 4 uger)</div>
        </div>
        <div className="card kpi">
          <div className="value">{dW === null ? "–" : signed(dW, "kg")}</div>
          <div className="label">Vægt siden start</div>
        </div>
        <div className="card kpi">
          <div className="value">{dWaist === null ? "–" : signed(dWaist, "cm")}</div>
          <div className="label">Livvidde siden start</div>
        </div>
      </div>

      <div className="card">
        <h2>Styrke pr. øvelse</h2>
        {used.length === 0 ? (
          <p className="small">Gem dit første pas, så kommer fremgangen her.</p>
        ) : (
          <>
            <div className="controls" style={{ marginBottom: "0.75rem" }}>
              <select value={ex?.id} onChange={(e) => setExId(e.target.value)} style={{ flex: 1 }}>
                {used.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
            </div>
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
                <LineChart points={series} unit={ex.unit === "kg" ? "kg" : UNIT_LABEL[ex.unit]} />
              </>
            )}
          </>
        )}
      </div>
    </>
  );
}

/* ---------- Krop ---------- */

function BodyTab({
  body,
  onSave,
  onDelete,
}: {
  body: BodyEntry[];
  onSave: (e: { date: string; weightKg: string; waistCm: string }) => void;
  onDelete: (date: string) => void;
}) {
  const [form, setForm] = useState({ date: today(), weightKg: "", waistCm: "" });
  const weights = body.filter((b) => b.weightKg).map((b) => ({ date: b.date, value: b.weightKg! }));
  const waists = body.filter((b) => b.waistCm).map((b) => ({ date: b.date, value: b.waistCm! }));

  return (
    <>
      <div className="card">
        <h2>Nye mål</h2>
        <p className="small" style={{ marginTop: 0 }}>
          Vej dig om morgenen før morgenmad, og mål livvidden i navlehøjde. Én gang om ugen er nok, fordi vægten svinger fra dag til dag.
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
            Livvidde (cm)
            <input inputMode="decimal" className="short" value={form.waistCm} onChange={(e) => setForm({ ...form, waistCm: e.target.value })} placeholder="100" />
          </label>
          <button
            onClick={() => {
              onSave(form);
              setForm({ ...form, weightKg: "", waistCm: "" });
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
        <h2>Livvidde</h2>
        <LineChart points={waists} unit="cm" color="var(--series-2)" />
      </div>

      {body.length > 0 && (
        <div className="card table-wrap">
          <table>
            <thead>
              <tr>
                <th>Dato</th>
                <th>Vægt</th>
                <th>Livvidde</th>
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

/* ---------- Historik ---------- */

function HistoryTab({ sessions, onDelete }: { sessions: Session[]; onDelete: (id: string) => void }) {
  if (!sessions.length) return <p className="muted">Ingen pas endnu. Gå til “Træn” og log dit første.</p>;
  const sorted = [...sessions].sort((a, b) => b.date.localeCompare(a.date) || (b.savedAt ?? "").localeCompare(a.savedAt ?? ""));
  return (
    <>
      {sorted.map((s) => {
        const vol = volume(s, (id) => exerciseById(id)?.unit);
        return (
          <details key={s.id} className="card">
            <summary>
              {fmtDate(s.date)} · {dayById(s.dayId)?.name ?? s.dayId}
              <span className="small" style={{ fontWeight: 400 }}>
                {" "}
                · {s.exercises.length} øvelser{vol ? ` · ${vol.toLocaleString("da-DK")} kg løftet` : ""}
              </span>
            </summary>
            <ul className="history-list">
              {s.exercises.map((e) => (
                <li key={e.id}>
                  <strong>{exerciseById(e.id)?.name ?? e.id}:</strong> {fmtSets(exerciseById(e.id), e.sets)}
                </li>
              ))}
            </ul>
            {s.note && <p className="small">{s.note}</p>}
            <ConfirmDelete label="Slet pas" onConfirm={() => onDelete(s.id)} />
          </details>
        );
      })}
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
      {armed ? "Sikker?" : label}
    </button>
  );
}
