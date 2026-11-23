import { test } from "node:test";
import assert from "node:assert/strict";
import { addPoint, cardioCalories, cardioMet, currentKmh, elapsedSec, emptyTrack, fmtPace, haversine, type GeoPoint } from "./cardio";
import { estimateCalories, sessionCalories } from "./calories";
import { exerciseById, dayById, withActivity, isCardioDay } from "./program";
import { suggest } from "./logic";

test("MET følger Compendium-punkterne og stiger med farten", () => {
  assert.equal(cardioMet("gaatur", 5.0), 3.8);
  assert.equal(cardioMet("gaatur", 6.0), 4.8);
  assert.ok(Math.abs(cardioMet("gaatur", 5.5) - 4.3) < 1e-9);
  assert.equal(cardioMet("loebetur", 9.9), 9.3);
  assert.ok(cardioMet("loebetur", 11) > 9.3 && cardioMet("loebetur", 11) < 11.8);
  // "Løb" i gangfart regnes som gang
  assert.equal(cardioMet("loebetur", 5.0), 3.8);
  assert.equal(cardioMet("gaatur", 1), 2.3);
});

test("gåtur: 85 kg, 5 km på 50 min (6 km/t) ≈ 340 kcal", () => {
  const c = cardioCalories("gaatur", 5, 3000, 85);
  assert.ok(Math.abs(c.kmh - 6) < 1e-9);
  const mid = (c.low + c.high) / 2;
  assert.ok(Math.abs(mid - 4.8 * 85 * (50 / 60)) < 1e-6);
});

test("samme distance hurtigere = flere kcal i alt for løb end gang", () => {
  const walk = cardioCalories("gaatur", 5, 3600, 85);
  const run = cardioCalories("loebetur", 5, 1800, 85);
  assert.ok(run.high > walk.high);
});

test("kalorier i pas med gåtur bruger farten; ingen pause eller opvarmning lægges til", () => {
  const ex = exerciseById("gaatur")!;
  const r = estimateCalories({ bodyKg: 85, exercises: [{ ex, sets: [{ reps: 5, sec: 3000 }] }], restSec: 0, warmupSec: 0 });
  assert.equal(r.low, Math.round((4.8 * 0.9 * 85 * 50) / 60 / 10) * 10);
  const s = sessionCalories(
    {
      id: "a",
      date: "2026-11-24",
      dayId: "interval",
      exercises: [{ id: "gaatur", sets: [{ kg: 0, reps: 5, sec: 3000 }] }],
      time: { startedAt: "2026-11-24T10:00:00Z", endedAt: "2026-11-24T11:00:00Z", totalSec: 3600, activeSec: 3300, restSec: 300, idleSec: 0 },
    },
    85,
  );
  assert.deepEqual([s.low, s.high], [r.low, r.high]);
});

test("konditionspas kan tages som gåtur eller løbetur", () => {
  const d = dayById("interval")!;
  assert.ok(isCardioDay(d));
  assert.equal(withActivity(d, "gaatur").exercises[0].id, "gaatur");
  assert.equal(withActivity(d, "noget-andet").exercises[0].id, "intervaller");
  const strength = dayById("overkrop-a")!;
  assert.equal(withActivity(strength, "gaatur"), strength);
});

test("forslag til tur", () => {
  const ex = exerciseById("gaatur")!;
  assert.match(suggest(ex, null).hint, /Første gang/);
  assert.match(suggest(ex, { id: "gaatur", sets: [{ kg: 0, reps: 4.2, sec: 2520 }] }).hint, /4,2 km med 6,0 km\/t/);
});

test("haversine: 0,001° breddegrad ≈ 111 m", () => {
  assert.ok(Math.abs(haversine({ lat: 55.77, lon: 9.7 }, { lat: 55.771, lon: 9.7 }) - 111.2) < 0.5);
});

const walkPoints = (n: number, stepM: number, stepSec: number, acc = 8): GeoPoint[] =>
  Array.from({ length: n }, (_, i) => ({ lat: 55.77 + (i * stepM) / 111_195, lon: 9.7, acc, t: i * stepSec * 1000 }));

test("GPS-spor: 100 punkter à 10 m giver ca. 990 m og 6 km/t", () => {
  let t = emptyTrack();
  for (const p of walkPoints(100, 10, 6)) t = addPoint(t, p, "gaatur");
  assert.ok(Math.abs(t.meters - 990) < 2);
  assert.ok(Math.abs(currentKmh(t, 99 * 6000) - 6) < 0.1);
});

test("GPS-støj: stå stille og unøjagtige punkter tæller ikke; urealistiske spring afvises", () => {
  let t = emptyTrack();
  for (let i = 0; i < 60; i++) t = addPoint(t, { lat: 55.77 + (i % 2 ? 2 : -2) / 111_195, lon: 9.7, acc: 10, t: i * 1000 }, "gaatur");
  assert.equal(t.meters, 0);
  t = addPoint(t, { lat: 55.78, lon: 9.7, acc: 80, t: 61_000 }, "gaatur");
  assert.equal(t.meters, 0);
  t = addPoint(t, { lat: 55.78, lon: 9.7, acc: 5, t: 62_000 }, "gaatur"); // 1,1 km på 2 sek
  assert.equal(t.meters, 0);
});

test("små skridt lægges sammen, så langsom gang stadig tæller", () => {
  let t = emptyTrack();
  for (const p of walkPoints(31, 2, 2)) t = addPoint(t, p, "gaatur"); // 2 m pr. punkt
  assert.ok(t.meters >= 54 && t.meters <= 60, String(t.meters));
});

test("ur med pause og tempo", () => {
  assert.equal(elapsedSec({ startedAt: 0, pausedMs: 60_000 }, 600_000), 540);
  assert.equal(elapsedSec({ startedAt: 0, pausedMs: 0, pausedAt: 500_000 }, 600_000), 500);
  assert.equal(fmtPace(5, 1800), "6:00");
  assert.equal(fmtPace(0, 100), "–");
});
