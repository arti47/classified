/* Classified — core rules library.
 * Every number here is extracted from the Classified rulebook (Expeditious Retreat Press,
 * OGL 1.0a). Chapter citations are given as [Ch.N] / page numbers where printed.
 * Effect text is paraphrased, never copied. Setting/adventure content excluded.
 *
 * SINGLE SOURCE OF TRUTH: no rules number may be hardcoded in src/ modules.
 */

/* ---------------------------------------------------------------- 1. RESOLUTION */

export const DIFFICULTY_FACTORS = [0.5, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
export const BASE_DIFFICULTY_FACTOR = 5;      // [Ch.1] base DF for all actions
export const MAX_BASE_CHANCE = 30;            // [Ch.3] "Base Chance maximum is 30"
export const MAX_SUCCESS_CHANCE = 300;
export const SKILL_RANK_OVER_CHARACTERISTIC = 2; // [Ch.2/3/6] rank <= highest under-stat +2

export const QUALITY = { SUPERB: 1, GREAT: 2, GOOD: 3, FAIR: 4, FAILURE: 5 };
export const QUALITY_NAMES = {
  1: "Superb (1)", 2: "Great (2)", 3: "Good (3)", 4: "Fair (4)", 5: "Failure"
};
export const QUALITY_SHORT = { 1: "Superb", 2: "Great", 3: "Good", 4: "Fair", 5: "Failure" };

/* The printed Success Quality Table is a pure function of the Success Chance row.
 * For row n (n = ceil(SC/10), 1..30):
 *   Superb 1..n | Great n+1..2n | Good 2n+1..min(5n, cap) | Fair rest | else Failure
 * where cap = SC when SC<=100, else 98; Fair tops out at SC (<=100) or 99. A d100 of
 * 100 is ALWAYS a failure. [Ch.1, Success Quality Table]
 * Two printed cells contain typesetting errors and are corrected by this derivation:
 *   - row 161-170 prints Good 35-85 / Fair 85-99 (85 overlaps); Fair starts at 86.
 *   - the Multiplication Table prints 8x7=46 (56) and 23x10=260 (230).
 */
export function qualityBands(successChance) {
  const sc = Math.max(1, Math.min(MAX_SUCCESS_CHANCE, Math.floor(successChance)));
  const n = Math.min(30, Math.max(1, Math.ceil(sc / 10)));
  const capHigh = sc <= 100 ? sc : 98;
  const fairTop = sc <= 100 ? Math.min(sc, 99) : 99;
  const superb = [1, n];
  const great = [n + 1, 2 * n];
  const goodTop = Math.min(5 * n, capHigh);
  const good = goodTop >= 2 * n + 1 ? [2 * n + 1, goodTop] : null;
  const fairFloor = (good ? good[1] : great[1]) + 1;
  const fair = fairTop >= fairFloor ? [fairFloor, fairTop] : null;
  return { sc, superb, great, good, fair };
}

/** Map a d100 roll against a Success Chance to a Quality (1-5). 100 always fails. */
export function qualityForRoll(roll, successChance) {
  if (roll >= 100) return QUALITY.FAILURE;
  const b = qualityBands(successChance);
  if (roll <= b.superb[1]) return QUALITY.SUPERB;
  if (roll <= b.great[1]) return QUALITY.GREAT;
  if (b.good && roll <= b.good[1]) return QUALITY.GOOD;
  if (b.fair && roll <= b.fair[1]) return QUALITY.FAIR;
  return QUALITY.FAILURE;
}

/** Multiplication Table: Success Chance = Base Chance x Difficulty Factor. DF 1/2 rounds down. */
export function successChance(baseChance, df) {
  const bc = Math.max(0, Math.min(MAX_BASE_CHANCE, Math.floor(baseChance)));
  const raw = df === 0.5 ? Math.floor(bc / 2) : bc * df;
  return Math.max(0, Math.min(MAX_SUCCESS_CHANCE, raw));
}

/** Difficulty Factor can never fall below 1/2 or rise above 10. [Ch.1] */
export function clampDF(df) {
  if (df <= 0.5) return 0.5;
  if (df >= 10) return 10;
  return Math.round(df);
}

/** Step a DF up/down the legal ladder by n steps (modifiers are ladder steps). */
export function stepDF(df, steps) {
  const idx = DIFFICULTY_FACTORS.indexOf(clampDF(df));
  const i = Math.max(0, Math.min(DIFFICULTY_FACTORS.length - 1, idx + steps));
  return DIFFICULTY_FACTORS[i];
}

/* Skill Time and Information Table [Ch.3] */
export const SKILL_TIME_INFO = {
  1: { time: 0.25, timeLabel: "1/4 base time", info: "100%" },
  2: { time: 0.5, timeLabel: "1/2 base time", info: "90%" },
  3: { time: 1, timeLabel: "base time", info: "75%" },
  4: { time: 2, timeLabel: "2x base time", info: "50%" },
  5: { time: 3, timeLabel: "3x base time", info: "False information" }
};

/* ---------------------------------------------------------------- 2. CHARACTERISTICS */

export const CHARACTERISTICS = [
  { key: "str", name: "Strength", abbr: "STR", desc: "Physical prowess and condition." },
  { key: "dex", name: "Dexterity", abbr: "DEX", desc: "Adroitness, grace, fine coordination." },
  { key: "wil", name: "Willpower", abbr: "WIL", desc: "Mental strength, pain tolerance, discipline." },
  { key: "per", name: "Perception", abbr: "PER", desc: "Awareness and judgement of what matters." },
  { key: "int", name: "Intelligence", abbr: "INT", desc: "Reasoning, education, raw brainpower." }
];
export const CHARACTERISTIC_KEYS = CHARACTERISTICS.map(c => c.key);
export const CHARACTERISTIC_BASE = 5;   // [Ch.2] all PCs start at 5
export const CHARACTERISTIC_MIN = 1;
export const CHARACTERISTIC_MAX = 15;

/* Creation Point cost of a characteristic value [Ch.2, Characteristics Table] */
export const CHARACTERISTIC_COST = {
  5: 0, 6: 10, 7: 20, 8: 30, 9: 40, 10: 50, 11: 60, 12: 80, 13: 100, 14: 120, 15: 140
};

/* Relative weight of each characteristic across the skill list [Ch.3 sidebar] */
export const CHARACTERISTIC_WEIGHT = { str: 2.5, dex: 5, wil: 4, per: 5, int: 8 };

/* ---------------------------------------------------------------- 3. RANKS */

export const RANKS = [
  { key: "rookie", name: "Rookie", creationPoints: 300, heroPoints: 3, scarChance: 0,
    xpModifier: -125, npcName: "Punk", npcHeroDice: "1d10-4",
    expectedSkillCharTotal: "<125" },
  { key: "agent", name: "Agent", creationPoints: 600, heroPoints: 6, scarChance: 0.5,
    xpModifier: 0, npcName: "Criminal", npcHeroDice: "4+(1d10-5)",
    expectedSkillCharTotal: "126-250" },
  { key: "special", name: "Special Agent", creationPoints: 900, heroPoints: 9, scarChance: 0.75,
    xpModifier: 500, npcName: "Villain", npcHeroDice: "9+(1d10-5)",
    expectedSkillCharTotal: ">250" }
];

/* ---------------------------------------------------------------- 4. PHYSICAL TRAITS */

/* Physical Traits Table [Ch.2]. Nine symmetric bands; cost/reputation shared by both
 * columns. Height/weight rows should not differ by more than one band (guideline). */
export const PHYSICAL_BANDS = [
  { i: 0, male: { h: "under 5'4\"", w: "under 135 lbs" }, female: { h: "under 5'", w: "under 105 lbs" }, cp: 4, rep: 40 },
  { i: 1, male: { h: "5'4\"-5'5\"", w: "135-149 lbs" }, female: { h: "5'-5'1\"", w: "105-114 lbs" }, cp: 8, rep: 20 },
  { i: 2, male: { h: "5'6\"-5'7\"", w: "150-164 lbs" }, female: { h: "5'2\"-5'3\"", w: "115-119 lbs" }, cp: 12, rep: 10 },
  { i: 3, male: { h: "5'8\"-5'9\"", w: "165-179 lbs" }, female: { h: "5'4\"-5'5\"", w: "120-124 lbs" }, cp: 16, rep: 5 },
  { i: 4, male: { h: "5'10\"-5'11\"", w: "180-194 lbs" }, female: { h: "5'6\"-5'7\"", w: "125-134 lbs" }, cp: 20, rep: 0 },
  { i: 5, male: { h: "6'-6'1\"", w: "195-209 lbs" }, female: { h: "5'8\"-5'9\"", w: "135-149 lbs" }, cp: 16, rep: 5 },
  { i: 6, male: { h: "6'2\"-6'3\"", w: "210-224 lbs" }, female: { h: "5'10\"-5'11\"", w: "150-174 lbs" }, cp: 12, rep: 10 },
  { i: 7, male: { h: "6'4\"-6'5\"", w: "225-239 lbs" }, female: { h: "6'-6'1\"", w: "175-189 lbs" }, cp: 8, rep: 20 },
  { i: 8, male: { h: "over 6'5\"", w: "over 239 lbs" }, female: { h: "over 6'1\"", w: "over 189 lbs" }, cp: 4, rep: 40 }
];

/* Appearance Table [Ch.2] */
export const APPEARANCES = [
  { key: "ugly", name: "Ugly", cp: 12, rep: 20, seduction: -3 },
  { key: "plain", name: "Plain", cp: 16, rep: 10, seduction: -2 },
  { key: "normal", name: "Normal", cp: 20, rep: 0, seduction: -1 },
  { key: "goodlooking", name: "Good Looking", cp: 16, rep: 10, seduction: 0 },
  { key: "attractive", name: "Attractive", cp: 12, rep: 20, seduction: 1 },
  { key: "stunning", name: "Stunning", cp: 8, rep: 35, seduction: 2 },
  { key: "gorgeous", name: "Gorgeous", cp: 4, rep: 50, seduction: 4 }
];

/* ---------------------------------------------------------------- 5. SKILLS */

/* formula: characteristics averaged (avg) or summed straight (single).
 * base = floor(formula value) + skill rank, capped at MAX_BASE_CHANCE. */
export const SKILLS = [
  { key: "boating", name: "Boating", stats: ["dex", "per"], mode: "avg", baseTime: "1 round in a chase; GM's call otherwise", repair: "24 hours", chase: true, group: "Vehicle",
    desc: "Handle surface and submarine watercraft. Mostly used in chases." },
  { key: "charisma", name: "Charisma", stats: ["wil"], mode: "single", baseTime: "10 minutes", repair: null, group: "Social",
    desc: "Impressions you make and how well you get what you want. Drives NPC Reaction and Persuasion." },
  { key: "cryptography", name: "Cryptography", stats: ["int"], mode: "single", baseTime: "1 hour", repair: "12 hours", group: "Technical",
    desc: "Encrypt and decrypt. Encoding needs Good (3) or better at the chosen security rank; each failed attempt costs an hour and must change the rank." },
  { key: "demolitions", name: "Demolitions", stats: ["int"], mode: "single", baseTime: "10 minutes", repair: "Ruined equipment cannot be repaired", group: "Technical",
    desc: "Work with explosives, improvise charges, and set them to fire." },
  { key: "disguise", name: "Disguise", stats: ["int"], mode: "single", baseTime: "10 minutes general / 2 hours for a specific person", repair: null, group: "Covert",
    desc: "Alter appearance. Seeing through it is a PER check at DF equal to the disguise's Quality (DF 10 if the disguise roll failed). Also makes fake fingerprints (DF 3) and palm prints (DF 2)." },
  { key: "diving", name: "Diving", stats: ["str", "dex"], mode: "avg", baseTime: "1 round in a chase", repair: "3 hours", chase: true, group: "Vehicle",
    desc: "Operate underwater; replaces combat skills when fighting in water. Snorkel depth rank x10 ft, snorkel duration rank x20 sec, scuba depth rank x30 ft, swim speed rank +5 ft/round." },
  { key: "driving", name: "Driving", stats: ["dex", "per"], mode: "avg", baseTime: "1 round in a chase", repair: "6 hours", chase: true, group: "Vehicle",
    desc: "Wheeled land vehicles." },
  { key: "electronics", name: "Electronics", stats: ["int"], mode: "single", baseTime: "1 hour", repair: "4 hours", group: "Technical",
    desc: "Security systems, computers, bugs, sabotage. Sabotage without leaving evidence needs Superb (1)." },
  { key: "evasion", name: "Evasion", stats: ["str", "dex"], mode: "avg", baseTime: "1 round in a chase", repair: "2 hours", chase: true, group: "Physical",
    desc: "Foot chases and unusual escape situations." },
  { key: "firecombat", name: "Fire Combat", stats: ["dex", "per"], mode: "avg", baseTime: "1 round", repair: "6 hours", group: "Combat",
    desc: "Firearms, rockets, bows and other launched projectiles. Vehicle-mounted weapons use the vehicle skill instead." },
  { key: "gambling", name: "Gambling", stats: ["per"], mode: "single", baseTime: "per hand", repair: null, group: "Social",
    desc: "Games of chance. Two sequential checks per hand." },
  { key: "handtohand", name: "Hand-to-Hand Combat", stats: ["str"], mode: "single", baseTime: "1 round", repair: "1 hour", group: "Combat",
    desc: "Unarmed and hand weapons; also all thrown weapons including grenades." },
  { key: "interrogation", name: "Interrogation", stats: ["int"], mode: "single", baseTime: "18 hours", repair: "2 hours", group: "Social",
    desc: "Extract information without physical pain. Mild discomfort only." },
  { key: "language", name: "Language", stats: ["int"], mode: "single", baseTime: "usually instant", repair: null, group: "Knowledge", multi: true, noRankCap: true,
    desc: "Speak and read a language. The only skill with no rank cap." },
  { key: "localcustoms", name: "Local Customs", stats: ["per"], mode: "single", baseTime: "varies", repair: null, group: "Social",
    desc: "Fit in locally, find fences and contacts. Modifies Reaction rolls by Quality." },
  { key: "lockpicking", name: "Lockpicking/Safecracking", stats: ["dex"], mode: "single", baseTime: "3 minutes locks / 15 minutes safes", repair: "10 minutes / 2 hours", group: "Covert",
    desc: "Open locks and safes with tools. A Superb (1) leaves every like lock in the building at +1 DF." },
  { key: "mountaineering", name: "Mountaineering", stats: ["str", "wil"], mode: "avg", baseTime: "15 minutes per 100 feet", repair: "2 hours", group: "Physical",
    desc: "Climb vertical surfaces. Failure is a fall; careful climbing is +2 DF at double time." },
  { key: "pickpocket", name: "Pickpocket", stats: ["dex"], mode: "single", baseTime: "instant", repair: null, group: "Covert",
    desc: "Lift items up to handgun size unnoticed." },
  { key: "piloting", name: "Piloting", stats: ["dex", "per"], mode: "avg", baseTime: "1 round in a chase", repair: "24 hours", chase: true, group: "Vehicle",
    desc: "Aircraft including blimps and balloons." },
  { key: "riding", name: "Riding", stats: ["wil", "per"], mode: "avg", baseTime: "1 round in a chase", repair: "1 hour, or as First Aid for animals", chase: true, group: "Vehicle",
    desc: "Control ridden animals." },
  { key: "science", name: "Science", stats: ["int"], mode: "single", baseTime: "1 hour", repair: "18 hours", group: "Technical",
    desc: "Scientific procedure and conclusions. Specialists get +2 DF in field, -1 DF outside it." },
  { key: "seduction", name: "Seduction", stats: ["wil"], mode: "seduction", baseTime: "an evening or longer", repair: null, group: "Social",
    desc: "Five staged rolls; success at stage 5 forces a fresh Reaction roll at +5 DF. Formula averages WIL with your Charisma skill rank." },
  { key: "sixthsense", name: "Sixth Sense", stats: ["per", "int"], mode: "avg", baseTime: "instant", repair: null, group: "Covert", gmRolled: true,
    desc: "Sense danger and wrongness. Always rolled by the GM; a player can never invoke it." },
  { key: "stealth", name: "Stealth", stats: ["wil"], mode: "single", baseTime: "1 minute per 50 feet", repair: null, group: "Covert",
    desc: "Move unseen using available cover. Needs cover or concealment. Roll every 100 feet travelled." },
  { key: "torture", name: "Torture", stats: ["wil", "int"], mode: "avg", baseTime: "10 hours", repair: "6 hours", group: "Social",
    desc: "Physical coercion for information. Normally an NPC skill." }
];

export const SKILL_COST_NEW = 10;      // [Ch.2] Creation Points to acquire a skill
export const SKILL_COST_RANK = 2;      // [Ch.2] Creation Points per Skill Rank
export const UNTRAINED_DF_PENALTY = -3;// [Ch.3] using a skill you lack
export const STARTING_SKILLS = ["charisma", "driving"]; // every character starts with rank 1

/* Abilities: fixed Base Chance 20, never improvable [Ch.2/3] */
export const ABILITY_BASE_CHANCE = 20;
export const FIXED_ABILITIES = [
  { key: "connoisseur", name: "Connoisseur",
    desc: "Judge food, drink, tobacco and etiquette; know source, price, quality and correct use. A success gives +1 DF on a Seduction attempt." },
  { key: "firstaid", name: "First Aid",
    desc: "Patch a wounded person, reducing their Wound Rank by one. Once per wound, within one hour of the wounding." },
  { key: "nativelanguage", name: "Native Language",
    desc: "Your native tongue, equivalent to Language Skill Rank 20." }
];
export const POTENTIAL_ABILITIES = [
  "boating", "cryptography", "demolitions", "disguise", "diving", "electronics",
  "gambling", "language", "mountaineering", "pickpocket", "piloting", "riding", "science"
];

/* Language Fluency Table [Ch.3] */
export const LANGUAGE_FLUENCY = [
  { min: 1, max: 3, label: "Crude", desc: "Basic signs and simple sentences; halting, simplistic conversation." },
  { min: 4, max: 7, label: "Basic", desc: "Most signs and longer text; basic conversation with a thick accent." },
  { min: 8, max: 11, label: "Beginning fluency", desc: "Simple material, average conversation, noticeable accent." },
  { min: 12, max: 14, label: "Fluent", desc: "Complex material and conversation; slight accent." },
  { min: 15, max: 19, label: "True fluency", desc: "Sounds native; can adopt a regional accent on demand." },
  { min: 20, max: 99, label: "Elite", desc: "Subtlest writing and speech, dialects and archaic forms; always succeeds at accents." }
];

/* ---------------------------------------------------------------- 6. DERIVED STATS */

export const CARRYING_CAPACITY = [
  { max: 5, range: "60-100 lbs", low: 60, high: 100 },
  { max: 10, range: "101-150 lbs", low: 101, high: 150 },
  { max: 13, range: "151-210 lbs", low: 151, high: 210 },
  { max: 14, range: "211-280 lbs", low: 211, high: 280 },
  { max: 15, range: "281-350 lbs", low: 281, high: 350 }
];
export const RUN_SWIM_MINUTES = [
  { max: 5, value: 10 }, { max: 10, value: 25 }, { max: 13, value: 40 },
  { max: 14, value: 55 }, { max: 15, value: 60 }
];
export const HTH_DAMAGE_RANK = [
  { max: 8, value: "A" }, { max: 13, value: "B" }, { max: 15, value: "C" }
];
export const SPEED_TABLE = [
  { max: 7, value: 0 }, { max: 15, value: 1 }, { max: 23, value: 2 }, { max: 30, value: 3 }
];
export const STAMINA_HOURS = [
  { max: 5, value: 24 }, { max: 10, value: 28 }, { max: 13, value: 30 },
  { max: 14, value: 33 }, { max: 15, value: 36 }
];
export const EXHAUSTION_DF_PENALTY = -3;   // carrying/stamina overrun
export const EXHAUSTION_REST = {
  carry: "15 minutes rest", runSwim: "30 minutes rest", stamina: "at least 5 hours sleep"
};

/* ---------------------------------------------------------------- 7. WEAKNESSES */

export const WEAKNESSES = [
  { key: "acrophobia", name: "Acrophobia", type: "Fear", cp: 5, desc: "Fear of heights." },
  { key: "agoraphobia", name: "Agoraphobia", type: "Fear", cp: 5, desc: "Fear of open spaces." },
  { key: "alcohol", name: "Alcohol Dependence", type: "Distraction", cp: 8, desc: "Drinks more than is wise and finds it hard to refuse one." },
  { key: "arachnophobia", name: "Arachnophobia", type: "Fear", cp: 8, desc: "Fear of spiders." },
  { key: "claustrophobia", name: "Claustrophobia", type: "Fear", cp: 5, desc: "Fear of enclosed spaces." },
  { key: "drugs", name: "Drug Dependence", type: "Distraction", cp: 13, desc: "Addicted to legal or illegal drugs." },
  { key: "snakes", name: "Fear of Snakes", type: "Fear", cp: 8, desc: "Fear of snakes." },
  { key: "gambling", name: "Gambling", type: "Distraction", cp: 10, desc: "Wagers higher and more often than is social; cannot walk away from a dare." },
  { key: "greed", name: "Greed", type: "Distraction", cp: 10, desc: "Cannot pass up cash and likes to display wealth." },
  { key: "personaltie", name: "Personal Tie", type: "Distraction", cp: 10, desc: "Emotionally close to people an enemy can exploit." },
  { key: "sadism", name: "Sadism", type: "Distraction", cp: 10, desc: "Enjoys causing pain." },
  { key: "sexual", name: "Sexual Attraction", type: "Distraction", cp: 10, desc: "Prone to emotional entanglement beyond what an operative should allow." },
  { key: "superstition", name: "Superstition", type: "Distraction", cp: 8, desc: "Believes deeply in luck, fate or ritual." }
];
export const WEAKNESS_MAX_DEFAULT = 2;   // GM may allow more
export const WEAKNESS_CHECK = {
  skill: null, characteristic: "wil",
  desc: "When a Weakness comes into play, roll Willpower. Failure raises the Difficulty Factor of the action at hand."
};

/* ---------------------------------------------------------------- 8. PROFESSIONS & FoE */

export const PROFESSION_RULES = {
  startAge: 25, maxYears: 6, cpPerYear: 2, foePerYear: 1, repPerYear: 6
};

export const PROFESSIONS = [
  { key: "criminal", name: "Criminal", desc: "A criminal past: thief, con artist and the like.",
    skills: ["charisma", "disguise", "gambling", "handtohand", "lockpicking", "mountaineering", "seduction", "sixthsense", "stealth"],
    foe: ["computers", "finearts", "jewelry", "law", "mecheng", "rarecollectibles"] },
  { key: "freelancer", name: "Freelancer", desc: "Mercenary, private investigator or fraud investigator.",
    skills: ["boating", "cryptography", "demolitions", "diving", "driving", "electronics", "evasion", "firecombat", "handtohand", "interrogation", "piloting", "riding", "stealth"],
    foe: ["computers", "economics", "intlaw", "law", "linguistics", "polisci"] },
  { key: "journalist", name: "Journalist", desc: "Reporting and investigation.",
    skills: ["charisma", "disguise", "driving", "gambling", "interrogation", "localcustoms", "sixthsense", "stealth"],
    foe: ["computers", "economics", "history", "polisci"] },
  { key: "lawenforcement", name: "Law Enforcement", desc: "Police work at local or national level.",
    skills: ["disguise", "electronics", "evasion", "firecombat", "handtohand", "interrogation", "riding", "sixthsense", "stealth"],
    foe: ["computers", "forensics", "law", "toxicology"] },
  { key: "military", name: "Military", desc: "Service in a national military or militant group.",
    skills: ["boating", "demolitions", "diving", "driving", "electronics", "firecombat", "handtohand", "interrogation", "localcustoms", "piloting"],
    foe: ["computers", "mecheng", "milsci"] },
  { key: "milintel", name: "Military Intelligence", desc: "The intelligence branch of a national military.",
    skills: ["cryptography", "demolitions", "disguise", "driving", "evasion", "firecombat", "piloting", "science", "sixthsense"],
    foe: ["forensics", "intlaw", "linguistics", "milsci", "polisci", "toxicology"] },
  { key: "professional", name: "Professional", desc: "Terminal degree or professional licence: professor, lawyer, doctor, clergy.",
    skills: ["cryptography", "electronics", "language", "localcustoms"],
    foe: ["architecture", "cinema", "computers", "dance", "finearts", "history", "intlaw", "law", "linguistics", "literature", "medicine", "music", "philosophy", "rarecollectibles", "religion", "theater"] },
  { key: "scientist", name: "Scientist", desc: "Work in a scientific field.",
    skills: ["cryptography", "electronics", "localcustoms", "science"],
    foe: ["biology", "botany", "chemistry", "computers", "economics", "linguistics", "medicine", "spacesciences"] }
];

/* Two General Fields of Experience may replace one profession Field of Experience. */
export const GENERAL_FOE = [
  "amfootball", "baseball", "boardgames", "computers", "cricket", "economics", "football",
  "golf", "icehockey", "linguistics", "polo", "snowskiing", "squash", "tennis", "wargaming", "waterskiing"
];
export const GENERAL_FOE_EXCHANGE = 2;

export const FIELDS_OF_EXPERIENCE = [
  { key: "amfootball", name: "American Football", type: "performance", desc: "Play American football; know its culture and history." },
  { key: "architecture", name: "Architecture", type: "information", desc: "Understand structures and their commonalities; can accurately case buildings." },
  { key: "baseball", name: "Baseball", type: "performance", desc: "Play baseball; know its culture and history." },
  { key: "biology", name: "Biology", type: "information", desc: "Biology and biochemistry; lab equipment and practice; read technical writing." },
  { key: "boardgames", name: "Board Games", type: "performance", desc: "Backgammon, go, checkers, chess and their culture." },
  { key: "botany", name: "Botany", type: "information", desc: "Plants, plant labs, and field identification." },
  { key: "chemistry", name: "Chemistry", type: "information", desc: "Chemistry, chemical lab equipment and practice." },
  { key: "cinema", name: "Cinema", type: "information", desc: "Film, its culture and history." },
  { key: "computers", name: "Computers", type: "information", desc: "Use computers and technology; common languages and hardware." },
  { key: "cricket", name: "Cricket", type: "performance", desc: "Play cricket; know its culture and history." },
  { key: "dance", name: "Dance", type: "performance", desc: "Dance and the culture of dance." },
  { key: "economics", name: "Economics/Business", type: "information", desc: "Current economic affairs, business reports and business culture." },
  { key: "finearts", name: "Fine Arts", type: "information", desc: "Two- and three-dimensional art; estimate a piece's value range." },
  { key: "football", name: "Football", type: "performance", desc: "Play football; know its culture and history." },
  { key: "forensics", name: "Forensics", type: "information", desc: "Current forensic methods and procedures." },
  { key: "golf", name: "Golf", type: "performance", desc: "Play golf; know its culture and history." },
  { key: "history", name: "History", type: "information", desc: "The history of humanity." },
  { key: "icehockey", name: "Ice Hockey", type: "performance", desc: "Play ice hockey; know its culture and history." },
  { key: "intlaw", name: "International Law", type: "information", desc: "International law and its effect on covert action." },
  { key: "jewelry", name: "Jewelry", type: "information", desc: "Precious metal, gems and jewelry; estimate value range." },
  { key: "law", name: "Law", type: "information", desc: "Native-country law, punishments and law-enforcement agencies." },
  { key: "linguistics", name: "Linguistics", type: "information", desc: "Speak one extra Language at Skill Rank 15 and pay half cost for new or improved languages." },
  { key: "literature", name: "Literature", type: "information", desc: "Literature; write elegantly; know its culture and history." },
  { key: "mecheng", name: "Mechanical Engineering", type: "information", desc: "How machinery and factories work; case buildings and locate ducts, elevators and the like." },
  { key: "medicine", name: "Medicine", type: "information", desc: "Human anatomy, physiology and disease. Enables hospital-grade care with supplies and a First Aid check." },
  { key: "milsci", name: "Military Science", type: "information", desc: "Military history, protocol, rank and administration." },
  { key: "music", name: "Music", type: "performance", desc: "Play one instrument very well and others passably; know music's culture and history." },
  { key: "philosophy", name: "Philosophy", type: "information", desc: "Philosophy, its culture and history." },
  { key: "polisci", name: "Political Science", type: "information", desc: "Current political affairs, leaders and organisations; assess political consequences." },
  { key: "polo", name: "Polo", type: "performance", desc: "Play polo (with the Riding skill); know its culture and history." },
  { key: "rarecollectibles", name: "Rare Collectibles", type: "information", desc: "Furniture, coins, stamps and their value ranges." },
  { key: "religion", name: "Religion", type: "information", desc: "Theology, religious structures, culture and history." },
  { key: "snowskiing", name: "Snow Skiing/Boarding", type: "performance", desc: "Ski or board; know the culture and history." },
  { key: "spacesciences", name: "Space Sciences", type: "information", desc: "Rocketry, satellites and cutting-edge developments." },
  { key: "squash", name: "Squash/Racquetball", type: "performance", desc: "Play squash and racquetball; know their culture and history." },
  { key: "tennis", name: "Tennis", type: "performance", desc: "Play tennis; know its culture and history." },
  { key: "theater", name: "Theater", type: "performance", desc: "Act; know the culture of acting." },
  { key: "toxicology", name: "Toxicology", type: "information", desc: "Poisons, their symptoms and antidotes." },
  { key: "wargaming", name: "Wargaming", type: "performance", desc: "Tabletop, computer and in-the-field simulation." },
  { key: "waterskiing", name: "Water Skiing", type: "performance", desc: "Water ski; know the culture and history." }
];

/* ---------------------------------------------------------------- 9. REPUTATION */

export const REPUTATION_TABLE = [
  { max: 50, label: "under 51", results: { 1: "P", 2: "N", 3: "N", 4: "N" } },
  { max: 100, label: "51-100", results: { 1: "Y", 2: "P", 3: "P", 4: "N" } },
  { max: 150, label: "101-150", results: { 1: "Y", 2: "Y", 3: "P", 4: "P" } },
  { max: Infinity, label: "over 150", results: { 1: "Y", 2: "Y", 3: "Y", 4: "P" } }
];
export const REPUTATION_RESULT_TEXT = {
  Y: "Yes — accurately identified.",
  P: "Perhaps — something familiar. A player character may Persuade the viewer they are not that person.",
  N: "No — not identified."
};
export const REPUTATION_GAINS = [
  { key: "mission", name: "Complete a mission (success or not)", value: 3 },
  { key: "kill", name: "Killing (per person)", value: 5 },
  { key: "henchman", name: "Killing a Henchman", value: 10 },
  { key: "villain", name: "Killing a Villain", value: 15 },
  { key: "scar", name: "New scar (per scar)", value: 20 },
  { key: "promotion", name: "Promotion to Special Agent", value: 20 }
];
export const SCAR_REPUTATION = 20;
export const DISGUISE_REPUTATION_MOD = { 1: -5, 2: -3, 3: -1, 4: 0, 5: 2 };
export const REPUTATION_REDUCTION = {
  fakeDeath: { amount: 75, note: "Temporary until the character is finally recognised by a Reputation check." },
  dataScrub: { xpPerPoint: 100, duration: "one month regardless of total reduction" }
};

/* ---------------------------------------------------------------- 10. HERO POINTS */

export const HERO_POINT_RULES = {
  costPerQualityStep: 1,
  costPerWoundStep: 1,
  missionSuccessAward: 1,
  gmRolledWarning: "For non-combat checks the GM rolls, points must be committed before the result is revealed.",
  spends: [
    { key: "quality", name: "Shift a Success Quality one step", cost: 1 },
    { key: "wound", name: "Reduce an incoming Wound Rank one step", cost: 1 },
    { key: "environment", name: "Alter the environment in your favour", cost: "GM-negotiated" },
    { key: "keypad", name: "Force open a keypad lock", cost: 3 },
    { key: "drug", name: "Shrug off a drug or poison", cost: "2-3" },
    { key: "detcord", name: "Escape detonation cord wrapped around you", cost: 3 },
    { key: "garrote", name: "Escape a garrote", cost: 1 },
    { key: "grenade", name: "Throw a live grenade clear", cost: 1 }
  ]
};

export const CAMPAIGN_STYLES = [
  { key: "heroic", name: "Heroic", failure: "Very slight chance of failure",
    heroPointRule: "Great (2) or better on any check, including combat",
    threshold: 2, combatEarns: true,
    desc: "Player characters are almost guaranteed success; the fun is in how." },
  { key: "cinematic", name: "Cinematic", failure: "Slim chance of failure",
    heroPointRule: "Superb (1) on any check, including combat",
    threshold: 1, combatEarns: true,
    desc: "Victory with a cost. Failure lands on people of tertiary importance." },
  { key: "adventurous", name: "Adventurous", failure: "Moderate chance of failure",
    heroPointRule: "Superb (1) on any check except Fire Combat and Hand-to-Hand Combat",
    threshold: 1, combatEarns: false, isDefault: true,
    desc: "The default. Real risks, real rewards, slim advantage over the opposition." },
  { key: "realistic", name: "Realistic", failure: "Significant chance of failure",
    heroPointRule: "Superb (1) on any check except Fire Combat and Hand-to-Hand Combat",
    threshold: 1, combatEarns: false,
    desc: "Grim and gritty. Expect to bury a lot of friends." }
];

/* ---------------------------------------------------------------- 11. EXPERIENCE */

export const XP_BASE_PER_MISSION = 500;
export const XP_MODIFIERS = [
  { key: "rankRookie", name: "Rookie rank character", value: -125, group: "rank" },
  { key: "rankAgent", name: "Agent rank character", value: 0, group: "rank" },
  { key: "rankSpecial", name: "Special Agent rank character", value: 500, group: "rank" },
  { key: "success", name: "Successful mission", value: 500, group: "outcome" },
  { key: "partial", name: "Partially successful mission", value: 0, group: "outcome" },
  { key: "failure", name: "Failed mission", value: -375, group: "outcome" },
  { key: "goodRP", name: "Good role-playing", value: 750, max: 750, group: "roleplay" },
  { key: "poorRP", name: "Poor role-playing", value: -250, max: -250, group: "roleplay" }
];
export const XP_COSTS = {
  skillRank: { formula: (finalRank) => 30 * finalRank, label: "30 x final Skill Rank" },
  newSkill: { flat: 100, label: "100 per Skill" },
  characteristic: { formula: (finalValue) => 150 * finalValue, label: "150 x final Characteristic" },
  reputation: { flat: 100, label: "100 per point reduced" },
  largeEquipment: { flat: 500, label: "500 per piece" },
  modifiedLargeEquipment: { flat: 700, perMod: 50, label: "700 + 50 per modification" },
  personalEquipment: { flat: 200, label: "200 per piece" }
};
export const XP_ADVANCE_GATE =
  "A Skill or Characteristic can only be raised by 1 point per mission.";

/* ---------------------------------------------------------------- 12. COMBAT */

export const DAMAGE_RANKS = ["A","B","C","D","E","F","G","H","I","J","K","L"];

/* Wound Rank Table: Success Quality x Damage Rank [Ch.7] */
export const WOUND_RANK_TABLE = {
  1: { A:"light", B:"medium", C:"medium", D:"heavy", E:"heavy", F:"incap", G:"incap", H:"killed", I:"killed", J:"killed", K:"killed", L:"killed" },
  2: { A:"light", B:"light", C:"medium", D:"medium", E:"heavy", F:"heavy", G:"incap", H:"incap", I:"killed", J:"killed", K:"killed", L:"killed" },
  3: { A:"stun", B:"stun", C:"light", D:"light", E:"light", F:"medium", G:"medium", H:"heavy", I:"incap", J:"incap", K:"incap", L:"incap" },
  4: { A:"stun", B:"stun", C:"stun", D:"stun", E:"light", F:"light", G:"light", H:"light", I:"light", J:"light", K:"medium", L:"heavy" }
};

export const WOUND_LEVELS = [
  { key: "none", name: "Unhurt", order: 0, dfMod: 0, drawMod: 0, painDF: null },
  { key: "stun", name: "Stun", order: 1, dfMod: 0, drawMod: 0, painDF: null,
    desc: "Hand-to-Hand: DF 8 Strength check or fall prone and senseless (roll the Stun Table). Fire Combat: DF 8 Willpower each round to continue the declared action. A Stun must be cleared before Pain Resistance rolls begin." },
  { key: "light", name: "Light Wound", order: 2, dfMod: -1, drawMod: -20, painDF: 7, scarChance: 0,
    desc: "Pain Resistance: DF 7 Willpower immediately and again each round in the Declaration Phase." },
  { key: "medium", name: "Medium Wound", order: 3, dfMod: -2, drawMod: -40, painDF: 5, scarChance: 0.05,
    desc: "Pain Resistance: DF 5 Willpower immediately and again each round." },
  { key: "heavy", name: "Heavy Wound", order: 4, dfMod: -3, drawMod: -60, painDF: 3, scarChance: 0.15,
    desc: "Pain Resistance: DF 3 Willpower immediately and again each round." },
  { key: "incap", name: "Incapacitated", order: 5, dfMod: -3, drawMod: -60, painDF: null, scarChance: 0.25,
    desc: "Out for 1-10 minutes (unarmed) or 1-10 hours (weapons, firearms, explosives, crashes). On waking, treat as a Heavy Wound with no Pain Resistance rolls." },
  { key: "killed", name: "Killed", order: 6, dfMod: null, drawMod: null, painDF: null,
    desc: "The character is dead." }
];

/* Wound Rank Accumulation: old wound x new wound [Ch.7] */
export const WOUND_ACCUMULATION = {
  light:  { light: "medium", medium: "heavy",  heavy: "incap",  incap: "incap" },
  medium: { light: "heavy",  medium: "incap",  heavy: "incap",  incap: "killed" },
  heavy:  { light: "incap",  medium: "incap",  heavy: "killed", incap: "killed" },
  incap:  { light: "incap",  medium: "killed", heavy: "killed", incap: "killed" }
};

export const STUN_TABLE = [
  { max: 20, rounds: 1 }, { max: 40, rounds: 2 }, { max: 60, rounds: 3 },
  { max: 80, rounds: 4 }, { max: 90, rounds: 5 }, { max: 100, rounds: 6 }
];

export const SHAKE_OFF_DAMAGE = {
  minStrength: 14, df: 5, ranksReduced: 2,
  desc: "Strength 14-15 characters may reduce a Hand-to-Hand wound by two ranks on a DF 5 Strength check — but only from bare hands or blunt weapons, never sharp or pointed ones."
};

export const SCAR_LOCATIONS = [
  { max: 5, name: "Face" }, { max: 10, name: "Neck" }, { max: 30, name: "Back" },
  { max: 49, name: "Chest" }, { max: 59, name: "Left Arm" }, { max: 69, name: "Right Arm" },
  { max: 79, name: "Left Leg" }, { max: 89, name: "Right Leg" },
  { max: 95, name: "Right Hand" }, { max: 100, name: "Left Hand" }
];

export const FALL_DAMAGE = [
  { max: 10, wound: "none" }, { max: 20, wound: "light" }, { max: 60, wound: "medium" },
  { max: 150, wound: "heavy" }, { max: 250, wound: "incap" }, { max: Infinity, wound: "killed" }
];

/* Area Weapon Damage: Damage Rank x distance band [Ch.7] */
export const AREA_DAMAGE = {
  H: [ {max:10,w:"medium"}, {max:20,w:"light"}, {max:30,w:"stun"}, {max:40,w:"none"} ],
  I: [ {max:10,w:"heavy"},  {max:20,w:"medium"},{max:30,w:"light"},{max:40,w:"stun"} ],
  J: [ {max:10,w:"incap"},  {max:20,w:"heavy"}, {max:30,w:"medium"},{max:40,w:"stun"} ],
  K: [ {max:10,w:"killed"}, {max:20,w:"incap"}, {max:30,w:"heavy"},{max:40,w:"light"} ],
  L: [ {max:10,w:"killed"}, {max:20,w:"killed"},{max:30,w:"incap"},{max:40,w:"light"} ]
};

export const DAMAGE_RANK_REDUCTION = [
  { key: "veh0", name: "Vehicle with 0-10 Modification Points", value: 0 },
  { key: "veh11", name: "Vehicle with 11-50 Modification Points", value: 1 },
  { key: "veh51", name: "Vehicle with 51-200 Modification Points", value: 2 },
  { key: "veh200", name: "Vehicle with over 200 Modification Points", value: 3 },
  { key: "wood", name: "Wood", value: 1 },
  { key: "concrete", name: "Reinforced concrete", value: 2 },
  { key: "iron", name: "Iron", value: 2 },
  { key: "steel", name: "Steel", value: 3 }
];

export const FIRE_COMBAT_MODS = [
  { key: "surprised", name: "Target surprised", value: 4 },
  { key: "aim", name: "Firer taking aim (sacrifices a round)", value: 3 },
  { key: "within10", name: "Target within 10 feet", value: 2 },
  { key: "close", name: "Target in close range", value: 1 },
  { key: "long", name: "Target in long range", value: -1 },
  { key: "multi", name: "Each shot after the first at a different target (non-automatic)", value: -1, stacking: true },
  { key: "specific", name: "Specific Fire (vulnerable spot or object)", value: -2 },
  { key: "firermoved", name: "Firer moves this round", value: -2 },
  { key: "targetmoved", name: "Target moved this round", value: -2 },
  { key: "cover13", name: "Target has one-third cover or is kneeling", value: -2 },
  { key: "defmove", name: "Target used defensive movement", value: -4 },
  { key: "cover23", name: "Target has two-thirds cover or is prone", value: -4 },
  { key: "rested", name: "Weapon rested on a solid surface or bipod", value: 1, note: "Performance Modifier" }
];
export const FIRE_COMBAT_NOTES = [
  "Range modifiers do not stack: a target within 10 feet gives +2, not +2 and +1.",
  "Close range also adds +1 Damage Rank; long range subtracts 1 Damage Rank.",
  "Taking Aim forbids a Draw Situation and any other action that round.",
  "Specific Fire that hits a vulnerable location adds +2 Wound Ranks.",
  "Shots per round are the lower of the character's Speed and the weapon's Rate of Fire.",
  "Automatic weapons take multiple targets with no additional-target penalty."
];

export const HTH_ACTIONS = [
  { key: "punch", name: "Punch", mod: 0, damageBonus: 0, desc: "Any upper-body attack, including hand weapons." },
  { key: "kick", name: "Kick", mod: -1, damageBonus: 1, desc: "Lower-body attack: +1 Damage Rank, harder to land." },
  { key: "special", name: "Special Attack", mod: -2, damageBonus: 0, specific: true, desc: "Any unique action the GM permits: disarm, deflect, cripple. Penalties stack for compound goals." },
  { key: "targeted", name: "Targeted Blow", mod: -2, damageBonus: 0, woundBonus: 2, specific: true, desc: "Hit a vulnerable part or a specific object: +2 Wound Ranks on a hit." },
  { key: "knockout", name: "Knockout Attack", mod: -4, damageBonus: 0, specific: true, desc: "Target makes a Willpower check at DF equal to double the attack's Quality; failure means 2d10+10 rounds unconscious. Against a surprised opponent: no check, 25 minutes +1d10." },
  { key: "pin", name: "Pin", mod: -2, damageBonus: null, specific: true, desc: "Restrain the target; no damage. A pinned target may only Break. A third party can tie them in two rounds." },
  { key: "break", name: "Break", mod: 0, damageBonus: null, specific: true, desc: "Escape a pin at DF equal to the pin's Quality. No damage." },
  { key: "throw", name: "Throw", mod: -2, damageBonus: null, specific: true, desc: "Move the target up to 10 feet or drop them; they lose held weapons. No damage unless they hit something." },
  { key: "stand", name: "Stand", mod: 0, fixedDF: 5, damageBonus: null, specific: true, desc: "Rise after a throw without granting free attacks. Failure grants each nearby opponent one free attack but you still stand." }
];
export const HTH_NOTES = [
  "Hand-to-Hand base Difficulty Factor is 5 minus the target's Speed.",
  "Engagement range is 10 feet; you may move and then attack.",
  "Attacks per round equal your Speed; Speed 0 attacks every other round.",
  "Only one Specific Action per round, but punches and kicks up to your Speed.",
  "Thrown weapons: 10 feet of range per point of Strength; throw as many as your Speed."
];

export const COMBAT_ROUND = {
  seconds: "3-5",
  declaration: "Highest Speed declares LAST, so the fastest characters know what everyone else intends. Ties are broken by d100, low rolls declaring first. Order is fixed for the whole encounter.",
  action: "Actions resolve in reverse declaration order, so the fastest acts first.",
  normalMovement: "10 x Speed feet",
  defensiveMovement: "5 x Speed feet, and shooters targeting you take -4 DF"
};

export const DRAW_BONUS = { 0: 0, 1: 20, 2: 40, 3: 60 };
export const DRAW_WEAPON_PENALTY = -40;
export const DRAW_NOTE =
  "If an NPC fires at you before you have fired this round, you may abandon your declared action for a Draw Situation. Both roll d100 + Speed bonus; higher fires first. You must still fire even if you lose.";

/* Grenades [Ch.7] */
export const GRENADE_SCATTER = { 1: 0, 2: 0.2, 3: 0.3, 4: 0.4, 5: 0.5 };
export const GRENADE_THROW_FT_PER_STR = 10;      // throw range [Ch.7]
export const GRENADE_SKILL = "handtohand";       // thrown weapons use Hand-to-Hand [Ch.4]
export const GRENADE_DUD_ROLL = [98, 99];        // a dud
export const GRENADE_EARLY_ROLL = 100;           // detonates early
export const GRENADE_SCATTER_DIRECTIONS = 10;    // d10 around the clock
export const GRENADE_NOTES = [
  "Throw range is 10 feet per point of Strength.",
  "Scatter distance is a percentage of the throw length; direction is d10 around the clock.",
  "A d100 of 98-99 is a dud; 00 detonates early.",
  "A Hero Point throws a live grenade clear; a Superb (1) on a DF 5 Dexterity check returns it to the thrower."
];

/* ---------------------------------------------------------------- 13. CHASES */

export const CHASE_START_BID = 7;
export const CHASE_RANGES = ["Close", "Average", "Long", "Far", "Distant"];
export const CHASE_MANEUVERS = [
  { key: "turn180", name: "180 Turn", controlDF: 4, ranges: ["Close", "Average"], pursuedOnly: true,
    desc: "Double back. Success sets range to Close as you pass. Pursuers must match with their own 180 Turn at DF equal to your Quality, or attempt a Ram, or the range jumps to Distant next round." },
  { key: "fastturn", name: "Fast Turn", controlDF: 4, ranges: ["Long", "Far", "Distant"],
    desc: "Break line of sight into a side road, alley or canal. The chase ends unless the pursuer passes a Perception check at DF equal to twice your Quality; if they do, range becomes Close." },
  { key: "follow", name: "Follow/Escape", controlDF: 6, ranges: ["Close", "Average", "Long", "Far", "Distant"],
    desc: "Close or open the distance. Range changes by 4/3/2/1 steps for Quality 1/2/3/4. Impossible if your maximum speed is below the other party's cruising speed, or if you are on foot against a vehicle." },
  { key: "stunt", name: "Stunt", controlDF: 3, ranges: ["Close", "Average", "Long", "Far", "Distant"],
    desc: "Anything else the GM allows. Any success works, but a Fair (4) means you are Stunned. A pursuer must match the same stunt at the same Difficulty Factor to hold distance." },
  { key: "ram", name: "Ram", controlDF: 4, ranges: ["Close"],
    desc: "Force or intimidate. Add your Ram rating and subtract the target's. Needs Good (3) or better; the target then makes an Accident roll at DF equal to your Quality. Steering an opponent somewhere specific is at -2 DF. Against a target on foot, success starts Hand-to-Hand and ends the chase." }
];
export const FOLLOW_ESCAPE_STEPS = { 1: 4, 2: 3, 3: 2, 4: 1 };

/* Accident Table: failed maneuver x the Difficulty Factor bid [Ch.8] */
export const ACCIDENT_TABLE = {
  turn180: { 0.5:"I", 1:"I", 2:"H", 3:"H", 4:"M", 5:"M", 6:"L", 7:"L" },
  fastturn: { 0.5:"M", 1:"M", 2:"M", 3:"L", 4:"L", 5:"L", 6:"L", 7:"L" },
  follow:   { 0.5:"I", 1:"H", 2:"H", 3:"M", 4:"M", 5:"L", 6:"L", 7:"L" },
  stunt:    { 0.5:"K", 1:"K", 2:"I", 3:"I", 4:"H", 5:"H", 6:"M", 7:"M" },
  ram:      { 0.5:"K", 1:"I", 2:"H", 3:"H", 4:"M", 5:"M", 6:"L", 7:"L" }
};
export const ACCIDENT_CODE_TO_WOUND = { L:"light", M:"medium", H:"heavy", I:"incap", K:"killed" };
export const ACCIDENT_NOTES = [
  "The table gives damage to the VEHICLE. Occupants take one Wound Rank less.",
  "Seat belts remove another rank; airbags remove one more but only fire on a single 3-rank hit and only once.",
  "Aircraft take one Wound Rank MORE unless built for dangerous environments.",
  "Foot-chase accidents also reduce the listed damage by one rank."
];

export const CHASE_MODS = [
  { key: "vehicle", name: "Vehicle Performance Modifier", value: "-3 to +3" },
  { key: "familiar", name: "Familiar with the chase location", value: 1 },
  { key: "impaired", name: "Drunk or drugged", value: -1 },
  { key: "weather", name: "Storm, rain, snow or fog", value: -1 },
  { key: "severe", name: "Severe weather", value: -2 },
  { key: "night", name: "Night chase", value: -2 }
];

export const VEHICLE_DAMAGE = [
  { key: "light", name: "Light", speedPct: 75, dfMod: -1 },
  { key: "medium", name: "Medium", speedPct: 50, dfMod: -2 },
  { key: "heavy", name: "Heavy", speedPct: 25, dfMod: -3 },
  { key: "incap", name: "Incapacitated", speedPct: 25, dfMod: -4, note: "Runs 1d10+3 rounds then stops." },
  { key: "killed", name: "Killed", speedPct: 0, dfMod: null, note: "Stops immediately." }
];

export const CHASE_OBSTACLES = {
  water: [
    { df: 5, text: "A low bridge lies ahead." },
    { df: 5, text: "A waterfall is not far off." },
    { df: 6, text: "Sharp rocks or high coral make this stretch dangerous." },
    { df: 4, text: "A vessel with an unobservant captain drifts across your path." },
    { df: 3, text: "An old wartime mine lurks ahead." }
  ],
  land: [
    { df: 5, text: "A police roadblock lies ahead." },
    { df: 4, text: "The road ends in a cul-de-sac or car park." },
    { df: 3, text: "A parade or race blocks the way." },
    { df: 4, text: "A refuse lorry pulls out ahead of you." },
    { df: 2, text: "Construction has closed the road ahead." },
    { df: 7, text: "Off-road going in an on-road vehicle." },
    { df: 6, text: "A drunk wanders into your path." },
    { df: 4, text: "Satellite navigation shows a road that does not exist." }
  ],
  air: [
    { df: 6, text: "A weather balloon ascends ahead." },
    { df: 4, text: "A flock of birds crosses your path." },
    { df: 2, text: "The engine inexplicably stalls." },
    { df: 5, text: "Heavy fog makes mountain flying lethal." },
    { df: 3, text: "Ice begins forming on the airframe." }
  ]
};

export const TAILING = {
  df: 5,
  desc: "Tail with the appropriate movement skill at DF 5. Any success works, but the target may spot you with a Sixth Sense check at DF equal to twice your Quality."
};

/**
 * The Quality-as-Difficulty-Factor family [Ch.4, Ch.5]. Each is the same shape: the actor
 * rolls, and the actor's Success Quality becomes the Difficulty Factor of the check that
 * opposes it. Seduction and the chase manoeuvres carry their own staged flows; these three
 * are the plain ones, and they are structured here so the roller can offer the second half
 * instead of leaving the player to look it up.
 *
 *   dfFrom "quality"    — the opposing Difficulty Factor is the actor's Quality
 *   multiplier          — twice the Quality, for the checks the book doubles
 *   failureDF           — what the opponent rolls at when the actor fails outright
 *   onlyOnQuality       — the procedure only fires on that Quality; better is clean, worse
 *                         is automatic detection
 */
export const QUALITY_OPPOSED = [
  {
    key: "disguise", skill: "disguise", name: "Disguise",
    opponent: "Observer's Perception", opponentAttr: "per",
    multiplier: 1, failureDF: 10,
    desc: "Anyone looking closely rolls Perception at a Difficulty Factor equal to your disguise Quality. A failed disguise lets them look at Difficulty Factor 10.",
    chapter: "Ch.4"
  },
  {
    key: "stealth", skill: "stealth", name: "Stealth",
    opponent: "Observer's Perception", opponentAttr: "per",
    multiplier: 1, failureDF: null, onlyOnQuality: 4, fixedDF: 5,
    desc: "Superb, Great or Good passes unnoticed. A Fair result gives observers a Difficulty Factor 5 Perception check; a failure is noticed automatically.",
    chapter: "Ch.4"
  },
  {
    key: "tailing", skill: null, name: "Tailing",
    opponent: "Target's Sixth Sense", opponentSkill: "sixthsense",
    actorDF: 5, multiplier: 2, failureDF: 10,
    desc: "Tail with the appropriate movement skill at Difficulty Factor 5. The target may spot you with a Sixth Sense check at a Difficulty Factor of twice your Quality.",
    chapter: "Ch.4"
  }
];
export const QUALITY_OPPOSED_BY_SKILL = Object.fromEntries(
  QUALITY_OPPOSED.filter(x => x.skill).map(x => [x.skill, x])
);

/* ---------------------------------------------------------------- 14. INTERACTIONS */

export const REACTIONS = [
  { key: "opposed", name: "Opposed", order: 0, persuadeMod: -4,
    desc: "Actively works against you given the chance." },
  { key: "unfriendly", name: "Unfriendly", order: 1, persuadeMod: -3,
    desc: "Offers no help and would rather you left them alone." },
  { key: "neutral", name: "Neutral", order: 2, persuadeMod: 0,
    desc: "Indifferent, or waiting for more information." },
  { key: "friendly", name: "Friendly", order: 3, persuadeMod: 1,
    desc: "Favourable; helps where the risk is low." },
  { key: "helpful", name: "Helpful", order: 4, persuadeMod: 3,
    desc: "Accepts personal risk to further your goals." }
];
export const REACTION_BY_QUALITY = { 1: "helpful", 2: "friendly", 3: "neutral", 4: "unfriendly", 5: "opposed" };
export const REACTION_MODS = [
  { key: "dressed", name: "Appropriately dressed", value: 1 },
  { key: "fluent", name: "Fluent in the language", value: 1 },
  { key: "poorspeech", name: "Speaks poorly", value: -1 },
  { key: "behaviour", name: "Behaves inappropriately", value: -1 },
  { key: "opposedorg", name: "NPC belongs to an opposed organisation", value: -6 }
];
export const LOCAL_CUSTOMS_REACTION_MOD = { 1: 3, 2: 2, 3: 1, 4: 0, 5: -1 };

/* Persuade Table: NPC Willpower x Success Quality [Ch.9] */
export const PERSUADE_TABLE = [
  { max: 5, label: "under 6", r: { 1:"Y", 2:"Y", 3:"Y", 4:"P" } },
  { max: 8, label: "6-8",     r: { 1:"Y", 2:"Y", 3:"P", 4:"N" } },
  { max: 11, label: "9-11",   r: { 1:"Y", 2:"P", 3:"P", 4:"N" } },
  { max: 13, label: "12-13",  r: { 1:"P", 2:"P", 3:"P", 4:"N" } },
  { max: 14, label: "14",     r: { 1:"P", 2:"P", 3:"N", 4:"N" } },
  { max: 99, label: "15",     r: { 1:"P", 2:"N", 3:"N", 4:"N" } }
];
export const PERSUADE_RESULT_TEXT = {
  Y: "Yes — the NPC does what you want.",
  P: "Perhaps — the NPC wavers: may help then change their mind, refuse then relent, or demand a bribe.",
  N: "No — the NPC turns you down."
};
export const PERSUADE_SUPERB_BONUS =
  "A Superb (1) Persuade improves the NPC's Reaction by one step if the GM judges it possible.";

/* Seduction [Ch.9] */
export const SEDUCTION_STAGES = [
  { stage: 1, name: "The Look", df: 10 },
  { stage: 2, name: "The Introduction", df: 9 },
  { stage: 3, name: "The Conversation", df: 8 },
  { stage: 4, name: "The First Touch", df: 6 },
  { stage: 5, name: "The Time and Location", df: 4 }
];
export const SEDUCTION_RESIST_FAILURE_DF = 10;
export const SEDUCTION_FINAL_REACTION_MOD = 5;
export const SEDUCTION_MODS = [
  { key: "gorgeous", name: "Character is Gorgeous", value: 4 },
  { key: "stunning", name: "Character is Stunning", value: 2 },
  { key: "npcattraction", name: "NPC has the Sexual Attraction weakness", value: 2 },
  { key: "npcmale", name: "NPC is male", value: 2 },
  { key: "attractive", name: "Character is Attractive", value: 1 },
  { key: "normal", name: "Character is Normal", value: -1 },
  { key: "plain", name: "Character is Plain/Unattractive", value: -2 },
  { key: "priorfail", name: "A prior seduction attempt failed", value: -2 },
  { key: "ugly", name: "Character is Ugly", value: -3 },
  { key: "connoisseur", name: "Successful Connoisseur use", value: 1 }
];

/* Interrogation and Torture share one result table: Quality x victim Willpower [Ch.9] */
export const COERCION_TABLE = [
  { max: 5, label: "under 6", r: { 1:1, 2:1, 3:2, 4:2, 5:3 } },
  { max: 8, label: "6-8",     r: { 1:1, 2:2, 3:2, 4:3, 5:4 } },
  { max: 11, label: "9-11",   r: { 1:2, 2:2, 3:3, 4:4, 5:5 } },
  { max: 13, label: "12-13",  r: { 1:3, 2:4, 3:5, 4:5, 5:5 } },
  { max: 14, label: "14",     r: { 1:3, 2:4, 3:5, 4:5, 5:5 } },
  { max: 99, label: "15",     r: { 1:3, 2:5, 3:5, 4:5, 5:5 } }
];
export const INTERROGATION_MODS = [
  { key: "exhaustedInt", name: "Exhausted interrogator", value: -2 },
  { key: "repeat", name: "Each interrogation after the first", value: 1, stacking: true,
    note: "Cumulative modifiers reset if the victim sleeps between sessions." },
  { key: "exhaustedVictim", name: "Exhausted victim", value: 2 }
];
export const TORTURE_MODS = [
  { key: "heavy", name: "Victim heavily wounded", value: -3 },
  { key: "medium", name: "Victim has a Medium Wound", value: -1 },
  { key: "light", name: "Victim lightly wounded", value: 1 }
];
export const TORTURE_RESIST = {
  df: 4, requiredQuality: 3,
  limitFormula: (wil) => Math.ceil(wil * 3),
  desc: "A trained operative may pass out to end a session: DF 4 Willpower needing Good (3) or better. You may do this up to three times your Willpower; beyond that a success also inflicts a Medium Wound.",
  failurePenalty: "A Failure or Fair (4) on the torturer's roll inflicts a Medium Wound — unless the victim passes out first."
};

/* Gambling tables [Ch.9]: first-roll Quality x second-roll Quality */
export const GAMBLING_GAMES = [
  { key: "baccarat", name: "Baccarat",
    desc: "Come as close to 9 as possible without going over.",
    table: {
      1: { 1:"W", 2:"W", 3:"W", 4:"W", 5:"W" },
      2: { 1:"St", 2:"St", 3:"St", 4:"St", 5:"St" },
      3: { 1:"1", 2:"2", 3:"3", 4:"F", 5:"F" },
      4: { 1:"1", 2:"3", 3:"4", 4:"F", 5:"F" },
      5: { 1:"1", 2:"4", 3:"4", 4:"F", 5:"F" }
    } },
  { key: "blackjack", name: "Blackjack (Twenty-One)",
    desc: "Come as close to 21 as possible without going over. Ties are discarded.",
    table: {
      1: { 1:"Nat", 2:"Nat", 3:"Nat", 4:"Nat", 5:"Nat" },
      2: { 1:"1", 2:"2", 3:"2", 4:"3", 5:"F" },
      3: { 1:"2", 2:"2", 3:"3", 4:"4", 5:"F" },
      4: { 1:"2", 2:"3", 3:"4", 4:"4", 5:"F" },
      5: { 1:"2", 2:"3", 3:"4", 4:"F", 5:"F" }
    } },
  { key: "chemin", name: "Chemin de Fer",
    desc: "Baccarat with a rotating bank and free play of your hand.",
    table: {
      1: { 1:"W", 2:"W", 3:"W", 4:"W", 5:"W" },
      2: { 1:"2", 2:"2", 3:"3", 4:"4", 5:"F" },
      3: { 1:"2", 2:"3", 3:"4", 4:"F", 5:"F" },
      4: { 1:"2", 2:"3", 3:"3", 4:"4", 5:"F" },
      5: { 1:"2", 2:"3", 3:"4", 4:"F", 5:"F" }
    } },
  { key: "poker", name: "Poker",
    desc: "Best hand after betting. 1* beats a plain Superb (1) — a high straight or royal flush.",
    table: {
      1: { 1:"1*", 2:"1", 3:"1", 4:"2", 5:"2" },
      2: { 1:"1", 2:"2", 3:"2", 4:"2", 5:"3" },
      3: { 1:"1", 2:"2", 3:"3", 4:"3", 5:"4" },
      4: { 1:"2", 2:"3", 3:"3", 4:"4", 5:"F" },
      5: { 1:"3", 2:"4", 3:"4", 4:"F", 5:"F" }
    } }
];
export const GAMBLING_CODE_TEXT = {
  W: "Win the hand outright.", St: "Stand.", Nat: "Natural 21 — beats all but another natural.",
  F: "Losing hand.", "1*": "Beats a plain Superb result."
};
export const GAMBLING_NOTES = [
  "Both sides roll secretly; bets are placed before each roll and before the reveal.",
  "Hero Points may be spent while gambling, but never on another character's hand, and villains may not spend Villain Points."
];

/* ---------------------------------------------------------------- 15. HEALING & REST */

export const HEALING = [
  { key: "firstaid", name: "First Aid", ranks: 1,
    limit: "Once per wounded person, and only within one hour of the wounding.",
    desc: "A successful First Aid check reduces the Wound Rank by one." },
  { key: "natural", name: "Natural healing", ranks: 1, period: "one week",
    limit: "No limit.", desc: "One Wound Rank per week without professional care." },
  { key: "hospital", name: "Hospital care", ranks: 1, period: "three days", maxRanks: 2,
    limit: "Maximum two Wound Ranks; after six days, healing returns to the natural rate.",
    desc: "One Wound Rank per three-day stay." },
  { key: "fieldmedicine", name: "Field medicine (Medicine FoE)", ranks: 1, period: "three days", maxRanks: 2,
    limit: "GM approval; needs medical supplies and a successful First Aid check. Failure wastes supplies.",
    desc: "Provides hospital-grade care in a private location." }
];

/* ---------------------------------------------------------------- 16. MISSION LIFECYCLE */

export const LIFECYCLE_EVENTS = [
  { key: "scene", name: "End Scene", effects: [
    "Clear per-scene flags (aim, defensive movement, cover, once-per-scene uses).",
    "Resolve any Stun durations still running.",
    "Reset cumulative interrogation modifiers if the subject slept."
  ] },
  { key: "session", name: "End Session", effects: [
    "Clear exhaustion if the characters have rested per the rest rules.",
    "Advance natural healing if in-fiction time has passed.",
    "Optional: award experience if the GM uses per-session awards (max one point per Skill or Characteristic either way)."
  ] },
  { key: "mission", name: "End Mission", effects: [
    "Award experience: 500 base, modified by rank, outcome and role-playing.",
    "Award 1 Hero Point to every character on a successful mission.",
    "Add 3 Reputation for completing the mission, plus any kill/scar Reputation earned.",
    "Unlock advancement: each Skill and Characteristic may rise by 1.",
    "Return equipment bought with experience points."
  ] }
];

/* ---------------------------------------------------------------- 17. INVENTORY & MONEY */

export const MONEY = { code: "USD", symbol: "$", note: "All prices in the rulebook are US dollars." };
export const EQUIPMENT_ACCESS = {
  agency: "Agency characters are equipped for the expected mission. Unusual or expensive requests need a Persuade attempt against the head of the armoury; two special requests per mission is a fair cap.",
  freelance: "Freelancers start with cash and resources agreed with the GM and buy their own kit."
};
export const EQUIPMENT_REPAIR_MULTIPLIER = [
  { rolls: "1-3 on 1d6 (Light)", wound: "light", multiplier: 1 },
  { rolls: "4-5 on 1d6 (Medium)", wound: "medium", multiplier: 2 },
  { rolls: "6 on 1d6 (Heavy)", wound: "heavy", multiplier: 3 },
  { rolls: "Incapacitated", wound: "incap", multiplier: 6 },
  { rolls: "Killed", wound: "killed", multiplier: 12 }
];

/* ---------------------------------------------------------------- 18. WEAPONS */

/* pm=Performance Modifier, rof=Rate of Fire, dr=Damage Rank, cm=Concealment Modifier,
 * mis=Misfire range, draw=Draw Situation modifier, rl=Reload rounds. */
export const WEAPONS = [
  // Pistols
  { key:"beretta950", name:"Beretta 950 Jetfire", cat:"pistol", pm:0, rof:2, ammo:6, dr:"E", close:"0-20", long:"80-120", cm:-4, mis:"98-99", draw:0, rl:1, price:300, desc:".25 calibre; one of the smallest semi-automatics made. Easily hidden, short on stopping power." },
  { key:"berettam9", name:"Beretta M9", cat:"pistol", pm:0, rof:3, ammo:15, dr:"F", close:"0-40", long:"100-200", cm:1, mis:"99", draw:0, rl:1, price:600, desc:"9mm service pistol; common worldwide but poorly suited to covert work." },
  { key:"browninghp", name:"Browning Hi-Power", cat:"pistol", pm:0, rof:3, ammo:13, dr:"G", close:"0-30", long:"130-190", cm:0, mis:"99", draw:0, rl:1, price:950, desc:"9mm with real punch and slightly better concealment than the M9." },
  { key:"fnfiveseven", name:"FN Five-seven", cat:"pistol", pm:1, rof:3, ammo:20, dr:"E", close:"0-50", long:"140-200", cm:1, mis:"99", draw:0, rl:1, price:1000, desc:"Uses the uncommon 5.7x28mm round shared with the P90." },
  { key:"glock19", name:"Glock 19", cat:"pistol", pm:0, rof:3, ammo:15, dr:"F", close:"0-30", long:"80-180", cm:-1, mis:"99", draw:20, rl:1, price:550, desc:"Austrian 9mm balancing power, concealment and draw. Excellent covert pistol." },
  { key:"hkp30", name:"Heckler & Koch P30", cat:"pistol", pm:0, rof:2, ammo:15, dr:"G", close:"0-30", long:"120-180", cm:-1, mis:"99", draw:0, rl:1, price:1100, desc:"Ambidextrous polymer-framed 9mm favoured by some European police." },
  { key:"keltecpf9", name:"Kel-Tec PF-9", cat:"pistol", pm:0, rof:2, ammo:7, dr:"E", close:"0-20", long:"80-140", cm:-3, mis:"97-99", draw:20, rl:1, price:300, desc:"The flattest and lightest mass-produced 9mm; a common back-up gun." },
  { key:"sigp229", name:"SIG Sauer P229", cat:"pistol", pm:1, rof:3, ammo:12, dr:"F", close:"0-40", long:"120-180", cm:0, mis:"98-99", draw:20, rl:1, price:1000, desc:"Accurate and powerful service pistol; less concealable than one would like." },
  { key:"sw500", name:"Smith & Wesson Model 500", cat:"pistol", pm:0, rof:1, ammo:5, dr:"J", close:"0-50", long:"120-250", cm:2, mis:"99", draw:-20, rl:3, price:1300, desc:"The most powerful production handgun. Useless for covert work, superb against vehicles." },
  { key:"sw640", name:"Smith & Wesson Model 640", cat:"pistol", pm:0, rof:1, ammo:5, dr:"H", close:"0-30", long:"80-130", cm:-1, mis:"99", draw:0, rl:2, price:800, desc:"Concealed-hammer revolver with good stopping power." },
  { key:"waltherp99", name:"Walther P99", cat:"pistol", pm:1, rof:3, ammo:15, dr:"F", close:"0-30", long:"120-200", cm:-1, mis:"98-99", draw:0, rl:1, price:700, desc:"Polymer-framed 9mm; compares well with the Five-seven and uses common ammunition." },
  { key:"waltherppk", name:"Walther PPK", cat:"pistol", pm:1, rof:2, ammo:7, dr:"E", close:"0-30", long:"120-180", cm:-2, mis:"98-99", draw:20, rl:1, price:800, desc:"The classic operative's pistol; dated against modern designs but still sound." },
  { key:"waltherpps", name:"Walther PPS", cat:"pistol", pm:0, rof:2, ammo:6, dr:"E", close:"0-20", long:"80-140", cm:-3, mis:"98-99", draw:40, rl:1, price:600, desc:"Very concealable polymer-framed pistol; a discreet choice." },
  // Rifles, shotguns, submachine guns
  { key:"ak74m", name:"AK-74M", cat:"rifle", pm:1, pmBurst:0, rof:2, rofBurst:10, ammo:30, dr:"I", drBurst:"L", close:"0-200", long:"1000-1400", cm:null, mis:"98-99", draw:-60, rl:2, price:900, auto:true, desc:"Modern AK platform; powerful and efficient assault rifle." },
  { key:"benellim4", name:"Benelli M4 Super 90", cat:"shotgun", pm:1, rof:2, ammo:8, dr:"H", close:"0-90", long:"180-450", cm:null, mis:"99", draw:-60, rl:3, price:1200, desc:"Semi-automatic combat shotgun with proven reliability." },
  { key:"usas12", name:"Daewoo USAS-12", cat:"shotgun", pm:0, rof:2, rofBurst:5, ammo:10, ammoAlt:20, dr:"H", drBurst:"K", close:"0-80", long:"160-400", cm:null, mis:"96-99", draw:-60, rl:2, price:2500, auto:true, desc:"Fully automatic combat shotgun; formidable but finicky." },
  { key:"fnp90", name:"FN P90", cat:"smg", pm:1, rof:2, rofBurst:10, ammo:50, dr:"E", drBurst:"H", close:"0-130", long:"400-800", cm:null, mis:"97-99", draw:-60, rl:2, price:2000, auto:true, desc:"Bullpup submachine gun with a large magazine; rarely a bad choice for heavier firepower." },
  { key:"mp5", name:"Heckler & Koch MP5", cat:"smg", pm:0, rof:2, rofBurst:6, ammo:30, dr:"F", drBurst:"I", close:"0-120", long:"450-700", cm:3, mis:"99", draw:-40, rl:1, price:2000, auto:true, desc:"The 9mm submachine gun; highly reliable and found nearly everywhere." },
  { key:"m4carbine", name:"M4 Carbine", cat:"rifle", pm:1, pmBurst:0, rof:2, rofBurst:10, ammo:30, dr:"J", drBurst:"L", close:"0-200", long:"800-1500", cm:null, mis:"99", draw:-60, rl:2, price:1100, auto:true, desc:"Durable, accurate assault rifle in wide special-forces use." },
  { key:"mossberg590", name:"Mossberg 590A1", cat:"shotgun", pm:0, rof:2, ammo:8, dr:"H", close:"0-60", long:"150-350", cm:null, mis:"99", draw:-40, rl:3, price:700, desc:"Tough military pump-action shotgun." },
  { key:"parkerhale", name:"Parker-Hale M82", cat:"rifle", pm:1, rof:0.5, ammo:4, dr:"K", close:"0-500", long:"1500-2500", cm:null, mis:"99", draw:-60, rl:2, price:2000, desc:"Bolt-action 7.62mm sniper rifle." },
  { key:"remingtonm24", name:"Remington M24", cat:"rifle", pm:1, rof:0.5, ammo:5, dr:"K", close:"0-800", long:"2000-3000", cm:null, mis:"99", draw:-80, rl:2, price:2500, desc:"Bolt-action 7.62mm sniper rifle, heavily used in recent wars." },
  { key:"uzi", name:"Uzi", cat:"smg", pm:0, rof:2, rofBurst:8, ammo:32, dr:"F", drBurst:"I", close:"0-100", long:"400-600", cm:5, mis:"96-99", draw:-40, rl:2, price:1500, auto:true, desc:"The most widely recognised submachine gun in the world." },
  { key:"wa2000", name:"Walther WA-2000", cat:"rifle", pm:2, rof:1, ammo:6, dr:"J", close:"0-800", long:"2200-4500", cm:null, mis:"99", draw:-60, rl:2, price:55000, desc:"Bullpup .300 Winchester Magnum sniping rifle; only 176 were built." },
  // Heavy weapons
  { key:"m2browning", name:".50 Caliber M2 Browning", cat:"heavy", pm:0, rof:25, ammo:200, dr:"L", drCount:3, close:"0-2000", long:"5000-7000", cm:null, mis:"98-99", draw:-100, rl:2, price:15000, desc:"The workhorse heavy machine gun; found everywhere." },
  { key:"m134", name:"M134 Minigun", cat:"heavy", pm:2, rof:100, ammo:500, ammoMax:5000, dr:"K", drCount:3, close:"0-1000", long:"2000-3000", cm:null, mis:"98-99", draw:-100, rl:2, price:20000, desc:"Six-barrelled rotary 7.62mm; a mounted weapon." },
  { key:"m240b", name:"M240B", cat:"heavy", pm:1, rof:20, ammo:100, dr:"J", drCount:3, close:"0-1000", long:"2500-4000", cm:null, mis:"98-99", draw:-80, rl:2, price:12000, desc:"Medium machine gun on bipod, tripod or pintle. No area damage despite its Damage Rank." },
  { key:"m252", name:"M252 Mortar", cat:"heavy", pm:-1, rof:1, ammo:1, dr:"K", close:"300-3000", long:"10000-15000", cm:null, mis:"99", draw:null, rl:1, price:14000, area:true, desc:"Indirect fire; needs a crew of five. HE shells $800, others $400. Double the area of a comparable grenade." },
  // Miscellaneous
  { key:"sidewinder", name:"AIM-9X Sidewinder Missile", cat:"misc", pm:2, rof:1, ammo:1, dr:"L", close:"3000-15000", long:"18-22 miles", cm:null, mis:"99", draw:null, rl:10, price:90000, area:true, desc:"Infrared homing air-to-air missile." },
  { key:"stinger", name:"FM-92 Stinger Missile", cat:"misc", pm:1, rof:1, ammo:1, dr:"L", close:"300-5000", long:"10000-15000", cm:null, mis:"99", draw:null, rl:1, price:40000, area:true, desc:"Infrared homing surface-to-air missile." },
  { key:"pepperspray", name:"Pepper Spray", cat:"misc", pm:0, rof:1, ammo:10, dr:"E", close:"0-2", long:"8-10", cm:-5, mis:"99", draw:20, rl:null, price:15, lessLethal:true, desc:"No real damage: triggers Pain Resistance rolls only, plus -1 DF on all actions for a minute. One successful resistance roll ends it." },
  { key:"speargun", name:"Speargun", cat:"misc", pm:0, rof:1, ammo:1, dr:"G", close:"0-40", long:"100-180", cm:null, mis:"99", draw:-40, rl:3, price:150, desc:"Underwater projectile weapon." },
  { key:"switchblade", name:"Switchblade Drone", cat:"misc", pm:-1, rof:1, ammo:1, dr:"J", close:"300-15000", long:"5-15 miles", cm:null, mis:"99", draw:-100, rl:null, price:25000, area:true, desc:"Backpack-sized explosive drone flown to target by one operator." },
  { key:"taser", name:"Taser", cat:"misc", pm:-1, rof:1, ammo:1, dr:"G", close:"0-5", long:"11-15", cm:-3, mis:"99", draw:0, rl:1, price:300, lessLethal:true, desc:"No real damage: triggers Pain Resistance rolls, drops the target prone and pins them for one round." },
  // Hand-to-hand
  { key:"baton", name:"Expandable Baton", cat:"hth", drBonus:2, cm:-2, draw:20, price:50, desc:"Collapsible steel or alloy baton. Blunt." },
  { key:"kabar", name:"KA-BAR Knife", cat:"hth", drBonus:1, cm:-4, draw:20, price:100, sharp:true, desc:"Combat and utility knife. Sharp: defeats Strength damage shrug-off." },
  { key:"m67", name:"M67 Grenade", cat:"hth", dr:"I", cm:-2, mis:"99", draw:-60, price:50, thrown:true, area:true, desc:"Fragmentation grenade. Thrown with Hand-to-Hand Combat." },
  { key:"shuriken", name:"Shuriken", cat:"hth", rof:3, drBonus:1, cm:-5, draw:20, price:10, thrown:true, sharp:true, desc:"Throwing star. Below Hand-to-Hand rank 5 you may only throw one per round." },
  { key:"rapier", name:"Rapier", cat:"hth", drBonus:2, cm:null, draw:0, price:500, sharp:true, desc:"Light duelling sword." },
  { key:"sword", name:"Sword", cat:"hth", drBonus:3, cm:null, draw:-20, price:500, sharp:true, desc:"Broadsword, Viking sword, gladius or similar one-handed blade." }
];

export const AMMUNITION = [
  { key:"standard", name:"Standard", price:50, per:"100 rounds", effect:"No modifier." },
  { key:"ap", name:"Armor Piercing", price:100, per:"100 rounds", effect:"Reduces armour effectiveness by 2 steps (pistol/SMG) or 4 steps (rifle)." },
  { key:"breaching", name:"Breaching", price:100, per:"100 rounds", effect:"Opens locked doors near-instantly. Against people beyond point blank, -2 Damage Ranks." },
  { key:"frangible", name:"Frangible", price:100, per:"100 rounds", effect:"Disintegrates on hard surfaces; always stopped by armour without harming the wearer." },
  { key:"hollowpoint", name:"Hollow Point", price:100, per:"100 rounds", effect:"+1 Damage Rank." },
  { key:"slug", name:"Shotgun Slug", price:100, per:"100 rounds", effect:"Doubles shotgun range and adds +1 Damage Rank at -1 Performance Modifier." },
  { key:"tracer", name:"Tracer", price:100, per:"100 rounds", effect:"+1 Performance Modifier on automatic weapons." }
];

export const GRENADE_TYPES = [
  { key:"concussion", name:"Concussion", radius:10, price:50, desc:"Pressure wave; smaller area than fragmentation, so favoured in assaults. Deals area damage underwater." },
  { key:"fragmentation", name:"Fragmentation", radius:40, price:50, desc:"Shrapnel in all directions; deals area damage. Wartime-era grenades reach 60 feet." },
  { key:"gas", name:"Gas / riot control", radius:25, price:50, desc:"Tear gas expanding 5 feet per round to full radius. Wind changes the pattern." },
  { key:"illumination", name:"Illumination", radius:100, price:50, desc:"Lights a 100-foot radius for 15-30 seconds. Infrared versions light only that spectrum." },
  { key:"incendiary", name:"Incendiary / thermite", radius:5, price:50, dr:"K", desc:"Burns 30 seconds at nearly 4,000F, even underwater. Small radius, so usually placed rather than thrown." },
  { key:"smoke", name:"Smoke / signal", radius:60, price:50, desc:"Burns 1-2 minutes; expands 20 feet per round. Perception checks inside take -4 DF. Signal versions cover 30 feet in colour." },
  { key:"stun", name:"Stun / flashbang", radius:20, price:50, desc:"Blinds anyone within 20 feet looking towards it and deafens for 1-2 minutes. Sixth Sense prevents the blindness; a DF 8 Willpower check preserves balance, else prone for a round." }
];

export const BODY_ARMOR = [
  { key:"lvl1", name:"Level 1 Body Armor", firearm:2, cutting:1, blunt:0, spotDF:8, price:250,
    desc:"Light bullet-resistant material. Concealable but not designed for it." },
  { key:"lvl2", name:"Level 2 Body Armor", firearm:3, cutting:2, blunt:1, spotDF:null, price:500,
    desc:"The standard police vest. Cannot be worn covertly with any success." },
  { key:"lvl3", name:"Level 3 Body Armor", firearm:4, cutting:3, blunt:2, spotDF:null, price:750,
    desc:"Military grade with insertable trauma plates." },
  { key:"lvl4", name:"Level 4 Body Armor", firearm:5, cutting:5, blunt:5, spotDF:null, price:1000,
    desc:"Level 3 plus a ballistic riot shield. SWAT and riot duty." },
  { key:"mesh", name:"Ballistic Mesh Shirt", firearm:2, cutting:0, blunt:0, spotDF:3, price:450,
    desc:"Concealable; firearm protection only, nothing against blades." },
  { key:"bespoke", name:"Bespoke Body Armor", firearm:3, cutting:2, blunt:1, spotDF:4, price:2500,
    desc:"Form-fitted, very concealable for its protection. Two weeks from fitting to delivery." },
  { key:"eod", name:"EOD Suit", firearm:6, cutting:6, blunt:6, absorbs:2, spotDF:null, price:15000,
    desc:"Bomb-disposal suit. One hour maximum in heat; all physical activity at quarter speed. Replace after absorbing wounds." },
  { key:"raincoat", name:"Raincoat Protector", firearm:3, cutting:2, blunt:1, spotDF:2, price:3000,
    desc:"Looks like an ordinary raincoat at only 7 lbs. Leather version $3,500." }
];
export const ARMOR_NOTES = [
  "A successful Targeted Blow or Specific Fire ignores body armour entirely.",
  "Vehicle armour, body armour and improvised shields normally stack; apply them in order."
];

export const SUPPRESSORS = [
  { key:"silencer", name:"Silencer", pistol:400, other:600, effect:"-1 Damage Rank, and -4 DF on hearing-based Perception checks to notice the shot." },
  { key:"flash", name:"Flash Suppressor", pistol:200, other:400, effect:"-2 DF to locate a concealed shooter." },
  { key:"hybrid", name:"Hybrid", pistol:800, other:1200, effect:"Both the silencer and flash suppressor effects." }
];
export const SIGHTS = [
  { key:"laser", name:"Laser Sight", pistol:250, other:600, effect:"Specific Fire at -1 DF instead of -2; Taking Aim gives +5 DF instead of +3. Effective to 2,500 feet on a rifle. All sights add +10 to Draw." },
  { key:"nightvision", name:"Night Vision Sight", price:950, effect:"Works as law-enforcement night vision goggles." },
  { key:"telescopic", name:"Telescopic Sight", price:750, effect:"Doubles the weapon's long range, capped by Damage Rank: F or less 1,500 ft; G-H 2,750 ft; I 4,500 ft; J+ 6,500 ft." },
  { key:"thermal", name:"Thermal Sight", price:1250, effect:"Works as thermal night vision goggles." }
];
export const HOLSTERS = [
  { key:"balanced", name:"Balanced", price:50, cm:0, draw:0, effect:"The default; no game effect." },
  { key:"concealed", name:"Concealed", price:50, cm:-2, draw:-20, effect:"-2 to the pistol's Concealment Modifier and -20 to Draw." },
  { key:"fast", name:"Fast", price:50, cm:1, draw:40, effect:"+1 to the pistol's Concealment Modifier and +40 to Draw." }
];

/* ---------------------------------------------------------------- 19. VEHICLES */

/* pm=Performance Modifier, pl=Performance Limit (lowest safe bid), mp=Modification Points */
export const VEHICLES = [
  // Cars, off-road, trucks, vans
  { key:"alfa159", name:"Alfa Romeo 159", cat:"car", pm:1, pl:4, cruise:80, max:140, range:520, ram:2, mp:6, price:38000 },
  { key:"arielatom", name:"Ariel Atom 500", cat:"car", pm:3, pl:1, cruise:120, max:175, range:300, ram:2, mp:2, price:205000 },
  { key:"astondbs", name:"Aston Martin DBS V12", cat:"car", pm:2, pl:2, cruise:130, max:190, range:300, ram:3, mp:7, price:290000 },
  { key:"bmw118i", name:"BMW 118i", cat:"car", pm:1, pl:3, cruise:80, max:130, range:510, ram:2, mp:6, price:33500 },
  { key:"bmw550i", name:"BMW 550i", cat:"car", pm:1, pl:3, cruise:90, max:155, range:400, ram:3, mp:8, price:85000 },
  { key:"bmwz4", name:"BMW Z4", cat:"car", pm:1, pl:4, cruise:80, max:155, range:360, ram:3, mp:8, price:70000 },
  { key:"veyron", name:"Bugatti Veyron", cat:"car", pm:3, pl:1, cruise:150, max:250, range:250, ram:3, mp:8, price:1850000 },
  { key:"escalade", name:"Cadillac Escalade", cat:"suv", pm:0, pl:4, cruise:80, max:140, range:410, ram:3, mp:11, price:65000 },
  { key:"corvette", name:"Chevrolet Corvette", cat:"car", pm:1, pl:3, cruise:120, max:190, range:375, ram:2, mp:6, price:85000 },
  { key:"charger", name:"Dodge Charger", cat:"car", pm:1, pl:4, cruise:80, max:140, range:425, ram:3, mp:8, price:32000 },
  { key:"durastar", name:"DuraStar Medium Duty", cat:"truck", pm:-1, pl:5, cruise:65, max:90, range:600, ram:7, mp:47, price:85000 },
  { key:"ferrari458", name:"Ferrari 458 Italia", cat:"car", pm:2, pl:2, cruise:140, max:200, range:330, ram:3, mp:8, price:265000 },
  { key:"fiatpanda", name:"Fiat Panda", cat:"car", pm:0, pl:4, cruise:60, max:100, range:380, ram:2, mp:4, price:12500 },
  { key:"crownvic", name:"Ford Crown Victoria", cat:"car", pm:0, pl:4, cruise:70, max:110, range:325, ram:3, mp:7, price:29000 },
  { key:"forde150", name:"Ford E-150", cat:"van", pm:-1, pl:5, cruise:60, max:100, range:495, ram:3, mp:10, price:32000 },
  { key:"mondeo", name:"Ford Mondeo", cat:"car", pm:1, pl:4, cruise:80, max:140, range:570, ram:3, mp:7, price:35000 },
  { key:"mustang", name:"Ford Mustang", cat:"car", pm:1, pl:4, cruise:70, max:120, range:380, ram:3, mp:7, price:25000 },
  { key:"taurus", name:"Ford Taurus", cat:"car", pm:0, pl:4, cruise:65, max:110, range:450, ram:3, mp:8, price:28000 },
  { key:"accord", name:"Honda Accord", cat:"car", pm:0, pl:4, cruise:65, max:110, range:450, ram:3, mp:5, price:24000 },
  { key:"humvee", name:"Humvee (HMMWV)", cat:"offroad", pm:1, pl:3, cruise:55, max:75, range:150, ram:4, mp:11, price:65000 },
  { key:"jaguarxk", name:"Jaguar XK", cat:"car", pm:1, pl:3, cruise:110, max:170, range:360, ram:3, mp:8, price:85000 },
  { key:"wrangler", name:"Jeep Wrangler", cat:"offroad", pm:0, pl:4, cruise:60, max:105, range:340, ram:3, mp:7, price:24500 },
  { key:"koenigsegg", name:"Koenigsegg CCX", cat:"car", pm:3, pl:1, cruise:150, max:245, range:305, ram:2, mp:6, price:550000 },
  { key:"aventador", name:"Lamborghini Aventador", cat:"car", pm:3, pl:2, cruise:140, max:215, range:310, ram:3, mp:7, price:390000 },
  { key:"gallardo", name:"Lamborghini Gallardo", cat:"car", pm:2, pl:2, cruise:140, max:200, range:360, ram:3, mp:7, price:215000 },
  { key:"defender", name:"Land Rover Defender", cat:"offroad", pm:1, pl:3, cruise:60, max:90, range:475, ram:3, mp:10, price:39000 },
  { key:"macktitan", name:"Mack Titan Semi-Trailer", cat:"truck", pm:-1, pl:5, cruise:55, max:90, range:1900, ram:11, mp:110, price:200000 },
  { key:"minicooper", name:"Mini Cooper S", cat:"car", pm:2, pl:4, cruise:70, max:140, range:395, ram:2, mp:5, price:25000 },
  { key:"nissanleaf", name:"Nissan Leaf", cat:"car", pm:0, pl:4, cruise:60, max:90, range:75, ram:2, mp:5, price:32500 },
  { key:"peugeot308", name:"Peugeot 308", cat:"car", pm:0, pl:4, cruise:60, max:125, range:360, ram:2, mp:6, price:28000 },
  { key:"porsche911", name:"Porsche 911 Turbo S", cat:"car", pm:2, pl:2, cruise:130, max:195, range:315, ram:3, mp:7, price:165000 },
  { key:"tatanano", name:"Tata Nano", cat:"car", pm:-1, pl:4, cruise:55, max:105, range:225, ram:1, mp:3, price:2500 },
  { key:"corolla", name:"Toyota Corolla", cat:"car", pm:0, pl:4, cruise:60, max:115, range:390, ram:2, mp:5, price:17000 },
  { key:"prius", name:"Toyota Prius", cat:"car", pm:0, pl:4, cruise:55, max:100, range:575, ram:2, mp:6, price:29000 },
  { key:"sienna", name:"Toyota Sienna Minivan", cat:"van", pm:-1, pl:4, cruise:60, max:110, range:430, ram:3, mp:8, price:29000 },
  { key:"tacoma", name:"Toyota Tacoma", cat:"truck", pm:0, pl:4, cruise:60, max:110, range:395, ram:3, mp:8, price:26000 },
  { key:"unimog", name:"Unimog U5000", cat:"offroad", pm:1, pl:4, cruise:40, max:60, range:450, ram:4, mp:19, price:195000 },
  { key:"astra", name:"Vauxhall Astra", cat:"car", pm:1, pl:4, cruise:70, max:135, range:485, ram:2, mp:6, price:32000 },
  { key:"vwpolo", name:"Volkswagen Polo", cat:"car", pm:0, pl:4, cruise:70, max:135, range:600, ram:2, mp:5, price:16500 },
  // Motorcycles and snowmobiles
  { key:"arcticcat", name:"Arctic Cat TZ1 LXR", cat:"snowmobile", pm:0, pl:4, cruise:50, max:100, range:110, ram:0, mp:2, price:12000 },
  { key:"bmwr1200", name:"BMW R1200RT-P", cat:"motorcycle", pm:1, pl:3, cruise:80, max:130, range:330, ram:0, mp:1, price:19000 },
  { key:"blackline", name:"Harley Davidson Blackline", cat:"motorcycle", pm:0, pl:4, cruise:60, max:115, range:215, ram:0, mp:1, price:15500 },
  { key:"ninja250", name:"Kawasaki Ninja 250R", cat:"motorcycle", pm:1, pl:4, cruise:60, max:105, range:250, ram:0, mp:1, price:5000 },
  { key:"polarisrmk", name:"Polaris Pro Ride RMK", cat:"snowmobile", pm:1, pl:3, cruise:50, max:90, range:90, ram:0, mp:1, price:10000 },
  { key:"daytona675", name:"Triumph Daytona 675", cat:"motorcycle", pm:1, pl:3, cruise:80, max:155, range:220, ram:0, mp:1, price:11000 },
  { key:"yzfr1", name:"Yamaha YZF-R1a", cat:"motorcycle", pm:2, pl:3, cruise:90, max:165, range:160, ram:0, mp:1, price:14500 },
  // Watercraft
  { key:"airboat12", name:"12' Airboat", cat:"boat", pm:0, pl:4, cruise:5, max:25, range:120, ram:1, mp:3, price:14000 },
  { key:"crrc15", name:"15' F470 CRRC", cat:"boat", pm:0, pl:4, cruise:10, max:30, range:170, ram:0, mp:1, price:9500 },
  { key:"stingray23", name:"23' Stingray 225SX", cat:"boat", pm:1, pl:3, cruise:30, max:60, range:170, ram:2, mp:5, price:48000 },
  { key:"chriscraft29", name:"29' Chris Craft Catalina", cat:"boat", pm:0, pl:4, cruise:35, max:50, range:386, ram:4, mp:12, price:240000 },
  { key:"rhib36", name:"36' Rigid Hull Inflatable Boat", cat:"boat", pm:1, pl:3, cruise:25, max:50, range:200, ram:5, mp:26, price:415000 },
  { key:"cigarette38", name:"38' Cigarette Top Gun", cat:"boat", pm:2, pl:3, cruise:40, max:85, range:200, ram:4, mp:15, price:350000 },
  { key:"rbm45", name:"45' Response Boat Medium", cat:"boat", pm:1, pl:3, cruise:30, max:50, range:280, ram:7, mp:55, price:3500000 },
  { key:"magnum80", name:"80' Magnum", cat:"boat", pm:1, pl:4, cruise:30, max:60, range:440, ram:13, mp:180, price:5250000 },
  { key:"island110", name:"110' Island-Class Patrol Boat", cat:"boat", pm:0, pl:4, cruise:15, max:35, range:3300, ram:22, mp:500, price:7000000 },
  { key:"sunseeker155", name:"155' Sunseeker Yacht", cat:"boat", pm:0, pl:5, cruise:15, max:30, range:4500, ram:31, mp:975, price:31000000 },
  { key:"cquester", name:"C-Quester Minisub", cat:"sub", pm:0, pl:4, cruise:5, max:10, range:75, ram:1, mp:3, price:350000 },
  { key:"benellipwc", name:"HSR Benelli Series-R", cat:"pwc", pm:2, pl:3, cruise:35, max:90, range:70, ram:0, mp:1, price:30000 },
  { key:"sdvmk8", name:"Mk VIII Mod 1 SDV Minisub", cat:"sub", pm:-1, pl:5, cruise:2, max:6, range:20, ram:2, mp:4, price:850000 },
  { key:"s301", name:"S301 Minisub", cat:"sub", pm:0, pl:5, cruise:5, max:15, range:100, ram:2, mp:3, price:2100000 },
  { key:"seadoogtx", name:"Sea-Doo GTX Limited iS 260", cat:"pwc", pm:1, pl:4, cruise:25, max:70, range:70, ram:0, mp:2, price:17500 },
  { key:"waverunnerfzr", name:"Yamaha WaveRunner FZR", cat:"pwc", pm:1, pl:4, cruise:25, max:65, range:70, ram:0, mp:1, price:14500 },
  { key:"superjet", name:"Yamaha WaveRunner Superjet", cat:"pwc", pm:1, pl:3, cruise:25, max:50, range:45, ram:0, mp:1, price:8500 },
  // Aircraft
  { key:"a380", name:"Airbus A380", cat:"jet", pm:0, pl:6, cruise:550, max:635, range:9500, ram:25, mp:610, price:290000000 },
  { key:"bell407", name:"Bell 407", cat:"rotary", pm:1, pl:4, cruise:130, max:150, range:600, ram:1, mp:4, price:2600000 },
  { key:"b737", name:"Boeing 737", cat:"jet", pm:0, pl:5, cruise:510, max:545, range:6500, ram:9, mp:85, price:60000000 },
  { key:"b787", name:"Boeing 787", cat:"jet", pm:0, pl:5, cruise:565, max:595, range:9500, ram:16, mp:254, price:195000000 },
  { key:"chinook", name:"Boeing CH-47 Chinook", cat:"rotary", pm:0, pl:4, cruise:150, max:195, range:450, ram:5, mp:23, price:35000000 },
  { key:"dash8", name:"Bombardier Dash 8 Q400", cat:"prop", pm:0, pl:5, cruise:420, max:480, range:1550, ram:6, mp:38, price:27000000 },
  { key:"mustangjet", name:"Cessna Citation Mustang", cat:"jet", pm:1, pl:4, cruise:390, max:495, range:1300, ram:2, mp:5, price:2650000 },
  { key:"twinotter", name:"de Havilland DHC-6 Twin Otter", cat:"prop", pm:0, pl:5, cruise:170, max:195, range:875, ram:3, mp:7, price:7000000 },
  { key:"eurotiger", name:"Eurocopter Tiger", cat:"rotary", pm:1, pl:4, cruise:110, max:190, range:500, ram:3, mp:7, price:31000000 },
  { key:"f16", name:"F-16 Fighting Falcon", cat:"jet", pm:2, pl:3, cruise:1000, max:1500, range:2600, ram:5, mp:26, price:47000000 },
  { key:"predator", name:"General Atomics MQ-1 Predator", cat:"prop", pm:0, pl:5, cruise:90, max:135, range:675, ram:0, mp:1, price:4000000 },
  { key:"g450", name:"Gulfstream G450", cat:"jet", pm:0, pl:4, cruise:525, max:580, range:5000, ram:7, mp:43, price:38250000 },
  { key:"g650", name:"Gulfstream G650", cat:"jet", pm:0, pl:4, cruise:560, max:610, range:8050, ram:7, mp:49, price:65000000 },
  { key:"r22", name:"Robinson R22", cat:"rotary", pm:-1, pl:4, cruise:90, max:115, range:240, ram:0, mp:1, price:260000 },
  { key:"blackhawk", name:"Sikorsky UH-60 Black Hawk", cat:"rotary", pm:1, pl:4, cruise:175, max:215, range:1380, ram:3, mp:10, price:22000000 }
];

export const VEHICLE_SKILL_BY_CAT = {
  car:"driving", suv:"driving", truck:"driving", van:"driving", offroad:"driving",
  motorcycle:"driving", snowmobile:"driving",
  boat:"boating", pwc:"boating", sub:"boating",
  jet:"piloting", prop:"piloting", rotary:"piloting"
};

export const VEHICLE_MODS = [
  { key:"armor1", name:"Armor Level 1", mp:0, price:"$2,500 per Modification Point", reduces:4,
    desc:"Bullet-resistant materials. Reduces Damage Rank by 4 steps; Damage Rank D or less cannot penetrate. Includes puncture-resistant tyres." },
  { key:"armor2", name:"Armor Level 2", mp:0.5, price:"$5,000 per Modification Point", reduces:6,
    desc:"Adds steel tubing and an electrical protection system. Reduces Damage Rank by 6 steps; F or less cannot penetrate. +1 Ram per 5 stock Modification Points." },
  { key:"armor3", name:"Armor Level 3", mp:0.5, price:"$10,000 per Modification Point", reduces:6, absorbs:1,
    desc:"Redundant systems and upgraded running gear. Reduces Damage Rank by 6 steps and absorbs one Wound Rank. +1 Ram per 4 stock Modification Points." },
  { key:"armor4", name:"Armor Level 4", mp:0.5, price:"$20,000 per Modification Point", reduces:8, absorbs:1,
    desc:"Heavy armour and cutting-edge materials. Reduces Damage Rank by 8 steps and absorbs one Wound Rank. +1 Ram per 2 stock Modification Points, but -1 Performance Modifier." },
  { key:"autopilot", name:"Autopilot", mp:2, price:"$5,000",
    desc:"Drives itself at -2 Performance Modifier and can only bid down to Difficulty Factor 5." },
  { key:"bulletscreen", name:"Bullet Proof Screen", mp:2, price:"$1,000",
    desc:"Steel sheets behind the rear window; complete protection from rearward small arms. Five rounds of .50 calibre jams it open." },
  { key:"dronesystem", name:"Drone System", mp:3, price:"$5,000 + $35,000 per drone",
    desc:"Launches a modified switchblade drone. Auto-seek attacks at Base Chance 10; a piloted drone uses the operator's skill." },
  { key:"ejector", name:"Ejector Seat", mp:0.5, price:"$8,000",
    desc:"Blows a seat clear. Wound by speed: over 30mph Light, over 50mph Medium, over 80mph Heavy, over 100mph Incapacitation." },
  { key:"electrical", name:"Electrical Protection System", mp:0.5, price:"$2,000",
    desc:"EMP hardening plus electrified door handles, from a nasty shock up to taser effect." },
  { key:"empcannon", name:"EMP Cannon", mp:2, price:"$8,500",
    desc:"Kills an unshielded electronic target within 100 feet in a cone. Two shots, then 24 hours on mains power to recharge." },
  { key:"explosivealarm", name:"Explosive Alarm System", mp:0, price:"$500",
    desc:"Motion-triggered charge by the accelerator. Damage Rank L to everything within 10 feet." },
  { key:"gasports", name:"Gas Ports and Oxygen Feeds", mp:2, price:"$2,000 + 4 grenades",
    desc:"Wheel-well grenades dropped by a switch, plus four hidden gas masks." },
  { key:"gunports", name:"Gun Ports", mp:0, price:"$1,000 sliding / $500 through-the-skin",
    desc:"Fire from inside. Cannot be armoured; no Take Aim or Specific Fire through a port. A vehicle may have as many ports as Modification Points." },
  { key:"halogen", name:"Halogen Burst Lamp", mp:0, price:"$500 + $50 per bulb",
    desc:"3,000-lumen flash from the number-plate lamp. Close-range pursuers make a DF 5 Control check; Average range takes -1 DF next round." },
  { key:"hud", name:"Heads-Up Display", mp:1, price:"$2,000 (night vision: 1.5 MP, $5,000)",
    desc:"+1 Difficulty Factor in night and bad-weather chases. Pairs with infrared headlights for goggle-free night vision." },
  { key:"hidden", name:"Hidden Compartment", mp:1, price:"$500-$4,000 per Modification Point by level",
    desc:"Four levels giving -1 to -4 Difficulty Factor on inspections. Levels 3-4 force a check even with dogs or scanners." },
  { key:"inkcloud", name:"Ink Cloud Generator", mp:1, price:"$2,000 + $100 refill",
    desc:"Expands 20 feet per round to a 100-foot radius; -2 Difficulty Factor to manoeuvres inside. One cloud per fill." },
  { key:"minedispenser", name:"Mine Dispenser", mp:1, price:"$1,500 + $100 per mine",
    desc:"Four mines, Area Damage Rank K. Cannot be used at Close range; avoiding one is a DF 4 roll." },
  { key:"computer", name:"Modified Integrated Computer", mp:0.5, price:"$4,000",
    desc:"Full computer with internet and secure-network access; prerequisite for several other modifications." },
  { key:"runninglights", name:"Modifiable Running Lights", mp:0.5, price:"$1,500",
    desc:"Reconfigure every light. Worth +1 or -1 Difficulty Factor in a chase; dimmed tail lights force a DF 3 Perception check or shooters take -2 DF." },
  { key:"mortarsystem", name:"Mortar System", mp:3, price:"$15,000 + double shell cost",
    desc:"Compact rotatable mortar at quarter range, fired through the integrated computer at -2 Difficulty Factor." },
  { key:"oilslick", name:"Oil Slick Sprayer", mp:0.5, price:"$1,500 + $200 refill",
    desc:"Pursuers at Close, Average or Long range make two DF 2 accident rolls. Two uses per fill." },
  { key:"performance", name:"Performance Modification", mp:1, price:"10% of stock price",
    desc:"+10% cruise and maximum speed and -1 Performance Limit (never below 2). Unavailable to vehicles already at Limit 1-2." },
  { key:"tires", name:"Puncture Resistant Tires", mp:0, price:"$200 per tyre",
    desc:"Two Kill results to disable. After the first, all driving is at -1 Difficulty Factor." },
  { key:"quicktint", name:"Quick-Tint Windows", mp:0, price:"$500", desc:"Heavy tint at the flick of a switch; also changes the vehicle's profile." },
  { key:"plates", name:"Revolving License Plate", mp:0, price:"$500", desc:"Four plates on a revolving mechanism." },
  { key:"smokescreen", name:"Smoke Screen Generator", mp:1, price:"$750 + $250 refill",
    desc:"Covers four lanes. Pursuers at Close or Average range make a DF 4 accident roll; every follower loses one range step regardless. Two charges." },
  { key:"pkglaw", name:"Law Enforcement Package", mp:2.5, price:"$3,000 + 15% of stock price",
    desc:"Puncture-resistant tyres, performance modification, police-records computer and structural reinforcement. +10% speeds, +1 Ram." },
  { key:"pkgagent", name:"Agent Package", mp:2, price:"$3,000 + 10% of stock + $5,000 per Modification Point",
    desc:"Puncture-resistant tyres, performance modification, records computer, quick-tint windows and Level 2 armour." },
  { key:"pkgspecial", name:"Special Agent Package", mp:2.5, price:"$5,000 + 10% of stock + $10,000 per Modification Point",
    desc:"As the Agent package but with Level 3 armour and an electrical protection system." },
  { key:"structural", name:"Structural Reinforcement", mp:1, price:"5% of stock price",
    desc:"+1 Ram, and the vehicle's first damage is reduced by one rank." },
  { key:"tackstrip", name:"Tack Strip Dispenser", mp:1, price:"$1,500 + $200 per strip",
    desc:"Kills every tyre on following vehicles. Avoidance is a Driving check at DF 2 Close, 4 Average, 7 beyond. Killed tyres force a DF 5 accident check." },
  { key:"tireslasher", name:"Tire Slasher", mp:0.5, price:"$1,000 for all four",
    desc:"Rotating hubcap blades. Needs a successful Stunt or Ram; delivers a single Kill to one tyre." },
  { key:"twin50", name:"Twin .50 Machineguns", mp:2, price:"$60,000",
    desc:"Behind the headlights, fired with the vehicle skill instead of Fire Combat. Three burst shots; an hour to reload." },
  { key:"twin240", name:"Twin M240B Machineguns", mp:2, price:"$50,000",
    desc:"As the .50 modification but six burst shots before depletion." },
  { key:"arresting", name:"Vehicle Arresting System", mp:1, price:"$2,000 + $500 per net",
    desc:"Drops a net that locks a follower's front tyres. Avoidance at DF 2 Close, 4 Average, 7 beyond. Ten minutes to untangle." }
];

/* ---------------------------------------------------------------- 20. GEAR */

export const GEAR = [
  // Cases and containers
  { key:"case_alarm", name:"Case: Alarm and Tracer", cat:"Cases & Luggage", mp:0.5, price:1000, desc:"Alarms if the case leaves a paired device by 10-50 feet, or transmits a trackable signal within 100 miles." },
  { key:"case_biometric", name:"Case: Biometric Lock", cat:"Cases & Luggage", mp:1, price:1250, desc:"Opens only for the keyed fingerprint." },
  { key:"case_bolt", name:"Case: Bolt and Lift", cat:"Cases & Luggage", mp:4, price:4750, desc:"Fires a bolt trailing 330 feet of line and winches up to 450 lbs. Fire Combat to lodge the bolt; a Fair result leaves a 10% chance it slips under 200 lbs. As a weapon: -2 DF, Damage Rank I at all ranges Average." },
  { key:"case_bulletproof", name:"Case: Bulletproof", cat:"Cases & Luggage", mp:4, price:2000, desc:"Folded, stops anything under .50 calibre in a small area; unfolded as improvised cover it reduces firearm and shrapnel Damage Rank by 4 steps." },
  { key:"case_bulletresistant", name:"Case: Bullet Resistant", cat:"Cases & Luggage", mp:2, price:1500, desc:"Folded, stops anything under .30 calibre; unfolded it reduces firearm and shrapnel Damage Rank by 2 steps." },
  { key:"case_firearm", name:"Case: Concealed Firearm", cat:"Cases & Luggage", mp:1, price:3000, desc:"A disassembled weapon hidden throughout the case; found only on a DF 1/2 Perception check. Destroying the case takes one minute, assembly another." },
  { key:"case_lining", name:"Case: Covert Linings", cat:"Cases & Luggage", mp:1, price:5000, desc:"Defeats airport-type screening. A trained operator needs a DF 1 Perception check; unattended scanners never catch it." },
  { key:"case_electric", name:"Case: Electric Security", cat:"Cases & Luggage", mp:2, price:750, desc:"Electrifies the case beyond a set distance from its fob; anyone holding it is immediately Stunned." },
  { key:"case_garrote", name:"Case: Garrote", cat:"Cases & Luggage", mp:0.5, price:300, desc:"Retracting high-tensile wire. Needs complete surprise and Good (3) or better; +8 Damage Rank. Escape costs a Hero or Villain Point." },
  { key:"case_gas", name:"Case: Gas Defense", cat:"Cases & Luggage", mp:1, price:2000, desc:"Opening it wrongly gasses everyone within 10 feet." },
  { key:"case_hidden", name:"Case: Hidden Compartment", cat:"Cases & Luggage", mp:1, price:100, desc:"Four levels giving -1 to -4 DF on inspections at $100/$200/$400/$1,000 per Modification Point." },
  { key:"case_knife", name:"Case: Knife Dispenser", cat:"Cases & Luggage", mp:2, price:500, desc:"Ejects two throwing knives, the second two rounds after the first." },
  // Belts, ties, shoes, rings, watches
  { key:"belt_explosive", name:"Belt: Explosive", cat:"Wearables", price:400, desc:"0.5 lbs of C4 in a covert lining, wirelessly detonated." },
  { key:"belt_money_c", name:"Belt: Money (commercial)", cat:"Wearables", price:25, desc:"Nylon travel belt with a zipped interior. Spotted on a DF 8 Perception check." },
  { key:"belt_money_covert", name:"Belt: Money (covert)", cat:"Wearables", price:250, desc:"Indistinguishable fine leather; the buckle hides a blade to open the stitching. Covert lining." },
  { key:"belt_rope", name:"Belt: Rope", cat:"Wearables", price:200, desc:"200 feet of high-tensile line rated to 750 lbs." },
  { key:"tie_incendiary", name:"Tie: Incendiary", cat:"Wearables", price:400, desc:"Burns at 3,300F; ignites in two rounds and cuts three inches of metal in ten. Worn and exposed to flame, one round to remove on a DF 3 Dexterity check or die." },
  { key:"tie_rope", name:"Tie: Rope", cat:"Wearables", price:125, desc:"100 feet of high-tensile line rated to 750 lbs." },
  { key:"shoe_escape", name:"Shoes: Escape Kit", cat:"Wearables", price:800, desc:"Plastic stabbing knife (+1 Damage Rank), pry handle, microdot reader and map dot, treated laces that weaken a half-inch bar, file, wire cutter, magnifier and three matches. Covert lining. Refill $100." },
  { key:"shoe_explosive", name:"Shoes: Explosive", cat:"Wearables", price:600, desc:"0.5 lbs of C4 in one heel, blasting cap and detonator in the other." },
  { key:"ring_poison", name:"Ring: Poison Compartment", cat:"Wearables", price:150, desc:"Hidden compartment for drugs or poison." },
  { key:"ring_utility", name:"Ring: Titanium Utility", cat:"Wearables", price:350, desc:"Half-inch blade, serrated blade, saw, bottle opener and comb." },
  { key:"watch_garrote", name:"Watch: Garrote", cat:"Wearables", price:300, desc:"Retracting wire. Complete surprise and Good (3) or better; +8 Damage Rank. Escape costs a Hero or Villain Point." },
  { key:"watch_geiger", name:"Watch: Geiger Counter", cat:"Wearables", price:600, desc:"Flash, beep or both when radiation is detected; a dial shows intensity." },
  { key:"watch_saw", name:"Watch: Rotary Saw", cat:"Wearables", price:450, desc:"Diamond edge cuts half an inch of metal a minute for ten minutes." },
  { key:"glasses_polarized", name:"Glasses: Polarized Lenses", cat:"Wearables", price:200, desc:"Manually adjustable polarisation cuts glare through glass." },
  { key:"glasses_rear", name:"Glasses: Rear Vision", cat:"Wearables", price:1250, desc:"Temple cameras project a rearward view onto the lenses. 45-minute battery." },
  // Cigarettes and lighters
  { key:"cig_anesthetizer", name:"Cigarette: Anesthetizer", cat:"Covert Tools", price:150, desc:"Blown at a target as a Hand-to-Hand attack. The target makes two serial Willpower rolls one step harder than your Quality; either failure means unconsciousness in a minute." },
  { key:"cig_explosive", name:"Cigarette: Explosive", cat:"Covert Tools", price:50, desc:"Damage Rank B a minute after lighting; disorients for a round unless a DF 3 Willpower check succeeds. Also serves as a blasting cap." },
  { key:"cigcase_explosive", name:"Cigarette Case: Explosive", cat:"Covert Tools", price:200, desc:"Hides 0.5 lbs of C4 behind thin metal, but carries no detonator." },
  { key:"cigcase_star", name:"Cigarette Case: Throwing Star", cat:"Covert Tools", price:50, desc:"The tungsten cover twists and locks into a shuriken." },
  { key:"lighter_explosive", name:"Lighter: Explosive", cat:"Covert Tools", price:50, desc:"0.5 lbs of C4 in the fuel chamber plus a minute of flame. No detonator." },
  { key:"lighter_gas", name:"Lighter: Gas Defense", cat:"Covert Tools", price:50, desc:"Holds a gas of choice instead of fuel." },
  // Pens and umbrellas
  { key:"pen_acid", name:"Pen: Acid", cat:"Covert Tools", price:150, desc:"Ballpoint melts four one-inch bars or a 10-inch hole in sheet metal; fountain version doubles that. Refill $25." },
  { key:"pen_binoculars", name:"Pen: Binoculars", cat:"Covert Tools", price:250, desc:"Twists apart into 5x miniature binoculars." },
  { key:"pen_explosive", name:"Pen: Explosive", cat:"Covert Tools", price:200, desc:"0.4 lbs of C4; three rapid clicks arms it as a grenade at Area Damage Rank H." },
  { key:"pen_gas", name:"Pen: Gas", cat:"Covert Tools", price:150, desc:"Enough CS gas for one person." },
  { key:"pen_gun", name:"Pen: Gun", cat:"Covert Tools", price:350, weapon:{ pm:-1, rof:1, ammo:1, dr:"F", close:"0-10", long:"40-80", mis:"97-99", draw:0, rl:2 }, desc:"Fires a single 9mm round." },
  { key:"umbrella_airgun", name:"Umbrella: Airgun", cat:"Covert Tools", price:950, weapon:{ pm:0, rof:1, ammo:1, dr:null, close:"0-1", long:null, mis:"99", draw:0, rl:20 }, desc:"Silently fires a thin capsule up to one foot. Heavy-metal toxin: DF 3 Strength shakes it off, else DF 5 checks after one and two weeks; either failure kills in the fourth week without top medical care. Great (2) or better fires unnoticed." },
  { key:"umbrella_resistant", name:"Umbrella: Bullet Resistant", cat:"Covert Tools", price:230, desc:"Reduces all projectile damage by 3 steps and shields against Molotov cocktails." },
  { key:"umbrella_pistol", name:"Umbrella: Pistol", cat:"Covert Tools", price:1250, weapon:{ pm:0, rof:2, ammo:2, dr:"D", close:"0-1", long:"50-100", mis:"98-99", draw:0, rl:1 }, desc:"Double-shot .22, silenced and flash suppressed." },
  { key:"umbrella_sword", name:"Umbrella: Sword", cat:"Covert Tools", price:275, desc:"+2 Damage Rank small sword in a covert-lined shaft." },
  // Binoculars, microphones, night vision
  { key:"binoc_assassin", name:"Binoculars: Assassin's", cat:"Surveillance", price:3500, desc:"Drives an explosive spike through the viewer's skull for L(2) damage. Two hidden pressure plates disarm it while held." },
  { key:"binoc_recording", name:"Binoculars: Recording", cat:"Surveillance", price:1950, desc:"20x zoom recording to a removable drive or streaming over the internet." },
  { key:"mic_shotgun", name:"Shotgun Microphone", cat:"Surveillance", price:100, desc:"Hears any chosen conversation within 50 yards in its cone, given clear line of sight." },
  { key:"mic_parabolic", name:"Parabolic Microphone", cat:"Surveillance", price:500, desc:"As the shotgun microphone but out to 300 yards." },
  { key:"mic_laser", name:"Laser Microphone", cat:"Surveillance", price:3500, desc:"Reads vibrations off glass at up to 5 miles." },
  { key:"nv_consumer", name:"Night Vision: Consumer", cat:"Surveillance", price:600, desc:"Spots a person at 100 yards and a vehicle at 400 under starlight; moonlight doubles both." },
  { key:"nv_le", name:"Night Vision: Law Enforcement", cat:"Surveillance", price:2000, desc:"Person at 400 yards, vehicle at 1,600 under starlight; moonlight doubles both." },
  { key:"nv_thermal", name:"Night Vision: Thermal", cat:"Surveillance", price:4000, desc:"Sees heat, defeating foliage and camouflage. Person at 400 yards, vehicle at 1,000, or 2,000 if recently driven." },
  { key:"nv_military", name:"Night Vision: Military", cat:"Surveillance", price:8000, desc:"Thermal and light amplification together." },
  // Lock picks
  { key:"lp_earring", name:"Earring Lock Picks", cat:"Entry Tools", price:200, desc:"Disguised picks lacking the finer tools: -1 Difficulty Factor." },
  { key:"lp_passcard", name:"Electronic Passcard Cracker", cat:"Entry Tools", price:800, desc:"Tries thousands of magnetic keycodes. Lockpicking at DF 4; a Fair (4) trips alarms, Good (3) or better does not." },
  { key:"lp_bump", name:"Bump Key set", cat:"Entry Tools", price:20, desc:"+2 Difficulty Factor and a 20-second base time. Works better on quality locks. Different keys for different lock types." },
  { key:"lp_jigglers", name:"Jigglers (tryout keys)", cat:"Entry Tools", price:50, desc:"Bump keys for cars, sold per manufacturer." },
  { key:"lp_picks", name:"Lock Picks", cat:"Entry Tools", price:50, desc:"Standard set: Americas, European or Asian. Wrong region is -1 Difficulty Factor. Elite 200-piece set $350 for +2 Difficulty Factor." },
  { key:"lp_shim", name:"Padlock Shim set", cat:"Entry Tools", price:25, desc:"+4 Difficulty Factor, 20-second base time. Twenty shims across five shackle diameters." },
  { key:"lp_slimjim", name:"Slim Jim set", cat:"Entry Tools", price:25, desc:"+2 Difficulty Factor, 20-second base time. Five per set." },
  { key:"lp_shovit", name:"Shovit Tool", cat:"Entry Tools", price:15, desc:"+2 Difficulty Factor, 20-second base time." },
  { key:"lp_snapgun", name:"Snap Gun", cat:"Entry Tools", price:50, desc:"Mechanically snaps the pins. Illegal without a locksmith licence in many places." },
  // Security gear
  { key:"sec_fingerprint", name:"Fingerprint Scanner Lock", cat:"Security Gear", price:200, desc:"Cheap versions fooled 25% of the time by false prints, expensive 15%, electronics-mounted 50%. Three failures trigger consequences. Expensive version $800." },
  { key:"sec_keypad", name:"Keypad Lock", cat:"Security Gear", price:300, desc:"Cracked with a DF 1 Electronics check given equipment — or 3 Hero Points." },
  { key:"sec_magcard", name:"Magnetic Card Lock", cat:"Security Gear", price:300, desc:"Needs an electronic passcard cracker. Lax employees are usually the easier route." },
  { key:"sec_metal", name:"Metal Detector", cat:"Security Gear", price:4500, desc:"Stationary $4,500, wand $150. Always detects unshielded metal larger than a key." },
  { key:"sec_motion", name:"Motion Detector", cat:"Security Gear", price:50, desc:"Very hard to bypass without moving slowly enough not to register." },
  { key:"sec_palm", name:"Palm Scanner Lock", cat:"Security Gear", price:3000, desc:"Cheap versions fooled 15% of the time, expensive 5%. Three failures trigger consequences. Expensive version $6,000." },
  { key:"sec_thermal", name:"Thermal Detector", cat:"Security Gear", price:200, desc:"Triggered by heat signatures; only a physical heat shield reliably defeats it." },
  { key:"sec_retinal", name:"Retinal Scanner", cat:"Security Gear", price:200000, desc:"Never yet fooled; the retina decays too fast after death. Requires an entirely different plan." },
  { key:"sec_signature", name:"Signature Analyzer", cat:"Security Gear", price:10000, desc:"Compares appearance, pressure, movement and repetition. Forgery is very hard even after watching." },
  { key:"sec_seismic", name:"Seismic Detector", cat:"Security Gear", price:300, desc:"Consumer models bypassed on a DF 5 Electronics check; high-security ($200,000) versions have never been bypassed except by not touching the warded area." },
  { key:"sec_voice", name:"Voice Analyzer", cat:"Security Gear", price:120000, desc:"99% accurate. Spoofing needs extensive access plus Disguise and Persuasion checks." },
  { key:"sec_xray", name:"X-Ray Scanner", cat:"Security Gear", price:25000, desc:"Hard to fool; covert linings are the main counter. Backscatter people-scanner $175,000." },
  // Explosives
  { key:"exp_c4", name:"C4 (M112 charge)", cat:"Explosives", price:200, desc:"1.25 lb block. 0.5 lbs is Area Damage Rank I; every extra 0.5 lbs adds a rank. Needs a blasting cap. M118 four-charge pack $300 (Damage Rank L)." },
  { key:"exp_detcord", name:"Detonation Cord", cat:"Explosives", price:1000, desc:"3,000 yards of PETN cord. Useless against a moving target; wrapped around a helpless one, death unless 3 Hero or Villain Points are spent." },
  { key:"exp_dynamite", name:"Dynamite", cat:"Explosives", price:20, desc:"Per 0.5 lb stick: Area Damage Rank H, each extra stick adding a rank to L at five sticks. Can be lit by fuse. Unstable if stored too long." },
  { key:"exp_claymore", name:"M18A1 Claymore Mine", cat:"Explosives", price:500, desc:"Remote-triggered 60-degree fan of 700 balls. Damage Rank L within 25 yards, J to 50, I to 100." },
  { key:"exp_minimore", name:"MM-1 Minimore", cat:"Explosives", price:400, desc:"Paperback-sized, 15-degree fan of 225 balls. Damage Rank K within 25 yards, I to 50, H to 100." },
  { key:"exp_molotov", name:"Molotov Cocktail", cat:"Explosives", price:10, desc:"Damage Rank H in a 5-foot burst, then Damage Rank D for two rounds. A shield reduces the initial hit to D and stops the rest." },
  { key:"exp_shaving", name:"Shaving Canister Flamethrower", cat:"Explosives", price:300, desc:"A 3-foot flame at Damage Rank H, four uses, and a dozen shaves the other way round. A roll of 00 explodes for Damage Rank J within 10 feet." },
  // Drugs and poisons
  { key:"drug_blackwidow", name:"Black Widow Poison", cat:"Drugs & Poisons", price:500, desc:"+2 Difficulty Factor to Torture attempts; victims act at -1 DF. Concentrated: DF 2 Strength check — Failure death in 6 hours, Fair 12, Good 24, Great recovery in a week, Superb in 72 hours. $25 per live spider." },
  { key:"drug_chloroform", name:"Chloroform", cat:"Drugs & Poisons", price:25, desc:"Applied with a Pin. DF 9 Willpower the first round or unconscious, the Difficulty Factor dropping by one each further round of exposure." },
  { key:"drug_cyanide", name:"Cyanide", cat:"Drugs & Poisons", price:100, desc:"Unconscious in under ten seconds, dead in five minutes. Amyl nitrate within that window allows a DF 3 Strength check to survive." },
  { key:"drug_haloperidol", name:"Haloperidol", cat:"Drugs & Poisons", price:50, desc:"Tranquilliser dart. DF 5 Strength each round to stay conscious until out or a Superb shrugs it off; then DF 8 Strength each of the first five rounds or die." },
  { key:"drug_halothane", name:"Halothane", cat:"Drugs & Poisons", price:85, desc:"Like chloroform but faster: DF 6 Willpower the first round, dropping by one per further round." },
  { key:"drug_hemotoxin", name:"Hemotoxins", cat:"Drugs & Poisons", price:200, desc:"Snake venom attacking the blood. DF 5 Strength — Failure death in 24 hours, Fair one week, Good two weeks, Great recovery in three weeks, Superb in one. Victims act as if Medium Wounded. $500 per snake." },
  { key:"drug_neurotoxin", name:"Neurotoxins", cat:"Drugs & Poisons", price:200, desc:"Snake venom attacking the nerves. DF 5 Strength — Failure death in 6 hours, Fair 12, Good 24, Great recovery in a week, Superb in 72 hours. Victims act as if Lightly Wounded. $500 per snake." },
  { key:"drug_naak", name:"Mark I NAAK", cat:"Drugs & Poisons", price:100, desc:"Nerve-agent antidote autoinjector. Works in ten rounds and fully reverses effects after three minutes. Includes diazepam." },
  { key:"drug_sarin", name:"Sarin Gas", cat:"Drugs & Poisons", price:10000, desc:"DF 2 Strength — Failure death in 10 minutes, Fair one hour, Good four hours, Great recovery in two weeks, Superb in one. Recovering victims act as if Lightly Wounded. Quarter-mile kill radius." },
  { key:"drug_vx", name:"VX Gas", cat:"Drugs & Poisons", price:20000, desc:"DF 1/2 Strength — Failure death in 8 minutes, Fair one hour, Good four hours, Great six hours, Superb recovery in two weeks. Recovering victims act as if Medium Wounded. Three-quarter-mile kill radius." },
  { key:"drug_novichok", name:"Novichok-5", cat:"Drugs & Poisons", price:40000, desc:"DF 1/2 Strength — Failure death in 8 minutes, Fair one hour, Good two hours, Great three hours, Superb recovery in three weeks. Recovering victims act as if Heavily Wounded. 1.75-mile kill radius." },
  { key:"drug_teargas", name:"Tear Gas (CS)", cat:"Drugs & Poisons", price:15, desc:"Damage Rank F at Base Chance 20, DF 5. Anything above a Light Wound heals on leaving the gas; the Light Wound clears after an hour." },
  { key:"drug_thiopental", name:"Thiopental Sodium", cat:"Drugs & Poisons", price:200, desc:"Truth serum: +2 Difficulty Factor to Torture. A roll of 98+ kills; each further dose worsens that by 5%. A Hero or Villain Point avoids the fatality." },
  { key:"drug_amytal", name:"Sodium Amytal", cat:"Drugs & Poisons", price:200, desc:"Knockout, kill or +2 Difficulty Factor to Torture. Spotted in an alcoholic drink at DF 2, otherwise DF 5; a lethal dose at DF 5 and DF 8. Overdose rules as thiopental." },
  // Surveillance bugs
  { key:"bug_sound", name:"Bug medium: Sound", cat:"Bugs", price:10, desc:"Picks up sound within 30 feet; another sound option adds 10 feet." },
  { key:"bug_visual", name:"Bug medium: Visual", cat:"Bugs", price:20, desc:"A 45-degree arc at half human visual detail; more options widen the arc or sharpen it. Night vision costs $100." },
  { key:"bug_location", name:"Bug medium: Location", cat:"Bugs", price:30, desc:"GPS position. Bugs with this are called tracers or trackers." },
  { key:"bug_gsm", name:"Bug transmission: GSM", cat:"Bugs", price:20, desc:"Dial the bug over the mobile network. Detection at -2 Difficulty Factor except while transmitting." },
  { key:"bug_uhf", name:"Bug transmission: UHF", cat:"Bugs", price:40, desc:"Detection at -2 Difficulty Factor; one-mile range." },
  { key:"bug_vlf", name:"Bug transmission: VLF", cat:"Bugs", price:40, desc:"Location data only, out to 100 miles. Detection at -4 Difficulty Factor." },
  { key:"bug_radio", name:"Bug transmission: Radio", cat:"Bugs", price:10, desc:"Ten-mile range but easy to detect with the right gear." },
  { key:"bug_hardwire", name:"Bug transmission: Hard-wire", cat:"Bugs", price:40, desc:"Permanent connection; detection at -5 Difficulty Factor. Wire taps are hard-wired bugs." },
  { key:"bug_none", name:"Bug transmission: None", cat:"Bugs", price:0, desc:"Stores only; requires physical collection. Detection at -1 Difficulty Factor." },
  { key:"bug_fixed", name:"Bug storage: Fixed duration", cat:"Bugs", price:10, desc:"Records until full. Base capacity 20 days location, 72 hours sound, 12 hours visual; +$10 per doubling." },
  { key:"bug_rolling", name:"Bug storage: Rolling duration", cat:"Bugs", price:15, desc:"Keeps a rolling window, overwriting the oldest data." },
  { key:"bug_battery", name:"Bug power: Battery", cat:"Bugs", price:10, desc:"10 days location, 6 hours sound, 2 hours visual; +$10 per doubling, up to ten doublings." },
  { key:"bug_continuous", name:"Bug power: Continuous", cat:"Bugs", price:20, desc:"Unlimited life but hard to install covertly; usually paired with a mains-powered casing." }
];
export const BUG_BUILD_NOTE =
  "Build a custom bug by choosing a medium, a transmission type, a storage option and a power source. Total the parts, add 10%, then add any casing cost.";

/** The four choices a custom bug is assembled from [Ch.7], and the assembly surcharge. */
export const BUG_BUILD_STEPS = [
  { key: "medium", name: "Medium", prefix: "bug_", keys: ["bug_sound", "bug_visual", "bug_location"] },
  { key: "transmission", name: "Transmission", keys: ["bug_gsm", "bug_uhf", "bug_vlf", "bug_radio", "bug_hardwire", "bug_none"] },
  { key: "storage", name: "Storage", keys: ["bug_fixed", "bug_rolling"] },
  { key: "power", name: "Power", keys: ["bug_battery", "bug_continuous"] }
];
export const BUG_ASSEMBLY_SURCHARGE = 0.1;

/* Vehicles in play [Ch.7, Ch.8]. Modification Points are both the budget for modifications
 * and the measure of how much damage the vehicle absorbs for the people inside it. */
export const VEHICLE_STATS = [
  { key: "pm", name: "Performance", desc: "Difficulty Factor modifier on every control check." },
  { key: "pl", name: "Passengers", desc: "How many it seats, driver included." },
  { key: "cruise", name: "Cruise", desc: "Comfortable speed in miles per hour." },
  { key: "max", name: "Maximum", desc: "Flat out, in miles per hour." },
  { key: "range", name: "Range", desc: "Miles on a full tank." },
  { key: "ram", name: "Ram", desc: "Damage Rank steps it deals ramming, and takes." },
  { key: "mp", name: "Mod Points", desc: "The modification budget, and what it absorbs for its occupants." }
];

/* ---------------------------------------------------------------- 21. RULES LIBRARY INDEX */

export const RULES_TOPICS = [
  { key:"resolution", title:"Core Resolution", chapter:"Chapter One",
    body:[
      "Every action is a Base Chance multiplied by a Difficulty Factor. The product is the Success Chance; you roll d100 against it.",
      "The base Difficulty Factor is 5. Circumstances step it up or down the ladder (1/2, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10). It can never leave that ladder.",
      "Higher Difficulty Factors are EASIER. A DF 8 action is far more forgiving than a DF 2 one.",
      "Compare the roll to the Success Chance row on the Success Quality Table for a result of Superb (1), Great (2), Good (3), Fair (4) or Failure.",
      "A d100 result of 100 always fails, no matter how high the Success Chance."
    ] },
  { key:"difficulty", title:"Difficulty Factor Modifiers", chapter:"Chapter One",
    body:[
      "Modifiers move the Difficulty Factor one step at a time along the ladder, not by arithmetic addition.",
      "One step matters; two or more steps transform the odds. Stack them honestly and tell the player before they commit.",
      "Using a skill you do not have is -3 Difficulty Factor, with the Base Chance coming from the underlying characteristic alone."
    ] },
  { key:"heropoints", title:"Hero Points", chapter:"Chapter Five",
    body:[
      "Hero Points shift a result one Success Quality step per point, in either direction, after the result is known.",
      "They also reduce an incoming wound by one rank per point.",
      "For checks the GM rolls in secret, the spend must be declared before the result is revealed — so points can be wasted.",
      "They may be spent on another character's behalf, except while Gambling.",
      "Villains hold Villain Points, which may only counter a character's action, never amplify the villain's own."
    ] },
  { key:"combatround", title:"The Combat Round", chapter:"Chapter Seven",
    body:[
      "A round is three to five seconds and has two phases.",
      "Declaration: the slowest declares first and the fastest declares last, so speed buys information. Order is set once and stands for the encounter.",
      "Action: resolution runs in reverse, so the fastest acts first and can interrupt slower characters mid-action.",
      "A character fired on before acting may abandon their declared action for a Draw Situation — the only legal change of declaration."
    ] },
  { key:"wounds", title:"Wounds and Pain", chapter:"Chapter Seven",
    body:[
      "Damage is the attack's Success Quality cross-referenced against the weapon's Damage Rank.",
      "Wounds are additive: a new wound on top of an old one produces a worse rank from the accumulation table.",
      "Light, Medium and Heavy wounds require an immediate Pain Resistance Willpower check and another every round during Declaration, or the character cannot act.",
      "Untreated wounds also impose a standing -1, -2 or -3 Difficulty Factor on everything.",
      "First Aid removes one rank, once per wound and only within the hour."
    ] },
  { key:"chases", title:"Chases", chapter:"Chapter Eight",
    body:[
      "Each round opens with a bidding war starting at Difficulty Factor 7 and running downwards.",
      "Whoever bids lowest chooses who acts first — but their bid becomes their own manoeuvre's Difficulty Factor whether they win or lose.",
      "Bidding below a vehicle's Performance Limit forces an automatic Control check on top of any failure check.",
      "A failed manoeuvre demands a Control check at that manoeuvre's Control Difficulty Factor; failing that is an accident."
    ] },
  { key:"reputation", title:"Reputation", chapter:"Chapter Four",
    body:[
      "Reputation measures how recognisable you are to other professionals. Low is good.",
      "It accrues from distinctive looks, years in a prior profession, missions, kills and scars.",
      "Anyone in the business may attempt a Perception check to recognise you; the result depends on your Reputation band.",
      "Faking a death cuts 75 points until you are recognised again. Data scrubbing costs 100 experience per point and takes a month."
    ] },
  { key:"interaction", title:"Interactions", chapter:"Chapter Nine",
    body:[
      "Reaction sets an NPC's baseline attitude, from Opposed through Neutral to Helpful.",
      "Persuasion is a Charisma check modified by that reaction, then cross-referenced against the NPC's Willpower for Yes, Perhaps or No.",
      "Seduction runs five staged rolls, each resisted by a Willpower check at a Difficulty Factor equal to your Quality.",
      "Interrogation and Torture convert your Quality against the victim's Willpower into a modified Quality, which then sets how much you learn."
    ] },
  { key:"advancement", title:"Experience and Advancement", chapter:"Chapter Six",
    body:[
      "Each completed mission pays 500 experience, modified by rank, outcome and role-playing.",
      "Skill Ranks cost 30 times the new rank; Characteristics cost 150 times the new value; a wholly new skill costs 100.",
      "No Skill or Characteristic may rise more than one point per mission.",
      "Experience also buys Reputation reduction and requisitioned equipment."
    ] }
];

export const OGL_NOTICE =
  "Classified is published by Expeditious Retreat Press under the Open Game License 1.0a. " +
  "All text in the rulebook is Open Game Content except the term \"Classified\", the publisher " +
  "name, logos, artwork and author/artist names. This application is a personal play aid.";
