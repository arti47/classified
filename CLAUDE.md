# Classified Player — canonical project spec

> Instantiated from *RPG Player-Character App — Autonomous Build Instructions (v2)*.
> **This file is canonical.** Every code change updates it in the same change: features,
> data model, file tables, roadmap checkboxes, ledger ticks, changelog. A code change with
> a stale CLAUDE.md is incomplete.

---

## 1. What this is

| | |
|---|---|
| **Game** | Classified (Expeditious Retreat Press), core rulebook only — a retro-clone of the system originally designed by Gerard Christopher Klug. OGL 1.0a. |
| **Audience** | Players, with an opt-in GM screen |
| **Platforms** | One installable PWA: phone, browser, desktop |
| **Core job** | Creation wizard + full in-play tracker + native dice engine + opt-in Mythic solo engine |
| **Solo play** | Mythic Game Master Emulator layered on top, behind a toggle. Second system, second source — see §2 and §3.20. |
| **Multiplayer** | Local-first. Sync architected from day one (schema, roles, security rules, `sync.js`), build gated behind First Session Playable. |
| **Backend** | Firebase Realtime Database + Storage; runs with zero keys in local mode |
| **Theme** | 1960s intelligence dossier — kraft/manila paper and typewriter faces in light mode, a dim operations room in dark, a red classification stamp as the single accent. Light + dark, default follows system. No rulebook art, logos or trade dress. |

### 1.1 Product Decisions

Recorded at Stage B. The user asked for an autonomous build with no Q&A round trip, so
these are the template's defaults applied deliberately, and each is reversible in Settings.

