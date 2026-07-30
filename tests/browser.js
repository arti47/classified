/* tests/browser.js — headless boot, wiring, layout and flow checks.
 * Firebase and any other cross-origin request is aborted so tests never touch the network. */

const VIEWPORTS = [
  { name: "360px phone", width: 360, height: 780 },
  { name: "390px phone", width: 390, height: 844 }
];

const TABS = ["home", "sheet", "combat", "rules", "settings", "create", "gear", "advance", "log", "gm", "solo"];

export async function browserTests(t, { chromium, executablePath, baseURL }) {
  const browser = await chromium.launch({ executablePath, args: ["--no-sandbox", "--disable-dev-shm-usage"] });

  try {
    for (const vp of VIEWPORTS) {
      t.group(`Browser — ${vp.name}`);

      const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
      const page = await context.newPage();

      const errors = [];
      page.on("pageerror", e => errors.push(String(e)));
      page.on("console", m => { if (m.type() === "error") errors.push("console: " + m.text()); });

      // Never let the harness reach the network.
      await page.route("**/*", route => {
        const url = route.request().url();
        if (url.startsWith(baseURL)) route.continue();
        else route.abort();
      });

      await page.goto(baseURL + "/index.html", { waitUntil: "load" });
      await page.waitForSelector(".nav-btn", { timeout: 10000 });

      t.pass(`app boots (${vp.name})`);

      // Turn on the GM screen so its tab is reachable.
      await page.evaluate(() => {
        localStorage.setItem("classified.settings", JSON.stringify({ theme: "system", campaignStyle: "adventurous", gmScreen: true, showUntrained: true, autoConditions: true, heroPointPrompt: true, solo: true }));
      });
      await page.reload({ waitUntil: "load" });
      await page.waitForSelector(".nav-btn");

      // Every route renders something.
      for (const tab of TABS) {
        await page.evaluate(r => { location.hash = "#/" + r; }, tab);
        await page.waitForTimeout(140);
        const filled = await page.evaluate(() => document.getElementById("screen").children.length > 0);
        if (!filled) { t.fail(`route ${tab} rendered content`); }
      }
      t.pass("every route renders content");

      // No horizontal overflow anywhere.
      for (const tab of TABS) {
        await page.evaluate(r => { location.hash = "#/" + r; }, tab);
        await page.waitForTimeout(120);
        const overflow = await page.evaluate(() =>
          document.documentElement.scrollWidth - document.documentElement.clientWidth);
        if (overflow > 1) { t.fail(`no horizontal overflow on ${tab} (overflowed by ${overflow}px)`); }
      }
      t.pass(`no horizontal overflow on any screen at ${vp.width}px`);

      // Full creation flow.
      await page.evaluate(() => { location.hash = "#/create"; });
      await page.waitForTimeout(150);
      await page.evaluate(() => {
        const btns = [...document.querySelectorAll(".opt-btn")];
        btns[0].click();                                  // Rookie
      });
      await page.waitForTimeout(150);
      await page.fill('input[type="text"]', "Test Operative");
      await page.evaluate(() => {
        const steps = [...document.querySelectorAll(".wstep")];
        steps[steps.length - 1].click();                  // jump to Review
      });
      await page.waitForTimeout(150);
      await page.evaluate(() => {
        const create = [...document.querySelectorAll("button")].find(b => b.textContent.includes("Create dossier"));
        if (create) create.click();
      });
      await page.waitForTimeout(300);

      const created = await page.evaluate(() => {
        const list = JSON.parse(localStorage.getItem("classified.characters") || "[]");
        return list.length > 0 && list[0].identity.name === "Test Operative";
      });
      t.ok(created, "the creation wizard produces a saved dossier");

      // The persistent resource header appears once a character exists.
      const headerVisible = await page.evaluate(() => {
        const h = document.getElementById("resourceHeader");
        return !h.hidden && h.children.length >= 4;
      });
      t.ok(headerVisible, "the persistent resource header shows on every in-play screen");

      // Sheet renders skills with base chances.
      await page.evaluate(() => { location.hash = "#/sheet"; });
      await page.waitForTimeout(200);
      const skillRows = await page.evaluate(() => document.querySelectorAll(".skill-row").length);
      t.ok(skillRows > 20, `the sheet lists the whole skill list (${skillRows} rows)`);

      // A roll opens the dialog and writes to the log.
      await page.evaluate(() => {
        const row = [...document.querySelectorAll(".skill-row")].find(r => r.textContent.includes("Charisma"));
        if (row) row.click();
      });
      await page.waitForSelector(".modal", { timeout: 4000 });
      t.pass("clicking a skill opens the roll dialog");

      const hasLadder = await page.evaluate(() => document.querySelectorAll(".df-step").length === 11);
      t.ok(hasLadder, "the roll dialog shows the full Difficulty Factor ladder");

      await page.evaluate(() => {
        const roll = [...document.querySelectorAll(".modal-foot .btn")].find(b => b.textContent.trim() === "Roll");
        if (roll) roll.click();
      });
      await page.waitForTimeout(300);
      const showsResult = await page.evaluate(() => !!document.querySelector(".roll-d100"));
      t.ok(showsResult, "the roll resolves and shows a d100 result with quality bands");

      await page.evaluate(() => {
        const done = [...document.querySelectorAll(".modal-foot .btn")].find(b => b.textContent.trim() === "Done");
        if (done) done.click();
      });
      await page.waitForTimeout(200);

      const logged = await page.evaluate(() => JSON.parse(localStorage.getItem("classified.rollLog") || "[]").length);
      t.ok(logged > 0, "the roll is written to the roll log");

      const logDetail = await page.evaluate(() => {
        const r = JSON.parse(localStorage.getItem("classified.rollLog") || "[]")[0];
        return r && r.baseChance !== undefined && r.df !== undefined && r.successChance !== undefined && r.roll !== undefined;
      });
      t.ok(logDetail, "the roll log records enough detail to re-derive the roll");

      // Combat lifecycle bundle and undo.
      await page.evaluate(() => { location.hash = "#/combat"; });
      await page.waitForTimeout(200);
      await page.evaluate(() => {
        const b = [...document.querySelectorAll("button")].find(x => x.textContent.trim() === "End Scene");
        if (b) b.click();
      });
      await page.waitForTimeout(200);
      await page.evaluate(() => {
        const b = [...document.querySelectorAll(".modal-foot .btn")].find(x => x.textContent.includes("End Scene"));
        if (b) b.click();
      });
      await page.waitForTimeout(300);
      await page.evaluate(() => {
        const b = [...document.querySelectorAll(".modal-foot .btn")].find(x => x.textContent.trim() === "OK");
        if (b) b.click();
      });
      await page.waitForTimeout(200);
      const undoAvailable = await page.evaluate(() => !!localStorage.getItem("classified.lifecycleUndo"));
      t.ok(undoAvailable, "a lifecycle boundary stores a one-step undo snapshot");

      // GM screen generators.
      await page.evaluate(() => { location.hash = "#/gm"; });
      await page.waitForTimeout(200);
      await page.evaluate(() => {
        const b = [...document.querySelectorAll("button")].find(x => x.textContent.includes("Hot encounter"));
        if (b) b.click();
      });
      await page.waitForSelector(".modal", { timeout: 4000 });
      const encounterFilled = await page.evaluate(() => {
        const body = document.querySelector(".modal-body");
        return body && body.textContent.trim().length > 40;
      });
      t.ok(encounterFilled, "the GM encounter generator produces a non-empty result");
      await page.keyboard.press("Escape");
      await page.waitForTimeout(150);

      // Accessibility basics.
      await page.evaluate(() => { location.hash = "#/home"; });
      await page.waitForTimeout(200);
      const a11y = await page.evaluate(() => {
        const current = document.querySelectorAll('.nav-btn[aria-current="page"]').length;
        const live = !!document.querySelector('[aria-live]');
        const iconBtns = [...document.querySelectorAll(".icon-btn")];
        const labelled = iconBtns.every(b => b.getAttribute("aria-label") || b.textContent.trim());
        const skip = !!document.querySelector(".skip-link");
        return { current, live, labelled, skip };
      });
      t.eq(a11y.current, 1, "exactly one navigation tab is marked as the current page");
      t.ok(a11y.live, "an aria-live region exists for announcing roll results");
      t.ok(a11y.labelled, "every icon-only button carries an accessible label");
      t.ok(a11y.skip, "a skip-to-content link is present");

      // Modals trap focus and close on Escape.
      await page.evaluate(() => { location.hash = "#/rules"; });
      await page.waitForTimeout(200);
      await page.evaluate(() => {
        const b = [...document.querySelectorAll(".skill-row")].find(x => x.textContent.includes("Core Resolution"));
        if (b) b.click();
      });
      await page.waitForSelector(".modal");
      const modalA11y = await page.evaluate(() => {
        const m = document.querySelector(".modal");
        return m.getAttribute("role") === "dialog" && m.getAttribute("aria-modal") === "true" && !!m.getAttribute("aria-labelledby");
      });
      t.ok(modalA11y, "modals are marked up as accessible dialogs");
      await page.keyboard.press("Escape");
      await page.waitForTimeout(150);
      const closed = await page.evaluate(() => !document.querySelector(".modal"));
      t.ok(closed, "Escape closes a modal");

      /* ---------------- the Mythic solo layer ---------------- */

      // Solo takes the Rules slot in the bottom bar rather than adding a seventh tab.
      const navState = await page.evaluate(() => {
        const routes = [...document.querySelectorAll(".nav-btn")].map(b => b.dataset.route);
        return { routes, count: routes.length };
      });
      t.ok(navState.routes.includes("solo") && !navState.routes.includes("rules"),
        "the Solo tab takes the Rules slot when solo play is on");
      t.eq(navState.count, 6, "the bottom bar still carries six tabs with solo play on");

      await page.evaluate(() => { location.hash = "#/solo"; });
      await page.waitForTimeout(160);
      const soloEmpty = await page.evaluate(() => document.getElementById("screen").textContent.includes("No adventure open"));
      t.ok(soloEmpty, "the Solo screen offers to start an adventure when none is open");

      // Start an adventure, then ask Fate a question through the real engine.
      const fate = await page.evaluate(async () => {
        const Store = await import("./src/store.js");
        const Solo = await import("./src/solo.js");
        const adv = Store.createAdventure({ name: "Operation Nightjar" });
        await Solo.askFate(Store.activeAdventure(), "fifty", "Is the safe already open?");
        const after = Store.activeAdventure();
        const log = Store.rollLog();
        return {
          chaos: adv.chaos,
          scene: adv.scene,
          journal: after.journal.length,
          kind: after.journal[0] && after.journal[0].kind,
          logSolo: !!(log[0] && log[0].solo),
          outcome: log[0] && log[0].outcome,
          modalText: (document.querySelector(".modal") || {}).textContent || ""
        };
      });
      t.eq(fate.chaos, 5, "a new adventure opens at Chaos Factor 5");
      t.ok(fate.journal >= 1 && fate.kind === "fate", "asking Fate writes a journal entry");
      t.ok(fate.logSolo, "a Fate answer is written to the shared roll log as a solo row");
      t.ok(["Yes", "No", "Exceptional Yes", "Exceptional No"].includes(fate.outcome),
        "the logged outcome is one of the four Mythic answers");
      t.ok(/Yes|No/.test(fate.modalText), "the Fate result is shown in a modal");

      await page.keyboard.press("Escape");
      await page.waitForTimeout(120);

      // The sequence of play: the primary action is the next boundary, and nothing else.
      const loop = await page.evaluate(async () => {
        const Store = await import("./src/store.js");
        const out = {};
        const primary = () => [...document.querySelectorAll("#screen .solo-primary")].map(b => b.textContent);
        location.hash = "#/solo";
        await new Promise(r => setTimeout(r, 220));

        // A new adventure opens on the briefing, before scene 1 exists.
        out.briefingPrimary = primary();
        out.phaseAtBirth = Store.activeAdventure().scenePhase;

        Store.updateAdventure(a => { a.scenePhase = "setup"; });
        document.dispatchEvent(new CustomEvent("app:rerender"));
        await new Promise(r => setTimeout(r, 220));
        out.setupPrimary = primary();
        out.quietBefore = !!document.querySelector(".solo-inplay.is-quiet");
        out.phaseBefore = Store.activeAdventure().scenePhase;

        // Start the scene through the store, the same state the dialog commits.
        Store.updateAdventure(a => { a.scenePhase = "play"; a.sceneKind = "expected"; a.sceneExpected = "The safe house"; });
        document.dispatchEvent(new CustomEvent("app:rerender"));
        await new Promise(r => setTimeout(r, 220));
        out.playPrimary = primary();
        out.quietDuring = !!document.querySelector(".solo-inplay.is-quiet");
        out.showsScene = document.getElementById("screen").textContent.includes("The safe house");
        return out;
      });
      t.eq(loop.phaseAtBirth, "briefing", "a new adventure opens on the briefing, not on scene 1");
      t.deep(loop.briefingPrimary, ["Write the mission briefing"],
        "and its only primary action is the briefing");
      t.deep(loop.setupPrimary, ["Start scene 1"], "with no scene open the only primary action is Start scene");
      t.ok(loop.quietBefore, "the in-scene tools are quietened before the scene starts");
      t.deep(loop.playPrimary, ["End scene 1"], "with a scene in play the only primary action is End scene");
      t.ok(!loop.quietDuring, "and the tools come forward once it is running");
      t.ok(loop.showsScene, "the scene you said you expected is shown while it runs");

      // Start scene: one chain that captures the expectation, tests it, forces whatever the
      // test owes, and only then puts the adventure in play. The phase must not flip early,
      // and no dialog in the chain may be dismissable.
      const started = await page.evaluate(async () => {
        const Store = await import("./src/store.js");
        const Solo = await import("./src/solo.js");
        Store.updateAdventure(a => { a.scenePhase = "setup"; a.sceneKind = null; a.sceneExpected = ""; });
        const p = Solo.startScene(Store.activeAdventure());
        await new Promise(r => setTimeout(r, 60));
        document.querySelector(".modal input").value = "Meet the courier";
        [...document.querySelectorAll(".modal-foot .btn")].find(b => b.textContent === "Test the scene").click();
        await p;

        const out = {
          kind: Store.activeAdventure().sceneKind,
          phaseAfterTest: Store.activeAdventure().scenePhase,
          steps: [], everyStepLocked: true, everyStepOnePrimary: true
        };

        // Walk the chain: each dialog offers exactly one primary, and that is the only exit.
        for (let i = 0; i < 6 && Store.activeAdventure().scenePhase !== "play"; i++) {
          const m = document.querySelector(".modal");
          if (!m) break;
          if (m.querySelector(".modal-head .icon-btn")) out.everyStepLocked = false;
          const primaries = [...m.querySelectorAll(".modal-foot .btn.primary")];
          if (primaries.length !== 1) out.everyStepOnePrimary = false;
          out.steps.push(primaries[0] ? primaries[0].textContent : "(none)");
          primaries[0].click();
          await new Promise(r => setTimeout(r, 120));
        }

        const adv = Store.activeAdventure();
        return { ...out, phase: adv.scenePhase, expected: adv.sceneExpected,
          journalText: adv.journal.map(j => j.text).join(" | ") };
      });
      t.eq(started.phaseAfterTest, "setup",
        "the scene test alone does not put the adventure in play — the chain has to finish first");
      t.ok(started.everyStepLocked, "no step of the Start scene chain can be dismissed");
      t.ok(started.everyStepOnePrimary, "each step of the chain offers exactly one primary action");
      t.eq(started.phase, "play", "finishing the chain puts the adventure in play");
      t.ok(/^Play scene \d+$/.test(started.steps[started.steps.length - 1]),
        `the chain ends on the action that commits the scene (${started.steps.join(" → ")})`);
      t.ok(["expected", "altered", "interrupt"].includes(started.kind), "and records how the test resolved");
      t.ok(started.journalText.includes("Meet the courier"), "the journal records the scene and its outcome");
      if (started.kind === "interrupt") {
        t.ok(started.expected !== "Meet the courier",
          "an interrupt relabels the scene card with the event that displaced the plan");
      } else {
        t.eq(started.expected, "Meet the courier", "a scene you got to play keeps what you expected");
      }

      // End scene: control question, Chaos step, list upkeep and the phase reset, in one commit.
      const ended = await page.evaluate(async () => {
        const Store = await import("./src/store.js");
        const Solo = await import("./src/solo.js");
        Store.updateAdventure(a => {
          a.chaos = 5; a.scene = 1; a.scenePhase = "play";
          a.threads = [{ id: "t_old", text: "Old thread", weight: 1 }];
          a.characters = [];
        });
        const p = Solo.endScene(Store.activeAdventure());
        await new Promise(r => setTimeout(r, 60));
        const modal = document.querySelector(".modal");
        [...modal.querySelectorAll(".chip")].find(c => c.textContent.includes("No —")).click();
        modal.querySelector("input[placeholder='What happened?']").value = "The meet went badly";
        // Strike the old thread off and add one of each.
        [...modal.querySelectorAll("button")].find(b => b.textContent === "Strike off").click();
        const inputs = [...modal.querySelectorAll("input[type='text']")];
        const threadInput = inputs.find(i => /goal that opened/.test(i.placeholder));
        const charInput = inputs.find(i => /now matters/.test(i.placeholder));
        threadInput.value = "Warn the station chief";
        [...modal.querySelectorAll("button")].filter(b => b.textContent === "Add")[0].click();
        charInput.value = "The courier";
        [...modal.querySelectorAll("button")].filter(b => b.textContent === "Add")[1].click();
        [...modal.querySelectorAll(".modal-foot .btn")].find(b => b.textContent === "End scene").click();
        await p;
        const adv = Store.activeAdventure();
        return {
          chaos: adv.chaos, scene: adv.scene, phase: adv.scenePhase, kind: adv.sceneKind,
          expected: adv.sceneExpected,
          threads: adv.threads.map(x => x.text), characters: adv.characters.map(x => x.text),
          undo: !!Store.peekSoloUndo(),
          summary: (document.querySelector(".modal") || {}).textContent || ""
        };
      });
      t.eq(ended.chaos, 6, "a scene the character did not control raises the Chaos Factor");
      t.eq(ended.scene, 2, "and advances the scene counter");
      t.eq(ended.phase, "setup", "and closes the scene, so the next primary action is Start scene");
      t.eq(ended.kind, null, "the scene outcome is cleared with the scene");
      t.eq(ended.expected, "", "as is the expectation");
      t.deep(ended.threads, ["Warn the station chief"], "the struck thread is gone and the new one is added");
      t.deep(ended.characters, ["The courier"], "the new character is added");
      t.ok(ended.undo, "the whole boundary sits under one undo snapshot");
      t.ok(/Chaos Factor 5 → 6/.test(ended.summary), "the summary reports what changed");
      await page.evaluate(() => document.querySelectorAll(".modal-head .icon-btn").forEach(b => b.click()));

      // A Random Event that names a list offers to update it.
      const eventActions = await page.evaluate(async () => {
        const Store = await import("./src/store.js");
        const Solo = await import("./src/solo.js");
        const labels = async focusRoll => {
          await Solo.rollRandomEvent(Store.activeAdventure(), { focusRoll });
          const out = [...document.querySelectorAll(".modal-foot .btn")].map(b => b.textContent);
          document.querySelectorAll(".modal-head .icon-btn").forEach(b => b.click());
          await new Promise(r => setTimeout(r, 40));
          return out;
        };
        Store.updateAdventure(a => { a.threads = [{ id: "t1", text: "Find the courier", weight: 1 }]; });
        return {
          newNpc: await labels(15),
          closeThread: await labels(68),
          context: await labels(95)
        };
      });
      t.ok(eventActions.newNpc.includes("Add to Characters"), "a New NPC event offers to add them to the Characters list");
      t.ok(eventActions.closeThread.includes("Strike that thread off"), "Close A Thread offers to strike off the thread it drew");
      t.ok(!eventActions.context.includes("Add to Characters"), "an event that names no list carries no list action");
      t.ok(!eventActions.newNpc.includes("Keep the planned scene"),
        "an ordinary event carries no interrupt action");

      // An interrupt files the displaced scene as a thread by itself, and ends on the commit.
      const interrupt = await page.evaluate(async () => {
        const Store = await import("./src/store.js");
        const Solo = await import("./src/solo.js");
        Store.updateAdventure(a => { a.threads = []; a.scenePhase = "setup"; a.sceneExpected = ""; });
        await Solo.rollRandomEvent(Store.activeAdventure(), {
          focusRoll: 95, chain: true, interruptedBy: "Meet the courier at the docks"
        });
        const m = document.querySelector(".modal");
        const out = {
          locked: !m.querySelector(".modal-head .icon-btn"),
          primaries: [...m.querySelectorAll(".modal-foot .btn.primary")].map(b => b.textContent),
          threads: Store.activeAdventure().threads.map(x => x.text),
          phaseBefore: Store.activeAdventure().scenePhase
        };
        m.querySelector(".modal-foot .btn.primary").click();
        await new Promise(r => setTimeout(r, 60));
        const adv = Store.activeAdventure();
        out.phaseAfter = adv.scenePhase;
        out.sceneLabel = adv.sceneExpected;
        return out;
      });
      t.deep(interrupt.threads, ["Meet the courier at the docks"],
        "an interrupt files the scene it displaced as a thread with no button to forget");
      t.ok(interrupt.locked, "the interrupt dialog cannot be dismissed past the commit");
      t.eq(interrupt.primaries.length, 1, "and offers exactly one primary action");
      t.eq(interrupt.phaseBefore, "setup", "the scene is not in play until that action is taken");
      t.eq(interrupt.phaseAfter, "play", "taking it puts the scene in play");
      t.ok(interrupt.sceneLabel && interrupt.sceneLabel !== "Meet the courier at the docks",
        "and the scene card now names the event rather than the displaced plan");

      // The altered-scene branch of the chain, driven directly so it is covered whatever the
      // scene test happened to roll above.
      const altered = await page.evaluate(async () => {
        const Store = await import("./src/store.js");
        const Solo = await import("./src/solo.js");
        Store.updateAdventure(a => { a.scenePhase = "setup"; });
        await Solo.rollSceneAdjustment(Store.activeAdventure(), { chain: true });
        const m = document.querySelector(".modal");
        const out = {
          locked: !m.querySelector(".modal-head .icon-btn"),
          primaries: [...m.querySelectorAll(".modal-foot .btn.primary")].map(b => b.textContent),
          phaseBefore: Store.activeAdventure().scenePhase
        };
        m.querySelector(".modal-foot .btn.primary").click();
        await new Promise(r => setTimeout(r, 60));
        out.phaseAfter = Store.activeAdventure().scenePhase;
        return out;
      });
      t.ok(altered.locked, "the Scene Adjustment dialog cannot be dismissed past the commit");
      t.ok(/^Play scene \d+$/.test(altered.primaries[0] || ""),
        "and its single primary action is the one that commits the scene");
      t.eq(altered.phaseBefore, "setup", "an altered scene is not in play until the adjustment is read");
      t.eq(altered.phaseAfter, "play", "and is once it has been");

      // Settings sit one level below the adventure switcher, not beside it.
      const advMenu = await page.evaluate(async () => {
        [...document.querySelectorAll("button")].find(b => b.textContent.trim() === "Adventures").click();
        await new Promise(r => setTimeout(r, 80));
        const top = [...document.querySelectorAll(".modal .opt-btn")].map(b => b.textContent);
        const settings = [...document.querySelectorAll(".modal .opt-btn")]
          .find(b => b.textContent.includes("Adventure settings"));
        settings.click();
        await new Promise(r => setTimeout(r, 80));
        const inner = [...document.querySelectorAll(".modal .opt-btn")].map(b => b.textContent);
        document.querySelectorAll(".modal-head .icon-btn").forEach(b => b.click());
        return { top, inner };
      });
      t.ok(advMenu.top.some(x => x.includes("Start a new adventure")),
        "the Adventures menu keeps the play actions at the top level");
      t.ok(!advMenu.top.some(x => x.includes("Delete this adventure")),
        "and no longer mixes destructive settings in beside them");
      t.ok(advMenu.inner.some(x => x.includes("Fate mechanic")) &&
        advMenu.inner.some(x => x.includes("Delete this adventure")),
        "Adventure settings gathers the configuration one level down");

      // The mission briefing: roll every row, edit one, commit, and check it seeded the lists.
      const briefed = await page.evaluate(async () => {
        const Store = await import("./src/store.js");
        const Solo = await import("./src/solo.js");
        const S = await import("./data-solo.js");
        Store.updateAdventure(a => {
          a.scenePhase = "briefing"; a.briefing = null; a.scene = 1;
          a.threads = []; a.characters = []; a.name = "Untitled adventure";
        });

        const p = Solo.openBriefing(Store.activeAdventure());
        await new Promise(r => setTimeout(r, 120));

        const modalEl = document.querySelector(".modal");
        const rollBtns = [...modalEl.querySelectorAll(".btn.sm")];
        for (const b of rollBtns) { b.click(); await new Promise(r => setTimeout(r, 60)); }

        const fields = [...modalEl.querySelectorAll('input[type="text"]')];
        const filledBefore = fields.filter(f => f.value.trim()).length;

        // Write over the objective the way a player would.
        const objIdx = S.BRIEFING_ROWS.findIndex(r => r.key === "objective");
        fields[objIdx].value = "Recover the case before the handover";
        fields[objIdx].dispatchEvent(new Event("input", { bubbles: true }));

        const seedNote = modalEl.textContent.includes("Recover the case before the handover → threads");

        [...modalEl.querySelectorAll(".modal-foot .btn")].find(b => /Commit|Save/.test(b.textContent)).click();
        await p;
        await new Promise(r => setTimeout(r, 150));
        [...document.querySelectorAll(".modal-foot .btn")].forEach(b => { if (b.textContent === "OK") b.click(); });
        await new Promise(r => setTimeout(r, 200));

        const adv = Store.activeAdventure();
        const screen = document.getElementById("screen");
        return {
          filledBefore, seedNote,
          rows: Object.keys(adv.briefing.rows).length,
          objective: adv.briefing.rows.objective.text,
          words: adv.briefing.rows.objective.words.length,
          hasNpc: !!(adv.briefing.npc && adv.briefing.npc.attrs),
          threads: adv.threads.map(x => x.text),
          characters: adv.characters.length,
          phase: adv.scenePhase,
          named: adv.name !== "Untitled adventure",
          pinnedClosed: !!screen.querySelector("details.acc:not([open]) summary"),
          pinnedText: screen.textContent.includes("Mission briefing")
        };
      });
      t.eq(briefed.filledBefore, 7, "every briefing row rolls itself into an editable field");
      t.ok(briefed.seedNote, "the dialog says which lists the finished lines will seed");
      t.eq(briefed.objective, "Recover the case before the handover", "what you write over the words is what is kept");
      t.ok(briefed.words >= 2, "and the words that prompted it are kept underneath");
      t.ok(briefed.hasNpc, "the opponent is a real generated NPC with characteristics");
      t.ok(briefed.threads.includes("Recover the case before the handover"),
        "the objective is seeded into Threads");
      t.eq(briefed.threads.length, 2, "along with the complication");
      t.eq(briefed.characters, 1, "and the opponent into Characters");
      t.eq(briefed.phase, "setup", "committing the briefing moves the adventure on to scene 1");
      t.ok(briefed.named, "an untitled adventure takes its codename as its name");
      t.ok(briefed.pinnedText, "the briefing is pinned on the Solo screen");
      t.ok(briefed.pinnedClosed, "in an accordion that starts closed");

      // The opponent used to be named by the Classified generator alone, which names an NPC
      // after its own stereotype and rank — the same three words every press.
      const opponent = await page.evaluate(async () => {
        const Store = await import("./src/store.js");
        const Solo = await import("./src/solo.js");
        const S = await import("./data-solo.js");
        const idx = S.BRIEFING_ROWS.findIndex(r => r.key === "opponent");

        const p = Solo.openBriefing(Store.activeAdventure());
        await new Promise(r => setTimeout(r, 120));
        const modalEl = document.querySelector(".modal");
        const genBtn = [...modalEl.querySelectorAll(".btn.sm")][idx];
        const label = genBtn.textContent;
        const names = [];
        for (let i = 0; i < 4; i++) {
          genBtn.click();
          await new Promise(r => setTimeout(r, 60));
          names.push([...modalEl.querySelectorAll('input[type="text"]')][idx].value);
        }
        const line = modalEl.textContent;
        [...modalEl.querySelectorAll(".modal-foot .btn")].find(b => /Commit|Save/.test(b.textContent)).click();
        await p;
        await new Promise(r => setTimeout(r, 150));
        [...document.querySelectorAll(".modal-foot .btn")].forEach(b => { if (b.textContent === "OK") b.click(); });
        await new Promise(r => setTimeout(r, 150));

        const npc = Store.activeAdventure().briefing.npc;
        return {
          label, names, distinct: new Set(names).size,
          statsShown: /Speed \d/.test(line) && /Villain Points/.test(line),
          alias: npc.alias, traits: npc.traits, name: npc.name,
          rolls: (Store.activeAdventure().briefing.rows.opponent.rolls || []).length,
          attrs: !!npc.attrs
        };
      });
      t.eq(opponent.label, "Generate", "the opponent row generates rather than rolls a word pair");
      t.ok(!opponent.names.some(n => n === "Villain Primary Opponent"),
        "the opponent is never the generator's own category label");
      t.ok(opponent.distinct >= 3, "generating again gives a different opponent");
      t.ok(opponent.statsShown, "with the stat block's Speed and Villain Points shown under the field");
      t.ok(!!opponent.alias && opponent.traits.length === 2,
        "the identity is a codename plus two words off the Adversary table");
      t.ok(opponent.name.startsWith(opponent.alias + " — "),
        "and reads as a codename followed by what they are");
      t.eq(opponent.rolls, 3, "all three identity rolls are kept with the row");
      t.ok(opponent.attrs, "the Classified stat block is still behind it");

      // Deleting the whole mission, and taking back exactly what it seeded.
      const deleted = await page.evaluate(async () => {
        const Store = await import("./src/store.js");
        Store.updateAdventure(a => {
          a.threads = (a.threads || []).concat([{ id: "li_byhand", text: "Added by hand", weight: 1 }]);
        });
        location.hash = "#/home"; await new Promise(r => setTimeout(r, 80));
        location.hash = "#/solo"; await new Promise(r => setTimeout(r, 150));

        const screen = document.getElementById("screen");
        const acc = [...screen.querySelectorAll("details.acc")]
          .find(d => d.querySelector("summary").textContent.includes("Mission briefing"));
        acc.open = true;
        const before = Store.activeAdventure();
        const btn = [...acc.querySelectorAll("button")].find(b => b.textContent === "Delete mission");
        btn.click();
        await new Promise(r => setTimeout(r, 120));

        const chooser = document.querySelector(".modal");
        const opts = [...chooser.querySelectorAll(".opt-btn")].map(b => b.textContent);
        [...chooser.querySelectorAll(".opt-btn")]
          .find(b => b.textContent.includes("Delete it and what it seeded")).click();
        await new Promise(r => setTimeout(r, 200));

        const after = Store.activeAdventure();
        return {
          options: opts.length,
          threadsBefore: before.threads.length,
          threadsAfter: after.threads.map(x => x.text),
          charactersAfter: after.characters.length,
          briefing: after.briefing,
          phase: after.scenePhase,
          journaled: after.journal.some(j => /Mission deleted/.test(j.text)),
          undo: !!Store.peekSoloUndo(),
          pinned: [...document.getElementById("screen").querySelectorAll("details.acc summary")]
            .some(s => s.textContent.includes("Mission briefing"))
        };
      });
      t.eq(deleted.options, 2, "deleting the mission asks whether the seeded entries go with it");
      t.eq(deleted.threadsBefore, 3, "the objective, the complication and one thread added by hand");
      t.deep(deleted.threadsAfter, ["Added by hand"],
        "deleting takes back only what the briefing seeded");
      t.eq(deleted.charactersAfter, 0, "including the opponent it put in Characters");
      t.eq(deleted.briefing, null, "the briefing itself is gone");
      t.eq(deleted.phase, "briefing", "and an adventure still on scene 1 can write a new one");
      t.ok(deleted.journaled, "the journal keeps the record that it happened");
      t.ok(deleted.undo, "and it is undoable once, like a scene boundary");
      t.ok(!deleted.pinned, "nothing stays pinned on the Solo screen");

      // Journal rows can be copied and deleted one at a time.
      const journalRow = await page.evaluate(async () => {
        const Store = await import("./src/store.js");
        Store.updateAdventure(a => {
          a.journal = [
            { id: "j1", ts: Date.now(), kind: "fate", text: "Is the safe open? — No", detail: "Fate Chart 71 vs 50" },
            { id: "j2", ts: Date.now(), kind: "note", text: "Second entry", detail: "" }
          ];
        });
        // Bounce through another route so the Solo screen definitely re-renders.
        location.hash = "#/home";
        await new Promise(r => setTimeout(r, 120));
        location.hash = "#/solo";
        await new Promise(r => setTimeout(r, 220));

        // Capture whichever copy path this browser actually takes: the async clipboard API
        // when it is available, the textarea and execCommand fallback when it is not.
        let copied = null;
        try {
          Object.defineProperty(navigator, "clipboard", {
            configurable: true,
            value: { writeText: async t => { copied = t; } }
          });
        } catch { /* fall back to execCommand below */ }
        document.execCommand = () => {
          const ta = document.activeElement;
          if (ta && ta.tagName === "TEXTAREA") copied = ta.value;
          return true;
        };

        const rows = [...document.querySelectorAll(".log-entry")]
          .filter(r => /Is the safe open|Second entry/.test(r.textContent));
        const first = rows.find(r => r.textContent.includes("Is the safe open"));
        first.querySelector('button[aria-label^="Copy"]').click();
        await new Promise(r => setTimeout(r, 80));
        const copiedRow = copied;   // snapshot before Copy all overwrites it

        first.querySelector('button[aria-label^="Delete"]').click();
        await new Promise(r => setTimeout(r, 120));
        [...document.querySelectorAll(".modal-foot .btn")].find(b => b.textContent === "Delete").click();
        await new Promise(r => setTimeout(r, 150));

        const after = Store.activeAdventure().journal.map(j => j.id);
        const copyAll = [...document.querySelectorAll("button")].find(b => b.textContent.trim() === "Copy all");
        copyAll.click();
        await new Promise(r => setTimeout(r, 80));

        return { copiedRow, after, copiedAll: copied, hasCopyAll: !!copyAll };
      });
      t.ok(journalRow.copiedRow && journalRow.copiedRow.includes("Is the safe open") && journalRow.copiedRow.includes("Fate Chart 71"),
        "a journal row copies itself, dice detail and all");
      t.deep(journalRow.after, ["j2"], "and deletes on its own without touching the rest");
      t.ok(journalRow.hasCopyAll, "the journal offers a Copy all");
      t.ok(journalRow.copiedAll && journalRow.copiedAll.includes("Second entry"),
        "which copies the surviving entries");

      // Re-rolling the words replaces the record instead of stacking beside it.
      const reroll = await page.evaluate(async () => {
        const Store = await import("./src/store.js");
        const Solo = await import("./src/solo.js");
        Store.clearLog();
        Store.updateAdventure(a => { a.journal = []; });
        await Solo.rollRandomEvent(Store.activeAdventure(), { focusRoll: 95 });
        const before = {
          journal: Store.activeAdventure().journal.filter(j => j.kind === "event").length,
          log: Store.rollLog().filter(r => r.label === "Random Event").length
        };
        [...document.querySelectorAll(".modal-foot .btn")].find(b => b.textContent === "Re-roll the words").click();
        await new Promise(r => setTimeout(r, 140));
        [...document.querySelectorAll(".modal-foot .btn")].find(b => b.textContent === "Re-roll the words").click();
        await new Promise(r => setTimeout(r, 140));
        const after = {
          journal: Store.activeAdventure().journal.filter(j => j.kind === "event").length,
          log: Store.rollLog().filter(r => r.label === "Random Event").length
        };
        document.querySelectorAll(".modal-head .icon-btn").forEach(b => b.click());
        return { before, after };
      });
      t.eq(reroll.before.journal, 1, "an event writes one journal row");
      t.eq(reroll.after.journal, 1, "and two re-rolls still leave one, not three");
      t.eq(reroll.after.log, 1, "the roll log keeps only the reading that was kept");

      // The solo roll log row renders without the Classified Quality columns.
      await page.evaluate(() => { location.hash = "#/log"; });
      await page.waitForTimeout(160);
      const logRendered = await page.evaluate(() => {
        const text = document.getElementById("screen").textContent;
        return { solo: text.includes("Solo (Mythic)"), undefinedText: text.includes("undefined") };
      });
      t.ok(logRendered.solo, "the roll log labels a solo row as Mythic");
      t.ok(!logRendered.undefinedText, "the solo roll-log row prints no undefined Success Quality");

      // Meaning tables roll a word pair, and the Solo screen renders with an adventure open.
      await page.evaluate(() => { location.hash = "#/solo"; });
      await page.waitForTimeout(160);
      const meaning = await page.evaluate(async () => {
        const Store = await import("./src/store.js");
        const Solo = await import("./src/solo.js");
        await Solo.rollMeaning(Store.activeAdventure(), "espAction");
        const words = (document.querySelector(".modal .roll-quality") || {}).textContent || "";
        return { words, journal: Store.activeAdventure().journal[0].kind };
      });
      t.ok(meaning.words.split(" · ").length === 2, "a Meaning Table rolls a word pair");
      t.eq(meaning.journal, "meaning", "a Meaning Table roll is journalled");
      await page.keyboard.press("Escape");
      await page.waitForTimeout(120);

      // Scene boundaries store a solo-specific undo snapshot.
      const undo = await page.evaluate(async () => {
        const Store = await import("./src/store.js");
        const before = Store.activeAdventure();
        const was = { chaos: before.chaos, scene: before.scene };
        Store.pushSoloUndo(Store.soloSnapshot());
        Store.updateAdventure(a => { a.chaos = 9; a.scene = 7; });
        const dirty = Store.activeAdventure();
        const applied = Store.applySoloUndo();
        const back = Store.activeAdventure();
        return { was, dirtyChaos: dirty.chaos, applied, chaos: back.chaos, scene: back.scene };
      });
      t.eq(undo.dirtyChaos, 9, "the Chaos Factor can be driven to the top of its range");
      t.ok(undo.applied && undo.chaos === undo.was.chaos && undo.scene === undo.was.scene,
        "the solo undo snapshot restores the Chaos Factor and scene count");

      // The solo state rides along in the backup.
      const backupSolo = await page.evaluate(async () => {
        const Store = await import("./src/store.js");
        const parsed = JSON.parse(Store.exportJSON());
        return Array.isArray(parsed.soloAdventures) && parsed.soloAdventures.length > 0;
      });
      t.ok(backupSolo, "solo adventures are included in the JSON backup");

      await page.evaluate(() => { location.hash = "#/solo"; });
      await page.waitForTimeout(160);
      const soloOverflow = await page.evaluate(() =>
        document.documentElement.scrollWidth - document.documentElement.clientWidth);
      t.ok(soloOverflow <= 1, `the Solo screen with an adventure open does not overflow horizontally (${soloOverflow}px)`);

      // No provenance or source-attribution labels anywhere in the UI: the data layer keeps
      // that record, the screens do not show it.
      const labels = await page.evaluate(async () => {
        const found = [];
        const scan = () => {
          const text = document.getElementById("screen").textContent +
            [...document.querySelectorAll(".modal")].map(m => m.textContent).join(" ");
          for (const needle of ["Vol. 38", "authored", "as printed", "reconstructed", "Chapter One", "Chapter Seven"]) {
            if (text.includes(needle)) found.push(needle);
          }
        };
        location.hash = "#/solo";
        await new Promise(r => setTimeout(r, 200));
        scan();
        const Store = await import("./src/store.js");
        const Solo = await import("./src/solo.js");
        if (!Store.activeAdventure()) Store.createAdventure({ name: "Label sweep" });
        location.hash = "#/home";
        await new Promise(r => setTimeout(r, 120));
        location.hash = "#/solo";
        await new Promise(r => setTimeout(r, 220));
        scan();
        Solo.openTopic("fate");
        await new Promise(r => setTimeout(r, 80));
        scan();
        document.querySelectorAll(".modal-head .icon-btn").forEach(b => b.click());
        location.hash = "#/rules";
        await new Promise(r => setTimeout(r, 220));
        scan();
        const proc = [...document.querySelectorAll(".skill-row")].find(x => x.textContent.includes("Core Resolution"));
        if (proc) proc.click();
        await new Promise(r => setTimeout(r, 120));
        scan();
        document.querySelectorAll(".modal-head .icon-btn").forEach(b => b.click());
        return [...new Set(found)];
      });
      t.deep(labels, [], "no source-attribution labels render on the Solo or Rules screens" +
        (labels.length ? ` (found ${labels.join(", ")})` : ""));

      // Zoom is off: an installed copy must not pinch or double-tap scale.
      const zoom = await page.evaluate(() => {
        const meta = document.querySelector('meta[name="viewport"]').getAttribute("content");
        const inputs = [...document.querySelectorAll("input, select, textarea")];
        const small = inputs.filter(i => {
          if (i.type === "checkbox" || i.type === "radio" || i.type === "file") return false;
          return parseFloat(getComputedStyle(i).fontSize) < 16;
        }).length;
        return {
          meta,
          htmlTouch: getComputedStyle(document.documentElement).touchAction,
          bodyTouch: getComputedStyle(document.body).touchAction,
          smallFields: small,
          standalone: !!document.querySelector('meta[name="apple-mobile-web-app-capable"]')
        };
      });
      t.ok(/user-scalable=no/.test(zoom.meta), "the viewport refuses user scaling");
      t.ok(/maximum-scale=1/.test(zoom.meta), "the viewport pins the maximum scale");
      t.ok(/width=device-width/.test(zoom.meta) && /viewport-fit=cover/.test(zoom.meta),
        "and still fits the device width and the safe area");
      t.eq(zoom.htmlTouch, "manipulation", "double-tap zoom is off at the root");
      t.eq(zoom.bodyTouch, "manipulation", "and on the body");
      t.eq(zoom.smallFields, 0, "no text field is under 16px, which is what makes iOS zoom to a focused field");
      t.ok(zoom.standalone, "the app declares itself installable as a standalone copy");

      // Single-finger scrolling still works — the gesture handlers only cancel multi-touch.
      const scrolls = await page.evaluate(async () => {
        location.hash = "#/rules";
        await new Promise(r => setTimeout(r, 220));
        window.scrollTo(0, 400);
        await new Promise(r => setTimeout(r, 80));
        const moved = window.scrollY > 0;
        window.scrollTo(0, 0);
        return moved;
      });
      t.ok(scrolls, "the page still scrolls with zoom disabled");

      // Every accordion starts closed, on every screen that has one.
      const accordions = await page.evaluate(async () => {
        const out = {};
        for (const route of ["sheet", "create", "solo", "gear"]) {
          location.hash = "#/" + route;
          await new Promise(r => setTimeout(r, 220));
          const all = [...document.querySelectorAll("details.acc")];
          out[route] = { total: all.length, open: all.filter(d => d.open).length };
        }
        return out;
      });
      for (const [route, counts] of Object.entries(accordions)) {
        if (counts.open !== 0) { t.fail(`every accordion on ${route} starts closed (${counts.open} of ${counts.total} open)`); }
      }
      t.pass("every accordion starts closed on the sheet, wizard, solo and gear screens");
      t.ok(accordions.sheet.total > 0 && accordions.solo.total > 0,
        "those screens do render accordions to close");

      // A closed accordion still holds its rows, so searching and counting keep working.
      const closedRows = await page.evaluate(async () => {
        location.hash = "#/sheet";
        await new Promise(r => setTimeout(r, 220));
        return document.querySelectorAll("details.acc .skill-row").length;
      });
      t.ok(closedRows > 20, "a closed accordion still holds its rows in the DOM");

      // Removed reference entries stay removed.
      const refList = await page.evaluate(async () => {
        location.hash = "#/solo";
        await new Promise(r => setTimeout(r, 220));
        const text = document.getElementById("screen").textContent;
        return {
          meaningTopic: text.includes("Meaning Tables and building your own"),
          buildingATable: text.includes("Building a table"),
          sideBySide: text.includes("side by side"),
          renamed: text.includes("Mythic and Classified")
        };
      });
      t.ok(!refList.meaningTopic, "the Meaning Tables essay is gone from the Solo screen");
      t.ok(!refList.buildingATable, "the Building a table reference row is gone");
      t.ok(!refList.sideBySide, "the two-systems topic no longer reads side by side");
      t.ok(refList.renamed, "it reads Mythic and Classified");

      const rowShape = await page.evaluate(async () => {
        location.hash = "#/solo";
        await new Promise(r => setTimeout(r, 220));
        const rows = [...document.querySelectorAll(".skill-row")];
        return { rows: rows.length, tagged: rows.filter(r => r.querySelector(".r") || r.querySelector(".b")).length };
      });
      t.ok(rowShape.rows > 20, "the Solo screen still lists every Meaning Table and reference entry");
      t.eq(rowShape.tagged, 0, "no Solo row carries a trailing label column");

      // The update toast: persistent, one at a time, and offering a reload.
      const toast = await page.evaluate(async () => {
        const main = await import("./src/main.js");
        main.showUpdateToast();
        main.showUpdateToast();   // must not stack
        const nodes = document.querySelectorAll(".toast.update");
        const t = nodes[0];
        const labels = [...t.querySelectorAll("button")].map(b => b.textContent);
        const clickable = getComputedStyle(t).pointerEvents;
        return { count: nodes.length, labels, clickable, text: t.textContent, role: t.getAttribute("role") };
      });
      t.eq(toast.count, 1, "asking twice for the update toast shows one toast, not two");
      t.deep(toast.labels, ["Later", "Reload"], "the update toast offers Later and Reload");
      t.eq(toast.clickable, "auto", "the update toast accepts clicks, unlike ordinary toasts");
      t.ok(/Update available/.test(toast.text), "the update toast says an update is available");
      t.eq(toast.role, "status", "the update toast is announced as a status");

      const dismissed = await page.evaluate(() => {
        [...document.querySelectorAll(".toast.update button")].find(b => b.textContent === "Later").click();
        return document.querySelectorAll(".toast.update").length;
      });
      t.eq(dismissed, 0, "Later dismisses the update toast");

      const reshown = await page.evaluate(async () => {
        const main = await import("./src/main.js");
        main.showUpdateToast();
        return document.querySelectorAll(".toast.update").length;
      });
      t.eq(reshown, 1, "the toast can be shown again after being dismissed");
      await page.evaluate(() => { document.querySelectorAll(".toast.update").forEach(n => n.remove()); });

      // The service worker registers and the update check is callable without throwing.
      const swOk = await page.evaluate(async () => {
        const main = await import("./src/main.js");
        const reg = await navigator.serviceWorker.getRegistration();
        const checked = await main.checkForUpdate({ force: true });
        return { registered: !!reg, checked: typeof checked === "boolean" };
      });
      t.ok(swOk.registered, "the service worker registers when served over http");
      t.ok(swOk.checked, "the update check runs and reports a result rather than throwing");

      // Export produces valid JSON.
      const exportOk = await page.evaluate(async () => {
        const m = await import("./src/store.js");
        const parsed = JSON.parse(m.exportJSON());
        return parsed.app === "classified-player" && Array.isArray(parsed.characters);
      });
      t.ok(exportOk, "JSON export produces a valid backup document");

      // Theme toggle works in both directions.
      const themed = await page.evaluate(async () => {
        const before = document.documentElement.getAttribute("data-theme");
        document.getElementById("themeBtn").click();
        const after = document.documentElement.getAttribute("data-theme");
        return before !== after;
      });
      t.ok(themed, "the theme toggle overrides the system preference");

      t.eq(errors.length, 0, "zero JavaScript errors during the whole run" +
        (errors.length ? `: ${errors.slice(0, 3).join(" | ")}` : ""));

      await context.close();
    }
  } finally {
    await browser.close();
  }
}
