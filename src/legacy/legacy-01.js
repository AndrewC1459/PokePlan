// Poképlan core: accounts, quests, repeating quests, undo, the calendar, and XP.
// Loads first. Later scripts add scenery, wildlife, partner progression and polish, and rely on the
// globals defined here (user, pokemon, tasks, persist, renderTasks, renderXP, animateQuests, ...).
// Date and repeat rules live in src/planner/schedule.js (unit tested) and arrive as PlannerLogic.
const L = window.PlannerLogic;

const P = {
  pikachu: { name: 'Pikachu', move: 'THUNDERBOLT!', type: 'electric', sprite: '/sprites/gen5ani/pikachu-f.gif', biome: 'MEADOW ROUTE', note: '🌿 &nbsp; Windy grassland · wildflowers sway', colors: ['#98d5e8', '#d9edbc', '#6ba46a', '#437752'] },
  charizard: { name: 'Charizard', move: 'FLAMETHROWER!', type: 'fire', sprite: '/sprites/gen5ani/charizard.gif', biome: 'VOLCANIC SKY', note: '🌋 &nbsp; Ember peaks · ash drifts by', colors: ['#f1b27c', '#c86650', '#833e43', '#522f43'] },
  gengar: { name: 'Gengar', move: 'SHADOW BALL!', type: 'ghost', sprite: '/sprites/gen5ani/gengar.gif', biome: 'MOONLIT HOLLOW', note: '🌙 &nbsp; Haunted woods · wisps float around', colors: ['#aaa8cf', '#706f9d', '#494869', '#282940'] },
};

const $ = s => document.querySelector(s);
const storeKey = 'pokeplan.accounts.v1', sessionKey = 'pokeplan.session.v1';
const previewMode = new URLSearchParams(location.search).has('preview');
const XP_PER_QUEST = 25;

let user = null, pokemon = null, tasks = [];
let filter = 'all', view = 'week', offset = 0, selected = new Set(), starterPick = null, authMode = 'signup';
let selectedDate = L.localDateKey(), activeDay = selectedDate;

const todayKey = () => L.localDateKey();
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ---------------------------------------------------------------------------------------------
// Account storage. localStorage holds every account on this browser; with cloud saves on,
// src/cloudSync.js wraps saveAccounts/logout so the signed-in trainer's record also goes online.

function accounts() {
  try {
    const raw = JSON.parse(localStorage.getItem(storeKey) || '{}');
    if (Array.isArray(raw)) return Object.fromEntries(raw.filter(x => x && x.email).map(x => [x.email.trim().toLowerCase(), x]));
    return raw && typeof raw === 'object' ? raw : {};
  } catch {
    return {};
  }
}

function saveAccounts(all) {
  try {
    localStorage.setItem(storeKey, JSON.stringify(all));
    return true;
  } catch {
    return false;
  }
}

function accountKey(all, email) {
  return Object.keys(all).find(k => k.trim().toLowerCase() === email) || null;
}

function sessionEmail() {
  return (localStorage.getItem(sessionKey) || '').trim().toLowerCase();
}

// Save the whole in-memory trainer record. Every change (quests, XP, partner, name) goes through here.
function persist() {
  if (!user || previewMode) return true;
  user.tasks = tasks;
  user.selectedDate = selectedDate;
  const all = accounts(), key = accountKey(all, sessionEmail());
  if (!key) return false;
  all[key] = user;
  return saveAccounts(all);
}

function normalizeUser() {
  if (!Array.isArray(user.routines)) user.routines = [];
  if (!user.deleted || typeof user.deleted !== 'object') user.deleted = {};
}

function openAccount(email) {
  user = accounts()[email];
  if (!user) return;
  localStorage.setItem(sessionKey, email);
  if (!user.pokemon) {
    $('#authWrap').classList.remove('hidden');
    $('#accountPanel').classList.add('hidden');
    $('#starterPanel').classList.remove('hidden');
    return;
  }
  showApp();
}

function showApp() {
  pokemon = user.pokemon;
  tasks = Array.isArray(user.tasks) ? user.tasks : [];
  normalizeUser();
  selectedDate = todayKey();
  selected.clear();
  if (runRollover() || user.selectedDate !== selectedDate) persist();
  $('#authWrap').classList.add('hidden');
  $('#app').classList.remove('hidden');
  $('#trainerLabel').textContent = (user.name || 'TRAINER').toUpperCase();
  showDate();
  renderPokemon();
  renderTasks();
}

