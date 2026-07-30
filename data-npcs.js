/* Classified — NPCs [Chapter Twelve, Chapter Thirteen].
 * NPC stereotypes with their random generation tables, the OSIRIS antagonist roster,
 * and the Hot/Cold random encounter system.
 * Biographies are compressed paraphrases; no rulebook prose is reproduced.
 */

/* ---------------------------------------------------------------- STEREOTYPES */

export const NPC_STEREOTYPES = [
  { key:"civilian", name:"Civilian", rookieMod:-3, villainMod:0,
    desc:"Everyone who is not one of the other stereotypes. Sometimes very much involved in the covert world." },
  { key:"contact", name:"Contact", rookieMod:-3, villainMod:3, usesTable:"covert",
    desc:"Has useful information and sometimes real power. Built from another stereotype plus knowledge or access." },
  { key:"covert", name:"Covert Operative", rookieMod:-3, villainMod:3,
    desc:"In the trade. May be friendly, indifferent, ambivalent or hostile." },
  { key:"foil", name:"Foil", rookieMod:-4, villainMod:0,
    desc:"Between civilian and operative; often out of their depth and a prime target for seduction." },
  { key:"henchman", name:"Henchman", rookieMod:-5, villainMod:5,
    desc:"The primary opponent's trusted right hand. Nearly impossible to turn; usually removed by violence." },
  { key:"opponent", name:"Primary Opponent", rookieMod:null, villainMod:4,
    desc:"The villainous mastermind. Calculating, egotistical, and prefers capture to killing until provoked." },
  { key:"security", name:"Security", rookieMod:-4, villainMod:4,
    desc:"Guards, soldiers and law enforcement. Exists to make a guns-blazing approach unworkable." },
  { key:"technician", name:"Technician", rookieMod:-3, villainMod:0,
    desc:"Specialised knowledge: scientists, engineers, sometimes religious figures." }
];

/* Characteristic tables, rolled 1d10 [Ch.12] */
export const NPC_CHARACTERISTIC_TABLES = {
  civilian: [
    { str:8, dex:7, wil:9, per:7, int:8 }, { str:7, dex:6, wil:8, per:6, int:7 },
    { str:6, dex:5, wil:6, per:7, int:7 }, { str:6, dex:5, wil:7, per:5, int:6 },
    { str:6, dex:6, wil:5, per:4, int:6 }, { str:5, dex:6, wil:4, per:7, int:5 },
    { str:6, dex:5, wil:5, per:6, int:5 }, { str:6, dex:6, wil:5, per:5, int:7 },
    { str:5, dex:5, wil:5, per:5, int:6 }, { str:7, dex:7, wil:6, per:6, int:6 }
  ],
  covert: [
    { str:9, dex:11, wil:9, per:9, int:10 }, { str:9, dex:8, wil:9, per:12, int:8 },
    { str:10, dex:9, wil:9, per:10, int:9 }, { str:9, dex:10, wil:11, per:9, int:9 },
    { str:10, dex:10, wil:9, per:9, int:8 }, { str:10, dex:9, wil:9, per:9, int:10 },
    { str:10, dex:11, wil:8, per:9, int:9 }, { str:9, dex:10, wil:9, per:10, int:8 },
    { str:11, dex:9, wil:10, per:9, int:9 }, { str:9, dex:10, wil:9, per:10, int:11 }
  ],
  foil: [
    { str:7, dex:6, wil:8, per:8, int:9 }, { str:6, dex:8, wil:7, per:6, int:7 },
    { str:6, dex:8, wil:8, per:9, int:10 }, { str:8, dex:9, wil:7, per:6, int:7 },
    { str:7, dex:6, wil:6, per:7, int:8 }, { str:9, dex:7, wil:7, per:8, int:6 },
    { str:8, dex:7, wil:7, per:8, int:6 }, { str:6, dex:7, wil:8, per:7, int:6 },
    { str:7, dex:7, wil:7, per:9, int:7 }, { str:9, dex:9, wil:8, per:8, int:6 }
  ],
  henchman: [
    { str:9, dex:10, wil:6, per:8, int:8 }, { str:10, dex:7, wil:10, per:7, int:6 },
    { str:6, dex:7, wil:8, per:7, int:7 }, { str:10, dex:9, wil:8, per:7, int:6 },
    { str:10, dex:6, wil:7, per:6, int:6 }, { str:9, dex:8, wil:9, per:6, int:6 },
    { str:9, dex:8, wil:7, per:6, int:10 }, { str:6, dex:10, wil:10, per:10, int:6 },
    { str:7, dex:10, wil:7, per:10, int:7 }, { str:7, dex:8, wil:9, per:10, int:8 }
  ],
  opponent: [
    { str:4, dex:11, wil:11, per:10, int:9 }, { str:5, dex:8, wil:10, per:9, int:9 },
    { str:11, dex:3, wil:4, per:11, int:11 }, { str:7, dex:8, wil:8, per:11, int:11 },
    { str:8, dex:7, wil:11, per:5, int:8 }, { str:5, dex:7, wil:8, per:8, int:10 },
    { str:9, dex:7, wil:9, per:7, int:9 }, { str:6, dex:7, wil:7, per:10, int:11 },
    { str:6, dex:7, wil:9, per:10, int:10 }, { str:5, dex:6, wil:10, per:9, int:11 }
  ],
  security: [
    { str:11, dex:11, wil:8, per:9, int:7 }, { str:8, dex:9, wil:9, per:8, int:8 },
    { str:8, dex:9, wil:9, per:8, int:8 }, { str:9, dex:10, wil:7, per:10, int:9 },
    { str:10, dex:9, wil:9, per:10, int:8 }, { str:9, dex:9, wil:9, per:11, int:6 },
    { str:9, dex:8, wil:8, per:9, int:9 }, { str:10, dex:8, wil:8, per:9, int:8 },
    { str:11, dex:10, wil:9, per:8, int:9 }, { str:10, dex:10, wil:9, per:8, int:7 }
  ],
  technician: [
    { str:5, dex:9, wil:6, per:9, int:10 }, { str:5, dex:9, wil:6, per:9, int:8 },
    { str:6, dex:10, wil:5, per:6, int:8 }, { str:7, dex:8, wil:6, per:7, int:12 },
    { str:7, dex:9, wil:6, per:7, int:10 }, { str:6, dex:10, wil:5, per:8, int:11 },
    { str:6, dex:8, wil:7, per:8, int:14 }, { str:6, dex:11, wil:7, per:6, int:9 },
    { str:5, dex:12, wil:6, per:7, int:9 }, { str:6, dex:11, wil:7, per:8, int:9 }
  ]
};

