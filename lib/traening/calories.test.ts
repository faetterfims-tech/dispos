import { test } from "node:test";
import assert from "node:assert/strict";
import { estimateCalories, kindOf, sessionCalories } from "./calories";

test("type pr. pas", () => {
  assert.equal(kindOf("overkrop-a"), "vaegte");
  assert.equal(kindOf("krop-a"), "kropsvaegt");
  assert.equal(kindOf("interval"), "kondition");
});

test("styrketræning: 85 kg, 50 min → ca. 250–350 kcal", () => {
  const r = estimateCalories({ kind: "vaegte", bodyKg: 85, totalSec: 50 * 60, activeSec: 10 * 60 });
  assert.deepEqual([r.low, r.high], [250, 350]);
  assert.equal(r.guessedWeight, false);
});

test("tæt træning løfter den øvre grænse", () => {
  const loose = estimateCalories({ kind: "vaegte", bodyKg: 85, totalSec: 3000, activeSec: 300 });
  const dense = estimateCalories({ kind: "vaegte", bodyKg: 85, totalSec: 3000, activeSec: 1500 });
  assert.ok(dense.high > loose.high);
  assert.equal(dense.low, loose.low);
});

test("intervaller: 12 runder + 10 min op/nedvarmning", () => {
  const r = estimateCalories({ kind: "kondition", bodyKg: 85, totalSec: 22 * 60, rounds: 12 });
  assert.ok(r.low >= 120 && r.high <= 260, `${r.low}-${r.high}`);
});

test("pas uden ur bliver skønnet ud fra sæt", () => {
  const s = { id: "x", date: "2026-11-23", dayId: "overkrop-a", exercises: [{ id: "roning", sets: [{ kg: 8, reps: 10 }, { kg: 8, reps: 10 }, { kg: 8, reps: 10 }] }] };
  const r = sessionCalories(s, 85);
  assert.ok(r.low > 0 && r.high >= r.low);
  assert.ok(sessionCalories(s).guessedWeight);
});
