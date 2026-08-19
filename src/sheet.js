/* sheet.js — the live character sheet, in-play tracking, and the persistent
 * resource header shown on every in-play screen. */

import { el, clear, $, money, signed, dfLabel, uid, percent, d100 } from "./core.js";
import { modal, showToast, confirmModal, promptModal, chooseModal } from "./ui.js";
import * as D from "../data.js";
import * as R from "./rules.js";
import * as Store from "./store.js";
import { Settings } from "./settings.js";
import {
  derived, skillList, abilityList, baseChanceFor, isTrained,
  conditionSummary, conditionDFMod, validate, expectedRankFor
} from "./derived.js";
import {
  openRoll, openAttack, openWeaponPicker, openSkillPicker, openQuickRoll,
  applyDamageToCharacter, openTakeDamage, getD100, resolve, presentResult
} from "./roller.js";
import { openRulesTopic } from "./screens.js";
import { navigate } from "./router.js";
import { appendHelp } from "./help.js";

/* ---------------------------------------------------------------- resource header */

export function renderResourceHeader() {
  const host = document.getElementById("resourceHeader");
  if (!host) return;
  const c = Store.activeCharacter();
  if (!c) { host.hidden = true; clear(host); return; }

  host.hidden = false;
  clear(host);
  const dv = derived(c);
  const wound = R.woundLevel(c.state.wound);
  const dfMod = conditionDFMod(c);

  // A chip with somewhere to go is a button; one without is not. The default used to be an
  // empty handler, which is how the DF chip came to look tappable and do nothing.
  const chip = (label, value, opts = {}) => el(opts.onclick ? "button" : "div", {
    class: "res-chip" + (opts.alert ? " is-alert" : "") + (opts.good ? " is-good" : "") +
      (opts.onclick ? "" : " is-static"),
    type: opts.onclick ? "button" : null,
    title: opts.title || "",
    onclick: opts.onclick || null
  }, el("span", { class: "lab", text: label }), el("b", { text: String(value) }));

  host.appendChild(chip("Hero", c.state.heroPoints ?? 0, {
    good: (c.state.heroPoints ?? 0) > 0,
    title: "Hero Points — tap to spend or gain",
    onclick: () => openHeroPoints(c)
  }));

  host.appendChild(chip("Wound", wound.name, {
    alert: c.state.wound !== "none",
    title: wound.desc || "Uninjured",
    onclick: () => openWoundPanel(c)
  }));

  if (dfMod !== 0) {
    host.appendChild(chip("DF", signed(dfMod), {
      alert: true,
      title: "Automatic Difficulty Factor modifier from your current condition — tap for the breakdown",
      onclick: () => openConditions(c)
    }));
  }

  host.appendChild(chip("Speed", dv.speed, {
    title: `Move ${dv.normalMove} ft normally, ${dv.defensiveMove} ft defensively. Draw bonus ${signed(dv.drawBonus)}.`,
    onclick: () => openSpeedPanel(c)
  }));

  host.appendChild(chip("Rep", c.reputation ?? 0, {
    alert: (c.reputation ?? 0) > 150,
    title: "Reputation — lower is better",
    onclick: () => navigate("advance")
  }));

  host.appendChild(chip("XP", (c.xp.total || 0) - (c.xp.spent || 0), {
    title: "Unspent experience points",
    onclick: () => navigate("advance")
  }));

  host.appendChild(chip("$", money(c.inventory.money || 0).replace("$", ""), {
    title: "Cash on hand",
    onclick: () => navigate("gear")
  }));
}

/* ---------------------------------------------------------------- panels */

export function openHeroPoints(c) {
  const body = el("div", {});
  const val = el("div", { class: "stat-box" },
    el("div", { class: "k", text: "Hero Points" }),
    el("div", { class: "v", text: String(c.state.heroPoints ?? 0) }));
  body.appendChild(val);

  const row = el("div", { class: "btn-row", style: "margin-top:12px" });
  row.appendChild(el("button", { class: "btn", type: "button", onclick: () => adjust(-1) }, "−1"));
  row.appendChild(el("button", { class: "btn", type: "button", onclick: () => adjust(1) }, "+1"));
  body.appendChild(row);

  function adjust(n) {
    Store.updateActive(x => { x.state.heroPoints = Math.max(0, (x.state.heroPoints || 0) + n); });
    c.state.heroPoints = Math.max(0, (c.state.heroPoints || 0) + n);
    val.querySelector(".v").textContent = String(c.state.heroPoints);
    renderResourceHeader();
  }

  const style = R.STYLE_BY_KEY[Settings.campaignStyle()];
  body.appendChild(el("div", { class: "banner", style: "margin-top:12px" },
    el("b", { text: style.name + " style" }),
    el("div", { class: "small", text: style.heroPointRule })));

  body.appendChild(el("div", { class: "section-title", style: "margin-top:14px", text: "Legal spends" }));
  for (const s of D.HERO_POINT_RULES.spends) {
    body.appendChild(el("div", { class: "card-row", style: "padding-left:0;padding-right:0" },
      el("span", { class: "grow small", text: s.name }),
      el("span", { class: "mono small", text: String(s.cost) })));
  }
  body.appendChild(el("p", { class: "small muted", style: "margin-top:10px", text: D.HERO_POINT_RULES.gmRolledWarning }));

  modal({
    title: "Hero Points", body,
    actions: [
      { label: "Rules", kind: "ghost", close: false, onClick: () => openRulesTopic("heropoints") },
      { label: "Done", kind: "primary" }
    ]
  });
}

/**
 * What is standing against every roll, and where each part of it came from.
 *
 * The DF chip appears only when something is; before this it was the one chip with no action
 * behind it, so it read as tappable and did nothing at all.
 */
export function openConditions(c) {
  const conds = conditionSummary(c);
  const total = conditionDFMod(c);
  const body = el("div", {});
  body.appendChild(el("p", { class: "small muted", text:
    "Every roll you make takes this automatically while it stands. Turn it off under Auto-apply condition modifiers in Settings." }));

  const card = el("div", { class: "card flush" });
  for (const x of conds) {
    card.appendChild(el("div", { class: "card-row" },
      el("span", { class: "grow", text: x.name }),
      el("b", { text: x.dfMod ? signed(x.dfMod) + " DF" : "no penalty" })));
  }
  body.appendChild(card);
  body.appendChild(el("div", { class: "banner warn", style: "margin-top:10px" },
    el("b", { text: `${signed(total)} Difficulty Factor in total` }),
    el("div", { class: "small", text: "Wounds heal with First Aid, rest or a hospital stay; exhaustion clears with rest, or at End Session." })));

  modal({
    title: "Standing against you",
    body,
    actions: [
      { label: "Wounds", kind: "ghost", onClick: () => openWoundPanel(c) },
      { label: "Close", kind: "primary" }
    ]
  });
}

