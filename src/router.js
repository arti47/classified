/* router.js — bottom-nav routing and conditional tab gating. */

import { el, clear, icon, hasIcon, preserveView } from "./core.js";
import { Settings } from "./settings.js";
import * as Store from "./store.js";

const ROUTES = {
  home: { label: "Home", icon: "◉", title: "Classified", render: h => imp("./onboard.js", m => m.renderHome(h)) },
  mission: { label: "Mission", nav: "Mission", icon: "◈", title: "Mission", render: h => imp("./mission.js", m => m.renderMission(h)) },
  files: { label: "Files", nav: "Files", icon: "≡", title: "Files", render: h => imp("./screens.js", m => m.renderFiles(h)) },
  create: { label: "Create", icon: "✎", title: "Recruit", render: h => imp("./wizard.js", m => m.renderCreate(h)) },
  sheet: { label: "Dossier", nav: "Agent", navIcon: "agent", icon: "🗂", title: "Agent", render: h => imp("./sheet.js", m => m.renderSheet(h)) },
  gear: { label: "Gear", icon: "⚙", title: "Gear", render: h => imp("./sheet.js", m => m.renderGear(h)) },
  combat: { label: "Combat", icon: "⚔", title: "Combat", render: h => imp("./combat.js", m => m.renderCombat(h)) },
  advance: { label: "Advance", icon: "▲", title: "Advance", render: h => imp("./screens.js", m => m.renderAdvance(h)) },
  rules: { label: "Rules", icon: "❋", title: "Rules", render: h => imp("./screens.js", m => m.renderRules(h)) },
  log: { label: "Log", icon: "≡", title: "Roll log", render: h => imp("./screens.js", m => m.renderLog(h)) },
  gm: { label: "GM", nav: "GM", icon: "★", title: "GM Screen", gated: () => Settings.gmScreen(), render: h => imp("./gm.js", m => m.renderGM(h)) },
  solo: { label: "Case board", icon: "◈", navIcon: "board", title: "Case board", gated: () => Settings.solo(), render: h => imp("./solo.js", m => m.renderSolo(h)) },
  settings: { label: "Settings", icon: "⚑", title: "Settings", render: h => imp("./screens.js", m => m.renderSettings(h)) },
  tutorial: { label: "Tutorial", icon: "◎", title: "Tutorial", render: h => imp("./help.js", m => m.renderTutorial(h)) },
  play: { label: "Guide", icon: "▶", title: "How to play", render: h => imp("./help.js", m => m.renderPlayGuide(h)) }
};

/* Three places (CLAUDE.md §1.3, U1): the Agent, the Mission, the Files. Everything else is a
 * page inside one of them, reached from its divider strip. The GM screen is a fourth tab only
 * for a player who has asked for it. */
function primaryTabs() {
  return ["sheet", "mission", "files", "gm"];
}

/* Folders: screens that belong together share a divider strip under the header, so a screen
 * with no tab of its own is still one tap from its neighbours, and the bottom tab that owns
 * the folder stays lit on every screen in it. Glossary is a dialog rather than a route, so it
 * rides in the Library strip as an action. */
const FOLDERS = {
  agent: { tab: "sheet", routes: ["sheet", "gear", "advance"] },
  mission: { tab: "mission", routes: ["mission", "solo", "combat"] },
  files: { tab: "files", routes: ["rules", "play", "tutorial", "log", "settings"], also: ["files"], hideOn: ["files"],
    actions: [{ key: "glossary", label: "Glossary", run: () => import("./help.js").then(m => m.openGlossary()) }] }
};

export function folderOf(route) {
  return Object.values(FOLDERS).find(f => f.routes.includes(route) || (f.also || []).includes(route)) || null;
}

function folderKey(route) {
  return Object.keys(FOLDERS).find(k => FOLDERS[k] === folderOf(route)) || "";
}

