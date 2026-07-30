/* rules.js — pure rules lookups over the data libraries. No DOM, no state. */

import { lookup, lookupRow, clamp, floor } from "./core.js";
import * as D from "../data.js";

/* ---------------------------------------------------------------- indices */

export const SKILL_BY_KEY = Object.fromEntries(D.SKILLS.map(s => [s.key, s]));
export const PROFESSION_BY_KEY = Object.fromEntries(D.PROFESSIONS.map(p => [p.key, p]));
export const FOE_BY_KEY = Object.fromEntries(D.FIELDS_OF_EXPERIENCE.map(f => [f.key, f]));
export const WEAKNESS_BY_KEY = Object.fromEntries(D.WEAKNESSES.map(w => [w.key, w]));
export const APPEARANCE_BY_KEY = Object.fromEntries(D.APPEARANCES.map(a => [a.key, a]));
export const RANK_BY_KEY = Object.fromEntries(D.RANKS.map(r => [r.key, r]));
export const WEAPON_BY_KEY = Object.fromEntries(D.WEAPONS.map(w => [w.key, w]));
export const VEHICLE_BY_KEY = Object.fromEntries(D.VEHICLES.map(v => [v.key, v]));
export const GEAR_BY_KEY = Object.fromEntries(D.GEAR.map(g => [g.key, g]));
export const ARMOR_BY_KEY = Object.fromEntries(D.BODY_ARMOR.map(a => [a.key, a]));
export const WOUND_BY_KEY = Object.fromEntries(D.WOUND_LEVELS.map(w => [w.key, w]));
export const STYLE_BY_KEY = Object.fromEntries(D.CAMPAIGN_STYLES.map(s => [s.key, s]));
export const REACTION_BY_KEY = Object.fromEntries(D.REACTIONS.map(r => [r.key, r]));

export function skillName(key) { return SKILL_BY_KEY[key] ? SKILL_BY_KEY[key].name : key; }

/* ---------------------------------------------------------------- base chance */

/** Characteristic-only value for a skill formula, rounded down. */
export function formulaValue(skill, attrs, charismaRank = 0) {
  if (!skill) return 0;
  if (skill.mode === "seduction") return floor((num(attrs.wil) + charismaRank) / 2);
  if (skill.mode === "avg") {
    const sum = skill.stats.reduce((t, k) => t + num(attrs[k]), 0);
    return floor(sum / skill.stats.length);
  }
  return num(attrs[skill.stats[0]]);
}

function num(v) { return Number(v) || 0; }

/** Highest underlying characteristic value — sets the Skill Rank cap. */
export function highestUnderlying(skill, attrs) {
  if (!skill) return 0;
  return Math.max(...skill.stats.map(k => num(attrs[k])));
}

/** Maximum legal Skill Rank. Language has no cap. */
export function maxSkillRank(skillKey, attrs) {
  const skill = SKILL_BY_KEY[skillKey];
  if (!skill) return 0;
  if (skill.noRankCap) return 99;
  return highestUnderlying(skill, attrs) + D.SKILL_RANK_OVER_CHARACTERISTIC;
}

/** Base Chance = floor(formula) + rank, capped at 30. */
export function baseChance(skillKey, attrs, rank = 0, charismaRank = 0) {
  const skill = SKILL_BY_KEY[skillKey];
  if (!skill) return 0;
  return clamp(formulaValue(skill, attrs, charismaRank) + (Number(rank) || 0), 0, D.MAX_BASE_CHANCE);
}

/** Untrained Base Chance (characteristics only). The -3 DF penalty is applied separately. */
export function untrainedBaseChance(skillKey, attrs, charismaRank = 0) {
  const skill = SKILL_BY_KEY[skillKey];
  if (!skill) return 0;
  return clamp(formulaValue(skill, attrs, charismaRank), 0, D.MAX_BASE_CHANCE);
}

export function formulaLabel(skillKey) {
  const s = SKILL_BY_KEY[skillKey];
  if (!s) return "";
  if (s.mode === "seduction") return "(WIL + Charisma rank) / 2";
  if (s.mode === "avg") return "(" + s.stats.map(k => k.toUpperCase()).join(" + ") + ") / " + s.stats.length;
  return s.stats[0].toUpperCase();
}

/* ---------------------------------------------------------------- derived stats */

export function carryRange(str) { return lookupRow(D.CARRYING_CAPACITY, num(str)).range; }
export function carryMax(str) { return lookupRow(D.CARRYING_CAPACITY, num(str)).high; }
export function runSwimMinutes(wil) { return lookup(D.RUN_SWIM_MINUTES, num(wil)); }
export function hthDamageRank(str) { return lookup(D.HTH_DAMAGE_RANK, num(str)); }
export function speedValue(per, dex) { return lookup(D.SPEED_TABLE, num(per) + num(dex)); }
export function staminaHours(wil) { return lookup(D.STAMINA_HOURS, num(wil)); }
export function drawBonus(speed) { return D.DRAW_BONUS[clamp(num(speed), 0, 3)] || 0; }