/* Skill packages, rolled 1d10 [Ch.12]. Keys match SKILLS in data.js. */
export const NPC_SKILL_TABLES = {
  civilian: [
    { driving:2, firecombat:1, language:6 },
    { boating:1, diving:3, language:11 },
    { driving:2, electronics:1, language:20, science:3 },
    { charisma:3, driving:1 },
    { gambling:2, language:15, riding:4 },
    { driving:3, evasion:1 },
    { boating:5, evasion:1, pickpocket:3 },
    { boating:5, driving:5 },
    { driving:3, language:7, piloting:4 },
    { charisma:4, driving:1, firecombat:4, handtohand:3 }
  ],
  covert: [
    { boating:10, charisma:4, disguise:1, driving:10, firecombat:12, gambling:10, handtohand:12, interrogation:8, localcustoms:1, piloting:10, sixthsense:9, stealth:10 },
    { charisma:3, cryptography:9, demolitions:12, driving:3, electronics:10, firecombat:12, handtohand:5, language:15, science:10 },
    { boating:2, charisma:5, driving:12, evasion:7, firecombat:7, gambling:2, handtohand:4, localcustoms:5, lockpicking:5, pickpocket:4, seduction:4 },
    { charisma:4, disguise:6, diving:5, driving:4, electronics:4, firecombat:10, handtohand:5, language:11, science:5, seduction:6, stealth:4 },
    { charisma:4, cryptography:5, demolitions:5, driving:6, firecombat:5, gambling:4, handtohand:7, interrogation:6, pickpocket:8, piloting:4, sixthsense:5 },
    { charisma:9, cryptography:5, demolitions:5, driving:5, firecombat:6, gambling:3, handtohand:6, language:15, piloting:4, sixthsense:5 },
    { charisma:4, cryptography:6, demolitions:5, disguise:6, driving:10, electronics:7, firecombat:6, handtohand:4, localcustoms:6, seduction:10, sixthsense:5, stealth:9 },
    { charisma:5, cryptography:7, driving:4, evasion:7, firecombat:8, gambling:5, handtohand:6, language:6, lockpicking:5, riding:5, science:6, seduction:7 },
    { charisma:6, driving:10, firecombat:6, handtohand:5, language:15, localcustoms:9, mountaineering:5, piloting:6, seduction:4 },
    { charisma:4, cryptography:6, demolitions:8, disguise:7, driving:9, electronics:8, firecombat:10, handtohand:12, interrogation:10, lockpicking:10 }
  ],
  foil: [
    { driving:6, evasion:4, firecombat:1, language:11 },
    { boating:5, diving:4, driving:5, localcustoms:5 },
    { boating:4, driving:10, gambling:4, language:8, piloting:6 },
    { driving:6, firecombat:2, gambling:2, handtohand:1 },
    { driving:5, firecombat:3, mountaineering:2, science:1 },
    { boating:4, diving:4, driving:7, seduction:4 },
    { charisma:8, driving:8, language:18, localcustoms:9, piloting:7 },
    { driving:7, gambling:8, localcustoms:8, riding:9 },
    { charisma:6, driving:6, handtohand:6, seduction:5 },
    { charisma:9, driving:5, gambling:8, language:8, seduction:8 }
  ],
  henchman: [
    { boating:10, driving:10, evasion:10, firecombat:2, handtohand:5, language:13, piloting:5 },
    { charisma:2, disguise:7, driving:6, electronics:5, handtohand:10, interrogation:5, language:9, torture:10 },
    { diving:8, driving:3, handtohand:9, mountaineering:5, sixthsense:8 },
    { disguise:5, driving:5, firecombat:6, handtohand:6, lockpicking:5 },
    { boating:2, driving:5, firecombat:8, handtohand:7, piloting:3 },
    { charisma:4, driving:7, firecombat:4, handtohand:9, interrogation:8, pickpocket:5 },
    { disguise:10, driving:5, firecombat:6, handtohand:5, language:17, piloting:10 },
    { driving:7, firecombat:10, handtohand:5, interrogation:6, sixthsense:7 },
    { driving:4, firecombat:3, gambling:4, handtohand:10, torture:7 },
    { demolitions:10, driving:8, firecombat:7, handtohand:9, language:7, stealth:6 }
  ],
  opponent: [
    { demolitions:9, driving:5, firecombat:4, language:8, localcustoms:5, lockpicking:6, piloting:11, science:11 },
    { boating:11, charisma:6, driving:11, electronics:9, firecombat:8, riding:7, science:11, seduction:5, sixthsense:6 },
    { demolitions:11, diving:5, driving:10, gambling:11, handtohand:5, language:20, pickpocket:6, riding:6, science:11 },
    { boating:3, charisma:1, electronics:4, evasion:10, handtohand:5, lockpicking:10, torture:11 },
    { charisma:11, demolitions:4, disguise:11, driving:2, electronics:11, firecombat:4, gambling:5, language:11, science:11 },
    { charisma:11, electronics:11, handtohand:4, interrogation:5, mountaineering:3, piloting:4, science:6, seduction:4 },
    { charisma:11, cryptography:3, demolitions:4, driving:3, electronics:5, firecombat:3, handtohand:4, language:8, science:8 },
    { charisma:4, disguise:11, driving:5, firecombat:3, handtohand:5, localcustoms:5, mountaineering:5, science:11 },
    { charisma:5, cryptography:11, diving:6, electronics:8, evasion:4, firecombat:6, gambling:4, language:15, sixthsense:8 },
    { charisma:11, disguise:6, electronics:11, handtohand:5, interrogation:6, language:9, piloting:10, science:9, torture:8 }
  ],
  security: [
    { driving:1, firecombat:2, handtohand:4, interrogation:1 },
    { driving:1, evasion:1, firecombat:3, handtohand:4 },
    { driving:6, firecombat:8, handtohand:10, stealth:3 },
    { driving:6, evasion:5, firecombat:4, handtohand:4 },
    { driving:5, evasion:2, firecombat:4, handtohand:4, interrogation:2 },
    { driving:3, firecombat:10, handtohand:3, riding:3 },
    { driving:4, firecombat:6, handtohand:7, stealth:6 },
    { driving:3, firecombat:7, handtohand:3, piloting:2 },
    { boating:3, driving:4, firecombat:5, handtohand:4 },
    { driving:1, evasion:4, firecombat:5, handtohand:7 }
  ],
  technician: [
    { interrogation:2, torture:14 },
    { interrogation:14, language:12, torture:1 },
    { electronics:10, piloting:3 },
    { firecombat:1, language:15, science:13 },
    { cryptography:14, driving:3 },
    { disguise:14, language:20, science:2 },
    { gambling:13, electronics:3 },
    { driving:4, lockpicking:12 },
    { handtohand:1, language:3, torture:15 },
    { demolitions:10, firecombat:1 }
  ]
};

