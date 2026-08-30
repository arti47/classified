# Classified Player

An installable player companion for **Classified**, the retro-clone role-playing game of
covert operations published by Expeditious Retreat Press under the Open Game License 1.0a.

Character creation wizard, full in-play dossier, a native dice engine that knows the
system's procedures, mission lifecycle tracking, a searchable rules library, the NPC and
encounter generators, and a GM screen. Phone, tablet and desktop, online or off.

## Running it

There is no build step. Clone and open:

```sh
git clone <this repo>
cd classified
python3 -m http.server 8080     # or: npx serve, or any static file server
```

Then open `http://localhost:8080`. A file server is required — ES modules will not load
from `file://`.

On a phone, use your browser's **Add to Home Screen** to install it as an app. It works
fully offline after the first load.

## What it does

- **Creation wizard** — point-buy across rank, physical traits, characteristics, skills,
  profession years, Fields of Experience, Weaknesses and Abilities, with the Creation Point
  budget always on screen and every legality rule enforced (skill rank caps, the Base
  Chance ceiling, profession year limits, the two starting skills). The five published
  sample characters instantiate in one tap.
- **Dice engine** — the Base Chance × Difficulty Factor procedure with the full Difficulty
  Factor ladder, live Success Quality bands, and Hero Point spends offered after every
  roll. It also runs the game's opposed procedures end to end: Reaction, Persuasion, the
  five stages of Seduction with Willpower resistance, Interrogation and Torture against the
  victim's Willpower, Reputation checks with disguise modifiers, Gambling's two-roll hands,
  and chase manoeuvres with bidding, Control checks and accident damage.
- **Combat** — attacks resolve damage from the Wound Rank Table, apply the accumulation
  table, roll Stun duration, prompt Pain Resistance and roll for scars. Declaration and
  action order run in opposite directions as the book requires; Draw Situations are
  supported.
- **Mission lifecycle** — End Scene, End Session and End Mission each fire their whole
  bundle at once, show exactly what changed, and can be undone in one step. End Mission
  computes experience from rank, outcome and role-playing.
- **Advancement** — spend experience on skills, characteristics, new skills and data
  scrubbing, with the one-advance-per-mission gate enforced.
- **Rules library** — every table in the game, searchable, with the core procedures written
  out. Automated surfaces link back to their entry.
- **GM screen** (toggle in Settings) — party panel, the Hot and Cold random encounter
  tables with their sub-tables and Hero Point variants, the NPC generator built on the
  book's 1d10 stereotype tables, the OSIRIS roster, animals, and the reference tables.
- **Solo play (toggle in Settings)** — a Solo tab running the Mythic Game Master Emulator
  as a second system layered on top: Fate questions on either the Fate Chart or the Fate
  Check, the Chaos Factor, scene tests with altered and interrupt scenes, Random Events with
  the Event Focus table, weighted Threads and Characters lists, an adventure journal, a
  guided End Scene with one-step undo, a rolled mission briefing that seeds your first
  threads and opponent, mysteries whose clues set the odds of a reveal Fate decides the moment
  of, an End Mission that pays Classified's experience, and 37 Meaning Tables of 100 words each. Nine come
  from the supplied Mythic Magazine Vol. 38 report; twenty-eight were written for this app's
  1960s-espionage context by that report's five-step method, one per subsystem the game
  actually has — combat, wounds, chases, reactions, interrogation, social play, the world
  around them, and the shape of the story. Fate never replaces a Classified roll — it settles
  what is true, and you still roll skills the ordinary way.
- **How to play** — a guide at Home → How to play that answers the only question a new
  player has: what do I do next in my own game. Three acts — start a game, keep it going, end
  it well — that tick themselves off as you play, with the next step pulled to the top and the
  scene loop written out. It knows whether you are playing solo or with a group, because the
  two end differently.
- **How to use it** — every screen and every Solo panel carries a collapsed "How to use"
  accordion, and a Tutorial screen walks one solo mission from creating the operative to the
  after-action report. Both switch off in Settings once you know your way around.
- **Backup** — JSON export and import in Settings.
- **Update prompt** — the app checks for a new deploy when it comes back to the foreground
  (and on a slow timer while open), and offers a Reload toast rather than reloading under you.

