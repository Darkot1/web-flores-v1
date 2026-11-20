/**
 * Acto 3 · Cartas. Los sobres cuelgan de una pérgola, cada uno con su lacre
 * de margarita. Al abrir uno: el sobre se abre, la carta se despliega en papel
 * crema con una flor prensada distinta y caen unos pétalos.
 * Todo el texto se inserta con textContent.
 */
import { createDialog } from "./modal.js";
import { createDaisy, el, PETAL_PALETTES } from "./daisy.js";
import { showToast } from "./toast.js";
import { formatLong, formatShort } from "../lib/dates.js";
import { createRng } from "../lib/seed.js";
import { prefersReducedMotion } from "../lib/motion.js";

export const SEAL_COLORS = {
  ciruela: { fill: "#5B2E7E", light: "#C9B6F2", label: "Ciruela" },
  morado: { fill: "#7B4FBF", light: "#E8DDF7", label: "Morado" },
  rosa: { fill: "#B23F6E", light: "#F6D9E4", label: "Rosa" },
  dorado: { fill: "#C99227", light: "#FBEFC9", label: "Dorado" },
  salvia: { fill: "#5F8259", light: "#E3ECDF", label: "Salvia" },
};

const h = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

export const createSeal = (color = "ciruela", size = 40) => {
  const c = SEAL_COLORS[color] ?? SEAL_COLORS.ciruela;
  const svg = el("svg", { class: "seal", viewBox: "-20 -20 40 40", width: size, height: size, "aria-hidden": "true", focusable: "false" });
  const blob = [];
  for (let i = 0; i < 18; i += 1) {
    const a = (i / 18) * Math.PI * 2;
    const r = 17 + (i % 2 ? 1.4 : -0.6);
    blob.push(`${(Math.cos(a) * r).toFixed(1)},${(Math.sin(a) * r).toFixed(1)}`);
  }
  svg.append(el("polygon", { points: blob.join(" "), fill: c.fill }));
  svg.append(el("circle", { r: 12.5, fill: "none", stroke: c.light, "stroke-opacity": 0.45, "stroke-width": 0.8 }));
  for (let i = 0; i < 10; i += 1) {
    svg.append(el("ellipse", { cx: 0, cy: -6, rx: 1.8, ry: 4.6, transform: `rotate(${i * 36})`, fill: c.light, opacity: 0.75 }));
  }
  svg.append(el("circle", { r: 2.6, fill: c.light, opacity: 0.9 }));
  svg.append(el("ellipse", { cx: -6, cy: -8, rx: 4, ry: 2, fill: "#fff", opacity: 0.18, transform: "rotate(-30)" }));
  return svg;
};

/** Papel de una carta (también se usa como vista previa del compositor). */
export const buildLetterPaper = (letter, authors, { preview = false } = {}) => {
  const paper = h("article", "letter-paper");
  const pressed = createDaisy({
    size: 92,
    stage: "full",
    color: letter.flower?.color ?? "morada",
    petals: letter.flower?.petals ?? 21,
    seed: letter.id ?? "preview",
    className: "letter-paper__flower",
  });
  const headingId = preview ? undefined : `letter-title-${letter.id}`;
  const title = h(preview ? "p" : "h2", "letter-paper__title", letter.title || "Sin título");
  if (headingId) title.id = headingId;
  const meta = h("p", "letter-paper__meta", `De ${authors[letter.from] ?? "—"} para ${authors[letter.to] ?? "—"} · ${letter.date ? formatLong(letter.date) : ""}`);
  paper.append(pressed, title, meta);
  if (letter.intro) paper.append(h("p", "letter-paper__intro", letter.intro));
  const body = h("div", "letter-paper__body");
  for (const para of letter.body ?? []) body.append(h("p", "", para));
  paper.append(body);
  const signature = h("p", "letter-paper__signature");
  signature.append(h("span", "letter-paper__sign", letter.signature || ""), h("span", "letter-paper__from", authors[letter.from] ?? ""));
  paper.append(signature);
  return { paper, headingId };
};

const petalRain = (host, seed) => {
  if (prefersReducedMotion()) return;
  const rng = createRng(seed);
  const colors = [PETAL_PALETTES.morada.petal, PETAL_PALETTES.lavanda.petal, PETAL_PALETTES.blanca.petal, PETAL_PALETTES.morada.inner];
  for (let i = 0; i < 14; i += 1) {
    const petal = h("span", "falling-petal");
    petal.style.left = `${rng.range(4, 96)}%`;
    petal.style.background = rng.pick(colors);
    host.append(petal);
    const drift = rng.range(-60, 60);
    const spin = rng.range(-260, 260);
    const anim = petal.animate(
      [
        { transform: `translate(0, -10vh) rotate(0deg)`, opacity: 0 },
        { opacity: 1, offset: 0.1 },
        { transform: `translate(${drift}px, 95vh) rotate(${spin}deg)`, opacity: 0 },
      ],
      { duration: rng.range(3200, 5200), delay: 900 + rng.range(0, 1400), easing: "cubic-bezier(.3,.1,.6,1)", fill: "both" },
    );
    anim.finished.then(() => petal.remove()).catch(() => {});
  }
};

