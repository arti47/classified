/* solo.js — the Mythic layer and the Solo screen.
 *
 * A SECOND SYSTEM. See CLAUDE.md §3.20. This module may import core, ui, store, settings
 * and data-solo.js, and nothing else: it must never reach into rules.js or data.js, which
 * is what keeps the Mythic engine and the Classified engine from bleeding together. Its one
 * crossing point is Store.addRoll(), so a solo session reads back in the shared roll log.
 *
 * That separation is why the d100 and d10 helpers below are local rather than imported from
 * roller.js — they honour the same manual-dice setting, but roller.js is the Classified
 * engine and importing it would breach the rule.
 */

import { el, clear, uid, d100, d10, die, announce, clamp, fmtDate, signed } from "./core.js";
import { modal, showToast, confirmModal, promptModal, chooseModal } from "./ui.js";
import * as S from "../data-solo.js";
import * as Store from "./store.js";
import { Settings } from "./settings.js";
import { appendHelp, glossaryRow } from "./help.js";

/* ---------------------------------------------------------------- dice */

/** d100 for the Mythic layer, honouring the manual-dice setting. */
async function soloD100(label = "d100") {
  if (!Settings.manualDice()) return d100();
  const v = await promptModal(`Enter your ${label} result (1-100)`, {
    title: "Manual dice", type: "number", okLabel: "Use result"
  });
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n >= 1 && n <= 100 ? n : d100();
}

async function soloD10(label = "d10") {
  if (!Settings.manualDice()) return d10();
  const v = await promptModal(`Enter your ${label} result (1-10)`, {
    title: "Manual dice", type: "number", okLabel: "Use result"
  });
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n >= 1 && n <= 10 ? n : d10();
}

/* ---------------------------------------------------------------- journal + log */

function journal(adv, kind, text, detail = "") {
  adv.journal = adv.journal || [];
  const id = uid("j");
  adv.journal.unshift({ id, ts: Date.now(), kind, text, detail });
  if (adv.journal.length > 200) adv.journal.length = 200;
  return id;
}

/** Drop a journal row by id. Used when a re-roll supersedes what it replaced. */
function unjournal(adv, id) {
  if (!id || !adv.journal) return;
  adv.journal = adv.journal.filter(j => j.id !== id);
}

/**
 * Write a solo roll to the shared log. `solo: true` and `outcome` keep it out of the
 * Classified Success Quality columns, which mean nothing here.
 */
function logSolo(adv, label, roll, outcome, note) {
  const linked = adv.characterId ? Store.getCharacter(adv.characterId) : null;
  const row = Store.addRoll({
    solo: true,
    by: linked ? (linked.identity.name || "Agent") : (adv.name || "Solo"),
    characterId: adv.characterId || null,
    label, roll, outcome, note: note || "",
    modifiers: []
  });
  announce(`${label}: ${outcome}`);
  return row ? row.id : null;
}

/* ---------------------------------------------------------------- screen */

export function renderSolo(host) {
  clear(host);
  const adv = Store.activeAdventure();

  if (!adv) {
    host.appendChild(el("div", { class: "card" },
      el("h1", { text: "Solo" }),
      el("p", { class: "small muted", text:
        "The Mythic Game Master Emulator, standing in for a game master. Ask Fate a question, test each scene against the Chaos Factor, and read the answers off the Meaning Tables." })));
    host.appendChild(el("div", { class: "empty" },
      el("div", { class: "big", text: "🎲" }),
      el("h2", { text: "No adventure open" }),
      el("p", { class: "muted", text: "An adventure holds the Chaos Factor, the scene count, your threads and characters, and the journal. It opens on the mission briefing, which names it." }),
      el("button", { class: "btn primary", type: "button", onclick: () => newAdventure(host) }, "Start an adventure")));
    appendHelp(host, "solo", {
      actions: [{ label: "Open the tutorial", onClick: () => import("./router.js").then(m => m.navigate("tutorial")) }]
    });
    appendTopics(host);
    return;
  }

  appendHeader(host, adv);
  appendCoach(host);
  appendHelp(host, "solo", {
    actions: [{ label: "Open the tutorial", onClick: () => import("./router.js").then(m => m.navigate("tutorial")) }]
  });
  appendPrimary(host, adv);
  appendBriefing(host, adv);
  appendInPlay(host, adv);
  appendLists(host, adv);
  appendJournal(host, adv);
  appendTopics(host);
}

/* The sequence of play, and the whole reason the screen is ordered the way it is:
 *
 *   setup ──Start scene──▶ play ──End scene──▶ setup (next scene)
 *
 * At setup the only thing to decide is what scene comes next. In play, the oracle and the
 * tables are what you reach for. So the primary action is whichever of those two boundaries
 * is next, the in-play tools sit under it, and the lists and journal — which you touch at the
 * boundaries — sit below them. */
const PHASES = {
  briefing: { key: "briefing", label: "No mission yet", next: "Write the mission briefing" },
  setup: { key: "setup", label: "No scene open", next: "Start scene" },
  play: { key: "play", label: "Scene in play", next: "End scene" }
};

function phaseOf(adv) { return PHASES[adv.scenePhase] || PHASES.setup; }

function rerender() {
  document.dispatchEvent(new CustomEvent("app:rerender"));
}

function save(mutator) {
  const adv = Store.updateAdventure(mutator);
  rerender();
  return adv;
}

function section(title, sub) {
  const s = el("div", { class: "section" });
  s.appendChild(el("div", { class: "section-head" }, el("div", { class: "section-title", text: title })));
  if (sub) s.appendChild(el("p", { class: "small muted", style: "margin-top:-2px", text: sub }));
  return s;
}

/* ---------------------------------------------------------------- header */

/**
 * The guided player, at the top of the screen it guides. Dynamically imported so the Mythic
 * layer keeps no static dependency on the conductor that drives it, and skipped when the
 * player has switched the how-to copy off — at that point they know where they are.
 */
function appendCoach(host) {
  if (!Settings.showHelp()) return;
  const slot = el("div", { class: "coach-slot" });
  host.appendChild(slot);
  import("./coach.js").then(m => m.renderCoach(slot, { compact: true }));
}

function appendHeader(host, adv) {
  const card = el("div", { class: "card" });
  const linked = adv.characterId ? Store.getCharacter(adv.characterId) : null;
  card.appendChild(el("div", { class: "row" },
    el("div", { class: "grow" },
      el("h1", { text: adv.name || "Untitled adventure" }),
      // Unlinked, the line is the control that fixes it rather than a note about it (N10).
      linked
        ? el("div", { class: "small muted", text: linkLabel(adv) })
        : el("div", { class: "row tight" },
            el("button", { class: "btn sm ghost", type: "button", onclick: () => linkDossier() }, "Link a dossier"),
            el("span", { class: "small muted", text: adv.fateMode === "check" ? "Fate Check" : "Fate Chart" }))),
    el("button", { class: "btn sm", type: "button", onclick: () => openAdventureMenu(host) }, "Adventures")
  ));

  const grid = el("div", { class: "grid grid-2", style: "margin-top:10px" });

  const chaosBox = el("div", { class: "stat-box" },
    el("div", { class: "k", text: "Chaos Factor" }),
    el("div", { class: "v", text: String(adv.chaos) }),
    el("div", { class: "s", text: adv.chaos >= 7 ? "running away from you" : adv.chaos <= 3 ? "firmly in hand" : "even footing" }));
  grid.appendChild(chaosBox);

  grid.appendChild(el("div", { class: "stat-box" },
    el("div", { class: "k", text: "Scene" }),
    el("div", { class: "v", text: String(adv.scene) }),
    el("div", { class: "s", text: adv.sceneKind
      ? S.SCENE_KINDS[adv.sceneKind].name.toLowerCase()
      : `${count(adv.threads, "thread")} · ${count(adv.characters, "character")}` })));
  card.appendChild(grid);

  card.appendChild(el("div", { class: "row tight", style: "margin-top:10px" },
    el("span", { class: "pill " + (adv.completedAt ? "q1" : "neutral"),
      text: adv.completedAt ? "Mission closed" : phaseOf(adv).label }),
    el("span", { class: "spacer" }),
    el("button", { class: "btn sm ghost", type: "button", onclick: () => openTopic("chaos") }, "What Chaos does")));
  host.appendChild(card);


  const undo = Store.peekSoloUndo();
  if (undo) {
    host.appendChild(el("div", { class: "banner" },
      el("div", { class: "small", text: `${undo.label || "Last scene boundary"} · ${fmtDate(undo.ts)}` }),
      el("button", {
        class: "btn sm", type: "button", style: "margin-top:6px",
        onclick: () => { if (Store.applySoloUndo()) { showToast("Reverted", "ok"); rerender(); } }
      }, "Undo it")));
  }
}

function count(list, noun) {
  const n = (list || []).length;
  return `${n} ${noun}${n === 1 ? "" : "s"}`;
}

function linkLabel(adv) {
  const linked = adv.characterId ? Store.getCharacter(adv.characterId) : null;
  const who = linked ? (linked.identity.name || "an unnamed operative") : "no dossier linked";
  return `${who} · ${adv.fateMode === "check" ? "Fate Check" : "Fate Chart"}`;
}

async function openAdventureMenu(host) {
  const list = Store.soloAdventures();
  const items = list.map(a => ({
    key: a.id, label: a.name || "Untitled",
    right: a.completedAt ? "closed" : `CF ${a.chaos} · sc ${a.scene}`,
    desc: a.completedAt
      ? `${(S.MISSION_OUTCOMES[a.outcome] || { name: "Closed" }).name} · ${a.scene - 1} scenes · ended ${fmtDate(a.completedAt)}`
      : `${count(a.threads, "thread")}, ${count(a.characters, "character")} · updated ${fmtDate(a.updatedAt)}`
  }));
  items.push({ key: "__new", label: "+ Start a new adventure", desc: "Opens on the mission briefing, which names it. Chaos Factor 5, scene 1, empty lists." });

  // Switching adventures is a play action and stays one tap. Everything that configures the
  // adventure rather than plays it sits one level down, so the two never mix.
  const active = Store.activeAdventure();
  if (active) {
    items.push({
      key: "__settings", label: "Adventure settings",
      right: active.fateMode === "check" ? "Fate Check" : "Fate Chart",
      desc: "Fate mechanic, Chaos Factor correction, linked dossier, rename, delete."
    });
  }

  let key = await chooseModal("Adventures", items);
  if (!key) return;
  if (key === "__new") { newAdventure(host); return; }

  if (key === "__settings") {
    key = await chooseModal("Adventure settings", [
      { key: "__mechanic", label: "Fate mechanic",
        right: active.fateMode === "check" ? "Fate Check" : "Fate Chart",
        desc: "The chart rolls d100 under a printed target; the check rolls 2d10 against 11." },
      { key: "__chaos", label: "Set the Chaos Factor by hand",
        right: String(active.chaos),
        desc: "End Scene steps it for you. This is for correcting it, not for playing." },
      { key: "__briefing", label: active.briefing ? "Edit the mission briefing" : "Write the mission briefing",
        desc: active.briefing ? "Rewrite any row. Editing never re-seeds your lists." : "Roll a mission and seed the Adventure Lists from it." },
      !active.completedAt && active.scene > 1
        ? { key: "__endmission", label: "End the mission",
            desc: "Closes the adventure and fires Classified's End Mission for the linked dossier." }
        : null,
      active.briefing
        ? { key: "__delbriefing", label: "Delete the mission",
            desc: "Drops the briefing, and optionally the threads and characters it seeded. The adventure stays." }
        : null,
      { key: "__link", label: "Link a dossier", desc: "Point this adventure at a character so PC events name them." },
      { key: "__rename", label: "Rename this adventure", desc: "" },
      { key: "__delete", label: "Delete this adventure", desc: "Its journal and lists go with it." }
    ].filter(Boolean), { intro: active.name || "Untitled" });
    if (!key) return;
  }
  if (key === "__briefing") { openBriefing(Store.activeAdventure()); return; }
  if (key === "__delbriefing") { deleteBriefing(Store.activeAdventure()); return; }
  if (key === "__endmission") { endMission(Store.activeAdventure()); return; }
  if (key === "__rename") {
    const name = await promptModal("Adventure name", { title: "Rename", value: active.name || "" });
    if (name) { save(a => { a.name = name; }); }
    return;
  }
  if (key === "__mechanic") {
    const pick = await chooseModal("Fate mechanic", [
      { key: "chart", label: "Fate Chart", desc: "Roll d100 at or under the printed target for the odds and Chaos Factor." },
      { key: "check", label: "Fate Check", desc: "Roll 2d10, add the odds and Chaos Factor modifiers, 11 or more is a Yes." }
    ]);
    if (pick) save(a => { a.fateMode = pick; });
    return;
  }
  if (key === "__chaos") {
    const v = await promptModal(`Chaos Factor (${S.CHAOS_MIN}-${S.CHAOS_MAX})`, {
      title: "Set the Chaos Factor", type: "number", value: String(active.chaos)
    });
    const n = parseInt(v, 10);
    if (Number.isFinite(n)) {
      save(a => { a.chaos = Math.max(S.CHAOS_MIN, Math.min(S.CHAOS_MAX, n)); });
    }
    return;
  }
  if (key === "__delete") {
    if (await confirmModal(`Delete “${active.name}”?`, { danger: true, okLabel: "Delete" })) {
      Store.deleteAdventure(active.id);
      rerender();
    }
    return;
  }
  if (key === "__link") { await linkDossier(); return; }
  Store.setActiveAdventure(key);
  rerender();
}

/**
 * Point this adventure at a character.
 *
 * An unlinked adventure still plays — Fate does not need a dossier — but the in-scene checks
 * disappear and events that name the player character have nobody to name, and the screen
 * used to say so in four quiet words in the header. With no dossiers at all it offers to make
 * one rather than reporting the obvious (N10).
 */
async function linkDossier() {
  const chars = Store.allCharacters();
  if (!chars.length) {
    const make = await confirmModal(
      "Solo play runs on an ordinary dossier: it is what the in-scene checks roll against, and what a Random Event means when it points at you. There are none on this device yet.",
      { title: "No dossier yet", okLabel: "Create a character" });
    if (make) import("./router.js").then(m => m.navigate("create"));
    return;
  }
  const pick = await chooseModal("Link a dossier", chars.map(c => ({
    key: c.id, label: c.identity.name || "Unnamed", desc: "Events that name the player character will use this dossier."
  })).concat([{ key: "__none", label: "No dossier", desc: "Run the adventure without a linked character." }]));
  if (!pick) return;
  save(a => { a.characterId = pick === "__none" ? null : pick; });
}

/**
 * Start an adventure, and nothing else: no name prompt, no dossier chooser.
 *
 * Both questions used to be asked here and both were the wrong question at the wrong time.
 * The very next screen is the briefing, whose first row rolls a codename and names the
 * adventure with it — so asking for a name one tap earlier is asking the player to invent
 * the thing the app is about to hand them. The dossier is whichever one is already open,
 * which is the answer in every case but a deliberate switch, and Adventure settings holds
 * both if the guess is wrong.
 */
