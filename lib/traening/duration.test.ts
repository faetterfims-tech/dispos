import { test } from "node:test";
import assert from "node:assert/strict";
import { estimateSec, fmtEstimate } from "./duration";
import { DAYS, exerciseById, resolveDay } from "./program";
import { buildSteps, totalSeconds } from "./warmup";

const owned = ["haandvaegte", "stang", "stol"] as const;
const full = (id: string) => resolveDay(DAYS.find((d) => d.id === id)!, [...owned]).exercises.map((ex) => ({ ex, sets: ex.sets }));

test("fuldt styrkepas med opvarmning ligger omkring 45–55 min", () => {
  const warm = totalSeconds(buildSteps());
  for (const id of ["overkrop-a", "underkrop", "overkrop-b", "fuldkrop"]) {
    const min = estimateSec(full(id), warm) / 60;
    assert.ok(min > 30 && min < 65, `${id}: ${min.toFixed(1)} min`);
  }
});

test("færre sæt (opstart) giver kortere tid", () => {
  const items = full("overkrop-a");
  const half = items.map((i) => ({ ...i, sets: Math.min(2, i.sets) }));
  assert.ok(estimateSec(half) < estimateSec(items) * 0.65);
});

test("intervaller: 5 min opvarmning + 1 min pr. runde", () => {
  assert.equal(estimateSec([{ ex: exerciseById("intervaller")!, sets: 1, reps: 10 }]), 15 * 60);
  assert.equal(fmtEstimate(15 * 60), "ca. 15–20 min");
  assert.equal(fmtEstimate(50 * 60), "ca. 45–55 min");
});
