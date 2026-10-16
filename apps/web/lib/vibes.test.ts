import assert from "node:assert/strict";
import test from "node:test";

import { VIBES, normalizeSeason, packageVibeLabels, vibeIdsFromLabels } from "./vibes";

test("the wizard offers exactly six vibes", () => {
  assert.equal(VIBES.length, 6);
  assert.deepEqual(
    VIBES.map((v) => v.id),
    ["chill", "adventure", "luxury", "local", "foodie", "scenic"],
  );
});

test("vibeIdsFromLabels accepts labels or ids, in VIBES order, deduped", () => {
  assert.deepEqual(vibeIdsFromLabels(["Foodie", "Local Experience", "foodie"]), ["local", "foodie"]);
  assert.deepEqual(vibeIdsFromLabels(["Hiking", "Scenic"]), ["scenic"]);
  assert.deepEqual(vibeIdsFromLabels(null), []);
});

test("normalizeSeason only returns values the API accepts", () => {
  assert.equal(normalizeSeason(" Autumn "), "autumn");
  assert.equal(normalizeSeason("monsoon"), null);
  assert.equal(normalizeSeason(undefined), null);
});

test("packageVibeLabels reads only the vibes column, in canonical order", () => {
  assert.deepEqual(packageVibeLabels({ vibes: ["foodie", "adventure"] }), ["Adventure", "Foodie"]);
  assert.deepEqual(packageVibeLabels({ vibes: [] }), []);
  assert.deepEqual(packageVibeLabels({}), []);
});
