/* tests/run.js — regression harness. `npm test`
 * Runs the pure-logic checks in Node, then boots the real app headless. */

import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { listen } from "./serve.js";
import { unitTests } from "./unit.js";
import { browserTests } from "./browser.js";

const t = createRunner();

function createRunner() {
  const results = [];
  let group = "General";
  return {
    group(name) { group = name; results.push({ kind: "group", name }); },
    pass(msg) { results.push({ kind: "pass", group, msg }); },
    fail(msg) { results.push({ kind: "fail", group, msg }); },
    ok(cond, msg) { cond ? this.pass(msg) : this.fail(msg); },
    eq(actual, expected, msg) {
      if (actual === expected) this.pass(msg);
      else this.fail(`${msg} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    },
    deep(actual, expected, msg) {
      if (JSON.stringify(actual) === JSON.stringify(expected)) this.pass(msg);
      else this.fail(`${msg} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    },
    report() {
      let passed = 0, failed = 0;
      for (const r of results) {
        if (r.kind === "group") { console.log(`\n\x1b[1m${r.name}\x1b[0m`); continue; }
        if (r.kind === "pass") { passed++; console.log(`  \x1b[32m✓\x1b[0m ${r.msg}`); }
        else { failed++; console.log(`  \x1b[31m✗\x1b[0m ${r.msg}`); }
      }
      console.log(`\n${passed} passed, ${failed} failed\n`);
      return failed;
    }
  };
}

function findChromium() {
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH || "/opt/pw-browsers";
  if (!existsSync(root)) return null;
  const dirs = readdirSync(root).filter(d => d.startsWith("chromium-"));
  for (const d of dirs) {
    for (const rel of ["chrome-linux/chrome", "chrome-linux/headless_shell", "chrome-mac/Chromium.app/Contents/MacOS/Chromium"]) {
      const p = join(root, d, rel);
      if (existsSync(p)) return p;
    }
  }
  const headless = readdirSync(root).filter(d => d.startsWith("chromium_headless_shell-"));
  for (const d of headless) {
    const p = join(root, d, "chrome-linux/headless_shell");
    if (existsSync(p)) return p;
  }
  return null;
}

async function main() {
  unitTests(t);

  const executablePath = findChromium();
  if (!executablePath) {
    t.group("Browser");
    t.fail("no Chromium binary found — browser checks were skipped");
  } else {
    let chromium;
    try {
      ({ chromium } = await import("playwright-core"));
    } catch {
      t.group("Browser");
      t.fail("playwright-core is not installed — run npm install");
    }
    if (chromium) {
      const { server, port } = await listen(0);
      try {
        await browserTests(t, { chromium, executablePath, baseURL: `http://127.0.0.1:${port}` });
      } catch (err) {
        t.fail("browser checks aborted: " + (err && err.message ? err.message.split("\n")[0] : String(err)));
      } finally {
        server.close();
      }
    }
  }

  const failed = t.report();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