/* Hero/Villain points and Reputation by NPC rank [Ch.12] */
export const NPC_POINTS = {
  rookie: { base: 0, dice: 10, offset: -4, label: "1d10-4" },
  agent: { base: 4, dice: 10, offset: -5, label: "4 + (1d10-5)" },
  special: { base: 9, dice: 10, offset: -5, label: "9 + (1d10-5)" }
};
export const NPC_REPUTATION = {
  rookie: { base: 29, dice: 3, sides: 10, offset: -10, label: "29 + (3d10-10)" },
  agent: { base: 81, dice: 4, sides: 10, offset: -10, label: "81 + (4d10-10)" },
  special: { base: 136, dice: 4, sides: 10, offset: -10, label: "136 + (4d10-10)" }
};
export const NPC_REPUTATION_BEAUTY_BONUS = 20; // Stunning or Gorgeous

export const NPC_CREATION_STEPS = [
  "Assign stereotype and rank.",
  "Roll or choose characteristics and skills.",
  "Roll Hero or Villain Points.",
  "Assign physical traits that match the characteristics.",
  "Assign equipment.",
  "Roll Reputation.",
  "Assign weaknesses (rarely more than one).",
  "Assign abilities and Fields of Experience if they matter in play.",
  "Assign Interaction Modifiers for Reaction, Persuasion, Seduction, Interrogation and Torture.",
  "Assign idiosyncrasies to make them memorable."
];
export const INTERACTION_MODIFIER_NOTE =
  "Interaction Modifiers apply as Difficulty Factor Modifiers when a player character uses that skill ON the NPC. " +
  "An NPC with +4 Interrogation is easy to interrogate; it does not make them a better interrogator.";

/* ---------------------------------------------------------------- OSIRIS */

export const OSIRIS_OVERVIEW = {
  name: "OSIRIS",
  goal: "Dismantle the nation-state and restore rule by the nobility. Every member of the Imperial Court holds noble blood.",
  departments: [
    { key:"planning", name:"Planning", ruler:"The Emperor, Duke Lothar Tristan Eugen Wolf",
      desc:"Vets and approves every major operation from every other department. Its tradecraft is why no major agency knows OSIRIS exists." },
    { key:"information", name:"Information", ruler:"The King of Whispers, Losang Tenzin",
      desc:"Second only to Planning. Runs moles inside major intelligence agencies and large corporations." },
    { key:"influence", name:"Influence", ruler:"The King of Power, Dr. Iskandar Kamari",
      desc:"Non-violent persuasive operations; determines what leverage will work on whom." },
    { key:"assassination", name:"Assassination", ruler:"The Queen of Death, Anna Elisabeth Munro",
      desc:"Called only when all else fails. Kills are disguised as accidents unless a message is intended." },
    { key:"military", name:"Military Affairs", ruler:"The King of War, Vasily Stanislavovich Orlov",
      desc:"Coordinates true military operations and is consulted on anything needing five or more people." },
    { key:"criminal", name:"Criminal Wealth", ruler:"The Queen of the Underground, Flavia Durand de la Penne",
      desc:"Roughly a quarter of operating revenue: narcotics, extortion, counterfeiting, fraud and laundering. No human trafficking." },
    { key:"legal", name:"Legal Wealth", ruler:"The King of Business, Oda Nagatoshi",
      desc:"Legally owned holdings on every populated continent, arranged into eight geographic regions." }
  ]
};

