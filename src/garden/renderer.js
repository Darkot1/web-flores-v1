/**
 * Dibuja el jardín vivo en SVG a partir del modelo (growth.js) y del layout
 * determinista (layout.js). Cada flor es un <use> del sprite; solo la flor
 * recién plantada se construye completa para animar su crecimiento.
 *
 * Accesibilidad: el jardín es un único tab stop (roving tabindex); las flechas
 * recorren las flores en orden cronológico. Cada flor tiene nombre accesible.
 */
import { ARCH_PALETTES, buildGardenModel, flowerColorFor, LANTERN_COLORS, phaseAt, STAGE_LABELS } from "./growth.js";
import { canvasToGround, DIMENSIONS, garlandAnchor, layoutGarland, layoutGrass, layoutItems, pathOutline, pondPlacement, seasonBands } from "./layout.js";
import { daisySymbolId, ensureGardenSprite, paletteVars, symbolHref, symbolSeed, DAISY_SCALE } from "./symbols.js";
import { buildDaisy, el, growDaisy, PETAL_PALETTES } from "../components/daisy.js";
import { formatLong, formatMonth } from "../lib/dates.js";
import { prefersReducedMotion, watchVisibility } from "../lib/motion.js";
import { createZoom } from "./zoom.js";
import { config } from "../config.js";

const SEAL_RIBBON = { ciruela: "#5B2E7E", morado: "#7B4FBF", dorado: "#D9A93F", rosa: "#C24D7A", salvia: "#5F8259" };

const isCompact = () => window.matchMedia("(max-width: 700px)").matches;

export const describeItem = (item) => {
  const date = formatLong(item.date);
  switch (item.kind) {
    case "memory":
      return { label: `Recuerdo: ${item.title}, ${date}`, title: item.title, meta: `${date} · ${STAGE_LABELS[item.stage]}`, kicker: item.isMilestone ? "Día especial" : "Recuerdo" };
    case "letter":
      return { label: `Carta: ${item.title}, ${date}`, title: item.title, meta: date, kicker: "Carta" };
    case "cluster":
      return { label: `${item.members.length} recuerdos de ${formatMonth(item.date)}`, title: `${item.members.length} recuerdos`, meta: formatMonth(item.date), kicker: "Mata de recuerdos" };
    case "bench":
      return { label: `Día especial: ${item.title}, ${date}`, title: item.title, meta: date, kicker: "Día especial" };
    case "tree":
      return { label: `Aquí empezó todo, ${date}`, title: "Aquí empezó todo", meta: date, kicker: "El primer día" };
    case "light":
    case "lantern":
      return { label: `${item.label}, ${date}`, title: item.label, meta: date, kicker: "Una luz en la guirnalda" };
    case "lamp":
      return { label: `${item.label}, ${date}`, title: item.label, meta: date, kicker: "Un farol junto al camino" };
    case "arch":
      return { label: `${item.label}, ${date}`, title: item.label, meta: date, kicker: "Arco de flores" };
    case "bloom":
      return { label: `${item.label}, ${date}`, title: item.label, meta: date, kicker: "Un árbol en flor" };
    case "grand":
      return { label: `${item.label}, ${date}`, title: item.label, meta: date, kicker: item.anniversary ? "Aniversario · el gran arco dorado" : "Gran arco · tres meses más" };
    case "pond":
      return {
        label: "El estanque",
        title: "El estanque",
        meta: item.count ? `${item.count} ${item.count === 1 ? "pez" : "peces"}: uno por cada carta y un koi dorado por cada aniversario` : "Cada carta traerá un pez; cada aniversario, un koi dorado",
        kicker: "El estanque",
      };
    default:
      return { label: "", title: "", meta: "" };
  }
};

/** Se pueden abrir (botones, recorridos con flechas). */
const INTERACTIVE = new Set(["memory", "letter", "cluster", "bench"]);
/** Solo informan (tooltip al pasar el ratón); para lectores, la vista Camino los lista. */
const DECOR_WITH_TIP = new Set(["tree", "arch", "grand", "light", "lantern", "lamp", "bloom", "pond"]);

const itemContent = (item) => {
  switch (item.kind) {
    case "memory":
      return el("use", { href: symbolHref(daisySymbolId(item.stage, item.petals)) });
    case "letter":
      return el("use", { href: symbolHref(daisySymbolId(item.stage, item.petals, true)) });
    case "wild":
      return el("use", { href: symbolHref(item.stage === "full" || item.stage === "open" ? "w-open" : "w-bud") });
    case "tree":
      return el("use", { href: symbolHref(`tree-${item.stage}`) });
    default:
      return el("use", { href: symbolHref(item.kind) });
  }
};

