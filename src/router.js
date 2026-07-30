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
  settings: { label: "Settings", icon: "⚑", title: "Settings", render: h => imp("./screens.js", m => m.renderSettings(h)) }
};

/* Primary tabs shown in the bottom navigation. The rest are reachable from Home
 * and Settings; a small screen cannot carry ten tabs. */
const PRIMARY = ["home", "sheet", "combat", "rules", "gm", "settings"];

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
  document.getElementById("headerTitle").textContent = ROUTES[route].title;
  ROUTES[route].render(host);
  window.scrollTo(0, 0);
  host.focus({ preventScroll: true });
  updateNavState();
}

export function rebuildNav() {
  const nav = document.getElementById("bottomNav");
  clear(nav);
  for (const key of PRIMARY) {
    const r = ROUTES[key];
    if (r.gated && !r.gated()) continue;
    nav.appendChild(el("button", {
      class: "nav-btn", type: "button", dataset: { route: key },
      onclick: () => navigate(key)
    },
      el("span", { class: "ico", "aria-hidden": "true", text: r.icon }),
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
