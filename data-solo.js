/* data-solo.js — the Mythic layer.
 *
 * A SECOND SYSTEM AND A SECOND SOURCE. Nothing in this file is Classified. See CLAUDE.md
 * §2 for the source split, §3.20 for the profile, and rulings S1-S7 for every case where
 * the supplied report did not carry the value and it had to be reconstructed or authored.
 *
 * Provenance is recorded on every table:
 *   source: "mm38"   verbatim from the supplied Mythic Magazine Vol. 38 report
 *   authored: true   written for this app by the report's own five-step method (S6)
 *   verify: true     reconstructed, not supplied — check against your own copy (S1)
 *
 * No imports. Pure data and pure functions, so the test harness can load it in Node.
 */

/** Split a whitespace-separated word list into a 100-entry table. */
function t(str) {
  return str.trim().split(/\s+/);
}

export const SOLO_SOURCE = {
  system: "Mythic Game Master Emulator",
  supplied: "Custom Elements Meaning Tables — a report based on Mythic Magazine Volume 38",
  suppliedCovers: "The five-step table-construction method, the ten Anything Words, the doubles rule, and nine complete 100-word tables.",
  scans: "The printed Fate Chart, Random Event Focus Table and Scene Adjustment Table were supplied as images after the first solo build. All three are now transcribed from the printing: the Event Focus table confirmed the earlier reconstruction band for band, and the Fate Chart and Scene Adjustment table replaced theirs.",
  chartNotice: "The Fate Chart reproduces the printed chart cell for cell — all 81 targets and both exceptional bands.",
  remaining: "The Fate Check's odds and chaos modifiers were never in a supplied source and remain the app's own arithmetic. The Fate Chart is the verified mechanic; prefer it if the difference matters."
};

/* ================================================================ T65 chaos */

export const CHAOS_MIN = 1;
export const CHAOS_MAX = 9;
export const CHAOS_START = 5;

/** Chaos Factor is clamped, never wrapped [S4]. */
export function stepChaos(chaos, delta) {
  const n = (Number(chaos) || CHAOS_START) + (Number(delta) || 0);
  return Math.max(CHAOS_MIN, Math.min(CHAOS_MAX, n));
}

export const CHAOS_RULES = {
  start: CHAOS_START,
  range: `${CHAOS_MIN}-${CHAOS_MAX}`,
  inControl: -1,
  notInControl: 1,
  desc: "The Chaos Factor measures how far events have slipped out of the character's hands. A scene that went their way lowers it by one; a scene that did not raises it by one.",
  effect: "A higher Chaos Factor makes a Yes more likely, makes Random Events fire more often, and makes a scene more likely to be altered or interrupted."
};

/* ================================================================ T62/T63/T64 fate */

/**
 * The nine odds.
 *   `rank` places the row on the Fate Chart's ladder: +4 Certain down to -4 Impossible.
 *   `mod`  is the Fate Check's arithmetic modifier, added to 2d10.
 */
export const FATE_ODDS = [
  { key: "certain",   name: "Certain",           rank:  4, mod:  5 },
  { key: "nearcert",  name: "Nearly Certain",    rank:  3, mod:  4 },
  { key: "verylikely",name: "Very Likely",       rank:  2, mod:  2 },
  { key: "likely",    name: "Likely",            rank:  1, mod:  1 },
  { key: "fifty",     name: "50/50",             rank:  0, mod:  0 },
  { key: "unlikely",  name: "Unlikely",          rank: -1, mod: -1 },
  { key: "veryunl",   name: "Very Unlikely",     rank: -2, mod: -2 },
  { key: "nearimp",   name: "Nearly Impossible", rank: -3, mod: -4 },
  { key: "impossible",name: "Impossible",        rank: -4, mod: -5 }
];

export const FATE_ODDS_BY_KEY = Object.fromEntries(FATE_ODDS.map(o => [o.key, o]));
export const FATE_DEFAULT_ODDS = "fifty";

/** Chaos modifier: one step per point away from the middle of the range. */
export function chaosMod(chaos) {
  return Math.max(CHAOS_MIN, Math.min(CHAOS_MAX, Number(chaos) || CHAOS_START)) - CHAOS_START;
}

/* The one part of the Mythic layer with no supplied source behind it (S1). */
export const FATE_CHECK_VERIFY = true;

export const FATE_CHECK = {
  dice: "2d10",
  threshold: 11,
  desc: "Roll 2d10, add the odds modifier and the chaos modifier, and 11 or more is a Yes.",
  eventTrigger: "Matching dice fire a Random Event as well as answering the question.",
  exceptionalMargin: 5,
  exceptionalDesc: "Beating or missing the threshold by 5 or more makes the answer Exceptional."
};

/**
 * The Fate Chart, transcribed from the printed chart supplied after the first solo build
 * [S1]. The printing is a single ladder read diagonally: every cell equals the cell up and
 * to its left, so one point of Chaos Factor moves exactly as far as one step of odds. That
 * is why Impossible at Chaos Factor 9 is the same 50 as 50/50 at Chaos Factor 5 — the
 * reconstruction this replaces weighted the odds axis four times as heavily, and got both
 * that and the middle column wrong.
 *
 *   ladder index = odds rank + (Chaos Factor - 5), clamped to +/-8
 */
export const FATE_LADDER = {
  "-8": 1, "-7": 1, "-6": 1,
  "-5": 5, "-4": 10, "-3": 15, "-2": 25, "-1": 35,
  "0": 50,
  "1": 65, "2": 75, "3": 85, "4": 90, "5": 95,
  "6": 99, "7": 99, "8": 99
};

export const FATE_LADDER_MIN = -8;
export const FATE_LADDER_MAX = 8;

export function fateScore(oddsKey, chaos) {
  const odds = FATE_ODDS_BY_KEY[oddsKey] || FATE_ODDS_BY_KEY[FATE_DEFAULT_ODDS];
  const raw = odds.rank + chaosMod(chaos);
  return Math.max(FATE_LADDER_MIN, Math.min(FATE_LADDER_MAX, raw));
}

export function fateTarget(oddsKey, chaos) {
  return FATE_LADDER[String(fateScore(oddsKey, chaos))];
}

/**
 * Exceptional Yes is the low fifth of the Yes range and Exceptional No the top fifth of the
 * No range, both rounded rather than truncated [S2]. Derived, not transcribed, and checked
 * against all 81 printed cells: at a target of 1 no Exceptional Yes is possible and at 99 no
 * Exceptional No is, which is what the printed chart's "x" means. Those cases return null.
 */
export function exceptionalYes(target) {
  const v = Math.round(Number(target) / 5);
  return v >= 1 ? v : null;
}

export function exceptionalNo(target) {
  const v = 100 - Math.round((100 - Number(target)) / 5) + 1;
  return v <= 100 ? v : null;
}

/** A doubles roll whose tens digit is at or under the Chaos Factor fires an event [S3]. */
export function isRandomEventRoll(roll, chaos) {
  const n = Number(roll);
  if (!Number.isFinite(n) || n < 11 || n > 99) return false;
  const tens = Math.floor(n / 10);
  if (n % 10 !== tens) return false;
  return tens <= Math.max(CHAOS_MIN, Math.min(CHAOS_MAX, Number(chaos) || CHAOS_START));
}

export const FATE_ANSWERS = {
  exceptionalYes: "Exceptional Yes",
  yes: "Yes",
  no: "No",
  exceptionalNo: "Exceptional No"
};

/** Read a d100 against the chart. A null band is one the printed chart marks "x". */
export function fateChartAnswer(roll, oddsKey, chaos) {
  const target = fateTarget(oddsKey, chaos);
  const exYes = exceptionalYes(target);
  const exNo = exceptionalNo(target);
  const n = Number(roll);
  let answer, key;
  if (exYes !== null && n <= exYes) { answer = FATE_ANSWERS.exceptionalYes; key = "exceptionalYes"; }
  else if (n <= target) { answer = FATE_ANSWERS.yes; key = "yes"; }
  else if (exNo !== null && n >= exNo) { answer = FATE_ANSWERS.exceptionalNo; key = "exceptionalNo"; }
  else { answer = FATE_ANSWERS.no; key = "no"; }
  return {
    mechanic: "chart", roll: n, target, exYes, exNo, answer, key,
    yes: key === "yes" || key === "exceptionalYes",
    exceptional: key === "exceptionalYes" || key === "exceptionalNo",
    event: isRandomEventRoll(n, chaos)
  };
}

