import { test } from "node:test";
import assert from "node:assert/strict";
import { exerciseById } from "./program";
import { afterTest, roundKg, startWeight, weightForReps } from "./loads";
import { suggest } from "./logic";

const ex = (id: string) => exerciseById(id)!;

test("afrunding til håndvægte", () => {
  assert.equal(roundKg(0.4), 1);
  assert.equal(roundKg(2.6), 3);
  assert.equal(roundKg(7.9), 6);
  assert.equal(roundKg(12.7), 12);
});

test("startgæt: fornuftige tal for Daniel (85 kg, ny, mand)", () => {
  const ctx = { bodyKg: 85, profile: { level: "ny" as const, sex: "mand" as const } };
  assert.equal(startWeight(ex("goblet"), ctx), 12);
  assert.equal(startWeight(ex("roning"), ctx), 10);
  assert.equal(startWeight(ex("skulderpres"), ctx), 6);
  assert.equal(startWeight(ex("sideloeft"), ctx), 2);
});

test("startgæt: lettere for kvinde og nybegynder end for øvet mand", () => {
  const w = startWeight(ex("skulderpres"), { bodyKg: 65, profile: { level: "ny", sex: "kvinde" } });
  const m = startWeight(ex("skulderpres"), { bodyKg: 90, profile: { level: "oevet", sex: "mand" } });
  assert.ok(w < m);
  assert.ok(w >= 1 && w <= 4, `kvinde ${w}`);
});

test("vægt ud fra antal (Epley)", () => {
  // 10 kg × 20 → ca. 16,7 e1rm → til 10 gange ca. 12,5 → 12
  assert.equal(weightForReps(10, 20, 10), 12);
  // 10 kg × 4 → til 10 gange: 8
  assert.equal(weightForReps(10, 4, 10), 8);
  assert.equal(weightForReps(0, 10, 10), 0);
});

test("testsæt: beholder vægten inden for målet, ellers justeres", () => {
  assert.equal(afterTest(ex("roning"), 10, 11).kg, 10);
  assert.equal(afterTest(ex("roning"), 10, 20).kg, 12);
  assert.equal(afterTest(ex("roning"), 10, 4).kg, 8);
  assert.equal(afterTest(ex("armstraek"), 0, 15).reps, 12);
  assert.equal(afterTest(ex("planke"), 0, 47).reps, 40);
});

test("første gang: testsæt med startgæt", () => {
  const s = suggest(ex("goblet"), null, { bodyKg: 85, profile: { level: "ny", sex: "mand" } });
  assert.ok(s.test);
  assert.equal(s.sets[0].kg, 12);
  assert.equal(s.sets[0].reps, 0);
  assert.equal(s.sets[1].reps, 10);
  assert.ok(!/Skriv din vægt/.test(s.hint));
  assert.match(suggest(ex("goblet"), null).hint, /Skriv din vægt/);
});

test("progression: langt over målet giver større spring, langt under giver mindre vægt", () => {
  const up = suggest(ex("roning"), { id: "roning", sets: [{ kg: 8, reps: 20 }, { kg: 8, reps: 18 }, { kg: 8, reps: 16 }, { kg: 8, reps: 15 }] });
  assert.ok(up.sets[0].kg >= 10, `op ${up.sets[0].kg}`);
  const down = suggest(ex("roning"), { id: "roning", sets: [{ kg: 16, reps: 5 }, { kg: 16, reps: 4 }, { kg: 16, reps: 4 }, { kg: 16, reps: 3 }] });
  assert.ok(down.sets[0].kg < 16, `ned ${down.sets[0].kg}`);
  assert.match(down.hint, /Gå ned til/);
});
