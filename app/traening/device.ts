"use client";

import { useCallback, useEffect, useRef } from "react";

/**
 * Bip via Web Audio. `init()` skal kaldes fra et tryk (iOS kræver det),
 * derefter kan `beep()` bruges når som helst.
 */
export function useBeeper() {
  const ctx = useRef<AudioContext | null>(null);

  const init = useCallback(() => {
    try {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (Ctx && !ctx.current) ctx.current = new Ctx();
      ctx.current?.resume().catch(() => {});
    } catch {
      ctx.current = null;
    }
  }, []);

  const beep = useCallback((freq: number, ms: number, volume = 0.4) => {
    try {
      const c = ctx.current;
      if (!c) return;
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.frequency.value = freq;
      osc.connect(gain);
      gain.connect(c.destination);
      const t = c.currentTime;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(volume, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + ms / 1000);
      osc.start(t);
      osc.stop(t + ms / 1000 + 0.02);
    } catch {
      /* ingen lyd — fint */
    }
  }, []);

  useEffect(
    () => () => {
      ctx.current?.close().catch(() => {});
    },
    [],
  );

  return { init, beep };
}

/** Hold skærmen tændt, mens `active` er sand. */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } };
    let lock: { release: () => Promise<void> } | null = null;
    const request = async () => {
      try {
        if (nav.wakeLock && document.visibilityState === "visible") lock = await nav.wakeLock.request("screen");
      } catch {
        lock = null;
      }
    };
    request();
    document.addEventListener("visibilitychange", request);
    return () => {
      document.removeEventListener("visibilitychange", request);
      lock?.release().catch(() => {});
    };
  }, [active]);
}