/** Read 2d10 against the Fate Check threshold. */
export function fateCheckAnswer(die1, die2, oddsKey, chaos) {
  const odds = FATE_ODDS_BY_KEY[oddsKey] || FATE_ODDS_BY_KEY[FATE_DEFAULT_ODDS];
  const cm = chaosMod(chaos);
  const total = Number(die1) + Number(die2) + odds.mod + cm;
  const margin = total - FATE_CHECK.threshold;
  const yes = margin >= 0;
  const exceptional = Math.abs(margin) >= FATE_CHECK.exceptionalMargin ||
    (!yes && margin <= -FATE_CHECK.exceptionalMargin);
  let key;
  if (yes) key = exceptional ? "exceptionalYes" : "yes";
  else key = exceptional ? "exceptionalNo" : "no";
  return {
    mechanic: "check", die1: Number(die1), die2: Number(die2),
    oddsMod: odds.mod, chaosMod: cm, total, threshold: FATE_CHECK.threshold,
    answer: FATE_ANSWERS[key], key, yes, exceptional,
    event: Number(die1) === Number(die2)
  };
}

/* ================================================================ T66 scenes */

export const SCENE_KINDS = {
  expected: { key: "expected", name: "Expected scene", desc: "Play the scene you had in mind." },
  altered: { key: "altered", name: "Altered scene", desc: "Something about the scene is different. Roll the Scene Adjustment table and change that one thing." },
  interrupt: { key: "interrupt", name: "Interrupt scene", desc: "Your scene does not happen. Roll a Random Event and play that instead." }
};

/**
 * Scene test: roll d10 against the Chaos Factor. Over it, the expected scene happens.
 * At or under, an odd roll alters the scene and an even roll interrupts it.
 */
export function sceneTest(d10Roll, chaos) {
  const n = Number(d10Roll);
  const cf = Math.max(CHAOS_MIN, Math.min(CHAOS_MAX, Number(chaos) || CHAOS_START));
  if (n > cf) return { ...SCENE_KINDS.expected, roll: n, chaos: cf };
  return { ...(n % 2 === 1 ? SCENE_KINDS.altered : SCENE_KINDS.interrupt), roll: n, chaos: cf };
}

/* T67 Scene Adjustment — transcribed from the printed table [S1]. A 7-10 does not adjust
 * anything itself: it tells you to make two adjustments, each rolled again on this table. */
export const SCENE_ADJUSTMENTS = [
  { max: 1,  name: "Remove A Character",        desc: "Someone you expected in this scene is not here." },
  { max: 2,  name: "Add A Character",           desc: "Someone you did not expect is here. Draw from the Characters list, or roll a new one." },
  { max: 3,  name: "Reduce/Remove An Activity", desc: "Something you expected to be happening here is smaller than expected, or is not happening at all." },
  { max: 4,  name: "Increase An Activity",      desc: "Something happening here is bigger, busier or further along than you expected." },
  { max: 5,  name: "Remove An Object",          desc: "Something you counted on being here is gone." },
  { max: 6,  name: "Add An Object",             desc: "Something unexpected is here to be used, taken or noticed." },
  { max: 10, name: "Make 2 Adjustments",        desc: "Roll twice more on this table and apply both.", double: true }
];

export const SCENE_ADJUSTMENT_DOUBLE_COUNT = 2;

export function sceneAdjustment(roll) {
  const n = Number(roll);
  for (const row of SCENE_ADJUSTMENTS) if (n <= row.max) return row;
  return SCENE_ADJUSTMENTS[SCENE_ADJUSTMENTS.length - 1];
}

/* ================================================================ T68 events */

/* Event Focus — transcribed from the printed Random Event Focus Table, which confirmed the
 * earlier reconstruction band for band [S1]. `list` marks the focuses that draw from an
 * Adventure List; `pc` marks the ones that point at the linked dossier. */
export const EVENT_FOCUS = [
  { max: 5,   key: "remote",       name: "Remote Event",             desc: "Something happens elsewhere that you learn about, or that will reach you later." },
  { max: 10,  key: "ambiguous",    name: "Ambiguous Event",          desc: "Something happens whose meaning is not clear yet. Do not explain it." },
  { max: 20,  key: "newnpc",       name: "New NPC",                  desc: "A character not yet in the adventure appears. Add them to the Characters list." },
  { max: 40,  key: "npcaction",    name: "NPC Action",               desc: "A character from the list acts, in a way the words describe.", list: "characters" },
  { max: 45,  key: "npcnegative",  name: "NPC Negative",             desc: "Something goes badly for a character on the list.", list: "characters" },
  { max: 50,  key: "npcpositive",  name: "NPC Positive",             desc: "Something goes well for a character on the list.", list: "characters" },
  { max: 55,  key: "threadtoward", name: "Move Toward A Thread",     desc: "One of your threads advances.", list: "threads" },
  { max: 65,  key: "threadaway",   name: "Move Away From A Thread",  desc: "One of your threads is set back.", list: "threads" },
  { max: 70,  key: "threadclose",  name: "Close A Thread",           desc: "One of your threads is resolved, for good or ill. Strike it off the list.", list: "threads" },
  { max: 80,  key: "pcnegative",   name: "PC Negative",              desc: "Something goes badly for the character.", pc: true },
  { max: 85,  key: "pcpositive",   name: "PC Positive",              desc: "Something goes well for the character.", pc: true },
  { max: 100, key: "context",      name: "Current Context",          desc: "Something happens in the scene as it stands, elaborating on what is already there." }
];

export function eventFocus(roll) {
  const n = Number(roll);
  for (const row of EVENT_FOCUS) if (n <= row.max) return row;
  return EVENT_FOCUS[EVENT_FOCUS.length - 1];
}

/* ================================================================ T69 lists */

export const LIST_SLOTS = 25;

/** A d100 across 25 slots: four numbers per slot, so a repeated entry comes up more often. */
export function listSlot(roll) {
  const n = Math.max(1, Math.min(100, Number(roll) || 1));
  return Math.ceil(n / 4);
}

export const LIST_RULES = {
  slots: LIST_SLOTS,
  desc: "Threads are what the character is trying to do. Characters are who matters to the adventure.",
  weighting: "Enter the same item more than once to make it come up more often. Randomising rolls d100 across 25 slots, four numbers per slot.",
  upkeep: "Add a thread when a new goal appears and strike it off when it closes. Add a character the moment they matter, and drop them when they no longer do."
};

/* ================================================================ T70 anything words */

export const ANYTHING_WORDS = t(`
  Change Continue Decrease Increase Mundane Mysterious Start Stop Strange Extra
`);

export const ANYTHING_WORD_NOTES = [
  "Change, Continue, Start and Stop shift a character's state or behaviour.",
  "Decrease, Increase and Extra modify size, quantity or intensity.",
  "Mundane grounds the result in the ordinary and expected.",
  "Mysterious injects a hidden motive or an unknown.",
  "Strange is the signal to invent something well outside expectation."
];

export const DOUBLES_NOTE =
  "Rolling the same word twice is not a wasted roll. Read it as that concept taken to an extreme.";

/* ================================================================ T71 method */

export const TABLE_BUILD_METHOD = [
  { step: 1, name: "Define the subject", desc: "Decide exactly what the table is for, and how specific it needs to be: broad descriptors, a narrow subject, or something highly specific." },
  { step: 2, name: "Brain dump", desc: "Write every word that comes to mind, cold, without editing. When the flow slows, mine your own list for synonyms and opposites." },
  { step: 3, name: "Branch out", desc: "Look outside your own head for more material so the table is not limited to your first instincts." },
  { step: 4, name: "Add neutral words", desc: "Mix in broadly applicable verbs and adjectives. They act as flexible modifiers for the targeted words." },
  { step: 5, name: "Edit down to 100", desc: "Sort alphabetically to spot duplicates, cut neutral words that clash with the setting, adjust anything too narrow or too broad, and use synonyms rather than repeats to weight an outcome." }
];

export const ONE_WORD_NOTE =
  "One word per entry, deliberately. A single word is read faster and attaches itself to the first thing that fits, where a phrase pins the result down too early.";

/* ================================================================ T72-T75 baseline tables */

