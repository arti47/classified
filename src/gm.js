/* gm.js — GM dashboard: party panel, NPC generator, rollable reference tables. */

import { el, clear, d10, d100, signed, pick, uid } from "./core.js";
import { modal, showToast, chooseModal, promptModal } from "./ui.js";
import * as D from "../data.js";
import * as R from "./rules.js";
import * as Store from "./store.js";
import * as Sync from "./sync.js";
import { derived, conditionSummary } from "./derived.js";
import { generateNPC, showNPC } from "./combat.js";
import { ENCOUNTER_TABLES, ENCOUNTERS, NPC_STEREOTYPES, NPC_CHARACTERISTIC_TABLES, NPC_CREATION_STEPS, INTERACTION_MODIFIER_NOTE, OSIRIS_OVERVIEW, OSIRIS_NPCS } from "../data-npcs.js";
import { ANIMALS } from "../data-monsters.js";

export function renderGM(host) {
  clear(host);

  host.appendChild(el("div", { class: "card" },
    el("h1", { text: "GM Screen" }),
    el("p", { class: "small muted", text: "Party state, the book's generators, and every rollable table in one place." })
  ));

  // Party
  const party = Store.allCharacters();
  const pSec = section("Party");
  if (!party.length) {
    pSec.appendChild(el("p", { class: "small muted", text: "No dossiers on this device." }));
  } else {
    const card = el("div", { class: "card flush" });
    for (const c of party) {
      const dv = derived(c);
      const conds = conditionSummary(c);
      card.appendChild(el("button", {
        class: "skill-row", type: "button",
        onclick: () => peekCharacter(c)
      },
        el("span", { class: "n" },
          el("div", { text: c.identity.name || "Unnamed" }),
          el("div", { class: "small muted", text:
            `${R.woundLevel(c.state.wound).name} · ${c.state.heroPoints} Hero · Rep ${c.reputation} · Speed ${dv.speed}` +
            (conds.length > 1 ? " · " + conds.map(x => x.name).join(", ") : "") })),
        el("span", { class: "b", text: String(dv.skillTotal) })
      ));
    }
    pSec.appendChild(card);
    pSec.appendChild(el("p", { class: "small muted", text:
      "The final column is the Skill Rank + Characteristic total the book uses to gauge rank: under 125 Rookie, 126-250 Agent, over 250 Special Agent." }));
  }
  host.appendChild(pSec);

  // Generators
  const gSec = section("Generators");
  const gRow = el("div", { class: "btn-row" });
  gRow.appendChild(el("button", { class: "btn", type: "button", onclick: () => rollEncounter("hot") }, "Hot encounter"));
  gRow.appendChild(el("button", { class: "btn", type: "button", onclick: () => rollEncounter("cold") }, "Cold encounter"));
  gRow.appendChild(el("button", { class: "btn", type: "button", onclick: () => openNPCGenerator() }, "Generate NPC"));
  gSec.appendChild(gRow);
  gSec.appendChild(el("p", { class: "small muted", text:
    "Hot areas are dangerous, or close on the trail. Cold areas are relative safety, or off the track." }));
  host.appendChild(gSec);

  // Reference
  const rSec = section("Reference tables");
  const tables = [
    { name: "Chase obstacles", go: () => obstacleTable() },
    { name: "Grenade scatter", go: () => grenadeScatter() },
    { name: "NPC build recipe", go: () => npcRecipe() },
    { name: "OSIRIS roster", go: () => osirisRoster() },
    { name: "Animals", go: () => animalList() },
    { name: "Equipment repair times", go: () => repairTable() }
  ];
  const card = el("div", { class: "card flush" });
  for (const t of tables) {
    card.appendChild(el("button", { class: "skill-row", type: "button", onclick: t.go }, el("span", { class: "n", text: t.name })));
  }
  rSec.appendChild(card);
  host.appendChild(rSec);

  // Broadcast
  const bSec = section("Broadcast");
  bSec.appendChild(el("p", { class: "small muted", text: Sync.statusLabel() }));
  bSec.appendChild(el("button", {
    class: "btn block", type: "button",
    onclick: async () => {
      const t = await promptModal("Message to the table", { title: "Broadcast" });
      if (!t) return;
      await Sync.broadcast(t);
      showToast(Sync.isEnabled() ? "Sent" : "Local mode — nothing to send", Sync.isEnabled() ? "ok" : "");
    }
  }, "Send a message"));
  host.appendChild(bSec);
}

