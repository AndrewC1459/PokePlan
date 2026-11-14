import { describe, expect, it } from 'vitest';
import { mergeSaves } from './merge.js';

describe('mergeSaves', () => {
  it('keeps quests added on either device', () => {
    const local = { tasks: [{ id: 'phone', updatedAt: 2 }] };
    const remote = { tasks: [{ id: 'laptop', updatedAt: 3 }] };
    expect(mergeSaves(local, remote).tasks.map(t => t.id)).toEqual(['phone', 'laptop']);
  });

  it('takes the newer edit of the same quest', () => {
    const local = { tasks: [{ id: 'a', done: false, updatedAt: 1 }] };
    const remote = { tasks: [{ id: 'a', done: true, updatedAt: 5 }] };
    expect(mergeSaves(local, remote).tasks).toEqual([{ id: 'a', done: true, updatedAt: 5 }]);
  });

  it('does not bring back a quest deleted on the other device', () => {
    const local = { tasks: [{ id: 'a', updatedAt: 1 }, { id: 'b', updatedAt: 1 }] };
    const remote = { tasks: [{ id: 'b', updatedAt: 1 }], deleted: { a: 4 } };
    const merged = mergeSaves(local, remote);
    expect(merged.tasks.map(t => t.id)).toEqual(['b']);
    expect(merged.deleted).toEqual({ a: 4 });
  });

  it('keeps a quest restored (e.g. by undo) after it was deleted', () => {
    const local = { tasks: [{ id: 'a', updatedAt: 9 }] };
    const remote = { tasks: [], deleted: { a: 4 } };
    expect(mergeSaves(local, remote).tasks.map(t => t.id)).toEqual(['a']);
  });

  it('merges repeating quests the same way', () => {
    const local = { routines: [{ id: 'r1', updatedAt: 1 }] };
    const remote = { routines: [{ id: 'r2', updatedAt: 1 }], deleted: { r1: 2 } };
    expect(mergeSaves(local, remote).routines.map(r => r.id)).toEqual(['r2']);
  });

  it('keeps the higher XP and the local copy of other fields', () => {
    const merged = mergeSaves({ xp: 50, name: 'Ash', form: 'raichu' }, { xp: 125, name: 'Old', habitatIndex: 2 });
    expect(merged).toMatchObject({ xp: 125, name: 'Ash', form: 'raichu', habitatIndex: 2 });
  });

  it('copes with a missing side', () => {
    const save = { tasks: [] };
    expect(mergeSaves(save, null)).toBe(save);
    expect(mergeSaves(null, save)).toBe(save);
  });
});
