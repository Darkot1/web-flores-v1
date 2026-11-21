import { test } from "node:test";
import assert from "node:assert/strict";
import { buildGardenModel } from "../src/garden/growth.js";
import { canvasToGround, DIMENSIONS, groundToCanvas, layoutGarland, layoutItems, layoutSignature, pathAt, layoutGrass, pondPlacement } from "../src/garden/layout.js";
import { monthLights } from "../src/garden/growth.js";

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

test("los arcos abrazan el camino: más anchos que él", () => {
  const model = buildGardenModel({ ...base, start: "2024-01-01" });
  const laid = layoutItems(model.items, DIMENSIONS.wide);
  const arches = laid.filter((i) => i.kind === "arch" || i.kind === "grand");
  assert.equal(arches.length, 11); // 34 meses → un gran arco cada 3
  for (const a of arches) {
    const half = (a.kind === "grand" ? 72 : 60) * a.scale;
    assert.ok(half > pathAt(a.depth, DIMENSIONS.wide).halfWidth, `${a.id} más estrecho que el camino`);
  }
});

test("las flores usan todo el prado, no solo la orilla del camino", () => {
  const laid = layoutItems(buildGardenModel(base).items, DIMENSIONS.wide).filter((i) => i.kind === "memory");
  const xs = laid.map((i) => i.x);
  assert.ok(Math.min(...xs) < DIMENSIONS.wide.width * 0.2);
  assert.ok(Math.max(...xs) > DIMENSIONS.wide.width * 0.8);
});

test("la guirnalda cuelga en el cielo, por encima del horizonte", () => {
  for (const dims of Object.values(DIMENSIONS)) {
    const { strands, lights } = layoutGarland(monthLights("2022-06-01", "2026-11-20"), dims);
    assert.equal(strands.length, 5);
    for (const l of lights) assert.ok(l.y + l.drop + 20 < dims.horizon, `${l.id} y=${l.y}`);
  }
});

test("nada se planta dentro del estanque", () => {
  for (const dims of Object.values(DIMENSIONS)) {
    const pond = pondPlacement(dims);
    const laid = layoutItems(buildGardenModel({ ...base, start: "2024-01-01" }).items, dims);
    for (const i of laid.filter((x) => ["memory", "wild", "letter", "cluster"].includes(x.kind))) {
      const inside = ((i.x - pond.cx) / pond.rx) ** 2 + ((i.y - pond.cy) / pond.ry) ** 2 < 1;
      assert.ok(!inside, `${i.id} en el estanque`);
    }
    assert.ok(pond.cx - pond.rx > 0 && pond.cx + pond.rx < dims.width);
  }
});

test("sembrar a mano: el recuerdo crece exactamente donde se tocó", () => {
  for (const dims of Object.values(DIMENSIONS)) {
    const x = dims.width * 0.7;
    const y = dims.horizon + (dims.height - dims.horizon) * 0.6;
    const spot = canvasToGround(x, y, dims);
    const back = groundToCanvas(spot, dims);
    assert.ok(Math.abs(back.x - x) < 2 && Math.abs(back.y - y) < 2);
    const model = buildGardenModel({ ...base, memories: [...memories, { id: "aqui", date: "2026-11-01", title: "Aquí", spot }] });
    const laid = layoutItems(model.items, dims).find((i) => i.id === "aqui");
    assert.ok(Math.abs(laid.x - x) < 2 && Math.abs(laid.y - y) < 2, `${laid.x},${laid.y} vs ${x},${y}`);
  }
});

test("un recuerdo sembrado a mano nunca se agrupa en una mata", () => {
  const many = Array.from({ length: 300 }, (_, i) => ({ id: `m${i}`, date: "2026-02-01", title: "x" }));
  const model = buildGardenModel({ ...base, memories: [...many, { id: "aqui", date: "2026-02-01", title: "Aquí", spot: { x: 0.5, y: 0.5 } }], caps: { flowers: 50, wild: 10 } });
  assert.ok(model.items.some((i) => i.id === "aqui" && i.kind === "memory"));
});
