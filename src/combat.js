/* combat.js — shared combat tracker, the generic progress-task tracker, and the
 * mission lifecycle engine (End Scene / End Session / End Mission) with a
 * confirmation summary and one-step undo. */

import { el, clear, uid, signed, d100, d10, clamp, fmtDate } from "./core.js";
import { modal, showToast, confirmModal, promptModal, chooseModal } from "./ui.js";
import * as D from "../data.js";
import * as R from "./rules.js";
import * as Store from "./store.js";
import { ANIMALS } from "../data-monsters.js";
import { OSIRIS_NPCS, NPC_CHARACTERISTIC_TABLES, NPC_SKILL_TABLES, NPC_STEREOTYPES, NPC_POINTS, NPC_REPUTATION } from "../data-npcs.js";
import { derived, conditionSummary } from "./derived.js";
import { openAttack, applyDamageToCharacter, getD100, resolve, presentResult, openChaseManeuver } from "./roller.js";
import { openRulesTopic } from "./screens.js";
import { renderResourceHeader } from "./sheet.js";
import { appendHelp } from "./help.js";

/* ---------------------------------------------------------------- combat screen */

export function renderCombat(host) {
  clear(host);
  const state = Store.combatState();
  const c = Store.activeCharacter();

  appendHelp(host, "combat");

  if (!state.active) {
    host.appendChild(el("div", { class: "section" },
      el("div", { class: "section-title", text: "Combat" }),
      el("p", { class: "small muted", style: "margin-top:8px", text:
        "Declaration runs slowest-first so the fastest characters declare last and act first. Actions resolve in reverse." })));
    host.appendChild(el("button", {
      class: "btn primary block", type: "button", onclick: () => startCombat(host)
    }, "Start an encounter"));
    renderTasks(host);
    renderLifecycle(host);
    return;
  }

  // Header
  host.appendChild(el("div", { class: "card" },
    el("div", { class: "row" },
      el("div", { class: "grow" },
        el("div", { class: "field-label", text: "Round" }),
        el("div", { class: "mono", style: "font-size:26px", text: String(state.round) })),
      el("div", { class: "grow" },
        el("div", { class: "field-label", text: "Phase" }),
        el("div", { style: "font-weight:600", text: state.phase === "declaration" ? "Declaration" : "Action" })),
      el("button", { class: "btn sm", type: "button", onclick: () => advancePhase(host) },
        state.phase === "declaration" ? "To Action" : "Next round")
    ),
    el("p", { class: "small muted", style: "margin-top:8px", text:
      state.phase === "declaration" ? D.COMBAT_ROUND.declaration : D.COMBAT_ROUND.action })
  ));

  // Order
  const order = orderedCombatants(state, state.phase);
  const sec = el("div", { class: "section" },
    el("div", { class: "section-head" },
      el("div", { class: "section-title", text: state.phase === "declaration" ? "Declaration order (slowest first)" : "Action order (fastest first)" }),
      el("button", { class: "btn sm", type: "button", onclick: () => openAddCombatant(host) }, "+ Add")));

  for (const cb of order) {
    sec.appendChild(combatantCard(cb, state, host));
  }
  host.appendChild(sec);

  host.appendChild(el("div", { class: "btn-row", style: "margin:16px 0" },
    el("button", { class: "btn", type: "button", onclick: () => openChaseManeuver(c) }, "Chase manoeuvre"),
    el("button", { class: "btn danger", type: "button", onclick: async () => {
      if (await confirmModal("End the encounter?", { okLabel: "End" })) { Store.clearCombat(); renderCombat(host); }
    } }, "End encounter")
  ));

  renderTasks(host);
  renderLifecycle(host);
}

function orderedCombatants(state, phase) {
  const list = [...(state.combatants || [])];
  list.sort((a, b) => (a.speed - b.speed) || (a.tiebreak - b.tiebreak));
  return phase === "declaration" ? list : list.reverse();
}

