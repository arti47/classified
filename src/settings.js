/* settings.js — feature and content toggles. Off by default unless noted. */

import { STORAGE_PREFIX } from "./core.js";

const KEY = STORAGE_PREFIX + "settings";

const DEFAULTS = {
  theme: "system",              // system | light | dark
  campaignStyle: "adventurous", // the book's default style
  gmScreen: false,
  manualDice: false,            // enter physical dice results instead of rolling
  showUntrained: true,
  autoConditions: true,         // apply wound/exhaustion DF modifiers automatically
  heroPointPrompt: true,        // offer Hero Point spends after each roll
  multiplayer: false,
  seatbelts: true,
  airbags: true,
  solo: false                   // the Mythic solo layer, a second system (CLAUDE.md §3.20)
};

let cache = null;

function load() {
  if (cache) return cache;
  try {
    cache = { ...DEFAULTS, ...(JSON.parse(localStorage.getItem(KEY) || "{}")) };
  } catch {
    cache = { ...DEFAULTS };
  }
  return cache;
}

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(cache)); } catch { /* storage full or blocked */ }
}

export function get(key) { return load()[key]; }

export function set(key, value) {
  load();
  cache[key] = value;
  save();
  document.dispatchEvent(new CustomEvent("settings:changed", { detail: { key, value } }));
}

export function all() { return { ...load() }; }

export function reset() { cache = { ...DEFAULTS }; save(); }

export const Settings = {
  theme: () => get("theme"),
  campaignStyle: () => get("campaignStyle"),
  gmScreen: () => !!get("gmScreen"),
  manualDice: () => !!get("manualDice"),
  showUntrained: () => !!get("showUntrained"),
  autoConditions: () => !!get("autoConditions"),
  heroPointPrompt: () => !!get("heroPointPrompt"),
  multiplayer: () => !!get("multiplayer"),
  seatbelts: () => !!get("seatbelts"),
  airbags: () => !!get("airbags"),
  solo: () => !!get("solo")
};

/* ---------------------------------------------------------------- theme */

export function applyTheme() {
  const t = get("theme");
  const root = document.documentElement;
  if (t === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", t);
}

export function cycleTheme() {
  const order = ["system", "light", "dark"];
  const next = order[(order.indexOf(get("theme")) + 1) % order.length];
  set("theme", next);
  applyTheme();
  return next;
}

export const TOGGLE_ROWS = [
  { key: "gmScreen", name: "GM Screen", desc: "Adds a GM tab with the party panel, NPC generator and rollable reference tables." },
  { key: "multiplayer", name: "Multiplayer party", desc: "Enables campaign sync. Requires Firebase keys in firebase-config.js." },
  { key: "manualDice", name: "Manual dice entry", desc: "Type the result of a physical d100 instead of rolling in the app." },
  { key: "showUntrained", name: "Show untrained skills", desc: "List every skill on the sheet, including those you have no ranks in." },
  { key: "autoConditions", name: "Auto-apply condition modifiers", desc: "Wounds and exhaustion adjust the Difficulty Factor of every roll automatically." },
  { key: "heroPointPrompt", name: "Offer Hero Point spends", desc: "After each roll, offer to shift the Success Quality with Hero Points." },
  { key: "seatbelts", name: "Assume seat belts worn", desc: "Reduces accident damage to occupants by one further Wound Rank." },
  { key: "airbags", name: "Assume airbags fitted", desc: "Reduces a single three-rank accident hit by one further Wound Rank." },
  { key: "solo", name: "Solo play (Mythic)", desc: "Adds a Solo tab running the Mythic Game Master Emulator: Fate questions, the Chaos Factor, scene tests, Random Events and 22 Meaning Tables. A second system, not part of Classified. Takes the Rules tab's place in the bottom bar; Rules stays on Home." }
];
