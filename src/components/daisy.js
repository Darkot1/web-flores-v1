/**
 * Margaritas en SVG. Una sola geometría sirve para:
 *  - createDaisy(): un <svg> autónomo (hero, cartas, celdas del calendario).
 *  - buildDaisy():  un <g> para insertar dentro de otro SVG (plantado en vivo).
 *  - daisy symbols: ver garden/symbols.js (usa colores por CSS custom properties).
 *
 * Etapas: seed → sprout → bud → open → full. La semilla (seed) da variación:
 * curvatura del tallo, largo y ángulo de cada pétalo, inclinación de la cabeza.
 */
import { createRng } from "../lib/seed.js";
import { prefersReducedMotion } from "../lib/motion.js";

export const SVG_NS = "http://www.w3.org/2000/svg";

export const PETAL_PALETTES = {
  morada: { petal: "#7B4FBF", inner: "#9A73D8", edge: "#4E2C86", center: "#F2C14E", centerDark: "#A8701C", label: "Morada" },
  lavanda: { petal: "#B79CEB", inner: "#D3C3F5", edge: "#7A62B3", center: "#F2C14E", centerDark: "#A8701C", label: "Lavanda" },
  blanca: { petal: "#FAF6FC", inner: "#FFFFFF", edge: "#B9A8D6", center: "#F2C14E", centerDark: "#A8701C", label: "Blanca" },
  dorada: { petal: "#F2C14E", inner: "#F8D987", edge: "#B98522", center: "#7B4FBF", centerDark: "#3E1F4F", label: "Dorada" },
  ciruela: { petal: "#5B2E7E", inner: "#7B4FBF", edge: "#2E1340", center: "#F2C14E", centerDark: "#A8701C", label: "Ciruela" },
};

export const GREENS = { stem: "#5F8259", leaf: "#86A77F", leafDark: "#5F8259", vein: "#C9DCC3", earth: "#8A6A4F" };

export const STAGES = ["seed", "sprout", "bud", "open", "full"];

const STEM_HEIGHT = 100;

export const el = (tag, attrs = {}, children = []) => {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value !== undefined && value !== null && value !== false) node.setAttribute(key, String(value));
  }
  for (const child of children) if (child) node.append(child);
  return node;
};

const r1 = (n) => Math.round(n * 10) / 10;

/** Punto de una Bézier cúbica. */
const bezier = (p0, p1, p2, p3, t) => {
  const u = 1 - t;
  return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
};

export const petalPath = (length, width) => {
  const L = length;
  const w = width;
  return (
    `M0 0 C${r1(w * 0.9)} ${r1(-L * 0.22)} ${r1(w)} ${r1(-L * 0.74)} ${r1(w * 0.38)} ${r1(-L * 0.97)}` +
    ` Q${r1(w * 0.16)} ${r1(-L * 1.03)} 0 ${r1(-L * 0.93)}` +
    ` Q${r1(-w * 0.16)} ${r1(-L * 1.03)} ${r1(-w * 0.38)} ${r1(-L * 0.97)}` +
    ` C${r1(-w)} ${r1(-L * 0.74)} ${r1(-w * 0.9)} ${r1(-L * 0.22)} 0 0Z`
  );
};

const leafPath = (l, w) =>
  `M0 0 C${r1(l * 0.3)} ${r1(-w)} ${r1(l * 0.72)} ${r1(-w * 0.95)} ${r1(l)} 0 C${r1(l * 0.7)} ${r1(w * 0.55)} ${r1(l * 0.3)} ${r1(w * 0.65)} 0 0Z`;

/**
 * Colores: por defecto valores directos; con `useVars` se emiten como
 * custom properties para que cada <use> del jardín pueda teñirlos.
 */
const paint = (palette, useVars) =>
  useVars
    ? {
        petal: "var(--petal, #7B4FBF)",
        inner: "var(--petal-inner, #9A73D8)",
        edge: "var(--petal-edge, #4E2C86)",
        center: "var(--center, #F2C14E)",
        centerDark: "var(--center-dark, #A8701C)",
        stem: "var(--stem, #5F8259)",
        leaf: "var(--leaf, #86A77F)",
        ribbon: "var(--ribbon, #C24D7A)",
      }
    : { ...palette, stem: GREENS.stem, leaf: GREENS.leaf, ribbon: palette.ribbon ?? "#C24D7A" };

const fill = (color) => ({ style: `fill:${color}` });

