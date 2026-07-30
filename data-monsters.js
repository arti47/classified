/* Classified — animals [Chapter Fourteen, Resources].
 * Classified has no monster bestiary; the book's only creature stat blocks are animals.
 * Note the STR values above 15 printed for horses: reproduced as printed.
 */

export const ANIMALS = [
  {
    key: "alligator", name: "Alligator / Crocodile",
    str: 15, dex: 1, wil: 4, per: 1, int: 0,
    abilities: ["Diving", "Sixth Sense", "Stealth"],
    hthBase: 10, hthDamage: "G", speed: 0, attacksNote: "One attack every other round",
    armor: 2,
    notes: [
      "Thick hide acts as body armour, reducing a weapon's Damage Rank by 2 steps.",
      "Strength 15 lets it shrug off blunt Hand-to-Hand damage by two ranks on a DF 5 Strength check."
    ]
  },
  {
    key: "guarddog", name: "Guard Dog",
    str: 6, dex: 13, wil: 12, per: 12, int: 0,
    abilities: ["Evasion", "Sixth Sense", "Stealth"],
    hthBase: 25, hthDamage: "D", speed: 3, attacksNote: "One attack per round",
    notes: [
      "Covers Dobermann, Rottweiler, German Shepherd and any large trained or hungry dog with no statistical difference.",
      "A larger canine such as a wolf gets +1 Damage Rank."
    ]
  },
  {
    key: "horse", name: "Horse",
    str: 18, dex: 10, wil: 5, per: 8, int: 0,
    abilities: ["Sixth Sense", "Stealth"],
    hthBase: 12, hthDamage: "E", speed: 3, attacksNote: "One attack per round",
    notes: [
      "Most horses are skittish. Police-trained horses give +2 Difficulty Factor to Riding checks when something would normally spook them."
    ]
  },
  {
    key: "piranha", name: "Piranha (school)",
    str: null, dex: null, wil: null, per: null, int: 0,
    abilities: [],
    hthBase: null, hthDamage: null, speed: null, attacksNote: "Automatic escalating damage",
    schedule: [
      { round: 1, wound: "light" }, { round: 2, wound: "light" },
      { round: 3, wound: "medium" }, { round: 4, wound: "medium" },
      { round: "5+", wound: "heavy" }
    ],
    notes: [
      "Only dangerous when very hungry, but then relentless.",
      "Rounds 1-2 inflict a Light Wound each, rounds 3-4 a Medium Wound each, and every round after that a Heavy Wound as the frenzy peaks."
    ]
  },
  {
    key: "shark", name: "Shark",
    str: 16, dex: 1, wil: 1, per: 1, int: 0,
    abilities: ["Sixth Sense", "Stealth"],
    divingBase: 30,
    hthBase: 12, hthDamage: "G", speed: 3, attacksNote: "One attack per round",
    notes: [
      "Statistics cover large sharks: tiger, bull and white-tip.",
      "Smaller sharks take -1 Damage Rank; a great white takes +1.",
      "Strength 16 lets it shrug off blunt Hand-to-Hand damage by two ranks on a DF 5 Strength check."
    ]
  }
];
