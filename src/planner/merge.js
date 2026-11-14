// Combine two copies of one trainer's save when they were edited on different devices or tabs.
//
// Quests and repeating quests merge item by item: the copy with the newer `updatedAt` wins, and an
// item deleted on either side (recorded in `deleted`, id -> time) stays deleted unless it was
// changed again after the deletion. Everything else (name, partner, biome, ...) takes the local
// copy, since that is the edit being saved right now; XP takes the larger value so no device's
// earned XP is lost.

function mergeById(localItems = [], remoteItems = [], deleted = {}) {
  const byId = new Map();
  for (const item of remoteItems) if (item?.id) byId.set(item.id, item);
  for (const item of localItems) {
    if (!item?.id) continue;
    const other = byId.get(item.id);
    if (!other || (Number(item.updatedAt) || 0) >= (Number(other.updatedAt) || 0)) byId.set(item.id, item);
  }
  // Keep local ordering first (newest quests are at the top), then anything only the remote has.
  const order = [...localItems, ...remoteItems].map(i => i?.id).filter(Boolean);
  const seen = new Set();
  const result = [];
  for (const id of order) {
    if (seen.has(id)) continue;
    seen.add(id);
    const item = byId.get(id);
    const gone = deleted[id];
    if (gone && gone >= (Number(item.updatedAt) || 0)) continue;
    result.push(item);
  }
  return result;
}

export function mergeSaves(local, remote) {
  if (!remote || typeof remote !== 'object') return local;
  if (!local || typeof local !== 'object') return remote;
  const deleted = { ...(remote.deleted || {}) };
  for (const [id, at] of Object.entries(local.deleted || {})) deleted[id] = Math.max(at, deleted[id] || 0);
  return {
    ...remote,
    ...local,
    xp: Math.max(Number(local.xp) || 0, Number(remote.xp) || 0),
    tasks: mergeById(local.tasks, remote.tasks, deleted),
    routines: mergeById(local.routines, remote.routines, deleted),
    deleted,
  };
}
