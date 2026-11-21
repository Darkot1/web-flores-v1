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
  wide: { width: 1000, height: 640, horizon: 172, pad: 26 },
  tall: { width: 600, height: 800, horizon: 172, pad: 22 },
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

const KIND_SCALE = { memory: 1.1, letter: 1.4, wild: 0.6, cluster: 1.3, bench: 1, tree: 1.2 };
/** Medio ancho de los símbolos de arco (unidades del sprite). */
const ARCH_HALF = { arch: 60, grand: 72 };

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

  return items
    .map((item) => {
      const rng = createRng(item.id);
      const isArch = item.kind === "arch" || item.kind === "grand";
      const isStatic = isArch || item.kind === "tree";
      let d = clamp(depthFor(item.t) + (isStatic ? 0 : rng.range(-0.015, 0.015)), 0.02, 0.995);
      let p = pathAt(d, dims);
      let x = p.x;
      let side = rng.sign();

      if (isArch) {
        x = p.x;
      } else if (item.kind === "tree") {
        side = -1;
        x = p.x - p.halfWidth - 34 * p.scale;
      } else if (item.kind === "bench") {
        x = p.x + side * (p.halfWidth + 26 * p.scale);
      } else {
        // Todo el prado: desde el borde del camino hasta el borde del jardín.
        const r = item.kind === "wild" ? 0 : 1;
        let found = false;
        for (let attempt = 0; attempt < 10 && !found; attempt += 1) {
          const u = rng.float() ** 0.9;
          const s = attempt % 2 === 0 ? side : -side;
          const gap = p.halfWidth + 12 * p.scale;
          const room = s > 0 ? dims.width - margin - (p.x + gap) : p.x - gap - margin;
          if (room < 20) continue;
          const candidate = p.x + s * (gap + u * room);
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
        // Los arcos abrazan el camino: su escala sale del ancho del camino.
        scale: isArch
          ? Math.round(((p.halfWidth * 1.12 + 6) / ARCH_HALF[item.kind]) * 1000) / 1000
          : Math.round(p.scale * (KIND_SCALE[item.kind] ?? 1) * (isStatic ? 1 : rng.range(0.86, 1.14)) * 1000) / 1000,
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


/**
 * Guirnaldas del cielo: una por año, 12 farolillos (uno por mes). La más
 * antigua arriba; cada año nuevo cuelga un poco más cerca del horizonte.
 */
export const layoutGarland = (lights, dims) => {
  if (!lights.length) return { strands: [], lights: [] };
  const years = Math.max(...lights.map((l) => l.year));
  const sag = dims.width * 0.028;
  const top = dims.horizon * 0.12;
  const bottom = dims.horizon - sag - 40; // cuerda + cordel + farolillo caben sobre el horizonte
  const gap = years > 1 ? Math.min(30, (bottom - top) / (years - 1)) : 0;
  const x0 = -20;
  const span = dims.width + 40;
  const strands = Array.from({ length: years }, (_, i) => {
    const y0 = top + i * gap;
    return { year: i + 1, y0, d: `M${x0} ${y0.toFixed(1)} Q${(dims.width / 2).toFixed(1)} ${(y0 + 2 * sag).toFixed(1)} ${dims.width + 20} ${y0.toFixed(1)}` };
  });
  const laid = lights.map((light) => {
    const strand = strands[light.year - 1];
    const t = (light.slot - 0.5) / 12;
    const rng = createRng(light.id);
    return {
      ...light,
      x: Math.round((x0 + t * span) * 10) / 10,
      y: Math.round((strand.y0 + 4 * sag * t * (1 - t)) * 10) / 10,
      drop: Math.round(rng.range(6, 14) * 10) / 10,
      rotate: Math.round(rng.range(-6, 6) * 10) / 10,
      scale: Math.round(rng.range(0.9, 1.08) * 100) / 100,
    };
  });
  return { strands, lights: laid };
};