/* Verbatim from the supplied report. A paraphrased word list is a different table. */

const ACTION_1 = t(`
  Abandon Accompany Activate Agree Ambush Arrive Assist Attack Attain Bargain
  Befriend Bestow Betray Block Break Carry Celebrate Change Close Combine
  Communicate Conceal Continue Control Create Deceive Decrease Defend Delay Deny
  Depart Deposit Destroy Dispute Disrupt Distrust Divide Drop Easy Energize
  Escape Expose Fail Fight Flee Free Guide Harm Heal Hinder
  Imitate Imprison Increase Indulge Inform Inquire Inspect Invade Leave Lure
  Misuse Move Neglect Observe Open Oppose Overthrow Praise Proceed Protect
  Punish Pursue Recruit Refuse Release Relinquish Repair Repulse Return Reward
  Ruin Separate Start Stop Strange Struggle Succeed Support Suppress Take
  Threaten Transform Trap Travel Triumph Truce Trust Use Usurp Waste
`);

const ACTION_2 = t(`
  Advantage Adversity Agreement Animal Attention Balance Battle Benefits Building Burden
  Bureaucracy Business Chaos Comfort Completion Conflict Cooperation Danger Defense Depletion
  Disadvantage Distraction Elements Emotion Enemy Energy Environment Expectation Exterior Extravagance
  Failure Fame Fear Freedom Friend Goal Group Health Hindrance Home
  Hope Idea Illness Illusion Individual Information Innocent Intellect Interior Investment
  Leadership Legal Location Military Misfortune Mundane Nature Needs News Normal
  Object Obscurity Official Opposition Outside Pain Path Peace People Personal
  Physical Plot Portal Possession Poverty Power Prison Project Protection Reassurance
  Representative Riches Safety Strength Success Suffering Surprise Tactic Technology Tension
  Time Trial Value Vehicle Victory Vulnerability Weapon Weather Work Wound
`);

const DESCRIPTOR_1 = t(`
  Adventurously Aggressively Anxiously Awkwardly Beautifully Bleakly Boldly Bravely Busily Calmly
  Carefully Carelessly Cautiously Ceaselessly Cheerfully Combatively Coolly Crazily Curiously Dangerously
  Defiantly Deliberately Delicately Delightfully Dimly Efficiently Emotionally Energetically Enormously Enthusiastically
  Excitedly Fearfully Ferociously Fiercely Foolishly Fortunately Frantically Freely Frighteningly Fully
  Generously Gently Gladly Gracefully Gratefully Happily Hastily Healthily Helpfully Helplessly
  Hopelessly Innocently Intensely Interestingly Irritatingly Joyfully Kindly Lazily Lightly Loosely
  Loudly Lovingly Loyally Majestically Meaningfully Mechanically Mildly Miserably Mockingly Mysteriously
  Naturally Neatly Nicely Oddly Offensively Officially Partially Passively Peacefully Perfectly
  Playfully Politely Positively Powerfully Quaintly Quarrelsomely Quietly Roughly Rudely Ruthlessly
  Slowly Softly Strangely Swiftly Threateningly Timidly Very Violently Wildly Yieldingly
`);

const DESCRIPTOR_2 = t(`
  Abnormal Amusing Artificial Average Beautiful Bizarre Boring Bright Broken Clean
  Cold Colorful Colorless Creepy Cute Damaged Dark Defeated Dirty Disagreeable
  Dry Dull Empty Enormous Extraordinary Extravagant Faded Familiar Fancy Feeble
  Feminine Festive Flawless Forlorn Fragile Fragrant Fresh Full Glorious Graceful
  Hard Harsh Healthy Heavy Historical Horrible Important Interesting Juvenile Lacking
  Large Lavish Lean Less Lethal Lively Lonely Lovely Magnificent Masculine
  Mature Messy Mighty Military Modern Mundane Mysterious Natural Normal Odd
  Old Pale Peaceful Petite Plain Poor Powerful Quaint Rare Reassuring
  Remarkable Rotten Rough Ruined Rustic Scary Shocking Simple Small Smooth
  Soft Strong Stylish Unpleasant Valuable Vibrant Warm Watery Weak Young
`);

const ELEM_LOCATIONS = t(`
  Abandoned Active Artistic Atmosphere Beautiful Bleak Bright Business Calm Charming
  Clean Cluttered Cold Colorful Colorless Confusing Cramped Creepy Crude Cute
  Damaged Dangerous Dark Delightful Dirty Domestic Empty Enclosed Enormous Entrance
  Exclusive Exposed Extravagant Familiar Fancy Festive Foreboding Fortunate Fragrant Frantic
  Frightening Full Harmful Helpful Horrible Important Impressive Inactive Intense Intriguing
  Lively Lonely Long Loud Meaningful Messy Mobile Modern Mundane Mysterious
  Natural New Occupied Odd Official Old Open Peaceful Personal Plain
  Portal Protected Protection Purposeful Quiet Reassuring Remote Resourceful Ruined Rustic
  Safe Services Simple Small Spacious Storage Strange Stylish Suspicious Tall
  Threatening Tranquil Unexpected Unpleasant Unusual Useful Warm Warning Watery Welcoming
`);

const ELEM_CHARACTERS = t(`
  Accompanied Active Aggressive Ambush Animal Anxious Armed Beautiful Bold Busy
  Calm Careless Casual Cautious Classy Colorful Combative Crazy Creepy Curious
  Dangerous Deceitful Defeated Defiant Delightful Emotional Energetic Equipped Excited Expected
  Familiar Fast Feeble Feminine Ferocious Foe Foolish Fortunate Fragrant Frantic
  Friend Frightened Frightening Generous Glad Happy Harmful Helpful Helpless Hurt
  Important Inactive Influential Innocent Intense Knowledgable Large Lonely Loud Loyal
  Masculine Mighty Miserable Multiple Mundane Mysterious Natural Odd Official Old
  Passive Peaceful Playful Powerful Professional Protected Protecting Questioning Quiet Reassuring
  Resourceful Seeking Skilled Slow Small Stealthy Strange Strong Tall Thieving
  Threatening Triumphant Unexpected Unnatural Unusual Violent Vocal Weak Wild Young
`);

/* The supplied Objects column repeats Information and Intriguing at 51-52, having already
 * used them at 49-50. Reproduced as supplied — the report is the source of record, and
 * silently editing a source table is how transcription damage gets laundered [S8]. */
const ELEM_OBJECTS = t(`
  Active Artistic Average Beautiful Bizarre Bright Clothing Clue Cold Colorful
  Communication Complicated Confusing Consumable Container Creepy Crude Cute Damaged Dangerous
  Deactivated Deliberate Delightful Desired Domestic Empty Energy Expected Expended Extravagant
  Faded Familiar Fancy Flora Fortunate Fragile Fragrant Frightening Garbage Guidance
  Hard Harmful Healing Heavy Helpful Horrible Important Inactive Information Intriguing
  Information Intriguing Large Lethal Light Liquid Loud Majestic Meaningful Mechanical
  Modern Moving Multiple Mundane Mysterious Natural New Odd Official Old
  Ornamental Ornate Personal Powerful Prized Protection Rare Ready Reassuring Resource
  Ruined Small Soft Solitary Stolen Strange Stylish Threatening Tool Travel
  Unexpected Unpleasant Unusual Useful Useless Valuable Warm Weapon Wet Worn
`);

const ADV_GENRE = t(`
  Action Adventure Agents Aliens Animals Aquatic Classic Combat Commerce Communities
  Contemporary Corporations Cosmic Cozy Crime Cybernetic Demons Derivative Dinosaurs Doomed
  Dystopian Escape Espionage Exploration Factions Fairytale Fantastical Fantasy Freedom Future
  Geographic Ghosts Gods Gothic Government Grim Gritty Heist Heroic Historical
  Horror Humorous Hybrid Invasion Investigative Law Legends Magic Martial-Arts Mecha
  Medieval Mercenary Military Monsters Mutation Mystery Nautical Occult Outlaws Parody
  Pirates Post-Apocalypse Powers Prehistoric Pulp Quest Realistic Religion Robots Rural
  Scary Scavenging School Sci-Fi Ships Small-Town Social Soldiers Space Steampunk
  Strange Subterranean Superhero Supernatural Survival Technology Thriller Time-Travel Travel Undead
  Urban Vampire Vehicles Victorian War Weird Western Wild Worlds Zombie
`);

