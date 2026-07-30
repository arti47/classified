/* Classified — published pre-generated characters.
 * Source: the "Character Sheets & Sample PCs" supplement (five filled Agent Dossiers).
 * These run on player-character rules, unlike the OSIRIS antagonists in data-npcs.js.
 *
 * Only skill RANKS are stored. Formula Totals and Base Chances are derived by the app
 * from the characteristics, so the handful of arithmetic slips on the printed sheets
 * (listed per character in `sheetNotes`) are corrected rather than reproduced.
 *
 * Every sheet's weapon and vehicle line matches the Chapter Ten tables exactly, with one
 * exception noted on Emily Steele.
 */

export const PREGENS = [
  {
    key: "jackson",
    name: "Michelle Jackson",
    rank: "rookie",
    age: 31,
    gender: "female",
    height: "5'7\"", weight: "140 lbs",
    heightBand: 4, weightBand: 5, appearance: "goodlooking",
    reputation: 51, heroPoints: 3, xp: 1,
    profession: "freelancer", professionYears: 6,
    attributes: { str: 7, dex: 9, wil: 7, per: 9, int: 7 },
    skills: {
      boating: 3, charisma: 2, driving: 6, evasion: 2, firecombat: 6,
      handtohand: 5, piloting: 6, riding: 2, sixthsense: 2, stealth: 3
    },
    ability: "mountaineering",
    nativeLanguage: "English",
    languages: [{ name: "Russian", rank: 15 }],
    weaknesses: ["claustrophobia", "sexual"],
    foe: ["computers", "economics", "intlaw", "law", "linguistics", "polisci"],
    weapon: "hkp30",
    vehicle: "mustang",
    blurb: "A freelance operative who came up through the private-investigation trade. Fast behind a wheel or a control column, and fluent in Russian thanks to a linguist's ear.",
    sheetNotes: [
      "Every printed Base Chance agrees with the characteristics and ranks.",
      "Russian at Skill Rank 15 comes free with the Linguistics Field of Experience."
    ]
  },
  {
    key: "sawyer",
    name: "Johnathan Sawyer",
    rank: "rookie",
    age: 28,
    gender: "male",
    height: "6'1\"", weight: "185 lbs",
    heightBand: 5, weightBand: 4, appearance: "goodlooking",
    reputation: 33, heroPoints: 3, xp: 0,
    profession: "military", professionYears: 3,
    attributes: { str: 9, dex: 8, wil: 8, per: 8, int: 7 },
    skills: {
      charisma: 2, driving: 5, firecombat: 7, handtohand: 4,
      science: 2, seduction: 3, sixthsense: 3, stealth: 4
    },
    ability: "language", abilityLanguage: "German",
    nativeLanguage: "English",
    languages: [],
    weaknesses: [],
    foe: ["computers", "mecheng", "milsci"],
    weapon: "waltherppk",
    vehicle: "minicooper",
    blurb: "Ex-military, no weaknesses on file, and the best shot of the four Rookies. Uncomplicated and quietly effective.",
    sheetNotes: [
      "Every printed Base Chance agrees with the characteristics and ranks.",
      "His sheet spends exactly its Creation Point budget: 306 of 306."
    ]
  },
  {
    key: "georges",
    name: "Godwin Georges",
    rank: "rookie",
    age: 28,
    gender: "male",
    height: "6'2\"", weight: "210 lbs",
    heightBand: 6, weightBand: 6, appearance: "stunning",
    reputation: 73, heroPoints: 3, xp: 0,
    profession: "milintel", professionYears: 3,
    attributes: { str: 9, dex: 7, wil: 7, per: 7, int: 11 },
    skills: {
      charisma: 1, cryptography: 2, demolitions: 1, disguise: 1, driving: 2,
      firecombat: 4, gambling: 4, handtohand: 4, interrogation: 2,
      science: 1, sixthsense: 1, stealth: 2
    },
    ability: "electronics",
    nativeLanguage: "English",
    languages: [],
    weaknesses: ["snakes", "sexual"],
    foe: ["forensics", "intlaw", "polisci"],
    weapon: "sw640",
    vehicle: "blackline",
    blurb: "Military intelligence, and the brain of the group at Intelligence 11. Striking enough to be remembered, which is the last thing an operative wants.",
    sheetNotes: [
      "The sheet prints his Hand-to-Hand Damage Rank as A; Strength 9 gives B. The app derives B.",
      "The sheet prints Piloting's Formula Total as 8 and Sixth Sense's as 8; the characteristics give 7 and 9. The app derives both."
    ]
  },
  {
    key: "steele",
    name: "Emily Steele",
    rank: "rookie",
    age: 30,
    gender: "female",
    height: "5'9\"", weight: "124 lbs",
    heightBand: 5, weightBand: 3, appearance: "attractive",
    reputation: 66, heroPoints: 3, xp: 0,
    profession: "criminal", professionYears: 6,
    attributes: { str: 6, dex: 10, wil: 10, per: 9, int: 8 },
    skills: {
      charisma: 4, driving: 2, evasion: 2, firecombat: 3,
      handtohand: 4, lockpicking: 6, sixthsense: 4, stealth: 7
    },
    ability: "pickpocket",
    nativeLanguage: "English",
    languages: [],
    weaknesses: ["arachnophobia"],
    foe: ["computers", "finearts", "jewelry", "law", "mecheng", "rarecollectibles"],
    weapon: "waltherpps",
    vehicle: "peugeot308",
    blurb: "A thief by trade — the quietest mover and the best hand with a lock in the sample roster.",
    sheetNotes: [
      "The sheet prints Skill Rank 6 for both Driving and Fire Combat, but Base Chances of 11 and 12, which give ranks 2 and 3. The Base Chance is the number used in play, so the app takes ranks 2 and 3.",
      "Her printed Reputation of 66 requires six profession years, but her age is printed as 30 rather than 31.",
      "Her sheet spends 332 Creation Points against a budget of 320.",
      "Her sheet gives the Walther PPS a Performance Modifier of +1; the Chapter Ten weapon table gives +0, which the app uses."
    ]
  },
  {
    key: "hunter",
    name: "Aidan Hunter",
    rank: "special",
    age: 36,
    gender: "male",
    height: "6'1\"", weight: "190 lbs",
    heightBand: 5, weightBand: 4, appearance: "stunning",
    reputation: 101, heroPoints: 9, xp: 0,
    profession: "military", professionYears: 6,
    attributes: { str: 9, dex: 12, wil: 13, per: 14, int: 12 },
    skills: {
      boating: 8, charisma: 13, disguise: 3, driving: 11, electronics: 6,
      evasion: 11, firecombat: 11, gambling: 12, handtohand: 11,
      localcustoms: 11, lockpicking: 5, mountaineering: 8, piloting: 8,
      riding: 6, science: 5, seduction: 12, sixthsense: 12, stealth: 12
    },
    ability: "language", abilityLanguage: "French",
    nativeLanguage: "English",
    languages: [],
    weaknesses: ["sexual"],
    foe: ["computers", "mecheng", "milsci", "forensics", "golf", "polo", "snowskiing", "waterskiing"],
    weapon: "waltherp99",
    vehicle: "porsche911",
    blurb: "The finished article: a Special Agent with a Speed of 3, a hand in every skill that matters, and a Reputation to match. Charming, conspicuous, and very hard to stop.",
    sheetNotes: [
      "His Hand-to-Hand rank of 11 on Strength 9 sits exactly at the rank cap of the highest underlying characteristic plus two.",
      "The sheet prints Diving's Formula Total as 8 and Electronics' as 11; the characteristics give 10 and 12. The app derives both.",
      "Four of his eight Fields of Experience are General ones, which the book exchanges two-for-one against a profession Field. Forensics sits outside the Military list, implying a second profession.",
      "His printed Reputation of 101 exceeds what creation alone produces (76), the balance presumably earned in play — promotion to Special Agent is worth 20 and a kill 5."
    ]
  }
];

/** The Creation Point audit performed against each sheet, kept as a regression fixture. */
export const PREGEN_BUDGET_AUDIT = [
  { key: "jackson", budget: 327, spent: 326 },
  { key: "sawyer", budget: 306, spent: 306 },
  { key: "georges", budget: 324, spent: 318 },
  { key: "steele", budget: 320, spent: 332, note: "over budget on the printed sheet" },
  { key: "hunter", budget: 922, spent: 918 }
];