/* ---------------------------------------------------------------- damage */

export const RANK_INDEX = Object.fromEntries(D.DAMAGE_RANKS.map((r, i) => [r, i]));

/** Shift a Damage Rank letter by n steps, clamped to A..L. Below A means no effect. */
export function shiftDamageRank(rank, steps) {
  const i = RANK_INDEX[rank];
  if (i === undefined) return null;
  const n = i + steps;
  if (n < 0) return null;
  return D.DAMAGE_RANKS[Math.min(D.DAMAGE_RANKS.length - 1, n)];
}

/** Wound key from an attack Quality and a Damage Rank. Failure deals nothing. */
export function woundFromHit(quality, damageRank) {
  if (quality >= D.QUALITY.FAILURE) return null;
  const row = D.WOUND_RANK_TABLE[quality];
  if (!row) return null;
  return row[damageRank] || null;
}

/** Combine an existing wound with a new one via the accumulation table. */
export function accumulateWound(current, incoming) {
  if (!incoming || incoming === "none") return current || "none";
  if (incoming === "killed") return "killed";
  if (incoming === "stun") return current && current !== "none" ? current : "none";
  if (!current || current === "none") return incoming;
  if (current === "stun") return incoming;
  if (current === "killed") return "killed";
  const row = D.WOUND_ACCUMULATION[current];
  if (!row) return incoming;
  return row[incoming] || incoming;
}

export function woundLevel(key) { return WOUND_BY_KEY[key] || WOUND_BY_KEY.none; }
export function woundDFMod(key) { const w = woundLevel(key); return w && w.dfMod ? w.dfMod : 0; }
export function woundDrawMod(key) { const w = woundLevel(key); return w && w.drawMod ? w.drawMod : 0; }
export function painDF(key) { const w = woundLevel(key); return w ? w.painDF : null; }

export function stunRounds(rollValue) { return lookup(D.STUN_TABLE, rollValue, "rounds"); }
export function fallWound(feet) { return lookup(D.FALL_DAMAGE, feet, "wound"); }
export function scarChance(woundKey) { const w = woundLevel(woundKey); return w && w.scarChance ? w.scarChance : 0; }
export function scarLocation(rollValue) { return lookup(D.SCAR_LOCATIONS, rollValue, "name"); }

export function areaWound(damageRank, feet) {
  const bands = D.AREA_DAMAGE[damageRank];
  if (!bands) return null;
  for (const b of bands) if (feet <= b.max) return b.w;
  return "none";
}

/** Healing: reduce a wound by n ranks. */
export function healWound(key, ranks = 1) {
  const order = ["none", "stun", "light", "medium", "heavy", "incap", "killed"];
  const i = order.indexOf(key);
  if (i <= 0) return "none";
  if (key === "killed") return "killed";
  return order[Math.max(0, i - ranks)];
}

/* ---------------------------------------------------------------- interaction */

export function persuadeResult(quality, npcWil) {
  if (quality >= D.QUALITY.FAILURE) return "N";
  const row = lookupRow(D.PERSUADE_TABLE, num(npcWil));
  return row.r[quality];
}

export function coercionQuality(quality, npcWil) {
  const row = lookupRow(D.COERCION_TABLE, num(npcWil));
  return row.r[quality];
}

export function reputationResult(quality, reputation) {
  if (quality >= D.QUALITY.FAILURE) return "N";
  const row = lookupRow(D.REPUTATION_TABLE, num(reputation));
  return row.results[quality];
}

export function reactionFromQuality(quality) { return D.REACTION_BY_QUALITY[quality]; }
export function localCustomsReactionMod(quality) { return D.LOCAL_CUSTOMS_REACTION_MOD[quality] || 0; }
export function disguiseReputationMod(quality) { return D.DISGUISE_REPUTATION_MOD[quality] || 0; }

export function gamblingResult(gameKey, q1, q2) {
  const g = D.GAMBLING_GAMES.find(x => x.key === gameKey);
  if (!g) return null;
  const row = g.table[q1];
  return row ? row[q2] : null;
}

/* ---------------------------------------------------------------- chases */

export function accidentWound(maneuverKey, dfBid) {
  const row = D.ACCIDENT_TABLE[maneuverKey];
  if (!row) return null;
  const bid = dfBid <= 0.5 ? 0.5 : Math.min(7, Math.max(1, Math.round(dfBid)));
  const code = row[bid];
  return code ? D.ACCIDENT_CODE_TO_WOUND[code] : null;
}

/** Vehicle wound to occupant wound: -1 rank, plus seat belts and airbags. */
export function occupantWound(vehicleWound, { seatbelt = true, airbag = false } = {}) {
  let steps = 1;
  if (seatbelt) steps += 1;
  if (airbag) steps += 1;
  return healWound(vehicleWound, steps);
}