const ADV_TONE = t(`
  Action Activity Adventurous Adversity Aggressive Amusing Anxious Attainment Average Bizarre
  Bleak Bold Busy Calm Cheerful Colorful Combative Competitive Conflict Crazy
  Creepy Dangerous Dark Emotional Energetic Epic Evil Exterior Failure Fame
  Familiar Fearful Festive Fierce Fortunate Frantic Fresh Frightening Glorious Goals
  Hard Harsh Heavy Historical Hopeful Horrible Horror Important Inquire Inspect
  Intellect Intense Interesting Intrigue Lavish Legal Lethal Light Macabre Magnificent
  Majestic Mature Meaningful Mechanical Messy Military Misfortune Mistrust Modern Mundane
  Mystery Natural Normal Odd Personal Physical Power Pursuit Quaint Random
  Rare Reassuring Remarkable Rough Rustic Scary Simple Slow Social Strange
  Strong Struggle Tension Travel Trials Vengeance Very Violent Warlike Wild
`);

/* ================================================================ T76-T78 authored tables */

/* Written for this app by the report's five-step method, for Classified's 1960s
 * intelligence context. Not extracted from anything [S6]. */

const ESP_ACTION = t(`
  Abduct Ambush Approach Arrest Assassinate Betray Blackmail Bluff Bribe Bug
  Burn Cache Compromise Conceal Confront Contact Coerce Counter Cover Cultivate
  Decode Defect Deliver Deny Destroy Detain Disarm Disguise Distract Divert
  Document Doublecross Eavesdrop Escape Escort Evade Exfiltrate Expose Extract Fabricate
  Feign Flee Follow Forge Frame Handoff Hide Hunt Impersonate Infiltrate
  Inform Interrogate Intercept Investigate Kidnap Leak Liquidate Lockpick Lure Mislead
  Monitor Negotiate Observe Obtain Photograph Plant Poison Pursue Question Recruit
  Report Rescue Retreat Retrieve Sabotage Sanction Scout Search Seduce Signal
  Silence Smuggle Steal Surveil Survive Swap Tail Threaten Trace Trap
  Vanish Verify Warn Change Continue Decrease Increase Start Stop Strange
`);

const ESP_DESCRIPTION = t(`
  Abruptly Amateurishly Anxiously Blatantly Boldly Brazenly Briskly Bureaucratically Calmly Carelessly
  Cautiously Charmingly Clandestinely Clinically Coldly Compromised Conspicuously Convincingly Coolly Crudely
  Dangerously Deceptively Deliberately Desperately Discreetly Efficiently Elegantly Erratically Expertly Faintly
  Fatally Formally Frantically Furtively Grimly Hastily Heavily Hesitantly Hurriedly Improvised
  Incompetently Indirectly Innocently Invisibly Lavishly Loudly Meticulously Nervously Obliquely Obviously
  Officially Openly Patiently Politely Precisely Professionally Publicly Quietly Recklessly Reluctantly
  Ruthlessly Secretly Silently Slowly Smoothly Sloppily Softly Suddenly Suspiciously Systematically
  Tensely Thoroughly Threateningly Unexpectedly Unofficially Urgently Violently Warily Wearily Coldbloodedly
  Bleakly Bluntly Brutally Casually Confidently Covertly Deadly Dryly Elaborately Faded
  Formal Glamorous Shabby Mundane Mysterious Strange Extra Change Increase Decrease
`);

const ESP_AGENCY = t(`
  Analyst Armourer Asset Authorisation Backstop Bagman Blackbag Briefing Budget Bureau
  Cable Cell Chief Cipher Clearance Codebook Committee Comms Contact Courier
  Cover Cryptography Cutout Deadletter Deaddrop Debriefing Defector Department Diplomat Directive
  Dossier Doubleagent Embassy Encryption Evaluation Exfiltration Expenses Fieldwork File Frequency
  Handler Headquarters Honeytrap Illegal Informant Infiltration Inquiry Instructions Interrogation Jurisdiction
  Legend Liaison Licence Logistics Mail Mandate Microdot Mission Mole Network
  Notice Oath Operation Orders Oversight Paperwork Passport Payroll Permission Photograph
  Protocol Quartermaster Recall Recruitment Registry Report Requisition Resource Rezidentura Safehouse
  Sanction Secretary Section Signal Sleeper Station Superior Surveillance Transcript Vetting
  Watchlist Wire Mundane Mysterious Strange Extra Change Continue Start Stop
`);

const ESP_ADVERSARY = t(`
  Accomplice Agent Ambitious Armed Assassin Blackmailer Bodyguard Brutal Cartel Charismatic
  Chemist Conspirator Corrupt Criminal Cruel Cultist Cunning Defector Deranged Disciplined
  Disfigured Doctor Elegant Enforcer Executive Extortionist Fanatic Financier Foreign Formidable
  Gangster General Genius Guard Henchman Hitman Hostile Ideologue Imposter Industrialist
  Informer Insider Interrogator Killer Kingpin Lieutenant Loyal Mastermind Mercenary Militant
  Muscle Networked Obsessive Officer Opportunist Organisation Paranoid Patient Patron Pilot
  Pistol Poisoner Politician Predator Professional Puppet Radical Ransom Recruiter Reptilian
  Ruthless Sadist Saboteur Scientist Scarred Secretive Sentry Sniper Soldier Specialist
  Spymaster Subordinate Surgeon Survivor Technician Terrorist Thief Traitor Tycoon Vengeful
  Wealthy Zealot Mundane Mysterious Strange Extra Change Increase Decrease Continue
`);

const ESP_LOCATION = t(`
  Airfield Alley Apartment Archive Bar Barracks Basement Bazaar Beach Border
  Bridge Bunker Cafe Canal Casino Cathedral Cellar Checkpoint Clinic Consulate
  Corridor Courtyard Customs Dam Depot Desert Dock Embassy Estate Factory
  Ferry Field Foundry Garage Garden Gate Harbour Highway Hotel Hangar
  Island Jungle Laboratory Library Lobby Lounge Market Mine Monastery Mountain
  Museum Nightclub Office Palace Park Penthouse Pier Platform Plaza Prison
  Quarry Quarter Racetrack Railway Refinery Residence Restaurant Rooftop Ruin Runway
  Safehouse Ship Shipyard Shop Slum Square Stadium Station Storeroom Street
  Studio Subway Suburb Terminal Theatre Tower Tunnel University Vault Village
  Villa Warehouse Waterfront Mundane Mysterious Strange Extra Change Occupied Abandoned
`);

const ESP_OBJECT = t(`
  Ammunition Antenna Attache Badge Bandage Battery Binoculars Blueprint Bomb Book
  Bottle Briefcase Bug Bullet Camera Canister Card Cash Cassette Chart
  Cheque Cigarette Cipher Clothing Coat Compass Contract Corpse Crate Extra
  Cyanide Detonator Diagram Diamond Diary Disguise Document Envelope Explosive Film
  Flashlight Folder Forgery Gadget Garrote Gem Glove Grenade Grapple Handcuffs
  Handgun Mundane Mysterious Holster Injector Ink Key Keycard Knife Ledger
  Lens Letter Lighter Lockpick Manifest Map Strange Medicine Microfilm Microphone
  Money Negative Newspaper Notebook Package Passport Pen Photograph Pill Poison
  Radio Receipt Recorder Ring Rope Safe Sample Silencer Suitcase Syringe
  Tape Telegram Telephone Ticket Toolkit Transmitter Uniform Vial Watch Wire
`);

const ESP_OBJECTIVE = t(`
  Acquire Apprehend Assassinate Assess Assist Blackmail Block Bug Capture Confirm
  Contact Counter Courier Decode Defect Deliver Destroy Deter Discredit Disrupt
  Divert Document Escort Establish Evacuate Evaluate Exchange Exfiltrate Expose Extract
  Find Follow Foil Guard Identify Impersonate Infiltrate Inspect Install Intercept
  Interrogate Investigate Locate Maintain Neutralise Observe Obtain Penetrate Persuade Photograph
  Plant Prevent Protect Prove Recover Recruit Remove Rescue Retrieve Return
  Sabotage Salvage Search Secure Seize Shadow Silence Smuggle Steal Substitute
  Support Survey Survive Sweep Tail Test Trace Track Transport Trap
  Uncover Undermine Verify Warn Withdraw Witness Deadline Deniability Quota Rendezvous
  Timetable Target Mundane Mysterious Strange Extra Change Continue Start Stop
`);

