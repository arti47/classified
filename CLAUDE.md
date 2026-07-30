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
| Missing GME tables | Reconstructed and flagged, then **replaced by the printed originals** | The Fate Chart, Event Focus and Scene Adjustment tables were supplied as images afterwards; only the Fate Check's modifiers are still unsourced — ruling S1 |

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

**Printed images of the three missing tables were supplied after the first solo build** and
are the source of record for them: the Fate Chart (9 odds × Chaos Factor 1–9, all three
numbers per cell), the Random Event Focus Table and the Scene Adjustment Table. They are now
transcribed rather than reconstructed, with a committed fixture holding the printed values
(ruling S1). The Fate Check's odds and chaos modifiers remain the app's own arithmetic and
stay flagged.

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
| **Fate Check** | The chartless alternative: 2d10 + odds modifier + chaos modifier against a threshold of 11; matching dice trigger a Random Event, and a margin of 5 either way makes the answer Exceptional. Selectable per adventure, and the only piece with no supplied source behind it. | `fateCheckAnswer()` |
| **Random Event trigger** | On the Fate Chart, a doubles roll (11, 22, … 99) whose tens digit is at or under the Chaos Factor fires a Random Event **as well as** answering the question. | `isRandomEventRoll()` |
| **Random Event** | Roll the Event Focus table, then roll a word pair from a Meaning Table to colour it. Focuses that name a thread or character draw from the Adventure Lists. | `rollRandomEvent()` |
| **Chaos Factor** | 1–9, clamped. Starts at 5. Falls one step when the scene went the character's way, rises one step when it did not. | `stepChaos()` |
| **Scene test** | At scene start, roll d10: over the Chaos Factor the expected scene happens; at or under, an **odd** roll alters it and an **even** roll replaces it with an **interrupt** scene built from a Random Event. | `sceneTest()` |
| **Scene Adjustment** | The altered-scene table: remove or add a character, reduce or increase an activity, remove or add an object, or on 7–10 **make two adjustments**, each rolled again. The app expands the recursion rather than leaving it to the player. | `sceneAdjustment()` |
| **Adventure Lists** | Threads and Characters, 25 slots each, weighted by repeated entry. Randomising a list rolls d100 across the slots so frequently entered items come up more often. | `rollList()` |
| **Meaning Tables** | 37 tables of 100 words. Rolled as a **pair** by default; the same word twice is amplification, not a re-roll. | `rollMeaning()` |

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

#### 3.20.4 Scene boundaries, and how they differ from R9

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
| S1 | The supplied report contains the Meaning Tables but **not** the GME core procedures — no Fate Chart, no Event Focus table, no Scene Adjustment table | **RESOLVED by printed images supplied afterwards.** All three are now transcribed from the printing and the `verify` flags are gone. The Event Focus table **confirmed** the reconstruction band for band. The Fate Chart and Scene Adjustment table **replaced** theirs — see SA3 and SA4 for what was wrong. The escape hatch built for this worked exactly as intended: swapping in the printed values was a `data-solo.js` edit and nothing else. `FATE_CHECK_VERIFY` stays true, because the Fate Check's modifiers were never in any supplied source and still are not. |
| S2 | Exceptional Yes and Exceptional No thresholds | **Derived, not transcribed**, on the A1/R2 precedent, and now **confirmed against all 81 printed cells**: Exceptional Yes is `round(target / 5)`, Exceptional No is `100 − round((100 − target) / 5) + 1`. Two corrections came out of the scan: the rounding is round, not floor — a target of 99 gives 20, which truncation misses — and at a target of 1 no Exceptional Yes exists while at 99 no Exceptional No does, which is what the printed **x** means. Both cases return `null` and the UI drops the band rather than inventing one. |
| S3 | Random Event trigger on the Fate Chart | Doubles (11, 22, … 99) whose **tens digit is at or under the Chaos Factor**. The event fires in addition to the answer, never instead of it. |
| S4 | Chaos Factor bounds | 1–9, clamped at both ends, starting at 5. `stepChaos()` clamps rather than wrapping. |
| S5 | Two different things called a scene | Kept separate and separately labelled. R9's End Scene stays the Classified combat-flag house aid on the Combat screen; Mythic's End Scene is its own bundle on the Solo screen. Neither calls the other. |
| S6 | The 13 authored tables are not extracted from anything | Marked `authored: true`, listed apart from the `source: "mm38"` baselines, and described on screen as written for this app. They are not presented as Mythic Magazine content. |
| S7 | Whether a Fate answer should be spendable with Hero Points | **No.** Hero Points shift a Classified Success Quality; nothing in either book connects them to an oracle. Left alone rather than invented. |
| S8 | The supplied report's Objects column prints Information and Intriguing twice, at 49-50 and again at 51-52 | **Reproduced as supplied.** The report is the source of record, and silently repairing a source table is how transcription damage gets laundered — the same reasoning as R3, where the app multiplies rather than trusting the printed 8 × 7 = 46. Two regression checks pin the repeat in place so it cannot be tidied away by accident. |

