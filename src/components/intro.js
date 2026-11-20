/**
 * Acto 1 · La semilla. Una semilla cae, brota y se abre una gran margarita
 * morada pétalo a pétalo; luego aparece su nombre. Saltable con un toque,
 * una tecla o scroll. Con reduced-motion todo aparece ya florecido.
 */
import { buildDaisy, el } from "./daisy.js";
import { growDaisy } from "./daisy.js";
import { prefersReducedMotion, rafThrottle, watchVisibility, clamp } from "../lib/motion.js";

export const mountIntro = ({ root, config }) => {
  const stage = root.querySelector("[data-hero-stage]");
  const copyNodes = root.querySelectorAll("[data-hero-reveal]");
  const skip = root.querySelector("[data-hero-skip]");
  root.querySelector("[data-hero-eyebrow]").textContent = config.intro.eyebrow;
  root.querySelector("[data-hero-name]").textContent = config.name;
  root.querySelector("[data-hero-phrase]").textContent = config.intro.phrase;
  root.querySelector("[data-hero-body]").textContent = config.intro.body;

  const svg = el("svg", { class: "hero-daisy", viewBox: "-62 -150 124 160", "aria-hidden": "true", focusable: "false" });
  svg.append(el("ellipse", { cx: 0, cy: 2, rx: 46, ry: 7, fill: "#8a6a4f", opacity: 0.22 }));
  const daisy = buildDaisy({ stage: "full", petals: 21, seed: "shara", color: "morada", stemHeight: 104 });
  const seed = el("g", { class: "hero-seed" }, [el("ellipse", { cx: 0, cy: -3, rx: 4.6, ry: 3, transform: "rotate(-20)", fill: "#6e5139" })]);
  svg.append(daisy, seed);
  stage.append(svg);

  const reveal = () => {
    root.classList.remove("is-intro");
    root.classList.add("is-bloomed");
    skip?.setAttribute("hidden", "");
  };

  if (prefersReducedMotion()) {
    seed.remove();
    reveal();
    return;
  }

  root.classList.add("is-intro");
  skip?.removeAttribute("hidden");
  const animations = [];
  animations.push(
    seed.animate(
      [
        { transform: "translateY(-150px)", opacity: 0 },
        { transform: "translateY(-150px)", opacity: 1, offset: 0.1 },
        { transform: "translateY(0)", opacity: 1, offset: 0.78 },
        { transform: "translateY(-4px)", opacity: 1, offset: 0.88 },
        { transform: "translateY(0)", opacity: 1 },
      ],
      { duration: 900, easing: "cubic-bezier(.45,0,.85,.6)", fill: "both" },
    ),
    seed.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, delay: 1100, fill: "forwards" }),
  );
  const growth = growDaisy(daisy, { delay: 950, petalStagger: 40 });
  animations.push(...growth.animations);
  const copyDelay = 3000;
  copyNodes.forEach((node, i) => {
    animations.push(
      node.animate([{ opacity: 0, transform: "translateY(14px)" }, { opacity: 1, transform: "none" }], {
        duration: 800,
        delay: copyDelay + i * 160,
        easing: "cubic-bezier(.22,.8,.3,1)",
        fill: "backwards",
      }),
    );
  });

  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    animations.forEach((a) => a.finish());
    reveal();
    cleanup();
  };
  const events = ["pointerdown", "keydown", "wheel", "touchmove"];
  const onScroll = () => window.scrollY > 24 && finish();
  const cleanup = () => {
    events.forEach((e) => window.removeEventListener(e, finish));
    window.removeEventListener("scroll", onScroll);
  };
  events.forEach((e) => window.addEventListener(e, finish, { passive: true }));
  window.addEventListener("scroll", onScroll, { passive: true });
  skip?.addEventListener("click", finish);
  Promise.all(animations.map((a) => a.finished.catch(() => {}))).then(() => {
    done = true;
    reveal();
    cleanup();
  });
};

/**
 * Transición al Acto 2: el tallo crece hacia abajo con el scroll y se vuelve
 * el camino del jardín. Una sola escritura de estilo por frame y solo cuando
 * está en pantalla.
 */
export const mountStemPath = (container) => {
  const clip = container.querySelector("[data-stem-clip]");
  if (!clip) return;
  if (prefersReducedMotion()) {
    clip.setAttribute("height", "100");
    return;
  }
  let visible = false;
  const update = rafThrottle(() => {
    if (!visible) return;
    const rect = container.getBoundingClientRect();
    const progress = clamp((window.innerHeight * 0.85 - rect.top) / (rect.height + window.innerHeight * 0.2));
    clip.setAttribute("height", (progress * 100).toFixed(2));
  });
  watchVisibility(container, (v) => {
    visible = v;
    if (v) update();
  }, { rootMargin: "0px" });
  window.addEventListener("scroll", update, { passive: true });
  update();
};
