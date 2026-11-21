// Two more habitats per partner, bigger wildlife pools, more Pokémon in the sky at once, and the
// pixel scenery for these six biomes.
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

  // ---- Wildlife roaming the scene (fewer on phones so the board stays readable) ----
  // Each Pokémon keeps to a part of the scene that suits it, read from the scene itself
  // (04-pixel-world.js): fliers and floaters in open sky, below any cave ceiling and above the tallest
  // trees, pillars and buildings; walkers on the ground, in front of the land but behind the close-up
  // props; swimmers half under the water. They move with the scenery at 30 fps, on its pixel grid.
  let roamers = [], lastStep = null;
  const SPRITE_SCALE = 1; // sprites show at their own size, like everywhere else in the app
  drawResidents = function () {
    const biome = activeBiome?.type || 'meadow', key = pokemon + ':' + biome;
    if (wildlifeKey === key) return;
    wildlifeKey = key;
    ambientLayer.replaceChildren();
    roamers = [];
    const count = window.innerWidth < 700 ? 5 : 8;
    const water = Boolean(sceneLayers(biome, world.width, world.height).g.water);
    const candidates = (habitatWildlife[pokemon]?.[biome] || [])
      .map(([id, kind]) => [id, kind === S || (water && waterSpeciesIds.has(id)) ? (water ? S : FL) : kind])
      .filter(([, kind]) => kind !== 'perch');
    const shuffled = [...candidates].sort(() => Math.random() - 0.5);
    const pool = pokemon === 'charizard' && biome === 'volcano'
      ? [[218, W], ...shuffled.filter(([id]) => id !== 218).slice(0, count - 1)]
      : shuffled.slice(0, count);
    pool.forEach(([id, kind], i) => {
      const el = document.createElement('div'), img = document.createElement('img');
      el.className = 'roamer ' + kind;
      img.alt = '';
      img.draggable = false;
      img.src = `/sprites/wildlife/${id}.gif`;
      img.addEventListener('error', () => { el.remove(); roamers = roamers.filter(m => m.el !== el); });
      img.addEventListener('load', () => { el.style.visibility = ''; if (lastStep) stepResidents(...lastStep); });
      el.style.visibility = 'hidden';
      el.appendChild(img);
      ambientLayer.appendChild(el);
      // Stable random values per Pokémon: where it starts, which lane, how fast, which way.
      roamers.push({ el, img, kind, a: Math.random(), b: (i + Math.random()) / pool.length, c: Math.random(), speed: 0.7 + Math.random() * 0.6, dir: i % 2 ? -1 : 1 });
    });
  };

  const lerp = (a, b, f) => a + (b - a) * f;
  // Back and forth: 0 → 1 → 0 over one period, with the direction of travel.
  const patrol = v => { const ph = PixelKit.wrap(v, 2); return ph < 1 ? [ph, 1] : [2 - ph, -1]; };

  stepResidents = function (t, g, P) {
    lastStep = [t, g, P];
    const snap = v => Math.round(v / P) * P, vw = g.W * P;
    // Open sky (CSS px): below the ceiling and the top edge, above the tallest standing prop.
    const skyTop = Math.max(g.ceiling + 4, g.H * 0.04) * P, skyBottom = Math.min(g.reach - 4, g.hz - 8) * P;
    // Ground: the lower part of the land, where the Pokémon are seen walking toward the viewer.
    const ground = [lerp(g.hz, g.H, 0.45) * P, (g.H - 3) * P];
    const water = g.water ? [lerp(g.water[0], g.water[1], 0.35) * P, (g.water[1] - 2) * P] : null;
    for (const m of roamers) {
      const w = m.img.naturalWidth * SPRITE_SCALE, h = m.img.naturalHeight * SPRITE_SCALE;
      if (!w) continue;
      let x, y, dir, depth = 0;
      if (m.kind === 'fly') {
        // Across the whole screen and round again, bobbing gently.
        const span = vw + w * 2, run = PixelKit.wrap(m.a * span + t * 65 * m.speed, span);
        dir = m.dir;
        x = dir > 0 ? run - w : vw + w - run - w;
        y = lerp(skyTop, Math.max(skyTop, skyBottom - h), m.b) + Math.sin(t * 1.6 + m.c * 6) * 3 * P;
      } else if (m.kind === 'float') {
        // Hovering about one spot, drifting slowly.
        const drift = Math.sin(t * 0.5 * m.speed + m.c * 6);
        dir = Math.cos(t * 0.5 * m.speed + m.c * 6) > 0 ? 1 : -1;
        x = m.a * (vw - w) + drift * 70;
        y = lerp(skyTop, Math.max(skyTop, skyBottom - h), m.b) + Math.sin(t * 1.3 + m.c * 4) * 2 * P;
      } else {
        // Walking or swimming back and forth along a stretch of ground or water.
        const band = m.kind === 'swim' && water ? water : ground, range = Math.min(vw * 0.4, 120 + m.c * 180);
        const [f, d] = patrol(t * (m.kind === 'swim' ? 24 : 45) * m.speed / range + m.c * 2);
        dir = d;
        x = Math.max(0, Math.min(vw - w, m.a * (vw - w - range) + f * range));
        const feet = lerp(band[0], band[1], m.b);
        // Swimmers sit low in the water; walkers step (a one-pixel bob, like the sprites' own frames).
        const shown = m.kind === 'swim' ? Math.round(h * 0.62) : h;
        y = feet - shown - (m.kind === 'walk' && Math.floor(t * 6 + m.c * 4) % 2 ? P : 0);
        m.el.style.height = m.kind === 'swim' ? shown + 'px' : '';
        depth = Math.round(feet);
      }
      m.el.style.transform = `translate(${snap(x)}px, ${snap(y)}px)`;
      m.el.style.zIndex = String(depth);
      // The sprites face left; flip them to walk or fly right.
      m.img.style.transform = dir > 0 ? 'scaleX(-1)' : '';
    }
  };

  // ---- Scenery for these habitats (pixel scenes, see 04-pixel-world.js) ----
  const K = PixelKit, Fx = SceneFx, r = Math.round;

  SCENES.beach = {
    sky: ['#3d93dd', '#58a6e4', '#77baea', '#99ceef', '#bfe2f3'],
    pad: ['#9c7c45', '#d1b273', '#e6cd8f', '#f6e6b8'],
    paintSky(p, g) {
      K.dome(p, r(g.W * 0.8), r(g.H * 0.13), 9 * g.k + 4, 9 * g.k + 4, ['#ffd25a', '#ffe580', '#fff4bf'], '#f6b847');
      Fx.makeClouds(g, PAL.cloud, { n: Math.ceil(g.W / 170) + 2, y1: 0.24 });
    },
    paint(p, g) {
      // Sea to the horizon, a wet shoreline, then sand.
      const sea = g.hz - r(26 * g.k), shore = g.hz + r((g.H - g.hz) * 0.18);
      g.sea = [sea, shore];
      g.water = [sea + 6, shore];
      p.rect(0, sea, g.W, shore - sea, '#3c8fc8');
      p.rect(0, sea, g.W, 1, '#2a6a9c');
      for (let y = sea + 1; y < shore; y++) {
        const f = (y - sea) / (shore - sea);
        if (f < 0.25) p.rect(0, y, g.W, 1, (y & 1) ? '#4a9fd4' : '#3c8fc8');
        else p.rect(0, y, g.W, 1, f < 0.6 ? '#53acd8' : '#6cc0e0');
      }
      K.poly(p, [[r(g.W * 0.06), sea + 1], [r(g.W * 0.09), sea - r(10 * g.k)], [r(g.W * 0.16), sea - r(14 * g.k)], [r(g.W * 0.22), sea + 1]], '#5d8a8f', '#36585f');
      const edge = x => Math.sin(x * 0.04) * 2;
      p.shape(0, shore - 4, g.W, g.H, (x, y) => y >= shore + edge(x), (x, y) => {
        const d = y - shore - edge(x);
        return d < 2 ? '#ffffff' : d < 6 ? '#c9b47a' : '#e6cd8f';
      }, '#9c7c45');
      for (let i = 0; i < g.W * (g.H - shore) * 0.004; i++) p.set(r(g.rand() * g.W), shore + 8 + r(g.rand() * (g.H - shore)), g.rand() > 0.5 ? '#d1b273' : '#f6e6b8');
      // Shells and starfish.
      for (let i = 0; i < g.W / 80; i++) {
        const x = r(g.rand() * g.W), y = shore + r((12 + g.rand() * 50) * g.k);
        if (g.rand() > 0.5) K.dome(p, x, y, 3, 2, ['#e08a7a', '#f6b6a6', '#ffe0d6'], '#9a4a40', { floor: y + 1 });
        else for (const [dx, dy] of [[0, -2], [-2, 0], [2, 0], [-1, 2], [1, 2], [0, 0], [0, -1]]) p.set(x + dx, y + dy, '#f08a3a');
      }
      // Palm trees.
      const palm = (x, base, h) => {
        const lean = h * 0.18, segs = [];
        for (let i = 0; i < 6; i++) segs.push([x + (lean * i) / 6, base - (h * i) / 6, x + (lean * (i + 1)) / 6, base - (h * (i + 1)) / 6]);
        K.strokes(p, segs, Math.max(3, h * 0.11), (xx, yy) => (((base - yy) / (h / 9)) % 1 < 0.3 ? '#7a5634' : xx < x + lean * ((base - yy) / h) ? '#b88a58' : '#9a6e44'), '#4a321e');
        const tx = x + lean, ty = base - h;
        p.tall(ty - h * 0.3);
        for (const [dx, dy] of [[-1, 0.3], [1, 0.35], [-0.7, -0.4], [0.75, -0.35], [0.1, -0.6]]) {
          const fr = [], len = h * 0.55;
          for (let i = 0; i < 5; i++) {
            const a = i / 5, b = (i + 1) / 5;
            fr.push([tx + dx * len * a, ty + dy * len * a + len * 0.5 * a * a, tx + dx * len * b, ty + dy * len * b + len * 0.5 * b * b]);
          }
          K.strokes(p, fr, Math.max(2.5, h * 0.09), (xx, yy) => (yy < ty + 1 ? '#7fc65a' : '#4f9a3e'), '#24502a');
        }
        K.dome(p, tx, ty + 2, 3, 3, ['#5a3a1e', '#7a5232', '#9a6e44'], '#3a2412');
      };
      for (let x = r(g.W * 0.08); x < g.W; x += r((160 + g.rand() * 140) * g.k)) palm(x, shore + r((18 + g.rand() * 20) * g.k), r((50 + g.rand() * 20) * g.k));
      for (let x = r(g.rand() * 100); x < g.W; x += r((120 + g.rand() * 100) * g.k)) K.rock(p, x, shore + r(8 * g.k), r(14 * g.k), r(7 * g.k), PAL.stone);
    },
    behind: (ctx, t, g) => Fx.clouds(ctx, t, g),
    front(ctx, t, g) {
      const [sea, shore] = g.sea;
      Fx.shimmer(ctx, t, 0, sea + 2, g.W, shore - 3, ['#ffffff', '#b8e4f4'], Math.ceil(g.W / 14), 5);
      // Foam rolling in and out along the shoreline.
      const reach = Math.round((Math.sin(t * 1.2) + 1) * 2 * g.k);
      for (let x = 0; x < g.W; x += 6) if (K.hash(x, Math.floor(t * 2)) > 0.25) Fx.dot(ctx, x, shore - 2 - reach + Math.sin(x * 0.04) * 2, 5, 1, '#ffffff');
      Fx.each(3, 8, (i, a, b) => {
        const x = K.wrap(a * g.W + t * (10 + b * 6), g.W + 20) - 10, y = g.H * (0.12 + b * 0.2), up = Math.floor(t * 3 + i) % 2;
        Fx.dot(ctx, x - 2, y - up, 2, 1, '#ffffff'); Fx.dot(ctx, x, y, 1, 1, '#c9d6e0'); Fx.dot(ctx, x + 1, y - up, 2, 1, '#ffffff');
      });
    },
  };

  SCENES.storm = {
    sky: ['#232a3a', '#2c3547', '#384356', '#465266', '#566275'],
    pad: ['#1f2e26', '#35503f', '#42604b', '#56785e'],
    paintSky(p, g) {
      // Heavy storm clouds fill the top of the sky.
      for (let x = -20; x < g.W + 30; x += r(24 * g.k)) {
        K.blob(p, [{ x, y: r((8 + K.hash(x, 2) * 30) * g.k), r: (18 + K.hash(x, 4) * 14) * g.k }], ['#262d3c', '#323b4d', '#414b5f', '#56607a'], '#161b26', { bias: -0.05 });
      }
    },
    paint(p, g) {
      K.range(p, g.rand, { y: g.hz - r(6 * g.k), height: 34 * g.k, width: 110 * g.k, ramp: ['#1b2420', '#2e3d36', '#36473e', '#405247', '#4c6052'], round: true });
      K.ground(p, g.rand, g.hz, ['#18241d', '#2f4a36', '#3a5841', '#4c6f52'], { tufts: 0.012 });
      // Tall grass clumps and old wooden poles with a sagging wire.
      for (let x = r(g.rand() * 30); x < g.W; x += r((18 + g.rand() * 26) * g.k)) {
        const y = g.hz + r((6 + g.rand() * (g.H - g.hz - 10) / g.k) * g.k);
        for (let i = -2; i <= 2; i++) K.strokes(p, [[x + i * 2, y, x + i * 3, y - r((6 + (2 - Math.abs(i)) * 3) * g.k)]], 1.2, '#4f7a55', '#1f3324');
      }
      const poles = [];
      for (let x = r(g.W * 0.1); x < g.W + 60; x += r(150 * g.k)) poles.push(x);
      const top = g.hz - r(46 * g.k);
      for (let i = 0; i + 1 < poles.length; i++) for (let s = 0; s <= 20; s++) {
        const f = s / 20, x = poles[i] + (poles[i + 1] - poles[i]) * f;
        p.set(r(x), r(top + 3 + Math.sin(f * Math.PI) * 8 * g.k), '#111620');
      }
      p.tall(top);
      for (const x of poles) {
        p.shape(x - 1, top, x + 2, g.hz + 3, () => true, (xx) => (xx === x - 1 ? '#5a4632' : '#3e2f22'), '#161009');
        p.shape(x - r(8 * g.k), top + 2, x + r(8 * g.k), top + 4, () => true, '#3e2f22', '#161009');
      }
    },
    front(ctx, t, g) {
      // A lightning bolt every few seconds, with a white flash.
      const cycle = 4.2, phase = t % cycle, strike = Math.floor(t / cycle);
      if (phase < 0.12 || (phase > 0.2 && phase < 0.28)) {
        let x = (0.15 + K.hash(strike, 5) * 0.7) * g.W, y = 0;
        const end = g.hz - 4;
        while (y < end) {
          const nx = x + (K.hash(strike, y) - 0.5) * 16 * g.k, ny = Math.min(end, y + 10 * g.k);
          for (let s = 0; s <= 6; s++) { const f = s / 6; Fx.dot(ctx, x + (nx - x) * f - 1, y + (ny - y) * f, 3, 2, '#fff3a8'); Fx.dot(ctx, x + (nx - x) * f, y + (ny - y) * f, 1, 2, '#ffffff'); }
          x = nx; y = ny;
        }
        ctx.fillStyle = '#fff8dc22';
        ctx.fillRect(0, 0, g.W, g.H);
      }
      Fx.fall(ctx, t, g, { n: Math.ceil(g.W / 6), seed: 2, vx: -40, vy: 220, colors: ['#9fb4d0', '#c6d4e6'], w: 1, h: 4 });
    },
  };

  SCENES.desert = {
    sky: ['#e58a4f', '#eea062', '#f2b878', '#f5cd92', '#f7dfae'],
    pad: ['#9c6a38', '#c98d4f', '#ddaa68', '#f0c987'],
    paintSky(p, g) { K.dome(p, r(g.W * 0.75), r(g.H * 0.15), 13 * g.k + 4, 13 * g.k + 4, ['#ffe27a', '#fff09e', '#fffbd6'], '#f6b847'); },
    paint(p, g) {
      // Distant mesas, then rolling dunes.
      for (let x = r(g.rand() * 80); x < g.W; x += r((170 + g.rand() * 150) * g.k)) {
        const w = r((40 + g.rand() * 40) * g.k), h = r((24 + g.rand() * 20) * g.k), y = g.hz - r(14 * g.k);
        K.poly(p, [[x - w, y + 2], [x - w + 8, y - h], [x + w - 6, y - h], [x + w, y + 2]], (xx, yy) => (yy < y - h + 2 ? '#e7a676' : xx < x ? '#c9805a' : '#b06d4c'), '#6e3a2c');
      }
      K.range(p, g.rand, { y: g.hz + r(4 * g.k), height: 22 * g.k, width: 120 * g.k, ramp: ['#9c6a38', '#c98d4f', '#d69c5c', '#e6b06f', '#f6cf8f'], round: true });
      const dunes = K.range(p, g.rand, { y: g.hz + r(36 * g.k), height: 26 * g.k, width: 150 * g.k, ramp: ['#9c6a38', '#d29a5a', '#e2ad6c', '#efc282', '#fbdca0'], round: true });
      g.dunes = dunes;
      for (let i = 0; i < g.W * g.H * 0.002; i++) { const x = r(g.rand() * g.W), y = dunes[Math.min(g.W - 1, x)] + 4 + r(g.rand() * 80); p.rect(x, y, 2, 1, '#d29a5a'); }
      const cactus = (x, base, h) => {
        p.tall(base - h);
        const w = Math.max(3, r(h * 0.22)), ramp = (xx, cx) => (xx < cx - w / 4 ? '#7ab55c' : xx > cx + w / 4 ? '#3f7a3c' : '#5a9a48');
        p.shape(x - w / 2, base - h, x + w / 2, base, (xx, yy) => yy > base - h + 1 || Math.abs(xx + 0.5 - x) < w / 2 - 1, xx => ramp(xx, x), '#1f4424');
        for (const s of [-1, 1]) {
          const ax = x + s * w * 1.1, ay = base - h * (s < 0 ? 0.55 : 0.4);
          p.shape(Math.min(x, ax) - w / 3, ay - 1, Math.max(x, ax) + w / 3, ay + w / 2, () => true, '#4f8f45', '#1f4424');
          p.shape(ax - w / 3, ay - h * 0.32, ax + w / 3, ay + 1, (xx, yy) => yy > ay - h * 0.32 + 1 || Math.abs(xx + 0.5 - ax) < w / 3 - 1, xx => ramp(xx, ax), '#1f4424');
        }
        for (let yy = base - h + 3; yy < base - 2; yy += 3) p.set(x, yy, '#d8f0b0');
      };
      for (let x = r(g.W * 0.05 + g.rand() * 60); x < g.W; x += r((110 + g.rand() * 120) * g.k)) cactus(x, dunes[Math.min(g.W - 1, x)] + r((14 + g.rand() * 30) * g.k), r((22 + g.rand() * 14) * g.k));
      for (let x = r(g.rand() * 90); x < g.W; x += r((100 + g.rand() * 90) * g.k)) K.rock(p, x, dunes[Math.min(g.W - 1, x)] + r(30 * g.k), r(12 * g.k), r(6 * g.k), ['#6e3a2c', '#a8684a', '#c4825c', '#dba077', '#efc29a']);
    },
    front(ctx, t, g) {
      Fx.fall(ctx, t, g, { n: Math.ceil(g.W / 12), seed: 6, vx: 50, vy: 3, colors: ['#f7dfae', '#e2ad6c'], w: 2, h: 1, y0: g.hz - 20, y1: g.H });
      // Heat shimmer: short bright lines wobbling over the dunes.
      Fx.each(10, 12, (i, a, b) => { if (Math.floor(t * 3 + i) % 2) Fx.dot(ctx, a * g.W + Math.sin(t * 3 + i) * 3, g.hz - 6 + b * 14, 10, 1, '#fff4d8'); });
    },
  };

  SCENES.canyon = {
    sky: ['#7a3a52', '#a84f58', '#cf6c5c', '#e89068', '#f4b47c'],
    pad: ['#5a2c22', '#8c4a34', '#a85e40', '#c9805a'],
    paintSky(p, g) { K.dome(p, r(g.W * 0.5), r(g.hz - 30 * g.k), 22 * g.k + 6, 22 * g.k + 6, ['#ffb35a', '#ffd07a', '#ffe9b0'], '#e88a4a'); },
    paint(p, g) {
      // Mesas in the middle distance, and tall striped canyon walls framing both sides.
      K.range(p, g.rand, { y: g.hz - r(4 * g.k), height: 40 * g.k, width: 70 * g.k, ramp: ['#4a2230', '#7a3a3e', '#8c4644', '#9e5248', '#b4644e'], round: false, streaks: false });
      const strata = ['#c46a46', '#a85638', '#d9845a', '#8c4a34', '#b8603e'];
      const wall = (fromLeft) => {
        const w = r(Math.max(g.W * 0.22, 80 * g.k)), top = r(g.H * 0.12);
        const edge = y => w * (0.55 + 0.45 * Math.min(1, (y - top) / (g.hz - top))) + Math.sin(y * 0.2) * 3 + (K.hash(1, y >> 3) - 0.5) * 6;
        g.front.shape(fromLeft ? 0 : g.W - w - 10, top, fromLeft ? w + 10 : g.W, g.H, (x, y) => (fromLeft ? x < edge(y) : x >= g.W - edge(y)), (x, y) => {
          const d = fromLeft ? edge(y) - x : x - (g.W - edge(y));
          if (d < 3) return fromLeft ? '#7a3a2a' : '#e8a070';
          return strata[Math.floor((y + Math.sin(x * 0.05) * 3) / (9 * g.k)) % strata.length];
        }, '#3e1a16');
      };
      K.ground(p, g.rand, g.hz, ['#4a2418', '#8c4a34', '#a85e40', '#c47a52'], { tufts: 0.004, pebble: true });
      const ry = g.hz + r((g.H - g.hz) * 0.45);
      g.river = [ry, ry + r(10 * g.k)];
      p.shape(0, ry - 2, g.W, ry + r(12 * g.k), (x, y) => y >= ry + Math.sin(x * 0.03) * 2 && y < ry + r(10 * g.k) + Math.sin(x * 0.03 + 1) * 2, (x, y) => (y < ry + 2 ? '#8fd0d8' : '#4e8ea0'), '#2a4a56');
      wall(true); wall(false);
      for (let x = r(g.W * 0.3); x < g.W * 0.75; x += r((60 + g.rand() * 70) * g.k)) K.rock(p, x, g.hz + r((6 + g.rand() * 16) * g.k), r(14 * g.k), r(8 * g.k), ['#4a2418', '#8c4a34', '#a85e40', '#c47a52', '#e09a6a']);
    },
    front(ctx, t, g) {
      Fx.shimmer(ctx, t, g.W * 0.2, g.river[0] + 2, g.W * 0.8, g.river[1] - 1, ['#d8f4f8'], Math.ceil(g.W / 40), 8);
      // Birds of prey circling high up.
      Fx.each(3, 17, (i, a) => {
        const ang = t * 0.4 + i * 2.1, x = g.W * (0.35 + a * 0.3) + Math.cos(ang) * 30 * g.k, y = g.H * 0.2 + Math.sin(ang) * 10 * g.k, up = Math.floor(t * 3 + i) % 2;
        Fx.dot(ctx, x - 3, y - up, 3, 1, '#3e1a1a'); Fx.dot(ctx, x, y, 1, 1, '#3e1a1a'); Fx.dot(ctx, x + 1, y - up, 3, 1, '#3e1a1a');
      });
    },
  };

  SCENES.graveyard = {
    sky: ['#120f24', '#1c1734', '#272044', '#342a55', '#433466'],
    pad: ['#141225', '#2e2a45', '#3b3655', '#514a6e'],
    paintSky(p, g) {
      for (let i = 0; i < g.W * g.hz * 0.002; i++) p.set(r(g.rand() * g.W), r(g.rand() * g.hz * 0.8), g.rand() > 0.7 ? '#fff6d8' : '#b9b4d8');
      const mx = r(g.W * 0.2), my = r(g.H * 0.15), mr = r(12 * g.k + 5);
      K.dome(p, mx, my, mr, mr, ['#c9c2a0', '#e8e1c0', '#fffbe6'], '#8f8a74');
      K.dome(p, mx + r(mr * 0.5), my - r(mr * 0.2), mr, mr, ['#1c1734', '#1c1734'], null);
    },
    paint(p, g) {
      K.range(p, g.rand, { y: g.hz - r(8 * g.k), height: 30 * g.k, width: 120 * g.k, ramp: ['#100d20', '#1f1a34', '#262040', '#2e274c', '#3a3260'], round: true });
      for (let x = r(g.rand() * 80); x < g.W; x += r((120 + g.rand() * 80) * g.k)) K.deadTree(p, x, g.hz + 2, r((56 + g.rand() * 24) * g.k), ['#0b0916', '#251f36', '#332a48', '#45395e']);
      // An iron fence along the back.
      const fy = g.hz + r(2 * g.k), fh = r(16 * g.k);
      p.rect(0, fy - fh + 3, g.W, 1, '#161422'); p.rect(0, fy - 4, g.W, 1, '#161422');
      for (let x = 2; x < g.W; x += r(6 * g.k) + 2) { p.rect(x, fy - fh, 1, fh, '#2c2840'); p.set(x, fy - fh - 1, '#4a4466'); }
      K.ground(p, g.rand, g.hz + 2, ['#0c0a18', '#1d1a2e', '#262238', '#34304a'], { tufts: 0.006 });
      const stone = ['#24203a', '#4c4766', '#625c80', '#7d779c', '#9a95b8'];
      for (let y = g.hz + r(20 * g.k); y < g.H + 10; y += r(44 * g.k)) {
        for (let x = r(K.hash(y, 3) * 60); x < g.W; x += r((80 + K.hash(x, y) * 70) * g.k)) {
          const w = r((12 + K.hash(x, 5) * 4) * g.k), h = r((16 + K.hash(x, 6) * 8) * g.k);
          K.tomb(p, x, y, w, h, stone, K.hash(x, y) > 0.7);
        }
      }
    },
    front(ctx, t, g) {
      Fx.fog(ctx, t, g, { n: 7, y0: g.hz, y1: g.H - 8, color: '#a49ccc33', speed: 3 });
      Fx.each(6, 19, (i, a, b) => {
        const x = a * g.W + Math.sin(t * 0.5 + i * 2) * 20, y = g.hz + b * (g.H - g.hz) * 0.8 + Math.sin(t * 1.3 + i) * 5, f = Math.floor(t * 6 + i) % 2;
        Fx.dot(ctx, x - 2, y - 1, 5, 4, '#3f6aa0'); Fx.dot(ctx, x - 1, y - 3 - f, 3, 5, '#6ea8e0'); Fx.dot(ctx, x, y - 1, 1, 2, '#dcefff');
      });
      Fx.twinkle(ctx, t, g, { n: 10, colors: ['#fff6d8'], y0: 0, y1: g.hz * 0.7, drift: 0 });
    },
  };

  SCENES.crystal = {
    sky: ['#120d20', '#191229', '#211833', '#2a1e3e', '#33244a'],
    pad: ['#1a1330', '#3a2c5c', '#4a3a72', '#62508e'],
    paint(p, g) {
      for (let x = -6; x < g.W + 6; x += r((16 + g.rand() * 18) * g.k)) {
        const h = r((12 + g.rand() * 30) * g.k), w = r((6 + g.rand() * 5) * g.k);
        p.rect(x - w, 0, w * 2, 3, '#211836');
        K.poly(g.front, [[x - w, -1], [x + w, -1], [x, h]], (xx) => (xx < x ? '#4a3a72' : '#35285a'), '#0e0a18');
        g.ceiling = Math.max(g.ceiling, h);
      }
      K.range(p, g.rand, { y: g.hz + 4, height: 50 * g.k, width: 70 * g.k, ramp: ['#0e0a18', '#251c40', '#2e2350', '#3a2c62', '#4c3c7a'] });
      K.ground(p, g.rand, g.hz + 4, ['#0e0a18', '#211836', '#2a2044', '#3a2e5a'], { tufts: 0.004, pebble: true });
      const ramps = [
        ['#1c3a5e', '#3a6ab0', '#5a98e0', '#8ec8ff', '#e8f6ff'],
        ['#4a1e6a', '#7a3ab0', '#a35ad8', '#cf8cff', '#f6e6ff'],
        ['#6a1e4a', '#b03a82', '#d85aa8', '#ff8cd0', '#ffe6f4'],
      ];
      g.glows = [];
      for (let x = r(g.rand() * 30); x < g.W; x += r((40 + g.rand() * 60) * g.k)) {
        const base = g.hz + r((8 + g.rand() * (g.H - g.hz - 12) / g.k) * g.k), h = r((16 + g.rand() * 22) * g.k), ramp = ramps[r(g.rand() * 2)];
        K.crystal(p, x - r(h * 0.25), base + 1, r(h * 0.6), ramp);
        K.crystal(p, x, base, h, ramp);
        K.crystal(p, x + r(h * 0.28), base + 2, r(h * 0.5), ramp);
        g.glows.push([x, base - h, ramp[3]]);
      }
    },
    front(ctx, t, g) {
      // Crystals glint one at a time.
      g.glows.forEach(([x, y, c], i) => {
        if (Math.floor(t * 2 + i * 1.7) % 5) return;
        Fx.dot(ctx, x, y - 3, 1, 7, '#ffffff'); Fx.dot(ctx, x - 3, y, 7, 1, '#ffffff'); Fx.dot(ctx, x - 1, y - 1, 3, 3, c);
      });
      Fx.twinkle(ctx, t, g, { n: 18, colors: ['#d7a8ff', '#8ec8ff', '#ff9cd8'], y0: 0, y1: g.H, drift: 4 });
    },
  };

  // ---- Close-up props at the bottom edge ----
  SCENES.beach.fore = (p, g, x, base, s) => { K.rock(p, x, base, r(60 * g.k * s), r(30 * g.k * s), PAL.stone); K.rock(p, x + r(30 * g.k), base, r(30 * g.k), r(14 * g.k), PAL.stone); };
  SCENES.storm.fore = (p, g, x, base, s) => {
    for (let j = -5; j <= 5; j++) K.strokes(p, [[x + j * 4 * g.k, base, x + j * 6 * g.k, base - r((48 - Math.abs(j) * 6) * g.k * s)]], 2.4, j % 2 ? '#4f7a55' : '#3e6446', '#1a2a1e');
  };
  SCENES.desert.fore = (p, g, x, base, s) => K.rock(p, x, base, r(64 * g.k * s), r(30 * g.k * s), ['#6e3a2c', '#a8684a', '#c4825c', '#dba077', '#efc29a']);
  SCENES.canyon.fore = (p, g, x, base, s) => K.rock(p, x, base, r(60 * g.k * s), r(34 * g.k * s), ['#4a2418', '#8c4a34', '#a85e40', '#c47a52', '#e09a6a']);
  SCENES.graveyard.fore = (p, g, x, base, s, i) => (i % 2
    ? K.tomb(p, x, base, r(30 * g.k * s), r(46 * g.k * s), ['#24203a', '#4c4766', '#625c80', '#7d779c', '#9a95b8'], true)
    : K.deadTree(p, x, base, r(120 * g.k * s), ['#0b0916', '#251f36', '#332a48', '#45395e']));
  SCENES.crystal.fore = (p, g, x, base, s) => {
    const ramp = ['#4a1e6a', '#7a3ab0', '#a35ad8', '#cf8cff', '#f6e6ff'];
    K.crystal(p, x - r(14 * g.k), base, r(50 * g.k * s), ramp);
    K.crystal(p, x + r(4 * g.k), base, r(74 * g.k * s), ramp);
    K.crystal(p, x + r(22 * g.k), base, r(40 * g.k * s), ['#1c3a5e', '#3a6ab0', '#5a98e0', '#8ec8ff', '#e8f6ff']);
  };

  wildlifeKey = '';
  drawResidents();
})();
