/* core.js — foundational constants, DOM helpers, raw dice. No imports. */

export const APP_NAME = "Classified Player";
export const STORAGE_PREFIX = "classified.";
export const SCHEMA_VERSION = 13;  // 9 clue odds, 10 clue lines and reveal tells, 11 the mission end, 12 the city and scene setting, 13 the Hidden truth as a choice (§6)

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
  glossary: "M4 19.5 8.5 5h1l4.5 14.5M5.6 14.5h6.8M15 13.5c.5-1.3 1.6-2 3-2 1.8 0 2.5 1 2.5 2.6v5.4M20.5 16c-3.5 0-5.5.6-5.5 2s1 1.8 2.2 1.8c1.6 0 3.3-1.1 3.3-3.8",
  /* The redesign's three places and the mission's verbs. */
  agent: "M12 4a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zM5 20.5c.8-4.5 3.6-6.5 7-6.5s6.2 2 7 6.5M7.5 6.5h9",
  mission: "M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17zM15.5 8.5l-2 5-5 2 2-5zM12 3.5v2M12 18.5v2M3.5 12h2M18.5 12h2",
  files: "M3.5 7.5h17v12h-17zM6 7.5V5h12v2.5M3.5 12h17M10 12v2h4v-2",
  help: "M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17zM9.6 9.5a2.5 2.5 0 1 1 3.4 2.3c-.6.3-1 .8-1 1.5v.7M12 16.6h.01",
  oracle: "M2.5 12s3.5-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.5 6.5-9.5 6.5S2.5 12 2.5 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z",
  event: "M13.5 2.5 5 13.5h6l-1 8 8.5-11h-6z",
  words: "M5 4.5h11l3 3v12H5zM8 9.5h8M8 13h8M8 16.5h5",
  hurt: "M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10zM12 10.5v5M9.5 13h5",
  flag: "M5.5 21V4M5.5 4.5h11l-2 3.5 2 3.5h-11",
  more: "M5 12h.01M12 12h.01M19 12h.01",
  board: "M3.5 4.5h17v15h-17zM7 8.5h4v4H7zM14 8.5h3M14 11.5h3M7 15.5h10",
  talk: "M4 5.5h16v10H10l-4 3.5v-3.5H4z",
  vehicle: "M4 15.5h16v3H4zM6.5 15.5l2-4.5h7l2.5 4.5M7.5 18.5v1M16.5 18.5v1",
  social: "M4 5.5h16v10H10l-4 3.5v-3.5H4z",
  technical: "M14.5 4.5a4 4 0 0 0-5 5L4 15l2.5 2.5L12 12a4 4 0 0 0 5-5l-2.5 2.5-2-2z",
  covert: "M3 12s3.5-5 9-5 9 5 9 5-3.5 5-9 5-9-5-9-5zM4 20 20 4",
  physical: "M13.5 4.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zM9 21l2.5-6 3 2.5V21M7 12l3-3.5h4l2.5 3.5M11.5 15l1-6.5",
  skillcombat: "M12 3v4M12 17v4M3 12h4M17 12h4M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zM12 11.2v1.6",
  ability: "M12 3.5l2.4 5 5.4.6-4 3.7 1.1 5.4L12 15.5l-4.9 2.7 1.1-5.4-4-3.7 5.4-.6z",
  travel: "M3 13.5l18-7-7 18-2.5-8.5z"
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
  target: [["c", 48, 48, 30], ["c", 48, 48, 18], ["c", 48, 48, 5, "accent"],
    ["p", "M48 10v14M48 72v14M10 48h14M72 48h14"]],
  phone: [["p", "M14 76l9-28h50l9 28z"], ["c", 48, 61, 11], ["c", 48, 61, 3],
    ["p", "M10 38c0-9 7-14 15-14h46c8 0 15 5 15 14v4H70v-6H26v6H10z", "accent"]],
  book: [["p", "M12 24c12-4 24-3 36 4 12-7 24-8 36-4v50c-12-4-24-3-36 4-12-7-24-8-36-4z"], ["p", "M48 28v50"],
    ["p", "M20 38h20M20 46h16M56 38h20M56 46h16", "accent"]],
  cipher: [["c", 48, 48, 32], ["c", 48, 48, 20], ["c", 48, 48, 4, "accent"],
    ["p", "M48 16v8M48 72v8M16 48h8M72 48h8M25 25l6 6M65 65l6 6M71 25l-6 6M31 65l-6 6"]],
  /* The agent in silhouette: a fedora, a turned-up collar, a trench coat. The portrait every
   * dossier carries until a photograph is added. */
  agent: [["p", "M26 34c0-3 6-6 22-6s22 3 22 6-8 3-22 3-22 0-22-3z"], ["p", "M34 30c0-9 6-14 14-14s14 5 14 14", "accent"],
    ["p", "M36 38c0 10 5 17 12 17s12-7 12-17"], ["p", "M30 58l18 12 18-12"],
    ["p", "M18 88c2-16 10-26 22-30l8 14 8-14c12 4 20 14 22 30"], ["p", "M48 72v16"]]
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