function newAdventure(host) {
  const chars = Store.allCharacters();
  const active = Store.activeId();
  const characterId = (active && chars.some(c => c.id === active)) ? active
    : (chars.length === 1 ? chars[0].id : null);

  const adv = Store.createAdventure({ characterId });
  save(a => { journal(a, "note", `Adventure opened at Chaos Factor ${adv.chaos}.`); });

  const linked = characterId ? Store.getCharacter(characterId) : null;
  showToast(linked
    ? `Adventure started for ${linked.identity.name || "your operative"}`
    : "Adventure started", "ok");
}

/* ---------------------------------------------------------------- the next step */

/**
 * The primary action: whichever scene boundary comes next. Everything else on the screen is
 * something you reach for during a scene, so only this one changes with the phase.
 */
function appendPrimary(host, adv) {
  appendHelp(host, "solo.scene");
  const phase = phaseOf(adv);
  const card = el("div", { class: "card" });

  // A finished mission has no next scene. Without this the loop had no exit at all: the
  // adventure ran until the player stopped opening it, and Classified's own End Mission —
  // the experience, the Hero Point, the Reputation — sat on another screen with nothing
  // pointing at it (ruling S24).
  if (adv.completedAt) {
    card.appendChild(el("div", { class: "banner ok" },
      el("b", { text: `Mission ${(S.MISSION_OUTCOMES[adv.outcome] || { name: "closed" }).name.toLowerCase()}` }),
      el("div", { class: "small", text: `Closed ${fmtDate(adv.completedAt)} after ${adv.scene - 1} scene${adv.scene === 2 ? "" : "s"}.` })));
    card.appendChild(el("p", { class: "small muted", style: "margin-top:8px", text:
      "The journal, the lists and the mysteries are all still here to read. Starting a new adventure leaves this one filed." }));
    card.appendChild(el("button", {
      class: "btn primary block solo-primary", type: "button", style: "margin-top:10px",
      onclick: () => newAdventure(host)
    }, "Start a new adventure"));
    card.appendChild(el("button", {
      class: "btn ghost block", style: "margin-top:6px", type: "button",
      onclick: async () => {
        if (await confirmModal("Reopen this mission? It goes back to where it was, and the experience it awarded is not taken back.",
          { title: "Reopen the mission", okLabel: "Reopen" })) {
          save(a => { a.completedAt = null; a.outcome = null; journal(a, "note", "Mission reopened."); });
        }
      }
    }, "Reopen it"));
    host.appendChild(card);
    return;
  }

  if (phase.key === "briefing") {
    card.appendChild(el("p", { class: "small muted", text:
      "Before scene one there is a mission. Roll the briefing and write it in your own words — the objective and the complication become your first threads, and the opponent your first character, so the oracle has something to point at." }));
    card.appendChild(el("button", {
      class: "btn primary block solo-primary", type: "button", style: "margin-top:10px",
      onclick: () => openBriefing(adv)
    }, "Write the mission briefing"));
    card.appendChild(el("button", {
      class: "btn ghost block", style: "margin-top:6px", type: "button",
      onclick: async () => {
        if (await confirmModal("Start scene 1 with no briefing? The Threads and Characters lists stay empty, so early Random Events will have nothing to draw.",
          { title: "Skip the briefing", okLabel: "Skip it" })) {
          save(a => { a.scenePhase = "setup"; journal(a, "note", "Briefing skipped."); });
        }
      }
    }, "Skip it — I know the mission"));
    card.appendChild(el("button", {
      class: "btn ghost block", style: "margin-top:6px", type: "button",
      onclick: () => openTopic("briefing")
    }, "What the briefing is for"));
    host.appendChild(card);
    return;
  }

  if (phase.key === "setup") {
    card.appendChild(el("p", { class: "small muted", text:
      "Say what you expect to happen next, then test it against the Chaos Factor. Over it, you get the scene you planned; at or under, it is altered or interrupted." }));
    card.appendChild(el("button", {
      class: "btn primary block solo-primary", type: "button", style: "margin-top:10px",
      onclick: () => startScene(adv)
    }, `Start scene ${adv.scene}`));
    // Between scenes is when a mission ends, so the exit sits beside the next scene rather
    // than buried in settings.
    if (adv.scene > 1) {
      card.appendChild(el("button", {
        class: "btn ghost block", style: "margin-top:6px", type: "button",
        onclick: () => endMission(adv)
      }, "End the mission"));
    }
  } else {
    const kind = adv.sceneKind ? S.SCENE_KINDS[adv.sceneKind] : null;
    if (kind) {
      card.appendChild(el("span", { class: "pill " +
        (adv.sceneKind === "expected" ? "q1" : adv.sceneKind === "altered" ? "q3" : "q5"), text: kind.name }));
    }
    if (adv.sceneExpected) {
      card.appendChild(el("p", { class: "small", style: "margin-top:6px" },
        el("b", { text: "This scene: " }), adv.sceneExpected));
    }
    card.appendChild(el("p", { class: "small muted", style: "margin-top:6px", text:
      "Play it out with the tools below. Ending the scene steps the Chaos Factor and takes you through your lists." }));
    card.appendChild(el("button", {
      class: "btn primary block solo-primary", type: "button", style: "margin-top:10px",
      onclick: () => endScene(adv)
    }, `End scene ${adv.scene}`));
  }

  card.appendChild(el("button", {
    class: "btn ghost block", style: "margin-top:6px", type: "button",
    onclick: () => openTopic("scenes")
  }, "How scenes work"));
  host.appendChild(card);
}

/* ---------------------------------------------------------------- mission briefing */

/**
 * The briefing, pinned under the primary action and closed by default. It is reference, not
 * a step — the step is the primary action above it — so it never competes for the eye.
 */
function appendBriefing(host, adv) {
  if (!adv.briefing) return;
  appendHelp(host, "solo.briefing");
  const rows = S.BRIEFING_ROWS
    .map(r => ({ row: r, val: adv.briefing.rows[r.key] }))
    .filter(x => x.val && x.val.text);
  if (!rows.length) return;

  const acc = el("details", { class: "acc" },
    el("summary", {},
      el("span", { text: "Mission briefing" }),
      el("span", { class: "small muted", text: briefingHeadline(adv) })));
  const body = el("div", { class: "acc-body", style: "padding:0" });

  const card = el("div", { class: "card flush" });
  for (const { row, val } of rows) {
    card.appendChild(el("div", { class: "card-row" },
      el("div", { class: "grow" },
        el("div", { class: "small muted", text: row.name }),
        el("div", { text: val.text }),
        promptedWords(val) ? el("div", { class: "lm", text: promptedWords(val) }) : null)));
  }
  body.appendChild(card);

  body.appendChild(el("div", { class: "btn-row", style: "padding:10px 14px" },
    el("button", { class: "btn sm", type: "button", onclick: () => openBriefing(adv) }, "Edit"),
    el("button", { class: "btn sm ghost", type: "button",
      onclick: () => copyText(briefingText(adv), "Briefing copied") }, "Copy"),
    adv.briefing.npc
      ? el("button", { class: "btn sm ghost", type: "button",
          onclick: () => import("./combat.js").then(m => m.showNPC(adv.briefing.npc)) }, "Opponent")
      : null,
    // A stat block that cannot reach the tracker is a stat block you read out and retype.
    adv.briefing.npc
      ? el("button", { class: "btn sm ghost", type: "button",
          onclick: () => import("./combat.js").then(m => {
            m.addNpcToEncounter(adv.briefing.npc);
            showToast(`${adv.briefing.npc.name} is in the encounter`, "ok");
          }) }, "To combat")
      : null,
    el("button", { class: "btn sm danger", type: "button",
      onclick: () => deleteBriefing(Store.activeAdventure()) }, "Delete mission")));

  acc.appendChild(body);
  host.appendChild(acc);
}

/**
 * The words that prompted a row, or "" when the row still *is* those words.
 *
 * Every row rolls its words straight into the field, so an unedited row's text is the words
 * joined — printing both underneath each other says the same thing twice. The words are worth
 * keeping only once the player has written over them, when they show what the line came from.
 * Compared on letters alone, so the joiner ("·", "/", "—") and case never make an unedited row
 * look edited.
 */
function promptedWords(val) {
  if (!val.words || !val.words.length) return "";
  const line = val.words.join(" · ");
  const bare = s => String(s).toLowerCase().replace(/[^a-z0-9]/g, "");
  return bare(val.text) === bare(line) ? "" : line;
}

/** The one-line summary on the closed accordion: the objective, or the codename. */
function briefingHeadline(adv) {
  const r = adv.briefing ? adv.briefing.rows : {};
  const obj = r.objective && r.objective.text;
  const code = r.codename && r.codename.text;
  return obj || code || "written";
}

/**
 * Delete the whole mission. The briefing goes; whether the Threads and Characters it seeded
 * go with it is the player's call, because by the time you want a different mission those
 * entries may have been played with for several scenes. Only the entries the briefing itself
 * created are eligible — anything added by hand since is left alone.
 *
 * An adventure that has not started scene 1 goes back to the briefing phase, so the primary
 * action offers to write a new one. One that is under way keeps its phase: the mission it was
 * briefed on is gone, but the scene it is in is not.
 */
async function deleteBriefing(adv) {
  if (!adv || !adv.briefing) return;
  const seeded = seededEntries(adv);
  const items = [
    { key: "briefing", label: "Delete the briefing only",
      desc: seeded.length
        ? `Your lists keep the ${seeded.length} entr${seeded.length === 1 ? "y" : "ies"} it seeded.`
        : "Nothing it seeded is still on your lists, so they are untouched." }
  ];
  if (seeded.length) {
    items.push({
      key: "both", label: "Delete it and what it seeded",
      desc: seeded.map(s => s.item.text).join("; ")
    });
  }
  const pick = await chooseModal(`Delete “${briefingHeadline(adv)}”?`, items, {
    intro: "The codename, objective, complication, cover, intel and the generated opponent all go. The journal keeps its record, and this is undoable once."
  });
  if (!pick) return;

  Store.pushSoloUndo(Store.soloSnapshot("Mission deleted"));
  const alsoLists = pick === "both";
  save(a => {
    if (alsoLists) {
      const ids = new Set(seeded.map(s => s.item.id));
      for (const listKey of ["threads", "characters"]) {
        a[listKey] = (a[listKey] || []).filter(i => !ids.has(i.id));
      }
    }
    a.briefing = null;
    if (a.scene <= 1 && a.scenePhase !== "play") a.scenePhase = "briefing";
    journal(a, "note", alsoLists ? "Mission deleted, with the entries it seeded." : "Mission deleted.");
  });
  showToast("Mission deleted", "ok");
}

/**
 * The Adventure List entries this briefing put there and that are still there. Matched by the
 * ids recorded at commit; a briefing written before those were kept falls back to matching the
 * row text, which is what it was seeded from.
 */
function seededEntries(adv) {
  const b = adv.briefing;
  if (!b) return [];
  const ids = new Set(Array.isArray(b.seededIds) ? b.seededIds : []);
  const texts = new Set(S.BRIEFING_ROWS
    .filter(r => r.seeds)
    .map(r => b.rows[r.key] && b.rows[r.key].text)
    .filter(Boolean));
  const out = [];
  for (const listKey of ["threads", "characters"]) {
    for (const item of adv[listKey] || []) {
      if (ids.has(item.id) || (!ids.size && texts.has(item.text))) out.push({ list: listKey, item });
    }
  }
  return out;
}

function briefingText(adv) {
  const lines = [];
  for (const row of S.BRIEFING_ROWS) {
    const val = adv.briefing.rows[row.key];
    if (!val || !val.text) continue;
    const prompt = promptedWords(val);
    lines.push(`${row.name}: ${val.text}` + (prompt ? `  (${prompt})` : ""));
  }
  return `${adv.name}\n\n${lines.join("\n")}`;
}

/**
 * The briefing's Primary Opponent: a Classified stat block with a rolled identity in front
 * of it.
 *
 * The stat block comes from the Classified generator, which lives on the combat screen and
 * is loaded on demand so the Mythic layer keeps no static dependency on Classified's rules
 * (ruling S15). That generator names an NPC after its own stereotype and rank, so on its own
 * it hands back "Villain Primary Opponent" every single time — the numbers changed, the name
 * never did. The codename and the two adversary words are what make each one a person.
 */
async function generateOpponent() {
  const cfg = S.BRIEFING_OPPONENT;
  const { generateNPC } = await import("./combat.js");
  const gen = generateNPC(cfg.stereotype, cfg.rank);
  const alias = await rollOne(cfg.aliasTable);
  const traits = await rollPair(cfg.traitTable);
  // The same trait twice is amplification, so the name says it once (see opponentName). The
  // words kept with the row have to match what the name used, or the pinned briefing thinks
  // the row was written over and prints the words back underneath it (S18).
  const said = traits.words[0].toLowerCase() === traits.words[1].toLowerCase()
    ? [traits.words[0]]
    : traits.words;
  return {
    ...gen,
    alias: alias.word,
    traits: traits.words,
    identityWords: [alias.word, ...said],
    identityRolls: [alias.roll, ...traits.rolls],
    name: opponentName(alias.word, traits.words)
  };
}

/** "Cormorant — ruthless spymaster". The same word twice is amplification, so it is said once. */
function opponentName(alias, traits) {
  const words = traits.map(w => String(w).toLowerCase());
  const tail = words[0] === words[1] ? words[0] : words.join(" ");
  return `${alias} — ${tail}`;
}

/**
 * Write or rewrite the briefing. Each row rolls its words straight into an editable field —
 * the words are the prompt, the field is the answer, and leaving the words as written is a
 * legitimate answer. Committing seeds the Adventure Lists.
 */
