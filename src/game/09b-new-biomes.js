// Update 2.0: four more biomes, one each for the types that used to borrow another's scenery:
// Frosted Tundra (Ice), Summit Dojo (Fighting), Iron Works (Steel) and Fairy Glade (Fairy).
// They aren't any starter's home; they're registered under `wild` so the team script (11-team.js)
// adds them to the shared biome list and every trainer can visit them with a lead of that type.
// The scenery uses the same 640×360 pixel grid and helpers as 09-more-habitats.js.
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

  const palettes = {
    tundra: { sky: ['#8fb8d8', '#b9d4e8', '#dfeaf3'], far: '#c3d5e6', mid: '#a6c0d6', near: '#eef4f8', ground: '#dbe7f0', accent: '#ffffff', ice: '#a9dcef' },
    dojo: { sky: ['#ee9f63', '#f5c286', '#fbe1b2'], far: '#a87878', mid: '#86606a', near: '#c9a46a', ground: '#b38955', accent: '#fff0c0' },
    foundry: { sky: ['#6e7987', '#8b95a1', '#b5ad9c'], far: '#4c5561', mid: '#5c6570', near: '#6a7179', ground: '#555b63', accent: '#ffcf4a' },
    glade: { sky: ['#c6b3e6', '#e4c6ec', '#fae1ef'], far: '#b6d5c3', mid: '#9ccaae', near: '#bde2c6', ground: '#a3d4af', accent: '#fff6a8' },
  };

  const baseTerrain = drawWorld;
  function newTerrain() {
    const type = activeBiome?.type, p = palettes[type];
    if (!p) return baseTerrain();
    const Wd = world.width, Ht = world.height, sx = Wd / 640, sy = Ht / 360, t = performance.now() / 1000, g = 4;
    wctx.setTransform(1, 0, 0, 1, 0, 0);
    wctx.imageSmoothingEnabled = false;
    wctx.clearRect(0, 0, Wd, Ht);
    const snap = n => Math.round(n / g) * g;
    // Round the edges, not the size, so neighbouring blocks always meet (no 1px gaps between bands).
    const rect = (x, y, w, h, c) => { const X = Math.round(x * sx), Y = Math.round(y * sy); wctx.fillStyle = c; wctx.fillRect(X, Y, Math.max(1, Math.round((x + w) * sx) - X), Math.max(1, Math.round((y + h) * sy) - Y)); };
    const poly = (pts, c) => { wctx.beginPath(); wctx.moveTo(snap(pts[0][0]) * sx, snap(pts[0][1]) * sy); for (let i = 1; i < pts.length; i++) wctx.lineTo(snap(pts[i][0]) * sx, snap(pts[i][1]) * sy); wctx.closePath(); wctx.fillStyle = c; wctx.fill(); };
    const ridge = (y, amp, phase, c, step = 16) => { const pts = [[0, 360]]; for (let x = 0; x <= 640; x += step) pts.push([x, y + Math.sin(x * .018 + phase) * amp + Math.sin(x * .043 + phase * .7) * amp * .22]); pts.push([640, 360]); poly(pts, c); };
    const cloud = (x, y, k, c) => { rect(x, y, 38 * k, 8 * k, c); rect(x + 8 * k, y - 8 * k, 23 * k, 8 * k, c); rect(x + 23 * k, y + 8 * k, 25 * k, 5 * k, c); };
    // A pixel line made of square blocks, for girders and banner poles.
    const line = (x1, y1, x2, y2, c, size = 3) => { const n = Math.max(1, Math.ceil(Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1)) / 3)); for (let i = 0; i <= n; i++) rect(x1 + (x2 - x1) * i / n, y1 + (y2 - y1) * i / n, size, size, c); };
    const sparkle = (x, y, c) => { rect(x, y - 3, 2, 8, c); rect(x - 3, y, 8, 2, c); };

    for (let y = 0; y < 360; y += 12) rect(0, y, 640, 12, y < 52 ? p.sky[0] : y < 112 ? p.sky[1] : p.sky[2]);

    if (type === 'tundra') {
      rect(462, 40, 40, 40, '#fff7e4'); rect(454, 48, 56, 24, '#fff7e455');
      for (let i = 0; i < 5; i++) cloud((i * 151 + t * (1.2 + i * .2)) % 760 - 68, 30 + (i % 3) * 22, .8, '#ffffffaa');
      // Far peaks with snow caps.
      const peaks = [[0, 214], [64, 150], [116, 196], [184, 112], [252, 198], [324, 140], [400, 204], [472, 118], [544, 192], [604, 148], [640, 176]];
      poly([[0, 360], ...peaks, [640, 360]], p.far);
      for (const [x, y] of peaks) if (y < 160) poly([[x - 22, y + 24], [x, y], [x + 22, y + 24], [x + 10, y + 18], [x, y + 26], [x - 10, y + 18]], '#ffffff');
      ridge(236, 10, t * .01, p.mid);
      rect(0, 262, 640, 98, p.near); rect(0, 304, 640, 56, p.ground);
      // Frozen pond.
      poly([[236, 304], [290, 290], [410, 290], [462, 304], [410, 318], [290, 318]], p.ice);
      for (let i = 0; i < 4; i++) rect(290 + i * 34, 298 + (i % 2) * 8, 22, 2, '#ffffffcc');
      // Snowy pines.
      for (const [x, k] of [[40, 1.2], [118, .9], [520, 1.1], [598, 1.3]]) {
        rect(x + 8 * k, 300 - 10 * k, 6 * k, 12 * k, '#6b4f3a');
        for (let s = 0; s < 3; s++) {
          const top = 300 - 64 * k + s * 18 * k, half = (14 + s * 7) * k;
          poly([[x + 11 * k - half, top + 22 * k], [x + 11 * k, top], [x + 11 * k + half, top + 22 * k]], '#2f5d55');
          poly([[x + 11 * k - half * .6, top + 10 * k], [x + 11 * k, top], [x + 11 * k + half * .6, top + 10 * k]], '#ffffff');
        }
      }
      for (let i = 0; i < 20; i++) if ((i + Math.floor(t * 2)) % 5 === 0) rect((i * 71 + 13) % 640, 270 + (i * 29) % 80, 2, 2, '#ffffff');
      // Falling snow.
      for (let i = 0; i < 90; i++) { const x = (i * 47 + Math.sin(t * .8 + i) * 12 + 660) % 660 - 10, y = (i * 67 + t * (16 + (i % 5) * 6)) % 380 - 20; rect(x, y, i % 3 ? 2 : 3, i % 3 ? 2 : 3, '#ffffffdd'); }
    } else if (type === 'dojo') {
      rect(286, 112, 76, 76, p.accent); rect(278, 120, 92, 60, '#fff0c044');
      for (let i = 0; i < 4; i++) cloud((i * 173 + t * (1.5 + i * .3)) % 780 - 80, 28 + (i % 2) * 26, .9, '#fde6c4bb');
      ridge(188, 26, t * .004, p.far); ridge(226, 14, t * .007, p.mid);
      rect(0, 258, 640, 102, p.near); rect(0, 304, 640, 56, p.ground);
      for (let i = 0; i < 36; i++) rect((i * 53) % 640, 266 + (i * 19) % 88, 3, 2, i % 2 ? '#b6915a' : '#dcbc85');
      // The dojo: walls, frame, two-tier roof with upturned eaves, steps.
      const dx = 392;
      rect(dx, 214, 168, 52, '#ecdfc2');
      for (let i = 0; i <= 6; i++) rect(dx + i * 27, 214, 4, 52, '#7a4a2c');
      rect(dx, 238, 168, 3, '#7a4a2c'); rect(dx + 64, 228, 40, 38, '#4a3428');
      poly([[dx - 22, 216], [dx + 190, 216], [dx + 166, 194], [dx + 2, 194]], '#3d3949');
      rect(dx - 26, 210, 8, 6, '#3d3949'); rect(dx + 186, 210, 8, 6, '#3d3949');
      rect(dx + 30, 180, 108, 14, '#ecdfc2');
      poly([[dx + 16, 182], [dx + 152, 182], [dx + 136, 164], [dx + 32, 164]], '#3d3949');
      rect(dx + 12, 176, 6, 6, '#3d3949'); rect(dx + 150, 176, 6, 6, '#3d3949');
      for (let s = 0; s < 3; s++) rect(dx + 56 - s * 8, 266 + s * 6, 56 + s * 16, 6, s % 2 ? '#a99d8c' : '#bdb2a1');
      // Banners on poles, waving.
      for (const bx of [338, 604]) {
        rect(bx, 168, 4, 98, '#5d3a24'); rect(bx - 2, 164, 8, 6, '#c9a24a');
        for (let i = 0; i < 6; i++) { const wave = Math.sin(t * 3 + i * .7 + bx) * 3; rect(bx + 4 + i * 5, 176 + wave, 5, 40, i === 2 ? '#f6ead0' : '#c4423a'); }
      }
      // Wooden training posts.
      for (const [x, k] of [[70, 1], [160, .9]]) {
        rect(x, 300 - 56 * k, 10 * k, 56 * k, '#8a5a36'); rect(x - 12 * k, 300 - 42 * k, 34 * k, 5 * k, '#8a5a36');
        rect(x - 2 * k, 300 - 52 * k, 14 * k, 8 * k, '#a8744a'); rect(x - 2 * k, 300 - 22 * k, 14 * k, 8 * k, '#a8744a');
      }
      // Leaves drifting on the wind.
      for (let i = 0; i < 26; i++) { const x = (i * 79 + t * (30 + (i % 4) * 8)) % 700 - 30, y = (i * 41 + Math.sin(t * 1.5 + i) * 14 + t * 10) % 300 + 20; rect(x, y, 4, 2, i % 3 ? '#e07b4a' : '#f2b24e'); }
    } else if (type === 'foundry') {
      rect(120, 46, 36, 36, '#d8cfb8aa');
      // Factory skyline with sawtooth roofs and smokestacks.
      for (const [x, w, h] of [[0, 120, 88], [140, 90, 70], [330, 130, 96], [500, 140, 80]]) {
        rect(x, 230 - h, w, h + 40, p.far);
        for (let s = 0; s < w; s += 22) poly([[x + s, 230 - h], [x + s + 22, 230 - h - 14], [x + s + 22, 230 - h]], p.far);
      }
      const stacks = [[96, 92], [262, 120], [446, 110], [586, 96]];
      for (const [x, h] of stacks) {
        rect(x, 230 - h - 40, 16, h + 40, '#3c434d');
        for (let b = 0; b < 3; b++) rect(x, 230 - h - 32 + b * 22, 16, 5, b % 2 ? '#e6e1d6' : '#b84a3a');
        if ((Math.floor(t * 2) + x) % 3) rect(x + 6, 230 - h - 46, 4, 4, '#ff5a4a');
        // Smoke puffs drifting up and away.
        for (let k = 0; k < 5; k++) {
          const ph = (t * .22 + k * .2 + x * .001) % 1, size = 8 + ph * 22;
          rect(x + 8 + ph * 46 - size / 2, 230 - h - 44 - ph * 110, size, size * .7, `rgba(210,206,198,${(.55 - ph * .5).toFixed(2)})`);
        }
      }
      // Steel girder framework.
      rect(0, 236, 640, 6, p.mid); rect(0, 252, 640, 4, p.mid);
      for (let x = 0; x < 640; x += 64) { rect(x, 236, 6, 30, p.mid); line(x, 242, x + 64, 252, '#7d8792'); line(x, 252, x + 64, 242, '#7d8792'); }
      rect(0, 264, 640, 96, p.near); rect(0, 312, 640, 48, p.ground);
      // Hazard stripe and a moving conveyor of crates.
      for (let x = 0; x < 640; x += 16) rect(x, 300, 8, 6, p.accent), rect(x + 8, 300, 8, 6, '#2b2f35');
      rect(0, 286, 640, 8, '#2b2f35');
      for (let x = 0; x < 640; x += 12) rect((x + t * 30) % 640, 288, 4, 2, '#4a5058');
      for (let i = 0; i < 6; i++) { const x = (i * 128 + t * 30) % 760 - 60; rect(x, 266, 26, 20, '#a5643f'); rect(x + 2, 268, 22, 2, '#c07a50'); rect(x + 11, 266, 4, 20, '#7d4a2e'); }
      // Welding sparks now and then.
      if (Math.floor(t * 4) % 5 < 2) for (let i = 0; i < 6; i++) rect(214 + Math.sin(t * 30 + i) * 10, 250 + Math.cos(t * 23 + i) * 8, 2, 2, i % 2 ? '#ffe08a' : '#ffffff');
    } else if (type === 'glade') {
      rect(480, 36, 46, 46, '#fff8dc'); rect(470, 46, 66, 26, '#fff8dc66');
      for (let i = 0; i < 5; i++) cloud((i * 149 + t * (1.3 + i * .25)) % 760 - 70, 26 + (i % 3) * 24, .8, i % 2 ? '#ffd9eabb' : '#ffffffaa');
      ridge(198, 18, t * .006, p.far); ridge(232, 12, t * .01, p.mid);
      rect(0, 262, 640, 98, p.near); rect(0, 304, 640, 56, p.ground);
      // Giant toadstools with a soft pulsing glow.
      for (const [x, k, cap] of [[44, 1.3, '#f08cb4'], [150, .8, '#b98cf0'], [470, 1, '#f5a0c8'], [574, 1.4, '#9cc4f5']]) {
        const pulse = (Math.sin(t * 1.6 + x) + 1) / 2;
        rect(x - 30 * k, 300 - 74 * k, 84 * k, 58 * k, `rgba(255,220,240,${(.08 + pulse * .12).toFixed(2)})`);
        rect(x + 4 * k, 300 - 40 * k, 16 * k, 40 * k, '#f6eedc');
        poly([[x - 18 * k, 300 - 38 * k], [x - 8 * k, 300 - 62 * k], [x + 12 * k, 300 - 70 * k], [x + 32 * k, 300 - 62 * k], [x + 42 * k, 300 - 38 * k]], cap);
        for (const [ox, oy] of [[-4, -50], [10, -60], [24, -48], [6, -44]]) rect(x + ox * k, 300 + oy * k, 5 * k, 4 * k, '#fff6fb');
      }
      // Flowers swaying in the grass.
      const petals = ['#ff9ec8', '#fff1a0', '#a8d4ff', '#ffffff', '#d6b0ff'];
      for (let i = 0; i < 46; i++) {
        const x = (i * 53 + 17) % 640, y = 276 + (i * 31) % 78, sway = Math.round(Math.sin(t * 2 + i) * 1.5);
        rect(x + 1, y + 3, 2, 6, '#6aa878'); rect(x + sway - 1, y, 6, 4, petals[i % petals.length]); rect(x + sway + 1, y + 1, 2, 2, '#ffd36a');
      }
      // Twinkles and floating light motes.
      for (let i = 0; i < 22; i++) if ((i + Math.floor(t * 3)) % 4 === 0) sparkle((i * 89 + 11) % 640, 70 + (i * 53) % 190, i % 2 ? p.accent : '#ffffff');
      for (let i = 0; i < 18; i++) { const x = (i * 97 + Math.sin(t * .6 + i) * 20 + 640) % 640, y = 300 - ((t * (8 + i % 4 * 3) + i * 41) % 200); rect(x, y, 3, 3, i % 2 ? '#fff6a8cc' : '#ffd1ecbb'); }
    }
  }
  drawWorld = newTerrain;

  wildlifeKey = '';
  drawResidents();
})();