const itemStyle = (item) => {
  if (item.kind === "cluster") {
    // Tres colores de sus propios recuerdos (o variados por semilla).
    const colors = [...new Set(item.members.map((m) => m.color))];
    while (colors.length < 3) colors.push(flowerColorFor(`${item.id}-${colors.length}`));
    return colors
      .slice(0, 3)
      .map((c, i) => {
        const p = PETAL_PALETTES[c] ?? PETAL_PALETTES.morada;
        const k = i + 1;
        return `--c${k}-petal:${p.petal};--c${k}-inner:${p.inner};--c${k}-edge:${p.edge};--c${k}-center:${p.center};--c${k}-center-dark:${p.centerDark}`;
      })
      .join(";");
  }
  if (item.kind === "memory" || item.kind === "wild") return paletteVars(item.color ?? "morada");
  if (item.kind === "letter") return paletteVars(item.color, { "--ribbon": SEAL_RIBBON[item.sealColor] ?? "#C24D7A" });
  if (item.kind === "arch") {
    const [a, b, c] = ARCH_PALETTES[item.season] ?? ARCH_PALETTES.rain;
    return `--arch-a:${a};--arch-b:${b};--arch-c:${c}`;
  }
  if (item.kind === "grand") {
    if (item.anniversary) return "--g1:#F2C14E;--g2:#FFF1BF;--g3:#E8A25C;--g4:#C98A1E";
    const [a, b, c] = ARCH_PALETTES[item.season] ?? ARCH_PALETTES.rain;
    return `--g1:${a};--g2:${b};--g3:${c};--g4:#5B2E7E`;
  }
  if (item.kind === "bloom") {
    const [a, b] = ARCH_PALETTES[item.season] ?? ARCH_PALETTES.rain;
    return `--bloom-a:${a};--bloom-b:${b === "#FAF6FC" ? "#C9B6F2" : b};--bloom-c:#86A77F`;
  }
  return undefined;
};

/** Un pez de perfil, mirando hacia +y (la dirección en que nada en su órbita). */
const fishShape = (fish) =>
  el("g", {}, [
    el("path", { d: "M0 -7 C4 -6 4.5 2 0 7 C-4.5 2 -4 -6 0 -7Z", fill: fish.color, stroke: "rgb(0 0 0 / 0.15)", "stroke-width": 0.4 }),
    el("path", { d: "M0 -6 L-4 -11 L0 -9.2 L4 -11Z", fill: fish.color, opacity: 0.9 }),
    el("circle", { cx: 1.2, cy: 2, r: 1.3, fill: fish.spots, opacity: 0.85 }),
    el("circle", { cx: -1.4, cy: -1.5, r: 1, fill: fish.spots, opacity: 0.7 }),
  ]);

const buildPond = (pond, fish, variant, maxSwimming = 18) => {
  const night = variant === "night";
  const { cx, cy, rx, ry } = pond;
  const g = el("g", { class: "g-item g-item--pond", "data-id": "pond", "data-tip": "", "aria-hidden": "true" });
  g.append(
    el("ellipse", { cx, cy: cy + 3, rx: rx + 10, ry: ry + 6, fill: night ? "#3a3346" : "#b9a587", opacity: 0.9 }),
    el("ellipse", { cx, cy, rx, ry, fill: night ? "#2a3550" : "#8fb9c9" }),
    el("ellipse", { cx, cy: cy + ry * 0.15, rx: rx * 0.92, ry: ry * 0.8, fill: night ? "#223049" : "#7aa9bd" }),
  );
  // piedras del borde
  for (let i = 0; i < 14; i += 1) {
    const a = (i / 14) * Math.PI * 2 + 0.2;
    g.append(el("ellipse", { cx: (cx + Math.cos(a) * (rx + 5)).toFixed(1), cy: (cy + Math.sin(a) * (ry + 3)).toFixed(1), rx: 6 + (i % 3), ry: 3.2, fill: night ? "#5d566a" : i % 2 ? "#cdbfa8" : "#b7a68c" }));
  }
  // peces nadando en órbitas elípticas
  const water = el("g", { class: "pond-water", transform: `translate(${cx} ${cy}) scale(1 ${(ry / rx).toFixed(3)})` });
  fish.forEach((f, i) => {
    const r = rx * (0.28 + ((i * 0.37) % 1) * 0.45);
    const reverse = i % 3 === 1;
    const swims = i < maxSwimming && !prefersReducedMotion();
    const orbit = el("g", {
      class: `pond-fish${reverse ? " is-reverse" : ""}${swims ? "" : " is-still"}`,
      style: swims ? `animation-duration:${(16 + ((i * 7) % 12)).toFixed(0)}s;animation-delay:${(-i * 2.3).toFixed(1)}s` : `transform:rotate(${(i * 47) % 360}deg)`,
    });
    const body = fishShape(f);
    body.setAttribute("transform", `translate(${r.toFixed(1)} 0) scale(${f.kind === "koi" ? 1.35 : 1.05}) rotate(${reverse ? 180 : 0})`);
    orbit.append(body);
    water.append(orbit);
  });
  g.append(water);
  // nenúfares y un brillo de luz (o la luna reflejada)
  for (const [dx, dy, s] of [[-0.55, -0.2, 1], [0.48, 0.25, 0.8], [0.15, -0.45, 0.7]]) {
    const lx = cx + dx * rx;
    const ly = cy + dy * ry;
    g.append(el("path", { d: `M${lx} ${ly} m${-9 * s} 0 a${9 * s} ${4 * s} 0 1 0 ${18 * s} 0 a${9 * s} ${4 * s} 0 1 0 ${-18 * s} 0 M${lx} ${ly} l${7 * s} ${-2 * s}`, fill: night ? "#4f6b55" : "#7fa476", stroke: night ? "#4f6b55" : "#6b9163", "stroke-width": 0.6 }));
  }
  g.append(archLilyFlower(cx - rx * 0.55, cy - ry * 0.2 - 3));
  g.append(el("ellipse", { cx: cx + rx * 0.2, cy: cy - ry * 0.35, rx: rx * 0.22, ry: ry * 0.12, fill: night ? "#e8ddf7" : "#ffffff", opacity: night ? 0.35 : 0.3 }));
  return g;
};

const archLilyFlower = (x, y) => {
  const head = el("g", { transform: `translate(${x.toFixed(1)} ${y.toFixed(1)})` });
  for (let i = 0; i < 6; i += 1) head.append(el("ellipse", { cx: 0, cy: -2.6, rx: 1.4, ry: 2.8, transform: `rotate(${i * 60})`, fill: "#F4C6D8" }));
  head.append(el("circle", { r: 1.2, fill: "#F2C14E" }));
  return head;
};

