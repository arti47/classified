/* store.js — local/cloud character persistence, roll log, JSON export/import. */

import { STORAGE_PREFIX, uid, deepClone, SCHEMA_VERSION } from "./core.js";
import { normalize, blankCharacter } from "./derived.js";
import * as Sync from "./sync.js";

const K_CHARS = STORAGE_PREFIX + "characters";
const K_ACTIVE = STORAGE_PREFIX + "activeCharacter";
const K_LOG = STORAGE_PREFIX + "rollLog";
const K_COMBAT = STORAGE_PREFIX + "combat";
const K_TASKS = STORAGE_PREFIX + "tasks";
const K_UNDO = STORAGE_PREFIX + "lifecycleUndo";
const K_SOLO = STORAGE_PREFIX + "soloAdventures";
const K_SOLO_ACTIVE = STORAGE_PREFIX + "soloActive";
const K_SOLO_UNDO = STORAGE_PREFIX + "soloUndo";

export const ROLL_LOG_CAP = 100;

const listeners = new Set();
export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function emit(what) {
  for (const fn of listeners) { try { fn(what); } catch (e) { console.error(e); } }
  document.dispatchEvent(new CustomEvent("store:changed", { detail: { what } }));
}

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}
function writeJSON(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; }
  catch { return false; }
}

/* ---------------------------------------------------------------- characters */

export function allCharacters() {
  return readJSON(K_CHARS, []).map(normalize);
}

export function getCharacter(id) {
  return allCharacters().find(c => c.id === id) || null;
}

export function activeId() { return localStorage.getItem(K_ACTIVE) || null; }

export function activeCharacter() {
  const id = activeId();
  if (!id) return null;
  return getCharacter(id);
}

export function setActive(id) {
  if (id) localStorage.setItem(K_ACTIVE, id);
  else localStorage.removeItem(K_ACTIVE);
  emit("active");
}

export function saveCharacter(c) {
  const list = readJSON(K_CHARS, []);
  const clean = normalize(c);
  clean.updatedAt = Date.now();
  clean.schema = SCHEMA_VERSION;
  const i = list.findIndex(x => x.id === clean.id);
  if (i >= 0) list[i] = clean; else list.push(clean);
  writeJSON(K_CHARS, list);
  Sync.pushCharacter(clean);
  emit("character");
  return clean;
}

export function createCharacter(rank = "rookie") {
  const c = blankCharacter(rank);
  saveCharacter(c);
  setActive(c.id);
  return c;
}

export function deleteCharacter(id) {
  const list = readJSON(K_CHARS, []).filter(c => c.id !== id);
  writeJSON(K_CHARS, list);
  if (activeId() === id) setActive(list.length ? list[0].id : null);
  emit("character");
}

/** Mutate the active character through a callback and persist the result. */
export function updateActive(mutator) {
  const c = activeCharacter();
  if (!c) return null;
  mutator(c);
  return saveCharacter(c);
}

/* ---------------------------------------------------------------- roll log */

export function rollLog() { return readJSON(K_LOG, []); }

export function addRoll(entry) {
  const log = readJSON(K_LOG, []);
  const row = { id: uid("roll"), ts: Date.now(), ...entry };
  log.unshift(row);
  if (log.length > ROLL_LOG_CAP) log.length = ROLL_LOG_CAP;
  writeJSON(K_LOG, log);
  Sync.pushRoll(row);
  emit("log");
  return row;
}

export function clearLog() { writeJSON(K_LOG, []); emit("log"); }

/**
 * Drop a single roll by id. Used when a solo re-roll supersedes the roll it replaced, so the
 * log shows the reading that was kept rather than every attempt.
 */
export function removeRoll(id) {
  if (!id) return;
  writeJSON(K_LOG, readJSON(K_LOG, []).filter(r => r.id !== id));
  emit("log");
}

/* ---------------------------------------------------------------- combat */

export function combatState() {
  return readJSON(K_COMBAT, { active: false, round: 0, combatants: [], phase: "declaration", declarationOrder: [] });
}
export function saveCombat(state) {
  writeJSON(K_COMBAT, state);
  Sync.pushCombat(state);
  emit("combat");
  return state;
}
export function clearCombat() {
  writeJSON(K_COMBAT, { active: false, round: 0, combatants: [], phase: "declaration", declarationOrder: [] });
  emit("combat");
}

/* ---------------------------------------------------------------- tasks */

