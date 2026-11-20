/**
 * Calendario de recuerdos: la tierra donde cada recuerdo planta una flor.
 * Patrón ARIA grid con roving tabindex; flechas, RePág/AvPág, Inicio/Fin.
 * Swipe horizontal en móvil para cambiar de mes.
 */
import { addDays, formatLong, formatMonth, parseKey, toKey } from "../lib/dates.js";
import { computeMilestones, stageFor, flowerColorFor } from "../garden/growth.js";
import { daisySymbolId, ensureGardenSprite, paletteVars, symbolHref, symbolSeed, DAISY_SCALE } from "../garden/symbols.js";
import { buildDaisy, el, growDaisy } from "./daisy.js";
import { config } from "../config.js";

const WEEKDAYS = [
  ["Lu", "lunes"],
  ["Ma", "martes"],
  ["Mi", "miércoles"],
  ["Ju", "jueves"],
  ["Vi", "viernes"],
  ["Sa", "sábado"],
  ["Do", "domingo"],
];

const monthStart = (key) => `${key.slice(0, 7)}-01`;
const shiftMonth = (key, delta) => {
  const d = parseKey(monthStart(key));
  d.setMonth(d.getMonth() + delta);
  return toKey(d);
};

/** Encuadre por etapa: los brotes se ven pequeños pero legibles. */
export const cellViewBox = (stage) => ({ seed: "-14 -14 28 18", sprout: "-22 -44 44 48", bud: "-30 -96 60 100" }[stage] ?? "-34 -110 68 114");

const miniDaisy = (stage, color) => {
  const svg = el("svg", { class: "cal-daisy", viewBox: cellViewBox(stage), "aria-hidden": "true", focusable: "false", style: paletteVars(color) });
  svg.append(el("use", { href: symbolHref(daisySymbolId(stage, 16)) }));
  return svg;
};

