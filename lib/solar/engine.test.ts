import { test } from "node:test";
import assert from "node:assert/strict";
import { calculate, calculateHour, paybackYears } from "./engine";
import { fillSellPrices } from "./sellprice";
import { parseSystemCsv, parseTimestamp } from "./sunmate";
import { localDay, copenhagenToUtc } from "./time";
import { mergeHours } from "./merge";
import type { HourData } from "./types";

const close = (a: number, b: number, eps = 1e-9) =>
  assert.ok(Math.abs(a - b) < eps, `${a} ≠ ${b}`);

const base = (start: string, o: Partial<HourData>): HourData => ({
  start,
  importKWh: 0,
  exportKWh: 0,
  buyPrice: 2,
  sellPrice: 0.5,
  pvKWh: 0,
  chargeKWh: 0,
  dischargeKWh: 0,
  ...o,
});

test("uden anlæg: alt købes, ingen besparelse", () => {
  const r = calculate([base("2026-06-01T10:00:00.000Z", { importKWh: 3 })]);
  close(r.total.actualCost, 6);
  close(r.total.noSystemCost, 6);
  close(r.total.solarOnlyCost, 6);
  close(r.total.totalSaving, 0);
});

test("sol midt på dagen uden batteri: overskud sælges", () => {
  // Hus bruger 1, sol 4, eksport 3.
  const h = calculateHour(base("2026-06-01T10:00:00.000Z", { pvKWh: 4, exportKWh: 3 }));
  assert.ok(h && h !== "inconsistent");
  close(h.load, 1);
  close(h.actual, -1.5); // 3 × 0,5 solgt
  close(h.noSystem, 2); // 1 × 2 købt
  close(h.solarOnly, -1.5); // samme som faktisk — batteriet gør intet her
});

test("batteri flytter sol fra middag til aften", () => {
  const hours = [
    // Middag: sol 4, hus 1, batteri lader 3, ingen eksport. Salgspris lav.
    base("2026-06-01T10:00:00.000Z", { pvKWh: 4, chargeKWh: 3, buyPrice: 1, sellPrice: 0.1 }),
    // Aften: hus 3, batteri afgiver 2,7 (10 % tab), køber 0,3. Dyr time.
    base("2026-06-01T18:00:00.000Z", { dischargeKWh: 2.7, importKWh: 0.3, buyPrice: 3, sellPrice: 1.5 }),
  ];
  const r = calculate(hours).total;
  close(r.loadKWh, 4);
  close(r.actualCost, 0.9); // 0,3 × 3
  close(r.noSystemCost, 1 * 1 + 3 * 3); // 10
  // Uden batteri: middag overskud 3 sælges à 0,1 = −0,3; aften køb 3 à 3 = 9
  close(r.solarOnlyCost, 8.7);
  close(r.solarSaving, 1.3);
  close(r.batterySaving, 7.8);
  close(r.totalSaving, 9.1);
  close(r.solarSaving + r.batterySaving, r.totalSaving);
});

test("billig netopladning tæller som batteribesparelse", () => {
  const hours = [
    base("2026-01-10T02:00:00.000Z", { importKWh: 10.5, chargeKWh: 10, buyPrice: 0.8 }), // hus 0,5
    base("2026-01-10T17:00:00.000Z", { dischargeKWh: 9, buyPrice: 2.5 }), // hus 9
  ];
  const r = calculate(hours).total;
  close(r.loadKWh, 9.5);
  close(r.actualCost, 8.4);
  close(r.noSystemCost, 0.4 + 22.5);
  close(r.solarSaving, 0);
  close(r.batterySaving, 22.9 - 8.4);
});

test("manglende data er ikke nul", () => {
  const r = calculate([
    base("2026-06-01T10:00:00.000Z", { importKWh: 1 }),
    base("2026-06-01T11:00:00.000Z", { importKWh: null }),
    base("2026-06-01T12:00:00.000Z", { importKWh: 1, pvKWh: null }),
  ]);
  assert.equal(r.total.hours, 1);
  assert.equal(r.missingSystemHours, 1);
});

