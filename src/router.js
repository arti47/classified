/* router.js — bottom-nav routing and conditional tab gating. */

import { el, clear, $, icon, hasIcon } from "./core.js";
import { Settings } from "./settings.js";
import * as Store from "./store.js";

const ROUTES = {
  home: { label: "Home", icon: "◉", title: "Classified", render: h => imp("./screens.js", m => m.renderHome(h)) },
  create: { label: "Create", icon: "✎", title: "Create", render: h => imp("./wizard.js", m => m.renderCreate(h)) },
  sheet: { label: "Sheet", icon: "🗂", title: "Dossier", render: h => imp("./sheet.js", m => m.renderSheet(h)) },
  gear: { label: "Gear", icon: "⚙", title: "Equipment", render: h => imp("./sheet.js", m => m.renderGear(h)) },
  combat: { label: "Combat", icon: "⚔", title: "Combat", render: h => imp("./combat.js", m => m.renderCombat(h)) },
  advance: { label: "Advance", icon: "▲", title: "Advancement", render: h => imp("./screens.js", m => m.renderAdvance(h)) },
  rules: { label: "Rules", icon: "❋", title: "Rules", render: h => imp("./screens.js", m => m.renderRules(h)) },
  log: { label: "Log", icon: "≡", title: "Roll log", render: h => imp("./screens.js", m => m.renderLog(h)) },
  gm: { label: "GM", icon: "★", title: "GM Screen", gated: () => Settings.gmScreen(), render: h => imp("./gm.js", m => m.renderGM(h)) },
  solo: { label: "Solo", icon: "◈", title: "Solo", gated: () => Settings.solo(), render: h => imp("./solo.js", m => m.renderSolo(h)) },
  settings: { label: "Settings", icon: "⚑", title: "Settings", render: h => imp("./screens.js", m => m.renderSettings(h)) },
  tutorial: { label: "Tutorial", icon: "◎", title: "Tutorial", render: h => imp("./help.js", m => m.renderTutorial(h)) },
  play: { label: "How to play", icon: "▶", title: "How to play", render: h => imp("./help.js", m => m.renderPlayGuide(h)) }
};

/* Primary tabs shown in the bottom navigation. The rest are reachable from Home
 * and Settings; a small screen cannot carry ten tabs. Six is the limit at 360px, so Solo
 * takes the Rules slot rather than adding a seventh — Rules keeps its Home tile. */
function primaryTabs() {
  const base = ["home", "sheet", "combat", "rules", "gm", "settings"];
  if (!Settings.solo()) return base;
  return base.map(k => (k === "rules" ? "solo" : k));
}

/* Folders: screens that belong together share a divider strip under the header, so a screen
 * with no tab of its own is still one tap from its neighbours, and the bottom tab that owns
 * the folder stays lit on every screen in it. Glossary is a dialog rather than a route, so it
 * rides in the Library strip as an action. */
const FOLDERS = {
  dossier: { tab: "sheet", routes: ["sheet", "gear", "advance", "log"] },
  library: { tab: "rules", routes: ["rules", "play", "tutorial"],
    actions: [{ key: "glossary", label: "Glossary", run: () => import("./help.js").then(m => m.openGlossary()) }] }
};

export function folderOf(route) {
  return Object.values(FOLDERS).find(f => f.routes.includes(route)) || null;
}

function renderSubNav(route) {
  const bar = document.getElementById("subNav");
  if (!bar) return;
  clear(bar);
  const folder = folderOf(route);
  bar.hidden = !folder;
  if (!folder) return;
  const strip = el("div", { class: "sub-nav-strip" });
  for (const key of folder.routes) {
    strip.appendChild(el("button", {
      class: "sub-tab", type: "button", dataset: { route: key },
      "aria-current": key === route ? "page" : null,
      onclick: () => { if (key !== current) navigate(key); }
    }, hasIcon(key) ? icon(key) : null, el("span", { text: ROUTES[key].label })));
  }
  for (const a of folder.actions || []) {
    strip.appendChild(el("button", { class: "sub-tab is-action", type: "button", onclick: a.run },
      hasIcon(a.key) ? icon(a.key) : null, el("span", { text: a.label })));
  }
  bar.appendChild(strip);
  const on = strip.querySelector('[aria-current="page"]');
  // Scroll only as far as it takes to show the current tab whole; a strip that fits stays put.
  if (on) requestAnimationFrame(() => {
    const right = on.offsetLeft + on.offsetWidth - strip.clientWidth;
    if (right > strip.scrollLeft) strip.scrollLeft = right + 8;
  });
}

let current = "home";

function imp(path, fn) {
  return import(path).then(fn).catch(err => {
    console.error("Route failed:", path, err);
    const host = document.getElementById("screen");
    clear(host);
    host.appendChild(el("div", { class: "empty" },
      el("p", { text: "This screen failed to load." }),
      el("p", { class: "small muted", text: String(err && err.message || err) })));
  });
}

export function currentRoute() { return current; }

export function navigate(route, { replace = false } = {}) {
  if (!ROUTES[route]) route = "home";
  current = route;

  const hash = "#/" + route;
  if (location.hash !== hash) {
    if (replace) history.replaceState(null, "", hash);
    else history.pushState(null, "", hash);
  }

  const host = document.getElementById("screen");
  clear(host);
  // A screen may widen itself (the sheet's two columns); a new route starts plain.
  host.className = "screen";
  document.getElementById("headerTitle").textContent = ROUTES[route].title;
  renderSubNav(route);
  ROUTES[route].render(host);
  window.scrollTo(0, 0);
  host.focus({ preventScroll: true });
  updateNavState();
}

export function rebuildNav() {
  const nav = document.getElementById("bottomNav");
  clear(nav);
  for (const key of primaryTabs()) {
    const r = ROUTES[key];
    if (r.gated && !r.gated()) continue;
    nav.appendChild(el("button", {
      class: "nav-btn", type: "button", dataset: { route: key },
      onclick: () => navigate(key)
    },
      el("span", { class: "ico", "aria-hidden": "true" }, hasIcon(key) ? icon(key) : r.icon),
      el("span", { class: "lbl", text: r.label })
    ));
  }
  updateNavState();
}

function updateNavState() {
  // The exact screen is the page; a folder's owning tab is marked as the location you are
  // inside of, so it stays lit on Gear, Advancement and the log without claiming to be them.
  const folder = folderOf(current);
  for (const btn of document.querySelectorAll(".nav-btn")) {
    if (btn.dataset.route === current) btn.setAttribute("aria-current", "page");
    else if (folder && folder.tab === btn.dataset.route) btn.setAttribute("aria-current", "location");
    else btn.removeAttribute("aria-current");
  }
}

export function initRouter() {
  rebuildNav();
  window.addEventListener("hashchange", () => {
    const route = (location.hash || "#/home").replace("#/", "");
    if (route !== current) navigate(route, { replace: true });
  });
  document.addEventListener("app:rerender", () => navigate(current, { replace: true }));
  const initial = (location.hash || "#/home").replace("#/", "");
  navigate(ROUTES[initial] ? initial : "home", { replace: true });
}