export function tasks() { return readJSON(K_TASKS, []); }
export function saveTask(task) {
  const list = readJSON(K_TASKS, []);
  const i = list.findIndex(t => t.id === task.id);
  if (i >= 0) list[i] = task; else list.push(task);
  writeJSON(K_TASKS, list);
  emit("tasks");
  return task;
}
export function deleteTask(id) {
  writeJSON(K_TASKS, readJSON(K_TASKS, []).filter(t => t.id !== id));
  emit("tasks");
}

/* ---------------------------------------------------------------- solo adventures */

/* The Mythic layer's state (CLAUDE.md §3.20, §6). Kept beside the characters rather than
 * inside them, so a dossier can be played solo and then handed to a table without carrying
 * oracle state with it. Local only: Mythic replaces the GM, and a synced campaign has one,
 * so nothing here is ever pushed. */

export function normalizeAdventure(a) {
  const src = a && typeof a === "object" ? a : {};
  const clampChaos = n => Math.max(1, Math.min(9, Number(n) || 5));
  return {
    id: src.id || uid("adv"),
    schema: SCHEMA_VERSION,
    name: src.name || "Untitled adventure",
    createdAt: Number(src.createdAt) || Date.now(),
    updatedAt: Number(src.updatedAt) || Date.now(),
    characterId: src.characterId || null,
    fateMode: src.fateMode === "check" ? "check" : "chart",
    chaos: clampChaos(src.chaos),
    scene: Math.max(1, Number(src.scene) || 1),
    // Where the current scene stands, so the screen can offer the next step in the loop
    // rather than every step at once. A version-4 record has no phase and starts at setup.
    scenePhase: src.scenePhase === "play" ? "play" : "setup",
    sceneExpected: typeof src.sceneExpected === "string" ? src.sceneExpected : "",
    sceneKind: ["expected", "altered", "interrupt"].includes(src.sceneKind) ? src.sceneKind : null,
    threads: normalizeList(src.threads),
    characters: normalizeList(src.characters),
    journal: Array.isArray(src.journal)
      ? src.journal.map(e => ({
          id: e.id || uid("j"),
          ts: Number(e.ts) || Date.now(),
          kind: e.kind || "note",
          text: e.text || "",
          detail: e.detail || ""
        }))
      : []
  };
}

function normalizeList(list) {
  if (!Array.isArray(list)) return [];
  return list.slice(0, 25).map(i => ({
    id: i.id || uid("li"),
    text: i.text || "",
    weight: Math.max(1, Math.min(9, Number(i.weight) || 1))
  }));
}

export function soloAdventures() {
  return readJSON(K_SOLO, []).map(normalizeAdventure);
}

export function getAdventure(id) {
  return soloAdventures().find(a => a.id === id) || null;
}

export function activeAdventureId() { return localStorage.getItem(K_SOLO_ACTIVE) || null; }

export function activeAdventure() {
  const list = soloAdventures();
  if (!list.length) return null;
  const id = activeAdventureId();
  return list.find(a => a.id === id) || list[0];
}

export function setActiveAdventure(id) {
  if (id) localStorage.setItem(K_SOLO_ACTIVE, id);
  else localStorage.removeItem(K_SOLO_ACTIVE);
  emit("solo");
}

export function saveAdventure(adv) {
  const list = readJSON(K_SOLO, []);
  const clean = normalizeAdventure(adv);
  clean.updatedAt = Date.now();
  const i = list.findIndex(a => a.id === clean.id);
  if (i >= 0) list[i] = clean; else list.push(clean);
  writeJSON(K_SOLO, list);
  emit("solo");
  return clean;
}

export function createAdventure({ name = "Untitled adventure", characterId = null } = {}) {
  const adv = normalizeAdventure({ name, characterId });
  saveAdventure(adv);
  setActiveAdventure(adv.id);
  return adv;
}

export function deleteAdventure(id) {
  const list = readJSON(K_SOLO, []).filter(a => a.id !== id);
  writeJSON(K_SOLO, list);
  if (activeAdventureId() === id) setActiveAdventure(list.length ? list[0].id : null);
  emit("solo");
}

/** Mutate the active adventure through a callback and persist the result. */
export function updateAdventure(mutator) {
  const adv = activeAdventure();
  if (!adv) return null;
  mutator(adv);
  return saveAdventure(adv);
}

/* Solo keeps its own one-step undo so an End Scene and an End Mission never overwrite
 * each other's snapshot. */
export function soloSnapshot() {
  return { ts: Date.now(), adventures: readJSON(K_SOLO, []), active: activeAdventureId() };
}
export function pushSoloUndo(snapshot) { writeJSON(K_SOLO_UNDO, snapshot); emit("solo"); }
export function peekSoloUndo() { return readJSON(K_SOLO_UNDO, null); }
export function clearSoloUndo() { localStorage.removeItem(K_SOLO_UNDO); emit("solo"); }

