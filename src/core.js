/* core.js — foundational constants, DOM helpers, raw dice. No imports. */

export const APP_NAME = "Classified Player";
export const STORAGE_PREFIX = "classified.";
export const SCHEMA_VERSION = 11;  // 9 clue odds, 10 clue lines and reveal tells, 11 the mission end (§6)

/* ---------------------------------------------------------------- DOM */

export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === "class") node.className = v;
    else if (k === "html") node.innerHTML = v;
    else if (k === "text") node.textContent = v;
    else if (k === "dataset") Object.assign(node.dataset, v);
    else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
    else if (v === true) node.setAttribute(k, "");
    else node.setAttribute(k, v);
  }
  for (const c of children.flat(4)) {
    if (c === null || c === undefined || c === false) continue;
    node.appendChild(typeof c === "object" && c.nodeType ? c : document.createTextNode(String(c)));
  }
  return node;
}

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export function clear(node) { while (node && node.firstChild) node.removeChild(node.firstChild); return node; }

export function announce(text) {
  const region = document.getElementById("liveRegion");
  if (!region) return;
  region.textContent = "";
  window.setTimeout(() => { region.textContent = text; }, 30);
}

/* ---------------------------------------------------------------- icons */

/* One stroke-icon family on a 24px grid in currentColor, so icons match the type and never
 * fall back to a colour emoji the way a Unicode glyph does. Decoration only: every icon sits
 * beside a text label or carries an aria-label on its button. */
const ICON_PATHS = {
  home: "M3 10.5 12 4l9 6.5M5.5 9v10.5h13V9M10 19.5v-5h4v5",
  sheet: "M3.5 6.5h6l2 2h9v11h-17zM3.5 6.5v-2h5l1.5 2M8 13h8M8 16h5",
  combat: "M12 3v4M12 17v4M3 12h4M17 12h4M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zM12 11.2v1.6",
  rules: "M4 5.5c3-1 5.5-.8 8 1 2.5-1.8 5-2 8-1v13c-3-1-5.5-.8-8 1-2.5-1.8-5-2-8-1zM12 6.5v13",
  gm: "M12 3.5l2.4 5 5.4.6-4 3.7 1.1 5.4L12 15.5l-4.9 2.7 1.1-5.4-4-3.7 5.4-.6z",
  solo: "M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17zM15.5 8.5l-2 5-5 2 2-5zM12 3.5v2M12 18.5v2M3.5 12h2M18.5 12h2",
  settings: "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7",
  gear: "M4 8.5h16v10.5H4zM9 8.5V6a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 6v2.5M4 13h16M11 13v2h2v-2",
  advance: "M4 19.5h16M7 19.5v-5M12 19.5v-9M17 19.5v-13M14.5 6.5 17 4l2.5 2.5",
  dice: "M5.5 4h13a1.5 1.5 0 0 1 1.5 1.5v13a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5v-13A1.5 1.5 0 0 1 5.5 4zM8.5 8.5h.01M15.5 8.5h.01M12 12h.01M8.5 15.5h.01M15.5 15.5h.01",
  log: "M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01",
  play: "M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17zM10 8.5v7l5.5-3.5z",
  tutorial: "M2.5 9 12 4.5 21.5 9 12 13.5zM6.5 11v5c3 2.3 8 2.3 11 0v-5M21.5 9v5",
  glossary: "M4 19.5 8.5 5h1l4.5 14.5M5.6 14.5h6.8M15 13.5c.5-1.3 1.6-2 3-2 1.8 0 2.5 1 2.5 2.6v5.4M20.5 16c-3.5 0-5.5.6-5.5 2s1 1.8 2.2 1.8c1.6 0 3.3-1.1 3.3-3.8"
};

export function hasIcon(key) { return Object.prototype.hasOwnProperty.call(ICON_PATHS, key); }