function section(title) {
  const s = el("div", { class: "section" });
  s.appendChild(el("div", { class: "section-title", text: title }));
  return s;
}

/* ---------------------------------------------------------------- party peek */

function peekCharacter(c) {
  const dv = derived(c);
  const body = el("div", {});
  body.appendChild(el("div", { class: "grid grid-3" },
    ...D.CHARACTERISTICS.map(ch => el("div", { class: "stat-box" },
      el("div", { class: "k", text: ch.abbr }), el("div", { class: "v", text: String(c.attributes[ch.key]) })))));

  body.appendChild(el("div", { class: "grid grid-3", style: "margin-top:10px" },
    box("Speed", dv.speed), box("Hero", c.state.heroPoints), box("Rep", c.reputation),
    box("Wound", R.woundLevel(c.state.wound).name), box("H-to-H", dv.hthDamage), box("Carry", dv.carryRange)));

  const skills = Object.entries(c.skills).sort((a, b) => b[1] - a[1]);
  if (skills.length) {
    const card = el("div", { class: "card flush", style: "margin-top:12px" });
    for (const [k, rank] of skills) {
      card.appendChild(el("div", { class: "card-row" },
        el("span", { class: "grow", text: R.skillName(k) }),
        el("span", { class: "small muted", text: "rank " + rank }),
        el("span", { class: "mono", text: String(R.baseChance(k, c.attributes, rank, c.skills.charisma || 0)) })));
    }
    body.appendChild(card);
  }

  if (c.weaknesses.length) {
    body.appendChild(el("p", { class: "small", style: "margin-top:10px",
      text: "Weaknesses: " + c.weaknesses.map(k => R.WEAKNESS_BY_KEY[k]?.name).filter(Boolean).join(", ") }));
  }
  if (c.foe.length) {
    body.appendChild(el("p", { class: "small muted",
      text: "Fields of Experience: " + c.foe.map(k => R.FOE_BY_KEY[k]?.name).filter(Boolean).join(", ") }));
  }

  modal({ title: c.identity.name || "Dossier", body, wide: true, actions: [{ label: "Close", kind: "primary" }] });
}

function box(k, v) {
  return el("div", { class: "stat-box" },
    el("div", { class: "k", text: k }),
    el("div", { class: "v", style: String(v).length > 5 ? "font-size:14px" : "", text: String(v) }));
}

/* ---------------------------------------------------------------- encounters */

export function rollEncounter(zone) {
  const table = ENCOUNTER_TABLES[zone];
  const r1 = d10();
  const r2 = d10();
  const raw = table[r1 - 1][r2 - 1];

  const m = raw.match(/^([a-z]+)([+-]\d+)?$/);
  const key = m ? m[1] : raw;
  const modifier = m && m[2] ? parseInt(m[2], 10) : 0;

  const enc = ENCOUNTERS[key];
  const body = el("div", {});
  body.appendChild(el("p", { class: "small muted", text: `${zone === "hot" ? "Hot" : "Cold"} area · rolled ${r1}, ${r2}` }));

  if (!enc) {
    body.appendChild(el("p", { text: raw }));
    modal({ title: "Encounter", body, actions: [{ label: "Close", kind: "primary" }] });
    return;
  }

  body.appendChild(el("h3", { text: enc.name + (modifier ? ` (${signed(modifier)} on the sub-table)` : "") }));
  if (enc.base) body.appendChild(el("p", { text: enc.base }));

  if (enc.sub) {
    const sub = d10() + modifier;
    let row = enc.sub[enc.sub.length - 1];
    for (const s of enc.sub) { if (sub <= s.max) { row = s; break; } }
    body.appendChild(el("div", { class: "banner", style: "margin-top:10px" },
      el("b", { text: `Sub-table roll ${sub}` }),
      el("div", { class: "small", text: row.text })));
  }

  if (enc.note) body.appendChild(el("p", { class: "small muted", text: enc.note }));

  const actions = [{ label: "Close", kind: "primary" }];
  if (enc.heroPoint) {
    body.appendChild(el("div", { class: "banner warn", style: "margin-top:10px", text:
      "Ask the players whether they will spend a Hero Point BEFORE revealing which version this is." }));
    actions.unshift({
      label: "Reveal Hero Point version", kind: "ghost", close: false,
      onClick: () => modal({
        title: enc.name + " — Hero Point spent",
        body: el("p", { text: enc.hero }),
        actions: [{ label: "OK", kind: "primary" }]
      })
    });
  }
  actions.unshift({ label: "Re-roll", kind: "ghost", onClick: () => rollEncounter(zone) });

  modal({ title: "Random encounter", body, actions });
}

