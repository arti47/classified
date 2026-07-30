/* ui.js — themed modals, toasts, confirm/prompt. No native alert/confirm/prompt anywhere. */

import { el, clear, $ } from "./core.js";

let openModals = [];

function trapFocus(container, e) {
  const focusable = container.querySelectorAll(
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
  );
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}

/**
 * Open a modal.
 * @param {object} opts { title, body (Node|string), actions:[{label, kind, onClick, close}], onClose, wide }
 * @returns {{close:Function, body:HTMLElement, setBody:Function, setTitle:Function}}
 */
export function modal(opts = {}) {
  const root = document.getElementById("modalRoot");
  const previouslyFocused = document.activeElement;

  const bodyEl = el("div", { class: "modal-body" });
  if (opts.body) {
    if (typeof opts.body === "string") bodyEl.innerHTML = opts.body;
    else bodyEl.appendChild(opts.body);
  }

  const titleEl = el("h2", { id: "modalTitle_" + openModals.length, text: opts.title || "" });
  // A locked modal is one step of a sequence the player must finish: no close button, no
  // Escape, no backdrop dismissal. Only its own actions move it on.
  const locked = opts.locked === true;
  const closeBtn = el("button", { class: "icon-btn", "aria-label": "Close", type: "button" }, "✕");

  const head = el("div", { class: "modal-head" }, titleEl, locked ? null : closeBtn);
  const parts = [head, bodyEl];

  let footEl = null;
  if (opts.actions && opts.actions.length) {
    footEl = el("div", { class: "modal-foot" });
    for (const a of opts.actions) {
      const b = el("button", {
        class: "btn " + (a.kind || ""), type: "button",
        onclick: () => {
          const keep = a.onClick ? a.onClick(api) : undefined;
          if (a.close !== false && keep !== false) api.close();
        }
      }, a.label);
      footEl.appendChild(b);
    }
    parts.push(footEl);
  }

  const dialog = el("div", {
    class: "modal", role: "dialog", "aria-modal": "true",
    "aria-labelledby": titleEl.id
  }, ...parts);
  if (opts.wide) dialog.style.maxWidth = "760px";

  const backdrop = el("div", { class: "modal-backdrop" }, dialog);

  function onKey(e) {
    if (e.key === "Escape") { e.preventDefault(); if (!locked) api.close(); }
    else if (e.key === "Tab") trapFocus(dialog, e);
  }

  backdrop.addEventListener("mousedown", e => { if (e.target === backdrop && !locked) api.close(); });
  closeBtn.addEventListener("click", () => api.close());
  document.addEventListener("keydown", onKey, true);

  const api = {
    body: bodyEl,
    el: dialog,
    setTitle(t) { titleEl.textContent = t; },
    setBody(node) {
      clear(bodyEl);
      if (typeof node === "string") bodyEl.innerHTML = node;
      else if (node) bodyEl.appendChild(node);
    },
    setActions(actions) {
      if (!footEl) { footEl = el("div", { class: "modal-foot" }); dialog.appendChild(footEl); }
      clear(footEl);
      for (const a of actions) {
        footEl.appendChild(el("button", {
          class: "btn " + (a.kind || ""), type: "button",
          onclick: () => { const keep = a.onClick ? a.onClick(api) : undefined; if (a.close !== false && keep !== false) api.close(); }
        }, a.label));
      }
    },
    close() {
      document.removeEventListener("keydown", onKey, true);
      backdrop.remove();
      openModals = openModals.filter(m => m !== api);
      if (opts.onClose) opts.onClose();
      if (previouslyFocused && previouslyFocused.focus) previouslyFocused.focus();
    }
  };

  openModals.push(api);
  root.appendChild(backdrop);

  const target = dialog.querySelector("input, select, textarea, button:not(.icon-btn)") ||
    dialog.querySelector(".modal-foot .btn") || closeBtn;
  window.setTimeout(() => target.focus(), 20);

  return api;
}

export function showToast(text, kind = "", ms = 2600) {
  const root = document.getElementById("toastRoot");
  const t = el("div", { class: "toast " + kind, text });
  root.appendChild(t);
  window.setTimeout(() => t.remove(), ms);
}

export function confirmModal(message, opts = {}) {
  return new Promise(resolve => {
    let settled = false;
    modal({
      title: opts.title || "Confirm",
      body: typeof message === "string" ? el("p", { text: message }) : message,
      actions: [
        { label: opts.cancelLabel || "Cancel", kind: "ghost", onClick: () => { settled = true; resolve(false); } },
        { label: opts.okLabel || "Confirm", kind: opts.danger ? "danger" : "primary", onClick: () => { settled = true; resolve(true); } }
      ],
      onClose: () => { if (!settled) resolve(false); }
    });
  });
}

export function promptModal(message, opts = {}) {
  return new Promise(resolve => {
    let settled = false;
    const input = el("input", { type: opts.type || "text", value: opts.value || "", id: "promptInput" });
    if (opts.placeholder) input.placeholder = opts.placeholder;
    const body = el("div", {},
      typeof message === "string" ? el("label", { class: "field-label", for: "promptInput", text: message }) : message,
      input
    );
    const m = modal({
      title: opts.title || "Enter a value",
      body,
      actions: [
        { label: "Cancel", kind: "ghost", onClick: () => { settled = true; resolve(null); } },
        { label: opts.okLabel || "OK", kind: "primary", onClick: () => { settled = true; resolve(input.value); } }
      ],
      onClose: () => { if (!settled) resolve(null); }
    });
    input.addEventListener("keydown", e => {
      if (e.key === "Enter") { e.preventDefault(); settled = true; resolve(input.value); m.close(); }
    });
  });
}

/** Choose one from a list. items: [{key,label,desc}] */
export function chooseModal(title, items, opts = {}) {
  return new Promise(resolve => {
    let settled = false;
    const body = el("div", {});
    if (opts.intro) body.appendChild(el("p", { class: "small muted", text: opts.intro }));
    for (const it of items) {
      body.appendChild(el("button", {
        class: "opt-btn", type: "button",
        onclick: () => { settled = true; resolve(it.key); m.close(); }
      },
        el("span", { class: "on-name" }, el("span", { text: it.label }), it.right ? el("span", { class: "mono small", text: it.right }) : null),
        it.desc ? el("span", { class: "on-desc", text: it.desc }) : null
      ));
    }
    const m = modal({
      title, body,
      actions: [{ label: "Cancel", kind: "ghost", onClick: () => { settled = true; resolve(null); } }],
      onClose: () => { if (!settled) resolve(null); }
    });
  });
}

export function closeAllModals() {
  [...openModals].forEach(m => m.close());
}
