/**
 * Reglas de crecimiento del jardín. Funciones puras: sin DOM, sin fechas
 * implícitas (siempre reciben `today`). Testeadas en tests/growth.test.js.
 */
import { addDays, addMonthsClamped, daysBetween, monthKey } from "../lib/dates.js";
import { createRng, weightedPick } from "../lib/seed.js";

export const STAGES = ["seed", "sprout", "bud", "open", "full"];

/** Día o noche en el jardín según la hora local (no según el tema de la página). */
export const phaseAt = (date = new Date(), { sunrise = 6, sunset = 18 } = {}) => {
  const hour = date.getHours() + date.getMinutes() / 60;
  return hour >= sunrise && hour < sunset ? "day" : "night";
};

export const STAGE_LABELS = {
  seed: "semilla",
  sprout: "brote",
  bud: "capullo",
  open: "flor abierta",
  full: "flor plena",
};

/** Días mínimos de antigüedad para alcanzar cada etapa. */
export const DEFAULT_THRESHOLDS = { sprout: 0, bud: 7, open: 30, full: 90 };

export const stageForAge = (ageDays, thresholds = DEFAULT_THRESHOLDS) => {
  if (ageDays < thresholds.sprout) return "seed";
  if (ageDays >= thresholds.full) return "full";
  if (ageDays >= thresholds.open) return "open";
  if (ageDays >= thresholds.bud) return "bud";
  return "sprout";
};

/** Etapa de una flor según la antigüedad de su fecha. Las fechas futuras son semillas. */
export const stageFor = (dateKey, today, thresholds = DEFAULT_THRESHOLDS) =>
  stageForAge(daysBetween(dateKey, today), thresholds);

export const stageIndex = (stage) => STAGES.indexOf(stage);

/** Días cultivando el jardín (0 si aún no empieza o empieza en el futuro). */
export const gardenAgeDays = (start, today) => (start ? Math.max(0, daysBetween(start, today)) : 0);

/** El arbolito del inicio madura con la edad del jardín. */
export const treeStage = (ageDays) => {
  if (ageDays < 180) return "sapling";
  if (ageDays < 730) return "young";
  return "tree";
};

/** Densidad de pasto [0.12, 1): nunca pelado, satura con los meses. */
export const grassDensity = (ageDays) => Math.max(0.12, 1 - Math.exp(-Math.max(0, ageDays) / 120));

/** Una flor silvestre por semana cultivada, con tope por dispositivo. */
export const wildflowerCount = (ageDays, cap) => Math.min(cap, Math.floor(Math.max(0, ageDays) / 7));

const plural = (n, one, many) => (n === 1 ? one : many);

/**
 * Hitos que se calculan solos a partir de la fecha de inicio:
 * inicio → arbolito, cada mesiversario → farol, cada aniversario → arco de flores.
 */
export const computeMilestones = (start, today, { maxMonths = 600 } = {}) => {
  if (!start || daysBetween(start, today) < 0) return [];
  const anchorDay = Number(start.slice(8, 10));
  const list = [{ id: "ms-start", kind: "tree", date: start, label: "Aquí empezó todo", n: 0 }];
  for (let n = 1; n <= maxMonths; n += 1) {
    const date = addMonthsClamped(start, n, anchorDay);
    if (daysBetween(date, today) < 0) break;
    if (n % 12 === 0) {
      const years = n / 12;
      list.push({ id: `ms-year-${years}`, kind: "arch", date, n, label: `${years} ${plural(years, "año", "años")} juntos` });
    } else {
      list.push({ id: `ms-month-${n}`, kind: "lamp", date, n, label: `${n} ${plural(n, "mes", "meses")} juntos` });
    }
  }
  return list;
};

/** El próximo hito: para un "faltan X días" discreto. */
export const nextMilestone = (start, today) => {
  if (!start) return null;
  const anchorDay = Number(start.slice(8, 10));
  if (daysBetween(start, today) < 0) return { date: start, n: 0, kind: "tree", inDays: daysBetween(today, start), label: "El primer día" };
  for (let n = 1; n < 1200; n += 1) {
    const date = addMonthsClamped(start, n, anchorDay);
    const inDays = daysBetween(today, date);
    if (inDays > 0) {
      const isYear = n % 12 === 0;
      return {
        date,
        n,
        kind: isYear ? "arch" : "lamp",
        inDays,
        label: isYear ? `${n / 12} ${plural(n / 12, "año", "años")} juntos` : `${n} ${plural(n, "mes", "meses")} juntos`,
      };
    }
  }
  return null;
};

/**
 * Estaciones. Colombia es tropical: no hay cuatro estaciones sino temporadas
 * secas y de lluvias (régimen bimodal andino).
 */
const TROPICAL = {
  1: "dry", 2: "dry", 3: "rains-start", 4: "rain", 5: "rain", 6: "veranillo",
  7: "veranillo", 8: "dry", 9: "rains-start", 10: "rain", 11: "rain", 12: "dry",
};
const NORTH = {
  12: "winter", 1: "winter", 2: "winter", 3: "spring", 4: "spring", 5: "spring",
  6: "summer", 7: "summer", 8: "summer", 9: "autumn", 10: "autumn", 11: "autumn",
};
const SOUTH_SHIFT = { winter: "summer", summer: "winter", spring: "autumn", autumn: "spring" };

