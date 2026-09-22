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

  const reducedMotionQuery = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  );
  const compactViewportQuery = window.matchMedia("(max-width: 900px)");
  const isReducedMotion = reducedMotionQuery.matches;
  const isCompactViewport = compactViewportQuery.matches;

  const musicButton = document.getElementById("music-toggle");
  const calendarGrid = document.querySelector("[data-calendar-grid]");
  const calendarLabel = document.querySelector("[data-calendar-label]");
  const calendarPrev = document.querySelector("[data-calendar-prev]");
  const calendarNext = document.querySelector("[data-calendar-next]");
  const calendarToday = document.querySelector("[data-calendar-today]");
  const memoryModal = document.querySelector("[data-memory-modal]");
  const memoryModalDate = document.querySelector("[data-memory-modal-date]");
  const memoryForm = document.querySelector("[data-memory-form]");
  const memoryTitleInput = document.querySelector("[data-memory-title]");
  const memoryNotesInput = document.querySelector("[data-memory-notes]");
  const memoryDeleteButton = document.querySelector("[data-memory-delete]");
  const memoryCloseButtons = document.querySelectorAll("[data-memory-close]");

  let audioContext = null;
  let masterGain = null;
  let musicTimer = null;
  let musicStep = 0;
  const memoryStorageKey = "garden-memories-v1";
  const today = new Date();
  let visibleMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  let activeMemoryDate = "";
  let memoryStore = {};
  let memoryModalHideTimer = null;

  const loadMemoryStore = () => {
    try {
      const raw = window.localStorage.getItem(memoryStorageKey);
      memoryStore = raw ? JSON.parse(raw) : {};
    } catch {
      memoryStore = {};
    }
  };

  const saveMemoryStore = () => {
    window.localStorage.setItem(memoryStorageKey, JSON.stringify(memoryStore));
  };

  const toDateKey = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  };

  const parseDateKey = (dateKey) => {
    const [year, month, day] = dateKey.split("-").map(Number);
    return new Date(year, month - 1, day);
  };

  const formatMonthLabel = (date) =>
    new Intl.DateTimeFormat("es-ES", {
      month: "long",
      year: "numeric",
    })
      .format(date)
      .replace(/^./, (character) => character.toUpperCase());

  const formatLongDate = (date) =>
    new Intl.DateTimeFormat("es-ES", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    })
      .format(date)
      .replace(/^./, (character) => character.toUpperCase());

  const closeMemoryModal = () => {
    if (!memoryModal) return;

    memoryModal.classList.remove("is-open");
    if (memoryModalHideTimer) {
      window.clearTimeout(memoryModalHideTimer);
    }
    memoryModalHideTimer = window.setTimeout(() => {
      if (memoryModal) memoryModal.hidden = true;
    }, 260);
    document.body.classList.remove("modal-open");
  };

  const renderCalendar = () => {
    if (!calendarGrid || !calendarLabel) return;

    const year = visibleMonth.getFullYear();
    const month = visibleMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const leadingEmptyDays = (firstDay.getDay() + 6) % 7;
    const todayKey = toDateKey(today);

    const cells = [];

    for (let index = 0; index < leadingEmptyDays; index += 1) {
      cells.push(
        '<div class="memory-calendar__cell memory-calendar__cell--empty" aria-hidden="true"></div>',
      );
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      const currentDate = new Date(year, month, day);
      const dateKey = toDateKey(currentDate);
      const memoryEntry = memoryStore[dateKey];
      const hasMemory = Boolean(memoryEntry);
      const isToday = dateKey === todayKey;
      const isActive = dateKey === activeMemoryDate;

      cells.push(`
        <button type="button" class="memory-calendar__day${hasMemory ? " has-memory" : ""}${isToday ? " is-today" : ""}${isActive ? " is-active" : ""}" data-calendar-date="${dateKey}">
          <span class="memory-calendar__number">${day}</span>
          ${hasMemory ? '<span class="memory-calendar__flower" aria-hidden="true">✿</span>' : ""}
        </button>
      `);
    }

    calendarGrid.innerHTML = cells.join("");
    calendarLabel.textContent = formatMonthLabel(visibleMonth);

    calendarGrid
      .querySelectorAll("[data-calendar-date]")
      .forEach((dayButton) => {
        dayButton.addEventListener("click", () => {
          const dateKey = dayButton.getAttribute("data-calendar-date");
          if (dateKey) {
            activeMemoryDate = dateKey;
            openMemoryModal(dateKey);
          }
        });
      });
  };

  const openMemoryModal = (dateKey) => {
    if (
      !memoryModal ||
      !memoryModalDate ||
      !memoryForm ||
      !memoryTitleInput ||
      !memoryNotesInput
    ) {
      return;
    }

    activeMemoryDate = dateKey;
    const memoryEntry = memoryStore[dateKey] ?? { title: "", notes: "" };

    if (memoryModalHideTimer) {
      window.clearTimeout(memoryModalHideTimer);
      memoryModalHideTimer = null;
    }

    memoryModal.hidden = false;
    document.body.classList.add("modal-open");
    window.requestAnimationFrame(() => {
      memoryModal.classList.add("is-open");
    });
    memoryModalDate.textContent = formatLongDate(parseDateKey(dateKey));
    memoryTitleInput.value = memoryEntry.title;
    memoryNotesInput.value = memoryEntry.notes;

    if (memoryDeleteButton) {
      memoryDeleteButton.hidden = !memoryStore[dateKey];
    }

    window.setTimeout(() => {
      memoryTitleInput.focus();
    }, 0);
  };

  loadMemoryStore();
  renderCalendar();

  calendarPrev?.addEventListener("click", () => {
    visibleMonth = new Date(
      visibleMonth.getFullYear(),
      visibleMonth.getMonth() - 1,
      1,
    );
    renderCalendar();
  });

  calendarNext?.addEventListener("click", () => {
    visibleMonth = new Date(
      visibleMonth.getFullYear(),
      visibleMonth.getMonth() + 1,
      1,
    );
    renderCalendar();
  });

  calendarToday?.addEventListener("click", () => {
    visibleMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    activeMemoryDate = toDateKey(today);
    renderCalendar();
  });

  memoryCloseButtons.forEach((button) => {
    button.addEventListener("click", closeMemoryModal);
  });

  memoryModal?.addEventListener("click", (event) => {
    if (event.target === memoryModal) {
      closeMemoryModal();
    }
  });

  memoryForm?.addEventListener("submit", (event) => {
    event.preventDefault();

    if (!activeMemoryDate || !memoryTitleInput || !memoryNotesInput) return;

    memoryStore[activeMemoryDate] = {
      title: memoryTitleInput.value.trim(),
      notes: memoryNotesInput.value.trim(),
    };

    saveMemoryStore();
    renderCalendar();
    closeMemoryModal();
  });

  memoryDeleteButton?.addEventListener("click", () => {
    if (!activeMemoryDate || !memoryStore[activeMemoryDate]) return;

    delete memoryStore[activeMemoryDate];
    saveMemoryStore();
    renderCalendar();
    closeMemoryModal();
  });

  const chords = [
    [261.63, 329.63, 392.0, 523.25],
    [246.94, 311.13, 370.0, 493.88],
    [220.0, 293.66, 349.23, 440.0],
    [233.08, 293.66, 392.0, 466.16],
  ];

  const updateMusicButton = (isPlaying) => {
    if (!musicButton) return;

    musicButton.textContent = isPlaying ? "Pausar música" : "Música";
    musicButton.setAttribute("aria-pressed", String(isPlaying));
    musicButton.classList.toggle("is-on", isPlaying);
  };

  const playChord = () => {
    if (!audioContext || !masterGain) return;

    const chord = chords[musicStep % chords.length];
    const start = audioContext.currentTime + 0.02;
    const duration = 1.65;

    chord.forEach((frequency, index) => {
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      const filter = audioContext.createBiquadFilter();

      osc.type = index === 0 ? "sine" : index === 3 ? "triangle" : "sawtooth";
      osc.frequency.setValueAtTime(frequency, start);
      osc.detune.setValueAtTime(index * 3 - 4, start);

      filter.type = "lowpass";
      filter.frequency.setValueAtTime(1100 + index * 180, start);
      filter.Q.setValueAtTime(0.8, start);

      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(
        0.03 - index * 0.003,
        start + 0.12,
      );
      gain.gain.exponentialRampToValueAtTime(0.012, start + duration * 0.78);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(masterGain);

      osc.start(start);
      osc.stop(start + duration + 0.1);
    });

    musicStep += 1;
  };

  const startMusic = async () => {
    if (!audioContext) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;

      audioContext = new AudioCtx();
      masterGain = audioContext.createGain();
      masterGain.gain.value = 0.7;
      masterGain.connect(audioContext.destination);
    }

    if (audioContext.state === "suspended") {
      await audioContext.resume();
    }

    playChord();
    musicTimer = window.setInterval(playChord, 1650);
    updateMusicButton(true);
  };

  const stopMusic = async () => {
    if (musicTimer) {
      window.clearInterval(musicTimer);
      musicTimer = null;
    }

    if (audioContext) {
      await audioContext.close();
    }

    audioContext = null;
    masterGain = null;
    musicStep = 0;
    updateMusicButton(false);
  };

  musicButton?.addEventListener("click", async () => {
    if (audioContext) {
      await stopMusic();
      return;
    }

    try {
      await startMusic();
    } catch {
      await stopMusic();
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
  const sectionGarden = document.querySelector("#jardin");
  const visibleGardenFlowers = Array.from(gardenFlowers).slice(
    0,
    isCompactViewport ? 12 : gardenFlowers.length,
  );
  let gardenIsVisible = !sectionGarden;

  if (sectionGarden) {
    const gardenObserver = new IntersectionObserver(
      ([entry]) => {
        gardenIsVisible = entry.isIntersecting;
      },
      { threshold: 0.08, rootMargin: "180px 0px" },
    );

    gardenObserver.observe(sectionGarden);
  }

  const applySceneFade = () => {
    if (isReducedMotion) return;

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
    } else if (hero) {
      hero.style.opacity = "";
      hero.style.transform = "";
    }

    if (garden && gardenRect && gardenIsVisible) {
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

      visibleGardenFlowers.forEach((flower, index) => {
        const shift = (index - 1) * 18;
        const depth =
          (index % 2 === 0 ? -1 : 1) * (Math.abs(gardenRect.top) * 0.08);
        flower.style.transform = `translate3d(${shift}px, ${depth}px, 0) scale(${0.45 + (index + 1) * 0.12})`;
      });
    } else if (garden) {
      garden.style.opacity = "";
      garden.style.transform = "";
      visibleGardenFlowers.forEach((flower) => {
        flower.style.transform = "";
      });
    }
  };

  const parallaxMount = document.querySelector(".garden");
  const moon = document.querySelector(".moon");
  let ticking = false;

  const updateParallax = () => {
    if (isReducedMotion) return;

    const scrollY = window.scrollY;
    const section = sectionGarden;

    if (parallaxMount && section) {
      if (gardenIsVisible) {
        const rect = section.getBoundingClientRect();
        const progress = Math.max(
          -1,
          Math.min(1, -rect.top / window.innerHeight),
        );
        parallaxMount.style.transform = `translateX(-50%) translateY(${progress * 18}px)`;
      } else {
        parallaxMount.style.transform = "";
      }
    }

    if (moon && section) {
      if (gardenIsVisible) {
        const rect = section.getBoundingClientRect();
        const progress = Math.max(
          -1,
          Math.min(1, -rect.top / window.innerHeight),
        );
        moon.style.transform = `translate(${progress * -18}px, ${progress * 12}px)`;
      } else {
        moon.style.transform = "";
      }
    }

    if (scrollY > 20) {
      document.body.classList.add("is-scrolling");
    }

    ticking = false;
  };

  const cursorGlow = document.createElement("div");
  cursorGlow.className = "cursor-glow";
  document.body.appendChild(cursorGlow);

  if (!isReducedMotion && !isCompactViewport) {
    window.addEventListener("pointermove", (event) => {
      cursorGlow.style.transform = `translate(${event.clientX}px, ${event.clientY}px)`;
    });
  }

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
