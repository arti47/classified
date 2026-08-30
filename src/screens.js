/* screens.js — home, rules library, roll log, advancement, settings and about. */

import { el, clear, money, signed, dfLabel, fmtDate, clamp } from "./core.js";
import { modal, showToast, confirmModal, promptModal, chooseModal } from "./ui.js";
import * as D from "../data.js";
import * as R from "./rules.js";
import * as Store from "./store.js";
import * as SettingsMod from "./settings.js";
import { Settings, TOGGLE_ROWS } from "./settings.js";
import * as Sync from "./sync.js";
import { derived, skillList, validate, expectedRankFor, conditionSummary } from "./derived.js";
import { navigate } from "./router.js";
import { appendHelp, openGlossary, glossaryRow, offerSolo } from "./help.js";
import { glossaryFind } from "../data-help.js";
import { ANIMALS } from "../data-monsters.js";
import { OSIRIS_NPCS, OSIRIS_OVERVIEW, NPC_STEREOTYPES, NPC_CREATION_STEPS, INTERACTION_MODIFIER_NOTE } from "../data-npcs.js";

/* ---------------------------------------------------------------- home */

export function renderHome(host) {
  clear(host);
  const c = Store.activeCharacter();

  host.appendChild(el("div", { class: "card" },
    el("h1", { text: "Classified" }),
    el("p", { class: "small muted", text: "The role-playing game of covert operations. Player companion." })
  ));

  appendHelp(host, "home");
  // The first-run card already carries Create a character as its first step, so the empty
  // state under it would be the same button twice.
  const started = appendStartHere(host, c);

  if (!c) {
    if (!started) host.appendChild(el("div", { class: "empty" },
      el("div", { class: "big", text: "🗄" }),
      el("h2", { text: "No dossier open" }),
      el("p", { class: "muted", text: "Create an operative and the sheet, roller and trackers come alive." }),
      el("button", { class: "btn primary", type: "button", onclick: () => navigate("create") }, "Create a character")
    ));
  } else {
    const dv = derived(c);
    host.appendChild(el("div", { class: "card" },
      el("div", { class: "row" },
        el("div", { class: "grow" },
          el("h2", { text: c.identity.name || "Unnamed operative" }),
          el("div", { class: "small muted", text:
            `${R.RANK_BY_KEY[c.identity.rank]?.name || ""} · ${R.woundLevel(c.state.wound).name} · ${c.state.heroPoints} Hero Points` })),
        el("button", { class: "btn sm primary", type: "button", onclick: () => navigate("sheet") }, "Open")
      )
    ));

    const conds = conditionSummary(c);
    if (conds.length) {
      host.appendChild(el("div", { class: "banner warn", text:
        conds.map(x => x.name + (x.dfMod ? ` (${signed(x.dfMod)} DF)` : "")).join(" · ") }));
    }
  }

  const quick = el("div", { class: "grid grid-2", style: "margin-top:6px" });
  const tile = (label, sub, go) => el("button", {
    class: "opt-btn", type: "button", onclick: go
  }, el("span", { class: "on-name" }, el("span", { text: label })), el("span", { class: "on-desc", text: sub }));

  quick.appendChild(tile("Roll", "Every check the book defines", () => {
    const ch = Store.activeCharacter();
    if (!ch) { showToast("Create a character first", "err"); return; }
    import("./roller.js").then(m => m.openQuickRoll(ch));
  }));
  quick.appendChild(tile("Combat", "Declaration and action order", () => navigate("combat")));
  quick.appendChild(tile("Rules", "Searchable reference", () => navigate("rules")));
  quick.appendChild(tile("Roll log", "Re-derive any roll", () => navigate("log")));
  quick.appendChild(tile("How to play", "Start a game, keep it going, end it well", () => navigate("play")));
  quick.appendChild(tile("Tutorial", "One mission played, start to finish", () => navigate("tutorial")));
  // The Solo tile is here whether or not the toggle is on: a screen you have to know about
  // before you can find it is a screen a new player never finds (N1).
  quick.appendChild(Settings.solo()
    ? tile("Solo", "Mythic: Fate, chaos, scenes, tables", () => navigate("solo"))
    : tile("Play solo", "No group? Mythic runs the game", () => offerSolo()));
  quick.appendChild(tile("Glossary", "What the words on screen mean", () => openGlossary()));
  host.appendChild(quick);

  const log = Store.rollLog().slice(0, 5);
  if (log.length) {
    host.appendChild(el("div", { class: "section-title", style: "margin-top:16px", text: "Recent rolls" }));
    const card = el("div", { class: "card flush" });
    for (const r of log) card.appendChild(logRow(r));
    host.appendChild(card);
  }

  host.appendChild(el("p", { class: "small muted", style: "margin-top:20px", text: D.OGL_NOTICE }));
}

/**
 * The first-run card: what to do, in order, for someone who has opened the app knowing
 * nothing about it (N9). It ticks the steps it can see are done, and it goes away on its own
 * once there is a dossier with a roll behind it — or on Hide this, whichever comes first.
 */
function appendStartHere(host, c) {
  if (!Settings.startHere()) return false;
  if (c && Store.rollLog().length) return false;

  const steps = [
    { done: !!c, label: "Create an operative",
      sub: "Point-buy your own, or tap a published sample character to start immediately.",
      action: "Create a character", go: () => navigate("create") },
    { done: Store.rollLog().length > 0, label: "Learn how a game runs",
      sub: "Start a game, keep it going, end it well — the guide ticks itself off as you play.",
      action: "How to play", go: () => navigate("play") },
    { done: Settings.solo(), label: "Play solo, without a group",
      sub: "Mythic answers the questions a referee would, so nobody has to run the game.",
      action: "Turn on solo play", go: () => offerSolo() }
  ];

  const box = el("div", { class: "card start-here" },
    el("div", { class: "row" },
      el("h2", { class: "grow", style: "margin:0", text: "New here?" }),
      el("button", {
        class: "btn sm ghost", type: "button",
        onclick: () => { SettingsMod.set("startHere", false); renderHome(host); }
      }, "Hide this")));
  box.appendChild(el("p", { class: "small muted", style: "margin:2px 0 0", text: "Three things, in order. Each one is a tap." }));

  for (const st of steps) {
    const row = el("div", { class: "card-row col" },
      el("b", { text: (st.done ? "✓ " : "") + st.label }),
      el("span", { class: "small muted", text: st.sub }));
    if (!st.done) {
      row.appendChild(el("button", { class: "btn sm", type: "button", style: "margin-top:6px", onclick: st.go }, st.action));
    }
    box.appendChild(row);
  }

  box.appendChild(el("p", { class: "small muted", style: "margin-top:10px", text:
    "Every screen carries a collapsed “How to use” panel, and the Glossary tile explains any word you meet. Both are in Settings if you want them gone." }));
  host.appendChild(box);
  return true;
}

/* ---------------------------------------------------------------- roll log */

