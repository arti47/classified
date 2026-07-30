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
  adv.journal.unshift({ id: uid("j"), ts: Date.now(), kind, text, detail });
  if (adv.journal.length > 200) adv.journal.length = 200;
}

/**
 * Write a solo roll to the shared log. `solo: true` and `outcome` keep it out of the
 * Classified Success Quality columns, which mean nothing here.
 */
function logSolo(adv, label, roll, outcome, note) {
  const linked = adv.characterId ? Store.getCharacter(adv.characterId) : null;
  Store.addRoll({
    solo: true,
    by: linked ? (linked.identity.name || "Agent") : (adv.name || "Solo"),
    characterId: adv.characterId || null,
    label, roll, outcome, note: note || "",
    modifiers: []
  });
  announce(`${label}: ${outcome}`);
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
      el("p", { class: "muted", text: "An adventure holds the Chaos Factor, the scene count, your threads and characters, and the journal." }),
      el("button", { class: "btn primary", type: "button", onclick: () => newAdventure(host) }, "Start an adventure")));
    appendTopics(host);
    return;
  }

  appendHeader(host, adv);
  appendFate(host, adv);
  appendScene(host, adv);
  appendMeaning(host, adv);
  appendLists(host, adv);
  appendJournal(host, adv);
  appendTopics(host);
}

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

function appendHeader(host, adv) {
  const card = el("div", { class: "card" });
  card.appendChild(el("div", { class: "row" },
    el("div", { class: "grow" },
      el("h1", { text: adv.name || "Untitled adventure" }),
      el("div", { class: "small muted", text: linkLabel(adv) })),
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
    el("div", { class: "s", text: `${count(adv.threads, "thread")} · ${count(adv.characters, "character")}` })));
  card.appendChild(grid);

  const chaosRow = el("div", { class: "btn-row", style: "margin-top:10px" });
  chaosRow.appendChild(el("button", {
    class: "btn sm", type: "button", disabled: adv.chaos <= S.CHAOS_MIN,
    onclick: () => save(a => { a.chaos = S.stepChaos(a.chaos, -1); })
  }, "Chaos −1"));
  chaosRow.appendChild(el("button", {
    class: "btn sm", type: "button", disabled: adv.chaos >= S.CHAOS_MAX,
    onclick: () => save(a => { a.chaos = S.stepChaos(a.chaos, 1); })
  }, "Chaos +1"));
  chaosRow.appendChild(el("button", {
    class: "btn sm ghost", type: "button",
    onclick: () => openTopic("chaos")
  }, "What this does"));
  card.appendChild(chaosRow);

  const modeRow = el("div", { class: "chip-wrap", style: "margin-top:10px" });
  for (const m of [
    { key: "chart", label: "Fate Chart (d100)" },
    { key: "check", label: "Fate Check (2d10)" }
  ]) {
    modeRow.appendChild(el("button", {
      class: "chip" + (adv.fateMode === m.key ? " on" : ""), type: "button",
      onclick: () => save(a => { a.fateMode = m.key; })
    }, m.label));
  }
  card.appendChild(modeRow);
  host.appendChild(card);

  host.appendChild(el("div", { class: "banner", text: S.SOLO_SOURCE.verifyNotice }));

  const undo = Store.peekSoloUndo();
  if (undo) {
    host.appendChild(el("div", { class: "banner" },
      el("div", { class: "small", text: `Last scene boundary fired ${fmtDate(undo.ts)}.` }),
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
    right: `CF ${a.chaos} · sc ${a.scene}`,
    desc: `${count(a.threads, "thread")}, ${count(a.characters, "character")} · updated ${fmtDate(a.updatedAt)}`
  }));
  items.push({ key: "__new", label: "+ Start a new adventure", desc: "Chaos Factor 5, scene 1, empty lists." });
  const active = Store.activeAdventure();
  if (active) items.push({ key: "__link", label: "Link a dossier", desc: "Point this adventure at a character so PC events name them." });
  if (active) items.push({ key: "__rename", label: "Rename this adventure", desc: "" });
  if (active) items.push({ key: "__delete", label: "Delete this adventure", desc: "Its journal and lists go with it." });

  const key = await chooseModal("Adventures", items);
  if (!key) return;
  if (key === "__new") { newAdventure(host); return; }
  if (key === "__rename") {
    const name = await promptModal("Adventure name", { title: "Rename", value: active.name || "" });
    if (name) { save(a => { a.name = name; }); }
    return;
  }
  if (key === "__delete") {
    if (await confirmModal(`Delete “${active.name}”?`, { danger: true, okLabel: "Delete" })) {
      Store.deleteAdventure(active.id);
      rerender();
    }
    return;
  }
  if (key === "__link") {
    const chars = Store.allCharacters();
    if (!chars.length) { showToast("No dossiers on this device", "err"); return; }
    const pick = await chooseModal("Link a dossier", chars.map(c => ({
      key: c.id, label: c.identity.name || "Unnamed", desc: "Events that name the player character will use this dossier."
    })).concat([{ key: "__none", label: "No dossier", desc: "Run the adventure without a linked character." }]));
    if (!pick) return;
    save(a => { a.characterId = pick === "__none" ? null : pick; });
    return;
  }
  Store.setActiveAdventure(key);
  rerender();
}