const buildCenter = (radius, colors, rng) => {
  const dots = [];
  const n = Math.round(radius * 2.6);
  for (let i = 1; i < n; i += 1) {
    const rr = Math.sqrt(i / n) * radius * 0.82;
    const a = i * 2.39996;
    dots.push(el("circle", { cx: r1(Math.cos(a) * rr), cy: r1(Math.sin(a) * rr), r: r1(0.55 + rng.float() * 0.35), ...fill(colors.centerDark), opacity: 0.55 }));
  }
  return el("g", { class: "daisy__center" }, [
    el("circle", { r: radius, ...fill(colors.center) }),
    el("circle", { r: radius, fill: "none", style: `stroke:${colors.centerDark}`, "stroke-width": 0.8, opacity: 0.5 }),
    ...dots,
    el("circle", { cx: r1(-radius * 0.3), cy: r1(-radius * 0.35), r: r1(radius * 0.32), fill: "#fff", opacity: 0.35 }),
  ]);
};

const buildPetals = ({ count, length, width, colors, rng, inner = false, open = 1 }) => {
  const group = el("g", { class: inner ? "daisy__petals daisy__petals--inner" : "daisy__petals" });
  const offset = inner ? 180 / count : 0;
  for (let i = 0; i < count; i += 1) {
    const angle = (360 / count) * i + offset + rng.range(-4, 4);
    const L = length * rng.range(0.88, 1.1) * open;
    const w = width * rng.range(0.9, 1.08);
    const petal = el("path", {
      class: "daisy__petal",
      d: petalPath(L, w),
      style: `fill:${inner ? colors.inner : colors.petal};stroke:${colors.edge}`,
      "stroke-width": inner ? 0 : 0.5,
      "stroke-opacity": 0.45,
    });
    const rib = el("path", { d: `M0 -3 L0 ${r1(-L * 0.82)}`, stroke: "#fff", "stroke-opacity": inner ? 0 : 0.28, "stroke-width": 0.7, fill: "none", "stroke-linecap": "round" });
    const wrap = el("g", { transform: `rotate(${r1(angle)})` }, [el("g", { class: "daisy__petal-wrap", "data-i": i }, [petal, rib])]);
    group.append(wrap);
  }
  return group;
};

const buildLeaf = (x, y, angle, length, width, colors, flip) =>
  el("g", { transform: `translate(${r1(x)} ${r1(y)}) rotate(${r1(angle)})${flip ? " scale(-1 1)" : ""}` }, [
    el("g", { class: "daisy__leaf" }, [
      el("path", { d: leafPath(length, width), ...fill(colors.leaf) }),
      el("path", { d: `M0 0 Q${r1(length * 0.5)} ${r1(-width * 0.15)} ${r1(length * 0.94)} 0`, fill: "none", stroke: GREENS.vein, "stroke-width": 0.6, opacity: 0.7 }),
    ]),
  ]);

const buildRibbon = (x, y, colors) =>
  el("g", { class: "daisy__ribbon", transform: `translate(${r1(x)} ${r1(y)})` }, [
    el("path", { d: "M0 0 C-9 -8 -14 -1 -10 3 C-7 6 -3 3 0 0Z", ...fill(colors.ribbon) }),
    el("path", { d: "M0 0 C9 -8 14 -1 10 3 C7 6 3 3 0 0Z", ...fill(colors.ribbon) }),
    el("path", { d: "M0 0 C-2 6 -5 11 -8 15 M0 0 C2 6 4 11 7 14", fill: "none", style: `stroke:${colors.ribbon}`, "stroke-width": 1.6, "stroke-linecap": "round" }),
    el("circle", { r: 2.2, ...fill(colors.ribbon), opacity: 0.9 }),
  ]);

/**
 * Construye el <g> de una margarita con la base del tallo en (0,0) y la
 * cabeza hacia arriba (y negativa).
 */