function logRow(r) {
  // Solo rows carry a Mythic outcome, not a Classified Success Quality: the Quality columns
  // are meaningless for a Fate answer, so they are not printed for one.
  if (r.solo) {
    return el("div", { class: "log-entry" },
      el("span", { class: "lr", text: String(r.roll) }),
      el("div", { class: "ld" },
        el("div", { class: "lt" },
          el("b", { text: r.label }), " ",
          el("span", { class: "pill neutral", text: r.outcome || "—" })),
        el("div", { class: "lm", text: ["Solo (Mythic)", r.note].filter(Boolean).join(" · ") }),
        el("div", { class: "lm", text: `${r.by || ""} · ${fmtDate(r.ts)}` })
      )
    );
  }
  return el("div", { class: "log-entry" },
    el("span", { class: "lr", text: String(r.roll) }),
    el("div", { class: "ld" },
      el("div", { class: "lt" },
        el("b", { text: r.label }), " ",
        el("span", { class: "pill q" + r.quality, text: D.QUALITY_SHORT[r.quality] })),
      el("div", { class: "lm", text:
        `Base ${r.baseChance ?? "—"} × DF ${r.df ? dfLabel(r.df) : "—"} = SC ${r.successChance ?? "—"}` +
        (r.modifiers && r.modifiers.length ? " · " + r.modifiers.map(m => `${m.name} ${signed(m.value)}`).join(", ") : "") +
        (r.heroSpent ? ` · ${r.heroSpent} Hero Point(s) spent` : "") +
        (r.note ? " · " + r.note : "") }),
      el("div", { class: "lm", text: `${r.by || ""} · ${fmtDate(r.ts)}` })
    )
  );
}

export function renderLog(host) {
  clear(host);
  const log = Store.rollLog();

  appendHelp(host, "log");

  host.appendChild(el("div", { class: "section-head" },
    el("div", { class: "section-title", text: `Roll log (${log.length})` }),
    log.length ? el("button", {
      class: "btn sm ghost", type: "button",
      onclick: async () => {
        if (await confirmModal("Clear the roll log?", { danger: true, okLabel: "Clear" })) { Store.clearLog(); renderLog(host); }
      }
    }, "Clear") : null));

  host.appendChild(el("p", { class: "small muted", text:
    `Every roll is recorded with enough detail to re-derive it. The last ${Store.ROLL_LOG_CAP} are kept.` }));

  if (!log.length) {
    // An empty state with nothing to tap is a dead end: say where rolls come from (N6).
    const empty = el("div", { class: "empty" },
      el("p", { class: "muted", text: "Nothing rolled yet." }),
      el("p", { class: "small muted", text: "Rolls land here from the sheet, the roller, combat and the Solo screen." }));
    const c = Store.activeCharacter();
    empty.appendChild(c
      ? el("button", { class: "btn primary", type: "button",
          onclick: () => import("./roller.js").then(m => m.openQuickRoll(c)) }, "Roll something")
      : el("button", { class: "btn primary", type: "button", onclick: () => navigate("create") }, "Create a character"));
    host.appendChild(empty);
    return;
  }

  const card = el("div", { class: "card flush" });
  for (const r of log) card.appendChild(logRow(r));
  host.appendChild(card);

  appendSharedLog(host, log);
}

/**
 * The rest of the table's rolls. Kept as its own section rather than merged into the local
 * log: the local log is what this device rolled and can re-derive, and a shared row belongs
 * to someone else's dossier. In local mode nothing is fetched and nothing is shown.
 */
function appendSharedLog(host, local) {
  if (!Sync.isEnabled() || !Sync.currentCampaign()) return;
  const sec = el("div", { class: "section", style: "margin-top:18px" },
    el("div", { class: "section-title", text: "The table's rolls" }));
  const card = el("div", { class: "card flush" });
  sec.appendChild(card);
  sec.appendChild(el("p", { class: "small muted", text: "Live from the campaign, newest first." }));
  host.appendChild(sec);

  const seen = new Set(local.map(r => r.id));
  Sync.watch("rollLog", val => {
    clear(card);
    const rows = val ? Object.values(val) : [];
    const others = rows.filter(r => r && !seen.has(r.id)).sort((a, b) => (b.ts || 0) - (a.ts || 0)).slice(0, 25);
    if (!others.length) {
      card.appendChild(el("div", { class: "card-row" },
        el("span", { class: "small muted", text: "Nothing from the rest of the table yet." })));
      return;
    }
    for (const r of others) card.appendChild(logRow(r));
  }).catch(() => {});
}

/* ---------------------------------------------------------------- rules library */

export function openRulesTopic(key) {
  const topic = D.RULES_TOPICS.find(t => t.key === key);
  if (!topic) return;
  modal({
    title: topic.title,
    body: el("div", {}, ...topic.body.map(t => el("p", { text: t }))),
    actions: [{ label: "Close", kind: "primary" }]
  });
}