async function newAdventure(host) {
  const name = await promptModal("What is this adventure called?", { title: "New adventure", placeholder: "Operation Nightjar" });
  if (name === null) return;
  const chars = Store.allCharacters();
  let characterId = null;
  if (chars.length === 1) characterId = chars[0].id;
  else if (chars.length > 1) {
    const pick = await chooseModal("Link a dossier", chars.map(c => ({
      key: c.id, label: c.identity.name || "Unnamed", desc: ""
    })).concat([{ key: "__none", label: "No dossier", desc: "Link one later from the Adventures menu." }]));
    if (pick && pick !== "__none") characterId = pick;
  }
  const adv = Store.createAdventure({ name: name || "Untitled adventure", characterId });
  save(a => { journal(a, "note", `Adventure opened at Chaos Factor ${adv.chaos}.`); });
}

/* ---------------------------------------------------------------- ask fate */

function appendFate(host, adv) {
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
      }, o.name));
    }
    clear(preview);
    if (adv.fateMode === "check") {
      const o = S.FATE_ODDS_BY_KEY[state.odds];
      preview.textContent = `2d10 ${signed(o.mod)} odds ${signed(S.chaosMod(adv.chaos))} chaos vs ${S.FATE_CHECK.threshold}+`;
    } else {
      const target = S.fateTarget(state.odds, adv.chaos);
      preview.textContent = `Yes on ${target} or under · Exceptional Yes ${S.exceptionalYes(target)} or under · Exceptional No ${S.exceptionalNo(target)} or over`;
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
      ? `${res.die1} + ${res.die2} ${signed(res.oddsMod)} odds ${signed(res.chaosMod)} chaos = ${res.total} vs ${res.threshold}+`
      : `${odds.name} at Chaos Factor ${adv.chaos} · Yes on ${res.target} or under` })
  ));

  if (res.mechanic === "chart") {
    const b = el("div", { class: "bands" });
    const seg = (name, range, hit) => el("div", { class: "band" + (hit ? " hit" : "") },
      el("span", { class: "bl", text: name }), range);
    b.appendChild(seg("Exc Yes", `1-${res.exYes}`, res.key === "exceptionalYes"));
    if (res.target > res.exYes) b.appendChild(seg("Yes", `${res.exYes + 1}-${res.target}`, res.key === "yes"));
    if (res.exNo - 1 > res.target) b.appendChild(seg("No", `${res.target + 1}-${res.exNo - 1}`, res.key === "no"));
    b.appendChild(seg("Exc No", `${Math.min(100, res.exNo)}-100`, res.key === "exceptionalNo"));
    body.appendChild(b);
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
        ? "The dice match, so an event fires as well as the answer."
        : `A double at or under the Chaos Factor, so an event fires as well as the answer.` })));
  }

  const actions = [{ label: "Done", kind: "primary" }];
  if (res.event) {
    actions.unshift({ label: "Roll the event", kind: "ghost", onClick: () => rollRandomEvent(Store.activeAdventure()) });
  }

  save(a => {
    journal(a, "fate", `${label} — ${res.answer}`,
      res.mechanic === "check"
        ? `Fate Check ${res.die1}+${res.die2} ${signed(res.oddsMod)}/${signed(res.chaosMod)} = ${res.total}, ${odds.name}, CF ${a.chaos}`
        : `Fate Chart ${res.roll} vs ${res.target}, ${odds.name}, CF ${a.chaos}`);
  });
  logSolo(adv, label, res.mechanic === "check" ? res.total : res.roll, res.answer,
    `${odds.name} · Chaos Factor ${adv.chaos}` + (res.event ? " · Random Event" : ""));

  modal({ title: "Fate", body, actions });
}

