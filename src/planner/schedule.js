// Date keys, repeating quests, and the daily rollover. Pure functions: no DOM, no storage.
//
// A task looks like:
//   { id, title, category, date: 'YYYY-MM-DD', allDay, time, done, updatedAt,
//     routineId?, carriedFrom? }
// A routine (repeating quest) looks like:
//   { id, title, category, allDay, time, repeat, start: 'YYYY-MM-DD', skip: [dateKey], updatedAt }
// Routines are templates. Each day they occur on gets a real task (id `${routine.id}@${date}`),
// so finishing, XP, and the battle animation treat it like any other quest.

export const REPEATS = {
  daily: 'Every day',
  weekdays: 'Weekdays',
  weekly: 'Every week',
  monthly: 'Every month',
};

// How long a deleted item is remembered, so another device's older copy can't bring it back.
export const TOMBSTONE_DAYS = 30;

export function localDateKey(d = new Date()) {
  const x = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return x.toISOString().slice(0, 10);
}

export function dateFromKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(key, days) {
  const d = dateFromKey(key);
  d.setDate(d.getDate() + days);
  return localDateKey(d);
}

function daysInMonth(year, monthIndex) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

export function occursOn(routine, key) {
  if (!routine || !REPEATS[routine.repeat] || !routine.start || key < routine.start) return false;
  if (routine.skip?.includes(key)) return false;
  const day = dateFromKey(key);
  switch (routine.repeat) {
    case 'daily':
      return true;
    case 'weekdays':
      return day.getDay() >= 1 && day.getDay() <= 5;
    case 'weekly':
      return day.getDay() === dateFromKey(routine.start).getDay();
    case 'monthly': {
      // Day 31 repeats on the last day of shorter months.
      const want = dateFromKey(routine.start).getDate();
      return day.getDate() === Math.min(want, daysInMonth(day.getFullYear(), day.getMonth()));
    }
    default:
      return false;
  }
}

export function routineTaskId(routine, key) {
  return `${routine.id}@${key}`;
}

export function makeId(prefix = 'task') {
  const rand = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).slice(2, 10);
  return `${prefix}-${Date.now()}-${rand}`;
}

export function routineTask(routine, key, now = Date.now()) {
  return {
    id: routineTaskId(routine, key),
    routineId: routine.id,
    title: routine.title,
    category: routine.category,
    date: key,
    allDay: routine.allDay,
    time: routine.time || '',
    done: false,
    updatedAt: now,
  };
}

// Adds the routine quests that fall on `key`. Past days are never filled in, and a quest that was
// deleted on its own (tombstoned) stays deleted. Returns { tasks, added }.
export function fillRoutineDay(tasks, routines, key, today, deleted = {}, now = Date.now()) {
  if (key < today || !routines?.length) return { tasks, added: 0 };
  const have = new Set(tasks.map(t => t.id));
  const extra = [];
  for (const routine of routines) {
    const id = routineTaskId(routine, key);
    if (have.has(id) || deleted[id] || !occursOn(routine, key)) continue;
    extra.push(routineTask(routine, key, now));
  }
  return extra.length ? { tasks: [...tasks, ...extra], added: extra.length } : { tasks, added: 0 };
}

// Start-of-day cleanup:
//  - finished quests from earlier days are removed (they already paid out their XP);
//  - unfinished one-off quests move to today, marked as carried over;
//  - unfinished repeating quests from earlier days are dropped, since today has its own copy;
//  - skip dates and tombstones that can no longer matter are pruned.
export function rollover({ tasks = [], routines = [], deleted = {} }, today, now = Date.now()) {
  let changed = false;
  const kept = [];
  for (const task of tasks) {
    const date = task.date || today;
    if (!task.date) changed = true;
    if (date >= today) {
      kept.push(task.date ? task : { ...task, date });
      continue;
    }
    changed = true;
    if (task.done || task.routineId) continue;
    kept.push({ ...task, date: today, carriedFrom: task.carriedFrom || date, updatedAt: now });
  }

  const nextRoutines = routines.map(r => {
    const skip = (r.skip || []).filter(k => k >= today);
    if (skip.length === (r.skip || []).length) return r;
    changed = true;
    return { ...r, skip };
  });

  const cutoff = now - TOMBSTONE_DAYS * 86400000;
  const nextDeleted = {};
  for (const [id, at] of Object.entries(deleted)) {
    if (at >= cutoff) nextDeleted[id] = at;
    else changed = true;
  }

  const filled = fillRoutineDay(kept, nextRoutines, today, today, nextDeleted, now);
  return {
    tasks: filled.tasks,
    routines: nextRoutines,
    deleted: nextDeleted,
    changed: changed || filled.added > 0,
  };
}

// Does `key` have anything on it? Used for calendar dots; counts future repeats too.
export function dayHasQuests(tasks, routines, key, today) {
  if (tasks.some(t => t.date === key)) return true;
  return key >= today && (routines || []).some(r => occursOn(r, key));
}
