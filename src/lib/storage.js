/**
 * Interfaz común de persistencia:
 *   listMemories, saveMemory, deleteMemory,
 *   listLetters, saveLetter, deleteLetter,
 *   getSettings, saveSettings
 *
 * Modo local (por defecto) → storage-local.js
 * Modo compartido (Supabase) → storage-supabase.js, solo si existen
 *   VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY y hay código de jardín.
 */
import { createLocalStorage } from "./storage-local.js";

const CODE_KEY = "jardin:code";

export const isSharedConfigured = () => Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);

/** Lee el código privado del enlace (#c=CODIGO) y lo recuerda en el dispositivo. */
export const readGardenCode = () => {
  const match = window.location.hash.match(/[#&]c=([^&]+)/);
  if (match) {
    const code = decodeURIComponent(match[1]);
    try {
      localStorage.setItem(CODE_KEY, code);
    } catch {
      /* ignorar */
    }
    history.replaceState(null, "", window.location.pathname + window.location.search);
    return code;
  }
  try {
    return localStorage.getItem(CODE_KEY);
  } catch {
    return null;
  }
};

export const rememberGardenCode = (code) => {
  try {
    if (code) localStorage.setItem(CODE_KEY, code);
    else localStorage.removeItem(CODE_KEY);
  } catch {
    /* ignorar */
  }
};

/**
 * Crea el adaptador adecuado. Si el modo compartido falla por código inválido,
 * lanza { code: "invalid_code" } para que la UI pida el código.
 */
export const createStorage = async ({ code, onStatus } = {}) => {
  if (isSharedConfigured() && code) {
    const { createSupabaseStorage } = await import("./storage-supabase.js");
    return createSupabaseStorage({
      url: import.meta.env.VITE_SUPABASE_URL,
      anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      code,
      onStatus,
    });
  }
  return createLocalStorage();
};