export async function openBriefing(adv) {
  const existing = adv.briefing ? adv.briefing.rows : {};
  const state = {};
  for (const row of S.BRIEFING_ROWS) {
    const prev = existing[row.key];
    state[row.key] = { text: prev ? prev.text : "", words: prev ? prev.words : [], rolls: prev ? prev.rolls : [] };
  }
  let npc = adv.briefing ? adv.briefing.npc : null;

  const body = el("div", {});
  body.appendChild(el("p", { class: "small muted", text:
    "Roll a row to fill it, then write over it if the words suggest something better. Blank rows are simply left out." }));

  // What the last roll wrote into each field, so Roll all can tell a row you have written
  // from a row that is still just its words.
  const rolled = new Map(S.BRIEFING_ROWS.map(r => [r.key, state[r.key].text]));
  const rollers = [];

  const rollAllBtn = el("button", { class: "btn block", type: "button" }, "Roll all");
  body.appendChild(rollAllBtn);
  body.appendChild(el("p", { class: "lm", text:
    "Rolls every row you have not written over. Anything you have edited is left alone." }));

  for (const row of S.BRIEFING_ROWS) {
    const field = el("input", { type: "text", value: state[row.key].text, placeholder: row.placeholder });
    field.addEventListener("input", () => { state[row.key].text = field.value; });

    const wordsEl = el("div", { class: "lm", text: state[row.key].words.join(" · ") });

    const rollBtn = el("button", { class: "btn sm", type: "button" }, row.npc ? "Generate" : "Roll");
    const runRoll = async () => {
      if (row.npc) {
        npc = await generateOpponent();
        state[row.key].words = npc.identityWords || [npc.alias, ...npc.traits];
        state[row.key].rolls = npc.identityRolls;
        state[row.key].text = npc.name;
        field.value = npc.name;
        rolled.set(row.key, npc.name);
        wordsEl.textContent = `${npc.rankLabel} ${npc.stereotype} · Speed ${npc.speed} · ${npc.points} Villain Points · rolled ${npc.identityRolls.join(", ")}`;
        syncSeeds();
        return;
      }
      if (row.hidden) {
        // Whether the mission conceals anything, and what it hangs on. A hit opens a mystery
        // when the briefing is committed — with no clues yet, so nothing says when it breaks.
        const r = await soloD100("Hidden truth d100");
        const hit = S.hiddenTruth(r);
        // The roll itself carries the subject, so the row has no prompt words to print under
        // its own line the way a word-pair row does.
        state[row.key].words = [];
        state[row.key].rolls = [r];
        state[row.key].text = hit.text;
        field.value = hit.text;
        rolled.set(row.key, hit.text);
        wordsEl.textContent = `Hidden truth · rolled ${r}`;
        syncSeeds();
        return;
      }
      const pair = await rollPair(row.table);
      state[row.key].words = pair.words;
      state[row.key].rolls = pair.rolls;
      state[row.key].text = pair.words.join(row.join || " · ");
      field.value = state[row.key].text;
      rolled.set(row.key, state[row.key].text);
      wordsEl.textContent = `${pair.label} · rolled ${pair.rolls.join(" and ")}`;
      syncSeeds();
    };
    rollBtn.addEventListener("click", () => runRoll());
    rollers.push({ row, run: runRoll, written: () => {
      const t = state[row.key].text;
      return !!t.trim() && t !== rolled.get(row.key);
    } });

    body.appendChild(el("div", { style: "margin-bottom:14px" },
      el("div", { class: "row tight" },
        el("span", { class: "field-label", style: "margin:0;flex:1 1 auto", text: row.name }),
        rollBtn),
      field,
      wordsEl,
      el("div", { class: "lm", text: row.hint })));
  }

  // One tap for the whole mission. A row you have written over is yours and survives it,
  // which is what stops Roll all being a button that destroys work.
  rollAllBtn.addEventListener("click", async () => {
    const due = rollers.filter(r => !r.written());
    if (!due.length) { showToast("Every row has been written over", ""); return; }
    rollAllBtn.disabled = true;
    rollAllBtn.textContent = "Rolling…";
    for (const r of due) await r.run();
    rollAllBtn.disabled = false;
    rollAllBtn.textContent = "Roll all";
    showToast(`Rolled ${due.length} row${due.length === 1 ? "" : "s"}`, "ok");
  });

  /* The lines that go on the Adventure Lists, worded before they are added rather than after.
   * A seeded thread used to be the row text verbatim, so a list could open on "Deliver ·
   * Evaluate" — a word pair, not something you can act on. These fields track the row until
   * you write in one, and then they are yours (ruling S22). */
  const first = !adv.briefing;
  const seedRows = S.BRIEFING_ROWS.filter(r => r.seeds);
  const seedFields = new Map();
  const seedDirty = new Set();
  const seedBox = el("div", { style: "margin-top:4px" });

  function seedDefault(row) {
    if (!row.npc) return state[row.key].text;
    // The opponent goes on Characters as who they are, not as the whole "codename — traits" line.
    return npc ? (npc.alias || npc.name) : state[row.key].text;
  }
  function syncSeeds() {
    for (const row of seedRows) {
      const f = seedFields.get(row.key);
      if (!f) continue;
      if (!seedDirty.has(row.key)) f.value = seedDefault(row);
      f.closest(".field").style.display = state[row.key].text.trim() ? "" : "none";
    }
  }

  if (first) {
    seedBox.appendChild(el("div", { class: "field-label", text: "Goes on your Adventure Lists" }));
    seedBox.appendChild(el("p", { class: "lm", text:
      "Write these the way you want to read them mid-scene. They follow the rows above until you change one." }));
    for (const row of seedRows) {
      const f = el("input", { type: "text", value: seedDefault(row), placeholder: row.name });
      f.addEventListener("input", () => seedDirty.add(row.key));
      seedFields.set(row.key, f);
      seedBox.appendChild(el("label", { class: "field" },
        el("span", { text: `${row.name} → ${row.seeds === "threads" ? "Threads" : "Characters"}` }), f));
    }
    syncSeeds();
    body.addEventListener("input", syncSeeds);
    body.appendChild(seedBox);
  } else {
    body.appendChild(el("p", { class: "small muted", text:
      "Editing the briefing does not touch your Adventure Lists — nothing you struck off comes back." }));
  }

  const ok = await confirmModal(body, {
    title: adv.briefing ? "Edit the briefing" : "Mission briefing",
    okLabel: adv.briefing ? "Save" : "Commit the briefing"
  });
  if (!ok) return;

  save(a => {
    const seededIds = a.briefing && Array.isArray(a.briefing.seededIds) ? a.briefing.seededIds : [];
    a.briefing = { rows: state, npc, writtenAt: Date.now(), seededIds };

    // Name the adventure from its codename if it never got one.
    if (state.codename.text && /^untitled/i.test(a.name || "")) a.name = state.codename.text;

    // Seed the lists once, on the first commit. An edit does not re-add what you may have
    // already struck off.
    if (first) {
      for (const row of seedRows) {
        if (!state[row.key].text.trim()) continue;
        const f = seedFields.get(row.key);
        const text = ((f && f.value.trim()) || seedDefault(row) || "").trim();
        if (!text) continue;
        const list = (a[row.seeds] = a[row.seeds] || []);
        if (list.length >= S.LIST_SLOTS) continue;
        if (list.some(i => i.text === text)) continue;
        const entry = { id: uid("li"), text, weight: 1 };
        list.push(entry);
        // Remembered so deleting the mission can take back exactly what it put there, and
        // nothing a player added by hand afterwards.
        a.briefing.seededIds.push(entry.id);
      }
      a.scenePhase = "setup";
      journal(a, "note", `Mission briefing: ${state.objective.text || state.codename.text || "written"}`,
        [state.genre.text, state.cover.text].filter(Boolean).join(" · "));

      // A Hidden truth hit opens a mystery on whatever it named, at zero clues. You start
      // knowing the mission conceals something, and nothing else about it.
      const hiddenSubject = state.hidden.rolls.length
        ? S.hiddenTruth(state.hidden.rolls[0]).subject
        : null;
      if (hiddenSubject && S.MYSTERY_SUBJECT_BY_KEY[hiddenSubject]) {
        const source = hiddenSubject === "opponent"
          ? (npc ? (npc.alias || npc.name) : "The primary opponent")
          : (state[hiddenSubject] && state[hiddenSubject].text) || S.MYSTERY_SUBJECT_BY_KEY[hiddenSubject].name;
        (a.mysteries = a.mysteries || []).push({
          id: uid("mys"), subject: hiddenSubject, label: source, sourceId: null,
          clues: 0, clueLog: [], misses: 0, lastScene: a.scene || 1,
          createdAt: Date.now(), revealedAt: null, reveal: null
        });
        journal(a, "note", `Mystery opened: ${source}`, state.hidden.text);
      }
    } else {
      journal(a, "note", "Mission briefing revised.");
    }
  });

  if (first) {
    const seeded = seedRows
      .filter(r => state[r.key].text.trim())
      .map(r => {
        const f = seedFields.get(r.key);
        return `${r.name}: ${(f && f.value.trim()) || seedDefault(r)}`;
      });
    modal({
      title: "Briefing committed",
      body: el("div", {},
        seeded.length
          ? el("div", {}, el("p", { class: "small", text: "Added to your Adventure Lists:" }),
              ...seeded.map(t => el("p", { class: "small", text: "• " + t })))
          : el("p", { class: "small muted", text: "Nothing was added to your lists — you can add threads and characters by hand." }),
        el("p", { class: "small muted", style: "margin-top:10px", text: "Scene 1 is next. The briefing stays pinned under the primary action." })),
      actions: [{ label: "OK", kind: "primary" }]
    });
  } else {
    showToast("Briefing saved", "ok");
  }
}

/**
 * Roll and commit the whole briefing without a dialog, and hand back what it says in plain
 * words. This is what the guided player calls: somebody who will not read a manual will not
 * fill in a seven-row form either, and every row is rewritable afterwards from the pinned
 * accordion, so nothing is lost by rolling it all now.
 */
export async function autoBriefing(adv) {
  const state = {};
  let npc = null;

  for (const row of S.BRIEFING_ROWS) {
    if (row.npc) {
      npc = await generateOpponent();
      state[row.key] = { text: npc.name, words: npc.identityWords || [], rolls: npc.identityRolls || [] };
      continue;
    }
    if (row.hidden) {
      const r = await soloD100("Hidden truth d100");
      const hit = S.hiddenTruth(r);
      state[row.key] = { text: hit.text, words: [], rolls: [r] };
      continue;
    }
    const pair = await rollPair(row.table);
    state[row.key] = {
      text: pair.words.join(row.join || " · "), words: pair.words, rolls: pair.rolls
    };
  }

  save(a => {
    a.briefing = { rows: state, npc, writtenAt: Date.now(), seededIds: [] };
    if (state.codename.text && /^untitled/i.test(a.name || "")) a.name = state.codename.text;

    for (const row of S.BRIEFING_ROWS) {
      if (!row.seeds) continue;
      const text = row.npc ? (npc ? (npc.alias || npc.name) : "") : state[row.key].text;
      if (!text) continue;
      const list = (a[row.seeds] = a[row.seeds] || []);
      if (list.length >= S.LIST_SLOTS || list.some(i => i.text === text)) continue;
      const entry = { id: uid("li"), text, weight: 1 };
      list.push(entry);
      a.briefing.seededIds.push(entry.id);
    }

    a.scenePhase = "setup";
    journal(a, "note", `Mission briefing: ${state.objective.text}`,
      [state.genre.text, state.cover.text].filter(Boolean).join(" · "));

    const hiddenSubject = state.hidden.rolls.length ? S.hiddenTruth(state.hidden.rolls[0]).subject : null;
    if (hiddenSubject && S.MYSTERY_SUBJECT_BY_KEY[hiddenSubject]) {
      const source = hiddenSubject === "opponent"
        ? (npc ? (npc.alias || npc.name) : "The primary opponent")
        : (state[hiddenSubject] && state[hiddenSubject].text) || S.MYSTERY_SUBJECT_BY_KEY[hiddenSubject].name;
      (a.mysteries = a.mysteries || []).push({
        id: uid("mys"), subject: hiddenSubject, label: source, sourceId: null,
        clues: 0, clueLog: [], misses: 0, lastScene: a.scene || 1,
        createdAt: Date.now(), revealedAt: null, reveal: null
      });
      journal(a, "note", `Mystery opened: ${source}`, state.hidden.text);
    }
  });

  return {
    codename: state.codename.text,
    objective: state.objective.text,
    complication: state.complication.text,
    cover: state.cover.text,
    intel: state.intel.text,
    opponent: npc ? npc.name : "",
    hidden: state.hidden.rolls.length ? S.hiddenTruth(state.hidden.rolls[0]) : null
  };
}

/* ---------------------------------------------------------------- in play */

/**
 * Everything used inside a scene, in one block: the oracle, the event roller and the Meaning
 * Tables. Usable between scenes too — sometimes a question needs answering before you know
 * what the next scene is — but quietened when no scene is open, so the primary action above
 * stays the obvious next move.
 */
function appendInPlay(host, adv) {
  const open = phaseOf(adv).key === "play";
  const wrap = el("div", { class: "solo-inplay" + (open ? "" : " is-quiet") });

  if (!open) {
    wrap.appendChild(el("p", { class: "small muted", text:
      `The in-scene tools. They still work between scenes, but scene ${adv.scene} has not started yet.` }));
  }

  appendCheck(wrap, adv);
  appendFate(wrap, adv);
  appendEvents(wrap, adv);
  appendMysteries(wrap, adv);
  appendMeaning(wrap, adv);
  host.appendChild(wrap);
}

/**
 * The other half of the game, one tap away.
 *
 * Fate answers what is true; anything the character *attempts* is a Classified check, and
 * before this the player had to leave the screen to make one. The roller is the Classified
 * engine, so it is reached by dynamic import — `solo.js` still has no static dependency on
 * it (S15) — and the button is only there when a dossier is linked to roll for.
 */
function appendCheck(host, adv) {
  const linked = adv.characterId ? Store.getCharacter(adv.characterId) : null;
  if (!linked) return;
  appendHelp(host, "solo.check");
  const sec = section("Roll a check",
    "Fate says what is true. What the character tries is an ordinary Classified check, on the dossier this adventure is linked to.");
  sec.appendChild(el("div", { class: "btn-row" },
    el("button", { class: "btn", type: "button",
      onclick: () => import("./roller.js").then(m => m.openQuickRoll(linked)) }, "Roll a skill"),
    el("button", { class: "btn ghost", type: "button",
      onclick: () => import("./roller.js").then(m => m.openWeaponPicker(linked)) }, "Attack"),
    el("button", { class: "btn ghost", type: "button",
      onclick: () => import("./roller.js").then(m => m.openTakeDamage(linked)) }, "Take damage")));
  host.appendChild(sec);
}

function appendEvents(host, adv) {
  appendHelp(host, "solo.events");
  const sec = section("Random Events", "A doubles roll within the Chaos Factor fires one on its own. Roll one here when the fiction needs a push.");
  sec.appendChild(el("button", {
    class: "btn block", type: "button", onclick: () => rollRandomEvent(adv)
  }, "Roll a Random Event"));
  sec.appendChild(el("button", {
    class: "btn ghost block", style: "margin-top:6px", type: "button", onclick: () => openTopic("events")
  }, "How events work"));
  host.appendChild(sec);
}

/* ---------------------------------------------------------------- ask fate */

