/**
 * Aleatoriedad determinista: la misma semilla (el id de un recuerdo o carta)
 * produce siempre la misma flor en el mismo lugar.
 */

/** Hash de cadena de 53 bits (cyrb53, dominio público). */
export const hashString = (str, seed = 0) => {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i += 1) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
};

/** PRNG mulberry32: devuelve una función que produce floats en [0, 1). */
export const mulberry32 = (a) => () => {
  a |= 0;
  a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

/** Generador con ayudas: rng.float(), rng.range(a, b), rng.int(a, b), rng.pick(arr), rng.chance(p). */
export const createRng = (seed) => {
  const next = mulberry32(typeof seed === "number" ? seed : hashString(String(seed)));
  return {
    float: next,
    range: (min, max) => min + (max - min) * next(),
    int: (min, max) => Math.floor(min + (max - min + 1) * next()),
    pick: (list) => list[Math.floor(next() * list.length)],
    chance: (p) => next() < p,
    sign: () => (next() < 0.5 ? -1 : 1),
  };
};

/** Elige según pesos: [{ value, weight }]. */
export const weightedPick = (rng, options) => {
  const total = options.reduce((sum, o) => sum + o.weight, 0);
  let roll = rng.float() * total;
  for (const option of options) {
    roll -= option.weight;
    if (roll <= 0) return option.value;
  }
  return options[options.length - 1].value;
};

export const createId = (prefix = "m") => {
  const random =
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}_${random}`;
};
