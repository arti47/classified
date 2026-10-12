/* beat.js — the story beat (CLAUDE.md §3.20.7).
 *
 * A solo journal row is a result: a Fate answer, a check, an event, a pair of words, a scene
 * opening. On its own that is a log of dice. A beat is that row with the player's own line
 * under it — "What happens?" — so the journal reads as the story the dice were for. This module
 * decides which rows are beats, offers the half-sentence to start from, saves the line, and
 * names the moves that fit the result. It owns no rule: the moves open procedures that already
 * exist, the starters and moves are copy in `data-help.js`, and nothing here touches a number.
 */

import { el } from "./core.js";
import { modal, showToast } from "./ui.js";
import * as Store from "./store.js";
import { BEAT_STARTERS, NEXT_MOVES } from "../data-help.js";

/** What kind of beat a journal row is, or null when it is bookkeeping rather than a result. */
export function beatOutcome(j) {
  if (!j) return null;
  const text = j.text || "";
  if (j.kind === "fate") {
    const m = /—\s*([^—]+)$/.exec(text);
    const a = (m ? m[1] : "").trim().toLowerCase();
    if (a.startsWith("exceptional yes")) return "exyes";
    if (a.startsWith("exceptional no")) return "exno";
    if (a.startsWith("yes")) return "yes";
    if (a.startsWith("no")) return "no";
    return null;
  }
  if (j.kind === "check") {
    const q = Number(j.quality);
    if (q === 1) return "superb";
    if (q >= 2 && q <= 4) return "success";
    if (q === 5) return "fail";
    return null;
  }
  if (j.kind === "event") return /^Random Event/.test(text) ? "event" : null;
  if (j.kind === "meaning") return "meaning";
  if (j.kind === "scene") {
    if (/^Scene adjustment/.test(text)) return "adjust";
    if (/^Scene \d+ —/.test(text)) return "scene";
  }
  return null;
}

/** The half-sentence the writing box opens with, built from the result. */
export function beatStarter(j) {
  const key = beatOutcome(j);
  if (!key) return "";
  const words = j.kind === "meaning" ? (j.text.split(":").slice(1).join(":").trim()) : "";
  return (BEAT_STARTERS[key] || "").replace("{words}", words);
}

export function nextMoves(j) {
  const key = beatOutcome(j);
  return key ? (NEXT_MOVES[key] || []) : [];
}

/** Save the player's line on a row; an empty line clears it. `skipped` marks a beat passed over. */
export function writeBeat(id, text, { skipped = false } = {}) {
  return Store.updateAdventure(a => {
    const j = (a.journal || []).find(x => x.id === id);
    if (!j) return;
    const t = String(text || "").trim();
    j.story = t;
    j.skipped = !t && skipped;
  });
}

/** A starter left untouched says nothing the result did not, so it is not saved as writing. */
function cleaned(box, starter) {
  const v = box.value.trim();
  return v === starter.trim() ? "" : v;
}

function field(j) {
  const starter = beatStarter(j);
  const box = el("textarea", { class: "beat-box", rows: "3", "aria-label": "What happens?",
    placeholder: "What happens?" });
  box.value = j.story || starter;
  return { box, starter };
}

/**
 * The writing box inline, under the newest beat on the Mission. `done` runs after a save or a
 * skip; the feed then redraws from the store.
 */
export function beatWriter(j, { focus = false } = {}) {
  const { box, starter } = field(j);
  const wrap = el("div", { class: "beat-writer" },
    el("label", { class: "beat-k", text: "What happens?" }),
    box,
    el("div", { class: "beat-actions" },
      el("button", { class: "btn ghost sm", type: "button", onclick: () => writeBeat(j.id, "", { skipped: true }) }, "Skip"),
      el("button", { class: "btn primary sm", type: "button",
        onclick: () => {
          const t = cleaned(box, starter);
          if (!t) { box.focus(); showToast("Write a line, or Skip"); return; }
          writeBeat(j.id, t);
        } }, "Write it")));
  // Put the caret at the end of the starter, ready to finish the sentence.
  requestAnimationFrame(() => { if (focus && box.isConnected && !document.querySelector(".modal")) {
    box.focus({ preventScroll: true }); box.setSelectionRange(box.value.length, box.value.length); } });
  return wrap;
}

/** The same box in a dialog, for any row tapped later — on the Mission or the Case board. */
export function openBeatWriter(j) {
  if (!j) return;
  const { box, starter } = field(j);
  const actions = [];
  if (j.story) actions.push({ label: "Clear", kind: "ghost", onClick: () => writeBeat(j.id, "") });
  actions.push({ label: "Save", kind: "primary", onClick: () => {
    writeBeat(j.id, cleaned(box, starter));
  } });
  modal({
    title: "What happens?",
    body: el("div", { class: "beat-modal" },
      el("div", { class: "beat-result", text: j.text }),
      j.detail ? el("div", { class: "small muted", text: j.detail }) : null,
      box),
    actions
  });
  requestAnimationFrame(() => { box.focus(); box.setSelectionRange(box.value.length, box.value.length); });
}

/** One line of text for a row: the player's words, then the result that prompted them. */
export function beatText(j) {
  return j.story ? `${j.story}\n(${j.text})` : j.text;
}