export function renderRules(host) {
  clear(host);

  appendHelp(host, "rules");

  const search = el("input", { type: "search", placeholder: "Search rules, skills, tables, gear…" });
  host.appendChild(search);
  const results = el("div", { style: "margin-top:12px" });
  host.appendChild(results);

  function draw() {
    clear(results);
    const q = search.value.trim().toLowerCase();

    if (q) {
      const hits = [];
      for (const t of D.RULES_TOPICS) {
        if (t.title.toLowerCase().includes(q) || t.body.some(b => b.toLowerCase().includes(q))) {
          hits.push({ label: t.title, sub: "Procedure", go: () => openRulesTopic(t.key) });
        }
      }
      for (const s of D.SKILLS) {
        if (s.name.toLowerCase().includes(q) || s.desc.toLowerCase().includes(q)) {
          hits.push({ label: s.name, sub: "Skill · " + R.formulaLabel(s.key), go: () => showSkill(s) });
        }
      }
      for (const w of D.WEAPONS) {
        if (w.name.toLowerCase().includes(q)) hits.push({ label: w.name, sub: "Weapon", go: () => navigate("gear") });
      }
      for (const g of D.GEAR) {
        if (g.name.toLowerCase().includes(q)) hits.push({ label: g.name, sub: g.cat, go: () => navigate("gear") });
      }
      // A newcomer searching "difficulty factor" wants the sentence, not the procedure (N7).
      for (const g of glossaryFind(q)) {
        hits.push({ label: g.term, sub: "Glossary", go: () => openGlossary(g.term) });
      }
      for (const f of D.FIELDS_OF_EXPERIENCE) {
        if (f.name.toLowerCase().includes(q)) {
          hits.push({ label: f.name, sub: "Field of Experience", go: () => modal({ title: f.name, body: el("p", { text: f.desc }), actions: [{ label: "OK", kind: "primary" }] }) });
        }
      }

      if (!hits.length) { results.appendChild(el("p", { class: "muted", text: "No matches." })); return; }
      const card = el("div", { class: "card flush" });
      for (const h of hits.slice(0, 40)) {
        card.appendChild(el("button", { class: "skill-row", type: "button", onclick: h.go },
          el("span", { class: "n", text: h.label }),
          el("span", { class: "r", text: h.sub })));
      }
      results.appendChild(card);
      return;
    }

    // Plain English first: every term below assumes you know the words, and a new player
    // does not (N7).
    const gCard = el("div", { class: "card flush" });
    gCard.appendChild(glossaryRow());
    results.appendChild(gCard);

    // Topics
    results.appendChild(el("div", { class: "section-title", style: "margin-top:16px", text: "Core procedures" }));
    const tCard = el("div", { class: "card flush" });
    for (const t of D.RULES_TOPICS) {
      tCard.appendChild(el("button", { class: "skill-row", type: "button", onclick: () => openRulesTopic(t.key) },
        el("span", { class: "n", text: t.title })));
    }
    results.appendChild(tCard);

    // Tables
    results.appendChild(el("div", { class: "section-title", style: "margin-top:16px", text: "Tables" }));
    const tables = [
      { name: "Success Quality Table", go: successQualityTable },
      { name: "Wound Rank Table", go: woundRankTable },
      { name: "Wound Rank Accumulation", go: accumulationTable },
      { name: "Area Weapon Damage", go: areaTable },
      { name: "Fire Combat Modifiers", go: () => modTable("Fire Combat Modifiers", D.FIRE_COMBAT_MODS, D.FIRE_COMBAT_NOTES) },
      { name: "Hand-to-Hand Actions", go: hthTable },
      { name: "Chase Manoeuvres & Accidents", go: chaseTable },
      { name: "Persuade Table", go: () => gridTable("Persuade Table", D.PERSUADE_TABLE, "NPC Willpower", D.PERSUADE_RESULT_TEXT) },
      { name: "Interrogation & Torture", go: coercionTable },
      { name: "Reputation Table", go: reputationTable },
      { name: "Gambling Tables", go: gamblingTables },
      { name: "Skill Time and Information", go: timeInfoTable },
      { name: "Experience Costs", go: xpTable },
      { name: "Falls, Scars and Stuns", go: miscTable }
    ];
    const tblCard = el("div", { class: "card flush" });
    for (const t of tables) {
      tblCard.appendChild(el("button", { class: "skill-row", type: "button", onclick: t.go },
        el("span", { class: "n", text: t.name })));
    }
    results.appendChild(tblCard);

    // Skills
    results.appendChild(el("div", { class: "section-title", style: "margin-top:16px", text: "Skills" }));
    const sCard = el("div", { class: "card flush" });
    for (const s of D.SKILLS) {
      sCard.appendChild(el("button", { class: "skill-row", type: "button", onclick: () => showSkill(s) },
        el("span", { class: "n", text: s.name }),
        el("span", { class: "r", text: R.formulaLabel(s.key) })));
    }
    results.appendChild(sCard);

    // Bestiary
    results.appendChild(el("div", { class: "section-title", style: "margin-top:16px", text: "Animals" }));
    const aCard = el("div", { class: "card flush" });
    for (const a of ANIMALS) {
      aCard.appendChild(el("button", { class: "skill-row", type: "button",
        onclick: () => import("./combat.js").then(m => m.showNPC({ ...a, attrs: { str: a.str, dex: a.dex, wil: a.wil, per: a.per, int: a.int }, points: undefined })) },
        el("span", { class: "n", text: a.name }),
        el("span", { class: "r", text: a.hthDamage ? "Damage Rank " + a.hthDamage : "special" })));
    }
    results.appendChild(aCard);

    // OSIRIS
    results.appendChild(el("div", { class: "section-title", style: "margin-top:16px", text: "OSIRIS" }));
    results.appendChild(el("p", { class: "small muted", text: OSIRIS_OVERVIEW.goal }));
    const oCard = el("div", { class: "card flush" });
    for (const n of OSIRIS_NPCS) {
      oCard.appendChild(el("button", { class: "skill-row", type: "button",
        onclick: () => import("./combat.js").then(m => m.showNPC(n)) },
        el("span", { class: "n", text: n.name }),
        el("span", { class: "r", text: n.title })));
    }
    results.appendChild(oCard);
  }

  search.addEventListener("input", draw);
  draw();
}

function showSkill(s) {
  const c = Store.activeCharacter();
  const body = el("div", {});
  body.appendChild(el("p", { text: s.desc }));
  const t = el("table", { class: "data" });
  const rows = [
    ["Formula", R.formulaLabel(s.key) + " + Skill Rank"],
    ["Base time", s.baseTime || "—"],
    ["Repair time", s.repair || "n/a"],
    ["Group", s.group]
  ];
  if (c) {
    rows.push(["Your Base Chance", String(R.baseChance(s.key, c.attributes, c.skills[s.key] || 0, c.skills.charisma || 0))]);
    rows.push(["Your rank cap", String(R.maxSkillRank(s.key, c.attributes))]);
  }
  for (const [k, v] of rows) t.appendChild(el("tr", {}, el("th", { text: k }), el("td", { text: String(v) })));
  body.appendChild(el("div", { class: "table-wrap" }, t));

  const actions = [{ label: "Close", kind: "primary" }];
  if (c && !s.multi) {
    actions.unshift({ label: "Roll it", kind: "ghost", onClick: () => import("./roller.js").then(m => m.openRoll({ character: c, skillKey: s.key })) });
  }
  modal({ title: s.name, body, actions });
}

/* ---------------------------------------------------------------- table views */

function tableModal(title, node, notes = []) {
  const body = el("div", {}, el("div", { class: "table-wrap" }, node));
  for (const n of notes) body.appendChild(el("p", { class: "small muted", text: n }));
  modal({ title, body, wide: true, actions: [{ label: "Close", kind: "primary" }] });
}

function successQualityTable() {
  const t = el("table", { class: "data" });
  t.appendChild(el("tr", {},
    el("th", { text: "Success Chance" }), el("th", { text: "Superb (1)" }),
    el("th", { text: "Great (2)" }), el("th", { text: "Good (3)" }), el("th", { text: "Fair (4)" })));
  for (let n = 1; n <= 30; n++) {
    const sc = n * 10;
    const b = D.qualityBands(sc);
    const rng = r => r ? (r[0] === r[1] ? String(r[0]) : `${r[0]}-${r[1]}`) : "—";
    t.appendChild(el("tr", {},
      el("td", { class: "num", text: `${(n - 1) * 10 + 1}-${sc}` }),
      el("td", { class: "num", text: rng(b.superb) }),
      el("td", { class: "num", text: rng(b.great) }),
      el("td", { class: "num", text: rng(b.good) }),
      el("td", { class: "num", text: sc <= 100 ? `${b.fair ? b.fair[0] : "—"}-SC` : rng(b.fair) })));
  }
  tableModal("Success Quality Table", t, [
    "Success Chance = Base Chance × Difficulty Factor, capped at 300.",
    "A d100 of 100 always fails. Above Success Chance 100, only a 100 fails.",
    "Two printed cells are typesetting errors and are corrected here: row 161-170 prints Good 35-85 and Fair 85-99, which overlap at 85; and the Multiplication Table prints 8×7 as 46 and 23×10 as 260."
  ]);
}

function woundRankTable() {
  const t = el("table", { class: "data" });
  t.appendChild(el("tr", {}, el("th", { text: "Quality" }), ...D.DAMAGE_RANKS.map(r => el("th", { text: r }))));
  for (const q of [1, 2, 3, 4]) {
    t.appendChild(el("tr", {},
      el("th", { text: D.QUALITY_SHORT[q] }),
      ...D.DAMAGE_RANKS.map(r => el("td", { text: R.woundLevel(D.WOUND_RANK_TABLE[q][r]).name.replace(" Wound", "") }))));
  }
  tableModal("Wound Rank Table", t, [
    "Close range adds one Damage Rank; long range subtracts one.",
    "Specific Fire and Targeted Blows add two Wound Ranks on a hit.",
    "A character may spend one Hero Point per Wound Rank to reduce the damage taken."
  ]);
}

