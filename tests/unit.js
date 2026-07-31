/* tests/unit.js — pure-logic regression checks against the rulebook.
 * These run in Node: data.js, src/rules.js and src/derived.js are DOM-free. */

import * as D from "../data.js";
import * as R from "../src/rules.js";
import { blankCharacter, normalize, derived, skillList, validate, creationSpend, baseChanceFor, conditionDFMod } from "../src/derived.js";
import { ANIMALS } from "../data-monsters.js";
import { OSIRIS_NPCS, ENCOUNTER_TABLES, ENCOUNTERS, NPC_CHARACTERISTIC_TABLES, NPC_SKILL_TABLES } from "../data-npcs.js";
import { PREGENS, PREGEN_BUDGET_AUDIT } from "../data-pregens.js";
import * as SOLO from "../data-solo.js";
import { HELP, TUTORIAL, helpFor } from "../data-help.js";
import { normalizeAdventure, wipeAdventures as Store_wipeAdventures, wipeCharacters as Store_wipeCharacters } from "../src/store.js";
import { readFileSync } from "node:fs";

export function unitTests(t) {

  /* ---------------- resolution engine ---------------- */

  t.group("Resolution engine");

  t.eq(D.BASE_DIFFICULTY_FACTOR, 5, "base Difficulty Factor is 5");
  t.eq(D.MAX_BASE_CHANCE, 30, "Base Chance caps at 30");

  // The worked example from Chapter One: DEX 12, PER 14, Fire Combat rank 12.
  const smythe = { str: 5, dex: 12, wil: 5, per: 14, int: 5 };
  t.eq(R.baseChance("firecombat", smythe, 12), 25, "worked example: Fire Combat Base Chance is 25");
  t.eq(D.successChance(25, 6), 150, "worked example: 25 x DF 6 = Success Chance 150");
  t.eq(D.qualityForRoll(34, 150), D.QUALITY.GOOD, "worked example: a roll of 34 at SC 150 is Good (3)");
  t.eq(D.successChance(25, 7), 175, "worked example at DF 7 gives Success Chance 175");
  t.eq(D.qualityForRoll(34, 175), D.QUALITY.GREAT, "worked example: the same 34 at DF 7 is Great (2)");

  // Printed Success Quality Table spot checks.
  const cases = [
    [10, { superb: [1, 1], great: [2, 2], good: [3, 5] }],
    [100, { superb: [1, 10], great: [11, 20], good: [21, 50] }],
    [150, { superb: [1, 15], great: [16, 30], good: [31, 75], fair: [76, 99] }],
    [190, { superb: [1, 19], great: [20, 38], good: [39, 95], fair: [96, 99] }],
    [200, { superb: [1, 20], great: [21, 40], good: [41, 98], fair: [99, 99] }],
    [300, { superb: [1, 30], great: [31, 60], good: [61, 98], fair: [99, 99] }]
  ];
  for (const [sc, want] of cases) {
    const b = D.qualityBands(sc);
    for (const [k, range] of Object.entries(want)) {
      t.deep(b[k], range, `Success Quality Table row ${sc}: ${k} band`);
    }
  }

  t.eq(D.qualityForRoll(100, 300), D.QUALITY.FAILURE, "a d100 of 100 always fails, even at Success Chance 300");
  t.eq(D.qualityForRoll(99, 300), D.QUALITY.FAIR, "99 at Success Chance 300 is still a Fair success");
  t.eq(D.qualityForRoll(46, 45), D.QUALITY.FAILURE, "rolling above the Success Chance fails");
  t.eq(D.qualityForRoll(45, 45), D.QUALITY.FAIR, "rolling exactly the Success Chance succeeds");

  // Difficulty Factor 1/2 rounds down, and the ladder is clamped.
  t.eq(D.successChance(3, 0.5), 1, "Difficulty Factor 1/2 rounds down (3 becomes 1)");
  t.eq(D.successChance(5, 0.5), 2, "Difficulty Factor 1/2 rounds down (5 becomes 2)");
  t.eq(D.successChance(30, 10), 300, "maximum Success Chance is 300");
  t.eq(D.successChance(40, 10), 300, "Base Chance above 30 is clamped before multiplying");
  t.eq(D.clampDF(0.1), 0.5, "Difficulty Factor cannot fall below 1/2");
  t.eq(D.clampDF(99), 10, "Difficulty Factor cannot rise above 10");
  t.eq(D.stepDF(5, 3), 8, "three positive modifier steps take DF 5 to 8");
  t.eq(D.stepDF(5, -10), 0.5, "large negative modifiers bottom out at 1/2");
  t.eq(D.stepDF(1, -1), 0.5, "stepping down from 1 gives 1/2");

  // No band ever overlaps or leaves a gap.
  for (let sc = 1; sc <= 300; sc++) {
    const b = D.qualityBands(sc);
    const segs = [b.superb, b.great, b.good, b.fair].filter(Boolean);
    let ok = segs[0][0] === 1;
    for (let i = 1; i < segs.length; i++) if (segs[i][0] !== segs[i - 1][1] + 1) ok = false;
    for (const s of segs) if (s[1] < s[0]) ok = false;
    if (!ok) { t.fail(`Success Quality bands are contiguous at Success Chance ${sc}`); return; }
  }
  t.pass("Success Quality bands are contiguous and non-overlapping for every Success Chance 1-300");

  /* ---------------- skills and derivation ---------------- */

  t.group("Skills and derived statistics");

  t.eq(D.SKILLS.length, 25, "the core book lists 25 skills");
  t.eq(R.baseChance("boating", { dex: 11, per: 12 }, 0), 11, "averaged formulas round down");
  t.eq(R.maxSkillRank("firecombat", { dex: 12, per: 14 }), 16, "rank cap is the highest underlying characteristic + 2");
  t.eq(R.maxSkillRank("language", { int: 5 }), 99, "Language alone has no rank cap");
  t.eq(R.baseChance("charisma", { wil: 15 }, 20), 30, "Base Chance is capped at 30");

  // Seduction's formula uses the Charisma SKILL RANK, not the Charisma base chance.
  t.eq(R.baseChance("seduction", { wil: 10 }, 4, 8), 13, "Seduction averages Willpower with the Charisma skill rank");

  const derCases = [
    ["carryRange", [5, "60-100 lbs"], [10, "101-150 lbs"], [13, "151-210 lbs"], [14, "211-280 lbs"], [15, "281-350 lbs"]],
    ["runSwimMinutes", [5, 10], [10, 25], [13, 40], [14, 55], [15, 60]],
    ["hthDamageRank", [8, "A"], [9, "B"], [13, "B"], [14, "C"], [15, "C"]],
    ["staminaHours", [5, 24], [10, 28], [13, 30], [14, 33], [15, 36]]
  ];
  for (const [fn, ...pairs] of derCases) {
    for (const [input, want] of pairs) t.eq(R[fn](input), want, `${fn}(${input}) is ${want}`);
  }
  t.eq(R.speedValue(3, 4), 0, "Speed 0 below a PER + DEX total of 8");
  t.eq(R.speedValue(4, 4), 1, "Speed 1 from a PER + DEX total of 8");
  t.eq(R.speedValue(8, 8), 2, "Speed 2 from a PER + DEX total of 16");
  t.eq(R.speedValue(12, 12), 3, "Speed 3 from a PER + DEX total of 24");
  t.eq(R.drawBonus(3), 60, "Speed 3 gives a Draw bonus of +60");

  /* ---------------- damage ---------------- */

  t.group("Damage and wounds");

  t.eq(R.woundFromHit(D.QUALITY.GOOD, "E"), "light", "Damage Rank E on a Good (3) is a Light Wound");
  t.eq(R.woundFromHit(D.QUALITY.GREAT, "E"), "heavy", "Damage Rank E on a Great (2) is a Heavy Wound");
  t.eq(R.woundFromHit(D.QUALITY.SUPERB, "H"), "killed", "Damage Rank H on a Superb (1) kills");
  t.eq(R.woundFromHit(D.QUALITY.FAIR, "A"), "stun", "Damage Rank A on a Fair (4) is only a Stun");
  t.eq(R.woundFromHit(D.QUALITY.FAILURE, "L"), null, "a failed attack deals nothing");

  t.eq(R.accumulateWound("light", "light"), "medium", "two Light Wounds make a Medium Wound");
  t.eq(R.accumulateWound("medium", "medium"), "incap", "two Medium Wounds incapacitate");
  t.eq(R.accumulateWound("heavy", "heavy"), "killed", "two Heavy Wounds kill");
  t.eq(R.accumulateWound("incap", "medium"), "killed", "a Medium Wound on top of Incapacitation kills");
  t.eq(R.accumulateWound("none", "heavy"), "heavy", "a first wound stands alone");
  t.eq(R.accumulateWound("light", "stun"), "light", "a Stun never worsens an existing wound");

  t.eq(R.woundDFMod("light"), -1, "a Light Wound is -1 Difficulty Factor");
  t.eq(R.woundDFMod("medium"), -2, "a Medium Wound is -2 Difficulty Factor");
  t.eq(R.woundDFMod("heavy"), -3, "a Heavy Wound is -3 Difficulty Factor");
  t.eq(R.painDF("light"), 7, "Light Wound Pain Resistance is Difficulty Factor 7");
  t.eq(R.painDF("medium"), 5, "Medium Wound Pain Resistance is Difficulty Factor 5");
  t.eq(R.painDF("heavy"), 3, "Heavy Wound Pain Resistance is Difficulty Factor 3");
  t.eq(R.woundDrawMod("heavy"), -60, "a Heavy Wound is -60 to Draw");

  t.eq(R.fallWound(5), "none", "a fall under 10 feet does nothing");
  t.eq(R.fallWound(60), "medium", "a 60-foot fall is a Medium Wound");
  t.eq(R.fallWound(300), "killed", "a fall over 250 feet kills");
  t.eq(R.stunRounds(1), 1, "a Stun Table roll of 1 is one round");
  t.eq(R.stunRounds(100), 6, "a Stun Table roll of 100 is six rounds");
  t.eq(R.areaWound("L", 5), "killed", "Damage Rank L kills inside 10 feet");
  t.eq(R.areaWound("H", 35), "none", "Damage Rank H is harmless past 30 feet");
  t.eq(R.shiftDamageRank("E", 1), "F", "close range adds a Damage Rank");
  t.eq(R.shiftDamageRank("A", -1), null, "reducing below Damage Rank A means no effect");
  t.eq(R.shiftDamageRank("L", 3), "L", "Damage Rank cannot exceed L");
  t.eq(R.healWound("heavy", 1), "medium", "healing one rank from Heavy gives Medium");
  t.eq(R.healWound("light", 3), "none", "over-healing bottoms out at unhurt");
  t.eq(R.healWound("killed", 5), "killed", "the dead do not heal");

  /* ---------------- opposed procedures ---------------- */

  t.group("Opposed and interaction procedures");

  t.eq(R.persuadeResult(1, 5), "Y", "Superb Persuasion against Willpower under 6 is Yes");
  t.eq(R.persuadeResult(4, 5), "P", "Fair Persuasion against Willpower under 6 is Perhaps");
  t.eq(R.persuadeResult(1, 15), "P", "even Superb Persuasion against Willpower 15 is only Perhaps");
  t.eq(R.persuadeResult(2, 15), "N", "Great Persuasion against Willpower 15 is No");
  t.eq(R.persuadeResult(5, 5), "N", "a failed Persuasion is always No");

  t.eq(R.coercionQuality(1, 5), 1, "Superb coercion against a weak will stays Superb");
  t.eq(R.coercionQuality(1, 15), 3, "Superb coercion against Willpower 15 degrades to Good");
  t.eq(R.coercionQuality(3, 11), 3, "Good coercion against Willpower 9-11 stays Good");
  t.eq(R.coercionQuality(5, 8), 4, "a failed interrogation of Willpower 6-8 still yields Fair information");
  t.eq(R.coercionQuality(4, 13), 5, "Fair coercion against Willpower 12-13 yields nothing");
  t.eq(D.SKILL_TIME_INFO[R.coercionQuality(1, 5)].info, "100%", "a modified Superb yields all the information");
  t.eq(D.SKILL_TIME_INFO[5].info, "False information", "a failed information roll yields false information");

  t.eq(R.reputationResult(1, 40), "P", "Reputation under 51 is at worst a Perhaps");
  t.eq(R.reputationResult(4, 40), "N", "a Fair Perception check misses a low-Reputation operative");
  t.eq(R.reputationResult(3, 200), "Y", "Reputation over 150 is identified on a Good check");
  t.eq(R.reputationResult(4, 200), "P", "Reputation over 150 is at best a Perhaps on a Fair check");
  t.eq(R.disguiseReputationMod(1), -5, "a Superb disguise is -5 to the Reputation check");
  t.eq(R.disguiseReputationMod(5), 2, "a failed disguise is +2 to the Reputation check");

  t.eq(R.reactionFromQuality(1), "helpful", "a Superb Reaction roll is Helpful");
  t.eq(R.reactionFromQuality(5), "opposed", "a failed Reaction roll is Opposed");
  t.eq(R.REACTION_BY_KEY.opposed.persuadeMod, -4, "Opposed NPCs impose -4 Difficulty Factor on Persuasion");
  t.eq(R.REACTION_BY_KEY.helpful.persuadeMod, 3, "Helpful NPCs give +3 Difficulty Factor on Persuasion");
  t.eq(R.localCustomsReactionMod(1), 3, "a Superb Local Customs check is +3 to Reaction");
  t.eq(R.localCustomsReactionMod(5), -1, "a failed Local Customs check is -1 to Reaction");

  t.eq(D.SEDUCTION_STAGES.length, 5, "Seduction has five stages");
  t.eq(D.SEDUCTION_STAGES[0].df, 10, "The Look is Difficulty Factor 10");
  t.eq(D.SEDUCTION_STAGES[4].df, 4, "The Time and Location is Difficulty Factor 4");
  t.eq(D.SEDUCTION_RESIST_FAILURE_DF, 10, "a failed seduction roll lets the target resist at Difficulty Factor 10");
  t.eq(D.SEDUCTION_FINAL_REACTION_MOD, 5, "a completed seduction forces a Reaction roll at +5");
  t.eq(D.TORTURE_RESIST.limitFormula(4), 12, "a victim may pass out up to three times their Willpower");

  t.eq(R.gamblingResult("baccarat", 1, 5), "W", "a Superb first Baccarat roll wins outright");
  t.eq(R.gamblingResult("blackjack", 1, 3), "Nat", "a Superb first Blackjack roll is a natural");
  t.eq(R.gamblingResult("poker", 1, 1), "1*", "double Superb in Poker beats a plain Superb");
  t.eq(R.gamblingResult("chemin", 5, 5), "F", "a double failure at Chemin de Fer loses");

  /* ---------------- chases ---------------- */

  t.group("Chases");

  t.eq(D.CHASE_START_BID, 7, "chase bidding starts at Difficulty Factor 7");
  t.eq(R.accidentWound("stunt", 0.5), "killed", "a failed Stunt bid at 1/2 kills the vehicle");
  t.eq(R.accidentWound("fastturn", 7), "light", "a failed Fast Turn bid at 7 is only a Light Wound");
  t.eq(R.accidentWound("ram", 2), "heavy", "a failed Ram bid at 2 is a Heavy Wound");
  t.eq(R.accidentWound("turn180", 4), "medium", "a failed 180 Turn bid at 4 is a Medium Wound");
  t.eq(R.accidentWound("follow", 1), "heavy", "a failed Follow/Escape bid at 1 is a Heavy Wound");

  t.eq(R.occupantWound("heavy", { seatbelt: false }), "medium", "occupants take one Wound Rank less than the vehicle");
  t.eq(R.occupantWound("heavy", { seatbelt: true }), "light", "seat belts remove another rank");
  t.eq(R.occupantWound("heavy", { seatbelt: true, airbag: true }), "stun", "seat belts and airbags together leave only a Stun");
  t.eq(D.FOLLOW_ESCAPE_STEPS[1], 4, "a Superb Follow/Escape moves four range steps");
  t.eq(D.FOLLOW_ESCAPE_STEPS[4], 1, "a Fair Follow/Escape moves one range step");
  t.eq(D.CHASE_MANEUVERS.find(m => m.key === "stunt").controlDF, 3, "a Stunt's Control Difficulty Factor is 3");
  t.eq(D.CHASE_MANEUVERS.find(m => m.key === "follow").controlDF, 6, "Follow/Escape's Control Difficulty Factor is 6");
  t.ok(D.CHASE_MANEUVERS.find(m => m.key === "ram").ranges.length === 1, "a Ram is only legal at Close range");
  t.ok(D.CHASE_MANEUVERS.find(m => m.key === "turn180").pursuedOnly, "only the pursued may attempt a 180 Turn");

  /* ---------------- creation ---------------- */

  t.group("Character creation");

  t.eq(R.RANK_BY_KEY.rookie.creationPoints, 300, "Rookies get 300 Creation Points");
  t.eq(R.RANK_BY_KEY.agent.creationPoints, 600, "Agents get 600 Creation Points");
  t.eq(R.RANK_BY_KEY.special.creationPoints, 900, "Special Agents get 900 Creation Points");
  t.eq(R.characteristicCost(5), 0, "the base value of 5 is free");
  t.eq(R.characteristicCost(12), 80, "a characteristic of 12 costs 80 Creation Points");
  t.eq(R.characteristicCost(15), 140, "a characteristic of 15 costs 140 Creation Points");
  t.eq(R.skillCost(1), 10, "a new skill at rank 1 costs 10 Creation Points");
  t.eq(R.skillCost(5), 18, "rank 5 costs 10 plus 4 further ranks at 2 each");

  const fresh = normalize(blankCharacter("rookie"));
  t.eq(fresh.skills.charisma, 1, "every character starts with Charisma at rank 1");
  t.eq(fresh.skills.driving, 1, "every character starts with Driving at rank 1");
  t.eq(fresh.state.heroPoints, 3, "a Rookie starts with 3 Hero Points");
  t.eq(Object.values(fresh.attributes).every(v => v === 5), true, "every characteristic starts at 5");

  const spend = creationSpend(fresh);
  t.eq(spend.budget, 300, "a fresh Rookie has a 300-point budget");
  t.eq(spend.physical, 60, "average height, weight and appearance cost 60 Creation Points");
  t.eq(spend.skills, 20, "the two starting skills cost 20 Creation Points");
  t.eq(spend.remaining, 220, "a fresh Rookie has 220 Creation Points left");

  const over = normalize({ ...fresh, attributes: { str: 15, dex: 15, wil: 15, per: 15, int: 15 } });
  t.ok(creationSpend(over).remaining < 0, "maxing every characteristic blows a Rookie's budget");
  t.ok(validate(over).errors.some(e => e.includes("Over budget")), "over-budget characters fail validation");

  const capBreak = normalize({ ...fresh, attributes: { ...fresh.attributes, str: 5 }, skills: { ...fresh.skills, handtohand: 20 } });
  t.ok(validate(capBreak).errors.some(e => e.includes("exceeds the cap")), "skill ranks above the cap fail validation");

  t.eq(R.startingReputation({ heightBand: 4, weightBand: 4, appearance: "normal", professionYears: 0 }), 0,
    "an average operative starts at Reputation 0");
  t.eq(R.startingReputation({ heightBand: 0, weightBand: 0, appearance: "gorgeous", professionYears: 6 }), 40 + 40 + 50 + 36,
    "extreme traits and six years of profession stack Reputation");
  t.eq(R.startingReputation({ heightBand: 4, weightBand: 5, appearance: "normal", professionYears: 0 }), 5,
    "height and weight each contribute their own row's Reputation");

  const freshSpend = creationSpend(normalize(blankCharacter("rookie")));
  t.eq(freshSpend.physical, 60, "average height (20) plus average weight (20) plus Normal appearance (20) costs 60");

  // The five published sample characters. Reputation is fully derivable from the printed
  // sheet, so each is an exact fixture for the Physical Traits and profession-year rules.
  const SAMPLES = [
    { name: "Michelle Jackson", female: true, heightBand: 4, weightBand: 5, appearance: "goodlooking", years: 6, rep: 51,
      attrs: { str: 7, dex: 9, wil: 7, per: 9, int: 7 }, speed: 2, hth: "A" },
    { name: "Johnathan Sawyer", female: false, heightBand: 5, weightBand: 4, appearance: "goodlooking", years: 3, rep: 33,
      attrs: { str: 9, dex: 8, wil: 8, per: 8, int: 7 }, speed: 2, hth: "B" },
    { name: "Godwin Georges", female: false, heightBand: 6, weightBand: 6, appearance: "stunning", years: 3, rep: 73,
      attrs: { str: 9, dex: 7, wil: 7, per: 7, int: 11 }, speed: 1, hth: "B" },
    { name: "Emily Steele", female: true, heightBand: 5, weightBand: 3, appearance: "attractive", years: 6, rep: 66,
      attrs: { str: 6, dex: 10, wil: 10, per: 9, int: 8 }, speed: 2, hth: "A" }
  ];
  for (const s of SAMPLES) {
    t.eq(R.startingReputation({ heightBand: s.heightBand, weightBand: s.weightBand, appearance: s.appearance, professionYears: s.years }),
      s.rep, `sample character ${s.name}: printed Reputation ${s.rep} is reproduced exactly`);
    t.eq(R.speedValue(s.attrs.per, s.attrs.dex), s.speed, `sample character ${s.name}: printed Speed matches PER + DEX`);
    t.eq(R.hthDamageRank(s.attrs.str), s.hth, `sample character ${s.name}: printed Hand-to-Hand Damage Rank matches Strength`);
  }

  // Michelle Jackson's sheet writes her language out as "Russian (7+15) = 22".
  t.eq(Math.min(D.MAX_BASE_CHANCE, 7 + 15), 22, "sample character Michelle Jackson: Russian at INT 7 plus rank 15 gives Base Chance 22");
  // Emily Steele's Seduction total is (WIL 10 + Charisma rank 4) / 2 = 7.
  t.eq(R.baseChance("seduction", { wil: 10 }, 0, 4), 7, "sample character Emily Steele: Seduction formula total is 7");

  /* ---------------- published pre-generated characters ---------------- */

  t.group("Published sample characters");

  t.eq(PREGENS.length, 5, "all five published sample characters are present");

  // Every Base Chance printed on the five sheets, keyed by skill. Sourced from the
  // sheets themselves; each must fall out of the characteristics and ranks we store.
  const PRINTED_BASE = {
    jackson: { boating: 12, charisma: 9, cryptography: 7, demolitions: 7, disguise: 7, diving: 8,
      driving: 15, electronics: 7, evasion: 10, firecombat: 15, gambling: 9, handtohand: 12,
      interrogation: 7, localcustoms: 9, lockpicking: 9, pickpocket: 9, piloting: 15, riding: 10,
      science: 7, seduction: 4, sixthsense: 10, stealth: 10, torture: 7 },
    sawyer: { boating: 8, charisma: 10, cryptography: 7, demolitions: 7, disguise: 7, diving: 8,
      driving: 13, electronics: 7, evasion: 8, firecombat: 15, gambling: 8, handtohand: 13,
      interrogation: 7, localcustoms: 8, lockpicking: 8, mountaineering: 8, pickpocket: 8,
      piloting: 8, riding: 8, science: 9, seduction: 8, sixthsense: 10, stealth: 12, torture: 7 },
    georges: { boating: 7, charisma: 8, cryptography: 13, demolitions: 12, disguise: 12, diving: 8,
      driving: 9, evasion: 8, firecombat: 11, gambling: 11, handtohand: 13, interrogation: 13,
      language: 11, localcustoms: 7, lockpicking: 7, mountaineering: 8, pickpocket: 7, riding: 7,
      science: 12, seduction: 4, stealth: 9, torture: 9 },
    steele: { boating: 9, charisma: 14, cryptography: 8, demolitions: 8, disguise: 8, diving: 8,
      driving: 11, electronics: 8, evasion: 10, firecombat: 12, gambling: 9, handtohand: 10,
      interrogation: 8, language: 8, localcustoms: 9, lockpicking: 16, mountaineering: 8,
      piloting: 9, riding: 9, science: 8, seduction: 7, sixthsense: 12, stealth: 17, torture: 9 },
    hunter: { boating: 21, charisma: 26, cryptography: 12, demolitions: 12, disguise: 15,
      driving: 24, evasion: 21, firecombat: 24, gambling: 26, handtohand: 20, interrogation: 12,
      language: 12, localcustoms: 25, lockpicking: 17, mountaineering: 19, pickpocket: 12,
      piloting: 21, riding: 19, science: 17, seduction: 25, sixthsense: 25, stealth: 25, torture: 12 }
  };

  for (const p of PREGENS) {
    const c = normalize({
      ...blankCharacter(p.rank),
      identity: { ...blankCharacter(p.rank).identity, heightBand: p.heightBand, weightBand: p.weightBand,
        appearance: p.appearance, profession: p.profession, professionYears: p.professionYears },
      attributes: { ...p.attributes },
      skills: { ...p.skills },
      abilities: { chosen: p.ability },
      weaknesses: [...p.weaknesses]
    });

    t.eq(R.startingReputation({ heightBand: p.heightBand, weightBand: p.weightBand,
      appearance: p.appearance, professionYears: p.professionYears }),
      p.key === "hunter" ? 76 : p.reputation,
      `${p.name}: creation Reputation derives correctly`);

    t.eq(R.speedValue(p.attributes.per, p.attributes.dex),
      { jackson: 2, sawyer: 2, georges: 1, steele: 2, hunter: 3 }[p.key],
      `${p.name}: printed Speed matches PER + DEX`);

    // Every printed Base Chance must fall out of our stored ranks.
    let mismatch = null;
    for (const [skill, printed] of Object.entries(PRINTED_BASE[p.key] || {})) {
      const got = baseChanceFor(c, skill);
      if (got !== printed) { mismatch = `${skill}: sheet ${printed}, derived ${got}`; break; }
    }
    t.ok(!mismatch, `${p.name}: every printed Base Chance is reproduced${mismatch ? " — " + mismatch : ""}`);

    // Ranks must be legal.
    let illegal = null;
    for (const [skill, rank] of Object.entries(p.skills)) {
      const cap = R.maxSkillRank(skill, p.attributes);
      if (rank > cap) { illegal = `${skill} rank ${rank} over the cap of ${cap}`; break; }
    }
    t.ok(!illegal, `${p.name}: every skill rank is within the cap${illegal ? " — " + illegal : ""}`);

    // The chosen Ability always reads Base Chance 20.
    // Language as the fourth Ability grants one named tongue at 20, not the generic skill.
    if (p.ability === "language") {
      t.eq(baseChanceFor(c, "language"), p.attributes.int,
        `${p.name}: the generic Language skill stays at INT, with ${p.abilityLanguage} the Ability`);
    } else {
      t.eq(baseChanceFor(c, p.ability), D.ABILITY_BASE_CHANCE, `${p.name}: the chosen Ability reads Base Chance 20`);
    }
  }

  // Aidan Hunter's Hand-to-Hand rank sits exactly at the cap, which is what confirms
  // the "+2 over the highest underlying characteristic" reading of the rank cap.
  t.eq(R.maxSkillRank("handtohand", { str: 9 }), 11, "Aidan Hunter's Hand-to-Hand rank 11 on Strength 9 is exactly at the cap");
  t.eq(D.PROFESSION_RULES.repPerYear, 6, "each profession year adds 6 Reputation");
  t.eq(D.PROFESSION_RULES.maxYears, 6, "a profession is capped at 6 years");

  /* ---------------- experience ---------------- */

  t.group("Experience and advancement");

  t.eq(R.missionXP({ rank: "rookie", outcome: "success", roleplay: 0 }), 875, "a Rookie's successful mission pays 875");
  t.eq(R.missionXP({ rank: "agent", outcome: "success", roleplay: 0 }), 1000, "an Agent's successful mission pays 1000");
  t.eq(R.missionXP({ rank: "special", outcome: "failure", roleplay: 0 }), 625, "a Special Agent still earns on a failed mission");
  t.eq(R.missionXP({ rank: "agent", outcome: "partial", roleplay: 750 }), 1250, "role-playing awards cap at +750");
  t.eq(R.missionXP({ rank: "agent", outcome: "partial", roleplay: 9999 }), 1250, "role-playing awards are clamped");
  t.eq(R.xpSkillRankCost(7), 210, "a skill rank costs 30 times the new rank");
  t.eq(R.xpCharacteristicCost(11), 1650, "a characteristic costs 150 times the new value");
  t.eq(D.XP_COSTS.newSkill.flat, 100, "a wholly new skill costs 100 experience");
  t.eq(D.REPUTATION_REDUCTION.dataScrub.xpPerPoint, 100, "data scrubbing costs 100 experience per point");

  /* ---------------- style and Hero Points ---------------- */

  t.group("Hero Points and campaign style");

  t.eq(R.earnsHeroPoint(1, "adventurous", false, false), true, "Adventurous style earns on a Superb non-combat roll");
  t.eq(R.earnsHeroPoint(1, "adventurous", true, false), false, "Adventurous style earns nothing from combat rolls");
  t.eq(R.earnsHeroPoint(1, "cinematic", true, false), true, "Cinematic style earns from combat rolls");
  t.eq(R.earnsHeroPoint(2, "heroic", true, false), true, "Heroic style earns on a Great result");
  t.eq(R.earnsHeroPoint(2, "cinematic", false, false), false, "Cinematic style needs a Superb, not a Great");
  t.eq(R.earnsHeroPoint(1, "adventurous", false, true), false, "a Superb bought with Hero Points earns nothing back");
  t.eq(R.earnsHeroPoint(1, "realistic", true, false), false, "Realistic style matches Adventurous");
  t.eq(D.HERO_POINT_RULES.costPerQualityStep, 1, "one Hero Point shifts one Success Quality step");
  t.eq(D.HERO_POINT_RULES.costPerWoundStep, 1, "one Hero Point reduces one Wound Rank");
  t.eq(D.RANKS.find(r => r.key === "special").heroPoints, 9, "Special Agents start with 9 Hero Points");

  /* ---------------- weapons, gear, encumbrance ---------------- */

  t.group("Equipment");

  const gunner = normalize({ ...blankCharacter("agent"), attributes: { str: 10, dex: 12, wil: 10, per: 12, int: 10 } });
  const ppk = R.WEAPON_BY_KEY.waltherppk;
  t.eq(R.weaponDamageRank(ppk, gunner, {}), "E", "the Walther PPK is Damage Rank E at average range");
  t.eq(R.weaponDamageRank(ppk, gunner, { rangeBand: "close" }), "F", "close range adds a Damage Rank");
  t.eq(R.weaponDamageRank(ppk, gunner, { rangeBand: "long" }), "D", "long range subtracts a Damage Rank");
  t.eq(R.weaponDamageRank(ppk, gunner, { silencer: true }), "D", "a silencer costs a Damage Rank");
  t.eq(R.weaponDamageRank(R.WEAPON_BY_KEY.mp5, gunner, { burst: true }), "I", "burst fire uses the burst Damage Rank");
  t.eq(R.weaponDamageRank(R.WEAPON_BY_KEY.kabar, gunner, {}), "C", "Strength 10 gives Damage Rank B, and a knife adds one");
  t.eq(R.weaponDamageRank(R.WEAPON_BY_KEY.sword, gunner, {}), "E", "Strength 10 with a sword is Damage Rank E");
  t.eq(R.weaponDamageRank({ key: "fist", cat: "hth", drBonus: 0 }, gunner, { kick: true }), "C", "a kick adds a Damage Rank");

  t.eq(R.shotsPerRound(R.WEAPON_BY_KEY.glock19, 2), 2, "shots are limited by Speed");
  t.eq(R.shotsPerRound(R.WEAPON_BY_KEY.sw500, 3), 1, "shots are limited by the weapon's Rate of Fire");
  t.eq(R.isMisfire(98, ppk), true, "a roll inside the misfire range jams the weapon");
  t.eq(R.isMisfire(97, ppk), false, "a roll below the misfire range is fine");
  t.eq(R.isMisfire(99, R.WEAPON_BY_KEY.berettam9), true, "single-value misfire ranges work");

  const loaded = normalize({
    ...gunner,
    inventory: { money: 0, items: [
      { id: "a", name: "Rifle", weight: 9, qty: 1 },
      { id: "b", name: "Ammunition", weight: 2, qty: 5 }
    ] }
  });
  t.eq(derived(loaded).carriedWeight, 19, "carried weight multiplies by quantity");
  t.eq(derived(loaded).carryMax, 150, "Strength 10 carries up to 150 lbs");

  t.eq(D.WEAPONS.filter(w => w.cat === "pistol").length, 13, "the book lists 13 pistols");
  t.ok(D.VEHICLES.length >= 78, "every vehicle in the book is present");
  t.ok(D.GEAR.length >= 100, "the miscellaneous equipment list is present");
  t.eq(D.BODY_ARMOR.find(a => a.key === "lvl2").firearm, 3, "Level 2 body armour stops 3 Damage Ranks of gunfire");

  /* ---------------- conditions ---------------- */

  t.group("Conditions");

  const hurt = normalize({ ...gunner, state: { ...gunner.state, wound: "medium", exhausted: true } });
  t.eq(conditionDFMod(hurt), -5, "a Medium Wound and exhaustion together are -5 Difficulty Factor");
  t.eq(D.EXHAUSTION_DF_PENALTY, -3, "exhaustion is -3 Difficulty Factor");
  t.eq(D.UNTRAINED_DF_PENALTY, -3, "using an untrained skill is -3 Difficulty Factor");
  t.eq(baseChanceFor(gunner, "cryptography"), 10, "an untrained skill uses the characteristic alone");
  t.eq(baseChanceFor(normalize({ ...gunner, abilities: { chosen: "cryptography" } }), "cryptography"), 20,
    "a chosen Ability is always Base Chance 20");

  // Language cannot be used untrained, so it never appears in the rollable skill list.
  t.ok(!skillList(gunner, { includeUntrained: true }).some(s => s.key === "language"),
    "Language is excluded from the untrained skill list");

  // The one-advance-per-mission gate covers characteristics as well as skills.
  const advanced = normalize({ ...gunner, advancedThisMission: { skills: ["firecombat"], attributes: ["dex"] } });
  t.deep(advanced.advancedThisMission, { skills: ["firecombat"], attributes: ["dex"] },
    "the one-advance-per-mission gate tracks both skills and characteristics");
  t.deep(normalize(blankCharacter("agent")).advancedThisMission, { skills: [], attributes: [] },
    "a new character has an empty advancement gate");

  /* ---------------- data integrity ---------------- */

  t.group("Data integrity");

  for (const s of D.SKILLS) {
    if (!s.stats || !s.stats.length) { t.fail(`skill ${s.key} has no underlying characteristics`); break; }
    if (s.stats.some(k => !D.CHARACTERISTIC_KEYS.includes(k))) { t.fail(`skill ${s.key} names an unknown characteristic`); break; }
  }
  t.pass("every skill names valid underlying characteristics");

  for (const p of D.PROFESSIONS) {
    const badSkill = p.skills.find(k => !R.SKILL_BY_KEY[k]);
    if (badSkill) { t.fail(`profession ${p.key} lists unknown skill ${badSkill}`); break; }
    const badFoe = p.foe.find(k => !R.FOE_BY_KEY[k]);
    if (badFoe) { t.fail(`profession ${p.key} lists unknown Field of Experience ${badFoe}`); break; }
  }
  t.pass("every profession references real skills and Fields of Experience");

  const badGeneral = D.GENERAL_FOE.find(k => !R.FOE_BY_KEY[k]);
  t.ok(!badGeneral, "every General Field of Experience is defined");

  const badAbility = D.POTENTIAL_ABILITIES.find(k => k !== "language" && !R.SKILL_BY_KEY[k]);
  t.ok(!badAbility, "every Potential Ability is a real skill");

  for (const q of [1, 2, 3, 4]) {
    for (const r of D.DAMAGE_RANKS) {
      if (!D.WOUND_RANK_TABLE[q][r]) { t.fail(`Wound Rank Table is missing Quality ${q}, Damage Rank ${r}`); break; }
    }
  }
  t.pass("the Wound Rank Table is complete for every Quality and Damage Rank");

  for (const v of D.VEHICLES) {
    if (!D.VEHICLE_SKILL_BY_CAT[v.cat]) { t.fail(`vehicle ${v.key} has no skill mapping for category ${v.cat}`); break; }
  }
  t.pass("every vehicle category maps to a driving, boating or piloting skill");

  /* ---------------- NPCs and encounters ---------------- */

  t.group("NPCs and encounters");

  t.eq(OSIRIS_NPCS.length, 7, "all seven OSIRIS antagonists are present");
  for (const n of OSIRIS_NPCS) {
    const speed = R.speedValue(n.per, n.dex);
    if (speed !== n.speed) { t.fail(`${n.name}: printed Speed ${n.speed} disagrees with PER ${n.per} + DEX ${n.dex} giving ${speed}`); break; }
  }
  t.pass("every OSIRIS antagonist's printed Speed matches their PER + DEX");

  for (const n of OSIRIS_NPCS) {
    const dr = R.hthDamageRank(n.str);
    if (dr !== n.hthDamage) { t.fail(`${n.name}: printed Hand-to-Hand Damage Rank ${n.hthDamage} disagrees with Strength ${n.str} giving ${dr}`); break; }
  }
  t.pass("every OSIRIS antagonist's printed Hand-to-Hand Damage Rank matches their Strength");

  t.eq(ANIMALS.length, 5, "all five animals are present");
  t.eq(ENCOUNTER_TABLES.hot.length, 10, "the Hot encounter table is 10 rows");
  t.eq(ENCOUNTER_TABLES.cold.length, 10, "the Cold encounter table is 10 rows");

  const missing = new Set();
  for (const zone of ["hot", "cold"]) {
    for (const row of ENCOUNTER_TABLES[zone]) {
      if (row.length !== 10) { t.fail(`${zone} encounter table has a row that is not 10 columns`); return; }
      for (const cell of row) {
        const key = cell.replace(/[+-]\d+$/, "");
        if (!ENCOUNTERS[key]) missing.add(key);
      }
    }
  }
  t.ok(missing.size === 0, "every encounter table cell resolves to a defined encounter" +
    (missing.size ? ` (missing: ${[...missing].join(", ")})` : ""));

  for (const key of Object.keys(NPC_CHARACTERISTIC_TABLES)) {
    if (NPC_CHARACTERISTIC_TABLES[key].length !== 10) { t.fail(`NPC characteristic table ${key} is not 10 rows`); break; }
    if (!NPC_SKILL_TABLES[key] || NPC_SKILL_TABLES[key].length !== 10) { t.fail(`NPC skill table ${key} is not 10 rows`); break; }
  }
  t.pass("every NPC generation table is a full 1d10 spread");

  for (const [key, rows] of Object.entries(NPC_SKILL_TABLES)) {
    const bad = rows.flatMap(r => Object.keys(r)).find(k => !R.SKILL_BY_KEY[k]);
    if (bad) { t.fail(`NPC skill table ${key} references unknown skill ${bad}`); break; }
  }
  t.pass("every NPC skill package references real skills");

  soloTests(t);
  helpTests(t);
}

