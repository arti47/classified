/* mission.js — the mission feed (U5).
 *
 * Where the game is played: one screen, one stream, one button. The scene card at the top
 * says where you are; everything that happens lands below it as a card, newest first;
 * and the big button always says what comes next — Brief me, Start scene N, or What do you
 * do? — which opens the verbs as pictures rather than a list of named procedures.
 *
 * A conductor, like the coach: it owns no rule. Every verb is a call into the engine that
 * already runs it — the roller for Classified checks, solo.js for Fate, events, words and
 * the scene boundaries — so the procedures, their dialogs and their logging are unchanged.
 * Solo mode reads the adventure's journal; table mode reads this dossier's rolls.
 */

import { el, clear, art, icon, fmtDate } from "./core.js";
import { modal, showToast, chooseModal } from "./ui.js";
import * as Store from "./store.js";
import { Settings } from "./settings.js";
import * as S from "../data-solo.js";
import { QUALITY_NAMES } from "../data.js";
import { navigate } from "./router.js";
import { appendHelp, offerSolo } from "./help.js";

const FEED_LEN = 30;

/* Each journal kind and each roll as a pictogram, so a feed reads at a glance. */
const KIND_ICON = { scene: "flag", fate: "oracle", event: "event", meaning: "words", note: "words", check: "dice" };

let feedWatch = null;

export function renderMission(host) {
  clear(host);
  host.classList.add("mission-screen");
  appendHelp(host, "mission");

  const c = Store.activeCharacter();
  if (!c) {
    host.appendChild(el("div", { class: "empty" },
      el("div", { class: "big" }, art("agent")),
      el("h2", { text: "No agent yet" }),
      el("button", { class: "btn primary", type: "button", onclick: () => navigate("home") }, "Recruit an agent")));
    return;
  }

  if (Settings.solo()) renderSoloMission(host, c);
  else renderTableMission(host, c);

  // Rolls arrive from dialogs this screen does not own; the feed follows the store.
  if (feedWatch) document.removeEventListener("store:changed", feedWatch);
  feedWatch = () => {
    const feed = host.querySelector(".feed");
    if (!feed || !host.isConnected) { document.removeEventListener("store:changed", feedWatch); feedWatch = null; return; }
    const fresh = Settings.solo() ? soloFeed(Store.activeAdventure()) : tableFeed(Store.activeCharacter());
    feed.replaceWith(fresh);
  };
  document.addEventListener("store:changed", feedWatch);
}

/* ---------------------------------------------------------------- solo */

function renderSoloMission(host, c) {
  const adv = Store.activeAdventure();

  if (!adv) {
    host.appendChild(emptyCard("map", "No mission open", "New mission", () => newMission(c)));
    return;
  }
  if (adv.completedAt) {
    const outcome = adv.outcome && S.MISSION_OUTCOMES[adv.outcome] ? S.MISSION_OUTCOMES[adv.outcome].name : "Closed";
    host.appendChild(sceneCard(adv, { kicker: adv.name, big: "Mission closed", line: outcome }));
    host.appendChild(soloFeed(adv));
    host.appendChild(dock(
      bigButton("New mission", "mission", () => newMission(c)),
      el("button", { class: "btn ghost block", type: "button", onclick: () => navigate("advance") }, "Spend experience")));
    return;
  }

  host.appendChild(sceneCard(adv));
  if (adv.briefing) host.appendChild(briefSlip(adv));
  host.appendChild(soloFeed(adv));

  const phase = adv.scenePhase || "setup";
  if (phase === "briefing" || !adv.briefing) {
    host.appendChild(dock(bigButton("Brief me", "files", () => briefMe(adv))));
  } else if (phase === "setup") {
    host.appendChild(dock(bigButton(`Start scene ${adv.scene}`, "flag", () => withSolo(m => m.startScene(Store.activeAdventure())))));
  } else {
    host.appendChild(dock(bigButton("What do you do?", "agent", () => soloVerbs(adv, c))));
  }
}

function newMission(c) {
  Store.createAdventure({ characterId: c.id });
  navigate("mission", { replace: true });
}

function withSolo(fn) { return import("./solo.js").then(fn); }
function withRoller(fn) { return import("./roller.js").then(fn); }

