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

      // Starting an adventure asks nothing: the briefing names it a moment later.
      const startFlow = await page.evaluate(async () => {
        const Store = await import("./src/store.js");
        const Solo = await import("./src/solo.js");
        for (const a of Store.soloAdventures()) Store.deleteAdventure(a.id);
        // Nothing earlier may leave a dialog on top of the screen this block clicks through.
        (await import("./src/ui.js")).closeAllModals();
        await new Promise(r => setTimeout(r, 60));
        location.hash = "#/home";
        await new Promise(r => setTimeout(r, 140));
        location.hash = "#/solo";
        await new Promise(r => setTimeout(r, 240));
        const empty = document.getElementById("screen").textContent.includes("No adventure open");
        [...document.querySelectorAll("#screen .btn.primary")].find(b => /Start an adventure/.test(b.textContent)).click();
        await new Promise(r => setTimeout(r, 260));
        const adv = Store.activeAdventure();
        return {
          empty,
          prompted: !!document.querySelector(".modal"),
          created: !!adv,
          name: adv && adv.name,
          phase: adv && adv.scenePhase,
          linked: !!(adv && adv.characterId),
          primary: [...document.querySelectorAll("#screen .solo-primary")].map(b => b.textContent)
        };
      });
      t.ok(startFlow.empty, "with nothing open the Solo screen offers to start an adventure");
      t.ok(!startFlow.prompted, "tapping it asks no questions — no name prompt, no dossier chooser");
      t.ok(startFlow.created, "the adventure exists straight away");
      t.eq(startFlow.name, "Untitled adventure", "unnamed until the briefing names it");
      t.eq(startFlow.phase, "briefing", "and it opens on the briefing");
      t.ok(startFlow.linked, "linked to the dossier that is already open");
      t.deep(startFlow.primary, ["Write the mission briefing"], "whose primary action is writing that briefing");

      // The codename row names the adventure, which is why the prompt was redundant.
      const named = await page.evaluate(async () => {
        const Store = await import("./src/store.js");
        Store.updateAdventure(a => { a.name = "Untitled adventure"; });
        const before = Store.activeAdventure().name;
        Store.updateAdventure(a => { a.name = "Operation Nightjar"; });   // what committing a codename does
        return { before, after: Store.activeAdventure().name };
      });
      t.eq(named.before, "Untitled adventure", "an adventure starts untitled");
      t.eq(named.after, "Operation Nightjar", "and takes the codename the briefing rolls");

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
        // Row fields are the bare inputs; the seed lines that go on the lists sit in labels.
        const rowFields = () => [...modalEl.querySelectorAll('input[type="text"]')].filter(f => !f.closest("label.field"));
        const seedFields = () => [...modalEl.querySelectorAll('label.field input[type="text"]')];

        // One tap fills the whole mission.
        modalEl.querySelector(".btn.block").click();
        for (let i = 0; i < 60 && rowFields().some(f => !f.value.trim()); i++) {
          await new Promise(r => setTimeout(r, 50));
        }
        const fields = rowFields();
        const filledBefore = fields.filter(f => f.value.trim()).length;
        const rolledOnce = fields.map(f => f.value);

        // Write over the objective the way a player would.
        const objIdx = S.BRIEFING_ROWS.findIndex(r => r.key === "objective");
        fields[objIdx].value = "Recover the case before the handover";
        fields[objIdx].dispatchEvent(new Event("input", { bubbles: true }));
        await new Promise(r => setTimeout(r, 30));

        // Roll all again: the row that was written over must survive it.
        modalEl.querySelector(".btn.block").click();
        for (let i = 0; i < 60 && rowFields()[0].value === rolledOnce[0]; i++) {
          await new Promise(r => setTimeout(r, 50));
        }
        const keptEdit = rowFields()[objIdx].value === "Recover the case before the handover";
        const rerolledOthers = rowFields().filter((f, i) => i !== objIdx && f.value !== rolledOnce[i]).length;

        // The seed line follows the row until it is written, and then it is the player's.
        const seeds = seedFields();
        const seedTracksRow = seeds[0].value === "Recover the case before the handover";
        const compIdx = S.BRIEFING_ROWS.findIndex(r => r.key === "complication");
        const complicationRow = rowFields()[compIdx].value;
        seeds[1].value = "Find out who turned the station chief";
        seeds[1].dispatchEvent(new Event("input", { bubbles: true }));
        // Changing the row afterwards must not overwrite what was written into the seed line.
        rowFields()[compIdx].dispatchEvent(new Event("input", { bubbles: true }));
        await new Promise(r => setTimeout(r, 30));
        const seedStaysWritten = seeds[1].value === "Find out who turned the station chief";
        const seedCount = seeds.length;

        [...modalEl.querySelectorAll(".modal-foot .btn")].find(b => /Commit|Save/.test(b.textContent)).click();
        await p;
        await new Promise(r => setTimeout(r, 150));
        [...document.querySelectorAll(".modal-foot .btn")].forEach(b => { if (b.textContent === "OK") b.click(); });
        await new Promise(r => setTimeout(r, 200));

        const adv = Store.activeAdventure();
        const screen = document.getElementById("screen");
        return {
          filledBefore, keptEdit, rerolledOthers, seedTracksRow, seedStaysWritten, seedCount,
          complicationRow,
          rows: Object.keys(adv.briefing.rows).length,
          objective: adv.briefing.rows.objective.text,
          words: adv.briefing.rows.objective.words.length,
          hasNpc: !!(adv.briefing.npc && adv.briefing.npc.attrs),
          threads: adv.threads.map(x => x.text),
          characters: adv.characters.length,
          phase: adv.scenePhase,
          named: adv.name !== "Untitled adventure",
          pinnedClosed: !!screen.querySelector("details.acc:not([open]) summary"),
          pinnedText: screen.textContent.includes("Mission briefing"),
          pinnedRows: (() => {
            const acc = [...screen.querySelectorAll("details.acc")]
              .find(d => d.querySelector("summary").textContent.includes("Mission briefing"));
            return acc
              ? [...acc.querySelectorAll(".card-row .grow")].map(g => [...g.children].map(c => c.textContent))
              : [];
          })()
        };
      });
      t.eq(briefed.filledBefore, 8, "Roll all fills every briefing row in one tap");
      t.ok(briefed.keptEdit, "and rolling again leaves a row you have written over alone");
      t.ok(briefed.rerolledOthers >= 5, "while every row still holding its words is rolled again");
      t.eq(briefed.seedCount, 3, "the three seeded lines are editable before they go on the lists");
      t.ok(briefed.seedTracksRow, "a seed line follows its row until it is written");
      t.ok(briefed.seedStaysWritten, "and then it is the player's, whatever the row does after");
      t.eq(briefed.objective, "Recover the case before the handover", "what you write over the words is what is kept");
      t.ok(briefed.words >= 2, "and the words that prompted it are kept underneath");
      t.ok(briefed.hasNpc, "the opponent is a real generated NPC with characteristics");
      t.ok(briefed.threads.includes("Recover the case before the handover"),
        "the objective is seeded into Threads");
      t.eq(briefed.threads.length, 2, "along with the complication");
      t.ok(briefed.threads.includes("Find out who turned the station chief"),
        "a seed line written by hand is what lands on the list, not the rolled words");
      t.ok(!briefed.threads.includes(briefed.complicationRow),
        "and the briefing row keeps the words it rolled");
      t.eq(briefed.characters, 1, "and the opponent into Characters");
      t.eq(briefed.phase, "setup", "committing the briefing moves the adventure on to scene 1");
      t.ok(briefed.named, "an untitled adventure takes its codename as its name");
      t.ok(briefed.pinnedText, "the briefing is pinned on the Solo screen");
      t.ok(briefed.pinnedClosed, "in an accordion that starts closed");

      // An unedited row's text IS the words joined, so printing both says it twice.
      const bare = s => String(s).toLowerCase().replace(/[^a-z0-9]/g, "");
      t.eq(briefed.pinnedRows.length, 8, "the pinned briefing lists every row");
      t.ok(!briefed.pinnedRows.some(r => r.slice(1).length > 1 && bare(r[1]) === bare(r[2])),
        "no pinned row prints its own words back underneath itself");
      t.ok(briefed.pinnedRows.every(r => r.length === 2 || r[0] === "Objective"),
        "a row left as it was rolled shows the line alone");
      const objRow = briefed.pinnedRows.find(r => r[0] === "Objective");
      t.eq(objRow.length, 3, "a row that was written over keeps the words that prompted it");
      t.ok(objRow[2].includes("·"), "and shows them as the word pair they were");

      // A list entry seeded from a word pair has to be rewordable in place. On its own
      // adventure: this block drives the DOM, and a screen still holding an earlier
      // adventure's rows would have it clicking a row that no longer exists.
      const reworded = await page.evaluate(async () => {
        const Store = await import("./src/store.js");
        (await import("./src/ui.js")).closeAllModals();
        await new Promise(r => setTimeout(r, 200));

        const adv = Store.createAdventure({ name: "Reword test", characterId: null });
        Store.updateAdventure(a => {
          a.scenePhase = "setup";
          a.threads = [{ id: "li_reword", text: "Deliver · Evaluate", weight: 1 }];
          a.characters = [];
        });
        location.hash = "#/home"; await new Promise(r => setTimeout(r, 100));
        location.hash = "#/solo"; await new Promise(r => setTimeout(r, 250));

        const find = () => [...document.querySelectorAll(".row-edit")]
          .find(b => b.getAttribute("aria-label") === "Reword Deliver · Evaluate");
        for (let i = 0; i < 40 && !find(); i++) await new Promise(r => setTimeout(r, 50));
        const btn = find();
        const clickable = !!btn;
        btn.click();
        for (let i = 0; i < 40 && !document.querySelector("#promptInput"); i++) {
          await new Promise(r => setTimeout(r, 50));
        }
        const input = [...document.querySelectorAll("#promptInput")].pop();
        const prefilled = input.value === "Deliver · Evaluate";
        input.value = "Get the case to the safe house before dawn";
        const dlg = input.closest(".modal");
        [...dlg.querySelectorAll(".modal-foot .btn")].find(b => b.textContent === "OK").click();
        for (let i = 0; i < 40 && Store.getAdventure(adv.id).threads[0].text === "Deliver · Evaluate"; i++) {
          await new Promise(r => setTimeout(r, 50));
        }

        const after = Store.getAdventure(adv.id).threads;
        const onScreen = document.getElementById("screen").textContent
          .includes("Get the case to the safe house before dawn");
        Store.deleteAdventure(adv.id);
        return {
          clickable, prefilled, onScreen,
          text: after[0].text, weight: after[0].weight, id: after[0].id === "li_reword",
          count: after.length
        };
      });
      t.ok(reworded.clickable, "a list entry's own text is the control that rewords it");
      t.ok(reworded.prefilled, "which opens on what it says now");
      t.eq(reworded.text, "Get the case to the safe house before dawn", "and keeps what you write");
      t.ok(reworded.id, "the entry keeps its identity, so a mystery or a seeded id still points at it");
      t.eq(reworded.weight, 1, "and its weight");
      t.eq(reworded.count, 1, "rewording adds nothing to the list");
      t.ok(reworded.onScreen, "the screen shows the new wording straight away");

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

      // Mysteries: clues set the odds and Fate decides the moment. No clock, because a clock
      // would tell you which clue breaks it open.
      const mystery = await page.evaluate(async () => {
        const Store = await import("./src/store.js");
        const Solo = await import("./src/solo.js");
        const clearModals = async () => {
          for (let i = 0; i < 8 && document.querySelector(".modal"); i++) {
            const m = document.querySelector(".modal");
            const x = m.querySelector(".modal-head .icon-btn");
            if (x) x.click();
            else { const btn = [...m.querySelectorAll(".modal-foot .btn")].pop(); if (btn) btn.click(); else break; }
            await new Promise(r => setTimeout(r, 40));
          }
        };
        Store.updateAdventure(a => {
          a.chaos = 5;
          a.mysteries = [{
            id: "mys_test", subject: "objective", label: "Who wants the film",
            sourceId: null, clues: 0, createdAt: Date.now(), revealedAt: null, reveal: null
          }];
          a.briefing = a.briefing || { rows: {}, npc: null, seededIds: [], writtenAt: Date.now() };
          a.briefing.rows.objective = { text: "Recover the courier's manifest", words: [], rolls: [] };
        });
        location.hash = "#/home";
        await new Promise(r => setTimeout(r, 140));
        location.hash = "#/solo";
        await new Promise(r => setTimeout(r, 240));

        const panel = document.getElementById("screen").textContent;
        const pips = document.querySelectorAll(".progress-track .progress-pip").length;

        let ticks = 0;
        let revealed = null;
        while (ticks < 25 && !revealed) {
          ticks += 1;
          await Solo.tickMystery("mys_test", "clue");
          await clearModals();
          const m = Store.activeAdventure().mysteries[0];
          if (m && m.revealedAt) revealed = m;
        }
        const log = Store.rollLog();
        const asked = log.filter(r => /break open now/i.test(r.label || ""));
        return {
          panel: panel.includes("Mysteries") && panel.includes("Who wants the film"),
          houseAid: /house aid/i.test(panel),
          oddsShown: /no clues yet/i.test(panel),
          pips, ticks,
          revealed: !!revealed,
          shape: revealed && revealed.reveal.shapeName,
          words: revealed && revealed.reveal.words.length,
          askedCount: asked.length,
          askedOutcome: asked[0] && asked[0].outcome,
          revealLogged: log.some(r => /Mystery revealed/.test(r.label || ""))
        };
      });
      t.ok(mystery.panel, "the Solo screen carries a Mysteries panel naming the open mystery");
      t.ok(mystery.houseAid, "and says on the panel that it is the app's own house aid");
      t.eq(mystery.pips, 0, "there is no clock: a clock would say which clue breaks it open");
      t.ok(mystery.oddsShown, "the panel shows what the clues have earned instead");
      t.ok(mystery.revealed, `it breaks open on a Fate roll rather than a count (took ${mystery.ticks} clues)`);
      t.ok(mystery.askedCount >= 1, "every clue asks the chart whether this is the moment");
      t.ok(["It breaks open", "It breaks wide open", "Not yet", "The lead goes cold"].includes(mystery.askedOutcome),
        "and the answer is logged in that question's own words");
      t.ok(!!mystery.shape, `the reveal rolls the shape of the truth (${mystery.shape})`);
      t.ok(mystery.words >= 2, "with a word pair to colour it");
      t.ok(mystery.revealLogged, "and the reveal is written to the shared roll log");

      // Clues are worth writing down: the count sets the odds, the lines are what the reveal
      // gets read against.
      const clues = await page.evaluate(async () => {
        const Store = await import("./src/store.js");
        const Solo = await import("./src/solo.js");
        const UI = await import("./src/ui.js");
        UI.closeAllModals();
        await new Promise(r => setTimeout(r, 60));
        Store.updateAdventure(a => {
          a.scene = 6; a.chaos = 5;
          a.mysteries = [{ id: "mys_clue", subject: "thread", label: "Deliver · Evaluate",
            sourceId: null, clues: 0, clueLog: [], misses: 0, lastScene: 6,
            createdAt: Date.now(), revealedAt: null, reveal: null }];
        });
        // A mid roll is a plain No at these odds, so the clue stands rather than being spent
        // by an Exceptional No — the point of the check is the line, not the answer.
        const real = Math.random;
        Math.random = () => 0.5;
        try { await Solo.tickMystery("mys_clue", "clue", "The manifest is countersigned twice"); }
        finally { Math.random = real; }
        for (let i = 0; i < 6 && document.querySelector(".modal"); i++) {
          const btn = [...document.querySelector(".modal").querySelectorAll(".modal-foot .btn")].pop();
          if (btn) btn.click(); else break;
          await new Promise(r => setTimeout(r, 40));
        }
        location.hash = "#/home"; await new Promise(r => setTimeout(r, 100));
        location.hash = "#/solo"; await new Promise(r => setTimeout(r, 200));

        const m = Store.activeAdventure().mysteries.find(x => x.id === "mys_clue");
        const screen = document.getElementById("screen").textContent;

        // The title is the control that rewords a mystery opened on a word pair.
        const btn = [...document.querySelectorAll(".row-edit")].find(b => b.textContent.includes("Deliver · Evaluate"));
        const renameable = !!btn;
        if (btn) {
          btn.click();
          await new Promise(r => setTimeout(r, 120));
          document.getElementById("promptInput").value = "Who is countersigning the manifests?";
          [...document.querySelectorAll(".modal-foot .btn")].find(b => b.textContent === "OK").click();
          await new Promise(r => setTimeout(r, 180));
        }
        const after = Store.activeAdventure().mysteries.find(x => x.id === "mys_clue");
        return {
          logged: m ? m.clueLog.length : 0,
          text: m && m.clueLog[0] && m.clueLog[0].text,
          lastScene: m && m.lastScene,
          onScreen: screen.includes("The manifest is countersigned twice"),
          renameable, label: after && after.label,
          clueKept: after && after.clueLog.length
        };
      });
      t.eq(clues.logged, 1, "a clue records the line that produced it, not just a count");
      t.eq(clues.text, "The manifest is countersigned twice", "in the player's own words");
      t.eq(clues.lastScene, 6, "and the scene it landed in, so a cold case can be spotted");
      t.ok(clues.onScreen, "the clue reads back on the mystery's card");
      t.ok(clues.renameable, "a mystery's own title is the control that rewords it");
      t.eq(clues.label, "Who is countersigning the manifests?", "so one opened on a word pair can be written as a question");
      t.eq(clues.clueKept, 1, "and rewording leaves its clues alone");

      // Two plain refusals is a pattern, not silence.
      const planted = await page.evaluate(async () => {
        const Store = await import("./src/store.js");
        const Solo = await import("./src/solo.js");
        const clear = async () => {
          (await import("./src/ui.js")).closeAllModals();
          await new Promise(r => setTimeout(r, 60));
        };
        await clear();
        Store.updateAdventure(a => {
          const m = a.mysteries.find(x => x.id === "mys_clue");
          m.clues = 1; m.misses = 1; m.revealedAt = null; m.reveal = null;   // one refusal already
        });
        const real = Math.random;
        Math.random = () => 0.5;                      // a plain No, neither Yes nor Exceptional
        try { await Solo.testMystery("mys_clue"); } finally { Math.random = real; }
        await new Promise(r => setTimeout(r, 120));
        const shown = document.querySelector(".modal") ? document.querySelector(".modal").textContent : "";
        await clear();
        const adv = Store.activeAdventure();
        const m = adv.mysteries.find(x => x.id === "mys_clue");
        const row = adv.journal.find(j => /trail was planted/i.test(j.text));
        const fired = row ? { detail: row.detail, misses: m.misses, clues: m.clues } : null;
        const log = Store.rollLog();
        return {
          fired: !!fired, shown: /twice refused/i.test(shown),
          words: fired ? fired.detail.split(" · ").length : 0,
          misses: fired ? fired.misses : null,
          clues: fired ? fired.clues : null,
          logged: log.some(r => /trail was planted/i.test(r.label || ""))
        };
      });
      t.ok(planted.fired, "a second plain refusal rolls the trail as planted");
      t.ok(planted.shown, "and says on the dialog why two dead askings are a pattern");
      t.eq(planted.words, 2, "with a word pair saying who laid it");
      t.eq(planted.misses, 0, "the count starts again from there");
      t.eq(planted.clues, 1, "and the clues already gathered still stand");
      t.ok(planted.logged, "the false lead is written to the shared roll log");

      // A shape that names a person draws one; a reveal on the opponent changes their sheet.
      const namedReveal = await page.evaluate(async () => {
        const Store = await import("./src/store.js");
        const Solo = await import("./src/solo.js");
        (await import("./src/ui.js")).closeAllModals();
        await new Promise(r => setTimeout(r, 60));
        const real = Math.random;
        Math.random = () => 0;          // d100 → 1: shape "Someone you trusted", first list slot
        try {
          Store.updateAdventure(a => {
            a.characters = [{ id: "li_named", text: "Halloran, the station chief", weight: 1 }];
            a.briefing = a.briefing || { rows: {}, npc: null, seededIds: [], writtenAt: Date.now() };
            a.briefing.npc = { name: "Cormorant — ruthless spymaster", alias: "Cormorant",
              attrs: { str: 8, dex: 8, wil: 8, per: 8, int: 8 }, weaknesses: [],
              interaction: { reaction: 0, persuasion: 0, seduction: 0, interrogation: 0, torture: 0 } };
            a.mysteries.push({ id: "mys_opp", subject: "opponent", label: "Who does Cormorant answer to?",
              sourceId: null, clues: 3, clueLog: [], misses: 0, lastScene: a.scene,
              createdAt: Date.now(), revealedAt: null, reveal: null });
          });
          await Solo.revealMystery(Store.activeAdventure(), "mys_opp", {});
          await new Promise(r => setTimeout(r, 120));
        } finally { Math.random = real; }

        const adv = Store.activeAdventure();
        const m = adv.mysteries.find(x => x.id === "mys_opp");
        const text = document.querySelector(".modal") ? document.querySelector(".modal").textContent : "";
        (await import("./src/ui.js")).closeAllModals();
        await new Promise(r => setTimeout(r, 60));
        return {
          shape: m.reveal.shapeName,
          implicated: m.reveal.implicated,
          tellKind: m.reveal.tell && m.reveal.tell.kind,
          tellName: m.reveal.tell && m.reveal.tell.name,
          npcWeaknesses: adv.briefing.npc.weaknesses.length,
          shownWho: text.includes("It runs through Halloran, the station chief"),
          shownTell: /Tell:/.test(text)
        };
      });
      t.eq(namedReveal.shape, "Someone you trusted", "a shape can name a person rather than a thing");
      t.eq(namedReveal.implicated, "Halloran, the station chief",
        "and when it does, the reveal draws one off the Characters list");
      t.ok(namedReveal.shownWho, "the reveal says who it runs through");
      t.eq(namedReveal.tellKind, "weakness", "a reveal on the opponent also hands you a tell");
      t.eq(namedReveal.npcWeaknesses, 1, "which is written onto their stat block, not just described");
      t.ok(!!namedReveal.tellName, `and named on the reveal (${namedReveal.tellName})`);
      t.ok(namedReveal.shownTell, "the reveal shows the tell it added");

      // A mystery nobody has touched is a thing running away from you.
      const stale = await page.evaluate(async () => {
        const Store = await import("./src/store.js");
        const Solo = await import("./src/solo.js");
        const S = await import("./data-solo.js");
        (await import("./src/ui.js")).closeAllModals();
        await new Promise(r => setTimeout(r, 60));
        Store.updateAdventure(a => {
          a.scene = 10; a.chaos = 5; a.scenePhase = "play";
          a.mysteries = [{ id: "mys_cold", subject: "thread", label: "The cold case",
            sourceId: null, clues: 1, clueLog: [], misses: 0,
            lastScene: 10 - S.MYSTERY_STALE_SCENES,
            createdAt: Date.now(), revealedAt: null, reveal: null }];
        });
        const before = Store.activeAdventure().chaos;
        const p = Solo.endScene(Store.activeAdventure());
        await new Promise(r => setTimeout(r, 150));

        const dlg = document.querySelector(".modal");
        const offered = dlg.textContent.includes("A mystery is getting away from you");
        const box = [...dlg.querySelectorAll('input[type="checkbox"]')][0];
        box.click();                                    // the stale bump is the first row
        [...dlg.querySelectorAll(".chip")].find(c => /No —/.test(c.textContent)).click();
        await new Promise(r => setTimeout(r, 40));
        const preview = dlg.querySelector("p.small.muted").textContent;
        [...dlg.querySelectorAll(".modal-foot .btn")].find(b => /End scene/.test(b.textContent)).click();
        await p;
        await new Promise(r => setTimeout(r, 200));
        const summary = document.querySelector(".modal") ? document.querySelector(".modal").textContent : "";
        (await import("./src/ui.js")).closeAllModals();
        await new Promise(r => setTimeout(r, 60));
        return { offered, before, after: Store.activeAdventure().chaos, preview, summary };
      });
      t.ok(stale.offered, "End Scene names a mystery no clue has touched for four scenes");
      t.eq(stale.after, stale.before + 2, "and its step stacks with the control question");
      t.ok(/5 → 7/.test(stale.preview), "the dialog shows where the Chaos Factor will land before you commit");
      t.ok(/getting away/.test(stale.summary), "and the summary says the cold case cost a step of its own");

      // An attack knows who it is aimed at, and the wound it works out lands on them.
      const targeted = await page.evaluate(async () => {
        const Store = await import("./src/store.js");
        const Roller = await import("./src/roller.js");
        const { addNpcToEncounter } = await import("./src/combat.js");
        (await import("./src/ui.js")).closeAllModals();
        await new Promise(r => setTimeout(r, 150));

        const c = Store.activeCharacter();
        Store.clearCombat();
        addNpcToEncounter({ name: "Sentry", speed: 1, attrs: { str: 8 }, hthDamage: "A" });
        const target = Store.combatState().combatants.find(x => !x.characterId);

        Roller.openAttack(c, { key: "unarmed", name: "Unarmed", cat: "hth", drBonus: 0 }, { targetId: target.id });
        for (let i = 0; i < 40 && !document.querySelector(".modal"); i++) await new Promise(r => setTimeout(r, 50));
        const dlg = document.querySelector(".modal");
        const namesTarget = /Sentry \(Speed 1\)/.test(dlg.textContent);
        // Speed 1 must have set the base Difficulty Factor without the player typing it.
        const speedTaken = /taken from the tracker/.test(dlg.textContent) &&
          !![...dlg.querySelectorAll(".chip.on")].find(ch => /Speed 1/.test(ch.textContent));
        // A d100 of 1 is a Superb, so the wound path is exercised on every run rather than
        // whenever the dice feel like it.
        const real = Math.random;
        Math.random = () => 0;
        [...dlg.querySelectorAll(".modal-foot .btn")].find(b => b.textContent === "Attack").click();
        for (let i = 0; i < 60 && !document.querySelector(".roll-quality"); i++) await new Promise(r => setTimeout(r, 50));
        Math.random = real;
        const result = document.querySelector(".modal");
        const applyBtn = [...result.querySelectorAll(".btn")].find(b => /Apply to Sentry/.test(b.textContent));
        const hit = !!applyBtn;
        let woundAfter = null, reported = false;
        if (applyBtn) {
          applyBtn.click();
          for (let i = 0; i < 40 && Store.combatState().combatants.find(x => x.id === target.id).wound === "none"; i++) {
            await new Promise(r => setTimeout(r, 50));
          }
          woundAfter = Store.combatState().combatants.find(x => x.id === target.id).wound;
          reported = /Sentry is now/.test(result.textContent);
        }
        (await import("./src/ui.js")).closeAllModals();
        Store.clearCombat();
        await new Promise(r => setTimeout(r, 100));
        return { namesTarget, speedTaken, hit, woundAfter, reported };
      });
      t.ok(targeted.namesTarget, "an attack during an encounter names the target it is aimed at");
      t.ok(targeted.speedTaken, "and takes their Speed from the tracker rather than asking for it");
      t.ok(targeted.hit, "a hit offers to apply the wound rather than only printing it");
      t.ok(targeted.woundAfter && targeted.woundAfter !== "none",
        `which lands on the target through the accumulation table (${targeted.woundAfter})`);
      t.ok(targeted.reported, "and says what they are now");

      // A Quality-as-Difficulty-Factor procedure has to offer its second half.
      const opposed = await page.evaluate(async () => {
        const Store = await import("./src/store.js");
        const Roller = await import("./src/roller.js");
        (await import("./src/ui.js")).closeAllModals();
        await new Promise(r => setTimeout(r, 150));
        const c = Store.activeCharacter();

        const run = async (skillKey, forceRoll) => {
          const real = Math.random;
          Math.random = () => forceRoll;
          Roller.openRoll({ character: c, skillKey });
          for (let i = 0; i < 40 && !document.querySelector(".modal"); i++) await new Promise(r => setTimeout(r, 50));
          const dlg = document.querySelector(".modal");
          [...dlg.querySelectorAll(".modal-foot .btn")].find(b => b.textContent === "Roll").click();
          for (let i = 0; i < 60 && !document.querySelector(".roll-quality"); i++) await new Promise(r => setTimeout(r, 50));
          Math.random = real;
          const text = (document.querySelector(".modal") || {}).textContent || "";
          const btn = [...(document.querySelector(".modal") || document.body).querySelectorAll(".btn")]
            .find(b => /^Roll .*at DF/.test(b.textContent));
          const label = btn ? btn.textContent : "";
          (await import("./src/ui.js")).closeAllModals();
          await new Promise(r => setTimeout(r, 100));
          return { text, label };
        };

        const disguised = await run("disguise", 0);        // d100 1 → Superb
        const blown = await run("disguise", 0.99);         // d100 100 → always a failure
        const stealthy = await run("stealth", 0);
        return { disguised, blown, stealthy };
      });
      t.ok(/Observer's Perception/.test(opposed.disguised.text),
        "a Disguise result offers the check the book says follows it");
      t.ok(/DF 1$/.test(opposed.disguised.label),
        `a Superb disguise is looked at on Difficulty Factor 1 (${opposed.disguised.label})`);
      t.ok(/DF 10$/.test(opposed.blown.label),
        `a failed disguise lets them look at Difficulty Factor 10 (${opposed.blown.label})`);
      t.ok(/Unnoticed/.test(opposed.stealthy.text) && !opposed.stealthy.label,
        "a Superb Stealth passes unnoticed and hands over no check at all");

      // Grenades: buyable, and now throwable.
      const grenade = await page.evaluate(async () => {
        const Store = await import("./src/store.js");
        const Roller = await import("./src/roller.js");
        const D = await import("./data.js");
        (await import("./src/ui.js")).closeAllModals();
        await new Promise(r => setTimeout(r, 150));
        const c = Store.activeCharacter();
        const inc = D.GRENADE_TYPES.find(g => g.key === "incendiary");

        const real = Math.random;
        Math.random = () => 0;                              // d100 1: a Superb, on target
        Roller.openGrenadeThrow(c, inc);
        for (let i = 0; i < 40 && !document.querySelector(".modal"); i++) await new Promise(r => setTimeout(r, 50));
        const setup = document.querySelector(".modal");
        const range = /10 feet per point of Strength/.test(setup.textContent);
        [...setup.querySelectorAll(".modal-foot .btn")].find(b => b.textContent === "Throw").click();
        for (let i = 0; i < 60 && !document.querySelector(".roll-quality"); i++) await new Promise(r => setTimeout(r, 50));
        Math.random = real;
        const out = (document.querySelector(".modal") || {}).textContent || "";
        const applies = [...(document.querySelector(".modal") || document.body).querySelectorAll(".btn")]
          .some(b => /^Apply to /.test(b.textContent));
        (await import("./src/ui.js")).closeAllModals();
        await new Promise(r => setTimeout(r, 100));
        return { range, onTarget: /On target/.test(out), dr: /Area Damage Rank K/.test(out), applies, out };
      });
      t.ok(grenade.range, "the throw dialog works the range out from Strength rather than asking");
      t.ok(grenade.onTarget, "a Superb throw lands where it was aimed");
      t.ok(grenade.dr, "the blast carries the grenade's own Area Damage Rank");
      t.ok(grenade.applies, "and the wound it works out can be applied rather than read out");

      // Phase 5: the campaign panel, the party, and the portrait. With no Firebase keys the
      // flow still runs against a local campaign record, which is what makes it testable.
      const campaign = await page.evaluate(async () => {
        const Store = await import("./src/store.js");
        const Sync = await import("./src/sync.js");
        const SettingsMod = await import("./src/settings.js");
        (await import("./src/ui.js")).closeAllModals();
        await new Promise(r => setTimeout(r, 150));
        Sync.leaveCampaign();
        SettingsMod.set("multiplayer", true);

        location.hash = "#/home"; await new Promise(r => setTimeout(r, 100));
        location.hash = "#/settings"; await new Promise(r => setTimeout(r, 250));
        const before = [...document.querySelectorAll("#screen .btn")].map(b => b.textContent);

        [...document.querySelectorAll("#screen .btn")].find(b => b.textContent === "Create a campaign").click();
        for (let i = 0; i < 40 && !document.querySelector("#promptInput"); i++) await new Promise(r => setTimeout(r, 50));
        const input = [...document.querySelectorAll("#promptInput")].pop();
        input.value = "Operation Midnight";
        [...input.closest(".modal").querySelectorAll(".modal-foot .btn")].find(b => b.textContent === "OK").click();
        for (let i = 0; i < 40 && !Sync.currentCampaign(); i++) await new Promise(r => setTimeout(r, 50));
        const made = Sync.currentCampaign();
        (await import("./src/ui.js")).closeAllModals();
        await new Promise(r => setTimeout(r, 150));

        location.hash = "#/home"; await new Promise(r => setTimeout(r, 100));
        location.hash = "#/settings"; await new Promise(r => setTimeout(r, 250));
        const panel = document.getElementById("screen").textContent;
        const hasLeave = [...document.querySelectorAll("#screen .btn")].map(b => b.textContent).includes("Leave");
        const persisted = JSON.parse(localStorage.getItem("classified.campaign") || "null");

        Sync.leaveCampaign();
        SettingsMod.set("multiplayer", false);
        location.hash = "#/home"; await new Promise(r => setTimeout(r, 100));
        return {
          before, code: made.joinCode, name: made.name, role: made.role, local: made.local,
          showsCode: panel.includes(made.joinCode),
          showsParty: panel.includes("Party"),
          showsName: panel.includes("Operation Midnight"),
          hasLeave,
          persisted: !!persisted && persisted.joinCode === made.joinCode
        };
      });
      t.ok(campaign.before.includes("Create a campaign") && campaign.before.includes("Join with a code"),
        "Settings carries the campaign controls, not just a status line");
      t.ok(/^[a-z]+-[a-z]+-[a-z]+$/.test(campaign.code), `a campaign gets a three-word join code (${campaign.code})`);
      t.eq(campaign.name, "Operation Midnight", "under the name you gave it");
      t.eq(campaign.role, "gm", "and the device that made it is the game master");
      t.ok(campaign.local, "with no keys configured it is a local campaign rather than a failure");
      t.ok(campaign.showsCode, "the panel shows the join code to share");
      t.ok(campaign.showsName && campaign.showsParty, "with the campaign name and who is at the table");
      t.ok(campaign.hasLeave, "and a way out of it");
      t.ok(campaign.persisted, "the campaign survives a reload");

      // The dossier photograph, compressed in the browser.
      const portrait = await page.evaluate(async () => {
        const Store = await import("./src/store.js");
        const Sheet = await import("./src/sheet.js");
        // A 900px source, which is what a phone camera hands you.
        const src = document.createElement("canvas");
        src.width = 900; src.height = 600;
        const g = src.getContext("2d");
        g.fillStyle = "#8c1c13"; g.fillRect(0, 0, 900, 600);
        g.fillStyle = "#e8dcc2"; g.fillRect(100, 100, 700, 400);
        const blob = await new Promise(r => src.toBlob(r, "image/png"));
        const file = new File([blob], "photo.png", { type: "image/png" });

        const url = await Sheet.compressImage(file);
        const bytes = Math.round(url.length * 0.75);
        const img = new Image();
        await new Promise(r => { img.onload = r; img.src = url; });

        Store.updateActive(x => { x.identity.portraitUrl = url; });
        location.hash = "#/home"; await new Promise(r => setTimeout(r, 100));
        location.hash = "#/sheet"; await new Promise(r => setTimeout(r, 250));
        const shown = document.querySelector("#screen .portrait img");
        const rendered = !!shown && shown.getAttribute("src") === url;
        const backup = JSON.parse(Store.exportJSON());
        Store.updateActive(x => { x.identity.portraitUrl = ""; });
        return {
          jpeg: url.startsWith("data:image/jpeg"),
          w: img.width, h: img.height, bytes,
          sourceBytes: blob.size, rendered,
          inBackup: JSON.stringify(backup).includes(url.slice(0, 64)),
          placeholder: !!document.querySelector("#screen .portrait")
        };
      });
      t.ok(portrait.jpeg, "a portrait is stored as a JPEG data URL, so it needs no Firebase Storage");
      t.eq(portrait.w, 256, "downscaled to 256px square");
      t.eq(portrait.h, 256, "on both axes, cropped to the middle rather than squashed");
      t.ok(portrait.bytes < portrait.sourceBytes,
        `and smaller than the source (${portrait.bytes} vs ${portrait.sourceBytes} bytes)`);
      t.ok(portrait.bytes < 60000, "small enough to sit in localStorage beside the dossier");
      t.ok(portrait.rendered, "the sheet shows it");
      t.ok(portrait.inBackup, "and it rides along in the JSON backup");
      t.ok(portrait.placeholder, "with a photo box on the sheet when there is none");

      // The loop needs an exit: a solo mission that ends, and Classified's own End Mission
      // fired for the dossier it was played on (S24).
      const mission = await page.evaluate(async () => {
        const Store = await import("./src/store.js");
        const Solo = await import("./src/solo.js");
        (await import("./src/ui.js")).closeAllModals();
        await new Promise(r => setTimeout(r, 200));

        const c = Store.activeCharacter();
        const adv = Store.createAdventure({ name: "Closing time", characterId: c.id });
        Store.updateAdventure(a => { a.scene = 4; a.scenePhase = "setup"; a.threads = [{ id: "li_open", text: "Still open", weight: 1 }]; });
        location.hash = "#/home"; await new Promise(r => setTimeout(r, 100));
        location.hash = "#/solo"; await new Promise(r => setTimeout(r, 250));

        const offered = [...document.querySelectorAll("#screen .btn")].some(b => b.textContent === "End the mission");
        const xpBefore = Store.getCharacter(c.id).xp.total;
        const missionsBefore = Store.getCharacter(c.id).missions || 0;

        const p = Solo.endMission(Store.activeAdventure());
        await new Promise(r => setTimeout(r, 200));
        const dlg = document.querySelector(".modal");
        const warns = dlg.textContent.includes("Still open");
        const handoff = /End Mission/.test(dlg.textContent);
        [...dlg.querySelectorAll(".modal-foot .btn")].find(b => /End the mission/.test(b.textContent)).click();
        // Classified's own bundle opens next and endMission is still awaiting it, so the
        // lifecycle dialog has to be answered before that promise can be awaited.
        for (let i = 0; i < 60 && !/Mission outcome/.test((document.querySelector(".modal") || {}).textContent || ""); i++) {
          await new Promise(r => setTimeout(r, 50));
        }
        const lifecycle = document.querySelector(".modal");
        const chained = !!lifecycle && /Mission outcome/.test(lifecycle.textContent);
        if (chained) {
          [...lifecycle.querySelectorAll(".modal-foot .btn")].find(b => /End Mission/.test(b.textContent)).click();
        }
        await p;
        await new Promise(r => setTimeout(r, 250));
        (await import("./src/ui.js")).closeAllModals();
        await new Promise(r => setTimeout(r, 100));

        location.hash = "#/home"; await new Promise(r => setTimeout(r, 100));
        location.hash = "#/solo"; await new Promise(r => setTimeout(r, 250));
        const after = Store.getAdventure(adv.id);
        const screen = document.getElementById("screen").textContent;
        const primary = [...document.querySelectorAll("#screen .solo-primary")].map(b => b.textContent);
        const ch = Store.getCharacter(c.id);
        Store.deleteAdventure(adv.id);
        return {
          offered, warns, handoff, chained,
          completed: !!after.completedAt, outcome: after.outcome,
          journalled: after.journal.some(j => /Mission ended/.test(j.text)),
          undo: !!Store.peekSoloUndo(),
          banner: /Mission success/i.test(screen), primary,
          xpGained: ch.xp.total - xpBefore,
          missions: (ch.missions || 0) - missionsBefore
        };
      });
      t.ok(mission.offered, "between scenes the Solo screen offers to end the mission");
      t.ok(mission.warns, "and says what is still open before it closes");
      t.ok(mission.handoff, "the dialog says it fires Classified's End Mission too");
      t.ok(mission.chained, "which it does, rather than leaving the player to find it on another screen");
      t.ok(mission.completed, "the adventure is closed");
      t.eq(mission.outcome, "success", "with the outcome it ended on");
      t.ok(mission.journalled, "the journal records the ending");
      t.ok(mission.undo, "and it is undoable once, like any other boundary");
      t.ok(mission.banner, "a closed mission says so instead of offering another scene");
      t.deep(mission.primary, ["Start a new adventure"], "and its primary action is the next adventure");
      t.ok(mission.xpGained > 0, `experience is awarded for the mission (${mission.xpGained})`);
      t.eq(mission.missions, 1, "and the dossier's mission count moves");

      // A stat block that cannot reach the tracker is one you retype.
      const toCombat = await page.evaluate(async () => {
        const Store = await import("./src/store.js");
        const { addNpcToEncounter } = await import("./src/combat.js");
        Store.clearCombat();
        const npc = { name: "Cormorant — ruthless spymaster", speed: 2, attrs: { str: 8 }, points: 11 };
        addNpcToEncounter(npc);
        const s = Store.combatState();
        return {
          active: s.active,
          names: s.combatants.map(x => x.name),
          carriesBlock: s.combatants.some(x => x.npc && x.npc.points === 11)
        };
      });
      t.ok(toCombat.active, "sending an NPC to combat starts an encounter if none is running");
      t.ok(toCombat.names.includes("Cormorant — ruthless spymaster"), "with the opponent in it");
      t.ok(toCombat.names.length >= 2, "alongside the open dossier");
      t.ok(toCombat.carriesBlock, "carrying its whole stat block, not just a name");

      // Fate answers what is true; what the character attempts is a Classified check.
      const check = await page.evaluate(async () => {
        const Store = await import("./src/store.js");
        (await import("./src/ui.js")).closeAllModals();
        await new Promise(r => setTimeout(r, 150));
        const c = Store.activeCharacter();
        const adv = Store.createAdventure({ name: "Check test", characterId: c.id });
        Store.updateAdventure(a => { a.scenePhase = "play"; });
        location.hash = "#/home"; await new Promise(r => setTimeout(r, 100));
        location.hash = "#/solo"; await new Promise(r => setTimeout(r, 250));
        const labels = [...document.querySelectorAll("#screen .btn")].map(b => b.textContent);
        const btn = [...document.querySelectorAll("#screen .btn")].find(b => b.textContent === "Roll a skill");
        btn.click();
        for (let i = 0; i < 40 && !document.querySelector(".modal"); i++) await new Promise(r => setTimeout(r, 50));
        const opened = (document.querySelector(".modal") || {}).textContent || "";
        (await import("./src/ui.js")).closeAllModals();
        await new Promise(r => setTimeout(r, 100));

        Store.updateAdventure(a => { a.characterId = null; });
        location.hash = "#/home"; await new Promise(r => setTimeout(r, 100));
        location.hash = "#/solo"; await new Promise(r => setTimeout(r, 250));
        const unlinked = [...document.querySelectorAll("#screen .btn")].map(b => b.textContent);
        Store.deleteAdventure(adv.id);
        return {
          offered: labels.includes("Roll a skill") && labels.includes("Attack") && labels.includes("Take damage"),
          opened: opened.length > 0,
          hiddenWhenUnlinked: !unlinked.includes("Roll a skill")
        };
      });
      t.ok(check.offered, "a scene in play offers the Classified checks beside the oracle");
      t.ok(check.opened, "and the roller opens on the linked dossier without leaving the screen");
      t.ok(check.hiddenWhenUnlinked, "with no dossier linked there is nothing to roll, so it is not offered");

      // The briefing can roll whether the mission hides anything at all.
      const hidden = await page.evaluate(async () => {
        const S = await import("./data-solo.js");
        const rolls = [1, 45, 60, 80, 95].map(r => S.hiddenTruth(r));
        return {
          none: rolls[0].subject,
          subjects: rolls.slice(1).map(r => r.subject),
          row: S.BRIEFING_ROWS.some(r => r.key === "hidden")
        };
      });
      t.eq(hidden.none, null, "a low Hidden truth roll means the mission is what it says");
      t.deep(hidden.subjects, ["objective", "complication", "opponent", "intel"],
        "and the rest hang the mystery on a real part of the briefing");
      t.ok(hidden.row, "the briefing carries the row that rolls it");

      // An Exceptional Fate answer marks a clue on the one open mystery.
      const lead = await page.evaluate(async () => {
        const Store = await import("./src/store.js");
        const Solo = await import("./src/solo.js");
        const clearModals = async () => {
          for (let i = 0; i < 8 && document.querySelector(".modal"); i++) {
            const m = document.querySelector(".modal");
            const x = m.querySelector(".modal-head .icon-btn");
            if (x) x.click();
            else { const btn = [...m.querySelectorAll(".modal-foot .btn")].pop(); if (btn) btn.click(); else break; }
            await new Promise(r => setTimeout(r, 40));
          }
        };
        Store.updateAdventure(a => {
          a.chaos = 9;
          a.mysteries = [{
            id: "mys_lead", subject: "thread", label: "The second mystery",
            sourceId: "t_mys", clues: 0, createdAt: Date.now(), revealedAt: null, reveal: null
          }];
        });
        for (let i = 0; i < 40; i++) {
          await clearModals();
          const before = Store.activeAdventure().mysteries.find(m => m.id === "mys_lead");
          if (!before) break;
          await Solo.askFate(Store.activeAdventure(), "certain", "probe");
          const banner = /a lead on/i.test((document.querySelector(".modal") || {}).textContent || "");
          await clearModals();
          const after = Store.activeAdventure().mysteries.find(m => m.id === "mys_lead");
          if (!after) return { marked: true, banner, tries: i + 1 };
          if (after.clues > before.clues || after.revealedAt) return { marked: true, banner, tries: i + 1 };
        }
        return { marked: false };
      });
      t.ok(lead.marked, `an Exceptional Fate answer marks a clue on the open mystery (after ${lead.tries} asks)`);
      t.ok(lead.banner, "and says so in the result");

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

      // The Advancement screen renders for a real character — it reached for a table that
      // rules.js does not re-export, and only the empty-state guard hid it.
      const advance = await page.evaluate(async () => {
        location.hash = "#/advance";
        await new Promise(r => setTimeout(r, 250));
        const text = document.getElementById("screen").textContent;
        return { failed: text.includes("failed to load"), band: /band/.test(text), raises: document.querySelectorAll("#screen .btn").length };
      });
      t.ok(!advance.failed, "the Advancement screen renders with a character open");
      t.ok(advance.band, "including the Reputation band");
      t.ok(advance.raises > 0, "and its raise buttons");

      // How-to panels: on every screen, closed, and gone when the toggle is off.
      const help = await page.evaluate(async () => {
        const out = { screens: {}, soloPanels: 0, openByDefault: 0 };
        for (const route of ["home", "create", "sheet", "gear", "combat", "advance", "rules", "log", "gm", "solo", "settings"]) {
          location.hash = "#/" + route;
          await new Promise(r => setTimeout(r, 200));
          const accs = [...document.querySelectorAll("details.help-acc")];
          out.screens[route] = accs.length;
          out.openByDefault += accs.filter(a => a.open).length;
          if (route === "solo") out.soloPanels = accs.length;
        }
        return out;
      });
      for (const [route, n] of Object.entries(help.screens)) {
        if (!n) { t.fail(`${route} carries a how-to panel`); }
      }
      t.pass("every screen carries a how-to panel");
      t.eq(help.openByDefault, 0, "and every one of them starts closed");
      t.ok(help.soloPanels >= 6, `the Solo screen carries one per panel (${help.soloPanels})`);

      const helpContent = await page.evaluate(async () => {
        location.hash = "#/solo";
        await new Promise(r => setTimeout(r, 220));
        const acc = [...document.querySelectorAll("details.help-acc")]
          .find(a => /How to use Ask Fate/.test(a.querySelector("summary").textContent));
        acc.open = true;
        return { steps: acc.querySelectorAll(".help-steps li").length, text: acc.textContent };
      });
      t.ok(helpContent.steps >= 3, "opening one shows numbered steps");
      t.ok(/Exceptional/.test(helpContent.text), "and the note explaining the rule behind the panel");

      const helpOff = await page.evaluate(async () => {
        const S = await import("./src/settings.js");
        S.set("showHelp", false);
        const counts = {};
        for (const route of ["home", "sheet", "solo"]) {
          location.hash = "#/" + route;
          await new Promise(r => setTimeout(r, 200));
          counts[route] = document.querySelectorAll("details.help-acc").length;
        }
        S.set("showHelp", true);
        return counts;
      });
      t.deep(helpOff, { home: 0, sheet: 0, solo: 0 }, "the Settings toggle removes them everywhere");

      // The tutorial: a screen of its own, reachable without a nav tab.
      const tutorial = await page.evaluate(async () => {
        location.hash = "#/tutorial";
        await new Promise(r => setTimeout(r, 250));
        const screen = document.getElementById("screen");
        return {
          steps: screen.querySelectorAll(".tut-step").length,
          numbered: [...screen.querySelectorAll(".tut-n")].map(n => n.textContent),
          taps: screen.querySelectorAll(".tut-tap").length,
          title: screen.textContent.includes("Running a solo mission"),
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          fromHome: (() => { location.hash = "#/home"; return true; })()
        };
      });
      t.ok(tutorial.title, "the tutorial screen renders its walkthrough");
      t.ok(tutorial.steps >= 8, `with a card per step (${tutorial.steps})`);
      t.deep(tutorial.numbered, tutorial.numbered.map((_, i) => String(i + 1)), "numbered in order");
      t.ok(tutorial.taps > 0, "and the taps each step needs");
      t.ok(tutorial.overflow <= 1, "the tutorial does not overflow at this width");

      const homeTile = await page.evaluate(async () => {
        location.hash = "#/home";
        await new Promise(r => setTimeout(r, 220));
        return [...document.querySelectorAll(".opt-btn")].some(b => /Tutorial/.test(b.textContent));
      });
      t.ok(homeTile, "Home carries a tile that opens it");

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

      // Wiping data: each button names its count, and neither wipe touches the other's data.
      const wipe = await page.evaluate(async () => {
        const Store = await import("./src/store.js");
        if (!Store.soloAdventures().length) Store.createAdventure({ name: "Wipe me" });
        // Force a fresh render: the counts on the wipe buttons are read when the screen is
        // drawn, and setting the hash it is already on would not redraw it.
        location.hash = "#/home";
        await new Promise(r => setTimeout(r, 140));
        location.hash = "#/settings";
        await new Promise(r => setTimeout(r, 240));
        const labels = () => [...document.querySelectorAll("#screen .btn.danger")].map(b => b.textContent);
        const before = { labels: labels(), chars: Store.allCharacters().length, missions: Store.soloAdventures().length };

        // Wipe the missions, confirm, and check the dossiers survived.
        [...document.querySelectorAll("#screen .btn.danger")].find(b => /Wipe all missions/.test(b.textContent)).click();
        await new Promise(r => setTimeout(r, 80));
        const dialog = (document.querySelector(".modal") || {}).textContent || "";
        [...document.querySelectorAll(".modal-foot .btn")].find(b => /Delete/.test(b.textContent)).click();
        await new Promise(r => setTimeout(r, 220));
        const afterMissions = {
          missions: Store.soloAdventures().length,
          chars: Store.allCharacters().length,
          active: localStorage.getItem("classified.soloActive"),
          undo: localStorage.getItem("classified.soloUndo")
        };

        // Now the characters.
        [...document.querySelectorAll("#screen .btn.danger")].find(b => /Wipe all characters/.test(b.textContent)).click();
        await new Promise(r => setTimeout(r, 80));
        [...document.querySelectorAll(".modal-foot .btn")].find(b => /Delete/.test(b.textContent)).click();
        await new Promise(r => setTimeout(r, 220));
        const afterChars = {
          chars: Store.allCharacters().length,
          activeChar: localStorage.getItem("classified.activeCharacter"),
          rolls: Store.rollLog().length,
          labels: labels()
        };
        return { before, dialog, afterMissions, afterChars };
      });
      t.ok(wipe.before.labels.some(l => /Wipe all missions \(\d+\)/.test(l)), "Settings offers a mission wipe with a count");
      t.ok(wipe.before.labels.some(l => /Wipe all characters \(\d+\)/.test(l)), "and a character wipe with a count");
      t.ok(/not touched/.test(wipe.dialog), "the confirmation says what it will not touch");
      t.eq(wipe.afterMissions.missions, 0, "wiping missions removes every adventure");
      t.eq(wipe.afterMissions.active, null, "and the active-adventure pointer");
      t.eq(wipe.afterMissions.undo, null, "and the solo undo snapshot");
      t.eq(wipe.afterMissions.chars, wipe.before.chars, "and leaves the dossiers alone");
      t.eq(wipe.afterChars.chars, 0, "wiping characters removes every dossier");
      t.eq(wipe.afterChars.activeChar, null, "and the active-character pointer");
      t.ok(wipe.afterChars.rolls > 0, "and leaves the roll log alone");
      t.ok(wipe.afterChars.labels.includes("No missions") && wipe.afterChars.labels.includes("No characters"),
        "with nothing left, both buttons say so and disable");

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
