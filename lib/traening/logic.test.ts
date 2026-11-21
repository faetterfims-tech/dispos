import { test } from "node:test";
import assert from "node:assert/strict";
import { exerciseById } from "./program";
import {
  isoWeekday,
  lastLog,
  progressSeries,
  sanitizeBody,
  sanitizeSession,
  sessionsPerWeek,
  suggest,
  volume,
  weekStart,
  type Session,
} from "./logic";

const roning = exerciseById("roning")!;
const armstraek = exerciseById("armstraek")!;
const planke = exerciseById("planke")!;

const session = (date: string, id: string, sets: [number, number][], dayId = "overkrop-a"): Session => ({
  id: `${date}-${id}`,
  date,
  dayId,
  exercises: [{ id, sets: sets.map(([kg, reps]) => ({ kg, reps })) }],
});

test("sanitizeSession renser og afviser", () => {
  assert.equal(sanitizeSession(null), null);
  assert.equal(sanitizeSession({ id: "a", date: "17-11-2026", dayId: "x", exercises: [] }), null);
  const s = sanitizeSession({
    id: "abc-1",
    date: "2026-11-17",
    dayId: "overkrop-a",
    exercises: [
      { id: "roning", sets: [{ kg: "12,5", reps: 10 }, { kg: 12, reps: 0 }, { kg: -1, reps: 5 }] },
      { id: "tom", sets: [] },
    ],
    note: "  god  ",
  });
  assert.deepEqual(s, { id: "abc-1", date: "2026-11-17", dayId: "overkrop-a", exercises: [{ id: "roning", sets: [{ kg: 12.5, reps: 10 }] }], note: "god" });
});

test("sanitizeBody kræver mindst ét mål", () => {
  assert.equal(sanitizeBody({ date: "2026-11-17" }), null);
  assert.deepEqual(sanitizeBody({ date: "2026-11-17", weightKg: "85,2", waistCm: "" }), { date: "2026-11-17", weightKg: 85.2 });
});

test("lastLog finder seneste før dato", () => {
  const all = [session("2026-11-10", "roning", [[10, 10]]), session("2026-11-14", "roning", [[12, 8]])];
  assert.equal(lastLog(all, "roning")?.date, "2026-11-14");
  assert.equal(lastLog(all, "roning", "2026-11-14")?.date, "2026-11-10");
  assert.equal(lastLog(all, "pullups"), null);
});

test("suggest: alle sæt på 12 → op i vægt", () => {
  const last = session("2026-11-10", "roning", [[10, 12], [10, 12], [10, 12], [10, 12]]).exercises[0];
  const s = suggest(roning, last);
  assert.equal(s.sets[0].kg, 12);
  assert.equal(s.sets[0].reps, 8);
  assert.match(s.hint, /12 kg/);
});

test("suggest: midt i området → samme vægt, +1 rep", () => {
  const last = session("2026-11-10", "roning", [[10, 10], [10, 9], [10, 8], [10, 8]]).exercises[0];
  const s = suggest(roning, last);
  assert.deepEqual(s.sets.map((x) => [x.kg, x.reps]), [[10, 11], [10, 10], [10, 9], [10, 9]]);
});

test("suggest: kropsvægt og tid", () => {
  const push = suggest(armstraek, { id: "armstraek", sets: [{ kg: 0, reps: 10 }, { kg: 0, reps: 8 }] });
  assert.equal(push.sets[0].reps, 11);
  assert.match(push.hint, /18 i alt/);
  const p = suggest(planke, { id: "planke", sets: [{ kg: 0, reps: 40 }, { kg: 0, reps: 30 }] });
  assert.equal(p.sets[0].reps, 45);
  assert.equal(suggest(roning, null).sets.length, roning.sets);
});

test("progressSeries stiger med vægt", () => {
  const all = [session("2026-11-14", "roning", [[12, 8]]), session("2026-11-10", "roning", [[10, 10]])];
  const s = progressSeries(all, roning);
  assert.deepEqual(s.map((x) => x.date), ["2026-11-10", "2026-11-14"]);
  assert.ok(s[1].value > s[0].value);
});

test("uger og ugedage", () => {
  assert.equal(weekStart("2026-11-17"), "2026-11-16"); // tirsdag → mandag
  assert.equal(weekStart("2026-11-22"), "2026-11-16"); // søndag
  assert.equal(isoWeekday("2026-11-22"), 7);
  assert.equal(isoWeekday("2026-11-16"), 1);
  const w = sessionsPerWeek([session("2026-11-16", "roning", [[1, 1]]), session("2026-11-18", "roning", [[1, 1]]), session("2026-11-10", "roning", [[1, 1]])]);
  assert.deepEqual(w, [{ week: "2026-11-16", count: 2 }, { week: "2026-11-09", count: 1 }]);
});

test("volume tæller kun vægtøvelser", () => {
  const s: Session = { id: "x", date: "2026-11-17", dayId: "a", exercises: [{ id: "roning", sets: [{ kg: 10, reps: 10 }] }, { id: "armstraek", sets: [{ kg: 0, reps: 20 }] }] };
  assert.equal(volume(s, (id) => exerciseById(id)?.unit), 100);
});

test("rækkefølge: næste pas, spring over og forfra", async () => {
  const { nextInOrder, upNext } = await import("./logic");
  const order = ["a", "b", "c"];
  assert.equal(nextInOrder("a", order), "b");
  assert.equal(nextInOrder("c", order), "a");
  assert.equal(nextInOrder("b", order, 2), "a");
  assert.equal(nextInOrder("ukendt", order), "a");

  assert.equal(upNext([], null, order), "a");
  const s = (dayId: string, savedAt: string): Session => ({ id: savedAt, date: savedAt.slice(0, 10), dayId, savedAt, exercises: [] });
  const sessions = [s("a", "2026-11-21T07:00:00.000Z"), s("b", "2026-11-23T07:00:00.000Z")];
  // En dag sprunget over ændrer ikke noget: næste er stadig efter det sidst gemte.
  assert.equal(upNext(sessions, null, order), "c");
  // Spring over efter sidste pas → det valgte gælder.
  assert.equal(upNext(sessions, { dayId: "a", setAt: "2026-11-24T06:00:00.000Z" }, order), "a");
  // Et gammelt spring over overhales af et nyere pas.
  assert.equal(upNext(sessions, { dayId: "a", setAt: "2026-11-22T06:00:00.000Z" }, order), "c");
});