test("negativt husforbrug markeres som inkonsistent", () => {
  const r = calculate([base("2026-06-01T10:00:00.000Z", { exportKWh: 5, pvKWh: 1 })]);
  assert.equal(r.inconsistentHours.length, 1);
  assert.equal(r.total.hours, 0);
});

test("dage og måneder følger dansk tid", () => {
  // 23:30 UTC 31. maj = 01:30 dansk tid 1. juni
  assert.equal(localDay("2026-05-31T23:00:00.000Z"), "2026-06-01");
  assert.equal(localDay("2026-01-31T23:00:00.000Z"), "2026-02-01");
  const r = calculate([base("2026-05-31T23:00:00.000Z", { importKWh: 1 })]);
  assert.equal(r.months[0].key, "2026-06");
});

test("dansk tid → UTC inkl. sommertid", () => {
  assert.equal(new Date(copenhagenToUtc(2026, 6, 1, 12)).toISOString(), "2026-06-01T10:00:00.000Z");
  assert.equal(new Date(copenhagenToUtc(2026, 1, 1, 12)).toISOString(), "2026-01-01T11:00:00.000Z");
  assert.equal(new Date(parseTimestamp("2026-06-01 00:00")!).toISOString(), "2026-05-31T22:00:00.000Z");
  assert.equal(new Date(parseTimestamp("01.06.2026 10:15")!).toISOString(), "2026-06-01T08:15:00.000Z");
  assert.equal(new Date(parseTimestamp("2026-06-01T10:00:00Z")!).toISOString(), "2026-06-01T10:00:00.000Z");
});

test("salgspris estimeres ud fra spot og kalibreret gebyr", () => {
  const hours = Array.from({ length: 30 }, (_, i) => ({
    start: new Date(Date.UTC(2026, 5, 1, i)).toISOString(),
    importKWh: 0,
    exportKWh: 1,
    // spot ekskl. moms = 0,6; afgifter 0,4 → købspris (0,6·1,25... ) konstrueret:
    buyPrice: (0.6 * 1.25 + 0.5),
    variableCharges: 0.5,
    sellPrice: i < 25 ? 0.55 : null, // gebyr 0,05
  }));
  const { hours: out, method, fee } = fillSellPrices(hours);
  assert.equal(method, "spot");
  close(fee!, 0.05);
  close(out[29].sellPrice!, 0.55);
  assert.equal(out[29].sellPriceEstimated, true);
  assert.equal(out[0].sellPriceEstimated, undefined);
});

test("CSV fra anlæg: 15-min Wh summeres til timer", () => {
  const csv = [
    "Tidspunkt;Produktion (Wh);Opladning (Wh);Afladning (Wh)",
    "2026-06-01 12:00;500;100;0",
    "2026-06-01 12:15;500;100;0",
    "2026-06-01 12:30;500;100;0",
    "2026-06-01 12:45;500;100;0",
    "2026-06-01 13:00;1.000;0;250",
  ].join("\n");
  const r = parseSystemCsv(csv);
  assert.equal(r.unitFactor, 0.001);
  assert.equal(r.hours.length, 2);
  assert.equal(r.hours[0].start, "2026-06-01T10:00:00.000Z");
  close(r.hours[0].pvKWh!, 2);
  close(r.hours[0].chargeKWh!, 0.4);
  close(r.hours[1].pvKWh!, 1);
  close(r.hours[1].dischargeKWh!, 0.25);
});

test("CSV med signeret batterikolonne", () => {
  const r = parseSystemCsv("time,pv,battery\n2026-06-01T10:00:00Z,2.5,-1\n2026-06-01T18:00:00Z,0,1.5");
  assert.equal(r.hasBattery, true);
  close(r.hours[0].chargeKWh!, 1);
  close(r.hours[1].dischargeKWh!, 1.5);
  close(r.hours[1].chargeKWh!, 0);
});

test("flet: time uden anlægsdata bliver ukendt, ikke nul", () => {
  const merged = mergeHours(
    [{ start: "a", importKWh: 1, exportKWh: 0, buyPrice: 1, sellPrice: 0.5 }],
    [],
  );
  assert.equal(merged[0].pvKWh, null);
  assert.equal(calculate(merged).total.hours, 0);
});

