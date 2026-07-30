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
| **Core job** | Creation wizard + full in-play tracker + native dice engine |
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

---

## 2. Source

The rulebook was supplied as pasted text of the complete core book — every chapter from
Introduction through Resources, including all tables, the equipment catalogues, the OSIRIS
chapter and the character sheets. It is authoritative for everything it contains, which is
the whole core book. Nothing was filled in from memory of the game.

**Transcription damage found and handled** (see §3 rulings): the Multiplication Table and
Success Quality Table each carry a typesetting error; the Physical Traits and Wound Rank
Accumulation tables arrived column-scrambled and were reconstructed from context.

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

### 3.19 Pre-generated characters — **ABSENT for players**

The book publishes no player pregens; it points at downloadable ones instead. The OSIRIS
seven are NPCs, and are extracted as such — **ruling recorded at checkpoint.**

### 3.20 Solo rules — **ABSENT**

No solo oracle or procedures. No solo tab.

### 3.21 GM tables

Hot and Cold random encounter tables (10 × 10 each) with ~40 named encounters, many with
1d10 sub-tables and Hero Point alternative outcomes; chase obstacle tables for water, land
and air; the four gambling tables; grenade scatter and direction; the accident table;
equipment repair multipliers; scar location; stun duration.

### Checkpoint rulings

Recorded inline where they bite. Each is a case where the printing was unclear or damaged.

| # | Point | Ruling |
|---|---|---|
| R1 | Skill Rank cap is stated as "+2 over the highest underlying characteristic" three times and as "cannot be greater than" once (the Language note in Ch. 3) | Use **+2**. It appears three times, and the Chapter One worked example (Fire Combat rank 12 on DEX 12/PER 14) only works with it. |
| R2 | Success Quality Table row 161–170 prints Good 35–85 and Fair 85–99, overlapping at 85 | Derive the table; Fair starts at **86**. Noted in the rules library. |
| R3 | Multiplication Table prints 8 × 7 = 46 and 23 × 10 = 260 | Arithmetic errors. The app multiplies. Noted in the rules library. |
| R4 | Physical Traits Table arrived column-scrambled | Reconstructed as nine symmetric bands; the printed cost/Reputation sequence (4/40 … 20/0 … 4/40) confirms the shape. |
| R5 | Wound Rank Accumulation arrived as an unlabelled 4 × 4 grid | Reconstructed as old-wound rows × new-wound columns, which matches the book's own worked example (Light + Light = Medium). |
| R6 | Speed table stops at PER + DEX 30 with no row above | 30 is the maximum possible (15 + 15). No extrapolation needed. |
| R7 | Seduction modifiers list "Unattractive −2" but the appearance list has no such entry | Map to **Plain**. Good Looking gets 0, the only unlisted appearance. |
| R8 | Hero Points have no printed cap or decay | Implement as uncapped and persistent. `maxHeroPoints()` returns null deliberately. |
| R9 | The book defines missions and sessions but no scene | End Scene is shipped as an **explicitly labelled house aid**. |
| R10 | Draw Situation ties | Not covered by the book. The app reports a dead heat and defers to the GM rather than inventing a rule. |
| R11 | Horse STR 18 and shark STR 16 exceed the 1–15 characteristic range | Reproduced as printed; animals are not bound by the PC range. |

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
| `firebase-config.js` | Placeholder config + `FIREBASE_ENABLED` flag |
| `database.rules.json` | RTDB security rules with player/GM roles |
| `manifest.json`, `service-worker.js`, `icon.svg` | PWA |
| `tests/` + `package.json` | Dev-only headless harness (`npm test`); `node_modules` gitignored; not in the SW app shell |
| `README.md` | Setup, Firebase steps, the two printed-table corrections, licensing |
| `CLAUDE.md` | This file |

No `data-<expansion>.js` (no expansions supplied), no `data-pregens.js` (§3.19), no
`data-solo.js` (§3.20).

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
| `screens.js` | Home, rules library, roll log, advancement, settings |
| `router.js` | Bottom-nav routing and conditional tab gating |
| `main.js` | Entry point and boot |

No `power-automation.js` (§3.14), no `solo.js` (§3.20).

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

characters/{characterId}
  id, schema, createdAt, updatedAt, owner, campaignId
  identity:   { name, gender, rank, bandIndex, appearance, height, weight, age,
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

Every schema addition ships with a back-fill in `normalize()` and is documented here in the
same change. `SCHEMA_VERSION` is 3.

---

## 7. Settings & toggles

One pattern: a flag in `settings.js` (off by default), a toggle row in Settings with a
one-line description, every related UI checks the flag, and gated nav tabs are hidden by the
router.

`gmScreen` · `multiplayer` · `manualDice` · `showUntrained` · `autoConditions` ·
`heroPointPrompt` · `seatbelts` · `airbags`. Plus `theme` and `campaignStyle`, which are
choices rather than toggles.

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

**Every box is ticked.** The core book is fully represented.

---

## 9. Build roadmap

- [x] **Phase 0 — Foundations.** All files scaffolded; the complete core data library
      extracted and verified per the ledger; theme; PWA shell; router and local storage.
- [x] **Phase 1 — Creation Wizard.** Eight steps, honest point-buy, all derived values,
      legality validated at every step. No group wizard (§3.8), no pregens (§3.19).
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
- [x] **Hardening.** Committed regression harness (282 checks); accessibility pass;
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