// Re-read the signed-in record from storage, e.g. after a newer cloud save arrives.
function reloadAccount() {
  if (!user) return;
  const fresh = accounts()[accountKey(accounts(), sessionEmail())];
  if (!fresh?.pokemon) return;
  const keepDate = selectedDate;
  user = fresh;
  hideUndo();
  showApp();
  if (keepDate >= todayKey()) {
    selectedDate = keepDate;
    showDate();
    renderTasks();
  }
}

// Cloud saves: another device saved first. Fold its copy into this one, keep this device's
// newest edits, and save the result (see src/planner/merge.js for the rules).
function mergeRemoteSave(remote) {
  if (!user) return;
  user.tasks = tasks;
  const merged = L.mergeSaves(user, remote);
  for (const key of Object.keys(merged)) user[key] = merged[key];
  tasks = user.tasks;
  normalizeUser();
  for (const id of [...selected]) if (!tasks.some(t => t.id === id)) selected.delete(id);
  const onBoard = user.pokemon && !$('#app').classList.contains('hidden');
  if (onBoard) runRollover();
  persist();
  if (!onBoard) return;
  $('#trainerLabel').textContent = (user.name || 'TRAINER').toUpperCase();
  renderPokemon();
  renderTasks();
}

function logout() {
  localStorage.removeItem(sessionKey);
  user = null;
  pokemon = null;
  tasks = [];
  selected.clear();
  hideUndo();
  $('#app').classList.add('hidden');
  $('#authWrap').classList.remove('hidden');
  $('#starterPanel').classList.add('hidden');
  $('#accountPanel').classList.remove('hidden');
  $('#accountForm').reset();
  $('#authError').textContent = '';
}

// ---------------------------------------------------------------------------------------------
// Sign-up / log-in screen (browser-only accounts; cloudSync takes over the form when it is on).

function setAuthMode(mode) {
  authMode = mode;
  document.querySelectorAll('[data-auth]').forEach(x => x.classList.toggle('active', x.dataset.auth === mode));
  $('#nameField').classList.toggle('hidden', mode === 'login');
  $('#password').autocomplete = mode === 'login' ? 'current-password' : 'new-password';
  $('#password').type = 'password';
  $('#showPassword').textContent = 'SHOW';
  $('#showPassword').setAttribute('aria-label', 'Show password');
  $('#accountSubmit').textContent = mode === 'login' ? 'LOG IN →' : 'CREATE ACCOUNT →';
  $('#authError').textContent = '';
}
document.querySelectorAll('[data-auth]').forEach(b => b.addEventListener('click', () => setAuthMode(b.dataset.auth)));

$('#showPassword').addEventListener('click', () => {
  const show = $('#password').type === 'password';
  $('#password').type = show ? 'text' : 'password';
  $('#showPassword').textContent = show ? 'HIDE' : 'SHOW';
  $('#showPassword').setAttribute('aria-label', show ? 'Hide password' : 'Show password');
});

$('#accountForm').addEventListener('submit', e => {
  e.preventDefault();
  const email = $('#email').value.trim().toLowerCase(), password = $('#password').value;
  const name = $('#trainerName').value.trim() || 'Trainer';
  const all = accounts(), key = accountKey(all, email), say = text => { $('#authError').textContent = text; };
  say('');
  if (authMode === 'signup') {
    if (key) return say('An account already exists for this email. Choose Log in.');
    all[email] = { email, name, password, pokemon: null, tasks: [], routines: [], deleted: {}, selectedDate: todayKey() };
    if (!saveAccounts(all)) return say('The browser could not save this account. Enable site storage and try again.');
    return openAccount(email);
  }
  if (!key || all[key].password !== password) return say('Email or password is incorrect. Check the spelling and try again.');
  if (key !== email) {
    all[email] = all[key];
    delete all[key];
    saveAccounts(all);
  }
  openAccount(email);
});

for (const [key, p] of Object.entries(P)) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'starter';
  b.dataset.poke = key;
  b.innerHTML = `<img src="${p.sprite}" alt=""><span>${p.name}</span>`;
  b.addEventListener('click', () => {
    starterPick = key;
    document.querySelectorAll('.starter').forEach(x => x.classList.toggle('active', x === b));
    $('#starterHint').textContent = p.name + ' will be your partner for this account.';
    $('#lockStarter').disabled = false;
  });
  $('#starterGrid').appendChild(b);
}

