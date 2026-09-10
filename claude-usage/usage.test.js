"use strict";
// Minimal node:test coverage for the pure bits of usage.js.
// Run: node --test

const { test } = require("node:test");
const assert = require("node:assert");
const usage = require("./usage");

test("normalizeModel collapses aliases and drops synthetic", () => {
  assert.equal(usage.normalizeModel("opus"), "claude-opus-4-8");
  assert.equal(usage.normalizeModel("sonnet"), "claude-sonnet-5");
  assert.equal(usage.normalizeModel("fable"), "claude-fable-5");
  assert.equal(usage.normalizeModel("claude-opus-4-8"), "claude-opus-4-8");
  assert.equal(usage.normalizeModel("<synthetic>"), null);
  assert.equal(usage.normalizeModel(null), null);
});

test("costOf prices each token class per its rate", () => {
  // 1M input @ $15 + 1M output @ $75 for opus = $90.
  const cost = usage.costOf(
    { input: 1e6, output: 1e6, cacheWrite: 0, cacheRead: 0 },
    "claude-opus-4-8"
  );
  assert.equal(cost, 90);
});

test("costOf falls back to opus tier for unknown models", () => {
  const known = usage.costOf({ input: 1e6, output: 0, cacheWrite: 0, cacheRead: 0 }, "claude-opus-4-8");
  const unknown = usage.costOf({ input: 1e6, output: 0, cacheWrite: 0, cacheRead: 0 }, "some-future-model");
  assert.equal(unknown, known);
});

test("localDayKey uses local calendar date", () => {
  const d = new Date(2026, 6, 18, 23, 59); // Jul 18 2026, local
  assert.equal(usage.localDayKey(d), "2026-07-18");
});

test("aggregate returns the expected shape", async () => {
  const data = await usage.aggregate(new Date());
  assert.ok(data.totals.today && data.totals.week && data.totals.all);
  assert.ok(Array.isArray(data.models));
  assert.equal(typeof data.fileCount, "number");
  for (const b of [data.totals.today, data.totals.week, data.totals.all]) {
    assert.ok(b.cost >= 0 && b.messages >= 0);
  }
});
