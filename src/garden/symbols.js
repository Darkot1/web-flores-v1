/**
 * Sprite de símbolos del jardín. Se construye una vez y cada flor del jardín
 * (y de las celdas del calendario) es un <use> ligero que lo referencia.
 * Los colores llegan por custom properties: --petal, --center, etc.
 */
import { buildDaisy, el, PETAL_PALETTES, GREENS } from "../components/daisy.js";

export const DAISY_SCALE = 0.8;
const PETAL_VARIANTS = [13, 16, 21];

export const symbolSeed = (stage, petals) => `sym-${stage}-${petals}`;

/** id del símbolo para una flor dada. */
export const daisySymbolId = (stage, petals = 16, ribbon = false) => {
  if (stage === "seed" || stage === "sprout") return `d-${stage}`;
  if (stage === "bud") return ribbon ? "d-bud-r" : "d-bud";
  const p = PETAL_VARIANTS.includes(petals) ? petals : 16;
  return `d-${stage}-${p}${ribbon ? "-r" : ""}`;
};

/** Custom properties de color para un <use>. */
export const paletteVars = (color, extra = {}) => {
  const p = PETAL_PALETTES[color] ?? PETAL_PALETTES.morada;
  const vars = { "--petal": p.petal, "--petal-inner": p.inner, "--petal-edge": p.edge, "--center": p.center, "--center-dark": p.centerDark, ...extra };
  return Object.entries(vars)
    .map(([k, v]) => `${k}:${v}`)
    .join(";");
};

const wrap = (id, children, transform) => el("g", { id, transform }, children);

const wildflower = (stage) => {
  const g = el("g", {});
  g.append(el("path", { d: "M0 0 Q2 -14 0 -26", fill: "none", stroke: GREENS.stem, "stroke-width": 1.6, "stroke-linecap": "round" }));
  g.append(el("path", { d: "M0 -8 Q6 -12 9 -8 Q5 -6 0 -8Z", fill: GREENS.leaf }));
  if (stage === "bud") {
    g.append(el("ellipse", { cx: 0, cy: -28, rx: 2.6, ry: 3.6, style: "fill:var(--petal,#C9B6F2)" }));
  } else {
    const head = el("g", { transform: "translate(0 -27)" });
    for (let i = 0; i < 6; i += 1) {
      head.append(el("ellipse", { cx: 0, cy: -4, rx: 2.3, ry: 4.4, transform: `rotate(${i * 60})`, style: "fill:var(--petal,#C9B6F2)" }));
    }
    head.append(el("circle", { r: 2.2, style: "fill:var(--center,#F2C14E)" }));
    g.append(head);
  }
  return g;
};

const tuft = (variant) => {
  const blades = [
    ["M0 0 Q-3 -10 -8 -16", "M0 0 Q0 -12 2 -20", "M0 0 Q4 -9 9 -13"],
    ["M0 0 Q-5 -8 -10 -10", "M0 0 Q-1 -14 -3 -18", "M0 0 Q3 -12 6 -17", "M0 0 Q6 -6 11 -8"],
    ["M0 0 Q-2 -9 -5 -13", "M0 0 Q2 -10 4 -15"],
  ][variant];
  return el(
    "g",
    {},
    blades.map((d, i) => el("path", { d, fill: "none", stroke: i % 2 ? "var(--grass-b,#7E9F78)" : "var(--grass-a,#93B28C)", "stroke-width": 1.8, "stroke-linecap": "round" })),
  );
};

const lamp = () =>
  el("g", { class: "lamp" }, [
    el("circle", { class: "lamp__glow", cx: 0, cy: -62, r: 34, fill: "url(#lamp-glow)" }),
    el("ellipse", { cx: 0, cy: 1, rx: 7, ry: 2, fill: "#3e1f4f", opacity: 0.2 }),
    el("path", { d: "M-1.6 0 L-1.2 -54 L1.2 -54 L1.6 0Z", fill: "#4a3a52" }),
    el("path", { d: "M0 -54 Q7 -58 9 -52", fill: "none", stroke: "#4a3a52", "stroke-width": 1.4 }),
    el("path", { d: "M-6 -56 L6 -56 L4.5 -70 L-4.5 -70Z", fill: "#4a3a52" }),
    el("path", { class: "lamp__light", d: "M-4.4 -57.5 L4.4 -57.5 L3.4 -68.5 L-3.4 -68.5Z", fill: "#f8e3a8" }),
    el("path", { d: "M-7 -70 L0 -76 L7 -70Z", fill: "#3e1f4f" }),
  ]);