$('#lockStarter').addEventListener('click', () => {
  if (!starterPick || !user) return;
  user.pokemon = starterPick;
  user.tasks = [{ id: L.makeId(), title: 'Finish your first quest', category: 'Personal', date: todayKey(), allDay: true, time: '', done: false, updatedAt: Date.now() }];
  user.selectedDate = todayKey();
  tasks = user.tasks;
  if (!persist()) {
    $('#starterHint').textContent = 'Could not save. Check this browser’s storage settings.';
    return;
  }
  showApp();
});

// ---------------------------------------------------------------------------------------------
// Daily rollover and repeating quests.

// Finished quests from earlier days are cleared, unfinished ones move to today, and today's
// repeating quests are added. Returns true when anything changed.
function runRollover(day = todayKey()) {
  activeDay = day;
  const out = L.rollover({ tasks, routines: user.routines, deleted: user.deleted }, day);
  if (!out.changed) return false;
  tasks = out.tasks;
  user.routines = out.routines;
  user.deleted = out.deleted;
  for (const id of [...selected]) if (!tasks.some(t => t.id === id)) selected.delete(id);
  return true;
}

// Make sure the repeating quests for the day being viewed exist (today and future days only).
function fillSelectedDay() {
  const out = L.fillRoutineDay(tasks, user.routines, selectedDate, todayKey(), user.deleted);
  if (!out.added) return;
  tasks = out.tasks;
  persist();
}

// Check every half minute whether midnight passed while the page was open.
setInterval(() => {
  const day = todayKey();
  updateTodayLabel();
  if (!user || !user.pokemon || day === activeDay) return;
  const wasToday = selectedDate === activeDay;
  runRollover(day);
  if (wasToday || selectedDate < day) selectedDate = day;
  persist();
  showDate();
  renderTasks();
}, 30000);

// ---------------------------------------------------------------------------------------------
// Undo: the last finish/delete can be reversed from the toast or with Ctrl+Z / ⌘Z.

let undoState = null, undoTimer = 0;

function snapshot() {
  return {
    tasks: structuredClone(tasks),
    routines: structuredClone(user.routines),
    deleted: { ...user.deleted },
    xp: Number(user.xp) || 0,
  };
}

function offerUndo(message, before) {
  undoState = before;
  $('#undoMessage').textContent = message;
  $('#undoToast').hidden = false;
  clearTimeout(undoTimer);
  undoTimer = setTimeout(hideUndo, 8000);
}

function hideUndo() {
  undoState = null;
  clearTimeout(undoTimer);
  const toast = $('#undoToast');
  if (toast) toast.hidden = true;
}

function undoLast() {
  if (!undoState || !user) return;
  const before = undoState, now = Date.now();
  // Restored items count as the newest edit, so a cloud merge keeps the undo.
  const changed = (list, previous) => {
    const was = new Map(previous.map(x => [x.id, JSON.stringify(x)]));
    return list.map(x => (was.get(x.id) === JSON.stringify(x) ? x : { ...x, updatedAt: now }));
  };
  tasks = changed(before.tasks, tasks);
  user.routines = changed(before.routines, user.routines);
  user.deleted = before.deleted;
  user.xp = before.xp;
  hideUndo();
  selected.clear();
  persist();
  renderTasks();
}

$('#undoButton').addEventListener('click', undoLast);
addEventListener('keydown', e => {
  if (!undoState || e.key.toLowerCase() !== 'z' || !(e.ctrlKey || e.metaKey) || e.shiftKey || e.altKey) return;
  if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '')) return;
  e.preventDefault();
  undoLast();
});

// ---------------------------------------------------------------------------------------------
// Quest list.

