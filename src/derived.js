/* derived.js — character-derived calculations, normalization and migration. */

import { clamp, uid, SCHEMA_VERSION } from "./core.js";
import * as D from "../data.js";
import * as R from "./rules.js";

/* ---------------------------------------------------------------- factory */

export function blankCharacter(rank = "rookie") {
  const rankRow = R.RANK_BY_KEY[rank] || R.RANK_BY_KEY.rookie;
  return {
    id: uid("char"),
    schema: SCHEMA_VERSION,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    owner: null,
    campaignId: null,
    identity: {
      name: "", gender: "", rank,
      // Height and weight are independent purchases: each draws its own Creation Point
      // cost and its own Reputation from its own row of the Physical Traits Table.
      heightBand: 4, weightBand: 4, appearance: "normal",
      height: "", weight: "", age: D.PROFESSION_RULES.startAge,
      profession: null, professionYears: 0,
      organisation: "", cover: "", portraitUrl: "", notes: ""
    },
    attributes: { str: 5, dex: 5, wil: 5, per: 5, int: 5 },
    // Every character begins with Charisma and Driving at rank 1 [Ch.2].
    skills: Object.fromEntries(D.STARTING_SKILLS.map(k => [k, 1])),
    languages: [],                    // [{name, rank}]
    abilities: { chosen: null },      // fourth ability key
    foe: [],                          // Field of Experience keys
    weaknesses: [],                   // weakness keys
    state: {
      wound: "none", stunRounds: 0, exhausted: false,
      heroPoints: rankRow.heroPoints,
      conditions: {},                 // key -> true
      firstAidUsed: false,
      scenesFlags: {},                // per-scene flags (aim, cover, defensive...)
      restFlags: {},
      combat: { aiming: false, cover: "none", posture: "standing", defensiveMove: false, ammo: {} }
    },
    reputation: 0,
    scars: [],                        // [{location, note}]
    inventory: { items: [], money: 0 },
    vehicles: [],
    xp: { total: 0, spent: 0, log: [] },
    advancedThisMission: { skills: [], attributes: [] },
    missions: 0,
    log: []                           // local roll log
  };
}

/* ---------------------------------------------------------------- migration */

export function normalize(c) {
  if (!c || typeof c !== "object") return blankCharacter();
  const base = blankCharacter(c.identity?.rank || "rookie");

  const out = { ...base, ...c };
  out.identity = { ...base.identity, ...(c.identity || {}) };
  // Migration: characters saved before height and weight were separable carried a single
  // bandIndex. Back-fill both bands from it so old dossiers keep their frame.
  if (c.identity && c.identity.bandIndex !== undefined) {
    if (c.identity.heightBand === undefined) out.identity.heightBand = c.identity.bandIndex;
    if (c.identity.weightBand === undefined) out.identity.weightBand = c.identity.bandIndex;
    delete out.identity.bandIndex;
  }
  out.attributes = { ...base.attributes, ...(c.attributes || {}) };
  out.state = { ...base.state, ...(c.state || {}) };
  out.state.conditions = { ...(c.state?.conditions || {}) };
  out.state.scenesFlags = { ...(c.state?.scenesFlags || {}) };
  out.state.restFlags = { ...(c.state?.restFlags || {}) };
  out.state.combat = { ...base.state.combat, ...(c.state?.combat || {}) };
  out.inventory = { ...base.inventory, ...(c.inventory || {}) };
  out.inventory.items = Array.isArray(c.inventory?.items) ? c.inventory.items.map(normalizeItem) : [];
  out.xp = { ...base.xp, ...(c.xp || {}) };
  out.xp.log = Array.isArray(c.xp?.log) ? c.xp.log : [];
  out.skills = { ...(c.skills || {}) };
  out.languages = Array.isArray(c.languages) ? c.languages : [];
  out.abilities = { ...base.abilities, ...(c.abilities || {}) };
  out.foe = Array.isArray(c.foe) ? c.foe : [];
  out.weaknesses = Array.isArray(c.weaknesses) ? c.weaknesses : [];
  out.scars = Array.isArray(c.scars) ? c.scars : [];
  out.vehicles = Array.isArray(c.vehicles) ? c.vehicles : [];
  out.log = Array.isArray(c.log) ? c.log : [];
  out.advancedThisMission = {
    skills: Array.isArray(c.advancedThisMission?.skills) ? c.advancedThisMission.skills : [],
    attributes: Array.isArray(c.advancedThisMission?.attributes) ? c.advancedThisMission.attributes : []
  };
  out.missions = Number(c.missions) || 0;
  out.reputation = Number(c.reputation) || 0;
  if (!out.id) out.id = uid("char");
  out.schema = SCHEMA_VERSION;

  // Every character begins with Charisma and Driving at rank 1.
  for (const k of D.STARTING_SKILLS) if (!(k in out.skills)) out.skills[k] = 1;

  return out;
}

