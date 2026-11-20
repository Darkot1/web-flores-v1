/** Avisos discretos con acción opcional (p. ej. "Deshacer"). */
let region = null;

const ensureRegion = () => {
  if (region) return region;
  region = document.createElement("div");
  region.className = "toast-region";
  region.setAttribute("role", "status");
  region.setAttribute("aria-live", "polite");
  document.body.append(region);
  return region;
};

export const showToast = (message, { action, duration = 6000, tone = "info" } = {}) => {
  const host = ensureRegion();
  const toast = document.createElement("div");
  toast.className = `toast toast--${tone}`;
  const text = document.createElement("p");
  text.textContent = message;
  toast.append(text);

  let timer = 0;
  const dismiss = () => {
    clearTimeout(timer);
    toast.classList.add("is-leaving");
    setTimeout(() => toast.remove(), 220);
  };
  const arm = () => {
    clearTimeout(timer);
    timer = setTimeout(dismiss, duration);
  };

  if (action) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "btn btn--quiet toast__action";
    button.textContent = action.label;
    button.addEventListener("click", () => {
      dismiss();
      action.onClick();
    });
    toast.append(button);
  }
  toast.addEventListener("pointerenter", () => clearTimeout(timer));
  toast.addEventListener("pointerleave", arm);
  toast.addEventListener("focusin", () => clearTimeout(timer));
  toast.addEventListener("focusout", arm);

  host.append(toast);
  arm();
  return dismiss;
};

/** Anuncio solo para lectores de pantalla. */
let announcer = null;
export const announce = (message) => {
  if (!announcer) {
    announcer = document.createElement("div");
    announcer.className = "visually-hidden";
    announcer.setAttribute("aria-live", "polite");
    document.body.append(announcer);
  }
  announcer.textContent = "";
  setTimeout(() => {
    announcer.textContent = message;
  }, 60);
};
