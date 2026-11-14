import { describe, expect, it } from 'vitest';
import { addDays, dayHasQuests, dueReminders, fillRoutineDay, occursOn, rollover, routineTaskId, sortForDay, taskMinutes, TOMBSTONE_DAYS } from './schedule.js';

const routine = (repeat, start = '2026-11-02', extra = {}) => ({
  id: 'r1', title: 'Stretch', category: 'Health', allDay: true, time: '', repeat, start, skip: [], ...extra,
});

describe('addDays', () => {
  it('crosses month and year boundaries', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
  it('is not thrown off by daylight saving changes', () => {
    expect(addDays('2026-03-07', 1)).toBe('2026-03-08');
    expect(addDays('2026-03-08', 1)).toBe('2026-03-09');
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-11-01', 1)).toBe('2026-11-02');
  });
});

describe('occursOn', () => {
  // 2026-11-02 is a Monday.
  it('daily repeats every day from the start date', () => {
    const r = routine('daily');
    expect(occursOn(r, '2026-11-01')).toBe(false);
    expect(occursOn(r, '2026-11-02')).toBe(true);
    expect(occursOn(r, '2027-04-19')).toBe(true);
  });
  it('weekdays skips Saturday and Sunday', () => {
    const r = routine('weekdays');
    expect(occursOn(r, '2026-11-06')).toBe(true); // Fri
    expect(occursOn(r, '2026-11-07')).toBe(false); // Sat
    expect(occursOn(r, '2026-11-08')).toBe(false); // Sun
    expect(occursOn(r, '2026-11-09')).toBe(true); // Mon
  });
  it('weekly keeps the starting weekday', () => {
    const r = routine('weekly');
    expect(occursOn(r, '2026-11-09')).toBe(true);
    expect(occursOn(r, '2026-11-10')).toBe(false);
  });
  it('monthly on the 31st lands on the last day of short months', () => {
    const r = routine('monthly', '2026-01-31');
    expect(occursOn(r, '2026-02-28')).toBe(true);
    expect(occursOn(r, '2026-02-27')).toBe(false);
    expect(occursOn(r, '2026-04-30')).toBe(true);
    expect(occursOn(r, '2026-05-31')).toBe(true);
    expect(occursOn(r, '2026-05-30')).toBe(false);
  });
  it('honours skipped days and unknown repeat values', () => {
    expect(occursOn(routine('daily', '2026-11-02', { skip: ['2026-11-04'] }), '2026-11-04')).toBe(false);
    expect(occursOn(routine('hourly'), '2026-11-04')).toBe(false);
  });
});

describe('fillRoutineDay', () => {
  const r = routine('daily');
  it('adds one copy per day and never duplicates it', () => {
    const first = fillRoutineDay([], [r], '2026-11-13', '2026-11-13', {}, 5);
    expect(first.added).toBe(1);
    expect(first.tasks[0]).toMatchObject({ id: 'r1@2026-11-13', routineId: 'r1', date: '2026-11-13', done: false, updatedAt: 5 });
    const again = fillRoutineDay(first.tasks, [r], '2026-11-13', '2026-11-13');
    expect(again.added).toBe(0);
    expect(again.tasks).toBe(first.tasks);
  });
  it('does not fill in past days', () => {
    expect(fillRoutineDay([], [r], '2026-11-12', '2026-11-13').added).toBe(0);
  });
  it('respects a deleted copy', () => {
    const deleted = { [routineTaskId(r, '2026-11-14')]: 1 };
    expect(fillRoutineDay([], [r], '2026-11-14', '2026-11-13', deleted).added).toBe(0);
  });
});

describe('rollover', () => {
  const today = '2026-11-13';
  const now = Date.UTC(2026, 10, 13);

  it('removes finished past quests and carries unfinished one-offs to today', () => {
    const out = rollover({
      tasks: [
        { id: 'a', date: '2026-11-11', done: true },
        { id: 'b', date: '2026-11-11', done: false },
        { id: 'c', date: '2026-11-13', done: false },
        { id: 'd', date: '2026-11-20', done: false },
      ],
    }, today, now);
    expect(out.changed).toBe(true);
    expect(out.tasks.map(t => t.id)).toEqual(['b', 'c', 'd']);
    expect(out.tasks[0]).toMatchObject({ date: today, carriedFrom: '2026-11-11' });
  });

  it('keeps the original carried-from date across several days', () => {
    const out = rollover({ tasks: [{ id: 'b', date: '2026-11-12', carriedFrom: '2026-11-10', done: false }] }, today, now);
    expect(out.tasks[0].carriedFrom).toBe('2026-11-10');
  });

  it('drops missed repeating quests instead of piling them up, and adds today’s copy', () => {
    const r = routine('daily');
    const out = rollover({ tasks: [{ id: 'r1@2026-11-12', routineId: 'r1', date: '2026-11-12', done: false }], routines: [r] }, today, now);
    expect(out.tasks.map(t => t.id)).toEqual(['r1@2026-11-13']);
  });

  it('gives undated quests today’s date', () => {
    const out = rollover({ tasks: [{ id: 'x', done: false }] }, today, now);
    expect(out.tasks[0].date).toBe(today);
    expect(out.changed).toBe(true);
  });

  it('prunes old skip dates and old tombstones', () => {
    const r = routine('daily', '2026-11-01', { skip: ['2026-11-10', '2026-11-20'] });
    const old = now - (TOMBSTONE_DAYS + 1) * 86400000;
    const out = rollover({ tasks: [], routines: [r], deleted: { gone: old, recent: now - 1000 } }, today, now);
    expect(out.routines[0].skip).toEqual(['2026-11-20']);
    expect(out.deleted).toEqual({ recent: now - 1000 });
  });

  it('reports no change when there is nothing to do', () => {
    const out = rollover({ tasks: [{ id: 'c', date: today, done: false }] }, today, now);
    expect(out.changed).toBe(false);
  });
});

describe('taskMinutes / sortForDay', () => {
  it('reads 24-hour and older 12-hour times', () => {
    expect(taskMinutes({ time: '09:30' })).toBe(570);
    expect(taskMinutes({ time: '9:30 AM' })).toBe(570);
    expect(taskMinutes({ time: '12:15 AM' })).toBe(15);
    expect(taskMinutes({ time: '12:15 PM' })).toBe(735);
    expect(taskMinutes({ time: '4:00 PM' })).toBe(960);
    expect(taskMinutes({ allDay: true, time: '09:00' })).toBeNull();
    expect(taskMinutes({ time: '' })).toBeNull();
    expect(taskMinutes({ time: 'soon' })).toBeNull();
  });
  it('puts all-day quests first, then timed ones by time, keeping ties in order', () => {
    const list = [
      { id: 'late', time: '18:00' }, { id: 'any1', allDay: true }, { id: 'early', time: '07:15' },
      { id: 'any2', time: '' }, { id: 'early2', time: '7:15 AM' },
    ];
    expect(sortForDay(list).map(t => t.id)).toEqual(['any1', 'any2', 'early', 'early2', 'late']);
  });
});

describe('dueReminders', () => {
  const today = '2026-11-13';
  const quest = (id, time, extra = {}) => ({ id, title: id, date: today, time, done: false, ...extra });
  const tasks = [quest('gym', '18:00'), quest('call', '09:00', { done: true }), quest('walk', ''), quest('tmrw', '18:00', { date: '2026-11-14' })];

  it('reminds `lead` minutes before open timed quests today', () => {
    expect(dueReminders(tasks, { lead: 10 }, today, 17 * 60 + 49)).toEqual([]);
    const due = dueReminders(tasks, { lead: 10 }, today, 17 * 60 + 50);
    expect(due.map(d => d.task.id)).toEqual(['gym']);
    expect(due[0].key).toBe(`quest:gym@${today}@1080`);
  });
  it('still reminds a little late, but not long after', () => {
    expect(dueReminders(tasks, { lead: 0 }, today, 18 * 60 + 10)).toHaveLength(1);
    expect(dueReminders(tasks, { lead: 0 }, today, 18 * 60 + 11)).toHaveLength(0);
  });
  it('does not repeat a reminder already sent, unless the time changed', () => {
    const sent = { [`quest:gym@${today}@1080`]: 1 };
    expect(dueReminders(tasks, { lead: 0 }, today, 18 * 60, sent)).toHaveLength(0);
    expect(dueReminders([quest('gym', '18:30')], { lead: 0 }, today, 18 * 60 + 30, sent)).toHaveLength(1);
  });
  it('sends nothing when reminders are off', () => {
    expect(dueReminders(tasks, { lead: null, nudge: null }, today, 18 * 60)).toEqual([]);
    expect(dueReminders(tasks, {}, today, 18 * 60)).toEqual([]);
  });
  it('sends one evening check-in while quests are left', () => {
    const due = dueReminders(tasks, { lead: null, nudge: '20:00' }, today, 20 * 60 + 5);
    expect(due).toEqual([{ key: `nudge:${today}`, kind: 'nudge', count: 2 }]);
    expect(dueReminders(tasks, { nudge: '20:00' }, today, 20 * 60 + 5, { [`nudge:${today}`]: 1 })).toEqual([]);
    expect(dueReminders(tasks, { nudge: '20:00' }, today, 19 * 60 + 59)).toEqual([]);
    expect(dueReminders([quest('a', '', { done: true })], { nudge: '20:00' }, today, 20 * 60)).toEqual([]);
  });
});

describe('dayHasQuests', () => {
  it('counts real quests and future repeats, but not past repeats', () => {
    const r = routine('weekly');
    expect(dayHasQuests([{ id: 'a', date: '2026-11-10' }], [], '2026-11-10', '2026-11-13')).toBe(true);
    expect(dayHasQuests([], [r], '2026-11-16', '2026-11-13')).toBe(true);
    expect(dayHasQuests([], [r], '2026-11-09', '2026-11-13')).toBe(false);
  });
});