function normalizeItem(it) {
  return {
    id: it.id || uid("item"),
    key: it.key || null,
    kind: it.kind || "gear",     // weapon | armor | gear | custom
    name: it.name || "Item",
    qty: Number(it.qty) || 1,
    weight: Number(it.weight) || 0,
    equipped: !!it.equipped,
    notes: it.notes || "",
    price: Number(it.price) || 0
  };
}

/* ---------------------------------------------------------------- derived */

export function derived(c) {
  const a = c.attributes;
  const charismaRank = c.skills.charisma || 0;
  return {
    speed: R.speedValue(a.per, a.dex),
    carryRange: R.carryRange(a.str),
    carryMax: R.carryMax(a.str),
    runSwim: R.runSwimMinutes(a.wil),
    stamina: R.staminaHours(a.wil),
    hthDamage: R.hthDamageRank(a.str),
    drawBonus: R.drawBonus(R.speedValue(a.per, a.dex)),
    charismaRank,
    normalMove: R.speedValue(a.per, a.dex) * 10,
    defensiveMove: R.speedValue(a.per, a.dex) * 5,
    carriedWeight: carriedWeight(c),
    skillTotal: skillCharacteristicTotal(c)
  };
}

export function carriedWeight(c) {
  return (c.inventory.items || []).reduce((t, i) => t + (Number(i.weight) || 0) * (Number(i.qty) || 1), 0);
}

/** The book's rank-expectation yardstick: Skill Ranks + Characteristics combined. */
export function skillCharacteristicTotal(c) {
  const attrs = Object.values(c.attributes).reduce((t, v) => t + (Number(v) || 0), 0);
  const skills = Object.values(c.skills).reduce((t, v) => t + (Number(v) || 0), 0);
  const langs = (c.languages || []).reduce((t, l) => t + (Number(l.rank) || 0), 0);
  return attrs + skills + langs;
}

export function expectedRankFor(total) {
  if (total < 126) return "Rookie / Punk";
  if (total <= 250) return "Agent / Criminal";
  return "Special Agent / Villain";
}

/* ---------------------------------------------------------------- skills */

/** All skills with base chances, sorted, including untrained entries. */
export function skillList(c, { includeUntrained = true } = {}) {
  const charismaRank = c.skills.charisma || 0;
  const rows = [];
  for (const s of D.SKILLS) {
    if (s.multi) continue;                 // Language handled separately
    const rank = c.skills[s.key];
    const trained = rank !== undefined && rank !== null;
    if (!trained && !includeUntrained) continue;
    rows.push({
      key: s.key, name: s.name, group: s.group, trained,
      rank: trained ? rank : 0,
      base: trained
        ? R.baseChance(s.key, c.attributes, rank, charismaRank)
        : R.untrainedBaseChance(s.key, c.attributes, charismaRank),
      dfPenalty: trained ? 0 : D.UNTRAINED_DF_PENALTY,
      maxRank: R.maxSkillRank(s.key, c.attributes),
      gmRolled: !!s.gmRolled
    });
  }
  return rows;
}

