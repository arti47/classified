/* roller.js — the dice engine.
 * Every roll in the app goes through resolve(), which records to the roll log and
 * offers Hero Point spends. Opposed procedures live here so they run identically
 * wherever they are invoked.
 */

import { el, clear, d100, d10, die, announce, clamp, dfLabel, signed, percent } from "./core.js";
import { modal, showToast, promptModal, chooseModal, confirmModal } from "./ui.js";
import * as D from "../data.js";
import * as R from "./rules.js";
import * as Store from "./store.js";
import { Settings } from "./settings.js";
import { baseChanceFor, isTrained, conditionDFMod, conditionSummary, applyWound, derived } from "./derived.js";
import { openRulesTopic } from "./screens.js";

/* ---------------------------------------------------------------- primitives */

/** Roll or ask for a d100 depending on the manual-dice setting. */
export async function getD100(label = "d100") {
  if (!Settings.manualDice()) return d100();
  const v = await promptModal(`Enter your ${label} result (1-100)`, {
    title: "Manual dice", type: "number", okLabel: "Use result"
  });
  const n = parseInt(v, 10);
  if (!Number.isFinite(n) || n < 1 || n > 100) return d100();
  return n;
}

/**
 * Core resolution.
 * @param {object} opts
 *   baseChance, df, modifiers:[{name,value}], rollValue (optional pre-rolled),
 *   label, character, skillKey, isCombat, weapon
 * @returns {object} result record
 */
export function resolve(opts) {
  const mods = (opts.modifiers || []).filter(m => m && m.value);
  const steps = mods.reduce((t, m) => t + Number(m.value || 0), 0);
  const df = D.stepDF(opts.df ?? D.BASE_DIFFICULTY_FACTOR, steps);
  const sc = D.successChance(opts.baseChance, df);
  const rollValue = opts.rollValue ?? d100();
  const quality = D.qualityForRoll(rollValue, sc);
  const bands = D.qualityBands(sc);

  return {
    label: opts.label || "Check",
    skillKey: opts.skillKey || null,
    baseChance: Math.min(opts.baseChance, D.MAX_BASE_CHANCE),
    startDF: opts.df ?? D.BASE_DIFFICULTY_FACTOR,
    df, steps, modifiers: mods,
    successChance: sc,
    roll: rollValue,
    quality,
    baseQuality: quality,
    heroSpent: 0,
    bands,
    isCombat: !!opts.isCombat,
    weaponKey: opts.weapon ? opts.weapon.key : null,
    ts: Date.now()
  };
}

export function qualityPill(q) {
  return el("span", { class: "pill q" + q, text: D.QUALITY_SHORT[q] });
}

function formulaText(res) {
  const parts = [`Base ${res.baseChance}`, `DF ${dfLabel(res.df)}`, `= SC ${res.successChance}`];
  if (res.modifiers.length) {
    parts.push("(" + res.modifiers.map(m => `${m.name} ${signed(m.value)}`).join(", ") + ")");
  }
  return parts.join(" · ");
}

/* ---------------------------------------------------------------- result UI */

function bandsRow(res) {
  const b = res.bands;
  const wrap = el("div", { class: "bands" });
  const seg = (name, range, q) => {
    if (!range) return null;
    return el("div", { class: "band" + (res.quality === q ? " hit" : "") },
      el("span", { class: "bl", text: name }),
      range[0] === range[1] ? String(range[0]) : `${range[0]}-${range[1]}`
    );
  };
  wrap.appendChild(seg("Superb", b.superb, 1));
  wrap.appendChild(seg("Great", b.great, 2));
  if (b.good) wrap.appendChild(seg("Good", b.good, 3));
  if (b.fair) wrap.appendChild(seg("Fair", b.fair, 4));
  const failFrom = (b.fair ? b.fair[1] : (b.good ? b.good[1] : b.great[1])) + 1;
  if (failFrom <= 100) {
    wrap.appendChild(el("div", { class: "band" + (res.quality === 5 ? " hit" : "") },
      el("span", { class: "bl", text: "Fail" }), `${failFrom}-100`));
  }
  return wrap;
}

/**
 * Show a result, offer Hero Point spends, log it, then run onDone(result).
 */
export function presentResult(res, { character, onDone, extra, title } = {}) {
  const body = el("div", {});
  const rollEl = el("div", { class: "roll-d100", text: String(res.roll) });
  const qEl = el("div", { class: "roll-quality q" + res.quality, text: D.QUALITY_NAMES[res.quality] });
  const formula = el("div", { class: "roll-formula", text: formulaText(res) });

  body.appendChild(el("div", { class: "roll-result" }, rollEl, qEl, formula));
  const bandsEl = bandsRow(res);
  body.appendChild(bandsEl);

  if (res.roll >= 100) {
    body.appendChild(el("div", { class: "banner warn", text: "A d100 of 100 is always a failure, whatever the Success Chance." }));
  }

  const extraSlot = el("div", {});
  // An extra renderer may have nothing to add for this result — a clean Stealth has no
  // observer's check — so a null return is legitimate rather than an error.
  const drawExtra = () => { const node = extra ? extra(res) : null; if (node) extraSlot.appendChild(node); };
  drawExtra();
  body.appendChild(extraSlot);

  const heroSlot = el("div", {});
  body.appendChild(heroSlot);

  const m = modal({ title: title || res.label, body });

  function refresh() {
    rollEl.textContent = String(res.roll);
    qEl.textContent = D.QUALITY_NAMES[res.quality] + (res.heroSpent ? ` (${res.heroSpent} Hero Point${res.heroSpent === 1 ? "" : "s"})` : "");
    qEl.className = "roll-quality q" + res.quality;
    const fresh = bandsRow(res);
    bandsEl.replaceWith(fresh);
    Object.assign(bandsEl, fresh);
    clear(extraSlot);
    drawExtra();
    drawHero();
  }

  function drawHero() {
    clear(heroSlot);
    if (!character || !Settings.heroPointPrompt()) return;
    const hp = character.state.heroPoints || 0;
    if (hp <= 0 && !res.heroSpent) return;

    const canImprove = res.quality > 1 && hp > 0;
    const row = el("div", { class: "row tight", style: "margin-top:10px" });
    row.appendChild(el("span", { class: "small muted", text: `Hero Points: ${hp}` }));
    row.appendChild(el("span", { class: "spacer" }));
    if (canImprove) {
      row.appendChild(el("button", {
        class: "btn sm primary", type: "button",
        onclick: () => {
          Store.updateActive(c => { c.state.heroPoints = Math.max(0, (c.state.heroPoints || 0) - 1); });
          character.state.heroPoints = Math.max(0, (character.state.heroPoints || 0) - 1);
          res.heroSpent += 1;
          res.quality = Math.max(1, res.quality - 1);
          refresh();
        }
      }, "Spend 1 → improve"));
    }
    if (res.heroSpent > 0) {
      row.appendChild(el("button", {
        class: "btn sm ghost", type: "button",
        onclick: () => {
          Store.updateActive(c => { c.state.heroPoints = (c.state.heroPoints || 0) + 1; });
          character.state.heroPoints = (character.state.heroPoints || 0) + 1;
          res.heroSpent -= 1;
          res.quality = Math.min(5, res.quality + 1);
          refresh();
        }
      }, "Refund 1"));
    }
    heroSlot.appendChild(row);
    heroSlot.appendChild(el("p", { class: "small muted", style: "margin-top:6px",
      text: "One Hero Point shifts the result one Success Quality step. For checks a GM rolls in secret, the spend must be committed before the result is revealed." }));
  }

  drawHero();

  m.setActions([
    { label: "Rules", kind: "ghost", close: false, onClick: () => openRulesTopic(res.isCombat ? "wounds" : "resolution") },
    { label: "Done", kind: "primary", onClick: () => finish() }
  ]);

  function finish() {
    // Hero Point award, per the campaign style.
    if (character && R.earnsHeroPoint(res.quality, Settings.campaignStyle(), res.isCombat, res.heroSpent > 0)) {
      Store.updateActive(c => { c.state.heroPoints = (c.state.heroPoints || 0) + 1; });
      character.state.heroPoints = (character.state.heroPoints || 0) + 1;
      showToast("Hero Point earned", "ok");
    }
    Store.addRoll({
      by: character ? character.identity.name || "Agent" : "—",
      characterId: character ? character.id : null,
      label: res.label,
      roll: res.roll,
      quality: res.quality,
      baseQuality: res.baseQuality,
      heroSpent: res.heroSpent,
      baseChance: res.baseChance,
      df: res.df,
      successChance: res.successChance,
      modifiers: res.modifiers,
      note: res.note || ""
    });
    announce(`${res.label}: rolled ${res.roll}, ${D.QUALITY_NAMES[res.quality]}`);
    if (onDone) onDone(res);
  }

  return m;
}

/* ---------------------------------------------------------------- roll dialog */

