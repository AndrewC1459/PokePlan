// Update 2.0: four more biomes, one each for the types that used to borrow another's scenery:
// Frosted Tundra (Ice), Summit Dojo (Fighting), Iron Works (Steel) and Fairy Glade (Fairy).
// They aren't any starter's home; they're registered under `wild` so the team script (11-team.js)
// adds them to the shared biome list and every trainer can visit them with a lead of that type.
// Their pixel scenery uses the kit in 04-pixel-world.js.
(() => {
  habitatList.wild = [
    { name: 'Frosted Tundra', description: 'Snow drifts over frozen ponds.', type: 'tundra' },
    { name: 'Summit Dojo', description: 'Banners snap in the mountain wind.', type: 'dojo' },
    { name: 'Iron Works', description: 'Smokestacks hum over the steel yard.', type: 'foundry' },
    { name: 'Fairy Glade', description: 'Toadstools glow among the flowers.', type: 'glade' },
  ];
  const W = 'walk', F = 'fly', FL = 'float';
  habitatWildlife.wild = {
    tundra: [[86, W], [87, W], [124, W], [131, W], [144, F], [215, W], [220, W], [221, W], [225, F], [238, W], [361, W], [363, W], [459, W], [582, FL], [613, W], [615, FL]],
    dojo: [[56, W], [66, W], [106, W], [107, W], [214, F], [236, W], [296, W], [307, W], [447, W], [532, W], [538, W], [539, W], [619, W]],
    foundry: [[81, FL], [227, F], [303, W], [304, W], [374, FL], [379, W], [436, FL], [597, W], [599, FL], [622, W], [624, W], [632, W]],
    glade: [[12, F], [35, W], [113, W], [173, W], [175, W], [187, FL], [209, W], [280, W], [298, W], [439, W], [546, FL], [548, W]],
  };

  const K = PixelKit, Fx = SceneFx, r = Math.round;

  SCENES.tundra = {
    sky: ['#7ea9d6', '#93b9de', '#a9c9e6', '#c1d9ee', '#dbe9f5'],
    pad: ['#7d93ad', '#bccde0', '#d8e5f1', '#ffffff'],
    paintSky(p, g) {
      K.dome(p, r(g.W * 0.72), r(g.H * 0.13), 8 * g.k + 4, 8 * g.k + 4, ['#fff1c8', '#fff8e4', '#ffffff'], '#e8d6a8');
      Fx.makeClouds(g, PAL.cloud, { n: Math.ceil(g.Wu / 180) + 2, y1: 0.22 });
    },
    paint(p, g) {
      const snow = ['#c4d6ea', '#ffffff'];
      K.range(p, g.rand, { y: g.hz - r(10 * g.k), height: 110 * g.k, width: 90 * g.k, ramp: ['#3e5270', '#62789a', '#7590b0', '#8eaac8', '#b0c8e0'], snow, cap: 0.45 });
      K.range(p, g.rand, { y: g.hz + 2, height: 30 * g.k, width: 100 * g.k, ramp: ['#6d86a6', '#bccde0', '#cfdcea', '#e4edf6', '#ffffff'], round: true });
      for (let x = r(g.rand() * 30); x < g.W; x += r((30 + g.rand() * 50) * g.k)) {
        K.pine(p, x, g.hz + r((4 + g.rand() * 8) * g.k), r((30 + g.rand() * 20) * g.k), ['#173a38', '#24524c', '#2f665c', '#3c7a6a'], ['#2a1e18', '#4a3424'], snow);
      }
      K.ground(p, g.rand, g.hz + r(8 * g.k), ['#7d93ad', '#c4d6ea', '#e2ecf6', '#ffffff'], { u: g.u, tufts: 0.002, pebble: true });
      // A frozen pond with cracks and a shine.
      const px = r(g.W * 0.62), py = g.hz + r((g.H - g.hz) * 0.5), pw = r(Math.min(g.W * 0.2, 90 * g.k));
      K.dome(p, px, py, pw, r(9 * g.k), ['#6aa8cc', '#8cc4e0', '#b0dcf0', '#d8f0fa'], '#4a7a9a');
      K.strokes(p, [[px - pw * 0.4, py - 2, px - pw * 0.1, py + 2], [px - pw * 0.1, py + 2, px + pw * 0.2, py - 1]], 1, '#ffffff');
      for (let x = r(g.rand() * 80); x < g.W; x += r((90 + g.rand() * 90) * g.k)) K.rock(p, x, g.hz + r((16 + g.rand() * 60) * g.k), r(14 * g.k), r(7 * g.k), ['#4a5a70', '#8a9ab0', '#a8b8cc', '#d8e4f0', '#ffffff']);
    },
    behind: (ctx, t, g) => Fx.clouds(ctx, t, g),
    front(ctx, t, g) {
      Fx.fall(ctx, t, g, { n: Math.ceil(g.Wu / 7), seed: 8, vx: 6, vy: 18, colors: ['#ffffff', '#e4eef8'], sway: 6 });
      Fx.fall(ctx, t, g, { n: Math.ceil(g.Wu / 30), seed: 9, vx: 10, vy: 28, colors: ['#ffffff'], w: 2, h: 2, sway: 8 });
    },
  };

  SCENES.dojo = {
    sky: ['#e2794f', '#ec9460', '#f3ae72', '#f7c88c', '#fadcaa'],
    pad: ['#8a6440', '#bc9460', '#cfa870', '#e6c68e'],
    paintSky(p, g) {
      K.dome(p, r(g.W * 0.2), r(g.hz - 40 * g.k), 18 * g.k + 4, 18 * g.k + 4, ['#ffd27a', '#ffe59e', '#fff4d0'], '#f0a050');
      Fx.makeClouds(g, ['#c9805a', '#f0c49a', '#fbdcbc', '#fff2e0'], { n: Math.ceil(g.Wu / 180) + 2, y1: 0.24 });
    },
    paint(p, g) {
      K.range(p, g.rand, { y: g.hz - r(6 * g.k), height: 90 * g.k, width: 100 * g.k, ramp: ['#4a2e3a', '#7a4f5a', '#8c5c64', '#a06c70', '#b88080'] });
      K.range(p, g.rand, { y: g.hz + 2, height: 24 * g.k, width: 90 * g.k, ramp: ['#3a4a2c', '#5a7040', '#68804a', '#7a9456', '#94ae6a'], round: true });
      K.ground(p, g.rand, g.hz + r(6 * g.k), ['#5a3e24', '#a8804e', '#c49a62', '#dcb67a'], { u: g.u, tufts: 0.004, pebble: true });
      // The dojo: plaster walls with timber frames, a two-tier roof with upturned eaves, and steps.
      const dx = r(g.W * 0.66), base = g.hz + r(10 * g.k), w = r(64 * g.k), wh = r(26 * g.k);
      g.dojo = [dx, base, w];
      p.tall(base - wh - r(40 * g.k));
      p.shape(dx - w, base - wh, dx + w, base, () => true, (x, y) => {
        const i = Math.floor((x - (dx - w)) / (16 * g.k));
        if (Math.abs(x - (dx - w + i * 16 * g.k)) < 1.5 || y === base - wh + r(10 * g.k)) return '#6a3e24';
        return Math.abs(x - dx) < 12 * g.k && y > base - wh + 12 * g.k ? '#3e2a20' : '#efe2c4';
      }, '#3a2214');
      const roof = (y, half, h) => K.poly(p, [[dx - half - 6 * g.k, y + 3], [dx - half - 9 * g.k, y - 2], [dx - half + 6 * g.k, y - h], [dx + half - 6 * g.k, y - h], [dx + half + 9 * g.k, y - 2], [dx + half + 6 * g.k, y + 3]],
        (x, yy) => (yy < y - h + 3 ? '#5c5a76' : yy > y - 1 ? '#2a2838' : '#45435c'), '#1c1a28');
      roof(base - wh, w + 8 * g.k, 14 * g.k);
      p.shape(dx - w * 0.6, base - wh - 26 * g.k, dx + w * 0.6, base - wh - 12 * g.k, () => true, '#efe2c4', '#3a2214');
      roof(base - wh - 24 * g.k, w * 0.7, 12 * g.k);
      p.shape(dx - 5 * g.k, base - wh - 40 * g.k, dx + 5 * g.k, base - wh - 34 * g.k, () => true, '#d8a840', '#5a3e14');
      for (let s = 0; s < 3; s++) p.shape(dx - 14 * g.k - s * 3, base + s * 3, dx + 14 * g.k + s * 3, base + s * 3 + 3, () => true, s % 2 ? '#a89c8a' : '#c4b8a4', '#4a4238');
      // Wooden training posts.
      for (let x = r(g.W * 0.08); x < dx - w - 30 * g.k; x += r((60 + g.rand() * 40) * g.k)) {
        const y = g.hz + r((20 + g.rand() * 30) * g.k), h = r(34 * g.k);
        p.shape(x - 3 * g.k, y - h, x + 3 * g.k, y, () => true, (xx) => (xx < x ? '#b07a4a' : '#8a5a36'), '#3e2414');
        p.shape(x - 10 * g.k, y - h * 0.75, x + 10 * g.k, y - h * 0.75 + 3 * g.k, () => true, '#8a5a36', '#3e2414');
        p.shape(x - 4 * g.k, y - h * 0.35, x + 4 * g.k, y - h * 0.35 + 5 * g.k, () => true, '#e8d8b0', '#3e2414');
      }
      g.poles = [dx - w - r(22 * g.k), dx + w + r(22 * g.k)].filter(x => x > 4 && x < g.W - 4);
      for (const x of g.poles) p.shape(x - 1, base - r(56 * g.k), x + 2, base, () => true, '#5a3a22', '#2a180c');
    },
    behind: (ctx, t, g) => Fx.clouds(ctx, t, g),
    front(ctx, t, g) {
      // Banners snapping in the wind: each column moves with its own phase.
      const [, base] = g.dojo;
      for (const x of g.poles) for (let i = 0; i < 6; i++) {
        const wave = Math.round(Math.sin(t * 6 + i * 0.9 + x) * 2 * g.k), y = base - r(52 * g.k) + wave, h = r(24 * g.k);
        Fx.dot(ctx, x + (2 + i * 3) * g.px, y - g.px, 3 * g.px, h + 2 * g.px, '#4a1a16');
        Fx.dot(ctx, x + (2 + i * 3) * g.px, y, 3 * g.px, h, i === 2 || i === 3 ? '#f6ead0' : '#c4423a');
      }
      Fx.fall(ctx, t, g, { n: Math.ceil(g.Wu / 30), seed: 10, vx: 30, vy: 10, colors: ['#e07b4a', '#f2b24e', '#c4423a'], w: 2, h: 1, sway: 10 });
    },
  };

  SCENES.foundry = {
    sky: ['#55606e', '#66717e', '#7a838c', '#949a9c', '#aeaea4'],
    pad: ['#2e3238', '#50565e', '#60666e', '#7a8088'],
    paintSky(p, g) { Fx.makeClouds(g, ['#56606a', '#868e96', '#a0a6ac', '#bcc0c2'], { n: Math.ceil(g.Wu / 150) + 2, y1: 0.25, speed: 1.5 }); },
    paint(p, g) {
      // Factory halls with sawtooth roofs, lit windows, and striped smokestacks.
      g.stacks = [];
      for (let x = r(-g.rand() * 40); x < g.W; x += r((80 + g.rand() * 60) * g.k)) {
        const w = r((50 + g.rand() * 40) * g.k), h = r((30 + g.rand() * 40) * g.k), top = g.hz - h;
        p.tall(top);
        p.shape(x, top, x + w, g.hz + 2, (xx, yy) => yy >= top + (((xx - x) % r(14 * g.k)) * 0.6), (xx, yy) => (yy < top + 10 * g.k && ((xx - x) % r(14 * g.k)) < 3 ? '#7a828e' : '#4c535e'), '#22262e');
        for (let wy = top + r(14 * g.k); wy < g.hz - 6; wy += r(10 * g.k)) for (let wx = x + 4; wx < x + w - 6; wx += r(9 * g.k)) {
          p.shape(wx, wy, wx + r(5 * g.k), wy + r(4 * g.k), () => true, K.hash(wx, wy) > 0.35 ? '#ffd86a' : '#2e3440', '#22262e');
        }
        if (g.rand() > 0.35) {
          const sx = x + r(w * (0.2 + g.rand() * 0.6)), sh = h + r((30 + g.rand() * 30) * g.k), sw = r(8 * g.k);
          p.shape(sx, g.hz - sh, sx + sw, g.hz, () => true, (xx, yy) => {
            const band = Math.floor((yy - (g.hz - sh)) / (6 * g.k));
            if (band === 1 || band === 3) return band === 1 ? '#c4423a' : '#e8e4da';
            return xx < sx + sw / 3 ? '#5e6672' : '#434a55';
          }, '#1e2228');
          g.stacks.push([sx + sw / 2, g.hz - sh]);
          p.tall(g.hz - sh);
        }
      }
      // Steel girders and a hazard-striped walkway.
      const gy = g.hz + r(6 * g.k), gh = r(14 * g.k);
      p.rect(0, gy, g.W, 2, '#3a4048'); p.rect(0, gy + gh, g.W, 2, '#3a4048');
      for (let x = 0; x < g.W; x += r(28 * g.k)) {
        K.strokes(p, [[x, gy, x + 28 * g.k, gy + gh], [x, gy + gh, x + 28 * g.k, gy]], 1.6, '#6a7480');
        p.rect(x, gy, 2, gh, '#3a4048');
      }
      K.ground(p, g.rand, gy + gh + 2, ['#1e2228', '#3e444c', '#4a5058', '#5e646c'], { u: g.u, tufts: 0.004, pebble: true });
      const sy = gy + gh + r(8 * g.k);
      for (let x = 0; x < g.W; x += 8) { p.rect(x, sy, 4, 3, '#f2c230'); p.rect(x + 4, sy, 4, 3, '#2a2e34'); }
      g.belt = sy + 4;
      p.rect(0, g.belt + 6, g.W, 3, '#2a2e34');
    },
    behind: (ctx, t, g) => Fx.clouds(ctx, t, g),
    front(ctx, t, g) {
      for (const [x, y] of g.stacks) {
        Fx.each(4, r(x), (i) => {
          const life = (t * 0.3 + i / 4) % 1, s = r((4 + life * 12) * g.k);
          Fx.dot(ctx, x - s / 2 + life * 24 * g.k, y - 3 - life * 50 * g.k, s, r(s * 0.7), life < 0.5 ? '#9aa0a6' : '#b8bcbe');
        });
        if (Math.floor(t * 2 + x) % 3) Fx.blk(ctx, x, y, 0, -2, 1, 1, '#ff5a4a');
      }
      // Crates riding the conveyor.
      const s = r(9 * g.k);
      for (let i = 0; i * 60 * g.k < g.W + 60; i++) {
        const x = K.wrap(i * 60 * g.k + t * 20 * g.u, g.W + 60 * g.u) - 30 * g.u;
        Fx.dot(ctx, x - 1, g.belt - s, s + 2, s + 1, '#3e2414'); Fx.dot(ctx, x, g.belt - s + 1, s, s - 1, '#b07a4a'); Fx.dot(ctx, x, g.belt - s + 1, s, 1, '#d8a070');
      }
      if (Math.floor(t * 4) % 5 < 2) Fx.each(6, Math.floor(t * 8), (i, a, b) => Fx.blk(ctx, g.W * 0.3 + (a - 0.5) * 12 * g.u, g.hz + (4 + (b - 0.5) * 8) * g.u, 0, 0, 1, 1, i % 2 ? '#ffe08a' : '#ffffff'));
    },
  };

  SCENES.glade = {
    sky: ['#b89ae0', '#cba8e6', '#ddb9ea', '#edcbec', '#f9dfef'],
    pad: ['#5a8a68', '#8cc49c', '#a3d4af', '#c4ecca'],
    paintSky(p, g) {
      K.dome(p, r(g.W * 0.78), r(g.H * 0.13), 9 * g.k + 4, 9 * g.k + 4, ['#fff2c0', '#fffae0', '#ffffff'], '#f0d090');
      Fx.makeClouds(g, ['#c79ad0', '#f6d6ee', '#ffeaf6', '#ffffff'], { n: Math.ceil(g.Wu / 170) + 2, y1: 0.25 });
    },
    paint(p, g) {
      K.range(p, g.rand, { y: g.hz - r(8 * g.k), height: 40 * g.k, width: 110 * g.k, ramp: ['#6a8a92', '#9cc0c4', '#acd0cc', '#bfded4', '#d6eee0'], round: true });
      const hills = K.range(p, g.rand, { y: g.hz + 2, height: 22 * g.k, width: 80 * g.k, ramp: ['#4a7a5a', '#7ab48a', '#8cc49c', '#a3d4af', '#c4ecca'], round: true });
      for (let x = r(g.rand() * 60); x < g.W; x += r((90 + g.rand() * 60) * g.k)) K.tree(p, x, hills[Math.min(g.W - 1, Math.max(0, x))] + 4, r((7 + g.rand() * 3) * g.k), ['#5a4a7a', '#8a6ab0', '#b08ad0', '#d4b0ec', '#f0d8ff'], ['#4a3424', '#7a5634', '#9a7048']);
      K.ground(p, g.rand, g.hz, ['#4a7a5a', '#7ab48a', '#9ccca8', '#c4ecca'], { u: g.u, tufts: 0.006 });
      // Giant toadstools and flowers.
      const caps = [['#7a2a4a', '#c44a7a', '#e870a0', '#ff9cc4', '#ffd6e8'], ['#4a2a7a', '#7a4ac4', '#9c70e8', '#c49cff', '#ecdcff'], ['#2a4a7a', '#4a7ac4', '#70a0e8', '#9cc4ff', '#dcecff']];
      g.caps = [];
      for (let x = r(g.rand() * 60); x < g.W; x += r((80 + g.rand() * 80) * g.k)) {
        const base = g.hz + r((10 + g.rand() * 50) * g.k), s = r((9 + g.rand() * 6) * g.k), ramp = caps[Math.floor(g.rand() * 3)];
        p.shape(x - s * 0.35, base - s * 1.3, x + s * 0.35, base, () => true, (xx) => (xx < x ? '#fffaf0' : '#e8dcc8'), '#8a7a6a');
        K.dome(p, x, base - s * 1.2, s, s * 0.8, ramp.slice(1), ramp[0], { floor: base - s * 1.05 });
        for (const [dx, dy] of [[-0.45, -0.45], [0.2, -0.65], [0.5, -0.3]]) p.rect(r(x + dx * s), r(base - s * 1.2 + dy * s * 0.8), 2, 2, '#ffffff');
        g.caps.push([x, base - s * 1.2, s]);
        p.tall(base - s * 2);
      }
      const petals = ['#ff9ec8', '#fff1a0', '#a8d4ff', '#ffffff', '#d6b0ff'];
      for (let i = 0; i < g.W * (g.H - g.hz) * 0.003 / g.u; i++) {
        const x = r(g.rand() * g.W), y = g.hz + 4 + r(g.rand() * (g.H - g.hz - 4)), c = petals[i % petals.length];
        p.set(x, y + 1, '#4a7a5a'); p.set(x - 1, y, c); p.set(x + 1, y, c); p.set(x, y - 1, c); p.set(x, y, '#ffd36a');
      }
    },
    behind: (ctx, t, g) => Fx.clouds(ctx, t, g),
    front(ctx, t, g) {
      Fx.twinkle(ctx, t, g, { n: 22, colors: ['#fff6a8', '#ffffff', '#ffc4ec'], y0: g.H * 0.15, y1: g.H, drift: 5, plus: true });
      Fx.fall(ctx, t, g, { n: Math.ceil(g.Wu / 30), seed: 12, vx: 4, vy: -8, colors: ['#ffd1ec', '#fff6a8'], sway: 6 });
    },
  };

  // ---- Close-up props at the bottom edge ----
  SCENES.tundra.fore = (p, g, x, base, s) => {
    K.pine(p, x, base + r(6 * g.k), r(110 * g.k * s), ['#173a38', '#24524c', '#2f665c', '#3c7a6a'], ['#2a1e18', '#4a3424'], ['#c4d6ea', '#ffffff']);
    K.rock(p, x + r(34 * g.k), base, r(34 * g.k), r(16 * g.k), ['#4a5a70', '#8a9ab0', '#a8b8cc', '#d8e4f0', '#ffffff']);
  };
  SCENES.dojo.fore = (p, g, x, base, s) => K.bush(p, x, base, r(66 * g.k * s), ['#2a3a1e', '#4a6a30', '#5e8240', '#7a9e52']);
  SCENES.foundry.fore = (p, g, x, base, s) => {
    const w = r(28 * g.k * s), h = r(36 * g.k * s);
    p.shape(x - w / 2, base - h, x + w / 2, base, () => true, (xx, yy) => (yy < base - h + 3 ? '#6a7480' : (yy - (base - h)) % r(9 * g.k) < 2 ? '#2e343c' : xx < x - w / 4 ? '#5a636e' : '#4a525c'), '#1a1e24');
    p.shape(x + w / 2 + 2, base - r(22 * g.k), x + w / 2 + r(26 * g.k), base, () => true, (xx, yy) => (Math.abs(xx - (x + w / 2 + r(13 * g.k))) < 2 || yy === base - r(12 * g.k) ? '#7d4a2e' : '#b07a4a'), '#3e2414');
  };
  SCENES.glade.fore = (p, g, x, base, s) => {
    const sz = r(26 * g.k * s);
    p.shape(x - sz * 0.35, base - sz * 1.4, x + sz * 0.35, base, () => true, (xx) => (xx < x ? '#fffaf0' : '#e8dcc8'), '#8a7a6a');
    K.dome(p, x, base - sz * 1.3, sz, sz * 0.8, ['#c44a7a', '#e870a0', '#ff9cc4', '#ffd6e8'], '#7a2a4a', { floor: base - sz * 1.12 });
    for (const [dx, dy] of [[-0.45, -0.45], [0.2, -0.65], [0.5, -0.3]]) p.rect(r(x + dx * sz), r(base - sz * 1.3 + dy * sz * 0.8), 3, 3, '#ffffff');
  };

  wildlifeKey = '';
  drawResidents();
})();
