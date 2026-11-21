/**
 * Vista "Camino": el jardín recorrido desde el primer día hasta hoy, como
 * lista semántica (también es la alternativa accesible al jardín visual).
 */
import { computeMilestones, seasonFor, stageFor, STAGE_LABELS, flowerColorFor } from "../garden/growth.js";
import { formatLong, formatMonth, monthKey } from "../lib/dates.js";
import { daisySymbolId, ensureGardenSprite, paletteVars, symbolHref } from "../garden/symbols.js";
import { el } from "./daisy.js";
import { config } from "../config.js";

const h = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

const ICONS = { tree: "tree-sapling", arch: "arch", bloom: "bloom", grand: "grand", lamp: "lamp", lantern: "lantern" };
const ICON_BOX = { tree: "-50 -160 100 166", arch: "-70 -100 140 104", bloom: "-34 -126 68 130", grand: "-86 -126 172 130", lamp: "-20 -80 40 84", lantern: "-12 -2 24 28" };
const KICKER = { tree: "El primer día", arch: "Arco de flores", bloom: "Un árbol en flor", grand: "Gran arco · tres meses más", lamp: "Un farol junto al camino", lantern: "Una luz en la guirnalda" };

const icon = (href, style, viewBox = "-34 -110 68 116") => {
  const svg = el("svg", { class: "timeline__icon", viewBox, "aria-hidden": "true", focusable: "false", style });
  svg.append(el("use", { href: symbolHref(href) }));
  return svg;
};

export const createTimeline = (host, { store, onOpenMemory, onOpenLetter }) => {
  ensureGardenSprite();

  const render = () => {
    const today = store.today();
    const { start, authors } = store.settings();
    const entries = [
      ...store.memories().map((m) => ({ kind: "memory", date: m.date, ref: m })),
      ...store.letters().map((l) => ({ kind: "letter", date: l.date, ref: l })),
      ...computeMilestones(start, today).map((ms) => ({ kind: ms.kind, date: ms.date, ref: ms })),
    ].sort((a, b) => a.date.localeCompare(b.date) || (a.kind === "tree" ? -1 : 0));

    const root = h("ol", "timeline");
    if (!entries.length) {
      const li = h("li", "timeline__empty", "El camino empieza con el primer recuerdo que plantes.");
      root.append(li);
      host.replaceChildren(root);
      return;
    }

    let currentMonth = null;
    let monthList = null;
    for (const entry of entries) {
      const mk = monthKey(entry.date);
      if (mk !== currentMonth) {
        currentMonth = mk;
        const monthLi = h("li", "timeline__month");
        const head = h("h4", "timeline__month-title");
        head.append(h("span", "", formatMonth(`${mk}-01`)), h("small", "", seasonFor(`${mk}-01`, config.climate).label));
        monthList = h("ol", "timeline__items");
        monthLi.append(head, monthList);
        root.append(monthLi);
      }
      const li = h("li", `timeline__item timeline__item--${entry.kind}`);
      if (entry.kind === "memory" || entry.kind === "letter") {
        const m = entry.ref;
        const stage = stageFor(m.date, today, config.growth);
        const btn = h("button", "timeline__btn");
        btn.type = "button";
        const color = entry.kind === "letter" ? m.flower?.color ?? "morada" : flowerColorFor(m.id);
        btn.append(icon(daisySymbolId(stage, 16, entry.kind === "letter"), paletteVars(color)));
        const text = h("span", "timeline__text");
        text.append(h("span", "timeline__kicker", entry.kind === "letter" ? `Carta de ${authors[m.from] ?? "—"}` : m.isMilestone ? "Día especial" : "Recuerdo"));
        text.append(h("span", "timeline__title", m.title));
        text.append(h("span", "timeline__date", `${formatLong(m.date)} · ${STAGE_LABELS[stage]}`));
        btn.append(text);
        btn.addEventListener("click", () => (entry.kind === "letter" ? onOpenLetter(m, btn) : onOpenMemory(m, btn)));
        li.append(btn);
      } else {
        const row = h("div", "timeline__milestone");
        const style = entry.ref.anniversary ? "--g1:#F2C14E;--g2:#FFF1BF;--g3:#E8A25C;--g4:#C98A1E" : entry.kind === "lantern" ? "--lantern-fill:#F2C14E" : entry.kind === "lamp" ? "--lamp-light:#F2C14E" : undefined;
        row.append(icon(ICONS[entry.kind], style, ICON_BOX[entry.kind]));
        const text = h("span", "timeline__text");
        text.append(h("span", "timeline__kicker", entry.ref.anniversary ? "Aniversario · el gran arco dorado" : KICKER[entry.kind]));
        text.append(h("span", "timeline__title", entry.ref.label));
        text.append(h("span", "timeline__date", formatLong(entry.date)));
        row.append(text);
        li.append(row);
      }
      monthList.append(li);
    }
    const todayLi = h("li", "timeline__today");
    todayLi.append(h("span", "timeline__kicker", "Hoy"), h("span", "timeline__title", formatLong(today)), h("span", "timeline__date", "…y el camino sigue."));
    root.append(todayLi);
    host.replaceChildren(root);
  };

  // Con cientos de recuerdos la lista es grande: solo se dibuja cuando se ve.
  let stale = true;
  const renderIfVisible = () => {
    if (host.hidden) return;
    render();
    stale = false;
  };
  store.subscribe((event) => {
    if (["load", "memories", "letters", "settings"].includes(event.type) && !event.read) {
      stale = true;
      renderIfVisible();
    }
  });
  return {
    show() {
      if (stale) renderIfVisible();
    },
  };
};
