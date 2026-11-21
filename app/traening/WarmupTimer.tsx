"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { WARMUP_PLANS, buildSteps, totalSeconds, type StepKind } from "@/lib/traening/warmup";

const COLORS: Record<StepKind, string> = { hold: "#b7791f", skift: "#5b5953", klar: "#2a6fd6" };

const fmtClock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

/**
 * Guidet nedtælling til rygopvarmningen. Fuld skærm, bip ved skift og de
 * sidste 3 sekunder, og skærmen holdes tændt, mens den kører.
 */
export default function WarmupTimer({ only, onItemDone, onClose }: { only?: number; onItemDone: (item: number) => void; onClose: () => void }) {
  const steps = useMemo(() => buildSteps(undefined, only), [only]);
  const heading = only === undefined ? "Opvarmning af ryggen" : WARMUP_PLANS[only].name;
  const [idx, setIdx] = useState(0);
  const [remaining, setRemaining] = useState(steps[0].seconds);
  const [paused, setPaused] = useState(false);
  const [done, setDone] = useState(false);

  const endAt = useRef(Date.now() + steps[0].seconds * 1000);
  const lastBeep = useRef<number | null>(null);
  const audio = useRef<AudioContext | null>(null);
  const wake = useRef<{ release: () => Promise<void> } | null>(null);
  const finished = useRef(false);

  const beep = useCallback((freq: number, ms: number) => {
    try {
      const ctx = audio.current;
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq;
      osc.connect(gain);
      gain.connect(ctx.destination);
      const t = ctx.currentTime;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.4, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + ms / 1000);
      osc.start(t);
      osc.stop(t + ms / 1000 + 0.02);
    } catch {
      /* ingen lyd — fint */
    }
  }, []);

  // Lyd skal startes fra et tryk (iOS). Komponenten åbnes af et tryk, så det sker her.
  useEffect(() => {
    try {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (Ctx) audio.current = new Ctx();
    } catch {
      audio.current = null;
    }
    beep(880, 250);
    return () => {
      audio.current?.close().catch(() => {});
    };
  }, [beep]);

  // Hold skærmen tændt
  useEffect(() => {
    const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } };
    const request = async () => {
      try {
        if (nav.wakeLock && document.visibilityState === "visible") wake.current = await nav.wakeLock.request("screen");
      } catch {
        wake.current = null;
      }
    };
    request();
    document.addEventListener("visibilitychange", request);
    return () => {
      document.removeEventListener("visibilitychange", request);
      wake.current?.release().catch(() => {});
    };
  }, []);

  const goTo = useCallback(
    (next: number) => {
      if (finished.current) return;
      const cur = steps[idx];
      // Øvelse færdig, når vi forlader dens sidste trin
      if (cur && (next >= steps.length || steps[next].item !== cur.item) && cur.kind === "hold") onItemDone(cur.item);
      if (next >= steps.length) {
        if (finished.current) return;
        finished.current = true;
        setDone(true);
        beep(660, 200);
        setTimeout(() => beep(880, 400), 220);
        return;
      }
      setIdx(next);
      endAt.current = Date.now() + steps[next].seconds * 1000;
      setRemaining(steps[next].seconds);
      lastBeep.current = null;
      beep(steps[next].kind === "hold" ? 880 : 520, steps[next].kind === "hold" ? 350 : 200);
    },
    [idx, steps, onItemDone, beep],
  );

  // Nedtælling ud fra uret, så den ikke glider
  useEffect(() => {
    if (paused || done) return;
    const t = setInterval(() => {
      const left = Math.max(0, Math.ceil((endAt.current - Date.now()) / 1000));
      setRemaining(left);
      if (left > 0 && left <= 3 && lastBeep.current !== left) {
        lastBeep.current = left;
        beep(660, 120);
      }
      if (left === 0) goTo(idx + 1);
    }, 200);
    return () => clearInterval(t);
  }, [paused, done, idx, goTo, beep]);

  const togglePause = () => {
    if (paused) {
      endAt.current = Date.now() + remaining * 1000;
      audio.current?.resume().catch(() => {});
    }
    setPaused(!paused);
  };

  const step = steps[idx];
  const next = steps[idx + 1];
  const left = remaining + steps.slice(idx + 1).reduce((s, x) => s + x.seconds, 0);
  const total = totalSeconds(steps);

  if (done) {
    return (
      <div className="tr-timer" style={{ "--c": "#1f8a5b" } as CSSProperties} role="dialog" aria-label="Opvarmning færdig">
        <div className="tr-timer-mid">
          <div className="tr-timer-big" style={{ fontSize: "5rem" }}>
            💪
          </div>
          <div className="tr-timer-title">{only === undefined ? "Opvarmningen er færdig" : `${heading} er færdig`}</div>
          <div className="tr-timer-sub">{only === undefined ? "Nu er ryggen klar. Gå videre til første øvelse." : "Godt klaret. Tag den næste, når du er klar."}</div>
        </div>
        <div className="tr-timer-buttons">
          <button className="tr-timer-main" onClick={onClose}>
            {only === undefined ? "Videre til øvelserne" : "Tilbage"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="tr-timer" style={{ "--c": COLORS[step.kind] } as CSSProperties} role="dialog" aria-label="Opvarmnings-timer">
      <div className="tr-timer-top">
        <span>
          {heading} · {fmtClock(left)} tilbage
        </span>
        <button className="tr-timer-x" onClick={onClose} aria-label="Stop timeren">
          ✕
        </button>
      </div>
      <div className="tr-timer-total">
        <div style={{ width: `${((total - left) / total) * 100}%` }} />
      </div>

      <div className="tr-timer-mid">
        <div className="tr-timer-sub">{step.sub}</div>
        <div className="tr-timer-big" aria-live="polite">
          {remaining}
        </div>
        <div className="tr-timer-title">{step.title}</div>
        {step.kind === "hold" && <div className="tr-timer-sub">Hold stille, træk vejret roligt</div>}
        {paused && <div className="tr-timer-paused">Pause</div>}
      </div>

      {next && (
        <div className="tr-timer-next">
          Næste: <b>{next.title}</b>
        </div>
      )}

      <div className="tr-timer-buttons">
        <button className="tr-timer-main" onClick={togglePause}>
          {paused ? "▶ Fortsæt" : "⏸ Pause"}
        </button>
        <button className="tr-timer-skip" onClick={() => goTo(idx + 1)}>
          Næste ⏭
        </button>
      </div>
    </div>
  );
}
