/**
 * Sprite de símbolos del jardín. Se construye una vez y cada flor del jardín
 * (y de las celdas del calendario) es un <use> ligero que lo referencia.
 * Los colores llegan por custom properties: --petal, --center, etc.
 */
import { buildDaisy, el, PETAL_PALETTES, GREENS } from "../components/daisy.js";
import { createRng } from "../lib/seed.js";

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
    el("ellipse", { cx: 0, cy: 1, rx: 7, ry: 2, fill: "#3e1f4f", opacity: 0.2 }),
    el("path", { d: "M-1.6 0 L-1.2 -54 L1.2 -54 L1.6 0Z", fill: "#4a3a52" }),
    el("path", { d: "M0 -54 Q7 -58 9 -52", fill: "none", stroke: "#4a3a52", "stroke-width": 1.4 }),
    el("path", { d: "M-6 -56 L6 -56 L4.5 -70 L-4.5 -70Z", fill: "#4a3a52" }),
    el("path", { class: "lamp__light", d: "M-4.4 -57.5 L4.4 -57.5 L3.4 -68.5 L-3.4 -68.5Z", style: "fill:var(--lamp-light,#e9e1d3)" }),
    el("path", { d: "M-7 -70 L0 -76 L7 -70Z", fill: "#3e1f4f" }),
  ]);

/** Cabecita de flor para arcos (colores por variable para teñir por temporada). */
const archFlower = (x, y, fill, size = 1) => {
  const head = el("g", { transform: `translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${size})` });
  for (let p = 0; p < 8; p += 1) head.append(el("ellipse", { cx: 0, cy: -3.6, rx: 1.9, ry: 3.8, transform: `rotate(${p * 45})`, style: `fill:${fill}` }));
  head.append(el("circle", { r: 1.7, fill: "#F2C14E" }));
  return head;
};

const ARCH_FILLS = ["var(--arch-a,#7B4FBF)", "var(--arch-b,#C9B6F2)", "var(--arch-c,#FAF6FC)"];

/** Arco de flores (cada 3 meses). Mide ±46 de ancho y ~120 de alto. */
const arch = () => {
  const g = el("g", { class: "arch" });
  g.append(
    el("ellipse", { cx: -46, cy: 1, rx: 7, ry: 2, fill: "#3e1f4f", opacity: 0.15 }),
    el("ellipse", { cx: 46, cy: 1, rx: 7, ry: 2, fill: "#3e1f4f", opacity: 0.15 }),
    el("path", { d: "M-46 0 L-46 -70 Q0 -122 46 -70 L46 0", fill: "none", stroke: "#6e5139", "stroke-width": 3.4, "stroke-linecap": "round" }),
    el("path", { d: "M-46 -70 Q0 -122 46 -70", fill: "none", stroke: "#5f8259", "stroke-width": 10, "stroke-linecap": "round", opacity: 0.9 }),
  );
  for (const side of [-1, 1]) {
    for (let i = 0; i < 5; i += 1) {
      g.append(el("path", { d: `M${side * 46} ${-8 - i * 13} q${side * 8} -5 ${side * 10} 2 q${side * -6} 4 ${side * -10} -2z`, fill: i % 2 ? "#86A77F" : "#9DB59A" }));
      if (i % 2 === 0) g.append(archFlower(side * (46 + 5), -14 - i * 13, ARCH_FILLS[(i / 2) % 3], 0.75));
    }
  }
  for (let i = 0; i <= 14; i += 1) {
    const t = i / 14;
    const x = (t * 2 - 1) * 46;
    const y = -70 - 52 * 2 * t * (1 - t) * 1.0 + (i % 2 ? 3 : -2);
    g.append(archFlower(x, y, ARCH_FILLS[i % 3], i % 4 === 0 ? 1.15 : 1));
  }
  return g;
};

/** Farolillo de papel colgante (se enciende de noche con --lamp-light). */
const paperLantern = (x, y, size = 1) =>
  el("g", { transform: `translate(${x} ${y}) scale(${size})` }, [
    el("path", { d: "M0 -10 L0 -4", stroke: "#4a3a52", "stroke-width": 0.9 }),
    el("ellipse", { cx: 0, cy: 2, rx: 5.2, ry: 6.4, style: "fill:var(--lantern-fill,var(--lamp-light,#f3e3b8))" }),
    el("path", { d: "M-5 2 h10 M-4.4 -1.5 h8.8 M-4.4 5.5 h8.8", stroke: "#c9a050", "stroke-width": 0.5, opacity: 0.6 }),
    el("rect", { x: -2.6, y: -5.2, width: 5.2, height: 1.6, rx: 0.6, fill: "#4a3a52" }),
    el("rect", { x: -2.6, y: 8, width: 5.2, height: 1.4, rx: 0.6, fill: "#4a3a52" }),
  ]);

