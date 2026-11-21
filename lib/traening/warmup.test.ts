import { test } from "node:test";
import assert from "node:assert/strict";
import { RYG_OPVARMNING } from "./program";
import { WARMUP_PLANS, buildSteps, totalSeconds } from "./warmup";

test("en plan pr. opvarmningsøvelse, samme navne", () => {
  assert.deepEqual(
    WARMUP_PLANS.map((p) => p.name),
    RYG_OPVARMNING.map((w) => w.name),
  );
});

test("trin: klar, hold og skift i rigtig rækkefølge", () => {
  const steps = buildSteps();
  // Firfod: 1 klar + 12 hold + 11 skift
  const first = steps.filter((s) => s.item === 0);
  assert.equal(first.length, 24);
  assert.equal(first[0].kind, "klar");
  assert.equal(first[1].title, "Højre arm + venstre ben ud");
  assert.equal(first[2].kind, "skift");
  assert.equal(first[3].title, "Venstre arm + højre ben ud");
  assert.equal(first[first.length - 1].kind, "hold");

  // Mavebøjning: skift ben midtvejs (efter hold 3)
  const curl = steps.filter((s) => s.item === 2);
  const half = curl.filter((s) => s.title.startsWith("Skift ben"));
  assert.equal(half.length, 1);
  assert.equal(curl.indexOf(half[0]), 6); // klar, h1, s, h2, s, h3, [skift ben]

  // Hele opvarmningen tager 6–10 min.
  const t = totalSeconds(steps);
  assert.ok(t > 6 * 60 && t < 10 * 60, `tid ${t}`);
});

test("timer for én øvelse", () => {
  const steps = buildSteps(undefined, 1);
  assert.ok(steps.length > 0);
  assert.ok(steps.every((s) => s.item === 1));
  assert.equal(steps[0].kind, "klar");
  assert.equal(steps.filter((s) => s.kind === "hold").length, WARMUP_PLANS[1].holds);
});