const MOD_PRESETS = [
  { name: "Untrained skill", value: -3 },
  { name: "Surprised target", value: 4 },
  { name: "Taking aim", value: 3 },
  { name: "Target within 10 feet", value: 2 },
  { name: "Close range", value: 1 },
  { name: "Long range", value: -1 },
  { name: "Firer moved", value: -2 },
  { name: "Target moved", value: -2 },
  { name: "One-third cover / kneeling", value: -2 },
  { name: "Two-thirds cover / prone", value: -4 },
  { name: "Defensive movement", value: -4 },
  { name: "Specific Fire", value: -2 }
];

/**
 * Open the full roll dialog for a skill or characteristic.
 * @param {object} opts { character, skillKey, attrKey, label, df, modifiers, isCombat, weapon, onResult }
 */
export function openRoll(opts = {}) {
  const character = opts.character || Store.activeCharacter();
  if (!character) { showToast("Create a character first", "err"); return; }

  const skillKey = opts.skillKey || null;
  const attrKey = opts.attrKey || null;

  let base;
  let label = opts.label;
  if (skillKey) {
    base = baseChanceFor(character, skillKey);
    label = label || R.skillName(skillKey);
  } else if (attrKey) {
    base = Number(character.attributes[attrKey]) || 0;
    label = label || attrKey.toUpperCase() + " check";
  } else {
    base = opts.baseChance || 0;
    label = label || "Check";
  }

  const mods = [...(opts.modifiers || [])];
  if (skillKey && !isTrained(character, skillKey)) {
    mods.push({ name: "Untrained", value: D.UNTRAINED_DF_PENALTY, locked: true });
  }
  if (Settings.autoConditions()) {
    for (const cond of conditionSummary(character)) {
      if (cond.dfMod) mods.push({ name: cond.name, value: cond.dfMod, locked: true });
    }
  }

  let df = opts.df ?? D.BASE_DIFFICULTY_FACTOR;

  const body = el("div", {});
  const preview = el("div", { class: "card", style: "margin-bottom:12px" });
  body.appendChild(preview);

  body.appendChild(el("div", { class: "field-label", text: "Difficulty Factor" }));
  const ladder = el("div", { class: "df-ladder" });
  body.appendChild(ladder);
  body.appendChild(el("p", { class: "small muted", style: "margin:6px 0 12px",
    text: "Base 5. Higher is easier. Modifiers move the Difficulty Factor one step at a time along the ladder." }));

  body.appendChild(el("div", { class: "field-label", text: "Modifiers" }));
  const modList = el("div", {});
  body.appendChild(modList);

  const presetWrap = el("div", { class: "chip-wrap", style: "margin-top:8px" });
  for (const p of MOD_PRESETS) {
    presetWrap.appendChild(el("button", {
      class: "chip", type: "button",
      onclick: () => { mods.push({ ...p }); render(); }
    }, `${p.name} ${signed(p.value)}`));
  }
  body.appendChild(presetWrap);

  function render() {
    clear(preview);
    const effective = D.stepDF(df, mods.reduce((t, m) => t + Number(m.value || 0), 0));
    const sc = D.successChance(base, effective);
    const b = D.qualityBands(sc);
    preview.appendChild(el("div", { class: "row" },
      el("div", { class: "stat-box", style: "flex:1" },
        el("div", { class: "k", text: "Base Chance" }), el("div", { class: "v", text: String(base) })),
      el("div", { class: "stat-box", style: "flex:1" },
        el("div", { class: "k", text: "Difficulty" }), el("div", { class: "v", text: dfLabel(effective) })),
      el("div", { class: "stat-box", style: "flex:1" },
        el("div", { class: "k", text: "Success Chance" }), el("div", { class: "v", text: String(sc) }))
    ));
    preview.appendChild(el("div", { class: "roll-formula", style: "text-align:center",
      text: `Superb 1-${b.superb[1]} · Great ${b.great[0]}-${b.great[1]}` +
        (b.good ? ` · Good ${b.good[0]}-${b.good[1]}` : "") +
        (b.fair ? ` · Fair ${b.fair[0]}-${b.fair[1]}` : "") }));

    clear(ladder);
    for (const step of D.DIFFICULTY_FACTORS) {
      ladder.appendChild(el("button", {
        class: "df-step" + (step === df ? " on" : ""), type: "button",
        onclick: () => { df = step; render(); }
      }, dfLabel(step)));
    }

    clear(modList);
    if (!mods.length) modList.appendChild(el("p", { class: "small muted", text: "None." }));
    for (let i = 0; i < mods.length; i++) {
      const m = mods[i];
      modList.appendChild(el("div", { class: "card-row", style: "padding-left:0;padding-right:0" },
        el("span", { class: "grow", text: m.name }),
        el("span", { class: "mono", text: signed(m.value) }),
        m.locked
          ? el("span", { class: "small muted", text: "auto" })
          : el("button", { class: "btn sm ghost", type: "button", onclick: () => { mods.splice(i, 1); render(); } }, "✕")
      ));
    }
  }
  render();

  const m = modal({
    title: label,
    body,
    actions: [
      { label: "Cancel", kind: "ghost" },
      {
        label: "Roll", kind: "primary", close: false,
        onClick: async () => {
          m.close();
          const rollValue = await getD100();
          const res = resolve({
            baseChance: base, df, modifiers: mods, rollValue,
            label, skillKey, isCombat: opts.isCombat, weapon: opts.weapon
          });
          presentResult(res, {
            character,
            extra: r => {
              const own = opts.extra ? opts.extra(r) : null;
              const opposed = opposedPanel(character, skillKey, r);
              if (own && opposed) return el("div", {}, own, opposed);
              return own || opposed;
            },
            onDone: opts.onResult
          });
        }
      }
    ]
  });
}

/* ---------------------------------------------------------------- combat */