---

## 4. Architecture — LOCKED

- **No build step.** Vanilla JS, native ES modules loaded directly by the browser. Clone
  and run always works.
- **Installable PWA:** `manifest.json`, `service-worker.js` (network-first, caches the app
  shell, versioned `CACHE_VERSION`), an SVG icon, and an in-app update toast.
- **Storage:** `localStorage` local-only mode works with zero configuration; real keys in
  `firebase-config.js` plus the `FIREBASE_ENABLED` flag switch on cloud sync.
- **Firebase:** Realtime Database + Storage for portraits.
- **Auth:** instant anonymous launch, no login wall.
- **Roles from day one:** `members/{uid}.role: "player" | "gm"` in the schema *and* in
  `database.rules.json`.
- **Campaigns:** memorable three-word join codes (`red-dragon-sword`).
- **Themed UI primitives:** no native `alert`/`confirm`/`prompt`. A shared `modal()` plus
  `showToast`/`confirmModal`/`promptModal`/`chooseModal`, with focus trap, Escape, and
  focus restore.
- **Accessibility:** `aria-live` roll announcements, labelled icon buttons, `aria-current`
  nav, a skip link.
- **Responsive:** phone-first, zero horizontal overflow at 360px.

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
| `solo.js` | The Mythic engine and the Solo screen: Fate, Chaos, scene test, Random Events, Adventure Lists, Meaning-table roller, journal, guided End Scene |
| `screens.js` | Home, rules library, roll log, advancement, settings |
| `router.js` | Bottom-nav routing and conditional tab gating |
| `main.js` | Entry point and boot |

No `power-automation.js` (§3.14).

