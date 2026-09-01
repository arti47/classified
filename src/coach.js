/* coach.js — the guided player: the app running the game for you, one beat at a time.
 *
 * The play guide (help.js) tells a player what to do. This one does it with them: a single
 * instruction, a single button, recomputed after every action, from "you have no character"
 * all the way to "mission closed and paid". A player who will not read a manual will not read
 * a guide either, so nothing here asks to be read — it asks to be tapped.
 *
 * Module discipline (CLAUDE.md §5.1): this is a *conductor*, not an engine. It owns no rule
 * and no oracle. It imports core, ui, store, settings and data-help statically, and reaches
 * the two engines — `solo.js` for Mythic, `roller.js` and `wizard.js` for Classified — by
 * dynamic import at the moment the player asks for them, which is the same crossing the
 * briefing's NPC generator makes under ruling S15.
 */

import { el, clear } from "./core.js";
import { modal, showToast, confirmModal } from "./ui.js";
import { Settings, set as setSetting } from "./settings.js";
import * as Store from "./store.js";
import { COACH } from "../data-help.js";

/* ---------------------------------------------------------------- state */

/**
 * Which beat the player is on. Derived, never stored: the coach must agree with the rest of
 * the app whatever route the player took to get here, including doing half of it by hand.
 */
export function currentBeat() {
  const c = Store.activeCharacter();
  if (!c) return "character";

  const adv = Store.activeAdventure();
  if (!adv || adv.completedAt) {
    // A closed mission is a finished game, not a missing one.
    if (adv && adv.completedAt) return "done";
    return "adventure";
  }
  if (adv.scenePhase === "briefing" || !adv.briefing) return "briefing";
  if (adv.scenePhase === "play") return "play";
  return adv.scene > 1 ? "ended" : "scene";
}

function say(beat) { return COACH.beats[beat] || COACH.beats.character; }

/* ---------------------------------------------------------------- the card */

/**
 * The whole guided player, as one card. Rendered by the Play screen and at the top of Solo,
 * so wherever the player is looking there is one instruction in front of them.
 *
 * @param {HTMLElement} host
 * @param {object} [opts] compact — the Solo screen's copy, which loses the blurb
 */
export function renderCoach(host, opts = {}) {
  const beat = currentBeat();
  const copy = say(beat);
  const card = el("div", { class: "card coach" + (opts.compact ? " is-compact" : "") });

  if (!opts.compact) {
    card.appendChild(el("div", { class: "field-label", text: COACH.title }));
  }
  card.appendChild(el("h2", { class: "coach-say", text: copy.say }));
  card.appendChild(el("p", { class: "small muted", style: "margin:4px 0 0", text: copy.why }));

  const body = el("div", { style: "margin-top:12px" });
  card.appendChild(body);
  drawBeat(body, beat, host, opts);

  host.appendChild(card);
  return card;
}

/** Redraw wherever the coach is mounted, so a beat never lags behind the state. */
function again(host, opts) {
  document.dispatchEvent(new CustomEvent("app:rerender"));
  if (host && host.isConnected && !opts.compact) {
    // The Play screen is the coach and nothing else, so it can redraw itself immediately
    // rather than waiting for the router.
    const existing = host.querySelector(".coach");
    if (existing) {
      const parent = existing.parentNode;
      existing.remove();
      const fresh = el("div", {});
      renderCoach(fresh, opts);
      parent.insertBefore(fresh.firstChild, parent.firstChild);
    }
  }
}

function primary(label, onClick) {
  return el("button", { class: "btn primary block coach-go", type: "button", onclick: onClick }, label);
}
function ghost(label, onClick) {
  return el("button", { class: "btn ghost block", type: "button", style: "margin-top:8px", onclick: onClick }, label);
}

function drawBeat(body, beat, host, opts) {
  const copy = say(beat);

  if (beat === "character") {
    body.appendChild(primary(copy.primary, () => takeReadyMade(host, opts)));
    body.appendChild(ghost(copy.secondary, () =>
      import("./router.js").then(m => m.navigate("create"))));
    return;
  }

  if (beat === "adventure") {
    body.appendChild(primary(copy.primary, () => startMission(host, opts)));
    return;
  }

  if (beat === "briefing") {
    body.appendChild(primary(copy.primary, () => rollMission(host, opts)));
    return;
  }

  if (beat === "scene") {
    const adv = Store.activeAdventure();
    const input = el("input", { type: "text", placeholder: copy.placeholder });
    body.appendChild(el("label", { class: "field" },
      el("span", { text: `Scene ${adv.scene}` }), input));
    body.appendChild(primary(copy.primary, () => openScene(input.value, host, opts)));
    return;
  }

  if (beat === "ended") {
    const adv = Store.activeAdventure();
    const input = el("input", { type: "text", placeholder: say("scene").placeholder });
    body.appendChild(el("label", { class: "field" },
      el("span", { text: `Scene ${adv.scene} — what now?` }), input));
    body.appendChild(primary(copy.primary, () => openScene(input.value, host, opts)));
    body.appendChild(ghost(say("wrap").primary, () => wrapUp(host, opts)));
    return;
  }

  if (beat === "play") {
    for (const o of copy.options) {
      body.appendChild(el("button", {
        class: "opt-btn", type: "button", onclick: () => inScene(o.key, host, opts)
      },
        el("span", { class: "on-name" }, el("span", { text: o.label })),
        el("span", { class: "on-desc", text: o.sub })));
    }
    body.appendChild(primary(copy.finish, () => finishScene(host, opts)));
    return;
  }

  if (beat === "done") {
    body.appendChild(primary(copy.primary, () => startMission(host, opts)));
    body.appendChild(ghost(copy.secondary, () =>
      import("./router.js").then(m => m.navigate("advance"))));
  }
}