/* ---------------------------------------------------------------- NPC generator */

async function openNPCGenerator() {
  const stype = await chooseModal("Stereotype", NPC_STEREOTYPES
    .filter(s => NPC_CHARACTERISTIC_TABLES[s.key])
    .map(s => ({ key: s.key, label: s.name, desc: s.desc })));
  if (!stype) return;
  const rank = await chooseModal("Rank", D.RANKS.map(r => ({
    key: r.key, label: r.npcName, desc: `${r.name} equivalent · Hero/Villain Points ${r.npcHeroDice}`
  })));
  if (!rank) return;
  showNPC(generateNPC(stype, rank));
}

/* ---------------------------------------------------------------- tables */

function obstacleTable() {
  const body = el("div", {});
  for (const [zone, list] of Object.entries(D.CHASE_OBSTACLES)) {
    body.appendChild(el("div", { class: "section-title", style: "margin-top:12px", text: zone[0].toUpperCase() + zone.slice(1) }));
    const card = el("div", { class: "card flush" });
    for (const o of list) {
      card.appendChild(el("button", {
        class: "skill-row", type: "button",
        onclick: () => showToast(`DF ${o.df}: ${o.text}`)
      }, el("span", { class: "n", style: "white-space:normal", text: o.text }), el("span", { class: "b", text: String(o.df) })));
    }
    body.appendChild(card);
    body.appendChild(el("button", {
      class: "btn sm", type: "button", style: "margin-top:6px",
      onclick: () => { const o = pick(list); modal({ title: "Obstacle", body: el("div", {}, el("p", { text: o.text }), el("p", { class: "small muted", text: `Difficulty Factor ${o.df}` })), actions: [{ label: "OK", kind: "primary" }] }); }
    }, `Roll a ${zone} obstacle`));
  }
  modal({ title: "Chase obstacles", body, wide: true, actions: [{ label: "Close", kind: "primary" }] });
}

function grenadeScatter() {
  const body = el("div", {});
  body.appendChild(el("p", { class: "small", text: "Scatter distance is a percentage of the throw length; direction is a d10 around the clock." }));
  const t = el("table", { class: "data" });
  t.appendChild(el("tr", {}, el("th", { text: "Quality" }), el("th", { text: "Scatter" })));
  for (const q of [1, 2, 3, 4, 5]) {
    t.appendChild(el("tr", {}, el("th", { text: D.QUALITY_SHORT[q] }),
      el("td", { class: "num", text: Math.round(D.GRENADE_SCATTER[q] * 100) + "%" })));
  }
  body.appendChild(el("div", { class: "table-wrap" }, t));
  for (const n of D.GRENADE_NOTES) body.appendChild(el("p", { class: "small muted", text: n }));

  body.appendChild(el("button", {
    class: "btn block", style: "margin-top:10px", type: "button",
    onclick: async () => {
      const dist = parseInt(await promptModal("Throw distance in feet", { title: "Scatter", type: "number", value: "60" }), 10) || 60;
      const q = parseInt(await promptModal("Throw Success Quality (1-4, or 5 for a failure)", { title: "Scatter", type: "number", value: "3" }), 10) || 3;
      const dir = d10();
      const off = Math.round(dist * D.GRENADE_SCATTER[q]);
      modal({
        title: "Grenade scatter",
        body: el("div", {},
          el("p", { text: off === 0 ? "Lands exactly on target." : `Lands ${off} feet off target.` }),
          el("p", { class: "small muted", text: `Direction: ${dir} o'clock on the scatter dial.` })),
        actions: [{ label: "OK", kind: "primary" }]
      });
    }
  }, "Roll scatter"));

  for (const g of D.GRENADE_TYPES) {
    body.appendChild(el("details", { class: "acc" },
      el("summary", { text: g.name }),
      el("div", { class: "acc-body" },
        el("p", { class: "small", text: g.desc }),
        el("p", { class: "small muted", text: `Radius ${g.radius} ft · ${g.price ? "$" + g.price : ""}` }))));
  }

  modal({ title: "Grenades", body, wide: true, actions: [{ label: "Close", kind: "primary" }] });
}

