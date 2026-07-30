/* main.js — entry point. */

import { el, $ } from "./core.js";
import { applyTheme, cycleTheme, Settings } from "./settings.js";
import { initRouter, navigate, currentRoute, rebuildNav } from "./router.js";
import { renderResourceHeader } from "./sheet.js";
import { showToast } from "./ui.js";
import * as Store from "./store.js";
import * as Sync from "./sync.js";

const CACHE_VERSION = "classified-v6";

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

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  if (location.protocol === "file:") return;

  navigator.serviceWorker.register("service-worker.js").then(reg => {
    reg.addEventListener("updatefound", () => {
      const sw = reg.installing;
      if (!sw) return;
      sw.addEventListener("statechange", () => {
        if (sw.state === "installed" && navigator.serviceWorker.controller) {
          showUpdateToast();
        }
      });
    });
  }).catch(err => console.warn("Service worker registration failed:", err));
}

function showUpdateToast() {
  const root = document.getElementById("toastRoot");
  const t = el("div", { class: "toast", style: "pointer-events:auto" },
    el("span", { text: "Update available — " }),
    el("button", {
      class: "btn sm primary", type: "button", style: "margin-left:8px",
      onclick: () => location.reload()
    }, "Reload"));
  root.appendChild(t);
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
else boot();

export { CACHE_VERSION };