const ESP_COMPLICATION = t(`
  Accident Alarm Ambush Arrest Betrayal Blackout Blockade Breakdown Bribe Bystander
  Casualty Checkpoint Compromised Confusion Corpse Crowd Curfew Deadline Delay Denial
  Detour Disguise Distraction Doubleagent Doubt Duplicate Eavesdropper Emergency Error Escape
  Evacuation Evidence Exposure Failure Fire Flood Fog Forgery Guard Hostage
  Illness Impostor Informant Injury Inspection Interference Interruption Intruder Jam Journalist
  Leak Loss Loyalty Malfunction Misinformation Mistake Misunderstanding Mole Noise Obstacle
  Overheard Panic Paperwork Patrol Photograph Police Power Pursuit Ransom Recognition
  Refusal Reinforcements Rescue Rival Roadblock Rumour Sabotage Search Sentry Shortage
  Sickness Silence Storm Strike Suspicion Switch Theft Traffic Traitor Trap
  Weather Witness Mundane Mysterious Strange Extra Change Increase Decrease Stop
`);

const ESP_COVER = t(`
  Academic Accountant Actor Adviser Aid Ambassador Analyst Antiquarian Architect Artist
  Athlete Attache Author Banker Barman Broker Buyer Captain Chauffeur Chef
  Chemist Clerk Collector Consultant Contractor Correspondent Courier Critic Curator Dealer
  Dentist Diplomat Doctor Driver Editor Engineer Entertainer Executive Exporter Farmer
  Financier Fisherman Gambler Geologist Guide Heir Historian Hotelier Importer Inspector
  Instructor Interpreter Inventor Investor Jeweller Journalist Lawyer Lecturer Locksmith Mechanic
  Merchant Miner Missionary Musician Nurse Officer Painter Pharmacist Photographer Physician
  Pilot Playboy Priest Professor Publisher Racer Radioman Reporter Researcher Sailor
  Salesman Scholar Secretary Servant Singer Smuggler Steward Student Surveyor Tailor
  Teacher Technician Tourist Trader Translator Tutor Veteran Waiter Mundane Strange
`);

const ESP_INTEL = t(`
  Accurate Accusation Address Alias Allegation Ambiguous Anonymous Authentic Blueprint Bluff
  Boast Broadcast Cable Cipher Claim Clue Code Confession Confirmation Contradiction
  Coordinates Cover Date Deadline Denial Detail Diagram Disinformation Document Encrypted
  Error Evidence Exaggeration Fabrication Fact Fake File Formula Fragment Frequency
  Gossip Halftruth Hearsay Hint Identity Incomplete Inventory Itinerary Leak Ledger
  List Location Manifest Map Memo Message Microfilm Misdirection Motive Name
  Newspaper Notebook Number Obsolete Order Overheard Password Pattern Photograph Plan
  Planted Prediction Priority Proof Quantity Recording Reliable Report Rumour Schedule
  Secret Sighting Signature Source Statement Suspicion Telegram Testimony Threat Timetable
  Transcript Unverified Warning Whisper Mundane Mysterious Strange Extra Increase Decrease
`);

const ESP_CODENAME = t(`
  Anvil Arrow Ash Aurora Autumn Avalanche Badger Basilisk Beacon Bishop
  Blackbird Blizzard Bramble Bronze Cardinal Cascade Cedar Chalice Cinder Cobalt
  Cobra Comet Compass Copper Coral Cormorant Crescent Crimson Crow Crown
  Dagger Dawn Delta Diamond Domino Dragon Driftwood Eagle Ember Emerald
  Falcon Fathom Fern Flint Frost Garnet Ghost Glacier Granite Harrier
  Hawk Hemlock Hornet Ibis Iron Ivory Jackal Jade Kestrel Lantern
  Lark Lattice Leopard Lighthouse Lynx Magpie Mandrake Mantis Marble Meridian
  Mirage Monsoon Mosaic Nettle Nightjar Obsidian Onyx Orchid Osprey Owl
  Panther Pelican Pewter Pilgrim Quartz Quicksilver Raven Sable Sapphire Scorpion
  Sentinel Serpent Shadow Sparrow Spindle Talon Thistle Tundra Viper Wolf
`);

const ESP_SURVEILLANCE = t(`
  Accelerate Alley Approach Backtrack Barrier Binoculars Blend Blindspot Block Bottleneck
  Brake Bridge Camera Chase Circle Collide Conceal Corner Crash Crossing
  Crowd Curb Detour Direction Disappear Discard Distance Diversion Doorway Doubleback
  Drive Duck Escape Evade Exit Eyecontact Follow Footsteps Gap Gate
  Glance Handoff Headlights Hide Hesitate Horn Intercept Junction Ladder Lens
  Lookout Lose Mirror Motorcade Move Notice Observe Obstacle Overtake Pace
  Parked Passenger Pattern Pause Pedestrian Photograph Position Pursue Radio Railing
  Reflection Reroute Reverse Roadblock Roof Route Running Scramble Shortcut Shadow
  Signal Skid Speed Spot Stairs Stalled Station Surveillance Swerve Tail
  Traffic Tunnel Turn Vantage Vehicle Wait Watch Window Change Stop
`);

const ESP_GADGET = t(`
  Awkward Backfires Bent Bespoke Blinking Brittle Bulky Burnt Charged Cheap
  Clogged Concealed Corroded Cracked Crude Damaged Dead Delayed Dented Depleted
  Disguised Drained Dual Elegant Empty Erratic Experimental Exposed Faulty Fiddly
  Flawless Fragile Frozen Fused Heavy Hidden Hot Improvised Inaccurate Incompatible
  Intermittent Jammed Leaking Light Locked Loose Loud Lubricated Malfunctioning Marked
  Miniature Mismatched Missing Modified Mundane Mysterious Noisy Obsolete Oiled Onetime
  Overheating Overpowered Oversized Painted Patched Prototype Quiet Rattling Recharged Reliable
  Repaired Reversed Rigged Rusted Sabotaged Scratched Sealed Serialised Sharp Silent
  Slow Smoking Sparking Sticky Strange Stuck Sturdy Swapped Tangled Temperamental
  Traceable Unlabelled Unstable Untested Warm Warped Waterlogged Worn Extra Change
`);

/* --- In play: what happens at the table, in Classified's own subsystems --- */

const ESP_COMBAT = t(`
  Advance Aim Ambush Attack Beat Block Bludgeon Break Burst Charge
  Choke Club Cover Crawl Cripple Cut Dash Deflect Disarm Disengage
  Dive Dodge Draw Drop Duck Elbow Empty Engage Escape Feint
  Fire Flank Flee Grab Grapple Guard Headbutt Hesitate Hide Hold
  Hurl Immobilise Jam Kick Kneel Knife Lunge Miss Overwhelm Parry
  Pin Pistolwhip Press Pull Punch Reload Retreat Rush Scatter Seize
  Shield Shoot Shove Silence Slam Slash Sprint Stab Stagger Stalk
  Stand Stow Strangle Strike Stun Subdue Suppress Surrender Sweep Swing
  Tackle Take Target Throttle Throw Trip Twist Unload Wait Ward
  Withdraw Wound Wrestle Change Continue Increase Decrease Start Stop Strange
`);

const ESP_WOUND = t(`
  Abrasion Aching Bandaged Battered Bleeding Blinded Blistered Bloodied Bruise Burn
  Bullet Burned Concussed Concussion Contusion Crippled Crushed Cut Dazed Deaf
  Deep Disfigured Dislocated Dizzy Exhausted Faint Fatal Fever Fracture Fractured
  Gash Graze Grazed Grievous Gunshot Hairline Haemorrhage Infected Internal Laceration
  Lame Light Limping Lingering Minor Mortal Numb Old Painful Pale
  Paralysed Penetrating Poisoned Puncture Ragged Raw Recent Scab Scalded Scar
  Scarred Sedated Septic Severe Shallow Shattered Shock Sickened Sprain Stab
  Stabbed Stitched Stunned Superficial Swollen Tender Throbbing Torn Twisted Unconscious
  Untreated Weak Welt Winded Wound Bandage Blood Bone Splint Tourniquet
  Fresh Healing Mundane Mysterious Strange Extra Change Increase Decrease Stop
`);