function accumulationTable() {
  const keys = ["light", "medium", "heavy", "incap"];
  const t = el("table", { class: "data" });
  t.appendChild(el("tr", {}, el("th", { text: "Old \\ New" }), ...keys.map(k => el("th", { text: R.woundLevel(k).name }))));
  for (const oldK of keys) {
    t.appendChild(el("tr", {},
      el("th", { text: R.woundLevel(oldK).name }),
      ...keys.map(newK => el("td", { text: R.woundLevel(D.WOUND_ACCUMULATION[oldK][newK]).name }))));
  }
  tableModal("Wound Rank Accumulation", t, ["Wounds are additive: a fresh wound on top of an old one produces the worse rank shown."]);
}

function areaTable() {
  const t = el("table", { class: "data" });
  t.appendChild(el("tr", {}, el("th", { text: "Damage Rank" }),
    el("th", { text: "under 10 ft" }), el("th", { text: "11-20 ft" }), el("th", { text: "21-30 ft" }), el("th", { text: "31-40 ft" })));
  for (const [rank, bands] of Object.entries(D.AREA_DAMAGE)) {
    t.appendChild(el("tr", {}, el("th", { text: rank }),
      ...bands.map(b => el("td", { text: R.woundLevel(b.w).name.replace(" Wound", "") }))));
  }
  tableModal("Area Weapon Damage", t, [
    "Not every weapon with Damage Rank H-L deals area damage. The M240B, for instance, does not.",
    "Grenades scatter by a percentage of the throw length: 20% on a Great, 30% on a Good, 40% on a Fair, 50% on a failure."
  ]);
}

function modTable(title, list, notes) {
  const t = el("table", { class: "data" });
  t.appendChild(el("tr", {}, el("th", { text: "Modifier" }), el("th", { text: "Situation" })));
  for (const m of list) {
    t.appendChild(el("tr", {}, el("td", { class: "num", text: signed(m.value) }), el("td", { style: "white-space:normal", text: m.name })));
  }
  tableModal(title, t, notes);
}

function hthTable() {
  const t = el("table", { class: "data" });
  t.appendChild(el("tr", {}, el("th", { text: "Action" }), el("th", { text: "DF" }), el("th", { text: "Effect" })));
  for (const a of D.HTH_ACTIONS) {
    t.appendChild(el("tr", {},
      el("td", { text: a.name }),
      el("td", { class: "num", text: a.fixedDF ? "DF " + a.fixedDF : signed(a.mod) }),
      el("td", { style: "white-space:normal;max-width:340px", text: a.desc })));
  }
  tableModal("Hand-to-Hand Combat", t, D.HTH_NOTES);
}

function chaseTable() {
  const body = el("div", {});
  const t = el("table", { class: "data" });
  t.appendChild(el("tr", {}, el("th", { text: "Manoeuvre" }), el("th", { text: "Control DF" }),
    ...[0.5, 1, 2, 3, 4, 5, 6, 7].map(b => el("th", { text: "bid " + dfLabel(b) }))));
  for (const mv of D.CHASE_MANEUVERS) {
    const row = D.ACCIDENT_TABLE[mv.key];
    t.appendChild(el("tr", {},
      el("td", { text: mv.name }),
      el("td", { class: "num", text: String(mv.controlDF) }),
      ...[0.5, 1, 2, 3, 4, 5, 6, 7].map(b => el("td", { class: "num", text: R.woundLevel(D.ACCIDENT_CODE_TO_WOUND[row[b]]).name.replace(" Wound", "") }))));
  }
  body.appendChild(el("div", { class: "table-wrap" }, t));
  body.appendChild(el("p", { class: "small muted", text: "Accident damage is to the VEHICLE. Occupants take one rank less, seat belts another, airbags one more on a single three-rank hit." }));
  for (const mv of D.CHASE_MANEUVERS) {
    body.appendChild(el("details", { class: "acc" },
      el("summary", { text: mv.name }),
      el("div", { class: "acc-body" },
        el("p", { class: "small", text: mv.desc }),
        el("p", { class: "small muted", text: "Legal at: " + mv.ranges.join(", ") }))));
  }
  modal({ title: "Chases", body, wide: true, actions: [{ label: "Close", kind: "primary" }] });
}

function gridTable(title, rows, rowLabel, legend) {
  const t = el("table", { class: "data" });
  t.appendChild(el("tr", {}, el("th", { text: rowLabel }),
    ...[1, 2, 3, 4].map(q => el("th", { text: D.QUALITY_SHORT[q] }))));
  for (const r of rows) {
    t.appendChild(el("tr", {}, el("th", { text: r.label }),
      ...[1, 2, 3, 4].map(q => el("td", { class: "num", text: r.r[q] }))));
  }
  const notes = legend ? Object.entries(legend).map(([k, v]) => `${k} — ${v}`) : [];
  tableModal(title, t, notes);
}

function coercionTable() {
  const t = el("table", { class: "data" });
  t.appendChild(el("tr", {}, el("th", { text: "Victim Willpower" }),
    ...[1, 2, 3, 4, 5].map(q => el("th", { text: D.QUALITY_SHORT[q] }))));
  for (const r of D.COERCION_TABLE) {
    t.appendChild(el("tr", {}, el("th", { text: r.label }),
      ...[1, 2, 3, 4, 5].map(q => el("td", { class: "num", text: D.QUALITY_SHORT[r.r[q]] }))));
  }
  tableModal("Interrogation and Torture", t, [
    "Cross-reference your Success Quality against the victim's Willpower for a modified Quality, then read the information gained from the Skill Time and Information table.",
    "Interrogation takes 18 hours; each session after the first is +1 Difficulty Factor, and sleep resets that.",
    "Torture takes 10 hours. A Fair result or failure inflicts a Medium Wound unless the victim passes out first.",
    D.TORTURE_RESIST.desc
  ]);
}

function reputationTable() {
  const t = el("table", { class: "data" });
  t.appendChild(el("tr", {}, el("th", { text: "Reputation" }), ...[1, 2, 3, 4].map(q => el("th", { text: D.QUALITY_SHORT[q] }))));
  for (const r of D.REPUTATION_TABLE) {
    t.appendChild(el("tr", {}, el("th", { text: r.label }), ...[1, 2, 3, 4].map(q => el("td", { class: "num", text: r.results[q] }))));
  }
  const notes = Object.entries(D.REPUTATION_RESULT_TEXT).map(([k, v]) => `${k} — ${v}`);
  notes.push("Gains: " + D.REPUTATION_GAINS.map(g => `${g.name} +${g.value}`).join("; ") + ".");
  notes.push(`Faking a death cuts ${D.REPUTATION_REDUCTION.fakeDeath.amount} points until you are recognised again. Data scrubbing costs ${D.REPUTATION_REDUCTION.dataScrub.xpPerPoint} experience per point and takes ${D.REPUTATION_REDUCTION.dataScrub.duration}.`);
  tableModal("Reputation Table", t, notes);
}

