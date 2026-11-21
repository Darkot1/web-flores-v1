/**
 * Arranque y orquestación del jardín vivo.
 */
import "@fontsource-variable/fraunces/soft.css";
import "@fontsource/figtree/400.css";
import "@fontsource/figtree/600.css";
import "@fontsource/caveat/500.css";

import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/hero.css";
import "./styles/calendar.css";
import "./styles/garden.css";
import "./styles/letters.css";
import "./styles/dialogs.css";

import { config } from "./config.js";
import { createStorage, isSharedConfigured, readGardenCode, rememberGardenCode } from "./lib/storage.js";
import { createStore } from "./lib/store.js";
import { createAmbientMusic } from "./lib/audio.js";
import { setupReveal } from "./lib/motion.js";
import { formatMonth } from "./lib/dates.js";
import { ensureGardenSprite } from "./garden/symbols.js";
import { createGarden, phaseAt } from "./garden/renderer.js";
import { mountIntro, mountStemPath } from "./components/intro.js";
import { renderGardenCounters, renderHeroCounter } from "./components/counters.js";
import { createCalendar } from "./components/calendar.js";
import { createMemorySheet } from "./components/memory-sheet.js";
import { createTimeline } from "./components/timeline.js";
import { createLetters } from "./components/letters.js";
import { createLetterComposer } from "./components/letter-composer.js";
import { createSettings, askGardenCode } from "./components/settings.js";
import { showToast } from "./components/toast.js";
import { mountClosing } from "./components/closing.js";

const $ = (selector) => document.querySelector(selector);

const setupMusic = () => {
  const button = $("[data-music]");
  const label = $("[data-music-label]");
  const music = createAmbientMusic(config.music);
  button.addEventListener("click", async () => {
    const next = !music.playing;
    button.setAttribute("aria-pressed", String(next));
    button.classList.toggle("is-on", next);
    label.textContent = next ? "Pausar música" : "Música";
    try {
      if (next) await music.play();
      else await music.pause();
    } catch {
      button.setAttribute("aria-pressed", "false");
      button.classList.remove("is-on");
      label.textContent = "Música no disponible";
    }
  });
};

const setupTheme = () => {
  const button = $("[data-theme-toggle]");
  const label = $("[data-theme-label]");
  const meta = document.querySelector('meta[name="theme-color"]');
  const apply = (theme, { save = false } = {}) => {
    document.documentElement.dataset.theme = theme;
    const dark = theme === "dark";
    button.setAttribute("aria-pressed", String(dark));
    button.setAttribute("aria-label", dark ? "Modo oscuro activado. Cambiar a modo claro" : "Cambiar a modo oscuro");
    label.textContent = dark ? "Día" : "Noche";
    meta?.setAttribute("content", dark ? "#1d0f28" : "#fbf6ec");
    if (save) {
      try {
        localStorage.setItem("jardin:theme", theme);
      } catch {
        /* ignorar */
      }
    }
    document.dispatchEvent(new CustomEvent("themechange", { detail: { theme } }));
  };
  apply(document.documentElement.dataset.theme === "dark" ? "dark" : "light");
  button.addEventListener("click", () => apply(document.documentElement.dataset.theme === "dark" ? "light" : "dark", { save: true }));
};

const setupNav = () => {
  const topbar = document.querySelector(".topbar");
  const onScroll = () => topbar.classList.toggle("is-scrolled", window.scrollY > 40);
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
  const links = [...document.querySelectorAll("[data-nav]")];
  const sections = links.map((a) => document.getElementById(a.dataset.nav));
  if (!("IntersectionObserver" in window)) return;
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const link = links.find((a) => a.dataset.nav === entry.target.id);
        links.forEach((a) => a.removeAttribute("aria-current"));
        link.setAttribute("aria-current", "location");
        link.classList.add("is-visited");
        document.body.dataset.act = entry.target.id;
      }
    },
    { rootMargin: "-45% 0px -50% 0px" },
  );
  sections.forEach((s) => s && observer.observe(s));
};

const fillCopy = () => {
  document.title = config.title;
  document.querySelector(".brand__text").textContent = config.title;
  document.querySelector(".brand").setAttribute("aria-label", `${config.title}, ir al inicio`);
  $("[data-soil-title]").textContent = config.memories.title;
  $("[data-soil-body]").textContent = config.memories.body;
  $("[data-letters-title]").textContent = config.letters.title;
  $("[data-letters-body]").textContent = config.letters.body;
  $("[data-closing-phrase]").textContent = config.closing.phrase;
  $("[data-closing-body]").textContent = config.closing.body;
};

const connectStorage = async (statusNode) => {
  const onStatus = (status) => {
    statusNode.dataset.status = status;
    statusNode.textContent =
      status === "offline" ? "Sin conexión: lo guardado espera aquí y se sincroniza al volver." : "Jardín compartido · sincronizado";
  };
  if (!isSharedConfigured()) return createStorage();
  let code = readGardenCode() ?? (await askGardenCode());
  for (let attempt = 0; attempt < 5 && code; attempt += 1) {
    try {
      return await createStorage({ code, onStatus });
    } catch (error) {
      if (error.code !== "invalid_code") {
        showToast("No pude conectar con el jardín compartido. Uso este dispositivo por ahora.", { tone: "error" });
        return createStorage();
      }
      rememberGardenCode(null);
      code = await askGardenCode({ invalid: true });
      if (code) rememberGardenCode(code);
    }
  }
  return createStorage();
};