export function openWoundPanel(c) {
  const body = el("div", {});
  const w = R.woundLevel(c.state.wound);

  body.appendChild(el("div", { class: "stat-box" },
    el("div", { class: "k", text: "Current wound" }),
    el("div", { class: "v", style: "font-size:20px", text: w.name })));

  const track = el("div", { class: "wound-bar" });
  const order = ["stun", "light", "medium", "heavy", "incap", "killed"];
  const cur = order.indexOf(c.state.wound);
  for (let i = 0; i < order.length; i++) {
    track.appendChild(el("div", { class: "wound-seg" + (cur >= i && cur >= 0 ? " on" : "") }));
  }
  body.appendChild(track);
  body.appendChild(el("div", { class: "row small muted" },
    el("span", { text: "Stun" }), el("span", { class: "spacer" }), el("span", { text: "Killed" })));

  if (w.desc) body.appendChild(el("p", { class: "small", style: "margin-top:10px", text: w.desc }));

  if (w.painDF) {
    body.appendChild(el("button", {
      class: "btn primary block", style: "margin-top:10px", type: "button",
      onclick: async () => {
        const rollValue = await getD100("Pain Resistance d100");
        const res = resolve({
          baseChance: Number(c.attributes.wil) || 0, df: w.painDF, rollValue,
          label: "Pain Resistance", skillKey: null
        });
        presentResult(res, {
          character: c,
          extra: r => el("div", { class: "banner " + (r.quality < 5 ? "ok" : "warn"), style: "margin-top:12px",
            text: r.quality < 5
              ? "You push through the pain and may act this round."
              : "The pain overwhelms you — no action this round. Roll again next Declaration Phase." })
        });
      }
    }, `Pain Resistance (DF ${w.painDF} Willpower)`));
  }

  if (c.state.wound === "stun") {
    body.appendChild(el("p", { class: "small muted", style: "margin-top:8px", text:
      "Hand-to-Hand Stun: Difficulty Factor 8 Strength or fall prone, senseless for the rolled number of rounds. Fire Combat Stun: Difficulty Factor 8 Willpower each round to resume your declared action." }));
  }

  body.appendChild(el("div", { class: "section-title", style: "margin-top:14px", text: "Change wound" }));
  const wrap = el("div", { class: "chip-wrap" });
  for (const lvl of D.WOUND_LEVELS) {
    wrap.appendChild(el("button", {
      class: "chip" + (c.state.wound === lvl.key ? " on" : ""), type: "button",
      onclick: () => {
        Store.updateActive(x => { x.state.wound = lvl.key; });
        c.state.wound = lvl.key;
        renderResourceHeader();
        render();
        showToast(lvl.name);
      }
    }, lvl.name));
  }
  body.appendChild(wrap);

  body.appendChild(el("div", { class: "section-title", style: "margin-top:14px", text: "Healing" }));
  const healWrap = el("div", {});
  for (const h of D.HEALING) {
    const disabled = h.key === "firstaid" && c.state.firstAidUsed;
    healWrap.appendChild(el("button", {
      class: "opt-btn", type: "button", disabled,
      onclick: () => applyHealing(c, h)
    },
      el("span", { class: "on-name" }, el("span", { text: h.name }),
        el("span", { class: "mono small", text: disabled ? "used" : `-${h.ranks} rank` })),
      el("span", { class: "on-desc", text: h.desc + " " + h.limit })
    ));
  }
  body.appendChild(healWrap);

  const m = modal({
    title: "Wounds", body,
    actions: [
      { label: "Rules", kind: "ghost", close: false, onClick: () => openRulesTopic("wounds") },
      { label: "Take damage", kind: "ghost", onClick: () => openTakeDamage(c) },
      { label: "Done", kind: "primary" }
    ]
  });
  function render() { m.close(); openWoundPanel(Store.activeCharacter()); }
}

async function applyHealing(c, h) {
  if (h.key === "firstaid") {
    const ok = await confirmModal(
      "First Aid may be attempted only once on a given wound, and only within an hour of the wounding. Roll it now?",
      { title: "First Aid", okLabel: "Roll First Aid" }
    );
    if (!ok) return;
    const rollValue = await getD100("First Aid d100");
    const res = resolve({
      baseChance: D.ABILITY_BASE_CHANCE, df: D.BASE_DIFFICULTY_FACTOR, rollValue,
      label: "First Aid"
    });
    presentResult(res, {
      character: c,
      onDone: r => {
        Store.updateActive(x => { x.state.firstAidUsed = true; });
        if (r.quality < D.QUALITY.FAILURE) {
          const after = R.healWound(c.state.wound, 1);
          Store.updateActive(x => { x.state.wound = after; });
          showToast(`Healed to ${R.woundLevel(after).name}`, "ok");
        } else {
          showToast("First Aid failed — no further attempts on this wound", "err");
        }
        renderResourceHeader();
      }
    });
    return;
  }

  const after = R.healWound(c.state.wound, h.ranks);
  Store.updateActive(x => { x.state.wound = after; if (h.key !== "natural") x.state.firstAidUsed = false; });
  showToast(`${h.name}: now ${R.woundLevel(after).name}`, "ok");
  renderResourceHeader();
}

export function openSpeedPanel(c) {
  const dv = derived(c);
  const body = el("div", {});
  body.appendChild(el("div", { class: "grid grid-2" },
    stat("Speed", dv.speed, `PER ${c.attributes.per} + DEX ${c.attributes.dex}`),
    stat("Draw bonus", signed(dv.drawBonus), "Added to a d100 Draw roll"),
    stat("Normal move", dv.normalMove + " ft", "10 × Speed"),
    stat("Defensive move", dv.defensiveMove + " ft", "5 × Speed, and -4 DF to shoot you")
  ));
  body.appendChild(el("p", { class: "small muted", style: "margin-top:12px", text: D.COMBAT_ROUND.declaration }));
  body.appendChild(el("p", { class: "small muted", text: D.COMBAT_ROUND.action }));
  body.appendChild(el("p", { class: "small muted", text: D.DRAW_NOTE }));

  body.appendChild(el("button", {
    class: "btn primary block", type: "button", style: "margin-top:12px",
    onclick: () => rollDraw(c)
  }, "Roll a Draw Situation"));

  modal({
    title: "Speed and initiative", body,
    actions: [
      { label: "Rules", kind: "ghost", close: false, onClick: () => openRulesTopic("combatround") },
      { label: "Done", kind: "primary" }
    ]
  });
}

