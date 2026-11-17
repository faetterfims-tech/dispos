"use client";

import { useState } from "react";

interface Point {
  date: string;
  value: number;
}

const W = 600;
const H = 200;
const PAD = { l: 40, r: 12, t: 12, b: 24 };

const fmtShort = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("da-DK", { day: "numeric", month: "short" });
const fmtNum = (n: number) => n.toLocaleString("da-DK", { maximumFractionDigits: 1 });

/** Simpel linjegraf over tid. Tidsaksen er ægte dage, så pauser kan ses. */
export default function LineChart({ points, unit, color = "var(--series-1)" }: { points: Point[]; unit: string; color?: string }) {
  const [hover, setHover] = useState<number | null>(null);
  if (points.length === 0) return <p className="small">Ingen data endnu.</p>;

  const t = points.map((p) => new Date(`${p.date}T12:00:00Z`).getTime());
  const t0 = t[0];
  const t1 = Math.max(t[t.length - 1], t0 + 86_400_000);
  const vals = points.map((p) => p.value);
  let lo = Math.min(...vals);
  let hi = Math.max(...vals);
  const pad = Math.max((hi - lo) * 0.15, hi * 0.03, 1);
  lo = Math.max(0, lo - pad);
  hi = hi + pad;

  const x = (ms: number) => PAD.l + ((ms - t0) / (t1 - t0)) * (W - PAD.l - PAD.r);
  const y = (v: number) => PAD.t + (1 - (v - lo) / (hi - lo)) * (H - PAD.t - PAD.b);
  const path = points.map((p, i) => `${i ? "L" : "M"}${x(t[i]).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
  const ticks = [lo, (lo + hi) / 2, hi];
  const h = hover !== null ? points[hover] : null;

  return (
    <div className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Udvikling i ${unit}`} onMouseLeave={() => setHover(null)}>
        <g className="grid">
          {ticks.map((v) => (
            <line key={v} x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} />
          ))}
        </g>
        <g className="axis">
          {ticks.map((v) => (
            <text key={v} x={PAD.l - 6} y={y(v) + 4} textAnchor="end">
              {fmtNum(v)}
            </text>
          ))}
          <text x={PAD.l} y={H - 4}>
            {fmtShort(points[0].date)}
          </text>
          {points.length > 1 && (
            <text x={W - PAD.r} y={H - 4} textAnchor="end">
              {fmtShort(points[points.length - 1].date)}
            </text>
          )}
        </g>
        <path d={path} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) => (
          <g key={p.date} onMouseEnter={() => setHover(i)} onClick={() => setHover(i)} style={{ cursor: "pointer" }}>
            <circle cx={x(t[i])} cy={y(p.value)} r={14} fill="transparent" />
            <circle cx={x(t[i])} cy={y(p.value)} r={hover === i ? 5 : 3.5} fill={color} stroke="var(--surface)" strokeWidth={1.5} />
          </g>
        ))}
      </svg>
      {h && hover !== null && (
        <div className="tooltip" style={{ left: `${(x(t[hover]) / W) * 100}%`, top: `${(y(h.value) / H) * 100}%` }}>
          <strong>{fmtNum(h.value)}</strong> {unit}
          <br />
          <span className="small">{fmtShort(h.date)}</span>
        </div>
      )}
    </div>
  );
}