export const OSIRIS_NPCS = [
  {
    key:"wolf", name:"Lothar Tristan Eugen Wolf", title:"The Emperor — Planning",
    rank:"special", rankLabel:"Villain",
    str:7, dex:11, wil:14, per:14, int:15,
    skills:{ boating:{r:12,b:20}, charisma:{r:14,b:30}, cryptography:{r:15,b:26}, demolitions:{r:15,b:20},
      disguise:{r:15,b:27}, diving:{r:9,b:18}, driving:{r:12,b:24}, electronics:{r:15,b:26}, evasion:{r:9,b:18},
      firecombat:{r:9,b:20}, gambling:{r:14,b:22}, handtohand:{r:7,b:16}, interrogation:{r:15,b:30},
      localcustoms:{r:14,b:22}, lockpicking:{r:11,b:20}, mountaineering:{r:10,b:10}, pickpocket:{r:11,b:20},
      piloting:{r:12,b:18}, riding:{r:14,b:18}, science:{r:15,b:21}, seduction:{r:14,b:28}, sixthsense:{r:14,b:30},
      stealth:{r:14,b:28}, torture:{r:14,b:23} },
    abilities:["Connoisseur","First Aid","German","Russian"],
    languages:[{name:"English",rank:15,base:30},{name:"French",rank:15,base:30}],
    height:"5'10\"", weight:"185 lbs", age:64, appearance:"Normal",
    reputation:45, points:11, speed:3, hthDamage:"A", stamina:33, runSwim:55, carrying:"101-150 lbs",
    weapon:"Walther P99",
    foe:["Board Games","Computers","Economics/Business","Fine Arts","Forensics","History","International Law","Linguistics","Mechanical Engineering","Military Science","Philosophy","Political Science","Wargaming"],
    weaknesses:[],
    idiosyncrasies:"Speaks quietly and deliberately. Tends to hold his chin with his left hand.",
    interaction:{ reaction:-2, persuasion:-4, seduction:-3, interrogation:-4, torture:-3 },
    description:"An average-looking, blue-eyed man with vaguely European features and perfectly groomed grey hair. His lack of physical distinction has been a career-long asset.",
    background:"Born in the ruins of East Berlin. Orphaned young, trained by a Soviet spymaster, and by twenty the youngest senior field operative in the East German service. Discovered in his thirties that his mother's line descended from a ducal house, which turned him against communism as thoroughly as against democracy. Faked his death against a famed British agent in 1989, expunged his files during the collapse, and spent the following decades building a financial empire and the Imperial Court around it. Now slowing physically, but his planning and tradecraft remain unmatched."
  },
  {
    key:"tenzin", name:"Losang Tenzin", title:"The King of Whispers — Information",
    rank:"special", rankLabel:"Villain",
    str:7, dex:7, wil:11, per:14, int:15,
    skills:{ boating:{r:10,b:15}, charisma:{r:11,b:14}, cryptography:{r:15,b:30}, demolitions:{r:15,b:15},
      disguise:{r:15,b:15}, diving:{r:7,b:12}, driving:{r:10,b:15}, electronics:{r:15,b:28}, evasion:{r:7,b:10},
      firecombat:{r:10,b:15}, gambling:{r:14,b:25}, handtohand:{r:7,b:12}, interrogation:{r:15,b:15},
      localcustoms:{r:14,b:28}, lockpicking:{r:7,b:7}, mountaineering:{r:9,b:9}, pickpocket:{r:7,b:7},
      piloting:{r:10,b:10}, riding:{r:12,b:12}, science:{r:15,b:27}, seduction:{r:7,b:14}, sixthsense:{r:14,b:28},
      stealth:{r:11,b:18}, torture:{r:13,b:13} },
    abilities:["Connoisseur","First Aid","Tibetan","Nepali"],
    languages:[{name:"Hindi",rank:15,base:30},{name:"English",rank:15,base:30},{name:"Mandarin",rank:15,base:30},
      {name:"Urdu",rank:15,base:30},{name:"Tamil",rank:15,base:30},{name:"Persian",rank:15,base:30}],
    height:"5'7\"", weight:"155 lbs", age:52, appearance:"Good Looking",
    reputation:70, points:6, speed:2, hthDamage:"A", stamina:30, runSwim:40, carrying:"101-150 lbs",
    weapon:"Beretta 950 Jetfire",
    foe:["Board Games","Computers","Economics/Business","Forensics","History","International Law","Linguistics","Military Science","Political Science"],
    weaknesses:["Sexual Attraction"],
    idiosyncrasies:"Nods frequently in conversation. Looks up when thinking. Scratches the scar on his left hand when nervous.",
    interaction:{ reaction:-1, persuasion:-2, seduction:0, interrogation:-2, torture:-1 },
    description:"Weathered from a fondness for sunny beaches, with thick black hair greying at the temples and a scar on the back of his left hand. He smiles often.",
    background:"Born to a Tibetan noble family that fled to Nepal and then India as its fortune drained away. Linguistically gifted, he was recruited from university by an American agency, then moved to signals work, collecting doctorates and degrees in his spare time. Recruited by Wolf at the turn of the millennium through a job arranged for his father; four years later he had deduced OSIRIS's existence on his own and asked to join it. Became King of Whispers in 2009."
  },
  {
    key:"kamari", name:"Dr. Iskandar Kamari", title:"The King of Power — Influence",
    rank:"agent", rankLabel:"Criminal",
    str:11, dex:10, wil:13, per:15, int:13,
    skills:{ boating:{r:12,b:12}, charisma:{r:13,b:26}, cryptography:{r:13,b:13}, demolitions:{r:13,b:13},
      disguise:{r:13,b:13}, diving:{r:10,b:15}, driving:{r:12,b:18}, electronics:{r:13,b:21}, evasion:{r:10,b:15},
      firecombat:{r:12,b:15}, gambling:{r:15,b:17}, handtohand:{r:11,b:19}, interrogation:{r:13,b:22},
      localcustoms:{r:15,b:22}, lockpicking:{r:10,b:10}, mountaineering:{r:12,b:12}, pickpocket:{r:10,b:10},
      piloting:{r:12,b:12}, riding:{r:14,b:14}, science:{r:13,b:26}, seduction:{r:13,b:22}, sixthsense:{r:14,b:28},
      stealth:{r:13,b:25}, torture:{r:13,b:28} },
    abilities:["Connoisseur","First Aid","Malaysian","Mandarin"],
    languages:[{name:"English",rank:13,base:28}],
    height:"6'2\"", weight:"240 lbs", age:44, appearance:"Good Looking",
    reputation:60, points:5, speed:3, hthDamage:"B", stamina:30, runSwim:40, carrying:"151-210 lbs",
    weapon:"None carried",
    foe:["Architecture","Biology","Economics/Business","History","Medicine","Philosophy","Political Science","Religion","Tennis"],
    weaknesses:["Sadism","Sexual Attraction"],
    idiosyncrasies:"Holds eye contact a second longer than is comfortable. Shakes hands with both hands.",
    interaction:{ reaction:-1, persuasion:-3, seduction:1, interrogation:-2, torture:1 },
    description:"Tall and heavily built, hair worn long and tied back. His body language is warm; his eyes are not.",
    background:"Singaporean, Oxford-trained in neuroscience, medicine and psychology, with research in pain perception and management. Recognised himself as a controlled psychopath during his studies and found the discovery liberating. Inherited his family home and its debts to a triad, worked off the debt as their analyst and torturer, and was recruited after Wolf had the entire triad leadership killed by simultaneous sniper fire on a single day. The newest member of the Imperial Court, and the one Wolf watches most closely."
  },
  {
    key:"munro", name:"Anna Elisabeth Munro", title:"The Queen of Death — Assassination",
    rank:"special", rankLabel:"Villain",
    str:9, dex:13, wil:13, per:13, int:10,
    skills:{ boating:{ability:true}, charisma:{r:13,b:21}, cryptography:{r:10,b:15}, demolitions:{r:10,b:22},
      disguise:{r:10,b:15}, diving:{r:11,b:22}, driving:{r:13,b:26}, electronics:{r:10,b:20}, evasion:{r:11,b:25},
      firecombat:{r:13,b:28}, gambling:{r:13,b:15}, handtohand:{r:9,b:20}, interrogation:{r:10,b:20},
      localcustoms:{r:13,b:24}, lockpicking:{r:13,b:21}, mountaineering:{r:11,b:18}, pickpocket:{r:13,b:19},
      piloting:{r:13,b:16}, riding:{r:13,b:18}, science:{r:10,b:15}, seduction:{r:10,b:18}, sixthsense:{r:11,b:25},
      stealth:{r:13,b:28}, torture:{r:11,b:11} },
    abilities:["Connoisseur","First Aid","English","Boating"],
    languages:[],
    height:"5'8\"", weight:"140 lbs", age:36, appearance:"Attractive",
    reputation:95, points:9, speed:3, hthDamage:"B", stamina:30, runSwim:40, carrying:"101-150 lbs",
    weapon:"SIG Sauer P229",
    foe:["Biology","Computers","Forensics","Mechanical Engineering","Military Science","Political Science","Snow Skiing/Boarding","Toxicology","Wargaming","Water Skiing"],
    weaknesses:["Personal Tie (sisters)","Sexual Attraction"],
    idiosyncrasies:"Uses Scottish Gaelic only when swearing. Passionate and emotive off mission, glacial on it.",
    interaction:{ reaction:-2, persuasion:-1, seduction:-3, interrogation:-2, torture:-1 },
    description:"Brown-haired and green-eyed, stereotypically Scots, and unwilling to live any part of life by halves.",
    background:"Raised in the Scottish far north on water, hills and clan history. Read mechanical engineering, took up fencing and target shooting, then served as a military engineer specialising in explosive ordnance disposal. Left when barred from sniper training, worked private military contracts, and was recruited by British intelligence. After her parents were killed in reprisal for one of her missions, an anonymous source gave her the information her own service could not — and then recruited her. Wolf considers her the least committed of the Court and works steadily on her indoctrination."
  },
  {
    key:"orlov", name:"Vasily Stanislavovich Orlov", title:"The King of War — Military Affairs",
    rank:"agent", rankLabel:"Criminal",
    str:14, dex:12, wil:11, per:12, int:9,
    skills:{ boating:{r:12,b:24}, charisma:{r:11,b:19}, cryptography:{r:9,b:15}, demolitions:{r:9,b:20},
      disguise:{r:9,b:15}, diving:{r:13,b:22}, driving:{r:12,b:26}, electronics:{r:9,b:15}, evasion:{r:13,b:22},
      firecombat:{r:12,b:25}, gambling:{r:12,b:14}, handtohand:{r:14,b:30}, interrogation:{r:9,b:11},
      localcustoms:{r:12,b:14}, lockpicking:{r:12,b:12}, mountaineering:{r:12,b:21}, pickpocket:{r:12,b:12},
      piloting:{r:12,b:16}, riding:{ability:true}, science:{r:9,b:9}, seduction:{r:9,b:14}, sixthsense:{r:10,b:22},
      stealth:{r:11,b:21}, torture:{r:10,b:22} },
    abilities:["Connoisseur","First Aid","Russian","Riding"],
    languages:[{name:"German",rank:9,base:25},{name:"English",rank:9,base:23}],
    height:"6'2\"", weight:"218 lbs", age:49, appearance:"Normal",
    reputation:110, points:8, speed:3, hthDamage:"C", stamina:30, runSwim:40, carrying:"211-280 lbs",
    weapon:"FN Five-seven",
    foe:["Computers","Football","Mechanical Engineering","Military Science","Political Science","Wargaming"],
    weaknesses:["Alcohol Dependence","Drug Dependence (steroids)","Sadism","Superstition"],
    idiosyncrasies:"Utterly humourless. When he does laugh, it is at someone else's accidental pain.",
    interaction:{ reaction:-3, persuasion:-3, seduction:0, interrogation:-1, torture:-3 },
    description:"Harsh angular face, high cheekbones, narrow chin and piercing blue eyes, hair kept military-short. A scar on his left cheek.",
    background:"Born in Vladivostok to a family that had hidden its boyar ancestry for two generations. Excelled in conscript service, joined a Soviet special group, and grew contemptuous of political leadership during the Afghan war. Removed from the unit after a Beirut hostage crisis he resolved with reprisals against the kidnappers' families. Spent a decade as a military instructor and mercenary before Wolf offered him his own private military company. He is the only person Wolf fully trusts, and he makes every operational decision at that company despite being formally only a consultant."
  },
  {
    key:"penne", name:"Flavia Durand de la Penne", title:"The Queen of the Underground — Criminal Wealth",
    rank:"agent", rankLabel:"Criminal",
    str:6, dex:10, wil:13, per:13, int:12,
    skills:{ boating:{r:11,b:15}, charisma:{r:13,b:28}, cryptography:{r:12,b:19}, demolitions:{r:12,b:12},
      disguise:{r:12,b:12}, diving:{r:8,b:12}, driving:{r:11,b:17}, electronics:{r:12,b:15}, evasion:{r:8,b:14},
      firecombat:{r:11,b:16}, gambling:{r:13,b:26}, handtohand:{r:6,b:10}, interrogation:{r:12,b:14},
      localcustoms:{r:13,b:24}, lockpicking:{r:10,b:22}, mountaineering:{r:9,b:9}, pickpocket:{r:10,b:22},
      piloting:{r:11,b:15}, riding:{r:13,b:16}, science:{r:12,b:12}, seduction:{r:14,b:30}, sixthsense:{r:12,b:17},
      stealth:{r:13,b:16}, torture:{r:12,b:12} },
    abilities:["Connoisseur","First Aid","Italian","French"],
    languages:[{name:"English",rank:12,base:25}],
    height:"5'11\"", weight:"145 lbs", age:36, appearance:"Gorgeous",
    reputation:175, points:5, speed:2, hthDamage:"A", stamina:30, runSwim:40, carrying:"101-150 lbs",
    weapon:"Beretta 950 Jetfire",
    foe:["Fine Arts","Forensics","International Law","Jewelry","Law","Literature","Music","Rare Collectibles","Tennis"],
    weaknesses:[],
    idiosyncrasies:"Touches people while talking to them. Pristine posture and graceful movement.",
    interaction:{ reaction:-1, persuasion:-1, seduction:-2, interrogation:-1, torture:-1 },
    description:"Silky blonde hair framing a flawless face, thick well-groomed brows, a Greek nose and full lips.",
    background:"Daughter of a Calabrian crime boss, privately tutored in languages and the arts until a violent argument sent her to Milan at sixteen. Discovered by a fashion house and inside six years the most in-demand model in the world, refusing only to sell ordinary products. Returned home when her father was killed in a feud, declared herself boss — unprecedented for a woman in that organisation — and settled the objections with four gunshots. The resulting war ended only when an old lover, Wolf, brokered peace. Elevated to the Imperial Court in 2007."
  },
  {
    key:"oda", name:"Oda Nagatoshi", title:"The King of Business — Legal Wealth",
    rank:"agent", rankLabel:"Criminal",
    str:10, dex:12, wil:11, per:13, int:12,
    skills:{ boating:{r:12,b:12}, charisma:{r:11,b:20}, cryptography:{r:12,b:17}, demolitions:{r:12,b:12},
      disguise:{r:12,b:12}, diving:{r:11,b:11}, driving:{r:12,b:20}, electronics:{r:12,b:18}, evasion:{r:11,b:21},
      firecombat:{r:12,b:19}, gambling:{r:13,b:18}, handtohand:{r:10,b:22}, interrogation:{r:12,b:12},
      localcustoms:{r:13,b:20}, lockpicking:{r:12,b:12}, mountaineering:{r:10,b:10}, pickpocket:{r:12,b:12},
      piloting:{r:12,b:18}, riding:{r:12,b:12}, science:{r:12,b:12}, seduction:{r:10,b:15}, sixthsense:{r:12,b:22},
      stealth:{r:11,b:19}, torture:{r:11,b:11} },
    abilities:["Connoisseur","First Aid","Japanese","Russian"],
    languages:[{name:"English",rank:12,base:24}],
    height:"5'8\"", weight:"140 lbs", age:55, appearance:"Good Looking",
    reputation:95, points:7, speed:3, hthDamage:"B", stamina:30, runSwim:40, carrying:"101-150 lbs",
    weapon:"Walther PPS",
    foe:["Economics/Business","Golf","International Law","Law","Political Science"],
    weaknesses:["Personal Tie (family)"],
    idiosyncrasies:"Tells jokes. Wears only platinum. Explosive temper when faced with failure. Smokes two or three Cuban cigars a day.",
    interaction:{ reaction:-1, persuasion:-1, seduction:-1, interrogation:-3, torture:-1 },
    description:"Muscular, wide-shouldered and narrow-hipped, black hair slicked back, with a close-cropped salt-and-pepper beard.",
    background:"Born in Nagoya to a businessman and martial-arts instructor descended from a famous clan; his father held the family's last peerage. Took a business degree at twenty and mastery of jujitsu and kendo at twenty-three, then ran the family holding company from twenty-four. Quadrupled its value through real estate, sold at the peak of the bubble into microchips and consumer staples, then divested technology just before the crash. Wolf recruited him in the late 1990s with the challenge of running a secret worldwide holding company, and quadrupled the wealth under his control overnight. Elevated in 2004."
  }
];