export function vehicleSkillFor(vehicleKey) {
  const v = VEHICLE_BY_KEY[vehicleKey];
  return v ? (D.VEHICLE_SKILL_BY_CAT[v.cat] || "driving") : "driving";
}

/* ---------------------------------------------------------------- creation costs */

export function characteristicCost(value) {
  const v = clamp(num(value), D.CHARACTERISTIC_MIN, D.CHARACTERISTIC_MAX);
  if (v <= D.CHARACTERISTIC_BASE) return 0;
  return D.CHARACTERISTIC_COST[v] || 0;
}

export function skillCost(rank) {
  const r = Number(rank) || 0;
  if (r <= 0) return 0;
  return D.SKILL_COST_NEW + (r - 1) * D.SKILL_COST_RANK;
}

/** Skill rank cost when only a subset of ranks is paid from profession points. */
export function rankStepCost(fromRank, toRank) {
  return Math.max(0, (toRank - fromRank)) * D.SKILL_COST_RANK;
}

/* ---------------------------------------------------------------- experience */

export function xpSkillRankCost(finalRank) { return D.XP_COSTS.skillRank.formula(finalRank); }
export function xpCharacteristicCost(finalValue) { return D.XP_COSTS.characteristic.formula(finalValue); }

export function missionXP({ rank = "agent", outcome = "success", roleplay = 0 } = {}) {
  const rankRow = RANK_BY_KEY[rank];
  let total = D.XP_BASE_PER_MISSION + (rankRow ? rankRow.xpModifier : 0);
  const out = D.XP_MODIFIERS.find(m => m.key === outcome);
  if (out) total += out.value;
  total += clamp(Number(roleplay) || 0, -250, 750);
  return total;
}

/* ---------------------------------------------------------------- gear helpers */

export function weaponSkill(weapon) {
  if (!weapon) return "firecombat";
  return weapon.cat === "hth" ? "handtohand" : "firecombat";
}

/** Effective Damage Rank of a weapon in a character's hands. */
export function weaponDamageRank(weapon, character, opts = {}) {
  if (!weapon) return null;
  if (weapon.cat === "hth") {
    if (weapon.dr) return weapon.dr;                       // thrown ordnance carries its own rank
    const base = hthDamageRank(character?.attributes?.str ?? 5);
    return shiftDamageRank(base, (weapon.drBonus || 0) + (opts.kick ? 1 : 0));
  }
  let dr = opts.burst && weapon.drBurst ? weapon.drBurst : weapon.dr;
  if (opts.rangeBand === "close") dr = shiftDamageRank(dr, 1);
  else if (opts.rangeBand === "long") dr = shiftDamageRank(dr, -1);
  if (opts.silencer) dr = shiftDamageRank(dr, -1);
  if (opts.hollowPoint) dr = shiftDamageRank(dr, 1);
  return dr;
}

/** Shots this round: min(Speed, Rate of Fire). Speed 0 fires every other round. */
export function shotsPerRound(weapon, speed) {
  if (!weapon || weapon.cat === "hth") return Math.max(1, speed);
  const rof = weapon.rof || 1;
  if (rof < 1) return rof;
  return Math.max(1, Math.min(speed || 1, rof));
}

export function isMisfire(rollValue, weapon) {
  if (!weapon || !weapon.mis) return false;
  const parts = String(weapon.mis).split("-").map(Number);
  const lo = parts[0];
  const hi = parts.length > 1 ? parts[1] : parts[0];
  return rollValue >= lo && rollValue <= hi;
}

/* ---------------------------------------------------------------- reputation */

/**
 * Starting Reputation = height row + weight row + appearance + 6 per profession year
 * + 20 per visible scar. Height and weight each contribute their own row's value.
 * Verified against four of the five published sample characters, which reproduce exactly.
 */
export function startingReputation({ heightBand = 4, weightBand = 4, appearance = "normal", professionYears = 0, scars = 0 } = {}) {
  const h = D.PHYSICAL_BANDS[heightBand] || D.PHYSICAL_BANDS[4];
  const w = D.PHYSICAL_BANDS[weightBand] || D.PHYSICAL_BANDS[4];
  const app = APPEARANCE_BY_KEY[appearance] || APPEARANCE_BY_KEY.normal;
  return h.rep + w.rep + app.rep +
    professionYears * D.PROFESSION_RULES.repPerYear +
    scars * D.SCAR_REPUTATION;
}

/* ---------------------------------------------------------------- language */

export function fluencyFor(rank) {
  for (const f of D.LANGUAGE_FLUENCY) if (rank >= f.min && rank <= f.max) return f;
  return D.LANGUAGE_FLUENCY[D.LANGUAGE_FLUENCY.length - 1];
}

/* ---------------------------------------------------------------- style */

export function earnsHeroPoint(quality, styleKey, isCombatRoll, usedHeroPoints) {
  if (usedHeroPoints) return false;
  const style = STYLE_BY_KEY[styleKey] || STYLE_BY_KEY.adventurous;
  if (isCombatRoll && !style.combatEarns) return false;
  return quality <= style.threshold;
}