async function rollDraw(c) {
  const dv = derived(c);
  const mustDraw = await confirmModal("Do you have to draw your weapon as part of this? That costs -40.", {
    title: "Draw Situation", okLabel: "Yes, drawing", cancelLabel: "No, in hand"
  });
  const woundMod = R.woundDrawMod(c.state.wound);
  const npcSpeed = parseInt(await promptModal("Opponent's Speed (0-3)", { title: "Opponent", type: "number", value: "2" }), 10);
  const oppBonus = R.drawBonus(Number.isFinite(npcSpeed) ? npcSpeed : 2);

  const mine = d100() + dv.drawBonus + (mustDraw ? D.DRAW_WEAPON_PENALTY : 0) + woundMod;
  const theirs = d100() + oppBonus;

  const lines = [
    `You: ${mine} (Speed bonus ${signed(dv.drawBonus)}${mustDraw ? ", drawing -40" : ""}${woundMod ? ", wounded " + woundMod : ""})`,
    `Opponent: ${theirs} (Speed bonus ${signed(oppBonus)})`,
    mine > theirs ? "You fire first." : mine === theirs ? "Dead heat — the GM rules, or you both fire." : "The opponent fires first. You must still take your shot."
  ];
  modal({
    title: "Draw Situation",
    body: el("div", {}, ...lines.map(t => el("p", { text: t }))),
    actions: [{ label: "OK", kind: "primary" }]
  });
  Store.addRoll({
    by: c.identity.name || "Agent", characterId: c.id,
    label: "Draw Situation", roll: mine, quality: mine > theirs ? 1 : 5,
    note: lines[2], modifiers: []
  });
}

function stat(k, v, s) {
  return el("div", { class: "stat-box" },
    el("div", { class: "k", text: k }),
    el("div", { class: "v", text: String(v) }),
    s ? el("div", { class: "s", text: s }) : null);
}

/* ---------------------------------------------------------------- sheet screen */

/* The dossier photograph. Compressed in the browser before it is stored: a phone camera
 * file is several megabytes and localStorage is a handful, so an uncompressed portrait fills
 * the quota and takes the dossier down with it. PORTRAIT_PX square, JPEG, and the result is a
 * data URL — which works with no Firebase configured and rides along in the JSON backup. */
const PORTRAIT_PX = 256;
const PORTRAIT_QUALITY = 0.72;

function portraitEl(c) {
  const url = c.identity.portraitUrl;
  const btn = el("button", {
    class: "portrait" + (url ? " has-photo" : ""), type: "button",
    "aria-label": url ? "Change the dossier photograph" : "Add a dossier photograph",
    onclick: () => openPortrait(c)
  });
  if (url) btn.appendChild(el("img", { src: url, alt: "" }));
  else btn.appendChild(el("span", { class: "ph", text: "PHOTO" }));
  return btn;
}

async function openPortrait(c) {
  if (c.identity.portraitUrl) {
    const pick = await chooseModal("Dossier photograph", [
      { key: "replace", label: "Replace it", desc: "Choose another image." },
      { key: "remove", label: "Remove it", desc: "The dossier goes back to a blank photo box." }
    ]);
    if (!pick) return;
    if (pick === "remove") {
      Store.updateActive(x => { x.identity.portraitUrl = ""; });
      renderHostAgain();
      showToast("Photograph removed", "ok");
      return;
    }
  }
  pickPortraitFile(c);
}

function pickPortraitFile(c) {
  const input = el("input", { type: "file", accept: "image/*", style: "display:none" });
  document.body.appendChild(input);
  input.addEventListener("change", async () => {
    const file = input.files && input.files[0];
    input.remove();
    if (!file) return;
    try {
      const url = await compressImage(file);
      Store.updateActive(x => { x.identity.portraitUrl = url; });
      renderHostAgain();
      showToast("Photograph added", "ok");
    } catch (e) {
      showToast("That image could not be read", "err");
    }
  });
  input.click();
}

/** Downscale to a square PORTRAIT_PX JPEG data URL. Exported for the harness. */
export function compressImage(file, px = PORTRAIT_PX) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("unreadable"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("not an image"));
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = px;
        canvas.height = px;
        const ctx = canvas.getContext("2d");
        // Cover, not stretch: a portrait crops to the middle rather than being squashed.
        const side = Math.min(img.width, img.height);
        ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, px, px);
        resolve(canvas.toDataURL("image/jpeg", PORTRAIT_QUALITY));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function renderHostAgain() {
  document.dispatchEvent(new CustomEvent("app:rerender"));
}

