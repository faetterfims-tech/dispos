"use client";

import { useState } from "react";
import type { PeriodResult } from "@/lib/solar/types";
import { fmtKr, fmtMonth } from "./format";

const W = 640;
const H = 240;
const PAD = { top: 12, right: 8, bottom: 26, left: 52 };

function niceStep(range: number): number {
  const raw = range / 4;
  const mag = 10 ** Math.floor(Math.log10(raw || 1));
  const n = raw / mag;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * mag;
}

/** Stablede søjler pr. måned: besparelse fra sol og fra batteri. Negative værdier vises under nul. */
export default function SavingsChart({ months }: { months: PeriodResult[] }) {
  const [hover, setHover] = useState<number | null>(null);
  if (months.length === 0) return null;

  const tops = months.map((m) => Math.max(0, m.solarSaving) + Math.max(0, m.batterySaving));
  const bottoms = months.map((m) => Math.min(0, m.solarSaving) + Math.min(0, m.batterySaving));
  const step = niceStep(Math.max(...tops, 1) - Math.min(...bottoms, 0));
  const yMax = Math.ceil(Math.max(...tops, 1) / step) * step;
  const yMin = Math.floor(Math.min(...bottoms, 0) / step) * step;

  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const y = (v: number) => PAD.top + ((yMax - v) / (yMax - yMin)) * innerH;
  const slot = innerW / months.length;
  const barW = Math.max(4, Math.min(36, slot * 0.6));

  const ticks: number[] = [];
  for (let v = yMin; v <= yMax + 1e-9; v += step) ticks.push(v);

  const seg = (base: number, val: number) => {
    const a = y(base);
    const b = y(base + val);
    return { yTop: Math.min(a, b), h: Math.max(0, Math.abs(a - b) - (val !== 0 ? 1 : 0)) };
  };

  const labelEvery = Math.ceil(months.length / 12);
  const hm = hover != null ? months[hover] : null;

  return (
    <div className="chart">
      <div className="legend">
        <span>
          <i style={{ background: "var(--series-1)" }} />
          Sol
        </span>
        <span>
          <i style={{ background: "var(--series-2)" }} />
          Batteri
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Besparelse pr. måned fordelt på sol og batteri">
        <g className="grid">
          {ticks.map((t) => (
            <line key={t} x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} strokeWidth={t === 0 ? 1.5 : 1} />
          ))}
        </g>
        <g className="axis">
          {ticks.map((t) => (
            <text key={t} x={PAD.left - 6} y={y(t) + 4} textAnchor="end">
              {Math.round(t).toLocaleString("da-DK")}
            </text>
          ))}
          {months.map((m, i) =>
            i % labelEvery === 0 ? (
              <text key={m.key} x={PAD.left + slot * i + slot / 2} y={H - 8} textAnchor="middle">
                {fmtMonth(m.key)}
              </text>
            ) : null,
          )}
        </g>
        {months.map((m, i) => {
          const x = PAD.left + slot * i + (slot - barW) / 2;
          // Positive stables opad fra nul, negative nedad.
          let pos = 0;
          let neg = 0;
          const parts = [
            { v: m.solarSaving, color: "var(--series-1)" },
            { v: m.batterySaving, color: "var(--series-2)" },
          ].map((p) => {
            const base = p.v >= 0 ? pos : neg;
            if (p.v >= 0) pos += p.v;
            else neg += p.v;
            return { ...p, ...seg(base, p.v) };
          });
          return (
            <g key={m.key} opacity={hover == null || hover === i ? 1 : 0.45}>
              {parts.map((p, j) =>
                p.h > 0 ? <rect key={j} x={x} y={p.yTop} width={barW} height={p.h} rx={3} fill={p.color} /> : null,
              )}
              <rect
                x={PAD.left + slot * i}
                y={PAD.top}
                width={slot}
                height={innerH}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                onClick={() => setHover(hover === i ? null : i)}
              />
            </g>
          );
        })}
      </svg>
      {hm && hover != null && (
        <div
          className="tooltip"
          style={{
            left: `${((PAD.left + slot * hover + slot / 2) / W) * 100}%`,
            top: `${(y(tops[hover]) / H) * 100}%`,
          }}
        >
          <strong>{fmtMonth(hm.key)}</strong>
          <br />
          Sol: {fmtKr(hm.solarSaving)}
          <br />
          Batteri: {fmtKr(hm.batterySaving)}
          <br />
          I alt: {fmtKr(hm.totalSaving)}
        </div>
      )}
    </div>
  );
}
