/* data-help.js — how to use the app, and the solo walkthrough.
 *
 * UI copy, not rules: nothing here is a value from either book, and nothing in `src/` should
 * author help text of its own. Entries are keyed by screen (`sheet`) or by panel within a
 * screen (`solo.fate`), and `src/help.js` renders them into a collapsed accordion wherever
 * the panel itself is drawn.
 *
 * Keep each entry to what it is and the taps that use it — these sit on every screen, and a
 * page of prose on a phone is worse than none. The one long-form piece is TUTORIAL, which
 * has a screen of its own.
 *
 * No imports. Pure data, so the harness can load it in Node.
 */

/**
 * @typedef {object} HelpEntry
 * @property {string} title  heading on the accordion
 * @property {string} what   one line: what this panel is for
 * @property {string[]} steps the taps, in order
 * @property {string} [note] one line on the rule behind it, where that helps
 */

export const HELP = {

  /* ---------------------------------------------------------------- screens */

  home: {
    title: "How to use Home",
    what: "The way in: who is open, what just happened, and a tile for everything else.",
    steps: [
      "The card at the top is the open dossier. Tap Open to go to the sheet.",
      "Tap a tile to jump: Roll for any check, Combat for an encounter, Rules to look something up, Roll log to re-read what you rolled.",
      "Recent rolls list the last five, newest first — tap through to the log for the rest.",
      "Glossary explains any word on any screen — both systems, in plain English.",
      "Play solo turns on the Mythic engine, which runs the game when there is nobody to run it.",
      "A red banner means a wound or a condition is standing against every roll you make."
    ],
    note: "Create and Gear are reachable from the sheet; the bottom bar carries the screens you use in play, and the GM and Solo tabs join it when you switch them on."
  },

  create: {
    title: "How to use Create",
    what: "Point-buy character creation, or a published sample character in one tap.",
    steps: [
      "Pick a rank first — it sets the Creation Point budget and your starting Hero Points.",
      "Work through the steps along the top: Traits, Characteristics, Profession, Skills, Weaknesses, Abilities.",
      "Watch the budget bar; it turns red the moment you are over, and Review lists anything illegal.",
      "Tap Create dossier on Review to save. Nothing is written until you do.",
      "Or scroll to Published sample characters and tap one to play it immediately."
    ],
    note: "Every character starts with Charisma and Driving at rank 1, and a skill can never exceed its highest underlying characteristic + 2."
  },

  sheet: {
    title: "How to use the Sheet",
    what: "The live character: everything here is tappable, and most of it rolls.",
    steps: [
      "Tap a characteristic to roll a straight check on it.",
      "Open a skill group and tap a skill to roll it — the dialog carries the Difficulty Factor ladder and your modifiers.",
      "The chips above the screen are your resources: tap Hero to spend or gain, Wound to take damage or heal.",
      "Roll opens every procedure the book defines — including throwing a grenade and tailing someone; Attack goes straight to your weapons.",
      "A Disguise or Stealth roll offers the check that opposes it, at the Difficulty Factor your own Quality sets.",
      "Untrained skills roll at −3 Difficulty Factor; hide them with Show all if the list is long."
    ],
    note: "Base Chance × Difficulty Factor = Success Chance, read on the Success Quality Table for Superb, Great, Good, Fair or a failure."
  },

  gear: {
    title: "How to use Gear",
    what: "What you carry, what it weighs, and what it costs.",
    steps: [
      "+ Add opens the catalogue: search it, tap an entry to add it to the dossier.",
      "Tap Use on a weapon to attack with it without leaving the screen, or Throw on a grenade for range, scatter and the blast.",
      "Adjust changes cash; a minus sign spends.",
      "The weight card turns red past your Strength's carrying maximum.",
      "Your vehicles sit under the catalogue: fit modifications against the Modification Point budget, and Damage works out what a crash does to everyone inside.",
      "Build a bug picks a medium, a transmission, storage and power, and prices the whole thing."
    ],
    note: "At maximum load you tire after Willpower minutes and take −3 Difficulty Factor until you rest fifteen."
  },

  combat: {
    title: "How to use Combat",
    what: "The encounter tracker, the progress tracker, and the mission boundaries.",
    steps: [
      "Start an encounter, then + Add to bring in NPCs, animals, OSIRIS antagonists or a name and a Speed.",
      "Declare in the order shown — slowest first — then tap To Action and resolve fastest first.",
      "Attack this on an opponent's card opens your weapons already aimed at them; the result applies the wound it worked out.",
      "Damage applies a wound through the accumulation table and rolls stun, pain and scars for you.",
      "Progress tasks track anything that takes several rolls: healing, a long interrogation, a data scrub.",
      "End Scene, End Session and End Mission each fire their whole bundle and can be undone once."
    ],
    note: "Declaration and action run in opposite directions on purpose: the fastest declare last and act first."
  },

  advance: {
    title: "How to use Advancement",
    what: "Spending experience between missions.",
    steps: [
      "Add XP records an award; End mission computes one from rank, outcome and role-playing.",
      "Raise lifts a characteristic or a skill if you can afford it and have not already raised it this mission.",
      "Learn a new skill adds one at rank 1.",
      "Data scrub buys Reputation back down, which is the only way it falls."
    ],
    note: "No skill or characteristic may rise more than one point per mission; the gate clears at End Mission."
  },

  rules: {
    title: "How to use the Rules library",
    what: "Every procedure and table from the core book, searchable.",
    steps: [
      "Start with the Glossary if a word on another screen made no sense.",
      "Type in the search box to match topics, skills, gear and Fields of Experience at once.",
      "Core procedures open as short explanations; Tables open the real table.",
      "Tap a skill for its formula, base time and your own Base Chance, then Roll it from there.",
      "Animals and OSIRIS open full stat blocks you can drop into an encounter."
    ]
  },

  log: {
    title: "How to use the Roll log",
    what: "The last hundred rolls, with enough detail to re-derive any of them.",
    steps: [
      "Each row shows the die, the result, and the Base Chance × Difficulty Factor that produced it.",
      "Rows marked Mythic are solo oracle answers, not Classified checks — they carry an answer, not a Success Quality.",
      "Clear empties the log; it cannot be undone."
    ]
  },

  gm: {
    title: "How to use the GM screen",
    what: "Everything a referee needs that a player does not.",
    steps: [
      "Party lists every dossier on this device; tap one to peek at its numbers.",
      "Hot and Cold roll the book's encounter tables, sub-tables and Hero Point variants included.",
      "Generate NPC builds one from the 1d10 stereotype tables at the rank you pick.",
      "Reference tables cover chases, grenades, repairs and the OSIRIS roster."
    ],
    note: "Ask the players whether they will spend a Hero Point before you reveal which version of an encounter they got."
  },

  solo: {
    title: "How to use Solo",
    what: "The Mythic Game Master Emulator, standing in for a referee. The screen is ordered as the loop you play.",
    steps: [
      "Write the mission briefing first — it seeds your threads and your first opponent.",
      "Start scene N: say what you expect, and the Chaos Factor decides whether you get it.",
      "Play the scene with the tools under the button: Roll a check, Ask Fate, Random Events, the Meaning Tables.",
      "End scene N: say whether you were in control, tidy your lists, and the Chaos Factor steps itself.",
      "Open a Mystery for anything you do not know yet — clues raise the odds and Fate decides when it breaks open.",
      "End the mission from the Solo screen when it is over — it closes the adventure and pays Classified's experience for you."
    ],
    note: "Fate answers what is true; skills, combat and damage stay on the ordinary Classified rules. The full walkthrough is on the Tutorial screen."
  },

  settings: {
    title: "How to use Settings",
    what: "Campaign style, theme, feature toggles, backups and wipes.",
    steps: [
      "Campaign style decides when Hero Points are earned — it is a table decision, not a preference.",
      "Toggles add or hide whole surfaces: the GM screen, solo play, manual dice entry.",
      "Export JSON before anything drastic; Import merges or replaces.",
      "Wipe data deletes every mission or every dossier, with no undo."
    ]
  },

  /* ---------------------------------------------------------------- solo panels */

  "solo.briefing": {
    title: "How to use the briefing",
    what: "The mission itself, rolled and then written in your own words.",
    steps: [
      "Roll all fills every row at once; a row you have written over is left alone.",
      "Roll a row to get its words, then write the line the words suggested to you.",
      "Objective and Complication become your first threads and the opponent your first character — word those lines at the bottom of the dialog before they go on.",
      "Opponent opens a full Classified stat block, ready to drop into an encounter.",
      "Copy puts the whole briefing on the clipboard; Edit reopens it at any time."
    ],
    note: "Skip it if you already know the mission — but the lists start empty, so early events have nothing to draw on."
  },

  "solo.scene": {
    title: "How to use the scene boundary",
    what: "The one button that moves the loop: it opens a scene, then closes it.",
    steps: [
      "Start scene N asks what you expect, then rolls d10 against the Chaos Factor.",
      "Over the Chaos Factor you play the scene you planned; at or under, an odd roll alters it and an even roll interrupts it.",
      "An altered scene rolls the Scene Adjustment table; an interrupt rolls a Random Event and offers to keep your planned scene as a thread.",
      "End scene N asks whether you were in control, steps the Chaos Factor, walks you through both lists, and asks which open mysteries the scene bore on.",
      "End the mission when it is over: it closes the adventure and fires Classified's End Mission for the linked dossier — experience, Reputation and the advancement gate."
    ],
    note: "Chaos falls when the scene went your way and rises when it did not. Higher chaos means more Yes answers, more events, and fewer scenes as planned."
  },

  "solo.check": {
    title: "How to use Roll a check",
    what: "The Classified half of a solo scene, on the dossier this adventure is linked to.",
    steps: [
      "Roll a skill for anything the character attempts — Fate never resolves that.",
      "Attack goes straight to the weapons on the sheet.",
      "Take damage applies a wound through the accumulation table, with the whole consequence chain.",
      "Everything lands in the same roll log as your oracle answers."
    ],
    note: "Ask Fate whether the guard is distracted; roll Stealth to get past him."
  },

  "solo.fate": {
    title: "How to use Ask Fate",
    what: "Closed questions about the world — the ones a referee would answer.",
    steps: [
      "Write a question that a Yes or a No actually settles.",
      "Pick the odds you would give it if someone were sitting opposite you.",
      "Tap Ask. The bands under the result show where the roll landed.",
      "An Exceptional answer is more than you asked for, or worse than a plain refusal."
    ],
    note: "Doubles at or under the Chaos Factor fire a Random Event as well as answering. Do not ask Fate whether you succeed at something — roll the skill."
  },

  "solo.events": {
    title: "How to use Random Events",
    what: "The referee interrupting: something happens that you did not plan.",
    steps: [
      "One fires by itself on a doubles roll within the Chaos Factor; roll one here when a scene stalls.",
      "The focus says what the event is about; the word pair colours it.",
      "Focuses that name a thread or a character draw from your lists — the buttons act on them for you.",
      "Re-roll the words if the pair says nothing; the focus stays."
    ]
  },

  "solo.meaning": {
    title: "How to use the Meaning Tables",
    what: "Open questions, answered with a word pair you interpret.",
    steps: [
      "Open a group and tap a table to roll two words.",
      "Read the first thing that fits the situation in front of you and move on.",
      "The same word twice is amplification, not a wasted roll.",
      "Baseline covers any scene; the rest point at what this game actually asks you to narrate."
    ]
  },

  "solo.mysteries": {
    title: "How to use Mysteries",
    what: "A question you cannot answer yet. Clues set the odds; Fate decides the moment. The app's own aid, not a Mythic procedure.",
    steps: [
      "+ New starts one on the objective, the complication, the opponent, the intel or a thread — or let the briefing's Hidden truth row roll whether the mission has one.",
      "+ Clue asks what you found, writes it down, then asks the chart whether it breaks open now: one clue is a long shot, three even money, six nearly certain.",
      "Tap a mystery's own title to reword it — one opened on a rolled thread starts life as a word pair.",
      "Clues also come from End Scene, an Exceptional Fate answer and an event that draws the mystery's own thread.",
      "It breaks open when Fate says so, which can be the second clue or the seventh. An Exceptional No is a lead going cold and costs you a clue; two plain refusals mean the trail was planted, and that gets rolled too.",
      "The reveal rolls the shape of the truth and a word pair, and shows it against the clues you wrote. A shape that names a person draws one off your Characters list; a reveal on the opponent adds a tell to their stat block; on the objective it offers to rewrite what the mission is for."
    ],
    note: "There is no clock on purpose — a clock would tell you which clue breaks it open, and nothing is written down until it does. A mystery nobody has touched for four scenes offers the Chaos Factor a step at End Scene."
  },

  "solo.threads": {
    title: "How to use Threads",
    what: "Everything the character is trying to do. This is the adventure's spine.",
    steps: [
      "+ Add a thread when a new goal appears in play.",
      "Tap a thread's text to reword it — a line seeded from a word pair rarely reads as a goal.",
      "Use + and − to weight one, so a pressing thread comes up more often.",
      "Randomise draws one across 25 slots when you need the adventure to pick for you.",
      "Strike a thread off at End Scene when it closes."
    ],
    note: "An empty list is why a solo adventure wanders: events that point at a thread have nothing to point at."
  },

  "solo.characters": {
    title: "How to use Characters",
    what: "Everyone who matters to the mission, on the same weighted list.",
    steps: [
      "+ Add anyone the fiction has committed to.",
      "Tap a name to reword it as play tells you who they actually are.",
      "Weight the ones the mission is about.",
      "Randomise picks one for an event that names a character.",
      "Remove them when they stop mattering — a stale list drags the oracle backwards."
    ]
  },

  "solo.journal": {
    title: "How to use the Journal",
    what: "The adventure as it happened: every Fate answer, event and boundary, newest first.",
    steps: [
      "+ Note writes anything the rolls did not.",
      "⧉ copies one entry; Copy all copies the lot, for pasting into a write-up.",
      "✕ deletes an entry you do not want in the record.",
      "Clear journal empties it and keeps the Chaos Factor, scene count and lists."
    ]
  }
};

