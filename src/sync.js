/* sync.js — Firebase auth, campaigns, join codes, presence.
 * Everything degrades to a no-op when FIREBASE_ENABLED is false, so the app is fully
 * usable offline with zero configuration. Phase 5 is gated on the First Session
 * Playable milestone; the wiring below is the architecture, active only with real keys.
 */

import { STORAGE_PREFIX, joinCode as makeJoinCode } from "./core.js";
import { FIREBASE_ENABLED, FIREBASE_CONFIG, FIREBASE_SDK } from "../firebase-config.js";
import { Settings } from "./settings.js";

const K_CAMPAIGN = STORAGE_PREFIX + "campaign";

let fb = null;              // { app, auth, db, user }
let initPromise = null;
let campaign = null;        // { id, joinCode, name, role }

export function isEnabled() { return FIREBASE_ENABLED && Settings.multiplayer(); }
export function currentCampaign() {
  if (campaign) return campaign;
  try { campaign = JSON.parse(localStorage.getItem(K_CAMPAIGN) || "null"); } catch { campaign = null; }
  return campaign;
}
export function currentUser() { return fb ? fb.user : null; }

function persistCampaign() {
  if (campaign) localStorage.setItem(K_CAMPAIGN, JSON.stringify(campaign));
  else localStorage.removeItem(K_CAMPAIGN);
}

/** Lazily load the Firebase SDK and sign in anonymously. */
export async function init() {
  if (!isEnabled()) return null;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const [{ initializeApp }, authMod, dbMod] = await Promise.all([
      import(/* @vite-ignore */ FIREBASE_SDK.app),
      import(/* @vite-ignore */ FIREBASE_SDK.auth),
      import(/* @vite-ignore */ FIREBASE_SDK.database)
    ]);
    const app = initializeApp(FIREBASE_CONFIG);
    const auth = authMod.getAuth(app);
    const db = dbMod.getDatabase(app);
    const cred = await authMod.signInAnonymously(auth);
    fb = { app, auth, db, user: cred.user, authMod, dbMod };
    document.dispatchEvent(new CustomEvent("sync:ready"));
    return fb;
  })().catch(err => {
    console.warn("Firebase unavailable, staying in local mode:", err && err.message);
    initPromise = null;
    return null;
  });

  return initPromise;
}

/* ---------------------------------------------------------------- campaigns */

export async function createCampaign(name, role = "gm") {
  const f = await init();
  const code = makeJoinCode();
  if (!f) {
    campaign = { id: "local", joinCode: code, name, role, local: true };
    persistCampaign();
    return campaign;
  }
  const { ref, push, set, serverTimestamp } = f.dbMod;
  const node = push(ref(f.db, "campaigns"));
  await set(node, {
    meta: { name, joinCode: code, createdAt: serverTimestamp(), ownerUid: f.user.uid },
    members: { [f.user.uid]: { displayName: "GM", role } }
  });
  campaign = { id: node.key, joinCode: code, name, role };
  persistCampaign();
  return campaign;
}

export async function joinCampaign(code, displayName, characterId) {
  const f = await init();
  if (!f) {
    campaign = { id: "local", joinCode: code, name: "Local table", role: "player", local: true };
    persistCampaign();
    return campaign;
  }
  const { ref, get, query, orderByChild, equalTo, set } = f.dbMod;
  const snap = await get(query(ref(f.db, "campaigns"), orderByChild("meta/joinCode"), equalTo(code)));
  if (!snap.exists()) throw new Error("No campaign with that join code.");
  const id = Object.keys(snap.val())[0];
  await set(ref(f.db, `campaigns/${id}/members/${f.user.uid}`), {
    displayName: displayName || "Agent", characterId: characterId || null, role: "player"
  });
  campaign = { id, joinCode: code, name: snap.val()[id].meta.name, role: "player" };
  persistCampaign();
  return campaign;
}

export function leaveCampaign() { campaign = null; persistCampaign(); }