/** Corazón de tierra (en perspectiva) con un borde de florecitas; de él crece la margarita. */
const heartPoint = (t) => ({
  x: 16 * Math.sin(t) ** 3,
  y: -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)),
});

const specialHeart = (k, variant) => {
  const night = variant === "night";
  const flat = 0.55; // aplastado por la perspectiva, pero se sigue leyendo como corazón
  const size = 2.4 * k;
  const pts = [];
  for (let i = 0; i <= 48; i += 1) {
    const p = heartPoint((i / 48) * Math.PI * 2);
    pts.push(`${(p.x * size).toFixed(1)},${(p.y * size * flat).toFixed(1)}`);
  }
  // el corazón se apoya delante de la flor: su centro un poco por debajo de la base
  const g = el("g", { class: "special-heart", transform: `translate(0 ${(6 * k).toFixed(1)})` });
  if (night) g.append(el("ellipse", { cx: 0, cy: 0, rx: 48 * k, ry: 26 * k, fill: "url(#lamp-glow)", opacity: 0.9 }));
  g.append(
    el("polygon", { points: pts.join(" "), fill: night ? "#4a3640" : "#9a7a5c", stroke: night ? "#f2c14e" : "#7a5b41", "stroke-width": night ? 1.6 : 1.2, "stroke-opacity": night ? 0.8 : 0.6 }),
    el("polygon", { points: pts.join(" "), fill: night ? "#5a4250" : "#b08e6c", transform: "scale(0.8)", opacity: 0.85 }),
  );
  // borde de florecitas
  const N = 20;
  for (let i = 0; i < N; i += 1) {
    const p = heartPoint((i / N) * Math.PI * 2);
    const f = el("g", { transform: `translate(${(p.x * size * 1.06).toFixed(1)} ${(p.y * size * flat * 1.06).toFixed(1)}) scale(${(0.15 * k).toFixed(3)} ${(0.15 * k * 0.8).toFixed(3)})`, style: paletteVars(i % 3 === 0 ? "dorada" : i % 3 === 1 ? "morada" : "blanca") });
    f.append(el("use", { href: symbolHref("d-head") }));
    g.append(f);
  }
  return g;
};

/**
 * @param {HTMLElement} host
 * El jardín es uno solo y su luz sigue la hora real del dispositivo (no el
 * tema claro/oscuro de la página): de día sol y faroles apagados; de noche
 * luna, luciérnagas y faroles encendidos. Se comprueba cada minuto.
 * @param {{ store, onOpen?: (item) => void, onPlantFirst?: () => void, onChooseStart?: () => void, label: (model) => string }} options
 */
export { phaseAt };
const currentPhase = () => phaseAt(new Date(), config.gardenClock);

