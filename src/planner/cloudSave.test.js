import { describe, expect, it } from 'vitest';
import { fetchSave, pushSave, sameStamp } from './cloudSave.js';

// A tiny stand-in for the Supabase query builder over one table, enough for cloudSave.js.
function fakeClient(rows = []) {
  const table = rows.map(r => ({ ...r }));
  const calls = [];
  function query(op, payload) {
    const filters = [];
    let columns = null;
    const matches = () => table.filter(r => filters.every(([k, v]) => (k === 'updated_at' ? sameStamp(r[k], v) : r[k] === v)));
    const pick = r => (columns ? Object.fromEntries(columns.map(c => [c, r[c]])) : r);
    const run = () => {
      calls.push(op);
      if (op === 'insert') {
        if (table.some(r => r.user_id === payload.user_id)) return { data: null, error: { code: '23505' } };
        table.push({ ...payload });
        return { data: [pick(payload)], error: null };
      }
      const hit = matches();
      if (op === 'update') hit.forEach(r => Object.assign(r, payload));
      return { data: hit.map(pick), error: null };
    };
    const builder = {
      eq(k, v) { filters.push([k, v]); return builder; },
      select(cols) { columns = cols.split(',').map(s => s.trim()); return builder; },
      maybeSingle() { const { data, error } = run(); return Promise.resolve({ data: data?.[0] ?? null, error }); },
      then(resolve, reject) { return Promise.resolve(run()).then(resolve, reject); },
    };
    return builder;
  }
  return {
    table, calls,
    from: () => ({
      select: cols => query('select').select(cols),
      update: payload => query('update', payload),
      insert: payload => query('insert', payload),
    }),
  };
}

const T1 = '2026-11-13T10:00:00.000+00:00';
const T2 = new Date('2026-11-13T10:05:00.000Z');

describe('pushSave', () => {
  it('saves over the copy it last saw', async () => {
    const client = fakeClient([{ user_id: 'u', data: { xp: 0 }, updated_at: T1 }]);
    const result = await pushSave(client, 'u', { xp: 25 }, '2026-11-13T10:00:00.000Z', T2);
    expect(result).toEqual({ stamp: T2.toISOString() });
    expect(client.table[0].data).toEqual({ xp: 25 });
  });

  it('reports a conflict instead of overwriting a newer save', async () => {
    const client = fakeClient([{ user_id: 'u', data: { xp: 50 }, updated_at: '2026-11-13T10:03:00.000Z' }]);
    const result = await pushSave(client, 'u', { xp: 25 }, T1, T2);
    expect(result.conflict).toEqual({ data: { xp: 50 }, updated_at: '2026-11-13T10:03:00.000Z' });
    expect(client.table[0].data).toEqual({ xp: 50 });
  });

  it('creates the row when there is no cloud copy yet', async () => {
    const client = fakeClient();
    const result = await pushSave(client, 'u', { xp: 0 }, null, T2);
    expect(result).toEqual({ stamp: T2.toISOString() });
    expect(client.table).toHaveLength(1);
  });

  it('treats an existing row as a conflict when we have no stamp', async () => {
    const client = fakeClient([{ user_id: 'u', data: { xp: 9 }, updated_at: T1 }]);
    const result = await pushSave(client, 'u', { xp: 0 }, null, T2);
    expect(result.conflict.data).toEqual({ xp: 9 });
    expect(client.calls).not.toContain('insert');
  });

  it('surfaces database errors', async () => {
    const client = fakeClient();
    client.from = () => ({ update: () => ({ eq() { return this; }, select: () => Promise.resolve({ data: null, error: { message: 'boom' } }) }) });
    await expect(pushSave(client, 'u', {}, T1, T2)).rejects.toEqual({ message: 'boom' });
  });
});

describe('fetchSave / sameStamp', () => {
  it('reads one row', async () => {
    const client = fakeClient([{ user_id: 'u', data: { a: 1 }, updated_at: T1 }]);
    expect(await fetchSave(client, 'u')).toEqual({ data: { a: 1 }, updated_at: T1 });
    expect(await fetchSave(client, 'nobody')).toBeNull();
  });
  it('compares timestamps across formats', () => {
    expect(sameStamp('2026-11-13T10:00:00+00:00', '2026-11-13T10:00:00.000Z')).toBe(true);
    expect(sameStamp('2026-11-13T10:00:00Z', '2026-11-13T10:00:01Z')).toBe(false);
    expect(sameStamp(null, T1)).toBe(false);
  });
});