/**
 * Set this device's member record. Called when the player picks which dossier they are
 * bringing, and whenever that dossier is renamed.
 */
export async function setMember({ displayName, characterId, role } = {}) {
  const f = await init();
  const c = currentCampaign();
  if (!c) return null;
  if (!f || c.local) {
    c.displayName = displayName || c.displayName || "Agent";
    if (characterId !== undefined) c.characterId = characterId;
    persistCampaign();
    return c;
  }
  const { ref, update } = f.dbMod;
  const patch = {};
  if (displayName !== undefined) patch.displayName = displayName;
  if (characterId !== undefined) patch.characterId = characterId;
  if (role !== undefined) patch.role = role;
  await update(ref(f.db, `campaigns/${c.id}/members/${f.user.uid}`), patch);
  return c;
}

/**
 * Everyone in the campaign, once. Returns [] in local mode rather than throwing, so the
 * party panel has one shape to render whether or not keys are configured.
 */
export async function members() {
  const f = await init();
  const c = currentCampaign();
  if (!f || !c || c.local) return [];
  const { ref, get } = f.dbMod;
  const snap = await get(ref(f.db, `campaigns/${c.id}/members`));
  if (!snap.exists()) return [];
  return Object.entries(snap.val()).map(([uid, m]) => ({ uid, ...m }));
}

/** Live party membership. Resolves to an unsubscribe function; a no-op in local mode. */
export async function watchMembers(callback) {
  return watch("members", val => {
    callback(val ? Object.entries(val).map(([uid, m]) => ({ uid, ...m })) : []);
  });
}

/* ---------------------------------------------------------------- pushes */

async function node(path) {
  const f = await init();
  const c = currentCampaign();
  if (!f || !c || c.local) return null;
  return { f, path: `campaigns/${c.id}/${path}` };
}

export async function pushCharacter(character) {
  const n = await node(`characters/${character.id}`);
  if (!n) return;
  const { ref, set } = n.f.dbMod;
  try { await set(ref(n.f.db, n.path), character); } catch (e) { console.warn("sync character failed", e); }
}

export async function pushRoll(entry) {
  const n = await node("rollLog");
  if (!n) return;
  const { ref, push, set } = n.f.dbMod;
  try { await set(push(ref(n.f.db, n.path)), entry); } catch (e) { console.warn("sync roll failed", e); }
}

/**
 * The combat mirror. Stamped with this device's id and a revision so a client can tell its
 * own echo from someone else's change — without that the tracker fights itself, every push
 * coming back as a remote update that triggers another push.
 */
export async function pushCombat(state) {
  const n = await node("combat");
  if (!n) return;
  const { ref, set } = n.f.dbMod;
  const stamped = { ...state, rev: Date.now(), by: n.f.user.uid };
  try { await set(ref(n.f.db, n.path), stamped); } catch (e) { console.warn("sync combat failed", e); }
}

/** True when a mirrored record came from this device. */
export function isOwnEcho(record) {
  return !!(record && fb && record.by && record.by === fb.user.uid);
}

export async function broadcast(text) {
  const n = await node("broadcast");
  if (!n) return;
  const { ref, push, set } = n.f.dbMod;
  await set(push(ref(n.f.db, n.path)), { text, ts: Date.now(), from: n.f.user.uid });
}

/** Subscribe to a campaign sub-path. Returns an unsubscribe function. */
export async function watch(path, callback) {
  const n = await node(path);
  if (!n) return () => {};
  const { ref, onValue } = n.f.dbMod;
  return onValue(ref(n.f.db, n.path), snap => callback(snap.val()));
}

export function statusLabel() {
  if (!FIREBASE_ENABLED) return "Local only — no Firebase keys configured";
  if (!Settings.multiplayer()) return "Local only — multiplayer toggle is off";
  const c = currentCampaign();
  if (!c) return "Signed in — no campaign joined";
  return `${c.name} · ${c.joinCode} · ${c.role}`;
}
