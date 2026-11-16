import { describe, expect, it } from 'vitest';
import { SPECIES } from './species.js';
import {
  awardXP, biomesFor, bringToParty, currentBiome, ensureTeam, evolutionFor, evolveFully, isSameOrLaterStage, leadOf, levelFor,
  makeMon, monName, moveFor, PARTY_SIZE, sendToBox, setLead, STARTER_ID, swapIn, syncStarter, xpForLevel,
} from './team.js';
import { mergeSaves } from './merge.js';

const now = new Date(2026, 10, 16, 12).getTime();

describe('species data', () => {
  it('covers every evolution it points to, with later stages at higher levels', () => {
    const reachedAt = {};
    for (const s of Object.values(SPECIES)) if (s.evolvesTo) reachedAt[s.evolvesTo] = s.evolveLevel;
    for (const [id, s] of Object.entries(SPECIES)) {
      expect(s.types.length).toBeGreaterThan(0);
      if (!s.evolvesTo) continue;
      expect(SPECIES[s.evolvesTo], `${s.name} evolves into a known species`).toBeTruthy();
      expect(s.evolveLevel, `${s.name} evolves after it was reached`).toBeGreaterThan(reachedAt[id] || 0);
    }
  });
});

describe('levels', () => {
  it('match the partner card: 100 XP a level, starting at 1', () => {
    expect([0, 99, 100, 250, -5].map(levelFor)).toEqual([1, 1, 2, 3, 1]);
    expect(xpForLevel(16)).toBe(1500);
    expect(levelFor(xpForLevel(16))).toBe(16);
  });
});

describe('upgrading an older save', () => {
  const old = () => ({ pokemon: 'charizard', form: 'charmeleon', xp: 1650, nickname: 'Blaze' });

  it('turns the single partner into a team of one, leading the party', () => {
    const user = old();
    expect(ensureTeam(user, now)).toBe(true);
    expect(user.mons).toEqual([{ id: STARTER_ID, starter: true, species: 5, xp: 1650, nickname: 'Blaze', caughtOn: '2026-11-16', updatedAt: now }]);
    expect(user.party).toEqual([STARTER_ID]);
    expect(ensureTeam(user, now + 1)).toBe(false);
  });

  it('keeps the starter in step with the partner card', () => {
    const user = old();
    ensureTeam(user, now);
    user.form = 'charizard'; user.xp = 3600; delete user.nickname;
    expect(syncStarter(user, now + 5)).toBe(true);
    expect(user.mons[0]).toMatchObject({ species: 6, xp: 3600, updatedAt: now + 5 });
    expect(user.mons[0].nickname).toBeUndefined();
  });

  it('uses the base form when the save has no form yet', () => {
    const user = { pokemon: 'pikachu', xp: 0 };
    ensureTeam(user, now);
    expect(user.mons[0].species).toBe(25);
  });

  it('cleans up a party that lists missing, repeated, or too many mons', () => {
    const user = old();
    ensureTeam(user, now);
    const extra = Array.from({ length: 7 }, (_, i) => ({ ...makeMon({ species: 16 }, now), id: 'm' + i }));
    user.mons.push(...extra);
    user.party = ['ghost', 'm0', 'm0', ...extra.map(m => m.id)];
    ensureTeam(user, now);
    expect(user.party).toEqual(['m0', 'm1', 'm2', 'm3', 'm4', 'm5']);
    expect(user.party.length).toBe(PARTY_SIZE);
    user.party = [];
    ensureTeam(user, now);
    expect(user.party).toEqual([STARTER_ID]);
  });
});

describe('Exp. Share', () => {
  const mons = [
    { id: 'lead', species: 16, xp: 90 },
    { id: 'bench', species: 129, xp: 0 },
    { id: 'boxed', species: 41, xp: 0 },
  ];
  it('gives the lead full XP, the rest of the party half, and the box nothing', () => {
    const { mons: after, gains } = awardXP(mons, ['lead', 'bench'], 25, now);
    expect(after.map(m => m.xp)).toEqual([115, 13, 0]);
    expect(after[2]).toBe(mons[2]);
    expect(gains).toEqual([
      { id: 'lead', xp: 25, fromLevel: 1, toLevel: 2, evolvesTo: null },
      { id: 'bench', xp: 13, fromLevel: 1, toLevel: 1, evolvesTo: null },
    ]);
    expect(mons[0].xp).toBe(90);
  });
  it('reports an evolution once the level is reached', () => {
    const karp = { id: 'k', species: 129, xp: xpForLevel(20) - 10 };
    expect(awardXP([karp], ['k'], 25, now).gains[0]).toMatchObject({ toLevel: 20, evolvesTo: 130 });
  });
});