const arch = () => {
  const g = el("g", { class: "arch" });
  g.append(
    el("path", { d: "M-46 0 L-46 -70 Q0 -120 46 -70 L46 0", fill: "none", stroke: "#6e5139", "stroke-width": 3.2, "stroke-linecap": "round" }),
    el("path", { d: "M-46 -70 Q0 -120 46 -70", fill: "none", stroke: "#5f8259", "stroke-width": 9, "stroke-linecap": "round", opacity: 0.85 }),
  );
  const colors = ["#7B4FBF", "#C9B6F2", "#FAF6FC", "#7B4FBF", "#F2C14E", "#7B4FBF", "#B79CEB"];
  for (let i = 0; i <= 12; i += 1) {
    const t = i / 12;
    const a = Math.PI * (1 - t);
    const x = Math.cos(a) * 46;
    const y = -70 - Math.sin(a) * 28 - (1 - Math.abs(0.5 - t) * 2) * 6;
    const fillColor = colors[i % colors.length];
    const head = el("g", { transform: `translate(${x.toFixed(1)} ${y.toFixed(1)})` });
    for (let p = 0; p < 7; p += 1) head.append(el("ellipse", { cx: 0, cy: -3.6, rx: 1.9, ry: 3.8, transform: `rotate(${p * 51})`, fill: fillColor }));
    head.append(el("circle", { r: 1.7, fill: "#F2C14E" }));
    g.append(head);
  }
  for (const side of [-1, 1]) {
    for (let i = 0; i < 4; i += 1) {
      g.append(el("path", { d: `M${side * 46} ${-12 - i * 15} q${side * 7} -4 ${side * 9} 2 q${side * -5} 3 ${side * -9} -2z`, fill: "#86A77F" }));
    }
  }
  return g;
};

const tree = (stage) => {
  const s = { sapling: 0.45, young: 0.72, tree: 1 }[stage] ?? 1;
  const g = el("g", { transform: `scale(${s})` });
  g.append(
    el("ellipse", { cx: 0, cy: 2, rx: 40, ry: 6, fill: "#3e1f4f", opacity: 0.12 }),
    el("path", { d: "M-5 0 C-4 -30 -7 -55 -2 -80 L3 -80 C6 -55 5 -30 6 0Z", fill: "#7a5b41" }),
    el("path", { d: "M0 -55 Q-14 -66 -22 -74 M1 -64 Q14 -72 20 -84", fill: "none", stroke: "#7a5b41", "stroke-width": 3, "stroke-linecap": "round" }),
  );
  const blobs = [
    [-24, -92, 26, "#86A77F"],
    [22, -98, 28, "#7E9F78"],
    [0, -118, 30, "#93B28C"],
    [-8, -84, 22, "#9DB59A"],
    [16, -80, 20, "#86A77F"],
  ];
  for (const [cx, cy, r, fillColor] of blobs) g.append(el("circle", { cx, cy, r, fill: fillColor }));
  const flowers = [[-26, -100], [18, -112], [2, -128], [28, -88], [-12, -80], [6, -96]];
  for (const [x, y] of flowers) {
    const head = el("g", { transform: `translate(${x} ${y})` });
    for (let p = 0; p < 8; p += 1) head.append(el("ellipse", { cx: 0, cy: -3.2, rx: 1.7, ry: 3.4, transform: `rotate(${p * 45})`, fill: "#7B4FBF" }));
    head.append(el("circle", { r: 1.6, fill: "#F2C14E" }));
    g.append(head);
  }
  return g;
};

const bench = () =>
  el("g", {}, [
    el("ellipse", { cx: 0, cy: 2, rx: 30, ry: 4, fill: "#3e1f4f", opacity: 0.14 }),
    el("path", { d: "M-24 0 L-22 -12 M24 0 L22 -12 M-20 -12 L-20 -30 M20 -12 L20 -30", stroke: "#6e5139", "stroke-width": 2.6, "stroke-linecap": "round" }),
    el("rect", { x: -27, y: -15, width: 54, height: 4.5, rx: 1.5, fill: "#8a6a4f" }),
    el("rect", { x: -25, y: -32, width: 50, height: 4, rx: 1.5, fill: "#8a6a4f" }),
    el("rect", { x: -25, y: -25, width: 50, height: 4, rx: 1.5, fill: "#8a6a4f" }),
    // mata de lavanda junto a la banca
    ...[-34, -38, -30, -36].map((x, i) =>
      el("path", { d: `M${x} 0 Q${x - 1} -12 ${x + (i - 1.5) * 2} -22`, fill: "none", stroke: "#9b7fd6", "stroke-width": 3, "stroke-linecap": "round", "stroke-dasharray": "2 1.4" }),
    ),
  ]);