export function renderSheet(host) {
  const c = Store.activeCharacter();
  clear(host);

  if (!c) {
    // The empty state keeps its how-to panel: a player who lands here with nothing open is
    // exactly the one who needs to know what this screen does (N4).
    appendHelp(host, "sheet");
    host.appendChild(el("div", { class: "empty" },
      el("div", { class: "big", text: "🗂" }),
      el("h2", { text: "No dossier open" }),
      el("p", { class: "muted", text: "The sheet is the operative you play: characteristics, skills, wounds, gear and every roll they can make." }),
      el("button", { class: "btn primary", type: "button", onclick: () => navigate("create") }, "Create a character")
    ));
    return;
  }

  const dv = derived(c);
  const rankRow = R.RANK_BY_KEY[c.identity.rank];

  appendHelp(host, "sheet");

  // Identity
  const head = el("div", { class: "card" });
  head.appendChild(el("div", { class: "row" },
    portraitEl(c),
    el("div", { class: "grow" },
      el("h1", { text: c.identity.name || "Unnamed operative" }),
      el("div", { class: "small muted", text:
        [rankRow ? rankRow.name : "", c.identity.profession ? R.PROFESSION_BY_KEY[c.identity.profession].name : "",
         c.identity.age ? `age ${c.identity.age}` : ""].filter(Boolean).join(" · ") })
    )
  ));
  const traits = [];
  if (c.identity.height) traits.push(c.identity.height);
  if (c.identity.weight) traits.push(c.identity.weight);
  const app = R.APPEARANCE_BY_KEY[c.identity.appearance];
  if (app) traits.push(app.name);
  if (traits.length) head.appendChild(el("div", { class: "small muted", text: traits.join(" · ") }));
  if (c.identity.cover) head.appendChild(el("div", { class: "small", style: "margin-top:6px" },
    el("b", { text: "Cover: " }), c.identity.cover));
  host.appendChild(head);

  // Conditions banner
  const conds = conditionSummary(c);
  if (conds.length) {
    const total = conditionDFMod(c);
    host.appendChild(el("div", { class: "banner warn" },
      el("b", { text: conds.map(x => x.name).join(", ") }),
      el("div", { class: "small", text: total
        ? `Every roll takes ${signed(total)} Difficulty Factor automatically.`
        : "No standing Difficulty Factor penalty." })
    ));
  }

  // Characteristics
  const attrSection = section("Characteristics");
  const attrGrid = el("div", { class: "grid grid-3" });
  for (const ch of D.CHARACTERISTICS) {
    attrGrid.appendChild(el("button", {
      class: "stat-box clickable", type: "button",
      onclick: () => openRoll({ character: c, attrKey: ch.key })
    },
      el("div", { class: "k", text: ch.abbr }),
      el("div", { class: "v", text: String(c.attributes[ch.key]) }),
      el("div", { class: "s", text: ch.name })
    ));
  }
  attrSection.appendChild(attrGrid);
  host.appendChild(attrSection);

  // Derived
  const derSection = section("Derived");
  derSection.appendChild(el("div", { class: "grid grid-3" },
    stat("Speed", dv.speed, "PER + DEX"),
    stat("H-to-H", dv.hthDamage, "Damage Rank"),
    stat("Carry", dv.carryRange, `for ${c.attributes.wil} min`),
    stat("Run/Swim", dv.runSwim + " min", "at maximum"),
    stat("Stamina", dv.stamina + " hr", "before exhaustion"),
    stat("Draw", signed(dv.drawBonus), "Draw Situation")
  ));
  derSection.appendChild(el("p", { class: "small muted", style: "margin-top:8px", text:
    `Carrying ${dv.carriedWeight} lbs of a ${dv.carryMax} lbs maximum. Skills + Characteristics total ${dv.skillTotal} — ${expectedRankFor(dv.skillTotal)}.` }));
  if (dv.carriedWeight > dv.carryMax) {
    derSection.appendChild(el("div", { class: "banner warn", text:
      `Overloaded. Carrying more than ${dv.carryMax} lbs is impossible; at maximum load you tire after ${c.attributes.wil} minutes and take ${D.EXHAUSTION_DF_PENALTY} Difficulty Factor until you rest 15 minutes.` }));
  }
  host.appendChild(derSection);

  // Abilities
  const abSection = section("Abilities", "Fixed at Base Chance 20 and never improvable.");
  const abCard = el("div", { class: "card flush" });
  for (const a of abilityList(c)) {
    abCard.appendChild(el("button", {
      class: "skill-row", type: "button",
      onclick: () => openRoll({ character: c, skillKey: a.chosen ? a.key : null, baseChance: D.ABILITY_BASE_CHANCE, label: a.name })
    },
      el("span", { class: "n", text: a.name }),
      el("span", { class: "r", text: "Ability" }),
      el("span", { class: "b", text: String(a.base) })
    ));
  }
  abSection.appendChild(abCard);
  host.appendChild(abSection);

  // Skills
  const showUntrained = Settings.showUntrained();
  const rows = skillList(c, { includeUntrained: showUntrained });
  const groups = {};
  for (const r of rows) (groups[r.group] = groups[r.group] || []).push(r);

  const skSection = section("Skills");
  const skHead = skSection.querySelector(".section-head");
  skHead.appendChild(el("button", {
    class: "btn sm ghost", type: "button",
    onclick: () => { Settings.showUntrained; import("./settings.js").then(S => { S.set("showUntrained", !showUntrained); renderSheet(host); }); }
  }, showUntrained ? "Hide untrained" : "Show all"));

  for (const [group, list] of Object.entries(groups)) {
    const acc = el("details", { class: "acc" },
      el("summary", { text: group + ` (${list.filter(r => r.trained).length}/${list.length})` }));
    const bodyEl = el("div", { class: "acc-body", style: "padding:0" });
    for (const r of list.sort((a, b) => a.name.localeCompare(b.name))) {
      bodyEl.appendChild(el("button", {
        class: "skill-row" + (r.trained ? "" : " untrained"), type: "button",
        onclick: () => openRoll({ character: c, skillKey: r.key })
      },
        el("span", { class: "n", text: r.name + (r.gmRolled ? " ⃰" : "") }),
        el("span", { class: "r", text: r.trained ? `rank ${r.rank}/${r.maxRank}` : "untrained −3 DF" }),
        el("span", { class: "b", text: String(r.base) })
      ));
    }
    acc.appendChild(bodyEl);
    skSection.appendChild(acc);
  }
  skSection.appendChild(el("p", { class: "small muted", text: "⃰ Sixth Sense is always rolled by the GM; you can never call for it." }));
  host.appendChild(skSection);

  // Languages
  const langSection = section("Languages");
  const langCard = el("div", { class: "card flush" });
  const native = c.identity.nativeLanguage || "Native language";
  langCard.appendChild(el("div", { class: "card-row" },
    el("span", { class: "grow", text: native }),
    el("span", { class: "small muted", text: "Ability · rank 20 equivalent" }),
    el("span", { class: "mono", text: "20" })));
  for (const l of c.languages || []) {
    const f = R.fluencyFor(l.rank);
    langCard.appendChild(el("button", {
      class: "skill-row", type: "button",
      onclick: () => openRoll({ character: c, baseChance: Math.min(D.MAX_BASE_CHANCE, Number(c.attributes.int) + l.rank), label: `Language — ${l.name}` })
    },
      el("span", { class: "n", text: l.name }),
      el("span", { class: "r", text: `rank ${l.rank} · ${f.label}` }),
      el("span", { class: "b", text: String(Math.min(D.MAX_BASE_CHANCE, Number(c.attributes.int) + l.rank)) })
    ));
  }
  if (!(c.languages || []).length) langCard.appendChild(el("div", { class: "card-row muted small", text: "No additional languages." }));
  langSection.appendChild(langCard);
  host.appendChild(langSection);

  // Fields of Experience
  if ((c.foe || []).length) {
    const foeSection = section("Fields of Experience", "You either know it or you do not — no roll required.");
    const wrap = el("div", { class: "chip-wrap" });
    for (const key of c.foe) {
      const f = R.FOE_BY_KEY[key];
      if (!f) continue;
      wrap.appendChild(el("button", {
        class: "chip static", type: "button",
        onclick: () => modal({ title: f.name, body: el("p", { text: f.desc }), actions: [{ label: "OK", kind: "primary" }] })
      }, f.name));
    }
    foeSection.appendChild(wrap);
    host.appendChild(foeSection);
  }

  // Weaknesses
  if ((c.weaknesses || []).length) {
    const wkSection = section("Weaknesses", "When one comes into play, roll Willpower or the action gets harder.");
    const card = el("div", { class: "card flush" });
    for (const key of c.weaknesses) {
      const w = R.WEAKNESS_BY_KEY[key];
      if (!w) continue;
      card.appendChild(el("button", {
        class: "skill-row", type: "button",
        onclick: () => openRoll({ character: c, attrKey: "wil", label: `Resist ${w.name}` })
      },
        el("span", { class: "n", text: w.name }),
        el("span", { class: "r", text: w.type }),
        el("span", { class: "b", text: "WIL" })
      ));
    }
    wkSection.appendChild(card);
    host.appendChild(wkSection);
  }

  // Scars
  if ((c.scars || []).length) {
    const scSection = section("Scars", `Each visible scar adds ${D.SCAR_REPUTATION} Reputation once revealed.`);
    const card = el("div", { class: "card flush" });
    for (const s of c.scars) {
      // Location over note: a scar's note is a sentence, and side by side it took the row
      // and left the location — the thing the row is about — wrapped into a corner.
      card.appendChild(el("div", { class: "card-row col" },
        el("b", { text: s.location }),
        s.note ? el("span", { class: "small muted", text: s.note }) : null));
    }
    scSection.appendChild(card);
    host.appendChild(scSection);
  }

  // Actions
  host.appendChild(el("div", { class: "btn-row", style: "margin:16px 0" },
    el("button", { class: "btn primary", type: "button", onclick: () => openQuickRoll(c) }, "Roll"),
    el("button", { class: "btn", type: "button", onclick: () => openWeaponPicker(c) }, "Attack"),
    el("button", { class: "btn", type: "button", onclick: () => openNotes(c) }, "Notes")
  ));

  const val = validate(c);
  if (val.errors.length) {
    host.appendChild(el("div", { class: "banner warn" },
      el("b", { text: "Legality problems" }),
      ...val.errors.map(e => el("div", { class: "small", text: "• " + e }))));
  }
}