export const createLetters = (root, { store, onCompose }) => {
  const shelf = root.querySelector("[data-letters-list]");
  const composeBtn = root.querySelector("[data-letters-compose]");
  const reader = createDialog({ className: "letter-dialog on-dark" });

  const render = () => {
    const { authors } = store.settings();
    const letters = store.letters();
    shelf.replaceChildren();
    letters.forEach((letter, index) => {
      const li = h("li", "pergola__item");
      const rng = createRng(letter.id);
      li.style.setProperty("--swing", `${rng.range(-3, 3).toFixed(1)}deg`);
      li.style.setProperty("--string", `${Math.round(rng.range(14, 54))}px`);
      li.style.setProperty("--delay", `${(-rng.range(0, 6)).toFixed(2)}s`);
      const unread = !store.isRead(letter.id);
      const btn = h("button", `envelope${unread ? " is-unread" : ""}`);
      btn.type = "button";
      btn.dataset.letterId = letter.id;
      btn.setAttribute("aria-label", `${letter.title}, ${authors[letter.from] ?? ""} · ${formatShort(letter.date)}${unread ? ", sin leer" : ", leída"} (carta)`);
      const body = h("span", "envelope__body");
      body.append(h("span", "envelope__flap"), createSeal(letter.sealColor, 34));
      body.querySelector(".seal").classList.add("envelope__seal");
      const label = h("span", "envelope__label");
      label.append(h("span", "envelope__title", letter.title), h("span", "envelope__meta", `${authors[letter.from] ?? ""} · ${formatShort(letter.date)}`));
      if (unread) label.append(h("span", "envelope__unread", "Sin leer"));
      btn.append(h("span", "envelope__string", ""), body, label);
      btn.addEventListener("click", () => openLetter(letter, btn));
      li.append(btn);
      li.style.setProperty("--i", index);
      shelf.append(li);
    });
  };

  const openLetter = (letter, opener) => {
    const { authors } = store.settings();
    const stage = h("div", "letter-open");
    const envelope = h("div", "letter-envelope");
    envelope.setAttribute("aria-hidden", "true");
    const flap = h("span", "letter-envelope__flap");
    const seal = createSeal(letter.sealColor, 52);
    seal.classList.add("letter-envelope__seal");
    envelope.append(h("span", "letter-envelope__back"), flap, seal);

    const { paper, headingId } = buildLetterPaper(letter, authors);
    reader.dialog.setAttribute("aria-labelledby", headingId);
    const actions = h("div", "letter-paper__actions");
    const closeBtn = h("button", "btn btn--ghost", "Guardar en el sobre");
    closeBtn.type = "button";
    closeBtn.addEventListener("click", () => reader.close());
    actions.append(closeBtn);
    if (!letter.initial) {
      const del = h("button", "btn btn--quiet", "Borrar carta");
      del.type = "button";
      del.addEventListener("click", async () => {
        if (del.dataset.confirm !== "1") {
          del.dataset.confirm = "1";
          del.textContent = "¿Seguro? Toca otra vez para borrar";
          return;
        }
        const undo = await store.deleteLetter(letter.id);
        reader.close();
        showToast(`Carta borrada: “${letter.title}”`, { action: { label: "Deshacer", onClick: undo } });
      });
      actions.append(del);
    }
    paper.append(actions);
    const rain = h("div", "petal-rain");
    rain.setAttribute("aria-hidden", "true");
    stage.append(envelope, paper, rain);
    reader.body.replaceChildren(stage);
    reader.open(opener);
    store.markRead(letter.id);

    if (prefersReducedMotion()) {
      envelope.remove();
      paper.focus?.();
      return;
    }
    seal.animate([{ transform: "scale(1)", opacity: 1 }, { transform: "scale(1.25)", opacity: 0 }], { duration: 380, delay: 150, fill: "forwards", easing: "ease-in" });
    flap.animate([{ transform: "rotateX(0deg)" }, { transform: "rotateX(180deg)" }], { duration: 650, delay: 300, fill: "forwards", easing: "cubic-bezier(.5,0,.3,1)" });
    envelope.animate([{ transform: "none", opacity: 1 }, { transform: "translateY(60px) scale(.9)", opacity: 0 }], { duration: 600, delay: 1000, fill: "forwards", easing: "ease-in" });
    paper.animate(
      [
        { transform: "translateY(90px) scale(.82)", opacity: 0 },
        { transform: "translateY(-12px) scale(.98)", opacity: 1, offset: 0.7 },
        { transform: "none", opacity: 1 },
      ],
      { duration: 900, delay: 850, fill: "backwards", easing: "cubic-bezier(.22,.8,.3,1)" },
    );
    petalRain(rain, letter.id);
    setTimeout(() => envelope.remove(), 1700);
  };

  composeBtn?.addEventListener("click", () => onCompose(composeBtn));

  store.subscribe((event) => {
    if (["load", "letters", "settings"].includes(event.type)) render();
  });
  render();

  return {
    open(id, opener) {
      const letter = store.letters().find((l) => l.id === id);
      if (letter) openLetter(letter, opener);
    },
  };
};
