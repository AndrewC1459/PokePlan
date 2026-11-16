// Update 2.0: wild battles. A random wild Pokémon (from any biome) appears each day; every quest
// finished today is a hit, and clearing today's list knocks it out and catches it. After that, bonus
// Pokémon appear: every few more quests finished that day catches another (see battle.js).
// The rules live in src/planner/battle.js; this file draws the board strip, the wild target in the
// attack screen, and the catch scene, through the battle hooks in 01-core.js.
(() => {
  const wildSprite = id => `/sprites/wildlife/${id}.gif`;
  const nameOf = id => (L.speciesInfo(id)?.name || 'Pokémon').toUpperCase();
  const typesOf = id => (L.speciesInfo(id)?.types || []).map(t => t[0].toUpperCase() + t.slice(1)).join(' / ');
  const hpColor = f => (f > 0.5 ? 'high' : f > 0.2 ? 'mid' : 'low');
  const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

  // Every wild species in every biome; the daily and bonus Pokémon are picked from all of them.
  let allWild = null;
  const wildPool = () => (allWild ||= [...new Set(Object.values(habitatWildlife).flatMap(pools => Object.values(pools).flat().map(([id]) => id)))]);
  const here = () => activeBiome?.type || '';

  // Today's random wild Pokémon, picked once a day (the same on every device).
  function ensureToday() {
    if (!user?.pokemon || typeof habitatWildlife === 'undefined') return null;
    const today = todayKey();
    if (L.ensureEncounter(user, today, wildPool(), here())) persist();
    return user.encounter?.date === today ? user.encounter : null;
  }

  // What today's quests are fighting: the daily Pokémon until it's caught, then the bonus ones.
  // Returns { kind: 'daily' | 'bonus', number, species, hp, left } or null once the day is done.
  function currentFight() {
    const enc = ensureToday();
    if (!enc) return null;
    const today = todayKey();
    if (!L.caughtToday(user.mons, today)) {
      const s = L.battleState(tasks, today);
      return { kind: 'daily', number: 0, species: enc.species, hp: s.hp, left: s.left };
    }
    const b = L.bonusState(tasks, user.mons, today);
    if (!b || b.done) return null;
    if (L.ensureBonus(user, today, b.index, wildPool(), here())) persist();
    const slot = user.encounter.bonuses?.[b.index];
    return slot ? { kind: 'bonus', number: b.index + 1, species: slot.species, hp: L.BONUS_HP, left: b.left } : null;
  }

  // ---- The strip under the list title -------------------------------------------------------
  function renderEncounter() {
    const box = $('#encounter'), enc = ensureToday();
    if (!box || !enc) { if (box) box.hidden = true; return; }
    const today = todayKey(), daily = L.caughtToday(user.mons, today), fight = currentFight();
    const bonus = daily ? L.bonusState(tasks, user.mons, today) : null;
    const species = fight?.species ?? daily?.species ?? enc.species;
    const frac = fight?.hp ? fight.left / fight.hp : fight ? 1 : 0;
    let label, status;
    if (fight?.kind === 'daily') {
      label = `WILD ${nameOf(species)}`;
      status = !fight.hp ? 'Add quests for today to battle it.' : `HP ${fight.left}/${fight.hp} · clear today’s list to catch it.`;
    } else if (fight?.kind === 'bonus') {
      label = `BONUS · WILD ${nameOf(species)}`;
      status = `Bonus ${fight.number}/${L.MAX_BONUS}: finish ${plural(fight.left, 'more quest')} today to catch it. Already caught: ${nameOf(daily.species)}${bonus.caught ? ` +${bonus.caught}` : ''}.`;
    } else {
      label = nameOf(species);
      status = `Caught ${nameOf(daily.species)} and all ${L.MAX_BONUS} bonus Pokémon today! New ones appear tomorrow.`;
    }
    box.hidden = false;
    box.className = 'encounter' + (fight ? '' : ' caught') + (fight?.kind === 'bonus' ? ' bonus' : '');
    box.innerHTML = `<img class="enc-sprite" src="${wildSprite(species)}" alt="">
      <div class="enc-copy">
        <div class="enc-top"><b>${escapeHtml(label)}</b><span>Lv. ${L.wildLevel(species)}</span>${fight ? '' : '<span class="enc-badge">✓ ALL CAUGHT</span>'}</div>
        <div class="hp-track ${hpColor(frac)}"><i style="width:${Math.round(frac * 100)}%"></i></div>
        <small>${escapeHtml(status)}</small>
      </div>`;
    box.querySelector('.enc-sprite').title = typesOf(species);
  }
  const renderTasksBeforeBattles = renderTasks;
  renderTasks = function () { renderTasksBeforeBattles(); renderEncounter(); queueLateCatch(); };

  // The list can be cleared without a battle: deleting the last open quest when the rest are done,
  // or finished quests arriving from another device. Play the catch then too, instead of leaving the
  // Pokémon at 0 HP until the next quest.
  let lateCatch = 0;
  function queueLateCatch() {
    clearTimeout(lateCatch);
    lateCatch = setTimeout(async () => {
      const today = todayKey();
      if (!user || $('#attackScreen').classList.contains('active') || document.querySelector('.account-dialog')) return;
      const dailyReady = user.encounter?.date === today && !L.caughtToday(user.mons, today) && L.battleState(tasks, today).cleared;
      if (!dailyReady && !L.bonusState(tasks, user.mons, today)?.pending) return;
      catchCards = [];
      $('#attackScreen').classList.add('active');
      $('#attacker').src = battler().sprite;
      $('#targetLabel').textContent = 'WILD POKÉMON';
      $('#targetTitle').textContent = 'Today’s list is clear!';
      $('#wildHp').hidden = true;
      await battleFinish();
      $('#attackScreen').classList.remove('active');
      renderXP();
      const cards = catchCards;
      catchCards = [];
      for (const show of cards) await whenClosed(show());
    }, 300);
  }

  // ---- The attack screen --------------------------------------------------------------------
  const stage = $('#attackStage'), wild = $('#wildMon'), ball = $('#catchBall');
  let fightBefore = null; // the fight a quest was aimed at, to spot a knockout after the hit
  function showHp(left, hp) {
    const frac = hp ? left / hp : 0;
    $('#wildHp').querySelector('.hp-track').className = 'hp-track ' + hpColor(frac);
    $('#wildHpFill').style.width = Math.round(frac * 100) + '%';
    $('#wildHpText').textContent = `HP ${left}/${hp}`;
  }

  battleTarget = t => {
    const fight = t.date === todayKey() ? currentFight() : null;
    fightBefore = fight;
    stage.classList.toggle('wild-battle', Boolean(fight));
    $('#wildHp').hidden = wild.hidden = !fight;
    $('#targetTitle').textContent = t.title;
    if (!fight) { $('#targetLabel').textContent = 'QUEST TARGET'; return; }
    $('#targetLabel').textContent = `${fight.kind === 'bonus' ? 'BONUS · ' : ''}WILD ${nameOf(fight.species)} · Lv. ${L.wildLevel(fight.species)}`;
    wild.src = wildSprite(fight.species);
    wild.className = 'wild-mon';
    showHp(fight.left, fight.hp);
  };

  battleHit = async t => {
    const before = fightBefore;
    if (!before) return;
    const today = todayKey();
    // Knocked out if the daily list is now clear, or this bonus Pokémon's three hits are in.
    const ko = before.kind === 'daily' ? L.battleState(tasks, today).cleared : (L.bonusState(tasks, user.mons, today)?.earned || 0) >= before.number;
    showHp(ko ? 0 : Math.max(0, before.left - 1), before.hp);
    wild.classList.remove('hurt');
    void wild.offsetWidth;
    wild.classList.add('hurt');
    if (ko) {
      await wait(350);
      wild.classList.add('fainted');
      $('#attackCaption').textContent = `The wild ${nameOf(before.species)} is worn out!`;
      await wait(900);
    }
  };


  // ---- Pixel-art balls -----------------------------------------------------------------------
  // Each ball is a 16×16 pixel grid drawn in code and shown at 2× with no smoothing, like the
  // sprites. Tilted and spinning frames are made by turning the grid with nearest-pixel sampling,
  // so they stay blocky instead of being rotated smoothly by the browser.
  const INK = '#14141c', WHITE = '#f4f4f0', WHITE_SHADE = '#bdbdb6', N = 16, MID = 7.5;
  const BALL_COLORS = {
    poke: { top: '#e3392f', shade: '#a8261f', shine: '#ff9d8f' },
    great: { top: '#3b6fd8', shade: '#27489a', shine: '#a8c6ff', mark: '#e3392f' },
    ultra: { top: '#3a3a46', shade: '#24242c', shine: '#7a7a8c', mark: '#f5c542' },
    master: { top: '#7a3fc2', shade: '#542a8a', shine: '#c79bff', mark: '#e86fb8' },
  };
  const M_LETTER = ['10001', '11011', '10101', '10001'];
  function ballGrid(kind) {
    const c = BALL_COLORS[kind] || BALL_COLORS.poke, inside = (x, y) => Math.hypot(x - MID, y - MID) <= 7.6, grid = [];
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      if (!inside(x, y)) { grid.push(null); continue; }
      const edge = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1);
      const button = Math.hypot(x - MID, y - MID);
      let col;
      if (edge || (button > 1.6 && button <= 2.7) || ((y === 7 || y === 8) && button > 1.6)) col = INK;
      else if (button <= 1.6) col = WHITE;
      else if (y > 8) col = x + y > 19 ? WHITE_SHADE : WHITE;
      else {
        col = x + y > 16 ? c.shade : c.top;
        if (Math.hypot(x - 4.5, y - 3) <= 1.1) col = c.shine;
        if (kind === 'great' && (x <= 4 || x >= 11) && y >= 3 && y <= 5) col = c.mark;
        if (kind === 'ultra' && (x === 4 || x === 5 || x === 10 || x === 11) && y >= 1) col = c.mark;
        if (kind === 'master') {
          if (Math.hypot(x - 3, y - 4.5) <= 1.2 || Math.hypot(x - 12, y - 4.5) <= 1.2) col = c.mark;
          if (y >= 2 && y <= 5 && x >= 5 && x <= 9 && M_LETTER[y - 2][x - 5] === '1') col = WHITE;
        }
      }
      grid.push(col);
    }
    return grid;
  }
  const frames = new Map();
  function ballFrame(kind, degrees = 0) {
    const key = kind + degrees;
    if (frames.has(key)) return frames.get(key);
    const grid = ballGrid(kind), a = degrees * Math.PI / 180, cos = Math.cos(a), sin = Math.sin(a);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = N;
    const ctx = canvas.getContext('2d');
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const sx = Math.round(cos * (x - MID) + sin * (y - MID) + MID), sy = Math.round(-sin * (x - MID) + cos * (y - MID) + MID);
      const col = sx >= 0 && sx < N && sy >= 0 && sy < N ? grid[sy * N + sx] : null;
      if (col) { ctx.fillStyle = col; ctx.fillRect(x, y, 1, 1); }
    }
    frames.set(key, canvas.toDataURL());
    return frames.get(key);
  }

  // Movement snaps to a 4px grid and advances in frames, so it reads like sprite animation.
  const SNAP = 4, BALL = 32;
  function placeBall(x, y, kind, degrees = 0) {
    ball.src = ballFrame(kind, degrees);
    ball.style.left = Math.round((x - BALL / 2) / SNAP) * SNAP + 'px';
    ball.style.top = Math.round((y - BALL / 2) / SNAP) * SNAP + 'px';
  }
  async function sparkle(x, y) {
    const stars = [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([dx, dy]) => {
      const s = document.createElement('i');
      s.className = 'catch-star';
      stage.appendChild(s);
      return { s, dx, dy };
    });
    for (const r of [14, 20, 26, 32]) {
      for (const { s, dx, dy } of stars) {
        s.style.left = Math.round((x + dx * r) / SNAP) * SNAP + 'px';
        s.style.top = Math.round((y + dy * r) / SNAP) * SNAP + 'px';
      }
      await wait(90);
    }
    stars.forEach(({ s }) => s.remove());
  }

  // One catch: throw, three wobbles, click. `got` is a result from catchWild / catchBonus.
  async function throwBall(got) {
    const species = got.mon.species, name = nameOf(species), kind = got.mon.ball || 'poke', ballName = L.BALLS[kind] || 'Poké Ball';
    // Clear the last attack's sparks so the catch plays on a clean stage.
    actx.setTransform(1, 0, 0, 1, 0, 0);
    actx.clearRect(0, 0, attackCanvas.width, attackCanvas.height);
    const { width: W, height: H } = stage.getBoundingClientRect();
    const from = [W * 0.25, H * 0.62], to = [W * 0.78, H * 0.42], rest = [W * 0.78, H * 0.6];
    stage.classList.add('wild-battle', 'catching');
    $('#attackName').textContent = ballName.toUpperCase() + '!';
    $('#attackCounter').textContent = got.number ? `BONUS ${got.number}` : '◓';
    $('#attackCaption').textContent = `You threw a ${ballName}!`;
    wild.src = wildSprite(species);
    wild.hidden = false;
    wild.className = 'wild-mon';
    ball.hidden = false;
    // Throw: an arc over 11 frames, spinning a quarter turn each frame.
    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      placeBall(from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t - H * 0.38 * 4 * t * (1 - t), kind, (i % 4) * 90);
      await wait(60);
    }
    // The Pokémon flashes white and shrinks into the ball in three steps.
    wild.style.transition = 'none';
    for (const s of [0.66, 0.33]) {
      wild.style.transform = `scale(${s})`;
      wild.style.filter = 'brightness(5)';
      await wait(80);
    }
    wild.hidden = true;
    // Drop to the ground with one small bounce.
    for (let i = 1; i <= 4; i++) { placeBall(to[0], to[1] + (rest[1] - to[1]) * (i / 4), kind); await wait(55); }
    placeBall(rest[0], rest[1] - 8, kind); await wait(70);
    placeBall(rest[0], rest[1], kind); await wait(380);
    // Three wobbles: tilt left, upright, tilt right, upright.
    for (let i = 0; i < 3; i++) {
      $('#attackCaption').textContent = '.'.repeat(i + 1);
      placeBall(rest[0] - 2, rest[1], kind, -25); await wait(140);
      placeBall(rest[0], rest[1], kind); await wait(90);
      placeBall(rest[0] + 2, rest[1], kind, 25); await wait(140);
      placeBall(rest[0], rest[1], kind); await wait(300);
    }
    // Click.
    $('#attackCaption').textContent = `Gotcha! ${name} was caught!`;
    ball.classList.add('caught');
    await sparkle(rest[0], rest[1]);
    await wait(900);
    ball.hidden = true;
    ball.classList.remove('caught');
    wild.style.transition = wild.style.transform = wild.style.filter = '';
    stage.classList.remove('wild-battle', 'catching');
    // Its card is shown after the attack screen closes (see the animateQuests wrapper below).
    const level = L.levelFor(got.mon.xp), where = got.toParty ? `It joined your party (${user.party.length}/${L.PARTY_SIZE}).` : 'Your party is full, so it went to your box.';
    catchCards.push(() => showAccountDialog({
      title: `${got.number ? 'Bonus! ' : ''}${name} joined your team!`,
      message: `Lv. ${level} · ${typesOf(species)}. ${where}`,
      content: `<div class="catch-card"><img src="${wildSprite(species)}" alt=""><p>${escapeHtml(got.mon.note)}<br><span class="catch-ball-note"><img src="${ballFrame(kind)}" alt=""> Caught with a ${escapeHtml(ballName)}</span></p></div>`,
      actions: [{ label: 'AWESOME', run: closeAccountDialog }],
    }));
  }

  // After the quests: catch the daily Pokémon if the list is clear, then any knocked-out bonus ones.
  battleFinish = async () => {
    const today = todayKey(), daily = L.catchWild(user, tasks, today);
    if (daily) { persist(); await throwBall(daily); }
    const nextBonus = () => {
      // A bonus knocked out on another device may not have been picked here yet.
      const b = L.bonusState(tasks, user.mons, today);
      if (b?.pending) L.ensureBonus(user, today, b.caught, wildPool(), here());
      return L.catchBonus(user, tasks, today);
    };
    for (let got = nextBonus(); got; got = nextBonus()) {
      persist();
      await throwBall(got);
    }
    renderTasks();
  };

  // Catch cards wait for the attack screen to close, one at a time, and later steps (evolutions) wait for them.
  let catchCards = [];
  const animateBeforeCatch = animateQuests;
  animateQuests = async function (ids) {
    catchCards = [];
    await animateBeforeCatch(ids);
    const cards = catchCards;
    catchCards = [];
    for (const show of cards) await whenClosed(show());
  };

  if (user) renderTasks();
})();