function appendFate(host, adv) {
  appendHelp(host, "solo.fate");
  const sec = section("Ask Fate", "A closed question the fiction cannot already answer. Skill checks stay on the Classified engine — this settles what is true, not what you manage.");

  const state = { odds: S.FATE_DEFAULT_ODDS, question: "" };

  const qInput = el("input", { type: "text", placeholder: "Is the safe already open?", oninput: e => { state.question = e.target.value; } });
  sec.appendChild(el("label", { class: "field" }, el("span", { text: "Question" }), qInput));

  sec.appendChild(el("div", { class: "field-label", text: "Odds" }));
  const oddsWrap = el("div", { class: "chip-wrap" });
  const preview = el("div", { class: "roll-formula", style: "margin-top:8px" });

  function drawOdds() {
    clear(oddsWrap);
    for (const o of S.FATE_ODDS) {
      oddsWrap.appendChild(el("button", {
        class: "chip" + (state.odds === o.key ? " on" : ""), type: "button",
        onclick: () => { state.odds = o.key; drawOdds(); }
      }, S.oddsLabel(o.key, adv.fateMode)));
    }
    clear(preview);
    if (adv.fateMode === "check") {
      const o = S.FATE_ODDS_BY_KEY[state.odds];
      preview.textContent = `2d10 ${signed(o.mod)} odds ${signed(S.chaosMod(adv.chaos))} chaos · ` +
        `Yes on ${S.FATE_CHECK.threshold}+ · Exceptional Yes ${S.FATE_CHECK.exceptionalYesFrom}+ · ` +
        `Exceptional No ${S.FATE_CHECK.exceptionalNoTo} or less`;
    } else {
      const target = S.fateTarget(state.odds, adv.chaos);
      const y = S.exceptionalYes(target);
      const n = S.exceptionalNo(target);
      preview.textContent = [
        `Yes on ${target} or under`,
        y === null ? "no Exceptional Yes at these odds" : `Exceptional Yes ${y} or under`,
        n === null ? "no Exceptional No at these odds" : `Exceptional No ${n} or over`
      ].join(" · ");
    }
  }
  drawOdds();
  sec.appendChild(oddsWrap);
  sec.appendChild(preview);

  sec.appendChild(el("button", {
    class: "btn primary block", type: "button", style: "margin-top:10px",
    onclick: () => askFate(adv, state.odds, qInput.value)
  }, "Ask"));

  sec.appendChild(el("button", {
    class: "btn ghost block", type: "button", style: "margin-top:6px",
    onclick: () => openTopic("fate")
  }, "How Fate works"));

  host.appendChild(sec);
}

export async function askFate(adv, oddsKey, question) {
  const odds = S.FATE_ODDS_BY_KEY[oddsKey] || S.FATE_ODDS_BY_KEY[S.FATE_DEFAULT_ODDS];
  const label = question && question.trim() ? question.trim() : `Fate — ${odds.name}`;

  let res;
  if (adv.fateMode === "check") {
    const a = Settings.manualDice() ? await soloD10("first d10") : die(10);
    const b = Settings.manualDice() ? await soloD10("second d10") : die(10);
    res = S.fateCheckAnswer(a, b, oddsKey, adv.chaos);
  } else {
    const roll = await soloD100("Fate d100");
    res = S.fateChartAnswer(roll, oddsKey, adv.chaos);
  }

  const body = el("div", {});
  body.appendChild(el("div", { class: "roll-result" },
    el("div", { class: "roll-d100", text: res.mechanic === "check" ? `${res.die1}+${res.die2}` : String(res.roll) }),
    el("div", { class: "roll-quality " + (res.yes ? "q1" : "q5"), text: res.answer }),
    el("div", { class: "roll-formula", text: res.mechanic === "check"
      ? `${res.die1} + ${res.die2} ${signed(res.oddsMod)} odds ${signed(res.chaosMod)} chaos = ${res.total} · ${S.oddsLabel(oddsKey, "check")} at Chaos Factor ${adv.chaos}`
      : `${S.oddsLabel(oddsKey, "chart")} at Chaos Factor ${adv.chaos} · Yes on ${res.target} or under` })
  ));

  if (res.mechanic === "chart") {
    const b = el("div", { class: "bands" });
    const seg = (name, range, hit) => el("div", { class: "band" + (hit ? " hit" : "") },
      el("span", { class: "bl", text: name }), range);
    const yesFrom = res.exYes === null ? 1 : res.exYes + 1;
    const noTo = res.exNo === null ? 100 : res.exNo - 1;
    if (res.exYes !== null) b.appendChild(seg("Exc Yes", `1-${res.exYes}`, res.key === "exceptionalYes"));
    if (res.target >= yesFrom) b.appendChild(seg("Yes", `${yesFrom}-${res.target}`, res.key === "yes"));
    if (noTo > res.target) b.appendChild(seg("No", `${res.target + 1}-${noTo}`, res.key === "no"));
    if (res.exNo !== null) b.appendChild(seg("Exc No", `${res.exNo}-100`, res.key === "exceptionalNo"));
    body.appendChild(b);
  }

  if (res.mechanic === "check") {
    const b = el("div", { class: "bands" });
    const seg = (name, range, hit) => el("div", { class: "band" + (hit ? " hit" : "") },
      el("span", { class: "bl", text: name }), range);
    b.appendChild(seg("Exc No", `≤${S.FATE_CHECK.exceptionalNoTo}`, res.key === "exceptionalNo"));
    b.appendChild(seg("No", `${S.FATE_CHECK.exceptionalNoTo + 1}-${S.FATE_CHECK.threshold - 1}`, res.key === "no"));
    b.appendChild(seg("Yes", `${S.FATE_CHECK.threshold}-${S.FATE_CHECK.exceptionalYesFrom - 1}`, res.key === "yes"));
    b.appendChild(seg("Exc Yes", `${S.FATE_CHECK.exceptionalYesFrom}+`, res.key === "exceptionalYes"));
    body.appendChild(b);
  }

  // An Exceptional answer is the oracle giving more than was asked for, which reads as a lead
  // (S20). One open mystery takes it; several are offered as a choice below. The clue is
  // marked when this dialog closes, so its own Fate question does not land on top of this one.
  const openMys = openMysteries(adv);
  const leadOn = res.exceptional && openMys.length === 1 ? openMys[0] : null;
  if (leadOn) {
    body.appendChild(el("div", { class: "banner ok" },
      el("b", { text: `A lead on: ${leadOn.label}` }),
      el("div", { class: "small", text: "Marked as a clue when you close this — then Fate says whether it breaks open." })));
  }

  if (res.exceptional) {
    body.appendChild(el("div", { class: "banner " + (res.yes ? "ok" : "warn"), text: res.yes
      ? "More than you asked for. Push the answer further than a plain Yes would go."
      : "Worse than a refusal. The answer is No, and something about the situation is worse than you thought." }));
  }

  const eventSlot = el("div", {});
  body.appendChild(eventSlot);
  if (res.event) {
    eventSlot.appendChild(el("div", { class: "banner warn" },
      el("b", { text: "Random Event" }),
      el("div", { class: "small", text: res.mechanic === "check"
        ? `Double ${res.die1}s, within the Chaos Factor, so an event fires as well as the answer.`
        : "A double at or under the Chaos Factor, so an event fires as well as the answer." })));
  }

  // A doubles roll inside the Chaos Factor fires an event as well as the answer. That is not
  // optional, so it becomes the only way out of this dialog.
  const actions = res.event
    ? [{ label: "Roll the event", kind: "primary", close: false,
         onClick: api => { api.close(); rollRandomEvent(Store.activeAdventure()); } }]
    : [{ label: "Done", kind: "primary" }];
  if (res.exceptional && openMys.length > 1) {
    actions.unshift({
      label: "Mark a clue", kind: "ghost", close: false,
      onClick: () => pickMysteryToTick("exceptional")
    });
  }

  save(a => {
    journal(a, "fate", `${label} — ${res.answer}`,
      res.mechanic === "check"
        ? `Fate Check ${res.die1}+${res.die2} ${signed(res.oddsMod)}/${signed(res.chaosMod)} = ${res.total}, ${odds.name}, CF ${a.chaos}`
        : `Fate Chart ${res.roll} vs ${res.target}, ${odds.name}, CF ${a.chaos}`);
  });
  logSolo(adv, label, res.mechanic === "check" ? res.total : res.roll, res.answer,
    `${odds.name} · Chaos Factor ${adv.chaos}` + (res.event ? " · Random Event" : ""));

  const m = modal({ title: "Fate", body, actions, locked: !!res.event,
    onClose: () => { if (leadOn) tickMystery(leadOn.id, "exceptional"); } });
  return m;
}

/* ---------------------------------------------------------------- scenes */

/**
 * Start a scene, the whole boundary in one flow: say what you expect, test it against the
 * Chaos Factor, and chain straight into whatever the test says happens instead. The scene is
 * only marked as in play once that has resolved, so the screen never claims a scene is
 * running before it is.
 */
export async function startScene(adv, opts = {}) {
  let expected = typeof opts.expected === "string" ? opts.expected.trim() : null;

  // The guided player has already asked what you are about to do, so it hands the answer in
  // rather than making the same question appear twice in a row.
  if (expected === null) {
    const input = el("input", { type: "text", placeholder: "The safe house, to warn the courier" });
    const body = el("div", {},
      el("label", { class: "field" },
        el("span", { text: `What do you expect scene ${adv.scene} to be?` }), input),
      el("p", { class: "small muted", text:
        `A d10 over ${adv.chaos} plays it as you expect. At or under, an odd roll alters the scene and an even roll interrupts it with a Random Event.` }));

    const go = await confirmModal(body, { title: `Start scene ${adv.scene}`, okLabel: "Test the scene" });
    if (!go) return;
    expected = input.value.trim();
  }
  const roll = await soloD10("scene test d10");
  const res = S.sceneTest(roll, adv.chaos);

  // The test result is recorded straight away — the dice were rolled — but the scene is NOT
  // marked in play yet. An altered or interrupted scene owes a further roll first, and the
  // screen must not claim a scene is running until that has resolved.
  Store.pushSoloUndo(Store.soloSnapshot());
  save(a => {
    a.sceneKind = res.key;
    a.sceneExpected = expected;
    journal(a, "scene", `Scene ${a.scene} — ${res.name}` + (expected ? `: ${expected}` : ""),
      `d10 ${roll} vs Chaos Factor ${res.chaos}`);
  });
  logSolo(adv, `Scene ${adv.scene} test`, roll, res.name, `d10 against Chaos Factor ${res.chaos}`);

  const out = el("div", {});
  out.appendChild(el("div", { class: "roll-result" },
    el("div", { class: "roll-d100", text: String(roll) }),
    el("div", { class: "roll-quality " + (res.key === "expected" ? "q1" : res.key === "altered" ? "q3" : "q5"), text: res.name }),
    el("div", { class: "roll-formula", text: `d10 ${roll} against Chaos Factor ${res.chaos}` })));
  out.appendChild(el("p", { text: res.desc }));
  if (expected) {
    out.appendChild(el("p", { class: "small muted" },
      el("b", { text: res.key === "interrupt" ? "You had planned: " : "Your scene: " }), expected));
  }

  // One forced next step, never a choice between finishing the sequence and walking away.
  // An expected scene is already complete, so its single action commits it to play. An
  // altered or interrupted scene owes a roll, and that roll's dialog carries the commit.
  if (res.key === "expected") {
    modal({
      title: `Scene ${adv.scene}`, body: out, locked: true,
      actions: [{ label: `Play scene ${adv.scene}`, kind: "primary", onClick: () => commitScenePlay() }]
    });
    return;
  }

  const step = res.key === "altered"
    ? { label: "Roll the adjustment", run: () => rollSceneAdjustment(Store.activeAdventure(), { chain: true }) }
    : { label: "Roll the interrupt", run: () => rollRandomEvent(Store.activeAdventure(), { chain: true, interruptedBy: expected }) };

  modal({
    title: `Scene ${adv.scene}`, body: out, locked: true,
    actions: [{ label: step.label, kind: "primary", close: false, onClick: api => { api.close(); step.run(); } }]
  });
}

/**
 * Flip the adventure into play. Called only at the end of the Start-scene chain, so the
 * scene card and the primary action never disagree with what has actually been rolled.
 * `sceneExpected` is overwritten when an interrupt replaced what was planned.
 */
function commitScenePlay(replacementScene) {
  save(a => {
    a.scenePhase = "play";
    if (replacementScene) a.sceneExpected = replacementScene;
  });
}

/** The action that closes the last dialog of a Start-scene chain. */
function playSceneAction(replacementScene) {
  const adv = Store.activeAdventure();
  return { label: `Play scene ${adv ? adv.scene : ""}`.trim(), kind: "primary",
    onClick: () => commitScenePlay(replacementScene) };
}

/**
 * Roll the Scene Adjustment table for an altered scene.
 * @param {object} opts chain — this is a step of the Start-scene sequence, so the dialog is
 *   locked and its single action commits the scene to play.
 */
export async function rollSceneAdjustment(adv, opts = {}) {
  const rolls = [];
  const resolved = [];
  let pending = 1;
  let guard = 0;

  while (pending > 0 && guard < 12) {
    guard += 1;
    pending -= 1;
    const roll = await soloD10(`Scene Adjustment d10 (${rolls.length + 1})`);
    const row = S.sceneAdjustment(roll);
    rolls.push({ roll, name: row.name });
    if (row.double) pending += S.SCENE_ADJUSTMENT_DOUBLE_COUNT;
    else resolved.push(row);
  }

  const body = el("div", {});
  for (const row of resolved) {
    body.appendChild(el("div", { class: "banner" },
      el("b", { text: row.name }),
      el("div", { class: "small", text: row.desc })));
  }
  body.appendChild(el("p", { class: "small muted", text:
    `Rolled ${rolls.map(r => r.roll).join(", ")}. ` +
    (resolved.length > 1
      ? `Make all ${resolved.length} changes and play the scene.`
      : "Change that one thing and play the scene.") }));
  if (rolls.some(r => r.name === "Make 2 Adjustments")) {
    body.appendChild(el("p", { class: "small muted", text:
      "A 7-10 is not itself an adjustment — it sends you back to the table twice, which is why there is more than one result here." }));
  }

  const names = resolved.map(r => r.name).join(" + ");
  save(a => { journal(a, "scene", `Scene adjustment — ${names}`, `d10 ${rolls.map(r => r.roll).join("/")}`); });
  logSolo(adv, "Scene adjustment", rolls[0].roll, names, resolved.map(r => r.desc).join(" "));

  modal({
    title: "Altered scene", body, locked: !!opts.chain,
    actions: [opts.chain ? playSceneAction() : { label: "Done", kind: "primary" }]
  });
}

/* ---------------------------------------------------------------- random events */

/**
 * Roll a Random Event.
 * @param {object} opts
 *   tableKey     — force the Meaning Table the words come from (used by "Re-roll the words")
 *   focusRoll    — force the Event Focus roll (used by the interrupt flow and the harness)
 *   interruptedBy — the scene this event displaced. The event becomes the scene and the
 *                   displaced plan is filed to Threads automatically, because in Mythic it
 *                   is exactly the sort of thing that comes back later.
 *   chain        — a step of the Start-scene sequence: locked dialog, commit action
 *   supersedes   — { journalId, rollId } from the roll this one replaces (re-roll)
 */