export const buildDaisy = ({
  petals = 16,
  color = "morada",
  centerColor,
  stage = "full",
  seed = "daisy",
  ribbon = false,
  ribbonColor,
  stemHeight = STEM_HEIGHT,
  useVars = false,
} = {}) => {
  const rng = createRng(seed);
  const palette = { ...(PETAL_PALETTES[color] ?? PETAL_PALETTES.morada) };
  if (centerColor) palette.center = centerColor;
  if (ribbonColor) palette.ribbon = ribbonColor;
  const colors = paint(palette, useVars);
  const root = el("g", { class: `daisy daisy--${stage}`, "data-stage": stage });
  const body = el("g", { class: "daisy__body" });
  root.append(body);

  if (stage === "seed") {
    body.append(
      el("ellipse", { cx: 0, cy: 1, rx: 15, ry: 4, fill: GREENS.earth, opacity: 0.55 }),
      el("g", { class: "daisy__seed" }, [
        el("ellipse", { cx: 0, cy: -2.5, rx: 4.2, ry: 2.8, transform: `rotate(${r1(rng.range(-25, 25))})`, fill: "#6E5139" }),
        el("path", { d: "M-1.5 -4 Q0 -5.2 1.8 -4", stroke: "#C9A985", "stroke-width": 0.7, fill: "none" }),
      ]),
    );
    return root;
  }

  const bend = rng.range(-9, 9);
  const H = stage === "sprout" ? stemHeight * 0.36 : stage === "bud" ? stemHeight * 0.86 : stemHeight;
  const c1 = bend * 0.6 + rng.range(-4, 4);
  const c2 = bend * 1.2;
  const bx = bend * 0.7;
  body.append(el("ellipse", { cx: 0, cy: 1, rx: 12, ry: 3, fill: GREENS.earth, opacity: 0.35 }));
  body.append(
    el("path", {
      class: "daisy__stem",
      d: `M0 0 C${r1(c1)} ${r1(-H * 0.35)} ${r1(c2)} ${r1(-H * 0.7)} ${r1(bx)} ${r1(-H)}`,
      fill: "none",
      style: `stroke:${colors.stem}`,
      "stroke-width": stage === "sprout" ? 2.2 : 2.6,
      "stroke-linecap": "round",
      pathLength: 1,
    }),
  );
  const stemAt = (t) => ({ x: bezier(0, c1, c2, bx, t), y: bezier(0, -H * 0.35, -H * 0.7, -H, t) });

  if (stage === "sprout") {
    const top = stemAt(1);
    body.append(
      buildLeaf(top.x, top.y, -35 + rng.range(-8, 8), 16, 7, colors, false),
      buildLeaf(top.x, top.y, -145 + rng.range(-8, 8), 15, 6.5, colors, false),
    );
    return root;
  }

  const leafCount = stage === "full" ? 3 : 2;
  for (let i = 0; i < leafCount; i += 1) {
    const t = 0.16 + i * 0.2 + rng.range(-0.04, 0.04);
    const p = stemAt(t);
    const right = (i + (rng.float() < 0.5 ? 0 : 1)) % 2 === 0;
    const len = (stage === "full" ? 30 : 24) * (1 - i * 0.12) * rng.range(0.9, 1.1);
    body.append(buildLeaf(p.x, p.y, right ? -28 + rng.range(-10, 6) : -152 + rng.range(-6, 10), len, len * 0.27, colors, false));
  }

  if (ribbon) {
    const p = stemAt(0.42);
    body.append(buildRibbon(p.x, p.y, colors));
  }

  const tilt = rng.range(-10, 10);
  const head = el("g", { class: "daisy__head", transform: `translate(${r1(bx)} ${r1(-H)}) rotate(${r1(tilt)})` });
  body.append(head);

  if (stage === "bud") {
    const tips = el("g", { class: "daisy__bud-tips" });
    for (const a of [-22, -8, 8, 22]) {
      tips.append(el("path", { d: petalPath(13, 3.4), transform: `translate(0 -6) rotate(${a})`, style: `fill:${colors.petal}` }));
    }
    head.append(
      tips,
      el("path", { d: "M0 5 C8 3 8.5 -6 2 -13 L0 -9 L-2 -13 C-8.5 -6 -8 3 0 5Z", style: `fill:${colors.leaf}` }),
      el("path", { d: "M-5 -1 L-1 -8 M5 -1 L1 -8", stroke: GREENS.leafDark, "stroke-width": 0.8, fill: "none", opacity: 0.6 }),
    );
    return root;
  }

  const open = stage === "open" ? 0.74 : 1;
  const cup = el("g", { transform: stage === "open" ? "scale(1 0.84)" : undefined });
  head.append(cup);
  const length = 27;
  cup.append(buildPetals({ count: petals, length, width: 9.2 * (13 / Math.max(petals, 13)) ** 0.6 + 1.2, colors, rng, open }));
  if (stage === "full") {
    cup.append(buildPetals({ count: Math.round(petals * 0.6), length: length * 0.62, width: 4.6, colors, rng, inner: true }));
  }
  cup.append(buildCenter(stage === "full" ? 7.5 : 6.2, colors, rng));
  return root;
};