const ESP_CHASE = t(`
  Accelerate Alley Armour Ascent Barricade Bearing Bend Blowout Boat Brake
  Bridge Bumper Bus Cargo Chase Checkpoint Cliff Collide Convoy Corner
  Crash Crossroads Curve Damage Dash Ditch Dive Dock Drift Drop
  Engine Escape Exit Ferry Fishtail Flare Fog Ford Fuel Gate
  Gears Gravel Ground Gutter Handbrake Headlights Helicopter Highway Hill Horn
  Ice Incline Intersection Jam Jump Junction Ladder Lane Launch Level
  Lorry Manoeuvre Mirror Motorcycle Mud Narrow Oil Overtake Pursuit Rail
  Ram Ramp Reverse Rooftop Roadblock Rudder Runway Skid Slalom Slick
  Speed Spin Steep Swerve Throttle Tow Traffic Train Tunnel Tyre
  Verge Wake Weave Wreck Change Increase Decrease Start Stop Strange
`);

const ESP_REACTION = t(`
  Admiring Afraid Aggressive Aloof Amused Angry Anxious Apologetic Arrogant Attentive
  Avoidant Bitter Blunt Bored Brusque Calculating Cautious Charmed Cheerful Cold
  Conciliatory Condescending Confiding Confused Contemptuous Cooperative Cordial Curious Defensive Deferential
  Defiant Delighted Dismissive Distracted Distrustful Drunk Eager Embarrassed Envious Evasive
  Excited Fawning Flattering Flirtatious Formal Friendly Frightened Furious Generous Grateful
  Greedy Grudging Guarded Guilty Helpful Hesitant Hostile Impatient Impressed Indifferent
  Indignant Insulted Interested Intimidated Jealous Loyal Mocking Nervous Neutral Nostalgic
  Obliging Obsequious Offended Officious Patronising Pitying Pleased Polite Professional Protective
  Proud Reluctant Resentful Respectful Scornful Secretive Sceptical Suspicious Sympathetic Talkative
  Threatening Warm Wary Weary Mundane Mysterious Strange Change Increase Decrease
`);

const ESP_COERCION = t(`
  Accusation Admission Alibi Ally Ambiguity Anger Bargain Beating Belief Betrayal
  Bluff Bravado Break Bribe Chains Clock Coffee Collapse Compliance Confession
  Contradiction Cooperation Cot Cuffs Deal Defiance Delay Demand Denial Deprivation
  Detail Diversion Doctor Doubt Drug Exhaustion Fabrication Family Fear File
  Flattery Friendship Guard Hood Hope Hunger Immunity Impatience Inconsistency Injection
  Interruption Isolation Lamp Leverage Lie Light Loyalty Manipulation Mercy Mistake
  Money Name Noise Oath Paperwork Patience Photograph Pity Pressure Promise
  Question Reassurance Recording Refusal Relief Repetition Resistance Rest Reversal Sedative
  Shackles Shame Silence Sleep Statement Stubbornness Sympathy Threat Time Truth
  Water Improvisation Partial Mundane Mysterious Strange Extra Continue Stop Change
`);

const ESP_SOCIAL = t(`
  Admiration Affection Anecdote Attention Attraction Ballroom Banter Bar Boast Bouquet
  Card Champagne Charm Cigarette Coincidence Compliment Confidence Conversation Dance Dinner
  Discretion Distance Drink Elegance Envy Escort Evening Excuse Eyes Favour
  Flattery Flirtation Gift Glance Gossip Guest Hand Handkerchief Hesitation Hint
  Host Humour Insult Interest Introduction Invitation Jealousy Jewellery Kindness Kiss
  Laughter Letter Lie Longing Marriage Mask Memory Message Mistake Money
  Music Name Number Offence Party Perfume Photograph Pity Promise Proposition
  Refusal Regret Rejection Reputation Reserve Rival Romance Room Rumour Scandal
  Secret Seduction Sincerity Smile Suspicion Sympathy Table Telephone Toast Touch
  Trust Vanity Whisper Wine Mundane Mysterious Strange Extra Start Stop
`);

/* --- World: the physical and institutional backdrop --- */

const ESP_WEATHER = t(`
  Afternoon Autumn Blizzard Breeze Bright Calm Chill Clear Cloudburst Clouds
  Cold Curfew Damp Dark Dawn Daybreak Deadline December Delay Downpour
  Drizzle Drought Dry Dusk Early Evening Fog Freezing Frost Gale
  Glare Gloom Gust Hail Haze Heat Holiday Hour Humid Ice
  Late Lightning Midday Midnight Minute Mist Moonless Moonlight Morning Muggy
  Night Noon Overcast Puddles Rain Rainbow Schedule Season Shadow Shower
  Sleet Slush Smog Snow Spring Squall Stars Storm Sultry Summer
  Sunday Sunrise Sunset Sunshine Sweltering Thaw Thunder Tide Timetable Tomorrow
  Tonight Twilight Warm Weekend Wet Wind Windless Winter Yesterday Sudden
  Brief Endless Mundane Mysterious Strange Extra Change Continue Increase Decrease
`);

const ESP_SENSORY = t(`
  Acrid Alarm Ammonia Antiseptic Ash Bells Bitter Bland Blood Bloom
  Blurred Bright Burning Cigar Cigarettes Citrus Clatter Clean Coffee Cologne
  Cordite Creak Damp Dazzling Diesel Dim Dust Echo Engine Fetid
  Flicker Floral Footsteps Fresh Fumes Gasoline Glare Gleam Grit Hiss
  Hollow Hum Humming Incense Iron Laughter Leather Metallic Mildew Muffled
  Murmur Music Musty Oily Perfume Polish Quiet Rain Rasp Rattle
  Ringing Rot Rough Rumble Rustle Salt Scorched Scrape Screech Sharp
  Shrill Silence Siren Slick Smoke Smooth Solvent Sour Spice Static
  Sticky Stifling Sweat Sweet Tang Thud Tobacco Varnish Voices Warm
  Whine Whisper Whistle Mundane Mysterious Strange Extra Increase Decrease Change
`);

const ESP_TERRAIN = t(`
  Arid Ash Basin Beach Bog Boulder Bramble Bush Canopy Canyon
  Cave Chasm Cliff Coast Cobbles Coral Crag Creek Crevice Current
  Dam Delta Dune Dust Escarpment Estuary Farmland Fen Field Flood
  Forest Foothills Ford Glacier Glade Gorge Grass Gravel Grove Gully
  Harbour Heath Hedge Hill Hollow Ice Island Jungle Lagoon Lake
  Levee Lowland Marsh Meadow Mesa Mire Moor Mountain Mud Oasis
  Orchard Outcrop Pass Pasture Path Peak Peninsula Pine Plain Plateau
  Pond Quarry Rapids Ravine Reef Ridge River Rock Sand Savanna
  Scrub Shoal Shore Slope Snowfield Spring Steppe Stream Summit Swamp
  Thicket Tundra Valley Vines Waterfall Woods Mundane Mysterious Strange Change
`);

const ESP_ORGANISATION = t(`
  Academy Agency Alliance Ally Ambition Archive Army Assembly Authority Bank
  Board Branch Budget Bureau Cabal Cartel Cell Chain Chairman Charter
  Client Clique Coalition Codeword Command Committee Company Conglomerate Consortium Corporation
  Council Coup Court Customs Delegation Department Directorate Discipline Division Doctrine
  Embargo Faction Feud Finance Firm Foundation Front Guild Headquarters Hierarchy
  Infighting Influence Inspectorate Institute Interests Junta Leadership League Ledger Legation
  Leverage Loyalty Mandate Merger Militia Ministry Mission Monopoly Network Office
  Order Oversight Party Patron Payroll Police Policy Politburo Press Purge
  Quota Regime Registry Reorganisation Reputation Rivalry Schism Secretariat Section Service
  Society Sponsor Staff Syndicate Treaty Union Mundane Mysterious Strange Change
`);

/* --- Story: what the adventure is doing to the character --- */

