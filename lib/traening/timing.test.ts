import { test } from "node:test";
import assert from "node:assert/strict";
import { fmtDuration, fmtMinutes, splitTime } from "./timing";

const S = 1000;

test("ingen sæt: alt er spildtid", () => {
  assert.deepEqual(splitTime(0, [], 300 * S), { totalSec: 300, activeSec: 0, restSec: 0, idleSec: 300 });
});

test("sæt, kort pause og lang pause", () => {
  // 0–60: klar (spild). 60–100 sæt. 100–190 pause (90 s). 190–230 sæt. 230–530: 120 pause + 180 spild.
  const r = splitTime(0, [{ start: 60 * S, end: 100 * S }, { start: 190 * S, end: 230 * S }], 530 * S);
  assert.deepEqual(r, { totalSec: 530, activeSec: 80, restSec: 210, idleSec: 240 });
});

test("igangværende sæt tæller som aktivt til nu", () => {
  const r = splitTime(0, [{ start: 10 * S }], 40 * S);
  assert.equal(r.activeSec, 30);
  assert.equal(r.idleSec, 10);
});

test("overlap flettes og klippes til træningen", () => {
  const r = splitTime(100 * S, [{ start: 50 * S, end: 150 * S }, { start: 140 * S, end: 160 * S }], 200 * S);
  assert.equal(r.activeSec, 60);
  assert.equal(r.restSec, 40);
  assert.equal(r.activeSec + r.restSec + r.idleSec, r.totalSec);
});

test("formatering", () => {
  assert.equal(fmtDuration(65), "1:05");
  assert.equal(fmtDuration(3723), "1:02:03");
  assert.equal(fmtMinutes(40), "40 sek");
  assert.equal(fmtMinutes(2700), "45 min");
  assert.equal(fmtMinutes(3900), "1 t 5 min");
});