const cluster = () => {
  const g = el("g", {});
  g.append(
    el("ellipse", { cx: 0, cy: 1, rx: 38, ry: 6, fill: "#3e1f4f", opacity: 0.12 }),
    el("path", { d: "M-36 0 C-40 -22 -22 -40 -4 -36 C8 -48 34 -40 34 -18 C42 -12 38 0 30 0Z", fill: "#86A77F" }),
    el("path", { d: "M-24 -6 C-26 -20 -12 -28 0 -22 C10 -30 26 -22 22 -8", fill: "#9DB59A", opacity: 0.8 }),
  );
  const heads = [[-22, -30, 0.42], [0, -44, 0.5], [20, -32, 0.44], [-6, -24, 0.38], [28, -14, 0.34], [-30, -12, 0.32]];
  for (const [x, y, s] of heads) g.append(el("use", { href: "#d-head", transform: `translate(${x} ${y}) scale(${s})` }));
  return g;
};

/** Solo la cabeza de una margarita (para matas). */
const daisyHead = () => {
  const full = buildDaisy({ stage: "full", petals: 16, seed: "sym-head", useVars: true });
  const head = full.querySelector(".daisy__head");
  head.setAttribute("transform", "");
  return head;
};

const emptySeed = () =>
  el("g", { class: "empty-seed" }, [
    el("ellipse", { cx: 0, cy: 2, rx: 34, ry: 8, fill: "#8a6a4f", opacity: 0.4 }),
    el("ellipse", { cx: 0, cy: 0, rx: 22, ry: 5, fill: "#6e5139", opacity: 0.55 }),
    el("g", { class: "empty-seed__body" }, [
      el("ellipse", { cx: 0, cy: -5, rx: 7, ry: 4.6, transform: "rotate(-18)", fill: "#6e5139" }),
      el("path", { d: "M-2 -8 Q1 -9.6 4 -8", stroke: "#c9a985", "stroke-width": 1, fill: "none" }),
    ]),
  ]);

let defs = null;
const built = new Set();

const scale = () => `scale(${DAISY_SCALE})`;
const daisyBuilder = (stage, petals, ribbon) => () =>
  wrap(daisySymbolId(stage, petals, ribbon), [buildDaisy({ stage, petals, seed: symbolSeed(stage, petals), ribbon, useVars: true })], scale());

/** Constructores de cada símbolo: solo se crean cuando alguien los usa. */
const builder = (id) => {
  if (id === "d-seed") return daisyBuilder("seed", 16);
  if (id === "d-sprout") return daisyBuilder("sprout", 16);
  if (id === "d-bud") return daisyBuilder("bud", 16);
  if (id === "d-bud-r") return daisyBuilder("bud", 16, true);
  const m = id.match(/^d-(open|full)-(\d+)(-r)?$/);
  if (m) return daisyBuilder(m[1], Number(m[2]), Boolean(m[3]));
  const simple = {
    "d-head": () => wrap("d-head", [daisyHead()]),
    "w-bud": () => wrap("w-bud", [wildflower("bud")]),
    "w-open": () => wrap("w-open", [wildflower("open")]),
    lamp: () => wrap("lamp", [lamp()]),
    arch: () => wrap("arch", [arch()]),
    bench: () => wrap("bench", [bench()]),
    cluster: () => {
      symbolHref("d-head");
      return wrap("cluster", [cluster()]);
    },
    "empty-seed": () => wrap("empty-seed", [emptySeed()]),
  };
  if (simple[id]) return simple[id];
  const g = id.match(/^grass-(\d)$/);
  if (g) return () => wrap(id, [tuft(Number(g[1]))]);
  const t = id.match(/^tree-(sapling|young|tree)$/);
  if (t) return () => wrap(id, [tree(t[1])]);
  return null;
};

/** Inserta el contenedor del sprite (idempotente). */
export const ensureGardenSprite = () => {
  if (defs) return;
  const svg = el("svg", { id: "garden-sprite", width: 0, height: 0, "aria-hidden": "true", focusable: "false", style: "position:absolute;width:0;height:0;overflow:hidden" });
  defs = el("defs");
  svg.append(defs);
  defs.append(
    el("radialGradient", { id: "lamp-glow" }, [
      el("stop", { offset: "0", "stop-color": "#f8e3a8", "stop-opacity": "0.9" }),
      el("stop", { offset: "0.35", "stop-color": "#f2c14e", "stop-opacity": "0.35" }),
      el("stop", { offset: "1", "stop-color": "#f2c14e", "stop-opacity": "0" }),
    ]),
  );
  document.body.prepend(svg);
};

/** Devuelve "#id" asegurando que el símbolo existe en el sprite. */
export const symbolHref = (id) => {
  ensureGardenSprite();
  if (!built.has(id)) {
    const make = builder(id);
    if (make) {
      defs.append(make());
      built.add(id);
    }
  }
  return `#${id}`;
};