const ESP_TWIST = t(`
  Accomplice Alliance Ambush Amnesia Betrayal Blackmail Bluff Bodyguard Bomb Bribe
  Brother Casualty Coincidence Confession Conspiracy Copy Corpse Countdown Counterfeit Coup
  Cover Crossfire Deadline Deception Decoy Defection Delay Demand Denial Diversion
  Double Duplicate Escape Evidence Exchange Explosion Failure Fake Forgery Frame
  Ghost Hostage Identity Impostor Informant Inheritance Insider Interference Kidnapping Leak
  Lie Loyalty Mistake Mole Motive Murder Nobody Order Partner Payment
  Photograph Plant Poison Promotion Ransom Recording Recruitment Relative Rescue Resurrection
  Reversal Rival Sabotage Sacrifice Scapegoat Secret Sibling Silence Substitution Suicide
  Superior Survivor Switch Target Testimony Theft Trap Treason Truce Truth
  Twin Ultimatum Vengeance Warning Witness Mundane Mysterious Strange Change Stop
`);

const ESP_SCENE = t(`
  Aftermath Ambush Approach Arrival Arrest Assembly Bargain Blackout Border Break
  Briefing Cache Capture Celebration Chase Checkpoint Confrontation Contact Conversation Crossing
  Debriefing Delivery Departure Discovery Disguise Dispute Escape Escort Exchange Exfiltration
  Fight Flight Funeral Handover Hunt Infiltration Inspection Interception Interrogation Interview
  Introduction Investigation Journey Loss Meeting Message Negotiation Observation Party Pause
  Photography Planning Pursuit Quarrel Raid Reconnaissance Recovery Recruitment Rendezvous Repair
  Report Rescue Rest Retreat Return Reunion Reversal Robbery Sabotage Search
  Setback Shadowing Signal Smuggling Standoff Stakeout Stalemate Surgery Surveillance Survival
  Tail Theft Threat Trade Trail Training Transit Trap Trial Waiting
  Warning Watch Wait Withdrawal Mundane Mysterious Strange Start Stop Continue
`);

const ESP_MOTIVE = t(`
  Addiction Advancement Affair Ambition Anger Atonement Belief Betrayal Bitterness Blackmail
  Boredom Cause Charity Comfort Compulsion Conscience Conviction Cowardice Curiosity Debt
  Deceit Delusion Desire Despair Devotion Disgrace Doubt Duty Envy Escape
  Faith Family Fanaticism Fear Freedom Friendship Gambling Glory Grief Grudge
  Guilt Habit Hatred Heritage Honour Hope Ideology Illness Indifference Inheritance
  Jealousy Justice Legacy Loneliness Love Loyalty Lust Malice Money Nationalism
  Nostalgia Oath Obligation Obsession Orders Pain Paranoia Patriotism Pity Pride
  Principle Profit Promise Protection Rage Rebellion Redemption Regret Rejection Religion
  Remorse Reputation Resentment Revenge Rivalry Safety Secrecy Shame Spite Status
  Survival Vanity Weakness Mundane Mysterious Strange Extra Change Increase Decrease
`);

const ESP_LEVERAGE = t(`
  Account Advance Allowance Arrears Asset Auction Audit Bank Banknote Bearer
  Bill Blackmail Bond Bonus Bribe Bullion Cash Certificate Cheque Coin
  Collateral Commission Contract Counterfeit Coupon Courier Credit Currency Debt Deed
  Deposit Diamond Discount Dividend Donation Dowry Embezzlement Escrow Estate Exchange
  Expenses Extortion Favour Fee Fine Forgery Fortune Fraud Fund Gambling
  Gift Gold Guarantee Hush Inheritance Insurance Interest Inventory Invoice Jewels
  Kickback Laundering Lease Ledger Lien Loan Loss Markup Mortgage Note
  Payment Payoff Pension Percentage Premium Price Profit Property Purse Ransom
  Receipt Reward Salary Savings Scheme Securities Settlement Shares Smuggling Stipend
  Surety Tax Theft Transfer Trust Vault Wager Wealth Mundane Strange
`);

const ESP_CONSEQUENCE = t(`
  Absence Accusation Aftermath Alarm Alliance Anger Apology Arrest Ashes Blame
  Bloodstain Body Bureaucracy Casualty Censure Chaos Charge Cleanup Closure Compensation
  Complaint Confession Consequence Cost Coverup Crackdown Credit Crowd Damage Debriefing
  Debt Defeat Delay Demotion Denial Discipline Disgrace Doubt Escalation Escape
  Evacuation Evidence Exile Exposure Failure Fallout Fame Fine Funeral Grief
  Guilt Headline Hearing Hospital Hostility Inquiry Investigation Isolation Journalist Loss
  Loyalty Medal Memorial Mistrust Notoriety Obituary Panic Paperwork Pardon Payment
  Penalty Pension Police Praise Precaution Promotion Prosecution Protest Purge Recall
  Recovery Reform Relief Reorganisation Reprimand Reputation Rescue Retaliation Retirement Revenge
  Reward Rumour Ruins Scandal Silence Survivor Suspicion Vengeance Mundane Change
`);

/* ================================================================ the table index */

/**
 * Every Meaning Table. `pairWith` names the table the second word of a pair comes from;
 * without it, a pair rolls twice on the same table, which is how Mythic treats the
 * Elements tables.
 */
export const MEANING_TABLES = [
  // Baseline, from the supplied report.
  { key: "action1", name: "Action 1", group: "Baseline", subject: "Verbs and subjects — the first half of an action pair", source: "mm38", pairWith: "action2", words: ACTION_1 },
  { key: "action2", name: "Action 2", group: "Baseline", subject: "Subjects and themes — the second half of an action pair", source: "mm38", words: ACTION_2 },
  { key: "descriptor1", name: "Descriptor 1", group: "Baseline", subject: "Adverbs — how something is done", source: "mm38", pairWith: "descriptor2", words: DESCRIPTOR_1 },
  { key: "descriptor2", name: "Descriptor 2", group: "Baseline", subject: "Adjectives — what something is like", source: "mm38", words: DESCRIPTOR_2 },
  { key: "locations", name: "Elements — Locations", group: "Baseline", subject: "What a place is like", source: "mm38", words: ELEM_LOCATIONS },
  { key: "characters", name: "Elements — Characters", group: "Baseline", subject: "What a person is like", source: "mm38", words: ELEM_CHARACTERS },
  { key: "objects", name: "Elements — Objects", group: "Baseline", subject: "What a thing is like", source: "mm38", words: ELEM_OBJECTS },
  { key: "genre", name: "Genre", group: "Baseline", subject: "Adventure generation — what kind of story", source: "mm38", pairWith: "tone", words: ADV_GENRE },
  { key: "tone", name: "Tone", group: "Baseline", subject: "Adventure generation — how the story feels", source: "mm38", words: ADV_TONE },

  // Authored for Classified.
  { key: "espAction", name: "Espionage Action", group: "Espionage", subject: "What an operative or an opponent does", authored: true, pairWith: "espDescription", words: ESP_ACTION },
  { key: "espDescription", name: "Espionage Description", group: "Espionage", subject: "How it is done, and what it is like — adverbs and adjectives together", authored: true, words: ESP_DESCRIPTION },
  { key: "espAgency", name: "Agency & Tradecraft", group: "Espionage", subject: "The apparatus around the mission: people, paperwork, procedure", authored: true, words: ESP_AGENCY },
  { key: "espAdversary", name: "Adversary", group: "Espionage", subject: "Who is on the other side, and what they are like", authored: true, words: ESP_ADVERSARY },
  { key: "espLocation", name: "Location", group: "Espionage", subject: "Where a scene happens in a 1960s world", authored: true, words: ESP_LOCATION },
  { key: "espObject", name: "Object & Equipment", group: "Espionage", subject: "What is on the table, in the case, or in the pocket", authored: true, words: ESP_OBJECT },

  { key: "espObjective", name: "Mission Objective", group: "Mission", subject: "What the mission actually asks for", authored: true, words: ESP_OBJECTIVE },
  { key: "espComplication", name: "Complication", group: "Mission", subject: "What goes wrong, or gets in the way", authored: true, words: ESP_COMPLICATION },
  { key: "espCover", name: "Cover Identity", group: "Mission", subject: "Who you are pretending to be, or who someone else claims to be", authored: true, words: ESP_COVER },
  { key: "espIntel", name: "Intel & Rumour", group: "Mission", subject: "What is learned, and how far it can be trusted", authored: true, words: ESP_INTEL },

  { key: "espCodename", name: "Codename Words", group: "Flavour", subject: "Operation and asset codenames — roll two and join them", authored: true, words: ESP_CODENAME },
  { key: "espSurveillance", name: "Surveillance & Chase", group: "Flavour", subject: "Watching, being watched, following and losing a tail", authored: true, words: ESP_SURVEILLANCE },
  { key: "espGadget", name: "Gadget Quirk", group: "Flavour", subject: "The state a piece of equipment turns out to be in", authored: true, words: ESP_GADGET },

  { key: "espCombat", name: "Combat Action", group: "In play", subject: "What a body does in a fight, armed or otherwise", authored: true, pairWith: "espDescription", words: ESP_COMBAT },
  { key: "espWound", name: "Wound & Injury", group: "In play", subject: "What the damage looks like, and what state it is in", authored: true, words: ESP_WOUND },
  { key: "espChase", name: "Vehicle & Chase", group: "In play", subject: "Roads, water, air, and what the vehicle meets on them", authored: true, words: ESP_CHASE },
  { key: "espReaction", name: "Reaction & Attitude", group: "In play", subject: "How an NPC takes you — for a Reaction roll you would rather interpret than tabulate", authored: true, words: ESP_REACTION },
  { key: "espCoercion", name: "Coercion & Pressure", group: "In play", subject: "The furniture of an interrogation: what is applied, and what gives", authored: true, words: ESP_COERCION },
  { key: "espSocial", name: "Social & Seduction", group: "In play", subject: "Parties, charm, and what passes between two people", authored: true, words: ESP_SOCIAL },

  { key: "espWeather", name: "Weather & Time", group: "World", subject: "When the scene happens and what the sky is doing", authored: true, words: ESP_WEATHER },
  { key: "espSensory", name: "Sensory Detail", group: "World", subject: "What the place smells, sounds and looks like", authored: true, words: ESP_SENSORY },
  { key: "espTerrain", name: "Terrain & Environment", group: "World", subject: "The ground itself, for anything outside a city", authored: true, words: ESP_TERRAIN },
  { key: "espOrganisation", name: "Organisation & Faction", group: "World", subject: "Institutions, their machinery and their politics", authored: true, words: ESP_ORGANISATION },

  { key: "espTwist", name: "Mission Twist", group: "Story", subject: "The thing the mission turns out to really be about", authored: true, words: ESP_TWIST },
  { key: "espScene", name: "Scene Framing", group: "Story", subject: "What kind of scene this is — useful for an interrupt", authored: true, pairWith: "espLocation", words: ESP_SCENE },
  { key: "espMotive", name: "Motive & Secret", group: "Story", subject: "Why someone is really doing this, and what they are hiding", authored: true, words: ESP_MOTIVE },
  { key: "espLeverage", name: "Leverage & Money", group: "Story", subject: "Money, debt and whatever holds someone in place", authored: true, words: ESP_LEVERAGE },
  { key: "espConsequence", name: "Consequence & Aftermath", group: "Story", subject: "What is left once the shooting stops", authored: true, words: ESP_CONSEQUENCE }
];

