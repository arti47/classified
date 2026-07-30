/* main.js — entry point. */

import { el, $ } from "./core.js";
import { applyTheme, cycleTheme, Settings } from "./settings.js";
import { initRouter, navigate, currentRoute, rebuildNav } from "./router.js";
import { renderResourceHeader } from "./sheet.js";
import { showToast } from "./ui.js";
import * as Store from "./store.js";
import * as Sync from "./sync.js";

const CACHE_VERSION = "classified-v9";

function boot() {
  applyTheme();
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if (Settings.theme() === "system") applyTheme();
  });

  document.getElementById("themeBtn").addEventListener("click", () => {
    const next = cycleTheme();
    showToast(next === "system" ? "Following system theme" : next === "dark" ? "Dark" : "Light");
  });

  document.getElementById("diceBtn").addEventListener("click", () => {
    const c = Store.activeCharacter();
    if (!c) { showToast("Create a character first", "err"); navigate("create"); return; }
    import("./roller.js").then(m => m.openQuickRoll(c));
  });

  Store.subscribe(what => {
    if (what === "character" || what === "active") renderResourceHeader();
  });
  document.addEventListener("settings:changed", e => {
    if (e.detail.key === "gmScreen" || e.detail.key === "multiplayer" || e.detail.key === "solo") rebuildNav();
  });

  renderResourceHeader();
  initRouter();

  if (Settings.multiplayer()) Sync.init();
  registerServiceWorker();
}

/* Update checks. The app has no build step and no version endpoint: the deployed
 * service-worker.js is the version marker, so asking the browser to re-fetch it is how a
 * running app finds out that new code was pushed. Registration alone only checks on a hard
 * navigation, which a standalone PWA may not see for days, so it is polled as well —
 * whenever the app comes back to the foreground, and on a slow timer while it stays open. */
const UPDATE_POLL_MS = 15 * 60 * 1000;   // background heartbeat
const UPDATE_FOCUS_THROTTLE_MS = 60 * 1000;  // do not re-check on every tab flick

let swRegistration = null;
let lastUpdateCheck = 0;
let updateToast = null;
let reloadingForUpdate = false;

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  if (location.protocol === "file:") return;

  navigator.serviceWorker.register("service-worker.js").then(reg => {
    swRegistration = reg;
    lastUpdateCheck = Date.now();

    // A worker may already be installed and waiting from a previous visit.
    if (reg.waiting && navigator.serviceWorker.controller) showUpdateToast(reg.waiting);

    reg.addEventListener("updatefound", () => {
      const sw = reg.installing || reg.waiting;
      if (!sw) return;
      // With no controller this is the first install, not an update — nothing to announce.
      if (!navigator.serviceWorker.controller) return;
      if (sw.state === "installed" || sw.state === "activated") { showUpdateToast(sw); return; }
      sw.addEventListener("statechange", () => {
        if (sw.state === "installed" || sw.state === "activated") showUpdateToast(sw);
      });
    });

    window.setInterval(checkForUpdate, UPDATE_POLL_MS);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") checkForUpdate();
    });
    window.addEventListener("focus", checkForUpdate);
    window.addEventListener("online", checkForUpdate);
  }).catch(err => console.warn("Service worker registration failed:", err));

  // The new worker calls skipWaiting, so it takes over as soon as it installs. Reload once
  // when that happens if the user asked for the update; otherwise leave the page alone.
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloadingForUpdate) location.reload();
  });
}

/** Ask the browser to re-fetch the service worker. Throttled; silent when it fails. */
export function checkForUpdate({ force = false } = {}) {
  if (!swRegistration) return Promise.resolve(false);
  const now = Date.now();
  if (!force && now - lastUpdateCheck < UPDATE_FOCUS_THROTTLE_MS) return Promise.resolve(false);
  lastUpdateCheck = now;
  return swRegistration.update().then(() => true).catch(() => false);
}

/**
 * The update toast: persistent, one at a time, and dismissible. Reload is the whole point,
 * so it is the primary action; Later leaves the new code waiting until the next launch.
 */
export function showUpdateToast(worker = null) {
  if (updateToast && updateToast.isConnected) return updateToast;

  const root = document.getElementById("toastRoot");
  const t = el("div", { class: "toast update", role: "status" },
    el("div", { class: "t-text" },
      el("b", { text: "Update available" }),
      el("div", { class: "small", text: "New code has been deployed. Reload to pick it up." })),
    el("div", { class: "t-actions" },
      el("button", {
        class: "btn sm ghost", type: "button",
        onclick: () => { t.remove(); updateToast = null; }
      }, "Later"),
      el("button", {
        class: "btn sm primary", type: "button",
        onclick: () => {
          reloadingForUpdate = true;
          // Nudge a waiting worker through, then reload either way.
          const waiting = worker || (swRegistration && swRegistration.waiting);
          if (waiting) { try { waiting.postMessage({ type: "SKIP_WAITING" }); } catch { /* ignore */ } }
          window.setTimeout(() => location.reload(), 60);
        }
      }, "Reload")));

  root.appendChild(t);
  updateToast = t;
  return t;
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
else boot();

export { CACHE_VERSION };
