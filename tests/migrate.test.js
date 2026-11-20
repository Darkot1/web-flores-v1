import { test } from "node:test";
import assert from "node:assert/strict";
import { migrateState, migrateV1Memories } from "../src/lib/migrate.js";

const v1 = {
  "2025-03-14": { title: "Nuestra caminata", notes: "Por el parque" },
  "2025-04-02": { title: "", notes: "Cine" },
  basura: { title: "x" },
};

test("migra v1 sin perder recuerdos y con ids estables", () => {
  const a = migrateV1Memories(v1, "2026-01-01T00:00:00Z");
  const b = migrateV1Memories(v1, "2026-02-01T00:00:00Z");
  assert.equal(a.length, 2);
  assert.equal(a[0].title, "Nuestra caminata");
  assert.equal(a[0].notes, "Por el parque");
  assert.equal(a[1].title, "Un recuerdo");
  assert.deepEqual(a.map((m) => m.id), b.map((m) => m.id));
  assert.equal(a[0].isMilestone, false);
});

test("migrar dos veces no duplica", () => {
  const once = migrateState(null, { v1 });
  const twice = migrateState(JSON.parse(JSON.stringify({ ...once, migratedV1: false })), { v1 });
  assert.equal(twice.memories.length, 2);
  assert.equal(twice.schemaVersion, 2);
});
