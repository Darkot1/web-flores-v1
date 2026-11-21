/**
 * Store mínimo: única fuente de verdad para calendario, jardín, camino,
 * cartas y contadores. Emite eventos con { type, freshId } para que las
 * vistas puedan animar lo recién plantado.
 */
import { config } from "../config.js";
import { initialLetters } from "../data/letters.js";
import { createId } from "./seed.js";
import { isDateKey, todayKey } from "./dates.js";

const READ_KEY = "jardin:read-letters";

const loadRead = () => {
  try {
    return new Set(JSON.parse(localStorage.getItem(READ_KEY)) ?? []);
  } catch {
    return new Set();
  }
};

export const createStore = (storage) => {
  const listeners = new Set();
  const state = {
    mode: storage.mode,
    status: "ready",
    memories: [],
    userLetters: [],
    settings: {},
    read: loadRead(),
  };

  const emit = (event) => listeners.forEach((fn) => fn(event, api));

  const settings = () => {
    const s = state.settings;
    return {
      start: isDateKey(s.start) ? s.start : config.relationshipStart,
      authors: {
        el: s.authors?.el?.trim() || config.authors.el,
        ella: s.authors?.ella?.trim() || config.authors.ella,
      },
    };
  };

  const letters = () => {
    const start = settings().start;
    const base = initialLetters.map((l) => ({ ...l, date: l.date ?? start ?? todayKey() }));
    return [...base, ...state.userLetters].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  };

  const guard = async (fn) => {
    try {
      return await fn();
    } catch (error) {
      emit({ type: "error", error });
      throw error;
    }
  };

  const api = {
    get mode() {
      return state.mode;
    },
    get status() {
      return state.status;
    },
    setStatus(status) {
      if (state.status === status) return;
      state.status = status;
      emit({ type: "status" });
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    today: () => todayKey(),
    settings,
    memories: () => [...state.memories].sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt)),
    memoriesOn: (date) => api.memories().filter((m) => m.date === date),
    letters,
    isRead: (id) => state.read.has(id),
    markRead(id) {
      if (state.read.has(id)) return;
      state.read.add(id);
      try {
        localStorage.setItem(READ_KEY, JSON.stringify([...state.read]));
      } catch {
        /* ignorar */
      }
      emit({ type: "letters", read: id });
    },

    async load() {
      const [memories, userLetters, savedSettings] = await Promise.all([storage.listMemories(), storage.listLetters(), storage.getSettings()]);
      state.memories = memories;
      state.userLetters = userLetters;
      state.settings = savedSettings;
      emit({ type: "load" });
    },

    async refresh() {
      const before = JSON.stringify([state.memories, state.userLetters, state.settings]);
      await api.load().catch(() => {});
      return before !== JSON.stringify([state.memories, state.userLetters, state.settings]);
    },

    async saveMemory(input) {
      const existing = input.id ? state.memories.find((m) => m.id === input.id) : null;
      const memory = {
        id: existing?.id ?? createId("m"),
        date: input.date,
        title: input.title.trim().slice(0, 120) || "Un recuerdo",
        notes: (input.notes ?? "").trim().slice(0, 2000),
        author: input.author === "el" || input.author === "ella" ? input.author : null,
        isMilestone: Boolean(input.isMilestone),
        spot: input.spot ?? existing?.spot ?? null,
        createdAt: existing?.createdAt ?? new Date().toISOString(),
      };
      await guard(() => storage.saveMemory(memory));
      state.memories = [...state.memories.filter((m) => m.id !== memory.id), memory];
      emit({ type: "memories", freshId: existing ? null : memory.id, changedId: memory.id });
      return memory;
    },

    /** Borra y devuelve una función para deshacer. */
    async deleteMemory(id) {
      const memory = state.memories.find((m) => m.id === id);
      if (!memory) return () => {};
      await guard(() => storage.deleteMemory(id));
      state.memories = state.memories.filter((m) => m.id !== id);
      emit({ type: "memories", removedId: id });
      return async () => {
        await guard(() => storage.saveMemory(memory));
        state.memories = [...state.memories, memory];
        emit({ type: "memories", freshId: memory.id });
      };
    },

    async saveLetter(input) {
      const letter = {
        id: createId("l"),
        date: input.date ?? todayKey(),
        title: input.title.trim().slice(0, 120) || "Una carta",
        from: input.from,
        to: input.from === "el" ? "ella" : "el",
        intro: (input.intro ?? "").trim(),
        body: input.body,
        signature: input.signature.trim(),
        flower: input.flower,
        sealColor: input.sealColor,
        createdAt: new Date().toISOString(),
      };
      await guard(() => storage.saveLetter(letter));
      state.userLetters = [...state.userLetters, letter];
      state.read.add(letter.id);
      emit({ type: "letters", freshId: letter.id });
      return letter;
    },

    async deleteLetter(id) {
      const letter = state.userLetters.find((l) => l.id === id);
      if (!letter) return () => {};
      await guard(() => storage.deleteLetter(id));
      state.userLetters = state.userLetters.filter((l) => l.id !== id);
      emit({ type: "letters", removedId: id });
      return async () => {
        await guard(() => storage.saveLetter(letter));
        state.userLetters = [...state.userLetters, letter];
        emit({ type: "letters", freshId: letter.id });
      };
    },

    async saveSettings(patch) {
      const next = { ...state.settings, ...patch };
      await guard(() => storage.saveSettings(next));
      state.settings = next;
      emit({ type: "settings" });
    },

    exportData: storage.exportData?.bind(storage),
    importData: storage.importData
      ? async (json) => {
          storage.importData(json);
          await api.load();
        }
      : null,
  };

  return api;
};