/* ---------------------------------------------------------------- ENCOUNTERS */

/* Hot: dangerous, or close on the trail. Cold: relative safety, or off the track.
 * Roll 2d10 and cross-reference [Ch.12]. Entries with a modifier apply it to the
 * sub-table roll. Entries marked heroPoint offer an alternative result for 1 Hero Point. */
export const ENCOUNTER_TABLES = {
  hot: [
    ["opponent","surveillance","henchman","hotel","chase","intercepted","attack","suspicious","contact+1","technician+2"],
    ["recognized","message","badluck","pickpocket","contact","goodluck","covert+1","accident","frosty","assassin"],
    ["security+1","deadbody","suspicious","questioning","agencycontact","attack","foil+1","message","technician+1","paging"],
    ["informant","covert","foil+3","accident","intuition","surveillance","cluecracked","attack","security","goodluck"],
    ["henchman","technician+1","message","employment","attack","hotel","pickpocket","recognized","badluck","chase"],
    ["assassin","kidnapping","contact+2","surveillance","opportunity","employment","civilian+1","foil+2","henchman","informant"],
    ["contact+1","pickpocket","goodluck","famous","henchman","surveillance","opponent","technician+1","intercepted","questioning"],
    ["covert+2","accident","security+2","frosty","message","informant","security","pickpocket","thief","deadbody"],
    ["deadbody","attack","chase","hotel","badluck","covert","recognized","foil+1","intuition","suspicious"],
    ["contact","employment","opportunity","cluecracked","technician+2","accident","vehicleclue","assassin","foil","surveillance"]
  ],
  cold: [
    ["civilian-1","famous","intuition","questioning","contact-1","covert-1","technician-1","frosty","computermixup","news"],
    ["deadbody","surveillance","hijacking","tourists","hotel","opportunity","pickpocket","security-1","frosty","recognized"],
    ["contact-1","covert-1","foil-1","accident","chase-2","intercepted","civilian","computermixup","deadbody","badluck"],
    ["contact-1","foil-1","badluck","civilian","technician","goodluck","suspicious","opportunity","intuition","message"],
    ["technician-1","intercepted","security-1","message","frosty","cluecracked","hotel","assassin","tourists","contact-1"],
    ["security-1","recognized","civilian","goodluck","questioning","accident","news","questioning","hijacking","foil-2"],
    ["informant","suspicious","deadbody","opportunity","security-1","technician-2","foil-1","intuition","news","arrest"],
    ["frosty","pickpocket","news","tourists","surveillance","badluck","questioning","accident","intercepted","contact-1"],
    ["civilian-1","computermixup","remotecontrol","intuition","covert-2","hijacking","technician-1","suspicious","contact-1","famous"],
    ["hijacking","security-1","frosty","foil-3","hotel","civilian","recognized","covert-1","surveillance","pickpocket"]
  ]
};

