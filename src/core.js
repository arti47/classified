/* core.js — foundational constants, DOM helpers, raw dice. No imports. */

export const APP_NAME = "Classified Player";
export const STORAGE_PREFIX = "classified.";
export const SCHEMA_VERSION = 5;   // 4 added solo adventures, 5 their scene phase (§6)

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