export async function rollRandomEvent(adv, opts = {}) {
  const focusRoll = opts.focusRoll || await soloD100("Event Focus d100");
  const focus = S.eventFocus(focusRoll);

  const tableKey = opts.tableKey || S.EVENT_MEANING_BY_FOCUS[focus.key] || S.EVENT_MEANING_DEFAULT;
  const pair = await rollPair(tableKey);

  // Focuses that name a thread or a character draw from the Adventure Lists.
  let subject = null;
  let subjectRoll = null;
  let drawn = null;
  if (focus.list) {
    subjectRoll = await soloD100(`${focus.list === "threads" ? "Threads" : "Characters"} list d100`);
    drawn = drawFromList(adv, focus.list, subjectRoll, { withItem: true });
    subject = drawn.text;
  } else if (focus.pc) {
    const linked = adv.characterId ? Store.getCharacter(adv.characterId) : null;
    subject = linked ? (linked.identity.name || "the character") : "the character";
  }

  const body = el("div", {});
  body.appendChild(el("div", { class: "banner" },
    el("b", { text: focus.name }),
    el("div", { class: "small", text: focus.desc }),
    el("div", { class: "small muted", text: `Event Focus d100 ${focusRoll}` })));

  if (subject) {
    body.appendChild(el("div", { class: "banner ok" },
      el("b", { text: subject }),
      subjectRoll ? el("div", { class: "small muted", text: `${focus.list} list, d100 ${subjectRoll} → slot ${S.listSlot(subjectRoll)}` }) : null));
  }

  body.appendChild(el("div", { class: "roll-result" },
    el("div", { class: "roll-quality", style: "font-size:19px", text: pair.words.join(" · ") }),
    el("div", { class: "roll-formula", text: `${pair.label} · rolled ${pair.rolls.join(" and ")}` })));

  if (pair.doubled) {
    body.appendChild(el("div", { class: "banner warn", text: S.DOUBLES_NOTE }));
  }

  body.appendChild(el("p", { class: "small muted", text:
    "Read it loosely and quickly. The words are a prompt, not a puzzle with one answer." }));

  const detail = [focus.name, subject, pair.words.join(" ")].filter(Boolean).join(" — ");

  // A re-roll replaces what it supersedes rather than stacking beside it, so the journal and
  // the roll log show the reading that was actually kept.
  if (opts.supersedes) {
    save(a => unjournal(a, opts.supersedes.journalId));
    Store.removeRoll(opts.supersedes.rollId);
  }

  let journalId = null;
  save(a => { journalId = journal(a, "event", `Random Event: ${detail}`, `focus ${focusRoll} · ${pair.label} ${pair.rolls.join("/")}`); });
  const rollId = logSolo(adv, "Random Event", focusRoll, focus.name, detail);

  // An interrupt displaces the scene that was planned. File it as a thread now rather than
  // leaving a button the player can forget, and note it in the dialog.
  if (opts.interruptedBy) {
    const room = (adv.threads || []).length < S.LIST_SLOTS;
    if (room) {
      save(a => {
        (a.threads = a.threads || []).push({ id: uid("li"), text: opts.interruptedBy, weight: 1 });
        journal(a, "note", `Displaced by the interrupt, kept as a thread: ${opts.interruptedBy}`);
      });
    }
    body.appendChild(el("div", { class: "banner" + (room ? "" : " warn") },
      el("b", { text: room ? "Your planned scene is now a thread" : "Threads list is full" }),
      el("div", { class: "small", text: room
        ? `"${opts.interruptedBy}" was displaced by this event and has been added to Threads.`
        : `"${opts.interruptedBy}" was displaced but the Threads list is at ${S.LIST_SLOTS} entries, so it was not filed.` })));
  }

  // Clues the event turned up. They are marked once this dialog is done with, so the
  // mystery's own Fate question never lands on top of the event.
  const pendingTicks = [];

  // The event usually tells you to change a list. Offer that here rather than making the
  // player leave the flow and remember to do it.
  const actions = [opts.chain
    ? playSceneAction(`${focus.name} — ${pair.words.join(" · ")}`)
    : { label: "Done", kind: "primary" }];
  actions.unshift({
    label: "Re-roll the words", kind: "ghost", close: false,
    onClick: api => {
      api.close();
      // interruptedBy is dropped: the displaced scene was filed on the first roll and must
      // not be filed again just because the words were re-read.
      rollRandomEvent(Store.activeAdventure(), {
        ...opts, interruptedBy: null, tableKey, focusRoll, supersedes: { journalId, rollId }
      });
    }
  });

  if (focus.key === "newnpc") {
    actions.unshift({
      label: "Add to Characters", kind: "ghost", close: false,
      onClick: () => addToList("characters", "Characters", pair.words.join(" "))
    });
  }
  // An event pointing at the mystery's own thread is the kind of clue the clock exists for,
  // so it ticks itself rather than waiting to be noticed.
  if (drawn && drawn.item && focus.list === "threads") {
    const mys = (adv.mysteries || []).find(m => !m.revealedAt && m.sourceId === drawn.item.id);
    if (mys) {
      body.appendChild(el("div", { class: "banner ok" },
        el("b", { text: `A lead on: ${mys.label}` }),
        el("div", { class: "small", text: "Marked as a clue — the question is asked when this dialog closes." })));
      pendingTicks.push({ id: mys.id, source: "event" });
    }
  }

  if (focus.key === "threadclose" && drawn && drawn.item) {
    actions.unshift({
      label: "Strike that thread off", kind: "ghost", close: false,
      onClick: () => {
        save(a => {
          a.threads = a.threads.filter(t => t.id !== drawn.item.id);
          journal(a, "note", `Closed: ${drawn.item.text}`);
        });
        showToast("Thread closed", "ok");
      }
    });
  }
  if ((focus.key === "threadtoward" || focus.key === "threadaway") && (!adv.threads || !adv.threads.length)) {
    actions.unshift({
      label: "Add a thread", kind: "ghost", close: false,
      onClick: () => addToList("threads", "Threads", pair.words.join(" "))
    });
  }
  modal({ title: "Random Event", body, actions, locked: !!opts.chain,
    onClose: () => { for (const t of pendingTicks) tickMystery(t.id, t.source); } });
}

/** Add to an Adventure List, letting the player edit the suggested wording first. */
async function addToList(which, title, suggested) {
  const text = await promptModal(which === "threads" ? "The thread to track" : "Who is it?", {
    title: "Add to " + title, value: suggested || ""
  });
  if (!text || !text.trim()) return;
  const adv = Store.activeAdventure();
  if ((adv[which] || []).length >= S.LIST_SLOTS) { showToast(`The list holds ${S.LIST_SLOTS} entries`, "err"); return; }
  save(a => {
    (a[which] = a[which] || []).push({ id: uid("li"), text: text.trim(), weight: 1 });
    journal(a, "note", `Added to ${which}: ${text.trim()}`);
  });
  showToast("Added to " + title, "ok");
}

/**
 * Draw an entry from an Adventure List by d100 across its 25 slots. With `withItem` the row
 * itself comes back too, so an event that closes a thread can strike off the one it drew.
 */
function drawFromList(adv, which, roll, { withItem = false } = {}) {
  const slot = S.listSlot(roll);
  const list = adv[which] || [];
  const expanded = [];
  for (const item of list) {
    const weight = Math.max(1, Number(item.weight) || 1);
    for (let i = 0; i < weight; i++) expanded.push(item);
  }
  if (!expanded.length) {
    const text = which === "threads"
      ? "Empty slot — invent a thread and add it to the list"
      : "Empty slot — invent a character and add them to the list";
    return withItem ? { text, item: null } : text;
  }
  const item = expanded[(slot - 1) % expanded.length];
  return withItem ? { text: item.text, item } : item.text;
}

/* ---------------------------------------------------------------- meaning tables */

/** A single word off one table. The pair is the default idiom; this is for the exceptions. */
async function rollOne(tableKey) {
  const table = S.MEANING_BY_KEY[tableKey];
  const r = await soloD100(`${table.name} d100`);
  return { word: table.words[r - 1], roll: r, label: table.name, tableKey };
}

async function rollPair(tableKey) {
  const table = S.MEANING_BY_KEY[tableKey];
  const second = table.pairWith ? S.MEANING_BY_KEY[table.pairWith] : table;
  const r1 = await soloD100(`${table.name} d100`);
  const r2 = await soloD100(`${second.name} d100`);
  const w1 = table.words[r1 - 1];
  const w2 = second.words[r2 - 1];
  return {
    label: table.pairWith ? `${table.name} + ${second.name}` : `${table.name} ×2`,
    words: [w1, w2], rolls: [r1, r2], doubled: w1 === w2, tableKey
  };
}

/* ---------------------------------------------------------------- mysteries (house aid) */

/**
 * Mystery clocks. Not a Mythic procedure and not a Classified one — see ruling S20; the panel
 * says so itself, the way End Scene does on the Combat screen.
 */
function appendMysteries(host, adv) {
  appendHelp(host, "solo.mysteries");
  const list = adv.mysteries || [];
  const open = list.filter(m => !m.revealedAt);
  const done = list.filter(m => m.revealedAt);

  const sec = section("Mysteries", "A question you do not know the answer to yet. Fill the clock as play turns it up; the answer is rolled when the last segment falls.");

  sec.querySelector(".section-head").appendChild(el("button", {
    class: "btn sm primary", type: "button", onclick: () => newMystery(adv)
  }, "+ New"));

  if (!list.length) {
    sec.appendChild(el("div", { class: "empty" },
      el("p", { class: "muted", text: "Nothing open. Start one on the objective, the complication, the opponent or a thread." })));
    sec.appendChild(el("p", { class: "small muted", text: S.MYSTERY_NOTE }));
    host.appendChild(sec);
    return;
  }

  for (const m of open) sec.appendChild(mysteryCard(adv, m));
  for (const m of done) sec.appendChild(mysteryCard(adv, m));
  sec.appendChild(el("p", { class: "small muted", style: "margin-top:8px", text: S.MYSTERY_NOTE }));
  host.appendChild(sec);
}

function mysteryCard(adv, m) {
  const subject = S.MYSTERY_SUBJECT_BY_KEY[m.subject] || S.MYSTERY_SUBJECT_BY_KEY.thread;
  const card = el("div", { class: "card" });

  const oddsKey = S.mysteryOdds(m.clues);
  card.appendChild(el("div", { class: "row" },
    // The label is the control that rewords it: a mystery opened on a rolled thread carries
    // that thread's word pair until you write what the question actually is (ruling S22).
    el("button", {
      class: "row-edit grow", type: "button", "aria-label": `Reword ${m.label}`,
      onclick: async () => {
        const text = await promptModal("What is the question?", { title: "Reword this mystery", value: m.label });
        if (text === null || !text.trim()) return;
        save(a => { const x = a.mysteries.find(y => y.id === m.id); if (x) x.label = text.trim(); });
      }
    },
      el("div", { style: "font-weight:600", text: m.label }),
      el("div", { class: "small muted", text: subject.name })),
    m.revealedAt
      ? el("span", { class: "pill q1", text: "Revealed" })
      : el("span", { class: "mono small", text: `${m.clues} clue${m.clues === 1 ? "" : "s"}` })));

  if (!m.revealedAt) {
    card.appendChild(el("p", { class: "small muted", style: "margin-top:4px", text: oddsKey
      ? `Next clue asks Fate at ${S.oddsLabel(oddsKey, adv.fateMode)} — it can break open on any of them, or hold.`
      : "No clues yet. The first one starts the odds at their longest." }));

    if (m.clueLog && m.clueLog.length) card.appendChild(clueList(m));

    const row = el("div", { class: "btn-row", style: "margin-top:6px" });
    row.appendChild(el("button", {
      class: "btn sm primary", type: "button", onclick: () => addClue(m.id)
    }, "+ Clue"));
    row.appendChild(el("button", {
      class: "btn sm ghost", type: "button",
      disabled: m.clues <= 0,
      onclick: () => save(a => {
        const x = a.mysteries.find(y => y.id === m.id);
        if (x) x.clues = Math.max(0, x.clues - 1);
      })
    }, "− Clue"));
    row.appendChild(el("button", {
      class: "btn sm ghost", type: "button",
      onclick: async () => {
        if (await confirmModal(`Drop “${m.label}”? The clues and anything rolled on it go with it.`,
          { title: "Drop this mystery", danger: true, okLabel: "Drop it" })) {
          save(a => { a.mysteries = a.mysteries.filter(y => y.id !== m.id); });
        }
      }
    }, "Drop"));
    card.appendChild(row);
  } else {
    if (m.clueLog && m.clueLog.length) card.appendChild(clueList(m));
    card.appendChild(el("div", { class: "banner", style: "margin-top:6px" },
      el("b", { text: m.reveal.shapeName }),
      el("div", { class: "small", text: m.reveal.shapeDesc }),
      m.reveal.implicated ? el("div", { class: "small", text: `It runs through ${m.reveal.implicated}.` }) : null,
      m.reveal.tell ? el("div", { class: "small", text: `Tell: ${m.reveal.tell.name} — ${m.reveal.tell.desc}` }) : null,
      m.reveal.words.length
        ? el("div", { class: "roll-formula", style: "text-align:left", text: m.reveal.words.join(" · ") })
        : null,
      m.reveal.exceptional
        ? el("div", { class: "small muted", text: "It broke wide open — the extra words came with it." })
        : null));
    card.appendChild(el("div", { class: "btn-row", style: "margin-top:6px" },
      el("button", {
        class: "btn sm", type: "button",
        onclick: () => addToList("threads", "Threads", m.reveal.words.join(" "))
      }, "+ Thread from this"),
      el("button", {
        class: "btn sm ghost", type: "button",
        onclick: () => save(a => { a.mysteries = a.mysteries.filter(y => y.id !== m.id); })
      }, "Clear")));
  }
  return card;
}

/**
 * The clues themselves, newest last, each removable. The count sets the odds; these lines are
 * what the reveal gets read against, which is the whole reason a clue is worth writing down.
 */
function clueList(m) {
  const card = el("div", { class: "card flush", style: "margin-top:6px" });
  for (const c of m.clueLog) {
    card.appendChild(el("div", { class: "card-row" },
      el("div", { class: "grow" },
        el("div", { class: "small", text: c.text || "A clue, unwritten" }),
        el("div", { class: "lm", text: (S.MYSTERY_TICKS.find(x => x.key === c.source) || {}).name || "A clue you mark" })),
      m.revealedAt ? null : el("button", {
        class: "btn sm ghost", type: "button", "aria-label": `Remove the clue ${c.text}`,
        onclick: () => save(a => {
          const x = a.mysteries.find(y => y.id === m.id);
          if (!x) return;
          x.clueLog = x.clueLog.filter(y => y.id !== c.id);
          x.clues = Math.max(0, x.clues - 1);
        })
      }, "✕")));
  }
  return card;
}

/** Mark a clue, writing down what it was first. The line is optional; the tick is not. */
async function addClue(id) {
  const text = await promptModal(S.MYSTERY_CLUE_PROMPT, {
    title: "Mark a clue", placeholder: "The manifest is countersigned twice", okLabel: "Mark it"
  });
  if (text === null) return;
  return tickMystery(id, "clue", text.trim());
}

