/* help.js — the collapsed how-to accordions, and the tutorial screen.
 *
 * Copy lives in `data-help.js`; this module only renders it. Every screen calls
 * `helpAccordion(key)` and appends what comes back — null when the player has turned help
 * off, so no screen needs to know about the setting.
 *
 * It imports core, ui, settings and data-help, and nothing else. That keeps it usable from
 * `solo.js`, which is barred from the Classified rules modules (CLAUDE.md §5.1).
 */

import { el, clear } from "./core.js";
import { modal } from "./ui.js";
import { Settings, set as setSetting } from "./settings.js";
import { HELP, TUTORIAL, helpFor, GLOSSARY, GLOSSARY_SYSTEMS, glossaryFind } from "../data-help.js";

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

/* ---------------------------------------------------------------- glossary */

/**
 * Every term the app puts on screen, in one searchable place. It lives here rather than in
 * `screens.js` because `solo.js` needs it too and may not import the Classified modules
 * (CLAUDE.md §5.1) — a player meeting "Difficulty Factor" on the Solo screen is exactly the
 * player who needs the definition.
 *
 * @param {string} [q] initial filter, e.g. the word that was tapped
 */
export function openGlossary(q = "") {
  const list = el("div", {});

  function draw(filter) {
    clear(list);
    const hits = filter ? glossaryFind(filter) : GLOSSARY;
    if (!hits.length) {
      list.appendChild(el("p", { class: "muted small", text: "No matches." }));
      return;
    }
    for (const grp of GLOSSARY_SYSTEMS) {
      const rows = hits.filter(g => g.sys === grp.key);
      if (!rows.length) continue;
      list.appendChild(el("div", { class: "section-title", style: "margin-top:14px", text: grp.name }));
      const card = el("div", { class: "card flush" });
      for (const g of rows) {
        card.appendChild(el("div", { class: "card-row col" },
          el("b", { text: g.term }),
          el("span", { class: "small muted", text: g.what })));
      }
      list.appendChild(card);
    }
  }

  const search = el("input", { type: "search", placeholder: "Search the glossary…", value: q,
    oninput: e => draw(e.target.value.trim()) });
  draw(q);

  modal({
    title: "Glossary", wide: true,
    body: el("div", {},
      el("p", { class: "small muted", text: "Plain English for every term on screen. Two systems are in play here, so each word says which one it belongs to." }),
      search, list),
    actions: [{ label: "Close", kind: "primary" }]
  });
}

/** A row a screen can drop into a list to open the glossary. */
export function glossaryRow(label = "Glossary — what the words mean") {
  return el("button", { class: "skill-row", type: "button", onclick: () => openGlossary() },
    el("span", { class: "n", text: label }));
}

/* ---------------------------------------------------------------- solo, offered */

/**
 * Solo play is a toggle, and a toggle is a thing you have to already know exists. A player
 * who bought this to play on their own never meets the word "Mythic" on a fresh install, so
 * the offer is made where they are rather than left in Settings (N1).
 *
 * @returns {Promise<boolean>} true when it was switched on
 */
export function offerSolo() {
  return new Promise(resolve => {
    modal({
      title: "Play on your own",
      body: el("div", {},
        el("p", { class: "small", text: "Solo play adds a second system on top of Classified: the Mythic Game Master Emulator. It answers the questions a referee would answer — is anyone here, does the meeting go your way, what happens instead — so you can play with nobody running the game." }),
        el("p", { class: "small", text: "You still roll Classified for everything your operative attempts. Mythic only decides what is true." }),
        el("p", { class: "small muted", text: "Turning it on adds a Solo tab in place of Rules, which keeps its tile on Home. You can turn it off again in Settings." })),
      actions: [
        { label: "Not now", kind: "ghost", onClick: () => resolve(false) },
        { label: "Turn on solo play", kind: "primary", onClick: () => { enableSolo(); resolve(true); } }
      ]
    });
  });
}

/** Switch solo play on, rebuild the bottom bar, and land on the Solo screen. */
export function enableSolo(go = true) {
  setSetting("solo", true);
  import("./router.js").then(m => { m.rebuildNav(); if (go) m.navigate("solo"); });
}

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

  // The walkthrough teaches a tab that a fresh install does not have. Offering it here is
  // the difference between a tutorial and a tour of somewhere you cannot go (N1).
  if (!Settings.solo()) {
    host.appendChild(el("div", { class: "card" },
      el("h2", { style: "margin:0 0 6px", text: "You do not have the Solo tab yet" }),
      el("p", { class: "small muted", text: "Everything above happens on a screen that is switched off by default. Turn it on and it takes the Rules tab's place; Rules keeps its tile on Home." }),
      el("button", { class: "btn primary block", type: "button", style: "margin-top:10px",
        onclick: () => enableSolo() }, "Turn on solo play")));
  }
}
