/* wizard.js — character creation. Legality is validated at every step and the
 * Creation Point budget is always on screen. */

import { el, clear, signed, uid, percent, d100, clamp } from "./core.js";
import { modal, showToast, confirmModal, promptModal, chooseModal } from "./ui.js";
import * as D from "../data.js";
import * as R from "./rules.js";
import * as Store from "./store.js";
import { blankCharacter, creationSpend, validate, derived, normalize } from "./derived.js";
import { navigate } from "./router.js";
import { renderResourceHeader } from "./sheet.js";

const STEPS = [
  { key: "rank", name: "Rank" },
  { key: "physical", name: "Traits" },
  { key: "attributes", name: "Characteristics" },
  { key: "profession", name: "Profession" },
  { key: "skills", name: "Skills" },
  { key: "weaknesses", name: "Weaknesses" },
  { key: "abilities", name: "Abilities" },
  { key: "review", name: "Review" }
];

let draft = null;
let stepIndex = 0;

export function startWizard(rank = "rookie") {
  draft = normalize(blankCharacter(rank));
  stepIndex = 0;
}

export function hasDraft() { return !!draft; }

export function renderWizard(host) {
  if (!draft) startWizard();
  clear(host);

  // Step chips
  const steps = el("div", { class: "wizard-steps" });
  for (let i = 0; i < STEPS.length; i++) {
    steps.appendChild(el("button", {
      class: "wstep" + (i === stepIndex ? " on" : i < stepIndex ? " done" : ""),
      type: "button",
      onclick: () => { stepIndex = i; renderWizard(host); }
    }, `${i + 1}. ${STEPS[i].name}`));
  }
  host.appendChild(steps);

  // Budget
  const spend = creationSpend(draft);
  const budget = el("div", { class: "budget" + (spend.remaining < 0 ? " over" : "") },
    el("div", {},
      el("div", { class: "field-label", style: "margin-bottom:2px", text: "Creation Points left" }),
      el("div", { class: "b-val", text: String(spend.remaining) })),
    el("div", { class: "small muted", text:
      `${spend.budget} available · traits ${spend.physical} · characteristics ${spend.attributes} · skills ${spend.skills}` +
      (spend.weaknessBonus ? ` · weaknesses +${spend.weaknessBonus}` : "") })
  );
  host.appendChild(budget);

  if (spend.professionBonus > 0) {
    host.appendChild(el("div", { class: "banner", text:
      `${spend.professionBonus} profession points available, spendable only on ${R.PROFESSION_BY_KEY[draft.identity.profession]?.name || "your profession's"} skills. ` +
      `They are counted inside the skills total above.` }));
  }

  const bodyEl = el("div", {});
  host.appendChild(bodyEl);
  STEP_RENDERERS[STEPS[stepIndex].key](bodyEl, host);

  // Nav
  const nav = el("div", { class: "btn-row", style: "margin:20px 0" });
  if (stepIndex > 0) nav.appendChild(el("button", { class: "btn", type: "button", onclick: () => { stepIndex--; renderWizard(host); } }, "Back"));
  if (stepIndex < STEPS.length - 1) {
    nav.appendChild(el("button", { class: "btn primary", type: "button", onclick: () => { stepIndex++; renderWizard(host); } }, "Next"));
  } else {
    nav.appendChild(el("button", { class: "btn primary", type: "button", onclick: () => finish(host) }, "Create dossier"));
  }
  host.appendChild(nav);
}

function update(host, mutator) {
  mutator(draft);
  draft = normalize(draft);
  renderWizard(host);
}

function sectionTitle(text, sub) {
  const wrap = el("div", { class: "section" });
  wrap.appendChild(el("div", { class: "section-title", text }));
  if (sub) wrap.appendChild(el("p", { class: "small muted", style: "margin-top:8px", text: sub }));
  return wrap;
}

/* ---------------------------------------------------------------- steps */