/** Start a mystery on a briefing row or a thread. */
async function newMystery(adv) {
  const items = [];
  const b = adv.briefing ? adv.briefing.rows : null;
  for (const key of ["objective", "complication", "intel"]) {
    const row = b && b[key];
    if (row && row.text) {
      items.push({ key: "row:" + key, label: S.MYSTERY_SUBJECT_BY_KEY[key].name, desc: row.text });
    }
  }
  if (adv.briefing && adv.briefing.npc) {
    items.push({ key: "row:opponent", label: "The primary opponent", desc: adv.briefing.npc.alias || adv.briefing.npc.name });
  }
  for (const t of adv.threads || []) items.push({ key: "thread:" + t.id, label: t.text, desc: "A thread" });
  items.push({ key: "custom", label: "Something else", desc: "Type the question yourself." });

  const pick = await chooseModal("What is the mystery about?", items, {
    intro: "A house aid: a clock that fills as play turns the question up, and an answer rolled when it fills."
  });
  if (!pick) return;

  let subject = "thread";
  let label = "";
  let sourceId = null;
  if (pick.startsWith("row:")) {
    subject = pick.slice(4);
    const row = subject === "opponent"
      ? (adv.briefing.npc.alias || adv.briefing.npc.name)
      : adv.briefing.rows[subject].text;
    label = row;
  } else if (pick.startsWith("thread:")) {
    sourceId = pick.slice(7);
    const t = (adv.threads || []).find(x => x.id === sourceId);
    label = t ? t.text : "A thread";
  } else {
    const typed = await promptModal("What is the question?", { title: "New mystery", placeholder: "Who is feeding the opposition our timetable?" });
    if (!typed || !typed.trim()) return;
    label = typed.trim();
  }

  openMystery({ subject, label, sourceId });
}

/**
 * Fill one segment. Returns the mystery as it stands after the tick, or null if there was
 * nothing to tick — the automatic sources use that to stay quiet.
 */
export function openMystery({ subject, label, sourceId = null, silent = false }) {
  const id = uid("mys");
  save(a => {
    (a.mysteries = a.mysteries || []).push({
      id, subject, label, sourceId, clues: 0, clueLog: [], misses: 0,
      // Opened in this scene, so it is not counted stale until several have passed.
      lastScene: a.scene || 1,
      createdAt: Date.now(), revealedAt: null, reveal: null
    });
    journal(a, "note", `Mystery opened: ${label}`, (S.MYSTERY_SUBJECT_BY_KEY[subject] || {}).name || "");
  });
  if (!silent) showToast("Mystery opened", "ok");
  return id;
}

/**
 * Mark a clue, then ask whether this is the moment.
 *
 * Clues do not count down to anything: they set the odds, and the Fate Chart decides. That is
 * the whole point of the redesign — a visible clock told the player which clue would break the
 * mystery open, which is a countdown rather than a mystery.
 *
 * The question is rolled by the app rather than asked by the player, so it does not fire the
 * doubles Random Event a Fate question would: End Scene can tick several mysteries in one
 * commit, and chaining events out of that would bury the boundary (ruling S21).
 */
export async function tickMystery(id, source = "clue", note = "") {
  const adv = Store.activeAdventure();
  if (!adv) return null;
  const before = (adv.mysteries || []).find(m => m.id === id);
  if (!before || before.revealedAt) return null;

  const reason = (S.MYSTERY_TICKS.find(x => x.key === source) || S.MYSTERY_TICKS[0]).name;
  save(a => {
    const m = a.mysteries.find(x => x.id === id);
    m.clues = Math.min(S.MYSTERY_MAX_CLUES, m.clues + 1);
    (m.clueLog = m.clueLog || []).push({ id: uid("clue"), ts: Date.now(), text: note || "", source });
    m.lastScene = a.scene || 1;
    journal(a, "note", `Clue: ${m.label} (${m.clues})`, note || reason);
  });

  return testMystery(id);
}

/** Ask the chart whether the mystery breaks open now, at the odds its clues have earned. */
export async function testMystery(id) {
  const adv = Store.activeAdventure();
  const m = (adv.mysteries || []).find(x => x.id === id);
  if (!m || m.revealedAt) return null;

  const oddsKey = S.mysteryOdds(m.clues);
  if (!oddsKey) return m;

  let res;
  if (adv.fateMode === "check") {
    const a = Settings.manualDice() ? await soloD10("first d10") : die(10);
    const b = Settings.manualDice() ? await soloD10("second d10") : die(10);
    res = S.fateCheckAnswer(a, b, oddsKey, adv.chaos);
  } else {
    const roll = await soloD100(`${m.label} — ${S.MYSTERY_QUESTION}`);
    res = S.fateChartAnswer(roll, oddsKey, adv.chaos);
  }

  const outcome = S.MYSTERY_ANSWERS[res.key];
  logSolo(adv, `${m.label} — ${S.MYSTERY_QUESTION}`,
    res.mechanic === "check" ? res.total : res.roll, outcome,
    `${S.oddsLabel(oddsKey, adv.fateMode)} on ${m.clues} clue${m.clues === 1 ? "" : "s"} · Chaos Factor ${adv.chaos}`);

  if (res.yes) {
    save(a => {
      const x = a.mysteries.find(y => y.id === id);
      x.misses = 0;
      journal(a, "event", `${m.label} — ${outcome}`, `${S.oddsLabel(oddsKey, adv.fateMode)} on ${m.clues} clues`);
    });
    await revealMystery(Store.activeAdventure(), id, { exceptional: res.key === "exceptionalYes" });
    return Store.activeAdventure().mysteries.find(x => x.id === id);
  }

  // An Exceptional No is a lead going cold: it costs the clue that raised it.
  if (res.key === "exceptionalNo") {
    save(a => {
      const x = a.mysteries.find(y => y.id === id);
      x.clues = Math.max(0, x.clues - 1);
      if (x.clueLog && x.clueLog.length) x.clueLog.pop();
      x.misses = 0;
      journal(a, "note", `${x.label} — the lead goes cold`, `back to ${x.clues} clue${x.clues === 1 ? "" : "s"}`);
    });
    showToast(`${m.label}: the lead goes cold`, "err");
    return Store.activeAdventure().mysteries.find(x => x.id === id);
  }

  // A plain No twice running is not silence, it is a pattern: the trail was laid for you.
  const misses = (m.misses || 0) + 1;
  save(a => { const x = a.mysteries.find(y => y.id === id); x.misses = misses; });
  if (misses >= S.MYSTERY_FALSE_LEAD.after) {
    await falseLead(id);
  } else {
    showToast(`${m.label}: not yet — ${m.clues} clue${m.clues === 1 ? "" : "s"}`, "");
  }
  return Store.activeAdventure().mysteries.find(x => x.id === id);
}

/**
 * The second refusal in a row. Rather than another quiet toast, the app says what two dead
 * askings mean and rolls the misdirection, so a run of No answers produces fiction instead of
 * nothing. The counter resets: the next refusal starts the pattern again.
 */
async function falseLead(id) {
  const adv = Store.activeAdventure();
  const m = (adv.mysteries || []).find(x => x.id === id);
  if (!m) return;
  const lead = S.MYSTERY_FALSE_LEAD;
  const pair = await rollPair(lead.table);

  save(a => {
    const x = a.mysteries.find(y => y.id === id);
    x.misses = 0;
    journal(a, "event", `${x.label} — ${lead.name}`, pair.words.join(" · "));
  });
  logSolo(adv, `${m.label} — ${lead.name}`, pair.rolls[0], lead.name, pair.words.join(" · "));

  modal({
    title: lead.name,
    body: el("div", {},
      el("div", { class: "banner warn" },
        el("b", { text: m.label }),
        el("div", { class: "small", text: lead.desc })),
      el("div", { class: "roll-result" },
        el("div", { class: "roll-quality", style: "font-size:20px", text: pair.words.join(" · ") }),
        el("div", { class: "roll-formula", text: `${pair.label} · rolled ${pair.rolls.join(" and ")}` })),
      el("p", { class: "small muted", text:
        "Read the words as who laid it and why. The clues you have still stand — they were just pointing where someone wanted." }),
      el("p", { class: "lm", text: "The count starts again from here." })),
    actions: [
      { label: "+ Thread from this", kind: "ghost", close: false,
        onClick: () => addToList("threads", "Threads", pair.words.join(" ")) },
      { label: "Done", kind: "primary" }
    ]
  });
}

/** Ask which open mystery a clue belongs to, when the app cannot tell. */
async function pickMysteryToTick(source) {
  const adv = Store.activeAdventure();
  const open = openMysteries(adv);
  if (!open.length) { showToast("No mystery is open", "err"); return; }
  if (open.length === 1) { tickMystery(open[0].id, source); return; }
  const pick = await chooseModal("Which mystery does this bear on?", open.map(m => ({
    key: m.id, label: m.label, right: `${m.clues} clue${m.clues === 1 ? "" : "s"}`,
    desc: (S.MYSTERY_SUBJECT_BY_KEY[m.subject] || {}).name || ""
  })));
  if (pick) tickMystery(pick, source);
}

/** Any mystery still open, for the automatic tick sources. */
function openMysteries(adv) {
  return (adv.mysteries || []).filter(m => !m.revealedAt);
}

/**
 * The reveal: a shape off the authored table, then a word pair from the table that fits the
 * subject. Nothing was decided in advance, which is the point — the answer cannot contradict
 * what has already been played.
 */
export async function revealMystery(adv, id, opts = {}) {
  const m = (adv.mysteries || []).find(x => x.id === id);
  if (!m) return;
  const subject = S.MYSTERY_SUBJECT_BY_KEY[m.subject] || S.MYSTERY_SUBJECT_BY_KEY.thread;

  const shapeRoll = await soloD100("Reveal d100");
  const shape = S.revealShape(shapeRoll);
  const pair = await rollPair(subject.table);
  // An Exceptional Yes brings more than the truth: a second pair comes with it.
  const extra = opts.exceptional ? await rollPair(subject.table) : null;
  const words = extra ? [...pair.words, ...extra.words] : pair.words;

  // A shape that names a person should land on someone already in play. The Characters list
  // is where those people are, so it is drawn from rather than left to the player to supply.
  let implicated = "";
  let implicatedRoll = null;
  if (shape.implicates && (adv.characters || []).length) {
    implicatedRoll = await soloD100("Characters d100");
    implicated = drawFromList(adv, "characters", implicatedRoll);
  }

  // A reveal on the opponent changes how they play, not only what they are.
  const tell = m.subject === "opponent" && adv.briefing && adv.briefing.npc
    ? await rollOpponentTell(adv.briefing.npc)
    : null;

  save(a => {
    const x = a.mysteries.find(y => y.id === id);
    x.revealedAt = Date.now();
    x.reveal = {
      shapeKey: shape.key, shapeName: shape.name, shapeDesc: shape.desc,
      words, rolls: [shapeRoll, ...pair.rolls, ...(extra ? extra.rolls : []), ...(implicatedRoll ? [implicatedRoll] : [])],
      exceptional: !!opts.exceptional,
      implicated, tell: tell ? { kind: tell.kind, name: tell.name, desc: tell.desc } : null
    };
    if (tell) tell.apply(a);
    journal(a, "event", `Revealed: ${x.label} — ${shape.name}`,
      [`d100 ${shapeRoll}`, pair.label, words.join(" "), implicated && `runs through ${implicated}`, tell && tell.name]
        .filter(Boolean).join(" · "));
  });
  logSolo(adv, `Mystery revealed — ${m.label}`, shapeRoll, shape.name, `${words.join(" · ")} · ${subject.name}`);

  const body = el("div", {});
  body.appendChild(el("div", { class: "banner" },
    el("b", { text: shape.name }),
    el("div", { class: "small", text: shape.desc }),
    el("div", { class: "small muted", text: `Reveal d100 ${shapeRoll}` })));
  body.appendChild(el("div", { class: "roll-result" },
    el("div", { class: "roll-quality", style: "font-size:20px", text: words.join(" · ") }),
    el("div", { class: "roll-formula", text: extra
      ? `${pair.label}, twice over — it broke wide open`
      : `${pair.label} · rolled ${pair.rolls.join(" and ")}` })));
  if (implicated) {
    body.appendChild(el("div", { class: "banner warn", style: "margin-top:8px" },
      el("b", { text: "It runs through " + implicated }),
      el("div", { class: "small", text: `Drawn from your Characters list on a d100 of ${implicatedRoll}.` })));
  }
  if (tell) {
    body.appendChild(el("div", { class: "banner", style: "margin-top:8px" },
      el("b", { text: "Tell: " + tell.name }),
      el("div", { class: "small", text: tell.desc }),
      el("div", { class: "lm", text: "Added to the opponent's stat block — open Opponent on the briefing to see it." })));
  }
  // The clues are what the shape and the words have to answer. Read against nothing, a reveal
  // is just two more words.
  if (m.clueLog && m.clueLog.length) {
    const written = m.clueLog.filter(c => c.text);
    if (written.length) {
      body.appendChild(el("div", { style: "margin-top:10px" },
        el("div", { class: "field-label", text: "Read it against what you found" }),
        ...written.map(c => el("p", { class: "small", text: "• " + c.text }))));
    }
  }
  body.appendChild(el("p", { class: "small muted", text:
    "Read the shape and the words together, and say what is true. It was not written down before now." }));

  const actions = [{ label: "Done", kind: "primary" }];
  actions.unshift({
    label: "+ Thread from this", kind: "ghost", close: false,
    onClick: () => addToList("threads", "Threads", words.join(" "))
  });

  // A mystery on the objective can rewrite what the mission is for — the one reveal that
  // changes the briefing rather than adding to it.
  if (subject.rewrites && adv.briefing && adv.briefing.rows.objective) {
    body.appendChild(el("p", { class: "small", style: "margin-top:8px" },
      el("b", { text: "The objective stands as: " }), adv.briefing.rows.objective.text));
    actions.unshift({
      label: "Rewrite the objective", kind: "ghost", close: false,
      onClick: () => rewriteObjective(shape, pair)
    });
  }

  modal({ title: "Mystery revealed", body, actions });
}

/**
 * The tell a reveal on the primary opponent hands you: half the time a Weakness off
 * Classified's own list, half the time an Interaction Modifier. Returns the description plus
 * the mutation to run inside the same save, so the stat block and the reveal never disagree.
 *
 * The Weakness list is Classified's, so it arrives by dynamic import — `solo.js` still has no
 * static dependency on the rules engine (ruling S15).
 */
