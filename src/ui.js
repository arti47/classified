/* ui.js — themed modals, toasts, confirm/prompt. No native alert/confirm/prompt anywhere. */

import { el, clear, $, icon } from "./core.js";
import { Settings } from "./settings.js";

let openModals = [];
let modalSeq = 0;

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

  // A monotonic counter, not the stack depth: closing the first of two open modals and
  // opening another would hand the new one the id the surviving modal is already using, so
  // two live dialogs would share an id and one aria-labelledby would point at the wrong one.
  const titleEl = el("h2", { id: "modalTitle_" + (++modalSeq), text: opts.title || "" });
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

  // Only the modal on top of the stack answers the keyboard. Every open modal listens on
  // the document, so without this one Escape closed the whole stack at once — and a dialog
  // opened over a locked step of a sequence would dismiss the locked one underneath it,
  // which is the thing `locked` exists to prevent (CLAUDE.md §4, ruling S10).
  function isTop() { return openModals[openModals.length - 1] === api; }

  function onKey(e) {
    if (!isTop()) return;
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

  const target = dialog.querySelector("[autofocus]") ||
    dialog.querySelector("input, select, textarea, button:not(.icon-btn)") ||
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

/**
 * A chooser drawn as tiles rather than a list (U6): an icon, a short name, and a number in
 * large type where there is one. Sections carry their own heading; a section may start
 * folded behind a "More" tile. Resolves with the chosen key, or null.
 *
 * @param {string} title
 * @param {Array<{title?, icon?, folded?, items: Array<{key, label, icon?, value?, dim?}>}>} sections
 */
export function tileModal(title, sections, opts = {}) {
  return new Promise(resolve => {
    let settled = false;
    const body = el("div", { class: "tile-picker" });
    const pick = key => { settled = true; resolve(key); m.close(); };
    const drawSection = (sec, host) => {
      if (sec.title) host.appendChild(el("div", { class: "tp-head" }, sec.icon ? icon(sec.icon) : null, el("span", { text: sec.title })));
      const grid = el("div", { class: "tp-grid" + (sec.compact ? " is-compact" : "") });
      for (const it of sec.items) {
        grid.appendChild(el("button", {
          class: "tp-tile" + (it.dim ? " is-dim" : ""), type: "button", "aria-label": it.aria || it.label,
          onclick: () => pick(it.key)
        },
          it.icon ? el("span", { class: "tp-ico" }, icon(it.icon)) : null,
          it.value !== undefined ? el("span", { class: "tp-val", text: String(it.value) }) : null,
          el("span", { class: "tp-label", text: it.label })));
      }
      host.appendChild(grid);
    };
    for (const sec of sections) {
      if (sec.folded) {
        const more = el("div", {});
        const btn = el("button", { class: "btn ghost block tp-more", type: "button",
          onclick: () => { btn.remove(); drawSection({ ...sec, folded: false }, more); } }, sec.foldLabel || "More");
        body.appendChild(btn);
        body.appendChild(more);
      } else drawSection(sec, body);
    }
    const m = modal({
      title, body, wide: opts.wide,
      actions: [],
      onClose: () => { if (!settled) resolve(null); }
    });
  });
}

export function closeAllModals() {
  [...openModals].forEach(m => m.close());
}

/**
 * Copy to the clipboard. The async API needs a secure context, so a hidden textarea and
 * execCommand stand in when it is unavailable — over plain http on a phone, for instance.
 */
export async function copyText(text, okMessage) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      showToast(okMessage, "ok");
      return;
    }
  } catch { /* fall through to the textarea */ }

  const ta = el("textarea", { style: "position:fixed;top:-1000px;left:-1000px;opacity:0" });
  ta.value = text;
  document.body.appendChild(ta);
  ta.select();
  let ok = false;
  try { ok = document.execCommand("copy"); } catch { ok = false; }
  ta.remove();

  if (ok) { showToast(okMessage, "ok"); return; }

  // Nothing worked, so show the text and let the player copy it by hand.
  const area = el("textarea", { style: "min-height:220px" });
  area.value = text;
  modal({
    title: "Copy",
    body: el("div", {},
      el("p", { class: "small muted", text: "This browser blocked the clipboard. Select the text and copy it." }),
      area),
    actions: [{ label: "Close", kind: "primary" }]
  });
  area.select();
}

/**
 * A click and a buzz when the dice land (U8). Off unless the player turns it on; silent where
 * the browser has no audio or no vibration. Decoration only — it never carries a result.
 */
let audioCtx = null;
export function landFeedback(strong = false) {
  if (!Settings.sfx()) return;
  try { if (navigator.vibrate) navigator.vibrate(strong ? [30, 40, 30] : 25); } catch { /* unsupported */ }
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    audioCtx = audioCtx || new AC();
    const t = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "square";
    osc.frequency.setValueAtTime(strong ? 140 : 220, t);
    gain.gain.setValueAtTime(0.12, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(t); osc.stop(t + 0.1);
  } catch { /* audio blocked */ }
}