/** Fire Combat or Hand-to-Hand attack with damage application. */
export function openAttack(character, weapon, options = {}) {
  const dv = derived(character);
  const isHTH = weapon && weapon.cat === "hth";
  const skillKey = R.weaponSkill(weapon);

  const body = el("div", {});
  const state = {
    rangeBand: "average",
    targetSpeed: 0,
    action: isHTH ? "punch" : "normal",
    burst: false,
    silencer: false,
    hollowPoint: false,
    mods: []
  };

  // Who you are shooting at. An encounter already knows every combatant and their Speed, so
  // the attack reads the target from the tracker rather than making the player type a Speed
  // they can see on the next screen — and the wound it works out can then be applied to them
  // instead of being read out and re-entered by hand (ruling A13).
  const encounter = Store.combatState();
  const targets = encounter.active
    ? encounter.combatants.filter(cb => !cb.characterId || cb.characterId !== character.id)
    : [];
  if (targets.length) {
    state.targetId = options.targetId || targets[0].id;
    const t0 = targets.find(cb => cb.id === state.targetId);
    if (t0) state.targetSpeed = clamp(Number(t0.speed) || 0, 0, 3);
  }

  const controls = el("div", {});
  body.appendChild(controls);

  function drawControls() {
    clear(controls);

    if (targets.length) {
      controls.appendChild(el("div", { class: "field-label", text: "Target" }));
      const tw = el("div", { class: "chip-wrap" });
      for (const cb of targets) {
        tw.appendChild(el("button", {
          class: "chip" + (state.targetId === cb.id ? " on" : ""), type: "button",
          onclick: () => {
            state.targetId = cb.id;
            state.targetSpeed = clamp(Number(cb.speed) || 0, 0, 3);
            drawControls();
          }
        }, `${cb.name} (Speed ${cb.speed})`));
      }
      controls.appendChild(tw);
    }

    if (weapon) {
      controls.appendChild(el("div", { class: "banner", text:
        `${weapon.name} · Damage Rank ${weapon.dr || "+" + (weapon.drBonus || 0)}` +
        (weapon.pm ? ` · Performance ${signed(weapon.pm)}` : "") +
        (weapon.rof ? ` · Rate of Fire ${weapon.rof}` : "") }));
    }

    if (isHTH) {
      controls.appendChild(el("div", { class: "field-label", text: "Attack type" }));
      const wrap = el("div", { class: "chip-wrap" });
      for (const a of D.HTH_ACTIONS) {
        wrap.appendChild(el("button", {
          class: "chip" + (state.action === a.key ? " on" : ""), type: "button",
          onclick: () => { state.action = a.key; drawControls(); }
        }, `${a.name}${a.mod ? " " + signed(a.mod) : ""}`));
      }
      controls.appendChild(wrap);
      const act = D.HTH_ACTIONS.find(a => a.key === state.action);
      controls.appendChild(el("p", { class: "small muted", style: "margin-top:6px", text: act.desc }));

      controls.appendChild(el("div", { class: "field-label", style: "margin-top:12px",
        text: state.targetId
          ? "Target Speed (taken from the tracker, lowers the base Difficulty Factor)"
          : "Target Speed (lowers the base Difficulty Factor)" }));
      const sw = el("div", { class: "chip-wrap" });
      for (const s of [0, 1, 2, 3]) {
        sw.appendChild(el("button", {
          class: "chip" + (state.targetSpeed === s ? " on" : ""), type: "button",
          onclick: () => { state.targetSpeed = s; drawControls(); }
        }, `Speed ${s} → DF ${5 - s}`));
      }
      controls.appendChild(sw);
    } else {
      controls.appendChild(el("div", { class: "field-label", text: "Range" }));
      const rw = el("div", { class: "chip-wrap" });
      const ranges = [
        { key: "point", label: `Within 10 ft (+2 DF, +1 DR)` },
        { key: "close", label: `Close ${weapon?.close || ""} (+1 DF, +1 DR)` },
        { key: "average", label: "Average (no modifier)" },
        { key: "long", label: `Long ${weapon?.long || ""} (-1 DF, -1 DR)` }
      ];
      for (const r of ranges) {
        rw.appendChild(el("button", {
          class: "chip" + (state.rangeBand === r.key ? " on" : ""), type: "button",
          onclick: () => { state.rangeBand = r.key; drawControls(); }
        }, r.label));
      }
      controls.appendChild(rw);

      controls.appendChild(el("div", { class: "field-label", style: "margin-top:12px", text: "Fire option" }));
      const ow = el("div", { class: "chip-wrap" });
      for (const o of [
        { key: "normal", label: "Normal Fire" },
        { key: "aim", label: "Taking Aim (+3 DF, costs a round)" },
        { key: "specific", label: "Specific Fire (-2 DF, +2 Wound Ranks)" }
      ]) {
        ow.appendChild(el("button", {
          class: "chip" + (state.action === o.key ? " on" : ""), type: "button",
          onclick: () => { state.action = o.key; drawControls(); }
        }, o.label));
      }
      controls.appendChild(ow);

      if (weapon && weapon.auto) {
        controls.appendChild(el("label", { class: "row tight", style: "margin-top:10px" },
          el("input", { type: "checkbox", checked: state.burst, onchange: e => { state.burst = e.target.checked; drawControls(); } }),
          el("span", { text: `Burst fire on one target (Damage Rank ${weapon.drBurst})` })));
      }
      controls.appendChild(el("label", { class: "row tight", style: "margin-top:8px" },
        el("input", { type: "checkbox", checked: state.silencer, onchange: e => { state.silencer = e.target.checked; drawControls(); } }),
        el("span", { text: "Silencer fitted (-1 Damage Rank)" })));
      controls.appendChild(el("label", { class: "row tight", style: "margin-top:6px" },
        el("input", { type: "checkbox", checked: state.hollowPoint, onchange: e => { state.hollowPoint = e.target.checked; drawControls(); } }),
        el("span", { text: "Hollow point ammunition (+1 Damage Rank)" })));

      controls.appendChild(el("p", { class: "small muted", style: "margin-top:10px",
        text: `Shots available this round: ${R.shotsPerRound(weapon, dv.speed)} (Speed ${dv.speed} vs Rate of Fire ${weapon?.rof ?? "—"}).` }));
    }

    const dr = R.weaponDamageRank(weapon, character, {
      burst: state.burst,
      rangeBand: state.rangeBand === "point" ? "close" : state.rangeBand,
      silencer: state.silencer,
      hollowPoint: state.hollowPoint,
      kick: state.action === "kick"
    });
    controls.appendChild(el("div", { class: "banner ok", style: "margin-top:12px",
      text: `Effective Damage Rank: ${dr || "none"}` }));
  }
  drawControls();

  const m = modal({
    title: (weapon ? weapon.name : "Attack"),
    body,
    actions: [
      { label: "Cancel", kind: "ghost" },
      {
        label: "Attack", kind: "primary", close: false,
        onClick: async () => {
          m.close();
          const mods = [];
          let df = D.BASE_DIFFICULTY_FACTOR;

          if (isHTH) {
            df = clamp(5 - state.targetSpeed, 0.5, 10);
            const act = D.HTH_ACTIONS.find(a => a.key === state.action);
            if (act.fixedDF) df = act.fixedDF;
            if (act.mod) mods.push({ name: act.name, value: act.mod });
          } else {
            if (state.rangeBand === "point") mods.push({ name: "Target within 10 feet", value: 2 });
            else if (state.rangeBand === "close") mods.push({ name: "Close range", value: 1 });
            else if (state.rangeBand === "long") mods.push({ name: "Long range", value: -1 });
            if (state.action === "aim") mods.push({ name: "Taking Aim", value: 3 });
            if (state.action === "specific") mods.push({ name: "Specific Fire", value: -2 });
          }

          if (weapon && weapon.pm) mods.push({ name: "Weapon performance", value: weapon.pm });
          if (Settings.autoConditions()) {
            for (const cond of conditionSummary(character)) {
              if (cond.dfMod) mods.push({ name: cond.name, value: cond.dfMod });
            }
          }
          if (!isTrained(character, skillKey)) mods.push({ name: "Untrained", value: D.UNTRAINED_DF_PENALTY });

          const rollValue = await getD100();
          const base = baseChanceFor(character, skillKey);
          const res = resolve({
            baseChance: base, df, modifiers: mods, rollValue,
            label: (weapon ? weapon.name : "Attack"), skillKey, isCombat: true, weapon
          });

          const jammed = !isHTH && R.isMisfire(rollValue, weapon);
          if (rollValue === 100 && !isHTH) res.note = "The weapon has misfired badly enough to need repair.";
          else if (jammed) res.note = "Weapon jammed. Clearing it needs a Difficulty Factor 5 Fire Combat check next round.";

          const dr = R.weaponDamageRank(weapon, character, {
            burst: state.burst,
            rangeBand: state.rangeBand === "point" ? "close" : state.rangeBand,
            silencer: state.silencer,
            hollowPoint: state.hollowPoint,
            kick: state.action === "kick"
          });

          presentResult(res, {
            character,
            extra: r => damagePanel(r, dr, {
              jammed, weapon,
              woundBonus: (state.action === "specific" || state.action === "targeted") ? 2 : 0,
              specificAction: isHTH ? state.action : null,
              targetId: state.targetId || null
            })
          });
        }
      }
    ]
  });
}

function woundOrder(key) {
  return ["none", "stun", "light", "medium", "heavy", "incap", "killed"].indexOf(key);
}
function woundByOrder(i) {
  return ["none", "stun", "light", "medium", "heavy", "incap", "killed"][clamp(i, 0, 6)];
}

function damagePanel(res, damageRank, opts = {}) {
  const wrap = el("div", { style: "margin-top:12px" });

  if (opts.jammed) {
    wrap.appendChild(el("div", { class: "banner warn", text: res.note }));
  }

  if (res.quality >= D.QUALITY.FAILURE) {
    wrap.appendChild(el("div", { class: "banner", text: "Miss — no damage." }));
    return wrap;
  }
  if (!damageRank) {
    const act = D.HTH_ACTIONS.find(a => a.key === opts.specificAction);
    wrap.appendChild(el("div", { class: "banner ok", text: act ? act.desc : "Hit — this action deals no damage." }));
    return wrap;
  }

  let wound = R.woundFromHit(res.quality, damageRank);
  if (wound && opts.woundBonus) wound = woundByOrder(woundOrder(wound) + opts.woundBonus);

  wrap.appendChild(el("div", { class: "banner ok" },
    el("b", { text: `Hit for a ${R.woundLevel(wound).name}` }),
    el("div", { class: "small", text: `Damage Rank ${damageRank} × ${D.QUALITY_SHORT[res.quality]}` +
      (opts.woundBonus ? ` and +${opts.woundBonus} Wound Ranks for the targeted shot` : "") })
  ));
  const w = R.woundLevel(wound);
  if (w.desc) wrap.appendChild(el("p", { class: "small muted", text: w.desc }));

  wrap.appendChild(el("p", { class: "small muted", text:
    "The target may spend Hero or Villain Points to reduce this by one rank per point." }));

  // The app worked the wound out; making the player re-choose it from a list on the combat
  // screen is the same decision taken twice, and the accumulation table is where it belongs.
  if (opts.targetId) {
    const cb = Store.combatState().combatants.find(x => x.id === opts.targetId);
    if (cb) {
      const applyRow = el("div", { class: "btn-row", style: "margin-top:10px" });
      const btn = el("button", { class: "btn sm primary", type: "button" }, `Apply to ${cb.name}`);
      btn.addEventListener("click", async () => {
        btn.disabled = true;
        const applied = applyWoundToCombatant(opts.targetId, wound);
        if (!applied) { wrap.appendChild(el("div", { class: "banner warn", text: "That combatant has left the encounter." })); return; }
        applyRow.replaceWith(el("div", { class: "banner ok" },
          el("b", { text: `${applied.name} is now ${R.woundLevel(applied.wound).name}` }),
          el("div", { class: "small", text: applied.was === "none"
            ? "Their first wound of the encounter."
            : `${R.woundLevel(applied.was).name} plus a ${R.woundLevel(wound).name}, through the accumulation table.` })));
        if (applied.characterId) {
          const ch = Store.getCharacter(applied.characterId);
          if (ch && ch.id === Store.activeId()) await applyDamageToCharacter(ch, wound);
        }
      });
      applyRow.appendChild(btn);
      wrap.appendChild(applyRow);
    }
  }

  return wrap;
}