/** The scene as a film would open it: a codename, a city in capitals, the place and the hour. */
function sceneCard(adv, over = {}) {
  const st = adv.sceneSetting;
  const phase = adv.scenePhase || "setup";
  const big = over.big || (st && st.city ? st.city : adv.city || (phase === "briefing" ? "Briefing" : "Between scenes"));
  const line = over.line || (st ? [st.place, st.time].filter(Boolean).join(" · ") : "");
  return el("div", { class: "scene-card" },
    el("div", { class: "sc-main" },
      el("span", { class: "sc-kicker", text: over.kicker || adv.name || "Untitled" }),
      el("span", { class: "sc-city", text: big }),
      line ? el("span", { class: "sc-line", text: line }) : null,
      el("span", { class: "sc-scene", text: phase === "play" ? `Scene ${adv.scene} · in play` : `Scene ${adv.scene}` })),
    chaosDial(adv.chaos));
}

/**
 * The Chaos Factor as a gauge: a needle on a nine-step arc, the number under it. A picture of
 * the number printed beside it, never a second source for it.
 */
export function chaosDial(chaos) {
  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", "0 0 100 60");
  svg.setAttribute("class", "chaos-dial-svg");
  svg.setAttribute("aria-hidden", "true");
  for (let i = 0; i < 9; i++) {
    const a0 = Math.PI * (1 - i / 9), a1 = Math.PI * (1 - (i + 1) / 9);
    const p = document.createElementNS(NS, "path");
    const r = 40, cx = 50, cy = 52;
    const pt = a => `${(cx + r * Math.cos(a)).toFixed(2)} ${(cy - r * Math.sin(a)).toFixed(2)}`;
    p.setAttribute("d", `M${pt(a0 - 0.03)} A${r} ${r} 0 0 1 ${pt(a1 + 0.03)}`);
    p.setAttribute("class", "cd-seg" + (i < chaos ? " on" : "") + (i >= 6 ? " hot" : ""));
    svg.appendChild(p);
  }
  const ang = Math.PI * (1 - (chaos - 0.5) / 9);
  const needle = document.createElementNS(NS, "path");
  needle.setAttribute("d", `M50 52 L${(50 + 30 * Math.cos(ang)).toFixed(2)} ${(52 - 30 * Math.sin(ang)).toFixed(2)}`);
  needle.setAttribute("class", "cd-needle");
  svg.appendChild(needle);
  return el("div", { class: "chaos-dial", title: `Chaos Factor ${chaos}`,
    role: "img", "aria-label": `Chaos Factor ${chaos}` },
    svg, el("span", { class: "cd-num", text: String(chaos) }), el("span", { class: "cd-k", text: "Chaos" }));
}

/** The briefing as a slip: what you are after, what is in the way, who you are, who is against you. */
function briefSlip(adv) {
  const r = adv.briefing.rows || {};
  const line = (ico, label, row) => row && row.text
    ? el("div", { class: "bs-row" }, el("span", { class: "bs-ico" }, icon(ico)),
        el("span", { class: "bs-k", text: label }), el("span", { class: "bs-v", text: row.text }))
    : null;
  return el("details", { class: "acc brief-slip" },
    el("summary", {}, el("span", { text: "Mission brief" }),
      el("span", { class: "small muted", text: (r.objective && r.objective.text) || "" })),
    el("div", { class: "acc-body" },
      line("flag", "After", r.objective),
      line("event", "In the way", r.complication),
      line("agent", "Cover", r.cover),
      line("oracle", "Heard", r.intel),
      line("skillcombat", "Against", r.opponent)));
}

/** Roll the whole briefing in one tap, then hand it over as a dossier. */
async function briefMe(adv) {
  const Solo = await import("./solo.js");
  const brief = await Solo.autoBriefing(adv);
  const line = (ico, k, v) => v ? el("div", { class: "bs-row" }, el("span", { class: "bs-ico" }, icon(ico)),
    el("span", { class: "bs-k", text: k }), el("span", { class: "bs-v", text: v })) : null;
  modal({
    title: "Your mission",
    body: el("div", { class: "brief-reveal" },
      el("div", { class: "br-code" }, el("span", { class: "stamp", text: "Top secret" }), el("b", { text: brief.codename })),
      line("flag", "After", brief.objective),
      line("event", "In the way", brief.complication),
      line("agent", "Cover", brief.cover),
      line("oracle", "Heard", brief.intel),
      line("skillcombat", "Against", brief.opponent),
      brief.hidden && brief.hidden.subject
        ? el("div", { class: "banner warn", style: "margin-top:10px" }, el("b", { text: "Something here is not what it seems." }))
        : null),
    actions: [{ label: "Start scene 1", kind: "primary",
      onClick: () => withSolo(m => m.startScene(Store.activeAdventure())) }]
  });
}

/* ---------------------------------------------------------------- the verbs */

