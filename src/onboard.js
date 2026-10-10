/* onboard.js — the way in (U3).
 *
 * A first launch used to open on a menu of eight tiles and a card naming three more things to
 * do. This is a recruitment instead: two full screens and no reading. Pick an agent from the
 * published dossiers (or build your own), say whether you play alone or with a group, and the
 * mission opens. It owns no rule: the agents are the book's published samples instantiated by
 * the wizard, and a solo start is the same adventure-and-briefing the coach makes.
 *
 * Home is this screen only while there is no dossier. Once there is one, Home is the mission.
 */

import { el, clear, art } from "./core.js";
import * as Store from "./store.js";
import { Settings, set as setSetting } from "./settings.js";
import { PREGENS } from "../data-pregens.js";
import * as R from "./rules.js";
import { skillList } from "./derived.js";
import { instantiatePregen } from "./wizard.js";
import { lookPicker } from "./sheet.js";
import { navigate, rebuildNav } from "./router.js";

let step = "agent";

export function renderHome(host) {
  if (Store.activeCharacter() && step !== "mode" && step !== "look") {
    navigate("mission", { replace: true });
    return;
  }
  clear(host);
  host.classList.add("onboard");
  if (step === "look" && Store.activeCharacter()) renderLook(host);
  else if (step === "mode" && Store.activeCharacter()) renderMode(host);
  else renderAgents(host);
}

/* ---------------------------------------------------------------- step 1: who */

function renderAgents(host) {
  step = "agent";
  host.appendChild(dots(1));
  host.appendChild(el("h1", { class: "ob-title", text: "Choose your agent" }));

  const rail = el("div", { class: "ob-rail", role: "list" });
  for (const p of PREGENS) {
    const c = instantiatePregen(p);
    const best = skillList(c, { includeUntrained: false })
      .filter(s => !s.gmRolled).sort((a, b) => b.base - a.base).slice(0, 3);
    rail.appendChild(el("div", { class: "ob-card", role: "listitem" },
      el("span", { class: "stamp ob-rank", text: R.RANK_BY_KEY[p.rank].name }),
      el("div", { class: "ob-pic" }, art(p.gender === "female" ? "agentF" : "agent")),
      el("div", { class: "ob-name", text: p.name }),
      el("div", { class: "ob-prof", text: profName(p.profession) }),
      el("div", { class: "ob-skills" }, best.map(s =>
        el("span", { class: "ob-skill" }, el("b", { text: String(s.base) }), el("span", { text: s.name })))),
      el("button", { class: "btn primary block", type: "button", onclick: () => recruit(p, host) },
        `Recruit ${p.name.split(" ")[0]}`)));
  }
  rail.appendChild(el("div", { class: "ob-card is-own", role: "listitem" },
    el("div", { class: "ob-pic" }, art("typewriter")),
    el("div", { class: "ob-name", text: "Your own agent" }),
    el("div", { class: "ob-prof", text: "Point-buy, step by step" }),
    el("button", { class: "btn block", type: "button", onclick: () => navigate("create") }, "Build my own")));
  host.appendChild(rail);
  host.appendChild(el("p", { class: "ob-hint", text: "Swipe for more" }));
}

function profName(key) {
  const p = R.PROFESSION_BY_KEY && R.PROFESSION_BY_KEY[key];
  return p ? p.name : (key ? key[0].toUpperCase() + key.slice(1) : "");
}

function recruit(p, host) {
  const saved = Store.saveCharacter(instantiatePregen(p));
  Store.setActive(saved.id);
  // No toast: the next screen is the confirmation, and a toast would sit over its title.
  step = "look";
  clear(host);
  renderLook(host);
  window.scrollTo(0, 0);
}

/* ---------------------------------------------------------------- step 2: the look */

function renderLook(host) {
  host.appendChild(dots(2));
  host.appendChild(el("h1", { class: "ob-title", text: "Make it yours" }));
  host.appendChild(lookPicker());
  host.appendChild(el("button", { class: "btn primary block", type: "button",
    onclick: () => { step = "mode"; clear(host); renderMode(host); window.scrollTo(0, 0); } }, "Next"));
}

/* ---------------------------------------------------------------- step 2: how */

function renderMode(host) {
  host.appendChild(dots(3));
  host.appendChild(el("h1", { class: "ob-title", text: "How will you play?" }));
  const grid = el("div", { class: "ob-modes" });
  grid.appendChild(modeTile("oracle", "Alone", "The app runs the world", () => begin(true)));
  grid.appendChild(modeTile("talk", "With a group", "A referee runs the world", () => begin(false)));
  host.appendChild(grid);
}

function modeTile(ico, name, sub, onClick) {
  return el("button", { class: "ob-mode", type: "button", onclick: onClick },
    el("span", { class: "ob-mode-ico" }, artOrIcon(ico)),
    el("span", { class: "ob-mode-name", text: name }),
    el("span", { class: "ob-mode-sub", text: sub }));
}

function artOrIcon(key) {
  return key === "oracle" ? art("keyhole") : art("phone");
}

async function begin(solo) {
  step = "agent";
  if (solo) {
    if (!Settings.solo()) setSetting("solo", true);
    rebuildNav();
    const c = Store.activeCharacter();
    if (!Store.activeAdventure() || Store.activeAdventure().completedAt) {
      Store.createAdventure({ characterId: c ? c.id : null });
    }
  } else if (Settings.solo()) {
    setSetting("solo", false);
    rebuildNav();
  }
  navigate("mission");
}

function dots(n) {
  return el("div", { class: "ob-dots", role: "img", "aria-label": `Step ${n} of 3` },
    [1, 2, 3].map(i => el("span", { class: "ob-dot" + (i === n ? " on" : i < n ? " done" : "") })));
}
