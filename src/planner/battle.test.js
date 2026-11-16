import { describe, expect, it } from 'vitest';
import { ballFor, battleState, bonusState, catchBonus, catchWild, caughtToday, ensureBonus, ensureEncounter, MAX_BONUS, pickWild, rarityOf, wildLevel } from './battle.js';
import { awardXP, ensureTeam, levelFor, PARTY_SIZE } from './team.js';
import { mergeSaves } from './merge.js';

const today = '2026-11-16';
const quest = (id, done, date = today) => ({ id, title: id, date, done });
const pool = [16, 19, 41, 129, 145];

describe('picking the wild Pokémon', () => {
  it('is the same for the same day and trainer', () => {
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
  it('picks a random one once a day, whatever the biome', () => {
    const user = { email: 'a@b.c' };
    expect(ensureEncounter(user, today, pool, 'meadow')).toBe(true);
    const first = user.encounter;
    expect(first).toMatchObject({ date: today, biome: 'meadow', bonuses: [] });
    expect(pool).toContain(first.species);
    expect(ensureEncounter(user, today, [129], 'river')).toBe(false);
    expect(user.encounter).toBe(first);
    expect(ensureEncounter(user, '2026-11-17', [129], 'river')).toBe(true);
    expect(user.encounter.species).toBe(129);
  });
  it('gives the same Pokémon on every device', () => {
    const phone = { email: 'a@b.c' }, laptop = { email: 'a@b.c' };
    ensureEncounter(phone, today, pool, 'meadow');
    ensureEncounter(laptop, today, pool, 'volcano');
    expect(phone.encounter.species).toBe(laptop.encounter.species);
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

describe('ballFor', () => {
  it('picks fancier balls for rarer and stronger Pokémon', () => {
    expect(ballFor(16)).toBe('poke'); // Pidgey
    expect(ballFor(17)).toBe('great'); // Pidgeotto, met at 18
    expect(ballFor(130)).toBe('great'); // Gyarados, uncommon
    expect(ballFor(18)).toBe('ultra'); // Pidgeot, met at 36
    expect(ballFor(149)).toBe('ultra'); // Dragonite, rare
    expect(ballFor(145)).toBe('master'); // Zapdos, legendary
  });
  it('is remembered on the caught Pokémon', () => {
    const user = { mons: [], party: [], encounter: { date: today, species: 145, biome: 'storm' } };
    expect(catchWild(user, [quest('a', true)], today).mon.ball).toBe('master');
  });
});

describe('bonus catches', () => {
  const done = (id, doneAt) => ({ id, title: id, date: today, done: true, doneAt });
  const open = id => ({ id, title: id, date: today, done: false });
  const caughtDay = () => {
    const user = { email: 'a@b.c', mons: [], party: [], encounter: { date: today, species: 16, biome: 'meadow' } };
    const list = [done('a', 10), done('b', 20)];
    catchWild(user, list, today, 100);
    return { user, list };
  };

  it('only start after the daily catch', () => {
    expect(bonusState([done('a', 10), open('b')], [], today)).toBeNull();
    const { user, list } = caughtDay();
    expect(bonusState(list, user.mons, today)).toEqual({ index: 0, hits: 0, left: 3, earned: 0, caught: 0, pending: 0, done: false });
  });

  it('count quests finished after the daily catch, three per catch', () => {
    const { user, list } = caughtDay();
    ensureBonus(user, today, 0, [129], 'river');
    const more = [...list, done('c', 150), done('d', 160), open('e')];
    expect(bonusState(more, user.mons, today)).toMatchObject({ index: 0, hits: 2, left: 1, pending: 0 });
    expect(catchBonus(user, more, today, 200)).toBeNull();
    more.push(done('f', 170));
    expect(bonusState(more, user.mons, today)).toMatchObject({ index: 1, hits: 0, earned: 1, pending: 1 });
    const got = catchBonus(user, more, today, 200);
    expect(got).toMatchObject({ number: 1, toParty: true });
    expect(got.mon).toMatchObject({ species: 129, bonus: 1, encounter: today, biome: 'river' });
    expect(user.dex[129]).toBe(today);
    expect(bonusState(more, user.mons, today)).toMatchObject({ caught: 1, pending: 0 });
    expect(caughtToday(user.mons, today).species).toBe(16);
  });

  it('keep counting while the daily catch earns Exp. Share XP', () => {
    const { user, list } = caughtDay();
    // Each finished quest gives the party XP, which updates the daily catch; that must not reset progress.
    user.mons = awardXP(user.mons, user.party, 25, 155).mons;
    const more = [...list, done('c', 150), done('d', 160)];
    expect(bonusState(more, user.mons, today)).toMatchObject({ hits: 2 });
  });

  it('work for a daily catch made before bonus catches existed', () => {
    const user = { pokemon: 'pikachu', xp: 0, mons: [{ id: 'old', species: 16, xp: 400, encounter: today, updatedAt: 5 }], party: ['old'] };
    expect(bonusState([done('c', 900)], user.mons, today).hits).toBe(0); // no catch time yet: nothing counts
    ensureTeam(user, 1000); // gives it a catch time on load
    const later = [done('c', 900), done('d', 1100), done('e', 1200), done('f', 1300)];
    expect(bonusState(later, user.mons, today)).toMatchObject({ earned: 1, pending: 1 });
  });

  it('stop at the daily limit', () => {
    const { user, list } = caughtDay();
    const lots = [...list, ...Array.from({ length: 20 }, (_, i) => done('x' + i, 300 + i))];
    expect(bonusState(lots, user.mons, today)).toMatchObject({ earned: MAX_BONUS, done: true, pending: MAX_BONUS });
    for (let i = 0; i < MAX_BONUS; i++) { ensureBonus(user, today, i, pool); expect(catchBonus(user, lots, today, 400 + i)).toBeTruthy(); }
    expect(catchBonus(user, lots, today, 500)).toBeNull();
    expect(user.mons.filter(m => m.bonus).map(m => m.bonus)).toEqual([1, 2, 3]);
  });

  it('keep the bonus Pokémon once picked', () => {
    const { user } = caughtDay();
    ensureBonus(user, today, 0, [19]);
    expect(ensureBonus(user, today, 0, [129])).toBe(false);
    expect(user.encounter.bonuses[0].species).toBe(19);
  });

  it('avoid Pokémon already met today when there are others', () => {
    const user = { email: 'a@b.c', mons: [], party: [], encounter: { date: today, species: 16, biome: 'meadow', bonuses: [] } };
    for (let i = 0; i < 3; i++) ensureBonus(user, today, i, [16, 19, 21, 43]);
    expect(new Set([16, ...user.encounter.bonuses.map(b => b.species)]).size).toBe(4);
    const only = { ...user, encounter: { date: today, species: 16, biome: 'x', bonuses: [] } };
    ensureBonus(only, today, 0, [16]);
    expect(only.encounter.bonuses[0].species).toBe(16);
  });
});