function gamblingTables() {
  const body = el("div", {});
  for (const g of D.GAMBLING_GAMES) {
    body.appendChild(el("div", { class: "section-title", style: "margin-top:12px", text: g.name }));
    body.appendChild(el("p", { class: "small muted", text: g.desc }));
    const t = el("table", { class: "data" });
    t.appendChild(el("tr", {}, el("th", { text: "1st \\ 2nd" }), ...[1, 2, 3, 4, 5].map(q => el("th", { text: D.QUALITY_SHORT[q] }))));
    for (const q1 of [1, 2, 3, 4, 5]) {
      t.appendChild(el("tr", {}, el("th", { text: D.QUALITY_SHORT[q1] }),
        ...[1, 2, 3, 4, 5].map(q2 => el("td", { class: "num", text: g.table[q1][q2] }))));
    }
    body.appendChild(el("div", { class: "table-wrap" }, t));
  }
  for (const [k, v] of Object.entries(D.GAMBLING_CODE_TEXT)) body.appendChild(el("p", { class: "small muted", text: `${k} — ${v}` }));
  for (const n of D.GAMBLING_NOTES) body.appendChild(el("p", { class: "small muted", text: n }));
  modal({ title: "Gambling", body, wide: true, actions: [{ label: "Close", kind: "primary" }] });
}

function timeInfoTable() {
  const t = el("table", { class: "data" });
  t.appendChild(el("tr", {}, el("th", { text: "Quality" }), el("th", { text: "Time" }), el("th", { text: "Information" })));
  for (const q of [1, 2, 3, 4, 5]) {
    const row = D.SKILL_TIME_INFO[q];
    t.appendChild(el("tr", {}, el("th", { text: D.QUALITY_SHORT[q] }),
      el("td", { text: row.timeLabel }), el("td", { text: row.info })));
  }
  tableModal("Skill Time and Information", t, [
    "Every skill lists a base time. A better Quality does the job faster and reveals more.",
    "Information rolls are usually made by the GM so the player cannot judge reliability from the die."
  ]);
}

function xpTable() {
  const body = el("div", {});
  const t1 = el("table", { class: "data" });
  t1.appendChild(el("tr", {}, el("th", { text: "Modifier" }), el("th", { text: "Amount" })));
  for (const m of D.XP_MODIFIERS) t1.appendChild(el("tr", {}, el("td", { style: "white-space:normal", text: m.name }), el("td", { class: "num", text: signed(m.value) })));
  body.appendChild(el("p", { class: "small", text: `Base award: ${D.XP_BASE_PER_MISSION} per completed mission.` }));
  body.appendChild(el("div", { class: "table-wrap" }, t1));

  const t2 = el("table", { class: "data" });
  t2.appendChild(el("tr", {}, el("th", { text: "Purchase" }), el("th", { text: "Cost" })));
  for (const [, v] of Object.entries(D.XP_COSTS)) {
    t2.appendChild(el("tr", {}, el("td", { style: "white-space:normal", text: v.label }), el("td", { class: "num", text: v.flat ? String(v.flat) : "formula" })));
  }
  body.appendChild(el("div", { class: "table-wrap" }, t2));
  body.appendChild(el("p", { class: "small muted", text: D.XP_ADVANCE_GATE }));
  modal({ title: "Experience", body, wide: true, actions: [{ label: "Close", kind: "primary" }] });
}

function miscTable() {
  const body = el("div", {});

  body.appendChild(el("div", { class: "section-title", text: "Falling" }));
  const t1 = el("table", { class: "data" });
  t1.appendChild(el("tr", {}, el("th", { text: "Distance" }), el("th", { text: "Damage" })));
  let lo = 0;
  for (const f of D.FALL_DAMAGE) {
    t1.appendChild(el("tr", {},
      el("td", { class: "num", text: f.max === Infinity ? "over 250 ft" : `${lo + 1}-${f.max} ft` }),
      el("td", { text: R.woundLevel(f.wound).name })));
    lo = f.max === Infinity ? lo : f.max;
  }
  body.appendChild(el("div", { class: "table-wrap" }, t1));
  body.appendChild(el("p", { class: "small muted", text: "On a failed Mountaineering roll, roll d100 for the percentage of the climb completed when the fall begins." }));

  body.appendChild(el("div", { class: "section-title", style: "margin-top:14px", text: "Stun duration" }));
  const t2 = el("table", { class: "data" });
  t2.appendChild(el("tr", {}, el("th", { text: "d100" }), el("th", { text: "Rounds" })));
  let plo = 0;
  for (const s of D.STUN_TABLE) {
    t2.appendChild(el("tr", {}, el("td", { class: "num", text: `${plo + 1}-${s.max}` }), el("td", { class: "num", text: String(s.rounds) })));
    plo = s.max;
  }
  body.appendChild(el("div", { class: "table-wrap" }, t2));

  body.appendChild(el("div", { class: "section-title", style: "margin-top:14px", text: "Scars" }));
  body.appendChild(el("p", { class: "small", text: "Scar chance: Medium Wound 5%, Heavy Wound 15%, Incapacitation 25%." }));
  const t3 = el("table", { class: "data" });
  t3.appendChild(el("tr", {}, el("th", { text: "d100" }), el("th", { text: "Location" })));
  let slo = 0;
  for (const s of D.SCAR_LOCATIONS) {
    t3.appendChild(el("tr", {}, el("td", { class: "num", text: `${slo + 1}-${s.max}` }), el("td", { text: s.name })));
    slo = s.max;
  }
  body.appendChild(el("div", { class: "table-wrap" }, t3));
  body.appendChild(el("p", { class: "small muted", text: `A visible scar adds ${D.SCAR_REPUTATION} Reputation. Covered by clothing it costs nothing until revealed.` }));

  modal({ title: "Falls, Stuns and Scars", body, wide: true, actions: [{ label: "Close", kind: "primary" }] });
}

/* ---------------------------------------------------------------- advancement */

