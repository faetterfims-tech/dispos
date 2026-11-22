import { test } from "node:test";
import assert from "node:assert/strict";
import { DAYS, EXERCISES, orderFor } from "./program";

test("hvert pas hører til ét program, og id'er er unikke", () => {
  assert.equal(new Set(DAYS.map((d) => d.id)).size, DAYS.length);
  assert.equal(new Set(EXERCISES.map((e) => e.id)).size, EXERCISES.length);
  assert.deepEqual([...orderFor("udstyr"), ...orderFor("kropsvaegt")].sort(), DAYS.map((d) => d.id).sort());
});

test("uden udstyr: ingen vægte, og hvert styrkepas træner hele kroppen", () => {
  const days = DAYS.filter((d) => d.program === "kropsvaegt");
  for (const d of days) for (const e of d.exercises) assert.notEqual(e.unit, "kg", `${d.id}: ${e.id} kræver vægte`);
  const strength = days.filter((d) => d.warmup);
  assert.equal(strength.length, 2);
  const has = (d: (typeof days)[number], re: RegExp) => d.exercises.some((e) => re.test(e.muscles));
  for (const d of strength) {
    assert.ok(has(d, /ben|baller/i), `${d.id}: ben`);
    assert.ok(has(d, /bryst|skuldre|arm/i), `${d.id}: skub`);
    assert.ok(has(d, /ryg/i), `${d.id}: ryg`);
    assert.ok(has(d, /mave/i), `${d.id}: mave`);
  }
});