const STEP_RENDERERS = {

  rank(body, host) {
    body.appendChild(sectionTitle("Rank", "Rank sets your Creation Point budget, your starting Hero Points, and your chance of carrying an identifying scar."));
    for (const r of D.RANKS) {
      body.appendChild(el("button", {
        class: "opt-btn" + (draft.identity.rank === r.key ? " on" : ""), type: "button",
        onclick: () => update(host, d => {
          d.identity.rank = r.key;
          d.state.heroPoints = r.heroPoints;
        })
      },
        el("span", { class: "on-name" }, el("span", { text: r.name }), el("span", { class: "mono small", text: `${r.creationPoints} CP` })),
        el("span", { class: "on-desc", text:
          `${r.heroPoints} starting Hero Points · ${r.scarChance ? Math.round(r.scarChance * 100) + "% chance of a visible scar" : "no starting scar"} · ` +
          `expected Skill + Characteristic total ${r.expectedSkillCharTotal}` })
      ));
    }

    body.appendChild(el("label", { class: "field", style: "margin-top:14px" },
      el("span", { text: "Name" }),
      el("input", { type: "text", value: draft.identity.name, placeholder: "Agent name",
        oninput: e => { draft.identity.name = e.target.value; } })));

    body.appendChild(el("label", { class: "field" },
      el("span", { text: "Native language" }),
      el("input", { type: "text", value: draft.identity.nativeLanguage || "", placeholder: "English",
        oninput: e => { draft.identity.nativeLanguage = e.target.value; } })));

    body.appendChild(el("label", { class: "field" },
      el("span", { text: "Organisation or employer (optional)" }),
      el("input", { type: "text", value: draft.identity.organisation || "",
        oninput: e => { draft.identity.organisation = e.target.value; } })));
  },

  physical(body, host) {
    body.appendChild(sectionTitle("Physical traits",
      "Being unremarkable is expensive. Height, weight and appearance each cost Creation Points and each add Reputation — and a low Reputation is an operative's most valuable asset."));

    const isFemale = (draft.identity.gender || "").toLowerCase().startsWith("f");
    const gap = Math.abs(draft.identity.heightBand - draft.identity.weightBand);

    body.appendChild(el("p", { class: "small muted", text:
      "Height and weight are separate purchases — each costs Creation Points and adds Reputation from its own row. Keep them within one row of each other to stay proportional." }));

    for (const [field, label] of [["heightBand", "Height"], ["weightBand", "Weight"]]) {
      body.appendChild(el("div", { class: "field-label", style: "margin-top:12px", text: label }));
      for (const band of D.PHYSICAL_BANDS) {
        const col = isFemale ? band.female : band.male;
        const value = field === "heightBand" ? col.h : col.w;
        body.appendChild(el("button", {
          class: "opt-btn" + (draft.identity[field] === band.i ? " on" : ""), type: "button",
          onclick: () => update(host, d => {
            d.identity[field] = band.i;
            const c2 = isFemale ? band.female : band.male;
            if (field === "heightBand") d.identity.height = c2.h; else d.identity.weight = c2.w;
          })
        },
          el("span", { class: "on-name" },
            el("span", { text: value }),
            el("span", { class: "mono small", text: `${band.cp} CP · +${band.rep} Rep` }))
        ));
      }
    }

    if (gap > 1) {
      body.appendChild(el("div", { class: "banner warn", text:
        "Height and weight are more than one row apart. Classified characters are typically fit and trim; the GM may allow any proportion." }));
    }

    body.appendChild(el("label", { class: "field", style: "margin-top:12px" },
      el("span", { text: "Gender (descriptive only; switches the height and weight column)" }),
      el("input", { type: "text", value: draft.identity.gender || "", placeholder: "e.g. female, male, non-binary",
        onchange: e => update(host, d => { d.identity.gender = e.target.value; }) })));

    body.appendChild(el("div", { class: "field-label", style: "margin-top:12px", text: "Appearance" }));
    for (const a of D.APPEARANCES) {
      body.appendChild(el("button", {
        class: "opt-btn" + (draft.identity.appearance === a.key ? " on" : ""), type: "button",
        onclick: () => update(host, d => { d.identity.appearance = a.key; })
      },
        el("span", { class: "on-name" }, el("span", { text: a.name }),
          el("span", { class: "mono small", text: `${a.cp} CP · +${a.rep} Rep` })),
        el("span", { class: "on-desc", text: `Seduction modifier ${signed(a.seduction)}` })
      ));
    }

    const rep = R.startingReputation({
      heightBand: draft.identity.heightBand,
      weightBand: draft.identity.weightBand,
      appearance: draft.identity.appearance,
      professionYears: draft.identity.professionYears || 0,
      scars: (draft.scars || []).length
    });
    body.appendChild(el("div", { class: "banner", style: "margin-top:12px" },
      el("b", { text: `Starting Reputation: ${rep}` }),
      el("div", { class: "small", text: "Under 51 is the safest band — professionals only place you on a Superb Perception check, and then only as 'perhaps'." })));
  },

  attributes(body, host) {
    body.appendChild(sectionTitle("Characteristics",
      "Everything starts at 5. Costs climb steeply past 11. Intelligence influences the most skills, Strength the fewest."));

    for (const ch of D.CHARACTERISTICS) {
      const v = draft.attributes[ch.key];
      const nextCost = v < 15 ? D.CHARACTERISTIC_COST[v + 1] - D.CHARACTERISTIC_COST[v] : null;
      const row = el("div", { class: "card" },
        el("div", { class: "row" },
          el("div", { class: "grow" },
            el("div", { style: "font-weight:600", text: `${ch.name} (${ch.abbr})` }),
            el("div", { class: "small muted", text: ch.desc })),
          el("div", { class: "stepper" },
            el("button", { type: "button", disabled: v <= D.CHARACTERISTIC_BASE,
              onclick: () => update(host, d => { d.attributes[ch.key] = Math.max(D.CHARACTERISTIC_BASE, v - 1); }) }, "−"),
            el("span", { class: "val", text: String(v) }),
            el("button", { type: "button", disabled: v >= D.CHARACTERISTIC_MAX,
              onclick: () => update(host, d => { d.attributes[ch.key] = Math.min(D.CHARACTERISTIC_MAX, v + 1); }) }, "+")
          )
        ),
        el("div", { class: "small muted", style: "margin-top:6px", text:
          `Total cost ${R.characteristicCost(v)} CP` + (nextCost ? ` · next point ${nextCost} CP` : " · at maximum") +
          ` · relative skill weight ${D.CHARACTERISTIC_WEIGHT[ch.key]}` })
      );
      body.appendChild(row);
    }

    const dv = derived(draft);
    body.appendChild(el("div", { class: "grid grid-3", style: "margin-top:12px" },
      box("Speed", dv.speed), box("H-to-H", dv.hthDamage), box("Carry", dv.carryRange),
      box("Run/Swim", dv.runSwim + "m"), box("Stamina", dv.stamina + "h"), box("Draw", signed(dv.drawBonus))
    ));
  },

  profession(body, host) {
    body.appendChild(sectionTitle("Profession and Fields of Experience",
      `Each year gives ${D.PROFESSION_RULES.cpPerYear} Creation Points for that profession's skills, one Field of Experience, ` +
      `${D.PROFESSION_RULES.repPerYear} Reputation, and a year of age. Maximum ${D.PROFESSION_RULES.maxYears} years.`));

    for (const p of D.PROFESSIONS) {
      body.appendChild(el("button", {
        class: "opt-btn" + (draft.identity.profession === p.key ? " on" : ""), type: "button",
        onclick: () => update(host, d => {
          d.identity.profession = p.key;
          d.foe = [];
        })
      },
        el("span", { class: "on-name" }, el("span", { text: p.name })),
        el("span", { class: "on-desc", text: p.desc }),
        el("span", { class: "on-desc", text: "Skills: " + p.skills.map(R.skillName).join(", ") })
      ));
    }

    if (draft.identity.profession) {
      const years = draft.identity.professionYears || 0;
      body.appendChild(el("div", { class: "card", style: "margin-top:12px" },
        el("div", { class: "row" },
          el("div", { class: "grow" },
            el("div", { style: "font-weight:600", text: "Years in the profession" }),
            el("div", { class: "small muted", text: `Age ${D.PROFESSION_RULES.startAge + years} · +${years * D.PROFESSION_RULES.repPerYear} Reputation · ${years * D.PROFESSION_RULES.cpPerYear} bonus points` })),
          el("div", { class: "stepper" },
            el("button", { type: "button", disabled: years <= 0,
              onclick: () => update(host, d => {
                d.identity.professionYears = years - 1;
                d.identity.age = D.PROFESSION_RULES.startAge + years - 1;
                d.foe = d.foe.slice(0, years - 1);
              }) }, "−"),
            el("span", { class: "val", text: String(years) }),
            el("button", { type: "button", disabled: years >= D.PROFESSION_RULES.maxYears,
              onclick: () => update(host, d => {
                d.identity.professionYears = years + 1;
                d.identity.age = D.PROFESSION_RULES.startAge + years + 1;
              }) }, "+")
          ))
      ));

      const prof = R.PROFESSION_BY_KEY[draft.identity.profession];
      const allowed = years;
      body.appendChild(el("div", { class: "field-label", style: "margin-top:14px",
        text: `Fields of Experience (${draft.foe.length}/${allowed})` }));
      body.appendChild(el("p", { class: "small muted", text:
        "Two General Fields may be taken in place of one profession Field." }));

      const profWrap = el("div", { class: "chip-wrap" });
      for (const key of prof.foe) {
        const f = R.FOE_BY_KEY[key];
        if (!f) continue;
        const on = draft.foe.includes(key);
        profWrap.appendChild(el("button", {
          class: "chip" + (on ? " on" : ""), type: "button", title: f.desc,
          onclick: () => update(host, d => {
            if (on) d.foe = d.foe.filter(x => x !== key);
            else d.foe.push(key);
          })
        }, f.name));
      }
      body.appendChild(profWrap);

      body.appendChild(el("div", { class: "field-label", style: "margin-top:12px", text: "General Fields of Experience" }));
      const genWrap = el("div", { class: "chip-wrap" });
      for (const key of D.GENERAL_FOE) {
        const f = R.FOE_BY_KEY[key];
        if (!f) continue;
        const on = draft.foe.includes(key);
        genWrap.appendChild(el("button", {
          class: "chip" + (on ? " on" : ""), type: "button", title: f.desc,
          onclick: () => update(host, d => {
            if (on) d.foe = d.foe.filter(x => x !== key);
            else d.foe.push(key);
          })
        }, f.name));
      }
      body.appendChild(genWrap);

      if (draft.foe.includes("linguistics")) {
        body.appendChild(el("div", { class: "banner ok", style: "margin-top:10px", text:
          "Linguistics: you speak one extra language at Skill Rank 15 and pay half cost for new or improved languages. Add it on the Skills step." }));
      }
    }
  },

  skills(body, host) {
    body.appendChild(sectionTitle("Skills",
      `${D.SKILL_COST_NEW} Creation Points to acquire a skill at rank 1, then ${D.SKILL_COST_RANK} per further rank. ` +
      `Rank cannot exceed the highest underlying characteristic + ${D.SKILL_RANK_OVER_CHARACTERISTIC}. Base Chance caps at ${D.MAX_BASE_CHANCE}.`));

    const prof = R.PROFESSION_BY_KEY[draft.identity.profession];
    const groups = {};
    for (const s of D.SKILLS) {
      if (s.multi) continue;
      (groups[s.group] = groups[s.group] || []).push(s);
    }

    for (const [group, list] of Object.entries(groups)) {
      const acc = el("details", { class: "acc", open: group === "Combat" || group === "Covert" },
        el("summary", { text: group }));
      const bodyEl = el("div", { class: "acc-body" });
      for (const s of list.sort((a, b) => a.name.localeCompare(b.name))) {
        const rank = draft.skills[s.key];
        const has = rank !== undefined;
        const max = R.maxSkillRank(s.key, draft.attributes);
        const base = has
          ? R.baseChance(s.key, draft.attributes, rank, draft.skills.charisma || 0)
          : R.untrainedBaseChance(s.key, draft.attributes, draft.skills.charisma || 0);
        const isProf = prof && prof.skills.includes(s.key);
        const locked = D.STARTING_SKILLS.includes(s.key);

        bodyEl.appendChild(el("div", { class: "card-row", style: "padding-left:0;padding-right:0" },
          el("div", { class: "grow" },
            el("div", {}, s.name, isProf ? el("span", { class: "pill neutral", style: "margin-left:6px", text: "profession" }) : null),
            el("div", { class: "small muted", text:
              `${R.formulaLabel(s.key)} + rank · Base ${base}` + (has ? ` · max rank ${max}` : " · not trained") })),
          el("div", { class: "stepper" },
            el("button", { type: "button", disabled: !has || (locked && rank <= 1),
              onclick: () => update(host, d => {
                if (rank <= 1) { if (!locked) delete d.skills[s.key]; }
                else d.skills[s.key] = rank - 1;
              }) }, "−"),
            el("span", { class: "val", text: has ? String(rank) : "—" }),
            el("button", { type: "button", disabled: has && rank >= max,
              onclick: () => update(host, d => { d.skills[s.key] = has ? rank + 1 : 1; }) }, "+")
          )
        ));
      }
      acc.appendChild(bodyEl);
      body.appendChild(acc);
    }

    // Languages
    body.appendChild(el("div", { class: "section-title", style: "margin-top:16px", text: "Languages" }));
    body.appendChild(el("p", { class: "small muted", text:
      "Language is the only skill without a rank cap. Base Chance is INT + rank, still capped at 30." }));
    for (let i = 0; i < (draft.languages || []).length; i++) {
      const l = draft.languages[i];
      const f = R.fluencyFor(l.rank);
      body.appendChild(el("div", { class: "card-row", style: "padding-left:0;padding-right:0" },
        el("div", { class: "grow" },
          el("div", { text: l.name }),
          el("div", { class: "small muted", text: `${f.label} — ${f.desc}` })),
        el("div", { class: "stepper" },
          el("button", { type: "button", onclick: () => update(host, d => {
            if (l.rank <= 1) d.languages.splice(i, 1); else d.languages[i].rank -= 1;
          }) }, "−"),
          el("span", { class: "val", text: String(l.rank) }),
          el("button", { type: "button", onclick: () => update(host, d => { d.languages[i].rank += 1; }) }, "+")
        )
      ));
    }
    body.appendChild(el("button", {
      class: "btn sm", type: "button", style: "margin-top:8px",
      onclick: async () => {
        const name = await promptModal("Language name", { title: "Add a language" });
        if (name) update(host, d => { d.languages.push({ name, rank: 1 }); });
      }
    }, "+ Add language"));
  },

  weaknesses(body, host) {
    body.appendChild(sectionTitle("Weaknesses",
      `Each Weakness adds Creation Points but promises complications. The book suggests no more than ${D.WEAKNESS_MAX_DEFAULT} without GM permission.`));
    body.appendChild(el("p", { class: "small muted", text: D.WEAKNESS_CHECK.desc }));

    for (const w of D.WEAKNESSES) {
      const on = draft.weaknesses.includes(w.key);
      body.appendChild(el("button", {
        class: "opt-btn" + (on ? " on" : ""), type: "button",
        onclick: () => update(host, d => {
          if (on) d.weaknesses = d.weaknesses.filter(x => x !== w.key);
          else d.weaknesses.push(w.key);
        })
      },
        el("span", { class: "on-name" }, el("span", { text: w.name }),
          el("span", { class: "mono small", text: `+${w.cp} CP · ${w.type}` })),
        el("span", { class: "on-desc", text: w.desc })
      ));
    }
  },

  abilities(body, host) {
    body.appendChild(sectionTitle("Abilities",
      `Every operative has Connoisseur, First Aid and their Native Language at a fixed Base Chance of ${D.ABILITY_BASE_CHANCE}. ` +
      "Choose one more from the Potential Abilities list. An Ability can never be improved."));

    const card = el("div", { class: "card flush" });
    for (const a of D.FIXED_ABILITIES) {
      card.appendChild(el("div", { class: "card-row" },
        el("div", { class: "grow" }, el("div", { text: a.name }), el("div", { class: "small muted", text: a.desc })),
        el("span", { class: "mono", text: String(D.ABILITY_BASE_CHANCE) })));
    }
    body.appendChild(card);

    body.appendChild(el("div", { class: "field-label", style: "margin-top:14px", text: "Your fourth Ability" }));
    for (const key of D.POTENTIAL_ABILITIES) {
      const s = R.SKILL_BY_KEY[key];
      const name = key === "language" ? "Language (a second tongue at Base Chance 20)" : (s ? s.name : key);
      body.appendChild(el("button", {
        class: "opt-btn" + (draft.abilities.chosen === key ? " on" : ""), type: "button",
        onclick: () => update(host, d => { d.abilities.chosen = d.abilities.chosen === key ? null : key; })
      },
        el("span", { class: "on-name" }, el("span", { text: name }), el("span", { class: "mono small", text: "Base 20" })),
        s ? el("span", { class: "on-desc", text: s.desc }) : null
      ));
    }

    body.appendChild(el("div", { class: "banner warn", style: "margin-top:12px", text:
      "An Ability is frozen at 20 forever. If you expect to push a skill above rank 10 or so, buy it as a skill instead." }));
  },

  review(body, host) {
    const val = validate(draft);
    const dv = derived(draft);
    const rankRow = R.RANK_BY_KEY[draft.identity.rank];

    body.appendChild(sectionTitle("Review"));

    if (val.errors.length) {
      body.appendChild(el("div", { class: "banner warn" },
        el("b", { text: "Must fix before creating" }),
        ...val.errors.map(e => el("div", { class: "small", text: "• " + e }))));
    }
    if (val.warnings.length) {
      body.appendChild(el("div", { class: "banner" },
        el("b", { text: "Worth a look" }),
        ...val.warnings.map(e => el("div", { class: "small", text: "• " + e }))));
    }
    if (!val.errors.length && !val.warnings.length) {
      body.appendChild(el("div", { class: "banner ok", text: "Legal and complete." }));
    }

    const rep = R.startingReputation({
      heightBand: draft.identity.heightBand,
      weightBand: draft.identity.weightBand,
      appearance: draft.identity.appearance,
      professionYears: draft.identity.professionYears || 0,
      scars: 0
    });

    body.appendChild(el("div", { class: "grid grid-2", style: "margin-top:12px" },
      box("Name", draft.identity.name || "—"),
      box("Rank", rankRow.name),
      box("Hero Points", draft.state.heroPoints),
      box("Reputation", rep),
      box("Points left", val.spend.remaining),
      box("Speed", dv.speed)
    ));

    if (rankRow.scarChance > 0) {
      body.appendChild(el("div", { class: "banner", style: "margin-top:12px" },
        el("b", { text: `Scar check: ${Math.round(rankRow.scarChance * 100)}% chance of a visible scar` }),
        el("div", { class: "small", text: `A scar adds ${D.SCAR_REPUTATION} Reputation. This is rolled when you create the dossier.` })));
    }

    const trained = Object.entries(draft.skills).sort((a, b) => b[1] - a[1]);
    if (trained.length) {
      const card = el("div", { class: "card flush", style: "margin-top:12px" });
      for (const [k, rank] of trained) {
        card.appendChild(el("div", { class: "card-row" },
          el("span", { class: "grow", text: R.skillName(k) }),
          el("span", { class: "small muted", text: "rank " + rank }),
          el("span", { class: "mono", text: String(R.baseChance(k, draft.attributes, rank, draft.skills.charisma || 0)) })));
      }
      body.appendChild(card);
    }
  }
};