export function renderAdvance(host) {
  clear(host);
  const c = Store.activeCharacter();
  if (!c) {
    // "No character." was the whole screen, with nothing to tap and nothing explained (N3).
    appendHelp(host, "advance");
    host.appendChild(el("div", { class: "empty" },
      el("div", { class: "big", text: "▲" }),
      el("h2", { text: "No dossier open" }),
      el("p", { class: "muted", text: "Advancement spends the experience a dossier has earned, so it needs one open. Experience is paid at the end of a mission." }),
      el("button", { class: "btn primary", type: "button", onclick: () => navigate("create") }, "Create a character")));
    return;
  }

  const available = (c.xp.total || 0) - (c.xp.spent || 0);
  const dv = derived(c);

  appendHelp(host, "advance");

  host.appendChild(el("div", { class: "card" },
    el("div", { class: "grid grid-3" },
      el("div", { class: "stat-box" }, el("div", { class: "k", text: "Available" }), el("div", { class: "v", text: String(available) })),
      el("div", { class: "stat-box" }, el("div", { class: "k", text: "Earned" }), el("div", { class: "v", text: String(c.xp.total || 0) })),
      el("div", { class: "stat-box" }, el("div", { class: "k", text: "Missions" }), el("div", { class: "v", text: String(c.missions || 0) }))),
    el("p", { class: "small muted", style: "margin-top:10px", text: D.XP_ADVANCE_GATE })
  ));

  host.appendChild(el("div", { class: "btn-row" },
    el("button", { class: "btn sm", type: "button", onclick: async () => {
      const v = await promptModal("Add experience points", { title: "Experience", type: "number", value: "500" });
      const n = parseInt(v, 10);
      if (Number.isFinite(n)) { Store.updateActive(x => { x.xp.total = (x.xp.total || 0) + n; }); renderAdvance(host); renderRes(); }
    } }, "Add XP"),
    el("button", { class: "btn sm", type: "button", onclick: () => import("./combat.js").then(m => m.runLifecycle("mission", null)) }, "End mission")
  ));

  // Characteristics
  const attrSec = el("div", { class: "section" }, el("div", { class: "section-title", text: "Characteristics" }));
  for (const ch of D.CHARACTERISTICS) {
    const cur = c.attributes[ch.key];
    const next = cur + 1;
    const cost = R.xpCharacteristicCost(next);
    const gated = c.advancedThisMission.attributes.includes(ch.key);
    const canAfford = available >= cost && next <= D.CHARACTERISTIC_MAX;

    attrSec.appendChild(el("div", { class: "card-row" },
      el("div", { class: "grow" },
        el("div", { text: `${ch.name} ${cur} → ${next}` }),
        el("div", { class: "small muted", text: gated ? "Already raised this mission" : `${cost} experience (150 × ${next})` })),
      el("button", {
        class: "btn sm" + (canAfford && !gated ? " primary" : ""), type: "button",
        disabled: !canAfford || gated || next > D.CHARACTERISTIC_MAX,
        onclick: () => {
          Store.updateActive(x => {
            x.attributes[ch.key] = next;
            x.xp.spent = (x.xp.spent || 0) + cost;
            x.advancedThisMission.attributes.push(ch.key);
            x.xp.log.push({ ts: Date.now(), amount: -cost, what: `${ch.name} to ${next}` });
          });
          showToast(`${ch.name} raised to ${next}`, "ok");
          renderAdvance(host); renderRes();
        }
      }, "Raise")
    ));
  }
  host.appendChild(attrSec);

  // Skills
  const skSec = el("div", { class: "section" }, el("div", { class: "section-title", text: "Skills" }));
  const trained = skillList(c, { includeUntrained: false });
  for (const s of trained.sort((a, b) => a.name.localeCompare(b.name))) {
    const next = s.rank + 1;
    const cost = R.xpSkillRankCost(next);
    const gated = c.advancedThisMission.skills.includes(s.key);
    const atCap = next > s.maxRank;
    const canAfford = available >= cost;

    skSec.appendChild(el("div", { class: "card-row" },
      el("div", { class: "grow" },
        el("div", { text: `${s.name} ${s.rank} → ${next}` }),
        el("div", { class: "small muted", text:
          atCap ? `At the cap of ${s.maxRank} — raise the underlying characteristic first`
            : gated ? "Already raised this mission"
            : `${cost} experience (30 × ${next}) · Base Chance ${s.base} → ${Math.min(D.MAX_BASE_CHANCE, s.base + 1)}` })),
      el("button", {
        class: "btn sm" + (canAfford && !gated && !atCap ? " primary" : ""), type: "button",
        disabled: !canAfford || gated || atCap,
        onclick: () => {
          Store.updateActive(x => {
            x.skills[s.key] = next;
            x.xp.spent = (x.xp.spent || 0) + cost;
            x.advancedThisMission.skills.push(s.key);
            x.xp.log.push({ ts: Date.now(), amount: -cost, what: `${s.name} to rank ${next}` });
          });
          showToast(`${s.name} raised to ${next}`, "ok");
          renderAdvance(host); renderRes();
        }
      }, "Raise")
    ));
  }

  skSec.appendChild(el("button", {
    class: "btn block", style: "margin-top:10px", type: "button",
    onclick: async () => {
      const untrained = skillList(c, { includeUntrained: true }).filter(s => !s.trained);
      const key = await chooseModal("Learn a new skill", untrained.map(s => ({
        key: s.key, label: s.name, right: `${D.XP_COSTS.newSkill.flat} XP`, desc: R.SKILL_BY_KEY[s.key].desc
      })), { intro: `A new skill costs ${D.XP_COSTS.newSkill.flat} experience and starts at rank 1.` });
      if (!key) return;
      const cost = D.XP_COSTS.newSkill.flat;
      if (available < cost) { showToast("Not enough experience", "err"); return; }
      Store.updateActive(x => {
        x.skills[key] = 1;
        x.xp.spent = (x.xp.spent || 0) + cost;
        x.xp.log.push({ ts: Date.now(), amount: -cost, what: `Learned ${R.skillName(key)}` });
      });
      renderAdvance(host); renderRes();
    }
  }, `+ Learn a new skill (${D.XP_COSTS.newSkill.flat} XP)`));
  host.appendChild(skSec);

  // Reputation
  const repSec = el("div", { class: "section" }, el("div", { class: "section-title", text: "Reputation" }));
  repSec.appendChild(el("div", { class: "card" },
    el("div", { class: "row" },
      el("div", { class: "grow" },
        el("div", { class: "mono", style: "font-size:24px", text: String(c.reputation || 0) }),
        el("div", { class: "small muted", text: D.REPUTATION_TABLE.find(r => (c.reputation || 0) <= r.max).label + " band" })),
      el("button", {
        class: "btn sm", type: "button",
        disabled: available < D.REPUTATION_REDUCTION.dataScrub.xpPerPoint || (c.reputation || 0) <= 0,
        onclick: async () => {
          const v = await promptModal(`Points to scrub (${D.REPUTATION_REDUCTION.dataScrub.xpPerPoint} XP each, ${D.REPUTATION_REDUCTION.dataScrub.duration})`,
            { title: "Data scrubbing", type: "number", value: "1" });
          const n = parseInt(v, 10);
          if (!Number.isFinite(n) || n < 1) return;
          const cost = n * D.REPUTATION_REDUCTION.dataScrub.xpPerPoint;
          if (cost > available) { showToast("Not enough experience", "err"); return; }
          Store.updateActive(x => {
            x.reputation = Math.max(0, (x.reputation || 0) - n);
            x.xp.spent = (x.xp.spent || 0) + cost;
            x.xp.log.push({ ts: Date.now(), amount: -cost, what: `Scrubbed ${n} Reputation` });
          });
          renderAdvance(host); renderRes();
        }
      }, "Data scrub")),
    el("p", { class: "small muted", style: "margin-top:8px", text:
      `Faking a death cuts ${D.REPUTATION_REDUCTION.fakeDeath.amount} points temporarily. ${D.REPUTATION_REDUCTION.fakeDeath.note}` })
  ));
  const gainRow = el("div", { class: "chip-wrap" });
  for (const g of D.REPUTATION_GAINS) {
    gainRow.appendChild(el("button", {
      class: "chip", type: "button",
      onclick: () => { Store.updateActive(x => { x.reputation = (x.reputation || 0) + g.value; }); renderAdvance(host); renderRes(); }
    }, `${g.name} +${g.value}`));
  }
  repSec.appendChild(gainRow);
  host.appendChild(repSec);

  if ((c.xp.log || []).length) {
    const logSec = el("div", { class: "section" }, el("div", { class: "section-title", text: "Advancement log" }));
    const card = el("div", { class: "card flush" });
    for (const l of [...c.xp.log].reverse().slice(0, 25)) {
      card.appendChild(el("div", { class: "card-row" },
        el("span", { class: "grow small", text: l.what || (l.outcome ? `Mission (${l.outcome})` : "Experience") }),
        el("span", { class: "mono small", text: signed(l.amount) }),
        el("span", { class: "small muted", text: fmtDate(l.ts) })));
    }
    logSec.appendChild(card);
    host.appendChild(logSec);
  }

  function renderRes() { import("./sheet.js").then(m => m.renderResourceHeader()); }
}

