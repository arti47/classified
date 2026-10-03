/* router.js — bottom-nav routing and conditional tab gating. */

import { el, clear, $ } from "./core.js";
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

/* The nav icon set: one stroke family, drawn on a 24px grid in currentColor, so it matches
 * the type and never falls back to a colour emoji the way a Unicode glyph does. */
const SVG_NS = "http://www.w3.org/2000/svg";
const ICON_PATHS = {
  home: "M3 10.5 12 4l9 6.5M5.5 9v10.5h13V9M10 19.5v-5h4v5",
  sheet: "M3.5 6.5h6l2 2h9v11h-17zM3.5 6.5v-2h5l1.5 2M8 13h8M8 16h5",
  combat: "M12 3v4M12 17v4M3 12h4M17 12h4M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zM12 11.2v1.6",
  rules: "M4 5.5c3-1 5.5-.8 8 1 2.5-1.8 5-2 8-1v13c-3-1-5.5-.8-8 1-2.5-1.8-5-2-8-1zM12 6.5v13",
  gm: "M12 3.5l2.4 5 5.4.6-4 3.7 1.1 5.4L12 15.5l-4.9 2.7 1.1-5.4-4-3.7 5.4-.6z",
  solo: "M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17zM15.5 8.5l-2 5-5 2 2-5zM12 3.5v2M12 18.5v2M3.5 12h2M18.5 12h2",
  settings: "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7"
};

function navIcon(key) {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "1.7");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  const path = document.createElementNS(SVG_NS, "path");
  path.setAttribute("d", ICON_PATHS[key] || ICON_PATHS.home);
  svg.appendChild(path);
  return svg;
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
      el("span", { class: "ico", "aria-hidden": "true" }, ICON_PATHS[key] ? navIcon(key) : r.icon),
      el("span", { class: "lbl", text: r.label })
    ));
  }
  updateNavState();
}

function updateNavState() {
  for (const btn of document.querySelectorAll(".nav-btn")) {
    if (btn.dataset.route === current) btn.setAttribute("aria-current", "page");
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
