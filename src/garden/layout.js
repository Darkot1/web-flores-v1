/**
 * Ubicación determinista. El jardín es un camino en perspectiva: lo más
 * antiguo queda al fondo (arriba, pequeño) y lo reciente cerca (abajo, grande).
 * Lado, distancia al camino, rotación y escala se derivan del id: el mismo
 * recuerdo cae siempre en el mismo sitio relativo del camino.
 */
import { createRng } from "../lib/seed.js";
import { daysBetween, monthKey } from "../lib/dates.js";
import { seasonFor } from "./growth.js";

export const DIMENSIONS = {
  wide: { width: 1000, height: 620, horizon: 150, pad: 26 },
  tall: { width: 600, height: 780, horizon: 150, pad: 22 },
};

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;

/** t (0 = inicio, 1 = hoy, >1 = futuro) → profundidad visual (0 = fondo, 1 = frente). */
export const depthFor = (t) => (t > 1 ? 0.95 + (t - 1) * 0.8 : 0.04 + 0.88 * clamp(t, 0, 1));

/** Punto central del camino a cierta profundidad. */
export const pathAt = (d, dims) => {
  const { width, height, horizon, pad } = dims;
  const e = d ** 1.45;
  const y = lerp(horizon + 8, height - pad, e);
  const swing = width * 0.2 * (0.35 + 0.65 * d);
  const x = width / 2 + Math.sin(d * Math.PI * 1.55 + 0.5) * swing;
  const halfWidth = lerp(width * 0.012, width * 0.11, e);
  const scale = lerp(0.3, 1.12, e);
  return { x, y, halfWidth, scale };
};

/** Contorno del camino como polígono (bordes izquierdo y derecho). */
export const pathOutline = (dims, steps = 40) => {
  const left = [];
  const right = [];
  for (let i = 0; i <= steps; i += 1) {
    const d = i / steps;
    const p = pathAt(d, dims);
    left.push([p.x - p.halfWidth, p.y]);
    right.push([p.x + p.halfWidth, p.y]);
  }
  const last = pathAt(1, dims);
  return [...left, [last.x - last.halfWidth * 1.3, dims.height], [last.x + last.halfWidth * 1.3, dims.height], ...right.reverse()];
};

const KIND_SCALE = { memory: 1.1, letter: 1.4, wild: 0.6, cluster: 1.3, bench: 1, lamp: 0.85, arch: 1, tree: 1.2 };

/**
 * Coloca cada elemento del modelo. `items` debe venir ordenado (lo hace
 * buildGardenModel) para que la resolución de choques sea determinista.
 */
