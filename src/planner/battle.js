// Daily wild battles. Each day one wild Pokémon from the current biome appears. Its HP is the
// number of quests on today's list, and each finished quest is a hit, so the battle is always worked
// out from the list itself: adding a quest adds HP, and deleting one takes it away. Clearing the whole
// list knocks it out and catches it. If the day ends first it simply runs off; nothing is lost.
// Pure functions: no DOM, no storage.
//
// user.encounter = { date, species, biome } is the day's wild Pokémon. Whether it was caught is read
// from the team (a mon with `encounter: date`), so two devices can't both catch it.

import { SPECIES } from './species.js';
import { makeMon, PARTY_SIZE, xpForLevel } from './team.js';

// Legendary birds and strong final stages turn up less often.
export const RARITY = { 144: 0.08, 145: 0.08, 146: 0.08, 149: 0.25, 142: 0.3, 373: 0.25, 130: 0.4, 6: 0.3 };
export const rarityOf = id => RARITY[id] ?? 1;

// Small, stable string hash (FNV-1a), so the same day and biome always give the same Pokémon.
function hash(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967296;
}

export function pickWild(pool, seed) {
  const ids = [...new Set(pool)].filter(id => SPECIES[id]);
  if (!ids.length) return null;
  const total = ids.reduce((sum, id) => sum + rarityOf(id), 0);
  let roll = hash(seed) * total;
  for (const id of ids) if ((roll -= rarityOf(id)) < 0) return id;
  return ids[ids.length - 1];
}

// The level a species can first be met at: 5, or the level its earlier stage evolves at.
const reachedAt = {};
for (const s of Object.values(SPECIES)) if (s.evolvesTo) reachedAt[s.evolvesTo] = s.evolveLevel;
export function wildLevel(species) {
  return Math.max(5, reachedAt[species] || 0);
}

// Today's wild Pokémon, chosen once per day and then kept even if the biome changes later.
export function ensureEncounter(user, today, biome, pool) {
  if (user.encounter?.date === today) return false;
  const species = pickWild(pool || [], `${today}|${biome}|${user.email || user.name || ''}`);
  if (!species) return false;
  user.encounter = { date: today, species, biome };
  return true;
}

export function caughtToday(mons, today) {
  return (mons || []).find(m => m.encounter === today) || null;
}

// Where today's battle stands: { hp, damage, left, cleared }.
export function battleState(tasks, today) {
  const list = (tasks || []).filter(t => t.date === today);
  const damage = list.filter(t => t.done).length;
  return { hp: list.length, damage, left: list.length - damage, cleared: list.length > 0 && damage === list.length };
}

// Catch today's wild Pokémon if the list is cleared and it hasn't been caught yet. It joins the
// party when there's room, otherwise the box. Returns { mon, toParty } or null; changes `user`.
export function catchWild(user, tasks, today, now = Date.now()) {
  const enc = user.encounter;
  if (!enc || enc.date !== today || caughtToday(user.mons, today) || !battleState(tasks, today).cleared) return null;
  const done = (tasks || []).filter(t => t.date === today && t.done);
  const titles = done.slice(0, 3).map(t => t.title).join(', ') + (done.length > 3 ? ', …' : '');
  const mon = {
    ...makeMon({
      species: enc.species, xp: xpForLevel(wildLevel(enc.species)), caughtOn: today,
      note: `Cleared ${done.length} quest${done.length === 1 ? '' : 's'}: ${titles}`,
    }, now),
    encounter: today,
    biome: enc.biome,
  };
  user.mons = [...(user.mons || []), mon];
  const toParty = (user.party || []).length < PARTY_SIZE;
  if (toParty) user.party = [...(user.party || []), mon.id];
  return { mon, toParty };
}