export const SEASONS = {
  dry: { label: "Temporada seca", tint: "#f4d9a2", light: 0.12 },
  veranillo: { label: "Veranillo", tint: "#f6cf8f", light: 0.14 },
  "rains-start": { label: "Llegan las lluvias", tint: "#d6dcc0", light: 0.05 },
  rain: { label: "Temporada de lluvias", tint: "#b9d2c4", light: -0.04 },
  winter: { label: "Invierno", tint: "#d4dcef", light: -0.06 },
  spring: { label: "Primavera", tint: "#e7d8f2", light: 0.06 },
  summer: { label: "Verano", tint: "#f6d79a", light: 0.14 },
  autumn: { label: "Otoño", tint: "#efc8a2", light: 0.04 },
};

export const seasonFor = (dateKey, climate = "tropical") => {
  const month = Number(dateKey.slice(5, 7));
  let id = climate === "tropical" ? TROPICAL[month] : NORTH[month];
  if (climate === "south") id = SOUTH_SHIFT[id];
  return { id, ...SEASONS[id] };
};

/** Color de una margarita de recuerdo: protagonistas moradas. */
export const flowerColorFor = (id) =>
  weightedPick(createRng(`${id}:color`), [
    { value: "morada", weight: 68 },
    { value: "lavanda", weight: 17 },
    { value: "blanca", weight: 11 },
    { value: "dorada", weight: 4 },
  ]);

export const petalCountFor = (id) => createRng(`${id}:petals`).pick([13, 16, 16, 21]);

/** Fecha de inicio efectiva: la configurada o, si no hay, el recuerdo más antiguo. */
export const effectiveStart = ({ start, memories = [], letters = [], today }) => {
  if (start) return start;
  const dates = [...memories, ...letters].map((x) => x.date).filter(Boolean).sort();
  return dates[0] && daysBetween(dates[0], today) > 0 ? dates[0] : addDays(today, -30);
};

const byDate = (a, b) => a.date.localeCompare(b.date) || String(a.id).localeCompare(String(b.id));

/**
 * Agrupa los recuerdos más antiguos en matas por mes cuando hay más de `cap`.
 * Las cartas y los hitos nunca se agrupan.
 */
export const clusterOldest = (items, cap) => {
  if (items.length <= cap) return items;
  const sorted = [...items].sort(byDate);
  const keep = [];
  const groups = new Map();
  // Cada mata ocupa un lugar: se agrupa hasta que quepa todo.
  let overflow = sorted.length - cap;
  for (const item of sorted) {
    const key = monthKey(item.date);
    if (overflow > 0 || groups.has(key)) {
      if (!groups.has(key)) groups.set(key, []);
      const group = groups.get(key);
      group.push(item);
      if (group.length > 1) overflow -= 1;
    } else {
      keep.push(item);
    }
  }
  const clusters = [...groups.entries()].map(([key, members]) =>
    members.length === 1
      ? members[0]
      : {
          id: `cluster-${key}`,
          kind: "cluster",
          date: members[0].date,
          month: key,
          members,
          stage: "full",
          title: `${members.length} recuerdos`,
        },
  );
  return [...clusters, ...keep].sort(byDate);
};

/**
 * Modelo completo del jardín a partir de datos reales.
 * @returns {{ items, start, hasStart, ageDays, density, wildCount, span }}
 */
export const buildGardenModel = ({
  memories = [],
  letters = [],
  start = null,
  today,
  caps = { flowers: 250, wild: 90 },
  thresholds = DEFAULT_THRESHOLDS,
}) => {
  const from = effectiveStart({ start, memories, letters, today });
  const ageDays = gardenAgeDays(start, today);
  const span = Math.max(30, daysBetween(from, today));
  const tOf = (date) => {
    const raw = daysBetween(from, date) / span;
    return raw > 1 ? 1 + Math.min(0.06, (raw - 1) * 0.5) : Math.max(0, raw);
  };

  const memoryItems = memories.map((m) => ({
    id: m.id,
    kind: "memory",
    date: m.date,
    title: m.title,
    author: m.author ?? null,
    stage: stageFor(m.date, today, thresholds),
    color: flowerColorFor(m.id),
    petals: petalCountFor(m.id),
    isMilestone: Boolean(m.isMilestone),
    ref: m,
  }));

  const flowers = clusterOldest(memoryItems, caps.flowers);

  const letterItems = letters.map((l) => ({
    id: l.id,
    kind: "letter",
    date: l.date,
    title: l.title,
    stage: stageFor(l.date, today, thresholds),
    color: l.flower?.color ?? "morada",
    petals: l.flower?.petals ?? 21,
    sealColor: l.sealColor,
    ref: l,
  }));

  const benches = memories
    .filter((m) => m.isMilestone)
    .map((m) => ({ id: `bench-${m.id}`, kind: "bench", date: m.date, title: m.title, memoryId: m.id, label: `Día especial: ${m.title}` }));

  const milestones = computeMilestones(start, today).map((ms) => ({
    ...ms,
    title: ms.label,
    stage: ms.kind === "tree" ? treeStage(ageDays) : undefined,
  }));

  const wildCount = start ? wildflowerCount(ageDays, caps.wild) : 0;
  const wild = Array.from({ length: wildCount }, (_, n) => {
    const date = addDays(start, n * 7 + 3);
    return { id: `wild-${n}`, kind: "wild", date, stage: stageFor(date, today, thresholds), color: createRng(`wild-${n}`).pick(["lavanda", "blanca", "blanca", "dorada", "morada"]) };
  });

  const items = [...milestones, ...benches, ...wild, ...flowers, ...letterItems]
    .map((item) => ({ ...item, t: tOf(item.date) }))
    .sort(byDate);

  return {
    items,
    start: from,
    hasStart: Boolean(start),
    ageDays,
    span,
    density: start ? grassDensity(ageDays) : 0.18,
    wildCount,
    counts: { memories: memories.length, letters: letters.length, clusters: flowers.filter((f) => f.kind === "cluster").length },
  };
};
