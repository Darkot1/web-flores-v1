/**
 * Hoja del día: panel lateral en escritorio, hoja que sube desde abajo en
 * móvil. Lista los recuerdos del día y permite añadir, editar y borrar
 * (con confirmación y "Deshacer").
 */
import { createDialog } from "./modal.js";
import { showToast, announce } from "./toast.js";
import { createDaisy } from "./daisy.js";
import { formatLong, formatWeekday } from "../lib/dates.js";
import { seasonFor, stageFor, STAGE_LABELS, flowerColorFor, petalCountFor } from "../garden/growth.js";
import { config } from "../config.js";

const h = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

let uid = 0;

export const createMemorySheet = ({ store, onPlanted, onClosed }) => {
  const titleId = "sheet-title";
  const sheet = createDialog({ className: "sheet", labelledBy: titleId });
  let date = null;
  let editingId = null;
  let formVisible = false;
  let dirty = false;

  const header = h("header", "sheet__header");
  const eyebrow = h("p", "eyebrow", "Recuerdos del día");
  const title = h("h2", "sheet__title");
  title.id = titleId;
  const meta = h("p", "sheet__meta");
  header.append(eyebrow, title, meta);

  const list = h("ul", "sheet__list");
  list.setAttribute("role", "list");
  const emptyText = h("p", "sheet__empty");
  const addButton = h("button", "btn btn--ghost sheet__add", "Sembrar otro recuerdo");
  addButton.type = "button";

  const form = h("form", "sheet__form");
  form.noValidate = true;
  const formTitle = h("h3", "sheet__form-title");
  const n = ++uid;
  // Fecha del recuerdo (editable: al sembrar desde el jardín no viene del calendario).
  const dateField = h("label", "field");
  dateField.append(h("span", "field__label", "Fecha"));
  const dateInput = Object.assign(h("input", "field__input"), { type: "date", required: true });
  dateField.append(dateInput);
  const spotNote = h("p", "sheet__spot-note", "Se sembrará justo en el lugar que tocaste del jardín.");
  spotNote.hidden = true;
  let pendingSpot = null;

  const titleField = h("label", "field");
  titleField.append(h("span", "field__label", "Título"));
  const titleInput = h("input", "field__input");
  Object.assign(titleInput, { type: "text", name: "title", maxLength: 120, required: true, placeholder: "Ej. Nuestra caminata", autocomplete: "off" });
  titleInput.id = `memory-title-${n}`;
  titleField.append(titleInput);

  const notesField = h("label", "field");
  notesField.append(h("span", "field__label", "Lo que pasó (opcional)"));
  const notesInput = h("textarea", "field__input");
  Object.assign(notesInput, { name: "notes", maxLength: 2000, rows: 4, placeholder: "Escribe aquí el recuerdo…" });
  notesField.append(notesInput);

  const authorSet = h("fieldset", "choice-row");
  authorSet.append(h("legend", "", "¿Quién lo siembra?"));
  const authorInputs = {};
  const authorLabels = {};
  for (const value of ["el", "ella", ""]) {
    const label = h("label", "choice");
    const input = document.createElement("input");
    Object.assign(input, { type: "radio", name: `author-${n}`, value });
    const span = h("span");
    authorLabels[value] = span;
    label.append(input, span);
    authorInputs[value] = input;
    authorSet.append(label);
  }

  const milestoneLabel = h("label", "check");
  const milestoneInput = document.createElement("input");
  milestoneInput.type = "checkbox";
  const milestoneText = h("span");
  milestoneText.append(h("strong", "", "Es un día especial"), document.createElement("br"), h("small", "", "Su margarita crecerá dentro de un corazón de flores y brillará de noche."));
  milestoneLabel.append(milestoneInput, milestoneText);

  const error = h("p", "form-error");
  error.setAttribute("role", "alert");
  error.hidden = true;

  const actions = h("div", "sheet__actions");
  const cancelEdit = h("button", "btn btn--ghost", "Cancelar");
  cancelEdit.type = "button";
  const submit = h("button", "btn btn--primary", "Plantar recuerdo");
  submit.type = "submit";
  actions.append(cancelEdit, submit);
  form.append(formTitle, spotNote, titleField, dateField, notesField, authorSet, milestoneLabel, error, actions);

  const discardBar = h("div", "discard-bar");
  discardBar.hidden = true;
  discardBar.setAttribute("role", "alertdialog");
  discardBar.setAttribute("aria-label", "Cambios sin guardar");
  const discardText = h("p", "", "Tienes un recuerdo sin guardar.");
  const keepBtn = h("button", "btn btn--ghost", "Seguir escribiendo");
  keepBtn.type = "button";
  const discardBtn = h("button", "btn btn--danger", "Descartar");
  discardBtn.type = "button";
  discardBar.append(discardText, keepBtn, discardBtn);

  sheet.body.append(header, list, emptyText, addButton, form, discardBar);

  const setAuthorLabels = () => {
    const { authors } = store.settings();
    authorLabels.el.textContent = authors.el;
    authorLabels.ella.textContent = authors.ella;
    authorLabels[""].textContent = "Los dos";
  };

  const resetForm = (memory = null) => {
    editingId = memory?.id ?? null;
    formTitle.textContent = memory ? "Editar recuerdo" : "Sembrar un recuerdo";
    submit.textContent = memory ? "Guardar cambios" : "Plantar recuerdo";
    titleInput.value = memory?.title ?? "";
    dateInput.value = memory?.date ?? date;
    notesInput.value = memory?.notes ?? "";
    (authorInputs[memory?.author ?? ""] ?? authorInputs[""]).checked = true;
    milestoneInput.checked = Boolean(memory?.isMilestone);
    error.hidden = true;
    titleInput.removeAttribute("aria-invalid");
    dirty = false;
  };

  const showForm = (visible, { focus = true } = {}) => {
    formVisible = visible;
    form.hidden = !visible;
    addButton.hidden = visible || !store.memoriesOn(date).length;
    cancelEdit.hidden = !store.memoriesOn(date).length && !editingId;
    if (visible && focus) setTimeout(() => titleInput.focus(), 30);
  };

  const confirmDelete = (memory, li, actionsRow) => {
    const confirm = h("div", "inline-confirm");
    confirm.setAttribute("role", "group");
    confirm.setAttribute("aria-label", "Confirmar borrado");
    confirm.append(h("p", "", "¿Borrar este recuerdo?"));
    const no = h("button", "btn btn--ghost", "No, dejarlo");
    no.type = "button";
    const yes = h("button", "btn btn--danger", "Sí, borrar");
    yes.type = "button";
    confirm.append(no, yes);
    actionsRow.hidden = true;
    li.append(confirm);
    no.focus();
    no.addEventListener("click", () => {
      confirm.remove();
      actionsRow.hidden = false;
      actionsRow.querySelector("[data-delete]")?.focus();
    });
    yes.addEventListener("click", async () => {
      try {
        const undo = await store.deleteMemory(memory.id);
        renderList();
        if (!store.memoriesOn(date).length) showForm(true);
        else addButton.focus();
        showToast(`Recuerdo borrado: “${memory.title}”`, {
          action: { label: "Deshacer", onClick: () => undo().then(() => announce("Recuerdo restaurado")) },
        });
      } catch (e) {
        confirm.querySelector("p").textContent = `No se pudo borrar. ${e.message}`;
      }
    });
  };

  const renderList = () => {
    const memories = store.memoriesOn(date);
    const { authors } = store.settings();
    list.replaceChildren();
    for (const memory of memories) {
      const li = h("li", "memory-card");
      const stage = stageFor(memory.date, store.today(), config.growth);
      li.append(createDaisy({ size: 44, stage, color: flowerColorFor(memory.id), petals: petalCountFor(memory.id), seed: memory.id, className: "memory-card__daisy" }));
      const content = h("div", "memory-card__content");
      const heading = h("h3", "memory-card__title", memory.title);
      const tags = h("p", "memory-card__tags");
      if (memory.author) tags.append(h("span", "tag", authors[memory.author]));
      if (memory.isMilestone) tags.append(h("span", "tag tag--special", "Día especial"));
      tags.append(h("span", "tag tag--stage", STAGE_LABELS[stage]));
      content.append(heading, tags);
      if (memory.notes) {
        for (const para of memory.notes.split(/\n{2,}/)) content.append(h("p", "memory-card__notes", para));
      }
      const row = h("div", "memory-card__actions");
      const edit = h("button", "btn btn--quiet", "Editar");
      edit.type = "button";
      edit.setAttribute("aria-label", `Editar “${memory.title}”`);
      const del = h("button", "btn btn--quiet", "Borrar");
      del.type = "button";
      del.dataset.delete = "";
      del.setAttribute("aria-label", `Borrar “${memory.title}”`);
      edit.addEventListener("click", () => {
        resetForm(memory);
        showForm(true);
      });
      del.addEventListener("click", () => confirmDelete(memory, li, row));
      row.append(edit, del);
      content.append(row);
      li.append(content);
      list.append(li);
    }
    list.hidden = !memories.length;
    emptyText.hidden = memories.length > 0;
    emptyText.textContent = date > store.today() ? "Este día aún no llega. Lo que siembres será una semilla esperando." : "Aún no hay nada sembrado este día.";
    addButton.hidden = formVisible || !memories.length;
  };

  const open = (dateKey, opener, { editId, spot = null } = {}) => {
    date = dateKey;
    pendingSpot = spot;
    spotNote.hidden = !spot;
    title.textContent = formatWeekday(dateKey);
    const season = seasonFor(dateKey, config.climate);
    const stage = stageFor(dateKey, store.today(), config.growth);
    const grows = { seed: "una semilla", sprout: "un brote", bud: "un capullo", open: "una flor abierta", full: "una flor plena" }[stage];
    meta.textContent = `${season.label} · aquí crece ${grows}`;
    setAuthorLabels();
    renderList();
    const editing = editId ? store.memoriesOn(dateKey).find((m) => m.id === editId) : null;
    resetForm(editing);
    discardBar.hidden = true;
    sheet.open(opener);
    // Si se siembra en un sitio del jardín, se va directo al formulario.
    showForm(!store.memoriesOn(dateKey).length || Boolean(editing) || Boolean(spot), { focus: true });
    if (store.memoriesOn(dateKey).length && !editing && !spot) setTimeout(() => (list.querySelector("button") ?? addButton).focus(), 30);
  };

  const openList = (heading, memories, opener) => {
    // Lista de una mata (muchos recuerdos de un mes).
    const clusterId = `cluster-title-${++uid}`;
    const listSheet = createDialog({ className: "sheet", labelledBy: clusterId });
    const t = h("h2", "sheet__title", heading);
    t.id = clusterId;
    const ul = h("ul", "sheet__list");
    for (const m of memories) {
      const li = h("li", "cluster-item");
      const btn = h("button", "cluster-item__btn");
      btn.type = "button";
      btn.append(h("span", "cluster-item__title", m.title), h("span", "cluster-item__date", formatLong(m.date)));
      btn.addEventListener("click", () => {
        listSheet.close();
        setTimeout(() => open(m.date, opener), 220);
      });
      li.append(btn);
      ul.append(li);
    }
    listSheet.body.append(h("p", "eyebrow", "Mata de recuerdos"), t, ul);
    listSheet.onClose(() => setTimeout(() => listSheet.dialog.remove(), 300));
    listSheet.open(opener);
    setTimeout(() => ul.querySelector("button")?.focus(), 30);
  };

  form.addEventListener("input", (event) => {
    dirty = true;
    if (event.target === titleInput && titleInput.value.trim()) {
      titleInput.removeAttribute("aria-invalid");
      error.hidden = true;
    }
  });
  addButton.addEventListener("click", () => {
    resetForm();
    showForm(true);
  });
  cancelEdit.addEventListener("click", () => {
    resetForm();
    if (store.memoriesOn(date).length) {
      showForm(false);
      addButton.focus();
    } else {
      sheet.requestClose();
    }
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!titleInput.value.trim()) {
      error.textContent = "Ponle un título a este recuerdo.";
      error.hidden = false;
      titleInput.setAttribute("aria-invalid", "true");
      titleInput.focus();
      return;
    }
    submit.disabled = true;
    try {
      const author = Object.entries(authorInputs).find(([, input]) => input.checked)?.[0] || null;
      const wasEditing = Boolean(editingId);
      const chosenDate = /^\d{4}-\d{2}-\d{2}$/.test(dateInput.value) ? dateInput.value : date;
      const memory = await store.saveMemory({
        id: editingId,
        date: chosenDate,
        title: titleInput.value,
        notes: notesInput.value,
        author,
        isMilestone: milestoneInput.checked,
        spot: editingId ? undefined : pendingSpot,
      });
      pendingSpot = null;
      dirty = false;
      sheet.close();
      if (!wasEditing) {
        onPlanted?.(memory);
      } else {
        showToast("Recuerdo actualizado.");
      }
    } catch (e) {
      error.textContent = e.code === "quota" ? "No queda espacio en este dispositivo. Exporta una copia desde Ajustes." : `No se pudo guardar: ${e.message}`;
      error.hidden = false;
    } finally {
      submit.disabled = false;
    }
  });

  let resolveDiscard = null;
  sheet.setBeforeClose(
    () =>
      new Promise((resolve) => {
        if (!dirty || !formVisible) return resolve(true);
        discardBar.hidden = false;
        keepBtn.focus();
        resolveDiscard = resolve;
      }),
  );
  keepBtn.addEventListener("click", () => {
    discardBar.hidden = true;
    resolveDiscard?.(false);
    titleInput.focus();
  });
  discardBtn.addEventListener("click", () => {
    discardBar.hidden = true;
    dirty = false;
    resolveDiscard?.(true);
  });

  store.subscribe((event) => {
    if (sheet.isOpen && (event.type === "memories" || event.type === "load")) renderList();
  });

  sheet.onClose(() => {
    pendingSpot = null;
    onClosed?.();
  });

  return { open, openList };
};
