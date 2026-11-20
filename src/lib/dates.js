/**
 * Utilidades de fecha puras. Todas las fechas de datos son claves "YYYY-MM-DD"
 * en hora local, para que un recuerdo nunca "salte" de día por zona horaria.
 */
const DAY_MS = 86_400_000;
const LOCALE = "es-CO";

const pad = (n) => String(n).padStart(2, "0");

export const toKey = (date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export const isDateKey = (value) =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(parseKey(value).getTime());

export const parseKey = (key) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
};

export const todayKey = (now = new Date()) => toKey(now);

/** Días enteros entre dos claves (b - a). Usa UTC para evitar el salto de horario de verano. */
export const daysBetween = (a, b) => {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / DAY_MS);
};

export const addDays = (key, days) => {
  const d = parseKey(key);
  d.setDate(d.getDate() + days);
  return toKey(d);
};

/** Suma meses conservando el día; si el mes no lo tiene (29–31), usa el último día. */
export const addMonthsClamped = (key, months, anchorDay) => {
  const [y, m] = key.split("-").map(Number);
  const day = anchorDay ?? Number(key.slice(8, 10));
  const target = new Date(y, m - 1 + months, 1);
  const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(day, last));
  return toKey(target);
};

export const monthKey = (key) => key.slice(0, 7);

const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);

const fmt = (options) => {
  const f = new Intl.DateTimeFormat(LOCALE, options);
  return (key) => f.format(parseKey(key));
};

const longFmt = fmt({ day: "numeric", month: "long", year: "numeric" });
const weekdayFmt = fmt({ weekday: "long", day: "numeric", month: "long", year: "numeric" });
const shortFmt = fmt({ day: "numeric", month: "short", year: "numeric" });
const monthFmt = fmt({ month: "long", year: "numeric" });
const monthShortFmt = fmt({ month: "short" });

export const formatLong = (key) => longFmt(key);
export const formatWeekday = (key) => capitalize(weekdayFmt(key));
export const formatShort = (key) => shortFmt(key).replace(/\./g, "");
export const formatMonth = (key) => capitalize(monthFmt(key).replace(" de ", " "));
export const formatMonthShort = (key) => monthShortFmt(key).replace(/\./g, "");

/** "1 año y 3 meses", "4 meses", "12 días". */
export const formatDuration = (fromKey, toKeyValue) => {
  const days = daysBetween(fromKey, toKeyValue);
  if (days < 0) return "";
  if (days < 31) return days === 1 ? "1 día" : `${days} días`;
  const [fy, fm, fd] = fromKey.split("-").map(Number);
  const [ty, tm, td] = toKeyValue.split("-").map(Number);
  let months = (ty - fy) * 12 + (tm - fm) - (td < fd ? 1 : 0);
  const years = Math.floor(months / 12);
  months %= 12;
  const y = years ? (years === 1 ? "1 año" : `${years} años`) : "";
  const m = months ? (months === 1 ? "1 mes" : `${months} meses`) : "";
  return [y, m].filter(Boolean).join(" y ") || "1 mes";
};

export const formatNumber = (n) => new Intl.NumberFormat(LOCALE).format(n);
