import { test } from "node:test";
import assert from "node:assert/strict";
import { buildGardenModel } from "../src/garden/growth.js";
import { DIMENSIONS, layoutItems, layoutSignature, pathAt, layoutGrass } from "../src/garden/layout.js";

const memories = Array.from({ length: 60 }, (_, i) => ({
  id: `mem-${i}`,
  date: `2026-${String(1 + (i % 10)).padStart(2, "0")}-${String(1 + (i % 27)).padStart(2, "0")}`,
  title: `R${i}`,
}));
const base = { today: "2026-11-20", start: "2026-01-01", memories };

test("el layout es determinista: igual en cada visita", () => {
  const a = layoutItems(buildGardenModel(base).items, DIMENSIONS.wide);
  const b = layoutItems(buildGardenModel({ ...base, memories: [...memories].reverse() }).items, DIMENSIONS.wide);
  assert.equal(layoutSignature(a), layoutSignature(b));
});

test("lo antiguo queda al fondo y lo reciente cerca", () => {
  const laid = layoutItems(buildGardenModel(base).items, DIMENSIONS.wide).filter((i) => i.kind === "memory");
  const oldest = laid.reduce((a, b) => (a.date < b.date ? a : b));
  const newest = laid.reduce((a, b) => (a.date > b.date ? a : b));
  assert.ok(oldest.y < newest.y);
  assert.ok(oldest.scale < newest.scale);
});

test("todas las flores quedan dentro del lienzo", () => {
  for (const dims of Object.values(DIMENSIONS)) {
    for (const item of layoutItems(buildGardenModel(base).items, dims)) {
      assert.ok(item.x >= 0 && item.x <= dims.width, `${item.id} x=${item.x}`);
      assert.ok(item.y >= dims.horizon && item.y <= dims.height, `${item.id} y=${item.y}`);
    }
  }
});

test("el camino se ensancha hacia el frente", () => {
  assert.ok(pathAt(0.1, DIMENSIONS.wide).halfWidth < pathAt(0.9, DIMENSIONS.wide).halfWidth);
});

test("el pasto solo se densifica: las primeras matas no cambian", () => {
  const few = layoutGrass(0.3, DIMENSIONS.wide, 100);
  const many = layoutGrass(0.9, DIMENSIONS.wide, 100);
  const key = (t) => `${t.x},${t.y}`;
  const manySet = new Set(many.map(key));
  assert.ok(few.every((t) => manySet.has(key(t))));
});
