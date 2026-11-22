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

test("udstyr: tilpassede pas kræver aldrig noget, man ikke har, og dækker stadig hele kroppen", async () => {
  const { EQUIPMENT, programFor, resolveDay, orderFor, dayById } = await import("./program");
  const all = EQUIPMENT.map((e) => e.id);
  // Alle kombinationer af udstyr (2^5)
  for (let mask = 0; mask < 1 << all.length; mask++) {
    const owned = all.filter((_, i) => mask & (1 << i));
    const prog = programFor(owned);
    for (const id of orderFor(prog)) {
      const d = resolveDay(dayById(id)!, owned);
      assert.ok(d.exercises.length > 0, `${id} tom med ${owned}`);
      for (const e of d.exercises) assert.ok((e.needs ?? []).every((n) => owned.includes(n)), `${id}: ${e.id} kræver ${e.needs} (har ${owned})`);
      assert.equal(new Set(d.exercises.map((e) => e.id)).size, d.exercises.length, `${id}: dublet`);
    }
    if (prog === "kropsvaegt") {
      for (const id of ["krop-a", "krop-b"]) {
        const d = resolveDay(dayById(id)!, owned);
        const has = (re: RegExp) => d.exercises.some((e) => re.test(e.muscles));
        assert.ok(has(/ben|baller/i) && has(/bryst|skuldre|arm/i) && has(/ryg/i) && has(/mave/i), `${id} hele kroppen med ${owned}`);
      }
    }
  }
});

test("udstyr: uden stang bliver pull-ups byttet ud", async () => {
  const { resolveDay, dayById } = await import("./program");
  const ids = (owned: Parameters<typeof resolveDay>[1]) => resolveDay(dayById("overkrop-a")!, owned).exercises.map((e) => e.id);
  assert.ok(ids(["haandvaegte", "stang", "stol"]).includes("pullups"));
  assert.ok(ids(["haandvaegte", "stol", "baand"]).includes("baandtraek"));
  assert.ok(ids(["haandvaegte", "stol"]).includes("ttraek"));
  assert.ok(!ids(["haandvaegte"]).includes("pullups"));
});