describe('evolution', () => {
  it('follows level-up evolutions, and set levels for stone/trade ones', () => {
    expect(evolutionFor({ species: 16, xp: xpForLevel(18) })).toBe(17);
    expect(evolutionFor({ species: 16, xp: xpForLevel(17) })).toBeNull();
    expect(evolutionFor({ species: 95, xp: xpForLevel(37) })).toBe(208);
    expect(evolutionFor({ species: 130, xp: xpForLevel(99) })).toBeNull();
  });
  it('leaves starters to their own evolution scenes', () => {
    expect(evolutionFor({ species: 4, starter: true, xp: xpForLevel(40) })).toBeNull();
  });
  it('knows which stage comes later', () => {
    expect(isSameOrLaterStage(16, 18)).toBe(true);
    expect(isSameOrLaterStage(18, 16)).toBe(false);
    expect(isSameOrLaterStage(16, 16)).toBe(true);
  });
  it('names a mon by nickname, then species', () => {
    expect(monName({ species: 25 })).toBe('Pikachu');
    expect(monName({ species: 25, nickname: 'Sparky' })).toBe('Sparky');
  });
});

describe('merging Pokémon from two devices', () => {
  it('keeps catches from both, the most XP, and the later evolution', () => {
    const local = { mons: [{ id: 'a', species: 16, xp: 2000, updatedAt: 9 }, { id: 'phone', species: 41, xp: 0, updatedAt: 3 }] };
    const remote = { mons: [{ id: 'a', species: 17, xp: 1700, updatedAt: 5 }, { id: 'laptop', species: 129, xp: 0, updatedAt: 4 }] };
    const merged = mergeSaves(local, remote).mons;
    expect(merged.map(m => m.id)).toEqual(['a', 'phone', 'laptop']);
    expect(merged[0]).toMatchObject({ species: 17, xp: 2000 });
  });
  it('two devices upgrading the same old save end up with one starter', () => {
    const a = { pokemon: 'gengar', xp: 300 }, b = { pokemon: 'gengar', xp: 300 };
    ensureTeam(a, now); ensureTeam(b, now + 50);
    expect(mergeSaves(a, b).mons.filter(m => m.starter)).toHaveLength(1);
  });
});

describe('biomes from the lead', () => {
  it('follows the lead’s types, and starters keep their old biomes too', () => {
    expect(biomesFor({ species: 6 })).toEqual(['volcano', 'cave', 'sky']); // Charizard: fire / flying
    expect(biomesFor({ species: 129 })).toEqual(['river', 'beach']);
    expect(biomesFor({ species: 25, starter: true }, 'pikachu')).toEqual(['meadow', 'forest', 'river', 'beach', 'storm']);
  });
  it('keeps the saved biome only if the lead can be there', () => {
    const user = { pokemon: 'pikachu', mons: [{ id: 'k', species: 129 }, { id: STARTER_ID, starter: true, species: 25 }], party: ['k', STARTER_ID], biome: 'beach' };
    expect(leadOf(user).id).toBe('k');
    expect(currentBiome(user)).toBe('beach');
    user.biome = 'storm';
    expect(currentBiome(user)).toBe('river');
  });
});

describe('moves', () => {
  it('grow stronger at levels 20 and 40', () => {
    expect(moveFor({ species: 129, xp: 0 })).toBe('WATER GUN!');
    expect(moveFor({ species: 129, xp: xpForLevel(20) })).toBe('BUBBLE BEAM!');
    expect(moveFor({ species: 41, xp: xpForLevel(45) })).toBe('GUNK SHOT!');
  });
});

describe('party edits', () => {
  const party = ['a', 'b', 'c'];
  it('moves the lead to the front', () => {
    expect(setLead(party, 'c')).toEqual(['c', 'a', 'b']);
    expect(setLead(party, 'z')).toBe(party);
  });
  it('never empties the party or overfills it', () => {
    expect(sendToBox(party, 'b')).toEqual(['a', 'c']);
    expect(sendToBox(['a'], 'a')).toEqual(['a']);
    expect(bringToParty(party, 'd')).toEqual(['a', 'b', 'c', 'd']);
    const full = ['1', '2', '3', '4', '5', '6'];
    expect(bringToParty(full, '7')).toBe(full);
    expect(swapIn(full, '3', '7')).toEqual(['1', '2', '7', '4', '5', '6']);
  });
  it('evolves as far as the level allows', () => {
    const mon = { species: 16, xp: xpForLevel(40) };
    expect(evolveFully(mon)).toEqual([16, 17, 18]);
    expect(mon.species).toBe(18);
    expect(evolveFully({ species: 16, xp: 0 })).toEqual([16]);
  });
});