async function rollOpponentTell(npc) {
  const cfg = S.MYSTERY_TELL;
  const weaknessSide = await soloD100("Tell d100") <= 50;

  if (weaknessSide) {
    const { rollWeakness } = await import("./combat.js");
    const w = rollWeakness(npc.weaknesses || []);
    return {
      kind: "weakness", name: w.name, desc: w.desc,
      apply: a => {
        const n = a.briefing.npc;
        n.weaknesses = Array.isArray(n.weaknesses) ? n.weaknesses : [];
        if (!n.weaknesses.includes(w.name)) n.weaknesses.push(w.name);
      }
    };
  }

  const skill = cfg.interaction[(await soloD100("Interaction d100") - 1) % cfg.interaction.length];
  const mod = cfg.modifiers[(await soloD100("Modifier d100") - 1) % cfg.modifiers.length];
  return {
    kind: "interaction", name: `${skill.name} ${signed(mod)}`,
    desc: `${cfg.note} What you have learned makes them that much easier to work on.`,
    apply: a => {
      const n = a.briefing.npc;
      n.interaction = n.interaction || { reaction: 0, persuasion: 0, seduction: 0, interrogation: 0, torture: 0 };
      n.interaction[skill.key] = (Number(n.interaction[skill.key]) || 0) + mod;
    }
  };
}

/** Rewrite the mission's objective, filing the old one to Threads as unfinished business. */
async function rewriteObjective(shape, pair) {
  const adv = Store.activeAdventure();
  const current = adv.briefing && adv.briefing.rows.objective ? adv.briefing.rows.objective.text : "";
  const typed = await promptModal("What is the mission actually for?", {
    title: "Rewrite the objective", value: current
  });
  if (typed === null) return;
  const next = typed.trim();
  if (!next || next === current) return;

  save(a => {
    a.briefing.rows.objective = { text: next, words: pair.words, rolls: pair.rolls };
    if (current && (a.threads || []).length < S.LIST_SLOTS) {
      const entry = { id: uid("li"), text: `Unfinished: ${current}`, weight: 1 };
      a.threads.push(entry);
    }
    journal(a, "note", `Objective rewritten: ${next}`, `was: ${current} · ${shape.name}`);
  });
  showToast("Objective rewritten", "ok");
}

function appendMeaning(host, adv) {
  appendHelp(host, "solo.meaning");
  const sec = section("Meaning Tables", "Roll a word pair and read the first thing that fits. The same word twice is amplification, not a wasted roll.");

  const groups = {};
  for (const m of S.MEANING_TABLES) (groups[m.group] = groups[m.group] || []).push(m);

  for (const [group, list] of Object.entries(groups)) {
    const acc = el("details", { class: "acc" },
      el("summary", { text: `${group} (${list.length})` }));
    const bodyEl = el("div", { class: "acc-body", style: "padding:0" });
    for (const m of list) {
      bodyEl.appendChild(el("button", {
        class: "skill-row", type: "button",
        onclick: () => rollMeaning(adv, m.key)
      }, el("span", { class: "n", text: m.name })));
    }
    acc.appendChild(bodyEl);
    sec.appendChild(acc);
  }

  sec.appendChild(el("p", { class: "small muted", style: "margin-top:8px", text:
    "Baseline covers any scene; the rest are pointed at what the game actually asks you to narrate — the run of play, the mission, the world around it, and the shape of the story." }));
  host.appendChild(sec);
}

export async function rollMeaning(adv, tableKey) {
  const table = S.MEANING_BY_KEY[tableKey];
  const pair = await rollPair(tableKey);

  const body = el("div", {});
  body.appendChild(el("div", { class: "roll-result" },
    el("div", { class: "roll-quality", style: "font-size:22px", text: pair.words.join(" · ") }),
    el("div", { class: "roll-formula", text: `${pair.label} · rolled ${pair.rolls.join(" and ")}` })));
  body.appendChild(el("p", { class: "small muted", text: table.subject }));
  if (pair.doubled) body.appendChild(el("div", { class: "banner warn", text: S.DOUBLES_NOTE }));

  save(a => { journal(a, "meaning", `${table.name}: ${pair.words.join(" ")}`, `rolled ${pair.rolls.join("/")}`); });
  logSolo(adv, table.name, pair.rolls[0], pair.words.join(" "), pair.label);

  modal({
    title: table.name, body,
    actions: [
      { label: "Roll again", kind: "ghost", close: false, onClick: api => { api.close(); rollMeaning(Store.activeAdventure(), tableKey); } },
      { label: "Done", kind: "primary" }
    ]
  });
}

/* ---------------------------------------------------------------- adventure lists */

function appendLists(host, adv) {
  appendHelp(host, "solo.threads");
  host.appendChild(listSection(adv, "threads", "Threads", "Everything the character is trying to do. Strike one off when it closes."));
  appendHelp(host, "solo.characters");
  host.appendChild(listSection(adv, "characters", "Characters", "Everyone who matters. Enter a name twice to make it come up twice as often."));
}

function listSection(adv, which, title, sub) {
  const sec = section(title, sub);
  const list = adv[which] || [];

  sec.querySelector(".section-head").appendChild(el("button", {
    class: "btn sm primary", type: "button",
    onclick: async () => {
      const text = await promptModal(which === "threads" ? "What is the character trying to do?" : "Who is it?", { title: "Add to " + title });
      if (!text) return;
      if (list.length >= S.LIST_SLOTS) { showToast(`The list holds ${S.LIST_SLOTS} entries`, "err"); return; }
      save(a => { (a[which] = a[which] || []).push({ id: uid("li"), text, weight: 1 }); });
    }
  }, "+ Add"));

  if (!list.length) {
    sec.appendChild(el("div", { class: "empty" }, el("p", { class: "muted", text: "Nothing listed. An event that points here will tell you to invent one." })));
  } else {
    const card = el("div", { class: "card flush" });
    for (const item of list) {
      card.appendChild(el("div", { class: "card-row" },
        // The text is the button: an entry seeded from a word pair reads like a word pair
        // until you write it as something you can act on (ruling S22).
        el("button", {
          class: "row-edit grow", type: "button", "aria-label": `Reword ${item.text}`,
          onclick: async () => {
            const text = await promptModal(which === "threads" ? "What is the character trying to do?" : "Who is it?",
              { title: "Reword this entry", value: item.text });
            if (text === null || !text.trim()) return;
            save(a => { const x = a[which].find(y => y.id === item.id); if (x) x.text = text.trim(); });
          }
        },
          el("div", { text: item.text }),
          el("div", { class: "small muted", text: `weight ${item.weight}${item.weight > 1 ? " — comes up more often" : ""}` })),
        el("button", {
          class: "btn sm ghost", type: "button", "aria-label": `Lower the weight of ${item.text}`,
          disabled: item.weight <= 1,
          onclick: () => save(a => { const x = a[which].find(y => y.id === item.id); if (x) x.weight = Math.max(1, x.weight - 1); })
        }, "−"),
        el("button", {
          class: "btn sm ghost", type: "button", "aria-label": `Raise the weight of ${item.text}`,
          onclick: () => save(a => { const x = a[which].find(y => y.id === item.id); if (x) x.weight = Math.min(9, x.weight + 1); })
        }, "+"),
        el("button", {
          class: "btn sm ghost", type: "button", "aria-label": `Remove ${item.text}`,
          onclick: async () => {
            if (await confirmModal(`Remove “${item.text}”?`, { okLabel: "Remove", danger: true })) {
              save(a => { a[which] = a[which].filter(y => y.id !== item.id); });
            }
          }
        }, "✕")));
    }
    sec.appendChild(card);
  }

  sec.appendChild(el("button", {
    class: "btn block", style: "margin-top:8px", type: "button",
    onclick: () => randomiseList(adv, which, title)
  }, `Randomise ${title.toLowerCase()}`));
  return sec;
}

export async function randomiseList(adv, which, title) {
  const roll = await soloD100(`${title} d100`);
  const text = drawFromList(adv, which, roll);
  save(a => { journal(a, "note", `${title} list → ${text}`, `d100 ${roll} → slot ${S.listSlot(roll)}`); });
  logSolo(adv, `${title} list`, roll, text, `slot ${S.listSlot(roll)} of ${S.LIST_SLOTS}`);
  modal({
    title: title + " list",
    body: el("div", {},
      el("div", { class: "banner ok", text }),
      el("p", { class: "small muted", text: `d100 ${roll} → slot ${S.listSlot(roll)} of ${S.LIST_SLOTS}. ${S.LIST_RULES.weighting}` })),
    actions: [{ label: "OK", kind: "primary" }]
  });
}

/* ---------------------------------------------------------------- end scene */

/**
 * End the scene: the control question that steps the Chaos Factor, a summary line, and the
 * list upkeep in the same dialog — adding a thread or a character, and striking off what has
 * closed. Everything commits together under one undo snapshot, because they are one decision
 * about the scene that just happened, not four errands.
 */
export async function endScene(adv) {
  const pending = {
    threads: { add: [], remove: new Set() },
    characters: { add: [], remove: new Set() }
  };

  const preview = el("div", {});
  let inControl = true;
  // Set below, once the stale-mystery block knows whether there is anything to offer.
  let staleBump = false;

  /** Where the Chaos Factor lands: the control question, plus a step for a case gone cold. */
  const nextChaos = () => {
    const afterControl = S.stepChaos(adv.chaos, inControl ? S.CHAOS_RULES.inControl : S.CHAOS_RULES.notInControl);
    return staleBump ? S.stepChaos(afterControl, S.CHAOS_RULES.notInControl) : afterControl;
  };

  preview.appendChild(el("div", { class: "field-label", text: "Was the character in control of how the scene went?" }));
  const wrap = el("div", { class: "chip-wrap" });
  const note = el("p", { class: "small muted", style: "margin-top:8px" });
  const opts = [{ key: true, label: "Yes — Chaos −1" }, { key: false, label: "No — Chaos +1" }];
  function drawOpts() {
    clear(wrap);
    for (const o of opts) {
      wrap.appendChild(el("button", {
        class: "chip" + (inControl === o.key ? " on" : ""), type: "button",
        onclick: () => { inControl = o.key; drawOpts(); }
      }, o.label));
    }
    const next = nextChaos();
    note.textContent = `Chaos Factor ${adv.chaos} → ${next}` +
      (staleBump ? " (control, and a mystery getting away)" : "") +
      (next === adv.chaos ? " (already at the end of the range)" : "");
  }
  drawOpts();
  preview.appendChild(wrap);
  preview.appendChild(note);

  const summary = el("input", { type: "text", placeholder: "What happened?" });
  preview.appendChild(el("label", { class: "field", style: "margin-top:12px" },
    el("span", { text: "Scene summary (optional)" }), summary));

  // A mystery nobody has touched for several scenes is a thing running away from you, which
  // is what the Chaos Factor is for. Offered, never applied silently, and it stacks with the
  // control question — a scene you lost while the case went cold is worth two steps.
  const stale = openMysteries(adv).filter(m =>
    (adv.scene || 1) - (m.lastScene || 0) >= S.MYSTERY_STALE_SCENES);
  if (stale.length) {
    const box = el("div", { style: "margin-top:14px" });
    box.appendChild(el("label", { class: "toggle-row" },
      el("input", { type: "checkbox", onchange: e => { staleBump = e.target.checked; drawOpts(); } }),
      el("div", { class: "grow" },
        el("div", { class: "t-name", text: "A mystery is getting away from you — Chaos +1" }),
        el("div", { class: "t-desc", text: `${stale.map(m => m.label).join("; ")} — no clue for ${S.MYSTERY_STALE_SCENES} scenes.` }))));
    preview.appendChild(box);
  }

  const mysteryTicks = new Set();
  const openNow = openMysteries(adv);
  if (openNow.length) {
    const box = el("div", { style: "margin-top:14px" });
    box.appendChild(el("div", { class: "field-label", text: "Did this scene bear on a mystery?" }));
    const card = el("div", { class: "card flush" });
    for (const m of openNow) {
      const label = el("label", { class: "toggle-row" },
        el("input", {
          type: "checkbox",
          onchange: e => { if (e.target.checked) mysteryTicks.add(m.id); else mysteryTicks.delete(m.id); }
        }),
        el("div", { class: "grow" },
          el("div", { class: "t-name", text: m.label }),
          el("div", { class: "t-desc", text: `${m.clues} clue${m.clues === 1 ? "" : "s"} — ticking marks one more and asks Fate` })));
      card.appendChild(label);
    }
    box.appendChild(card);
    preview.appendChild(box);
  }

  preview.appendChild(upkeepBlock(adv, "threads", "Threads", pending));
  preview.appendChild(upkeepBlock(adv, "characters", "Characters", pending));

  const ok = await confirmModal(preview, { title: `End scene ${adv.scene}`, okLabel: "End scene" });
  if (!ok) return;

  Store.pushSoloUndo(Store.soloSnapshot());

  const before = adv.chaos;
  const changes = [];
  const updated = save(a => {
    a.chaos = nextChaos();
    journal(a, "scene", `Scene ${a.scene} ended — ${inControl ? "in control" : "not in control"}` +
      (summary.value.trim() ? `: ${summary.value.trim()}` : ""),
      `Chaos Factor ${before} → ${a.chaos}`);

    for (const which of ["threads", "characters"]) {
      const p = pending[which];
      if (p.remove.size) {
        const gone = a[which].filter(i => p.remove.has(i.id)).map(i => i.text);
        a[which] = a[which].filter(i => !p.remove.has(i.id));
        for (const text of gone) journal(a, "note", `Closed: ${text}`);
        changes.push(`Struck off ${gone.length} ${which === "threads" ? "thread" : "character"}${gone.length === 1 ? "" : "s"}.`);
      }
      let added = 0;
      for (const text of p.add) {
        if (a[which].length >= S.LIST_SLOTS) break;
        a[which].push({ id: uid("li"), text, weight: 1 });
        journal(a, "note", `Added to ${which}: ${text}`);
        added += 1;
      }
      if (added) {
        changes.push(`Added ${added} ${which === "threads" ? "thread" : "character"}${added === 1 ? "" : "s"}.`);
      }
      // A full list used to swallow the rest of the additions without a word.
      if (added < p.add.length) {
        changes.push(`${p.add.length - added} could not be added — ${which} is full at ${S.LIST_SLOTS}. Strike something off first.`);
      }
    }

    a.scene = (a.scene || 1) + 1;
    a.scenePhase = "setup";
    a.sceneKind = null;
    a.sceneExpected = "";
  });

  changes.unshift(`Chaos Factor ${before} → ${updated.chaos}.` +
    (staleBump ? " A mystery getting away from you cost a step of its own." : ""));
  changes.push(`Scene ${updated.scene} is next — start it when you know what you expect.`);

  for (const id of mysteryTicks) {
    const m = (updated.mysteries || []).find(x => x.id === id);
    if (m && !m.revealedAt) changes.push(`${m.label}: a clue from this scene — Fate is asked once you close this.`);
  }

  modal({
    title: "Scene ended",
    body: el("div", {}, ...changes.map(t => el("p", { class: "small", text: "• " + t })),
      el("p", { class: "small muted", style: "margin-top:10px", text: "Undo is on the Solo screen if that was not what you meant." })),
    actions: [{ label: "OK", kind: "primary" }],
    // The clues this scene earned are marked one at a time after the boundary is read, so a
    // mystery that breaks open does so on its own dialog rather than inside the summary.
    onClose: async () => {
      for (const id of mysteryTicks) await tickMystery(id, "scene", summary.value.trim());
    }
  });
}