export function helpFor(key) { return HELP[key] || null; }

export const HELP_KEYS = Object.keys(HELP);

/* ================================================================ the glossary */

/**
 * Plain-language definitions of every term the app puts on screen, for a player who has
 * read neither book. Two systems meet here, so each entry says which one it belongs to:
 * `classified`, `mythic`, or `app` for the handful of words this app itself uses.
 *
 * Copy, not rules: the numbers behind these terms live in `data.js` and `data-solo.js`, and
 * nothing here is authoritative. It is the sentence you would say to someone at the table
 * who asked "what's a Difficulty Factor?" — enough to keep playing, not the procedure.
 */
export const GLOSSARY = [
  /* --- the app's own words */
  { term: "Dossier", sys: "app", what: "A character. The app calls a character sheet a dossier, because the theme is a 1960s intelligence file." },
  { term: "House aid", sys: "app", what: "Something the app adds that is in neither book — End Scene and Mysteries. Always labelled, so you know it is not a rule you can look up." },

  /* --- Classified */
  { term: "d100", sys: "classified", what: "A roll from 1 to 100. The app rolls it for you unless you turn on manual dice entry in Settings." },
  { term: "Base Chance", sys: "classified", what: "Your raw ability at one skill: the characteristics it runs on, averaged and rounded down, plus your rank in it. It stops at 30." },
  { term: "Difficulty Factor", sys: "classified", what: "How hard the task is, on a ladder from ½ to 10. Higher is easier — it multiplies your Base Chance. An ordinary task is 5." },
  { term: "Success Chance", sys: "classified", what: "Base Chance × Difficulty Factor. The number your d100 has to come in under. A roll of 100 always fails, however high it is." },
  { term: "Success Quality", sys: "classified", what: "How well it went, not merely whether: Superb (1), Great (2), Good (3), Fair (4) or Failure. Most procedures care which." },
  { term: "Hero Point", sys: "classified", what: "A point you spend to bend a result: one shifts the Success Quality a step in either direction, or takes one rank off a wound." },
  { term: "Villain Point", sys: "classified", what: "The same currency in an important NPC's hands. It can only spoil what you did, never improve what they do." },
  { term: "Characteristic", sys: "classified", what: "One of the five ratings, 1 to 15: Strength, Dexterity, Willpower, Perception, Intelligence. Every player character starts at 5." },
  { term: "Skill Rank", sys: "classified", what: "Your training in one skill. It can never be more than the highest characteristic the skill runs on, plus 2." },
  { term: "Ability", sys: "classified", what: "A knack rather than a skill — First Aid, Connoisseur, your native language and one you pick. Fixed Base Chance 20, and it never improves." },
  { term: "Field of Experience", sys: "classified", what: "Knowledge you either have or you do not. It is never rolled: you know it, or you find someone who does." },
  { term: "Untrained", sys: "classified", what: "Using a skill you have no rank in: the characteristics only, and three steps harder on the Difficulty Factor ladder." },
  { term: "Creation Point", sys: "classified", what: "The budget you spend building a character. Your rank decides how many you get — 300, 600 or 900." },
  { term: "Experience", sys: "classified", what: "Paid at the end of a mission and spent on ranks and characteristics. Nothing may rise by more than one point per mission." },
  { term: "Reputation", sys: "classified", what: "How recognisable you are. It grows with what you do, and it can be bought back down with experience." },
  { term: "Speed", sys: "classified", what: "How many attacks you get in a round, from Perception + Dexterity. It also sets how fast you clear a holster." },
  { term: "Wound Rank", sys: "classified", what: "How badly hurt you are: Stun, Light, Medium, Heavy, Incapacitated. Wounds add together, and two Heavy wounds kill." },
  { term: "Damage Rank", sys: "classified", what: "A weapon's power, A through L. Read against your Success Quality it gives the wound you inflicted." },
  { term: "Pain Resistance", sys: "classified", what: "A Willpower roll a wounded character makes every round to keep acting through it." },
  { term: "Exhaustion", sys: "classified", what: "Three steps harder on everything, from carrying too much, running too far, or going too long without sleep. Rest clears it." },
  { term: "Misfire", sys: "classified", what: "A roll inside the weapon's misfire band jams it. A 100 on a Fire Combat roll wrecks it outright." },
  { term: "Mission", sys: "classified", what: "The book's unit of play, not the session. Ending one pays the experience, the Hero Point and the Reputation." },

  /* --- Mythic */
  { term: "Mythic", sys: "mythic", what: "The Game Master Emulator: a second system, by different authors, that answers the questions a referee would. It never touches a Classified roll." },
  { term: "Fate question", sys: "mythic", what: "A yes-or-no question about the fiction — is the guard still there? You say how likely it is, and the app rolls the answer." },
  { term: "Odds", sys: "mythic", what: "Your own estimate of how likely a yes is, on nine steps from Certain to Impossible. There is no right answer; say what you think." },
  { term: "Chaos Factor", sys: "mythic", what: "1 to 9, starting at 5: how far the adventure has got away from you. High chaos makes unlikely answers likelier and Random Events more common." },
  { term: "Exceptional Yes / No", sys: "mythic", what: "An answer that landed hard — more than you asked for, or considerably less. The app tells you which band the roll fell in." },
  { term: "Random Event", sys: "mythic", what: "Something you never asked about, breaking in. The app rolls what it is about, then two words to colour it." },
  { term: "Event Focus", sys: "mythic", what: "What a Random Event is about: a thread, a character, you, or the world at large." },
  { term: "Scene test", sys: "mythic", what: "The d10 at the start of every scene. Over the Chaos Factor you get the scene you expected; at or under it changes, or something else happens instead." },
  { term: "Altered scene", sys: "mythic", what: "The scene you expected, with one detail changed — someone missing, something added. The app rolls which." },
  { term: "Interrupt scene", sys: "mythic", what: "Your scene never happens: a Random Event takes its place. The plan you had is filed as a thread so it is not lost." },
  { term: "Threads", sys: "mythic", what: "One of the two Adventure Lists: the loose ends you are chasing. Twenty-five slots; entering one twice makes it come up more often." },
  { term: "Characters (list)", sys: "mythic", what: "The other Adventure List: everyone in play. Random Events draw from it, so keep it current." },
  { term: "Meaning Table", sys: "mythic", what: "A hundred words. The app rolls two of them; the pair is a prompt, not an answer — you decide what it means here." },
  { term: "Fate Chart", sys: "mythic", what: "The default way of answering a Fate question: a target number read off the odds and the Chaos Factor, rolled under on a d100." },
  { term: "Fate Check", sys: "mythic", what: "The alternative: 2d10 plus modifiers for the odds and the Chaos Factor. Same questions, no chart. Pick one per adventure." },
  { term: "Mystery", sys: "mythic", what: "This app's own aid, in neither book: something you suspect but cannot prove. Each clue raises the odds, and Fate decides when it breaks open." },
  { term: "Clue", sys: "mythic", what: "Anything you found that points at a mystery. Write down what it was — the reveal is read against your clues, not against the count." },
  { term: "Mission briefing", sys: "mythic", what: "This app's own opening step: the objective, the complication, your cover and the opponent, rolled before scene 1 so the lists are not empty." }
];