function verbSheet(title, verbs) {
  let api = null;
  const grid = el("div", { class: "verbs" });
  for (const v of verbs) {
    if (!v) continue;
    grid.appendChild(el("button", {
      class: "verb" + (v.kind ? " is-" + v.kind : ""), type: "button",
      onclick: () => { api.close(); setTimeout(v.go, 30); }
    }, el("span", { class: "verb-ico" }, icon(v.icon)), el("span", { class: "verb-label", text: v.label })));
  }
  api = modal({ title, body: grid, actions: [] });
}

function soloVerbs(adv, c) {
  verbSheet("What do you do?", [
    { label: "Try something", icon: "dice", go: () => withRoller(m => m.openSkillPicker(c)) },
    { label: "Fight", icon: "skillcombat", go: () => withRoller(m => m.openWeaponPicker(c)) },
    { label: "Ask the oracle", icon: "oracle", go: () => fateDial(Store.activeAdventure()) },
    { label: "Something happens", icon: "event", go: () => withSolo(m => m.rollRandomEvent(Store.activeAdventure())) },
    { label: "Inspire me", icon: "words", go: () => wordsPicker() },
    { label: "Other moves", icon: "talk", go: () => withRoller(m => m.openQuickRoll(c)) },
    { label: "I'm hurt", icon: "hurt", go: () => withRoller(m => m.openTakeDamage(c)) },
    { label: "End the scene", icon: "flag", kind: "end", go: () => withSolo(m => m.endScene(Store.activeAdventure())) }
  ]);
}

/**
 * Fate as one dial: the question, then the odds on a slider from Impossible to Certain, with
 * the chance of a Yes drawn as a bar. The answer is the engine's own Fate dialog.
 */
export function fateDial(adv) {
  if (!adv) return;
  const order = [...S.FATE_ODDS].reverse();              // Impossible … Certain, left to right
  let idx = order.findIndex(o => o.key === S.FATE_DEFAULT_ODDS);
  const q = el("input", { type: "text", class: "fd-q", placeholder: "Is the guard asleep?" });
  const name = el("div", { class: "fd-odds" });
  const bar = el("div", { class: "fd-bar" }, el("span", { class: "fd-fill" }));
  const pct = el("div", { class: "fd-pct" });
  const range = el("input", { type: "range", min: "0", max: String(order.length - 1), step: "1",
    value: String(idx), class: "fd-range", "aria-label": "How likely is it?" });
  const draw = () => {
    const o = order[idx];
    name.textContent = S.oddsLabel(o.key, adv.fateMode);
    if (adv.fateMode === "check") {
      bar.hidden = true; pct.textContent = "";
    } else {
      const t = S.fateTarget(o.key, adv.chaos);
      bar.hidden = false;
      bar.firstChild.style.width = t + "%";
      pct.textContent = `Yes on ${t} or under`;
    }
  };
  range.addEventListener("input", () => { idx = Number(range.value); draw(); });
  draw();
  modal({
    title: "Ask the oracle",
    body: el("div", { class: "fate-dial" },
      q,
      el("div", { class: "fd-label", text: "How likely?" }),
      name, range,
      el("div", { class: "fd-ends" }, el("span", { text: "No way" }), el("span", { text: "Sure thing" })),
      bar, pct),
    actions: [{ label: "Ask", kind: "primary",
      onClick: () => withSolo(m => m.askFate(Store.activeAdventure(), order[idx].key, q.value)) }]
  });
}

/* The tables a scene reaches for most, as six pictures; the full shelf is on the case board. */
const QUICK_WORDS = [
  { key: "espScene", label: "A scene", icon: "flag" },
  { key: "espAction", label: "An action", icon: "physical" },
  { key: "espAdversary", label: "A person", icon: "agent" },
  { key: "espLocation", label: "A place", icon: "travel" },
  { key: "espObject", label: "A thing", icon: "gear" },
  { key: "espTwist", label: "A twist", icon: "event" }
];

function wordsPicker() {
  verbSheet("Inspire me", [
    ...QUICK_WORDS.filter(w => S.MEANING_BY_KEY[w.key]).map(w => ({ label: w.label, icon: w.icon,
      go: () => withSolo(m => m.rollMeaning(Store.activeAdventure(), w.key)) })),
    { label: "Every table", icon: "board", go: () => withSolo(m => { m.setSoloPage("oracle"); navigate("solo"); }) }
  ]);
}

/* ---------------------------------------------------------------- the feed */

