// Update 2.0: your team. Party of six (lead first) plus a box; the lead battles, shows on the partner
// card, and decides the biome from its types; caught Pokémon level up and evolve.
// Rules live in src/planner/team.js; this file is the screens and the wiring.
(() => {
  // ---- Every biome and its wildlife, for every trainer ---------------------------------------
  // The scenery and wild Pokémon used to belong to one starter each. Biome keys are unique, so one
  // shared table works for everyone; older code that looks things up by starter still finds them.
  const BIOMES = {}, POOLS = {};
  for (const list of Object.values(habitatList)) for (const b of list) BIOMES[b.type] ||= b;
  for (const pools of Object.values(habitatWildlife)) for (const [b, list] of Object.entries(pools)) POOLS[b] ||= list;
  for (const starter of Object.keys(habitatWildlife)) Object.assign(habitatWildlife[starter], POOLS);

  const lead = () => L.leadOf(user);
  const caughtLead = () => { const m = lead(); return m && !m.starter ? m : null; };
  const spriteOf = mon => (mon?.starter ? P[pokemon]?.sprite : `/sprites/wildlife/${mon?.species}.gif`);
  const nameOf = mon => (mon?.starter ? user.nickname || P[pokemon]?.name || 'Partner' : L.monName(mon));
  const typesOf = mon => (L.speciesInfo(mon?.species)?.types || []).map(t => t[0].toUpperCase() + t.slice(1)).join(' / ');
  const byId = id => user.mons.find(m => m.id === id);

  // ---- The lead picks the biome --------------------------------------------------------------
  drawHabitat = function () {
    if (!user) return;
    if (!user.biome) {
      // Saves from before 2.0 kept a position in the starter's list; keep showing the same place.
      const list = habitatList[pokemon] || [];
      user.biome = list[Math.abs(Number(user.habitatIndex) || 0) % (list.length || 1)]?.type;
    }
    activeBiome = BIOMES[L.currentBiome(user)] || BIOMES.meadow;
    $('#terrainNote').textContent = activeBiome.name + ' · ' + activeBiome.description;
    updateBiomeButton();
    drawResidents();
  };

  // Replace the old button (its listener cycled the starter's list) with one that cycles the lead's biomes.
  const oldButton = $('#nextBiome'), biomeButton = oldButton.cloneNode(true);
  oldButton.replaceWith(biomeButton);
  function updateBiomeButton() {
    const options = L.biomesFor(lead(), pokemon), at = options.indexOf(L.currentBiome(user));
    biomeButton.disabled = options.length < 2;
    biomeButton.textContent = options.length < 2 ? 'ONLY BIOME' : `CHANGE BIOME ↻ ${at + 1}/${options.length}`;
    biomeButton.title = options.length < 2 ? 'Lead with a different type of Pokémon to see other biomes.' : '';
  }
  biomeButton.addEventListener('click', () => {
    const options = L.biomesFor(lead(), pokemon);
    if (options.length < 2) return;
    user.biome = options[(options.indexOf(L.currentBiome(user)) + 1) % options.length];
    persist();
    drawHabitat();
    renderTasks();
  });

  // ---- The lead battles ------------------------------------------------------------------------
  // Until each type gets its own animation, borrow the closest of the three existing ones.
  const ANIMATION = { fire: 'fire', dragon: 'fire', electric: 'electric', steel: 'electric', ice: 'electric', fairy: 'electric' };
  battler = () => {
    const m = caughtLead();
    if (!m) return P[pokemon];
    return { name: nameOf(m), sprite: spriteOf(m), move: L.moveFor(m), type: ANIMATION[L.speciesInfo(m.species)?.types[0]] || 'ghost' };
  };

  // ---- Partner card: shows the lead, plus a row for the party -------------------------------
  const card = document.querySelector('.companion'), lockNote = card.querySelector('.comp-lock'), starterLock = lockNote.textContent;
  const strip = document.createElement('div');
  strip.className = 'party-strip';
  card.appendChild(strip);
  strip.addEventListener('click', () => openTeam());

  function showLead() {
    if (!user?.mons) return;
    const m = caughtLead();
    card.classList.toggle('lead-caught', Boolean(m));
    lockNote.textContent = m ? typesOf(m) : starterLock;
    if (m) {
      const level = L.levelFor(m.xp), into = Math.max(0, Number(m.xp) || 0) % 100, next = L.speciesInfo(m.species);
      $('#miniPokemon').src = spriteOf(m);
      $('#miniPokemon').alt = nameOf(m);
      $('#companionName').textContent = nameOf(m);
      $('#xpLevel').textContent = 'LV. ' + level;
      $('#xpPoints').textContent = into + ' / 100 XP';
      $('#xpFill').style.width = into + '%';
      const evo = document.querySelector('#evoTools');
      if (evo) {
        evo.innerHTML = `<div class="evo-note">Lv. ${level} · ${escapeHtml(L.moveFor(m).replaceAll('!', ''))}</div>`
          + (next?.evolvesTo ? `<div class="evo-note">Evolves into ${escapeHtml(L.speciesInfo(next.evolvesTo).name)} at Lv. ${next.evolveLevel}</div>` : '');
      }
    }
    const party = user.party.map(byId).filter(Boolean);
    strip.innerHTML = `<div class="party-strip-top"><span>PARTY ${party.length}/${L.PARTY_SIZE}</span><b>TEAM ▸</b></div>
      <div class="party-slots">${Array.from({ length: L.PARTY_SIZE }, (_, i) => party[i]
        ? `<span class="party-slot${i === 0 ? ' lead' : ''}" title="${escapeHtml(nameOf(party[i]))} · Lv. ${L.levelFor(party[i].xp)}"><img src="${spriteOf(party[i])}" alt=""></span>`
        : '<span class="party-slot open-slot"></span>').join('')}</div>`;
    strip.setAttribute('role', 'button');
    strip.tabIndex = 0;
    strip.setAttribute('aria-label', 'Open your team');
  }
  strip.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openTeam(); } });
  for (const name of ['refreshPartner', 'renderXP', 'renderPokemon']) {
    const before = window[name];
    window[name] = function (...args) { const out = before.apply(this, args); showLead(); return out; };
  }

  // Renaming: the pencil renames whoever leads (the starter's own nickname flow handles the starter).
  document.addEventListener('click', e => {
    if (!e.target.closest('#nicknamePartner') || !caughtLead()) return;
    e.stopImmediatePropagation();
    renameMon(caughtLead());
  }, true);
  function renameMon(m, after = () => {}) {
    const dialog = showAccountDialog({
      title: 'Nickname',
      message: `Give ${L.speciesInfo(m.species)?.name || 'your Pokémon'} a nickname, or leave it blank.`,
      content: '<label for="monNickname">NICKNAME<input id="monNickname" maxlength="16" autocomplete="off"></label>',
      actions: [
        { label: 'SAVE', run: shade => save(shade) },
        { label: 'CANCEL', secondary: true, run: () => { closeAccountDialog(); after(); } },
      ],
    });
    const input = dialog.querySelector('#monNickname');
    input.value = m.nickname || '';
    input.focus();
    input.addEventListener('keydown', e => { if (e.key === 'Enter') save(dialog); });
    function save(shade) {
      const value = shade.querySelector('#monNickname').value.trim();
      if (value) m.nickname = value; else delete m.nickname;
      m.updatedAt = Date.now();
      persist();
      closeAccountDialog();
      renderPokemon();
      after();
    }
  }

  // ---- Team screen: party and box ------------------------------------------------------------
  function teamRow(m, i, inParty) {
    const level = L.levelFor(m.xp), into = Math.max(0, Number(m.xp) || 0) % 100;
    const isLead = inParty && i === 0, partySize = user.party.length;
    const when = m.starter ? 'Your starter' : `Caught ${m.caughtOn || ''}${m.note ? ' · ' + m.note : ''}`;
    const buttons = inParty
      ? (isLead ? '<span class="team-lead-tag">★ LEAD</span>' : `<button type="button" data-act="lead">LEAD</button>`)
        + (partySize > 1 ? `<button type="button" data-act="box">BOX</button>` : '')
      : `<button type="button" data-act="party" ${partySize >= L.PARTY_SIZE ? 'disabled title="Your party is full. Box someone first."' : ''}>PARTY</button>`;
    return `<div class="team-row${isLead ? ' is-lead' : ''}" data-id="${escapeHtml(m.id)}" title="${escapeHtml(when)}">
      <img src="${spriteOf(m)}" alt="">
      <div class="team-info">
        <div class="team-name"><b>${escapeHtml(nameOf(m))}</b><span>Lv. ${level}</span></div>
        <small>${escapeHtml(typesOf(m))}${inParty && !isLead ? ' · Exp. Share' : ''}</small>
        ${inParty ? `<div class="hp-track team-xp"><i style="width:${into}%"></i></div>` : ''}
      </div>
      <div class="team-actions">${buttons}${m.starter ? '' : '<button type="button" data-act="rename" title="Nickname" aria-label="Nickname">✎</button>'}</div>
    </div>`;
  }
  function drawTeam(view) {
    const party = user.party.map(byId).filter(Boolean), box = user.mons.filter(m => !user.party.includes(m.id));
    const wild = [...new Set(Object.values(POOLS).flat().map(([id]) => id))], dex = user.dex || {};
    view.innerHTML = `<div class="team-dex"><b>POKÉDEX ${wild.filter(id => dex[id]).length}/${wild.length}</b><span>different wild Pokémon caught</span></div>
      <h3>PARTY · ${party.length}/${L.PARTY_SIZE}</h3>
      <p class="team-hint">Your lead battles and picks the biome. The rest of the party gets half the XP (Exp. Share).</p>
      ${party.map((m, i) => teamRow(m, i, true)).join('')}
      <h3>BOX · ${box.length}</h3>
      ${box.length ? '<p class="team-hint">Pokémon in the box rest and don’t earn XP.</p>' + box.map(m => teamRow(m, 0, false)).join('')
        : '<p class="team-hint">Pokémon you catch go here once your party is full.</p>'}`;
  }
  function openTeam() {
    if (!user?.mons) return;
    const dialog = showAccountDialog({ title: 'Your team', message: '', content: '<div class="team-view" id="teamView"></div>', actions: [{ label: 'DONE', run: closeAccountDialog }] });
    dialog.querySelector('.account-dialog-card').classList.add('team-card');
    const view = dialog.querySelector('#teamView');
    drawTeam(view);
    view.addEventListener('click', e => {
      const act = e.target.closest('button[data-act]')?.dataset.act, id = e.target.closest('.team-row')?.dataset.id;
      if (!act || !id) return;
      const m = byId(id);
      if (act === 'rename') return renameMon(m, () => openTeam());
      const before = user.party;
      user.party = act === 'lead' ? L.setLead(before, id) : act === 'box' ? L.sendToBox(before, id) : L.bringToParty(before, id);
      if (user.party === before) return;
      if (act === 'lead' || before[0] !== user.party[0]) user.biome = L.biomesFor(lead(), pokemon)[0];
      persist();
      drawHabitat();
      renderPokemon();
      renderXP();
      renderTasks();
      drawTeam(view);
    });
  }

  // ---- Caught Pokémon evolve when they reach the level -----------------------------------------
  async function playEvolution(m, steps) {
    const from = L.speciesInfo(steps[0])?.name, to = L.speciesInfo(steps.at(-1))?.name, who = m.nickname || from;
    const dialog = showAccountDialog({
      title: `What? ${who} is evolving!`,
      message: '',
      content: `<div class="evolve-scene"><img id="evolveSprite" src="/sprites/wildlife/${steps[0]}.gif" alt=""></div>`,
      actions: [{ label: 'AWESOME', run: closeAccountDialog }],
    });
    const img = dialog.querySelector('#evolveSprite'), done = dialog.querySelector('.account-dialog-actions button');
    done.disabled = true;
    // Flicker between the two forms as silhouettes, faster and faster, then reveal.
    img.classList.add('silhouette');
    for (const ms of [420, 360, 300, 240, 180, 140, 110, 90, 80, 70]) {
      img.src = img.src.endsWith(`/${steps[0]}.gif`) ? `/sprites/wildlife/${steps.at(-1)}.gif` : `/sprites/wildlife/${steps[0]}.gif`;
      await wait(ms);
    }
    img.src = `/sprites/wildlife/${steps.at(-1)}.gif`;
    img.classList.remove('silhouette');
    dialog.querySelector('h2').textContent = 'Congratulations!';
    dialog.querySelector('.account-dialog-message').textContent = `${who} evolved into ${to}!`;
    done.disabled = false;
    done.focus();
    // Wait until it's closed before the next one.
    await whenClosed(dialog);
  }

  const animateBeforeTeam = animateQuests;
  animateQuests = async function (ids) {
    questGains = [];
    await animateBeforeTeam(ids);
    const leveled = [...new Set(questGains.filter(g => g.toLevel > g.fromLevel).map(g => g.id))];
    for (const id of leveled) {
      const m = byId(id);
      if (!m || m.starter) continue;
      const steps = L.evolveFully(m);
      for (const s of steps) L.recordDex(user, s, todayKey());
      if (steps.length < 2) continue;
      m.updatedAt = Date.now();
      persist();
      renderPokemon();
      await playEvolution(m, steps);
    }
    questGains = [];
  };

  if (user?.pokemon) { drawHabitat(); renderPokemon(); renderTasks(); }
})();
