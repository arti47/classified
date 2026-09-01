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
import { HELP, TUTORIAL, PLAY_GUIDE, helpFor, GLOSSARY, GLOSSARY_SYSTEMS, glossaryFind } from "../data-help.js";
import * as Store from "./store.js";

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
/* ---------------------------------------------------------------- the play guide */

/**
 * Where you are in a game, and the one thing to do next.
 *
 * The tutorial narrates a mission somebody else played; the how-to panels explain the panel
 * in front of you; the first-run card names three things and disappears the moment play
 * begins. None of them answers "what do I do next in my own game", which is the only
 * question a new player actually has — so this screen does, and stays useful for the whole
 * arc: start a game, keep it going, end it well.
 *
 * State comes from the live dossier and adventure, so a step ticks itself off as it is done.
 */
function guideState() {
  const c = Store.activeCharacter();
  const advs = Store.soloAdventures();
  const adv = Store.activeAdventure();
  const played = advs.some(a => a.scene > 1 || a.completedAt);
  return {
    hasCharacter: !!c,
    soloOn: Settings.solo(),
    hasAdventure: !!adv,
    hasBriefing: !!(adv && adv.briefing),
    playedAScene: played || !!(adv && adv.scenePhase === "play"),
    missionClosed: advs.some(a => a.completedAt),
    spentXP: !!(c && (c.xp.spent || 0) > 0),
    hasRolled: Store.rollLog().length > 0,
    inCampaign: !!(typeof localStorage !== "undefined" && localStorage.getItem("classified.campaign")),
    never: false
  };
}

export function renderPlayGuide(host, opts = {}) {
  clear(host);
  const state = guideState();
  const solo = Settings.solo();
  const track = solo ? PLAY_GUIDE.solo : PLAY_GUIDE.table;

  // The guided player comes first and takes the whole screen for somebody who just wants to
  // play. The written guide underneath is for the player who wants to know why. The slot is
  // captured rather than looked up later: `host` is reassigned below, and a promise that
  // resolves after that would search the wrong element.
  const coachSlot = el("div", { class: "coach-slot" });
  host.appendChild(coachSlot);
  import("./coach.js").then(m => m.renderCoach(coachSlot));

  const acc = el("details", { class: "acc" }, el("summary", {},
    el("span", { text: "How a game works" }),
    el("span", { class: "small muted", text: "the whole arc" })));
  const guide = el("div", { class: "acc-body", style: "padding:0" });
  acc.appendChild(guide);
  host.appendChild(acc);
  host = guide;

  host.appendChild(el("div", { class: "card" },
    el("h1", { text: "How to play" }),
    ...PLAY_GUIDE.intro.map(t => el("p", { class: "small muted", text: t }))));

  // Which game you are playing decides how it ends, so it is named rather than assumed.
  host.appendChild(el("div", { class: "card" },
    el("div", { class: "row" },
      el("div", { class: "grow" },
        el("div", { class: "field-label", text: "You are set up for" }),
        el("div", { style: "font-weight:600", text: track.name }),
        el("div", { class: "small muted", text: track.sub })),
      el("button", { class: "btn sm", type: "button",
        onclick: () => (solo ? goTo("solo", host) : goTo("offerSolo", host)) },
        solo ? "Open Solo" : "Play solo instead"))));

  // The next undone step in the whole guide, pulled to the top: one thing to do, always.
  const flat = track.acts.flatMap(a => (a.steps || []).map(st => ({ act: a, st })));
  const next = flat.find(x => !state[x.st.when]);
  if (next) {
    const card = el("div", { class: "card next-step" });
    card.appendChild(el("div", { class: "field-label", text: "Do this next" }));
    card.appendChild(el("div", { style: "font-weight:600", text: next.st.label }));
    card.appendChild(el("p", { class: "small muted", style: "margin-top:4px", text: next.st.sub }));
    if (next.st.tap) card.appendChild(el("p", { class: "small mono tut-tap", text: next.st.tap }));
    card.appendChild(el("button", {
      class: "btn primary block", type: "button", style: "margin-top:10px",
      onclick: () => goTo(next.st.go, host)
    }, next.st.action || "Go"));
    host.appendChild(card);
  } else {
    host.appendChild(el("div", { class: "banner ok" },
      el("b", { text: "You have played a mission end to end" }),
      el("div", { class: "small", text: "Everything below is here as a reminder of the loop." })));
  }

  for (const act of track.acts) {
    const sec = el("div", { class: "section" },
      el("div", { class: "section-title", text: act.title }));
    sec.appendChild(el("p", { class: "small muted", text: act.what }));

    for (const st of act.steps || []) {
      const done = !!state[st.when];
      const row = el("div", { class: "card guide-step" + (done ? " is-done" : "") });
      row.appendChild(el("div", { class: "row tight" },
        el("span", { class: "guide-tick", text: done ? "✓" : "" }),
        el("b", { class: "grow", text: st.label })));
      row.appendChild(el("p", { class: "small muted", style: "margin:4px 0 0", text: st.sub }));
      if (st.tap) row.appendChild(el("p", { class: "small mono tut-tap", text: st.tap }));
      if (!done && st.go) {
        row.appendChild(el("button", { class: "btn sm", type: "button", style: "margin-top:8px",
          onclick: () => goTo(st.go, host) }, st.action || "Go"));
      }
      sec.appendChild(row);
    }

    // The middle act is a loop rather than a checklist: it is what you do every scene.
    if (act.loop) {
      const card = el("div", { class: "card flush" });
      for (const step of act.loop) {
        card.appendChild(el("div", { class: "card-row col" },
          el("div", { class: "row tight" },
            el("span", { class: "tut-n", text: String(step.n) }),
            el("b", { class: "grow", text: step.label })),
          el("span", { class: "small muted", text: step.sub }),
          step.tap ? el("span", { class: "small mono tut-tap", text: step.tap }) : null));
      }
      sec.appendChild(card);
      if (act.note) sec.appendChild(el("p", { class: "small muted", text: act.note }));
    }

    host.appendChild(sec);
  }

  host.appendChild(el("div", { class: "btn-row", style: "margin-top:8px" },
    el("button", { class: "btn", type: "button", onclick: () => goTo("tutorial", host) }, "See a mission played"),
    el("button", { class: "btn ghost", type: "button", onclick: () => openGlossary() }, "Glossary")));
}

/** Route or act. Kept here so the guide's data stays free of anything but copy. */
function goTo(where, host) {
  if (!where) return;
  if (where === "offerSolo") { offerSolo(); return; }
  import("./router.js").then(m => m.navigate(where));
}

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