export const layoutItems = (items, dims) => {
  const cell = 30;
  const occupied = new Map();
  const keyOf = (x, y) => `${Math.round(x / cell)}:${Math.round(y / (cell * 0.6))}`;
  const isFree = (x, y, r) => {
    for (let dx = -r; dx <= r; dx += 1) {
      for (let dy = -r; dy <= r; dy += 1) {
        if (occupied.has(`${Math.round(x / cell) + dx}:${Math.round(y / (cell * 0.6)) + dy}`)) return false;
      }
    }
    return true;
  };
  const margin = dims.width * 0.04;
  let lampIndex = 0;

  return items
    .map((item) => {
      const rng = createRng(item.id);
      const isStatic = item.kind === "lamp" || item.kind === "arch" || item.kind === "tree";
      let d = clamp(depthFor(item.t) + (isStatic ? 0 : rng.range(-0.015, 0.015)), 0.02, 0.995);
      let p = pathAt(d, dims);
      let x = p.x;
      let side = rng.sign();

      if (item.kind === "lamp") {
        side = lampIndex % 2 === 0 ? 1 : -1;
        lampIndex += 1;
        x = p.x + side * (p.halfWidth + 10 * p.scale);
      } else if (item.kind === "arch") {
        x = p.x;
      } else if (item.kind === "tree") {
        side = -1;
        x = p.x - p.halfWidth - 34 * p.scale;
      } else if (item.kind === "bench") {
        x = p.x + side * (p.halfWidth + 26 * p.scale);
      } else {
        const spread = item.kind === "wild" ? dims.width * 0.5 : dims.width * 0.36;
        const r = item.kind === "wild" ? 0 : 1;
        let found = false;
        for (let attempt = 0; attempt < 10 && !found; attempt += 1) {
          const u = rng.float() ** 1.25;
          const s = attempt % 2 === 0 ? side : -side;
          const candidate = p.x + s * (p.halfWidth + 12 * p.scale + u * spread * (0.45 + 0.55 * d));
          if (candidate > margin && candidate < dims.width - margin && (item.kind === "wild" || isFree(candidate, p.y, r))) {
            x = candidate;
            side = s;
            found = true;
          } else if (attempt === 6) {
            d = clamp(d + rng.range(-0.025, 0.025), 0.02, 0.995);
            p = pathAt(d, dims);
          }
        }
        if (!found) x = clamp(p.x + side * (p.halfWidth + 14 * p.scale), margin, dims.width - margin);
      }

      if (item.kind !== "wild") occupied.set(keyOf(x, p.y), item.id);

      return {
        ...item,
        x: Math.round(x * 10) / 10,
        y: Math.round(p.y * 10) / 10,
        depth: d,
        side,
        scale: Math.round(p.scale * (KIND_SCALE[item.kind] ?? 1) * (isStatic ? 1 : rng.range(0.86, 1.14)) * 1000) / 1000,
        rotate: isStatic ? 0 : Math.round(rng.range(-8, 8) * 10) / 10,
        swayDelay: Math.round(rng.range(-6, 0) * 100) / 100,
        swayDuration: Math.round(rng.range(4.5, 7.5) * 100) / 100,
      };
    })
    .sort((a, b) => a.y - b.y || a.x - b.x);
};

/** Matas de pasto: las primeras N siempre son las mismas, así el prado solo se densifica. */
export const layoutGrass = (density, dims, max) => {
  const count = Math.round(density * max);
  const tufts = [];
  for (let n = 0; n < count; n += 1) {
    const rng = createRng(`grass-${n}`);
    const d = rng.float() ** 0.8;
    const p = pathAt(d, dims);
    const side = rng.sign();
    const x = p.x + side * (p.halfWidth + rng.float() * dims.width * 0.55);
    if (x < -10 || x > dims.width + 10) continue;
    tufts.push({ x: Math.round(x), y: Math.round(p.y), scale: Math.round(p.scale * rng.range(0.7, 1.3) * 100) / 100, variant: rng.int(0, 2), flip: rng.chance(0.5) });
  }
  return tufts.sort((a, b) => a.y - b.y);
};

/** Bandas de luz por mes a lo largo del camino: el año que pasa. */
export const seasonBands = ({ start, span, today, climate, dims }) => {
  const bands = [];
  let cursor = `${monthKey(start)}-01`;
  let guard = 0;
  while (daysBetween(cursor, today) >= 0 && guard < 600) {
    const [y, m] = cursor.split("-").map(Number);
    const next = `${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, "0")}-01`;
    const t0 = Math.max(0, daysBetween(start, cursor) / span);
    const t1 = Math.min(1, daysBetween(start, next) / span);
    const y0 = pathAt(depthFor(t0), dims).y;
    const y1 = t1 >= 1 ? dims.height : pathAt(depthFor(t1), dims).y;
    if (y1 > y0) bands.push({ month: monthKey(cursor), y0, y1, season: seasonFor(cursor, climate) });
    cursor = next;
    guard += 1;
  }
  return bands;
};

/** Para tests: dos layouts idénticos para los mismos datos. */
export const layoutSignature = (laid) => laid.map((i) => `${i.id}@${i.x},${i.y},${i.rotate}`).join("|");