function renderSubNav(route) {
  const bar = document.getElementById("subNav");
  if (!bar) return;
  clear(bar);
  const folder = folderOf(route);
  // A hub is its own navigation: the Files tiles are the strip, drawn larger.
  bar.hidden = !folder || (folder.hideOn || []).includes(route);
  if (bar.hidden) return;
  const strip = el("div", { class: "sub-nav-strip" });
  for (const key of folder.routes) {
    if (ROUTES[key].gated && !ROUTES[key].gated()) continue;
    strip.appendChild(el("button", {
      class: "sub-tab", type: "button", dataset: { route: key },
      "aria-current": key === route ? "page" : null,
      onclick: () => { if (key !== current) navigate(key); }
    }, icon(ROUTES[key].navIcon || (hasIcon(key) ? key : "files")), el("span", { text: ROUTES[key].label })));
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

export function navigate(route, { replace = false, keepFocus = false } = {}) {
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
  // The stylesheet reads where you are: the resource strip belongs to the Agent and the fight.
  document.body.dataset.route = route;
  document.body.dataset.folder = folderKey(route);
  renderSubNav(route);
  ROUTES[route].render(host);
  window.scrollTo(0, 0);
  if (!keepFocus) host.focus({ preventScroll: true });
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
      el("span", { class: "ico", "aria-hidden": "true" }, icon(r.navIcon || (hasIcon(key) ? key : "files"))),
      el("span", { class: "lbl", text: r.nav || r.label })
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

/**
 * Swipe sideways to turn the page (U13): on the Case board between its four pages on a phone,
 * anywhere else to the neighbouring page in the folder's strip. A swipe that starts in a field
 * or on something that scrolls sideways of its own is that thing's, not the page's.
 */
function folderNeighbour(route, dir) {
  const f = folderOf(route);
  if (!f) return null;
  const list = f.routes.filter(k => !ROUTES[k].gated || ROUTES[k].gated());
  const i = list.indexOf(route);
  if (i < 0) return null;
  return list[i + dir] || null;
}

function sideScroller(node) {
  for (let n = node; n && n.id !== "screen"; n = n.parentElement) {
    if (n.matches && n.matches("input, textarea, select, .ob-rail, .range-track, [data-noswipe]")) return true;
    const ox = getComputedStyle(n).overflowX;
    if ((ox === "auto" || ox === "scroll") && n.scrollWidth > n.clientWidth + 2) return true;
  }
  return false;
}

function initSwipe() {
  const host = document.getElementById("screen");
  let start = null;
  host.addEventListener("touchstart", e => {
    if (e.touches.length !== 1 || document.querySelector(".modal") || sideScroller(e.target)) { start = null; return; }
    start = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() };
  }, { passive: true });
  host.addEventListener("touchend", e => {
    if (!start) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x, dy = t.clientY - start.y, dt = Date.now() - start.t;
    start = null;
    if (Math.abs(dx) < 70 || Math.abs(dy) > 45 || dt > 700) return;
    swipe(dx < 0 ? 1 : -1);
  }, { passive: true });
}

/** Turn one page in a direction: +1 forward, −1 back. Exported so it can be driven directly. */
export function swipe(dir) {
  if (current === "solo" && window.innerWidth < 900) {
    return import("./solo.js").then(m => m.stepSoloPage(dir));
  }
  const next = folderNeighbour(current, dir);
  if (next) navigate(next);
}

export function initRouter() {
  initSwipe();
  rebuildNav();
  window.addEventListener("hashchange", () => {
    const route = (location.hash || "#/home").replace("#/", "");
    if (route !== current) navigate(route, { replace: true });
  });
  // A redraw of the screen already open keeps its place; only a real navigation starts at the top.
  document.addEventListener("app:rerender", () => {
    const host = document.getElementById("screen");
    preserveView(host, () => navigate(current, { replace: true, keepFocus: true }));
  });
  const initial = (location.hash || "#/home").replace("#/", "");
  navigate(ROUTES[initial] ? initial : "home", { replace: true });
}