export function abilityList(c) {
  const rows = D.FIXED_ABILITIES.map(a => ({
    key: a.key, name: a.key === "nativelanguage" && c.identity.nativeLanguage
      ? `Native Language (${c.identity.nativeLanguage})` : a.name,
    base: D.ABILITY_BASE_CHANCE, desc: a.desc, fixed: true
  }));
  if (c.abilities.chosen) {
    const s = R.SKILL_BY_KEY[c.abilities.chosen];
    const isLang = c.abilities.chosen === "language";
    rows.push({
      key: c.abilities.chosen,
      name: isLang
        ? (c.identity.abilityLanguage || "A second language") + " (Ability)"
        : (s ? s.name : c.abilities.chosen) + " (Ability)",
      base: D.ABILITY_BASE_CHANCE,
      desc: s ? s.desc : "",
      fixed: true, chosen: true
    });
  }
  return rows;
}

/** Base Chance for any roll target, honouring Abilities.
 * Choosing Language as the fourth Ability grants ONE named language at Base Chance 20;
 * it does not turn the generic Language skill into an Ability. Aidan Hunter's published
 * sheet shows exactly this: French as an Ability alongside Language at INT 12. */
export function baseChanceFor(c, skillKey) {
  if (c.abilities.chosen === skillKey && skillKey !== "language") return D.ABILITY_BASE_CHANCE;
  const rank = c.skills[skillKey];
  const charismaRank = c.skills.charisma || 0;
  if (rank === undefined || rank === null) {
    return R.untrainedBaseChance(skillKey, c.attributes, charismaRank);
  }
  return R.baseChance(skillKey, c.attributes, rank, charismaRank);
}

export function isTrained(c, skillKey) {
  if (c.abilities.chosen === skillKey && skillKey !== "language") return true;
  return c.skills[skillKey] !== undefined;
}

/* ---------------------------------------------------------------- creation budget */

export function creationSpend(c) {
  const rankRow = R.RANK_BY_KEY[c.identity.rank] || R.RANK_BY_KEY.rookie;
  const hBand = D.PHYSICAL_BANDS[c.identity.heightBand] || D.PHYSICAL_BANDS[4];
  const wBand = D.PHYSICAL_BANDS[c.identity.weightBand] || D.PHYSICAL_BANDS[4];
  const app = R.APPEARANCE_BY_KEY[c.identity.appearance] || R.APPEARANCE_BY_KEY.normal;

  // Height and weight are separate choices — the book lets them differ by a row — so each
  // is charged from its own row of the Physical Traits Table.
  const physical = hBand.cp + wBand.cp + app.cp;
  const attributes = Object.values(c.attributes).reduce((t, v) => t + R.characteristicCost(v), 0);

  let skills = 0;
  for (const [k, rank] of Object.entries(c.skills)) skills += R.skillCost(rank);
  for (const l of c.languages || []) skills += R.skillCost(l.rank);

  const weaknessBonus = (c.weaknesses || [])
    .reduce((t, k) => t + (R.WEAKNESS_BY_KEY[k] ? R.WEAKNESS_BY_KEY[k].cp : 0), 0);
  const professionBonus = (c.identity.professionYears || 0) * D.PROFESSION_RULES.cpPerYear;

  const budget = rankRow.creationPoints + weaknessBonus;
  const spent = physical + attributes + skills;

  return {
    budget, spent, remaining: budget - spent,
    physical, attributes, skills,
    weaknessBonus, professionBonus,
    professionSpent: professionSpend(c),
    professionRemaining: professionBonus - professionSpend(c)
  };
}

/** Profession points may only be spent on that profession's listed skills. */
function professionSpend(c) {
  const prof = R.PROFESSION_BY_KEY[c.identity.profession];
  if (!prof) return 0;
  return Number(c.identity.professionSpent) || 0;
}

