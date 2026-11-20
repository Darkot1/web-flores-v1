/**
 * Escribir una carta nueva: los dos pueden escribir. Vista previa en vivo,
 * elección de flor (color y pétalos) y lacre. Al enviarla, su flor se planta.
 */
import { createDialog } from "./modal.js";
import { buildLetterPaper, createSeal, SEAL_COLORS } from "./letters.js";
import { PETAL_PALETTES } from "./daisy.js";
import { todayKey } from "../lib/dates.js";
import { config } from "../config.js";

const h = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

const radioGroup = (legend, name, options, checked) => {
  const set = h("fieldset", "choice-row");
  set.append(h("legend", "", legend));
  const inputs = [];
  for (const opt of options) {
    const label = h("label", "choice");
    const input = document.createElement("input");
    Object.assign(input, { type: "radio", name, value: opt.value, checked: opt.value === checked });
    const span = h("span");
    if (opt.swatch) {
      const sw = h("i", "swatch");
      sw.style.background = opt.swatch;
      span.append(sw);
    }
    if (opt.node) span.append(opt.node);
    span.append(document.createTextNode(opt.label));
    label.append(input, span);
    set.append(label);
    inputs.push(input);
  }
  return { set, value: () => inputs.find((i) => i.checked)?.value, inputs };
};

export const createLetterComposer = ({ store, onSent }) => {
  const dialog = createDialog({ className: "composer", labelledBy: "composer-title" });
  const title = h("h2", "composer__title", "Escribir una carta");
  title.id = "composer-title";
  const intro = h("p", "composer__lead", "Lo que escribas se guardará en la pérgola, y su flor crecerá en el jardín.");

  const form = h("form", "composer__form");
  form.noValidate = true;
  const fromSlot = h("div");
  const field = (labelText, input, hint) => {
    const wrap = h("label", "field");
    wrap.append(h("span", "field__label", labelText), input);
    if (hint) wrap.append(h("span", "field__hint", hint));
    return wrap;
  };
  const titleInput = Object.assign(h("input", "field__input"), { type: "text", maxLength: 120, required: true, placeholder: "Ej. Para cuando me extrañes", autocomplete: "off" });
  const introInput = Object.assign(h("input", "field__input"), { type: "text", maxLength: 200, placeholder: "Ej. Y esto era para decirte…", autocomplete: "off" });
  const bodyInput = Object.assign(h("textarea", "field__input composer__body"), { rows: 8, maxLength: 6000, required: true, placeholder: "Escribe tu carta. Deja una línea en blanco para separar párrafos." });
  const signInput = Object.assign(h("input", "field__input"), { type: "text", maxLength: 80, value: config.signature, autocomplete: "off" });

  const flowerColor = radioGroup(
    "Su flor",
    "letter-flower",
    ["morada", "lavanda", "blanca", "dorada", "ciruela"].map((c) => ({ value: c, label: PETAL_PALETTES[c].label, swatch: PETAL_PALETTES[c].petal })),
    "morada",
  );
  const petals = radioGroup(
    "Pétalos",
    "letter-petals",
    [
      { value: "13", label: "Sencilla" },
      { value: "16", label: "Clásica" },
      { value: "21", label: "Plena" },
    ],
    "21",
  );
  const seal = radioGroup(
    "Lacre",
    "letter-seal",
    Object.entries(SEAL_COLORS).map(([value, c]) => ({ value, label: c.label, node: createSeal(value, 22) })),
    "ciruela",
  );

  const error = h("p", "form-error");
  error.setAttribute("role", "alert");
  error.hidden = true;
  const actions = h("div", "composer__actions");
  const cancel = Object.assign(h("button", "btn btn--ghost", "Cancelar"), { type: "button" });
  const submit = Object.assign(h("button", "btn btn--primary", "Enviar y plantar su flor"), { type: "submit" });
  actions.append(cancel, submit);

  form.append(fromSlot, field("Título", titleInput), field("Primera línea (opcional)", introInput), field("Carta", bodyInput), field("Firma", signInput), flowerColor.set, petals.set, seal.set, error, actions);

  const previewWrap = h("div", "composer__preview");
  previewWrap.setAttribute("aria-label", "Vista previa de la carta");
  previewWrap.setAttribute("role", "region");
  const previewSeal = h("div", "composer__seal");
  const previewPaper = h("div");
  previewWrap.append(h("p", "eyebrow", "Vista previa"), previewSeal, previewPaper);

  const layout = h("div", "composer__layout");
  layout.append(form, previewWrap);
  dialog.body.append(title, intro, layout);

  let fromGroup = null;
  let dirty = false;

  const paragraphs = () =>
    bodyInput.value
      .split(/\n\s*\n/)
      .map((p) => p.replace(/\s*\n\s*/g, " ").trim())
      .filter(Boolean);

  const draft = () => ({
    id: "preview",
    title: titleInput.value.trim(),
    intro: introInput.value.trim(),
    body: paragraphs(),
    signature: signInput.value.trim(),
    from: fromGroup?.value() ?? "el",
    to: fromGroup?.value() === "ella" ? "el" : "ella",
    date: todayKey(),
    flower: { color: flowerColor.value(), petals: Number(petals.value()) },
    sealColor: seal.value(),
  });

  let previewFrame = 0;
  const updatePreview = () => {
    cancelAnimationFrame(previewFrame);
    previewFrame = requestAnimationFrame(() => {
      const d = draft();
      const { paper } = buildLetterPaper({ ...d, title: d.title || "Tu título", body: d.body.length ? d.body : ["Aquí aparecerá tu carta…"] }, store.settings().authors, { preview: true });
      previewPaper.replaceChildren(paper);
      previewSeal.replaceChildren(createSeal(d.sealColor, 46));
    });
  };

  form.addEventListener("input", (event) => {
    dirty = true;
    if (event.target.value?.trim()) event.target.removeAttribute("aria-invalid");
    updatePreview();
  });
  form.addEventListener("change", updatePreview);
  cancel.addEventListener("click", () => dialog.requestClose());

  dialog.setBeforeClose(() => {
    if (!dirty || (!titleInput.value.trim() && !bodyInput.value.trim())) return true;
    // eslint-disable-next-line no-alert
    return window.confirm("¿Descartar esta carta? Lo escrito se perderá.");
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const d = draft();
    const missing = !d.title ? titleInput : !d.body.length ? bodyInput : null;
    if (missing) {
      error.textContent = !d.title ? "Ponle un título a tu carta." : "Escribe algo en tu carta.";
      error.hidden = false;
      missing.setAttribute("aria-invalid", "true");
      missing.focus();
      return;
    }
    submit.disabled = true;
    try {
      const letter = await store.saveLetter(d);
      dirty = false;
      dialog.close();
      onSent?.(letter);
    } catch (e) {
      error.textContent = `No se pudo enviar: ${e.message}`;
      error.hidden = false;
    } finally {
      submit.disabled = false;
    }
  });

  return {
    open(opener) {
      const { authors } = store.settings();
      fromGroup = radioGroup("¿Quién escribe?", "letter-from", [
        { value: "el", label: authors.el },
        { value: "ella", label: authors.ella },
      ], fromGroup?.value() ?? "el");
      fromSlot.replaceChildren(fromGroup.set);
      error.hidden = true;
      [titleInput, bodyInput].forEach((i) => i.removeAttribute("aria-invalid"));
      updatePreview();
      dialog.open(opener);
      setTimeout(() => titleInput.focus(), 30);
    },
    reset() {
      form.reset();
      signInput.value = config.signature;
      dirty = false;
    },
  };
};
