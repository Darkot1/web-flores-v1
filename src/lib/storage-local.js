/**
 * Adaptador local (por defecto): todo vive en localStorage de este navegador.
 * Lo que se planta aquí solo se ve en este dispositivo.
 */
import { emptyState, migrateState } from "./migrate.js";

const KEY = "jardin:v2";
const LEGACY_KEY = "garden-memories-v1";

const safeParse = (raw) => {
  try {
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const createLocalStorage = () => {
  let state = emptyState();

  const read = () => {
    try {
      const stored = safeParse(localStorage.getItem(KEY));
      const legacy = safeParse(localStorage.getItem(LEGACY_KEY));
      state = migrateState(stored, { v1: legacy });
      // La clave v1 se conserva intacta como respaldo.
      write();
    } catch {
      state = emptyState();
    }
  };

  const write = () => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (error) {
      const err = new Error("No hay espacio para guardar en este dispositivo.");
      err.code = "quota";
      err.cause = error;
      throw err;
    }
  };

  const upsert = (list, item) => {
    const index = list.findIndex((x) => x.id === item.id);
    if (index >= 0) list[index] = item;
    else list.push(item);
  };

  read();

  return {
    mode: "local",
    async listMemories() {
      return structuredClone(state.memories);
    },
    async saveMemory(memory) {
      upsert(state.memories, memory);
      write();
      return memory;
    },
    async deleteMemory(id) {
      state.memories = state.memories.filter((m) => m.id !== id);
      write();
    },
    async listLetters() {
      return structuredClone(state.letters);
    },
    async saveLetter(letter) {
      upsert(state.letters, letter);
      write();
      return letter;
    },
    async deleteLetter(id) {
      state.letters = state.letters.filter((l) => l.id !== id);
      write();
    },
    async getSettings() {
      return { ...state.settings };
    },
    async saveSettings(settings) {
      state.settings = { ...state.settings, ...settings };
      write();
      return { ...state.settings };
    },
    exportData() {
      return JSON.stringify({ ...state, exportedAt: new Date().toISOString() }, null, 2);
    },
    importData(json) {
      const incoming = migrateState(JSON.parse(json));
      for (const m of incoming.memories) upsert(state.memories, m);
      for (const l of incoming.letters) upsert(state.letters, l);
      state.settings = { ...incoming.settings, ...state.settings };
      write();
    },
  };
};