export function icon(key) {
  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS, "svg");
  for (const [k, v] of Object.entries({ viewBox: "0 0 24 24", fill: "none", stroke: "currentColor",
    "stroke-width": "1.7", "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true" })) svg.setAttribute(k, v);
  const path = document.createElementNS(NS, "path");
  path.setAttribute("d", ICON_PATHS[key] || ICON_PATHS.home);
  svg.appendChild(path);
  return svg;
}

/* ---------------------------------------------------------------- line art */

/* Single-stroke spy props for empty states, drawn on a 96px grid in currentColor. Each has
 * one accent stroke (class "accent") that the stylesheet inks in the stamp red. Decoration
 * only: every one sits above a heading that says what the empty state is. */
const ART = {
  folder: [["p", "M12 28h24l6 6h42v44H12z"], ["p", "M22 36V18h44v18"], ["p", "M28 24h24M28 30h30"],
    ["p", "M8 42h80l-6 36H14z"], ["p", "M52 56h22v10H52z", "accent"]],
  idcard: [["p", "M10 26h76v50H10z"], ["p", "M18 36h22v30H18z"], ["c", 29, 47, 5],
    ["p", "M21 64c1-7 15-7 16 0"], ["p", "M48 40h28M48 48h22M48 56h26"], ["p", "M44 18v14M52 18v14", "accent"]],
  briefcase: [["p", "M12 34h72v44H12z"], ["p", "M36 34v-8a4 4 0 0 1 4-4h16a4 4 0 0 1 4 4v8"],
    ["p", "M12 50h72"], ["p", "M30 46v8M66 46v8", "accent"]],
  ladder: [["p", "M12 80h72"], ["p", "M18 80V66h16V54h16V40h16V28h12v52"], ["p", "M64 14l12-2-2 12M76 12 58 30", "accent"]],
  map: [["p", "M12 26l22-8 28 8 22-8v56l-22 8-28-8-22 8z"], ["p", "M34 18v56M62 26v56"],
    ["p", "M48 30c-6 0-10 4-10 10 0 8 10 16 10 16s10-8 10-16c0-6-4-10-10-10z", "accent"], ["c", 48, 40, 3]],
  stopwatch: [["c", 48, 54, 26], ["p", "M42 20h12M48 20v8M70 30l5-5"], ["p", "M48 54 60 42", "accent"],
    ["p", "M48 32v4M48 72v4M26 54h4M66 54h4"]],
  reel: [["p", "M10 22h76v54H10z"], ["c", 30, 44, 13], ["c", 66, 44, 13], ["c", 30, 44, 3], ["c", 66, 44, 3],
    ["p", "M30 57h36", "accent"], ["p", "M22 70h52"]],
  typewriter: [["p", "M30 16h36v26H30z"], ["p", "M36 24h24M36 31h18", "accent"], ["p", "M18 42h60v8H18z"],
    ["p", "M14 50h68l6 26H8z"], ["c", 24, 63, 3], ["c", 36, 63, 3], ["c", 48, 63, 3], ["c", 60, 63, 3], ["c", 72, 63, 3]],
  cards: [["p", "M26 30v-8h56v40h-6"], ["p", "M18 30h58v42H18z"], ["p", "M18 40h58", "accent"],
    ["p", "M26 50h36M26 58h28M26 66h32"]],
  car: [["p", "M10 58h76v12H10z"], ["p", "M24 58l8-14h30l10 14"], ["c", 28, 72, 7], ["c", 68, 72, 7],
    ["p", "M38 52h22", "accent"]],
  keyhole: [["p", "M26 12h44a4 4 0 0 1 4 4v64a4 4 0 0 1-4 4H26a4 4 0 0 1-4-4V16a4 4 0 0 1 4-4z"], ["c", 48, 38, 10],
    ["p", "M43 46l-5 24h20l-5-24", "accent"]],
  cipher: [["c", 48, 48, 32], ["c", 48, 48, 20], ["c", 48, 48, 4, "accent"],
    ["p", "M48 16v8M48 72v8M16 48h8M72 48h8M25 25l6 6M65 65l6 6M71 25l-6 6M31 65l-6 6"]]
};