/**
 * End the mission — the loop's exit, and the one place the two systems have to meet.
 *
 * Mythic has no notion of a mission ending; Classified does, and its End Mission bundle is
 * where the experience, the Hero Point, the Reputation and the one-advance-per-mission gate
 * live. So this closes the adventure *and* hands off to that bundle by dynamic import, which
 * is the same crossing the briefing's NPC generator makes (S15). Without it a solo player
 * finished a mission and was awarded nothing, on a screen that offered only another scene
 * (ruling S24).
 */
export async function endMission(adv) {
  const linked = adv.characterId ? Store.getCharacter(adv.characterId) : null;
  const openThreads = (adv.threads || []).length;
  const openMys = openMysteries(adv).length;

  let outcome = "success";
  const body = el("div", {});
  body.appendChild(el("div", { class: "field-label", text: "How did it end?" }));
  const wrap = el("div", { class: "chip-wrap" });
  const draw = () => {
    clear(wrap);
    for (const o of S.MISSION_OUTCOMES_LIST) {
      wrap.appendChild(el("button", {
        class: "chip" + (outcome === o.key ? " on" : ""), type: "button",
        onclick: () => { outcome = o.key; draw(); }
      }, o.name));
    }
  };
  draw();
  body.appendChild(wrap);

  if (openThreads || openMys) {
    body.appendChild(el("div", { class: "banner warn", style: "margin-top:12px" },
      el("b", { text: "Still open" }),
      el("div", { class: "small", text: [
        openThreads ? `${openThreads} thread${openThreads === 1 ? "" : "s"}` : "",
        openMys ? `${openMys} myster${openMys === 1 ? "y" : "ies"}` : ""
      ].filter(Boolean).join(" and ") + " — they stay in the record, unanswered." })));
  }

  body.appendChild(el("p", { class: "small muted", style: "margin-top:12px", text: linked
    ? `Closing this also fires Classified's End Mission for ${linked.identity.name || "your operative"}: experience, Reputation, the Hero Point for a success, and the advancement gate.`
    : "No dossier is linked, so nothing is awarded — this only closes the adventure." }));

  const ok = await confirmModal(body, { title: `End the mission after ${adv.scene - 1} scenes`, okLabel: "End the mission" });
  if (!ok) return;

  Store.pushSoloUndo(Store.soloSnapshot("Mission ended"));
  save(a => {
    a.completedAt = Date.now();
    a.outcome = outcome;
    a.scenePhase = "setup";
    a.sceneKind = null;
    a.sceneExpected = "";
    journal(a, "scene", `Mission ended — ${S.MISSION_OUTCOMES[outcome].name}`,
      `${a.scene - 1} scenes · Chaos Factor ${a.chaos}`);
  });

  // The Classified half. Its own dialog reports what it awarded, so this one does not repeat it.
  if (linked) {
    if (Store.activeId() !== linked.id) Store.setActive(linked.id);
    const { runLifecycle } = await import("./combat.js");
    await runLifecycle("mission");
  } else {
    showToast("Mission closed", "ok");
  }
}

/** One list's upkeep controls inside the End Scene dialog. */
function upkeepBlock(adv, which, title, pending) {
  const box = el("div", { style: "margin-top:14px" });
  box.appendChild(el("div", { class: "field-label", text: title }));

  const list = adv[which] || [];
  if (list.length) {
    const card = el("div", { class: "card flush" });
    for (const item of list) {
      const row = el("div", { class: "card-row" });
      const label = el("span", { class: "grow small", text: item.text });
      const btn = el("button", { class: "btn sm ghost", type: "button" }, "Strike off");
      btn.addEventListener("click", () => {
        if (pending[which].remove.has(item.id)) {
          pending[which].remove.delete(item.id);
          label.style.textDecoration = "";
          btn.textContent = "Strike off";
        } else {
          pending[which].remove.add(item.id);
          label.style.textDecoration = "line-through";
          btn.textContent = "Keep";
        }
      });
      row.appendChild(label);
      row.appendChild(btn);
      card.appendChild(row);
    }
    box.appendChild(card);
  } else {
    box.appendChild(el("p", { class: "small muted", text: "Nothing listed yet." }));
  }

  const added = el("div", { class: "chip-wrap", style: "margin-top:6px" });
  const input = el("input", { type: "text", placeholder: which === "threads" ? "A new goal that opened" : "Someone who now matters" });
  const addBtn = el("button", { class: "btn sm", type: "button" }, "Add");
  const commit = () => {
    const text = input.value.trim();
    if (!text) return;
    if ((adv[which] || []).length + pending[which].add.length >= S.LIST_SLOTS) {
      showToast(`The list holds ${S.LIST_SLOTS} entries`, "err");
      return;
    }
    pending[which].add.push(text);
    added.appendChild(el("span", { class: "chip static", text }));
    input.value = "";
  };
  addBtn.addEventListener("click", commit);
  input.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); commit(); } });

  box.appendChild(el("div", { class: "row tight", style: "margin-top:6px" },
    el("span", { class: "grow" }, input), addBtn));
  box.appendChild(added);
  return box;
}

/* ---------------------------------------------------------------- journal */

function appendJournal(host, adv) {
  appendHelp(host, "solo.journal");
  const entries = adv.journal || [];
  const sec = section("Journal", "Every Fate answer, event and scene boundary, newest first.");

  sec.querySelector(".section-head").appendChild(el("button", {
    class: "btn sm", type: "button",
    onclick: async () => {
      const text = await promptModal("Note", { title: "Add a journal note" });
      if (text) save(a => { journal(a, "note", text); });
    }
  }, "+ Note"));

  if (!entries.length) {
    sec.appendChild(el("div", { class: "empty" }, el("p", { class: "muted", text: "Nothing recorded yet." })));
    host.appendChild(sec);
    return;
  }

  sec.querySelector(".section-head").appendChild(el("button", {
    class: "btn sm ghost", type: "button",
    onclick: () => copyText(journalText(entries), `${entries.length} entries copied`)
  }, "Copy all"));

  const card = el("div", { class: "card flush" });
  for (const e of entries.slice(0, 40)) {
    card.appendChild(el("div", { class: "log-entry" },
      el("span", { class: "lr", style: "font-size:11px", text: e.kind }),
      el("div", { class: "ld" },
        el("div", { class: "lt" }, el("b", { text: e.text })),
        e.detail ? el("div", { class: "lm", text: e.detail }) : null,
        el("div", { class: "lm", text: fmtDate(e.ts) })),
      el("div", { class: "row tight", style: "flex:none" },
        el("button", {
          class: "btn sm ghost", type: "button",
          "aria-label": `Copy: ${e.text}`, title: "Copy this entry",
          onclick: () => copyText(entryText(e), "Entry copied")
        }, "⧉"),
        el("button", {
          class: "btn sm ghost", type: "button",
          "aria-label": `Delete: ${e.text}`, title: "Delete this entry",
          onclick: async () => {
            if (await confirmModal(e.text, {
              title: "Delete this entry?", danger: true, okLabel: "Delete"
            })) {
              save(a => unjournal(a, e.id));
              showToast("Entry deleted");
            }
          }
        }, "✕"))));
  }
  sec.appendChild(card);

  if (entries.length > 40) {
    sec.appendChild(el("p", { class: "small muted", text: `${entries.length - 40} older entries are kept in the adventure record. Copy all takes every one of them.` }));
  }
  sec.appendChild(el("button", {
    class: "btn ghost block", style: "margin-top:8px", type: "button",
    onclick: async () => {
      if (await confirmModal("Clear this adventure's journal? The Chaos Factor, scene count and lists are kept.", { danger: true, okLabel: "Clear" })) {
        save(a => { a.journal = []; });
      }
    }
  }, "Clear journal"));
  host.appendChild(sec);
}

/** One journal row as plain text: what happened, the dice behind it, and when. */
function entryText(e) {
  return [`[${e.kind}] ${e.text}`, e.detail, fmtDate(e.ts)].filter(Boolean).join("\n");
}

/** The whole journal, oldest first, so a pasted log reads forwards. */
function journalText(entries) {
  return [...entries].reverse().map(entryText).join("\n\n");
}

/**
 * Copy to the clipboard. The async API needs a secure context, so a hidden textarea and
 * execCommand stand in when it is unavailable — over plain http on a phone, for instance.
 */
async function copyText(text, okMessage) {
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

/* ---------------------------------------------------------------- topics */

export function openTopic(key) {
  const topic = S.SOLO_TOPICS.find(t => t.key === key);
  if (!topic) return;
  modal({
    title: topic.title,
    body: el("div", {}, ...topic.body.map(t => el("p", { text: t }))),
    actions: [{ label: "Close", kind: "primary" }]
  });
}

function appendTopics(host) {
  const sec = section("Solo reference");
  const card = el("div", { class: "card flush" });
  for (const t of S.SOLO_TOPICS) {
    card.appendChild(el("button", { class: "skill-row", type: "button", onclick: () => openTopic(t.key) },
      el("span", { class: "n", text: t.title })));
  }
  sec.appendChild(card);

  card.appendChild(el("button", { class: "skill-row", type: "button", onclick: () => showFateChart() },
    el("span", { class: "n", text: "The Fate Chart" })));
  card.appendChild(el("button", { class: "skill-row", type: "button", onclick: () => showFateCheck() },
    el("span", { class: "n", text: "The Fate Check" })));
  card.appendChild(el("button", { class: "skill-row", type: "button", onclick: () => showEventFocus() },
    el("span", { class: "n", text: "Event Focus table" })));
  card.appendChild(el("button", { class: "skill-row", type: "button", onclick: () => showSceneAdjustment() },
    el("span", { class: "n", text: "Scene Adjustment table" })));
  // Two systems' vocabulary meet on this screen, which is where a new player most needs it (N7).
  card.appendChild(glossaryRow());

  host.appendChild(sec);
}

function showFateChart() {
  const t = el("table", { class: "data" });
  t.appendChild(el("tr", {}, el("th", { text: "Odds" }),
    ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map(c => el("th", { text: "CF " + c }))));
  for (const o of S.FATE_ODDS) {
    t.appendChild(el("tr", {}, el("th", { text: o.name }),
      ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map(c => {
        const target = S.fateTarget(o.key, c);
        const y = S.exceptionalYes(target);
        const n = S.exceptionalNo(target);
        return el("td", { class: "num" },
          el("span", { class: "small muted", text: (y === null ? "x" : String(y)) + " " }),
          el("b", { text: String(target) }),
          el("span", { class: "small muted", text: " " + (n === null ? "x" : String(n)) }));
      })));
  }
  modal({
    title: "Fate Chart", wide: true,
    body: el("div", {},
      el("div", { class: "table-wrap" }, t),
      el("p", { class: "small muted", text: "Each cell reads: Exceptional Yes on that or under, Yes on the bold number or under, Exceptional No on the last number or over. An x means that band cannot occur at those odds." }),
      el("p", { class: "small muted", text: "The printing is one ladder read diagonally: every cell equals the cell up and to its left, so a point of Chaos Factor moves exactly as far as a step of odds." })),
    actions: [{ label: "Close", kind: "primary" }]
  });
}

function showFateCheck() {
  const mods = el("table", { class: "data" });
  mods.appendChild(el("tr", {}, el("th", { text: "Odds" }), el("th", { text: "Roll modifier" }), el("th", { text: "Chaos Factor" })));
  for (const o of S.FATE_ODDS) {
    const cf = Object.keys(S.FATE_CHECK_CHAOS_MOD).find(k => S.FATE_CHECK_CHAOS_MOD[k] === o.mod);
    mods.appendChild(el("tr", {},
      el("td", { text: o.checkName }),
      el("td", { class: "num", text: o.mod === 0 ? "None" : signed(o.mod) }),
      el("td", { class: "num", text: cf || "—" })));
  }

  const answers = el("table", { class: "data" });
  answers.appendChild(el("tr", {}, el("th", { text: "Roll total" }), el("th", { text: "Answer" })));
  for (const [range, answer] of [
    [`${S.FATE_CHECK.exceptionalYesFrom}-20`, "Exceptional Yes"],
    [`${S.FATE_CHECK.threshold} or more`, "Yes"],
    [`${S.FATE_CHECK.threshold - 1} or less`, "No"],
    [`2-${S.FATE_CHECK.exceptionalNoTo}`, "Exceptional No"],
    ["Double digits within the Chaos Factor", "Random Event"]
  ]) {
    answers.appendChild(el("tr", {}, el("td", { style: "white-space:normal", text: range }), el("td", { text: answer })));
  }

  modal({
    title: "Fate Check", wide: true,
    body: el("div", {},
      el("p", { class: "small", text: S.FATE_CHECK.desc }),
      el("div", { class: "table-wrap" }, mods),
      el("p", { class: "small muted", text: "The Odds and the Chaos Factor read off the same modifier column, so a Chaos Factor of 9 is worth as much as odds of Has To Be." }),
      el("div", { class: "table-wrap" }, answers),
      el("p", { class: "small muted", text: S.FATE_CHECK.exceptionalDesc })),
    actions: [{ label: "Close", kind: "primary" }]
  });
}

function showEventFocus() {
  const t = el("table", { class: "data" });
  t.appendChild(el("tr", {}, el("th", { text: "d100" }), el("th", { text: "Focus" })));
  let lo = 0;
  for (const f of S.EVENT_FOCUS) {
    t.appendChild(el("tr", {},
      el("td", { class: "num", text: `${lo + 1}-${f.max}` }),
      el("td", { style: "white-space:normal" }, el("b", { text: f.name }), el("div", { class: "small muted", text: f.desc }))));
    lo = f.max;
  }
  modal({
    title: "Event Focus", wide: true,
    body: el("div", {},
      el("div", { class: "table-wrap" }, t),
      el("p", { class: "small muted", text: "Roll the focus, then roll a word pair from a Meaning Table to colour it. Focuses that name a thread or a character draw from your Adventure Lists." })),
    actions: [{ label: "Close", kind: "primary" }]
  });
}

function showSceneAdjustment() {
  const t = el("table", { class: "data" });
  t.appendChild(el("tr", {}, el("th", { text: "d10" }), el("th", { text: "Result" })));
  let lo = 0;
  for (const r of S.SCENE_ADJUSTMENTS) {
    t.appendChild(el("tr", {},
      el("td", { class: "num", text: lo + 1 === r.max ? String(r.max) : `${lo + 1}-${r.max}` }),
      el("td", { style: "white-space:normal" }, el("b", { text: r.name }), el("div", { class: "small muted", text: r.desc }))));
    lo = r.max;
  }
  modal({
    title: "Scene Adjustment", wide: true,
    body: el("div", {},
      el("div", { class: "table-wrap" }, t),
      el("p", { class: "small muted", text: "Rolled when a scene is altered: change that one thing and play it. A 7-10 sends you back to the table twice, and the app expands that for you." })),
    actions: [{ label: "Close", kind: "primary" }]
  });
}

