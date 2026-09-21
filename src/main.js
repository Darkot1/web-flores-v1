import "./styles/base.css";
import "./styles/hero.css";
import "./styles/garden.css";
import "./styles/message.css";
import { messageContent } from "./data/message.js";

const buildMessage = () => {
  const title = document.querySelector("[data-message-title]");
  const intro = document.querySelector("[data-message-intro]");
  const body = document.querySelector("[data-message-body]");
  const signature = document.querySelector("[data-message-signature]");

  if (title) title.textContent = messageContent.title;
  if (intro) intro.textContent = messageContent.intro;
  if (body) {
    body.innerHTML = messageContent.lines
      .map((line) => `<span>${line}</span>`)
      .join("");
  }
  if (signature) signature.textContent = `${messageContent.signature}`;
};

document.addEventListener("DOMContentLoaded", () => {
  buildMessage();

  const musicButton = document.getElementById("music-toggle");
  let audioContext = null;
  let oscillators = [];

  const stopMusic = () => {
    if (!audioContext) return;

    oscillators.forEach((osc) => {
      try {
        osc.stop();
      } catch {
        // no-op
      }
    });

    oscillators = [];
    audioContext.close();
    audioContext = null;
    musicButton?.classList.remove("is-on");
    if (musicButton) musicButton.textContent = "Música";
  };

  const startMusic = () => {
    if (audioContext) return;

    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;

    audioContext = new AudioCtx();
    const notes = [261.63, 329.63, 392.0, 523.25];

    notes.forEach((freq, index) => {
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();

      osc.type = index % 2 === 0 ? "sine" : "triangle";
      osc.frequency.value = freq;
      gain.gain.value = 0.018;

      osc.connect(gain);
      gain.connect(audioContext.destination);

      osc.start();
      oscillators.push(osc);
    });

    musicButton?.classList.add("is-on");
    if (musicButton) musicButton.textContent = "Pausa";
  };

  musicButton?.addEventListener("click", async () => {
    if (audioContext) {
      stopMusic();
      return;
    }

    try {
      await startMusic();
    } catch {
      stopMusic();
    }
  });

  document.querySelectorAll("[data-scroll]").forEach((button) => {
    button.addEventListener("click", () => {
      const target = document.querySelector(button.dataset.scroll);
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  });

  const revealElements = document.querySelectorAll(".reveal");
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
        }
      });
    },
    { threshold: 0.2 },
  );

  revealElements.forEach((element) => observer.observe(element));

  const hero = document.querySelector(".scene--hero");
  const garden = document.querySelector(".scene--garden");
  const gardenFlowers = document.querySelectorAll(".garden-flower");

  const applySceneFade = () => {
    const heroRect = hero?.getBoundingClientRect();
    const gardenRect = garden?.getBoundingClientRect();

    if (hero && heroRect) {
      const heroProgress = Math.max(
        0,
        Math.min(
          1,
          (window.innerHeight - heroRect.top) / (window.innerHeight * 1.2),
        ),
      );
      const fade =
        1 -
        Math.min(
          1,
          Math.max(0, (window.scrollY || 0) / (window.innerHeight * 0.9)),
        );
      hero.style.opacity = String(Math.max(0.15, fade));
      hero.style.transform = `scale(${1 + heroProgress * 0.04})`;
    }

    if (garden && gardenRect) {
      const viewportTop = 0;
      const viewportBottom = window.innerHeight;
      const visibleHeight = Math.max(
        0,
        Math.min(gardenRect.bottom, viewportBottom) -
          Math.max(gardenRect.top, viewportTop),
      );
      const opacity = Math.min(
        1,
        Math.max(0.2, visibleHeight / Math.max(gardenRect.height * 0.8, 1)),
      );

      garden.style.opacity = String(opacity);
      garden.style.transform = `translateY(${Math.max(-30, gardenRect.top * 0.18)}px)`;

      gardenFlowers.forEach((flower, index) => {
        const shift = (index - 1) * 18;
        const depth =
          (index % 2 === 0 ? -1 : 1) * (Math.abs(gardenRect.top) * 0.08);
        flower.style.transform = `translate3d(${shift}px, ${depth}px, 0) scale(${0.45 + (index + 1) * 0.12})`;
      });
    }
  };

  const parallaxMount = document.querySelector(".garden");
  const moon = document.querySelector(".moon");
  let ticking = false;

  const updateParallax = () => {
    const scrollY = window.scrollY;
    const section = document.querySelector("#jardin");

    if (parallaxMount && section) {
      const rect = section.getBoundingClientRect();
      const progress = Math.max(
        -1,
        Math.min(1, -rect.top / window.innerHeight),
      );
      parallaxMount.style.transform = `translateX(-50%) translateY(${progress * 18}px)`;
    }

    if (moon && section) {
      const rect = section.getBoundingClientRect();
      const progress = Math.max(
        -1,
        Math.min(1, -rect.top / window.innerHeight),
      );
      moon.style.transform = `translate(${progress * -18}px, ${progress * 12}px)`;
    }

    if (scrollY > 20) {
      document.body.classList.add("is-scrolling");
    }

    ticking = false;
  };

  const cursorGlow = document.createElement("div");
  cursorGlow.className = "cursor-glow";
  document.body.appendChild(cursorGlow);

  window.addEventListener("pointermove", (event) => {
    cursorGlow.style.transform = `translate(${event.clientX}px, ${event.clientY}px)`;
  });

  window.addEventListener(
    "scroll",
    () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          updateParallax();
          applySceneFade();
        });
        ticking = true;
      }
    },
    { passive: true },
  );

  window.addEventListener("resize", () => {
    updateParallax();
    applySceneFade();
  });

  updateParallax();
  applySceneFade();
});
