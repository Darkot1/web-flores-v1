/**
 * Contadores con alma: discretos, tipográficos, sin aspecto de dashboard.
 */
import { formatLong, formatNumber, formatDuration } from "../lib/dates.js";
import { gardenAgeDays, nextMilestone } from "../garden/growth.js";

const plural = (n, one, many) => `${formatNumber(n)} ${n === 1 ? one : many}`;

export const renderHeroCounter = (node, store, { onChooseStart, notStartedText }) => {
  const { start } = store.settings();
  const today = store.today();
  node.replaceChildren();
  if (!start) {
    const text = document.createElement("span");
    text.textContent = notStartedText;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn btn--ghost hero__start-btn";
    btn.textContent = "Elegir el día en que empezó";
    btn.addEventListener("click", onChooseStart);
    node.append(text, btn);
    return;
  }
  const days = gardenAgeDays(start, today);
  if (start > today) {
    const text = document.createElement("span");
    text.textContent = `La semilla se planta el ${formatLong(start)}.`;
    node.append(text);
    return;
  }
  const number = document.createElement("strong");
  number.className = "hero__days";
  number.textContent = formatNumber(days);
  const label = document.createElement("span");
  label.textContent = days === 1 ? " día cultivando este jardín" : " días cultivando este jardín";
  const since = document.createElement("small");
  since.className = "hero__since";
  since.textContent = `Desde el ${formatLong(start)} · ${formatDuration(start, today)}`;
  node.append(number, label, since);
};

export const renderGardenCounters = (node, store) => {
  const { start } = store.settings();
  const today = store.today();
  const memories = store.memories().length;
  const letters = store.letters().length;
  const parts = [];
  if (start && start <= today) parts.push([gardenAgeDays(start, today), "día cultivando", "días cultivando"]);
  parts.push([memories, "recuerdo sembrado", "recuerdos sembrados"], [letters, "carta", "cartas"]);

  const list = document.createElement("ul");
  list.className = "soul-counters__list";
  for (const [n, one, many] of parts) {
    const li = document.createElement("li");
    const strong = document.createElement("strong");
    strong.textContent = formatNumber(n);
    const span = document.createElement("span");
    span.textContent = ` ${n === 1 ? one : many}`;
    li.append(strong, span);
    list.append(li);
  }
  node.replaceChildren(list);
  const next = nextMilestone(start, today);
  if (next && start <= today) {
    const p = document.createElement("p");
    p.className = "soul-counters__next";
    p.textContent =
      next.kind === "arch"
        ? `En ${plural(next.inDays, "día", "días")} crece un arco de flores: ${next.label}.`
        : `En ${plural(next.inDays, "día", "días")} se enciende un nuevo farol: ${next.label}.`;
    node.append(p);
  }
};