function section(title, sub) {
  const s = el("div", { class: "section" });
  s.appendChild(el("div", { class: "section-head" }, el("div", { class: "section-title", text: title })));
  if (sub) s.appendChild(el("p", { class: "small muted", style: "margin-top:-2px", text: sub }));
  return s;
}

function openNotes(c) {
  const ta = el("textarea", { value: c.identity.notes || "" });
  modal({
    title: "Notes",
    body: ta,
    actions: [
      { label: "Cancel", kind: "ghost" },
      { label: "Save", kind: "primary", onClick: () => {
        Store.updateActive(x => { x.identity.notes = ta.value; });
        showToast("Saved", "ok");
      } }
    ]
  });
}

/* ---------------------------------------------------------------- gear screen */

export function renderGear(host) {
  const c = Store.activeCharacter();
  clear(host);
  if (!c) {
    // "No character." was the entire screen — no explanation and nothing to tap (N2).
    appendHelp(host, "gear");
    host.appendChild(el("div", { class: "empty" },
      el("div", { class: "big", text: "⚙" }),
      el("h2", { text: "No dossier open" }),
      el("p", { class: "muted", text: "Equipment belongs to an operative: what they carry, what it weighs, the cash, the garage and the bug bench." }),
      el("button", { class: "btn primary", type: "button", onclick: () => navigate("create") }, "Create a character")));
    return;
  }

  const dv = derived(c);

  appendHelp(host, "gear");

  const moneyCard = el("div", { class: "card" },
    el("div", { class: "row" },
      el("div", { class: "grow" },
        el("div", { class: "field-label", text: "Cash on hand" }),
        el("div", { class: "mono", style: "font-size:22px", text: money(c.inventory.money || 0) })),
      el("button", { class: "btn sm", type: "button", onclick: async () => {
        const v = await promptModal("Adjust cash (use a minus sign to spend)", { title: "Cash", type: "number", value: "0" });
        const n = parseInt(v, 10);
        if (Number.isFinite(n)) {
          Store.updateActive(x => { x.inventory.money = Math.max(0, (x.inventory.money || 0) + n); });
          renderGear(host); renderResourceHeader();
        }
      } }, "Adjust")
    ),
    el("p", { class: "small muted", style: "margin-top:8px", text: D.EQUIPMENT_ACCESS.agency })
  );
  host.appendChild(moneyCard);

  const loadCard = el("div", { class: "card" },
    el("div", { class: "row" },
      el("div", { class: "grow" },
        el("div", { class: "field-label", text: "Carried weight" }),
        el("div", { class: "mono", style: "font-size:22px", text: `${dv.carriedWeight} / ${dv.carryMax} lbs` })),
      el("span", { class: "pill " + (dv.carriedWeight > dv.carryMax ? "q5" : "q1"),
        text: dv.carriedWeight > dv.carryMax ? "Over limit" : "Within limit" })
    ),
    el("p", { class: "small muted", style: "margin-top:8px", text:
      `Strength ${c.attributes.str} allows ${dv.carryRange} carried for ${c.attributes.wil} minutes. Beyond that, ${D.EXHAUSTION_DF_PENALTY} Difficulty Factor on everything until 15 minutes of rest.` })
  );
  host.appendChild(loadCard);

  const invSection = section("Inventory");
  invSection.querySelector(".section-head").appendChild(
    el("button", { class: "btn sm primary", type: "button", onclick: () => openAddItem(c, () => renderGear(host)) }, "+ Add"));

  const items = c.inventory.items || [];
  if (!items.length) {
    invSection.appendChild(el("div", { class: "empty" }, el("p", { class: "muted", text: "Nothing carried." })));
  } else {
    const card = el("div", { class: "card flush" });
    for (const item of items) {
      const w = item.key ? R.WEAPON_BY_KEY[item.key] : null;
      const row = el("div", { class: "card-row" });
      row.appendChild(el("div", { class: "grow" },
        el("div", { text: item.name + (item.qty > 1 ? ` ×${item.qty}` : "") }),
        el("div", { class: "small muted", text:
          [item.weight ? item.weight + " lbs" : null,
           item.price ? money(item.price) : null,
           w && w.dr ? "DR " + w.dr : null,
           w && w.cm !== null && w.cm !== undefined ? "Conceal " + signed(w.cm) : null,
           item.equipped ? "equipped" : null].filter(Boolean).join(" · ") })
      ));
      const grenadeType = item.key && String(item.key).startsWith("gren_")
        ? D.GRENADE_TYPES.find(g => g.key === String(item.key).slice(5))
        : null;
      if (grenadeType) {
        // Buyable with mechanics you could not reach: scatter lived on the GM screen, which
        // is off by default (A16).
        row.appendChild(el("button", { class: "btn sm", type: "button",
          onclick: () => import("./roller.js").then(m => m.openGrenadeThrow(c, grenadeType)) }, "Throw"));
      } else if (item.kind === "weapon" && w) {
        row.appendChild(el("button", { class: "btn sm", type: "button", onclick: () => openAttack(c, w) }, "Use"));
      }
      row.appendChild(el("button", {
        class: "btn sm ghost", type: "button",
        onclick: async () => {
          if (await confirmModal(`Remove ${item.name}?`, { danger: true, okLabel: "Remove" })) {
            Store.updateActive(x => { x.inventory.items = x.inventory.items.filter(i => i.id !== item.id); });
            renderGear(host);
          }
        }
      }, "✕"));
      card.appendChild(row);
    }
    invSection.appendChild(card);
  }
  host.appendChild(invSection);

  // Catalogue
  const catSection = section("Equipment catalogue", "Everything the core book lists. Tap to add to your dossier.");
  const search = el("input", { type: "search", placeholder: "Search weapons, gear, vehicles…" });
  catSection.appendChild(search);
  const results = el("div", { style: "margin-top:10px" });
  catSection.appendChild(results);

  function drawCatalogue() {
    clear(results);
    const q = search.value.trim().toLowerCase();
    const entries = [];
    for (const w of D.WEAPONS) entries.push({ kind: "weapon", key: w.key, name: w.name, cat: catLabel(w.cat), price: w.price, obj: w });
    for (const a of D.BODY_ARMOR) entries.push({ kind: "armor", key: a.key, name: a.name, cat: "Body armour", price: a.price, obj: a });
    for (const g of D.GEAR) entries.push({ kind: "gear", key: g.key, name: g.name, cat: g.cat, price: g.price, obj: g });
    for (const t of D.GRENADE_TYPES) entries.push({ kind: "gear", key: "gren_" + t.key, name: t.name + " Grenade", cat: "Grenades", price: t.price, obj: t });
    for (const s of D.SUPPRESSORS) entries.push({ kind: "gear", key: "sup_" + s.key, name: s.name, cat: "Suppressors", price: s.pistol, obj: s });
    for (const s of D.SIGHTS) entries.push({ kind: "gear", key: "sight_" + s.key, name: s.name, cat: "Sights", price: s.price || s.pistol, obj: s });
    for (const h of D.HOLSTERS) entries.push({ kind: "gear", key: "hol_" + h.key, name: h.name + " holster", cat: "Holsters", price: h.price, obj: h });
    for (const a of D.AMMUNITION) entries.push({ kind: "gear", key: "ammo_" + a.key, name: a.name + " ammunition", cat: "Ammunition", price: a.price, obj: a });

    const filtered = q
      ? entries.filter(e => e.name.toLowerCase().includes(q) || e.cat.toLowerCase().includes(q))
      : entries.slice(0, 24);

    if (!filtered.length) { results.appendChild(el("p", { class: "muted small", text: "Nothing matches." })); return; }

    const byCat = {};
    for (const e of filtered) (byCat[e.cat] = byCat[e.cat] || []).push(e);
    for (const [cat, list] of Object.entries(byCat)) {
      // Closed by default; a live search opens the groups it matched, which is a result
      // rather than a default.
      const acc = el("details", { class: "acc", open: !!q }, el("summary", { text: `${cat} (${list.length})` }));
      const bodyEl = el("div", { class: "acc-body", style: "padding:0" });
      for (const e of list) {
        bodyEl.appendChild(el("button", {
          class: "skill-row", type: "button",
          onclick: () => showCatalogueEntry(c, e, () => renderGear(host))
        },
          el("span", { class: "n", text: e.name }),
          el("span", { class: "b", text: e.price ? money(e.price).replace("$", "$") : "—" })
        ));
      }
      acc.appendChild(bodyEl);
      results.appendChild(acc);
    }

    if (!q) results.appendChild(el("p", { class: "small muted", style: "margin-top:8px", text: "Search to see the full catalogue." }));
  }
  search.addEventListener("input", drawCatalogue);
  drawCatalogue();
  host.appendChild(catSection);

  host.appendChild(garageSection(c, host));
  host.appendChild(bugSection(c, host));

  // Vehicles
  const vSection = section("Vehicles you could own");
  const vSearch = el("input", { type: "search", placeholder: "Search vehicles…" });
  vSection.appendChild(vSearch);
  const vResults = el("div", { style: "margin-top:10px" });
  vSection.appendChild(vResults);
  function drawVehicles() {
    clear(vResults);
    const q = vSearch.value.trim().toLowerCase();
    const list = q ? D.VEHICLES.filter(v => v.name.toLowerCase().includes(q)) : D.VEHICLES.slice(0, 8);
    const card = el("div", { class: "card flush" });
    for (const v of list) {
      card.appendChild(el("button", {
        class: "skill-row", type: "button",
        onclick: () => showVehicle(v)
      },
        el("span", { class: "n", text: v.name }),
        el("span", { class: "r", text: `Perf ${signed(v.pm)} · Limit ${v.pl} · Ram ${v.ram}` }),
        el("span", { class: "b", text: String(v.mp) })
      ));
    }
    vResults.appendChild(card);
    if (!q) vResults.appendChild(el("p", { class: "small muted", text: "Search to see all 78 vehicles. The final column is Modification Points." }));
  }
  vSearch.addEventListener("input", drawVehicles);
  drawVehicles();
  host.appendChild(vSection);
}