function combatantCard(cb, state, host) {
  const wound = R.woundLevel(cb.wound || "none");
  const card = el("div", { class: "combatant" + (cb.acted ? " acted" : "") });

  card.appendChild(el("div", { class: "c-head" },
    el("span", { class: "c-name", text: cb.name }),
    el("span", { class: "pill neutral", text: "Speed " + cb.speed }),
    wound.key !== "none" ? el("span", { class: "pill q5", text: wound.name }) : null
  ));

  if (cb.declaration) {
    card.appendChild(el("div", { class: "small", style: "margin-top:6px" },
      el("b", { text: "Declared: " }), cb.declaration));
  }

  const row = el("div", { class: "btn-row", style: "margin-top:8px" });
  row.appendChild(el("button", {
    class: "btn sm", type: "button",
    onclick: async () => {
      const t = await promptModal("What are they doing this round?", { title: cb.name, value: cb.declaration || "" });
      if (t !== null) mutate(host, s => { const x = s.combatants.find(y => y.id === cb.id); if (x) x.declaration = t; });
    }
  }, "Declare"));

  row.appendChild(el("button", {
    class: "btn sm", type: "button",
    onclick: () => openCombatantDamage(cb, host)
  }, "Damage"));

  if (cb.characterId) {
    row.appendChild(el("button", {
      class: "btn sm primary", type: "button",
      onclick: () => {
        const ch = Store.getCharacter(cb.characterId);
        if (ch) import("./roller.js").then(m => m.openWeaponPicker(ch));
      }
    }, "Attack"));
  }

  row.appendChild(el("button", {
    class: "btn sm ghost", type: "button",
    onclick: () => mutate(host, s => { const x = s.combatants.find(y => y.id === cb.id); if (x) x.acted = !x.acted; })
  }, cb.acted ? "Un-act" : "Acted"));

  row.appendChild(el("button", {
    class: "btn sm ghost", type: "button",
    onclick: () => mutate(host, s => { s.combatants = s.combatants.filter(y => y.id !== cb.id); })
  }, "✕"));

  card.appendChild(row);

  if (wound.painDF) {
    card.appendChild(el("p", { class: "small muted", style: "margin-top:6px", text:
      `Pain Resistance: Difficulty Factor ${wound.painDF} Willpower each round in Declaration, or no action.` }));
  }
  if (cb.stunRounds > 0) {
    card.appendChild(el("p", { class: "small", style: "margin-top:6px", text: `Stunned for ${cb.stunRounds} more round(s).` }));
  }
  return card;
}

function mutate(host, fn) {
  const s = Store.combatState();
  fn(s);
  Store.saveCombat(s);
  renderCombat(host);
}

function startCombat(host) {
  const s = { active: true, round: 1, phase: "declaration", combatants: [] };
  const c = Store.activeCharacter();
  if (c) {
    const dv = derived(c);
    s.combatants.push({
      id: uid("cb"), name: c.identity.name || "You", speed: dv.speed,
      tiebreak: d100(), wound: c.state.wound, characterId: c.id, acted: false, stunRounds: 0
    });
  }
  Store.saveCombat(s);
  renderCombat(host);
}

function advancePhase(host) {
  const s = Store.combatState();
  if (s.phase === "declaration") {
    s.phase = "action";
  } else {
    s.phase = "declaration";
    s.round += 1;
    for (const cb of s.combatants) {
      cb.acted = false;
      cb.declaration = "";
      if (cb.stunRounds > 0) cb.stunRounds -= 1;
    }
  }
  Store.saveCombat(s);
  renderCombat(host);
}

