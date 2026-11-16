// The trainer's Pokémon: everything they own (`mons`), the party of up to six (`party`, lead first),
// levels, Exp. Share, and evolution. Pure functions: no DOM, no storage.
//
// A mon looks like:
//   { id, species: dexNumber, xp, nickname?, starter?, caughtOn: 'YYYY-MM-DD', note?, updatedAt }
// `user.party` is a list of mon ids; any mon not in it is in the box.
//
// Saves from before 2.0 had a single partner: user.pokemon ('pikachu' | 'charizard' | 'gengar'),
// user.form, user.xp and user.nickname. Those fields still drive the partner card, so for now the
// starter's mon mirrors them (syncStarter) rather than the other way round.

import { SPECIES } from './species.js';
import { localDateKey } from './schedule.js';

export const PARTY_SIZE = 6;
export const XP_PER_LEVEL = 100;
// Exp. Share: party members who aren't leading get this fraction of the lead's XP. The box gets none.
export const SHARE = 0.5;
export const STARTER_ID = 'starter';

export const STARTER_SPECIES = { pikachu: 25, charizard: 4, gengar: 92 };
export const FORM_SPECIES = { pikachu: 25, raichu: 26, charmander: 4, charmeleon: 5, charizard: 6, gastly: 92, haunter: 93, gengar: 94 };

export const levelFor = xp => Math.floor(Math.max(0, Number(xp) || 0) / XP_PER_LEVEL) + 1;
export const xpForLevel = level => Math.max(0, level - 1) * XP_PER_LEVEL;

export function speciesInfo(id) {
  return SPECIES[id] || null;
}

export function monName(mon) {
  return mon?.nickname || speciesInfo(mon?.species)?.name || 'Pokémon';
}

function randomPart() {
  return typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10);
}

export function makeMon({ species, xp = 0, caughtOn, note, nickname }, now = Date.now()) {
  const mon = { id: `mon-${now}-${randomPart()}`, species, xp, caughtOn: caughtOn || localDateKey(new Date(now)), updatedAt: now };
  if (note) mon.note = note;
  if (nickname) mon.nickname = nickname;
  return mon;
}

// Copy the starter's legacy fields onto its mon. The starter's id is fixed, so two devices that
// upgrade the same save on their own still end up with one starter after their saves merge.
export function syncStarter(user, now = Date.now()) {
  if (!user?.pokemon) return false;
  const mons = Array.isArray(user.mons) ? user.mons : [];
  const species = FORM_SPECIES[user.form] || STARTER_SPECIES[user.pokemon];
  const xp = Math.max(0, Number(user.xp) || 0);
  const nickname = user.nickname || '';
  const current = mons.find(m => m.id === STARTER_ID);
  if (current && current.species === species && current.xp === xp && (current.nickname || '') === nickname) return false;
  const starter = {
    ...(current || { id: STARTER_ID, starter: true, caughtOn: localDateKey(new Date(now)) }),
    species, xp, updatedAt: now,
  };
  if (nickname) starter.nickname = nickname;
  else delete starter.nickname;
  user.mons = current ? mons.map(m => (m.id === STARTER_ID ? starter : m)) : [starter, ...mons];
  return true;
}

// Make sure the save has a valid team: the starter's mon exists, and the party only lists owned mons,
// once each, at most six, and is never empty. Returns true if anything changed.
export function ensureTeam(user, now = Date.now()) {
  let changed = syncStarter(user, now);
  if (!Array.isArray(user.mons)) { user.mons = []; changed = true; }
  const owned = new Set(user.mons.map(m => m.id));
  const party = [...new Set(Array.isArray(user.party) ? user.party : [])].filter(id => owned.has(id)).slice(0, PARTY_SIZE);
  if (!party.length && user.mons.length) party.push(owned.has(STARTER_ID) ? STARTER_ID : user.mons[0].id);
  if (!Array.isArray(user.party) || party.length !== user.party.length || party.some((id, i) => id !== user.party[i])) {
    user.party = party;
    changed = true;
  }
  return changed;
}

// The species this mon is ready to become, or null. Starters keep their own evolution scenes
// (Thunder Stone, Haunter's trade), so they never evolve here.
export function evolutionFor(mon) {
  if (!mon || mon.starter) return null;
  const info = speciesInfo(mon.species);
  return info?.evolvesTo && levelFor(mon.xp) >= info.evolveLevel ? info.evolvesTo : null;
}

// Give XP for a finished quest: the lead gets `amount`, the rest of the party gets the Exp. Share.
// Returns { mons, gains: [{ id, xp, fromLevel, toLevel, evolvesTo }] } without changing the input.
export function awardXP(mons, party, amount, now = Date.now()) {
  const share = new Map((party || []).map((id, i) => [id, i === 0 ? amount : Math.round(amount * SHARE)]));
  const gains = [];
  const next = (mons || []).map(mon => {
    const xp = share.get(mon.id);
    if (!xp) return mon;
    const after = { ...mon, xp: (Number(mon.xp) || 0) + xp, updatedAt: now };
    gains.push({ id: mon.id, xp, fromLevel: levelFor(mon.xp), toLevel: levelFor(after.xp), evolvesTo: evolutionFor(after) });
    return after;
  });
  return { mons: next, gains };
}

// True if `later` is `earlier` or one of its evolutions. Used when merging two copies of a mon.
export function isSameOrLaterStage(earlier, later) {
  for (let id = earlier, steps = 0; id && steps < 4; id = speciesInfo(id)?.evolvesTo, steps++) if (id === later) return true;
  return false;
}