/* ---------------------------------------------------------------- scenes */

function appendScene(host, adv) {
  const sec = section("Scene", "Say what you expect to happen, then let the Chaos Factor decide whether you get it.");

  sec.appendChild(el("div", { class: "btn-row" },
    el("button", { class: "btn primary", type: "button", onclick: () => testScene(adv) }, "Test the scene"),
    el("button", { class: "btn", type: "button", onclick: () => rollRandomEvent(adv) }, "Random Event"),
    el("button", { class: "btn", type: "button", onclick: () => endScene(adv) }, "End scene")
  ));
  sec.appendChild(el("p", { class: "small muted", style: "margin-top:8px", text:
    `A d10 over ${adv.chaos} plays the scene as expected. At or under, an odd roll alters it and an even roll interrupts it.` }));
  sec.appendChild(el("button", { class: "btn ghost block", style: "margin-top:6px", type: "button", onclick: () => openTopic("scenes") }, "How scenes work"));
  host.appendChild(sec);
}

export async function testScene(adv) {
  const roll = await soloD10("scene test d10");
  const res = S.sceneTest(roll, adv.chaos);

  const body = el("div", {});
  body.appendChild(el("div", { class: "roll-result" },
    el("div", { class: "roll-d100", text: String(roll) }),
    el("div", { class: "roll-quality " + (res.key === "expected" ? "q1" : res.key === "altered" ? "q3" : "q5"), text: res.name }),
    el("div", { class: "roll-formula", text: `d10 ${roll} against Chaos Factor ${res.chaos}` })));
  body.appendChild(el("p", { text: res.desc }));

  const actions = [{ label: "Done", kind: "primary" }];
  if (res.key === "altered") actions.unshift({ label: "Roll the adjustment", kind: "ghost", onClick: () => rollSceneAdjustment(Store.activeAdventure()) });
  if (res.key === "interrupt") actions.unshift({ label: "Roll the event", kind: "ghost", onClick: () => rollRandomEvent(Store.activeAdventure()) });

  save(a => { journal(a, "scene", `Scene ${a.scene} test — ${res.name}`, `d10 ${roll} vs CF ${res.chaos}`); });
  logSolo(adv, `Scene ${adv.scene} test`, roll, res.name, `d10 against Chaos Factor ${res.chaos}`);

  modal({ title: "Scene test", body, actions });
}

export async function rollSceneAdjustment(adv) {
  const roll = await soloD10("Scene Adjustment d10");
  let row = S.SCENE_ADJUSTMENTS[S.SCENE_ADJUSTMENTS.length - 1];
  for (const r of S.SCENE_ADJUSTMENTS) if (roll <= r.max) { row = r; break; }

  const body = el("div", {},
    el("div", { class: "banner" }, el("b", { text: row.name }), el("div", { class: "small", text: row.desc })),
    el("p", { class: "small muted", text: `Rolled ${roll}. Change that one thing and play the scene.` }));

  const actions = [{ label: "Done", kind: "primary" }];
  if (row.name === "Random Event instead") {
    actions.unshift({ label: "Roll the event", kind: "ghost", onClick: () => rollRandomEvent(Store.activeAdventure()) });
  }

  save(a => { journal(a, "scene", `Scene adjustment — ${row.name}`, `d10 ${roll}`); });
  logSolo(adv, "Scene adjustment", roll, row.name, row.desc);
  modal({ title: "Altered scene", body, actions });
}