async function openAddCombatant(host) {
  const kind = await chooseModal("Add to the encounter", [
    { key: "npc", label: "Generated NPC", desc: "Roll a stereotype from the book's tables." },
    { key: "osiris", label: "OSIRIS antagonist", desc: "One of the seven named villains." },
    { key: "animal", label: "Animal", desc: "Guard dog, shark, alligator, horse or piranha." },
    { key: "manual", label: "Manual entry", desc: "Just a name and a Speed." }
  ]);
  if (!kind) return;

  if (kind === "manual") {
    const name = await promptModal("Name", { title: "Add combatant" });
    if (!name) return;
    const speed = parseInt(await promptModal("Speed (0-3)", { title: name, type: "number", value: "2" }), 10);
    addCombatant(host, { name, speed: clamp(Number.isFinite(speed) ? speed : 2, 0, 3) });
    return;
  }

  if (kind === "animal") {
    const key = await chooseModal("Animal", ANIMALS.map(a => ({
      key: a.key, label: a.name,
      right: a.hthDamage ? "DR " + a.hthDamage : "",
      desc: (a.notes && a.notes[0]) || ""
    })));
    if (!key) return;
    const a = ANIMALS.find(x => x.key === key);
    addCombatant(host, { name: a.name, speed: a.speed ?? 0, npc: a });
    return;
  }

  if (kind === "osiris") {
    const key = await chooseModal("OSIRIS", OSIRIS_NPCS.map(n => ({
      key: n.key, label: n.name, right: n.rankLabel, desc: n.title
    })));
    if (!key) return;
    const n = OSIRIS_NPCS.find(x => x.key === key);
    addCombatant(host, { name: n.name, speed: n.speed, npc: n });
    return;
  }

  const stype = await chooseModal("Stereotype", NPC_STEREOTYPES
    .filter(s => NPC_CHARACTERISTIC_TABLES[s.key])
    .map(s => ({ key: s.key, label: s.name, desc: s.desc })));
  if (!stype) return;
  const rank = await chooseModal("Rank", D.RANKS.map(r => ({ key: r.key, label: r.npcName, desc: r.name + " equivalent" })));
  if (!rank) return;
  const npc = generateNPC(stype, rank);
  addCombatant(host, { name: npc.name, speed: npc.speed, npc });
  showNPC(npc);
}

function addCombatant(host, opts) {
  mutate(host, s => {
    s.combatants.push({
      id: uid("cb"), name: opts.name, speed: opts.speed ?? 0, tiebreak: d100(),
      wound: "none", acted: false, stunRounds: 0, npc: opts.npc || null,
      characterId: opts.characterId || null
    });
  });
}

/**
 * Put an NPC into the encounter from another screen, starting one if none is running.
 * The Solo screen's briefing generates a full stat block; without this it could only be read,
 * and a stat block you cannot send anywhere is one you retype into the tracker by hand.
 */
export function addNpcToEncounter(npc) {
  const s = Store.combatState();
  if (!s.active) {
    s.active = true;
    s.round = 1;
    s.phase = "declaration";
    s.combatants = [];
    const c = Store.activeCharacter();
    if (c) {
      s.combatants.push({
        id: uid("cb"), name: c.identity.name || "Operative", speed: derived(c).speed,
        tiebreak: d100(), wound: c.state.wound || "none", acted: false, stunRounds: 0,
        npc: null, characterId: c.id
      });
    }
  }
  s.combatants.push({
    id: uid("cb"), name: npc.name, speed: npc.speed ?? 0, tiebreak: d100(),
    wound: "none", acted: false, stunRounds: 0, npc, characterId: null
  });
  Store.saveCombat(s);
  return s;
}

async function openCombatantDamage(cb, host) {
  const key = await chooseModal(`Wound ${cb.name}`, D.WOUND_LEVELS.filter(w => w.key !== "none")
    .map(w => ({ key: w.key, label: w.name, desc: w.desc || "" })),
    { intro: "Wounds are additive — this is combined with any wound already carried." });
  if (!key) return;

  const after = R.accumulateWound(cb.wound || "none", key);
  mutate(host, s => {
    const x = s.combatants.find(y => y.id === cb.id);
    if (!x) return;
    x.wound = after;
    if (key === "stun") x.stunRounds = R.stunRounds(d100());
  });

  if (cb.characterId) {
    const ch = Store.getCharacter(cb.characterId);
    if (ch && ch.id === Store.activeId()) {
      await applyDamageToCharacter(ch, key);
      renderResourceHeader();
    }
  } else {
    showToast(`${cb.name}: ${R.woundLevel(after).name}`);
  }
}