/** El gran arco de cada aniversario: doble corona morada y dorada, con farolillos. ±72 de ancho, ~118 de alto. */
const grandArch = () => {
  const W = 72;
  const H = 64;
  const R = 52;
  const g = el("g", { class: "arch arch--grand" });
  const crown = (w, h, r) => `M${-w} ${-h} Q0 ${-h - 2 * r} ${w} ${-h}`;
  g.append(
    el("ellipse", { cx: 0, cy: 2, rx: 84, ry: 6, fill: "#3e1f4f", opacity: 0.12 }),
    el("path", { d: `M${-W} 0 L${-W} ${-H} Q0 ${-H - 2 * R} ${W} ${-H} L${W} 0`, fill: "none", stroke: "#5b4636", "stroke-width": 4.4, "stroke-linecap": "round" }),
    el("path", { d: `M${-W + 8} 0 L${-W + 8} ${-H + 2} Q0 ${-H - 2 * R + 14} ${W - 8} ${-H + 2} L${W - 8} 0`, fill: "none", stroke: "#6e5139", "stroke-width": 2.4, "stroke-linecap": "round" }),
    el("path", { d: crown(W, H, R), fill: "none", stroke: "#5f8259", "stroke-width": 13, "stroke-linecap": "round", opacity: 0.92 }),
  );
  const fills = ["var(--g1,#7B4FBF)", "var(--g2,#F2C14E)", "var(--g3,#B79CEB)", "var(--g1,#7B4FBF)", "#FAF6FC", "var(--g4,#5B2E7E)"];
  for (let i = 0; i <= 18; i += 1) {
    const t = i / 18;
    g.append(archFlower((t * 2 - 1) * W, -H - R * 4 * t * (1 - t) + (i % 2 ? 3 : -3), fills[i % fills.length], i % 3 === 0 ? 1.25 : 1));
  }
  for (let i = 0; i <= 10; i += 1) {
    const t = i / 10;
    g.append(archFlower((t * 2 - 1) * (W - 4), -H - 10 - (R - 2) * 4 * t * (1 - t), fills[(i + 2) % fills.length], 0.75));
  }
  for (const side of [-1, 1]) {
    for (let i = 0; i < 5; i += 1) {
      g.append(el("path", { d: `M${side * W} ${-8 - i * 12} q${side * 9} -5 ${side * 11} 2 q${side * -6} 4 ${side * -11} -2z`, fill: i % 2 ? "#86A77F" : "#9DB59A" }));
      if (i % 2 === 0) g.append(archFlower(side * (W + 6), -14 - i * 12, fills[(i + 1) % fills.length], 0.85));
    }
    // un farolillo colgando a cada lado
    g.append(paperLantern(side * 40, -96, 1.2));
  }
  return g;
};

/** Árbol en flor (algunos meses): copa redonda teñida por la temporada. ~110 de alto. */
const bloomTree = () => {
  const g = el("g", { class: "bloom-tree" });
  g.append(
    el("ellipse", { cx: 0, cy: 2, rx: 30, ry: 5, fill: "#3e1f4f", opacity: 0.12 }),
    el("path", { d: "M-4 0 C-3 -24 -6 -44 -2 -62 L3 -62 C6 -44 4 -24 5 0Z", fill: "#7a5b41" }),
    el("path", { d: "M0 -46 Q-12 -54 -18 -62 M1 -52 Q12 -60 17 -70", fill: "none", stroke: "#7a5b41", "stroke-width": 2.6, "stroke-linecap": "round" }),
  );
  const blobs = [
    [-18, -78, 21, "var(--bloom-a,#B79CEB)"],
    [18, -82, 22, "var(--bloom-b,#9A73D8)"],
    [0, -98, 24, "var(--bloom-a,#B79CEB)"],
    [-6, -70, 17, "var(--bloom-c,#86A77F)"],
    [12, -66, 15, "var(--bloom-b,#9A73D8)"],
  ];
  for (const [cx, cy, r, fill] of blobs) g.append(el("circle", { cx, cy, r, style: `fill:${fill}` }));
  const dots = [[-22, -86], [-8, -104], [10, -96], [22, -78], [-14, -66], [4, -80], [16, -90], [-26, -74]];
  for (const [x, y] of dots) g.append(archFlower(x, y, "#FAF6FC", 0.55));
  return g;
};

