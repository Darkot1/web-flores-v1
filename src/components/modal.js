/**
 * Diálogos accesibles sobre <dialog> nativo: showModal() vuelve inerte el
 * resto de la página (focus trap) y Esc dispara `cancel`. Devolvemos el foco
 * a quien abrió el diálogo al cerrar.
 */
import { prefersReducedMotion } from "../lib/motion.js";

let openCount = 0;

export const createDialog = ({ className = "", labelledBy, describedBy, closeLabel = "Cerrar" } = {}) => {
  const dialog = document.createElement("dialog");
  dialog.className = `dialog ${className}`.trim();
  if (labelledBy) dialog.setAttribute("aria-labelledby", labelledBy);
  if (describedBy) dialog.setAttribute("aria-describedby", describedBy);

  const panel = document.createElement("div");
  panel.className = "dialog__panel";
  const close = document.createElement("button");
  close.type = "button";
  close.className = "btn btn--ghost btn--icon dialog__close";
  close.setAttribute("aria-label", closeLabel);
  close.innerHTML = '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  const body = document.createElement("div");
  body.className = "dialog__body";
  panel.append(close, body);
  dialog.append(panel);
  document.body.append(dialog);

  let opener = null;
  let beforeClose = null;
  const closeListeners = new Set();

  const finish = () => {
    dialog.classList.remove("is-closing");
    if (dialog.open) dialog.close();
  };

  const api = {
    dialog,
    panel,
    body,
    get isOpen() {
      return dialog.open;
    },
    open(from = document.activeElement) {
      opener = from;
      if (!dialog.open) {
        dialog.showModal();
        openCount += 1;
        document.documentElement.classList.add("has-modal");
      }
    },
    /** Cierra respetando `beforeClose` (p. ej. cambios sin guardar). */
    async requestClose() {
      if (beforeClose && (await beforeClose()) === false) return false;
      api.close();
      return true;
    },
    close() {
      if (!dialog.open) return;
      if (prefersReducedMotion()) finish();
      else {
        dialog.classList.add("is-closing");
        setTimeout(finish, 200);
      }
    },
    setBeforeClose(fn) {
      beforeClose = fn;
    },
    onClose(fn) {
      closeListeners.add(fn);
    },
  };

  dialog.addEventListener("close", () => {
    openCount = Math.max(0, openCount - 1);
    if (!openCount) document.documentElement.classList.remove("has-modal");
    closeListeners.forEach((fn) => fn());
    if (opener && document.contains(opener)) opener.focus({ preventScroll: true });
  });
  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    api.requestClose();
  });
  close.addEventListener("click", () => api.requestClose());
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) api.requestClose();
  });

  return api;
};