export function art(key) {
  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS, "svg");
  for (const [k, v] of Object.entries({ viewBox: "0 0 96 96", fill: "none", stroke: "currentColor",
    "stroke-width": "2.2", "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true",
    class: "art" })) svg.setAttribute(k, v);
  for (const part of ART[key] || ART.folder) {
    const isCircle = part[0] === "c";
    const node = document.createElementNS(NS, isCircle ? "circle" : "path");
    if (isCircle) { node.setAttribute("cx", part[1]); node.setAttribute("cy", part[2]); node.setAttribute("r", part[3]); }
    else node.setAttribute("d", part[1]);
    const cls = isCircle ? part[4] : part[2];
    if (cls) node.setAttribute("class", cls);
    svg.appendChild(node);
  }
  return svg;
}

/* ---------------------------------------------------------------- meters */

/* A number already printed beside it, drawn to scale: `fraction` of 0–1. Decoration only
 * (aria-hidden), so it never becomes a second source for the number. */
export function meter(fraction, kind = "") {
  const f = Math.max(0, Math.min(1, Number(fraction) || 0));
  return el("span", { class: "meter" + (kind ? " " + kind : ""), "aria-hidden": "true" },
    el("span", { class: "meter-fill", style: `width:${(f * 100).toFixed(1)}%` }));
}

/* ---------------------------------------------------------------- dice */

export function d100() { return 1 + Math.floor(Math.random() * 100); }
export function d10() { return 1 + Math.floor(Math.random() * 10); }
export function d6() { return 1 + Math.floor(Math.random() * 6); }
export function die(sides) { return 1 + Math.floor(Math.random() * sides); }
export function roll(count, sides) {
  let total = 0;
  for (let i = 0; i < count; i++) total += die(sides);
  return total;
}
export function pick(list) { return list[Math.floor(Math.random() * list.length)]; }
export function percent(chance) { return d100() <= chance * 100; }

/* ---------------------------------------------------------------- numbers */

export const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
export const floor = Math.floor;

export function lookup(table, value, field = "value") {
  for (const row of table) if (value <= row.max) return row[field];
  return table[table.length - 1][field];
}

export function lookupRow(table, value) {
  for (const row of table) if (value <= row.max) return row;
  return table[table.length - 1];
}

export function money(n) {
  if (n === null || n === undefined) return "—";
  return "$" + Number(n).toLocaleString("en-US");
}

export function signed(n) { return n > 0 ? "+" + n : String(n); }

export function dfLabel(df) { return df === 0.5 ? "½" : String(df); }

/* ---------------------------------------------------------------- misc */

export function uid(prefix = "id") {
  return prefix + "_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function deepClone(obj) {
  if (typeof structuredClone === "function") {
    try { return structuredClone(obj); } catch { /* fall through */ }
  }
  return JSON.parse(JSON.stringify(obj));
}

export function debounce(fn, ms = 250) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

export function titleCase(s) {
  return String(s).replace(/\w\S*/g, w => w[0].toUpperCase() + w.slice(1).toLowerCase());
}

export function fmtDate(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) + " " +
    d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

export const JOIN_WORDS_A = ["red","black","white","gold","iron","cold","silent","grey","blue","pale","dark","swift"];
export const JOIN_WORDS_B = ["dragon","falcon","viper","raven","tiger","wolf","lion","serpent","hawk","fox","bear","owl"];
export const JOIN_WORDS_C = ["sword","dagger","cipher","key","crown","shield","lantern","compass","anchor","mask","seal","coin"];

export function joinCode() {
  return `${pick(JOIN_WORDS_A)}-${pick(JOIN_WORDS_B)}-${pick(JOIN_WORDS_C)}`;
}