function soloFeed(adv) {
  const feed = el("div", { class: "feed", "aria-live": "polite" });
  const rows = adv ? [...(adv.journal || [])].slice(0, FEED_LEN) : [];
  if (!rows.length) {
    feed.appendChild(el("div", { class: "feed-empty" }, art("typewriter"), el("span", { text: "Nothing has happened yet." })));
    return feed;
  }
  for (const j of rows) feed.appendChild(feedCard(KIND_ICON[j.kind] || "words", j.text, j.detail, j.ts, j.kind,
    j.quality ? QUALITY_NAMES[j.quality] : stampFor(j)));
  return feed;
}

/* A Fate answer lands as a stamp: the engine writes it as the end of the line. */
function stampFor(j) {
  if (j.kind !== "fate") return null;
  const m = /—\s*([^—]+)$/.exec(j.text || "");
  return m ? m[1].trim() : null;
}

function feedCard(ico, text, detail, ts, kind, stamp) {
  const yes = stamp && /^(exceptional )?yes|superb|great|good|fair/i.test(stamp);
  return el("div", { class: "feed-card k-" + (kind || "note") },
    el("span", { class: "fc-ico" }, icon(ico)),
    el("div", { class: "fc-body" },
      el("div", { class: "fc-text", text: stamp ? text.replace(/\s*—\s*[^—]+$/, "").replace(/:\s*[^:]+$/, m => (kind === "check" ? "" : m)) : text }),
      detail ? el("div", { class: "fc-detail", text: detail }) : null),
    stamp ? el("span", { class: "fc-stamp " + (yes ? "is-yes" : "is-no"), text: stamp }) : null);
}

/* ---------------------------------------------------------------- table */

function renderTableMission(host, c) {
  const fight = Store.combatState();
  host.appendChild(el("div", { class: "scene-card" },
    el("div", { class: "sc-main" },
      el("span", { class: "sc-kicker", text: "Field operation" }),
      el("span", { class: "sc-city", text: fight && fight.active ? `Round ${fight.round}` : "In the field" }),
      el("span", { class: "sc-line", text: fight && fight.active
        ? (fight.phase === "declaration" ? "Declaration" : "Action") + ` · ${(fight.combatants || []).length} in the fight`
        : "Your referee runs the world" }))));
  host.appendChild(tableFeed(c));
  host.appendChild(dock(
    bigButton("What do you do?", "agent", () => tableVerbs(c)),
    el("button", { class: "link-btn solo-offer", type: "button", onclick: () => offerSolo() }, "Playing alone? Let the app run the world →")));
}

function tableVerbs(c) {
  verbSheet("What do you do?", [
    { label: "Try something", icon: "dice", go: () => withRoller(m => m.openSkillPicker(c)) },
    { label: "Fight", icon: "skillcombat", go: () => withRoller(m => m.openWeaponPicker(c)) },
    { label: "Other moves", icon: "talk", go: () => withRoller(m => m.openQuickRoll(c)) },
    { label: "I'm hurt", icon: "hurt", go: () => withRoller(m => m.openTakeDamage(c)) },
    { label: "Encounter", icon: "combat", go: () => navigate("combat") },
    { label: "Wrap up", icon: "flag", kind: "end", go: () => wrapUp() }
  ]);
}

async function wrapUp() {
  const key = await chooseModal("Wrap up", [
    { key: "session", label: "End the session" },
    { key: "mission", label: "End the mission" }
  ]);
  if (key) import("./combat.js").then(m => m.runLifecycle(key, null));
}

function tableFeed(c) {
  const feed = el("div", { class: "feed", "aria-live": "polite" });
  const rows = c ? Store.rollLog().filter(r => r.characterId === c.id && !r.solo).slice(0, FEED_LEN) : [];
  if (!rows.length) {
    feed.appendChild(el("div", { class: "feed-empty" }, art("typewriter"), el("span", { text: "No rolls yet." })));
    return feed;
  }
  for (const r of rows) {
    feed.appendChild(feedCard("dice", r.label,
      `${r.roll}${r.successChance != null ? ` vs ${r.successChance}` : ""} · ${fmtDate(r.ts)}`, r.ts, "check",
      QUALITY_NAMES[r.quality] || null));
  }
  return feed;
}

/* ---------------------------------------------------------------- pieces */

function bigButton(label, ico, go) {
  return el("button", { class: "big-go", type: "button", onclick: go }, icon(ico), el("span", { text: label }));
}

function dock(...children) {
  return el("div", { class: "mission-dock" }, ...children);
}

function emptyCard(artKey, title, action, go) {
  return el("div", { class: "empty" },
    el("div", { class: "big" }, art(artKey)),
    el("h2", { text: title }),
    el("button", { class: "btn primary", type: "button", onclick: go }, action));
}