export const MEANING_BY_KEY = Object.fromEntries(MEANING_TABLES.map(m => [m.key, m]));

/** The table a Random Event's colour words come from by default. */
export const EVENT_MEANING_DEFAULT = "espAction";

/** Which table best fits each Event Focus, so the event roller can suggest one. */
export const EVENT_MEANING_BY_FOCUS = {
  remote: "espConsequence",
  ambiguous: "espSensory",
  newnpc: "espAdversary",
  npcaction: "espAction",
  npcnegative: "espComplication",
  npcpositive: "espAction",
  threadtoward: "espObjective",
  threadaway: "espComplication",
  threadclose: "espTwist",
  pcnegative: "espComplication",
  pcpositive: "espAction",
  context: "espScene"
};

/* ================================================================ T79 topics */

export const SOLO_TOPICS = [
  {
    key: "fate",
    title: "Asking Fate a question",
    source: "Mythic GME",
    body: [
      "Frame a question the fiction cannot already answer, and one that a Yes or a No actually settles. Pick the odds you would give it if a game master were sitting opposite you.",
      "The app reads the odds against the current Chaos Factor and rolls. The low fifth of the Yes range is an Exceptional Yes — more than you asked for. The top fifth of the No range is an Exceptional No — worse than a simple refusal.",
      "The Fate Chart and the Fate Check are two ways of reading roughly the same probability. The chart rolls d100 under a printed target; the check rolls 2d10 and adds the odds and chaos modifiers against 11. Pick one per adventure and stay with it — the chart is the one this app reproduces from the printing."
    ]
  },
  {
    key: "chaos",
    title: "The Chaos Factor",
    source: "Mythic GME",
    body: [
      "Chaos runs 1 to 9 and starts at 5. It is the single dial that says how far events have run away from the character.",
      "At the end of a scene, ask whether the character was in control of how it went. If they were, lower the Chaos Factor by one. If they were not, raise it by one.",
      "A high Chaos Factor makes Yes answers more likely, fires Random Events more often, and makes your planned scene more likely to be altered or interrupted. A low one hands the reins back."
    ]
  },
  {
    key: "scenes",
    title: "Starting a scene",
    source: "Mythic GME",
    body: [
      "Say what you expect the next scene to be, then test it: roll d10 against the Chaos Factor. Over it, your expected scene happens as you imagined.",
      "At or under the Chaos Factor, an odd roll means the scene is altered — roll the Scene Adjustment table and change that one thing. An even roll means the scene is interrupted: your scene does not happen, and a Random Event happens instead.",
      "An interrupt is not a punishment. It is the emulator doing the job a game master would do by refusing to let you script the evening."
    ]
  },
  {
    key: "events",
    title: "Random Events",
    source: "Mythic GME",
    body: [
      "An event fires when the Fate Chart roll is a double whose tens digit is at or under the Chaos Factor, or when a Fate Check's dice match. It happens as well as the answer, not instead of it.",
      "Roll the Event Focus table for what the event is about, then roll a word pair from a Meaning Table to colour it. Focuses that name a thread or a character draw from your Adventure Lists.",
      "Interpret loosely and quickly. The words are a prompt, not a puzzle with one right answer."
    ]
  },
  {
    key: "lists",
    title: "Threads and Characters",
    source: "Mythic GME",
    body: [
      "Keep two lists of 25 slots: Threads, which is everything the character is trying to do, and Characters, which is everyone who matters.",
      "Enter an item more than once to weight it. Randomising a list rolls d100 across the 25 slots, four numbers to a slot, so a thread entered three times comes up three times as often.",
      "Add a thread the moment a new goal appears and strike it off when it closes. The lists are what stop a solo adventure from wandering."
    ]
  },
  {
    key: "meaning",
    title: "Meaning Tables and building your own",
    source: "Mythic Magazine Vol. 38",
    body: [
      "A Meaning Table answers open questions the way Fate answers closed ones. Roll a word pair and read the first thing that fits the situation in front of you.",
      "One word per entry is deliberate: a single word is read faster and attaches itself to context, where a phrase pins the answer down before you have thought about it.",
      "Rolling the same word twice is amplification, not a wasted roll — take the concept to an extreme.",
      "The ten Anything Words — Change, Continue, Decrease, Increase, Mundane, Mysterious, Start, Stop, Strange, Extra — are seeded through these tables on purpose. Mundane grounds a result; Strange is the signal to invent something well outside expectation.",
      "To build your own: define the subject, brain-dump cold, look outside your own head, mix in neutral words as modifiers, then edit to 100 — cutting anything that clashes with the setting and using synonyms rather than repeats to weight an outcome."
    ]
  },
  {
    key: "twosystems",
    title: "Mythic and Classified side by side",
    source: "This app",
    body: [
      "The solo engine never replaces a Classified roll. Fate answers questions about the world; skills, combat and damage stay on Base Chance × Difficulty Factor as always.",
      "So a scene runs: ask Fate whether the guard is where you feared, then roll Stealth against him the ordinary way.",
      "Hero Points are untouched by the solo engine. Neither book connects them to an oracle, so the app does not invent a link.",
      "The Fate Chart, the Event Focus table and the Scene Adjustment table are transcribed from the printed originals. The Fate Check's modifiers are not — they are the app's own arithmetic, so the chart is the mechanic to trust if a close call matters."
    ]
  }
];