export const GLOSSARY_SYSTEMS = [
  { key: "classified", name: "Classified" },
  { key: "mythic", name: "Solo play (Mythic)" },
  { key: "app", name: "This app" }
];

/** Case-insensitive search over terms and definitions. */
export function glossaryFind(q) {
  const s = String(q || "").trim().toLowerCase();
  if (!s) return [];
  return GLOSSARY.filter(g => g.term.toLowerCase().includes(s) || g.what.toLowerCase().includes(s));
}

/* ================================================================ the tutorial */

/**
 * One mission, played from nothing to the after-action report, with the rolls that actually
 * came up as the running example. Read-only: it never touches an adventure, so it can be
 * opened mid-session.
 *
 * Where the example needs a Classified roll it shows the tap and the rule, rather than
 * re-teaching combat — the two systems working side by side is the thing worth showing.
 */
export const TUTORIAL = {
  title: "Running a solo mission",
  intro: [
    "Solo play is two systems working together. Mythic answers the questions a referee would answer — what is here, does it go your way, what happens instead. Classified answers what your operative manages to do about it, on the same Base Chance × Difficulty Factor rolls as any table game.",
    "This walks through one mission end to end. The rolls quoted are the ones that came up when it was played; yours will differ, and that is the point."
  ],
  steps: [
    {
      n: 1,
      title: "Have an operative",
      body: [
        "Solo runs on an ordinary dossier. Create one, or tap a published sample character on the Create screen to start immediately.",
        "In the example: Michelle Jackson, a Rookie freelancer with Driving 5 and a taste for other people's paperwork."
      ],
      tap: "Create → a rank, or a sample character"
    },
    {
      n: 2,
      title: "Turn solo play on",
      body: [
        "Settings → Solo play (Mythic). The Solo tab takes the Rules tab's place in the bottom bar; Rules stays on its Home tile.",
        "Open Solo and tap Start an adventure. Name it or leave it blank — the briefing can name it for you."
      ],
      tap: "Settings → Solo play, then Solo → Start an adventure"
    },
    {
      n: 3,
      title: "Roll the mission briefing",
      body: [
        "A new adventure opens on the briefing, before scene one exists. Roll each row and write the line the words suggested — the words are a prompt, not the answer.",
        "Codename rolled Nightjar Ash, so the mission became Operation Nightjar. Objective rolled Recover · Manifest, written as \"Recover the courier's manifest before it reaches the buyer\". Complication rolled Betrayal · Delay: \"the station chief is already compromised\".",
        "Objective and Complication become threads; the opponent becomes a character with a full Classified stat block behind them."
      ],
      tap: "Write the mission briefing → Roll on each row → Save"
    },
    {
      n: 4,
      title: "Start scene one",
      body: [
        "Say what you expect: \"I meet my contact at the freight office to confirm the manifest.\" Then the app rolls d10 against the Chaos Factor, which starts at 5.",
        "Rolled 7 — over the Chaos Factor, so the scene happens as expected. A 3 would have altered it; a 4 would have interrupted it with a Random Event."
      ],
      tap: "Start scene 1 → type the expectation → Test the scene"
    },
    {
      n: 5,
      title: "Play the scene, asking Fate what a referee would answer",
      body: [
        "\"Is the contact already here?\" Odds: Likely. Target 75 at Chaos Factor 5; rolled 31 — Yes.",
        "\"Is he alone?\" Odds: 50/50. Target 50; rolled 88 — No. Someone is with him, and that is now a fact.",
        "Do not ask Fate whether you succeed at something. That is a Classified roll: Perception to read the second man's stance, opened from the sheet, Base Chance × Difficulty Factor as usual."
      ],
      tap: "Ask Fate → odds → Ask · Sheet → Perception",
      rule: "resolution"
    },
    {
      n: 6,
      title: "Take the Random Events when they come",
      body: [
        "\"Does he hand the manifest over?\" rolled 44 — a Yes, and a double 4 at Chaos Factor 5, so an event fires as well.",
        "Focus rolled NPC Action, drawing the station chief off the Characters list; the word pair came up Conceal · Urgently. Read as: the chief is already at the freight office, moving something out of sight.",
        "An event that names a list carries a button that acts on it — add the new character, strike off the thread that closed."
      ],
      tap: "the event modal → Add to Characters, or Strike that thread off"
    },
    {
      n: 7,
      title: "Roll a Meaning Table when the question is open",
      body: [
        "Fate answers yes or no. When the question is \"what is in the case?\", roll a table instead.",
        "Object & Equipment gave Microfilm · Forgery — the manifest is a forgery, and the real cargo is on film. The mission has changed shape, and nothing in the app decided that but the two words."
      ],
      tap: "Meaning Tables → a group → a table"
    },
    {
      n: 8,
      title: "End the scene",
      body: [
        "One question decides the Chaos Factor: was the character in control of how it went? The chief slipping away with the film says no, so Chaos steps 5 → 6 and the world gets a little less predictable.",
        "The same dialog is where the lists are kept honest: strike \"confirm the manifest\" off, add \"find where the film went\", add the chief to Characters."
      ],
      tap: "End scene 1 → Yes or No → tidy the lists → End scene"
    },
    {
      n: 9,
      title: "Put the question you cannot answer to Fate",
      body: [
        "The forged manifest raised a question the mission could not answer yet: who wanted the film. That went on the objective as a mystery — and the briefing's Hidden truth row had already hinted the objective was not what it appeared.",
        "Clues came in as play turned it up: one marked by hand, one from a scene at End Scene, one from an Exceptional Fate answer. Each clue asks the chart whether it breaks open now, at odds the clues have earned — one clue is a long shot, three even money, six nearly certain. This one held out to the fourth.",
        "The reveal rolled Not what it claimed, coloured Delusion · Friendship: the courier had been running the film for a friend who no longer existed. Because the answer is rolled at the reveal rather than stored in advance, it could not contradict anything already played — and because Fate decides the moment, nothing had told me which clue would be the one."
      ],
      tap: "Mysteries → + New → the objective → + Clue"
    },
    {
      n: 10,
      title: "Keep looping until the mission resolves",
      body: [
        "Scene two started at Chaos Factor 6 and rolled a 2 — even, so it was interrupted. The planned stakeout never happened; the event was PC Negative, read as the freight office being raided while the operative was still inside.",
        "That is the loop: start, play, end, repeat. Threads open and close, the Chaos Factor drifts with your grip on events, and the journal writes itself as you go."
      ]
    },
    {
      n: 11,
      title: "Close the mission",
      body: [
        "When the last thread closes, the mission is over. Ask Fate if you are unsure — \"Is this finished?\" at Unlikely is a legitimate question.",
        "End the mission from the Solo screen: it asks how it ended, says what is still open, closes the adventure, and fires Classified\'s own End Mission for the linked dossier — experience from rank, outcome and role-playing, a Hero Point on a success, and the one-advance-per-mission gate cleared. One undo covers both halves.",
        "The closed adventure stays readable and the primary action becomes Start a new adventure. Copy all on the journal gives you the whole mission as text for a write-up.",
        "Spend experience takes you straight to Advancement from the completion dialog."
      ],
      tap: "Solo → End the mission → outcome → End Mission · Journal → Copy all",
      rule: "advancement"
    }
  ],
  outro: [
    "Two habits carry a solo game further than any table: ask Fate only what a referee would decide, and keep the Threads and Characters lists current. The oracle can only point at what you have written down."
  ]
};