/**
 * Write a wound onto a combatant through the accumulation table — wounds are additive, so
 * this is never a straight assignment.
 */
function applyWoundToCombatant(id, wound) {
  const s = Store.combatState();
  const cb = s.combatants.find(x => x.id === id);
  if (!cb) return null;
  const was = cb.wound || "none";
  cb.wound = R.accumulateWound(was, wound);
  if (wound === "stun") cb.stunRounds = R.stunRounds(d100());
  Store.saveCombat(s);
  return { name: cb.name, was, wound: cb.wound, characterId: cb.characterId };
}

/** Apply a wound to the active character with the full consequence chain. */
export async function applyDamageToCharacter(character, incomingWound) {
  const { before, after } = applyWound(character, incomingWound);
  Store.updateActive(c => { c.state.wound = after; });

  const lines = [`${R.woundLevel(before).name} → ${R.woundLevel(after).name}`];
  const w = R.woundLevel(after);

  if (after === "stun") {
    const r = await getD100("Stun Table d100");
    const rounds = R.stunRounds(r);
    lines.push(`Stunned for ${rounds} round${rounds === 1 ? "" : "s"} (rolled ${r}). The GM should keep the duration secret.`);
  }
  if (w.painDF) lines.push(`Pain Resistance: Difficulty Factor ${w.painDF} Willpower, now and every round in the Declaration Phase.`);
  if (w.dfMod) lines.push(`Standing penalty of ${w.dfMod} Difficulty Factor on all actions until healed.`);

  const chance = R.scarChance(after);
  if (chance > 0 && percent(chance)) {
    const locRoll = d100();
    const loc = R.scarLocation(locRoll);
    Store.updateActive(c => {
      c.scars.push({ location: loc, note: `${w.name}` });
      c.reputation = (c.reputation || 0) + D.SCAR_REPUTATION;
    });
    lines.push(`Scarred: ${loc}. Reputation +${D.SCAR_REPUTATION} once the scar is visible.`);
  }

  modal({
    title: "Damage applied",
    body: el("div", {}, ...lines.map(t => el("p", { text: t }))),
    actions: [{ label: "OK", kind: "primary" }]
  });
  return after;
}

/* ---------------------------------------------------------------- opposed tests */

/**
 * Generic two-stage opposed procedure: the actor rolls, and the actor's Quality
 * becomes the opponent's Difficulty Factor.
 */
/**
 * The second half of a Quality-as-Difficulty-Factor procedure, offered on the result of the
 * first. Disguise and Stealth both end with somebody looking; before this the roller printed
 * the Quality and stopped, and the player had to find the rule and set up the opposing check
 * themselves (finding A15).
 */
function opposedPanel(character, skillKey, res) {
  const proc = skillKey ? D.QUALITY_OPPOSED_BY_SKILL[skillKey] : null;
  if (!proc) return null;

  const wrap = el("div", { style: "margin-top:12px" });
  const failed = res.quality >= D.QUALITY.FAILURE;

  // Stealth only hands the observer a check on a Fair; better is clean, worse is automatic.
  if (proc.onlyOnQuality) {
    if (failed) {
      wrap.appendChild(el("div", { class: "banner warn" },
        el("b", { text: "Noticed" }),
        el("div", { class: "small", text: "A failure is spotted automatically — no check for the observer." })));
      return wrap;
    }
    if (res.quality !== proc.onlyOnQuality) {
      wrap.appendChild(el("div", { class: "banner ok" },
        el("b", { text: "Unnoticed" }),
        el("div", { class: "small", text: proc.desc })));
      return wrap;
    }
  }

  const df = failed
    ? proc.failureDF
    : (proc.fixedDF !== undefined && proc.fixedDF !== null
        ? proc.fixedDF
        : D.clampDF(res.quality * (proc.multiplier || 1)));

  wrap.appendChild(el("div", { class: "banner" },
    el("b", { text: proc.opponent }),
    el("div", { class: "small", text: `${proc.desc} That is Difficulty Factor ${dfLabel(df)} here.` })));
  wrap.appendChild(el("button", {
    class: "btn sm block", type: "button", style: "margin-top:8px",
    onclick: () => rollOpposingCheck(proc, df)
  }, `Roll ${proc.opponent.toLowerCase()} at DF ${dfLabel(df)}`));
  return wrap;
}

/** The observer's side. Their Base Chance is theirs, so it is asked for rather than assumed. */
async function rollOpposingCheck(proc, df) {
  const typed = await promptModal(`${proc.opponent} — their Base Chance`, {
    title: proc.name, type: "number", value: "10",
    okLabel: "Roll"
  });
  if (typed === null) return;
  const base = clamp(parseInt(typed, 10) || 0, 1, D.MAX_BASE_CHANCE);
  const rollValue = await getD100(`${proc.opponent} d100`);
  const res = resolve({ baseChance: base, df, rollValue, label: proc.opponent });
  presentResult(res, {
    title: proc.opponent,
    extra: r => el("p", { class: "small muted", style: "margin-top:10px", text:
      r.quality >= D.QUALITY.FAILURE
        ? "They do not see through it."
        : "They see through it — the procedure is over and the fiction moves on." })
  });
}

export async function opposedByQuality(opts) {
  const { character, skillKey, label, actorDF = D.BASE_DIFFICULTY_FACTOR, modifiers = [],
    opponentLabel, opponentBase, failureDF = 10, multiplier = 1, onComplete } = opts;

  const base = baseChanceFor(character, skillKey);
  const rollValue = await getD100();
  const res = resolve({ baseChance: base, df: actorDF, modifiers, rollValue, label, skillKey });

  presentResult(res, {
    character,
    onDone: async r => {
      const targetDF = r.quality >= D.QUALITY.FAILURE
        ? failureDF
        : D.clampDF(r.quality * multiplier);
      const opRoll = await getD100(`${opponentLabel} d100`);
      const opRes = resolve({
        baseChance: opponentBase, df: targetDF, rollValue: opRoll,
        label: opponentLabel
      });
      presentResult(opRes, {
        title: opponentLabel,
        onDone: o => { if (onComplete) onComplete(r, o); }
      });
    }
  });
}

export function openSeduction(character) {
  const body = el("div", {});
  const state = { stage: 1, targetWil: 8, mods: [] };

  const stageWrap = el("div", {});
  body.appendChild(stageWrap);

  function draw() {
    clear(stageWrap);
    stageWrap.appendChild(el("div", { class: "field-label", text: "Stage" }));
    const w = el("div", { class: "chip-wrap" });
    for (const s of D.SEDUCTION_STAGES) {
      w.appendChild(el("button", {
        class: "chip" + (state.stage === s.stage ? " on" : ""), type: "button",
        onclick: () => { state.stage = s.stage; draw(); }
      }, `${s.stage}. ${s.name} (DF ${s.df})`));
    }
    stageWrap.appendChild(w);

    stageWrap.appendChild(el("div", { class: "field-label", style: "margin-top:12px", text: "Modifiers" }));
    const mw = el("div", { class: "chip-wrap" });
    for (const mod of D.SEDUCTION_MODS) {
      const on = state.mods.some(x => x.key === mod.key);
      mw.appendChild(el("button", {
        class: "chip" + (on ? " on" : ""), type: "button",
        onclick: () => {
          if (on) state.mods = state.mods.filter(x => x.key !== mod.key);
          else state.mods.push(mod);
          draw();
        }
      }, `${mod.name} ${signed(mod.value)}`));
    }
    stageWrap.appendChild(mw);

    stageWrap.appendChild(el("label", { class: "field", style: "margin-top:12px" },
      el("span", { text: "Target Willpower" }),
      el("input", { type: "number", value: state.targetWil, min: 1, max: 15,
        onchange: e => { state.targetWil = parseInt(e.target.value, 10) || 8; } })));

    stageWrap.appendChild(el("p", { class: "small muted", text:
      "The target resists with a Willpower check at a Difficulty Factor equal to your Success Quality — Difficulty Factor 10 if you failed. If their check fails, the seduction may proceed. Success at stage 5 forces a fresh Reaction roll at +5 Difficulty Factor." }));
  }
  draw();

  const m = modal({
    title: "Seduction",
    body,
    actions: [
      { label: "Cancel", kind: "ghost" },
      {
        label: "Roll stage", kind: "primary", close: false,
        onClick: async () => {
          m.close();
          const stage = D.SEDUCTION_STAGES.find(s => s.stage === state.stage);
          await opposedByQuality({
            character,
            skillKey: "seduction",
            label: `Seduction — ${stage.name}`,
            actorDF: stage.df,
            modifiers: state.mods.map(x => ({ name: x.name, value: x.value })),
            opponentLabel: "Target resists (Willpower)",
            opponentBase: state.targetWil,
            failureDF: D.SEDUCTION_RESIST_FAILURE_DF,
            onComplete: (mine, theirs) => {
              const resisted = theirs.quality < D.QUALITY.FAILURE;
              const lines = [];
              if (mine.quality >= D.QUALITY.FAILURE) {
                lines.push("Your roll failed, so the target resists at Difficulty Factor 10 — and a failed attempt costs you -2 Difficulty Factor on any later try.");
              }
              if (resisted) {
                lines.push("The target made their Willpower check. They may let the seduction continue anyway, or shut it down — their motives decide.");
              } else {
                lines.push("The target failed their Willpower check. The seduction may move to the next stage.");
              }
              if (state.stage === 5 && !resisted) {
                lines.push("Stage 5 complete: roll a fresh Reaction for the target at +5 Difficulty Factor. It may improve their opinion of you — or not.");
              }
              modal({
                title: "Seduction outcome",
                body: el("div", {}, ...lines.map(t => el("p", { text: t }))),
                actions: [{ label: "OK", kind: "primary" }]
              });
            }
          });
        }
      }
    ]
  });
}