/* ---------------------------------------------------------------- NPC generation */

export function generateNPC(stereotypeKey, rankKey) {
  const stype = NPC_STEREOTYPES.find(s => s.key === stereotypeKey) || NPC_STEREOTYPES[0];
  const table = NPC_CHARACTERISTIC_TABLES[stereotypeKey] || NPC_CHARACTERISTIC_TABLES.civilian;
  const skillTable = NPC_SKILL_TABLES[stereotypeKey] || NPC_SKILL_TABLES.civilian;

  const idx = d10() - 1;
  const skillIdx = d10() - 1;
  const rankRow = R.RANK_BY_KEY[rankKey] || R.RANK_BY_KEY.agent;

  let mod = 0;
  if (rankKey === "rookie" && stype.rookieMod !== null && stype.rookieMod !== undefined) mod = stype.rookieMod;
  if (rankKey === "special" && stype.villainMod) mod = stype.villainMod;

  const attrs = {};
  for (const k of ["str", "dex", "wil", "per", "int"]) {
    attrs[k] = clamp((table[idx][k] || 5) + mod, 1, 15);
  }

  const skills = {};
  for (const [k, v] of Object.entries(skillTable[skillIdx])) {
    skills[k] = Math.max(1, v + mod);
  }

  const pts = NPC_POINTS[rankKey] || NPC_POINTS.agent;
  const points = Math.max(1, pts.base + (d10() + pts.offset));

  const repRow = NPC_REPUTATION[rankKey] || NPC_REPUTATION.agent;
  let rep = repRow.base + repRow.offset;
  for (let i = 0; i < repRow.dice; i++) rep += d100() % repRow.sides + 1;

  const speed = R.speedValue(attrs.per, attrs.dex);
  const name = `${rankRow.npcName} ${stype.name}`;

  const baseChances = {};
  for (const [k, rank] of Object.entries(skills)) {
    baseChances[k] = R.baseChance(k, attrs, rank, skills.charisma || 0);
  }

  return {
    generated: true,
    name, stereotype: stype.name, rank: rankKey, rankLabel: rankRow.npcName,
    attrs, skills, baseChances, points, reputation: Math.max(0, rep),
    speed, hthDamage: R.hthDamageRank(attrs.str),
    interaction: {
      reaction: 0, persuasion: 0, seduction: 0, interrogation: 0, torture: 0
    }
  };
}

/**
 * One Weakness off the book's list, at random. Lives here rather than in the Mythic layer
 * because the list is Classified's: the solo screen reaches it by dynamic import, the same
 * way it reaches the NPC generator (ruling S15).
 */
export function rollWeakness(exclude = []) {
  const taken = new Set(exclude.map(String));
  const pool = D.WEAKNESSES.filter(w => !taken.has(w.name) && !taken.has(w.key));
  const list = pool.length ? pool : D.WEAKNESSES;
  return list[Math.floor(Math.random() * list.length)];
}