function catLabel(cat) {
  return ({ pistol: "Pistols", rifle: "Rifles", shotgun: "Shotguns", smg: "Submachine guns",
    heavy: "Heavy weapons", misc: "Miscellaneous weapons", hth: "Hand-to-hand weapons" })[cat] || cat;
}

function showCatalogueEntry(c, entry, onAdd) {
  const o = entry.obj;
  const body = el("div", {});
  if (o.desc) body.appendChild(el("p", { text: o.desc }));
  if (o.effect) body.appendChild(el("p", { text: o.effect }));

  if (entry.kind === "weapon") {
    const t = el("table", { class: "data" });
    const rows = [
      ["Performance Modifier", o.pm !== undefined ? signed(o.pm) : "—"],
      ["Rate of Fire", o.rof ?? "—"],
      ["Ammunition", o.ammo ?? "—"],
      ["Damage Rank", o.dr || (o.drBonus ? "+" + o.drBonus : "—")],
      ["Burst Damage Rank", o.drBurst || "—"],
      ["Close range", o.close || "—"],
      ["Long range", o.long || "—"],
      ["Concealment Modifier", o.cm === null || o.cm === undefined ? "n/a" : signed(o.cm)],
      ["Misfire", o.mis || "—"],
      ["Draw", o.draw === null || o.draw === undefined ? "n/a" : signed(o.draw)],
      ["Reload rounds", o.rl ?? "—"],
      ["Price", money(o.price)]
    ];
    for (const [k, v] of rows) t.appendChild(el("tr", {}, el("th", { text: k }), el("td", { class: "num", text: String(v) })));
    body.appendChild(el("div", { class: "table-wrap" }, t));
  }
  if (entry.kind === "armor") {
    body.appendChild(el("p", { class: "small", text:
      `Reduces firearm and shrapnel Damage Rank by ${o.firearm} steps, cutting and stabbing by ${o.cutting}, bludgeoning by ${o.blunt}.` +
      (o.absorbs ? ` Absorbs ${o.absorbs} Wound Ranks.` : "") +
      (o.spotDF ? ` Spotted on a Difficulty Factor ${o.spotDF} Perception check.` : "") }));
    for (const n of D.ARMOR_NOTES) body.appendChild(el("p", { class: "small muted", text: n }));
  }

  modal({
    title: entry.name,
    body,
    actions: [
      { label: "Close", kind: "ghost" },
      { label: "Add to dossier", kind: "primary", onClick: () => {
        Store.updateActive(x => {
          x.inventory.items.push({
            id: uid("item"), key: o.key || entry.key, kind: entry.kind,
            name: entry.name, qty: 1, weight: 0, equipped: false, price: entry.price || 0
          });
        });
        showToast("Added", "ok");
        if (onAdd) onAdd();
      } }
    ]
  });
}