export function openPersuasion(character) {
  const state = { reaction: "neutral", targetWil: 8, extra: [] };
  const body = el("div", {});
  const wrap = el("div", {});
  body.appendChild(wrap);

  function draw() {
    clear(wrap);
    wrap.appendChild(el("div", { class: "field-label", text: "The NPC's current Reaction" }));
    const rw = el("div", { class: "chip-wrap" });
    for (const r of D.REACTIONS) {
      rw.appendChild(el("button", {
        class: "chip" + (state.reaction === r.key ? " on" : ""), type: "button",
        onclick: () => { state.reaction = r.key; draw(); }
      }, `${r.name} ${signed(r.persuadeMod)}`));
    }
    wrap.appendChild(rw);
    const react = R.REACTION_BY_KEY[state.reaction];
    wrap.appendChild(el("p", { class: "small muted", style: "margin-top:6px", text: react.desc }));

    wrap.appendChild(el("label", { class: "field", style: "margin-top:12px" },
      el("span", { text: "NPC Willpower" }),
      el("input", { type: "number", value: state.targetWil, min: 1, max: 15,
        onchange: e => { state.targetWil = parseInt(e.target.value, 10) || 8; } })));

    wrap.appendChild(el("p", { class: "small muted", text:
      "A bribe may add or subtract Difficulty Factor at the GM's discretion. The GM should roll Persuasion in secret, because a Perhaps result is deliberately unstable." }));
  }
  draw();

  const m = modal({
    title: "Persuasion",
    body,
    actions: [
      { label: "Cancel", kind: "ghost" },
      {
        label: "Roll", kind: "primary", close: false,
        onClick: async () => {
          m.close();
          const react = R.REACTION_BY_KEY[state.reaction];
          const rollValue = await getD100();
          const res = resolve({
            baseChance: baseChanceFor(character, "charisma"),
            df: D.BASE_DIFFICULTY_FACTOR,
            modifiers: [{ name: react.name + " reaction", value: react.persuadeMod }],
            rollValue, label: "Persuasion", skillKey: "charisma"
          });
          presentResult(res, {
            character,
            extra: r => {
              const code = R.persuadeResult(r.quality, state.targetWil);
              const box = el("div", { style: "margin-top:12px" });
              box.appendChild(el("div", { class: "banner " + (code === "Y" ? "ok" : code === "N" ? "warn" : ""),
                text: D.PERSUADE_RESULT_TEXT[code] }));
              if (r.quality === 1) box.appendChild(el("p", { class: "small muted", text: D.PERSUADE_SUPERB_BONUS }));
              return box;
            }
          });
        }
      }
    ]
  });
}

export function openCoercion(character, kind = "interrogation") {
  const isTorture = kind === "torture";
  const state = { targetWil: 8, mods: [] };
  const modSet = isTorture ? D.TORTURE_MODS : D.INTERROGATION_MODS;

  const body = el("div", {});
  const wrap = el("div", {});
  body.appendChild(wrap);

  function draw() {
    clear(wrap);
    wrap.appendChild(el("label", { class: "field" },
      el("span", { text: "Victim Willpower" }),
      el("input", { type: "number", value: state.targetWil, min: 1, max: 15,
        onchange: e => { state.targetWil = parseInt(e.target.value, 10) || 8; } })));

    wrap.appendChild(el("div", { class: "field-label", text: "Modifiers" }));
    const mw = el("div", { class: "chip-wrap" });
    for (const mod of modSet) {
      const on = state.mods.some(x => x.key === mod.key);
      mw.appendChild(el("button", {
        class: "chip" + (on ? " on" : ""), type: "button",
        onclick: () => {
          if (on) state.mods = state.mods.filter(x => x.key !== mod.key);
          else state.mods.push(mod);
          draw();
        }
      }, `${mod.name} ${signed(mod.value)}`));
    }
    wrap.appendChild(mw);

    if (isTorture) {
      wrap.appendChild(el("p", { class: "small muted", style: "margin-top:10px", text: D.TORTURE_RESIST.desc }));
      wrap.appendChild(el("p", { class: "small muted", text: D.TORTURE_RESIST.failurePenalty }));
    } else {
      wrap.appendChild(el("p", { class: "small muted", style: "margin-top:10px", text:
        "A session takes 18 hours, scaled by Success Quality. Cumulative session modifiers reset if the victim sleeps." }));
    }
  }
  draw();

  const m = modal({
    title: isTorture ? "Torture" : "Interrogation",
    body,
    actions: [
      { label: "Cancel", kind: "ghost" },
      {
        label: "Roll", kind: "primary", close: false,
        onClick: async () => {
          m.close();
          const skillKey = isTorture ? "torture" : "interrogation";
          const rollValue = await getD100();
          const res = resolve({
            baseChance: baseChanceFor(character, skillKey),
            df: D.BASE_DIFFICULTY_FACTOR,
            modifiers: state.mods.map(x => ({ name: x.name, value: x.value })),
            rollValue, label: isTorture ? "Torture" : "Interrogation", skillKey
          });
          presentResult(res, {
            character,
            extra: r => {
              const modQ = R.coercionQuality(r.quality, state.targetWil);
              const info = D.SKILL_TIME_INFO[modQ];
              const box = el("div", { style: "margin-top:12px" });
              box.appendChild(el("div", { class: "banner " + (modQ >= 5 ? "warn" : "ok") },
                el("b", { text: `Modified result: ${D.QUALITY_NAMES[modQ]}` }),
                el("div", { class: "small", text: `Information gained: ${info.info} · Time: ${info.timeLabel}` })
              ));
              if (isTorture && (r.quality === 4 || r.quality === 5)) {
                box.appendChild(el("p", { class: "small", text:
                  "A Fair result or a failure inflicts a Medium Wound on the victim — unless they managed to pass out first." }));
              }
              return box;
            }
          });
        }
      }
    ]
  });
}

export function openReputationCheck(character) {
  const state = { per: 10, rep: character ? character.reputation : 0, disguise: null };
  const body = el("div", {});
  const wrap = el("div", {});
  body.appendChild(wrap);

  function draw() {
    clear(wrap);
    wrap.appendChild(el("label", { class: "field" },
      el("span", { text: "Observer's Perception" }),
      el("input", { type: "number", value: state.per, min: 1, max: 15,
        onchange: e => { state.per = parseInt(e.target.value, 10) || 10; } })));
    wrap.appendChild(el("label", { class: "field" },
      el("span", { text: "Subject's Reputation" }),
      el("input", { type: "number", value: state.rep, min: 0,
        onchange: e => { state.rep = parseInt(e.target.value, 10) || 0; } })));

    wrap.appendChild(el("div", { class: "field-label", text: "Disguise in play" }));
    const dw = el("div", { class: "chip-wrap" });
    dw.appendChild(el("button", { class: "chip" + (state.disguise === null ? " on" : ""), type: "button",
      onclick: () => { state.disguise = null; draw(); } }, "No disguise"));
    for (const q of [1, 2, 3, 4, 5]) {
      dw.appendChild(el("button", {
        class: "chip" + (state.disguise === q ? " on" : ""), type: "button",
        onclick: () => { state.disguise = q; draw(); }
      }, `${D.QUALITY_SHORT[q]} ${signed(D.DISGUISE_REPUTATION_MOD[q])}`));
    }
    wrap.appendChild(dw);
    wrap.appendChild(el("p", { class: "small muted", style: "margin-top:8px", text:
      "Only NPCs in the business roll Reputation. The GM makes this check." }));
  }
  draw();

  const m = modal({
    title: "Reputation check",
    body,
    actions: [
      { label: "Cancel", kind: "ghost" },
      {
        label: "Roll", kind: "primary", close: false,
        onClick: async () => {
          m.close();
          const mods = [];
          if (state.disguise !== null) {
            mods.push({ name: `Disguise (${D.QUALITY_SHORT[state.disguise]})`, value: D.DISGUISE_REPUTATION_MOD[state.disguise] });
          }
          const rollValue = await getD100();
          const res = resolve({
            baseChance: state.per, df: D.BASE_DIFFICULTY_FACTOR, modifiers: mods,
            rollValue, label: "Reputation check"
          });
          presentResult(res, {
            extra: r => {
              const code = R.reputationResult(r.quality, state.rep);
              return el("div", { class: "banner " + (code === "Y" ? "warn" : code === "N" ? "ok" : ""), style: "margin-top:12px",
                text: D.REPUTATION_RESULT_TEXT[code] });
            }
          });
        }
      }
    ]
  });
}