/* ================================================================ how-to copy */
function helpTests(t) {
  t.group("How to use");

  const keys = Object.keys(HELP);
  t.ok(keys.length >= 19, `every screen and Solo panel has an entry (${keys.length})`);

  for (const screen of ["home", "create", "sheet", "gear", "combat", "advance", "rules", "log", "gm", "solo", "settings"]) {
    if (!HELP[screen]) { t.fail(`${screen} has a how-to entry`); }
  }
  t.pass("all eleven screens have a how-to entry");

  for (const panel of ["briefing", "scene", "fate", "events", "meaning", "threads", "characters", "journal"]) {
    if (!HELP["solo." + panel]) { t.fail(`solo.${panel} has a how-to entry`); }
  }
  t.pass("all eight Solo panels have one of their own");

  let shape = null;
  for (const [key, e] of Object.entries(HELP)) {
    if (!e.title || !/^How to use/.test(e.title)) shape = `${key}: title`;
    else if (!e.what || e.what.length > 160) shape = `${key}: what`;
    else if (!Array.isArray(e.steps) || e.steps.length < 3 || e.steps.length > 6) shape = `${key}: ${e.steps && e.steps.length} steps`;
    else if (e.steps.some(x => typeof x !== "string" || !x.trim())) shape = `${key}: empty step`;
  }
  t.ok(!shape, "every entry is a title, one line of what, and three to six steps" + (shape ? ` (${shape})` : ""));

  t.eq(helpFor("nonexistent"), null, "an unknown key resolves to nothing rather than throwing");
  t.ok(!!helpFor("solo.fate"), "a known key resolves");

  t.ok(TUTORIAL.steps.length >= 8, `the tutorial runs a mission end to end (${TUTORIAL.steps.length} steps)`);
  t.deep(TUTORIAL.steps.map(s => s.n), TUTORIAL.steps.map((_, i) => i + 1), "its steps are numbered in order");
  let tut = null;
  for (const step of TUTORIAL.steps) {
    if (!step.title || !Array.isArray(step.body) || !step.body.length) tut = `step ${step.n}`;
  }
  t.ok(!tut, "every tutorial step has a title and a body" + (tut ? ` (${tut})` : ""));
  t.ok(TUTORIAL.steps.some(s => /briefing/i.test(s.title)), "it covers the briefing");
  t.ok(TUTORIAL.steps.some(s => /Start scene/i.test(s.title + s.body.join(" "))), "starting a scene");
  t.ok(TUTORIAL.steps.some(s => /Ask Fate|asking Fate/i.test(s.title + s.body.join(" "))), "asking Fate");
  t.ok(TUTORIAL.steps.some(s => /Random Event/i.test(s.title + s.body.join(" "))), "Random Events");
  t.ok(TUTORIAL.steps.some(s => /End scene|End the scene/i.test(s.title)), "ending a scene");
  t.ok(TUTORIAL.steps.some(s => /End Mission|Close the mission/i.test(s.title + s.body.join(" "))), "and closing the mission");

  const rules = TUTORIAL.steps.filter(s => s.rule).map(s => s.rule);
  const known = D.RULES_TOPICS.map(x => x.key);
  const bad = rules.find(r => !known.includes(r));
  t.ok(!bad, "every rule the tutorial links to is a real rules topic" + (bad ? ` (${bad})` : ""));
  t.ok(rules.length > 0, "and it does link into the Classified rules where the example needs them");
}

