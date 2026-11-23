import { test } from "node:test";
import assert from "node:assert/strict";
import { daysBetween, defaultKind, isDue, parseImageDataUrl, pickComparison, type PhotoMeta } from "./photos-core";

const p = (id: string, date: string, view: "forfra" | "side" = "forfra", kind: PhotoMeta["kind"] = "undervejs"): PhotoMeta => ({ id, date, view, kind, savedAt: `${date}T10:00:00Z` });

test("billeddata: kun jpeg/webp og under grænsen", () => {
  const small = "data:image/jpeg;base64," + "A".repeat(400);
  assert.ok(parseImageDataUrl(small, 1000));
  assert.equal(parseImageDataUrl(small, 100), null);
  assert.equal(parseImageDataUrl("data:image/png;base64," + "A".repeat(400), 1000), null);
  assert.equal(parseImageDataUrl("data:image/jpeg;base64,<script>", 1000), null);
  assert.equal(parseImageDataUrl(42, 1000), null);
});

test("påmindelser", () => {
  assert.equal(daysBetween("2026-11-01", "2026-11-15"), 14);
  assert.ok(isDue(null, "2026-11-23", 7));
  assert.ok(isDue("2026-11-16", "2026-11-23", 7));
  assert.ok(!isDue("2026-11-20", "2026-11-23", 7));
});

test("sammenligning: første (helst Før) mod nyeste, samme vinkel, nok dage imellem", () => {
  assert.equal(pickComparison([p("a", "2026-11-01"), p("b", "2026-11-05")]), null);
  const r = pickComparison([p("a", "2026-11-01", "forfra", "foer"), p("b", "2026-11-10"), p("c", "2026-12-01"), p("s", "2026-12-02", "side")]);
  assert.deepEqual([r?.before.id, r?.after.id], ["a", "c"]);
  const side = pickComparison([p("a", "2026-11-01", "side"), p("b", "2026-12-01", "side"), p("f", "2026-12-01")]);
  assert.deepEqual([side?.before.id, side?.after.id], ["a", "b"]);
  assert.equal(defaultKind([]), "foer");
  assert.equal(defaultKind([p("a", "2026-11-01")]), "undervejs");
});