function formatClock(value) {
  if (!value) return 'ALL DAY';
  if (/\b(AM|PM)\b/i.test(value)) return value; // older saves stored 12-hour text
  const [h, m] = value.split(':').map(Number), d = new Date();
  d.setHours(h, m || 0, 0, 0);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function taskRow(t) {
  const routine = t.routineId && user.routines.find(r => r.id === t.routineId);
  const when = t.allDay || (!t.time && !t.startTime) ? 'ALL DAY' : formatClock(t.time || t.startTime);
  const category = t.category || 'Personal';
  const row = document.createElement('div');
  row.className = 'task' + (selected.has(t.id) ? ' selected' : '') + (t.done ? ' done' : '');
  row.dataset.id = t.id;
  row.innerHTML = `${t.done
    ? '<span class="done-mark" aria-label="Completed">✓</span>'
    : `<input class="check" type="checkbox" aria-label="Select ${escapeHtml(t.title)}" ${selected.has(t.id) ? 'checked' : ''}>`}
    <div class="task-copy"><div class="task-title">${escapeHtml(t.title)}</div>
    <div class="task-meta"><span class="tag ${escapeHtml(category.toLowerCase())}">${escapeHtml(category)}</span>
    <span class="time-badge">${when}</span>
    ${routine ? `<span class="repeat-badge" title="Repeating quest">↻ ${escapeHtml(L.REPEATS[routine.repeat].toUpperCase())}</span>` : ''}
    ${t.carriedFrom && !t.done ? '<span class="carry-badge">CARRIED OVER</span>' : ''}</div></div>
    <div class="task-right"><span class="priority">${t.done ? 'FINISHED' : ''}</span>
    <button class="delete" type="button" title="Delete" aria-label="Delete ${escapeHtml(t.title)}">×</button></div>`;
  return row;
}

function renderTasks() {
  if (!user) return;
  fillSelectedDay();
  const day = tasks.filter(t => t.date === selectedDate);
  const active = day.filter(t => !t.done), done = day.filter(t => t.done), list = $('#taskList');
  const groups = filter === 'open' ? [['', active]] : filter === 'done' ? [['', done]] : [['TO DO', active], ['DONE', done]];
  list.innerHTML = '';
  for (const [label, items] of groups) {
    if (!items.length) continue;
    if (label) {
      const head = document.createElement('div');
      head.className = 'done-heading';
      head.textContent = label;
      list.appendChild(head);
    }
    for (const t of items) list.appendChild(taskRow(t));
  }
  if (!list.children.length) list.innerHTML = '<div class="empty">No quests for this date.<br>Add one below to get started.</div>';

  $('#taskCount').textContent = ` (${active.length})`;
  $('#bulkbar').classList.toggle('show', selected.size > 0);
  $('#selectedCount').textContent = selected.size + ' selected';
  $('#progressText').textContent = done.length + '/' + day.length;
  $('#progressBar').style.width = day.length ? (done.length / day.length) * 100 + '%' : '0%';
  $('#weekCount').textContent = String(active.length);
  renderCalendar();
  renderXP();
}

$('#taskList').addEventListener('change', e => {
  const id = e.target.closest('.check') && e.target.closest('.task')?.dataset.id;
  if (!id) return;
  selected.has(id) ? selected.delete(id) : selected.add(id);
  renderTasks();
});

$('#taskList').addEventListener('click', e => {
  const id = e.target.closest('.delete') && e.target.closest('.task')?.dataset.id;
  const task = id && tasks.find(t => t.id === id);
  if (task) deleteTask(task);
});

function removeTask(task) {
  tasks = tasks.filter(t => t.id !== task.id);
  user.deleted[task.id] = Date.now();
  selected.delete(task.id);
}

function deleteTask(task) {
  const routine = task.routineId && user.routines.find(r => r.id === task.routineId);
  if (!routine) {
    const before = snapshot();
    removeTask(task);
    persist();
    renderTasks();
    offerUndo(`Deleted “${task.title}”`, before);
    return;
  }
  showAccountDialog({
    title: 'Delete repeating quest?',
    message: `“${task.title}” repeats ${L.REPEATS[routine.repeat].toLowerCase()}.`,
    actions: [
      { label: 'JUST THIS DAY', run: () => { closeAccountDialog(); skipRoutineDay(task, routine); } },
      { label: 'STOP REPEATING', run: () => { closeAccountDialog(); stopRoutine(task, routine); } },
      { label: 'CANCEL', secondary: true, run: closeAccountDialog },
    ],
  });
}

function skipRoutineDay(task, routine) {
  const before = snapshot();
  removeTask(task);
  user.routines = user.routines.map(r => (r.id === routine.id ? { ...r, skip: [...(r.skip || []), task.date], updatedAt: Date.now() } : r));
  persist();
  renderTasks();
  offerUndo(`Skipped “${task.title}” on this day`, before);
}

// Remove the series, plus its unfinished copies from this day on. Finished copies keep their place.
function stopRoutine(task, routine) {
  const before = snapshot(), now = Date.now();
  user.routines = user.routines.filter(r => r.id !== routine.id);
  user.deleted[routine.id] = now;
  for (const t of tasks.filter(t => t.routineId === routine.id && !t.done && t.date >= task.date)) removeTask(t);
  persist();
  renderTasks();
  offerUndo(`“${task.title}” no longer repeats`, before);
}

// ---------------------------------------------------------------------------------------------
// Adding quests.

function updateTimeFields() {
  $('#taskTime').hidden = $('#scheduleMode').value === 'allDay';
}
function updateCategoryField() {
  const custom = $('#customCategory');
  custom.hidden = $('#category').value !== 'custom';
  if (!custom.hidden) custom.focus();
}
$('#scheduleMode').addEventListener('change', updateTimeFields);
$('#category').addEventListener('change', updateCategoryField);
updateTimeFields();

$('#addForm').addEventListener('submit', e => {
  e.preventDefault();
  if (!user) return;
  const input = $('#taskInput'), title = input.value.trim(), chosen = $('#category').value, custom = $('#customCategory');
  const category = chosen === 'custom' ? custom.value.trim() : chosen;
  if (!title) return;
  if (chosen === 'custom' && !category) {
    custom.setCustomValidity('Enter a custom task type.');
    custom.reportValidity();
    custom.focus();
    return;
  }
  custom.setCustomValidity('');
  const allDay = $('#scheduleMode').value === 'allDay', time = allDay ? '' : $('#taskTime').value;
  const repeat = $('#repeatMode').value, now = Date.now();

  if (L.REPEATS[repeat]) {
    // Repeating quests can't start in the past; today's or the chosen day's copy appears right away.
    const start = selectedDate < todayKey() ? todayKey() : selectedDate;
    user.routines.push({ id: L.makeId('routine'), title, category, allDay, time, repeat, start, skip: [], updatedAt: now });
    selectedDate = start;
    showDate();
  } else {
    tasks.unshift({ id: L.makeId(), title, category, done: false, date: selectedDate, allDay, time, updatedAt: now });
  }

  input.value = '';
  $('#repeatMode').value = 'none';
  if (chosen === 'custom') {
    custom.value = '';
    $('#category').value = 'Study';
    custom.hidden = true;
  }
  filter = 'all';
  document.querySelectorAll('[data-filter]').forEach(b => b.classList.toggle('active', b.dataset.filter === 'all'));
  persist();
  renderTasks();
});

document.querySelectorAll('[data-filter]').forEach(b => b.addEventListener('click', () => {
  filter = b.dataset.filter;
  document.querySelectorAll('[data-filter]').forEach(x => x.classList.toggle('active', x === b));
  renderTasks();
}));

// ---------------------------------------------------------------------------------------------
// Calendar.

function updateTodayLabel() {
  $('#todayLabel').textContent = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase();
}
updateTodayLabel();

function showDate() {
  const d = L.dateFromKey(selectedDate);
  $('#dateBadge').textContent = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).toUpperCase();
  $('#boardTitle').textContent = selectedDate === todayKey() ? "TODAY'S LIST" : 'QUEST LIST';
}

