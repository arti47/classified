/* tests/unit.js — pure-logic regression checks against the rulebook.
 * These run in Node: data.js, src/rules.js and src/derived.js are DOM-free. */

import * as D from "../data.js";
import * as R from "../src/rules.js";
import { blankCharacter, normalize, derived, skillList, validate, creationSpend, baseChanceFor, conditionDFMod } from "../src/derived.js";
import { ANIMALS } from "../data-monsters.js";
import { OSIRIS_NPCS, ENCOUNTER_TABLES, ENCOUNTERS, NPC_CHARACTERISTIC_TABLES, NPC_SKILL_TABLES } from "../data-npcs.js";

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
}