export function openReaction(character) {
  const state = { mods: [], localCustoms: null };
  const body = el("div", {});
  const wrap = el("div", {});
  body.appendChild(wrap);

  function draw() {
    clear(wrap);
    wrap.appendChild(el("div", { class: "field-label", text: "Circumstances" }));
    const mw = el("div", { class: "chip-wrap" });
    for (const mod of D.REACTION_MODS) {
      const on = state.mods.some(x => x.key === mod.key);
      mw.appendChild(el("button", {
        class: "chip" + (on ? " on" : ""), type: "button",
        onclick: () => {
          if (on) state.mods = state.mods.filter(x => x.key !== mod.key);
          else state.mods.push(mod);
          draw();
        }
      }, `${mod.name} ${signed(mod.value)}`));
    }
    wrap.appendChild(mw);

    wrap.appendChild(el("div", { class: "field-label", style: "margin-top:12px", text: "Local Customs result (optional)" }));
    const lw = el("div", { class: "chip-wrap" });
    lw.appendChild(el("button", { class: "chip" + (state.localCustoms === null ? " on" : ""), type: "button",
      onclick: () => { state.localCustoms = null; draw(); } }, "Not used"));
    for (const q of [1, 2, 3, 4, 5]) {
      lw.appendChild(el("button", {
        class: "chip" + (state.localCustoms === q ? " on" : ""), type: "button",
        onclick: () => { state.localCustoms = q; draw(); }
      }, `${D.QUALITY_SHORT[q]} ${signed(D.LOCAL_CUSTOMS_REACTION_MOD[q])}`));
    }
    wrap.appendChild(lw);
  }
  draw();

  const m = modal({
    title: "NPC Reaction",
    body,
    actions: [
      { label: "Cancel", kind: "ghost" },
      {
        label: "Roll", kind: "primary", close: false,
        onClick: async () => {
          m.close();
          const mods = state.mods.map(x => ({ name: x.name, value: x.value }));
          if (state.localCustoms !== null) {
            mods.push({ name: `Local Customs (${D.QUALITY_SHORT[state.localCustoms]})`, value: R.localCustomsReactionMod(state.localCustoms) });
          }
          const rollValue = await getD100();
          const res = resolve({
            baseChance: baseChanceFor(character, "charisma"),
            df: D.BASE_DIFFICULTY_FACTOR, modifiers: mods, rollValue,
            label: "NPC Reaction", skillKey: "charisma"
          });
          presentResult(res, {
            character,
            extra: r => {
              const key = R.reactionFromQuality(r.quality);
              const react = R.REACTION_BY_KEY[key];
              return el("div", { class: "banner", style: "margin-top:12px" },
                el("b", { text: react.name }), el("div", { class: "small", text: react.desc }));
            }
          });
        }
      }
    ]
  });
}

/* ---------------------------------------------------------------- gambling */

export function openGambling(character) {
  const state = { game: "baccarat" };
  const body = el("div", {});
  const wrap = el("div", {});
  body.appendChild(wrap);

  function draw() {
    clear(wrap);
    const gw = el("div", { class: "chip-wrap" });
    for (const g of D.GAMBLING_GAMES) {
      gw.appendChild(el("button", {
        class: "chip" + (state.game === g.key ? " on" : ""), type: "button",
        onclick: () => { state.game = g.key; draw(); }
      }, g.name));
    }
    wrap.appendChild(gw);
    const g = D.GAMBLING_GAMES.find(x => x.key === state.game);
    wrap.appendChild(el("p", { class: "small muted", style: "margin-top:8px", text: g.desc }));
    for (const n of D.GAMBLING_NOTES) wrap.appendChild(el("p", { class: "small muted", text: n }));
  }
  draw();

  const m = modal({
    title: "Gambling",
    body,
    actions: [
      { label: "Cancel", kind: "ghost" },
      {
        label: "Play a hand", kind: "primary", close: false,
        onClick: async () => {
          m.close();
          const base = baseChanceFor(character, "gambling");
          const r1v = await getD100("first Gambling d100");
          const r1 = resolve({ baseChance: base, df: D.BASE_DIFFICULTY_FACTOR, rollValue: r1v, label: "Gambling — first cards", skillKey: "gambling" });
          presentResult(r1, {
            character,
            title: "Gambling — first cards",
            onDone: async first => {
              const r2v = await getD100("second Gambling d100");
              const r2 = resolve({ baseChance: base, df: D.BASE_DIFFICULTY_FACTOR, rollValue: r2v, label: "Gambling — draw", skillKey: "gambling" });
              presentResult(r2, {
                character,
                title: "Gambling — draw",
                extra: second => {
                  const code = R.gamblingResult(state.game, first.quality, second.quality);
                  const text = D.GAMBLING_CODE_TEXT[code] || `Hand value: ${D.QUALITY_NAMES[code] || code}`;
                  return el("div", { class: "banner", style: "margin-top:12px" },
                    el("b", { text: `Result: ${code}` }), el("div", { class: "small", text }));
                }
              });
            }
          });
        }
      }
    ]
  });
}

/* ---------------------------------------------------------------- chases */

export function openChaseManeuver(character) {
  const state = { maneuver: "follow", bid: 5, vehicleKey: null, mods: [] };

  const body = el("div", {});
  const wrap = el("div", {});
  body.appendChild(wrap);

  function draw() {
    clear(wrap);
    wrap.appendChild(el("div", { class: "field-label", text: "Manoeuvre" }));
    const mw = el("div", { class: "chip-wrap" });
    for (const mv of D.CHASE_MANEUVERS) {
      mw.appendChild(el("button", {
        class: "chip" + (state.maneuver === mv.key ? " on" : ""), type: "button",
        onclick: () => { state.maneuver = mv.key; draw(); }
      }, mv.name));
    }
    wrap.appendChild(mw);
    const mv = D.CHASE_MANEUVERS.find(x => x.key === state.maneuver);
    wrap.appendChild(el("p", { class: "small muted", style: "margin-top:6px", text: mv.desc }));
    wrap.appendChild(el("p", { class: "small muted", text:
      `Legal at: ${mv.ranges.join(", ")} · Control Difficulty Factor ${mv.controlDF}` }));

    wrap.appendChild(el("div", { class: "field-label", style: "margin-top:12px", text: "Your bid (this becomes your Difficulty Factor)" }));
    const bw = el("div", { class: "df-ladder" });
    for (const step of [0.5, 1, 2, 3, 4, 5, 6, 7]) {
      bw.appendChild(el("button", {
        class: "df-step" + (state.bid === step ? " on" : ""), type: "button",
        onclick: () => { state.bid = step; draw(); }
      }, dfLabel(step)));
    }
    wrap.appendChild(bw);
    wrap.appendChild(el("p", { class: "small muted", style: "margin-top:6px", text:
      "Bidding starts at 7 and runs downwards. The lowest bidder chooses who acts first, but pays for it with a harder manoeuvre." }));

    wrap.appendChild(el("div", { class: "field-label", style: "margin-top:12px", text: "Vehicle" }));
    const sel = el("select", { onchange: e => { state.vehicleKey = e.target.value || null; draw(); } });
    sel.appendChild(el("option", { value: "", text: "On foot / no vehicle" }));
    for (const v of D.VEHICLES) {
      sel.appendChild(el("option", { value: v.key, selected: state.vehicleKey === v.key,
        text: `${v.name} (Perf ${signed(v.pm)}, Limit ${v.pl})` }));
    }
    wrap.appendChild(sel);

    const veh = state.vehicleKey ? R.VEHICLE_BY_KEY[state.vehicleKey] : null;
    if (veh && state.bid < veh.pl) {
      wrap.appendChild(el("div", { class: "banner warn", style: "margin-top:8px", text:
        `Bidding below the vehicle's Performance Limit of ${veh.pl} forces an automatic Control check whether or not the manoeuvre succeeds.` }));
    }

    wrap.appendChild(el("div", { class: "field-label", style: "margin-top:12px", text: "Conditions" }));
    const cw = el("div", { class: "chip-wrap" });
    for (const mod of D.CHASE_MODS.filter(m => typeof m.value === "number")) {
      const on = state.mods.some(x => x.key === mod.key);
      cw.appendChild(el("button", {
        class: "chip" + (on ? " on" : ""), type: "button",
        onclick: () => {
          if (on) state.mods = state.mods.filter(x => x.key !== mod.key);
          else state.mods.push(mod);
          draw();
        }
      }, `${mod.name} ${signed(mod.value)}`));
    }
    wrap.appendChild(cw);
  }
  draw();

  const m = modal({
    title: "Chase manoeuvre",
    body,
    actions: [
      { label: "Cancel", kind: "ghost" },
      {
        label: "Roll manoeuvre", kind: "primary", close: false,
        onClick: async () => {
          m.close();
          const mv = D.CHASE_MANEUVERS.find(x => x.key === state.maneuver);
          const veh = state.vehicleKey ? R.VEHICLE_BY_KEY[state.vehicleKey] : null;
          const skillKey = veh ? R.vehicleSkillFor(veh.key) : "evasion";

          const mods = state.mods.map(x => ({ name: x.name, value: x.value }));
          if (veh && veh.pm) mods.push({ name: "Vehicle performance", value: veh.pm });
          if (Settings.autoConditions()) {
            for (const cond of conditionSummary(character)) if (cond.dfMod) mods.push({ name: cond.name, value: cond.dfMod });
          }

          const rollValue = await getD100();
          const res = resolve({
            baseChance: baseChanceFor(character, skillKey), df: state.bid,
            modifiers: mods, rollValue, label: `${mv.name} (${R.skillName(skillKey)})`, skillKey
          });

          presentResult(res, {
            character,
            extra: r => chaseOutcome(r, mv, veh, state, mods, character)
          });
        }
      }
    ]
  });
}