/* ---------------------------------------------------------------- settings */

/**
 * The campaign panel: create one, join one with its code, see who is in it, leave it.
 *
 * Every action works with no keys configured — `sync.js` falls back to a local campaign
 * record — so the flow can be walked through and tested on one device, and the same taps do
 * the real thing once keys are in place. Without keys the panel says so rather than
 * pretending the party is shared.
 */
function campaignCard(host) {
  const card = el("div", { class: "card" });
  const c = Sync.currentCampaign();
  const live = Sync.isEnabled();

  card.appendChild(el("p", { class: "small", text: Sync.statusLabel() }));

  if (c) {
    card.appendChild(el("div", { class: "card flush", style: "margin-top:10px" },
      el("div", { class: "card-row" },
        el("div", { class: "grow" },
          el("div", { style: "font-weight:600", text: c.name || "Untitled campaign" }),
          el("div", { class: "small muted", text: `${c.role === "gm" ? "Game master" : "Player"}${c.local ? " · local only" : ""}` })),
        el("span", { class: "mono", text: c.joinCode })),
      el("div", { class: "card-row" },
        el("div", { class: "grow small muted", text: "Share the join code with the table." }),
        el("button", { class: "btn sm", type: "button",
          onclick: () => copyJoinCode(c.joinCode) }, "Copy code"))));

    const party = el("div", { style: "margin-top:10px" });
    card.appendChild(party);
    renderParty(party, c);

    card.appendChild(el("div", { class: "btn-row", style: "margin-top:10px" },
      el("button", { class: "btn sm", type: "button",
        onclick: () => pickSeat(host, c) }, "Which dossier am I playing?"),
      el("button", { class: "btn sm danger", type: "button", onclick: async () => {
        if (await confirmModal(`Leave “${c.name}”? Your dossiers and roll log stay on this device.`,
          { title: "Leave the campaign", okLabel: "Leave", danger: true })) {
          Sync.leaveCampaign();
          renderSettings(host);
        }
      } }, "Leave")));
  } else {
    card.appendChild(el("div", { class: "btn-row", style: "margin-top:10px" },
      el("button", { class: "btn sm primary", type: "button", onclick: async () => {
        const name = await promptModal("What is the campaign called?", {
          title: "Create a campaign", placeholder: "Operation Midnight"
        });
        if (name === null) return;
        const made = await Sync.createCampaign(name.trim() || "Untitled campaign", "gm");
        renderSettings(host);
        modal({
          title: "Campaign created",
          body: el("div", {},
            el("p", { class: "small", text: "The join code is how the rest of the table gets in:" }),
            el("div", { class: "roll-result" }, el("div", { class: "roll-quality", text: made.joinCode })),
            el("p", { class: "small muted", text: made.local
              ? "No Firebase keys are configured, so this campaign lives on this device only. The code will work once keys are in place."
              : "Anyone with this code can join from their own device." })),
          actions: [
            { label: "Copy code", kind: "ghost", close: false, onClick: () => copyJoinCode(made.joinCode) },
            { label: "Done", kind: "primary" }
          ]
        });
      } }, "Create a campaign"),
      el("button", { class: "btn sm", type: "button", onclick: async () => {
        const code = await promptModal("Join code", { title: "Join a campaign", placeholder: "red-dragon-sword" });
        if (code === null || !code.trim()) return;
        const who = Store.activeCharacter();
        try {
          await Sync.joinCampaign(code.trim().toLowerCase(),
            who ? (who.identity.name || "Agent") : "Agent", who ? who.id : null);
          showToast("Joined", "ok");
        } catch (e) {
          showToast(e.message || "Could not join that campaign", "err");
        }
        renderSettings(host);
      } }, "Join with a code")));
  }

  card.appendChild(el("p", { class: "small muted", style: "margin-top:10px", text: live
    ? "Characters, rolls and the combat tracker are mirrored to the campaign as you play."
    : "Local-first by default. Drop real keys into firebase-config.js, set FIREBASE_ENABLED to true, deploy database.rules.json, then turn on the multiplayer toggle above." }));
  return card;
}

function copyJoinCode(code) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(code).then(() => showToast("Join code copied", "ok"),
      () => showToast(code, ""));
    return;
  }
  showToast(code, "");
}

/** Who is at the table. Falls back to this device's own seat when nothing is shared yet. */
function renderParty(hostEl, c) {
  clear(hostEl);
  hostEl.appendChild(el("div", { class: "field-label", text: "Party" }));
  const list = el("div", { class: "card flush" });
  hostEl.appendChild(list);

  const seat = (name, sub) => el("div", { class: "card-row" },
    el("div", { class: "grow" },
      el("div", { text: name }),
      el("div", { class: "small muted", text: sub })));

  const mine = c.characterId ? Store.getCharacter(c.characterId) : Store.activeCharacter();
  list.appendChild(seat(mine ? (mine.identity.name || "Unnamed operative") : "No dossier chosen",
    `This device · ${c.role === "gm" ? "game master" : "player"}`));

  Sync.members().then(all => {
    const others = all.filter(m => m.uid !== (Sync.currentUser() || {}).uid);
    if (!others.length) return;
    for (const m of others) {
      list.appendChild(seat(m.displayName || "Agent", m.role === "gm" ? "Game master" : "Player"));
    }
  }).catch(() => {});
}

/** Say which dossier this device is bringing, so the rest of the table sees the right name. */
async function pickSeat(host, c) {
  const chars = Store.allCharacters();
  if (!chars.length) { showToast("No dossiers on this device", "err"); return; }
  const pick = await chooseModal("Which dossier am I playing?", chars.map(x => ({
    key: x.id, label: x.identity.name || "Unnamed", desc: R.RANK_BY_KEY[x.identity.rank]?.name || ""
  })));
  if (!pick) return;
  const ch = Store.getCharacter(pick);
  Store.setActive(pick);
  await Sync.setMember({ characterId: pick, displayName: ch.identity.name || "Agent" });
  renderSettings(host);
}