/* ---------------------------------------------------------------- random events */

export async function rollRandomEvent(adv, opts = {}) {
  const focusRoll = await soloD100("Event Focus d100");
  const focus = S.eventFocus(focusRoll);

  const tableKey = opts.tableKey || S.EVENT_MEANING_BY_FOCUS[focus.key] || S.EVENT_MEANING_DEFAULT;
  const pair = await rollPair(tableKey);

  // Focuses that name a thread or a character draw from the Adventure Lists.
  let subject = null;
  let subjectRoll = null;
  if (focus.list) {
    subjectRoll = await soloD100(`${focus.list === "threads" ? "Threads" : "Characters"} list d100`);
    subject = drawFromList(adv, focus.list, subjectRoll);
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
  save(a => { journal(a, "event", `Random Event: ${detail}`, `focus ${focusRoll} · ${pair.label} ${pair.rolls.join("/")}`); });
  logSolo(adv, "Random Event", focusRoll, focus.name, detail);

  modal({
    title: "Random Event", body,
    actions: [
      { label: "Re-roll the words", kind: "ghost", close: false, onClick: api => { api.close(); rollRandomEvent(Store.activeAdventure(), { tableKey }); } },
      { label: "Done", kind: "primary" }
    ]
  });
}

/** Draw an entry from an Adventure List by d100 across its 25 slots. */
function drawFromList(adv, which, roll) {
  const slot = S.listSlot(roll);
  const list = adv[which] || [];
  const expanded = [];
  for (const item of list) {
    const weight = Math.max(1, Number(item.weight) || 1);
    for (let i = 0; i < weight; i++) expanded.push(item.text);
  }
  if (!expanded.length) {
    return which === "threads"
      ? "Empty slot — invent a thread and add it to the list"
      : "Empty slot — invent a character and add them to the list";
  }
  return expanded[(slot - 1) % expanded.length];
}

/* ---------------------------------------------------------------- meaning tables */

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

function appendMeaning(host, adv) {
  const sec = section("Meaning Tables", "Roll a word pair and read the first thing that fits. The same word twice is amplification, not a wasted roll.");

  const groups = {};
  for (const m of S.MEANING_TABLES) (groups[m.group] = groups[m.group] || []).push(m);

  for (const [group, list] of Object.entries(groups)) {
    const acc = el("details", { class: "acc", open: group === "Espionage" },
      el("summary", { text: `${group} (${list.length})` }));
    const bodyEl = el("div", { class: "acc-body", style: "padding:0" });
    for (const m of list) {
      bodyEl.appendChild(el("button", {
        class: "skill-row", type: "button",
        onclick: () => rollMeaning(adv, m.key)
      },
        el("span", { class: "n", text: m.name }),
        el("span", { class: "r", text: m.authored ? "authored" : "Vol. 38" }),
        el("span", { class: "b", text: "d100" })));
    }
    acc.appendChild(bodyEl);
    sec.appendChild(acc);
  }

  sec.appendChild(el("p", { class: "small muted", style: "margin-top:8px", text:
    "The Baseline tables come from the supplied Mythic Magazine Vol. 38 report. The Espionage, Mission and Flavour tables were written for this app by that report's own five-step method." }));
  sec.appendChild(el("button", { class: "btn ghost block", style: "margin-top:6px", type: "button", onclick: () => openTopic("meaning") }, "Meaning Tables and building your own"));
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
  host.appendChild(listSection(adv, "threads", "Threads", "Everything the character is trying to do. Strike one off when it closes."));
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
        el("div", { class: "grow" },
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

export async function endScene(adv) {
  const preview = el("div", {});
  preview.appendChild(el("p", { class: "small muted", text: "Ending a scene will:" }));
  for (const line of [
    "Step the Chaos Factor by one, in the direction you choose below.",
    "Advance the scene counter.",
    "Write the scene to the journal.",
    "Offer to update your Threads and Characters lists."
  ]) preview.appendChild(el("div", { class: "small", text: "• " + line }));

  let inControl = true;
  preview.appendChild(el("div", { class: "field-label", style: "margin-top:14px", text: "Was the character in control of how the scene went?" }));
  const wrap = el("div", { class: "chip-wrap" });
  const note = el("p", { class: "small muted", style: "margin-top:8px" });
  const opts = [
    { key: true, label: "Yes — Chaos −1" },
    { key: false, label: "No — Chaos +1" }
  ];
  function drawOpts() {
    clear(wrap);
    for (const o of opts) {
      wrap.appendChild(el("button", {
        class: "chip" + (inControl === o.key ? " on" : ""), type: "button",
        onclick: () => { inControl = o.key; drawOpts(); }
      }, o.label));
    }
    const next = S.stepChaos(adv.chaos, inControl ? S.CHAOS_RULES.inControl : S.CHAOS_RULES.notInControl);
    note.textContent = `Chaos Factor ${adv.chaos} → ${next}` + (next === adv.chaos ? " (already at the end of the range)" : "");
  }
  drawOpts();
  preview.appendChild(wrap);
  preview.appendChild(note);

  const summary = el("input", { type: "text", placeholder: "What happened?" });
  preview.appendChild(el("label", { class: "field", style: "margin-top:12px" },
    el("span", { text: "Scene summary (optional)" }), summary));

  const ok = await confirmModal(preview, { title: `End scene ${adv.scene}`, okLabel: "End scene" });
  if (!ok) return;

  Store.pushSoloUndo(Store.soloSnapshot());

  const before = adv.chaos;
  const changes = [];
  const updated = save(a => {
    a.chaos = S.stepChaos(a.chaos, inControl ? S.CHAOS_RULES.inControl : S.CHAOS_RULES.notInControl);
    journal(a, "scene", `Scene ${a.scene} ended — ${inControl ? "in control" : "not in control"}` +
      (summary.value.trim() ? `: ${summary.value.trim()}` : ""),
      `Chaos Factor ${before} → ${a.chaos}`);
    a.scene = (a.scene || 1) + 1;
  });
  changes.push(`Chaos Factor ${before} → ${updated.chaos}.`);
  changes.push(`Scene ${updated.scene} is next.`);
  changes.push("Check your lists: add any thread that opened, strike off any that closed, and add anyone who now matters.");

  modal({
    title: "Scene ended",
    body: el("div", {}, ...changes.map(t => el("p", { class: "small", text: "• " + t })),
      el("p", { class: "small muted", style: "margin-top:10px", text: "Undo is on the Solo screen if that was not what you meant." })),
    actions: [{ label: "OK", kind: "primary" }]
  });
}

/* ---------------------------------------------------------------- journal */

function appendJournal(host, adv) {
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

  const card = el("div", { class: "card flush" });
  for (const e of entries.slice(0, 40)) {
    card.appendChild(el("div", { class: "log-entry" },
      el("span", { class: "lr", style: "font-size:11px", text: e.kind }),
      el("div", { class: "ld" },
        el("div", { class: "lt" }, el("b", { text: e.text })),
        e.detail ? el("div", { class: "lm", text: e.detail }) : null,
        el("div", { class: "lm", text: fmtDate(e.ts) }))));
  }
  sec.appendChild(card);

  if (entries.length > 40) {
    sec.appendChild(el("p", { class: "small muted", text: `${entries.length - 40} older entries are kept in the adventure record.` }));
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

/* ---------------------------------------------------------------- topics */

export function openTopic(key) {
  const topic = S.SOLO_TOPICS.find(t => t.key === key);
  if (!topic) return;
  modal({
    title: topic.title,
    body: el("div", {},
      el("p", { class: "small muted", text: topic.source }),
      ...topic.body.map(t => el("p", { text: t }))),
    actions: [{ label: "Close", kind: "primary" }]
  });
}

function appendTopics(host) {
  const sec = section("Solo reference");
  const card = el("div", { class: "card flush" });
  for (const t of S.SOLO_TOPICS) {
    card.appendChild(el("button", { class: "skill-row", type: "button", onclick: () => openTopic(t.key) },
      el("span", { class: "n", text: t.title }),
      el("span", { class: "r", text: t.source })));
  }
  sec.appendChild(card);

  card.appendChild(el("button", { class: "skill-row", type: "button", onclick: () => showFateChart() },
    el("span", { class: "n", text: "The Fate Chart" }),
    el("span", { class: "r", text: "reconstructed" })));
  card.appendChild(el("button", { class: "skill-row", type: "button", onclick: () => showEventFocus() },
    el("span", { class: "n", text: "Event Focus table" }),
    el("span", { class: "r", text: "reconstructed" })));
  card.appendChild(el("button", { class: "skill-row", type: "button", onclick: () => showMethod() },
    el("span", { class: "n", text: "Building a table" }),
    el("span", { class: "r", text: "Vol. 38" })));

  host.appendChild(sec);
}

function showFateChart() {
  const t = el("table", { class: "data" });
  t.appendChild(el("tr", {}, el("th", { text: "Odds" }),
    ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map(c => el("th", { text: "CF " + c }))));
  for (const o of S.FATE_ODDS) {
    t.appendChild(el("tr", {}, el("th", { text: o.name }),
      ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map(c => el("td", { class: "num", text: String(S.fateTarget(o.key, c)) }))));
  }
  modal({
    title: "Fate Chart", wide: true,
    body: el("div", {},
      el("div", { class: "table-wrap" }, t),
      el("p", { class: "small muted", text: "Roll d100 at or under the number for a Yes. The low fifth of the Yes range is an Exceptional Yes; the top fifth of the No range is an Exceptional No. A 100 always answers No." }),
      el("div", { class: "banner warn", text: S.SOLO_SOURCE.reconstructed }),
      el("p", { class: "small muted", text: "The middle column is the anchor and each step away from it is one point of Chaos Factor. The odds axis is weighted four times as heavily as the chaos axis, which is what keeps an Impossible question impossible in a chaotic scene." })),
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
      el("div", { class: "banner warn", text: S.SOLO_SOURCE.reconstructed })),
    actions: [{ label: "Close", kind: "primary" }]
  });
}

function showMethod() {
  const body = el("div", {});
  body.appendChild(el("p", { class: "small", text: S.ONE_WORD_NOTE }));
  const card = el("div", { class: "card flush" });
  for (const s of S.TABLE_BUILD_METHOD) {
    card.appendChild(el("div", { class: "card-row" },
      el("span", { class: "mono", text: String(s.step) }),
      el("div", { class: "grow" },
        el("div", { style: "font-weight:600", text: s.name }),
        el("div", { class: "small muted", text: s.desc }))));
  }
  body.appendChild(card);
  body.appendChild(el("div", { class: "section-title", style: "margin-top:14px", text: "The Anything Words" }));
  const wrap = el("div", { class: "chip-wrap" });
  for (const w of S.ANYTHING_WORDS) wrap.appendChild(el("span", { class: "chip static", text: w }));
  body.appendChild(wrap);
  for (const n of S.ANYTHING_WORD_NOTES) body.appendChild(el("p", { class: "small muted", text: n }));
  body.appendChild(el("p", { class: "small muted", text: S.DOUBLES_NOTE }));
  modal({ title: "Building a Meaning Table", body, wide: true, actions: [{ label: "Close", kind: "primary" }] });
}
