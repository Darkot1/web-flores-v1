/**
 * Ajustes del jardín: fecha de inicio y nombres (editables desde la app),
 * y el modo de guardado (local o compartido).
 */
import { createDialog } from "./modal.js";
import { showToast } from "./toast.js";
import { isDateKey, todayKey } from "../lib/dates.js";
import { rememberGardenCode } from "../lib/storage.js";

const h = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

export const createSettings = ({ store }) => {
  const dialog = createDialog({ className: "settings", labelledBy: "settings-title" });
  const title = h("h2", "settings__title", "Ajustes del jardín");
  title.id = "settings-title";

  const form = h("form", "settings__form");
  form.noValidate = true;
  const field = (labelText, input, hint) => {
    const wrap = h("label", "field");
    wrap.append(h("span", "field__label", labelText), input);
    if (hint) wrap.append(h("span", "field__hint", hint));
    return wrap;
  };
  const startInput = Object.assign(h("input", "field__input"), { type: "date" });
  const elInput = Object.assign(h("input", "field__input"), { type: "text", maxLength: 40, autocomplete: "off" });
  const ellaInput = Object.assign(h("input", "field__input"), { type: "text", maxLength: 40, autocomplete: "off" });
  const clearStart = Object.assign(h("button", "btn btn--quiet", "Aún no empieza"), { type: "button" });
  const startRow = h("div", "settings__start");
  startRow.append(field("El día en que todo empezó", startInput, "Con ella se cuentan los días juntos, los faroles y los aniversarios."), clearStart);

  const names = h("fieldset", "settings__names");
  names.append(h("legend", "", "Cómo os llamáis en el jardín"), field("Él", elInput), field("Ella", ellaInput));

  const error = h("p", "form-error");
  error.setAttribute("role", "alert");
  error.hidden = true;
  const save = Object.assign(h("button", "btn btn--primary", "Guardar ajustes"), { type: "submit" });
  form.append(startRow, names, error, save);

  const modeBox = h("section", "settings__mode");
  modeBox.setAttribute("aria-labelledby", "settings-mode-title");

  dialog.body.append(title, form, modeBox);

  const renderMode = () => {
    const heading = h("h3", "", "");
    heading.id = "settings-mode-title";
    const text = h("p", "field__hint");
    modeBox.replaceChildren(heading, text);
    if (store.mode === "shared") {
      heading.textContent = "Jardín compartido";
      text.textContent = "Lo que planta uno lo ve el otro en su dispositivo. Este navegador recuerda vuestro código.";
      const forget = Object.assign(h("button", "btn btn--ghost", "Olvidar el código en este dispositivo"), { type: "button" });
      forget.addEventListener("click", () => {
        rememberGardenCode(null);
        window.location.reload();
      });
      modeBox.append(forget);
    } else {
      heading.textContent = "Guardado en este dispositivo";
      text.textContent = "Lo que plantas vive solo en este navegador. Guarda una copia de vez en cuando.";
      const row = h("div", "settings__io");
      const exportBtn = Object.assign(h("button", "btn btn--ghost", "Descargar copia"), { type: "button" });
      const importLabel = h("label", "btn btn--ghost settings__import");
      const importInput = Object.assign(document.createElement("input"), { type: "file", accept: "application/json,.json", className: "visually-hidden" });
      importLabel.append(document.createTextNode("Restaurar copia"), importInput);
      exportBtn.addEventListener("click", () => {
        const blob = new Blob([store.exportData()], { type: "application/json" });
        const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: `jardin-${todayKey()}.json` });
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      });
      importInput.addEventListener("change", async () => {
        const file = importInput.files?.[0];
        if (!file) return;
        try {
          await store.importData(await file.text());
          showToast("Copia restaurada. El jardín volvió a crecer.");
        } catch {
          showToast("Ese archivo no parece una copia del jardín.", { tone: "error" });
        }
      });
      row.append(exportBtn, importLabel);
      modeBox.append(row);
    }
  };

  clearStart.addEventListener("click", () => {
    startInput.value = "";
    startInput.focus();
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const start = startInput.value;
    if (start && !isDateKey(start)) {
      error.textContent = "Esa fecha no es válida.";
      error.hidden = false;
      return;
    }
    try {
      await store.saveSettings({ start: start || null, authors: { el: elInput.value.trim(), ella: ellaInput.value.trim() } });
      dialog.close();
      showToast(start ? "Listo. El jardín ya sabe cuándo empezó todo." : "Ajustes guardados.");
    } catch (e) {
      error.textContent = `No se pudo guardar: ${e.message}`;
      error.hidden = false;
    }
  });

  return {
    open(opener, { focus = "start" } = {}) {
      const s = store.settings();
      startInput.value = s.start ?? "";
      elInput.value = s.authors.el;
      ellaInput.value = s.authors.ella;
      error.hidden = true;
      renderMode();
      dialog.open(opener);
      setTimeout(() => (focus === "start" ? startInput : elInput).focus(), 30);
    },
  };
};

/** Pide el código privado del jardín compartido. Resuelve con el código o null (usar local). */
export const askGardenCode = ({ invalid = false } = {}) =>
  new Promise((resolve) => {
    const dialog = createDialog({ className: "settings", labelledBy: "code-title" });
    const title = h("h2", "settings__title", "Entrar a nuestro jardín");
    title.id = "code-title";
    const text = h("p", "", invalid ? "Ese código no abre el jardín. Revísalo e inténtalo otra vez." : "Escribe el código privado de vuestro jardín para ver lo que habéis plantado los dos.");
    const form = h("form", "settings__form");
    const input = Object.assign(h("input", "field__input"), { type: "password", autocomplete: "current-password", required: true });
    const label = h("label", "field");
    label.append(h("span", "field__label", "Código del jardín"), input);
    const enter = Object.assign(h("button", "btn btn--primary", "Entrar"), { type: "submit" });
    const local = Object.assign(h("button", "btn btn--ghost", "Usar solo en este dispositivo"), { type: "button" });
    form.append(label, enter, local);
    dialog.body.append(title, text, form);
    let result = null;
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      if (!input.value.trim()) return input.focus();
      result = input.value.trim();
      dialog.close();
    });
    local.addEventListener("click", () => dialog.close());
    dialog.onClose(() => {
      setTimeout(() => dialog.dialog.remove(), 300);
      resolve(result);
    });
    dialog.open();
    setTimeout(() => input.focus(), 30);
  });