function chaseOutcome(res, mv, veh, state, mods, character) {
  const box = el("div", { style: "margin-top:12px" });
  const belowLimit = veh && state.bid < veh.pl;
  const failed = res.quality >= D.QUALITY.FAILURE;

  if (!failed) {
    let text = "Manoeuvre succeeded.";
    if (mv.key === "follow") text += ` Range changes by ${D.FOLLOW_ESCAPE_STEPS[res.quality]} step${D.FOLLOW_ESCAPE_STEPS[res.quality] === 1 ? "" : "s"}.`;
    if (mv.key === "turn180") text += " Range drops to Close as you pass. Pursuers must match at Difficulty Factor " + res.quality + " or the range jumps to Distant.";
    if (mv.key === "fastturn") text += ` The chase ends unless the pursuer passes a Perception check at Difficulty Factor ${D.clampDF(res.quality * 2)}.`;
    if (mv.key === "stunt" && res.quality === 4) text += " A Fair result means you are Stunned during the stunt.";
    if (mv.key === "ram") {
      text += res.quality <= 3
        ? ` The target makes an Accident roll at Difficulty Factor ${res.quality}.`
        : " A Ram needs Good (3) or better; this hit did not land hard enough.";
    }
    box.appendChild(el("div", { class: "banner ok", text }));
  } else {
    box.appendChild(el("div", { class: "banner warn", text:
      `Manoeuvre failed. Make a Control check at Difficulty Factor ${mv.controlDF} to avoid an accident.` }));
  }

  const checksNeeded = (failed ? 1 : 0) + (belowLimit ? 1 : 0);
  if (checksNeeded > 0) {
    box.appendChild(el("p", { class: "small muted", text:
      belowLimit
        ? `Bidding under the Performance Limit adds a Control check. Total Control checks required: ${checksNeeded}.`
        : "" }));
    box.appendChild(el("button", {
      class: "btn sm block", type: "button", style: "margin-top:8px",
      onclick: () => runControlChecks(character, mv, state, veh, mods, checksNeeded)
    }, `Roll ${checksNeeded} Control check${checksNeeded === 1 ? "" : "s"}`));
  }
  return box;
}

async function runControlChecks(character, mv, state, veh, mods, count) {
  const skillKey = veh ? R.vehicleSkillFor(veh.key) : "evasion";
  for (let i = 0; i < count; i++) {
    const rollValue = await getD100(`Control check ${i + 1} d100`);
    const res = resolve({
      baseChance: baseChanceFor(character, skillKey), df: mv.controlDF, modifiers: mods,
      rollValue, label: `Control check — ${mv.name}`, skillKey
    });
    // eslint-disable-next-line no-await-in-loop
    await new Promise(done => {
      presentResult(res, {
        character,
        extra: r => {
          if (r.quality < D.QUALITY.FAILURE) return el("div", { class: "banner ok", style: "margin-top:12px", text: "Control held — no accident." });
          const vehicleWound = R.accidentWound(mv.key, state.bid);
          const occupant = R.occupantWound(vehicleWound, { seatbelt: Settings.seatbelts(), airbag: false });
          const wrap = el("div", { style: "margin-top:12px" });
          wrap.appendChild(el("div", { class: "banner warn" },
            el("b", { text: "Accident" }),
            el("div", { class: "small", text: `Vehicle takes a ${R.woundLevel(vehicleWound).name}. Occupants take a ${R.woundLevel(occupant).name}.` })
          ));
          for (const n of D.ACCIDENT_NOTES) wrap.appendChild(el("p", { class: "small muted", text: n }));
          wrap.appendChild(el("button", {
            class: "btn sm danger block", type: "button", style: "margin-top:8px",
            onclick: () => applyDamageToCharacter(character, occupant)
          }, `Apply ${R.woundLevel(occupant).name} to ${character.identity.name || "me"}`));
          return wrap;
        },
        onDone: () => done()
      });
    });
  }
}

/* ---------------------------------------------------------------- grenades */

/**
 * Throw a grenade. The book has all of this — throw range by Strength, scatter as a
 * percentage of the throw by Success Quality, direction on a d10, duds and early
 * detonations — but it was only reachable from the GM screen, which is off by default, and
 * that screen asked the player to type in the Quality they had just rolled (finding A16).
 *
 * Thrown weapons use Hand-to-Hand, which is what makes this an ordinary check with an
 * unusual consequence chain rather than a system of its own.
 */
export function openGrenadeThrow(character, type) {
  const dv = derived(character);
  const maxFt = (Number(character.attributes.str) || 0) * D.GRENADE_THROW_FT_PER_STR;
  const state = { distance: Math.min(maxFt, 60), df: D.BASE_DIFFICULTY_FACTOR };

  const body = el("div", {});
  body.appendChild(el("div", { class: "banner" },
    el("b", { text: type.name }),
    el("div", { class: "small", text: type.desc }),
    el("div", { class: "small muted", text: `Radius ${type.radius} ft` + (type.dr ? ` · Area Damage Rank ${type.dr}` : "") })));

  const distLabel = el("div", { class: "small muted" });
  const dist = el("input", { type: "range", min: 5, max: Math.max(10, maxFt), step: 5, value: String(state.distance) });
  const setDist = () => {
    state.distance = parseInt(dist.value, 10) || 5;
    distLabel.textContent = `${state.distance} ft of a possible ${maxFt} — 10 feet per point of Strength ${character.attributes.str}.`;
  };
  dist.addEventListener("input", setDist);
  setDist();
  body.appendChild(el("label", { class: "field", style: "margin-top:12px" },
    el("span", { text: "Throw distance" }), dist));
  body.appendChild(distLabel);

  const ladder = el("div", { class: "df-ladder", style: "margin-top:12px" });
  const drawLadder = () => {
    clear(ladder);
    for (const step of D.DIFFICULTY_FACTORS) {
      ladder.appendChild(el("button", {
        class: "df-step" + (step === state.df ? " on" : ""), type: "button",
        onclick: () => { state.df = step; drawLadder(); }
      }, dfLabel(step)));
    }
  };
  drawLadder();
  body.appendChild(el("div", { class: "field-label", style: "margin-top:12px", text: "Difficulty Factor" }));
  body.appendChild(ladder);
  for (const n of D.GRENADE_NOTES) body.appendChild(el("p", { class: "small muted", text: n }));

  const m = modal({
    title: "Throw " + type.name,
    body,
    actions: [
      { label: "Cancel", kind: "ghost" },
      { label: "Throw", kind: "primary", close: false, onClick: async () => {
        m.close();
        const mods = [];
        if (Settings.autoConditions()) {
          for (const cond of conditionSummary(character)) if (cond.dfMod) mods.push({ name: cond.name, value: cond.dfMod });
        }
        const skillKey = D.GRENADE_SKILL;
        if (!isTrained(character, skillKey)) mods.push({ name: "Untrained", value: D.UNTRAINED_DF_PENALTY });

        const rollValue = await getD100();
        const res = resolve({
          baseChance: baseChanceFor(character, skillKey), df: state.df, modifiers: mods,
          rollValue, label: "Throw " + type.name, skillKey
        });
        presentResult(res, { character, extra: r => grenadePanel(character, type, state, r, rollValue) });
      } }
    ]
  });
}

