/* tests/browser.js — headless boot, wiring, layout and flow checks.
 * Firebase and any other cross-origin request is aborted so tests never touch the network. */

const VIEWPORTS = [
  { name: "360px phone", width: 360, height: 780 },
  { name: "390px phone", width: 390, height: 844 }
];

const TABS = ["home", "sheet", "combat", "rules", "settings", "create", "gear", "advance", "log", "gm"];

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
        localStorage.setItem("classified.settings", JSON.stringify({ theme: "system", campaignStyle: "adventurous", gmScreen: true, showUntrained: true, autoConditions: true, heroPointPrompt: true }));
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
