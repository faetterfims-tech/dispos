import { test } from "node:test";
import assert from "node:assert/strict";
import { exerciseById } from "./program";
import { estimateCalories, kindOf, sessionCalories, setWorkSec } from "./calories";

const ex = (id: string) => exerciseById(id)!;

test("type pr. pas", () => {
  assert.equal(kindOf("overkrop-a"), "vaegte");
  assert.equal(kindOf("krop-a"), "kropsvaegt");
  assert.equal(kindOf("interval"), "kondition");
});

test("arbejdstid pr. sæt: målt, ellers antal × rytme", () => {
  assert.equal(setWorkSec(ex("goblet"), { reps: 10 }), 30);
  assert.equal(setWorkSec(ex("goblet"), { reps: 10, sec: 42 }), 42);
  assert.equal(setWorkSec(ex("hoftehaev"), { reps: 12 }), 60);
  assert.equal(setWorkSec(ex("planke"), { reps: 40 }), 40);
  assert.equal(setWorkSec(ex("intervaller"), { reps: 12 }), 360);
});

test("flere sæt giver flere kalorier; spildtid tæller ikke", () => {
  const sets = (n: number) => Array.from({ length: n }, () => ({ reps: 10 }));
  const two = estimateCalories({ bodyKg: 85, exercises: [{ ex: ex("goblet"), sets: sets(2) }] });
  const four = estimateCalories({ bodyKg: 85, exercises: [{ ex: ex("goblet"), sets: sets(4) }] });
  assert.ok(four.high > two.high);
});

test("et helt styrkepas (85 kg, 5 øvelser × 4 sæt, målt pause 25 min, 7 min opvarmning) giver et fornuftigt niveau", () => {
  const ids = ["armstraek", "roning", "skulderpres", "pullups", "curl"];
  const r = estimateCalories({
    bodyKg: 85,
    exercises: ids.map((id) => ({ ex: ex(id), sets: Array.from({ length: 4 }, () => ({ reps: 10, sec: 35 })) })),
    restSec: 25 * 60,
    warmupSec: 7 * 60,
  });
  assert.ok(r.low >= 100 && r.high <= 300, `${r.low}-${r.high}`);
});

test("pas med ur: opvarmning udledes, pause fra målingen", () => {
  const s = {
    id: "x", date: "2026-11-23", dayId: "overkrop-a",
    exercises: [{ id: "roning", sets: [{ kg: 8, reps: 10, sec: 40 }, { kg: 8, reps: 10, sec: 40 }] }],
    time: { startedAt: "", endedAt: "", totalSec: 3600, activeSec: 80 + 420, restSec: 180, idleSec: 2920 },
  };
  const withIdle = sessionCalories(s, 85);
  const noIdle = sessionCalories({ ...s, time: { ...s.time, totalSec: 680, idleSec: 0 } }, 85);
  assert.deepEqual(withIdle, noIdle); // 48 min spild ændrer intet
  assert.ok(sessionCalories(s).guessedWeight);
});
