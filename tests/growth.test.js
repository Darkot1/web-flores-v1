import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildGardenModel,
  clusterOldest,
  computeMilestones,
  grassDensity,
  nextMilestone,
  monthLights,
  phaseAt,
  seasonFor,
  stageFor,
  treeStage,
  wildflowerCount,
} from "../src/garden/growth.js";

const today = "2026-11-20";

test("las etapas maduran con la antigüedad del recuerdo", () => {
  assert.equal(stageFor("2026-12-01", today), "seed");
  assert.equal(stageFor(today, today), "sprout");
  assert.equal(stageFor("2026-11-10", today), "bud");
  assert.equal(stageFor("2026-10-01", today), "open");
  assert.equal(stageFor("2025-01-01", today), "full");
});

test("hitos: árbol al inicio, luz cada mes, arco cada 3 meses, gran arco cada año", () => {
  const ms = computeMilestones("2025-10-31", today);
  assert.equal(ms[0].kind, "tree");
  const count = (k) => ms.filter((m) => m.kind === k).length;
  assert.equal(count("light"), 8);
  assert.equal(count("arch"), 3);
  assert.equal(count("grand"), 1);
  assert.equal(ms.find((m) => m.n === 4).date, "2026-02-28");
  assert.equal(ms.find((m) => m.n === 12).label, "1 año juntos");
  assert.deepEqual(computeMilestones(null, today), []);
  assert.deepEqual(computeMilestones("2027-01-01", today), []);
});

test("la guirnalda tiene una luz por cada mes, agrupadas por año", () => {
  const lights = monthLights("2024-11-20", today);
  assert.equal(lights.length, 24);
  assert.deepEqual([lights[0].year, lights[0].slot], [1, 1]);
  assert.deepEqual([lights[23].year, lights[23].slot], [2, 12]);
  assert.equal(lights[14].label, "1 año y 3 meses juntos");
});

test("próximo hito", () => {
  const next = nextMilestone("2025-10-31", today);
  assert.equal(next.date, "2026-11-30");
  assert.equal(next.inDays, 10);
  assert.equal(next.kind, "light");
  assert.match(next.text, /luz/);
  assert.equal(nextMilestone("2025-11-25", today).kind, "grand");
});

test("el tiempo solo hace crecer pasto y silvestres", () => {
  assert.ok(grassDensity(0) >= 0.12);
  assert.ok(grassDensity(30) < grassDensity(365));
  assert.ok(grassDensity(365) > 0.9);
  assert.equal(wildflowerCount(30, 90), 4);
  assert.equal(wildflowerCount(2000, 90), 90);
  assert.equal(treeStage(10), "sapling");
  assert.equal(treeStage(400), "young");
  assert.equal(treeStage(1000), "tree");
});

test("Colombia: temporadas secas y de lluvias", () => {
  assert.equal(seasonFor("2026-01-10").id, "dry");
  assert.equal(seasonFor("2026-04-10").id, "rain");
  assert.equal(seasonFor("2026-10-10").id, "rain");
  assert.equal(seasonFor("2026-07-10").id, "veranillo");
  assert.equal(seasonFor("2026-07-10", "north").id, "summer");
  assert.equal(seasonFor("2026-07-10", "south").id, "winter");
});

const makeMemories = (n, startYear = 2024) =>
  Array.from({ length: n }, (_, i) => {
    const d = new Date(startYear, 0, 1 + i * 2);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    return { id: `m${i}`, date: key, title: `Recuerdo ${i}` };
  });

test("con muchos recuerdos, los más antiguos se agrupan en matas sin perder ninguno", () => {
  const items = makeMemories(300).map((m) => ({ ...m, kind: "memory" }));
  const grouped = clusterOldest(items, 80);
  assert.ok(grouped.length <= 82, `quedaron ${grouped.length}`);
  const total = grouped.reduce((sum, g) => sum + (g.kind === "cluster" ? g.members.length : 1), 0);
  assert.equal(total, 300);
  const newest = grouped.at(-1);
  assert.equal(newest.kind, "memory");
});

test("el modelo nunca está vacío: sin recuerdos hay pasto; sin fecha no hay hitos", () => {
  const empty = buildGardenModel({ today, start: null });
  assert.equal(empty.items.length, 0);
  assert.ok(empty.density > 0);
  const young = buildGardenModel({ today, start: "2026-10-20" });
  assert.ok(young.items.some((i) => i.kind === "tree"));
  assert.ok(young.items.some((i) => i.kind === "wild"));
});

test("cartas e hitos marcados plantan elementos propios", () => {
  const model = buildGardenModel({
    today,
    start: "2025-01-01",
    memories: [{ id: "a", date: "2025-02-14", title: "San Valentín", isMilestone: true }],
    letters: [{ id: "l1", date: "2025-03-01", title: "Carta", flower: { color: "lavanda", petals: 21 } }],
  });
  assert.ok(model.items.find((i) => i.kind === "bench" && i.memoryId === "a"));
  const letter = model.items.find((i) => i.kind === "letter");
  assert.equal(letter.color, "lavanda");
  assert.equal(letter.stage, "full");
});

test("el jardín sigue la hora, no el tema", () => {
  const at = (h, m = 0) => new Date(2026, 10, 20, h, m);
  assert.equal(phaseAt(at(5, 59)), "night");
  assert.equal(phaseAt(at(6, 0)), "day");
  assert.equal(phaseAt(at(17, 59)), "day");
  assert.equal(phaseAt(at(18, 0)), "night");
  assert.equal(phaseAt(at(23, 30)), "night");
  assert.equal(phaseAt(at(19, 0), { sunrise: 6, sunset: 19.5 }), "day");
});