export function showNPC(npc) {
  const body = el("div", {});

  if (npc.title) body.appendChild(el("p", { class: "small muted", text: npc.title }));
  if (npc.description) body.appendChild(el("p", { text: npc.description }));

  const attrs = npc.attrs || { str: npc.str, dex: npc.dex, wil: npc.wil, per: npc.per, int: npc.int };
  const grid = el("div", { class: "grid grid-3" });
  for (const ch of D.CHARACTERISTICS) {
    grid.appendChild(el("div", { class: "stat-box" },
      el("div", { class: "k", text: ch.abbr }),
      el("div", { class: "v", text: String(attrs[ch.key] ?? "—") })));
  }
  body.appendChild(grid);

  body.appendChild(el("div", { class: "grid grid-3", style: "margin-top:10px" },
    el("div", { class: "stat-box" }, el("div", { class: "k", text: "Speed" }), el("div", { class: "v", text: String(npc.speed ?? "—") })),
    el("div", { class: "stat-box" }, el("div", { class: "k", text: "H-to-H" }), el("div", { class: "v", text: npc.hthDamage || "—" })),
    el("div", { class: "stat-box" }, el("div", { class: "k", text: npc.rankLabel === "Villain" || npc.rank === "special" ? "Villain Pts" : "Points" }),
      el("div", { class: "v", text: String(npc.points ?? "—") }))
  ));

  if (npc.reputation !== undefined) {
    body.appendChild(el("p", { class: "small muted", style: "margin-top:8px", text: `Reputation ${npc.reputation}` }));
  }

  const skills = npc.skills || {};
  const keys = Object.keys(skills);
  if (keys.length) {
    const card = el("div", { class: "card flush", style: "margin-top:12px" });
    for (const k of keys.sort()) {
      const v = skills[k];
      const rank = typeof v === "object" ? (v.ability ? "Ability" : v.r) : v;
      const base = typeof v === "object" ? (v.ability ? 20 : v.b) : (npc.baseChances ? npc.baseChances[k] : null);
      card.appendChild(el("div", { class: "card-row" },
        el("span", { class: "grow", text: R.skillName(k) }),
        el("span", { class: "small muted", text: typeof rank === "number" ? "rank " + rank : String(rank) }),
        el("span", { class: "mono", text: base !== null && base !== undefined ? String(base) : "—" })));
    }
    body.appendChild(card);
  }

  if (npc.interaction) {
    const i = npc.interaction;
    body.appendChild(el("p", { class: "small muted", style: "margin-top:10px", text:
      `Interaction modifiers — Reaction ${signed(i.reaction)}, Persuasion ${signed(i.persuasion)}, Seduction ${signed(i.seduction)}, Interrogation ${signed(i.interrogation)}, Torture ${signed(i.torture)}. These apply when a player character uses that skill on them.` }));
  }
  if (npc.weaknesses && npc.weaknesses.length) {
    body.appendChild(el("p", { class: "small", text: "Weaknesses: " + npc.weaknesses.join(", ") }));
  }
  if (npc.idiosyncrasies) body.appendChild(el("p", { class: "small", text: "Idiosyncrasies: " + npc.idiosyncrasies }));
  if (npc.foe && npc.foe.length) body.appendChild(el("p", { class: "small muted", text: "Fields of Experience: " + npc.foe.join(", ") }));
  if (npc.background) body.appendChild(el("p", { class: "small muted", style: "margin-top:10px", text: npc.background }));
  if (npc.notes) for (const n of npc.notes) body.appendChild(el("p", { class: "small muted", text: n }));

  modal({ title: npc.name, body, actions: [{ label: "Close", kind: "primary" }] });
}

/* ---------------------------------------------------------------- progress tasks */

