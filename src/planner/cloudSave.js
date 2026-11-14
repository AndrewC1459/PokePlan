// Reading and writing a trainer's cloud save without overwriting another device's newer copy.
// `client` is a Supabase client; each save row is { user_id, data, updated_at } (see supabase/schema.sql).

const TABLE = 'planner_saves';

export function sameStamp(a, b) {
  if (!a || !b) return false;
  return new Date(a).getTime() === new Date(b).getTime();
}

export async function fetchSave(client, userId) {
  const { data, error } = await client.from(TABLE).select('data, updated_at').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return data; // { data, updated_at } or null
}

// Write `record` only if the cloud copy is still the one we last saw (`stamp`).
// Resolves to { stamp } when saved, or { conflict: { data, updated_at } } when another device
// saved in between; the caller merges and tries again.
export async function pushSave(client, userId, record, stamp, now = new Date()) {
  const updated_at = now.toISOString();
  if (stamp) {
    const { data, error } = await client.from(TABLE)
      .update({ data: record, updated_at })
      .eq('user_id', userId)
      .eq('updated_at', stamp)
      .select('updated_at');
    if (error) throw error;
    if (data?.length) return { stamp: data[0].updated_at };
  }
  const remote = await fetchSave(client, userId);
  if (remote) return { conflict: remote };
  const { data, error } = await client.from(TABLE).insert({ user_id: userId, data: record, updated_at }).select('updated_at');
  if (error) throw error;
  return { stamp: data[0].updated_at };
}