/* ================================================================ the Mythic layer
 * A second system and a second source (CLAUDE.md §2, §3.20). These checks never touch
 * data.js: if a Classified value ever leaks into data-solo.js, that is the bug.
 */
function soloTests(t) {

  t.group("Mythic — Meaning Tables");

  t.eq(SOLO.MEANING_TABLES.length, 37, "37 Meaning Tables ship: 9 baseline and 28 authored");
  t.eq(SOLO.MEANING_TABLES.filter(m => m.source === "mm38").length, 9, "nine tables are marked as coming from the supplied report");
  t.eq(SOLO.MEANING_TABLES.filter(m => m.authored).length, 28, "twenty-eight tables are marked as authored for this app (S6)");

  let short = null;
  for (const m of SOLO.MEANING_TABLES) if (m.words.length !== 100) short = `${m.key} has ${m.words.length}`;
  t.ok(!short, "every Meaning Table is exactly 100 entries" + (short ? ` (${short})` : ""));

  t.eq(SOLO.MEANING_TABLES.reduce((n, m) => n + m.words.length, 0), 3700, "3,700 words in total");

  let badToken = null;
  for (const m of SOLO.MEANING_TABLES) {
    const bad = m.words.find(w => !/^[A-Z][A-Za-z-]*$/.test(w));
    if (bad) { badToken = `${m.key}: ${bad}`; break; }
  }
  t.ok(!badToken, "every entry is a single capitalised word, per the one-word rule" + (badToken ? ` (${badToken})` : ""));

  // Authored tables must not repeat a word: the report says weight an outcome with
  // synonyms, not duplicates. Baseline tables reproduce whatever the source printed.
  let authoredDup = null;
  for (const m of SOLO.MEANING_TABLES.filter(x => x.authored)) {
    const dup = m.words.find((w, i) => m.words.indexOf(w) !== i);
    if (dup) { authoredDup = `${m.key}: ${dup}`; break; }
  }
  t.ok(!authoredDup, "no authored table repeats a word" + (authoredDup ? ` (${authoredDup})` : ""));

  // The Objects column of the supplied report repeats Information and Intriguing at 51-52.
  // Reproduced as supplied rather than quietly corrected (S8).
  const objects = SOLO.MEANING_BY_KEY.objects.words;
  t.eq(objects[50], "Information", "the supplied Objects column's repeat at 51 is reproduced as printed (S8)");
  t.eq(objects[51], "Intriguing", "the supplied Objects column's repeat at 52 is reproduced as printed (S8)");

  // Every baseline word list matches the supplied report, cell for cell.
  const report = readFileSync(new URL("./fixtures/mm38-tables.json", import.meta.url), "utf8");
  const fixture = JSON.parse(report);
  let mismatch = null;
  for (const [key, words] of Object.entries(fixture)) {
    const got = SOLO.MEANING_BY_KEY[key].words;
    for (let i = 0; i < 100; i++) {
      if (got[i] !== words[i]) { mismatch = `${key} ${i + 1}: source ${words[i]}, app ${got[i]}`; break; }
    }
    if (mismatch) break;
  }
  t.ok(!mismatch, "all 900 baseline words reproduce the supplied report exactly" + (mismatch ? ` (${mismatch})` : ""));

  let missingAnything = null;
  for (const m of SOLO.MEANING_TABLES.filter(x => x.authored)) {
    const hits = SOLO.ANYTHING_WORDS.filter(w => m.words.includes(w)).length;
    if (hits < 2 && m.key !== "espCodename") missingAnything = `${m.key} carries ${hits}`;
  }
  t.ok(!missingAnything, "every authored table except the codename list seeds Anything Words" + (missingAnything ? ` (${missingAnything})` : ""));

  const groups = [...new Set(SOLO.MEANING_TABLES.map(m => m.group))];
  t.deep(groups, ["Baseline", "Espionage", "Mission", "Flavour", "In play", "World", "Story"],
    "the tables are grouped by what they are for, baseline first");
  for (const g of groups) {
    const n = SOLO.MEANING_TABLES.filter(m => m.group === g).length;
    if (!n) { t.fail(`group ${g} has tables`); break; }
  }
  t.pass("every group carries at least one table");

  let badPair = null;
  for (const m of SOLO.MEANING_TABLES) {
    if (m.pairWith && !SOLO.MEANING_BY_KEY[m.pairWith]) badPair = m.key;
  }
  t.ok(!badPair, "every pairWith points at a real table" + (badPair ? ` (${badPair})` : ""));

  const badFocusTable = Object.entries(SOLO.EVENT_MEANING_BY_FOCUS)
    .find(([, table]) => !SOLO.MEANING_BY_KEY[table]);
  t.ok(!badFocusTable, "every Event Focus suggests a real Meaning Table");

  /* ---------------- fate ---------------- */

  t.group("Mythic — Fate");

  t.eq(SOLO.FATE_ODDS.length, 9, "nine odds from Certain to Impossible");

  // The printed chart, supplied as an image after the first solo build, is the fixture.
  const printed = JSON.parse(readFileSync(new URL("./fixtures/fate-chart.json", import.meta.url), "utf8"));

  let cellMiss = null;
  for (const oddsKey of printed.odds) {
    for (let c = 1; c <= 9; c++) {
      const [exY, target, exN] = printed.chart[oddsKey][c - 1];
      const got = SOLO.fateTarget(oddsKey, c);
      if (got !== target) { cellMiss = `${oddsKey}/CF${c} target: printed ${target}, app ${got}`; break; }
      const gotY = SOLO.exceptionalYes(got);
      if (gotY !== exY) { cellMiss = `${oddsKey}/CF${c} exceptional yes: printed ${exY}, app ${gotY}`; break; }
      const gotN = SOLO.exceptionalNo(got);
      if (gotN !== exN) { cellMiss = `${oddsKey}/CF${c} exceptional no: printed ${exN}, app ${gotN}`; break; }
    }
    if (cellMiss) break;
  }
  t.ok(!cellMiss, "all 81 printed Fate Chart cells reproduce, targets and both exceptional bands" +
    (cellMiss ? ` (${cellMiss})` : ""));

  t.eq(SOLO.fateTarget("fifty", 5), 50, "50/50 at Chaos Factor 5 is a target of 50");
  t.eq(SOLO.fateTarget("certain", 5), 90, "Certain at Chaos Factor 5 is 90, not 99 — the reconstruction had this wrong");
  t.eq(SOLO.fateTarget("certain", 1), 50, "Certain at Chaos Factor 1 is the same 50 as 50/50 at Chaos Factor 5");
  t.eq(SOLO.fateTarget("impossible", 9), 50, "Impossible at Chaos Factor 9 is also 50: the printed chart is one ladder read diagonally");
  t.eq(SOLO.fateTarget("impossible", 1), 1, "Impossible at Chaos Factor 1 bottoms out at 1");
  t.eq(SOLO.fateTarget("certain", 9), 99, "Certain at Chaos Factor 9 tops out at 99");

  // The diagonal is the chart's defining property: one step of chaos equals one step of odds.
  let diagonalBreak = null;
  for (let i = 1; i < SOLO.FATE_ODDS.length; i++) {
    for (let c = 2; c <= 9; c++) {
      const up = SOLO.fateTarget(SOLO.FATE_ODDS[i - 1].key, c - 1);
      const here = SOLO.fateTarget(SOLO.FATE_ODDS[i].key, c);
      if (up !== here) diagonalBreak = `${SOLO.FATE_ODDS[i].key}/CF${c} is ${here}, up-left is ${up}`;
    }
  }
  t.ok(!diagonalBreak, "every cell equals the cell up and to its left" + (diagonalBreak ? ` (${diagonalBreak})` : ""));

  // Monotone along both axes.
  let nonMono = null;
  for (const o of SOLO.FATE_ODDS) {
    for (let c = 2; c <= 9; c++) {
      if (SOLO.fateTarget(o.key, c) < SOLO.fateTarget(o.key, c - 1)) nonMono = `${o.key} at CF ${c}`;
    }
  }
  t.ok(!nonMono, "a higher Chaos Factor never lowers the chance of a Yes" + (nonMono ? ` (${nonMono})` : ""));

  nonMono = null;
  for (let c = 1; c <= 9; c++) {
    for (let i = 1; i < SOLO.FATE_ODDS.length; i++) {
      if (SOLO.fateTarget(SOLO.FATE_ODDS[i].key, c) > SOLO.fateTarget(SOLO.FATE_ODDS[i - 1].key, c)) {
        nonMono = `${SOLO.FATE_ODDS[i].key} at CF ${c}`;
      }
    }
  }
  t.ok(!nonMono, "worse odds never beat better odds at the same Chaos Factor" + (nonMono ? ` (${nonMono})` : ""));

  // Derived thresholds round rather than truncate, and the printed "x" cases return null [S2].
  t.eq(SOLO.exceptionalYes(50), 10, "Exceptional Yes is the low fifth of the Yes range");
  t.eq(SOLO.exceptionalNo(50), 91, "Exceptional No is the top fifth of the No range");
  t.eq(SOLO.exceptionalYes(99), 20, "a target of 99 gives Exceptional Yes 20 — rounding, not truncation");
  t.eq(SOLO.exceptionalNo(99), null, "a target of 99 has no Exceptional No, the printed x");
  t.eq(SOLO.exceptionalYes(1), null, "a target of 1 has no Exceptional Yes, the printed x");
  t.eq(SOLO.exceptionalNo(1), 81, "a target of 1 gives Exceptional No 81");

  let bandBreak = null;
  for (const o of SOLO.FATE_ODDS) {
    for (let c = 1; c <= 9; c++) {
      const target = SOLO.fateTarget(o.key, c);
      const y = SOLO.exceptionalYes(target);
      const n = SOLO.exceptionalNo(target);
      if (y !== null && (y < 1 || y > target)) bandBreak = `${o.key}/CF${c} exceptional yes ${y} vs target ${target}`;
      if (n !== null && n <= target) bandBreak = `${o.key}/CF${c} exceptional no ${n} overlaps target ${target}`;
    }
  }
  t.ok(!bandBreak, "no Fate band overlaps its neighbour at any odds or Chaos Factor" + (bandBreak ? ` (${bandBreak})` : ""));

  // Every roll 1-100 lands in exactly one band, at every odds and Chaos Factor.
  let coverage = null;
  for (const o of SOLO.FATE_ODDS) {
    for (let c = 1; c <= 9; c++) {
      for (let r = 1; r <= 100; r++) {
        const res = SOLO.fateChartAnswer(r, o.key, c);
        if (!res.key) coverage = `${o.key}/CF${c} roll ${r}`;
      }
    }
  }
  t.ok(!coverage, "every d100 result reads as exactly one answer at all 81 cells" + (coverage ? ` (${coverage})` : ""));

  t.eq(SOLO.fateChartAnswer(1, "certain", 9).key, "exceptionalYes", "a 1 at Certain and Chaos Factor 9 is an Exceptional Yes");
  t.eq(SOLO.fateChartAnswer(100, "certain", 9).key, "no", "a 100 answers No even at a target of 99, because 99 is the highest printed target");
  t.eq(SOLO.fateChartAnswer(81, "impossible", 1).key, "exceptionalNo", "81 at Impossible and Chaos Factor 1 is an Exceptional No");
  t.eq(SOLO.fateChartAnswer(1, "impossible", 1).key, "yes", "a 1 at Impossible is a plain Yes: that cell has no Exceptional Yes band");

    t.eq(SOLO.fateChartAnswer(50, "fifty", 5).key, "yes", "rolling exactly the target is a Yes");
  t.eq(SOLO.fateChartAnswer(51, "fifty", 5).key, "no", "one over the target is a No");
  t.eq(SOLO.fateChartAnswer(95, "fifty", 5).key, "exceptionalNo", "a 95 against a target of 50 is an Exceptional No");

  // Random Event trigger (S3).
  t.ok(SOLO.isRandomEventRoll(33, 5), "a double at or under the Chaos Factor fires an event");
  t.ok(!SOLO.isRandomEventRoll(77, 5), "a double above the Chaos Factor does not fire an event");
  t.ok(!SOLO.isRandomEventRoll(34, 5), "a non-double never fires an event");
  t.ok(SOLO.isRandomEventRoll(99, 9), "a 99 fires an event at Chaos Factor 9");
  t.ok(!SOLO.isRandomEventRoll(100, 9), "100 is not a double and fires nothing");
  t.ok(SOLO.fateChartAnswer(22, "fifty", 5).event, "the chart answer reports the event alongside the answer");

  // Fate Check, against the printed Modifiers and Answers tables.
  const check = JSON.parse(readFileSync(new URL("./fixtures/fate-check.json", import.meta.url), "utf8"));

  let modMiss = null;
  for (const [label, mod] of check.oddsModifiers) {
    const row = SOLO.FATE_ODDS.find(o => o.checkName === label);
    if (!row) { modMiss = `no odds row labelled ${label}`; break; }
    if (row.mod !== mod) { modMiss = `${label}: printed ${mod}, app ${row.mod}`; break; }
  }
  t.ok(!modMiss, "every printed Fate Check odds label and Roll Modifier reproduces" + (modMiss ? ` (${modMiss})` : ""));

  let chaosMiss = null;
  for (const [cf, mod] of Object.entries(check.chaosModifiers)) {
    if (SOLO.chaosMod(Number(cf)) !== mod) chaosMiss = `CF ${cf}: printed ${mod}, app ${SOLO.chaosMod(Number(cf))}`;
  }
  t.ok(!chaosMiss, "the printed Chaos Factor modifier column reproduces" + (chaosMiss ? ` (${chaosMiss})` : ""));

  // The check's chaos column is the uneven Roll Modifier ladder, not one step per point —
  // and the chart's diagonal is, so the two adjustments must stay separate.
  t.eq(SOLO.chaosMod(9), 5, "Chaos Factor 9 is worth +5 on a Fate Check, as much as the best odds");
  t.eq(SOLO.chaosMod(2), -4, "Chaos Factor 2 is worth -4, skipping -3 exactly as the printed column does");
  t.eq(SOLO.chartChaosStep(9), 4, "the Fate Chart still moves one ladder position per point of Chaos Factor");
  t.eq(SOLO.chartChaosStep(1), -4, "and four positions down at Chaos Factor 1");

  t.eq(SOLO.FATE_CHECK.threshold, check.thresholds.yes, "a modified total of 11 or more is a Yes");
  t.eq(SOLO.FATE_CHECK.exceptionalYesFrom, check.thresholds.exceptionalYes, "18 or more is an Exceptional Yes");
  t.eq(SOLO.FATE_CHECK.exceptionalNoTo, check.thresholds.exceptionalNo, "4 or less is an Exceptional No");

  t.eq(SOLO.fateCheckAnswer(6, 5, "fifty", 5).key, "yes", "2d10 totalling 11 at 50/50 is a Yes");
  t.eq(SOLO.fateCheckAnswer(5, 5, "fifty", 5).key, "no", "2d10 totalling 10 at 50/50 is a No");
  t.eq(SOLO.fateCheckAnswer(9, 9, "fifty", 5).key, "exceptionalYes", "a total of 18 is an Exceptional Yes");
  t.eq(SOLO.fateCheckAnswer(9, 8, "fifty", 5).key, "yes", "a total of 17 is still a plain Yes");
  t.eq(SOLO.fateCheckAnswer(2, 2, "fifty", 5).key, "exceptionalNo", "a total of 4 is an Exceptional No");
  t.eq(SOLO.fateCheckAnswer(3, 2, "fifty", 5).key, "no", "a total of 5 is a plain No");

  // The bands are fixed totals, not a margin from 11 — that was the reconstruction's error.
  t.eq(SOLO.fateCheckAnswer(8, 8, "fifty", 5).key, "yes", "a total of 16 is a Yes, not an Exceptional Yes: the band is 18, not a margin of 5");
  t.eq(SOLO.fateCheckAnswer(3, 3, "fifty", 5).key, "no", "a total of 6 is a No, not an Exceptional No");

  // Odds and chaos both feed the same total.
  t.eq(SOLO.fateCheckAnswer(5, 5, "certain", 9).total, 20, "odds +5 and Chaos Factor 9 add +10 to the dice");
  t.eq(SOLO.fateCheckAnswer(5, 5, "impossible", 1).total, 0, "odds -5 and Chaos Factor 1 subtract 10");
  t.eq(SOLO.fateCheckAnswer(5, 5, "impossible", 1).key, "exceptionalNo", "which drives the answer past Exceptional No");

  // "Double digits within CF": matching dice AND the number within the Chaos Factor.
  t.ok(SOLO.fateCheckAnswer(4, 4, "fifty", 5).event, "double 4s at Chaos Factor 5 fire an event");
  t.ok(!SOLO.fateCheckAnswer(8, 8, "fifty", 5).event, "double 8s at Chaos Factor 5 do not: the number is outside the Chaos Factor");
  t.ok(SOLO.fateCheckAnswer(8, 8, "fifty", 9).event, "double 8s do fire at Chaos Factor 9");
  t.ok(!SOLO.fateCheckAnswer(4, 5, "fifty", 9).event, "unmatched dice never fire an event");
  t.ok(!SOLO.fateCheckAnswer(2, 2, "fifty", 1).event, "double 2s at Chaos Factor 1 do not fire");
  t.ok(SOLO.fateCheckAnswer(1, 1, "fifty", 1).event, "double 1s at Chaos Factor 1 do");

  t.eq(SOLO.oddsLabel("certain", "check"), "Has To Be", "the Fate Check prints its own label for the best odds");
  t.eq(SOLO.oddsLabel("certain", "chart"), "Certain", "the Fate Chart prints its own");
  t.eq(SOLO.oddsLabel("nearimp", "check"), "No Way", "Nearly Impossible is No Way on the check's table");

  /* ---------------- chaos, scenes, events, lists ---------------- */

  t.group("Mythic — chaos, scenes and events");

  t.eq(SOLO.CHAOS_START, 5, "the Chaos Factor starts at 5");
  t.eq(SOLO.stepChaos(1, -1), 1, "the Chaos Factor clamps at 1 (S4)");
  t.eq(SOLO.stepChaos(9, 1), 9, "the Chaos Factor clamps at 9 (S4)");
  t.eq(SOLO.stepChaos(5, -1), 4, "a scene the character controlled lowers it by one");
  t.eq(SOLO.stepChaos(5, 1), 6, "a scene they did not control raises it by one");
  t.eq(SOLO.chaosMod(5), 0, "Chaos Factor 5 is the neutral column on both mechanics");
  t.eq(SOLO.chartChaosStep(5), 0, "and the neutral ladder position on the chart");

  t.eq(SOLO.sceneTest(9, 5).key, "expected", "a d10 over the Chaos Factor plays the expected scene");
  t.eq(SOLO.sceneTest(3, 5).key, "altered", "an odd roll at or under the Chaos Factor alters the scene");
  t.eq(SOLO.sceneTest(4, 5).key, "interrupt", "an even roll at or under the Chaos Factor interrupts it");
  t.eq(SOLO.sceneTest(10, 9).key, "expected", "a 10 always beats the Chaos Factor");
  t.eq(SOLO.sceneTest(1, 1).key, "altered", "at Chaos Factor 1 only a 1 disturbs the scene, and it alters it");

  t.eq(SOLO.SCENE_ADJUSTMENTS.length, 7, "the printed Scene Adjustment table has seven rows, the last spanning 7-10");
  t.eq(SOLO.SCENE_ADJUSTMENTS[SOLO.SCENE_ADJUSTMENTS.length - 1].max, 10, "the Scene Adjustment table covers 1-10");
  let adjMiss = null;
  for (const [max, name] of printed.sceneAdjustment) {
    const row = SOLO.sceneAdjustment(max);
    if (row.name !== name || row.max !== max) adjMiss = `${max}: printed ${name}, app ${row.name}`;
  }
  t.ok(!adjMiss, "every printed Scene Adjustment row reproduces" + (adjMiss ? ` (${adjMiss})` : ""));
  t.ok(SOLO.sceneAdjustment(7).double && SOLO.sceneAdjustment(10).double,
    "7-10 is flagged as sending you back to the table twice");
  t.ok(!SOLO.sceneAdjustment(6).double, "1-6 are single adjustments");
  t.eq(SOLO.SCENE_ADJUSTMENT_DOUBLE_COUNT, 2, "Make 2 Adjustments means two");

  t.eq(SOLO.EVENT_FOCUS[SOLO.EVENT_FOCUS.length - 1].max, 100, "the Event Focus table covers the whole d100");
  let focusMiss = null;
  for (const [max, name] of printed.eventFocus) {
    const row = SOLO.eventFocus(max);
    if (row.name !== name || row.max !== max) focusMiss = `${max}: printed ${name}, app ${row.name}`;
  }
  t.ok(!focusMiss, "every printed Event Focus band reproduces — the reconstruction was already right" +
    (focusMiss ? ` (${focusMiss})` : ""));
  let gap = null;
  let prev = 0;
  for (const f of SOLO.EVENT_FOCUS) {
    if (f.max <= prev) gap = f.key;
    prev = f.max;
  }
  t.ok(!gap, "Event Focus bands ascend without a gap or an overlap" + (gap ? ` (${gap})` : ""));
  for (let r = 1; r <= 100; r++) {
    if (!SOLO.eventFocus(r)) { t.fail(`Event Focus resolves a roll of ${r}`); break; }
  }
  t.pass("every d100 result resolves to an Event Focus");

  /* ---------------- mysteries: the app's own aid (S20) ---------------- */

  t.group("Mysteries — house aid");

  t.deep(SOLO.MYSTERY_SIZES.map(x => x.size), [4, 6, 8], "clocks come in four, six and eight segments");
  t.eq(SOLO.MYSTERY_DEFAULT_SIZE, 6, "six is the middle default");
  t.deep(SOLO.MYSTERY_SUBJECTS.map(x => x.key), ["objective", "complication", "opponent", "thread"],
    "a mystery can be about the objective, the complication, the opponent or a thread");
  t.ok(SOLO.MYSTERY_SUBJECTS.every(x => !!SOLO.MEANING_BY_KEY[x.table]),
    "every subject's reveal colour comes from a real Meaning Table");
  t.ok(SOLO.MYSTERY_SUBJECT_BY_KEY.objective.rewrites, "only the objective's reveal can rewrite the mission");
  t.ok(!SOLO.MYSTERY_SUBJECT_BY_KEY.opponent.rewrites, "the opponent's cannot");
  t.eq(SOLO.MYSTERY_TICKS.length, 4, "four things fill a segment");

  t.eq(SOLO.REVEAL_SHAPES[SOLO.REVEAL_SHAPES.length - 1].max, 100, "the Reveal table covers the whole d100");
  let revealGap = null;
  let prevMax = 0;
  for (const r of SOLO.REVEAL_SHAPES) {
    if (r.max <= prevMax) revealGap = r.key;
    if (!r.name || !r.desc) revealGap = r.key + " (empty)";
    prevMax = r.max;
  }
  t.ok(!revealGap, "its bands ascend without a gap, and each says what it means" + (revealGap ? ` (${revealGap})` : ""));
  for (let r = 1; r <= 100; r++) {
    if (!SOLO.revealShape(r)) { t.fail(`the Reveal table resolves a roll of ${r}`); break; }
  }
  t.pass("every d100 result resolves to a revelation");
  t.ok(/house aid/i.test(SOLO.MYSTERY_NOTE), "the note on screen calls it a house aid (S20)");
  t.ok(/Blades|Brindlewood/.test(SOLO.MYSTERY_NOTE), "and names where the two ideas come from");

  const mysTopic = SOLO.SOLO_TOPICS.find(x => x.key === "mysteries");
  t.ok(!!mysTopic, "the solo reference carries a mysteries topic");
  t.ok(/house aid/i.test(mysTopic.title + mysTopic.body.join(" ")), "which says the same thing");

  const mys = normalizeAdventure({ mysteries: [
    { subject: "objective", label: "Who wants the film", size: 99, filled: 40 },
    { subject: "nonsense", label: "x", size: 4, filled: -3 },
    { subject: "thread", label: "y", size: 8, filled: 8, revealedAt: 123,
      reveal: { shapeKey: "planted", shapeName: "It was planted", words: ["Deceive", "Urgently"], rolls: [30, 1, 2] } }
  ] }).mysteries;
  t.eq(mys[0].size, 6, "an impossible clock size falls back to six");
  t.eq(mys[0].filled, 6, "and a count past the end is clamped to it");
  t.eq(mys[1].subject, "thread", "an unknown subject falls back to a thread");
  t.eq(mys[1].filled, 0, "and a negative count to zero");
  t.eq(mys[2].reveal.shapeName, "It was planted", "a revealed mystery keeps its rolled answer");
  t.deep(mys[2].reveal.words, ["Deceive", "Urgently"], "words and all");
  t.deep(normalizeAdventure({}).mysteries, [], "an adventure from before version 8 simply has none");

  t.eq(SOLO.LIST_SLOTS, 25, "an Adventure List holds 25 slots");
  t.eq(SOLO.listSlot(1), 1, "d100 1-4 is the first slot");
  t.eq(SOLO.listSlot(4), 1, "d100 4 is still the first slot");
  t.eq(SOLO.listSlot(5), 2, "d100 5 starts the second slot");
  t.eq(SOLO.listSlot(100), 25, "d100 100 is the last slot");
  let slotBreak = null;
  for (let r = 1; r <= 100; r++) {
    const s = SOLO.listSlot(r);
    if (s < 1 || s > SOLO.LIST_SLOTS) slotBreak = String(r);
  }
  t.ok(!slotBreak, "every d100 result lands inside the 25 slots" + (slotBreak ? ` (${slotBreak})` : ""));

  t.eq(SOLO.ANYTHING_WORDS.length, 10, "the ten Anything Words are present");
  t.eq(SOLO.TABLE_BUILD_METHOD.length, 5, "the five-step table-construction method is recorded");
  t.eq(SOLO.SOLO_TOPICS.length, 8, "the solo rules library carries a topic per procedure");
  t.ok(!SOLO.SOLO_TOPICS.some(x => x.key === "meaning"),
    "the Meaning Tables topic is gone: the tables are on the screen, they do not need an essay");
  t.eq(SOLO.SOLO_TOPICS.find(x => x.key === "twosystems").title, "Mythic and Classified",
    "the two-systems topic is titled Mythic and Classified");
  t.deep(SOLO.SOLO_TOPICS.map(x => x.key), ["briefing", "fate", "chaos", "scenes", "events", "lists", "mysteries", "twosystems"],
    "the topic list is Fate, chaos, scenes, events, lists and the two systems");
  t.ok(!("FATE_CHART_VERIFY" in SOLO) && !("EVENT_FOCUS_VERIFY" in SOLO) &&
       !("SCENE_ADJUSTMENT_VERIFY" in SOLO) && !("FATE_CHECK_VERIFY" in SOLO),
    "no verify flags remain: every procedure table is transcribed from a printed original (S1)");

  /* ---------------- persistence ---------------- */

  t.group("Mythic — adventure records");

  const fresh = normalizeAdventure({ name: "Operation Nightjar" });
  t.eq(fresh.chaos, 5, "a new adventure starts at Chaos Factor 5");
  t.eq(fresh.scene, 1, "a new adventure starts at scene 1");
  t.eq(fresh.fateMode, "chart", "the Fate Chart is the default mechanic");
  t.eq(fresh.schema, 8, "an adventure records SCHEMA_VERSION 8");
  t.deep(fresh.threads, [], "the Threads list starts empty");
  t.eq(fresh.scenePhase, "setup", "a new adventure has no scene open yet");
  t.eq(fresh.sceneKind, null, "and no scene outcome recorded");
  t.eq(fresh.sceneExpected, "", "and no expected scene");

  const dirty = normalizeAdventure({
    chaos: 99, scene: -3, fateMode: "nonsense",
    threads: new Array(40).fill(0).map((_, i) => ({ text: "t" + i, weight: 0 })),
    journal: [{ text: "x" }]
  });
  t.eq(dirty.chaos, 9, "an out-of-range Chaos Factor is clamped on load");
  t.eq(dirty.scene, 1, "a nonsense scene number falls back to 1");
  t.eq(dirty.fateMode, "chart", "an unknown Fate mode falls back to the chart");
  t.eq(normalizeAdventure({ scenePhase: "nonsense" }).scenePhase, "setup", "an unknown scene phase falls back to setup");
  t.eq(normalizeAdventure({ scenePhase: "play" }).scenePhase, "play", "a scene in play survives a reload");
  t.eq(normalizeAdventure({ sceneKind: "wat" }).sceneKind, null, "an unknown scene outcome is dropped");
  t.eq(normalizeAdventure({ sceneKind: "interrupt" }).sceneKind, "interrupt", "a real one is kept");
  t.eq(dirty.threads.length, 25, "a list longer than 25 slots is truncated on load");
  t.eq(dirty.threads[0].weight, 1, "a weight below 1 is corrected on load");
  t.ok(!!dirty.journal[0].id && !!dirty.journal[0].ts, "journal entries are back-filled with an id and a timestamp");

  t.ok(typeof Store_wipeAdventures === "function", "the store exposes a mission wipe");
  t.ok(typeof Store_wipeCharacters === "function", "and a character wipe");

  const v3 = normalizeAdventure(undefined);
  t.ok(!!v3.id && v3.threads.length === 0 && v3.journal.length === 0,
    "a missing record normalizes into a legal empty adventure, so a version-3 backup imports cleanly");

  // A version-4 adventure predates the scene phase and must open at setup, not mid-scene.
  const v4 = normalizeAdventure({ id: "adv_old", schema: 4, chaos: 7, scene: 5, journal: [] });
  t.eq(v4.scenePhase, "setup", "a version-4 adventure loads with no scene open");
  t.eq(v4.chaos, 7, "and keeps its Chaos Factor");
  t.eq(v4.scene, 5, "and its scene count");

  // A version-6 briefing predates the seeded-entry ids and must still load.
  const v6 = normalizeAdventure({
    id: "adv_v6", schema: 6, scenePhase: "setup",
    briefing: { rows: { objective: { text: "Recover the case" } }, npc: { name: "x" }, writtenAt: 1 }
  });
  t.deep(v6.briefing.seededIds, [], "a version-6 briefing back-fills an empty seeded-entry list");
  t.eq(v6.briefing.rows.objective.text, "Recover the case", "and keeps every row it had");
  t.deep(normalizeAdventure({ briefing: { rows: {}, seededIds: ["li_1", "li_2"] } }).briefing.seededIds,
    ["li_1", "li_2"], "recorded seeded ids survive a reload");

  /* ---------------- the briefing's opponent ---------------- */

  t.group("Mythic — the briefing's Primary Opponent");

  const oppCfg = SOLO.BRIEFING_OPPONENT;
  t.eq(oppCfg.stereotype, "opponent", "the briefing's opponent is a Primary Opponent");
  t.eq(oppCfg.rank, "special", "at Villain rank");
  t.ok(!!SOLO.MEANING_BY_KEY[oppCfg.aliasTable], "its codename comes off a real Meaning Table");
  t.ok(!!SOLO.MEANING_BY_KEY[oppCfg.traitTable], "and its two describing words off another");
  t.ok(SOLO.BRIEFING_ROWS.find(r => r.key === "opponent").placeholder !== "Villain Primary Opponent",
    "the placeholder is no longer the generator's own category label");
}