export function renderSettings(host) {
  clear(host);

  appendHelp(host, "settings");

  host.appendChild(el("div", { class: "section" }, el("div", { class: "section-title", text: "Campaign style" })));
  host.appendChild(el("p", { class: "small muted", text: "Style decides when Hero Points are earned and how forgiving the table is." }));
  for (const s of D.CAMPAIGN_STYLES) {
    host.appendChild(el("button", {
      class: "opt-btn" + (Settings.campaignStyle() === s.key ? " on" : ""), type: "button",
      onclick: () => { SettingsMod.set("campaignStyle", s.key); renderSettings(host); }
    },
      el("span", { class: "on-name" }, el("span", { text: s.name + (s.isDefault ? " (default)" : "") }),
        el("span", { class: "mono small", text: s.failure })),
      el("span", { class: "on-desc", text: s.desc }),
      el("span", { class: "on-desc", text: "Hero Points: " + s.heroPointRule })
    ));
  }

  host.appendChild(el("div", { class: "section", style: "margin-top:18px" }, el("div", { class: "section-title", text: "Theme" })));
  const themeWrap = el("div", { class: "chip-wrap" });
  for (const t of ["system", "light", "dark"]) {
    themeWrap.appendChild(el("button", {
      class: "chip" + (Settings.theme() === t ? " on" : ""), type: "button",
      onclick: () => { SettingsMod.set("theme", t); SettingsMod.applyTheme(); renderSettings(host); }
    }, t === "system" ? "Follow system" : t[0].toUpperCase() + t.slice(1)));
  }
  host.appendChild(themeWrap);

  host.appendChild(el("div", { class: "section", style: "margin-top:18px" }, el("div", { class: "section-title", text: "Toggles" })));
  const togCard = el("div", { class: "card" });
  for (const row of TOGGLE_ROWS) {
    const input = el("input", {
      type: "checkbox", checked: !!SettingsMod.get(row.key),
      onchange: e => {
        SettingsMod.set(row.key, e.target.checked);
        if (row.key === "gmScreen" || row.key === "multiplayer" || row.key === "solo") {
          import("./router.js").then(m => m.rebuildNav());
        }
        if (row.key === "showUntrained") showToast("Applied on the sheet");
      }
    });
    togCard.appendChild(el("label", { class: "toggle-row" },
      input,
      el("div", { class: "grow" },
        el("div", { class: "t-name", text: row.name }),
        el("div", { class: "t-desc", text: row.desc }))));
  }
  host.appendChild(togCard);

  host.appendChild(el("div", { class: "section", style: "margin-top:18px" }, el("div", { class: "section-title", text: "Backup" })));
  host.appendChild(el("p", { class: "small muted", text:
    "Characters live in this browser's storage. Export regularly — clearing site data wipes them." }));
  host.appendChild(el("div", { class: "btn-row" },
    el("button", { class: "btn primary", type: "button", onclick: () => { Store.downloadBackup(); showToast("Backup downloaded", "ok"); } }, "Export JSON"),
    el("button", { class: "btn", type: "button", onclick: () => openImport(host) }, "Import JSON")
  ));

  /* Wiping is one tap away from the export that makes it safe, on purpose: the two belong
   * to the same decision. Each wipe names what it will destroy and how much of it, and
   * neither touches the other's data. */
  const chars = Store.allCharacters().length;
  const missions = Store.soloAdventures().length;

  host.appendChild(el("div", { class: "section", style: "margin-top:18px" }, el("div", { class: "section-title", text: "Wipe data" })));
  host.appendChild(el("p", { class: "small muted", text:
    "There is no undo for these, and no copy anywhere else. Export a backup first if there is any chance you want it back." }));
  host.appendChild(el("div", { class: "btn-row" },
    el("button", {
      class: "btn danger", type: "button", disabled: !missions,
      onclick: () => wipeMissions(host)
    }, missions ? `Wipe all missions (${missions})` : "No missions"),
    el("button", {
      class: "btn danger", type: "button", disabled: !chars,
      onclick: () => wipeCharacters(host)
    }, chars ? `Wipe all characters (${chars})` : "No characters")
  ));

  host.appendChild(el("div", { class: "section", style: "margin-top:18px" }, el("div", { class: "section-title", text: "Multiplayer" })));
  host.appendChild(campaignCard(host));

  host.appendChild(el("div", { class: "section", style: "margin-top:18px" }, el("div", { class: "section-title", text: "About" })));
  host.appendChild(el("div", { class: "card" },
    el("p", { class: "small", text: D.OGL_NOTICE }),
    el("p", { class: "small muted", text:
      "This is a personal play aid built from the rulebook. Rules text is paraphrased, never reproduced; no setting, adventure or art content is included." }),
    el("p", { class: "small muted", text: "Every value here comes from the core rulebook. Nothing is invented." })
  ));

  const val = Store.activeCharacter() ? validate(Store.activeCharacter()) : null;
  if (val && (val.errors.length || val.warnings.length)) {
    host.appendChild(el("div", { class: "banner warn" },
      el("b", { text: "Current character" }),
      ...val.errors.map(e => el("div", { class: "small", text: "• " + e })),
      ...val.warnings.map(e => el("div", { class: "small", text: "• " + e }))));
  }
}

async function wipeMissions(host) {
  const n = Store.soloAdventures().length;
  const ok = await confirmModal(
    `Delete ${n} solo mission${n === 1 ? "" : "s"}? Every Chaos Factor, scene count, thread, character list and journal goes with them. Your dossiers are not touched.`,
    { title: "Wipe all missions", danger: true, okLabel: `Delete ${n === 1 ? "it" : "them all"}` });
  if (!ok) return;
  const gone = Store.wipeAdventures();
  showToast(`${gone} mission${gone === 1 ? "" : "s"} deleted`, "ok");
  renderSettings(host);
}

async function wipeCharacters(host) {
  const n = Store.allCharacters().length;
  const ok = await confirmModal(
    `Delete ${n} dossier${n === 1 ? "" : "s"}? Characters, gear, wounds, experience and scars all go. The roll log and your solo missions are not touched.`,
    { title: "Wipe all characters", danger: true, okLabel: `Delete ${n === 1 ? "it" : "them all"}` });
  if (!ok) return;
  const gone = Store.wipeCharacters();
  showToast(`${gone} dossier${gone === 1 ? "" : "s"} deleted`, "ok");
  import("./sheet.js").then(m => m.renderResourceHeader());
  renderSettings(host);
}

function openImport(host) {
  const input = el("input", { type: "file", accept: "application/json,.json" });
  const modeSel = el("select", {},
    el("option", { value: "merge", text: "Merge with what is here (newest wins)" }),
    el("option", { value: "replace", text: "Replace everything" }));
  const body = el("div", {},
    el("label", { class: "field" }, el("span", { text: "Backup file" }), input),
    el("label", { class: "field" }, el("span", { text: "Mode" }), modeSel));

  modal({
    title: "Import backup",
    body,
    actions: [
      { label: "Cancel", kind: "ghost" },
      { label: "Import", kind: "primary", close: false, onClick: async api => {
        const file = input.files && input.files[0];
        if (!file) { showToast("Choose a file", "err"); return false; }
        try {
          const text = await file.text();
          const n = Store.importJSON(text, modeSel.value);
          showToast(`Imported ${n} character${n === 1 ? "" : "s"}`, "ok");
          api.close();
          renderSettings(host);
          import("./sheet.js").then(m => m.renderResourceHeader());
        } catch (e) {
          showToast("Import failed: " + e.message, "err");
          return false;
        }
      } }
    ]
  });
}
