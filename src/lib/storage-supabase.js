/**
 * Adaptador compartido con Supabase. Se carga con import() dinámico solo si
 * existen VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.
 *
 * Seguridad: las tablas tienen RLS sin políticas (nadie las lee directo).
 * Todo pasa por funciones RPC que exigen el código privado del jardín
 * (ver supabase/schema.sql). La anon key sola no permite leer nada.
 *
 * Sin conexión: se mantiene una copia local y las escrituras pendientes se
 * reintentan al volver la conexión.
 */
import { createClient } from "@supabase/supabase-js";

const CACHE_KEY = "jardin:shared-cache";
const QUEUE_KEY = "jardin:shared-queue";

const toMemoryRow = (m) => ({ id: m.id, date: m.date, title: m.title, notes: m.notes ?? "", author: m.author, is_milestone: Boolean(m.isMilestone), spot: m.spot ?? null, created_at: m.createdAt });
const fromMemoryRow = (r) => ({ id: r.id, date: r.date, title: r.title, notes: r.notes ?? "", author: r.author, isMilestone: r.is_milestone, spot: r.spot ?? null, createdAt: r.created_at });
const toLetterRow = (l) => ({
  id: l.id, date: l.date, title: l.title, from_author: l.from, to_author: l.to, intro: l.intro ?? "",
  body: l.body, signature: l.signature, flower: l.flower, seal_color: l.sealColor, created_at: l.createdAt,
});
const fromLetterRow = (r) => ({
  id: r.id, date: r.date, title: r.title, from: r.from_author, to: r.to_author, intro: r.intro,
  body: r.body, signature: r.signature, flower: r.flower, sealColor: r.seal_color, createdAt: r.created_at,
});

const load = (key, fallback) => {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
};
const save = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* sin espacio: la nube sigue siendo la fuente de verdad */
  }
};

export const createSupabaseStorage = async ({ url, anonKey, code, onStatus = () => {} }) => {
  const client = createClient(url, anonKey, { auth: { persistSession: false } });
  const cache = load(CACHE_KEY, { memories: [], letters: [], settings: {} });
  let queue = load(QUEUE_KEY, []);

  const rpc = async (fn, args = {}) => {
    const { data, error } = await client.rpc(fn, { p_code: code, ...args });
    if (error) {
      const err = new Error(error.message);
      err.code = /invalid_code/.test(error.message) ? "invalid_code" : "network";
      throw err;
    }
    return data;
  };

  const flush = async () => {
    if (!queue.length) return;
    const pending = [...queue];
    for (const op of pending) {
      try {
        await rpc(op.fn, op.args);
        queue = queue.filter((q) => q !== op && q.key !== op.key);
      } catch (error) {
        if (error.code === "invalid_code") throw error;
        onStatus("offline");
        break;
      }
    }
    save(QUEUE_KEY, queue);
    if (!queue.length) onStatus("synced");
  };

  const write = async (key, fn, args) => {
    queue = queue.filter((q) => q.key !== key);
    queue.push({ key, fn, args });
    save(QUEUE_KEY, queue);
    try {
      await flush();
    } catch (error) {
      if (error.code === "invalid_code") throw error;
    }
  };

  const upsert = (list, item) => {
    const i = list.findIndex((x) => x.id === item.id);
    if (i >= 0) list[i] = item;
    else list.push(item);
  };

  // Comprueba el código al conectar.
  await rpc("garden_check");
  window.addEventListener("online", () => flush().catch(() => {}));

  return {
    mode: "shared",
    async listMemories() {
      try {
        await flush();
        const rows = await rpc("list_memories");
        cache.memories = rows.map(fromMemoryRow);
        save(CACHE_KEY, cache);
        onStatus(queue.length ? "offline" : "synced");
      } catch (error) {
        if (error.code === "invalid_code") throw error;
        onStatus("offline");
      }
      return structuredClone(cache.memories);
    },
    async saveMemory(memory) {
      upsert(cache.memories, memory);
      save(CACHE_KEY, cache);
      await write(`m:${memory.id}`, "save_memory", { p_memory: toMemoryRow(memory) });
      return memory;
    },
    async deleteMemory(id) {
      cache.memories = cache.memories.filter((m) => m.id !== id);
      save(CACHE_KEY, cache);
      await write(`m:${id}`, "delete_memory", { p_id: id });
    },
    async listLetters() {
      try {
        const rows = await rpc("list_letters");
        cache.letters = rows.map(fromLetterRow);
        save(CACHE_KEY, cache);
      } catch (error) {
        if (error.code === "invalid_code") throw error;
      }
      return structuredClone(cache.letters);
    },
    async saveLetter(letter) {
      upsert(cache.letters, letter);
      save(CACHE_KEY, cache);
      await write(`l:${letter.id}`, "save_letter", { p_letter: toLetterRow(letter) });
      return letter;
    },
    async deleteLetter(id) {
      cache.letters = cache.letters.filter((l) => l.id !== id);
      save(CACHE_KEY, cache);
      await write(`l:${id}`, "delete_letter", { p_id: id });
    },
    async getSettings() {
      try {
        cache.settings = (await rpc("get_settings")) ?? {};
        save(CACHE_KEY, cache);
      } catch (error) {
        if (error.code === "invalid_code") throw error;
      }
      return { ...cache.settings };
    },
    async saveSettings(settings) {
      cache.settings = { ...cache.settings, ...settings };
      save(CACHE_KEY, cache);
      await write("settings", "save_settings", { p_settings: cache.settings });
      return { ...cache.settings };
    },
  };
};