function startOfWeek(d) {
  const x = new Date(d);
  x.setDate(x.getDate() - x.getDay());
  x.setHours(0, 0, 0, 0);
  return x;
}

function renderCalendar() {
  const grid = $('#calendar');
  if (!grid || !user) return;
  const base = new Date(), today = todayKey(), short = { month: 'short', day: 'numeric' };
  if (view === 'month') { base.setDate(1); base.setMonth(base.getMonth() + offset); }
  else if (view === 'week') base.setDate(base.getDate() + offset * 7);
  else base.setDate(base.getDate() + offset);
  const y = base.getFullYear(), m = base.getMonth();
  $('#monthName').textContent = view === 'day'
    ? base.toLocaleDateString('en-US', { ...short, year: 'numeric' })
    : view === 'week'
      ? `${startOfWeek(base).toLocaleDateString('en-US', short)} – ${new Date(startOfWeek(base).getTime() + 518400000).toLocaleDateString('en-US', short)}`
      : base.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

  let dates = [base];
  if (view !== 'day') {
    const start = view === 'month' ? startOfWeek(new Date(y, m, 1)) : startOfWeek(base);
    dates = Array.from({ length: view === 'month' ? 42 : 7 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
  }
  grid.className = 'calgrid ' + (view === 'month' ? 'monthview' : view + 'view');
  grid.innerHTML = '';
  for (const d of dates) {
    const key = L.localDateKey(d), cell = document.createElement('button');
    cell.type = 'button';
    cell.className = 'day' + (view === 'month' && d.getMonth() !== m ? ' muted' : '') + (key === today ? ' today' : '')
      + (key === selectedDate ? ' picked' : '') + (L.dayHasQuests(tasks, user.routines, key, today) ? ' has' : '');
    cell.textContent = d.getDate();
    cell.setAttribute('aria-label', d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }));
    cell.addEventListener('click', () => pickDate(key));
    grid.appendChild(cell);
  }
}