export function renderTasks(host) {
  const list = Store.tasks();
  const sec = el("div", { class: "section" },
    el("div", { class: "section-head" },
      el("div", { class: "section-title", text: "Progress tasks" }),
      el("button", { class: "btn sm", type: "button", onclick: () => openNewTask(host) }, "+ New")));

  sec.appendChild(el("p", { class: "small muted", text:
    "One tracker for every multi-roll effort in the game: healing over weeks, a long interrogation, data scrubbing, an extended chase, or a mission timetable." }));

  if (!list.length) {
    sec.appendChild(el("div", { class: "empty" }, el("p", { class: "muted", text: "No tasks running." })));
  }

  for (const t of list) {
    const card = el("div", { class: "card" });
    card.appendChild(el("div", { class: "row" },
      el("div", { class: "grow" },
        el("div", { style: "font-weight:600", text: t.name }),
        el("div", { class: "small muted", text: `${t.progress} / ${t.requirement}${t.unit ? " " + t.unit : ""}` })),
      el("button", { class: "btn sm ghost", type: "button", onclick: () => { Store.deleteTask(t.id); renderHostAgain(host); } }, "✕")
    ));

    const track = el("div", { class: "progress-track" });
    for (let i = 0; i < Math.min(t.requirement, 40); i++) {
      track.appendChild(el("button", {
        class: "progress-pip" + (i < t.progress ? " on" : ""), type: "button",
        "aria-label": `Set progress to ${i + 1}`,
        onclick: () => { t.progress = i + 1 === t.progress ? i : i + 1; Store.saveTask(t); renderHostAgain(host); }
      }));
    }
    card.appendChild(track);

    if (t.note) card.appendChild(el("p", { class: "small muted", text: t.note }));
    if (t.progress >= t.requirement) card.appendChild(el("div", { class: "banner ok", text: "Complete." }));
    sec.appendChild(card);
  }

  host.appendChild(sec);
}

function renderHostAgain(host) {
  // Re-render whichever screen owns this host.
  const ev = new CustomEvent("app:rerender");
  document.dispatchEvent(ev);
}

async function openNewTask(host) {
  const name = await promptModal("What is being tracked?", { title: "New progress task" });
  if (!name) return;
  const req = parseInt(await promptModal("How many steps to completion?", { title: name, type: "number", value: "6" }), 10);
  const note = await promptModal("Note (optional)", { title: name, value: "" });
  Store.saveTask({ id: uid("task"), name, requirement: clamp(Number.isFinite(req) ? req : 6, 1, 40), progress: 0, note: note || "" });
  renderHostAgain(host);
}

/* ---------------------------------------------------------------- lifecycle */

export function renderLifecycle(host) {
  const sec = el("div", { class: "section" },
    el("div", { class: "section-title", text: "Mission lifecycle" }));
  sec.appendChild(el("p", { class: "small muted", text:
    "The app owns these boundaries. Each fires its whole bundle at once, shows you exactly what changed, and can be undone in one step." }));

  const row = el("div", { class: "btn-row", style: "margin-top:10px" });
  for (const ev of D.LIFECYCLE_EVENTS) {
    row.appendChild(el("button", { class: "btn", type: "button", onclick: () => runLifecycle(ev.key, host) }, ev.name));
  }
  sec.appendChild(row);

  const undo = Store.peekUndo();
  if (undo) {
    sec.appendChild(el("div", { class: "banner", style: "margin-top:10px" },
      el("div", { class: "small", text: `Last boundary fired ${fmtDate(undo.ts)}.` }),
      el("button", { class: "btn sm", type: "button", style: "margin-top:6px", onclick: () => {
        if (Store.applyUndo()) { showToast("Reverted", "ok"); renderResourceHeader(); renderHostAgain(host); }
      } }, "Undo it")));
  }

  host.appendChild(sec);
}