## Data files

| File | Contents |
|---|---|
| `data.js` | Core rules: resolution, characteristics, skills, creation, combat, chases, interactions, healing, experience, and the full equipment and vehicle catalogues |
| `data-monsters.js` | The book's five animals |
| `data-npcs.js` | NPC stereotypes and generation tables, the OSIRIS antagonists, and the random encounter system |
| `data-pregens.js` | The five published pre-generated characters |
| `data-help.js` | The how-to copy for every screen and Solo panel, and the solo tutorial |
| `data-solo.js` | The Mythic layer: Fate, Chaos Factor, scenes, Random Events, Adventure Lists and all 37 Meaning Tables. No Classified rules live in this file |

No rules value is hardcoded anywhere in `src/`. If a number is wrong, it is wrong in a data
file and nowhere else.

## Multiplayer (optional)

The app is local-first and needs no configuration. To enable a shared party:

1. Create a project at the [Firebase console](https://console.firebase.google.com).
2. Enable **Realtime Database** and **Anonymous** authentication.
3. Deploy `database.rules.json` as your database security rules.
4. Paste your web config into `firebase-config.js` and set `FIREBASE_ENABLED = true`.
5. Turn on the **Multiplayer party** toggle in Settings.
6. **Create a campaign** or **Join with a code** in the Multiplayer panel, and share the
   three-word join code with the table.

Characters, rolls and the combat tracker mirror to the campaign as you play; the combat
mirror ignores a device's own echo, so two clients cannot push each other in a circle. The
roll log grows a second section carrying the rest of the table's rolls. Player and GM roles
are in the schema and the security rules from the start. **Never commit real keys.**

The campaign controls work with no keys configured — the campaign is local to the device
until keys are in place — so you can walk the flow before setting up Firebase. Dossier
photographs are compressed in the browser to a 256px JPEG and stored with the character, so
they need no Storage bucket and travel in the JSON backup.

## Tests

```sh
npm install     # dev-only: playwright-core for the headless checks
npm test
```

The harness runs the rules engine against the rulebook in Node, then boots the real app in
headless Chromium: every route renders, the creation flow completes, a roll resolves and is
logged with enough detail to re-derive it, lifecycle boundaries store an undo snapshot, the
GM generators produce output, there is no horizontal overflow at 360px or 390px, the
accessibility basics hold, and the console stays clean. The solo layer is covered too: all
900 baseline Meaning Table words are checked against a fixture extracted from the supplied
report, all 81 Fate Chart cells are checked against a fixture transcribed from the printed chart,
and a solo session is driven end to end in the browser.

If Chromium is not on the machine, the browser section reports as skipped and the Node
checks still run.

## Two corrections to the printed tables

The app derives the Success Quality Table rather than transcribing it, which quietly fixes
two typesetting errors in the printing this was built from:

- The row for Success Chance 161–170 prints Good as 35–85 and Fair as 85–99. They overlap
  at 85; Fair starts at 86.
- The Multiplication Table prints 8 × 7 as 46 (56) and 23 × 10 as 260 (230).

Both are noted in the rules library's Success Quality Table entry.

## Licensing and content

Classified is published by Expeditious Retreat Press under the **Open Game License 1.0a**.
All text in the rulebook is Open Game Content except the term "Classified", the publisher
name, logos, artwork, and author and artist names.

This application is a **personal play aid** built from the rulebook. It extracts numbers and
mechanics and paraphrases every effect description in its own words; no rules prose is
reproduced verbatim, and no setting, adventure or artwork is included.

The optional solo layer is a **different game by a different publisher**: the Mythic Game
Master Emulator and Mythic Magazine are Word Mill Games'. `data-solo.js` reproduces nine
100-word Meaning Tables from the supplied Mythic Magazine Vol. 38 material, because a
paraphrased word list is not the same table, and transcribes the printed Fate Chart, Fate Check,
Random Event Focus Table and Scene Adjustment Table from images of the originals, so no part
of the solo layer is guesswork. The other twenty-eight tables were written for this app.

If you publish or distribute this application or anything derived from it, the licensing is
your responsibility, for both layers. Openly licensed material — an SRD, or ORC/Creative
Commons content — is the safe basis for anything public.
