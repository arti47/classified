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
  solo: false,                  // the Mythic solo layer, a second system (CLAUDE.md §3.20)
  showHelp: false,              // inline how-to bars; the header's ? carries the same copy (U4)
  veteran: false,               // shows every procedure at once instead of the common ones first (U7)
  sfx: false,                   // a click and a buzz when the dice land (U8)
  startHere: true               // the first-run card on Home; hidden by its own Hide this, not by a toggle row
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
  solo: () => !!get("solo"),
  showHelp: () => !!get("showHelp"),
  veteran: () => !!get("veteran"),
  sfx: () => !!get("sfx"),
  startHere: () => !!get("startHere")
};

/* ---------------------------------------------------------------- theme */

export function applyTheme() {
  const t = get("theme");
  const root = document.documentElement;
  if (t === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", t);
  // The browser chrome follows the paper: an explicit choice overrides both media-matched
  // theme-color tags, and "system" hands them back to the media queries.
  const colours = { light: "#e9dfc7", dark: "#0f141c", nightops: "#030a05" };
  for (const meta of document.querySelectorAll('meta[name="theme-color"]')) {
    if (!meta.dataset.media) meta.dataset.media = meta.getAttribute("media") || "";
    if (t === "system") {
      meta.setAttribute("media", meta.dataset.media);
      meta.setAttribute("content", meta.dataset.media.includes("dark") ? colours.dark : colours.light);
    } else {
      meta.removeAttribute("media");
      meta.setAttribute("content", colours[t] || colours.light);
    }
  }
}

export function cycleTheme() {
  const order = ["system", "light", "dark", "nightops"];
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
  { key: "showHelp", name: "Show how-to panels", desc: "A collapsed how-to bar on every screen. The ? in the header always has the same help." },
  { key: "veteran", name: "Veteran mode", desc: "Every procedure the book defines on one picker, instead of the common ones first." },
  { key: "sfx", name: "Sound and vibration", desc: "A click and a buzz when the dice land, and shake the phone to roll." },
  { key: "solo", name: "Solo play (Mythic)", desc: "The Mythic Game Master Emulator runs the world: Fate questions, the Chaos Factor, scenes, Random Events and 37 Meaning Tables. A second system, not part of Classified." }
];
