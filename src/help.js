/* help.js — the collapsed how-to accordions, and the tutorial screen.
 *
 * Copy lives in `data-help.js`; this module only renders it. Every screen calls
 * `helpAccordion(key)` and appends what comes back — null when the player has turned help
 * off, so no screen needs to know about the setting.
 *
 * It imports core, ui, settings and data-help, and nothing else. That keeps it usable from
 * `solo.js`, which is barred from the Classified rules modules (CLAUDE.md §5.1).
 */

import { el } from "./core.js";
import { Settings } from "./settings.js";
import { HELP, TUTORIAL, helpFor } from "../data-help.js";

/**
 * A collapsed "How to use" accordion for a screen or panel.
 * @param {string} key one of the data-help.js keys, e.g. "sheet" or "solo.fate"
 * @param {object} [opts] extra: { actions: [{label, onClick}] } appended under the steps
 * @returns {HTMLElement|null} null when help is switched off or the key is unknown
 */
export function helpAccordion(key, opts = {}) {
  if (!Settings.showHelp()) return null;
  const entry = helpFor(key);
  if (!entry) return null;

  const acc = el("details", { class: "acc help-acc" },
    el("summary", {},
      el("span", { text: entry.title }),
      el("span", { class: "small muted", text: "how to use" })));

  const body = el("div", { class: "acc-body" });
  body.appendChild(el("p", { class: "small", text: entry.what }));

  const ol = el("ol", { class: "help-steps" });
  for (const step of entry.steps) ol.appendChild(el("li", { class: "small", text: step }));
  body.appendChild(ol);

  if (entry.note) body.appendChild(el("p", { class: "small muted", text: entry.note }));

  if (opts.actions && opts.actions.length) {
    const row = el("div", { class: "btn-row", style: "margin-top:10px" });
    for (const a of opts.actions) {
      row.appendChild(el("button", { class: "btn sm", type: "button", onclick: a.onClick }, a.label));
    }
    body.appendChild(row);
  }

  acc.appendChild(body);
  return acc;
}

/** Append the accordion to a host if there is one to append. */
export function appendHelp(host, key, opts) {
  const node = helpAccordion(key, opts);
  if (node) host.appendChild(node);
  return node;
}

export const HELP_ENTRY_KEYS = Object.keys(HELP);

/* ---------------------------------------------------------------- tutorial */

/** The walkthrough: one mission from nothing to the after-action report. Reads only. */
export function renderTutorial(host) {
  host.appendChild(el("div", { class: "card" },
    el("h1", { text: TUTORIAL.title }),
    ...TUTORIAL.intro.map(t => el("p", { class: "small muted", text: t }))));

  for (const step of TUTORIAL.steps) {
    const card = el("div", { class: "card tut-step" });
    card.appendChild(el("div", { class: "row tight" },
      el("span", { class: "tut-n", text: String(step.n) }),
      el("h2", { class: "grow", style: "margin:0;font-size:16px", text: step.title })));
    for (const p of step.body) card.appendChild(el("p", { class: "small", text: p }));
    if (step.tap) {
      card.appendChild(el("p", { class: "small mono tut-tap", text: step.tap }));
    }
    if (step.rule) {
      card.appendChild(el("button", {
        class: "btn sm ghost", type: "button",
        onclick: () => import("./screens.js").then(m => m.openRulesTopic(step.rule))
      }, "The rule behind it"));
    }
    host.appendChild(card);
  }

  for (const t of TUTORIAL.outro) {
    host.appendChild(el("p", { class: "small muted", style: "margin-top:14px", text: t }));
  }
}
