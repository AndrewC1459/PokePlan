// Two more habitats per partner, bigger wildlife pools, and more Pokémon in the sky at once.
(() => {
  // ---- New habitats (appended, so saved habitat choices keep pointing at the same scene) ----
  habitatList.pikachu.push(
    { name: 'Sunny Shoreline', description: 'Waves roll onto warm sand.', type: 'beach' },
    { name: 'Thunder Plains', description: 'Storm clouds crackle over the grass.', type: 'storm' },
  );
  habitatList.charizard.push(
    { name: 'Scorched Dunes', description: 'Heat shimmers over endless sand.', type: 'desert' },
    { name: 'Dragon Canyon', description: 'Red cliffs glow in the setting sun.', type: 'canyon' },
  );
  habitatList.gengar.push(
    { name: 'Lavender Graves', description: 'Wisps flicker between old stones.', type: 'graveyard' },
    { name: 'Shadow Grotto', description: 'Violet crystals pulse in the dark.', type: 'crystal' },
  );

  // ---- Wildlife: new pools plus extra residents for the original habitats ----
  const W = 'walk', F = 'fly', FL = 'float', S = 'swim';
  Object.assign(habitatWildlife.pikachu, {
    beach: [[72, S], [90, S], [116, S], [120, S], [222, S], [318, S], [98, W], [7, W], [278, F], [279, F]],
    storm: [[81, FL], [82, FL], [100, W], [125, W], [179, W], [309, W], [311, W], [312, W], [587, F], [145, F], [426, FL]],
  });
  Object.assign(habitatWildlife.charizard, {
    desert: [[27, W], [328, W], [331, W], [449, W], [551, W], [329, F], [330, F], [227, F], [22, F], [343, FL]],
    canyon: [[371, W], [443, W], [66, W], [74, FL], [142, F], [149, F], [373, F], [628, F], [630, F], [22, F]],
  });
  Object.assign(habitatWildlife.gengar, {
    graveyard: [[92, FL], [93, FL], [200, FL], [353, FL], [355, FL], [562, FL], [607, FL], [608, FL], [104, W], [41, F], [198, F]],
    crystal: [[302, W], [524, W], [361, W], [41, F], [42, F], [169, F], [337, FL], [338, FL], [442, FL], [478, FL], [597, FL]],
  });
  const extras = {
    pikachu: {
      meadow: [[15, F], [17, F], [267, F], [191, W], [285, W]],
      forest: [[193, F], [284, F], [415, F], [167, W], [540, W]],
      river: [[270, S], [339, S], [550, S], [158, W], [98, W]],
    },
    charizard: {
      volcano: [[146, F], [240, W], [322, W], [324, W], [631, W]],
      sky: [[18, F], [277, F], [334, F], [396, F], [521, F]],
      cave: [[74, FL], [527, F], [75, W], [299, W], [529, W]],
    },
    gengar: {
      haunted: [[354, FL], [562, FL], [609, FL], [608, FL]],
      ruins: [[344, FL], [201, FL], [436, FL], [562, FL]],
      marsh: [[195, S], [341, W], [453, W], [618, W]],
    },
  };
  for (const [starter, biomes] of Object.entries(extras))
    for (const [biome, list] of Object.entries(biomes)) habitatWildlife[starter][biome].push(...list);
  for (const id of [195, 270, 339, 550, 90, 116, 120, 222, 318]) waterSpeciesIds.add(id);

  // ---- More residents on screen (fewer on phones so the board stays readable) ----
  const waterBiomes = new Set(['river', 'marsh', 'beach']);
  drawResidents = function () {
    const biome = activeBiome?.type || 'meadow', key = pokemon + ':' + biome;
    if (wildlifeKey === key) return;
    wildlifeKey = key;
    ambientLayer.replaceChildren();
    const count = window.innerWidth < 700 ? 5 : 8;
    const water = waterBiomes.has(biome);
    const candidates = (habitatWildlife[pokemon]?.[biome] || [])
      .map(([id, kind]) => [id, kind === S || (water && waterSpeciesIds.has(id)) ? (water ? S : FL) : kind])
      .filter(([, kind]) => kind !== 'perch');
    const shuffled = [...candidates].sort(() => Math.random() - 0.5);
    const pool = pokemon === 'charizard' && biome === 'volcano'
      ? [[218, W], ...shuffled.filter(([id]) => id !== 218).slice(0, count - 1)]
      : shuffled.slice(0, count);
    pool.forEach(([id, kind], i) => {
      const wrap = document.createElement('div'), img = document.createElement('img');
      wrap.className = 'resident-wrap ' + kind + (i % 2 ? ' from-right' : '');
      wrap.style.setProperty('--lane', kind === S ? `${74 + (i % 3) * 5}%` : kind === W ? `${5 + (i % 3) * 2}%` : `${8 + (i % 5) * 8}%`);
      wrap.style.setProperty('--ground', `${3 + (i % 3) * 2}%`);
      const duration = kind === W ? 12 + i * 1.1 : kind === S ? 22 + i * 2 : 19 + i * 2.1;
      wrap.style.setProperty('--delay', `${-Math.random() * duration}s`);
      wrap.style.setProperty('--speed', `${duration}s`);
      img.className = 'resident';
      img.alt = '';
      img.draggable = false;
      img.src = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-v/black-white/animated/${id}.gif`;
      img.addEventListener('error', () => wrap.remove());
      wrap.appendChild(img);
      ambientLayer.appendChild(wrap);
    });
  };

  // ---- Terrain for the new habitats (same pixel style as the originals) ----
  const palettes = {
    beach: { sky: ['#6fb8dc', '#a9dcea', '#f3e6b8'], far: '#7fb6c4', mid: '#4f9fb8', near: '#ead59c', ground: '#d8bb7a', accent: '#ffe9a3' },
    storm: { sky: ['#3e4a63', '#566279', '#7d8791'], far: '#5b6a72', mid: '#4a5d5c', near: '#3c5446', ground: '#2c4036', accent: '#ffe36b' },
    desert: { sky: ['#e7a76d', '#f0c483', '#f7deaa'], far: '#d39a6a', mid: '#c98552', near: '#e2b06c', ground: '#c9924f', accent: '#fff1b0' },
    canyon: { sky: ['#c86f6a', '#e49a72', '#f4c78d'], far: '#a85a52', mid: '#8e4a45', near: '#b8683f', ground: '#7d4033', accent: '#ffd38a', water: '#5e8c96' },
    graveyard: { sky: ['#2f2f4d', '#4a4568', '#6f6488'], far: '#4b4763', mid: '#3a3852', near: '#2c2c40', ground: '#1f2232', accent: '#c9a8ff' },
    crystal: { sky: ['#1f1b33', '#2e2647', '#41355e'], far: '#3a2f57', mid: '#2b2443', near: '#211c35', ground: '#171427', accent: '#d7a8ff', water: '#3b3466' },
  };
  const baseTerrain = drawWorld;

  function extraTerrain() {
    const type = activeBiome?.type, p = palettes[type];
    if (!p) return baseTerrain();
    const Wd = world.width, Ht = world.height, sx = Wd / 640, sy = Ht / 360, t = performance.now() / 1000, g = 4;
    wctx.setTransform(1, 0, 0, 1, 0, 0);
    wctx.imageSmoothingEnabled = false;
    wctx.clearRect(0, 0, Wd, Ht);
    const snap = n => Math.round(n / g) * g;
    const rect = (x, y, w, h, c) => { wctx.fillStyle = c; wctx.fillRect(Math.round(x * sx), Math.round(y * sy), Math.max(1, Math.round(w * sx)), Math.max(1, Math.round(h * sy))); };
    const poly = (pts, c) => { wctx.beginPath(); wctx.moveTo(snap(pts[0][0]) * sx, snap(pts[0][1]) * sy); for (let i = 1; i < pts.length; i++) wctx.lineTo(snap(pts[i][0]) * sx, snap(pts[i][1]) * sy); wctx.closePath(); wctx.fillStyle = c; wctx.fill(); };
    const ridge = (y, amp, phase, c, step = 16) => { const pts = [[0, 360]]; for (let x = 0; x <= 640; x += step) pts.push([x, y + Math.sin(x * .018 + phase) * amp + Math.sin(x * .043 + phase * .7) * amp * .22]); pts.push([640, 360]); poly(pts, c); };
    const cloud = (x, y, k, c) => { rect(x, y, 38 * k, 8 * k, c); rect(x + 8 * k, y - 8 * k, 23 * k, 8 * k, c); rect(x + 23 * k, y + 8 * k, 25 * k, 5 * k, c); };
    const stars = n => { for (let i = 0; i < n; i++) { const x = (i * 83 + 19) % 640, y = (i * 47 + 7) % 150; if ((i + Math.floor(t * 1.5)) % 5) rect(x, y, 2, 2, i % 4 ? '#d8d4e5' : '#fff0c7'); } };

    for (let y = 0; y < 360; y += 12) rect(0, y, 640, 12, y < 52 ? p.sky[0] : y < 112 ? p.sky[1] : p.sky[2]);

    if (type === 'beach') {
      rect(500, 30, 40, 40, p.accent); rect(508, 26, 24, 6, '#fff6cf');
      for (let i = 0; i < 5; i++) cloud((i * 151 + t * (1.4 + i * .2)) % 760 - 68, 34 + (i % 3) * 24, .7, '#ffffff88');
      rect(0, 150, 640, 110, p.mid); rect(0, 150, 640, 6, '#8fd0e0');
      poly([[30, 154], [70, 128], [120, 122], [170, 140], [200, 154]], p.far);
      for (let i = 0; i < 30; i++) { const x = (i * 53 - t * (4 + i % 3) + 900) % 680 - 20, y = 162 + (i * 29) % 86; rect(x, y, 14 + (i % 3) * 8, 2, i % 2 ? '#9fdcea' : '#7cc3d8'); }
      const shore = []; for (let x = 0; x <= 640; x += 16) shore.push([x, 252 + Math.sin(x * .02 + t * .8) * 5]);
      poly([[0, 360], ...shore, [640, 360]], p.near);
      for (let x = 0; x < 640; x += 16) rect(x, 250 + Math.sin(x * .02 + t * .8) * 5, 12, 3, '#ffffffcc');
      rect(0, 300, 640, 60, p.ground);
      for (let i = 0; i < 40; i++) rect((i * 37) % 640, 270 + (i * 23) % 85, 3, 2, i % 3 ? '#c9a868' : '#f6e7c0');
      for (let i = 0; i < 4; i++) { const x = 70 + i * 150, y = 318 + (i % 2) * 18; rect(x, y, 4, 12, '#e8806a'); rect(x - 4, y + 4, 12, 4, '#e8806a'); }
      for (const [x, k] of [[48, 1.1], [578, 1]]) {
        for (let s = 0; s < 9; s++) rect(x + s * 1.6 * k, 300 - s * 9 * k, 8 * k, 10 * k, s % 2 ? '#8a6a43' : '#a07c4f');
        const tx = x + 16 * k, ty = 300 - 82 * k;
        poly([[tx, ty], [tx - 38 * k, ty + 12 * k], [tx - 32 * k, ty + 18 * k]], '#3f8a55');
        poly([[tx, ty], [tx + 40 * k, ty + 10 * k], [tx + 34 * k, ty + 17 * k]], '#3f8a55');
        poly([[tx, ty], [tx - 26 * k, ty - 18 * k], [tx - 17 * k, ty - 20 * k]], '#57a466');
        poly([[tx, ty], [tx + 28 * k, ty - 16 * k], [tx + 19 * k, ty - 20 * k]], '#57a466');
        rect(tx - 5 * k, ty - 2 * k, 10 * k, 7 * k, '#6b4a2f');
      }
    } else if (type === 'storm') {
      ridge(188, 22, t * .01, p.far); ridge(222, 16, t * .015, p.mid);
      for (let i = 0; i < 9; i++) cloud((i * 97 + t * (3 + i % 3)) % 760 - 70, 18 + (i % 4) * 20, 1.6 + (i % 2) * .4, i % 2 ? '#2a3346dd' : '#323d52dd');
      const cycle = 4.6, phase = t % cycle, strike = Math.floor(t / cycle);
      const flash = phase < .08 || (phase > .16 && phase < .24);
      if (flash) {
        let x = 90 + (strike * 197) % 460, y = 30;
        for (let s = 0; s < 8; s++) { const nx = x + ((strike * 31 + s * 17) % 29) - 14; rect(Math.min(x, nx), y, Math.abs(nx - x) + 4, 4, '#fff3a8'); rect(nx, y, 4, 26, '#fff3a8'); x = nx; y += 26; }
      }
      rect(0, 262, 640, 98, p.near); rect(0, 288, 640, 72, p.ground);
      for (let i = 0; i < 150; i++) { const x = (i * 29 + Math.sin(t * 2 + i) * 2 + 640) % 640, y = 266 + (i * 17) % 90; rect(x, y, 2, 4, i % 9 === 0 ? p.accent : i % 2 ? '#4e6b52' : '#33503f'); }
      for (let i = 0; i < 5; i++) { const x = 40 + i * 140; rect(x, 214, 4, 52, '#29313c'); rect(x - 10, 214, 24, 3, '#29313c'); rect(x - 8, 222, 20, 2, '#29313c'); }
      for (let i = 0; i < 70; i++) { const x = (i * 47 - t * 60 + 900) % 680 - 20, y = (i * 67 + t * 260) % 380 - 20; rect(x, y, 1, 7, '#b9c8e077'); }
      if (flash) { wctx.fillStyle = '#fff6d02e'; wctx.fillRect(0, 0, Wd, Ht); }
    } else if (type === 'desert') {
      rect(470, 40, 56, 56, p.accent); rect(478, 34, 40, 6, '#fff8d8');
      poly([[40, 190], [60, 150], [140, 150], [160, 190]], p.far); poly([[430, 190], [445, 162], [520, 162], [540, 190]], p.far);
      ridge(196, 18, t * .01, p.far); ridge(228, 15, t * .015, p.mid); ridge(262, 10, t * .02, p.near);
      rect(0, 300, 640, 60, p.ground);
      for (let i = 0; i < 6; i++) { const y = 150 + i * 8; rect((t * 20 + i * 90) % 640, y, 60, 1, '#fff4d044'); }
      for (const [x, k] of [[90, 1.1], [300, .8], [520, 1.2]]) {
        const y = 300, c = '#5f8b4f';
        rect(x, y - 40 * k, 10 * k, 40 * k, c); rect(x - 9 * k, y - 28 * k, 6 * k, 14 * k, c); rect(x - 9 * k, y - 18 * k, 12 * k, 5 * k, c);
        rect(x + 13 * k, y - 34 * k, 6 * k, 14 * k, c); rect(x + 7 * k, y - 24 * k, 12 * k, 5 * k, c); rect(x + 3 * k, y - 38 * k, 2 * k, 30 * k, '#7aa865');
      }
      for (let i = 0; i < 36; i++) { const x = (i * 61 + t * (20 + i % 4 * 6)) % 680 - 20, y = 240 + (i * 37) % 110; rect(x, y, 3, 1, '#f6dfa8aa'); }
    } else if (type === 'canyon') {
      rect(272, 104, 96, 96, p.accent); for (let i = 0; i < 4; i++) rect(272, 140 + i * 14, 96, 4, p.sky[2]);
      for (let i = 0; i < 4; i++) { const x = (i * 173 - t * 6 + 800) % 760 - 60, y = 60 + (i % 2) * 22; rect(x, y, 6, 2, '#5a3038'); rect(x + 6, y - 2, 6, 2, '#5a3038'); rect(x + 12, y, 6, 2, '#5a3038'); }
      poly([[0, 360], [0, 96], [60, 96], [74, 150], [118, 156], [130, 230], [170, 250], [170, 360]], p.far);
      poly([[640, 360], [640, 84], [574, 84], [560, 140], [520, 146], [506, 220], [466, 246], [466, 360]], p.far);
      for (let i = 0; i < 9; i++) { rect(0, 112 + i * 26, 120 - i * 2, 3, '#93504a'); rect(530 + i * 2, 100 + i * 28, 110, 3, '#93504a'); }
      poly([[150, 250], [200, 196], [250, 196], [270, 250]], p.mid); poly([[380, 252], [400, 206], [460, 206], [480, 252]], p.mid);
      rect(0, 250, 640, 110, p.near); rect(0, 296, 640, 64, p.ground);
      poly([[250, 360], [290, 296], [350, 296], [400, 360]], p.water);
      for (let i = 0; i < 10; i++) { const y = 302 + i * 6; rect(296 - i * 4 + Math.sin(t + i) * 3, y, 14, 2, '#a7d3d6'); }
      for (let i = 0; i < 26; i++) { const x = (i * 71 + t * (4 + i % 3)) % 660 - 10, y = 120 + (i * 43) % 190; rect(x, y, 2, 2, '#ffe1a888'); }
    } else if (type === 'graveyard') {
      stars(50); rect(96, 32, 44, 44, '#e9e1c8'); rect(108, 28, 40, 40, p.sky[0]);
      ridge(196, 16, t * .006, p.far);
      for (let i = 0; i < 4; i++) { const x = 30 + i * 180; rect(x + 14, 150, 8, 70, p.mid); poly([[x + 16, 168], [x - 8, 130], [x, 126], [x + 20, 160]], p.mid); poly([[x + 20, 160], [x + 44, 128], [x + 50, 134], [x + 24, 176]], p.mid); }
      ridge(226, 10, t * .01, p.mid);
      for (let x = 0; x < 640; x += 20) { rect(x, 232, 3, 30, '#191b29'); rect(x - 1, 228, 5, 4, '#191b29'); }
      rect(0, 238, 640, 3, '#191b29'); rect(0, 252, 640, 3, '#191b29');
      rect(0, 262, 640, 98, p.near); rect(0, 296, 640, 64, p.ground);
      for (let i = 0; i < 9; i++) {
        const x = 24 + i * 70, y = 300 + (i % 3) * 14, k = .9 + (i % 2) * .2;
        if (i % 3 === 1) { rect(x + 6 * k, y - 30 * k, 6 * k, 30 * k, '#5e5a78'); rect(x, y - 24 * k, 18 * k, 5 * k, '#5e5a78'); }
        else { rect(x, y - 22 * k, 18 * k, 22 * k, '#6e6a86'); rect(x + 3 * k, y - 26 * k, 12 * k, 4 * k, '#6e6a86'); rect(x + 2 * k, y - 20 * k, 3 * k, 16 * k, '#8c88a6'); rect(x + 5 * k, y - 14 * k, 8 * k, 2 * k, '#4b4862'); }
      }
      for (let i = 0; i < 7; i++) { const x = (i * 97 + Math.sin(t * .7 + i) * 18 + 640) % 640, y = 210 + (i * 31) % 80 + Math.sin(t * 2 + i) * 5; const on = (Math.floor(t * 3) + i) % 6 !== 0; if (on) { rect(x - 3, y - 3, 10, 10, '#c9a8ff33'); rect(x, y, 4, 4, p.accent); } }
      for (let i = 0; i < 6; i++) { const x = (i * 131 + t * (i % 2 ? 4 : -2) + 700) % 700 - 25, y = 268 + (i * 19) % 60; rect(x, y, 60, 4, '#b8b2d022'); rect(x + 20, y - 6, 40, 4, '#d8d0e833'); }
    } else if (type === 'crystal') {
      stars(18);
      poly([[0, 225], [70, 190], [120, 92], [180, 214], [262, 70], [330, 214], [420, 96], [500, 222], [566, 86], [640, 200], [640, 360], [0, 360]], p.far);
      for (let i = 0; i < 10; i++) { const x = i * 70; poly([[x, 0], [x + 36, 0], [x + 18, 46 + (i % 4) * 14]], p.mid); }
      ridge(256, 10, t * .02, p.near);
      rect(0, 284, 640, 76, p.ground); rect(0, 304, 640, 56, p.water);
      for (let i = 0; i < 40; i++) { const x = (i * 43 + t * .4) % 640, y = 308 + (i * 17) % 50; rect(x, y, 16 + (i % 3) * 8, 2, i % 2 ? '#6a5aa8' : '#8a74c8'); }
      for (let i = 0; i < 9; i++) {
        const x = 18 + i * 70, y = 290 - (i % 3) * 8, h = 34 + (i % 4) * 12, pulse = (Math.sin(t * 2 + i) + 1) / 2;
        const c = i % 3 === 0 ? '#7fd3ff' : i % 3 === 1 ? '#b88cff' : '#ff8fd8';
        rect(x - 6, y - h - 6, 40, h + 10, `rgba(200,160,255,${(.05 + pulse * .1).toFixed(2)})`);
        poly([[x, y], [x + 8, y - h * .7], [x + 14, y - h], [x + 20, y - h * .7], [x + 28, y]], c);
        poly([[x + 14, y - h], [x + 20, y - h * .7], [x + 28, y], [x + 14, y]], '#ffffff55');
      }
      for (let i = 0; i < 24; i++) { const x = (i * 89 + 11) % 640, y = 120 + (i * 53) % 170; if ((i + Math.floor(t * 2.5)) % 4 === 0) { rect(x, y, 2, 6, p.accent); rect(x - 2, y + 2, 6, 2, p.accent); } }
    }
    requestAnimationFrame(drawWorld);
  }
  drawWorld = extraTerrain;

  wildlifeKey = '';
  drawResidents();
})();