function grenadePanel(character, type, state, res, rollValue) {
  const wrap = el("div", { style: "margin-top:12px" });

  if (rollValue === D.GRENADE_EARLY_ROLL) {
    wrap.appendChild(el("div", { class: "banner warn" },
      el("b", { text: "It goes off early" }),
      el("div", { class: "small", text: "The grenade detonates before it leaves your hand." })));
  } else if (D.GRENADE_DUD_ROLL.includes(rollValue)) {
    wrap.appendChild(el("div", { class: "banner warn" },
      el("b", { text: "Dud" }),
      el("div", { class: "small", text: "It lands and does nothing." })));
    return wrap;
  }

  const pct = D.GRENADE_SCATTER[res.quality] ?? 0.5;
  const off = Math.round(state.distance * pct);
  const dir = die(D.GRENADE_SCATTER_DIRECTIONS);
  wrap.appendChild(el("div", { class: off === 0 ? "banner ok" : "banner" },
    el("b", { text: off === 0 ? "On target" : `${off} feet off target` }),
    el("div", { class: "small", text: off === 0
      ? "It lands where you aimed."
      : `${Math.round(pct * 100)}% of a ${state.distance}-foot throw, ${dir} o'clock on the scatter dial.` }),
    el("div", { class: "small muted", text: `Everything within ${type.radius} feet of where it lands is in the blast.` })));

  if (type.dr) {
    const wound = R.woundFromHit(res.quality, type.dr);
    wrap.appendChild(el("div", { class: "banner warn", style: "margin-top:8px" },
      el("b", { text: `Area Damage Rank ${type.dr}` }),
      el("div", { class: "small", text: `Anyone caught in it takes a ${R.woundLevel(wound).name}.` })));
    wrap.appendChild(applyToTargetRow(wound, character));
  } else {
    wrap.appendChild(el("p", { class: "small muted", style: "margin-top:8px", text:
      "This type deals no Damage Rank of its own — read its description for what it does to anyone inside the radius." }));
  }
  return wrap;
}

/** Where a blast lands: any combatant in the tracker, or the thrower themselves. */
function applyToTargetRow(wound, character) {
  const row = el("div", { class: "btn-row", style: "margin-top:8px" });
  const s = Store.combatState();
  for (const cb of (s.active ? s.combatants : [])) {
    row.appendChild(el("button", { class: "btn sm", type: "button", onclick: e => {
      const applied = applyWoundToCombatant(cb.id, wound);
      if (applied) {
        e.currentTarget.disabled = true;
        e.currentTarget.textContent = `${applied.name}: ${R.woundLevel(applied.wound).name}`;
        if (applied.characterId === character.id) applyDamageToCharacter(character, wound);
      }
    } }, `Apply to ${cb.name}`));
  }
  if (!s.active) {
    row.appendChild(el("button", { class: "btn sm danger", type: "button",
      onclick: () => applyDamageToCharacter(character, wound) },
      `Apply to ${character.identity.name || "me"}`));
  }
  return row;
}

/** Which grenade. Carried ones first, since those are the ones you can actually throw. */
export function openGrenadePicker(character) {
  const carried = new Set((character.inventory.items || [])
    .filter(i => i.key && String(i.key).startsWith("gren_"))
    .map(i => String(i.key).slice(5)));
  const items = D.GRENADE_TYPES.map(g => ({
    key: g.key, label: g.name,
    right: carried.has(g.key) ? "carried" : "",
    desc: `Radius ${g.radius} ft${g.dr ? " · Area Damage Rank " + g.dr : ""} — ${g.desc}`
  }));
  items.sort((a, b) => (b.right ? 1 : 0) - (a.right ? 1 : 0));
  chooseModal("Throw a grenade", items).then(key => {
    if (!key) return;
    openGrenadeThrow(character, D.GRENADE_TYPES.find(g => g.key === key));
  });
}

/**
 * Tailing: a movement skill at Difficulty Factor 5, and the target's Sixth Sense at twice
 * your Quality against it. Sixth Sense is GM-rolled, which is exactly why the app rolls it
 * here rather than the player invoking it.
 */
export function openTailing(character) {
  const proc = D.QUALITY_OPPOSED.find(x => x.key === "tailing");
  const movement = D.SKILLS.filter(sk => ["driving", "boating", "piloting", "riding", "evasion", "stealth"].includes(sk.key));
  chooseModal("Tail them with", movement.map(sk => ({
    key: sk.key, label: sk.name, right: String(baseChanceFor(character, sk.key)),
    desc: sk.desc || ""
  })), { intro: proc.desc }).then(skillKey => {
    if (!skillKey) return;
    openRoll({
      character, skillKey, df: proc.actorDF, label: "Tailing — " + R.skillName(skillKey),
      onResult: async r => {
        const df = r.quality >= D.QUALITY.FAILURE ? proc.failureDF : D.clampDF(r.quality * proc.multiplier);
        const typed = await promptModal("Their Sixth Sense Base Chance", {
          title: proc.opponent, type: "number", value: "10", okLabel: "Roll"
        });
        if (typed === null) return;
        const base = clamp(parseInt(typed, 10) || 0, 1, D.MAX_BASE_CHANCE);
        const rollValue = await getD100(`${proc.opponent} d100`);
        const res = resolve({ baseChance: base, df, rollValue, label: proc.opponent });
        presentResult(res, {
          title: proc.opponent,
          extra: o => el("p", { class: "small muted", style: "margin-top:10px", text:
            o.quality >= D.QUALITY.FAILURE ? "They do not spot you." : "They have spotted you." })
        });
      }
    });
  });
}

/* ---------------------------------------------------------------- quick tools */

export function openQuickRoll(character) {
  const items = [
    { key: "skill", label: "Skill or Characteristic check", desc: "The standard Base Chance × Difficulty Factor roll." },
    { key: "attack", label: "Attack", desc: "Fire Combat or Hand-to-Hand with automatic damage." },
    { key: "reaction", label: "NPC Reaction", desc: "Set an NPC's opening attitude from a Charisma check." },
    { key: "persuade", label: "Persuasion", desc: "Charisma against the NPC's Willpower for Yes, Perhaps or No." },
    { key: "seduce", label: "Seduction", desc: "The five staged rolls with the target's Willpower resistance." },
    { key: "interrogate", label: "Interrogation", desc: "Question a subject without physical coercion." },
    { key: "torture", label: "Torture", desc: "Physical coercion, with the victim's escape into unconsciousness." },
    { key: "reputation", label: "Reputation check", desc: "Can that professional place your face?" },
    { key: "gamble", label: "Gambling", desc: "Baccarat, Blackjack, Chemin de Fer or Poker." },
    { key: "chase", label: "Chase manoeuvre", desc: "Bid, manoeuvre, and resolve any accident." },
    { key: "grenade", label: "Throw a grenade", desc: "Range by Strength, scatter by Quality, and the blast." },
    { key: "tailing", label: "Tail someone", desc: "A movement skill at Difficulty Factor 5, and their Sixth Sense against it." },
    { key: "damage", label: "Take damage", desc: "Apply a wound with the full consequence chain." }
  ];
  chooseModal("Roll", items).then(key => {
    if (!key) return;
    switch (key) {
      case "skill": openSkillPicker(character); break;
      case "attack": openWeaponPicker(character); break;
      case "reaction": openReaction(character); break;
      case "persuade": openPersuasion(character); break;
      case "seduce": openSeduction(character); break;
      case "interrogate": openCoercion(character, "interrogation"); break;
      case "torture": openCoercion(character, "torture"); break;
      case "reputation": openReputationCheck(character); break;
      case "gamble": openGambling(character); break;
      case "chase": openChaseManeuver(character); break;
      case "grenade": openGrenadePicker(character); break;
      case "tailing": openTailing(character); break;
      case "damage": openTakeDamage(character); break;
    }
  });
}

export function openSkillPicker(character) {
  const items = D.CHARACTERISTICS.map(c => ({
    key: "attr:" + c.key, label: c.name + " check", right: String(character.attributes[c.key]), desc: c.desc
  })).concat(D.SKILLS.filter(s => !s.multi).map(s => ({
    key: "skill:" + s.key,
    label: s.name,
    right: String(baseChanceFor(character, s.key)),
    desc: isTrained(character, s.key) ? s.desc : "Untrained — characteristic only, at -3 Difficulty Factor."
  })));
  chooseModal("Choose a check", items).then(key => {
    if (!key) return;
    const [kind, id] = key.split(":");
    if (kind === "attr") openRoll({ character, attrKey: id });
    else openRoll({ character, skillKey: id });
  });
}

export function openWeaponPicker(character, options = {}) {
  const owned = (character.inventory.items || [])
    .filter(i => i.kind === "weapon" && i.key)
    .map(i => R.WEAPON_BY_KEY[i.key])
    .filter(Boolean);
  const list = owned.length ? owned : D.WEAPONS;
  const items = list.map(w => ({
    key: w.key,
    label: w.name,
    right: w.dr ? "DR " + w.dr : "+" + (w.drBonus || 0) + " DR",
    desc: w.desc
  }));
  items.unshift({ key: "__unarmed", label: "Unarmed", right: "DR " + R.hthDamageRank(character.attributes.str), desc: "Bare hands, elbows, knees and feet." });
  chooseModal(owned.length ? "Your weapons" : "All weapons", items).then(key => {
    if (!key) return;
    if (key === "__unarmed") openAttack(character, { key: "unarmed", name: "Unarmed", cat: "hth", drBonus: 0 }, options);
    else openAttack(character, R.WEAPON_BY_KEY[key], options);
  });
}

export function openTakeDamage(character) {
  const items = D.WOUND_LEVELS
    .filter(w => w.key !== "none")
    .map(w => ({ key: w.key, label: w.name, desc: w.desc || "" }));
  chooseModal("Apply a wound", items, { intro: "Wounds are additive — this will be combined with any wound already carried." })
    .then(key => { if (key) applyDamageToCharacter(character, key); });
}
