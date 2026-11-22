import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanName, hashToken, isOwnerHeader, keyPrefix, newToken, tokenLooksValid } from "./invite-core";

test("token: tilfældigt, url-sikkert og hashes stabilt", () => {
  const a = newToken();
  const b = newToken();
  assert.notEqual(a, b);
  assert.ok(tokenLooksValid(a));
  assert.equal(hashToken(a), hashToken(a));
  assert.notEqual(hashToken(a), a);
  assert.ok(!tokenLooksValid("kort"));
  assert.ok(!tokenLooksValid("../../etc/passwd-aaaaaaaaaaaaaaaa"));
});

test("navn renses", () => {
  assert.equal(cleanName("  Mor   Carina "), "Mor Carina");
  assert.equal(cleanName(""), null);
  assert.equal(cleanName(42), null);
  assert.equal(cleanName("x".repeat(60))?.length, 40);
});

test("ejer-tjek af Basic-header", () => {
  const h = (pw: string) => `Basic ${Buffer.from(`daniel:${pw}`).toString("base64")}`;
  assert.ok(isOwnerHeader(h("hemmelig"), "hemmelig"));
  assert.ok(!isOwnerHeader(h("forkert"), "hemmelig"));
  assert.ok(!isOwnerHeader(null, "hemmelig"));
  assert.ok(!isOwnerHeader(h("hemmelig"), undefined));
});

test("data-nøgler: ejer uændret, gæster for sig", () => {
  assert.equal(keyPrefix("owner"), "traening:");
  assert.equal(keyPrefix("ab12cd"), "traening:u:ab12cd:");
});