/** Enlaces viejos (#semilla, #tierra) siguen funcionando. */
const redirectLegacyHash = () => {
  const legacy = { "#semilla": "#inicio", "#tierra": "#recuerdos" };
  const target = legacy[window.location.hash];
  if (!target) return;
  history.replaceState(null, "", target);
  requestAnimationFrame(() => document.querySelector(target)?.scrollIntoView());
};

const boot = async () => {
  redirectLegacyHash();
  fillCopy();
  ensureGardenSprite();
  mountIntro({ root: $("#inicio"), config });
  mountStemPath($("[data-stem-path]"));
  setupTheme();
  setupMusic();
  setupNav();
  setupReveal();

  const statusNode = $("[data-save-status]");
  const storage = await connectStorage(statusNode);
  const store = createStore(storage);
  if (store.mode === "local") statusNode.textContent = "Guardado en este dispositivo.";

  const settings = createSettings({ store });
  const openSettings = (opener) => settings.open(opener ?? document.activeElement);

  let garden = null;
  const sheet = createMemorySheet({
    store,
    onClosed: () => garden?.clearPendingPlant(),
    onPlanted: (memory) => {
      showToast("Tu margarita ya está en el jardín.", {
        action: {
          label: "Verla",
          onClick: () => {
            showView("garden");
            garden.reveal(memory.id);
          },
        },
      });
    },
  });

  const calendar = createCalendar($("[data-calendar]"), { store, onSelectDay: (date, button) => sheet.open(date, button) });

  let letters = null;
  const openFromGarden = (item) => {
    const opener = document.activeElement;
    if (item.kind === "memory") {
      calendar.showDate(item.ref.date);
      sheet.open(item.ref.date, opener);
    } else if (item.kind === "letter") letters.open(item.id, opener);
    else if (item.kind === "cluster") sheet.openList(`${item.members.length} recuerdos · ${formatMonth(item.date)}`, item.members.map((m) => m.ref), opener);
  };

  const gardenLabel = (model) =>
    `Jardín con ${model.counts.memories} ${model.counts.memories === 1 ? "recuerdo" : "recuerdos"} y ${model.counts.letters} ${model.counts.letters === 1 ? "carta" : "cartas"}. Usa las flechas para recorrer las flores en orden.`;

  garden = createGarden($("[data-garden-day]"), {
    store,
    label: gardenLabel,
    onOpen: openFromGarden,
    onPlantFirst: () => {
      const today = store.today();
      calendar.showDate(today);
      sheet.open(today, document.activeElement);
    },
    onChooseStart: () => openSettings(),
    // Tocar la tierra del jardín → sembrar ahí un recuerdo (con fecha de hoy, editable).
    onPlantAt: (spot, opener) => sheet.open(store.today(), opener, { spot }),
  });

  mountClosing({ scene: $("[data-closing-scene]"), tally: $("[data-closing-tally]"), store });

  // El jardín sigue la hora real: lo decimos en voz baja bajo el jardín.
  const clockNode = $("[data-garden-clock]");
  const renderClock = () => {
    clockNode.textContent =
      phaseAt(new Date(), config.gardenClock) === "night" ? "Ahora es de noche: los faroles están encendidos." : "Ahora es de día; al anochecer se encienden los faroles.";
  };
  renderClock();
  setInterval(renderClock, 60_000);

  const timeline = createTimeline($("[data-timeline]"), {
    store,
    onOpenMemory: (memory, button) => sheet.open(memory.date, button),
    onOpenLetter: (letter, button) => letters.open(letter.id, button),
  });

  const composer = createLetterComposer({
    store,
    onSent: (letter) => {
      composer.reset();
      showToast("Tu carta ya cuelga de la pérgola y su flor está brotando.", {
        action: {
          label: "Ver su flor",
          onClick: () => {
            showView("garden");
            garden.reveal(letter.id);
          },
        },
      });
    },
  });
  letters = createLetters($("#cartas"), { store, onCompose: (button) => composer.open(button) });

  // Vista Jardín | Camino
  const viewButtons = document.querySelectorAll("[data-view]");
  const showView = (view) => {
    viewButtons.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.view === view)));
    $("[data-garden-day]").hidden = view !== "garden";
    $("[data-timeline]").hidden = view !== "path";
    if (view === "path") timeline.show();
  };
  viewButtons.forEach((b) => b.addEventListener("click", () => showView(b.dataset.view)));

  // Contadores
  const heroCounter = $("[data-hero-counter]");
  const soulCounters = $("[data-soul-counters]");
  const renderCounters = () => {
    renderHeroCounter(heroCounter, store, { onChooseStart: (e) => openSettings(e?.currentTarget), notStartedText: config.intro.notStarted });
    renderGardenCounters(soulCounters, store);
  };
  store.subscribe((event) => {
    if (["load", "memories", "letters", "settings"].includes(event.type)) renderCounters();
  });
  $("[data-open-settings]").addEventListener("click", (e) => openSettings(e.currentTarget));

  await store.load().catch(() => {
    showToast("No pude leer el jardín. Lo intento de nuevo en un momento.", { tone: "error" });
  });

  // En modo compartido, traer lo que plantó el otro.
  if (store.mode === "shared") {
    const refresh = async () => {
      if (document.visibilityState !== "visible" || document.documentElement.classList.contains("has-modal")) return;
      if (await store.refresh()) showToast("El jardín creció: hay algo nuevo plantado.");
    };
    document.addEventListener("visibilitychange", refresh);
    setInterval(refresh, 30_000);
  }

  // Si pasa la medianoche con la página abierta, el jardín madura.
  let lastDay = store.today();
  setInterval(() => {
    if (store.today() !== lastDay) {
      lastDay = store.today();
      store.load();
    }
  }, 60_000);
};

boot();