/**
 * The garage: the vehicles this dossier actually owns.
 *
 * They were storable from the wizard and rendered nowhere, and the 36 vehicle modifications
 * had no surface at all — which matters, because Modification Points are both the budget for
 * fitting them and the measure of how much damage the vehicle absorbs for the people inside
 * it (finding A17).
 */
/**
 * The bug workshop. The parts were all in the catalogue and the assembly rule was in the
 * data, but building one meant buying four separate rows and doing the arithmetic by hand
 * (finding A18). Choose a part per step and it prices the whole thing, surcharge included,
 * and puts the finished bug on the dossier as one item.
 */
function bugSection(c, host) {
  const sec = section("Build a bug");
  sec.appendChild(el("p", { class: "small muted", text: D.BUG_BUILD_NOTE }));
  sec.appendChild(el("button", {
    class: "btn block", type: "button", onclick: () => openBugBuilder(c, host)
  }, "Build one"));
  return sec;
}

function openBugBuilder(c, host) {
  const parts = Object.fromEntries(D.BUG_BUILD_STEPS.map(st => [st.key, st.keys[0]]));
  const body = el("div", {});
  const total = el("div", { class: "banner ok" });

  const partOf = key => D.GEAR.find(g => g.key === key);
  const price = () => {
    const sum = D.BUG_BUILD_STEPS.reduce((n, st) => n + (partOf(parts[st.key]).price || 0), 0);
    return Math.round(sum * (1 + D.BUG_ASSEMBLY_SURCHARGE));
  };
  const name = () => "Bug: " + D.BUG_BUILD_STEPS
    .map(st => partOf(parts[st.key]).name.split(": ")[1] || partOf(parts[st.key]).name)
    .join(" / ");

  const draw = () => {
    clear(total);
    total.appendChild(el("b", { text: money(price()) }));
    total.appendChild(el("div", { class: "small", text:
      `Parts plus the ${Math.round(D.BUG_ASSEMBLY_SURCHARGE * 100)}% assembly surcharge. Casing is bought separately.` }));
    total.appendChild(el("div", { class: "small muted", text: name() }));
  };

  for (const st of D.BUG_BUILD_STEPS) {
    body.appendChild(el("div", { class: "field-label", style: "margin-top:12px", text: st.name }));
    const wrap = el("div", { class: "chip-wrap" });
    const drawStep = () => {
      clear(wrap);
      for (const key of st.keys) {
        const part = partOf(key);
        wrap.appendChild(el("button", {
          class: "chip" + (parts[st.key] === key ? " on" : ""), type: "button",
          title: part.desc,
          onclick: () => { parts[st.key] = key; drawStep(); draw(); }
        }, `${part.name.split(": ")[1] || part.name} ${part.price ? money(part.price) : "free"}`));
      }
    };
    drawStep();
    body.appendChild(wrap);
    body.appendChild(el("p", { class: "lm", text: partOf(parts[st.key]).desc }));
  }
  draw();
  body.appendChild(total);

  const m = modal({
    title: "Build a bug", body,
    actions: [
      { label: "Cancel", kind: "ghost" },
      { label: "Add to the dossier", kind: "primary", close: false, onClick: () => {
        const cost = price();
        m.close();
        Store.updateActive(x => {
          x.inventory.items.push({
            id: uid("item"), key: null, kind: "custom", name: name(), qty: 1,
            weight: 0, equipped: false, price: cost,
            notes: D.BUG_BUILD_STEPS.map(st => partOf(parts[st.key]).desc).join(" ")
          });
          x.inventory.money = Math.max(0, (x.inventory.money || 0) - cost);
        });
        showToast(`Built for ${money(cost)}`, "ok");
        renderGear(host);
      } }
    ]
  });
}

function garageSection(c, host) {
  const sec = section("Your vehicles");
  sec.querySelector(".section-head").appendChild(el("button", {
    class: "btn sm primary", type: "button", onclick: () => addVehicle(c, host)
  }, "+ Add"));

  const owned = c.vehicles || [];
  if (!owned.length) {
    sec.appendChild(el("div", { class: "empty" },
      el("p", { class: "muted", text: "No vehicle on the dossier. Agency characters are usually issued one." })));
    return sec;
  }

  for (const v of owned) {
    const stock = R.VEHICLE_BY_KEY[v.key];
    const card = el("div", { class: "card" });
    const spent = modPointsSpent(v);
    const budget = stock ? stock.mp : 0;

    card.appendChild(el("div", { class: "row" },
      el("div", { class: "grow" },
        el("div", { style: "font-weight:600", text: v.name || (stock ? stock.name : "Vehicle") }),
        el("div", { class: "small muted", text: stock
          ? `Perf ${signed(stock.pm)} · limit ${stock.pl} · cruise ${stock.cruise} · max ${stock.max} · ram ${stock.ram}`
          : "Not in the catalogue" })),
      v.wound && v.wound !== "none" ? el("span", { class: "pill q5", text: R.woundLevel(v.wound).name }) : null,
      el("span", { class: "mono small", text: `${spent} / ${budget} MP` })));

    if (v.mods.length) {
      const list = el("div", { class: "card flush", style: "margin-top:8px" });
      for (const key of v.mods) {
        const mod = D.VEHICLE_MODS.find(m => m.key === key);
        if (!mod) continue;
        list.appendChild(el("div", { class: "card-row" },
          el("div", { class: "grow" },
            el("div", { class: "small", text: mod.name }),
            el("div", { class: "lm", text: mod.desc })),
          el("span", { class: "mono small", text: mod.mp ? `${mod.mp} MP` : "—" }),
          el("button", { class: "btn sm ghost", type: "button", "aria-label": `Remove ${mod.name}`,
            onclick: () => {
              Store.updateActive(x => {
                const y = x.vehicles.find(z => z.id === v.id);
                if (y) y.mods = y.mods.filter(m => m !== key);
              });
              renderGear(host);
            } }, "✕")));
      }
      card.appendChild(list);
    }

    const armour = vehicleArmour(v);
    if (armour.reduces || armour.absorbs) {
      card.appendChild(el("p", { class: "small muted", style: "margin-top:8px", text:
        `Armour reduces an incoming Damage Rank by ${armour.reduces} steps` +
        (armour.absorbs ? ` and absorbs ${armour.absorbs} Wound Rank.` : ".") }));
    }

    card.appendChild(el("div", { class: "btn-row", style: "margin-top:8px" },
      el("button", { class: "btn sm", type: "button", onclick: () => fitModification(c, v, host) }, "Fit a modification"),
      el("button", { class: "btn sm", type: "button", onclick: () => vehicleDamage(c, v, host) }, "Damage"),
      stock ? el("button", { class: "btn sm ghost", type: "button", onclick: () => showVehicle(stock) }, "Stats") : null,
      el("button", { class: "btn sm ghost", type: "button", onclick: async () => {
        if (await confirmModal(`Give up the ${v.name}?`, { okLabel: "Remove", danger: true })) {
          Store.updateActive(x => { x.vehicles = x.vehicles.filter(z => z.id !== v.id); });
          renderGear(host);
        }
      } }, "✕")));

    sec.appendChild(card);
  }
  return sec;
}