/* ---------------------------------------------------------------- dice faces */

/* The dice behind a number, drawn: a d100 as its two percentile dice (tens and units, 100 read
 * as 00 + 0), or any list of single dice. Decoration only — the number itself is printed
 * beside them as text and is what every reader and test takes. The value is decided before
 * this is called; the tumble only flickers the faces for a moment before showing it. */
export function d100Faces(roll) {
  const r = Number(roll) || 0;
  if (r >= 100) return ["00", "0"];
  return [String(Math.floor(r / 10) * 10).padStart(2, "0"), String(r % 10)];
}

export function diceFaces(faces, { tens = false } = {}) {
  const wrap = el("span", { class: "dice-faces", "aria-hidden": "true" },
    faces.map((f, i) => el("span", { class: "die-face" + (tens && i === 0 ? " is-tens" : "") }, el("b", { text: String(f) }))));
  const still = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!still) {
    const bs = [...wrap.querySelectorAll("b")];
    wrap.classList.add("is-tumbling");
    let n = 0;
    const t = setInterval(() => {
      n++;
      bs.forEach((b, i) => { b.textContent = tens && i === 0 ? String(Math.floor(Math.random() * 10) * 10).padStart(2, "0") : String(Math.floor(Math.random() * 10)); });
      if (n >= 9) {
        clearInterval(t);
        bs.forEach((b, i) => { b.textContent = String(faces[i]); });
        wrap.classList.remove("is-tumbling");
        wrap.classList.add("is-landed");
      }
    }, 45);
  } else wrap.classList.add("is-landed");
  return wrap;
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

/* ---------------------------------------------------------------- shared screen pieces */

/** Ask the router to redraw the current screen. One event, so no screen keeps its own copy. */
export function rerender() {
  document.dispatchEvent(new CustomEvent("app:rerender"));
}

/**
 * A section on a screen: a typed heading on its rule, an optional line under it, and an
 * optional control on the heading (a "?" or an "+ Add"). Every screen builds its sections here.
 */
export function section(title, sub, ...headExtras) {
  const s = el("div", { class: "section" });
  s.appendChild(el("div", { class: "section-head" }, el("div", { class: "section-title", text: title }), ...headExtras));
  // The line under a heading explains; it shows only with the how-to setting on (U4).
  if (sub) s.appendChild(el("p", { class: "small muted explain section-sub", style: "margin-top:-2px", text: sub }));
  return s;
}

/** A labelled number box. A long value steps its size down rather than wrapping. */
export function statBox(k, v) {
  return el("div", { class: "stat-box" },
    el("div", { class: "k", text: k }),
    el("div", { class: "v", style: String(v).length > 6 ? "font-size:15px" : "", text: String(v) }));
}

/**
 * Redraw a screen without losing the reader's place. A redraw rebuilds every accordion closed
 * (they start closed by design) and the router scrolled to the top, so raising one skill shut
 * the group it was in and threw the player back to the head of the page. The open accordions
 * are recorded by their heading and reopened, and the scroll position is put back.
 */
export function preserveView(host, render) {
  const key = d => {
    const s = d.querySelector(":scope > summary");
    if (!s) return "";
    const first = s.firstElementChild;
    return (first ? first.textContent : s.textContent).trim();
  };
  const open = new Set([...host.querySelectorAll("details[open]")].map(key).filter(Boolean));
  const y = window.scrollY;
  render();
  if (open.size) host.querySelectorAll("details").forEach(d => { if (open.has(key(d))) d.open = true; });
  window.scrollTo(0, y);
}