function box(k, v) {
  return el("div", { class: "stat-box" },
    el("div", { class: "k", text: k }),
    el("div", { class: "v", style: String(v).length > 6 ? "font-size:15px" : "", text: String(v) }));
}

/* ---------------------------------------------------------------- finish */

async function finish(host) {
  const val = validate(draft);
  if (!val.ok) {
    showToast("Fix the legality problems first", "err");
    return;
  }

  const rankRow = R.RANK_BY_KEY[draft.identity.rank];
  let scarNote = "";
  if (rankRow.scarChance > 0 && percent(rankRow.scarChance)) {
    const loc = R.scarLocation(d100());
    draft.scars.push({ location: loc, note: "From before play began" });
    scarNote = ` A distinctive scar on the ${loc.toLowerCase()} adds ${D.SCAR_REPUTATION} Reputation.`;
  }

  draft.reputation = R.startingReputation({
    heightBand: draft.identity.heightBand,
    weightBand: draft.identity.weightBand,
    appearance: draft.identity.appearance,
    professionYears: draft.identity.professionYears || 0,
    scars: draft.scars.length
  });

  const saved = Store.saveCharacter(draft);
  Store.setActive(saved.id);
  draft = null;
  stepIndex = 0;

  showToast("Dossier created" + (scarNote ? " with a scar" : ""), "ok");
  if (scarNote) {
    modal({
      title: "Dossier opened",
      body: el("div", {},
        el("p", { text: `${saved.identity.name} is ready.` }),
        el("p", { text: scarNote.trim() }),
        el("p", { class: "small muted", text: "Scars raise Reputation only while visible. Covered by clothing they cost nothing until revealed." })),
      actions: [{ label: "Open sheet", kind: "primary", onClick: () => navigate("sheet") }]
    });
  } else {
    navigate("sheet");
  }
  renderResourceHeader();
}