export async function runLifecycle(key, host) {
  const ev = D.LIFECYCLE_EVENTS.find(e => e.key === key);
  if (!ev) return;

  const c = Store.activeCharacter();
  const preview = el("div", {});
  preview.appendChild(el("p", { class: "small muted", text: "This will:" }));
  for (const line of ev.effects) preview.appendChild(el("div", { class: "small", text: "• " + line }));

  let outcome = "success";
  let roleplay = 0;
  if (key === "mission" && c) {
    preview.appendChild(el("div", { class: "field-label", style: "margin-top:14px", text: "Mission outcome" }));
    const wrap = el("div", { class: "chip-wrap" });
    for (const o of ["success", "partial", "failure"]) {
      const mod = D.XP_MODIFIERS.find(m => m.key === o);
      wrap.appendChild(el("button", {
        class: "chip" + (outcome === o ? " on" : ""), type: "button",
        onclick: e => {
          outcome = o;
          for (const b of wrap.children) b.classList.remove("on");
          e.currentTarget.classList.add("on");
          updateXP();
        }
      }, `${o[0].toUpperCase() + o.slice(1)} ${signed(mod.value)}`));
    }
    preview.appendChild(wrap);

    preview.appendChild(el("label", { class: "field", style: "margin-top:12px" },
      el("span", { text: "Role-playing award (-250 to +750)" }),
      el("input", { type: "number", value: "0", min: -250, max: 750,
        oninput: e => { roleplay = parseInt(e.target.value, 10) || 0; updateXP(); } })));

    const xpLine = el("div", { class: "banner ok" });
    preview.appendChild(xpLine);
    function updateXP() {
      const xp = R.missionXP({ rank: c.identity.rank, outcome, roleplay });
      clear(xpLine);
      xpLine.appendChild(el("b", { text: `Experience: ${xp}` }));
      xpLine.appendChild(el("div", { class: "small", text:
        `500 base ${signed(R.RANK_BY_KEY[c.identity.rank].xpModifier)} rank ${signed(D.XP_MODIFIERS.find(m => m.key === outcome).value)} outcome ${signed(roleplay)} role-play` }));
    }
    updateXP();
  }

  const ok = await confirmModal(preview, { title: ev.name, okLabel: ev.name });
  if (!ok) return;

  Store.pushUndo(Store.snapshot());
  const changes = [];

  if (key === "scene") {
    Store.updateActive(x => {
      x.state.scenesFlags = {};
      x.state.combat = { aiming: false, cover: "none", posture: "standing", defensiveMove: false, ammo: x.state.combat.ammo || {} };
    });
    changes.push("Per-scene flags cleared: aim, cover, posture, defensive movement.");
    const s = Store.combatState();
    if (s.active) {
      for (const cb of s.combatants) { cb.acted = false; cb.declaration = ""; }
      Store.saveCombat(s);
      changes.push("Combatant declarations and acted flags reset.");
    }
  }

  if (key === "session") {
    Store.updateActive(x => {
      x.state.exhausted = false;
      x.state.restFlags = {};
      x.state.firstAidUsed = false;
    });
    changes.push("Exhaustion cleared and First Aid made available again for new wounds.");
    changes.push(`Rest reminders: ${D.EXHAUSTION_REST.carry} after carrying, ${D.EXHAUSTION_REST.runSwim} after running or swimming, ${D.EXHAUSTION_REST.stamina} for stamina.`);
  }

  if (key === "mission" && c) {
    const xp = R.missionXP({ rank: c.identity.rank, outcome, roleplay });
    Store.updateActive(x => {
      x.xp.total = (x.xp.total || 0) + xp;
      x.xp.log.push({ ts: Date.now(), amount: xp, outcome, roleplay });
      x.missions = (x.missions || 0) + 1;
      x.reputation = (x.reputation || 0) + 3;
      if (outcome === "success") x.state.heroPoints = (x.state.heroPoints || 0) + D.HERO_POINT_RULES.missionSuccessAward;
      x.advancedThisMission = { skills: [], attributes: [] };
      x.state.exhausted = false;
      x.state.firstAidUsed = false;
    });
    changes.push(`${xp} experience awarded.`);
    changes.push("Reputation +3 for completing the mission.");
    if (outcome === "success") changes.push("+1 Hero Point for a successful mission.");
    changes.push("Advancement unlocked: each Skill and Characteristic may rise by one.");
    changes.push("Equipment requisitioned with experience should be returned.");
  }

  modal({
    title: ev.name + " complete",
    body: el("div", {}, ...changes.map(t => el("p", { class: "small", text: "• " + t })),
      el("p", { class: "small muted", style: "margin-top:10px", text: "Use Undo on the combat screen to revert this in one step." })),
    actions: [{ label: "OK", kind: "primary" }]
  });

  renderResourceHeader();
  if (host) renderCombat(host);
}