function npcRecipe() {
  const body = el("div", {});
  body.appendChild(el("p", { class: "small", text: "The book's ten-step NPC process. Steps five onwards are usually skipped for a walk-on." }));
  const card = el("div", { class: "card flush" });
  for (let i = 0; i < NPC_CREATION_STEPS.length; i++) {
    card.appendChild(el("div", { class: "card-row" },
      el("span", { class: "mono", text: String(i + 1) }),
      el("span", { class: "grow small", text: NPC_CREATION_STEPS[i] })));
  }
  body.appendChild(card);
  body.appendChild(el("p", { class: "small muted", style: "margin-top:10px", text: INTERACTION_MODIFIER_NOTE }));

  const t = el("table", { class: "data" });
  t.appendChild(el("tr", {}, el("th", { text: "Stereotype" }), el("th", { text: "Punk/Rookie" }), el("th", { text: "Villain/Special" })));
  for (const s of NPC_STEREOTYPES) {
    t.appendChild(el("tr", {},
      el("td", { text: s.name }),
      el("td", { class: "num", text: s.rookieMod === null || s.rookieMod === undefined ? "n/a" : signed(s.rookieMod) }),
      el("td", { class: "num", text: s.villainMod ? signed(s.villainMod) : "—" })));
  }
  body.appendChild(el("div", { class: "table-wrap" }, t));
  modal({ title: "NPC build recipe", body, wide: true, actions: [{ label: "Close", kind: "primary" }] });
}

function osirisRoster() {
  const body = el("div", {});
  body.appendChild(el("p", { class: "small", text: OSIRIS_OVERVIEW.goal }));
  for (const d of OSIRIS_OVERVIEW.departments) {
    body.appendChild(el("details", { class: "acc" },
      el("summary", { text: d.name }),
      el("div", { class: "acc-body" },
        el("p", { class: "small", style: "font-weight:600", text: d.ruler }),
        el("p", { class: "small muted", text: d.desc }))));
  }
  const card = el("div", { class: "card flush", style: "margin-top:12px" });
  for (const n of OSIRIS_NPCS) {
    card.appendChild(el("button", { class: "skill-row", type: "button", onclick: () => showNPC(n) },
      el("span", { class: "n", text: n.name }),
      el("span", { class: "r", text: n.rankLabel })));
  }
  body.appendChild(card);
  modal({ title: "OSIRIS", body, wide: true, actions: [{ label: "Close", kind: "primary" }] });
}

function animalList() {
  const body = el("div", {});
  const card = el("div", { class: "card flush" });
  for (const a of ANIMALS) {
    card.appendChild(el("button", {
      class: "skill-row", type: "button",
      onclick: () => showNPC({ ...a, attrs: { str: a.str, dex: a.dex, wil: a.wil, per: a.per, int: a.int } })
    },
      el("span", { class: "n", text: a.name }),
      el("span", { class: "r", text: a.hthBase ? `Base ${a.hthBase}` : "special" }),
      el("span", { class: "b", text: a.hthDamage || "—" })));
  }
  body.appendChild(card);
  modal({ title: "Animals", body, actions: [{ label: "Close", kind: "primary" }] });
}

function repairTable() {
  const body = el("div", {});
  const t = el("table", { class: "data" });
  t.appendChild(el("tr", {}, el("th", { text: "Vehicle damage" }), el("th", { text: "Repair multiplier" })));
  for (const r of D.EQUIPMENT_REPAIR_MULTIPLIER) {
    t.appendChild(el("tr", {}, el("td", { text: R.woundLevel(r.wound).name }), el("td", { class: "num", text: "×" + r.multiplier })));
  }
  body.appendChild(el("div", { class: "table-wrap" }, t));
  body.appendChild(el("p", { class: "small muted", text:
    "Multiply the skill's listed repair time. Driving repairs take 6 hours base, so a Killed car is 72 hours. Larger vehicles should take proportionally longer." }));

  const t2 = el("table", { class: "data" });
  t2.appendChild(el("tr", {}, el("th", { text: "Skill" }), el("th", { text: "Repair time" })));
  for (const s of D.SKILLS.filter(x => x.repair)) {
    t2.appendChild(el("tr", {}, el("td", { text: s.name }), el("td", { style: "white-space:normal", text: s.repair })));
  }
  body.appendChild(el("div", { class: "table-wrap" }, t2));
  modal({ title: "Equipment repair", body, wide: true, actions: [{ label: "Close", kind: "primary" }] });
}
