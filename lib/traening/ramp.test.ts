import { test } from "node:test";
import assert from "node:assert/strict";
import { rampEnabled, rampFor, rampSets } from "./ramp";
import { exerciseById } from "./program";

const s = (date: string) => ({ date });

test("standard: opstart for ny og lidt erfaren, ikke for øvet", () => {
  assert.equal(rampEnabled(null), true);
  assert.equal(rampEnabled({ level: "ny" }), true);
  assert.equal(rampEnabled({ level: "lidt" }), true);
  assert.equal(rampEnabled({ level: "oevet" }), false);
  assert.equal(rampEnabled({ level: "ny", ramp: false }), false);
  assert.equal(rampEnabled({ level: "oevet", ramp: true }), true);
});

test("ny: 3 uger regnet fra første træning", () => {
  const p = { level: "ny" as const };
  assert.equal(rampFor(p, [], "2026-11-25")?.week, 1);
  const hist = [s("2026-11-23"), s("2026-11-25")];
  assert.deepEqual(rampFor(p, hist, "2026-11-29") && { w: rampFor(p, hist, "2026-11-29")!.week, sets: rampFor(p, hist, "2026-11-29")!.sets }, { w: 1, sets: 2 });
  assert.equal(rampFor(p, hist, "2026-11-30")?.week, 2);
  assert.equal(rampFor(p, hist, "2026-12-07")?.week, 3);
  assert.equal(rampFor(p, hist, "2026-12-14"), null);
});

test("lidt erfaren: 2 uger; øvet: ingen, men kan vælges til", () => {
  const hist = [s("2026-11-23")];
  assert.equal(rampFor({ level: "lidt" }, hist, "2026-12-06")?.weeks, 2);
  assert.equal(rampFor({ level: "lidt" }, hist, "2026-12-07"), null);
  assert.equal(rampFor({ level: "oevet" }, hist, "2026-11-24"), null);
  assert.equal(rampFor({ level: "oevet", ramp: true }, hist, "2026-11-24")?.weeks, 2);
  assert.equal(rampFor({ level: "ny", ramp: false }, hist, "2026-11-24"), null);
});

test("antal sæt under opstart", () => {
  const roning = exerciseById("roning")!; // 4 sæt
  const planke = exerciseById("planke")!; // 3 sæt
  const p = { level: "ny" as const };
  const w1 = rampFor(p, [], "2026-11-24");
  const w3 = rampFor(p, [s("2026-11-01")], "2026-11-16");
  assert.equal(roning.sets, 4);
  assert.equal(rampSets(roning, w1), 2);
  assert.equal(rampSets(roning, w3), 3);
  assert.equal(rampSets(planke, w3), Math.max(2, planke.sets - 1));
  assert.equal(rampSets(roning, null), 4);
  assert.equal(rampSets(exerciseById("gaatur")!, w1), 1);
  assert.equal(rampSets(exerciseById("intervaller")!, w1), exerciseById("intervaller")!.sets);
});