/* ---------------------------------------------------------------- the beats */

/** A playable agent in one tap. The published samples are legal, complete and immediate. */
async function takeReadyMade(host, opts) {
  const { PREGENS } = await import("../data-pregens.js");
  const { instantiatePregen } = await import("./wizard.js");
  const pick = PREGENS[Math.floor(Math.random() * PREGENS.length)];
  // instantiatePregen builds the dossier; saving it is the caller's job.
  const saved = Store.saveCharacter(instantiatePregen(pick));
  Store.setActive(saved.id);
  showToast(`${saved.identity.name} is ready`, "ok");
  again(host, opts);
}

/** Everything a mission needs, including the toggle that makes solo play possible at all. */
async function startMission(host, opts) {
  if (!Settings.solo()) setSetting("solo", true);
  const c = Store.activeCharacter();
  Store.createAdventure({ characterId: c ? c.id : null });
  await rollMission(host, opts);
}

/** Roll the briefing and say what it means, in the words the player would use. */
async function rollMission(host, opts) {
  const Solo = await import("./solo.js");
  const adv = Store.activeAdventure();
  if (!adv) return;
  const brief = await Solo.autoBriefing(adv);

  const body = el("div", {});
  const line = (label, text) => el("p", { class: "small", style: "margin:0 0 8px" },
    el("b", { text: label + " " }), text);
  body.appendChild(el("div", { class: "banner ok" },
    el("b", { text: brief.codename }),
    el("div", { class: "small", text: "Your mission, rolled and ready." })));
  body.appendChild(line("What you are after:", brief.objective));
  body.appendChild(line("What is in the way:", brief.complication));
  body.appendChild(line("Who you are pretending to be:", brief.cover));
  body.appendChild(line("What you were told:", brief.intel));
  body.appendChild(line("Who is against you:", brief.opponent));
  if (brief.hidden && brief.hidden.subject) {
    body.appendChild(el("div", { class: "banner warn" },
      el("b", { text: "Something is not what it looks like" }),
      el("div", { class: "small", text: brief.hidden.text })));
  }
  for (const t of COACH.briefingSaid) body.appendChild(el("p", { class: "small muted", text: t }));

  modal({
    title: "Your mission", body,
    actions: [{ label: "Start scene 1", kind: "primary", onClick: () => again(host, opts) }]
  });
}

/** Open the scene the player just described, letting the Mythic chain do its own dialogs. */
async function openScene(expected, host, opts) {
  const text = (expected || "").trim();
  if (!text) { showToast("Say what you are about to do first", "err"); return; }
  const Solo = await import("./solo.js");
  await Solo.startScene(Store.activeAdventure(), { expected: text });
  again(host, opts);
}

/**
 * The three things a player can want mid-scene, and the tool each one is. This is the beat
 * that matters: "what do I do now" is a question about *which* tool, and the answer is a
 * plain-English choice rather than a screen of named procedures.
 */
async function inScene(kind, host, opts) {
  const adv = Store.activeAdventure();
  const c = Store.activeCharacter();

  if (kind === "do") {
    if (!c) { showToast("No dossier open", "err"); return; }
    const { openSkillPicker } = await import("./roller.js");
    openSkillPicker(c);
    return;
  }

  if (kind === "idea") {
    const Solo = await import("./solo.js");
    await Solo.rollMeaning(adv, "espScene");
    return;
  }

  // "Is something true?" — the question, then how likely it feels, in words.
  const copy = say("ask");
  const input = el("input", { type: "text", placeholder: copy.placeholder });
  let odds = "fifty";
  const wrap = el("div", { class: "chip-wrap" });
  const draw = () => {
    clear(wrap);
    for (const o of copy.odds) {
      wrap.appendChild(el("button", {
        class: "chip" + (odds === o.key ? " on" : ""), type: "button",
        onclick: () => { odds = o.key; draw(); }
      }, o.label));
    }
  };
  draw();

  const body = el("div", {},
    el("label", { class: "field" }, el("span", { text: copy.say }), input),
    el("div", { class: "field-label", style: "margin-top:12px", text: "How likely is it?" }),
    wrap,
    el("p", { class: "small muted", style: "margin-top:8px", text: copy.why }));

  const ok = await confirmModal(body, { title: "Ask", okLabel: copy.primary });
  if (!ok) return;

  const Solo = await import("./solo.js");
  await Solo.askFate(Store.activeAdventure(), odds, input.value.trim());
}

/** Close the scene through the Mythic boundary, which owns the bookkeeping. */
async function finishScene(host, opts) {
  const Solo = await import("./solo.js");
  await Solo.endScene(Store.activeAdventure());
  again(host, opts);
}

/** End the mission through the same boundary the Solo screen uses. */
async function wrapUp(host, opts) {
  const Solo = await import("./solo.js");
  await Solo.endMission(Store.activeAdventure());
  again(host, opts);
}
