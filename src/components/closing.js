/**
 * Cierre del Acto III. No repite el jardín: vuelve a la margarita del
 * principio, ya florecida, de noche, rodeada de una flor pequeña por cada
 * recuerdo y carta (hasta 24) y dos faroles encendidos.
 */
import { buildDaisy, el } from "./daisy.js";
import { flowerColorFor } from "../garden/growth.js";
import { paletteVars, symbolHref } from "../garden/symbols.js";
import { createRng } from "../lib/seed.js";
import { formatNumber } from "../lib/dates.js";
import { gardenAgeDays } from "../garden/growth.js";

const plural = (n, one, many) => `${formatNumber(n)} ${n === 1 ? one : many}`;

export const mountClosing = ({ scene, tally, store }) => {
  const render = () => {
    const memories = store.memories();
    const letters = store.letters();
    const svg = el("svg", { class: "closing-svg", viewBox: "-300 -250 600 280", focusable: "false" });
    svg.style.setProperty("--lamp-light", "#ffe9a8");

    svg.append(
      el("ellipse", { cx: 0, cy: 18, rx: 300, ry: 46, fill: "#2f2440" }),
      el("ellipse", { cx: 0, cy: 10, rx: 230, ry: 26, fill: "#3a2d4f" }),
    );

    // Una florcita por recuerdo y por carta, en un arco alrededor.
    const small = [...memories.map((m) => ({ id: m.id, color: flowerColorFor(m.id) })), ...letters.map((l) => ({ id: l.id, color: l.flower?.color ?? "morada" }))].slice(-24);
    small.forEach((item, i) => {
      const rng = createRng(`closing-${item.id}`);
      const side = i % 2 === 0 ? -1 : 1;
      const k = Math.floor(i / 2);
      const x = side * (70 + k * 17 + rng.range(-5, 5));
      const y = 12 + rng.range(-6, 10) - Math.max(0, 12 - k) * 0.3;
      const s = 0.42 - Math.min(0.18, k * 0.012);
      const g = el("g", { transform: `translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${s.toFixed(3)})`, style: paletteVars(item.color) });
      g.append(el("use", { href: symbolHref("d-full-16") }));
      svg.append(g);
    });

    for (const x of [-120, 120]) {
      svg.append(el("circle", { class: "closing-halo", cx: x, cy: -48, r: 46, fill: "url(#lamp-glow)" }));
      svg.append(el("use", { href: symbolHref("lamp"), transform: `translate(${x} 16) scale(1)` }));
    }

    const daisy = buildDaisy({ stage: "full", petals: 21, seed: "shara", color: "morada", stemHeight: 104 });
    const big = el("g", { class: "closing-daisy", transform: "translate(0 14) scale(1.9)" }, [daisy]);
    svg.append(big);
    scene.replaceChildren(svg);

    const { start } = store.settings();
    const parts = [];
    const days = gardenAgeDays(start, store.today());
    if (start && days > 0) parts.push(plural(days, "día", "días"));
    parts.push(plural(memories.length, "recuerdo", "recuerdos"), plural(letters.length, "carta", "cartas"));
    tally.textContent = parts.join(" · ");
  };

  store.subscribe((event) => {
    if (["load", "memories", "letters", "settings"].includes(event.type)) render();
  });
  render();
};