`solo.js` may import `core.js`, `ui.js`, `store.js`, `settings.js` and `data-solo.js`. It
must **not** import `rules.js` or `data.js`: the Mythic layer never reaches into the
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
  threads:    [ { id, text, weight } ],         // Adventure List, 25 slots
  characters: [ { id, text, weight } ],         // Adventure List, 25 slots
  journal:    [ { id, ts, kind, text, detail } ]  // kind: scene|fate|event|meaning|note
} ]
classified.soloActive: <adventureId>
classified.soloUndo:   <one-step End Scene snapshot>
```

Every schema addition ships with a back-fill in `normalize()` and is documented here in the
same change. `SCHEMA_VERSION` is 4. The pre-A11 single `bandIndex` field is migrated to `heightBand` and `weightBand` on load. Version 4 adds the solo keys above; characters are
untouched by it, and `normalizeAdventure()` — in `store.js`, beside the rest of the
persistence layer, so `derived.js` stays free of Mythic — back-fills every field, clamps the
Chaos Factor, truncates a list past 25 slots and corrects a weight below 1. A version-3
backup carries no solo section and imports cleanly. Solo rolls are written to the shared log
with `solo: true` and a Mythic `outcome` instead of a Success Quality.

---

## 7. Settings & toggles

One pattern: a flag in `settings.js` (off by default), a toggle row in Settings with a
one-line description, every related UI checks the flag, and gated nav tabs are hidden by the
router.

`gmScreen` · `multiplayer` · `manualDice` · `showUntrained` · `autoConditions` ·
`heroPointPrompt` · `seatbelts` · `airbags` · `solo`. Plus `theme` and `campaignStyle`,
which are choices rather than toggles.

`solo` is the only toggle that **swaps** a nav tab rather than adding one: six tabs is the
limit at 360px, so when solo is on the Solo tab takes the Rules slot and Rules stays
reachable from its Home tile. `manualDice` applies to Mythic rolls too — `getD100()` is
still the single entry point, and the Fate Check's 2d10 gets the same treatment.

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
- [x] **T45** Vehicle modifications — 36 entries
- [x] **T46** Miscellaneous gear — 106 entries across 12 categories
- [x] **T47** Bug construction system
- [x] **T48** Rules library topics — 9 core procedures
- [x] **T49** OGL notice

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
- [x] **T64** Fate Check — odds modifiers, chaos modifiers, threshold, matching-dice trigger *(unsourced, flagged, S1)*
- [x] **T65** Chaos Factor — range, start, stepping, and what raises or lowers it *(S4)*
- [x] **T66** Scene test — expected / altered / interrupt, and the d10 procedure
- [x] **T67** Scene Adjustment table, including the 7–10 double *(transcribed from the printed table, S1)*
- [x] **T68** Event Focus table *(transcribed; the printing confirmed the reconstruction, S1)*
- [x] **T69** Adventure Lists — Threads and Characters, 25 slots, weighting and randomisation
- [x] **T70** Anything Words — the ten, and the doubles-as-amplification rule
- [x] **T71** The five-step table-construction method, as a rules-library topic
- [x] **T72** Baseline Action Tables — Action 1, Action 2 *(200 words, mm38)*
- [x] **T73** Baseline Description Tables — Descriptor 1, Descriptor 2 *(200 words, mm38)*
- [x] **T74** Baseline Elements Tables — Locations, Characters, Objects *(300 words, mm38)*
- [x] **T75** Baseline Adventure tables — Genre, Tone *(200 words, mm38)*
- [x] **T76** Authored core espionage set — Espionage Action, Espionage Description, Agency & Tradecraft, Adversary, Location, Object & Equipment *(600 words, authored)*
- [x] **T77** Authored mission set — Mission Objective, Complication, Cover Identity, Intel & Rumour *(400 words, authored)*
- [x] **T78** Authored flavour set — Codename Words, Surveillance & Chase, Gadget Quirk *(300 words, authored)*
- [x] **T79** Solo rules-library topics — Fate, Chaos, scenes, events, lists, table building
- [x] **T80** Authored in-play set — Combat Action, Wound & Injury, Vehicle & Chase, Reaction & Attitude, Coercion & Pressure, Social & Seduction *(600 words, authored)*
- [x] **T81** Authored world set — Weather & Time, Sensory Detail, Terrain & Environment, Organisation & Faction *(400 words, authored)*
- [x] **T82** Authored story set — Mission Twist, Scene Framing, Motive & Secret, Leverage & Money, Consequence & Aftermath *(500 words, authored)*

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
- [ ] **Phase 5 — Multiplayer & Sync** *(gated per §1.1; architecture in place)*. Firebase
      init, security rules and role schema are written and shipped. Remaining: campaign
      creation and join UI, party overview, two-way combat sync, shared roll log, portrait
      upload with client-side compression.
- [x] **Phase 6 — Conditional surfaces.** GM screen with party panel, encounter generators,
      NPC generator, OSIRIS roster and reference tables. No expansions, no solo mode, no
      power automation — none exist in this game.
- [x] **Phase 7 — Solo play (Mythic).** *(§3.20, decided in §1.2.)*
      - [x] `data-solo.js` extracted and authored per the T62–T82 ledger.
      - [x] `src/solo.js`: Chaos + scene header, Fate question box on both mechanics,
            Random Event generator, Threads and Characters lists, Meaning-table roller,
            adventure journal, guided End Scene with one-step undo.
      - [x] Per-adventure persistence in `store.js`, in the JSON backup, `SCHEMA_VERSION` 4.
      - [x] `solo` toggle, nav swap, and the unsourced-mechanic notice (S1) on screen.
      - [x] Roll-log integration through `Store.addRoll()`.
      - [x] Regression checks: chart monotonicity, derived thresholds, event trigger,
            chaos clamping, list weighting, and every table exactly 100 entries.
- [x] **Hardening.** Committed regression harness (456 checks); accessibility pass;
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
   explicitly labelled a house aid — currently only End Scene (R9).
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

**Verified against scans supplied after the first build:** the Physical Traits Table (nine bands, both columns), the Wound Rank Accumulation grid, the Characteristics and Skills cost tables, the Potential Abilities list, the Ch.6 experience modifiers and expenditures, and the Skill Rank cap note in both chapters. The Multiplication Table error survives into the official character-sheet PDF.

**Verified against the printed images supplied after the first solo build:** all 81 Fate Chart
cells with both exceptional bands, the Random Event Focus Table, and the Scene Adjustment
Table. The fixture at `tests/fixtures/fate-chart.json` is the transcription; the harness
compares the app's derived values against it.

**Still not verifiable here, by construction:** the Fate Check's odds and chaos modifiers
(S1). No supplied source carries them, so they remain the app's own arithmetic. The Solo
screen says so when an adventure is set to the Fate Check, and the Fate Chart — which is
verified — is the default.

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
