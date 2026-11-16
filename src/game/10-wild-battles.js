// Update 2.0: daily wild battles. A wild Pokémon from the current biome appears each day; every quest
// finished today is a hit, and clearing today's list knocks it out and catches it.
// The rules live in src/planner/battle.js; this file draws the board strip, the wild target in the
// attack screen, and the catch scene, through the battle hooks in 01-core.js.
(() => {
  const wildSprite = id => `/sprites/wildlife/${id}.gif`;
  const nameOf = id => (L.speciesInfo(id)?.name || 'Pokémon').toUpperCase();
  const typesOf = id => (L.speciesInfo(id)?.types || []).map(t => t[0].toUpperCase() + t.slice(1)).join(' / ');
  const hpColor = f => (f > 0.5 ? 'high' : f > 0.2 ? 'mid' : 'low');

  // Today's wild Pokémon comes from the biome on screen (see ensureEncounter for when it can change).
  function ensureToday() {
    if (!user?.pokemon || typeof habitatWildlife === 'undefined') return null;
    const biome = activeBiome?.type || 'meadow';
    const pool = (habitatWildlife[pokemon]?.[biome] || []).map(([id]) => id);
    // Before the first hit today (and before a catch), moving biome brings that biome's Pokémon.
    const fresh = !L.battleState(tasks, todayKey()).damage && !L.caughtToday(user.mons, todayKey());
    if (L.ensureEncounter(user, todayKey(), biome, pool, fresh)) persist();
    return user.encounter?.date === todayKey() ? user.encounter : null;
  }

  // ---- The strip under the list title -------------------------------------------------------
  function renderEncounter() {
    const box = $('#encounter'), enc = ensureToday();
    if (!box || !enc) { if (box) box.hidden = true; return; }
    const today = todayKey(), caught = L.caughtToday(user.mons, today);
    const { hp, left } = L.battleState(tasks, today), frac = hp ? left / hp : 1;
    const level = L.levelFor(caught ? caught.xp : L.xpForLevel(L.wildLevel(enc.species)));
    const status = caught
      ? `Caught! ${nameOf(enc.species)} joined your ${user.party.includes(caught.id) ? 'party' : 'box'}. A new one appears tomorrow.`
      : !hp ? 'Add quests for today to battle it.'
        : `HP ${left}/${hp} · clear today’s list to catch it.`;
    box.hidden = false;
    box.className = 'encounter' + (caught ? ' caught' : '');
    box.innerHTML = `<img class="enc-sprite" src="${wildSprite(enc.species)}" alt="">
      <div class="enc-copy">
        <div class="enc-top"><b>${caught ? '' : 'WILD '}${escapeHtml(nameOf(enc.species))}</b><span>Lv. ${level}</span>${caught ? '<span class="enc-badge">✓ CAUGHT</span>' : ''}</div>
        <div class="hp-track ${hpColor(caught ? 0 : frac)}"><i style="width:${caught ? 0 : Math.round(frac * 100)}%"></i></div>
        <small>${escapeHtml(status)}</small>
      </div>`;
    box.querySelector('.enc-sprite').title = typesOf(enc.species);
  }
  const renderTasksBeforeBattles = renderTasks;
  renderTasks = function () { renderTasksBeforeBattles(); renderEncounter(); };

  // ---- The attack screen --------------------------------------------------------------------
  const stage = $('#attackStage'), wild = $('#wildMon'), ball = $('#catchBall');
  const fighting = t => {
    const enc = ensureToday();
    return enc && t.date === todayKey() && !L.caughtToday(user.mons, todayKey()) ? enc : null;
  };
  function showHp() {
    const { hp, left } = L.battleState(tasks, todayKey()), frac = hp ? left / hp : 0;
    $('#wildHp').querySelector('.hp-track').className = 'hp-track ' + hpColor(frac);
    $('#wildHpFill').style.width = Math.round(frac * 100) + '%';
    $('#wildHpText').textContent = `HP ${left}/${hp}`;
  }

  battleTarget = t => {
    const enc = fighting(t);
    stage.classList.toggle('wild-battle', Boolean(enc));
    $('#wildHp').hidden = wild.hidden = !enc;
    $('#targetTitle').textContent = t.title;
    if (!enc) { $('#targetLabel').textContent = 'QUEST TARGET'; return; }
    $('#targetLabel').textContent = `WILD ${nameOf(enc.species)} · Lv. ${L.wildLevel(enc.species)}`;
    wild.src = wildSprite(enc.species);
    wild.className = 'wild-mon';
    showHp();
  };

  battleHit = async t => {
    if (!fighting(t)) return;
    showHp();
    wild.classList.remove('hurt');
    void wild.offsetWidth;
    wild.classList.add('hurt');
    if (L.battleState(tasks, todayKey()).cleared) {
      await wait(350);
      wild.classList.add('fainted');
      $('#attackCaption').textContent = `The wild ${nameOf(user.encounter.species)} is worn out!`;
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

  // Clearing the list catches it: throw, three wobbles, click.
  battleFinish = async () => {
    const enc = user.encounter, got = L.catchWild(user, tasks, todayKey());
    if (!got) return;
    persist();
    const name = nameOf(enc.species), kind = got.mon.ball || 'poke', ballName = L.BALLS[kind] || 'Poké Ball';
    // Clear the last attack's sparks so the catch plays on a clean stage.
    actx.setTransform(1, 0, 0, 1, 0, 0);
    actx.clearRect(0, 0, attackCanvas.width, attackCanvas.height);
    const { width: W, height: H } = stage.getBoundingClientRect();
    const from = [W * 0.25, H * 0.62], to = [W * 0.78, H * 0.42], rest = [W * 0.78, H * 0.6];
    stage.classList.add('wild-battle', 'catching');
    $('#attackName').textContent = ballName.toUpperCase() + '!';
    $('#attackCounter').textContent = '◓';
    $('#attackCaption').textContent = `You threw a ${ballName}!`;
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
    renderTasks();
    const level = L.levelFor(got.mon.xp), where = got.toParty ? `It joined your party (${user.party.length}/${L.PARTY_SIZE}).` : 'Your party is full, so it went to your box.';
    // Shown after the attack screen closes (see the animateQuests wrapper below), before any evolutions.
    catchCard = () => showAccountDialog({
      title: `${name} joined your team!`,
      message: `Lv. ${level} · ${typesOf(enc.species)}. ${where}`,
      content: `<div class="catch-card"><img src="${wildSprite(enc.species)}" alt=""><p>${escapeHtml(got.mon.note)}<br><span class="catch-ball-note"><img src="${ballFrame(kind)}" alt=""> Caught with a ${escapeHtml(ballName)}</span></p></div>`,
      actions: [{ label: 'AWESOME', run: closeAccountDialog }],
    });
  };

  // The catch card waits for the attack screen to close, and later steps wait for the card.
  let catchCard = null;
  const animateBeforeCatch = animateQuests;
  animateQuests = async function (ids) {
    catchCard = null;
    await animateBeforeCatch(ids);
    const show = catchCard;
    catchCard = null;
    if (show) await whenClosed(show());
  };

  if (user) renderTasks();
})();