| Decision | Choice | Consequence |
|---|---|---|
| Usage mode | Local-first, sync later | Phase 5 gated behind First Session Playable |
| User's seat | Player, GM screen available | GM tab hidden until toggled on |
| Dice input | Digital, with manual physical-dice entry behind a toggle | `getD100()` is the single entry point for every roll |
| Expansion commitment | None — only the core book was supplied | No `data-<expansion>.js` files |
| Table device | Mixed, phone-first | Zero horizontal overflow at 360px is a test |
| Theme default | Follow system | `prefers-color-scheme` with an in-app override |
| Campaign style | Adventurous (the book's own default) | Sets when Hero Points are earned; changeable in Settings |

### 1.2 Solo Decisions

Recorded at the Phase 7 request, one question at a time. Unlike §1.1 these are the user's
own answers, not template defaults.

| Decision | Choice | Consequence |
|---|---|---|
| Engine scope | Full Mythic GME engine, not tables alone | Fate, Chaos Factor, scenes, Random Events, Adventure Lists all ship |
| Fate mechanic | Fate Chart is the default; Fate Check selectable | `fateMode` per adventure, d100 idiom matches Classified |
| Solo surfaces | One tab carrying the whole adventure engine | Chaos + scene header, Fate box, events, lists, meaning roller, journal |
| Tables shipped | All 9 word tables from the supplied report | 900 baseline entries; the World History router is a worksheet diagram, not shipped |
| Custom tables | 28 authored Classified-flavoured tables | 2,800 further entries built by the report's own 5-step method (§3.20.2) — one table per subsystem the game actually has |
| Integration | Full — shared roll log, per-character link, one storage layer | Oracle rolls are ordinary roll-log rows; solo state exports with the backup |
| Gating | `solo` toggle, off by default | Solo replaces Rules in the bottom nav when on; Rules stays on Home |
| Persistence | Per-adventure records | Named adventures, switchable and archivable |
| Scene bookkeeping | Guided one-tap End Scene with undo | Mirrors the existing lifecycle engine |
| Meaning roller | Rolls a word pair by default | Doubles reported as amplification, per the report |
| Missing GME tables | Reconstructed and flagged, then **replaced by the printed originals** | The Fate Chart, Fate Check, Event Focus and Scene Adjustment tables were all supplied as images afterwards. Nothing in the solo layer is unsourced — ruling S1 |

---

## 2. Source

The rulebook was supplied as pasted text of the complete core book — every chapter from
Introduction through Resources, including all tables, the equipment catalogues, the OSIRIS
chapter and the character sheets. It is authoritative for everything it contains, which is
the whole core book. Nothing was filled in from memory of the game.

**Transcription damage found and handled** (see §3 rulings): the Multiplication Table and
Success Quality Table each carry a typesetting error; the Physical Traits and Wound Rank
Accumulation tables arrived column-scrambled and were reconstructed from context.

**Scans supplied after the first build** confirmed all four reconstructions and corrected
one rule (A11). A second source, the *Character Sheets & Sample PCs* PDF, supplies five
published pre-generated characters — see §3.19 for what could and could not be extracted
from it, and §11 for how they are used as fixtures.

**A third source covers solo play and is a different game.** *Custom Elements Meaning
Tables — a report based on Mythic Magazine Volume 38* (Word Mill Games) was supplied as
Markdown. It is authoritative for what it contains: the table-construction method, the ten
Anything Words, the doubles rule, and nine complete 100-word tables (Action 1/2,
Descriptor 1/2, Locations, Characters, Objects, Genre, Tone). It does **not** contain the
GME core procedures — no Fate Chart, no Event Focus table, no Scene Adjustment table. The
report's §5 World History Paths is a worksheet routing diagram, not a table, and is not
shipped.

**Printed images of every missing procedure were supplied after the first solo build** and are
the source of record for them: the Fate Chart (9 odds × Chaos Factor 1–9, all three numbers
per cell), the Random Event Focus Table, the Scene Adjustment Table, and the Fate Check page
with its Modifiers and Answers tables. All are transcribed rather than reconstructed, with
committed fixtures holding the printed values (ruling S1). Nothing in the solo layer is
guesswork now, and no `verify` flag remains.

Classified rules and Mythic rules never mix in one file: `data.js` and its siblings stay
core-book-only, and every Mythic value lives in `data-solo.js`.

---

## 3. System Profile (completed)

### 3.1 Core resolution mechanic

**Base Chance × Difficulty Factor = Success Chance.** Roll d100 against the Success Chance
row on the Success Quality Table for Superb (1), Great (2), Good (3), Fair (4) or Failure.

- Base Chance = skill formula (one or two characteristics, averaged and rounded down) +
  Skill Rank, **capped at 30**.
- Difficulty Factor ladder: ½, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10. Base 5. **Higher is easier.**
  Modifiers move it one step at a time and it can never leave the ladder.
- Success Chance ranges 1–300. Above 100, only a d100 of 100 fails. **A 100 always fails.**
- No crit/fumble dice; the Quality tiers do that work. Weapons carry a **Misfire** range
  (e.g. 98–99); a 100 in Fire Combat wrecks the weapon.
- No push/re-roll economy. The re-roll analogue is **Hero Points**, which shift the Quality
  after the fact (§3.3).
- Untrained skill use: characteristic-only Base Chance at **−3 Difficulty Factor**.

*Archetype:* none of the template's five. It is a percentile-under system whose target
number is built by multiplication, with a four-tier success ladder rather than a binary.

**Implementation:** `qualityBands()` derives the printed table as a pure function of the row
index, which is why the two printed errors below never enter the app.

### 3.2 Opposed / contested test procedure

Classified has **no single opposed mechanic**. It has a family of two-stage procedures,
all of the shape *actor rolls → the actor's Success Quality becomes the opponent's
Difficulty Factor*, plus a family of cross-reference tables. Both are implemented.

**Quality-as-Difficulty-Factor procedures:**

| Procedure | Actor | Opponent | Failure case |
|---|---|---|---|
| Seduction (5 staged rolls) | Seduction at the stage's DF (10/9/8/6/4) | Willpower at DF = actor's Quality | Actor failure → opponent resists at DF 10 |
| Disguise | Disguise | Perception at DF = disguise Quality | Failed disguise → observer at DF 10 |
| Fast Turn (chase) | vehicle skill at the bid | Perception at DF = **twice** the Quality | — |
| 180 Turn (chase) | vehicle skill at the bid | matching 180 Turn at DF = Quality | Range jumps to Distant |
| Tailing | movement skill at DF 5 | Sixth Sense at DF = **twice** the Quality | — |
| Stealth | Stealth | Fair (4) result → observers get a DF 5 Perception check | Failure → automatically noticed |

**Cross-reference table procedures:** Persuasion (Quality × NPC Willpower → Yes/Perhaps/No),
Interrogation and Torture (Quality × victim Willpower → a *modified* Quality, which then
reads information yield off the Skill Time and Information table), Reputation (Perception
Quality × Reputation band → Yes/Perhaps/No), and Gambling (first-roll Quality × second-roll
Quality → hand result).

**Ties:** none of the procedures produce a tie. The only genuine tie is a **Draw Situation**
(d100 + Speed bonus each side, higher fires first), which the book leaves to the GM; the app
reports a dead heat rather than inventing a rule.

**Resource banking:** nothing is banked or carried over. A losing seduction stage costs a −2
Difficulty Factor on later attempts; that is the only residue in the system.

### 3.3 Meta-currencies

**Hero Points** (players) and **Villain Points** (powerful NPCs). No other pool exists — no
group currency, no GM mirror economy.

- **Starting:** Rookie 3, Agent 6, Special Agent 9. NPCs roll: Punk `1d10−4`, Criminal
  `4 + (1d10−5)`, Villain `9 + (1d10−5)`.
- **Earning** depends on campaign style: Adventurous and Realistic award 1 on a Superb (1)
  on any check **except Fire Combat and Hand-to-Hand**; Cinematic includes combat rolls;
  Heroic awards on a Great (2) or better including combat. A Superb bought with Hero Points
  earns nothing back. Every successful mission awards 1 to each character regardless of
  style.
- **Spends:** 1 point per Success Quality step (either direction), 1 point per Wound Rank
  reduced, GM-negotiated environment alteration, 3 to force a keypad lock, 2–3 to shrug off
  a drug or poison, 3 to escape detonation cord, 1 to escape a garrote, 1 to throw a live
  grenade clear.
- **Cap:** none printed. **Decay:** none. Points persist across missions.
- **Timing rule that matters:** for checks the GM rolls in secret, the spend must be
  committed *before* the result is revealed, so points can be wasted. Villain Points may
  only counter a character's action, never amplify the villain's own. Hero Points may be
  spent for another character — except while Gambling.

### 3.4 Attributes & scales

Five characteristics, range 1–15, **all player characters start at 5**. Point-buy only:
6=10, 7=20, 8=30, 9=40, 10=50, 11=60, 12=80, 13=100, 14=120, 15=140 Creation Points. The
book gives no rolled or array method for PCs. NPCs use 1d10 stereotype tables instead
(§3.18).

Strength, Dexterity, Willpower, Perception, Intelligence. The book prints their relative
weight across the skill list: INT 8, DEX 5, PER 5, WIL 4, STR 2.5.

### 3.5 Derived stats

Every one is a table lookup, not a formula. **Nothing is computed from a rating.**

| Derived | Source | Values |
|---|---|---|
| Carrying Capacity | STR | <6: 60–100 lbs · 6–10: 101–150 · 11–13: 151–210 · 14: 211–280 · 15: 281–350 |
| Running/Swimming | WIL | <6: 10 min · 6–10: 25 · 11–13: 40 · 14: 55 · 15: 60 |
| Hand-to-Hand Damage Rank | STR | <9: A · 9–13: B · 14–15: C |
| Speed | PER + DEX | <8: 0 · 8–15: 1 · 16–23: 2 · 24–30: 3 |
| Stamina | WIL | <6: 24 h · 6–10: 28 · 11–13: 30 · 14: 33 · 15: 36 |
| Draw bonus | Speed | 0: +0 · 1: +20 · 2: +40 · 3: +60 |
| Movement | Speed | normal 10 × Speed ft · defensive 5 × Speed ft |

Carrying Capacity holds for **Willpower minutes**; beyond that, exhaustion at −3 Difficulty
Factor until 15 minutes of rest.

### 3.6 Skills

25 skills. Base Chance = floor(formula) + Skill Rank, capped at 30. **Rank cap = highest
underlying characteristic + 2**, except Language, which has no cap.

Every character begins with **Charisma and Driving at rank 1**. Costs: 10 Creation Points to
acquire, 2 per further rank.

**Abilities** are a separate class: fixed Base Chance **20**, never improvable. Everyone has
Connoisseur, First Aid and their Native Language; each character picks a fourth from
Boating, Cryptography, Demolitions, Disguise, Diving, Electronics, Gambling, Language,
Mountaineering, Pickpocket, Piloting, Riding, Science.

Specialisation: Science specialists get +2 Difficulty Factor in field and −1 outside it.
Weapon specialisation is an optional GM rule (+1 DF with a chosen model, offset by a
negative the GM and player agree). Neither is automated; both are recorded in the library.

Sixth Sense is **GM-rolled only** — a player can never invoke it. Flagged in the data and
marked on the sheet.

### 3.7 Creation options

Rank → Creation Points (Rookie 300, Agent 600, Special Agent 900). Then, in rule-legal
order: gender (descriptive; switches the height/weight column), height and weight band,
appearance, characteristics, skills, Weaknesses (+Creation Points), profession and years.

- **Physical traits** are charged *and* add Reputation. Average is the most expensive
  choice; Gorgeous is the cheapest and adds 50 Reputation.
- **Weaknesses** grant 5–13 Creation Points each; the book suggests no more than two.
- **Profession**: 1–6 years. Each year gives 2 Creation Points spendable only on that
  profession's listed skills, one Field of Experience, 6 Reputation, and a year of age from
  a base of 25.
- **Fields of Experience** are binary knowledge, never rolled. Two General Fields may
  replace one profession Field.
- **Scar check** at creation: Agent 50%, Special Agent 75%. Each visible scar is +20
  Reputation.

### 3.8 Shared group entity — **ABSENT**

Classified has no party-level entity. No House, crew, ship or covenant. The `group` node
exists in the Firebase schema shape but is unused, and there is no group wizard.

### 3.9 Conditions & statuses

There is no separate condition list. **Wounds are the condition system**, and they carry
teeth automatically:

| Wound | Standing DF | Draw | Pain Resistance | Scar chance |
|---|---|---|---|---|
| Stun | — | — | DF 8 STR (H-to-H) or DF 8 WIL (Fire) | — |
| Light | −1 | −20 | DF 7 Willpower, every round | — |
| Medium | −2 | −40 | DF 5 Willpower, every round | 5% |
| Heavy | −3 | −60 | DF 3 Willpower, every round | 15% |
| Incapacitated | −3 | −60 | none on waking | 25% |

Plus **Exhaustion** (−3 DF) from carrying, running/swimming or stamina overrun, and
**Weaknesses**, which force a Willpower roll when triggered; failure raises the Difficulty
Factor of the action at hand. All of these feed `conditionDFMod()` and are applied to every
roll automatically when the toggle is on.

### 3.10 Health, damage & death

Damage is **Success Quality × the weapon's Damage Rank (A–L)** read off the Wound Rank
Table. Close range adds a rank, long range subtracts one. Specific Fire and Targeted Blows
add **+2 Wound Ranks**.

Wounds are **additive** via the accumulation table — two Heavy Wounds kill, a Medium on top
of Incapacitation kills.

**Death procedure.** There is no death spiral or death save. Killed is a table result,
reached either directly (Superb with Damage Rank H+) or through accumulation. The escape
hatches, all implemented in the guided damage flow:

1. **Hero Points** — 1 point per Wound Rank reduced, spent by the target after the hit.
2. **Strength shrug-off** — STR 14–15 reduce a Hand-to-Hand wound by **two** ranks on a
   DF 5 Strength check, but only from bare hands or blunt weapons, never sharp ones.
3. **Body armour** — reduces the Damage Rank by 2–8 steps before the wound is read; a
   successful Targeted Blow or Specific Fire ignores armour entirely.
4. **Vehicle occupancy** — occupants take one rank less than the vehicle, seat belts
   another, airbags one more (single 3-rank hits only, once).

Incapacitation lasts 1–10 minutes unarmed, 1–10 hours from weapons; the character wakes at
Heavy with no Pain Resistance rolls.

### 3.11 Rest & recovery

| Method | Effect | Limit |
|---|---|---|
| First Aid | −1 Wound Rank | **Once per wound, within one hour of the wounding** |
| Natural | −1 rank per week | none |
| Hospital | −1 rank per three-day stay | **Maximum two ranks**, then natural rate |
| Field medicine (Medicine FoE) | as hospital | GM approval, supplies, and a First Aid check |

Exhaustion clears with 15 minutes (carrying), 30 minutes (running/swimming) or 5 hours
sleep (stamina). The once-per-wound First Aid limit is enforced by a state flag cleared at
End Session.

### 3.12 Scene / session / adventure lifecycle

The book's unit of play is the **mission**, not the session. It defines no formal scene
boundary, so the app's End Scene is an explicitly labelled house aid for clearing per-scene
combat flags; End Session and End Mission are the book's own.

- **End Scene** *(house aid)* — clears aim, cover, posture, defensive movement, and combat
  declarations.
- **End Session** — clears exhaustion, resets rest flags, re-arms First Aid for new wounds.
- **End Mission** — awards experience (500 base, modified by rank, outcome and role-playing),
  +1 Hero Point on success, +3 Reputation plus any kill/scar Reputation, unlocks the
  one-advance-per-mission gate, and reminds the table to return requisitioned equipment.

Each fires its whole bundle, shows a summary of exactly what changed, and stores a one-step
undo snapshot.

### 3.13 Extended / progress tasks

The book's multi-roll efforts are **chases** (bidding rounds), **seduction** (five stages),
**multi-session interrogation** (+1 DF cumulative, reset by sleep), **healing** (weeks or
three-day stays), **data scrubbing** (100 XP per point over a month) and **mission
timetables**. There is no unified progress-clock mechanic.

One generic pip tracker serves them all, on the Combat screen. Chases and seduction get
their own purpose-built flows because their procedures are specific.

### 3.14 Powers / magic — **ABSENT**

Classified has no magic, psionics or special abilities. There is no `power-automation.js`.

The equivalent surface is **equipment with embedded mechanics** — the anesthetizer
cigarette's two serial Willpower rolls, the umbrella airgun's three-stage toxin, the bolt
and lift's Fire Combat check, garrotes, gas defences. These are catalogued with their exact
procedures; weapons are fully "tap to use" through the attack flow.

### 3.15 Advancement

500 experience per completed mission, modified: Rookie −125, Agent 0, Special Agent +500;
success +500, partial 0, failure −375; role-playing up to +750 or down to −250.

Costs: Skill Rank **30 × final rank**; Characteristic **150 × final value**; new skill 100;
Reputation reduction 100 per point; large equipment 500, modified large 700 + 50 per
modification, personal equipment 200.

**Gate:** no Skill or Characteristic may rise more than **1 point per mission**. Enforced by
`advancedThisMission`, cleared at End Mission.

The identity mechanic that interacts with advancement is **Reputation** — it accrues from
play (mission 3, kill 5, henchman 10, villain 15, scar 20, promotion 20) and is bought down
with experience, so growing more capable makes you more recognisable.

### 3.16 Inventory, encumbrance & wealth

**Weight-based, with a duration clause.** Carrying Capacity by Strength gives a range; the
maximum can be carried for Willpower minutes before exhaustion at −3 Difficulty Factor.
Lighter loads are indefinite; heavier loads are impossible.

Currency is plain **US dollars**. Agency characters are equipped by their organisation and
Persuade the armourer for anything unusual (two special requests per mission is the book's
suggested cap); freelancers buy their own. No coin weight, no abstract wealth index.

Weapons carry a **Concealment Modifier**; spotting a concealed weapon is a DF 5 Perception
check. Vehicles carry **Modification Points** which both limit modifications and set how
much damage the vehicle absorbs for its occupants.

### 3.17 Combat structure

**Two phases, opposite directions.** Declaration runs slowest-first so the fastest declare
last and act on the best information; the Action phase resolves in reverse so the fastest
act first and can interrupt. Order is fixed for the whole encounter; ties broken by d100,
low declaring first.

- Attacks per round = **Speed**, capped by the weapon's Rate of Fire. Speed 0 acts every
  other round.
- Hand-to-Hand base Difficulty Factor is **5 minus the target's Speed**. Engagement range
  10 feet.
- One Specific Action per round, plus punches and kicks up to Speed.
- **Draw Situations** are the only legal change of a declared action.
- Movement is abstract — no grid, no zones. Normal 10 × Speed feet, defensive 5 × Speed feet
  at −4 DF to shoot the mover.
- **One conflict scale.** Chases are a separate subsystem, not a second combat scale.

### 3.18 Bestiary & NPCs

**No monster bestiary.** The book's only creature stat blocks are five animals: alligator/
crocodile, guard dog, horse, piranha (a schedule of escalating wounds rather than attacks),
and shark.

NPCs are generated from a **tier system**: eight stereotypes (Civilian, Contact, Covert
Operative, Foil, Henchman, Primary Opponent, Security, Technician) × three ranks (Punk,
Criminal, Villain), each with a 1d10 characteristic table and a 1d10 skill package, plus a
per-stereotype rank modifier. Hero/Villain Points and Reputation roll from rank-based dice.

**Interaction Modifiers** are the NPC-facing mechanic: they apply as Difficulty Factor
modifiers when a *player character uses that skill on the NPC*, never the reverse.

The seven **OSIRIS** antagonists are published as full stat blocks and are extracted
complete. They run on NPC rules (Villain/Criminal ranks with Villain Points).

### 3.19 Pre-generated characters — **SHIPPED**

The core book points at downloadable pregens rather than printing them. The supplementary
*Character Sheets & Sample PCs* PDF supplies **five**: Michelle Jackson, Johnathan Sawyer,
Godwin Georges and Emily Steele (Rookies) and Aidan Hunter (Special Agent). They run on PC
rules, unlike the OSIRIS seven, which are NPCs.

`data-pregens.js` stores only their **skill ranks**. Formula Totals and Base Chances are
derived by the app from the characteristics, so the handful of arithmetic slips on the
printed sheets are corrected rather than reproduced. Each pregen carries a `sheetNotes`
list recording exactly what its sheet gets wrong. One-tap instantiation lives on the Create
screen.

All 114 printed Base Chances across the five sheets are regression fixtures (§11).

### 3.20 Solo rules — **MYTHIC LAYER, PLANNED**

Classified itself has no solo oracle or procedures; nothing in §3.20 comes from the core
book. Solo play is a **second system bolted on**, the Mythic Game Master Emulator, behind
the `solo` toggle. Everything below is Mythic's, not Classified's, and the UI labels it as
such so the two are never confused at the table.

#### 3.20.1 The Mythic layer

| Piece | Procedure | Where |
|---|---|---|
| **Fate question** | Pick odds from the nine-step ladder (Certain → Impossible), read the target against the current Chaos Factor, roll d100 under it for Yes. Low fifth of the Yes range is an **Exceptional Yes**; top fifth of the No range an **Exceptional No**. | `fateTarget()`, `fateChartAnswer()` |
| **Fate Check** | The chartless alternative: 2d10 + odds modifier + Chaos Factor modifier, both read off the printing's single Roll Modifier column. 11 or more is Yes, **18 or more** an Exceptional Yes, **4 or less** an Exceptional No — fixed totals, not a margin. Double digits **within** the Chaos Factor fire a Random Event. Selectable per adventure. | `fateCheckAnswer()` |
| **Random Event trigger** | On the Fate Chart, a doubles roll (11, 22, … 99) whose tens digit is at or under the Chaos Factor fires a Random Event **as well as** answering the question. | `isRandomEventRoll()` |
| **Random Event** | Roll the Event Focus table, then roll a word pair from a Meaning Table to colour it. Focuses that name a thread or character draw from the Adventure Lists. | `rollRandomEvent()` |
| **Chaos Factor** | 1–9, clamped. Starts at 5. Falls one step when the scene went the character's way, rises one step when it did not. | `stepChaos()` |
| **Scene test** | At scene start, roll d10: over the Chaos Factor the expected scene happens; at or under, an **odd** roll alters it and an **even** roll replaces it with an **interrupt** scene built from a Random Event. | `sceneTest()` |
| **Scene Adjustment** | The altered-scene table: remove or add a character, reduce or increase an activity, remove or add an object, or on 7–10 **make two adjustments**, each rolled again. The app expands the recursion rather than leaving it to the player. | `sceneAdjustment()` |
| **Adventure Lists** | Threads and Characters, 25 slots each, weighted by repeated entry. Randomising a list rolls d100 across the slots so frequently entered items come up more often. | `rollList()` |
| **Meaning Tables** | 37 tables of 100 words. Rolled as a **pair** by default; the same word twice is amplification, not a re-roll. | `rollMeaning()` |

**Two Chaos Factor adjustments, deliberately.** The chart moves **one ladder position per
point** (`chartChaosStep()`), which is what makes it a diagonal. The check's printed Chaos
Factor column reuses the Roll Modifier column, so its adjustment is the same uneven ladder as
the odds — ±5, ±4, ±2, ±1, 0 (`chaosMod()`). They are different shapes and must not be
collapsed into one function; the book itself notes that the Chaos Factor swings Exceptional
results further under the check.

**How the chart is built.** The printing is **one ladder read diagonally** — every cell equals
the cell up and to its left — so the app stores the ladder and indexes it, rather than keeping
81 literal cells:

```
ladder index = odds rank + (Chaos Factor − 5), clamped to ±8
targets:  1  1  1  5 10 15 25 35 50 65 75 85 90 95 99 99 99      (index −8 … +8)
```

One point of Chaos Factor therefore moves exactly as far as one step of odds, which is why
Impossible at Chaos Factor 9 is the same 50 as 50/50 at Chaos Factor 5, and why Certain at
Chaos Factor 5 is 90 rather than 99. All 81 printed cells reproduce from this, targets and
both exceptional bands, against a committed fixture.

**What the Mythic layer does not do.** It never touches Classified's resolution mechanic. A
Fate question is not a skill check: skill checks stay Base Chance × Difficulty Factor
through `resolve()`. The solo engine answers questions about the fiction and hands the
result back to the player, who then rolls Classified normally for anything the character
attempts.

#### 3.20.2 Meaning Tables shipped

**Baseline, extracted from the supplied report (9 tables, 900 words):** Action 1, Action 2,
Descriptor 1, Descriptor 2, Locations, Characters, Objects, Genre, Tone. Verbatim, because
a paraphrased word list is a different table.

**Authored for Classified (28 tables, 2,800 words):** built by the report's own five-step
method for this app's 1960s-espionage context, seeded with the ten Anything Words and
finished with neutral filler per Steps 4 and 5. Step 1 of that method is to define the
subject, so the subjects are the game's own subsystems: every §3 procedure that a solo player
has to narrate rather than roll has a table pointed at it.

| Set | Tables | Points at |
|---|---|---|
| Core espionage | Espionage Action · Espionage Description · Agency & Tradecraft · Adversary · Location · Object & Equipment | the general run of play |
| Mission-shaped | Mission Objective · Complication · Cover Identity · Intel & Rumour | §3.12 missions, §3.7 cover, the Skill Time and Information table |
| Flavour | Codename Words · Surveillance & Chase · Gadget Quirk | naming, §3.17 tailing, §3.14 equipment |
| In play | Combat Action · Wound & Injury · Vehicle & Chase · Reaction & Attitude · Coercion & Pressure · Social & Seduction | §3.17 combat, §3.10 wounds, §3.13 chases, §3.18 Reactions, §3.2 Interrogation and Seduction |
| World | Weather & Time · Sensory Detail · Terrain & Environment · Organisation & Faction | scene backdrop, and the institutions §3.18 NPCs belong to |
| Story | Mission Twist · Scene Framing · Motive & Secret · Leverage & Money · Consequence & Aftermath | interrupt scenes, NPC motive, §3.16 money, mission aftermath |

Two tables pair across rather than rolling twice on themselves: Combat Action draws its
second word from Espionage Description, and Scene Framing draws its second from Location, so
an interrupt scene arrives with a place attached.

Authored tables carry `authored: true` and baselines carry `source: "mm38"`, so the two are
never presented as one provenance (ruling S6).

#### 3.20.3 Integration with Classified

- Every Fate, event and meaning roll writes a row to the **shared roll log** through
  `Store.addRoll()`, so a solo session reads back in one place with the character's checks.
- A solo adventure **links to a dossier** by `characterId`, and the Event Focus results that
  name the player character resolve to that dossier's name.
- Solo state lives in the same `localStorage` layer and rides along in **JSON export and
  import**.
- **Hero Points are untouched.** Neither book connects them to Fate, so the app does not
  invent a link.
- Solo is **not synced**. Mythic replaces the GM; a shared campaign has one, so there is no
  `solo` node in the Firebase shape.

#### 3.20.4 The sequence of play, and how the screen follows it

Mythic is a loop, and the Solo screen is ordered as that loop rather than as a menu of every
Mythic feature:

```
briefing ──Commit──▶ setup ──Start scene──▶ play ──End scene──▶ setup (next scene)
```

`scenePhase` (§6) is what makes the screen know where it stands, and only one control changes
with it: the **primary action**, which reads `Write the mission briefing` at briefing,
`Start scene N` at setup and `End scene N` in play. Under it sit the in-scene tools — Ask Fate, Random Events, the Meaning Tables — then the
Adventure Lists, the journal, and the reference. Nothing is gated: an oracle question between
scenes is legitimate, so the in-play block stays usable and is merely quietened when no scene
is open (ruling S9).

**Starting an adventure asks nothing.** The tap creates it and lands on the briefing: no name
prompt, because the briefing's first row rolls a codename and names the adventure with it, and
no dossier chooser, because the dossier already open is the answer in every case but a
deliberate switch. Both are in Adventure settings if the guess is wrong (ruling S19).

**The mission briefing** is the phase a new adventure opens in. Mythic assumes you arrive
with a premise; Classified missions are briefed, and an adventure that opens on an empty
Threads list gives the first Random Event nothing to point at. Seven rows — codename, genre
and tone, objective, complication, cover identity, intel, and a Primary Opponent — each roll
their words straight into an editable field, because the words are the prompt and the field
is the answer. Committing writes the objective and the complication into Threads and the
opponent into Characters, names an untitled adventure from its codename, and moves the phase
to setup. **Roll all** fills every row that still holds
its own words in one tap, and leaves anything you have written over alone. The lines that go
on the Adventure Lists are fields of their own at the foot of the dialog: they track their row
until you write in one, so a thread is worded before it is added rather than after (ruling S22).
It is skippable, and editable afterwards from Adventure settings — an edit never
re-seeds the lists, so nothing you struck off comes back. The committed briefing is pinned
under the primary action in an accordion that starts closed: it is reference, not a step
(rulings S14, S15). A pinned row prints the words that prompted it only once they are no
longer what it says — an unedited row *is* those words joined, so printing both repeats it
(ruling S18).

**The Primary Opponent** is a Classified stat block with a Mythic identity in front of it.
The stat block comes from the NPC generator by dynamic import (S15); the codename and the two
words that say what they are come from `espCodename` and `espAdversary`. The generator alone
names an NPC after its own stereotype and rank, which for this row is the constant string
*Villain Primary Opponent* — a category, not a person (ruling S16).

**Deleting the mission** is its own action, on the pinned accordion and in Adventure settings.
It asks whether the Threads and Characters the briefing seeded go with it, takes back only the
entries the briefing itself created, and returns an adventure that has not started scene 1 to
the briefing phase. It writes a journal row and takes an undo snapshot, so it is reversible
once, like a scene boundary (ruling S17).

**Start scene** is one *locked chain*, not a dialog with options. It asks what you expect,
rolls the scene test, and then forces whatever the test owes: the Scene Adjustment table on
an altered scene, a Random Event on an interrupt. Every dialog in the chain carries exactly
one primary action and cannot be dismissed — no close button, no Escape, no backdrop click
(ruling S10). The chain always ends on `Play scene N`, and **that** is the only thing that
sets `scenePhase` to `play`, so the screen never claims a scene is running before the rolls
behind it have happened. On an interrupt the event becomes the scene, the scene card is
relabelled to name it, and the displaced plan is filed to Threads automatically (ruling S11).

The **journal** is a record, not a log file: each row copies to the clipboard on its own
(what happened, the dice behind it, and when) and deletes on its own behind a confirmation,
with a **Copy all** that takes every entry oldest-first so a pasted session reads forwards.
The clipboard falls back to a hidden textarea, and then to a selectable dialog, for browsers
that block the async API.

**End the mission** is the loop's exit, and the one place the two systems have to meet. Mythic
has no notion of a mission ending; Classified does, and its End Mission bundle is where the
experience, the Hero Point, the Reputation and the one-advance-per-mission gate live. Ending a
mission from the Solo screen closes the adventure — outcome, `completedAt`, a journal row, one
undo — and then fires that bundle for the linked dossier by dynamic import. A closed adventure
stops offering another scene: the primary action becomes *Start a new adventure*, and the
switcher files it as closed rather than leaving it in the rotation. Reopening one is a tap and
does not take back what it awarded (ruling S24).

**Roll a check** sits at the top of the in-scene tools. Fate answers what is *true*; anything
the character *attempts* is an ordinary Classified check, and before this the player had to
leave the screen to make one. Skill, attack and damage all open the real roller on the linked
dossier, by dynamic import, and land in the same roll log as the oracle answers. The block is
absent when no dossier is linked, because then there is nothing to roll.

**End scene** is the other boundary and carries all of its bookkeeping in one dialog: the
control question that steps the Chaos Factor, a summary line, and the Threads and Characters
upkeep — add what opened, strike off what closed. It commits as one change under one undo
snapshot, and resets the phase so the next primary action is `Start scene N+1`.

The **Adventures** button is the switcher: your adventures, and starting a new one. Those
are play actions and stay one tap. Everything that configures an adventure rather than plays
it — the Fate mechanic, a manual Chaos Factor override for correcting the number, the linked
dossier, rename and delete — sits one level down behind **Adventure settings**, so a
destructive control is never adjacent to the thing you tap to change adventure (ruling S13).

#### 3.20.6 Mysteries — the app's own aid (house aid)

Neither book carries this, so it ships explicitly labelled, exactly as End Scene does under
R9 (ruling S20). The truth is **generated at the reveal** rather than written in advance, in
the manner of Brindlewood Bay: an answer decided up front is one the player already knows, and
one rolled at the end cannot contradict what has already been played.

**There is no clock.** The first build used a 4/6/8 segment clock, in the manner of Blades in
the Dark, and it was wrong for this: a visible clock says *which clue* breaks the mystery open,
which makes it a countdown rather than a mystery (ruling S21). Clues now set the **odds** and
Fate decides the moment.

| Piece | Behaviour |
|---|---|
| **Subject** | The objective, the complication, the primary opponent, the intel, any thread, or a question you type. The subject decides which Meaning Table colours the reveal. |
| **Opening one** | By hand from the panel, or rolled: the briefing's **Hidden truth** row rolls d100 for whether this mission conceals anything and what it hangs on, and a hit opens the mystery at zero clues. You start knowing something is off, and nothing else. |
| **Clues** | Four sources: marked by hand, ticked at End Scene, an Exceptional Fate answer, and a Random Event that draws the mystery's own thread. Each one raises the odds — 1 clue Very Unlikely, 2 Unlikely, 3 50/50, 4 Likely, 5 Very Likely, 6+ Nearly Certain (`mysteryOdds()`). |
| **What a clue was** | Each clue carries the line that produced it, written when it is marked and kept on the card. A clue ticked at End Scene takes the scene summary. The count sets the odds; the lines are what the reveal gets read against, and they are shown in the reveal dialog for exactly that (ruling S23). |
| **A refusal twice over** | Two plain No answers running are a pattern rather than silence: the app rolls `MYSTERY_FALSE_LEAD` and says the trail was planted, with a word pair for who laid it. The clues already gathered stand — they were pointing where someone wanted. The count resets. |
| **A case gone cold** | A mystery no clue has touched for `MYSTERY_STALE_SCENES` scenes is offered at End Scene as a step of Chaos Factor of its own, stacking with the control question. Offered, never applied silently. |
| **Breaking open** | Every clue asks the chart *does it break open now?* at those odds and the current Chaos Factor, logged like any other roll. A case can crack on the second clue and another can hold past the sixth. |
| **The bands** | An **Exceptional Yes** brings a second word pair — it breaks wide open. An **Exceptional No** is a lead going cold and costs the clue that raised it. |
| **Reveal** | A d100 on the authored `REVEAL_SHAPES` table gives the shape — *someone you trusted*, *it was planted*, *the wrong target* — then a word pair from the subject's table. Journal and shared roll log both get it. |
| **Who it runs through** | A shape marked `implicates` names a person rather than a thing, so the reveal draws one off the **Characters list** instead of leaving the player to supply a stranger. With an empty list it simply says nothing. |
| **The opponent's tell** | A reveal on the primary opponent also changes how they *play*: half the time a Weakness off Classified's own list, half the time an Interaction Modifier, written onto the stored stat block. The Weakness list arrives by dynamic import, so the module rule holds (S15); the shape of the aid is `MYSTERY_TELL` in `data-solo.js`. |
| **Rewording** | A mystery's title is the control that rewords it, like a list entry — one opened on a rolled thread starts life as a word pair (S22). |
| **The objective's twist** | A mystery on the objective is the one reveal that can change what the mission is *for*: the modal shows the standing objective and offers to rewrite it, filing the old wording to Threads as unfinished business. |
| **Afterwards** | It stays on the panel marked Revealed, with its answer readable, and offers to open a thread from what it found. Clearing it is one tap. |

#### 3.20.5 Scene boundaries, and how they differ from R9

Two things called a scene now exist and they are deliberately separate:

- **End Scene (house aid, R9)** — clears aim, cover, posture and combat declarations. Still
  on the Combat screen, unchanged.
- **End Scene (Mythic)** — asks whether the character was in control, steps the Chaos
  Factor, increments the scene number, writes a journal row, offers to update the Adventure
  Lists, and stores a one-step undo. On the Solo screen only.

### 3.21 GM tables

Hot and Cold random encounter tables (10 × 10 each) with ~40 named encounters, many with
1d10 sub-tables and Hero Point alternative outcomes; chase obstacle tables for water, land
and air; the four gambling tables; grenade scatter and direction; the accident table;
equipment repair multipliers; scar location; stun duration.

### Checkpoint rulings

Recorded inline where they bite. Each is a case where the printing was unclear or damaged.

| # | Point | Ruling |
|---|---|---|
| R1 | Skill Rank cap is stated as "+2 over the highest underlying characteristic" three times and as "cannot be greater than" once (the Language note in Ch. 3) | **CONFIRMED +2** against scans of the printed Ch.2 and Ch.3 notes. Corroborated by Aidan Hunter, the published Special Agent sample, who has Hand-to-Hand rank 11 on Strength 9 — exactly at the cap. |
| R2 | Success Quality Table row 161–170 prints Good 35–85 and Fair 85–99, overlapping at 85 | Derive the table; Fair starts at **86**. Noted in the rules library. |
| R3 | Multiplication Table prints 8 × 7 = 46 and 23 × 10 = 260 | Arithmetic errors. **The official character-sheet PDF reprints the same 8 × 7 = 46**, confirming a persistent printing error rather than a transcription artefact. The app multiplies. |
| R4 | Physical Traits Table arrived column-scrambled, and it was unclear whether height and weight are one purchase or two | **CONFIRMED and CORRECTED.** The scan verifies the nine symmetric bands. Height and weight are **separate purchases**, each drawing its own Creation Point cost and its own Reputation from its own row — the book lets them differ by a row, which is only meaningful if they are chosen independently. Four of the five published sample characters reproduce their printed Reputation exactly under this reading, including two whose height and weight sit in different rows. See audit finding A11. |
| R5 | Wound Rank Accumulation arrived as an unlabelled 4 × 4 grid | **CONFIRMED** against the printed table: old-wound rows × new-wound columns, exactly as reconstructed. |
| R6 | Speed table stops at PER + DEX 30 with no row above | 30 is the maximum possible (15 + 15). No extrapolation needed. |
| R7 | Seduction modifiers list "Unattractive −2" but the appearance list has no such entry | Map to **Plain**. Good Looking gets 0, the only unlisted appearance. |
| R8 | Hero Points have no printed cap or decay | Implement as uncapped and persistent. `maxHeroPoints()` returns null deliberately. |
| R9 | The book defines missions and sessions but no scene | End Scene is shipped as an **explicitly labelled house aid**. |
| R10 | Draw Situation ties | Not covered by the book. The app reports a dead heat and defers to the GM rather than inventing a rule. |
| R11 | Horse STR 18 and shark STR 16 exceed the 1–15 characteristic range | Reproduced as printed; animals are not bound by the PC range. |

### Solo rulings

The Mythic layer's own cases. Same rule as above: recorded where they bite, and the data
layer carries the flag rather than the UI.

| # | Point | Ruling |
|---|---|---|
| S1 | The supplied report contains the Meaning Tables but **not** the GME core procedures — no Fate Chart, no Fate Check page, no Event Focus table, no Scene Adjustment table | **FULLY RESOLVED by printed images supplied afterwards.** All four are transcribed from the printing and every `verify` flag is gone. The Event Focus table **confirmed** the reconstruction band for band. The Fate Chart, Scene Adjustment table and Fate Check **replaced** theirs — see SA3 to SA7. The escape hatch built for this worked exactly as intended each time: swapping in printed values was a `data-solo.js` edit and nothing else. |
| S2 | Exceptional Yes and Exceptional No thresholds | **Derived, not transcribed**, on the A1/R2 precedent, and now **confirmed against all 81 printed cells**: Exceptional Yes is `round(target / 5)`, Exceptional No is `100 − round((100 − target) / 5) + 1`. Two corrections came out of the scan: the rounding is round, not floor — a target of 99 gives 20, which truncation misses — and at a target of 1 no Exceptional Yes exists while at 99 no Exceptional No does, which is what the printed **x** means. Both cases return `null` and the UI drops the band rather than inventing one. |
| S3 | Random Event trigger on the Fate Chart | Doubles (11, 22, … 99) whose **tens digit is at or under the Chaos Factor**. The event fires in addition to the answer, never instead of it. |
| S4 | Chaos Factor bounds | 1–9, clamped at both ends, starting at 5. `stepChaos()` clamps rather than wrapping. |
| S5 | Two different things called a scene | Kept separate and separately labelled. R9's End Scene stays the Classified combat-flag house aid on the Combat screen; Mythic's End Scene is its own bundle on the Solo screen. Neither calls the other. |
| S6 | The 13 authored tables are not extracted from anything | Marked `authored: true`, listed apart from the `source: "mm38"` baselines, and described on screen as written for this app. They are not presented as Mythic Magazine content. |
| S7 | Whether a Fate answer should be spendable with Hero Points | **No.** Hero Points shift a Classified Success Quality; nothing in either book connects them to an oracle. Left alone rather than invented. |
| S10 | Whether a mandatory follow-up roll — the Scene Adjustment on an altered scene, the interrupt event, the event a Fate doubles fires — may be walked away from | **No.** Each was a ghost button beside a primary that dismissed the dialog, so the sequence could be abandoned halfway and the screen would still claim a scene was running. They are now the single primary action of a `locked: true` modal: no close button, no Escape, no backdrop dismissal. `scenePhase` flips to `play` only when the last step of the chain is taken, so the scene card and the primary action can never disagree with what has been rolled. |
| S11 | What an interrupt does with the scene that was planned | The event **becomes** the scene and the displaced plan is filed to Threads automatically, with a journal line. It was previously a ghost button that was easy to miss, and the scene card went on naming the plan that had just been overwritten. |
| S14 | The briefing is not a Mythic procedure | Correct — Mythic starts from a premise you already have. The briefing is the app's own scaffolding for the first beat, built from the authored espionage tables plus the two mm38 baselines that had no other job. Marked as this app's own in its rules-library topic, like End Scene under R9. |
| S15 | The briefing's Primary Opponent needs Classified's NPC generator, which `solo.js` is forbidden to import | Resolved by **dynamic** import at the moment the button is tapped. The rule tightens rather than loosens: `solo.js` still has no *static* dependency on `rules.js` or `data.js`, so the Mythic layer cannot reach Classified's resolution mechanic, and the one place it borrows a generator is explicit and lazy. |
| S16 | The briefing's Primary Opponent read *Villain Primary Opponent* however many times it was generated | The Classified generator names an NPC `rank.npcName + stereotype.name`, and this row pins both, so the name was a constant while the stats underneath changed — indistinguishable from a button that does nothing. The stat block is what Classified owns; the identity is what the Meaning Tables are for, so a codename off `espCodename` and a pair off `espAdversary` are rolled alongside it and the row reads *Cormorant — ruthless spymaster*. The generator itself is untouched: NPCs made on the Combat screen still carry their category label, which is right there. |
| S17 | A briefing could be rewritten but never removed, so an adventure was stuck with the mission it opened on | Delete the mission is its own action. It asks whether the seeded list entries go too, matches them by the ids recorded at commit — never entries added by hand — and returns a phase-1 adventure to the briefing so a new mission can be written. Deleting the *adventure* stays where it was, under Adventure settings; the two are not the same and are no longer adjacent. |
| S21 | The first mystery build showed a 4/6/8 clock, so the player could see that the fourth clue would break it open | **The clock is gone.** A question whose answer arrives on schedule is a countdown, not a mystery. Clues now set the odds of a Fate question the app rolls after every clue, so the case can crack early or hold out. Two consequences recorded here: the question is rolled by the app rather than asked by the player, so it does **not** fire the doubles Random Event a Fate question would — End Scene can tick several mysteries in one commit and chaining events out of that would bury the boundary; and the clue that fires it is marked when the dialog that produced it closes, so a mystery never opens its own dialog on top of another. |
| S20 | Mystery clocks are in neither book — the clock is Blades in the Dark's, the answer-at-the-reveal is Brindlewood Bay's | Shipped as a **house aid**, labelled as one on the panel, in its how-to entry and in its rules-library topic, on the R9 precedent. It rolls only on the app's own authored tables and the existing Meaning Tables, so nothing is presented as sourced from Classified or Mythic. |
| S24 | The solo loop had no exit. A mission ran until the player stopped opening the adventure: nothing closed it, the switcher filled with finished missions, and Classified's End Mission — the experience, the Hero Point, the Reputation, the advancement gate — sat on the Combat screen with nothing in Solo pointing at it | **End the mission**, between scenes and in Adventure settings. It asks the outcome, says what is still open, closes the adventure, and fires `runLifecycle("mission")` for the linked dossier through the same dynamic import the briefing's generator uses (S15). Three smaller seams closed with it: the briefing's opponent can walk into the encounter tracker rather than being read out and retyped, the in-scene block carries the Classified checks a scene actually needs, and End Scene now says when a list was too full to take what it was given instead of dropping it silently. |
| S23 | A clue was a bare increment, so a reveal had nothing to be read against — the shape and the words answered a number | Each clue now carries the line that produced it, kept on the card and shown in the reveal dialog under *Read it against what you found*. Optional: a clue with no line still counts. Three consequences ride along, all from the same reading that a mystery is a thing you are gathering rather than filling — a second plain refusal rolls the trail as planted rather than passing in silence, a case nobody has touched for four scenes offers the Chaos Factor a step, and a reveal that names a person draws one off the Characters list rather than inventing a stranger. |
| S22 | A briefing seeded its threads with the row text verbatim, so an Adventure List could open on *Deliver · Evaluate* — a word pair, not a goal anyone can act on | Two fixes, at both ends. The briefing dialog now carries the **seed lines themselves**: one field per list entry, tracking its row until you write in it, so the wording that goes on the list is settled before it is added rather than after. And every list entry's **text is the control that rewords it** — tap it and write it again, keeping its id and weight, so an entry a mystery or a briefing points at survives being reworded. Also **Roll all**, which fills the whole mission in one tap and leaves any row you have written over alone. |
| S19 | Start an adventure opened a name prompt, and then a dossier chooser, before anything existed | **Both removed.** The name was the wrong question a tap too early: the briefing's codename row names the adventure a moment later, so the app was asking the player to invent the thing it was about to hand them. The dossier is whichever is already open. Adventure settings still holds rename and the dossier link. |
| S18 | Every pinned briefing row printed twice — the line, then the words under it | The words go straight into the field, so an unedited row's text is the words joined and the two lines were the same sentence in two typefaces. The words are shown only when the player has written over them, which is the one case where they say something the line does not. Compared on letters alone, so the joiner and case never make an unedited row look edited. |
| S13 | The Adventures button mixed switching adventures with configuring and deleting them | Split. Top level is the switcher plus *Start a new adventure*; a single **Adventure settings** row opens the Fate mechanic, the Chaos override, the dossier link, rename and delete. |
| S12 | Whether re-rolling a Random Event's words should leave a trail | **No.** A re-roll supersedes: it deletes the journal row and roll-log row it replaces, so the record shows the reading that was kept. The Event Focus is held fixed across a re-roll — only the words change. |
| S9 | Whether the in-scene tools should be locked while no scene is open | **No.** A solo player legitimately asks Fate a question between scenes — often to decide what the next scene even is. The tools stay live and the screen leans on emphasis instead: the primary action is the next boundary, and the in-play block is quietened until a scene is running. |
| S8 | The supplied report's Objects column prints Information and Intriguing twice, at 49-50 and again at 51-52 | **Reproduced as supplied.** The report is the source of record, and silently repairing a source table is how transcription damage gets laundered — the same reasoning as R3, where the app multiplies rather than trusting the printed 8 × 7 = 46. Two regression checks pin the repeat in place so it cannot be tidied away by accident. |

---

## 4. Architecture — LOCKED

- **No build step.** Vanilla JS, native ES modules loaded directly by the browser. Clone
  and run always works.
- **Installable PWA:** `manifest.json`, `service-worker.js` (network-first, caches the app
  shell, versioned `CACHE_VERSION`), an SVG icon, and an in-app update toast.
- **Update discovery.** The app has no build step and no version endpoint, so the deployed
  `service-worker.js` *is* the version marker. Registration alone only checks on a hard
  navigation, which an installed PWA may not see for days, so `main.js` also polls
  `registration.update()` — on return to the foreground, on focus, on coming back online, and
  on a 15-minute heartbeat, throttled to one check a minute. When a new worker installs
  behind an existing controller, a persistent toast offers **Reload** or **Later**; Reload
  posts `SKIP_WAITING` and reloads. Nothing auto-reloads under the player mid-session.
- **Storage:** `localStorage` local-only mode works with zero configuration; real keys in
  `firebase-config.js` plus the `FIREBASE_ENABLED` flag switch on cloud sync.
- **Firebase:** Realtime Database + Storage for portraits.
- **Auth:** instant anonymous launch, no login wall.
- **Roles from day one:** `members/{uid}.role: "player" | "gm"` in the schema *and* in
  `database.rules.json`.
- **Sync is stamped, not merged.** The combat mirror carries `rev` and `by`, so a client
  ignores its own echo and takes a remote change only when its revision is newer. Without
  that the tracker fights itself: every push returns as a remote update that triggers another.
- **Portraits are compressed in the browser** to a 256px JPEG data URL, so they need no
  Storage bucket, ride along in the JSON backup, and cannot blow the `localStorage` quota.
- **A write that fails is announced.** `writeJSON()` returned false on a full or blocked
  `localStorage` and every call site ignored it, so the app silently stopped saving and the
  player found out on the next reload. Every write — the JSON blobs and the bare active-record
  pointers alike — now goes through `writeRaw()`, which raises `store:writefailed` once per
  session; `main.js` turns that into a toast, so `store.js` still imports no UI (F5).
- **Campaigns:** memorable three-word join codes (`red-dragon-sword`).
- **Locked modals:** a dialog that is one step of a sequence the player must finish takes
  `locked: true` — no close button, no Escape, no backdrop dismissal, and only its own
  actions move it on. Used by the Start-scene chain (§3.20.4).
- **Only the top dialog answers the keyboard.** Modals stack — a stat block over a roster, a
  reveal over an encounter — and each one listens on the document, so Escape and Tab are
  claimed by whichever is on top of `openModals` and ignored by the rest. Heading ids come
  from a monotonic counter rather than the stack depth, so two live dialogs never share one
  (F1, F2).
- **Themed UI primitives:** no native `alert`/`confirm`/`prompt`. A shared `modal()` plus
  `showToast`/`confirmModal`/`promptModal`/`chooseModal`, with focus trap, Escape, and
  focus restore.
- **Accessibility:** `aria-live` roll announcements, labelled icon buttons, `aria-current`
  nav, a skip link.
- **Responsive:** phone-first, zero horizontal overflow at 360px.
- **No zoom.** An installed home-screen copy should behave like an app, so the viewport sets
  `maximum-scale=1, user-scalable=no`, `touch-action: manipulation` kills double-tap zoom, and
  `main.js` cancels iOS pinch gestures — multi-touch only, so one finger still pans and taps.
  Every text field is 16px, which is what stops iOS zooming to a focused input; that is the
  fix for focus zoom that does not involve disabling anything. The accessibility cost is real
  and deliberate: system font-size scaling still applies (`-webkit-text-size-adjust: 100%`,
  relative units throughout), but a player who pinches to enlarge a table no longer can. One
  line in `index.html` reverses it.
- **Accordions start closed.** Every `details.acc` on the sheet, the wizard, the Solo screen
  and the gear catalogue opens on a tap, not on render, so a screen opens as a list of
  headings rather than a wall. The one exception is the gear catalogue under a live search,
  where matched groups open because that is a result rather than a default.

---

## 5. Files

| File | Purpose |
|---|---|
| `index.html` | App shell: header, resource header, screen mount, bottom nav, module entry |
| `styles.css` | Dossier theme (light + dark) and every component style |
| `data.js` | **Core rules library** — every §3 list, table and formula from the core book |
| `data-monsters.js` | The book's five animals (there is no monster bestiary — see §3.18) |
| `data-npcs.js` | NPC stereotypes and generation tables, OSIRIS, the encounter system |
| `data-pregens.js` | The five published pre-generated characters |
| `data-help.js` | **How-to copy** — one entry per screen and per Solo panel, the solo tutorial, and the glossary of both systems' terms. UI text, not rules. |
| `data-solo.js` | **Mythic layer** — Fate, Chaos, scenes, events, and all 37 Meaning Tables (§3.20). No Classified rules in this file. |
| `firebase-config.js` | Placeholder config + `FIREBASE_ENABLED` flag |
| `database.rules.json` | RTDB security rules with player/GM roles |
| `manifest.json`, `service-worker.js`, `icon.svg` | PWA |
| `tests/` + `package.json` | Dev-only headless harness (`npm test`); `node_modules` gitignored; not in the SW app shell |
| `README.md` | Setup, Firebase steps, the two printed-table corrections, licensing |
| `CLAUDE.md` | This file |

No `data-<expansion>.js` — no expansions were supplied.

### 5.1 `src/` module map

| Module | Responsibility |
|---|---|
| `core.js` | Constants, DOM helpers, raw dice, formatting. **No imports.** |
| `ui.js` | Themed modal, toast, confirm, prompt, chooser |
| `rules.js` | Pure rules lookups over the data libraries. No DOM, no state. |
| `derived.js` | Character-derived calculation, normalization, migration, validation |
| `settings.js` | Feature and content toggles, theme |
| `store.js` | Local/cloud persistence, roll log, combat mirror, tasks, undo, JSON backup |
| `sync.js` | Firebase auth, campaigns, join codes, pushes. No-ops without keys. |
| `wizard.js` | Creation wizard and the dossier list |
| `roller.js` | The dice engine: resolution, Hero Points, attacks, damage, every opposed procedure, chases, gambling, roll-log writes |
| `sheet.js` | Character sheet, gear screen, and the persistent resource header |
| `combat.js` | Combat tracker, NPC instantiation, progress tasks, lifecycle engine |
| `gm.js` | GM dashboard: party panel, generators, reference tables |
| `help.js` | The collapsed how-to accordions, the glossary, the tutorial screen, and the offer that switches solo play on. Renders `data-help.js`; imports core, ui, settings only, so `solo.js` may use it |
| `solo.js` | The Mythic engine and the Solo screen: Fate, Chaos, scene test, Random Events, Adventure Lists, Meaning-table roller, journal, guided End Scene |
| `screens.js` | Home, rules library, roll log, advancement, settings |
| `router.js` | Bottom-nav routing and conditional tab gating |
| `main.js` | Entry point, boot, and service-worker update discovery (`checkForUpdate()`, `showUpdateToast()`) |

No `power-automation.js` (§3.14).

`solo.js` may import `core.js`, `ui.js`, `store.js`, `settings.js`, `help.js` and
`data-solo.js`. It
must **not** *statically* import `rules.js` or `data.js`. The one exception is the briefing's
Primary Opponent, which dynamically imports `combat.js`'s generator at the moment it is asked
for (ruling S15). The Mythic layer never reaches into the
Classified rules engine, which is what keeps the two systems from bleeding together. Its one
crossing point is `Store.addRoll()` for the shared log.

**When adding or moving a `src/` file:** update this table *and* the service worker's
`APP_SHELL` list, then bump `CACHE_VERSION` — in the same change.

---

## 6. Data model

Local storage keys are `classified.*`. The Firebase shape:

```
campaigns/{campaignId}
  meta:    { name, joinCode, createdAt, ownerUid }
  members/{uid}: { displayName, characterId, role: "player" | "gm" }
  group:   —                                    // ABSENT: Classified has no group entity
  pools:   —                                    // ABSENT: Hero Points are personal only
  combat:  { active, round, phase, combatants[] }
  tasks/{taskId}: { name, requirement, progress, note }
  rollLog/{pushId}: { by, characterId, label, roll, quality, baseQuality, heroSpent,
                      baseChance, df, successChance, modifiers[], note, ts }   // capped ~100
  broadcast/{pushId}: { text, ts, from }
  solo:    —                                    // ABSENT: Mythic replaces the GM (§3.20.3)

characters/{characterId}
  id, schema, createdAt, updatedAt, owner, campaignId
  identity:   { name, gender, rank, heightBand, weightBand, appearance, height, weight, age,
                nativeLanguage, profession, professionYears, organisation, cover,
                portraitUrl, notes }
  attributes: { str, dex, wil, per, int }
  skills:     { <skillKey>: rank }
  languages:  [ { name, rank } ]
  abilities:  { chosen }                        // the fourth Ability
  foe:        [ <fieldOfExperienceKey> ]
  weaknesses: [ <weaknessKey> ]
  state:      { wound, stunRounds, exhausted, heroPoints, conditions{}, firstAidUsed,
                scenesFlags{}, restFlags{},
                combat: { aiming, cover, posture, defensiveMove, ammo{} } }
  reputation: number
  scars:      [ { location, note } ]
  inventory:  { items[ {id,key,kind,name,qty,weight,equipped,notes,price} ], money }
  vehicles:   [ ]
  xp:         { total, spent, log[] }
  advancedThisMission: { skills[], attributes[] }   // the one-advance-per-mission gate
  missions:   number
  log:        [ ]
```

Solo adventures are local-only and sit beside the characters rather than inside them, so a
dossier can be played solo, then handed to a table, without carrying oracle state:

```
classified.soloAdventures: [ {
  id, schema, name, createdAt, updatedAt,
  characterId,                                  // the linked dossier, or null
  fateMode: "chart" | "check",                  // §1.2, default "chart"
  chaos: 1..9,                                  // Chaos Factor, starts at 5
  scene: number,                                // scene counter, starts at 1
  scenePhase: "briefing" | "setup" | "play",    // where the loop stands (§3.20.4)
  briefing: null | {                            // the mission, or null if skipped or deleted
    rows: { <rowKey>: { text, words[], rolls[] } },
    npc,                                        // the Primary Opponent: stat block + alias + traits
    seededIds: [ <listEntryId> ],               // what it put on the lists, so deleting can take it back
    writtenAt },
  sceneExpected: string,                        // what you said this scene would be
  sceneKind: "expected" | "altered" | "interrupt" | null,   // how the scene test resolved
  mysteries:  [ { id, subject, label, sourceId, clues, clueLog[ {id,ts,text,source} ], misses, lastScene,
                  revealedAt, reveal: { shapeKey, shapeName, shapeDesc, words[], rolls[],
                                        exceptional, implicated, tell } } ],
  threads:    [ { id, text, weight } ],         // Adventure List, 25 slots
  characters: [ { id, text, weight } ],         // Adventure List, 25 slots
  completedAt: number | null,                    // the mission's own end (§3.20.4)
  outcome: "success" | "partial" | "failure" | null,
  journal:    [ { id, ts, kind, text, detail } ]  // kind: scene|fate|event|meaning|note
} ]
classified.soloActive: <adventureId>
classified.soloUndo:   <one-step snapshot: { ts, label, adventures, active } >
```

Every schema addition ships with a back-fill in `normalize()` and is documented here in the
same change. `SCHEMA_VERSION` is 11. The pre-A11 single `bandIndex` field is migrated to `heightBand` and `weightBand` on load. Version 4 added the solo keys above, version 5 the three scene-phase fields, version 6 the briefing, version 7 its `seededIds` and version 8 the mysteries and version 9 their clue-driven odds — a version-8 clock's filled segments carry over as that many clues — a record from any earlier version simply has none. Version 5 records load with `briefing: null` and keep the phase they were in, so an adventure under way is never sent back to a briefing it never had; a version-6 briefing back-fills an empty `seededIds`, and deleting its mission falls back to matching the seeded rows by text. The one-step undo snapshot carries a `label` so the banner names what it would revert. Version 5 also added the three scene-phase
fields; characters are untouched by both, and `normalizeAdventure()` — in `store.js`, beside the rest of the
persistence layer, so `derived.js` stays free of Mythic — back-fills every field, clamps the
Chaos Factor, truncates a list past 25 slots and corrects a weight below 1. A version-3
backup carries no solo section and imports cleanly, and a version-4 adventure loads with no
scene open rather than mid-scene. Solo rolls are written to the shared log
with `solo: true` and a Mythic `outcome` instead of a Success Quality.

---

## 7. Settings & toggles

One pattern: a flag in `settings.js` (off by default), a toggle row in Settings with a
one-line description, every related UI checks the flag, and gated nav tabs are hidden by the
router.

`gmScreen` · `multiplayer` · `manualDice` · `showUntrained` · `autoConditions` ·
`heroPointPrompt` · `seatbelts` · `airbags` · `solo` · `showHelp`. Plus `theme` and
`campaignStyle`, which are choices rather than toggles.

`solo` is the only toggle that **swaps** a nav tab rather than adding one: six tabs is the
limit at 360px, so when solo is on the Solo tab takes the Rules slot and Rules stays
reachable from its Home tile. `manualDice` applies to Mythic rolls too — `getD100()` is
still the single entry point, and the Fate Check's 2d10 gets the same treatment.

**How-to panels.** `showHelp` is the one toggle that starts **on**: a collapsed
"How to use" accordion at the top of every screen and inside every Solo panel, holding what
the panel is for and the taps that use it. `src/help.js` renders them from `data-help.js`, so
no screen authors help text of its own and turning the flag off removes them everywhere in
one place. The solo walkthrough is a screen of its own (`#/tutorial`), reachable from the
Solo help panel and a Home tile — no nav tab, because six is the limit at 360px.

**The glossary.** `GLOSSARY` in `data-help.js`: 42 terms across three groups — Classified,
Mythic, and the two words this app uses for itself — each a sentence a player can act on
rather than the procedure behind it. It opens from a Home tile, from the head of the Rules
library, from the Solo reference list, and out of a rules search, which matches definitions as
well as titles. It lives in `help.js` rather than `screens.js` because `solo.js` needs it and
may not import the Classified modules (§5.1); the player meeting *Difficulty Factor* on the
Solo screen is exactly the one who needs it.

**Start here.** `startHere` is the only flag with no toggle row: a first-run card on Home
naming the three things to do in order — a dossier, the walkthrough, solo play — ticking the
ones already done. It goes away on **Hide this**, and on its own once there is a dossier with
a roll behind it, so it can never become furniture. Solo play is offered from Home whether or
not the toggle is on, because a screen you must already know about is a screen a new player
never finds (N1).

**Wipe data.** Two destructive buttons sit directly under Backup, because exporting is what
makes wiping safe and the two belong to the same decision. Each carries its own count, is
disabled when there is nothing to delete, and confirms with what it destroys *and* what it
leaves alone: `wipeAdventures()` clears every solo mission with its active pointer and undo
snapshot and does not touch dossiers; `wipeCharacters()` clears every dossier and the active
pointer and does not touch the roll log or the missions. Neither is undoable, and the
confirmation says so.

---

## 8. Data Extraction Ledger

**How to continue.** Work top to bottom within the current phase. Query the source;
corroborate anything surprising; write the table paraphrased and cited; **tick the box in
the same change** and append a changelog row. Estimated counts yield to real counts —
record them. **An unticked box means the data is not extracted. Never build UI against an
unticked table.**

### `data.js` — core rules

- [x] **T1** Difficulty Factor ladder, base, clamping and stepping
- [x] **T2** Success Quality Table (derived; two printed errors corrected — R2, R3)
- [x] **T3** Multiplication Table / Success Chance (derived, capped 300)
- [x] **T4** Skill Time and Information table
- [x] **T5** Characteristics, ranges, point-buy costs, relative weights
- [x] **T6** Ranks: Creation Points, Hero Points, scar chance, XP modifier, NPC names, expectation bands
- [x] **T7** Physical Traits Table — 9 bands, both columns (reconstructed, R4)
- [x] **T8** Appearance Table with Seduction modifiers
- [x] **T9** Skill list — 25 skills with formulas, base times, repair times, descriptions
- [x] **T10** Abilities: the three fixed, the 13 Potential, Base Chance 20
- [x] **T11** Language Fluency Table
- [x] **T12** Derived stat tables — carry, run/swim, H-to-H Damage Rank, Speed, stamina, draw
- [x] **T13** Weaknesses — 13 entries with type and Creation Points
- [x] **T14** Professions — 8, with skill lists and Field of Experience lists
- [x] **T15** Fields of Experience — 40 entries, plus the 16 General and the 2-for-1 rule
- [x] **T16** Reputation Table, gains, disguise modifiers, reduction methods
- [x] **T17** Hero Point rules and the four campaign styles
- [x] **T18** Experience: base, modifiers, costs, the one-per-mission gate
- [x] **T19** Wound Rank Table (4 × 12)
- [x] **T20** Wound levels: DF penalties, Draw penalties, Pain Resistance DFs, scar chances
- [x] **T21** Wound Rank Accumulation (reconstructed, R5)
- [x] **T22** Stun Table, Strength shrug-off, scar locations, fall damage
- [x] **T23** Area Weapon Damage and Damage Rank reductions by material
- [x] **T24** Fire Combat modifiers and options
- [x] **T25** Hand-to-Hand actions and Specific Actions
- [x] **T26** Combat round structure, Draw Situations, movement
- [x] **T27** Grenade scatter, direction, duds
- [x] **T28** Chase manoeuvres with Control DFs and range legality
- [x] **T29** Accident Table (5 manoeuvres × 8 bids) and its notes
- [x] **T30** Chase modifiers, obstacles, vehicle damage, tailing
- [x] **T31** Reactions, Reaction modifiers, Local Customs modifiers
- [x] **T32** Persuade Table
- [x] **T33** Seduction stages and modifiers
- [x] **T34** Interrogation/Torture table, modifiers, the unconsciousness escape
- [x] **T35** Gambling — 4 games × 5 × 5
- [x] **T36** Healing methods and limits
- [x] **T37** Mission lifecycle bundles
- [x] **T38** Money, equipment access, repair multipliers
- [x] **T39** Weapons — 40 entries with all 12 statistics
- [x] **T40** Ammunition — 7 types
- [x] **T41** Grenades — 7 types
- [x] **T42** Body armour — 8 entries
- [x] **T43** Suppressors, sights, holsters
- [x] **T44** Vehicles — 78 entries with all 8 statistics, plus skill mapping
- [x] **T86** Vehicle statistics as a printed list, for the garage panel *(labels for T44's columns)*
- [x] **T45** Vehicle modifications — 36 entries
- [x] **T46** Miscellaneous gear — 106 entries across 12 categories
- [x] **T47** Bug construction system, its four build steps and the assembly surcharge
- [x] **T48** Rules library topics — 9 core procedures
- [x] **T49** OGL notice
- [x] **T84** Quality-as-Difficulty-Factor procedures — Disguise, Stealth and Tailing, with their opposing checks and failure cases *(missed at first pass; §3.2 listed them but only Seduction and the chases were structured)*
- [x] **T85** Grenade throw constants — range per point of Strength, the skill thrown weapons use, dud and early-detonation rolls, and the scatter dial

### `data-monsters.js`

- [x] **T50** Animals — 5 entries (there is no monster bestiary; recorded in §3.18)

### `data-npcs.js`

- [x] **T51** NPC stereotypes — 8, with rank modifiers
- [x] **T52** NPC characteristic tables — 7 × 1d10
- [x] **T53** NPC skill packages — 7 × 1d10
- [x] **T54** NPC Hero/Villain Point and Reputation dice
- [x] **T55** NPC creation steps and the Interaction Modifier rule
- [x] **T56** OSIRIS overview and the 7 departments
- [x] **T57** OSIRIS antagonists — 7 full stat blocks with skills, Fields of Experience, Interaction Modifiers, biographies
- [x] **T58** Hot and Cold encounter tables — 2 × 10 × 10
- [x] **T59** Encounter definitions — 40, with sub-tables and Hero Point variants

### `data-pregens.js`

- [x] **T60** Five published sample characters: identity, characteristics, skill ranks, Abilities, Weaknesses, Fields of Experience, languages, weapon and vehicle
- [x] **T61** Per-sheet arithmetic-slip notes and the Creation Point audit

**Every box above is ticked.** The core book is fully represented.

### `data-solo.js` — the Mythic layer

A second system and a second source (§2). Reconstructed tables are marked in the row and
carry `verify: true` in the data; authored tables are marked and carry `authored: true`.

- [x] **T62** Fate Chart — 9 odds × Chaos Factor 1–9, all three numbers per cell *(transcribed from the printed chart, S1)*
- [x] **T63** Exceptional Yes / Exceptional No thresholds *(derived, confirmed against all 81 printed cells, S2)*
- [x] **T64** Fate Check — odds modifiers, the Chaos Factor column, the Answers table, its own odds labels, and the double-digits-within-CF trigger *(transcribed from the printed page, S1)*
- [x] **T65** Chaos Factor — range, start, stepping, and what raises or lowers it *(S4)*
- [x] **T66** Scene test — expected / altered / interrupt, and the d10 procedure
- [x] **T67** Scene Adjustment table, including the 7–10 double *(transcribed from the printed table, S1)*
- [x] **T68** Event Focus table *(transcribed; the printing confirmed the reconstruction, S1)*
- [x] **T69** Adventure Lists — Threads and Characters, 25 slots, weighting and randomisation
- [x] **T70** Anything Words — the ten, and the doubles-as-amplification rule
- [x] **T71** The five-step table-construction method *(in the data as `TABLE_BUILD_METHOD`; no longer surfaced — see the changelog)*
- [x] **T72** Baseline Action Tables — Action 1, Action 2 *(200 words, mm38)*
- [x] **T73** Baseline Description Tables — Descriptor 1, Descriptor 2 *(200 words, mm38)*
- [x] **T74** Baseline Elements Tables — Locations, Characters, Objects *(300 words, mm38)*
- [x] **T75** Baseline Adventure tables — Genre, Tone *(200 words, mm38)*
- [x] **T76** Authored core espionage set — Espionage Action, Espionage Description, Agency & Tradecraft, Adversary, Location, Object & Equipment *(600 words, authored)*
- [x] **T77** Authored mission set — Mission Objective, Complication, Cover Identity, Intel & Rumour *(400 words, authored)*
- [x] **T78** Authored flavour set — Codename Words, Surveillance & Chase, Gadget Quirk *(300 words, authored)*
- [x] **T79** Solo rules-library topics — Fate, Chaos, scenes, events, lists, and the two systems side by side
- [x] **T80** Authored in-play set — Combat Action, Wound & Injury, Vehicle & Chase, Reaction & Attitude, Coercion & Pressure, Social & Seduction *(600 words, authored)*
- [x] **T81** Authored world set — Weather & Time, Sensory Detail, Terrain & Environment, Organisation & Faction *(400 words, authored)*
- [x] **T82** Authored story set — Mission Twist, Scene Framing, Motive & Secret, Leverage & Money, Consequence & Aftermath *(500 words, authored)*

- [x] **T83** Mysteries — the clue-to-odds ladder, subjects, clue sources, the authored Reveal table with its person-naming shapes, the false-lead and stale-case rules, the opponent's tell, and the briefing's Hidden truth table *(house aid, S20, S21, S23)*

**Every box is ticked.** The supplied report is fully represented — 900 baseline words
reproduced cell for cell and checked against a committed fixture extracted from the report
itself — and the 2,800 authored words are in place, one table per subsystem (§3.20.2). The three reconstructed procedure tables
are flagged rather than presented as extracted (S1).

---

## 9. Build roadmap

- [x] **Phase 0 — Foundations.** All files scaffolded; the complete core data library
      extracted and verified per the ledger; theme; PWA shell; router and local storage.
- [x] **Phase 1 — Creation Wizard.** Eight steps, honest point-buy, all derived values,
      legality validated at every step, plus one-tap instantiation of the five published
      pregens. No group wizard (§3.8).
- [x] **Phase 2 — Core Tracker.** Live sheet with clamped steppers, wounds, conditions,
      inventory and encumbrance, abilities, languages, Fields of Experience, Weaknesses,
      scars, notes; persistent resource header on every in-play screen; JSON export/import;
      persistence and migration.
- [x] **Phase 3 — Dice Engine.** The core procedure with the full ladder and live bands;
      every opposed procedure from §3.2; Hero Point spends with the secret-roll timing rule;
      conditions auto-applied; misfires; crit/fumble consequences from the real tables;
      equipment "tap to use"; roll log with `aria-live`; rules-library links on automated
      surfaces.
- [x] **🏁 First Session Playable.** Create → sheet → roll → track, verified end to end
      headless with zero console errors.
- [x] **Phase 4 — In-Play Systems.** Guided damage flow with the full consequence chain;
      healing with enforced limits; the lifecycle engine with confirmation summary and
      one-step undo; the generic progress-task tracker; the advancement loop with its gate;
      local combat tracker with animals, OSIRIS and generated NPCs.
- [x] **Phase 5 — Multiplayer & Sync** *(gated per §1.1)*. Firebase init, security rules and
      role schema were already shipped; the surfaces are now built too — campaign creation and
      join with a three-word code, the party panel and the seat picker, two-way combat sync
      behind an echo guard, the table's rolls beside the local log, and the dossier
      photograph compressed in the browser. Every control works with no keys configured,
      against a local campaign record, and does the real thing once keys are in place.
- [x] **Phase 6 — Conditional surfaces.** GM screen with party panel, encounter generators,
      NPC generator, OSIRIS roster and reference tables. No expansions, no solo mode, no
      power automation — none exist in this game.
- [x] **Phase 7 — Solo play (Mythic).** *(§3.20, decided in §1.2.)*
      - [x] `data-solo.js` extracted and authored per the T62–T82 ledger.
      - [x] `src/solo.js`: Chaos + scene header, Fate question box on both mechanics,
            Random Event generator, Threads and Characters lists, Meaning-table roller,
            adventure journal, guided End Scene with one-step undo.
      - [x] Per-adventure persistence in `store.js`, in the JSON backup, `SCHEMA_VERSION` 4.
      - [x] `solo` toggle and nav swap.
      - [x] Roll-log integration through `Store.addRoll()`.
      - [x] Regression checks: chart monotonicity, derived thresholds, event trigger,
            chaos clamping, list weighting, and every table exactly 100 entries.
- [x] **Hardening.** Committed regression harness (872 checks); accessibility pass;
      rules-accuracy audit with every finding closed (§11).

---

## 10. Process rules — LOCKED

1. **Living spec.** This file is canonical and updates in the same change as the code.
2. **Single source of truth.** All rules numbers live in `data*.js`. Never hardcode a rules
   value in `src/`. If a table is missing, add it to the data layer first — and to the
   ledger if it was missed.
3. **Changelog.** Every change appends a dated row: what, why, root cause for fixes,
   verification performed, cache version.
4. **Verify in a real browser.** Headless, end to end, **zero console errors**. "It parses"
   is not verification.
5. **Regression harness.** `npm test` must stay green. Every bug fix adds a check that would
   have caught it.
6. **Cache discipline.** Any shipped-file change bumps `CACHE_VERSION`.
7. **Root-cause fixes.** Debug to the actual cause; record cause and fix in the changelog.
8. **Scope guard.** Core rules only. No setting or adventure content. Anything invented is
   explicitly labelled a house aid — End Scene (R9) and the solo Mysteries (S20).
9. **Module discipline.** Respect the §5.1 responsibilities; import and export explicitly.

---

## 11. Rules-accuracy audit

Run before the build was declared done. Method: pull the app's value from the data files,
compare against the source, and correct the data layer rather than the UI.

**Data values — verified clean.** All 25 skill formulas; every derived-stat table; the
characteristic cost ladder; all 40 weapons across 12 statistics; all 78 vehicles across 8;
all 36 vehicle modifications; all 8 body armour entries; all 40 Fields of Experience; all 8
professions' skill and Field lists; all 13 Weaknesses; the Wound Rank Table; the
accumulation table; the Accident Table; all four gambling tables; the Persuade,
Interrogation/Torture and Reputation tables; the encounter tables and every sub-table.

**Engine behaviours — the audit's real yield.** As the template predicts, the findings were
sequencing and gating, not numbers.

| # | Finding | Fix | Regression check |
|---|---|---|---|
| A1 | The Success Quality Table transcribed by hand carried the printed 161–170 overlap into the app | Derive the table from the row index instead of transcribing | Bands are contiguous and non-overlapping for all 300 Success Chances |
| A2 | `blankCharacter()` created a character without Charisma and Driving at rank 1, so a wizard draft that skipped the rank step failed validation with a rule the player could not act on | Seed the two starting skills in the factory, not only in `normalize()` | The creation flow completes and saves a legal dossier |
| A3 | Hero Points earned from combat rolls under Adventurous style | `earnsHeroPoint()` checks the style's `combatEarns` flag | Style-by-style earning matrix |
| A4 | A Superb bought with Hero Points would have earned a Hero Point back | Track `heroSpent` and suppress the award | Explicit check |
| A5 | Occupant damage did not stack seat belts on top of the in-vehicle reduction | `occupantWound()` applies vehicle, belt and airbag reductions in order | Heavy vehicle wound → Stun with both fitted |
| A6 | A Stun landing on an existing wound worsened it through the accumulation table | Stuns never worsen an existing wound; they must be cleared first | Explicit check |
| A7 | Damage Rank could be shifted below A or above L by range and ammunition modifiers | Clamp: below A is no effect, above L stays L | Explicit checks |
| A8 | Difficulty Factor modifiers were applied arithmetically rather than as ladder steps | `stepDF()` walks the legal ladder and clamps at ½ and 10 | Large modifiers bottom out at ½, top out at 10 |
| A9 | Untrained Language rolls were offered; Language cannot be used untrained | Language is excluded from the untrained skill list | Language never appears in the rollable list |
| A10 | The one-advance-per-mission gate was not enforced on characteristics, only skills | `advancedThisMission.attributes` gates both, and the advancement UI disables a second raise | The gate tracks both arrays and survives normalization |
| A19 | Deleting a dossier left every reference to it behind: a combatant in the running encounter kept its `characterId`, so its **Attack** button looked live and did nothing at all when tapped, and a solo adventure kept pointing at an id that could never resolve again. `wipeCharacters()` did the same at scale | `detachCharacter()` in `store.js` runs from both delete paths. The combatant stays — they are still a body in the fight — but is detached, so the card offers *Attack this* rather than a dead *Attack*; the solo adventure's `characterId` becomes null, which is what the screen already renders honestly. The button also reports a missing dossier rather than failing silently, in case one vanishes another way | Deleting a dossier under a running encounter leaves the body, cuts the reference, unlinks the adventure, and the card shows the control that works |
| A17 | A vehicle could be issued in the wizard and then appeared nowhere: `character.vehicles` rendered on no screen, and the 36 vehicle modifications had no surface at all. Modification Points are both the budget for fitting them and what the vehicle absorbs for its occupants, so none of that was reachable | A garage on the Gear screen: owned vehicles with their statistics, add and remove, fit a modification against the Modification Point budget, the armour's Damage Rank reduction and Wound Rank absorption, and a Damage control that runs the occupant chain and applies the wound to the character | A fitted modification spends its Modification Points, the armour line reports what it absorbs, and both survive a reload |
| A18 | The bug construction system was extracted but had no surface: the parts were four separate catalogue rows and the assembly rule sat in the data, so building one meant doing the arithmetic by hand | A builder on the Gear screen — medium, transmission, storage and power, priced with the ten per cent assembly surcharge and added to the dossier as a single item | Four steps, the surcharge in the total, one item added at the price quoted |
| A15 | Of §3.2's Quality-as-Difficulty-Factor family only Seduction and the chase manoeuvres were guided. A Disguise or Stealth roll printed its Quality and stopped, leaving the player to find the rule and set up the check that opposes it | `QUALITY_OPPOSED` in `data.js` (T84) carries all three plain ones, and the result of the roll offers the second half at the Difficulty Factor the book prescribes. Stealth is offered only on a Fair, since better passes unnoticed and worse is spotted automatically. Tailing has no skill of its own, so it is a roll-hub entry that picks the movement skill first | A Superb disguise is looked at on Difficulty Factor 1 and a failed one at 10; a Superb Stealth hands over no check at all |
| A16 | Grenades were in the catalogue and could be bought, but the only way to scatter one was the GM screen — off by default — which then asked the player to type in the Success Quality it had just been told | A throw flow on the Gear row and in the roll hub: range worked out from Strength, a Hand-to-Hand check as the book prescribes for thrown weapons, scatter by Quality with a d10 direction, duds and early detonations, and the blast applied to anyone in the tracker | A Superb throw lands on target, carries the incendiary's Area Damage Rank K, and offers to apply the wound |
| A13 | An attack computed the wound and then only *printed* it. With an encounter running the player had to leave the result, tap the target's Damage button and re-choose the wound the app had just worked out — the same decision taken twice, on two screens | The attack dialog reads the encounter: a target chip row, the target's Speed taken from the tracker for the Hand-to-Hand Difficulty Factor, and an **Apply to `<target>`** action on the result that writes the wound through the accumulation table. An opponent's card carries **Attack this**, which opens the weapons already aimed at them. A wound landing on the player character still runs the full consequence chain | A forced Superb against a tracked Sentry names the target, takes its Speed, applies the wound and reports the result |
| A14 | End Mission unlocked the advancement gate and paid the experience, then left the player on the Combat screen with no way to spend it | The completion dialog carries **Spend experience**, which routes to Advancement | — |
| A12 | Choosing Language as the fourth Ability turned the *generic* Language skill into a Base Chance 20 Ability. It grants one **named** tongue at 20; the generic skill stays at Intelligence. | `baseChanceFor()` and `isTrained()` exempt `language`; the Ability is displayed by its language name | Aidan Hunter's sheet shows French as an Ability alongside Language at INT 12 — his printed row is now reproduced |
| A11 | Height and weight were treated as a single frame purchase: Creation Points were charged twice but Reputation was credited only once, and the wizard forced both into the same row | Split into `identity.heightBand` and `identity.weightBand`. Each charges its own cost and credits its own Reputation; the wizard picks them separately and warns past a one-row gap. Old dossiers migrate from `bandIndex`. | Four published sample characters reproduce their printed Reputation exactly, two of them with height and weight in different rows |

**Solo layer.** Two findings, both at the seam between the two systems rather than inside
either one.

| # | Finding | Fix | Regression check |
|---|---|---|---|
| SA1 | Solo rolls written to the shared log rendered a Classified Success Quality pill from a field they do not have, printing `undefined` in the log | `logRow()` branches on `solo: true` and prints the Mythic outcome instead | The log renders a solo row labelled Mythic and contains no `undefined` |
| SA2 | Adding a Solo tab to the six-tab bottom bar would have overflowed at 360px | Solo takes the Rules slot when the toggle is on, and Rules keeps its Home tile | The bar still carries six tabs, Solo is present and Rules is not, and no screen overflows at 360px |
| SA3 | The reconstructed Fate Chart was wrong in two ways at once: it weighted the odds axis four times as heavily as the chaos axis, and its middle column read 99/95/85/75/50/25/15/5/1. The printed chart is a plain diagonal — one point of Chaos Factor equals one step of odds — with 90 at Certain/CF5 | Replaced with the printed ladder, indexed by `odds rank + (Chaos Factor − 5)` | All 81 printed cells reproduce from a committed fixture; every cell equals the cell up and to its left |
| SA4 | The reconstructed Scene Adjustment table invented ten distinct results, including a "Random Event instead" row. The printed table has six adjustments and a 7–10 band meaning **Make 2 Adjustments** | Replaced with the printed seven rows; `rollSceneAdjustment()` expands the 7–10 recursion, re-rolling until it holds real adjustments, and reports all of them at once | Every printed row reproduces, 7–10 is flagged `double`, and 1–6 are not |
| SA5 | The Fate Check's Chaos Factor adjustment was implemented as one step per point, `CF − 5`, by analogy with the chart. The printing reuses the Roll Modifier column for it, so it is the same uneven ladder as the odds: Chaos Factor 9 is worth **+5**, and it skips −3 entirely between Chaos Factor 3 and 2 | Split into `chartChaosStep()` for the chart's diagonal and `chaosMod()` for the printed check column | The printed Chaos Factor column reproduces; Chaos Factor 9 is +5 on the check and +4 ladder positions on the chart |
| SA6 | Exceptional results on the Fate Check were treated as a **margin** of 5 from the threshold, so a total of 16 read as an Exceptional Yes. The printed Answers table uses **fixed totals**: 18 or more, and 4 or less | `fateCheckAnswer()` reads the printed bands | A total of 16 is a plain Yes and 6 a plain No; 18 and 4 are the Exceptional bands |
| SA7 | The Fate Check fired a Random Event on **any** matching dice. The printing says "Double Digits **Within CF**" — the number showing must also be at or under the Chaos Factor, exactly as the chart requires of its doubles | The trigger checks both conditions | Double 8s fire at Chaos Factor 9 but not at 5; double 2s do not fire at Chaos Factor 1 |
| SA9 | The Solo screen was ordered as a feature menu, not as the sequence of play: **Ask Fate sat above the Scene box**, so the mid-scene oracle came before the boundary that opens a scene, and nothing recorded which phase the adventure was in — no button could say what came next | `scenePhase` on the adventure, a single primary action that reads `Start scene N` or `End scene N`, and loop order down the screen: boundary → in-scene tools → lists → journal → reference | With no scene open the only primary action is Start scene; with one running it is End scene, and the in-play block is quietened in the first case |
| SA10 | One button row mixed three phases — **Test the scene** (opens), **Random Event** (mid-scene), **End scene** (closes) — so all three read as equally available at any moment | Start and End became the phase-driven primary action; Random Event moved into the in-scene block where it belongs | The scene box no longer exists; the primary action is asserted per phase |
| SA11 | End Scene's own dialog promised it would "offer to update your Threads and Characters lists" and then only **printed a reminder** — the upkeep that keeps a solo adventure from wandering was left to the player's memory | Both lists are in the dialog: add a thread or character, strike off what closed, all committed with the boundary under one undo snapshot | Ending a scene strikes off a thread and adds a thread and a character in one commit, and the counter, phase and Chaos Factor all move with it |
| SA12 | The scene test never captured the **expected scene**, so nothing on screen said what the current scene was, and an altered or interrupted result relied on the player remembering to roll the follow-up | `startScene()` asks, rolls, and chains into the Scene Adjustment or the Random Event; the expectation and outcome are stored and shown while the scene runs; an interrupt offers the planned scene as a thread so it is not lost | Starting a scene stores the phase, kind and expectation, journals both, and reports the outcome in the same flow |
| SA13 | A Random Event that named a list — New NPC, Close A Thread — had **no way to act on it**, and the header carried manual Chaos ±1 buttons directly above the End Scene that steps the Chaos Factor for you, inviting a double step | Contextual actions in the event modal (add the NPC, strike off the drawn thread, add a first thread); the manual override and the Fate mechanic switch moved into the Adventures menu | A New NPC event offers Add to Characters, Close A Thread offers to strike off the thread it drew, and an event that names no list carries no list action |
| SA8 | The two mechanics print **different labels for the same nine odds** — the chart reads Certain and Nearly Impossible, the check's table reads Has To Be and No Way — and the app showed the chart's labels in both | `oddsLabel(key, mechanic)` returns the label the active mechanic prints, and the odds chips follow the adventure's `fateMode` | Both label sets resolve for the same rank |

### Newcomer audit

A different question from the three flow audits: not *does the app know the rule* but *can
somebody who has read neither book, and has never played a solo RPG, get anywhere*. Method:
wipe the device, walk every route and every empty state as a first-time player, and tap what
is offered. The findings are all of one shape — the app knew something and did not say it.

| # | Finding | Fix | Regression check |
|---|---|---|---|
| N1 | **Solo play was undiscoverable.** A fresh install carries Home, Sheet, Combat, Rules and Settings; Solo appears only after finding a toggle at the foot of Settings. The Tutorial teaches a screen that is not there, and a player who came here to play alone never meets the word Mythic | A **Play solo** tile sits on Home whether or not the toggle is on. Tapping it explains what the second system is and what it costs — the Rules slot — and turns it on. The tutorial carries the same offer at its foot, since it is a tour of somewhere you cannot go otherwise | With solo off there is still no Solo tab, but Home carries the tile; the offer explains before it switches anything on; Turn on solo play adds the tab and lands on it |
| N2 | **Gear with no dossier was the two words `No character.`** — no explanation, no button, nothing to tap | A real empty state: what the screen is for, and Create a character | The bare string renders on no screen, and every empty state offers a way out |
| N3 | **Advancement was the same two words** | The same, plus the line that experience is paid at the end of a mission — the thing a newcomer is missing when the screen looks empty | as above |
| N4 | Four empty states dropped their **how-to panel**, because `appendHelp` sat after the guard. The player with nothing open is precisely the one who needs it | The panel is appended before the guard on the sheet, gear, advancement and the log | Each of the four keeps its how-to panel with nothing open |
| N5 | **The mission bundles ran with no dossier and reported changes that never happened.** End Session listed cleared exhaustion and re-armed First Aid; End Mission printed a completion dialog with no changes in it at all. Starting an encounter with no dossier opened a tracker with nobody in it and said nothing | `runLifecycle()` checks for a dossier first and says what the bundle would have done, with Create a character beside Close. The empty encounter says why it is empty and points at **+ Add** | End Mission with no dossier explains rather than reporting, and offers to create one |
| N6 | The **roll log's empty state** had nothing to tap: a newcomer who opened it first had no way to find out where rolls come from | It names the four screens rolls arrive from, and offers Roll something — or Create a character when there is nobody to roll for | The log's empty state offers the way out |
| N7 | **Two systems' vocabulary, and nowhere to look any of it up.** *Difficulty Factor* appears on the first roll, *Chaos Factor* on the first scene, and the rules library explains procedures to a reader who already knows the words | `GLOSSARY` in `data-help.js`: 42 terms, grouped by which system owns them, each a sentence rather than a procedure. Opened from a Home tile, the head of the Rules library, the Solo reference and a rules search, which now matches definitions as well as titles | Every term the screens use is defined, no term twice, search matches inside a definition, and the modal filters as you type |
| N8 | The solo toggle's own description claimed **22 Meaning Tables**; 37 ship | Corrected. Drift from the day the authored set went from 13 to 28 | — |
| N9 | **Nothing said what to do first.** Home's empty state offered Create a character and stopped there; the order — dossier, walkthrough, solo — was knowable only by exploring | A first-run card naming the three, ticking what is done, hidden by **Hide this** and by having a dossier with a roll behind it. `startHere` is the one flag with no toggle row, because it is not a preference | A fresh device opens on the card; Hide this removes it and it stays removed |
| N10 | An adventure with **no dossier linked** said so in four muted words in the header, and the fix was two levels down in Adventure settings. With no dossiers at all, that control reported the obvious and stopped | The line is the control: unlinked, it reads **Link a dossier**. With none on the device it offers to create one instead of refusing | The unlinked header shows the control, and with no dossiers it offers to make one |

### Plumbing audit

The newcomer audit asked whether a first-time player could get anywhere. This one asked
whether anything is simply *broken*, and was run by machine rather than by eye: a crawler
clicked every control on every screen and then every control inside every dialog those
opened, with a populated dossier, a running encounter and an open adventure, watching for
console errors, `undefined` in rendered text, and controls that do nothing at all. It found
no broken buttons and no errors — every "does nothing" hit was a chip already selected or a
second dialog opening behind the first. What it did turn up sits under the app rather than
on it.

| # | Finding | Fix | Regression check |
|---|---|---|---|
| F1 | **One Escape closed every open dialog.** Each modal adds its own `keydown` listener on the document, so with two open both fired: opening a stat block over the roster and pressing Escape dismissed the roster too. Tab was worse — two focus traps fighting over the same key, so focus could be pulled into the dialog behind. And a dialog opened over a **locked** step took the locked one with it, which is precisely what `locked` exists to prevent (S10) | Only the modal on top of `openModals` answers the keyboard; the rest ignore it | Two stacked dialogs: Escape closes the top only, a second Escape the one underneath, and a locked step on top ignores Escape without dismissing what is under it |
| F2 | Modal heading ids came from `openModals.length`, so closing the first of two and opening another handed the newcomer an id the survivor was already using — two live dialogs sharing one id, and an `aria-labelledby` pointing at the wrong heading | A monotonic counter | Two open dialogs carry different heading ids |
| F3 | **The DF chip was a button that did nothing.** The chip helper defaulted `onclick` to an empty function, and the one chip with no action was the one that reports the automatic Difficulty Factor — the number a player most wants explained | A chip with somewhere to go is a `button`; one without is not. The DF chip opens **Standing against you**: every condition, what each takes, and the total | The chip is present with a wound and exhaustion standing, and opens a breakdown naming both and the −5 total |
| F4 | The resource chips were a **21px** touch target — Hero Points and Wounds are the most-tapped controls in play, and both were a thumb-width too small | 8px of vertical padding, giving 31px | Every chip measures at least 30px |
| F5 | **A failed `localStorage` write was thrown away in silence.** `writeJSON()` returned false and no call site looked; a full quota — two portraits and a shelf of adventures will do it — meant the dossier stopped saving and the player found out on the next reload | The store raises `store:writefailed` once per session and `main.js` toasts it, naming the way out: export a backup, then drop a portrait or wipe old missions | With `setItem` stubbed to throw, one warning is raised and the toast says storage is full |
| F6 | `CACHE_VERSION` was declared in **both** `service-worker.js` and `main.js`, where nothing read it — and it had already drifted a version behind | Removed from `main.js`. The deployed worker is the version marker (§4), and now the only place the version is written | No file under `src/` declares a cache version, and the worker declares one |
| F7 | A long note beside a label in a `card-row` took the whole row and squeezed the label to **zero width**, so the thing the row was about was the part clipped | Text in a row may shrink and wrap; buttons are left alone, because a button allowed to shrink breaks its own label across two lines. The scar row stacks its note under its location, which is what the note is | A row with a long note keeps a readable label and keeps the button beside it on one line |
| F8 | The Home how-to said the bottom bar carries "the six screens you use in play"; a fresh install carries five, and six only with the GM screen on | Corrected, and it now names why the count changes | — |

Two process guards came out of it and are asserted from now on: every shipped module appears
in the service worker's `APP_SHELL` and every `APP_SHELL` entry is a file that exists, so the
§5 rule about updating the list is no longer a rule the build cannot check.

**Verified against scans supplied after the first build:** the Physical Traits Table (nine bands, both columns), the Wound Rank Accumulation grid, the Characteristics and Skills cost tables, the Potential Abilities list, the Ch.6 experience modifiers and expenditures, and the Skill Rank cap note in both chapters. The Multiplication Table error survives into the official character-sheet PDF.

**Verified against the printed images supplied after the first solo build:** all 81 Fate Chart
cells with both exceptional bands, the Random Event Focus Table, the Scene Adjustment Table,
and the Fate Check's Modifiers and Answers tables. The fixtures at
`tests/fixtures/fate-chart.json` and `tests/fixtures/fate-check.json` are the transcriptions;
the harness compares the app's values against them.

**Nothing in the solo layer is now unsourced.** Every `verify` flag has been removed, and the
harness asserts that none has crept back.

**Verified clean, do not re-litigate:** the Chapter One worked example reproduces exactly at
both DF 6 and DF 7; a d100 of 100 fails at every Success Chance including 300; DF ½ rounds
down; Base Chance clamps at 30 before multiplication; the Seduction formula uses the
Charisma *skill rank*, not its Base Chance; every OSIRIS antagonist's printed Speed and
Hand-to-Hand Damage Rank agree with their characteristics.

---

## 12. Content & IP

Numbers and mechanics extracted; **all effect and flavour text paraphrased, never copied**.
No setting, adventure, art or logo content. Chapter citations in the data files point back
to the source for re-verification.

The app is a personal play aid built from the user's own book. The README states that
publishing or distributing it makes licensing the user's responsibility, and that openly
licensed material is the safe basis for anything public. The OGL notice appears in the
About screen.

**Provenance lives in the data layer, not on screen.** `data-solo.js` marks every table
`source: "mm38"` or `authored: true`, `SOLO_TOPICS` carry a `source`, and `RULES_TOPICS` carry
a `chapter`; the harness asserts against those fields and this file records them. The screens
show none of it — no "Vol. 38", "authored", "as printed" or chapter tags on rows, and no
attribution line in a topic modal. A player at the table wants the table, not its footnote.
The fields stay in the data so the record survives and the labels can come back in one edit.

**Two systems, two provenances.** The Classified layer is OGL 1.0a and paraphrased
throughout. The Mythic layer is not: `data-solo.js` reproduces nine 100-word Meaning Tables
verbatim from the supplied report, because a word list cannot be paraphrased and still be
the same table, and Mythic is Word Mill Games' rather than open content. The user decided
against adding further licensing text to the README or About screen, so the existing
personal-use wording stands and the split is recorded here instead. The thirteen authored
tables are this app's own work and are marked as such (S6).

---

## Changelog

| Date | Change | Why | Verification | Cache |
|---|---|---|---|---|
| 2026-07-30 | Instantiated this spec from the v2 template with the completed System Profile, ledger and roadmap | Stage C start | — | — |
| 2026-07-30 | Extracted the complete core data library: T1–T59, all ticked | Data before features | 282-check harness, including data-integrity cross-references | `classified-v1` |
| 2026-07-30 | Built Phases 0–4 and 6: shell, wizard, sheet, dice engine, in-play systems, GM screen | Core deliverable | Headless Chromium at 360px and 390px, zero console errors | `classified-v1` |
| 2026-07-30 | Derived the Success Quality Table rather than transcribing it (A1) | The printed row 161–170 overlaps at 85, and the Multiplication Table has two arithmetic errors; deriving sidesteps both | Contiguity check across all 300 Success Chances | `classified-v1` |
| 2026-07-30 | Seeded Charisma and Driving in `blankCharacter()` (A2) | Root cause: the factory produced an illegal character, and a draft that never triggered `normalize()` reached Review with an unactionable validation error | Browser creation flow now completes and saves | `classified-v1` |
| 2026-07-30 | Closed audit findings A3–A10 | Engine behaviours deviating from the book | Each has a dedicated regression check | `classified-v1` |
| 2026-07-30 | Split height and weight into independent purchases (A11); confirmed R1, R3, R4, R5 against supplied scans | Root cause: the Physical Traits Table pairs Height and Weight as separate columns and the book permits them to differ by a row, so each is its own purchase. Reputation was being under-counted and the wizard was over-constrained. | 298 checks green, including four published sample characters whose printed Reputation now reproduces exactly | `classified-v2` |
| 2026-07-30 | Shipped `data-pregens.js` with the five published sample characters and one-tap instantiation (T60, T61) | The Character Sheets supplement was supplied as page images, from which the skill columns are readable | All 114 printed Base Chances reproduce; the Creation Point audit clears four of five sheets, with Emily Steele 12 points over on the printed sheet | `classified-v3` |
| 2026-07-30 | Language as the fourth Ability grants a named tongue, not the generic skill (A12) | Root cause: `baseChanceFor()` matched the Ability key against the skill key without exempting Language. Found by Aidan Hunter's sheet, which prints French as an Ability and Language at INT 12. | 325 checks green | `classified-v3` |
| 2026-07-30 | Planned Phase 7 — the Mythic solo layer. Recorded the third source (§2), the solo system profile (§3.20), the eleven solo decisions (§1.2), rulings S1–S7, `data-solo.js` and `src/solo.js` in the file tables, the per-adventure schema at `SCHEMA_VERSION` 4 (§6), the `solo` toggle and its nav swap (§7), ledger rows T62–T79, and the two-provenance note (§12) | Spec before code, per process rule 1. The user asked for a solo tab on the Mythic system and for the supplied Elements tables to be rollable; the answers to Q1–Q12 fix the scope. The ledger boxes stay unticked because no data is extracted yet | None yet — this change is documentation only | unchanged |
| 2026-07-30 | Shipped the Mythic solo layer: `data-solo.js` (T62–T79), `src/solo.js`, the `solo` toggle and its nav swap, per-adventure persistence at `SCHEMA_VERSION` 4, solo rows in the shared roll log, and 22 Meaning Tables — 9 reproduced from the supplied report and 13 authored for this app | Phase 7, per the plan committed earlier today. The Fate Chart, Event Focus and Scene Adjustment tables were not in the supplied source, so they are derived or reconstructed and flagged on screen (S1); the Fate Check ships alongside because it needs no chart | 442 checks green, including all 900 baseline words against a committed fixture extracted from the report, chart monotonicity on both axes, band contiguity at every odds and Chaos Factor, and the event trigger. Driven headless at 360px in light and dark: adventure creation, both Fate mechanics across all nine odds, scene test, scene adjustment, twelve Random Events, list randomisation, seven Meaning Tables, guided End Scene with undo, and the roll log — zero console errors, zero horizontal overflow | `classified-v4` |
| 2026-07-30 | Closed SA1 and SA2 | Root cause of SA1: `logRow()` read `quality` and `QUALITY_SHORT[quality]` unconditionally, and a Fate answer has no Success Quality, so the pill rendered `undefined`. SA2 was a layout limit, not a bug — six tabs is the maximum at 360px | A solo row renders as Mythic with no `undefined`; the nav carries six tabs with Solo in the Rules slot | `classified-v4` |
| 2026-07-30 | Extended the authored Meaning Tables from 13 to 28 (T80–T82): an in-play set for combat, wounds, chases, Reactions, coercion and social play; a world set for weather, senses, terrain and institutions; and a story set for twists, scene framing, motive, leverage and aftermath. 37 tables, 3,700 words | The report's Step 1 is to define the subject, and the app's subjects are the game's own subsystems — a solo player narrating a §3.17 fight or a §3.13 chase had no table pointed at it, so every procedure that has to be narrated rather than rolled now has one. Combat Action pairs across to Espionage Description and Scene Framing to Location, so an interrupt scene arrives with a place attached | 444 checks green: every table exactly 100 single capitalised words, no repeats inside an authored table, Anything Words seeded in all but the codename list, every pairWith and Event Focus suggestion resolving, and the group index matching the roller | `classified-v5` |
| 2026-07-30 | Replaced the reconstructed Fate Chart and Scene Adjustment table with the printed originals, supplied as images (S1 resolved; SA3, SA4); confirmed the Event Focus table and the Exceptional Yes/No derivation | Root cause of SA3: the reconstruction guessed at two things and got both wrong — it weighted the odds axis four times as heavily as the chaos axis, where the printed chart is a plain diagonal, and its middle column put Certain at 99 where the printing says 90. Root cause of SA4: the reconstruction invented ten results where the printing has six plus a 7–10 "Make 2 Adjustments" band. S2 needed rounding rather than truncation, and the printed **x** cells mean a band that cannot occur, now `null` rather than a fabricated 1 | 456 checks green, including all 81 printed cells against a new committed fixture, the diagonal property, every d100 reading as exactly one answer at all 81 cells, and every printed Scene Adjustment and Event Focus row. Driven headless at 360px: both mechanics, the 7–10 recursion, and the chart reference view | `classified-v6` |
| 2026-07-30 | Made the app notice a deploy: `main.js` polls `registration.update()` on foreground, focus, reconnect and a 15-minute heartbeat, and raises a persistent Reload/Later toast when a new worker installs behind the current one. The service worker answers `SKIP_WAITING` so a waiting worker takes over before the reload | The update toast only fired on `updatefound`, which the browser raises on a hard navigation — an installed PWA can sit for days on stale code after a push. A worker already waiting from a previous visit was missed entirely, and the old toast auto-dismissed after 2.6 seconds, so the one thing it existed to offer could vanish before it was read | 474 checks green, plus an end-to-end deploy simulation: load, edit the served `CACHE_VERSION` and a module, force a check, toast appears, Reload brings up the new code with the old cache purged and no toast left behind. Zero console errors | `classified-v7` |
| 2026-07-30 | Transcribed the printed Fate Check page, closing the last unsourced piece of the solo layer (S1 fully resolved; SA5–SA8) | Root causes, all from reasoning by analogy with the chart instead of from a source: the Chaos Factor adjustment was linear where the printing reuses the uneven Roll Modifier column (+5 at Chaos Factor 9, no −3 at all); Exceptional results were a margin of 5 where the printing uses fixed totals of 18 and 4; the Random Event trigger ignored the "within CF" half of "Double Digits Within CF"; and the check's own odds labels — Has To Be, Sure Thing, No Way — were not carried at all | 495 checks green against a new committed fixture: every printed odds label and Roll Modifier, the whole Chaos Factor column, the Answers bands, the doubles trigger at three Chaos Factors, and the chart's diagonal still intact beside the check's separate ladder | `classified-v8` |
| 2026-07-30 | Removed every source-attribution label from the UI: the "Vol. 38" and "authored" tags and the `d100` column on Meaning Table rows, the "as printed" tags on the solo reference list, the source line in a solo topic modal, the provenance banners in the Fate Chart and Fate Check views, and the Classified chapter tags in the rules library rows, search results and topic modals | The user asked for these labels gone, and for any like them. They were shelf-provenance, not play information — the same four words repeated down a column, squeezing the table names into a narrow gutter on a phone. Provenance is still recorded where it belongs: the `source`/`authored`/`chapter` fields in the data layer, the ledger, and §12 | 501 checks green, including a new sweep that walks the Solo and Rules screens and their modals and asserts none of the attribution strings render, and that no Solo row carries a trailing label column | `classified-v9` |
| 2026-07-30 | Trimmed the Solo reference list: dropped the "Meaning Tables and building your own" topic and the button that opened it, dropped the "Building a table" entry and its unreachable `showMethod()`, and renamed "Mythic and Classified side by side" to "Mythic and Classified" | The user asked for it. Both removals were how-to-write-tables material rather than how-to-play material, and 37 rollable tables sitting directly above them made the essay redundant. `TABLE_BUILD_METHOD`, `ONE_WORD_NOTE` and `ANYTHING_WORD_NOTES` stay in the data layer — T70 and T71 are extraction rows, not UI rows, and the harness still checks them | 512 checks green: the topic list is asserted key by key, and a browser sweep confirms neither removed entry nor the old title renders on the Solo screen | `classified-v10` |
| 2026-07-30 | Every accordion now starts closed: the sheet's skill groups, the wizard's skill groups, and the Solo screen's Meaning Table groups | The user asked for it, and the defaults had drifted per screen — the sheet opened all of them, the wizard opened Combat and Covert, Solo opened Espionage. A phone screen that opens as a list of headings is navigable; one that opens expanded is a wall. The gear catalogue keeps opening groups that match a live search, which is a result and not a default | 518 checks green, including a sweep of the sheet, wizard, Solo and gear screens asserting no `details.acc` renders open, and a check that a closed accordion still holds its rows in the DOM so counts and search keep working | `classified-v11` |
| 2026-07-30 | Turned off zoom for the installed app: `maximum-scale=1, user-scalable=no` on the viewport, `touch-action: manipulation` on the root and body, iOS pinch-gesture handlers in `main.js`, 16px text fields, and the standalone/apple-mobile-web-app meta tags | Reported: a home-screen copy still pinched and double-tapped to zoom. The viewport meta carried no scale limit, so nothing stopped it; `touch-action` was unset, so double-tap zoom was live; iOS ignores `user-scalable` in a Safari tab, hence the gesture handlers; and fields under 16px make iOS zoom to a focused input, which is the other route to a scaled view. The multi-touch guard cancels nothing single-fingered, so panning and taps are untouched | 534 checks green, including the viewport contents, computed `touch-action` on root and body, no field under 16px, the standalone declaration, and that the page still scrolls with zoom disabled | `classified-v12` |
| 2026-07-30 | Audited the Solo screen against Mythic's sequence of play and rebuilt it as that loop (SA9–SA13, ruling S9): `scenePhase` on the adventure at `SCHEMA_VERSION` 5, one phase-driven primary action, a Start Scene flow that captures the expected scene and chains the adjustment or interrupt, an End Scene that carries the Threads and Characters upkeep it always claimed to, contextual list actions on Random Events, and the Fate mechanic and manual Chaos override moved out of the header into the Adventures menu | Reported: the buttons did not follow the sequence of play. They did not — the screen was a feature menu. Ask Fate sat above the scene boundary that opens a scene; one button row mixed opening, mid-scene and closing actions; nothing tracked the phase, so no control could say what came next; End Scene promised list upkeep and delivered a reminder; the expected scene was never captured, so the screen could not say what the current scene was; and manual Chaos ±1 sat directly above the End Scene that steps it | 588 checks green. Driven headless at 360px: three scenes played start to finish through the UI, plus a forced high-chaos run that exercised altered scenes, the 7–10 adjustment recursion, an interrupt that rolled its own event and kept the planned scene as a thread, and the event list actions. Zero console errors, zero overflow | `classified-v13` |
| 2026-07-30 | Audited every Solo button against the sequence of play and closed six breaks (S10-S13) | Root cause: the mandatory follow-up rolls were ghost buttons beside a dismissing primary, and `scenePhase` flipped to `play` on the scene test rather than at the end of the chain, so a scene could be reported as running with its adjustment or interrupt never rolled. | 628 checks green, including a chain walk asserting every step is locked, carries one primary, and ends on the commit | `classified-v14` |
| 2026-07-30 | Individual journal entries can be copied and deleted, and the journal gained a Copy all | Asked for. A journal you cannot prune or quote is a log file rather than a record of play. | 636 checks green, including both clipboard paths and a delete that leaves the rest of the journal alone | `classified-v15` |
| 2026-07-30 | Added the mission briefing as a phase before scene 1 (S14, S15) | A new adventure opened on scene 1 with empty lists, so the first Random Event had nothing to draw and the player had no premise to test a scene against. Seven rolled-and-editable rows now seed Threads and Characters, and `espCover` and `espIntel` finally have a job outside the manual roller. | 664 checks green, including a run that rolls every row, writes over one, commits, and asserts the seeding, the generated opponent, the phase move and the closed pinned accordion | `classified-v16` |
| 2026-07-30 | The briefing's Primary Opponent gets a rolled identity, and the whole mission can be deleted (S16, S17). `SCHEMA_VERSION` 7 records which list entries a briefing seeded | Reported: the primary villain was stuck at "Villain Primary Opponent". Root cause: `generateNPC()` names an NPC `rank.npcName + stereotype.name`, and the briefing pins both to Villain and Primary Opponent, so the name was a constant while the stats behind it changed — pressing Generate looked like it did nothing. A codename off `espCodename` and a pair off `espAdversary` now go in front of the stat block. Deleting was simply missing: a briefing could be rewritten but never removed, so an adventure was stuck with the mission it opened on | 706 checks green, including four generations that must not repeat and must never read the category label, all three identity rolls kept with the row, and a delete that takes back the two seeded threads and the seeded character while leaving a hand-added thread alone, returns the phase to briefing, journals it and leaves an undo | `classified-v17` |
| 2026-07-30 | The pinned mission briefing stopped printing every row twice (S18) | Reported with a screenshot: seven rows, each reading `Interrogate · Start` and then `Interrogate · Start` again. Root cause: the row rendered `text` and then the words underneath unconditionally, and since rolling a row writes the joined words straight into the field, an unedited row's text is exactly that word line. The words are now shown only when the text has been written over — the case where they record what the line came from — and the Copy output follows the same rule. | 716 checks green, including that no pinned row prints its own words back underneath itself, that an unedited row is a single line, and that the one row written over in the test keeps its prompt | `classified-v18` |
| 2026-07-30 | Added Wipe data to Settings: wipe all missions and wipe all characters, each with its own count, disabled when empty, and confirmed with what it destroys and what it leaves alone. `Store.wipeAdventures()` and `Store.wipeCharacters()` back them | The user asked for it. Deleting adventures one at a time from the Adventures menu and dossiers one at a time from the sheet was the only way to start clean. The two wipes stay strictly separate — missions do not take dossiers with them, and dossiers do not take the roll log — because a player clearing one usually wants to keep the other | 740 checks green, including that each wipe empties only its own store, clears its pointers and the solo undo snapshot, leaves the roll log intact, and that both buttons report and disable themselves once there is nothing left | `classified-v19` |
| 2026-07-31 | Added `data-help.js` and `src/help.js`: a collapsed "How to use" accordion on all eleven screens and all eight Solo panels, behind a `showHelp` toggle that starts on, plus a Tutorial screen walking one solo mission from creating the operative to End Mission | The user asked for it. The app had a rules library explaining the *game* and nothing explaining the *app*, and the solo loop in particular is four surfaces deep before anything happens. Help copy lives in its own data module for the same reason rules values do: `src/` renders it, never authors it. The tutorial is read-only and shows the Classified rolls in place, so the two systems are seen working together rather than re-taught | 787 checks green: every screen and panel has an entry of the right shape, every panel renders its accordion closed, the toggle removes them all, the tutorial's steps are numbered and its rule links resolve. Swept all twelve routes at 360px, zero overflow, zero console errors | `classified-v20` |
| 2026-07-31 | Fixed the Advancement screen, which threw for any open character: it read `R.REPUTATION_TABLE`, and `rules.js` does not re-export that table | Root cause: the reference was wrong from the start, and the screen's own empty-state guard hid it — the route sweep only ever visited Advancement with no character open, so it returned early and never reached the line. Adding a how-to panel to the screen is what made the harness open it with a character | A regression check renders Advancement with a character and asserts the Reputation band and the raise buttons are there | `classified-v20` |
| 2026-07-31 | Start an adventure no longer prompts for a name or a dossier: the tap creates the adventure, links the dossier already open, and lands on the briefing (S19) | Reported, and right: the name prompt asked the player to invent the one thing the app was about to roll for them, since the briefing's codename row names an untitled adventure on commit. The dossier chooser was the same mistake in a different key — the open dossier is the answer unless the player is deliberately switching, and Adventure settings holds both | 805 checks green, including that the tap opens no modal at all, that the adventure exists immediately at the briefing phase with the open dossier linked, and that its name is still Untitled until a codename lands | `classified-v21` |
| 2026-07-31 | Added Mysteries to the Solo screen (T83, ruling S20): a 4/6/8-segment clock on the objective, the complication, the opponent or any thread, filled by clues, scenes, Exceptional Fate answers and events that draw its thread, revealing a shape off a new authored table plus a word pair from the subject's Meaning Table — and, on the objective, offering to rewrite what the mission is for | The user asked for a counter towards a reveal, and for the objective to be able to twist. Researched how other systems do it: Blades in the Dark's clocks make the pressure visible, Ironsworn's progress tracks add a second resolution roll beside Fate, and Brindlewood Bay generates the truth at the reveal instead of writing it down first. The last is the one that matters solo — a pre-written answer is one the player already knows, and a rolled one cannot contradict what has been played — so the clock is Blades' and the reveal is Brindlewood's. Neither book has any of it, so it is labelled a house aid on the panel, in its how-to entry and in its topic | 856 checks green: the Reveal table covers the whole d100 with no gap, every subject's colour table resolves, clocks clamp at both ends and refuse to overfill, a version-7 adventure loads with no mysteries, and a browser run fills a four-segment clock, reveals it, and confirms the objective's rewrite action, the roll-log row and the Exceptional-answer tick | `classified-v22` |
| 2026-07-31 | Replaced the mystery clock with clues that set the odds of a Fate roll, and added the briefing's Hidden truth row (S21, T83, `SCHEMA_VERSION` 9) | Reported, and right: a visible 4/6/8 clock told the player that the fourth clue would break the mystery open, which is a countdown rather than a mystery. Clues now raise the odds — 1 Very Unlikely through 6+ Nearly Certain — and after every clue the app asks the chart whether this is the moment, at the current Chaos Factor, so a case can crack on the second clue or hold past the sixth. An Exceptional Yes brings a second word pair; an Exceptional No is a lead going cold and costs the clue. The briefing gained an eighth row that rolls whether the mission conceals anything and what it hangs on, opening the mystery at zero clues | 872 checks green, including the odds ladder rung by rung against real chart rows, the Hidden truth table's coverage and subjects, a version-8 clock migrating to clues, and a browser run that marks clues until Fate breaks the mystery open and checks the question is logged in its own words | `classified-v23` |
| 2026-07-31 | Roll all on the briefing, the seeded list lines editable before they are added, and every Threads or Characters entry rewordable in place (S22) | Reported with a screenshot of a Threads list reading `Deliver · Evaluate` and `Roadblock · Traffic`. Root cause: the briefing seeded each list with its row text verbatim, and the row text is the rolled words joined, so the lists opened on word pairs rather than on anything a player could act on — and once an entry was on a list there was no way to reword it, only remove it. Rolling the mission was also seven separate taps before it could be read as a whole | 898 checks green, including Roll all filling every row and sparing an edited one, a seed line that tracks its row until it is written and then holds, the written line being what lands on the list while the briefing row keeps its words, and a reword that keeps the entry's id and weight | `classified-v24` |
| 2026-07-31 | Mysteries gained the six things the panel was missing (S23, `SCHEMA_VERSION` 10): clue lines, a false lead on two refusals, a Chaos step for a cold case, a reveal that names someone off the Characters list, a tell written onto the opponent's stat block, and a rewordable title | Asked for, all six. Root of the set: a clue was a bare increment, so the reveal's shape and word pair were being read against a number rather than against anything the player had found — the one thing that makes a generated truth land. The rest follow from the same reading: a run of No answers produced nothing at all, a mystery could sit untouched for a whole session with no cost, a shape that says *someone you trusted* could not say who, a reveal on the opponent changed the fiction but not the stat block, and a mystery opened on a rolled thread was stuck with that thread's word pair for a name | 964 checks green over four consecutive sweeps, including the clue line surviving a reload, a deterministic false lead on the second refusal, a stale case stacking its Chaos step with the control question, a forced *Someone you trusted* drawing the right name off the list, and a Weakness landing on the stored opponent. One flaky browser check fixed at root: it drove a screen left over from an earlier block, and now runs on an adventure of its own | `classified-v25` |
| 2026-07-31 | Audited the solo loop end to end for seams and closed four (S24, `SCHEMA_VERSION` 11): the mission can be ended, the opponent can be sent to the encounter tracker, a scene carries the Classified checks beside the oracle, and a full Adventure List says so | Asked for an audit of whether solo play flows. It did not, in four places, all at the joins rather than inside either engine. The loop had no exit at all — an adventure ran until it was abandoned, and the mission-end bundle that pays the experience was on another screen with nothing pointing at it. The briefing generated a full stat block that could only be read. Fate answered questions in a screen with no way to roll the skill the answer called for. And End Scene silently swallowed list additions past 25 | 1008 checks green over three consecutive sweeps, including the whole ending chain — Solo's dialog into Classified's, the adventure closed, the experience and mission count moved on the dossier, the closed banner replacing the next scene — plus the opponent landing in a fresh encounter with its stat block intact, and the check block appearing only when a dossier is linked | `classified-v26` |
| 2026-07-31 | Audited the whole app for flow, not just Solo, and closed two seams outside it (A13, A14): an attack now knows its target and applies the wound it worked out, and End Mission points at the screen where the experience is spent | Asked for a second audit, this time over everything. Inside Solo the loop now holds; the breaks left were on the Classified side and both at the same join — the app computed something and then made the player carry it to another screen by hand. An attack worked out the wound and printed it; the target's Speed sat in the tracker while the attack dialog asked for it; and the mission bundle announced unlocked advancement on a screen that could not spend it | 1018 checks green over three consecutive sweeps, including a forced Superb that names its target, takes its Speed from the tracker, applies the wound through the accumulation table and reports the result | `classified-v27` |
| 2026-07-31 | Built the rest of Phase 5 and ticked it: campaign create and join with the three-word code, the party panel and seat picker, two-way combat sync behind an echo guard, the table's rolls beside the local log, and the dossier photograph compressed in the browser. Removed a stray debug script from the repo root and corrected the tutorial's closing step, which still sent the player to the Combat screen for End Mission | The last unticked roadmap box, and two pieces of drift the audit turned up. Every control is exercised against a local campaign record, so the flow works and is tested on one device with no keys, and the same taps do the real thing once keys are in place. The portrait is a 256px JPEG data URL rather than a Storage upload for the same reason: it works with zero configuration, and an uncompressed phone photograph would take the dossier down with the quota | 1053 checks green over three consecutive sweeps: the panel's controls, a created campaign's code shape, name, role, party and persistence, and the portrait downscaled to 256 square, smaller than its source, rendered on the sheet and present in the backup. One flaky check fixed at root — a doubled adversary pair made the pinned briefing think the row had been written over | `classified-v28` |
| 2026-07-31 | Third flow audit, over everything again: closed the last two places where the app knew a rule and stopped short of it (A15, A16; T84, T85) | Both were the same shape as A13, which is what made them worth looking for. §3.2 says the Quality-as-Difficulty-Factor family is implemented; Seduction and the chases were, but Disguise, Stealth and Tailing printed a Quality and left the opposing check to the player. And grenades could be bought from the catalogue while the only scatter roll in the app sat behind the GM toggle and asked for the Quality by hand. Both are now data-first — the procedures and the throw constants went into `data.js` before either flow was written | 1087 checks green over three consecutive sweeps, including the disguise ladder at both ends, a clean Stealth handing over nothing, and a forced Superb throw landing on target with its Area Damage Rank | `classified-v29` |
| 2026-07-31 | Fourth pass: gave the last two extracted-but-unreachable systems a surface (A17, A18; T86) | Both were data with no way in. A vehicle could be issued at creation and then rendered on no screen, which also meant the 36 modifications and the Modification Point budget — the same number that decides how much damage the vehicle absorbs for the people inside it — had nowhere to live. The bug parts were four catalogue rows and a note about adding ten per cent. Characters normalize their vehicles now, so an old dossier's `{key, name}` gains its modifications, its wound and an id | 1119 checks green over three consecutive sweeps, including a fitted modification spending its budget and surviving a reload, the armour line, the occupant chain, and a built bug landing on the dossier at the price it quoted | `classified-v30` |
| 2026-07-31 | Fifth pass, driving the app rather than reading it: found and fixed the one place a deleted dossier left live-looking controls behind (A19) | Every earlier audit walked the happy path. This one deleted a dossier out from under a running encounter and an open solo adventure, which is what a player does when they retire a character. The combatant's Attack button stayed on the card, resolved to nothing, and reported nothing; the adventure held a dead link for good. Fixed in the store rather than on each screen, so both the single delete and the wipe are covered | 1127 checks green over three consecutive sweeps, plus a scripted probe over all ten routes with a deleted dossier in play: zero console errors, zero horizontal overflow at 360px | `classified-v31` |
| 2026-08-19 | Newcomer audit (N1–N10): the app is now usable by someone who has read neither book. A glossary of both systems' terms in `data-help.js`, reachable from Home, the Rules library, the Solo reference and a rules search; a first-run card on Home; solo play offered from Home and from the tutorial rather than hidden behind a Settings toggle; real empty states on Gear, Advancement, the Sheet and the log; the mission bundles refusing to report changes they cannot make; and the unlinked-adventure line turned into the control that fixes it | Asked: how idiot-proof is it for someone who never read the manuals and does not know how to play a solo RPG, across every function. Driven from a wiped device rather than read. Every finding was the same shape — the app knew something and did not say it — and two were worse than silence: a player who came here to play alone could not find the Solo screen at all, and End Session with no dossier open listed changes it had not made | 1213 checks green over three consecutive sweeps, including a newcomer sweep that walks every empty state on a wiped device, drives the solo offer from tile to tab, opens and filters the glossary from both libraries, and asserts the mission bundle explains itself rather than reporting. It also closed a harness gap found while writing it: nothing clicked the encounter tracker's own **Acted** and **✕** controls, so a fault in the path behind them would have passed | `classified-v32` |
| 2026-08-19 | Plumbing audit (F1–F8), run by crawler rather than by eye: only the top dialog answers the keyboard and heading ids stopped colliding; the DF chip became the control that explains itself instead of a button with an empty handler; the resource chips became a real touch target; a failed `localStorage` write is announced instead of swallowed; the duplicate `CACHE_VERSION` in `main.js` is gone; and a long note can no longer squeeze its label out of a row | Asked to fix everything. A crawler clicked every control on every screen, then every control inside every dialog they open, with a populated dossier, a running encounter and an open adventure. No broken buttons and no console errors anywhere — every apparent dead control was a chip already selected or a second dialog opening behind the first. The real faults were under the app: stacked modals shared one document-level key handler, so Escape closed the whole stack and could dismiss a locked step of the Start-scene chain from underneath it, and the persistence layer returned a failure nobody read | 1245 checks green over three consecutive sweeps, including the stacked-dialog behaviour in both directions, the locked step under an ordinary one, chip heights, the condition breakdown, and a stubbed quota failure raising exactly one warning. Two process guards added with it: every shipped module is in `APP_SHELL`, every `APP_SHELL` entry exists, and the cache version is declared in exactly one file | `classified-v33` |
