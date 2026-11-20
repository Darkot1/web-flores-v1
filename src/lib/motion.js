/** Utilidades de movimiento compartidas. */
const reducedQuery = typeof window !== "undefined" ? window.matchMedia?.("(prefers-reduced-motion: reduce)") : null;

export const prefersReducedMotion = () => Boolean(reducedQuery?.matches);

export const onReducedMotionChange = (fn) => reducedQuery?.addEventListener?.("change", () => fn(prefersReducedMotion()));

export const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
export const lerp = (a, b, t) => a + (b - a) * t;

/** Ejecuta `fn` como máximo una vez por frame. */
export const rafThrottle = (fn) => {
  let queued = false;
  return (...args) => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      fn(...args);
    });
  };
};

/** Observa visibilidad y llama a fn(isVisible). Devuelve una función para dejar de observar. */
export const watchVisibility = (element, fn, options = { rootMargin: "120px 0px" }) => {
  if (!("IntersectionObserver" in window)) {
    fn(true);
    return () => {};
  }
  const observer = new IntersectionObserver(([entry]) => fn(entry.isIntersecting), options);
  observer.observe(element);
  return () => observer.disconnect();
};

/** Revela elementos .reveal una sola vez al entrar en pantalla. */
export const setupReveal = (root = document) => {
  const items = root.querySelectorAll(".reveal:not(.is-visible)");
  if (prefersReducedMotion() || !("IntersectionObserver" in window)) {
    items.forEach((item) => item.classList.add("is-visible"));
    return;
  }
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      }
    },
    { threshold: 0.15 },
  );
  items.forEach((item) => observer.observe(item));
};