function pickDate(key) {
  selectedDate = key;
  selected.clear();
  persist();
  showDate();
  renderTasks();
}

// Arrows move the picked day by one day, week, or month, depending on the zoom.
function moveCalendar(direction) {
  offset += direction;
  const d = L.dateFromKey(selectedDate);
  if (view === 'day') d.setDate(d.getDate() + direction);
  else if (view === 'week') d.setDate(d.getDate() + direction * 7);
  else {
    const day = d.getDate();
    d.setDate(1);
    d.setMonth(d.getMonth() + direction);
    d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
  }
  pickDate(L.localDateKey(d));
}
$('#prev').addEventListener('click', () => moveCalendar(-1));
$('#next').addEventListener('click', () => moveCalendar(1));

// Switching zoom keeps the picked day in view.
document.querySelectorAll('.zoom button').forEach(b => b.addEventListener('click', () => {
  view = b.dataset.view;
  document.querySelectorAll('.zoom button').forEach(x => x.classList.toggle('active', x === b));
  const focus = L.dateFromKey(selectedDate), now = new Date();
  if (view === 'day') offset = Math.round((focus - new Date(now.getFullYear(), now.getMonth(), now.getDate())) / 86400000);
  else if (view === 'week') offset = Math.round((startOfWeek(focus) - startOfWeek(now)) / 604800000);
  else offset = (focus.getFullYear() - now.getFullYear()) * 12 + focus.getMonth() - now.getMonth();
  renderCalendar();
}));

// ---------------------------------------------------------------------------------------------
// Partner card and XP. Later scripts wrap renderPokemon/renderXP to add biomes and evolutions.

function renderPokemon() {
  const p = P[pokemon];
  if (!p) return;
  $('#miniPokemon').src = p.sprite;
  $('#companionName').textContent = p.name;
  $('#terrainNote').innerHTML = p.note;
}

function renderXP() {
  if (!user) return;
  const xp = Math.max(0, Number(user.xp) || 0), level = Math.floor(xp / 100) + 1, into = xp % 100;
  $('#xpLevel').textContent = 'LV. ' + level;
  $('#xpPoints').textContent = into + ' / 100 XP';
  $('#xpFill').style.width = into + '%';
}

// ---------------------------------------------------------------------------------------------
// Background world canvas. One animation loop draws whichever terrain renderer is current;
// the scenery scripts assign drawWorld.

const world = $('#world'), wctx = world.getContext('2d');
let drawWorld = () => {};
let drawResidents = () => {}; // wildlife layer; the scenery scripts assign the real one

function resizeWorld() {
  const dpr = Math.min(devicePixelRatio || 1, 2);
  world.width = Math.max(1, Math.floor(innerWidth * dpr));
  world.height = Math.max(1, Math.floor(innerHeight * dpr));
  wctx.imageSmoothingEnabled = false;
}
addEventListener('resize', resizeWorld);
resizeWorld();

(function worldLoop() {
  drawWorld();
  requestAnimationFrame(worldLoop);
})();

// ---------------------------------------------------------------------------------------------
// Finishing quests: each one gets a battle beat, then awards XP. Later scripts assign drawMove
// (the attack art) and wrap animateQuests (level-up and evolution moments).

