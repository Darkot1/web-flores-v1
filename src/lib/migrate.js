/**
 * Migraciones del esquema local. Funciones puras: reciben datos crudos y
 * devuelven el estado en la versión actual sin perder nada.
 */
import { hashString } from "./seed.js";
import { isDateKey } from "./dates.js";

export const SCHEMA_VERSION = 2;

export const emptyState = () => ({
  schemaVersion: SCHEMA_VERSION,
  memories: [],
  letters: [],
  settings: {},
});

/**
 * v1 (`garden-memories-v1`): { "2025-03-14": { title, notes } }
 * v2: { memories: [{ id, date, title, notes, author, isMilestone, createdAt }] }
 * El id se deriva de la fecha para que la migración sea idempotente.
 */
export const migrateV1Memories = (v1, migratedAt = new Date().toISOString()) => {
  if (!v1 || typeof v1 !== "object" || Array.isArray(v1)) return [];
  return Object.entries(v1)
    .filter(([date, entry]) => isDateKey(date) && entry && typeof entry === "object")
    .map(([date, entry]) => ({
      id: `m_v1_${date}_${hashString(`${date}|${entry.title ?? ""}`).toString(36)}`,
      date,
      title: String(entry.title ?? "").trim() || "Un recuerdo",
      notes: String(entry.notes ?? "").trim(),
      author: null,
      isMilestone: false,
      createdAt: migratedAt,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
};

/** Normaliza cualquier estado guardado a la versión actual. */
export const migrateState = (raw, { v1 } = {}) => {
  const state = raw && typeof raw === "object" ? { ...emptyState(), ...raw } : emptyState();
  state.memories = Array.isArray(state.memories) ? state.memories : [];
  state.letters = Array.isArray(state.letters) ? state.letters : [];
  state.settings = state.settings && typeof state.settings === "object" ? state.settings : {};

  if (v1 && !state.migratedV1) {
    const existing = new Set(state.memories.map((m) => m.id));
    for (const memory of migrateV1Memories(v1)) {
      if (!existing.has(memory.id)) state.memories.push(memory);
    }
    state.migratedV1 = true;
  }

  state.schemaVersion = SCHEMA_VERSION;
  return state;
};
