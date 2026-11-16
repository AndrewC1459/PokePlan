import { describe, expect, it } from 'vitest';
import { battleState, catchWild, caughtToday, ensureEncounter, pickWild, rarityOf, wildLevel } from './battle.js';
import { levelFor, PARTY_SIZE } from './team.js';
import { mergeSaves } from './merge.js';

const today = '2026-11-16';
const quest = (id, done, date = today) => ({ id, title: id, date, done });
const pool = [16, 19, 41, 129, 145];

describe('picking the wild Pokémon', () => {
  it('is the same for the same day, biome and trainer', () => {
    expect(pickWild(pool, 'a')).toBe(pickWild(pool, 'a'));
    const seen = new Set(Array.from({ length: 60 }, (_, i) => pickWild(pool, 'day' + i)));
    expect(seen.size).toBeGreaterThan(2);
  });
  it('turns up rare ones less often', () => {
    const rolls = Array.from({ length: 2000 }, (_, i) => pickWild(pool, 'r' + i));
    const zapdos = rolls.filter(id => id === 145).length, pidgey = rolls.filter(id => id === 16).length;
    expect(rarityOf(145)).toBeLessThan(1);
    expect(zapdos).toBeLessThan(pidgey / 4);
  });
  it('ignores unknown species and empty pools', () => {
    expect(pickWild([99999], 'x')).toBeNull();
    expect(pickWild([], 'x')).toBeNull();
  });
});

describe('ensureEncounter', () => {
  it('picks once a day and keeps it if the biome changes', () => {
    const user = { email: 'a@b.c' };
    expect(ensureEncounter(user, today, 'meadow', pool)).toBe(true);
    const first = user.encounter;
    expect(first).toMatchObject({ date: today, biome: 'meadow' });
    expect(ensureEncounter(user, today, 'river', [129])).toBe(false);
    expect(user.encounter).toBe(first);
    expect(ensureEncounter(user, '2026-11-17', 'river', [129])).toBe(true);
    expect(user.encounter.species).toBe(129);
  });
});

describe('battleState', () => {
  it('uses today’s quests as HP and finished ones as hits', () => {
    expect(battleState([quest('a', true), quest('b', false), quest('c', false, '2026-11-17')], today))
      .toEqual({ hp: 2, damage: 1, left: 1, cleared: false });
    expect(battleState([quest('a', true)], today).cleared).toBe(true);
    expect(battleState([], today)).toEqual({ hp: 0, damage: 0, left: 0, cleared: false });
  });
});

describe('wildLevel', () => {
  it('meets evolved Pokémon no lower than they evolve', () => {
    expect(wildLevel(16)).toBe(5);
    expect(wildLevel(17)).toBe(18);
    expect(wildLevel(130)).toBe(20);
  });
});

describe('catchWild', () => {
  const setup = () => ({ email: 'a@b.c', mons: [{ id: 'starter', species: 25, xp: 0 }], party: ['starter'], encounter: { date: today, species: 17, biome: 'meadow' } });

  it('catches only once the whole list is cleared', () => {
    const user = setup();
    expect(catchWild(user, [quest('a', true), quest('b', false)], today, 7)).toBeNull();
    const tasks = [quest('Read', true), quest('Gym', true), quest('Call', true), quest('Laundry', true)];
    const got = catchWild(user, tasks, today, 7);
    expect(got.toParty).toBe(true);
    expect(got.mon).toMatchObject({ species: 17, caughtOn: today, encounter: today, biome: 'meadow', note: 'Cleared 4 quests: Read, Gym, Call, …' });
    expect(levelFor(got.mon.xp)).toBe(18);
    expect(user.party).toEqual(['starter', got.mon.id]);
    expect(catchWild(user, tasks, today, 8)).toBeNull();
  });

  it('sends it to the box when the party is full', () => {
    const user = setup();
    user.mons = Array.from({ length: PARTY_SIZE }, (_, i) => ({ id: 'm' + i, species: 16, xp: 0 }));
    user.party = user.mons.map(m => m.id);
    const got = catchWild(user, [quest('a', true)], today);
    expect(got.toParty).toBe(false);
    expect(user.party).toHaveLength(PARTY_SIZE);
    expect(user.mons).toHaveLength(PARTY_SIZE + 1);
  });

  it('does not catch yesterday’s Pokémon or one already caught on another device', () => {
    const user = setup();
    user.encounter.date = '2026-11-15';
    expect(catchWild(user, [quest('a', true)], today)).toBeNull();

    const phone = setup(), laptop = setup();
    catchWild(phone, [quest('a', true)], today, 5);
    const merged = mergeSaves(laptop, phone);
    expect(caughtToday(merged.mons, today)).toBeTruthy();
    expect(catchWild(merged, [quest('a', true)], today, 6)).toBeNull();
  });
});
