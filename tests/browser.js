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

      // Every screen puts its prop on the header's folder label, and the label still says its name.
      const headerArt = [];
      for (const r of ["home", "sheet", "gear", "advance", "log", "combat", "rules", "settings", "gm", "solo", "play", "tutorial", "create"]) {
        await page.evaluate(x => { location.hash = "#/" + x; }, r);
        await page.waitForTimeout(100);
        if (!(await page.evaluate(() => !!document.querySelector("#headerArt svg.art") &&
          document.getElementById("headerTitle").textContent.trim().length > 0))) headerArt.push(r);
      }
      t.ok(!headerArt.length, "every screen's header label carries its line-art prop beside its name" + (headerArt.length ? ` (missing: ${headerArt.join(", ")})` : ""));

      // The tutorial's tap lines are the way there: each is a button that leaves the tutorial.
      await page.evaluate(() => { location.hash = "#/tutorial"; });
      await page.waitForTimeout(200);
      const taps = await page.evaluate(async () => {
        const btns = [...document.querySelectorAll("#screen button.tut-tap.is-link")];
        const n = btns.length;
        const create = btns.find(b => /^Create/.test(b.textContent));
        create?.click();
        await new Promise(r => setTimeout(r, 250));
        return { n, toCreate: location.hash === "#/create" };
      });
      t.ok(taps.n >= 8 && taps.toCreate, `every tutorial tap line is a link, and the Create one opens Create (${taps.n} links)`);

      // Folders: the dossier's four screens and the library's three share a divider strip,
      // and the bottom tab that owns the folder stays lit on each of them.
      const folders = {};
      for (const r of ["sheet", "gear", "advance", "log", "rules", "play", "tutorial", "home", "combat"]) {
        await page.evaluate(x => { location.hash = "#/" + x; }, r);
        await page.waitForTimeout(140);
        folders[r] = await page.evaluate(() => {
          const bar = document.getElementById("subNav");
          return {
            shown: !bar.hidden,
            tabs: [...bar.querySelectorAll(".sub-tab[data-route]")].map(b => b.dataset.route),
            current: (bar.querySelector('.sub-tab[aria-current="page"]') || {}).dataset?.route || null,
            lit: (document.querySelector('.nav-btn[aria-current="location"]') || {}).dataset?.route || null,
            glossary: [...bar.querySelectorAll(".sub-tab.is-action")].some(b => /Glossary/.test(b.textContent)),
            whole: (() => {
              const on = bar.querySelector('.sub-tab[aria-current="page"]');
              if (!on) return true;
              const a = on.getBoundingClientRect(), b = bar.querySelector(".sub-nav-strip").getBoundingClientRect();
              return a.left >= b.left - 1 && a.right <= b.right + 1;
            })()
          };
        });
      }
      t.ok(["sheet", "gear", "advance", "log"].every(r => folders[r].shown && folders[r].current === r &&
        folders[r].tabs.join() === "sheet,gear,advance,log"), "Sheet, Gear, Advancement and the log share one divider strip, each marked current in turn");
      t.ok(["gear", "advance", "log"].every(r => folders[r].lit === "sheet"), "and the Sheet tab stays lit on the three that have no tab of their own");
      t.ok(["rules", "play", "tutorial"].every(r => folders[r].shown && folders[r].tabs.join() === "rules,play,tutorial" && folders[r].glossary),
        "Rules, How to play and the Tutorial share a Library strip that also opens the Glossary");
      t.ok(!folders.home.shown && !folders.combat.shown, "screens outside a folder carry no strip");
      await page.waitForTimeout(50);
      t.ok(Object.values(folders).every(f => f.whole), "the current divider tab is always shown whole, never cut at the strip's edge");

      // The briefing desk: the agent card opens the sheet, and a running encounter puts a card
      // on the desk that opens Combat.
      const desk = await page.evaluate(async () => {
        const Store = await import("./src/store.js");
        const created = Store.activeCharacter() ? null : Store.createCharacter("agent");
        if (created) Store.setActive(created.id);
        const hadFight = Store.combatState().active;
        location.hash = "#/home";
        await new Promise(r => setTimeout(r, 200));
        const out = { agent: !!document.querySelector(".desk .agent-card .wound-track"),
          open: !!document.querySelector(".desk .agent-card button.desk-open") };
        document.querySelector(".desk .agent-card .desk-open").click();
        await new Promise(r => setTimeout(r, 200));
        out.toSheet = location.hash === "#/sheet";
        out.combatCard = hadFight === !!document.querySelector(".desk .combat-card");
        location.hash = "#/home";
        await new Promise(r => setTimeout(r, 150));
        out.combatCard = hadFight === !!document.querySelector(".desk .combat-card");
        // The sheet's meters are pictures of the printed numbers, so each must agree with its
        // number: a characteristic's bar is its share of 15, a Base Chance box its share of 30.
        location.hash = "#/sheet";
        await new Promise(r => setTimeout(r, 250));
        out.meters = [...document.querySelectorAll(".grid-5 .stat-box")].every(b => {
          const v = Number(b.querySelector(".v").textContent);
          const w = parseFloat(b.querySelector(".meter-fill").style.width);
          return Math.abs(w - v / 15 * 100) < 0.2;
        });
        const boxes = [...document.querySelectorAll(".skill-row .b")].filter(b => /^\d+$/.test(b.textContent));
        out.fills = boxes.length > 0 && boxes.every(b => {
          const f = parseFloat(b.style.getPropertyValue("--fill"));
          return Math.abs(f - Math.round(Math.min(1, Number(b.textContent) / 30) * 100)) < 1;
        });
        out.track = !!document.querySelector(".dossier-head .wound-track");
        // The GM's party peek opens the dossier it summarises.
        location.hash = "#/gm";
        await new Promise(r => setTimeout(r, 250));
        document.querySelector("#screen .card.flush .skill-row")?.click();
        await new Promise(r => setTimeout(r, 250));
        [...document.querySelectorAll(".modal-foot .btn")].find(b => b.textContent.trim() === "Open")?.click();
        await new Promise(r => setTimeout(r, 250));
        out.peekOpens = location.hash === "#/sheet";
        // The initiative rail puts every combatant on its own Speed lane and points the way the
        // phase runs; the chase dialog lights exactly the ranges its manoeuvre is legal at.
        const savedFight = JSON.parse(JSON.stringify(Store.combatState()));
        Store.saveCombat({ active: true, round: 1, phase: "declaration", combatants: [
          { id: "r0", name: "Slow", speed: 0, tiebreak: 1, wound: "none" },
          { id: "r2", name: "Mid", speed: 2, tiebreak: 2, wound: "none" },
          { id: "r3", name: "Fast", speed: 3, tiebreak: 3, wound: "none", acted: true }] });
        location.hash = "#/home"; await new Promise(r => setTimeout(r, 120));
        location.hash = "#/combat"; await new Promise(r => setTimeout(r, 250));
        const lanes = [...document.querySelectorAll(".init-rail .ir-lane")];
        out.rail = lanes.length === 4 &&
          lanes[0].textContent.includes("Slow") && lanes[2].textContent.includes("Mid") && lanes[3].textContent.includes("Fast") &&
          !lanes[1].querySelector(".ir-token") && !!document.querySelector(".init-rail.is-declaration") &&
          !!lanes[3].querySelector(".ir-token.is-acted");
        const D = await import("./data.js");
        const roller = await import("./src/roller.js");
        roller.openChaseManeuver(Store.activeCharacter());
        await new Promise(r => setTimeout(r, 250));
        const mv = D.CHASE_MANEUVERS.find(m => m.key === "follow");
        const lit = [...document.querySelectorAll(".modal .range-track .rt-step.on .rt-l")].map(x => x.textContent);
        out.ranges = lit.join() === mv.ranges.join();
        document.querySelectorAll(".modal-head .icon-btn").forEach(b => b.click());
        await new Promise(r => setTimeout(r, 120));
        if (savedFight.active) Store.saveCombat(savedFight); else Store.clearCombat();
        if (created) Store.deleteCharacter(created.id);
        return out;
      });
      t.ok(desk.agent && desk.open, "Home's agent card carries the wound track and a real Open button");
      t.ok(desk.toSheet, "and opening it lands on the sheet");
      t.ok(desk.combatCard, "a combat card is on the desk exactly when an encounter is running");
      t.ok(desk.meters, "every characteristic's bar is its value's share of 15");
      t.ok(desk.fills, "every Base Chance box is filled to its share of the cap of 30");
      t.ok(desk.track, "the dossier head carries the wound track");
      t.ok(desk.peekOpens, "the GM party peek opens the dossier it summarises");
      t.ok(desk.rail, "the initiative rail puts each combatant on its Speed lane, marks the acted, and runs the declaration way");
      t.ok(desk.ranges, "the chase dialog's range track lights exactly the ranges the manoeuvre is legal at");

      // Every Home tile carries an icon, and the icon adds no text to the tile's name.
      await page.evaluate(() => { location.hash = "#/home"; });
      await page.waitForTimeout(200);
      const tiles = await page.evaluate(() => [...document.querySelectorAll(".tile-grid .opt-btn")].map(b => ({
        svg: !!b.querySelector(".tile-ico svg"), name: b.querySelector(".on-name").textContent
      })));
      t.ok(tiles.length >= 8 && tiles.every(x => x.svg && x.name.trim().length), "every Home tile draws an icon beside its name");

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

      // The percentile dice, once landed, read as the roll: tens + units, with 100 as 00 + 0.
      await page.waitForTimeout(650);
      const faces = await page.evaluate(() => {
        const f = [...document.querySelectorAll(".modal .dice-faces .die-face b")].map(b => b.textContent);
        const roll = Number(document.querySelector(".modal .roll-d100").textContent);
        const val = f.length === 2 ? (f[0] === "00" && f[1] === "0" ? 100 : Number(f[0]) + Number(f[1])) : null;
        return { f, roll, val };
      });
      t.ok(faces.f.length === 2 && faces.val === faces.roll, `the two percentile dice land on the roll (${faces.f.join(" + ")} = ${faces.roll})`);

      // The d100 track is a picture of the bands, so it has to agree with them: the pin sits at
      // the roll, and the segment under the pin is the quality the result names.
      const track = await page.evaluate(() => {
        const tr = document.querySelector(".modal .d100-track");
        const pin = tr && tr.querySelector(".pin");
        if (!tr || !pin) return null;
        const roll = Number(document.querySelector(".roll-d100").textContent);
        const q = (document.querySelector(".roll-quality").className.match(/q(\d)/) || [])[1];
        const box = tr.getBoundingClientRect();
        const x = pin.getBoundingClientRect().left + pin.getBoundingClientRect().width / 2;
        const under = [...tr.querySelectorAll(".seg")].find(sg => {
          const r = sg.getBoundingClientRect(); return x >= r.left - 1 && x <= r.right + 1;
        });
        return { roll, q, pct: (x - box.left) / box.width * 100, under: under && (under.className.match(/q(\d)/) || [])[1] };
      });
      t.ok(track && Math.abs(track.pct - track.roll) <= 2, "the result's d100 track pins the roll at its place on 1–100" +
        (track ? ` (roll ${track.roll}, pin ${track.pct.toFixed(1)}%)` : ""));
      t.ok(track && (track.under === track.q || Math.abs(track.pct - track.roll) <= 2 && track.roll >= 100),
        "and the band under the pin is the Success Quality the result names");

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
          primary: [...document.querySelectorAll("#screen .solo-primary")].map(b => b.textContent),
          gauge: [...document.querySelectorAll("#screen .chaos-gauge span")].map(x => x.classList.contains("on")),
          chaos: adv && adv.chaos,
          // The bar first, then the loop column, then the record: a desk reads in play order.
          order: (() => {
            const bar = document.querySelector("#screen > .solo-bar");
            const a = document.querySelector("#screen > .col-a"), b = document.querySelector("#screen > .col-b");
            return !!(bar && a && b && bar.compareDocumentPosition(a) & Node.DOCUMENT_POSITION_FOLLOWING &&
              a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING &&
              bar.querySelector(".solo-primary") && b.textContent.includes("Threads"));
          })()
        };
      });
      // Cross-links from the Solo screen: the linked dossier's name leads to its sheet, and
      // the reference list carries the Rules library whose tab Solo has taken.
      const soloLinks = await page.evaluate(async () => {
        const out = { name: !!document.querySelector("#screen .solo-header .link-btn"),
          rules: [...document.querySelectorAll("#screen .skill-row")].some(b => b.textContent.trim() === "Rules") };
        document.querySelector("#screen .solo-header .link-btn")?.click();
        await new Promise(r => setTimeout(r, 300));
        out.toSheet = location.hash === "#/sheet";
        // The derived Speed box opens the Speed panel; Carry leads to Gear.
        const speed = [...document.querySelectorAll("#screen button.stat-box")].find(b => /Speed/i.test(b.querySelector(".k").textContent));
        speed?.click();
        await new Promise(r => setTimeout(r, 250));
        out.speedPanel = !!document.querySelector(".modal");
        document.querySelectorAll(".modal-head .icon-btn").forEach(b => b.click());
        await new Promise(r => setTimeout(r, 150));
        const carry = [...document.querySelectorAll("#screen button.stat-box")].find(b => /Carry/i.test(b.querySelector(".k").textContent));
        carry?.click();
        await new Promise(r => setTimeout(r, 250));
        out.toGear = location.hash === "#/gear";
        location.hash = "#/solo";
        await new Promise(r => setTimeout(r, 300));
        return out;
      });
      // One control per step: on Solo the coach never repeats the primary action's boundary.
      const dup = await page.evaluate(async () => {
        const S = await import("./src/settings.js");
        const Store = await import("./src/store.js");
        S.set("showHelp", true);
        const before = JSON.parse(JSON.stringify(Store.activeAdventure()));
        const out = {};
        for (const phase of ["setup", "play"]) {
          Store.updateAdventure(a => { a.scenePhase = phase; if (!a.briefing) a.briefing = { rows: {}, seededIds: [], writtenAt: Date.now() }; });
          location.hash = "#/home"; await new Promise(r => setTimeout(r, 100));
          location.hash = "#/solo"; await new Promise(r => setTimeout(r, 450));
          const coach = document.querySelector("#screen .coach");
          out[phase] = {
            coach: !!coach,
            coachBoundary: coach ? [...coach.querySelectorAll("button")].some(b => /start scene|end scene|go$|write|roll my mission/i.test(b.textContent.trim())) : false,
            primaries: document.querySelectorAll("#screen .solo-primary").length
          };
        }
        Store.updateAdventure(a => { a.scenePhase = before.scenePhase; a.briefing = before.briefing; });
        location.hash = "#/home"; await new Promise(r => setTimeout(r, 100));
        location.hash = "#/solo"; await new Promise(r => setTimeout(r, 300));
        return out;
      });
      t.ok(!dup.setup.coach && dup.setup.primaries === 1, "between scenes Solo carries one Start-scene control, not the coach's copy of it");
      t.ok(dup.play.coach && !dup.play.coachBoundary && dup.play.primaries === 1,
        "in a scene the coach offers its three choices and leaves End scene to the primary action");

      // Four pages on a phone under one sticky bar; every page at once on a desk (S26).
      const pagesProbe = async () => page.evaluate(async () => {
        location.hash = "#/home"; await new Promise(r => setTimeout(r, 100));
        location.hash = "#/solo"; await new Promise(r => setTimeout(r, 350));
        const shown = () => [...document.querySelectorAll("#screen .solo-page")]
          .filter(p => getComputedStyle(p).display !== "none").map(p => p.dataset.page);
        const out = {
          pages: [...document.querySelectorAll("#screen .solo-page")].map(p => p.dataset.page),
          tabs: [...document.querySelectorAll("#screen .solo-tab")].filter(t => getComputedStyle(t).display !== "none").map(t => t.textContent.trim()),
          tabsShown: getComputedStyle(document.querySelector("#screen .solo-tabs")).display !== "none",
          sticky: getComputedStyle(document.querySelector("#screen .solo-bar")).position,
          primaryInBar: document.querySelectorAll("#screen .solo-bar .solo-primary").length,
          primaries: document.querySelectorAll("#screen .solo-primary").length,
          before: shown(), helpBars: document.querySelectorAll("#screen details.help-acc").length,
          marks: document.querySelectorAll("#screen .section-head .help-q").length,
          // One row: every reading and the button share a line, however long the label.
          rows: new Set([...document.querySelectorAll("#screen .solo-status > *")]
            .map(n => { const r = n.getBoundingClientRect(); return Math.round((r.top + r.bottom) / 2 / 16); })).size,
          clockWords: /\bclock\b|last segment/i.test(document.getElementById("screen").textContent)
        };
        document.querySelector('#screen .solo-tab[data-page="oracle"]').click();
        await new Promise(r => setTimeout(r, 80));
        out.afterOracle = shown();
        out.selected = document.querySelector('#screen .solo-tab[aria-selected="true"]')?.dataset.page;
        out.fateOnOracle = !!document.querySelector('#screen .solo-page[data-page="oracle"]').textContent.match(/Ask Fate/);
        location.hash = "#/home"; await new Promise(r => setTimeout(r, 100));
        location.hash = "#/solo"; await new Promise(r => setTimeout(r, 350));
        out.remembered = shown();
        document.querySelector('#screen .solo-tab[data-page="scene"]').click();
        await new Promise(r => setTimeout(r, 60));
        return out;
      });
      const phone = await pagesProbe();
      t.deep(phone.pages, ["scene", "oracle", "lists", "journal"], "Solo is four pages: Scene, Oracle, Lists, Journal");
      if (vp.width < 900) {
        t.deep(phone.tabs, ["Scene", "Oracle", "Lists", "Journal"], "with a tab for each on a phone");
        t.deep(phone.before, ["scene"], "and only the current page showing");
        t.deep(phone.afterOracle, ["oracle"], "a tab opens its page and hides the rest");
        t.eq(phone.selected, "oracle", "and is marked selected");
        t.deep(phone.remembered, ["oracle"], "the page survives a trip to another screen");
      }
      t.ok(phone.fateOnOracle, "Ask Fate lives on the Oracle page");
      t.eq(phone.sticky, "sticky", "the status bar is sticky over every page");
      t.ok(phone.primaryInBar === 1 && phone.primaries === 1, "and carries the one primary action");
      t.eq(phone.rows, 1, "the bar's readings and primary action sit on one row");
      t.ok(!phone.clockWords, "nothing on Solo still describes a mystery as a clock (S21)");
      t.eq(phone.helpBars, 0, "no how-to bars on Solo");
      t.ok(phone.marks >= 6, `the how-to copy is a ? on each heading instead (${phone.marks})`);
      await page.setViewportSize({ width: 1280, height: 900 });
      const wide = await pagesProbe();
      t.ok(!wide.tabsShown && wide.before.length === 4, "on a desk the tabs go and all four pages show");
      await page.setViewportSize({ width: vp.width, height: vp.height });

      t.ok(soloLinks.name && soloLinks.toSheet, "the Solo header's linked dossier name opens that dossier's sheet");
      t.ok(soloLinks.rules, "the Solo reference carries the Rules library, whose tab Solo has taken");
      t.ok(soloLinks.speedPanel && soloLinks.toGear, "the sheet's derived Speed opens its panel and Carry opens Gear");
      t.ok(startFlow.gauge.length === 9 && startFlow.gauge.filter(Boolean).length === startFlow.chaos,
        "the Chaos gauge has nine cells and lights exactly the Chaos Factor");
      t.ok(startFlow.order, "the solo loop sits before the lists and journal, so a phone reads it in play order");
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
        // The setting arrives pre-rolled: a city and three lines, each filled, under a caption.
        const lines = [...document.querySelectorAll(".modal .setting-line input")].map(i => i.value);
        const cityBefore = lines[0];
        const travel = [...document.querySelectorAll(".modal .setting-line button")].find(b => b.textContent === "Travel");
        let travelled = cityBefore;
        for (let i = 0; i < 6 && travelled === cityBefore; i++) {
          travel.click(); await new Promise(r => setTimeout(r, 40));
          travelled = document.querySelector(".modal .setting-line input").value;
        }
        const settingSeen = {
          filled: lines.length === 4 && lines.every(v => v.trim().length > 0),
          caption: (document.querySelector(".modal .scene-caption") || {}).textContent || "",
          travelled
        };
        document.querySelector(".modal input.scene-expect").value = "Meet the courier";
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
        out.settingSeen = settingSeen;
        out.sceneSetting = adv.sceneSetting;
        out.city = adv.city;
        return { ...out, phase: adv.scenePhase, expected: adv.sceneExpected,
          journalText: adv.journal.map(j => j.text + " " + (j.detail || "")).join(" | ") };
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
      t.ok(started.settingSeen.filled, "Start scene opens with the setting already rolled: city, place, time and weather, a detail");
      t.ok(started.settingSeen.caption.includes(started.settingSeen.travelled.toUpperCase()),
        `and the location card names the city in capitals (${started.settingSeen.caption})`);
      t.ok(started.sceneSetting && started.sceneSetting.city === started.settingSeen.travelled && started.city === started.settingSeen.travelled,
        "Travel moves the scene to a new city, and the adventure goes with it");
      t.ok(started.journalText.includes(started.settingSeen.travelled.toUpperCase()), "the journal carries the scene's location card");
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
      t.eq(briefed.filledBefore, 9, "Roll all fills every briefing row in one tap, the city included");
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
      t.eq(briefed.pinnedRows.length, 9, "the pinned briefing lists every row");
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

      // The play guide: the one screen that answers "what do I do next in my own game".
      const guide = await page.evaluate(async () => {
        const Store = await import("./src/store.js");
        const S = await import("./src/settings.js");
        (await import("./src/ui.js")).closeAllModals();
        await new Promise(r => setTimeout(r, 150));

        const go = async h => {
          location.hash = "#/home"; await new Promise(r => setTimeout(r, 90));
          location.hash = "#/" + h; await new Promise(r => setTimeout(r, 260));
          return document.getElementById("screen");
        };
        const nextStep = el => {
          const card = el.querySelector(".next-step");
          return card ? card.querySelector("b, div[style*='font-weight']").textContent : null;
        };

        // With solo off the guide is the table game, and ends where the referee says.
        S.set("solo", false);
        let screen = await go("play");
        const table = {
          track: screen.textContent.includes("Playing with a group"),
          next: nextStep(screen),
          loop: screen.textContent.includes("Roll what you attempt"),
          endsAtCombat: screen.textContent.includes("Combat → End Mission")
        };

        // With solo on it is the solo game, and it knows a dossier exists.
        S.set("solo", true);
        screen = await go("play");
        const solo = {
          track: screen.textContent.includes("Playing alone"),
          ticks: screen.querySelectorAll(".guide-step.is-done").length,
          next: nextStep(screen),
          loop: screen.textContent.includes("Start the scene") && screen.textContent.includes("End the scene"),
          endsInSolo: screen.textContent.includes("Solo → End the mission"),
          acts: [...screen.querySelectorAll(".section-title")].map(x => x.textContent)
        };

        // And it moves on as the game does.
        const adv = Store.createAdventure({ name: "Guide run", characterId: Store.activeId() });
        screen = await go("play");
        const afterAdventure = nextStep(screen);
        Store.deleteAdventure(adv.id);
        return { table, solo, afterAdventure };
      });
      t.ok(guide.table.track, "with solo off the guide teaches the game you are set up for");
      t.ok(guide.table.loop, "carrying the loop a table game actually runs");
      t.ok(guide.table.endsAtCombat, "and ending where a refereed mission ends");
      t.ok(guide.solo.track, "with solo on it teaches the solo game instead");
      t.ok(guide.solo.loop, "whose loop is the scene boundary");
      t.ok(guide.solo.endsInSolo, "and whose ending is on the Solo screen");
      t.deep(guide.solo.acts, ["Start a game", "Keep it going", "End it well"],
        "in the three acts a game has");
      t.ok(guide.solo.ticks >= 1, "a step already done is ticked off rather than asked for again");
      t.ok(!!guide.solo.next, `and one step is pulled out as the thing to do next (${guide.solo.next})`);
      t.ok(guide.afterAdventure !== guide.solo.next,
        "which moves on as the game moves on, rather than being a fixed list");

      // A deleted dossier must not leave live-looking controls pointing at nothing.
      const orphans = await page.evaluate(async () => {
        const Store = await import("./src/store.js");
        (await import("./src/ui.js")).closeAllModals();
        await new Promise(r => setTimeout(r, 150));

        const keep = Store.activeId();
        const doomed = Store.createCharacter("agent");
        Store.updateActive(x => { x.identity.name = "Doomed"; });
        const adv = Store.createAdventure({ name: "Orphan run", characterId: doomed.id });
        Store.saveCombat({ active: true, round: 1, phase: "declaration", combatants: [
          { id: "cb_orphan", name: "Doomed", speed: 2, tiebreak: 5, wound: "none",
            acted: false, stunRounds: 0, npc: null, characterId: doomed.id }
        ]});

        Store.deleteCharacter(doomed.id);
        const combat = Store.combatState();
        const solo = Store.getAdventure(adv.id);

        Store.setActive(keep);
        location.hash = "#/home"; await new Promise(r => setTimeout(r, 100));
        location.hash = "#/combat"; await new Promise(r => setTimeout(r, 300));
        const labels = [...document.querySelectorAll("#screen .btn")].map(b => b.textContent);

        Store.deleteAdventure(adv.id);
        Store.clearCombat();
        return {
          stillThere: combat.combatants.length,
          detached: combat.combatants.every(x => !x.characterId),
          soloUnlinked: solo.characterId === null,
          offersAttackThis: labels.includes("Attack this"),
          noDeadAttack: !labels.includes("Attack")
        };
      });
      t.eq(orphans.stillThere, 1, "deleting a dossier leaves the body in the encounter");
      t.ok(orphans.detached, "but cuts the reference to the dossier that is gone");
      t.ok(orphans.soloUnlinked, "and unlinks the solo adventure that pointed at it");
      t.ok(orphans.noDeadAttack && orphans.offersAttackThis,
        "so the card offers the control that works instead of one that does nothing");

      // The garage: vehicles you own, what they are fitted with, and what a crash does.
      const garage = await page.evaluate(async () => {
        const Store = await import("./src/store.js");
        const D = await import("./data.js");
        (await import("./src/ui.js")).closeAllModals();
        await new Promise(r => setTimeout(r, 150));

        const stock = D.VEHICLES.find(v => v.mp >= 6);
        const armour = D.VEHICLE_MODS.find(m => m.key === "armor3");
        Store.updateActive(x => {
          x.vehicles = [{ id: "veh_test", key: stock.key, name: stock.name, mods: [], wound: "none", note: "" }];
        });
        location.hash = "#/home"; await new Promise(r => setTimeout(r, 100));
        location.hash = "#/gear"; await new Promise(r => setTimeout(r, 300));
        const listed = document.getElementById("screen").textContent.includes(stock.name);
        const budget = document.getElementById("screen").textContent.includes(`0 / ${stock.mp} MP`);

        // Fitting one spends Modification Points.
        Store.updateActive(x => { x.vehicles[0].mods = [armour.key]; });
        location.hash = "#/home"; await new Promise(r => setTimeout(r, 100));
        location.hash = "#/gear"; await new Promise(r => setTimeout(r, 300));
        const spent = document.getElementById("screen").textContent.includes(`${armour.mp} / ${stock.mp} MP`);
        const armourLine = /absorbs 1 Wound Rank/.test(document.getElementById("screen").textContent);

        const after = Store.activeCharacter().vehicles[0];
        Store.updateActive(x => { x.vehicles = []; });
        return { listed, budget, spent, armourLine, persisted: after.mods.length === 1, id: after.id };
      });
      t.ok(garage.listed, "a vehicle on the dossier is shown on the Gear screen");
      t.ok(garage.budget, "with its Modification Point budget");
      t.ok(garage.spent, "which a fitted modification spends");
      t.ok(garage.armourLine, "and armour says what it does to an incoming hit");
      t.ok(garage.persisted, "the fit survives a reload");
      t.eq(garage.id, "veh_test", "and the vehicle keeps its identity");

      // Building a bug: four parts, the surcharge, one item on the dossier.
      const bug = await page.evaluate(async () => {
        const Store = await import("./src/store.js");
        const D = await import("./data.js");
        (await import("./src/ui.js")).closeAllModals();
        await new Promise(r => setTimeout(r, 150));
        location.hash = "#/home"; await new Promise(r => setTimeout(r, 100));
        location.hash = "#/gear"; await new Promise(r => setTimeout(r, 300));

        const before = Store.activeCharacter().inventory.items.length;
        [...document.querySelectorAll("#screen .btn")].find(b => b.textContent === "Build one").click();
        for (let i = 0; i < 40 && !document.querySelector(".modal"); i++) await new Promise(r => setTimeout(r, 50));
        const dlg = document.querySelector(".modal");
        const steps = D.BUG_BUILD_STEPS.every(st => dlg.textContent.includes(st.name));
        const expected = Math.round(D.BUG_BUILD_STEPS
          .reduce((n, st) => n + (D.GEAR.find(g => g.key === st.keys[0]).price || 0), 0) * 1.1);
        const priced = dlg.textContent.includes("$" + expected.toLocaleString("en-US"));
        [...dlg.querySelectorAll(".modal-foot .btn")].find(b => /Add to the dossier/.test(b.textContent)).click();
        await new Promise(r => setTimeout(r, 250));

        const items = Store.activeCharacter().inventory.items;
        const made = items[items.length - 1];
        Store.updateActive(x => { x.inventory.items = x.inventory.items.filter(i => i.id !== made.id); });
        (await import("./src/ui.js")).closeAllModals();
        return {
          steps, priced, expected,
          added: items.length === before + 1,
          name: made.name, price: made.price
        };
      });
      t.ok(bug.steps, "the bug builder asks for a medium, a transmission, storage and power");
      t.ok(bug.priced, `and totals the parts with the assembly surcharge ($${bug.expected})`);
      t.ok(bug.added, "building one puts a single item on the dossier");
      t.ok(/^Bug: /.test(bug.name), `named for what it is made of (${bug.name})`);
      t.eq(bug.price, bug.expected, "at the price it quoted");

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
          // Solo carries its how-to copy as "?" marks on the headings rather than bars (S26).
          out.screens[route] = accs.length + (route === "solo" ? document.querySelectorAll("#screen .help-q").length : 0);
          out.openByDefault += accs.filter(a => a.open).length;
          if (route === "solo") out.soloPanels = document.querySelectorAll("#screen .help-q").length;
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
        document.querySelector('#screen .help-q[data-help="solo.fate"]').click();
        await new Promise(r => setTimeout(r, 120));
        const m = document.querySelector(".modal");
        const out = { steps: m.querySelectorAll(".help-steps li").length, text: m.textContent };
        m.querySelector(".modal-foot .btn")?.click();
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
        await new Promise(r => setTimeout(r, 120));
        return out;
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
          counts[route] = document.querySelectorAll("details.help-acc, #screen .help-q").length;
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

      /* ---- the newcomer sweep (N1–N10)
       * Someone who has read neither book and has never played solo. The wipe above left the
       * device with no dossier and no mission, which is the state they arrive in. */
      const newcomer = await page.evaluate(async () => {
        const SettingsMod = await import("./src/settings.js");
        const clearModals = async () => {
          for (let i = 0; i < 8 && document.querySelector(".modal"); i++) {
            const m = document.querySelector(".modal");
            const x = m.querySelector(".modal-head .icon-btn");
            if (x) x.click();
            else { const btn = [...m.querySelectorAll(".modal-foot .btn")].pop(); if (btn) btn.click(); else break; }
            await new Promise(r => setTimeout(r, 40));
          }
        };
        // Always through the router: setting a hash the page is already on renders nothing,
        // and half of this sweep re-visits the screen it is standing on.
        const router = await import("./src/router.js");
        const go = async route => {
          router.navigate(route);
          await new Promise(r => setTimeout(r, 240));
        };
        const screenText = () => document.getElementById("screen").textContent.replace(/\s+/g, " ").trim();
        const buttons = () => [...document.querySelectorAll("#screen button")].map(b => b.textContent.trim());

        const Store = await import("./src/store.js");
        const out = { screens: {} };

        // 1. No screen is a dead end with a dossier missing. The log is cleared first so its
        // own empty state is the one under test.
        Store.clearLog();
        for (const route of ["sheet", "gear", "advance", "log"]) {
          await go(route);
          out.screens[route] = {
            help: !!document.querySelector("#screen .help-acc"),
            bare: screenText() === "No character.",
            way: buttons().some(b => /Create a character|Roll something/.test(b)),
            len: screenText().length
          };
        }

        // 2. The first-run card, and Hide this.
        await go("home");
        const start = document.querySelector(".start-here");
        out.startHere = {
          shown: !!start,
          steps: start ? start.querySelectorAll(".card-row").length : 0,
          solo: start ? /solo/i.test(start.textContent) : false,
          guide: start ? /how to play/i.test(start.textContent) : false
        };
        [...document.querySelectorAll("#screen .start-here button")].find(b => /Hide this/.test(b.textContent)).click();
        await new Promise(r => setTimeout(r, 160));
        out.startHere.hidden = !document.querySelector(".start-here");
        await go("home");
        out.startHere.staysHidden = !document.querySelector(".start-here");
        SettingsMod.set("startHere", true);

        // 3. Solo is offered on Home even with the toggle off, and turning it on lands there.
        SettingsMod.set("solo", false);
        router.rebuildNav();
        await go("home");
        out.soloOff = {
          navHasSolo: [...document.querySelectorAll(".nav-btn .lbl")].some(x => x.textContent === "Solo"),
          tile: buttons().some(b => /Play solo/.test(b)),
          glossaryTile: buttons().some(b => /Glossary/.test(b))
        };
        [...document.querySelectorAll("#screen button")].find(b => /Play solo/.test(b.textContent)).click();
        await new Promise(r => setTimeout(r, 200));
        out.soloOffer = (document.querySelector(".modal") || {}).textContent || "";
        [...document.querySelectorAll(".modal button")].find(b => /Turn on solo play/.test(b.textContent)).click();
        await new Promise(r => setTimeout(r, 400));
        out.soloOn = {
          navHasSolo: [...document.querySelectorAll(".nav-btn .lbl")].some(x => x.textContent === "Solo"),
          route: location.hash,
          on: SettingsMod.get("solo")
        };
        await clearModals();

        // 4. The glossary, from the Rules library and from Solo.
        await go("rules");
        [...document.querySelectorAll("#screen button")].find(b => /^Glossary/.test(b.textContent)).click();
        await new Promise(r => setTimeout(r, 200));
        const gm = document.querySelector(".modal");
        out.glossary = {
          opened: !!gm,
          terms: gm ? gm.querySelectorAll(".card-row.col").length : 0,
          hasDF: gm ? /Difficulty Factor/.test(gm.textContent) : false,
          hasChaos: gm ? /Chaos Factor/.test(gm.textContent) : false,
          systems: gm ? [...gm.querySelectorAll(".section-title")].map(x => x.textContent) : []
        };
        const box = gm && gm.querySelector('input[type="search"]');
        if (box) { box.value = "wound"; box.dispatchEvent(new Event("input")); }
        await new Promise(r => setTimeout(r, 120));
        out.glossary.filtered = gm ? [...gm.querySelectorAll(".card-row.col b")].map(x => x.textContent) : [];
        await clearModals();

        // The rules search finds a term by its definition, not only its title.
        await go("rules");
        const search = document.querySelector("#screen input[type=search]");
        search.value = "difficulty factor";
        search.dispatchEvent(new Event("input"));
        await new Promise(r => setTimeout(r, 150));
        out.searchHits = [...document.querySelectorAll("#screen .skill-row .r")].map(x => x.textContent);

        await go("solo");
        out.soloGlossary = buttons().some(b => /Glossary/.test(b));

        // 5. A mission bundle with no dossier explains itself instead of reporting nothing.
        await go("combat");
        [...document.querySelectorAll("#screen button")].find(b => b.textContent.trim() === "End Mission").click();
        await new Promise(r => setTimeout(r, 220));
        const lm = document.querySelector(".modal");
        out.lifecycle = {
          text: lm ? lm.textContent.replace(/\s+/g, " ") : "",
          offersCreate: lm ? [...lm.querySelectorAll("button")].some(b => /Create a character/.test(b.textContent)) : false
        };
        await clearModals();

        // 6. An unlinked solo adventure offers the link rather than noting its absence.
        Store.createAdventure({ name: "Newcomer" });
        Store.updateAdventure(a => { a.characterId = null; });
        await go("solo");
        out.unlinked = buttons().some(b => b.trim() === "Link a dossier");
        [...document.querySelectorAll("#screen button")].find(b => b.textContent.trim() === "Link a dossier").click();
        await new Promise(r => setTimeout(r, 220));
        const dm = document.querySelector(".modal");
        out.linkOffer = {
          text: dm ? dm.textContent.replace(/\s+/g, " ") : "",
          offersCreate: dm ? [...dm.querySelectorAll("button")].some(b => /Create a character/.test(b.textContent)) : false
        };
        await clearModals();
        Store.wipeAdventures();

        // 7. An encounter with no dossier: it says why the round is empty, and the tracker's
        // own controls still work — Acted and ✕ run through a path nothing else exercises.
        Store.saveCombat({ active: false, round: 1, phase: "declaration", combatants: [] });
        await go("combat");
        [...document.querySelectorAll("#screen button")].find(b => b.textContent.trim() === "Start an encounter").click();
        await new Promise(r => setTimeout(r, 260));
        out.encounter = { toast: (document.querySelector(".toast") || {}).textContent || "" };
        const Combat = await import("./src/combat.js");
        Combat.addNpcToEncounter({ name: "Sentry", speed: 2 });
        await go("combat");
        out.encounter.combatants = Store.combatState().combatants.length;
        [...document.querySelectorAll("#screen button")].find(b => b.textContent.trim() === "Acted").click();
        await new Promise(r => setTimeout(r, 200));
        out.encounter.acted = Store.combatState().combatants.some(x => x.acted);
        [...document.querySelectorAll("#screen button")].find(b => b.textContent.trim() === "✕").click();
        await new Promise(r => setTimeout(r, 200));
        out.encounter.left = Store.combatState().combatants.length;
        Store.saveCombat({ active: false, round: 1, phase: "declaration", combatants: [] });

        await go("home");
        return out;
      });

      for (const route of ["sheet", "gear", "advance", "log"]) {
        const r = newcomer.screens[route];
        t.ok(!r.bare, `${route} with no dossier is not the bare words "No character."`);
        t.ok(r.way, `${route} offers the way out of its empty state`);
        t.ok(r.help, `${route} keeps its how-to panel when nothing is open`);
      }
      t.ok(newcomer.startHere.shown, "a fresh device opens on a first-run card");
      t.ok(newcomer.startHere.steps >= 3, "with a step for the dossier, learning the loop and solo play");
      t.ok(newcomer.startHere.solo && newcomer.startHere.guide,
        "and it points at solo play and the play guide by name");
      t.ok(newcomer.startHere.hidden && newcomer.startHere.staysHidden, "Hide this removes it, and it stays removed");
      t.ok(!newcomer.soloOff.navHasSolo, "with solo off there is no Solo tab, as before");
      t.ok(newcomer.soloOff.tile, "but Home still carries a Play solo tile, so it can be found at all");
      t.ok(newcomer.soloOff.glossaryTile, "and a Glossary tile beside it");
      t.ok(/Mythic Game Master Emulator/.test(newcomer.soloOffer), "the tile explains what solo play is before switching anything on");
      t.ok(newcomer.soloOn.on && newcomer.soloOn.navHasSolo, "Turn on solo play adds the tab");
      t.eq(newcomer.soloOn.route, "#/solo", "and lands on the screen it just created");
      t.ok(newcomer.glossary.opened, "the Rules library opens a glossary");
      t.ok(newcomer.glossary.terms >= 30, `covering every term on screen (${newcomer.glossary.terms})`);
      t.ok(newcomer.glossary.hasDF && newcomer.glossary.hasChaos, "including both systems' central jargon");
      t.ok(newcomer.glossary.systems.length >= 2, "grouped by which system the word belongs to");
      t.ok(newcomer.glossary.filtered.length > 0 && newcomer.glossary.filtered.every(x => /Wound|Damage|Pain|Hero|Mystery|Clue/i.test(x)),
        "and it filters as you type");
      t.ok(newcomer.searchHits.includes("Glossary"), "a rules search for a term returns its plain-English definition too");
      t.ok(newcomer.soloGlossary, "the Solo reference carries the same glossary");
      t.ok(/nothing for it to change/.test(newcomer.lifecycle.text), "End Mission with no dossier says so rather than reporting changes it did not make");
      t.ok(newcomer.lifecycle.offersCreate, "and offers to create one");
      t.ok(newcomer.unlinked, "an unlinked adventure shows Link a dossier as a control, not a note");
      t.ok(newcomer.linkOffer.offersCreate, "and with no dossiers at all it offers to make one");
      t.ok(/\+ Add/.test(newcomer.encounter.toast), "an encounter started with no dossier says why the round is empty");
      t.eq(newcomer.encounter.combatants, 1, "a body can still be brought into it");
      t.ok(newcomer.encounter.acted, "the tracker's Acted control marks them");
      t.eq(newcomer.encounter.left, 0, "and ✕ takes them out again");

      /* ---- the dialog stack, the resource chips, and a write that fails
       * Found by driving the app rather than reading it: every open modal listened to the
       * document, the DF chip was a button with an empty handler, the chips were a 21px
       * target, and a failed localStorage write was thrown away in silence. */
      const plumbing = await page.evaluate(async () => {
        const U = await import("./src/ui.js");
        const Store = await import("./src/store.js");
        const Sheet = await import("./src/sheet.js");
        const wait = ms => new Promise(r => setTimeout(r, ms));
        const esc = () => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
        const wipe = () => document.querySelectorAll(".modal-backdrop,.toast").forEach(n => n.remove());
        const out = {};

        // Two stacked dialogs: Escape takes the top one only.
        U.modal({ title: "Underneath", body: "one", actions: [{ label: "OK", kind: "primary" }] });
        await wait(40);
        U.modal({ title: "On top", body: "two", actions: [{ label: "OK", kind: "primary" }] });
        await wait(40);
        out.stacked = document.querySelectorAll(".modal").length;
        out.ids = [...document.querySelectorAll(".modal h2")].map(h => h.id);
        esc(); await wait(80);
        out.afterFirstEscape = [...document.querySelectorAll(".modal h2")].map(h => h.textContent);
        esc(); await wait(80);
        out.afterSecondEscape = document.querySelectorAll(".modal").length;
        wipe();

        // A locked step on top of anything ignores Escape, and does not take the one below.
        U.modal({ title: "Ordinary", body: "a", actions: [{ label: "OK", kind: "primary" }] });
        await wait(40);
        U.modal({ title: "Locked step", body: "b", locked: true, actions: [{ label: "Next", kind: "primary" }] });
        await wait(40);
        esc(); await wait(80);
        out.lockedOnTop = [...document.querySelectorAll(".modal h2")].map(h => h.textContent);
        wipe();

        // The resource chips: every one is a real target, and every one goes somewhere.
        // The wipe above left the device empty, so the chips need somebody to be about.
        const c = Store.activeCharacter() || Store.allCharacters()[0] || Store.createCharacter("agent");
        if (c) {
          Store.setActive(c.id);
          Store.updateActive(x => { x.state.wound = "medium"; x.state.exhausted = true; x.inventory.money = 1250000; });
          Sheet.renderResourceHeader();
          await wait(120);
          out.clipped = [...document.querySelectorAll(".res-chip b")].filter(b => b.scrollWidth > b.clientWidth + 1).map(b => b.textContent);
          out.chips = [...document.querySelectorAll(".res-chip")].map(n => ({
            label: n.querySelector(".lab").textContent,
            tag: n.tagName,
            h: Math.round(n.getBoundingClientRect().height)
          }));
          // The strip is one bar that fits the width: no sideways scroll, no chip past the edge.
          const strip = document.getElementById("resourceHeader");
          out.navIcons = [...document.querySelectorAll(".nav-btn .ico")].every(n => n.querySelector("svg"));
          out.strip = {
            scrolls: strip.scrollWidth > strip.clientWidth + 1,
            outside: [...strip.children].some(n => n.getBoundingClientRect().right > strip.getBoundingClientRect().right + 1)
          };
          const df = [...document.querySelectorAll(".res-chip")].find(n => n.querySelector(".lab").textContent === "DF");
          if (df) {
            df.click(); await wait(220);
            const m = document.querySelector(".modal");
            out.dfPanel = m ? m.textContent.replace(/\s+/g, " ") : "";
          }
          wipe();
          Store.updateActive(x => { x.state.wound = "none"; x.state.exhausted = false; x.inventory.money = 0; });
          Sheet.renderResourceHeader();
        }

        // A row with a long note keeps its label, and does not shrink a button into two lines.
        const probe = document.createElement("div");
        probe.className = "card flush";
        probe.style.cssText = "width:320px";
        probe.innerHTML = '<div class="card-row"><span class="grow">left cheek</span>' +
          '<span class="small muted">a thin white line from a knife fight in Marseille, taken in 1962</span>' +
          '<button class="btn sm" type="button">Use</button></div>';
        document.getElementById("screen").appendChild(probe);
        await wait(60);
        const label = probe.querySelector(".grow");
        const useBtn = probe.querySelector("button");
        out.row = {
          labelWidth: Math.round(label.getBoundingClientRect().width),
          labelClipped: label.scrollWidth > label.clientWidth + 2,
          buttonHeight: Math.round(useBtn.getBoundingClientRect().height),
          buttonClipped: useBtn.scrollWidth > useBtn.clientWidth + 2
        };
        probe.remove();

        // A write that cannot land says so, once.
        const realSet = localStorage.setItem.bind(localStorage);
        localStorage.setItem = () => { const e = new Error("quota"); e.name = "QuotaExceededError"; throw e; };
        let raised = 0;
        const onFail = () => { raised++; };
        document.addEventListener("store:writefailed", onFail);
        try {
          Store.addRoll({ label: "probe", roll: 1, quality: 1 });
          await wait(80);
          out.toast = [...document.querySelectorAll(".toast")].map(n => n.textContent).join(" ");
        } finally {
          localStorage.setItem = realSet;
          document.removeEventListener("store:writefailed", onFail);
        }
        out.raised = raised;
        wipe();
        return out;
      });

      t.eq(plumbing.stacked, 2, "two dialogs can stand open at once");
      t.eq(new Set(plumbing.ids).size, 2, "and they carry different heading ids, so aria-labelledby points at the right one");
      t.deep(plumbing.afterFirstEscape, ["Underneath"], "Escape closes the top dialog only, not the whole stack");
      t.eq(plumbing.afterSecondEscape, 0, "a second Escape closes the one underneath");
      t.deep(plumbing.lockedOnTop, ["Ordinary", "Locked step"], "a locked step ignores Escape and does not dismiss what is under it");
      t.ok(plumbing.chips && plumbing.chips.length >= 5, "the resource header carries its chips");
      t.ok(plumbing.chips.every(x => x.h >= 30), "every chip is a real touch target" +
        (plumbing.chips ? " (" + plumbing.chips.map(x => x.label + " " + x.h).join(", ") + ")" : ""));
      t.ok(plumbing.chips.some(x => x.label === "DF"), "a standing condition shows its Difficulty Factor");
      t.ok(plumbing.strip && !plumbing.strip.scrolls && !plumbing.strip.outside,
        "the resource strip fits the width with no sideways scroll, a wound and a condition standing");
      t.ok(plumbing.clipped && !plumbing.clipped.length, "no chip value is clipped, $1,250,000 and a Medium wound standing" +
        (plumbing.clipped && plumbing.clipped.length ? ` (${plumbing.clipped.join(", ")})` : ""));
      t.ok(plumbing.navIcons, "every nav tab draws an SVG icon rather than a glyph that can fall back to emoji");
      t.ok(/Medium Wound/.test(plumbing.dfPanel || "") && /Exhausted/.test(plumbing.dfPanel || ""),
        "and the DF chip opens the breakdown rather than doing nothing");
      t.ok(/-5 Difficulty Factor in total/.test(plumbing.dfPanel || ""), "with the total it applies");
      t.ok(plumbing.row.labelWidth > 20 && !plumbing.row.labelClipped,
        `a long note in a row leaves its label readable (${plumbing.row.labelWidth}px)`);
      t.ok(plumbing.row.buttonHeight < 40 && !plumbing.row.buttonClipped,
        `and the button in that row keeps its label on one line (${plumbing.row.buttonHeight}px)`);
      t.eq(plumbing.raised, 1, "a failed write raises exactly one warning");
      t.ok(/Storage is full/.test(plumbing.toast || ""), "and the player is told rather than left to find out on reload");

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

      // The guided player: a whole mission driven from the coach card and nothing else.
      const coached = await page.evaluate(async () => {
        const Store = await import("./src/store.js");
        const S = await import("./src/settings.js");
        const UI = await import("./src/ui.js");
        UI.closeAllModals();
        await new Promise(r => setTimeout(r, 150));

        // A device that looks empty to the coach, without destroying what the rest of the
        // suite is standing on: the beat is derived from what is *active*, so unsetting is
        // enough and nothing else has to be deleted.
        // activeAdventure() falls back to the first record rather than stranding a player,
        // so the only way to look like a device that has never played is to have none. This
        // block runs last for exactly that reason.
        for (const a of Store.soloAdventures()) Store.deleteAdventure(a.id);
        const keep = Store.allCharacters().map(c => c.id);
        Store.setActive(null);
        S.set("solo", false);
        S.set("showHelp", true);

        const go = async () => {
          location.hash = "#/home"; await new Promise(r => setTimeout(r, 90));
          location.hash = "#/play"; await new Promise(r => setTimeout(r, 350));
          return document.getElementById("screen");
        };
        const coach = () => document.querySelector(".coach");
        const says = () => { const c = coach(); return c ? c.querySelector(".coach-say").textContent : ""; };
        const tap = async label => {
          const btn = [...coach().querySelectorAll("button")].find(b => b.textContent.includes(label));
          if (!btn) return false;
          btn.click();
          await new Promise(r => setTimeout(r, 400));
          return true;
        };
        const clearModals = async () => {
          for (let i = 0; i < 10 && document.querySelector(".modal"); i++) {
            const m = document.querySelector(".modal");
            const btn = [...m.querySelectorAll(".modal-foot .btn")].pop();
            if (btn) btn.click(); else break;
            await new Promise(r => setTimeout(r, 120));
          }
        };

        await go();
        const step1 = says();
        const madeAgent = await tap("ready-made agent");
        await new Promise(r => setTimeout(r, 300));
        const hasCharacter = !!Store.activeCharacter();

        await go();
        const step2 = says();
        await tap("Start a mission");
        await new Promise(r => setTimeout(r, 900));
        const briefed = !!(Store.activeAdventure() && Store.activeAdventure().briefing);
        const soloOn = S.Settings.solo();
        const briefingShown = document.querySelector(".modal")
          ? /What you are after/.test(document.querySelector(".modal").textContent) : false;
        await clearModals();

        await go();
        const step3 = says();
        const field = coach().querySelector('input[type="text"]');
        const asksWhat = !!field;
        if (field) { field.value = "Search the freight office after dark"; }
        await tap("Go");
        await new Promise(r => setTimeout(r, 500));
        await clearModals();                       // the scene-test chain ends on Play scene
        await new Promise(r => setTimeout(r, 250));

        await go();
        const live = Store.activeAdventure();
        const inPlay = !!live && live.scenePhase === "play";
        const step4 = says();
        const options = [...coach().querySelectorAll(".opt-btn")].map(b => b.textContent);

        await tap("Finish this scene");
        await new Promise(r => setTimeout(r, 400));
        await clearModals();                       // the End Scene dialog, taken as it stands
        await new Promise(r => setTimeout(r, 300));

        await go();
        const step5 = says();
        const now = Store.activeAdventure();
        const scene = now ? now.scene : 0;

        for (const c of Store.allCharacters()) if (!keep.includes(c.id)) Store.deleteCharacter(c.id);
        if (keep.length) Store.setActive(keep[0]);
        UI.closeAllModals();
        return {
          step1, madeAgent, hasCharacter,
          step2, soloOn, briefed, briefingShown,
          step3, asksWhat, inPlay, step4, options, step5, scene
        };
      });
      t.ok(/agent to play/i.test(coached.step1), "with nothing on the device the coach asks for an agent");
      t.ok(coached.madeAgent && coached.hasCharacter, "and one tap makes a playable one");
      t.ok(/mission/i.test(coached.step2), "then it offers a mission");
      t.ok(coached.soloOn, "turning on solo play itself rather than asking the player to find the toggle");
      t.ok(coached.briefed, "and rolling the whole briefing in that one tap");
      t.ok(coached.briefingShown, "which it reads back in plain words, not table names");
      t.ok(/what you are about to do/i.test(coached.step3) && coached.asksWhat,
        "then it asks what you are about to do, in a field on the card");
      t.ok(coached.inPlay, "and opens the scene");
      t.eq(coached.options.length, 3, "a scene offers three plain choices and nothing else");
      t.ok(coached.options.some(o => /tries something/i.test(o)) &&
           coached.options.some(o => /true/i.test(o)) &&
           coached.options.some(o => /stuck/i.test(o)),
        "do something, find out if something is true, or ask for an idea");
      t.eq(coached.scene, 2, "finishing the scene moves the mission on");
      t.ok(/next one|what now/i.test(coached.step5), "and the coach asks for the next scene");


      // Redundancy and linking audit: one control per destination on the play guide, every
      // tap line leading to the screen it names, rules topics leading to their tools, a GM
      // broadcast arriving, a dossier that can be duplicated, and a roll's author linked.
      const linked = await page.evaluate(async () => {
        const Store = await import("./src/store.js");
        const S = await import("./src/settings.js");
        const wait = ms => new Promise(r => setTimeout(r, ms));
        const out = {};
        document.querySelectorAll(".modal-head .icon-btn").forEach(b => b.click());
        await wait(100);
        // Table track: the tap lines that used to offer solo play.
        const soloWas = S.Settings.solo();
        S.set("solo", false);
        location.hash = "#/home"; await wait(150);
        location.hash = "#/play"; await wait(300);
        const combatTap = [...document.querySelectorAll("#screen .tut-tap.is-link")].find(b => /^Combat/.test(b.textContent));
        out.combatTap = !!combatTap;
        combatTap?.click(); await wait(250);
        out.combatTapGoes = location.hash;
        out.offeredSolo = !!document.querySelector(".modal");
        document.querySelectorAll(".modal-head .icon-btn").forEach(b => b.click());
        S.set("solo", soloWas);
        location.hash = "#/play"; await wait(300);
        const nextCard = document.querySelector("#screen .next-step");
        out.nextCardLinks = nextCard ? nextCard.querySelectorAll("button").length : -1;
        const nextRow = document.querySelector("#screen .guide-step.is-next");
        out.nextRowControls = nextRow ? nextRow.querySelectorAll("button").length : -1;
        out.doubleControlRows = [...document.querySelectorAll("#screen .guide-step")]
          .filter(r => r.querySelector(".tut-tap.is-link") && r.querySelector("button.btn")).length;
        // Rules topics lead to their tools.
        const scr = await import("./src/screens.js");
        scr.openRulesTopic("chases"); await wait(150);
        out.chaseTool = [...document.querySelectorAll(".modal .modal-foot .btn")].map(b => b.textContent);
        document.querySelectorAll(".modal-head .icon-btn").forEach(b => b.click()); await wait(100);
        scr.openRulesTopic("combatround"); await wait(150);
        [...document.querySelectorAll(".modal .modal-foot .btn")].find(b => /Combat/.test(b.textContent))?.click();
        await wait(250);
        out.topicToCombat = location.hash;
        // A broadcast from the GM reaches this device.
        document.dispatchEvent(new CustomEvent("sync:broadcast", { detail: { text: "Rendezvous moved to the pier", ts: Date.now() } }));
        await wait(100);
        out.broadcastShown = [...document.querySelectorAll(".toast")].some(x => /pier/.test(x.textContent));
        // Duplicate a dossier from the list.
        const before = Store.allCharacters().length;
        location.hash = "#/create"; await wait(300);
        document.querySelector('#screen button[aria-label^="Duplicate"]')?.click(); await wait(250);
        out.duplicated = Store.allCharacters().length - before;
        const copy = Store.allCharacters().find(c => /\(copy\)$/.test(c.identity.name));
        if (copy) Store.deleteCharacter(copy.id);
        // The roll log names who rolled, and the name opens that dossier.
        const roller = Store.allCharacters()[0];
        if (roller) Store.setActive(roller.id);
        Store.addRoll({ by: roller ? roller.identity.name : "Agent", characterId: roller ? roller.id : null,
          label: "Audit roll", roll: 12, quality: 3, modifiers: [] });
        location.hash = "#/log"; await wait(300);
        const by = document.querySelector("#screen .log-entry .link-btn");
        out.byLink = !!by;
        location.hash = "#/home"; await wait(150);
        location.hash = "#/log"; await wait(300);
        document.querySelector("#screen .log-entry .link-btn")?.click(); await wait(250);
        out.byGoes = location.hash;
        return out;
      });
      t.ok(linked.combatTap && linked.combatTapGoes === "#/combat" && !linked.offeredSolo,
        "a Combat tap line on the table track opens Combat, not the solo offer");
      t.eq(linked.nextCardLinks, 1, "the pinned next step carries one control, not a link and a button to the same place");
      t.eq(linked.nextRowControls, 0, "and its row below is marked rather than offered a second time");
      t.eq(linked.doubleControlRows, 0, "no guide step carries both a tap link and a button to the same place");
      t.ok(linked.chaseTool.includes("Chase manoeuvre"), "the Chases rules topic offers the chase roller");
      t.eq(linked.topicToCombat, "#/combat", "and The Combat Round leads to the Combat screen");
      t.ok(linked.broadcastShown, "a GM broadcast is shown on the receiving device");
      t.eq(linked.duplicated, 1, "a dossier can be duplicated from the dossier list");
      t.ok(linked.byLink && linked.byGoes === "#/sheet", "a roll's author in the log opens that dossier");

      // Reported: the solo journal did not capture skill rolls. A real roll through the dialog,
      // with solo on and the adventure linked to the dossier that rolled.
      const journaled = await page.evaluate(async () => {
        const wait = ms => new Promise(r => setTimeout(r, ms));
        const Store = await import("./src/store.js");
        const S = await import("./src/settings.js");
        const Roller = await import("./src/roller.js");
        (await import("./src/ui.js")).closeAllModals();
        const soloWas = S.Settings.solo();
        S.set("solo", true);
        const c = Store.activeCharacter() || Store.allCharacters()[0];
        Store.setActive(c.id);
        const adv = Store.createAdventure({ characterId: c.id });
        Store.setActiveAdventure(adv.id);
        Store.updateAdventure(a => { a.scenePhase = "play"; a.scene = 2; });
        const count = () => (Store.activeAdventure().journal || []).filter(j => j.kind === "check").length;
        const before = count();
        Roller.openRoll({ character: c, skillKey: "stealth" });
        for (let i = 0; i < 40 && !document.querySelector(".modal"); i++) await wait(50);
        [...document.querySelectorAll(".modal-foot .btn")].find(b => b.textContent === "Roll").click();
        for (let i = 0; i < 60 && !document.querySelector(".roll-quality"); i++) await wait(50);
        [...document.querySelectorAll(".modal-foot .btn")].find(b => b.textContent === "Done").click();
        await wait(150);
        const entry = (Store.activeAdventure().journal || []).find(j => j.kind === "check");
        const out = { added: count() - before, text: entry && entry.text, detail: entry && entry.detail };
        // Not when the adventure is someone else's, and not with solo off.
        Store.updateAdventure(a => { a.characterId = "someone-else"; });
        Store.addRoll({ by: "X", characterId: c.id, label: "Stray", roll: 5, quality: 2, modifiers: [] });
        out.otherDossier = count();
        Store.updateAdventure(a => { a.characterId = c.id; });
        S.set("solo", false);
        Store.addRoll({ by: "X", characterId: c.id, label: "Stray", roll: 5, quality: 2, modifiers: [] });
        out.soloOff = count();
        S.set("solo", true);
        location.hash = "#/home"; await wait(120);
        location.hash = "#/solo"; await wait(350);
        out.tagShown = [...document.querySelectorAll('#screen .journal .log-entry[data-kind="check"] .kind-tag')].length;
        Store.deleteAdventure ? Store.deleteAdventure(adv.id) : null;
        S.set("solo", soloWas);
        return out;
      });
      t.eq(journaled.added, 1, "a skill roll made during a solo mission is written into its journal");
      t.ok(/Stealth/.test(journaled.text || "") && /rolled \d+/.test(journaled.detail || "") && /scene 2/.test(journaled.detail || ""),
        "naming the skill, the Quality, the dice and the scene");
      t.eq(journaled.otherDossier, 1, "a roll by a dossier the adventure is not linked to stays out of it");
      t.eq(journaled.soloOff, 1, "and with solo play off nothing is journalled");
      t.ok(journaled.tagShown >= 1, "the journal shows the row with its own CHECK tag");

      // Suggested names: gender is two chips, and a roll fills the Name field from its tables.
      const naming = await page.evaluate(async () => {
        const wait = ms => new Promise(r => setTimeout(r, ms));
        const W = await import("./src/wizard.js");
        const N = await import("./data-names.js");
        W.startWizard("rookie");
        location.hash = "#/home"; await wait(120);
        location.hash = "#/create"; await wait(300);
        const host = document.getElementById("screen");
        const rollBtn = () => [...host.querySelectorAll("button")].find(b => b.textContent === "Roll a name");
        const out = { freeText: !!host.querySelector('input[placeholder*="non-binary"]'), disabledFirst: rollBtn()?.disabled };
        out.genders = [...host.querySelectorAll('[role="radiogroup"] .chip')].map(c => c.textContent);
        [...host.querySelectorAll('[role="radiogroup"] .chip')].find(c => c.textContent === "Female").click(); await wait(200);
        rollBtn().click(); await wait(100);
        const name = host.querySelector('input[aria-label="Name"]').value;
        const [first, ...rest] = name.split(" ");
        out.firstOk = N.FEMALE_NAMES.includes(first);
        out.lastOk = N.SURNAMES.includes(rest.join(" "));
        const steps = [...host.querySelectorAll(".wstep")];
        steps.find(b => b.textContent.includes("Traits")).click(); await wait(200);
        out.column = /female column/.test(host.textContent);
        return out;
      });
      t.ok(!naming.freeText, "gender is no longer a free-text field");
      t.deep(naming.genders, ["Male", "Female"], "it is two choices, Male and Female");
      t.ok(naming.disabledFirst === true, "a name cannot be rolled until a gender is chosen");
      t.ok(naming.firstOk && naming.lastOk, "a roll fills the Name with a given name for that gender and a surname");
      t.ok(naming.column, "and the Traits step reads that gender's column");

      // Reported with a screenshot: the stepper sat beside a short description and under a long
      // one, and on iOS the beside case ran the text under the buttons.
      const steppers = await page.evaluate(async () => {
        const wait = ms => new Promise(r => setTimeout(r, ms));
        const host = document.getElementById("screen");
        [...host.querySelectorAll(".wstep")].find(b => b.textContent.includes("Characteristics")).click();
        await wait(250);
        return [...host.querySelectorAll(".card > .row")].filter(r => r.querySelector(":scope > .stepper")).map(r => {
          const g = r.querySelector(":scope > .grow").getBoundingClientRect();
          const st = r.querySelector(":scope > .stepper").getBoundingClientRect();
          return { clear: g.right <= st.left + 0.5, beside: st.top < g.bottom, left: Math.round(st.left) };
        });
      });
      t.eq(steppers.length, 5, "the five characteristics each carry a stepper");
      t.ok(steppers.every(x => x.clear), "no characteristic's text runs under its stepper");
      t.ok(steppers.every(x => x.beside) && new Set(steppers.map(x => x.left)).size === 1,
        "and every stepper sits in the same place, beside its text, whatever the description's length");

      // Reported: Fields of Experience read 2/0, and raising a skill shut its group and jumped
      // the page to the top.
      const wiz = await page.evaluate(async () => {
        const wait = ms => new Promise(r => setTimeout(r, ms));
        const W = await import("./src/wizard.js");
        W.startWizard("agent");
        location.hash = "#/home"; await wait(120);
        location.hash = "#/create"; await wait(300);
        const out = {};
        const host = document.getElementById("screen");
        const go = name => [...host.querySelectorAll(".wstep")].find(b => b.textContent.includes(name)).click();
        // Pick a wizard draft rather than the rank menu if one is offered.
        if (!host.querySelector(".wstep")) {
          [...host.querySelectorAll(".opt-btn")].find(b => /Agent/.test(b.textContent))?.click(); await wait(200);
        }
        go("Profession"); await wait(200);
        [...host.querySelectorAll(".opt-btn")].find(b => /Military/.test(b.textContent))?.click(); await wait(200);
        const label = () => [...host.querySelectorAll(".field-label")].find(l => /Fields of Experience \(/.test(l.textContent))?.textContent;
        out.zeroLabel = label();
        out.zeroChips = [...host.querySelectorAll(".chip-wrap .chip")].filter(c => !c.disabled).length;
        const plus = [...host.querySelectorAll(".stepper button")].find(b => b.textContent === "+");
        plus.click(); await wait(200);
        const chip = name => [...host.querySelectorAll(".chip-wrap .chip")].find(c => c.textContent === name);
        chip("Golf").click(); await wait(150);
        chip("Polo").click(); await wait(150);
        out.halfLabel = label();
        out.fullAfterTwo = chip("Military Science")?.disabled;
        go("Skills"); await wait(250);
        const acc = host.querySelector("details.acc:not(.help-acc)");
        acc.open = true;
        const groupName = acc.querySelector("summary").textContent;
        window.scrollTo(0, 400); const y = window.scrollY;
        acc.querySelectorAll(".stepper button")[1].click(); await wait(250);
        const again = [...host.querySelectorAll("details.acc:not(.help-acc)")].find(d => d.querySelector("summary").textContent === groupName);
        out.stillOpen = !!(again && again.open);
        out.scrollKept = Math.abs(window.scrollY - y) < 5;
        return out;
      });
      t.eq(wiz.zeroLabel, "Fields of Experience (0/0)", "with no profession years the Fields counter reads 0/0");
      t.eq(wiz.zeroChips, 0, "and no Field can be chosen until a year is added");
      t.eq(wiz.halfLabel, "Fields of Experience (1/1)", "two General Fields fill one year's slot");
      t.ok(wiz.fullAfterTwo === true, "after which a profession Field is not offered");
      t.ok(wiz.stillOpen, "raising a skill leaves its group open");
      t.ok(wiz.scrollKept, "and keeps the page where it was");

      t.eq(errors.length, 0, "zero JavaScript errors during the whole run" +
        (errors.length ? `: ${errors.slice(0, 3).join(" | ")}` : ""));

      await context.close();
    }
  } finally {
    await browser.close();
  }
}