test("tilbagebetalingstid", () => {
  close(paybackYears(100_000, 5_000, 182.5)!, 10);
  assert.equal(paybackYears(100_000, -1, 30), null);
});

import { timelineToHours } from "./timeline";

test("tidslinje: watt → kWh pr. hel time, kun afsluttede timer", () => {
  // Hvert 5. minut fra 10:00 til 12:10: sol 6000 W, batteri lader 2000 W.
  const pts = [];
  for (let m = 0; m <= 130; m += 5) {
    pts.push({ datetime: new Date(Date.UTC(2026, 5, 1, 10, m)).toISOString(), solar_w: 6000, battery_w: 2000 });
  }
  const h = timelineToHours(pts);
  assert.equal(h.length, 2); // 10-11 og 11-12; 12-13 er ikke slut
  close(h[0].pvKWh!, 6);
  close(h[0].chargeKWh!, 2);
  close(h[0].dischargeKWh!, 0);
});

test("tidslinje: afladning er negativ battery_w, og huller giver ingen time", () => {
  const pts = [
    { datetime: "2026-06-01T18:00:00Z", solar_w: 0, battery_w: -3000 },
    { datetime: "2026-06-01T18:30:00Z", solar_w: 0, battery_w: -3000 }, // 30 min hul > 20 min
    { datetime: "2026-06-01T18:45:00Z", solar_w: 0, battery_w: -3000 },
    { datetime: "2026-06-01T19:00:00Z", solar_w: 0, battery_w: -3000 },
  ];
  assert.equal(timelineToHours(pts).length, 0);
  const full = Array.from({ length: 13 }, (_, i) => ({
    datetime: new Date(Date.UTC(2026, 5, 1, 18, i * 5)).toISOString(),
    solar_w: 0,
    battery_w: -3000,
  }));
  const h = timelineToHours(full);
  close(h[0].dischargeKWh!, 3);
  close(h[0].chargeKWh!, 0);
});

test("tidslinje: kalibreres mod SunMates dagstotaler", () => {
  const pts = Array.from({ length: 13 }, (_, i) => ({
    datetime: new Date(Date.UTC(2026, 5, 1, 10, i * 5)).toISOString(),
    solar_w: 5000,
    battery_w: 0,
  }));
  const h = timelineToHours(pts, { produced_today_kwh: 5.5 });
  close(h[0].pvKWh!, 5.5);
  // Urimelig total (3×) ignoreres
  close(timelineToHours(pts, { produced_today_kwh: 15 })[0].pvKWh!, 5);
});

test("CSV med kun dagstal afvises med tydelig besked", () => {
  assert.throws(
    () => parseSystemCsv("Dato;Produktion (kWh);Batteriopladning (kWh);Batteriafladning (kWh)\n2026-01-01;4,5;42,1;41,3\n2026-01-02;5,4;31,8;31,5"),
    /ét tal pr. dag/,
  );
});

test("CSV med SunMates danske kolonnenavne pr. time", () => {
  const r = parseSystemCsv("Tidspunkt;Produktion (kWh);Batteriopladning (kWh);Batteriafladning (kWh)\n2026-06-01 12:00;4,5;2,1;0,0");
  assert.equal(r.hasBattery, true);
  close(r.hours[0].chargeKWh!, 2.1);
  close(r.hours[0].dischargeKWh!, 0);
});

import { packHours, unpackHours } from "./merge";

test("kompakt overførsel bevarer timer, null og estimat-markering", () => {
  const h = [
    { start: "2021-09-01T10:00:00.000Z", importKWh: 1.23456, exportKWh: null, buyPrice: 2.5, sellPrice: 0.4, sellPriceEstimated: true },
    { start: "2026-10-27T22:00:00.000Z", importKWh: 0, exportKWh: 3, buyPrice: null, sellPrice: 1.1 },
  ];
  const back = unpackHours(JSON.parse(JSON.stringify(packHours(h))));
  assert.equal(back[0].start, h[0].start);
  assert.equal(back[0].importKWh, 1.2346);
  assert.equal(back[0].exportKWh, null);
  assert.equal(back[0].sellPriceEstimated, true);
  assert.equal(back[1].buyPrice, null);
  assert.equal(back[1].sellPriceEstimated, undefined);
});
