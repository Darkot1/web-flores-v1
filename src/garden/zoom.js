/**
 * Zoom y desplazamiento del jardín cambiando solo el viewBox del SVG
 * (las flores no se vuelven a dibujar).
 *
 * - Móvil: pellizcar para acercar; con zoom, arrastrar con un dedo mueve el
 *   jardín. Sin zoom, el dedo sigue desplazando la página.
 * - Escritorio: Ctrl/⌘ + rueda (o pellizco del trackpad) y arrastrar.
 * - Doble clic / doble toque: acerca en ese punto (o vuelve si ya está cerca).
 * - Botones + / − / restablecer y teclas + − 0 con el jardín enfocado.
 */
import { prefersReducedMotion } from "../lib/motion.js";

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 4;

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export const createZoom = (svg, { onChange = () => {} } = {}) => {
  let base = { width: 1000, height: 620 };
  let scale = 1;
  let cx = 500;
  let cy = 310;
  let anim = 0;

  // ── Estado → viewBox
  const constrain = () => {
    scale = clamp(scale, MIN_ZOOM, MAX_ZOOM);
    const w = base.width / scale;
    const h = base.height / scale;
    cx = clamp(cx, w / 2, base.width - w / 2);
    cy = clamp(cy, h / 2, base.height - h / 2);
  };

  const apply = () => {
    constrain();
    const w = base.width / scale;
    const h = base.height / scale;
    svg.setAttribute("viewBox", `${(cx - w / 2).toFixed(2)} ${(cy - h / 2).toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)}`);
    svg.classList.toggle("is-zoomed", scale > 1.001);
    svg.style.touchAction = scale > 1.001 ? "none" : "pan-y";
    onChange(scale);
  };

  /** Punto de pantalla → coordenadas del jardín (sin zoom aplicado). */
  const toGarden = (clientX, clientY) => {
    const rect = svg.getBoundingClientRect();
    const w = base.width / scale;
    const h = base.height / scale;
    return {
      x: cx - w / 2 + ((clientX - rect.left) / rect.width) * w,
      y: cy - h / 2 + ((clientY - rect.top) / rect.height) * h,
    };
  };

  /** Cambia el zoom manteniendo fijo el punto (gx, gy) bajo el dedo/cursor. */
  const zoomAround = (nextScale, gx, gy) => {
    const s = clamp(nextScale, MIN_ZOOM, MAX_ZOOM);
    const k = scale / s;
    cx = gx + (cx - gx) * k;
    cy = gy + (cy - gy) * k;
    scale = s;
    apply();
  };

  const animateTo = (targetScale, gx = cx, gy = cy) => {
    cancelAnimationFrame(anim);
    if (prefersReducedMotion()) {
      zoomAround(targetScale, gx, gy);
      return;
    }
    const from = scale;
    const start = performance.now();
    const step = (t) => {
      const k = Math.min(1, (t - start) / 260);
      const eased = 1 - (1 - k) ** 3;
      zoomAround(from + (targetScale - from) * eased, gx, gy);
      if (k < 1) anim = requestAnimationFrame(step);
    };
    anim = requestAnimationFrame(step);
  };

  // ── Gestos
  const pointers = new Map();
  let pinch = null;
  let drag = null;
  let moved = false;
  let lastTap = { time: 0, x: 0, y: 0 };

  svg.addEventListener("pointerdown", (e) => {
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    moved = false;
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const mid = toGarden((a.x + b.x) / 2, (a.y + b.y) / 2);
      pinch = { dist: Math.hypot(a.x - b.x, a.y - b.y), scale, mid };
      drag = null;
    } else if (pointers.size === 1 && (scale > 1.001 || e.pointerType === "mouse")) {
      drag = { x: e.clientX, y: e.clientY, cx, cy };
    }
  });

  window.addEventListener("pointermove", (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && pointers.size >= 2) {
      const [a, b] = [...pointers.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (Math.abs(dist - pinch.dist) > 4) moved = true;
      zoomAround(pinch.scale * (dist / pinch.dist), pinch.mid.x, pinch.mid.y);
    } else if (drag && scale > 1.001) {
      const dx = e.clientX - drag.x;
      const dy = e.clientY - drag.y;
      if (Math.hypot(dx, dy) > 6) moved = true;
      if (!moved) return;
      const rect = svg.getBoundingClientRect();
      cx = drag.cx - (dx / rect.width) * (base.width / scale);
      cy = drag.cy - (dy / rect.height) * (base.height / scale);
      apply();
      svg.classList.add("is-dragging");
    }
  });

  const end = (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    if (pointers.size === 0) {
      drag = null;
      svg.classList.remove("is-dragging");
    }
  };
  window.addEventListener("pointerup", end);
  window.addEventListener("pointercancel", end);

  // Doble toque (táctil) y doble clic: acercar ahí o volver.
  const toggleAt = (clientX, clientY) => {
    const p = toGarden(clientX, clientY);
    animateTo(scale > 1.5 ? 1 : 2.4, p.x, p.y);
  };
  const onFlower = (e) => Boolean(e.target.closest?.(".g-item[role=button]"));
  svg.addEventListener("pointerup", (e) => {
    if (e.pointerType !== "touch" || moved || onFlower(e)) return;
    const now = performance.now();
    if (now - lastTap.time < 300 && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 30) {
      toggleAt(e.clientX, e.clientY);
      lastTap.time = 0;
    } else {
      lastTap = { time: now, x: e.clientX, y: e.clientY };
    }
  });
  svg.addEventListener("dblclick", (e) => {
    if (onFlower(e)) return;
    e.preventDefault();
    toggleAt(e.clientX, e.clientY);
  });

  // Ctrl/⌘ + rueda, y el pellizco del trackpad (llega como wheel con ctrlKey).
  svg.addEventListener(
    "wheel",
    (e) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const p = toGarden(e.clientX, e.clientY);
      zoomAround(scale * Math.exp(-e.deltaY * 0.0045), p.x, p.y);
    },
    { passive: false },
  );

  return {
    get scale() {
      return scale;
    },
    /** Punto de pantalla → coordenadas del jardín. */
    toGarden,
    /** Llamar tras cada render: nuevas dimensiones base, conservando el zoom. */
    setBase(dims) {
      const changed = dims.width !== base.width || dims.height !== base.height;
      if (changed) {
        const rx = cx / base.width;
        const ry = cy / base.height;
        base = { width: dims.width, height: dims.height };
        cx = rx * base.width;
        cy = ry * base.height;
      }
      apply();
    },
    zoomIn: () => animateTo(scale * 1.6),
    zoomOut: () => animateTo(scale / 1.6),
    reset: () => animateTo(1, base.width / 2, base.height / 2),
    /** ¿El último gesto fue un arrastre/pellizco? (para no abrir una flor sin querer) */
    consumeMoved() {
      const m = moved;
      moved = false;
      return m;
    },
    /** Si hay zoom, centra un punto del jardín (p. ej. la flor enfocada). */
    ensureVisible(x, y) {
      if (scale <= 1.001) return;
      const w = base.width / scale;
      const h = base.height / scale;
      const margin = 0.18;
      if (x < cx - w * (0.5 - margin) || x > cx + w * (0.5 - margin) || y < cy - h * (0.5 - margin) || y > cy + h * (0.5 - margin)) {
        cancelAnimationFrame(anim);
        cx = x;
        cy = y - h * 0.1;
        apply();
      }
    },
  };
};