export const ENCOUNTERS = {
  accident: { name:"Accident", heroPoint:true,
    base:"A minor accident in a taxi, bus, train or ferry costs at least an hour. Nothing sinister — just traffic.",
    hero:"An overheard description of a fleeing perpetrator reveals the accident was arranged by the Primary Opponent or a Henchman." },
  agencycontact: { name:"Agency Contact", heroPoint:true,
    base:"A local operative of your rank (Rookies) or one rank below arrives with local knowledge and useful abilities.",
    hero:"They also bring detailed intelligence on the target's plan and additional equipment.",
    note:"Skip entirely if the characters have no agency; refund any Hero Point." },
  arrest: { name:"Arrest",
    base:"Someone tips off the authorities about concealed weapons. Anyone armed is searched and detained. A friendly nation clears it up; an unfriendly one does not. Good (3) Persuasion learns who informed; Great (2) or better learns it without the guards realising they told you." },
  assassin: { name:"Assassin", heroPoint:true,
    base:"The person you were looking for was killed about fifteen minutes ago — this becomes a Dead Body encounter. If you sought no one, the assassin is coming for you in a public space; roll Sixth Sense.",
    hero:"You arrive as the assassin — a Covert Operative — is about to finish an Incapacitated victim. If you sought no one, you learn the assassin's plan instead." },
  attack: { name:"Attack", heroPoint:true,
    base:"Snakes, traps or venomous spiders waiting in your hotel room. Roll Sixth Sense to notice something is wrong.",
    hero:"You spot the trap before it triggers and find a tell-tale clue pointing at the Primary Opponent." },
  badluck: { name:"Bad Luck",
    base:"Something ordinary and believable goes wrong: an observation post is compromised, an officer recognises someone, a dog barks at the wrong moment, or critical equipment fails catastrophically." },
  chase: { name:"Chase", sub:[
    { max:2, text:"The local crime boss sends goons in a matching vehicle to frighten you." },
    { max:4, text:"An unfriendly agency's operative follows in a matching vehicle. No violence unless you damage him or the car." },
    { max:7, text:"A carload of hostiles wants you captured or dead; a second vehicle waits for prisoners." },
    { max:9, text:"A major chase: at least three enemy vehicles, one of a different type. They want you alive and will not break off before nine mishaps or the arrival of the police." },
    { max:10, text:"As above, but led by a Henchman, and it does not end until the Henchman's vehicle is disabled." }
  ], note:"Results of 4 or less have nothing to do with the current mission." },
  civilian: { name:"Civilian", sub:[
    { max:2, text:"An oily swindler tries to sell you false information." },
    { max:4, text:"A garrulous retired naval officer talks your ear off. On a 1-2 he can introduce a Contact; on a 9-10 a Foil." },
    { max:6, text:"A professional pilot, driver or captain strikes up conversation. Hot: leads to a Vehicle Clue or Technician. Cold: a Technician." },
    { max:8, text:"An elderly lady complains about a churlish man matching the Henchman's description and, with coaxing, recalls where he can be found. The information is false in a Hot area and good in a Cold one." },
    { max:10, text:"A retired law officer. If you carry concealed weapons he checks Perception (DF 5 Hot, DF 3 Cold) and, on success, calls old colleagues — an Arrest encounter." },
    { max:99, text:"Petty criminals have marked you as visiting business travellers and likely victims." }
  ] },
  cluecracked: { name:"Clue Cracked",
    base:"You suddenly grasp an earlier clue or crack a code. With nothing outstanding, a Hot area yields a new clue and a Cold area a clue that puts you back on track." },
  computermixup: { name:"Computer Mix Up",
    base:"A booking error puts an NPC in a position to let slip where the Primary Opponent or a Henchman is, or what they are doing." },
  contact: { name:"Contact", sub:[
    { max:2, text:"Has information on the Primary Opponent, but anything short of Good (3) on Persuade insults them subtly and ends the relationship." },
    { max:4, text:"Leads you to an Informant." },
    { max:6, text:"Can supply equipment outside normal channels, in exchange for a promise of future assistance or information." },
    { max:8, text:"Believes your target is a competitor. Hot: gives actionable intelligence, such as a precise location or the current plan. Cold: gives behaviour, habits, favourite haunts and general security posture." },
    { max:10, text:"Can test any material or technology relating to the Primary Opponent's plan." },
    { max:99, text:"Two of the above, plus a small security detachment placed at your disposal — though the Contact insists on commanding them personally." }
  ] },
  covert: { name:"Covert Operative", sub:[
    { max:2, text:"From an opposed agency, with personal history with one of you. A Reaction roll at -3 DF decides whether they leave you alone (planning a later betrayal) or interfere immediately." },
    { max:4, text:"From a friendly agency but personally dismissive of yours. Helps, then tries to preempt you and claim the success." },
    { max:6, text:"An enemy operative posing as a friendly one. Offers hints, deflects questions about their past, and is really building a file on you." },
    { max:8, text:"A former member of your agency who trained one of you, still friendly. Cold: unfamiliar with the target. Hot: knows where the Primary Opponent will appear in public." },
    { max:10, text:"From an enemy agency, but running a mission much like yours. Cooperates while giving away nothing and learning everything." },
    { max:99, text:"Takes a liking to one of you. A Reaction roll at +3 DF makes them a lasting ally who can extract you from legal trouble at home — reciprocity expected." }
  ] },
  deadbody: { name:"Dead Body",
    base:"Cold: the body carries a clue to the Primary Opponent's location. Hot: it lies near definitive information about their plans. Following an Assassin encounter, it implicates the Primary Opponent." },
  employment: { name:"Employment Offer", heroPoint:true,
    base:"A Contact offers you an assassination job — a rival needs removing.",
    hero:"The job is actually for the Primary Opponent, opening a route into their operation." },
  famous: { name:"Famous Operative",
    base:"You recognise a famous operative in public. They are working and will not acknowledge you unless approached, will accept volunteered information, will decline help, and will not reveal what they are doing." },
  foil: { name:"Foil", sub:[
    { max:3, text:"A travel professional attracted to one of you, with no useful covert information." },
    { max:5, text:"An elegant older Foil who may introduce a Contact to someone who pleases them." },
    { max:7, text:"A professional athlete on a tight schedule but with access to a useful social circle." },
    { max:9, text:"A hanger-on who loves the good life and is friendly with either a Contact or a Technician — your choice." },
    { max:11, text:"Being harassed by security goons — the Primary Opponent's in a Hot area, a linked syndicate's in a Cold one. Adventurous by nature and glad to help." },
    { max:12, text:"A junior employee of the Primary Opponent who may reveal locations, names and details of other staff or Henchmen." },
    { max:99, text:"Falls in love with one of you and will risk everything. A relative is a Contact, giving +3 Difficulty Factor on the Reaction check. Treated badly, they become a vindictive enemy with dangerous family." }
  ] },
  frosty: { name:"Frosty Reception", base:"Your next Reaction roll is at -2 Difficulty Factor." },
  goodluck: { name:"Good Luck", heroPoint:true,
    base:"Something ordinary goes right: a perfect observation post, a useful overheard remark, a guard dog that adores you, equipment performing above spec.",
    hero:"The luck pinpoints your target's location or drops a large part of the Primary Opponent's plan into your hands." },
  henchman: { name:"Henchman",
    base:"The Primary Opponent's Henchmen arrive to persuade you physically. If you have already met the Primary Opponent and proved a persistent nuisance, they are willing to kill." },
  hijacking: { name:"Hijacking", heroPoint:true,
    base:"Punks hijack your taxi or transit vehicle to rob everyone aboard and vanish into the crowd.",
    hero:"The punks know of your Primary Opponent and are trying to impress him by capturing you. If they fail, they can be made to talk." },
  hotel: { name:"Hotel Operator",
    base:"A desk clerk or concierge mentions someone asking after you — describing a Henchman in person, or a voice on the telephone that is the Primary Opponent. Skip if the Primary Opponent does not yet know you exist." },
  informant: { name:"Informant", heroPoint:true, sub:[
    { max:3, text:"Nearly useless; can only confirm what you already know." },
    { max:6, text:"Noticed a Covert Operative (Cold) or known associates of the Primary Opponent (Hot)." },
    { max:8, text:"Overheard part of the Primary Opponent's plans from a Henchman (Hot), or learned the name of a Technician involved (Cold)." },
    { max:99, text:"Can introduce you to a Contact: +1 on the Contact roll in a Cold area, +2 in a Hot one." }
  ], hero:"Spending a Hero Point turns Cold results into Hot ones, or adds +3 to the roll — your choice. Rescuing the informant on a low result earns +2 on your next Informant encounter." },
  intercepted: { name:"Intercepted",
    base:"A message or piece of equipment has been intercepted. It will never arrive and must be resent. You may not know until far too late." },
  intuition: { name:"Intuition", base:"A sudden insight connects disparate pieces and clarifies what is going on." },
  kidnapping: { name:"Kidnapping",
    base:"The Primary Opponent takes someone you know, preferring in order: a Foil, a Covert Operative, a Civilian, a Contact. With no one available, you are Attacked instead." },
  message: { name:"Mysterious Message", sub:[
    { max:5, text:"A Foil seeking one character's attention: +3 on the next Foil encounter." },
    { max:8, text:"A Contact wants a dinner meeting: +2 on the next Contact encounter." },
    { max:10, text:"From the Primary Opponent — an invitation to a fine restaurant or casino if you have not yet interfered, or a deniable death threat if you have." }
  ] },
  news: { name:"News",
    base:"A breaking story inadvertently reveals the Primary Opponent's location behind an innocuous headline about accounting irregularities, a new invention, or a missing photographer." },
  opponent: { name:"Primary Opponent",
    base:"Not yet met: an invitation to a charity competition — backgammon, baccarat, trap shooting or golf — which they will cheat at if they can do so unseen. Met but unprovoked: the same, plus a firm warning backed by a Henchman. Provoked: they lead a hit squad against you personally, Henchman included." },
  opportunity: { name:"Opportunity",
    base:"The players choose the encounter: Foil, Contact, Covert Operative, Technician or Henchman. Any sub-table roll is at +1." },
  paging: { name:"Paging", sub:[
    { max:5, text:"A Primary Opponent or one of their Technicians is paged." },
    { max:8, text:"The Primary Opponent is paged." },
    { max:10, text:"A Henchman is paged." }
  ] },
  pickpocket: { name:"Pickpocket",
    base:"An experienced pickpocket at Base Chance 20 targets you. Caught and held, they can introduce an Informant at +2." },
  questioning: { name:"Questioning", heroPoint:true,
    base:"An enemy agency's operative invites a character to lunch to work out why you are really here. Tense but polite.",
    hero:"They let slip the Primary Opponent's location." },
  recognized: { name:"Recognized",
    base:"A local informant recognises one of you, and word will be circulating in covert circles shortly." },
  remotecontrol: { name:"Remote Control", heroPoint:true,
    base:"Without adequate precautions your main vehicle is taken over remotely. You have a few rounds to correct it before an obvious attempt on your lives.",
    hero:"You notice the vehicle has been tampered with." },
  security: { name:"Security", sub:[
    { max:2, text:"A simple brute after money." },
    { max:6, text:"Sent to maul you if the Primary Opponent has met you. Otherwise, Hot: sent to 'invite' you to a meeting with physical persuasion available. Cold: sent to observe." },
    { max:8, text:"They attempt to tail you." },
    { max:10, text:"Punks interrupted while ransacking your rooms; they have not found it yet and think working you over is a sound next step." },
    { max:99, text:"As above, but they carry remarkably detailed information on the Primary Opponent's plans, including the timetable." }
  ] },
  suspicious: { name:"Suspicious Action",
    base:"You notice something unusual. Pursued, it leads in the general direction of the Primary Opponent." },
  surveillance: { name:"Surveillance", sub:[
    { max:1, text:"Only a nosy neighbour." },
    { max:5, text:"An enemy agency's operative under strict orders to avoid all contact." },
    { max:7, text:"A private investigator hired by someone you have crossed, told you are former business partners who cheated his client, and told to avoid contact while gathering something incriminating." },
    { max:9, text:"Local national law enforcement." },
    { max:10, text:"A Special Agent with full licence to kill — you have stirred up a hornets' nest somewhere." }
  ] },
  technician: { name:"Technician", sub:[
    { max:2, text:"Recently fired by the Primary Opponent's business partners. Knows a little; a DF 1 Perception, Electronics or Science check assembles it into the technical shape of the plan." },
    { max:4, text:"Lazy, out buying equipment, with dreadful tradecraft. Follow him to the lair and pick up passwords and procedures on the way." },
    { max:6, text:"From your own agency, arriving with technological goodies." },
    { max:8, text:"From your past, at your hotel — his family has been kidnapped and he has been 'recruited' by the Primary Opponent." },
    { max:10, text:"A Technician with a high Reputation. Hot: unknowingly furthering the Primary Opponent's plans. Cold: simply on holiday." },
    { max:99, text:"The Primary Opponent's most important Technician leaves the lair with only a few guards." }
  ] },
  thief: { name:"Thief", heroPoint:true,
    base:"A DF 4 Perception check spots an inexperienced thief stealing something of value.",
    hero:"Approaching them without calling the authorities gives a Foil encounter at +1; following them leads to a Contact encounter." },
  tourists: { name:"Tourists", sub:[
    { max:3, text:"A gaggle of students and a dishevelled chaperone loudly announcing the day's schedule, heading your way — useful cover." },
    { max:7, text:"A couple just back from where the Primary Opponent was staying; they watched the Henchman rough up local toughs and can describe his fighting ability." },
    { max:9, text:"Camera-happy tourists whose photographs show the Primary Opponent's plan in motion or the Henchman at work." },
    { max:10, text:"An extremely attractive enemy operative sent to see whether any of you will take a bribe, targeting whoever seems most interested in the future." }
  ] },
  vehicleclue: { name:"Vehicle Clue",
    base:"You notice a particular vehicle linked to the Primary Opponent." }
};