export const createCalendar = (root, { store, onSelectDay }) => {
  ensureGardenSprite();
  const label = root.querySelector("[data-calendar-label]");
  const grid = root.querySelector("[data-calendar-grid]");
  const prev = root.querySelector("[data-calendar-prev]");
  const next = root.querySelector("[data-calendar-next]");
  const todayBtn = root.querySelector("[data-calendar-today]");
  grid.dataset.focusScope = "";

  let visible = monthStart(store.today());
  let focused = store.today();
  let swiped = false;

  const render = ({ focus = false, freshDate = null } = {}) => {
    const today = store.today();
    const { start } = store.settings();
    const milestoneDates = new Map(computeMilestones(start, shiftMonth(visible, 1)).map((m) => [m.date, m]));
    const memories = store.memories();
    const byDate = new Map();
    for (const m of memories) {
      if (!byDate.has(m.date)) byDate.set(m.date, []);
      byDate.get(m.date).push(m);
    }

    const monthText = formatMonth(visible);
    if (label.textContent !== monthText) label.textContent = monthText; // aria-live: solo al cambiar de mes
    if (focused.slice(0, 7) !== visible.slice(0, 7)) focused = visible;

    const first = parseKey(visible);
    const lead = (first.getDay() + 6) % 7;
    const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
    const totalCells = Math.ceil((lead + daysInMonth) / 7) * 7;

    const rows = [];
    const head = document.createElement("div");
    head.setAttribute("role", "row");
    head.className = "cal__row cal__row--head";
    for (const [short, long] of WEEKDAYS) {
      const th = document.createElement("div");
      th.setAttribute("role", "columnheader");
      th.className = "cal__weekday";
      const abbr = document.createElement("abbr");
      abbr.title = long;
      abbr.textContent = short;
      th.append(abbr);
      head.append(th);
    }
    rows.push(head);

    let row = null;
    for (let i = 0; i < totalCells; i += 1) {
      if (i % 7 === 0) {
        row = document.createElement("div");
        row.setAttribute("role", "row");
        row.className = "cal__row";
        rows.push(row);
      }
      const cell = document.createElement("div");
      cell.setAttribute("role", "gridcell");
      cell.className = "cal__cell";
      const dayNum = i - lead + 1;
      if (dayNum < 1 || dayNum > daysInMonth) {
        cell.classList.add("cal__cell--out");
        row.append(cell);
        continue;
      }
      const key = toKey(new Date(first.getFullYear(), first.getMonth(), dayNum));
      const dayMemories = byDate.get(key) ?? [];
      const ms = milestoneDates.get(key);
      const special = dayMemories.some((m) => m.isMilestone);
      const button = document.createElement("button");
      button.type = "button";
      button.className = "cal__day";
      button.dataset.date = key;
      button.tabIndex = key === focused ? 0 : -1;
      if (key === today) {
        button.classList.add("is-today");
        button.setAttribute("aria-current", "date");
      }
      if (key > today) button.classList.add("is-future");
      if (dayMemories.length) button.classList.add("has-memory");
      if (special) button.classList.add("is-special");
      if (ms) button.classList.add(`has-${ms.kind}`);

      const num = document.createElement("span");
      num.className = "cal__num";
      num.textContent = String(dayNum);
      num.setAttribute("aria-hidden", "true");
      button.append(num);

      if (dayMemories.length) {
        const stage = stageFor(key, today, config.growth);
        const holder = document.createElement("span");
        holder.className = "cal__flower";
        if (key === freshDate) {
          const svg = el("svg", { class: "cal-daisy", viewBox: cellViewBox(stage), "aria-hidden": "true", focusable: "false", style: paletteVars(flowerColorFor(dayMemories[0].id)) });
          const g = buildDaisy({ stage, petals: 16, seed: symbolSeed(stage, 16), useVars: true });
          svg.append(el("g", { transform: `scale(${DAISY_SCALE})` }, [g]));
          holder.append(svg);
          requestAnimationFrame(() => growDaisy(g, { delay: 150, speed: 1.3 }));
        } else {
          holder.append(miniDaisy(stage, flowerColorFor(dayMemories[0].id)));
        }
        button.append(holder);
        if (dayMemories.length > 1) {
          const count = document.createElement("span");
          count.className = "cal__count";
          count.textContent = String(dayMemories.length);
          count.setAttribute("aria-hidden", "true");
          button.append(count);
        }
      }
      if (ms) {
        const mark = document.createElement("span");
        mark.className = `cal__mark cal__mark--${ms.kind}`;
        mark.setAttribute("aria-hidden", "true");
        button.append(mark);
      }

      const parts = [formatLong(key)];
      if (key === today) parts.push("hoy");
      if (dayMemories.length) parts.push(dayMemories.length === 1 ? "1 recuerdo" : `${dayMemories.length} recuerdos`);
      else parts.push("sin recuerdos");
      if (special) parts.push("día especial");
      if (ms) parts.push(ms.label);
      button.setAttribute("aria-label", parts.join(", "));
      cell.append(button);
      row.append(cell);
    }

    grid.replaceChildren(...rows);
    if (focus) grid.querySelector(`[data-date="${focused}"]`)?.focus();
  };

  const go = (key, { focus = true } = {}) => {
    focused = key;
    if (monthStart(key) !== visible) visible = monthStart(key);
    render({ focus });
  };

  prev.addEventListener("click", () => {
    visible = shiftMonth(visible, -1);
    focused = visible;
    render();
  });
  next.addEventListener("click", () => {
    visible = shiftMonth(visible, 1);
    focused = visible;
    render();
  });
  todayBtn.addEventListener("click", () => go(store.today()));

  grid.addEventListener("click", (event) => {
    const button = event.target.closest(".cal__day");
    if (!button || swiped) return;
    focused = button.dataset.date;
    grid.querySelectorAll(".cal__day[tabindex='0']").forEach((b) => (b.tabIndex = -1));
    button.tabIndex = 0;
    onSelectDay(button.dataset.date, button);
  });

  grid.addEventListener("keydown", (event) => {
    const button = event.target.closest(".cal__day");
    if (!button) return;
    const key = button.dataset.date;
    const date = parseKey(key);
    const dow = (date.getDay() + 6) % 7;
    const moves = {
      ArrowLeft: () => addDays(key, -1),
      ArrowRight: () => addDays(key, 1),
      ArrowUp: () => addDays(key, -7),
      ArrowDown: () => addDays(key, 7),
      Home: () => addDays(key, -dow),
      End: () => addDays(key, 6 - dow),
      PageUp: () => {
        const d = parseKey(shiftMonth(key, -1));
        d.setDate(Math.min(date.getDate(), new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
        return toKey(d);
      },
      PageDown: () => {
        const d = parseKey(shiftMonth(key, 1));
        d.setDate(Math.min(date.getDate(), new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
        return toKey(d);
      },
    };
    if (moves[event.key]) {
      event.preventDefault();
      go(moves[event.key]());
    }
  });

  // Swipe
  let startX = 0;
  let startY = 0;
  let tracking = false;
  grid.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "mouse") return;
    tracking = true;
    swiped = false;
    startX = event.clientX;
    startY = event.clientY;
  });
  grid.addEventListener("pointerup", (event) => {
    if (!tracking) return;
    tracking = false;
    const dx = event.clientX - startX;
    const dy = event.clientY - startY;
    if (Math.abs(dx) > 50 && Math.abs(dy) < 40) {
      swiped = true;
      visible = shiftMonth(visible, dx < 0 ? 1 : -1);
      focused = visible;
      render();
      grid.classList.remove("is-swipe-left", "is-swipe-right");
      void grid.offsetWidth;
      grid.classList.add(dx < 0 ? "is-swipe-left" : "is-swipe-right");
      setTimeout(() => (swiped = false), 50);
    }
  });
  grid.addEventListener("pointercancel", () => (tracking = false));

  store.subscribe((event) => {
    if (event.type === "memories") {
      const changed = event.freshId ? store.memories().find((m) => m.id === event.freshId) : null;
      render({ freshDate: changed?.date ?? null });
    } else if (event.type === "load" || event.type === "settings") {
      render();
    }
  });

  render();

  return {
    showDate(key) {
      go(key, { focus: false });
    },
    focusDate(key) {
      go(key);
    },
  };
};
