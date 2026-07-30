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
        Store.pushSoloUndo(Store.soloSnapshot());
        Store.updateAdventure(a => { a.chaos = 9; a.scene = 7; });
        const dirty = Store.activeAdventure();
        const applied = Store.applySoloUndo();
        const back = Store.activeAdventure();
        return { dirtyChaos: dirty.chaos, applied, chaos: back.chaos, scene: back.scene };
      });
      t.eq(undo.dirtyChaos, 9, "the Chaos Factor can be driven to the top of its range");
      t.ok(undo.applied && undo.chaos === 5 && undo.scene === 1,
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