/**
 * El árbol del primer día: dos troncos que se entrelazan y crecen hasta
 * formar una sola copa de flores moradas (como un jacarandá). Crece por etapas:
 * retoño (dos brotes enroscados) → joven → árbol pleno con un columpio.
 * Base en (0,0); el árbol pleno mide ~170 de alto y ~170 de ancho.
 */
const tree = (stage) => {
  const conf = { sapling: { s: 0.46, n: 10, swing: false }, young: { s: 0.74, n: 26, swing: false }, tree: { s: 1, n: 54, swing: true } }[stage] ?? { s: 1, n: 54, swing: true };
  const rng = createRng(`primer-dia-${stage}`);
  const g = el("g", { class: "first-tree", transform: `scale(${conf.s})` });

  // sombra, pétalos caídos y raíces
  g.append(el("ellipse", { cx: 0, cy: 2, rx: 74, ry: 9, fill: "#3e1f4f", opacity: 0.13 }));
  for (let i = 0; i < 26; i += 1) {
    const x = rng.range(-70, 70);
    g.append(el("ellipse", { cx: x.toFixed(1), cy: rng.range(-2, 6).toFixed(1), rx: 2.2, ry: 1.2, transform: `rotate(${rng.int(0, 180)} ${x.toFixed(1)} 2)`, fill: rng.pick(["#B79CEB", "#9A73D8", "#E8DDF7"]), opacity: 0.85 }));
  }
  g.append(el("path", { d: "M-14 0 C-22 2 -32 4 -42 3 M14 0 C22 2 34 5 44 3 M-5 1 C-10 5 -14 7 -22 9 M6 1 C11 5 17 7 24 9", fill: "none", stroke: "#6b4f39", "stroke-width": 5, "stroke-linecap": "round" }));

  // dos troncos que se abrazan
  const trunkA = "M-13 2 C-14 -22 10 -32 5 -56 C0 -80 -17 -90 -10 -116";
  const trunkB = "M13 2 C14 -22 -10 -32 -5 -56 C0 -80 17 -90 11 -116";
  g.append(
    // troncos gruesos con contorno oscuro y una luz lateral (corteza)
    el("path", { d: trunkA, fill: "none", stroke: "#4e3828", "stroke-width": 19, "stroke-linecap": "round" }),
    el("path", { d: trunkA, fill: "none", stroke: "#6e5139", "stroke-width": 16, "stroke-linecap": "round" }),
    el("path", { d: trunkB, fill: "none", stroke: "#5b4330", "stroke-width": 18, "stroke-linecap": "round" }),
    el("path", { d: trunkB, fill: "none", stroke: "#8a6a4f", "stroke-width": 15, "stroke-linecap": "round" }),
    el("path", { d: trunkA, fill: "none", stroke: "#a9865f", "stroke-width": 3, "stroke-linecap": "round", opacity: 0.55, transform: "translate(-3.5 0)" }),
    el("path", { d: trunkB, fill: "none", stroke: "#c4a27a", "stroke-width": 2.6, "stroke-linecap": "round", opacity: 0.5, transform: "translate(3.5 0)" }),
  );
  // ramas
  g.append(
    el("path", {
      d: "M-10 -112 Q-34 -118 -56 -132 M-9 -110 Q-20 -136 -34 -156 M11 -112 Q36 -116 58 -128 M10 -110 Q22 -138 30 -158 M0 -100 Q2 -130 -2 -164",
      fill: "none",
      stroke: "#6e5139",
      "stroke-width": 6.5,
      "stroke-linecap": "round",
    }),
  );

  // copa: cerezo (sakura) morado — nubes de flor, florecitas de cinco pétalos y ramas que asoman
  const CX = 0;
  const CY = -132;
  const RX = 84;
  const RY = 46;
  const inCloud = () => {
    const a = rng.range(0, Math.PI * 2);
    const rr = Math.sqrt(rng.float());
    const y = Math.sin(a) * RY * rr;
    return { x: CX + Math.cos(a) * RX * rr, y: CY + (y > 0 ? y * 0.6 : y) };
  };
  // nubes de flor: tres capas, de la sombra (fondo) a la luz (frente)
  const puffs = [
    [-58, -122, 24], [58, -122, 24], [-34, -146, 28], [34, -146, 28], [0, -160, 26],
    [0, -128, 34], [-74, -108, 16], [74, -108, 16], [-18, -112, 20], [20, -112, 20],
  ];
  for (const [x, y, r] of puffs) g.append(el("circle", { cx: x, cy: y + 3, r: r * 1.04, fill: "#6A3FB0" }));
  for (const [x, y, r] of puffs) g.append(el("circle", { cx: x - 2, cy: y - 1, r: r * 0.92, fill: "#9A73D8" }));
  for (const [x, y, r] of puffs) g.append(el("circle", { cx: x - 5, cy: y - 6, r: r * 0.66, fill: "#B79CEB" }));
  for (const [x, y, r] of puffs) g.append(el("circle", { cx: x - 8, cy: y - 10, r: r * 0.36, fill: "#D7C4F3", opacity: 0.9 }));
  // ramitas oscuras que asoman entre las nubes
  g.append(
    el("path", {
      d: "M-56 -132 Q-66 -138 -78 -134 M-34 -156 Q-40 -170 -50 -174 M58 -128 Q70 -132 80 -126 M30 -158 Q36 -172 46 -176 M-2 -164 Q-6 -178 2 -186",
      fill: "none",
      stroke: "#5b4330",
      "stroke-width": 2.6,
      "stroke-linecap": "round",
    }),
  );
  // florecitas de sakura (cinco pétalos con muesca) sobre las nubes
  const blossomColors = ["#F3ECFF", "#E8DDF7", "#D7C4F3", "#C9B6F2", "#B79CEB", "#8E5CC8"];
  const blossom = (x, y, r, fill, rot) => {
    const f = el("g", { transform: `translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${rot})` });
    for (let k = 0; k < 5; k += 1) {
      f.append(el("path", { d: `M0 0 C${(-r * 0.7).toFixed(1)} ${(-r * 0.5).toFixed(1)} ${(-r * 0.5).toFixed(1)} ${(-r * 1.2).toFixed(1)} 0 ${(-r).toFixed(1)} C${(r * 0.5).toFixed(1)} ${(-r * 1.2).toFixed(1)} ${(r * 0.7).toFixed(1)} ${(-r * 0.5).toFixed(1)} 0 0Z`, transform: `rotate(${k * 72})`, fill }));
    }
    f.append(el("circle", { r: (r * 0.28).toFixed(1), fill: "#5B2E7E" }));
    return f;
  };
  for (let i = 0; i < conf.n * 1.6; i += 1) {
    const p = inCloud();
    g.append(blossom(p.x, p.y, rng.range(2.6, 4.2), rng.pick(blossomColors), rng.int(0, 72)));
  }
  // pétalos que caen alrededor de la copa
  for (let i = 0; i < Math.round(conf.n * 0.35); i += 1) {
    const x = rng.range(-90, 90);
    const y = rng.range(-100, -20);
    g.append(el("ellipse", { cx: 0, cy: 0, rx: 2.4, ry: 1.3, transform: `translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${rng.int(0, 180)})`, fill: rng.pick(["#C9B6F2", "#B79CEB", "#E8DDF7"]), opacity: 0.9 }));
  }
  // el columpio, cuando el árbol ya es grande
  if (conf.swing) {
    g.append(
      el("path", { d: "M34 -118 L36 -40 M50 -122 L52 -40", stroke: "#cbb79a", "stroke-width": 1.4 }),
      el("rect", { x: 31, y: -42, width: 26, height: 5, rx: 2, fill: "#8a6a4f" }),
      el("path", { d: "M34 -42 h20", stroke: "#a9865f", "stroke-width": 1 }),
    );
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
  // Cada cabeza toma uno de tres colores (--c1, --c2, --c3): la mata se ve variada.
  heads.forEach(([x, y, sc], i) => {
    const k = (i % 3) + 1;
    const vars = `--petal:var(--c${k}-petal,#7B4FBF);--petal-inner:var(--c${k}-inner,#9A73D8);--petal-edge:var(--c${k}-edge,#4E2C86);--center:var(--c${k}-center,#F2C14E);--center-dark:var(--c${k}-center-dark,#A8701C)`;
    g.append(el("g", { style: vars }, [el("use", { href: "#d-head", transform: `translate(${x} ${y}) scale(${sc})` })]));
  });
  return g;
};

/** Solo la cabeza de una margarita (para matas). */
const daisyHead = () => {
  const full = buildDaisy({ stage: "full", petals: 13, seed: "sym-head", useVars: true, lite: true });
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
  wrap(daisySymbolId(stage, petals, ribbon), [buildDaisy({ stage, petals, seed: symbolSeed(stage, petals), ribbon, useVars: true, lite: true })], scale());

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
    grand: () => wrap("grand", [grandArch()]),
    bloom: () => wrap("bloom", [bloomTree()]),
    lantern: () => wrap("lantern", [paperLantern(0, 10, 1)]),
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
