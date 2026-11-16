// Wild battles. Each day one random wild Pokémon appears, from any biome. Its HP is the number of
// quests on today's list, and each finished quest is a hit, so the battle is always worked out from
// the list itself: adding a quest adds HP, and deleting one takes it away. Clearing the whole list
// knocks it out and catches it. If the day ends first it simply runs off; nothing is lost.
//
// Bonus catches: once the daily Pokémon is caught, a bonus wild Pokémon appears with BONUS_HP HP.
// Every quest finished after the daily catch is a hit, so every BONUS_HP more quests catches one,
// up to MAX_BONUS a day.
// Pure functions: no DOM, no storage.
//
// user.encounter = { date, species, biome, bonuses: [{ species, biome }] } is the day's wild Pokémon
// and the bonus ones met so far (`biome` is just where you were when it appeared). Whether they were
// caught is read from the team (mons with `encounter: date`, and `bonus: n` for the nth bonus), so
// two devices can't both catch the same one.

import { SPECIES } from './species.js';
import { makeMon, PARTY_SIZE, recordDex, xpForLevel } from './team.js';

export const BONUS_HP = 3;
export const MAX_BONUS = 3;

// Legendaries and strong or special Pokémon turn up less often.
export const RARITY = {
  144: 0.08, 145: 0.08, 146: 0.08, 379: 0.08, // legendaries
  149: 0.25, 142: 0.3, 373: 0.25, 130: 0.4, 6: 0.3, 131: 0.3, 113: 0.3, 374: 0.3, 447: 0.4, 214: 0.5,
};
export const rarityOf = id => RARITY[id] ?? 1;

// Small, stable string hash (FNV-1a), so the same day always gives the same Pokémon.
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

// Which ball the catch uses, by how special the Pokémon is: legendaries get a Master Ball, rare ones or
// strong final stages an Ultra Ball, uncommon or evolved ones a Great Ball, everyone else a Poké Ball.
export const BALLS = { poke: 'Poké Ball', great: 'Great Ball', ultra: 'Ultra Ball', master: 'Master Ball' };
export function ballFor(species) {
  const rarity = rarityOf(species), level = wildLevel(species);
  if (rarity <= 0.1) return 'master';
  if (rarity <= 0.3 || level >= 36) return 'ultra';
  if (rarity < 1 || level >= 18) return 'great';
  return 'poke';
}

// Seeded by the day and trainer, so every device picks the same Pokémon and it can't be rerolled.
const seedFor = (user, today, extra = '') => `${today}|${user.email || user.name || ''}${extra}`;

// Today's wild Pokémon: a random one from `pool` (every wild species), chosen once per day.
export function ensureEncounter(user, today, pool, biome = '') {
  if (user.encounter?.date === today) return false;
  const species = pickWild(pool || [], seedFor(user, today));
  if (!species) return false;
  user.encounter = { date: today, species, biome, bonuses: [] };
  return true;
}

// The day's main catch (bonus catches don't count here).
export function caughtToday(mons, today) {
  return (mons || []).find(m => m.encounter === today && !m.bonus) || null;
}

// Where today's main battle stands: { hp, damage, left, cleared }.
export function battleState(tasks, today) {
  const list = (tasks || []).filter(t => t.date === today);
  const damage = list.filter(t => t.done).length;
  return { hp: list.length, damage, left: list.length - damage, cleared: list.length > 0 && damage === list.length };
}

// Bonus battles after the daily catch. Returns null before it, otherwise
// { index, hits, left, earned, caught, pending, done } where `index` is the bonus being fought (0-based),
// `earned` how many have been knocked out today, `pending` how many of those still need catching,
// and `done` true once all MAX_BONUS are earned.
// Only quests finished after the daily catch count. A daily catch without a catch time (from before
// bonus catches existed) gets one from ensureTeam, so it starts counting from then.
export function bonusState(tasks, mons, today) {
  const daily = caughtToday(mons, today);
  if (!daily) return null;
  const since = Number(daily.caughtAt) || Infinity;
  const progress = (tasks || []).filter(t => t.date === today && t.done && (Number(t.doneAt) || 0) > since).length;
  const earned = Math.min(MAX_BONUS, Math.floor(progress / BONUS_HP));
  const caught = (mons || []).filter(m => m.encounter === today && m.bonus).length;
  const done = earned >= MAX_BONUS;
  const hits = done ? BONUS_HP : progress - earned * BONUS_HP;
  return { index: Math.min(earned, MAX_BONUS - 1), hits, left: BONUS_HP - hits, earned, caught, pending: Math.max(0, earned - caught), done };
}

// The bonus Pokémon for slot `index`, picked at random when it first appears. It prefers species not
// met yet today, so bonus catches add variety.
export function ensureBonus(user, today, index, pool, biome = '') {
  const enc = user.encounter;
  if (enc?.date !== today || index >= MAX_BONUS || enc.bonuses?.[index]) return false;
  const bonuses = [...(enc.bonuses || [])];
  const met = new Set([enc.species, ...bonuses.filter(Boolean).map(b => b.species)]);
  const fresh = (pool || []).filter(id => !met.has(id));
  const species = pickWild(fresh.length ? fresh : pool || [], seedFor(user, today, `|bonus${index}`));
  if (!species) return false;
  bonuses[index] = { species, biome };
  user.encounter = { ...enc, bonuses };
  return true;
}

function addCatch(user, species, biome, today, note, now, extra = {}) {
  const mon = {
    ...makeMon({ species, xp: xpForLevel(wildLevel(species)), caughtOn: today, note }, now),
    encounter: today, biome, ball: ballFor(species), caughtAt: now, ...extra,
  };
  user.mons = [...(user.mons || []), mon];
  recordDex(user, species, today);
  const toParty = (user.party || []).length < PARTY_SIZE;
  if (toParty) user.party = [...(user.party || []), mon.id];
  return { mon, toParty };
}

// Catch today's wild Pokémon if the list is cleared and it hasn't been caught yet. It joins the
// party when there's room, otherwise the box. Returns { mon, toParty } or null; changes `user`.
export function catchWild(user, tasks, today, now = Date.now()) {
  const enc = user.encounter;
  if (!enc || enc.date !== today || caughtToday(user.mons, today) || !battleState(tasks, today).cleared) return null;
  const done = (tasks || []).filter(t => t.date === today && t.done);
  const titles = done.slice(0, 3).map(t => t.title).join(', ') + (done.length > 3 ? ', …' : '');
  return addCatch(user, enc.species, enc.biome, today, `Cleared ${done.length} quest${done.length === 1 ? '' : 's'}: ${titles}`, now);
}

// Catch the next knocked-out bonus Pokémon, if any. Returns { mon, toParty, number } or null.
export function catchBonus(user, tasks, today, now = Date.now()) {
  const state = bonusState(tasks, user.mons, today);
  if (!state?.pending) return null;
  const number = state.caught + 1, slot = user.encounter?.bonuses?.[number - 1];
  if (user.encounter?.date !== today || !slot) return null;
  const got = addCatch(user, slot.species, slot.biome, today, `Bonus catch #${number}: ${BONUS_HP} more quests after clearing the list`, now, { bonus: number });
  return { ...got, number };
}