/* ---------------------------------------------------------------- validation */

export function validate(c) {
  const errors = [];
  const warnings = [];
  const spend = creationSpend(c);

  if (!c.identity.name || !c.identity.name.trim()) errors.push("The character needs a name.");
  if (spend.remaining < 0) errors.push(`Over budget by ${-spend.remaining} Creation Points.`);

  for (const [k, v] of Object.entries(c.attributes)) {
    if (v < D.CHARACTERISTIC_MIN || v > D.CHARACTERISTIC_MAX) {
      errors.push(`${k.toUpperCase()} must be between ${D.CHARACTERISTIC_MIN} and ${D.CHARACTERISTIC_MAX}.`);
    }
  }

  for (const [k, rank] of Object.entries(c.skills)) {
    const max = R.maxSkillRank(k, c.attributes);
    if (rank > max) {
      errors.push(`${R.skillName(k)} rank ${rank} exceeds the cap of ${max} (highest underlying characteristic + 2).`);
    }
    if (rank < 1) errors.push(`${R.skillName(k)} must be at least rank 1.`);
  }

  for (const key of D.STARTING_SKILLS) {
    if (!(key in c.skills)) errors.push(`Every character starts with ${R.skillName(key)} at rank 1.`);
  }

  const gap = Math.abs((c.identity.heightBand ?? 4) - (c.identity.weightBand ?? 4));
  if (gap > 1) {
    warnings.push("Height and weight are more than one row apart. The book keeps characters proportional unless the GM allows otherwise.");
  }

  const years = c.identity.professionYears || 0;
  if (years > D.PROFESSION_RULES.maxYears) {
    errors.push(`A character may spend at most ${D.PROFESSION_RULES.maxYears} years in a profession.`);
  }
  if (years > 0 && !c.identity.profession) errors.push("Choose a profession for those years of experience.");

  const foeAllowance = years;
  if (c.foe.length > foeAllowance) {
    warnings.push(`You have ${c.foe.length} Fields of Experience but only ${foeAllowance} year${foeAllowance === 1 ? "" : "s"} of profession. Two General Fields may replace one profession Field.`);
  }

  if ((c.weaknesses || []).length > D.WEAKNESS_MAX_DEFAULT) {
    warnings.push(`The book suggests at most ${D.WEAKNESS_MAX_DEFAULT} Weaknesses without GM permission.`);
  }

  if (!c.abilities.chosen) warnings.push("Pick a fourth Ability from the Potential Abilities list.");

  return { errors, warnings, ok: errors.length === 0, spend };
}

/* ---------------------------------------------------------------- state helpers */

export function applyWound(c, incoming) {
  const before = c.state.wound;
  c.state.wound = R.accumulateWound(before, incoming);
  if (incoming === "stun" && before === "none") c.state.stunRounds = 0;
  return { before, after: c.state.wound };
}

export function maxHeroPoints(c) {
  // The rulebook sets no cap on Hero Points. Displayed maxima are informational.
  return null;
}

export function conditionSummary(c) {
  const list = [];
  const w = R.woundLevel(c.state.wound);
  if (c.state.wound !== "none") list.push({ key: "wound", name: w.name, dfMod: w.dfMod || 0 });
  if (c.state.exhausted) list.push({ key: "exhausted", name: "Exhausted", dfMod: D.EXHAUSTION_DF_PENALTY });
  for (const [k, v] of Object.entries(c.state.conditions || {})) {
    if (!v) continue;
    list.push({ key: k, name: v.name || k, dfMod: Number(v.dfMod) || 0 });
  }
  return list;
}

/** Total automatic Difficulty Factor modifier from the character's current condition. */
export function conditionDFMod(c) {
  return conditionSummary(c).reduce((t, x) => t + (x.dfMod || 0), 0);
}