function modPointsSpent(v) {
  return (v.mods || []).reduce((n, key) => {
    const mod = D.VEHICLE_MODS.find(m => m.key === key);
    return n + (mod ? Number(mod.mp) || 0 : 0);
  }, 0);
}

/** What the fitted armour does to an incoming hit. The best fitted level applies, not the sum. */
function vehicleArmour(v) {
  let reduces = 0;
  let absorbs = 0;
  for (const key of v.mods || []) {
    const mod = D.VEHICLE_MODS.find(m => m.key === key);
    if (!mod) continue;
    reduces = Math.max(reduces, Number(mod.reduces) || 0);
    absorbs = Math.max(absorbs, Number(mod.absorbs) || 0);
  }
  return { reduces, absorbs };
}

async function addVehicle(c, host) {
  const pick = await chooseModal("Add a vehicle", D.VEHICLES.map(v => ({
    key: v.key, label: v.name, right: `${v.mp} MP`,
    desc: `Perf ${signed(v.pm)} · cruise ${v.cruise} · ${money(v.price)}`
  })));
  if (!pick) return;
  const stock = R.VEHICLE_BY_KEY[pick];
  Store.updateActive(x => {
    x.vehicles.push({ id: uid("veh"), key: stock.key, name: stock.name, mods: [], wound: "none", note: "" });
  });
  renderGear(host);
}

/** Fit a modification, refusing anything the Modification Point budget cannot pay for. */
async function fitModification(c, v, host) {
  const stock = R.VEHICLE_BY_KEY[v.key];
  const budget = stock ? stock.mp : 0;
  const spent = modPointsSpent(v);
  const left = budget - spent;

  const pick = await chooseModal("Fit a modification", D.VEHICLE_MODS
    .filter(m => !v.mods.includes(m.key))
    .map(m => ({
      key: m.key, label: m.name,
      right: (Number(m.mp) || 0) > left ? "no room" : (m.mp ? `${m.mp} MP` : "free"),
      desc: `${m.price} — ${m.desc}`
    })), { intro: `${left} of ${budget} Modification Points left. Modification Points are also what the vehicle absorbs for its occupants, so spending them all has a cost in a crash.` });
  if (!pick) return;

  const mod = D.VEHICLE_MODS.find(m => m.key === pick);
  if ((Number(mod.mp) || 0) > left) {
    showToast(`${mod.name} needs ${mod.mp} Modification Points and only ${left} are left`, "err");
    return;
  }
  Store.updateActive(x => {
    const y = x.vehicles.find(z => z.id === v.id);
    if (y) y.mods.push(pick);
  });
  renderGear(host);
}

/**
 * Damage the vehicle, and work out what the people inside take. The occupant chain is the
 * book's: one rank less than the vehicle, a seat belt another, an airbag one more.
 */
async function vehicleDamage(c, v, host) {
  const key = await chooseModal(`Damage the ${v.name}`, D.WOUND_LEVELS.filter(w => w.key !== "none")
    .map(w => ({ key: w.key, label: w.name, desc: w.desc || "" })),
    { intro: "Vehicle wounds are additive, the same as a character's." });
  if (!key) return;

  const armour = vehicleArmour(v);
  const landed = armour.absorbs ? R.healWound(key, armour.absorbs) : key;
  const after = R.accumulateWound(v.wound || "none", landed);
  const occupant = R.occupantWound(after, { seatbelt: Settings.seatbelts(), airbag: Settings.airbags() });

  Store.updateActive(x => {
    const y = x.vehicles.find(z => z.id === v.id);
    if (y) y.wound = after;
  });

  const body = el("div", {});
  if (armour.absorbs) {
    body.appendChild(el("p", { class: "small muted", text:
      `Armour absorbed ${armour.absorbs} Wound Rank, so a ${R.woundLevel(key).name} landed as a ${R.woundLevel(landed).name}.` }));
  }
  body.appendChild(el("div", { class: "banner warn" },
    el("b", { text: `${v.name}: ${R.woundLevel(after).name}` }),
    el("div", { class: "small", text: `Occupants take a ${R.woundLevel(occupant).name} — one rank less than the vehicle` +
      (Settings.seatbelts() ? ", another for the seat belt" : "") +
      (Settings.airbags() ? ", one more for the airbag" : "") + "." })));

  modal({
    title: "Vehicle damage", body,
    actions: [
      occupant !== "none"
        ? { label: `Apply to ${c.identity.name || "me"}`, kind: "danger", close: false,
            onClick: () => import("./roller.js").then(m => m.applyDamageToCharacter(c, occupant)) }
        : null,
      { label: "Done", kind: "primary" }
    ].filter(Boolean)
  });
  renderGear(host);
}

function showVehicle(v) {
  const t = el("table", { class: "data" });
  const rows = [
    ["Performance Modifier", signed(v.pm)],
    ["Performance Limit", v.pl],
    ["Cruise speed", v.cruise + " mph"],
    ["Maximum speed", v.max + " mph"],
    ["Range", v.range + " miles"],
    ["Ram rating", v.ram],
    ["Modification Points", v.mp],
    ["Damage Rank reduction to occupants", v.mp > 200 ? 3 : v.mp > 50 ? 2 : v.mp > 10 ? 1 : 0],
    ["Price", money(v.price)],
    ["Skill used", R.skillName(R.vehicleSkillFor(v.key))]
  ];
  for (const [k, val] of rows) t.appendChild(el("tr", {}, el("th", { text: k }), el("td", { class: "num", text: String(val) })));
  modal({
    title: v.name,
    body: el("div", {},
      el("div", { class: "table-wrap" }, t),
      el("p", { class: "small muted", text:
        `Bidding below Difficulty Factor ${v.pl} in a chase forces an automatic Control check.` })),
    actions: [{ label: "Close", kind: "primary" }]
  });
}

async function openAddItem(c, onDone) {
  const name = await promptModal("Item name", { title: "Add item" });
  if (!name) return;
  const weight = parseFloat(await promptModal("Weight in pounds (0 if negligible)", { title: name, type: "number", value: "0" })) || 0;
  Store.updateActive(x => {
    x.inventory.items.push({ id: uid("item"), key: null, kind: "custom", name, qty: 1, weight, equipped: false, price: 0 });
  });
  if (onDone) onDone();
}