export function applySoloUndo() {
  const snap = peekSoloUndo();
  if (!snap) return false;
  writeJSON(K_SOLO, snap.adventures || []);
  if (snap.active) localStorage.setItem(K_SOLO_ACTIVE, snap.active);
  clearSoloUndo();
  emit("solo");
  return true;
}

/* ---------------------------------------------------------------- lifecycle undo */

export function pushUndo(snapshot) { writeJSON(K_UNDO, snapshot); emit("undo"); }
export function peekUndo() { return readJSON(K_UNDO, null); }
export function clearUndo() { localStorage.removeItem(K_UNDO); emit("undo"); }

/** Restore the last lifecycle snapshot. */
export function applyUndo() {
  const snap = peekUndo();
  if (!snap) return false;
  if (snap.characters) writeJSON(K_CHARS, snap.characters);
  if (snap.combat) writeJSON(K_COMBAT, snap.combat);
  if (snap.tasks) writeJSON(K_TASKS, snap.tasks);
  clearUndo();
  emit("character");
  return true;
}

export function snapshot() {
  return {
    ts: Date.now(),
    characters: readJSON(K_CHARS, []),
    combat: readJSON(K_COMBAT, null),
    tasks: readJSON(K_TASKS, [])
  };
}

/* ---------------------------------------------------------------- backup */

export function exportJSON() {
  return JSON.stringify({
    app: "classified-player",
    schema: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    characters: readJSON(K_CHARS, []),
    rollLog: readJSON(K_LOG, []),
    combat: readJSON(K_COMBAT, null),
    tasks: readJSON(K_TASKS, []),
    soloAdventures: readJSON(K_SOLO, []),
    soloActive: activeAdventureId(),
    settings: readJSON(STORAGE_PREFIX + "settings", {})
  }, null, 2);
}

export function downloadBackup() {
  const blob = new Blob([exportJSON()], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `classified-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Import a backup.
 * @param {string} text raw JSON
 * @param {"merge"|"replace"} mode
 */
export function importJSON(text, mode = "merge") {
  const data = JSON.parse(text);
  if (!data || !Array.isArray(data.characters)) throw new Error("Not a Classified Player backup.");

  const incoming = data.characters.map(normalize);
  if (mode === "replace") {
    writeJSON(K_CHARS, incoming);
    if (Array.isArray(data.rollLog)) writeJSON(K_LOG, data.rollLog.slice(0, ROLL_LOG_CAP));
    if (data.combat) writeJSON(K_COMBAT, data.combat);
    if (Array.isArray(data.tasks)) writeJSON(K_TASKS, data.tasks);
    if (data.settings) writeJSON(STORAGE_PREFIX + "settings", data.settings);
    writeJSON(K_SOLO, (data.soloAdventures || []).map(normalizeAdventure));
    if (data.soloActive) localStorage.setItem(K_SOLO_ACTIVE, data.soloActive);
  } else {
    const existing = readJSON(K_CHARS, []);
    const byId = new Map(existing.map(c => [c.id, c]));
    for (const c of incoming) {
      if (byId.has(c.id)) {
        const cur = byId.get(c.id);
        if ((c.updatedAt || 0) >= (cur.updatedAt || 0)) byId.set(c.id, c);
      } else {
        byId.set(c.id, c);
      }
    }
    writeJSON(K_CHARS, Array.from(byId.values()));

    // Solo adventures merge on the same newest-wins rule. A version-3 backup has none.
    if (Array.isArray(data.soloAdventures)) {
      const advById = new Map(readJSON(K_SOLO, []).map(a => [a.id, a]));
      for (const a of data.soloAdventures.map(normalizeAdventure)) {
        const cur = advById.get(a.id);
        if (!cur || (a.updatedAt || 0) >= (cur.updatedAt || 0)) advById.set(a.id, a);
      }
      writeJSON(K_SOLO, Array.from(advById.values()));
    }
  }

  const list = readJSON(K_CHARS, []);
  if (!activeId() && list.length) setActive(list[0].id);
  emit("character");
  return incoming.length;
}

/** Duplicate a character, e.g. before a risky mission. */
export function duplicateCharacter(id) {
  const c = getCharacter(id);
  if (!c) return null;
  const copy = deepClone(c);
  copy.id = uid("char");
  copy.identity.name = (copy.identity.name || "Agent") + " (copy)";
  copy.createdAt = Date.now();
  return saveCharacter(copy);
}
