/**
 * Dibuja el jardín vivo en SVG a partir del modelo (growth.js) y del layout
 * determinista (layout.js). Cada flor es un <use> del sprite; solo la flor
 * recién plantada se construye completa para animar su crecimiento.
 *
 * Accesibilidad: el jardín es un único tab stop (roving tabindex); las flechas
 * recorren las flores en orden cronológico. Cada flor tiene nombre accesible.
 */
import { buildGardenModel, STAGE_LABELS } from "./growth.js";
import { DIMENSIONS, layoutGrass, layoutItems, pathOutline, seasonBands } from "./layout.js";
import { daisySymbolId, ensureGardenSprite, paletteVars, symbolHref, symbolSeed, DAISY_SCALE } from "./symbols.js";
import { buildDaisy, el, growDaisy } from "../components/daisy.js";
import { formatLong, formatMonth } from "../lib/dates.js";
import { prefersReducedMotion, watchVisibility } from "../lib/motion.js";
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
    case "lamp":
    case "arch":
      return { label: `${item.label}, ${date}`, title: item.label, meta: date, kicker: item.kind === "arch" ? "Aniversario" : "Mesiversario" };
    default:
      return { label: "", title: "", meta: "" };
  }
};

/** Se pueden abrir (botones, recorridos con flechas). */
const INTERACTIVE = new Set(["memory", "letter", "cluster", "bench"]);
/** Solo informan (tooltip al pasar el ratón); para lectores, la vista Camino los lista. */
const DECOR_WITH_TIP = new Set(["tree", "lamp", "arch"]);

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
  if (item.kind === "memory" || item.kind === "cluster" || item.kind === "wild") return paletteVars(item.color ?? "morada");
  if (item.kind === "letter") return paletteVars(item.color, { "--ribbon": SEAL_RIBBON[item.sealColor] ?? "#C24D7A" });
  return undefined;
};

/**
 * @param {HTMLElement} host
 * El jardín es uno solo; su luz sigue al tema: claro = de día, oscuro = de noche
 * (faroles encendidos, luna). Se re-dibuja al cambiar el tema.
 * @param {{ store, onOpen?: (item) => void, onPlantFirst?: () => void, onChooseStart?: () => void, label: (model) => string }} options
 */
const currentPhase = () => (document.documentElement.dataset.theme === "dark" ? "night" : "day");

export const createGarden = (host, { store, onOpen, onPlantFirst, onChooseStart, label }) => {
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

  host.replaceChildren(svg, tip, empty);

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
    });

    laid = layoutItems(model.items, dims);
    svg.setAttribute("viewBox", `0 0 ${dims.width} ${dims.height}`);
    svg.setAttribute("aria-label", label(model));
    nodesById.clear();

    const frag = document.createDocumentFragment();
    frag.append(defsFor());
    const { width, height, horizon } = dims;
    frag.append(el("rect", { width, height, fill: `url(#sky-${variant})` }));
    frag.append(el("circle", { cx: width * (variant === "night" ? 0.22 : 0.78), cy: horizon * 0.55, r: 120, fill: `url(#orb-${variant})` }));
    if (variant === "night") {
      // Luna nítida dentro del halo y unas pocas luciérnagas fijas (deterministas).
      frag.append(el("circle", { cx: width * 0.22, cy: horizon * 0.55, r: 16, fill: "#f3ecff" }));
      const flies = el("g", { class: "garden-fireflies", "aria-hidden": "true" });
      for (let i = 0; i < (compact ? 10 : 22); i += 1) {
        const fx = ((i * 0.6180339) % 1) * width;
        const fy = horizon + 30 + ((i * 0.3819660 + 0.2) % 1) * (height - horizon - 80);
        flies.append(el("circle", { cx: fx.toFixed(1), cy: fy.toFixed(1), r: 1.8, fill: "#ffe9a8", opacity: 0.85 }));
      }
      frag.append(flies);
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
      for (const item of laid.filter((i) => i.kind === "lamp")) {
        glows.append(el("circle", { class: "lamp-halo", cx: item.x, cy: item.y - 56 * item.scale, r: 40 * item.scale + 6, fill: "url(#lamp-glow)" }));
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
    const item = itemFromEvent(e);
    if (!item) {
      hideTip();
      return;
    }
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

  document.addEventListener("themechange", () => render());

  store.subscribe((event) => {
    if (["load", "memories", "letters", "settings"].includes(event.type)) {
      if (event.type === "letters" && event.read) return;
      render(event);
    }
  });

  return {
    render,
    /** Lleva el foco a una flor y la resalta. */
    reveal(id) {
      const entry = nodesById.get(id) ?? [...nodesById.values()].find((e) => e.item.members?.some((m) => m.id === id));
      if (!entry) return;
      entry.g.scrollIntoView?.({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "center" });
      entry.g.classList.remove("is-highlight");
      void entry.g.getBoundingClientRect();
      entry.g.classList.add("is-highlight");
      const index = focusOrder.findIndex((i) => i.id === entry.item.id);
      if (index >= 0) setTimeout(() => setFocus(index), 450);
    },
  };
};
