// Update 2.0: daily wild battles. A wild Pokémon from the current biome appears each day; every quest
// finished today is a hit, and clearing today's list knocks it out and catches it.
// The rules live in src/planner/battle.js; this file draws the board strip, the wild target in the
// attack screen, and the catch scene, through the battle hooks in 01-core.js.
(() => {
  const wildSprite = id => `/sprites/wildlife/${id}.gif`;
  const nameOf = id => (L.speciesInfo(id)?.name || 'Pokémon').toUpperCase();
  const typesOf = id => (L.speciesInfo(id)?.types || []).map(t => t[0].toUpperCase() + t.slice(1)).join(' / ');
  const hpColor = f => (f > 0.5 ? 'high' : f > 0.2 ? 'mid' : 'low');

  // Pick today's wild Pokémon from the biome on screen (once a day; it stays if the biome changes).
  function ensureToday() {
    if (!user?.pokemon || typeof habitatWildlife === 'undefined') return null;
    const biome = activeBiome?.type || 'meadow';
    const pool = (habitatWildlife[pokemon]?.[biome] || []).map(([id]) => id);
    if (L.ensureEncounter(user, todayKey(), biome, pool)) persist();
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

  // Clearing the list catches it: throw, three wobbles, click.
  battleFinish = async () => {
    const enc = user.encounter, got = L.catchWild(user, tasks, todayKey());
    if (!got) return;
    persist();
    const name = nameOf(enc.species);
    stage.classList.add('wild-battle', 'catching');
    $('#attackName').textContent = 'POKÉ BALL!';
    $('#attackCounter').textContent = '◓';
    $('#attackCaption').textContent = 'You threw a Poké Ball!';
    wild.hidden = false;
    wild.className = 'wild-mon';
    ball.hidden = false;
    ball.className = 'catch-ball thrown';
    await wait(650);
    wild.classList.add('absorbed');
    ball.className = 'catch-ball landed';
    await wait(500);
    for (let i = 0; i < 3; i++) {
      $('#attackCaption').textContent = '.'.repeat(i + 1);
      ball.className = 'catch-ball settled';
      void ball.offsetWidth;
      ball.className = 'catch-ball settled wobble';
      await wait(620);
    }
    ball.className = 'catch-ball settled caught';
    $('#attackCaption').textContent = `Gotcha! ${name} was caught!`;
    await wait(1300);
    ball.hidden = true;
    stage.classList.remove('wild-battle', 'catching');
    renderTasks();
    const level = L.levelFor(got.mon.xp), where = got.toParty ? `It joined your party (${user.party.length}/${L.PARTY_SIZE}).` : 'Your party is full, so it went to your box.';
    // Shown once the attack screen has closed.
    setTimeout(() => showAccountDialog({
      title: `${name} joined your team!`,
      message: `Lv. ${level} · ${typesOf(enc.species)}. ${where}`,
      content: `<div class="catch-card"><img src="${wildSprite(enc.species)}" alt=""><p>${escapeHtml(got.mon.note)}</p></div>`,
      actions: [{ label: 'AWESOME', run: closeAccountDialog }],
    }), 50);
  };

  if (user) renderTasks();
})();
