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

// The Pokédex: every species the trainer has caught or evolved into, with the first date.
// user.dex = { [dexNumber]: 'YYYY-MM-DD' }. Kept even if that Pokémon later evolves.
export function recordDex(user, species, date) {
  if (!species) return false;
  user.dex = user.dex && typeof user.dex === 'object' ? user.dex : {};
  if (user.dex[species] && user.dex[species] <= date) return false;
  user.dex = { ...user.dex, [species]: date };
  return true;
}

// Make sure the save has a valid team: the starter's mon exists, and the party only lists owned mons,
// once each, at most six, and is never empty. Also fills the Pokédex from the team for older saves.
// Returns true if anything changed.
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
  for (const mon of user.mons) if (!user.dex?.[mon.species]) { recordDex(user, mon.species, mon.caughtOn || localDateKey(new Date(now))); changed = true; }
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

// ---- Biomes: your lead's types decide where you are ----------------------------------------
// Biome keys match the scenery in the game scripts. Types without a biome of their own yet borrow
// the closest one.
export const TYPE_BIOMES = {
  normal: ['meadow'], grass: ['meadow', 'forest'], bug: ['forest'], water: ['river', 'beach'],
  electric: ['storm'], fire: ['volcano', 'cave'], flying: ['sky'], ground: ['desert'],
  rock: ['canyon', 'cave'], dragon: ['canyon'], ghost: ['haunted', 'graveyard'], psychic: ['ruins'],
  poison: ['marsh'], dark: ['crystal'], ice: ['river'], fighting: ['canyon'], steel: ['cave'], fairy: ['meadow'],
};
// Starters keep the five biomes they always had, so nobody loses a place they could visit before.
export const STARTER_BIOMES = {
  pikachu: ['meadow', 'forest', 'river', 'beach', 'storm'],
  charizard: ['volcano', 'sky', 'cave', 'desert', 'canyon'],
  gengar: ['haunted', 'ruins', 'marsh', 'graveyard', 'crystal'],
};

export function biomesFor(mon, starterKey) {
  const fromTypes = (speciesInfo(mon?.species)?.types || []).flatMap(t => TYPE_BIOMES[t] || []);
  const home = mon?.starter ? STARTER_BIOMES[starterKey] || [] : [];
  return [...new Set([...home, ...fromTypes])];
}

export function leadOf(user) {
  return (user?.mons || []).find(m => m.id === user?.party?.[0]) || null;
}

// The biome to show: the saved one if the lead can be there, otherwise the lead's first.
// Every biome, for free travel.
export const ALL_BIOMES = [...new Set(Object.values(STARTER_BIOMES).flat())];

// The biome to show: wherever you travelled, or your lead's first biome if that's not a real place.
export function currentBiome(user) {
  return ALL_BIOMES.includes(user?.biome) ? user.biome : biomesFor(leadOf(user), user?.pokemon)[0] || 'meadow';
}

// ---- Moves for caught Pokémon (starters keep their own move lists) -------------------------
export const TYPE_MOVES = {
  normal: ['TACKLE!', 'HEADBUTT!', 'HYPER BEAM!'], fire: ['EMBER!', 'FLAMETHROWER!', 'FIRE BLAST!'],
  water: ['WATER GUN!', 'BUBBLE BEAM!', 'HYDRO PUMP!'], grass: ['VINE WHIP!', 'RAZOR LEAF!', 'SOLAR BEAM!'],
  electric: ['THUNDER SHOCK!', 'THUNDERBOLT!', 'THUNDER!'], ice: ['POWDER SNOW!', 'ICE BEAM!', 'BLIZZARD!'],
  fighting: ['KARATE CHOP!', 'BRICK BREAK!', 'CLOSE COMBAT!'], poison: ['POISON STING!', 'SLUDGE BOMB!', 'GUNK SHOT!'],
  ground: ['MUD-SLAP!', 'DIG!', 'EARTHQUAKE!'], flying: ['GUST!', 'WING ATTACK!', 'HURRICANE!'],
  psychic: ['CONFUSION!', 'PSYBEAM!', 'PSYCHIC!'], bug: ['BUG BITE!', 'X-SCISSOR!', 'MEGAHORN!'],
  rock: ['ROCK THROW!', 'ROCK SLIDE!', 'STONE EDGE!'], ghost: ['ASTONISH!', 'SHADOW BALL!', 'PHANTOM FORCE!'],
  dragon: ['TWISTER!', 'DRAGON PULSE!', 'DRAGON RUSH!'], dark: ['BITE!', 'CRUNCH!', 'DARK PULSE!'],
  steel: ['METAL CLAW!', 'IRON HEAD!', 'FLASH CANNON!'], fairy: ['FAIRY WIND!', 'DRAINING KISS!', 'MOONBLAST!'],
};
export const MOVE_LEVELS = [1, 20, 40];
export function moveFor(mon) {
  const type = speciesInfo(mon?.species)?.types?.[0] || 'normal', level = levelFor(mon?.xp);
  const list = TYPE_MOVES[type] || TYPE_MOVES.normal;
  return list[MOVE_LEVELS.filter(at => level >= at).length - 1];
}

// ---- Party and box -------------------------------------------------------------------------
// Each returns a new party list (lead first), or the same list if the move isn't allowed.
export function setLead(party, id) {
  return party.includes(id) ? [id, ...party.filter(x => x !== id)] : party;
}
export function sendToBox(party, id) {
  return party.length > 1 && party.includes(id) ? party.filter(x => x !== id) : party;
}
export function bringToParty(party, id) {
  return party.length < PARTY_SIZE && !party.includes(id) ? [...party, id] : party;
}
// Swap a party member with a boxed one, keeping its slot.
export function swapIn(party, outId, inId) {
  return party.includes(outId) && !party.includes(inId) ? party.map(x => (x === outId ? inId : x)) : party;
}

// Evolve a caught mon as far as its level allows. Returns the steps taken, e.g. [16, 17, 18].
export function evolveFully(mon) {
  const steps = [mon.species];
  for (let next = evolutionFor(mon); next && steps.length < 4; next = evolutionFor(mon)) {
    mon.species = next;
    steps.push(next);
  }
  return steps;
}