/* ---------------------------------------------------------------- entry screen */

export function renderCreate(host) {
  clear(host);

  if (draft) {
    renderWizard(host);
    return;
  }

  host.appendChild(el("div", { class: "section" },
    el("div", { class: "section-title", text: "New operative" }),
    el("p", { class: "small muted", style: "margin-top:8px", text:
      "Point-buy creation. Pick a rank to set your budget; you can change it later in the wizard." })));

  for (const r of D.RANKS) {
    host.appendChild(el("button", {
      class: "opt-btn", type: "button",
      onclick: () => { startWizard(r.key); renderWizard(host); }
    },
      el("span", { class: "on-name" }, el("span", { text: r.name }), el("span", { class: "mono small", text: `${r.creationPoints} CP` })),
      el("span", { class: "on-desc", text: `${r.heroPoints} Hero Points · recommended for ${r.key === "rookie" ? "new players" : r.key === "agent" ? "experienced players" : "a heroic or cinematic table"}` })
    ));
  }

  const existing = Store.allCharacters();
  if (existing.length) {
    host.appendChild(el("div", { class: "section", style: "margin-top:20px" },
      el("div", { class: "section-title", text: "Existing dossiers" })));
    const card = el("div", { class: "card flush" });
    for (const c of existing) {
      card.appendChild(el("div", { class: "card-row" },
        el("button", {
          class: "grow", style: "background:none;border:none;text-align:left;cursor:pointer;color:inherit;padding:0",
          type: "button",
          onclick: () => { Store.setActive(c.id); renderResourceHeader(); navigate("sheet"); }
        },
          el("div", { text: c.identity.name || "Unnamed" }),
          el("div", { class: "small muted", text:
            `${R.RANK_BY_KEY[c.identity.rank]?.name || ""} · Reputation ${c.reputation} · ${Object.keys(c.skills).length} skills` })),
        el("button", {
          class: "btn sm ghost", type: "button",
          onclick: async () => {
            if (await confirmModal(`Delete ${c.identity.name || "this dossier"}? This cannot be undone.`, { danger: true, okLabel: "Delete" })) {
              Store.deleteCharacter(c.id);
              renderCreate(host);
              renderResourceHeader();
            }
          }
        }, "✕")
      ));
    }
    host.appendChild(card);
  }
}