export const createGarden = (host, { store, onOpen, onPlantFirst, onChooseStart, onPlantAt, label }) => {
  let variant = currentPhase();
  ensureGardenSprite();

  host.classList.add("garden-view");
  host.dataset.focusScope = "";
  const svg = el("svg", { class: "garden-svg", role: "group", "aria-roledescription": "jardín", focusable: "false" });
  const tip = document.createElement("div");
  tip.className = "garden-tip";
  tip.hidden = true;
  tip.setAttribute("aria-hidden", "true");
  const tipKicker = document.createElement("p");
  tipKicker.className = "garden-tip__kicker";
  const tipTitle = document.createElement("p");
  tipTitle.className = "garden-tip__title";
  const tipMeta = document.createElement("p");
  tipMeta.className = "garden-tip__meta";
  const tipOpen = document.createElement("button");
  tipOpen.type = "button";
  tipOpen.className = "btn btn--primary garden-tip__open";
  tipOpen.textContent = "Abrir";
  tipOpen.tabIndex = -1;
  tip.append(tipKicker, tipTitle, tipMeta, tipOpen);

  const empty = document.createElement("div");
  empty.className = "garden-empty";
  empty.hidden = true;

  // Controles de zoom
  const zoomBar = document.createElement("div");
  zoomBar.className = "garden-zoom";
  zoomBar.setAttribute("role", "group");
  zoomBar.setAttribute("aria-label", "Zoom del jardín");
  const zoomBtn = (label, path) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "garden-zoom__btn";
    b.setAttribute("aria-label", label);
    b.title = label;
    b.innerHTML = `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="${path}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    zoomBar.append(b);
    return b;
  };
  const zoomInBtn = zoomBtn("Acercar el jardín", "M12 5v14M5 12h14");
  const zoomOutBtn = zoomBtn("Alejar el jardín", "M5 12h14");
  const zoomResetBtn = zoomBtn("Ver todo el jardín", "M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5");
  const zoomStatus = document.createElement("span");
  zoomStatus.className = "visually-hidden";
  zoomStatus.setAttribute("aria-live", "polite");
  zoomBar.append(zoomStatus);
  const zoomHint = document.createElement("p");
  zoomHint.className = "garden-zoom__hint";
  zoomHint.setAttribute("aria-hidden", "true");

  // Sembrar tocando la tierra: una burbuja confirma el sitio.
  const plantBubble = document.createElement("button");
  plantBubble.type = "button";
  plantBubble.className = "btn btn--primary garden-plant";
  plantBubble.hidden = true;
  plantBubble.innerHTML = '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 21v-7M12 14c-4 0-6-3-6-6 4 0 6 3 6 6zm0 0c4 0 6-3 6-6-4 0-6 3-6 6z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  plantBubble.append(document.createTextNode("Sembrar un recuerdo aquí"));
  let pendingSpot = null;
  let plantMarker = null;

  host.replaceChildren(svg, tip, empty, zoomBar, zoomHint, plantBubble);

  let hintTimer = 0;
  const zoom = createZoom(svg, {
    onChange: (scale) => {
      const zoomed = scale > 1.001;
      zoomOutBtn.disabled = !zoomed;
      zoomResetBtn.disabled = !zoomed;
      zoomInBtn.disabled = scale >= 3.99;
      zoomStatus.textContent = zoomed ? `Zoom ${scale.toFixed(1).replace(".0", "")}×` : "Jardín completo";
      host.classList.toggle("is-zoomed", zoomed);
      if (zoomed && !hintTimer) {
        zoomHint.textContent = window.matchMedia("(pointer: coarse)").matches ? "Arrastra para recorrerlo" : "Arrastra para recorrerlo · doble clic para volver";
        hintTimer = setTimeout(() => (zoomHint.textContent = ""), 2600);
      }
      if (!zoomed) {
        clearTimeout(hintTimer);
        hintTimer = 0;
        zoomHint.textContent = "";
      }
      hideTip();
    },
  });
  zoomInBtn.addEventListener("click", () => zoom.zoomIn());
  zoomOutBtn.addEventListener("click", () => zoom.zoomOut());
  zoomResetBtn.addEventListener("click", () => zoom.reset());

  let dims = null;
  let laid = [];
  let focusOrder = [];
  let focusIndex = 0;
  let tipItem = null;
  let compact = isCompact();

  const nodesById = new Map();

  const renderEmpty = (model) => {
    const hasContent = model.counts.memories + model.counts.letters > 0;
    const hasStart = model.hasStart;
    const showEmpty = !hasContent || !hasStart;
    empty.hidden = !showEmpty;
    if (!showEmpty) return;
    const card = document.createElement("div");
    card.className = "garden-empty__card";
    const title = document.createElement("p");
    title.className = "garden-empty__title";
    const body = document.createElement("p");
    body.className = "garden-empty__body";
    const actions = document.createElement("div");
    actions.className = "garden-empty__actions";
    if (!hasContent) {
      title.textContent = "Aquí va a crecer nuestro primer recuerdo";
      body.textContent = "La tierra ya está lista. Planta un recuerdo y mira cómo brota.";
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn btn--primary";
      btn.textContent = "Plantar el primero";
      btn.addEventListener("click", () => onPlantFirst?.());
      actions.append(btn);
    } else {
      title.textContent = "El jardín aún no tiene su primer día";
      body.textContent = "Elige la fecha en que todo empezó y el tiempo hará crecer el pasto, el arbolito y los faroles.";
    }
    if (!hasStart) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = hasContent ? "btn btn--primary" : "btn btn--ghost";
      btn.textContent = "Elegir el día en que empezó";
      btn.addEventListener("click", () => onChooseStart?.());
      actions.append(btn);
    }
    card.append(title, body, actions);
    empty.replaceChildren(card);
  };

  const defsFor = () => {
    const night = variant === "night";
    return el("defs", {}, [
      el("linearGradient", { id: `sky-${variant}`, x1: 0, y1: 0, x2: 0, y2: 1 }, [
        el("stop", { offset: 0, "stop-color": night ? "#1d0f28" : "#f7e6cf" }),
        el("stop", { offset: 0.7, "stop-color": night ? "#3e1f4f" : "#fbf3e4" }),
        el("stop", { offset: 1, "stop-color": night ? "#5a3b67" : "#fbf6ec" }),
      ]),
      el("linearGradient", { id: `ground-${variant}`, x1: 0, y1: 0, x2: 0, y2: 1 }, [
        el("stop", { offset: 0, "stop-color": night ? "#4a4060" : "#c9d8c2" }),
        el("stop", { offset: 1, "stop-color": night ? "#2f2a40" : "#a9c1a3" }),
      ]),
      el("radialGradient", { id: `orb-${variant}` }, [
        el("stop", { offset: 0, "stop-color": night ? "#efe6ff" : "#fff3cf", "stop-opacity": 0.95 }),
        el("stop", { offset: 0.25, "stop-color": night ? "#c9b6f2" : "#f2c14e", "stop-opacity": 0.5 }),
        el("stop", { offset: 1, "stop-color": night ? "#c9b6f2" : "#f2c14e", "stop-opacity": 0 }),
      ]),
    ]);
  };

  const render = (event) => {
    variant = currentPhase();
    host.classList.toggle("garden-view--day", variant === "day");
    host.classList.toggle("garden-view--night", variant === "night");
    svg.style.setProperty("--lamp-light", variant === "night" ? "#ffe9a8" : "#e9e1d3");
    compact = isCompact();
    dims = compact ? DIMENSIONS.tall : DIMENSIONS.wide;
    const caps = config.caps[compact ? "mobile" : "desktop"];
    const settings = store.settings();
    const today = store.today();
    const model = buildGardenModel({
      memories: store.memories(),
      letters: store.letters(),
      start: settings.start,
      today,
      caps,
      thresholds: config.growth,
      climate: config.climate,
    });

    laid = layoutItems(model.items, dims);
    zoom.setBase(dims);
    svg.setAttribute("aria-label", label(model));
    nodesById.clear();

    const frag = document.createDocumentFragment();
    frag.append(defsFor());
    const { width, height, horizon } = dims;
    frag.append(el("rect", { width, height, fill: `url(#sky-${variant})` }));
    frag.append(el("circle", { cx: width * 0.78, cy: horizon * 0.55, r: 120, fill: `url(#orb-${variant})` }));
    if (variant === "night") {
      // Luna nítida dentro del halo y unas pocas luciérnagas fijas (deterministas).
      frag.append(el("circle", { cx: width * 0.78, cy: horizon * 0.55, r: 16, fill: "#f3ecff" }));
      const flies = el("g", { class: "garden-fireflies", "aria-hidden": "true" });
      for (let i = 0; i < (compact ? 10 : 22); i += 1) {
        const fx = ((i * 0.6180339) % 1) * width;
        const fy = horizon + 30 + ((i * 0.3819660 + 0.2) % 1) * (height - horizon - 80);
        flies.append(el("circle", { cx: fx.toFixed(1), cy: fy.toFixed(1), r: 1.8, fill: "#ffe9a8", opacity: 0.85 }));
      }
      frag.append(flies);
    }
    // Guirnaldas del cielo: una luz por cada mes juntos.
    // Atadas a la copa del árbol del primer día: ningún farolillo queda detrás de él.
    const treeItem = laid.find((i) => i.kind === "tree");
    const garland = layoutGarland(model.lights, dims, garlandAnchor(dims, treeItem?.stage));
    if (garland.strands.length) {
      const sky = el("g", { class: "garden-garland" });
      for (const strand of garland.strands) {
        sky.append(el("path", { d: strand.d, fill: "none", stroke: variant === "night" ? "#8c7a96" : "#a08a74", "stroke-width": 1.1, opacity: 0.8 }));
      }
      for (const light of garland.lights) {
        const g = el("g", {
          class: "g-item g-item--light",
          transform: `translate(${light.x} ${light.y})`,
          "data-id": light.id,
          "data-tip": "",
          "aria-hidden": "true",
          opacity: light.opacity,
          style: variant === "night" ? "--lantern-fill:#ffe9a8" : `--lantern-fill:${LANTERN_COLORS[light.season] ?? "#F2C14E"}`,
        });
        const swings = light.year === garland.strands.length;
        const sway = el("g", { class: swings ? "g-lantern" : "g-lantern is-still", style: swings ? `animation-delay:${(-light.slot * 0.37).toFixed(2)}s` : undefined });
        sway.append(el("path", { d: `M0 0 L0 ${light.drop}`, stroke: "#6b5a70", "stroke-width": 0.8 }));
        sway.append(el("use", { href: symbolHref("lantern"), transform: `translate(0 ${light.drop - 2}) rotate(${light.rotate}) scale(${light.scale})` }));
        g.append(el("rect", { x: -10, y: 0, width: 20, height: light.drop + 26, fill: "transparent" }), sway);
        nodesById.set(light.id, { g, body: sway, item: light });
        sky.append(g);
      }
      frag.append(sky);
    }
    // Colinas lejanas
    frag.append(
      el("path", { d: `M0 ${horizon + 10} C${width * 0.18} ${horizon - 30} ${width * 0.34} ${horizon - 6} ${width * 0.5} ${horizon - 18} S${width * 0.82} ${horizon - 34} ${width} ${horizon - 4} L${width} ${horizon + 20} L0 ${horizon + 20}Z`, fill: variant === "night" ? "#4f3a63" : "#d9cfe9", opacity: 0.85 }),
      el("path", { d: `M0 ${horizon + 16} C${width * 0.25} ${horizon - 4} ${width * 0.6} ${horizon + 18} ${width} ${horizon + 2} L${width} ${horizon + 30} L0 ${horizon + 30}Z`, fill: variant === "night" ? "#3f4b52" : "#bccfb4" }),
    );
    frag.append(el("rect", { x: 0, y: horizon + 8, width, height: height - horizon - 8, fill: `url(#ground-${variant})` }));

    // El año que pasa: bandas de luz por mes.
    const bandList = seasonBands({ start: model.start, span: model.span, today, climate: config.climate, dims });
    if (bandList.length) {
      const top = horizon + 8;
      const range = height - top;
      const grad = el("linearGradient", { id: `seasons-${variant}`, gradientUnits: "userSpaceOnUse", x1: 0, y1: top, x2: 0, y2: height });
      for (const band of bandList) {
        const mid = ((band.y0 + band.y1) / 2 - top) / range;
        grad.append(el("stop", { offset: Math.min(1, Math.max(0, mid)).toFixed(4), "stop-color": band.season.tint }));
      }
      frag.querySelector("defs").append(grad);
      frag.append(el("rect", { class: "garden-seasons", "aria-hidden": "true", x: 0, y: top, width, height: range, fill: `url(#seasons-${variant})`, opacity: variant === "night" ? 0.14 : 0.42 }));
    }

    const outline = pathOutline(dims);
    frag.append(el("polygon", { class: "garden-path", points: outline.map((p) => p.map((n) => n.toFixed(1)).join(",")).join(" "), fill: variant === "night" ? "#6b5a70" : "#dcc7a6", stroke: variant === "night" ? "#54465c" : "#c4aa84", "stroke-width": 1.5 }));

    const grass = el("g", { class: "garden-grass", "aria-hidden": "true" });
    for (const t of layoutGrass(model.density, dims, caps.grass)) {
      grass.append(el("use", { href: symbolHref(`grass-${t.variant}`), transform: `translate(${t.x} ${t.y}) scale(${t.flip ? -t.scale : t.scale} ${t.scale})` }));
    }
    frag.append(grass);

    // El estanque, con un pez por carta y un koi dorado por aniversario.
    const pondEl = buildPond(pondPlacement(dims), model.fish, variant, compact ? 8 : 18);
    frag.append(pondEl);
    nodesById.set("pond", { g: pondEl, body: pondEl, item: { id: "pond", kind: "pond", count: model.fish.length, date: today } });

    // Semilla de espera si no hay nada plantado.
    if (model.counts.memories + model.counts.letters === 0) {
      const front = laid.length ? null : { x: width / 2, y: height - dims.pad - 40 };
      if (front) frag.append(el("use", { href: symbolHref("empty-seed"), class: "garden-waiting-seed", transform: `translate(${front.x} ${front.y}) scale(1.4)` }));
    }

    const items = el("g", { class: "garden-items" });
    // Viento: menos flores en móvil y aún menos si el jardín está muy poblado.
    const swayBudget = compact ? (laid.length > 90 ? 8 : 18) : laid.length > 200 ? 36 : 60;
    // En móvil el viewBox se encoge: el área de toque se agranda para seguir rondando 44px.
    const hitW = compact ? 76 : 48;
    const byNearest = [...laid].filter((i) => i.kind === "memory" || i.kind === "letter" || i.kind === "wild").sort((a, b) => b.y - a.y);
    const swaying = new Set(prefersReducedMotion() ? [] : byNearest.slice(0, swayBudget).map((i) => i.id));

    for (const item of laid) {
      const interactive = INTERACTIVE.has(item.kind);
      const g = el("g", {
        class: `g-item g-item--${item.kind}`,
        transform: `translate(${item.x} ${item.y})`,
        "data-id": item.id,
        style: itemStyle(item),
      });
      const sway = el("g", {
        class: swaying.has(item.id) ? "g-sway is-swaying" : "g-sway",
        style: swaying.has(item.id) ? `animation-delay:${item.swayDelay}s;animation-duration:${item.swayDuration}s` : undefined,
      });
      const body = el("g", { transform: `scale(${item.scale}) rotate(${item.rotate})` }, [itemContent(item)]);
      if (item.kind === "memory" && item.isMilestone) {
        // Día especial: la margarita brota de un corazón dibujado en la tierra.
        g.classList.add("is-special");
        g.append(specialHeart(Math.max(0.6, item.scale), variant));
      }
      if (item.kind === "tree") {
        // El árbol del primer día brilla un poco: es donde empezó todo.
        const grow = { sapling: 0.46, young: 0.74, tree: 1 }[item.stage] ?? 1;
        g.append(el("ellipse", { class: "first-tree-glow", cx: 0, cy: -118 * item.scale * grow, rx: 120 * item.scale * grow, ry: 90 * item.scale * grow, fill: "url(#lamp-glow)", opacity: variant === "night" ? 0.95 : 0.6 }));
        for (let k = 0; k < 9; k += 1) {
          const a = (k / 9) * Math.PI * 2;
          const ring = el("g", { transform: `translate(${(Math.cos(a) * (30 + 46 * grow) * item.scale).toFixed(1)} ${(Math.sin(a) * 8 * item.scale + 4).toFixed(1)}) scale(${(0.3 * item.scale).toFixed(2)})`, style: paletteVars(k % 3 ? "morada" : "lavanda") });
          ring.append(el("use", { href: symbolHref("d-full-13") }));
          g.append(ring);
        }
      }
      sway.append(body);
      g.append(sway);
      if (interactive) {
        const info = describeItem(item);
        g.setAttribute("role", "button");
        g.setAttribute("tabindex", "-1");
        g.setAttribute("aria-label", info.label);
        // Área de toque generosa e invisible.
        const h = Math.max(hitW, 92 * item.scale + 22);
        const hit = el("rect", { class: "g-hit", x: -hitW / 2, y: 12 - h, width: hitW, height: h, rx: 12, fill: "transparent" });
        g.prepend(hit);
      } else if (DECOR_WITH_TIP.has(item.kind)) {
        g.dataset.tip = "";
        g.setAttribute("aria-hidden", "true");
      } else {
        g.setAttribute("aria-hidden", "true");
      }
      nodesById.set(item.id, { g, body, item });
      items.append(g);
    }
    frag.append(items);

    if (variant === "night") {
      frag.append(el("rect", { class: "garden-night-veil", width, height, fill: "#1d0f28", opacity: 0.14, "pointer-events": "none" }));
      const glows = el("g", { class: "garden-lamp-glows", "pointer-events": "none", "aria-hidden": "true" });
      for (const light of garland.lights) {
        glows.append(el("circle", { cx: light.x, cy: light.y + light.drop + 10, r: 20, fill: "url(#lamp-glow)" }));
      }
      for (const item of laid.filter((i) => i.kind === "lamp")) {
        glows.append(el("circle", { cx: item.x, cy: item.y - 63 * item.scale, r: 36 * item.scale + 6, fill: "url(#lamp-glow)" }));
      }
      for (const item of laid.filter((i) => i.kind === "grand")) {
        for (const side of [-1, 1]) {
          glows.append(el("circle", { cx: item.x + side * 40 * item.scale, cy: item.y - 83 * item.scale, r: 20 * item.scale + 6, fill: "url(#lamp-glow)" }));
        }
      }
      frag.append(glows);
    }

    svg.replaceChildren(frag);

    focusOrder = laid.filter((i) => INTERACTIVE.has(i.kind)).sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
    const fresh = event?.freshId;
    const preferred = fresh ? focusOrder.findIndex((i) => i.id === fresh || i.members?.some((m) => m.id === fresh)) : -1;
    focusIndex = preferred >= 0 ? preferred : Math.min(focusIndex, Math.max(0, focusOrder.length - 1));
    if (!focusOrder.length) focusIndex = 0;
    if (focusOrder.length) {
      nodesById.get(focusOrder[focusIndex].id)?.g.setAttribute("tabindex", "0");
      // tabindex="-1" (no quitarlo): Chromium deja el <svg> enfocable si se elimina.
      svg.setAttribute("tabindex", "-1");
    } else {
      svg.setAttribute("tabindex", "0");
    }

    renderEmpty(model);
    hideTip();
    hidePlant();
    if (fresh) plant(fresh);
  };

  /** Sustituye el <use> por una flor completa y la hace crecer. */
  const plant = (id) => {
    const entry = nodesById.get(id);
    if (!entry || (entry.item.kind !== "memory" && entry.item.kind !== "letter")) return;
    const { item, body } = entry;
    const stage = item.stage;
    const petals = [13, 16, 21].includes(item.petals) ? item.petals : 16;
    const ribbon = item.kind === "letter";
    const daisy = buildDaisy({ stage, petals, seed: symbolSeed(stage, petals), ribbon: ribbon && stage !== "seed" && stage !== "sprout", useVars: true });
    const holder = el("g", { transform: `scale(${DAISY_SCALE})` }, [daisy]);
    body.replaceChildren(holder);
    entry.g.classList.add("is-fresh");
    const ripple = el("ellipse", { class: "plant-ripple", cx: 0, cy: 0, rx: 18 * item.scale + 6, ry: 5 * item.scale + 2 });
    entry.g.prepend(ripple);
    growDaisy(daisy, { delay: 250 }).finished.then(() => {
      ripple.remove();
      entry.g.classList.remove("is-fresh");
    });
  };

  const hidePlant = ({ keepMarker = false } = {}) => {
    plantBubble.hidden = true;
    if (!keepMarker) {
      plantMarker?.remove();
      plantMarker = null;
      pendingSpot = null;
    }
  };

  /** Toque en la tierra: muestra dónde se sembraría y la burbuja para confirmarlo. */
  const offerPlantAt = (clientX, clientY) => {
    if (!onPlantAt || !dims) return false;
    const pt = zoom.toGarden(clientX, clientY);
    if (pt.y < dims.horizon + 14 || pt.y > dims.height - 6) return false;
    const pond = pondPlacement(dims);
    if (((pt.x - pond.cx) / (pond.rx + 8)) ** 2 + ((pt.y - pond.cy) / (pond.ry + 8)) ** 2 < 1) return false;
    hideTip();
    hidePlant();
    pendingSpot = canvasToGround(pt.x, pt.y, dims);
    plantMarker = el("g", { class: "plant-marker", transform: `translate(${pt.x.toFixed(1)} ${pt.y.toFixed(1)})`, "pointer-events": "none" }, [
      el("ellipse", { class: "plant-ripple", cx: 0, cy: 0, rx: 16, ry: 5 }),
      el("ellipse", { cx: 0, cy: 1, rx: 9, ry: 3, fill: "#6e5139", opacity: 0.5 }),
      el("ellipse", { cx: 0, cy: -2, rx: 3.4, ry: 2.2, fill: "#6e5139" }),
    ]);
    svg.querySelector(".garden-items")?.append(plantMarker);
    plantBubble.hidden = false;
    const hostRect = host.getBoundingClientRect();
    const bw = plantBubble.offsetWidth;
    const left = Math.min(Math.max(8, clientX - hostRect.left - bw / 2), hostRect.width - bw - 8);
    const top = clientY - hostRect.top - plantBubble.offsetHeight - 16;
    plantBubble.style.transform = `translate(${Math.round(left)}px, ${Math.round(top < 6 ? clientY - hostRect.top + 16 : top)}px)`;
    return true;
  };

  plantBubble.addEventListener("click", () => {
    if (!pendingSpot) return;
    const spot = pendingSpot;
    hidePlant({ keepMarker: true });
    onPlantAt?.(spot, plantBubble);
  });

  // Tooltip
  const showTip = (item, { withOpen = false } = {}) => {
    const entry = nodesById.get(item.id);
    if (!entry) return;
    const info = describeItem(item);
    tipKicker.textContent = info.kicker;
    tipTitle.textContent = info.title;
    tipMeta.textContent = info.meta;
    const openable = item.kind === "memory" || item.kind === "letter" || item.kind === "cluster" || item.kind === "bench";
    tipOpen.hidden = !(withOpen && openable);
    tipOpen.textContent = item.kind === "letter" ? "Leer carta" : item.kind === "cluster" ? "Ver recuerdos" : "Abrir recuerdo";
    tip.hidden = false;
    tipItem = item;
    const hostRect = host.getBoundingClientRect();
    const r = entry.g.getBoundingClientRect();
    const x = r.left + r.width / 2 - hostRect.left;
    const y = r.top - hostRect.top;
    const tipWidth = tip.offsetWidth;
    const left = Math.min(Math.max(8, x - tipWidth / 2), hostRect.width - tipWidth - 8);
    const above = y - tip.offsetHeight - 10;
    tip.style.transform = `translate(${Math.round(left)}px, ${Math.round(above < 4 ? r.bottom - hostRect.top + 10 : above)}px)`;
  };

  const hideTip = () => {
    tip.hidden = true;
    tipItem = null;
  };

  const itemFromEvent = (event, { decor = false } = {}) => {
    const g = event.target.closest?.(decor ? ".g-item[role=button], .g-item[data-tip]" : ".g-item[role=button]");
    return g ? nodesById.get(g.dataset.id)?.item : null;
  };

  const open = (item) => {
    if (!item) return;
    if (item.kind === "bench") {
      const memory = store.memories().find((m) => m.id === item.memoryId);
      if (memory) onOpen?.({ ...item, kind: "memory", ref: memory, date: memory.date });
      return;
    }
    if (item.kind === "memory" || item.kind === "letter" || item.kind === "cluster") onOpen?.(item);
  };

  const setFocus = (index) => {
    if (!focusOrder.length) return;
    const prev = nodesById.get(focusOrder[focusIndex]?.id);
    prev?.g.setAttribute("tabindex", "-1");
    focusIndex = (index + focusOrder.length) % focusOrder.length;
    const next = nodesById.get(focusOrder[focusIndex].id);
    next.g.setAttribute("tabindex", "0");
    next.g.focus();
    zoom.ensureVisible(next.item.x, next.item.y - 30 * next.item.scale);
  };

  let lastPointer = "mouse";
  let pointerFocus = false;
  svg.addEventListener("pointerdown", (e) => {
    lastPointer = e.pointerType;
    pointerFocus = true;
    setTimeout(() => (pointerFocus = false), 400);
  });
  svg.addEventListener("pointerover", (e) => {
    if (e.pointerType !== "mouse") return;
    const item = itemFromEvent(e, { decor: true });
    if (item) showTip(item);
  });
  svg.addEventListener("pointerout", (e) => {
    if (e.pointerType === "mouse" && !e.relatedTarget?.closest?.(".g-item")) hideTip();
  });
  svg.addEventListener("click", (e) => {
    if (zoom.consumeMoved()) return; // fue un arrastre o pellizco, no un toque
    const item = itemFromEvent(e);
    if (!item) {
      hideTip();
      if (!offerPlantAt(e.clientX, e.clientY)) hidePlant();
      return;
    }
    hidePlant();
    const index = focusOrder.findIndex((i) => i.id === item.id);
    if (index >= 0) {
      nodesById.get(focusOrder[focusIndex]?.id)?.g.setAttribute("tabindex", "-1");
      focusIndex = index;
      nodesById.get(item.id).g.setAttribute("tabindex", "0");
    }
    if (lastPointer === "touch" || lastPointer === "pen") {
      if (tipItem?.id === item.id) open(item);
      else showTip(item, { withOpen: true });
    } else {
      open(item);
    }
  });
  tipOpen.addEventListener("click", () => open(tipItem));
  svg.addEventListener("focusin", (e) => {
    if (pointerFocus) return; // el toque gestiona su propio tooltip
    const item = itemFromEvent(e);
    if (item) showTip(item);
  });
  svg.addEventListener("focusout", (e) => {
    if (!svg.contains(e.relatedTarget)) hideTip();
  });
  svg.addEventListener("keydown", (e) => {
    const item = itemFromEvent(e);
    if (!item) return;
    const keys = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
    if (e.key in keys) {
      e.preventDefault();
      setFocus(focusIndex + keys[e.key]);
    } else if (e.key === "Home") {
      e.preventDefault();
      setFocus(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setFocus(focusOrder.length - 1);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      open(item);
    } else if (e.key === "Escape") {
      hideTip();
    } else if (e.key === "+" || e.key === "=") {
      e.preventDefault();
      zoom.zoomIn();
    } else if (e.key === "-") {
      e.preventDefault();
      zoom.zoomOut();
    } else if (e.key === "0") {
      e.preventDefault();
      zoom.reset();
    }
  });

  // Viento solo cuando se ve.
  watchVisibility(host, (visible) => host.classList.toggle("is-paused", !visible));

  // Re-render al cruzar el punto de quiebre.
  let resizeTimer = 0;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (isCompact() !== compact) render();
    }, 150);
  });

  // Al amanecer o al anochecer, el jardín cambia solo.
  setInterval(() => {
    if (currentPhase() !== variant) render();
  }, 60_000);

  // El jardín se dibuja cuando está cerca de la pantalla (o cuando el navegador
  // está libre): así no compite con la portada al cargar.
  let armed = false;
  let pending = null;
  const arm = () => {
    if (armed) return;
    armed = true;
    if (pending) {
      const ev = pending;
      pending = null;
      render(ev === true ? undefined : ev);
    }
  };
  watchVisibility(host, (visible) => visible && arm(), { rootMargin: "900px 0px" });
  (window.requestIdleCallback ?? ((fn) => setTimeout(fn, 1200)))(arm, { timeout: 4000 });

  store.subscribe((event) => {
    if (["load", "memories", "letters", "settings"].includes(event.type)) {
      if (event.type === "letters" && event.read) return;
      if (!armed) {
        pending = event.freshId ? true : event;
        return;
      }
      render(event);
    }
  });

  return {
    render,
    /** Quita la semilla marcada si se cerró la hoja sin sembrar. */
    clearPendingPlant() {
      hidePlant();
    },
    /** Lleva el foco a una flor y la resalta. */
    reveal(id) {
      arm();
      const entry = nodesById.get(id) ?? [...nodesById.values()].find((e) => e.item.members?.some((m) => m.id === id));
      if (!entry) return;
      zoom.ensureVisible(entry.item.x, entry.item.y - 30 * entry.item.scale);
      entry.g.scrollIntoView?.({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "center" });
      entry.g.classList.remove("is-highlight");
      void entry.g.getBoundingClientRect();
      entry.g.classList.add("is-highlight");
      const index = focusOrder.findIndex((i) => i.id === entry.item.id);
      if (index >= 0) setTimeout(() => setFocus(index), 450);
    },
  };
};