const attackCanvas = $('#attackCanvas'), actx = attackCanvas.getContext('2d');
let attackRaf = 0;
let drawMove = () => {};

async function animateQuests(ids) {
  const targets = ids.map(id => tasks.find(t => t.id === id)).filter(t => t && !t.done);
  if (!targets.length) return;
  const before = snapshot();
  selected.clear();
  $('#bulkbar').classList.remove('show');
  for (let i = 0; i < targets.length; i++) {
    const t = targets[i], p = P[pokemon];
    $('#attackScreen').classList.add('active');
    $('#attacker').src = p.sprite;
    $('#attackName').textContent = p.move;
    $('#targetTitle').textContent = t.title;
    $('#attackCaption').textContent = p.name + ' is charging…';
    $('#attackCounter').textContent = targets.length > 1 ? `${i + 1} / ${targets.length}` : '✦';
    cancelAnimationFrame(attackRaf);
    window.attackStart = performance.now();
    attackRaf = requestAnimationFrame(() => drawMove(0, p.type));
    await wait(1250);
    $('#attackCaption').textContent = `Direct hit! +${XP_PER_QUEST} XP`;
    $('#attackStage').classList.add('hit');
    await wait(350);
    $('#attackStage').classList.remove('hit');
    t.done = true;
    t.updatedAt = Date.now();
    user.xp = (Number(user.xp) || 0) + XP_PER_QUEST;
    persist();
    renderTasks();
    await wait(180);
  }
  cancelAnimationFrame(attackRaf);
  $('#attackScreen').classList.remove('active');
  renderXP();
  offerUndo(targets.length > 1 ? `${targets.length} quests finished` : `Finished “${targets[0].title}”`, before);
}
$('#completeSelected').addEventListener('click', () => animateQuests([...selected]));

// ---------------------------------------------------------------------------------------------
// Shared pop-up dialog used for confirmations across the app.

function closeAccountDialog() {
  document.querySelector('.account-dialog')?.remove();
}

function showAccountDialog({ title, message, content = '', actions = [] }) {
  closeAccountDialog();
  const shade = document.createElement('div');
  shade.className = 'account-dialog';
  shade.innerHTML = `<section class="account-dialog-card" role="dialog" aria-modal="true" aria-labelledby="accountDialogTitle"><h2 id="accountDialogTitle"></h2><p class="account-dialog-message"></p>${content}<div class="account-dialog-error" aria-live="polite"></div><div class="account-dialog-actions"></div></section>`;
  shade.querySelector('h2').textContent = title;
  shade.querySelector('.account-dialog-message').textContent = message;
  const row = shade.querySelector('.account-dialog-actions');
  for (const action of actions) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = action.label;
    if (action.secondary) b.className = 'secondary';
    b.addEventListener('click', () => action.run(shade));
    row.appendChild(b);
  }
  shade.addEventListener('click', e => { if (e.target === shade) closeAccountDialog(); });
  document.body.appendChild(shade);
  shade.querySelector('button')?.focus();
  return shade;
}
addEventListener('keydown', e => { if (e.key === 'Escape') closeAccountDialog(); });

// ---------------------------------------------------------------------------------------------
// Start-up, called once every script has loaded: open the preview trainer or the saved session.

function bootPlanner() {
  if (previewMode) {
    const day = todayKey();
    user = {
      name: 'Preview Trainer', pokemon: 'charizard', xp: 75, habitatIndex: 0, selectedDate: day,
      routines: [{ id: 'pv-r', title: 'Stretch for 10 minutes', category: 'Health', allDay: true, time: '', repeat: 'daily', start: day, skip: [] }],
      tasks: [
        { id: 'pv1', title: 'Review science notes', category: 'Study', date: day, allDay: false, time: '09:30', done: false },
        { id: 'pv2', title: 'Finish the lab worksheet', category: 'Study', date: day, allDay: true, time: '', done: false },
        { id: 'pv3', title: 'Take a short walk', category: 'Health', date: day, allDay: false, time: '16:00', done: true },
      ],
    };
    showApp();
    return;
  }
  const saved = localStorage.getItem(sessionKey), email = saved?.trim().toLowerCase(), all = accounts();
  const key = email ? accountKey(all, email) : null;
  if (key) openAccount(key);
  else if (saved) localStorage.removeItem(sessionKey);
}