/** Un <svg> autónomo con una margarita. `size` es el ancho en px. */
export const createDaisy = ({ size = 120, label, className = "", ...options } = {}) => {
  const svg = el("svg", {
    class: `daisy-svg ${className}`.trim(),
    viewBox: "-50 -146 100 154",
    width: size,
    height: Math.round(size * 1.54),
    role: label ? "img" : undefined,
    "aria-label": label,
    "aria-hidden": label ? undefined : "true",
    focusable: "false",
  });
  svg.append(buildDaisy(options));
  return svg;
};

/** Ease orgánicos. */
const EASE_STEM = "cubic-bezier(.3,0,.2,1)";
const EASE_BLOOM = "cubic-bezier(.34,1.35,.64,1)";
const EASE_SOFT = "cubic-bezier(.22,.8,.3,1)";

/**
 * Anima el crecimiento de una margarita construida con buildDaisy.
 * Devuelve { finished: Promise, finish() } para poder saltarla.
 */
export const growDaisy = (root, { delay = 0, speed = 1, petalStagger = 38 } = {}) => {
  const animations = [];
  if (prefersReducedMotion() || !root.animate) {
    return { finished: Promise.resolve(), finish: () => {} };
  }
  const d = (ms) => ms / speed;
  const add = (node, keyframes, options) => {
    if (!node) return;
    animations.push(node.animate(keyframes, { fill: "backwards", ...options }));
  };

  const stem = root.querySelector(".daisy__stem");
  const stemDur = d(900);
  add(stem, [{ strokeDasharray: "1 1", strokeDashoffset: 1 }, { strokeDasharray: "1 1", strokeDashoffset: 0 }], { duration: stemDur, delay, easing: EASE_STEM });

  root.querySelectorAll(".daisy__leaf").forEach((leaf, i) => {
    add(leaf, [{ transform: "scale(0) rotate(-30deg)", opacity: 0 }, { transform: "scale(1) rotate(0deg)", opacity: 1 }], {
      duration: d(520),
      delay: delay + d(260 + i * 150),
      easing: EASE_SOFT,
    });
  });

  add(root.querySelector(".daisy__ribbon"), [{ transform: "scale(0)", opacity: 0 }, { transform: "scale(1)", opacity: 1 }], { duration: d(500), delay: delay + d(700), easing: EASE_BLOOM });

  const headDelay = delay + stemDur * 0.85;
  add(root.querySelector(".daisy__bud-tips"), [{ transform: "scale(.2)", opacity: 0 }, { transform: "scale(1)", opacity: 1 }], { duration: d(500), delay: headDelay, easing: EASE_BLOOM });
  add(root.querySelector(".daisy__seed"), [{ transform: "translateY(-40px)", opacity: 0 }, { transform: "translateY(0)", opacity: 1 }], { duration: d(600), delay, easing: "cubic-bezier(.5,0,.9,.6)" });

  const petals = [...root.querySelectorAll(".daisy__petals:not(.daisy__petals--inner) .daisy__petal-wrap")];
  const inner = [...root.querySelectorAll(".daisy__petals--inner .daisy__petal-wrap")];
  petals.forEach((petal, i) => {
    add(petal, [{ transform: "scale(.15, .05)", opacity: 0 }, { transform: "scale(1, 1)", opacity: 1 }], {
      duration: d(560),
      delay: headDelay + d(120) + d(i * petalStagger),
      easing: EASE_BLOOM,
    });
  });
  const petalsEnd = headDelay + d(120) + d(petals.length * petalStagger);
  inner.forEach((petal, i) => {
    add(petal, [{ transform: "scale(.1)", opacity: 0 }, { transform: "scale(1)", opacity: 1 }], { duration: d(480), delay: petalsEnd - d(200) + d(i * 30), easing: EASE_BLOOM });
  });
  add(root.querySelector(".daisy__center"), [{ transform: "scale(0)" }, { transform: "scale(1.12)", offset: 0.7 }, { transform: "scale(1)" }], {
    duration: d(520),
    delay: headDelay,
    easing: EASE_SOFT,
  });

  return {
    animations,
    finished: Promise.all(animations.map((a) => a.finished.catch(() => {}))),
    finish: () => animations.forEach((a) => a.finish()),
  };
};
