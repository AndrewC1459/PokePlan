// Attack animations, one per type, drawn as pixel art in the sprites' style (outlined, shaded, crisp).
// The battle stage shows the current biome behind the fight, with a ground pad under each Pokémon.
//
// drawMove(t, type) is called by animateQuests (01-core.js) every frame of a quest's attack, with t in
// ms since the attack started. `type` is the attacker's type; physical moves (tackles, claws, bites)
// also lunge the attacker into the target. Effects grow with the attacker's level.
(() => {
  const K = PixelKit, stage = $('#attackStage'), attacker = $('#attacker'), wildImg = $('#wildMon');
  const backdrop = $('#battleBackdrop'), bctx = backdrop?.getContext('2d');
  const r = Math.round, clamp = K.clamp;
  const seg = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
  const ease = f => f * f * (3 - 2 * f);
  const PHYSICAL = new Set(['TACKLE', 'HEADBUTT', 'KARATE CHOP', 'BRICK BREAK', 'CLOSE COMBAT', 'BUG BITE', 'X-SCISSOR', 'MEGAHORN',
    'METAL CLAW', 'IRON HEAD', 'BITE', 'CRUNCH', 'DRAGON RUSH', 'WING ATTACK', 'FIRE CLAW', 'FLAME CHARGE', 'VOLT TACKLE', 'LICK',
    'SHADOW SNEAK', 'PHANTOM FORCE']);

  // ---- Sizing: the canvases hold one pixel per art pixel, like the background -------------------
  function fit(canvas) {
    const box = stage.getBoundingClientRect(), P = worldPixel;
    const W = Math.max(1, Math.ceil(box.width / P)), H = Math.max(1, Math.ceil(box.height / P));
    if (canvas.width !== W || canvas.height !== H) {
      canvas.width = W;
      canvas.height = H;
      canvas.style.width = W * P + 'px';
      canvas.style.height = H * P + 'px';
    }
    return { box, P, W, H };
  }
  // Where the attacker and the target are on the stage, in art pixels.
  function spots({ box, P, W, H }) {
    const a = attacker.getBoundingClientRect(), w = wildImg.hidden ? null : wildImg.getBoundingClientRect();
    const card = $('.target-card')?.getBoundingClientRect();
    const A = { x: (a.left + a.width / 2 - box.left) / P, y: (a.top + a.height * 0.55 - box.top) / P, feet: (a.bottom - box.top) / P - 4, w: a.width / P };
    const T = w && w.width
      ? { x: (w.left + w.width / 2 - box.left) / P, y: (w.top + w.height * 0.55 - box.top) / P, feet: (w.bottom - box.top) / P - 4, w: w.width / P }
      : card && card.width
        ? { x: (card.left - box.left) / P + 6, y: (card.top + card.height / 2 - box.top) / P, feet: null, w: 0 }
        : { x: W * 0.78, y: H * 0.48, feet: null, w: 0 };
    return { A, T };
  }

  // ---- The battle backdrop: today's biome plus a pad under each Pokémon --------------------------
  function pad(ctx, cx, cy, rx, ramp) {
    const ry = Math.max(3, r(rx * 0.3)), p = new K.Pix(r(rx * 2 + 4), ry * 2 + 4);
    K.dome(p, rx + 2, ry + 2, rx, ry, [ramp[1], ramp[2], ramp[2], ramp[3]], ramp[0]);
    // The pad's top is a lit rim, its front edge in shadow.
    p.shape(0, ry + 2, p.w, p.h, (x, y) => ((x + 0.5 - rx - 2) / (rx - 1.5)) ** 2 + ((y + 0.5 - ry - 2) / (ry - 1.5)) ** 2 > 1 && ((x + 0.5 - rx - 2) / rx) ** 2 + ((y + 0.5 - ry - 2) / ry) ** 2 <= 1, ramp[1]);
    ctx.drawImage(p.canvas(), r(cx - rx - 2), r(cy - ry - 2));
  }
  function paintBackdrop() {
    if (!bctx) return;
    const fitted = fit(backdrop), { W, H } = fitted, type = activeBiome?.type || 'meadow';
    paintScene(bctx, type, W, H, 0, { stage: true });
    const ramp = (SCENES[type] || SCENES.meadow).pad || ['#3a6a35', '#5f9a48', '#79b657', '#a5d77a'];
    const { A, T } = spots(fitted);
    pad(bctx, A.x, A.feet, Math.max(36, A.w * 0.55), ramp);
    if (T.feet) pad(bctx, T.x, T.feet, Math.max(32, T.w * 0.6), ramp);
    else if (stage.classList.contains('wild-battle')) pad(bctx, W * 0.78, H * 0.62, 44, ramp);
  }
  new MutationObserver(() => { if ($('#attackScreen').classList.contains('active')) paintBackdrop(); })
    .observe($('#attackScreen'), { attributes: true, attributeFilter: ['class'] });
  new MutationObserver(paintBackdrop).observe(wildImg, { attributes: true, attributeFilter: ['hidden'] });
  addEventListener('resize', () => { if ($('#attackScreen').classList.contains('active')) paintBackdrop(); });

  // ---- Effect sprites, built once with the pixel kit ----------------------------------------------
  const sprites = new Map();
  const sprite = (key, w, h, draw) => {
    if (!sprites.has(key)) { const p = new K.Pix(w, h); draw(p); sprites.set(key, p.canvas()); }
    return sprites.get(key);
  };
  const orb = (rad, ramp, key = '') => sprite(`orb${rad}${ramp}${key}`, rad * 2 + 4, rad * 2 + 4, p => {
    K.dome(p, rad + 2, rad + 2, rad, rad, ramp.slice(1), ramp[0]);
    p.set(rad, rad - 1, '#ffffff'); p.set(rad - 1, rad, '#ffffff');
  });
  const flame = (s, f) => sprite(`flame${s}${f}`, s * 2 + 4, s * 3 + 4, p => {
    const cx = s + 2, cy = s * 2 + 1, sway = f ? 1 : -1;
    K.blob(p, [{ x: cx, y: cy, r: s }, { x: cx + sway, y: cy - s * 0.8, r: s * 0.7 }, { x: cx + sway * 2, y: cy - s * 1.5, r: s * 0.38 }],
      ['#c8322a', '#f0642e', '#ffa53a', '#ffe066'], '#7a1a16', { bias: 0.15 });
    p.shape(cx - s * 0.5, cy - s * 0.6, cx + s * 0.5, cy + s * 0.6, (x, y) => Math.hypot(x + 0.5 - cx, (y + 0.5 - cy) * 0.8) < s * 0.42, '#fff6c0');
  });
  const leaf = (s, a) => sprite(`leaf${s}${a}`, s * 2 + 4, s * 2 + 4, p => {
    const c = s + 2, ang = (a * Math.PI) / 4, cos = Math.cos(ang), sin = Math.sin(ang);
    p.shape(0, 0, p.w, p.h, (x, y) => {
      const dx = x + 0.5 - c, dy = y + 0.5 - c, u = dx * cos + dy * sin, v = -dx * sin + dy * cos;
      return (u / s) ** 2 + (v / (s * 0.45)) ** 2 <= 1;
    }, (x, y) => {
      const dx = x + 0.5 - c, dy = y + 0.5 - c, v = -dx * sin + dy * cos;
      return Math.abs(v) < 0.6 ? '#2f6a2a' : v < 0 ? '#8fd85a' : '#5aa83e';
    }, '#1e4a1e');
  });
  const bubble = rad => sprite(`bubble${rad}`, rad * 2 + 4, rad * 2 + 4, p => {
    const c = rad + 2;
    p.shape(0, 0, p.w, p.h, (x, y) => Math.hypot(x + 0.5 - c, y + 0.5 - c) <= rad, (x, y) => (Math.hypot(x + 0.5 - c, y + 0.5 - c) > rad - 1.2 ? '#7fd0f4' : '#bfe9fb'), '#2a6a9c');
    p.set(c - r(rad * 0.45), c - r(rad * 0.45), '#ffffff'); p.set(c - r(rad * 0.45) + 1, c - r(rad * 0.45), '#ffffff');
  });
  const shard = (s, a) => sprite(`shard${s}${a}`, s * 2 + 4, s * 2 + 4, p => {
    const c = s + 2, ang = (a * Math.PI) / 4, pts = [[s, 0], [0, s * 0.4], [-s * 0.7, 0], [0, -s * 0.4]];
    K.poly(p, pts.map(([u, v]) => [c + u * Math.cos(ang) - v * Math.sin(ang), c + u * Math.sin(ang) + v * Math.cos(ang)]),
      (x, y) => ((x - c) * Math.sin(ang) - (y - c) * Math.cos(ang) < 0 ? '#e8faff' : '#8ed6f2'), '#2a7aa8');
  });
  const rockSpr = (s, k = 0) => sprite(`rock${s}${k}`, s * 2 + 4, s * 2 + 4, p => {
    K.blob(p, [{ x: s + 2, y: s + 2, r: s }, { x: s + 2 - s * 0.4, y: s + 2 + s * 0.2, r: s * 0.7 }, { x: s + 2 + s * 0.45, y: s + 2 - s * 0.1 + k, r: s * 0.65 }],
      ['#5a4a3a', '#8a7458', '#a88e6a', '#cbb38a'], '#33281e', { noise: 0.15 });
  });
  const star = (s, c, o) => sprite(`star${s}${c}`, s * 2 + 3, s * 2 + 3, p => {
    const m = s + 1;
    p.shape(0, 0, p.w, p.h, (x, y) => { const dx = Math.abs(x - m), dy = Math.abs(y - m); return dx + dy <= s && (dx <= s / 4 || dy <= s / 4 || dx + dy <= s / 2); }, c, o);
    p.set(m, m, '#ffffff');
  });
  const sludge = rad => sprite(`sludge${rad}`, rad * 2 + 6, rad * 2 + 6, p => {
    K.blob(p, [{ x: rad + 3, y: rad + 3, r: rad }, { x: rad + 3 - rad * 0.6, y: rad + 3 + rad * 0.4, r: rad * 0.55 }, { x: rad + 3 + rad * 0.55, y: rad + 3 - rad * 0.5, r: rad * 0.45 }],
      ['#5a2a7a', '#8a3ab0', '#b45ad8', '#d89cf0'], '#2e1240');
  });
  const crescent = (rad, flip) => sprite(`cres${rad}${flip}`, rad * 2 + 4, rad * 2 + 4, p => {
    const c = rad + 2, off = rad * 0.45 * (flip ? -1 : 1);
    p.shape(0, 0, p.w, p.h, (x, y) => Math.hypot(x + 0.5 - c, y + 0.5 - c) <= rad && Math.hypot(x + 0.5 - c - off, y + 0.5 - c) > rad * 0.85,
      (x, y) => (Math.hypot(x + 0.5 - c, y + 0.5 - c) > rad - 1.5 ? '#ffffff' : '#c6ecf6'), '#5a9ab8');
  });
  const fist = s => sprite(`fist${s}`, s * 2 + 4, s * 2 + 4, p => {
    const c = s + 2;
    K.blob(p, [{ x: c, y: c, r: s * 0.8 }, { x: c + s * 0.35, y: c - s * 0.25, r: s * 0.6 }, { x: c + s * 0.35, y: c + s * 0.3, r: s * 0.6 }], ['#b0603a', '#e08a5a', '#f6b48a', '#ffd8b8'], '#5a2a16');
    for (let i = -1; i <= 1; i++) p.rect(c + r(s * 0.55), c + r(i * s * 0.35), 2, 1, '#8a4a2a');
  });
  const teeth = (w, up) => sprite(`teeth${w}${up}`, w + 2, 9, p => {
    p.shape(0, 0, w + 2, 9, (x, y) => { const k = (x % 6) - 3, tip = up ? 7 - y : y - 1; return x > 0 && x < w + 1 && tip >= 0 && Math.abs(k + 0.5) <= (6 - tip) * 0.5 + 0.2; },
      (x, y) => ((x % 6) < 3 ? '#ffffff' : '#d8dce8'), '#2a2438');
  });

  // ---- Drawing helpers on the attack canvas -------------------------------------------------------
  let ctx = null;
  const blit = (img, x, y) => ctx.drawImage(img, r(x - img.width / 2), r(y - img.height / 2));
  const dot = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(r(x), r(y), w, h); };
  function line(x0, y0, x1, y1, size, c) {
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
    ctx.fillStyle = c;
    for (let i = 0; i <= n; i++) ctx.fillRect(r(x0 + ((x1 - x0) * i) / n - size / 2), r(y0 + ((y1 - y0) * i) / n - size / 2), size, size);
  }
  // A line with a dark outline and a bright core, like everything else in the sprites.
  function bold(x0, y0, x1, y1, size, out, fill, core) {
    line(x0, y0, x1, y1, size + 2, out); line(x0, y0, x1, y1, size, fill);
    if (core) line(x0, y0, x1, y1, Math.max(1, size - 2), core);
  }
  function ring(x, y, rad, size, c) {
    const n = Math.max(12, Math.ceil(rad * 6));
    ctx.fillStyle = c;
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; ctx.fillRect(r(x + Math.cos(a) * rad - size / 2), r(y + Math.sin(a) * rad - size / 2), size, size); }
  }
  // Rays and sparks bursting out of the target.
  function burst(T, f, power, colors, img) {
    if (f <= 0 || f >= 1) return;
    const n = 6 + r(power * 8), d = Z(6 + f * (14 + power * 16));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + 0.3;
      if (img) blit(img, T.x + Math.cos(a) * d, T.y + Math.sin(a) * d);
      else bold(T.x + Math.cos(a) * d * 0.55, T.y + Math.sin(a) * d * 0.55, T.x + Math.cos(a) * d, T.y + Math.sin(a) * d, Z(1), colors[0], colors[1]);
    }
    if (f < 0.6 && colors[1]) ring(T.x, T.y, Z(4 + f * 26 * (0.6 + power * 0.6)), Z(2), colors[1]);
  }
  // Energy gathering at the attacker before the move.
  function charge(A, t, c) {
    const f = seg(t, 0, 320);
    if (f >= 1) return;
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 + t * 0.004, d = Z(22 * (1 - f) + 4); dot(A.x + Math.cos(a) * d, A.y + Math.sin(a) * d, Z(2), Z(2), c); }
  }
  const lerp = (a, b, f) => a + (b - a) * f;
  const along = (g, f, arc = 0) => ({ x: lerp(g.A.x, g.T.x, f), y: lerp(g.A.y, g.T.y, f) - Math.sin(f * Math.PI) * arc });

  // ---- One animation per type ---------------------------------------------------------------------
  // Each gets g = { t, A, T, W, H, power (0..1 with level), frame, physical } and draws one frame.
  // Z(n) scales a size or distance to the stage (art sizes are designed for a ~120px tall stage).
  let zoom = 1;
  const Z = n => Math.max(1, r(n * zoom));
  const TYPES = {
    normal(g) {
      if (!g.physical) { // Hyper Beam style: a thick beam.
        const f = seg(g.t, 300, 700), fade = seg(g.t, 1100, 1300);
        if (f > 0 && fade < 1) { const e = along(g, f); bold(g.A.x, g.A.y, e.x, e.y, Z(3 + g.power * 3), '#b0602a', '#ffd86a', '#ffffff'); }
      }
      burst(g.T, seg(g.t, g.physical ? 620 : 700, 1250), g.power, ['#8a6a2a', '#fff4c0'], star(Z(4), '#fff4c0', '#8a6a2a'));
    },
    fire(g) {
      charge(g.A, g.t, '#ff8a3d');
      const f = ease(seg(g.t, 250, 800));
      if (!g.physical && f > 0 && f < 1) {
        for (let i = 5; i >= 1; i--) { const q = along(g, Math.max(0, f - i * 0.05), Z(10)), s = Z(i > 2 ? 2 : 3); dot(q.x - s / 2, q.y - s / 2, s, s, i % 2 ? '#ffd166' : '#ff8a3d'); }
        const q = along(g, f, Z(10));
        blit(flame(Z(4 + g.power * 3), g.frame % 2), q.x, q.y - Z(3));
      }
      // Impact: a row of flames flickering up around the target.
      const hit = seg(g.t, 720, 1350);
      if (hit > 0 && hit < 1) {
        const n = 3 + r(g.power * 3);
        for (let i = 0; i < n; i++) {
          const x = g.T.x + (i - (n - 1) / 2) * Z(7), rise = Math.sin(hit * Math.PI) * Z(6 + (i % 2) * 4);
          blit(flame(Z(3 + g.power * 2 + (i % 2)), (g.frame + i) % 2), x, g.T.y + Z(8) - rise);
        }
      }
    },
    water(g) {
      charge(g.A, g.t, '#7fd0f4');
      // A stream of bubbles arcing into the target, then a splash.
      const n = 6 + r(g.power * 6);
      for (let i = 0; i < n; i++) {
        const f = seg(g.t, 200 + i * 45, 700 + i * 45);
        if (f <= 0 || f >= 1) continue;
        const q = along(g, ease(f), Z(14));
        blit(bubble(Z(2 + (i % 3 === 0) + (g.power > 0.5))), q.x + Math.sin(g.t * 0.02 + i) * Z(2), q.y);
      }
      const hit = seg(g.t, 750, 1300);
      if (hit > 0 && hit < 1) for (let i = 0; i < 9; i++) {
        const a = Math.PI + (i / 8) * Math.PI, d = hit * Z(12 + g.power * 10);
        blit(bubble(Z(1.5 + (i % 2))), g.T.x + Math.cos(a) * d, g.T.y + Math.sin(a) * d + hit * hit * Z(14));
      }
    },
    grass(g) {
      // Spinning leaves curving in from above and below.
      const n = 4 + r(g.power * 5);
      for (let i = 0; i < n; i++) {
        const f = ease(seg(g.t, 150 + i * 60, 750 + i * 60));
        if (f <= 0 || f >= 1) continue;
        const q = along(g, f, (i % 2 ? 1 : -1) * Z(12 + i * 2));
        blit(leaf(Z(4 + g.power * 2), (g.frame + i) % 4), q.x, q.y);
      }
      const hit = seg(g.t, 800, 1350);
      if (hit > 0 && hit < 1) for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2, d = Z(4 + hit * 22);
        blit(leaf(Z(3), (i + g.frame) % 4), g.T.x + Math.cos(a) * d, g.T.y + Math.sin(a) * d + hit * Z(8));
      }
    },
    electric(g) {
      charge(g.A, g.t, '#ffe45d');
      if (!g.physical) {
        // A jagged bolt that flickers between two shapes as it reaches the target.
        const f = seg(g.t, 220, 620), fade = seg(g.t, 1150, 1350);
        if (f > 0 && fade < 1) {
          const n = 7, pts = [];
          for (let i = 0; i <= n; i++) {
            const q = along(g, (i / n) * f), j = i === 0 || i === n ? 0 : ((i + g.frame) % 2 ? 1 : -1) * Z(4 + g.power * 5);
            pts.push([q.x, q.y + j]);
          }
          for (let i = 0; i < n; i++) bold(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], Z(2 + g.power * 2), '#8a6a10', '#ffe45d', '#ffffff');
        }
      }
      const hit = seg(g.t, 650, 1300);
      if (hit > 0 && hit < 1) {
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2 + g.frame, d = Z(6 + hit * 16), x = g.T.x + Math.cos(a) * d, y = g.T.y + Math.sin(a) * d;
          bold(x, y, x + Z(3), y - Z(4), Z(1), '#8a6a10', '#ffe45d'); bold(x + Z(3), y - Z(4), x + Z(5), y + Z(1), Z(1), '#8a6a10', '#ffe45d');
        }
        if (g.frame % 2 && hit < 0.4) { ctx.fillStyle = '#fff6b022'; ctx.fillRect(0, 0, g.W, g.H); }
      }
    },
    ice(g) {
      charge(g.A, g.t, '#bfefff');
      const n = 3 + r(g.power * 4);
      for (let i = 0; i < n; i++) {
        const f = ease(seg(g.t, 220 + i * 70, 720 + i * 70));
        if (f <= 0 || f >= 1) continue;
        const q = along(g, f, (i - n / 2) * Z(3));
        blit(shard(Z(5 + g.power * 3), 0), q.x, q.y);
      }
      // Impact: ice crystals snap shut around the target.
      const hit = seg(g.t, 820, 1400);
      if (hit > 0 && hit < 1) for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2, d = Z(20 - Math.min(1, hit * 3) * 8);
        blit(shard(Z(5), (i * 2 + 4) % 8), g.T.x + Math.cos(a) * d, g.T.y + Math.sin(a) * d);
        if (hit > 0.4) blit(star(Z(3), '#e8faff', '#2a7aa8'), g.T.x + Math.cos(a + 0.5) * (d + Z(6)), g.T.y + Math.sin(a + 0.5) * (d + Z(6)));
      }
    },
    fighting(g) {
      if (!g.physical) {
        const f = ease(seg(g.t, 250, 720));
        if (f > 0 && f < 1) { const q = along(g, f); blit(fist(Z(6 + g.power * 3)), q.x, q.y); }
      }
      const hit = seg(g.t, 680, 1200);
      if (hit > 0 && hit < 1) {
        blit(fist(Z(7 + g.power * 3)), g.T.x - Z(6) + hit * Z(4), g.T.y);
        burst(g.T, hit, g.power, ['#7a2a16', '#ffcf6a']);
      }
    },
    poison(g) {
      charge(g.A, g.t, '#b45ad8');
      const n = 3 + r(g.power * 3);
      for (let i = 0; i < n; i++) {
        const f = ease(seg(g.t, 220 + i * 90, 760 + i * 90));
        if (f > 0 && f < 1) { const q = along(g, f, Z(20 + i * 4)); blit(sludge(Z(4 + g.power * 2)), q.x, q.y); }
      }
      // Purple bubbles rise and pop over the target.
      const hit = seg(g.t, 800, 1450);
      if (hit > 0 && hit < 1) for (let i = 0; i < 7; i++) {
        const life = (hit * 1.6 + i / 7) % 1, x = g.T.x + (i - 3) * Z(5) + Math.sin(i + g.t * 0.01) * Z(2), y = g.T.y + Z(8) - life * Z(24);
        if (life < 0.85) blit(orb(Z(1.5 + (i % 2)), ['#2e1240', '#8a3ab0', '#b45ad8', '#d89cf0']), x, y);
        else blit(star(Z(2), '#d89cf0', '#2e1240'), x, y);
      }
    },
    ground(g) {
      // Rocks burst out of the ground in a line toward the target, then the ground shakes.
      const n = 5 + r(g.power * 3), feet = g.T.feet ?? g.T.y + Z(16);
      for (let i = 0; i < n; i++) {
        const f = seg(g.t, 250 + i * 70, 650 + i * 70);
        if (f <= 0 || f >= 1) continue;
        const x = lerp(g.A.x + Z(10), g.T.x, (i + 1) / n), y = lerp(g.A.feet ?? g.A.y + Z(16), feet, (i + 1) / n);
        blit(rockSpr(Z(3 + (i % 2) + g.power * 2), i % 3), x, y - Math.sin(f * Math.PI) * Z(8 + i));
        dot(x - Z(4), y + 1, Z(8), 1, '#5a4a3a');
      }
      const hit = seg(g.t, 800, 1300);
      stage.style.setProperty('--quake', hit > 0 && hit < 1 && g.frame % 2 ? (g.frame % 4 < 2 ? '3px' : '-3px') : '0px');
      if (hit > 0 && hit < 1) for (let k = 0; k < 5; k++) dot(g.T.x - Z(12) + k * Z(6), feet - Z(2) - ((k + g.frame) % 2) * Z(3), Z(2), Z(2), '#a88e6a');
    },
    flying(g) {
      // Gusts: white wind crescents, then feathers drifting past the target.
      const n = 3 + r(g.power * 3);
      for (let i = 0; i < n; i++) {
        const f = ease(seg(g.t, 200 + i * 90, 700 + i * 90));
        if (f > 0 && f < 1) { const q = along(g, f, (i % 2 ? -1 : 1) * Z(10)); blit(crescent(Z(5 + g.power * 3), i % 2), q.x, q.y); }
      }
      const hit = seg(g.t, 750, 1400);
      if (hit > 0 && hit < 1) for (let i = 0; i < 5; i++) {
        const x = g.T.x + (i - 2) * Z(7) + Math.sin(g.t * 0.008 + i) * Z(4), y = g.T.y - Z(10) + hit * Z(26) + (i % 2) * Z(4);
        bold(x, y, x + Z(4), y - Z(2), Z(1), '#5a6a7a', '#ffffff');
      }
    },
    psychic(g) {
      // Pink rings pulse out from the attacker to the target, which then wobbles inside them.
      for (let i = 0; i < 4 + r(g.power * 2); i++) {
        const f = seg(g.t, 200 + i * 110, 700 + i * 110);
        if (f <= 0 || f >= 1) continue;
        const q = along(g, f);
        ring(q.x, q.y, Z(3 + f * 6 + g.power * 3), Z(2), i % 2 ? '#ff7ab8' : '#ffc0e0');
      }
      const hit = seg(g.t, 750, 1400);
      if (hit > 0 && hit < 1) {
        ring(g.T.x, g.T.y, Z(10 + Math.sin(hit * Math.PI * 4) * 3 + g.power * 4), Z(2), '#ff7ab8');
        ring(g.T.x, g.T.y, Z(16 + Math.sin(hit * Math.PI * 4 + 1) * 3 + g.power * 5), Z(1), '#ffc0e0');
        wildImg.style.translate = hit < 0.9 ? `${(g.frame % 2 ? 1 : -1) * 2}px 0` : '';
      } else wildImg.style.translate = '';
    },
    bug(g) {
      if (!g.physical) {
        const f = ease(seg(g.t, 250, 750));
        if (f > 0 && f < 1) { const q = along(g, f, Z(8)); blit(orb(Z(3 + g.power * 2), ['#2e4a12', '#6a9a1e', '#9acc2e', '#d0f070']), q.x, q.y); }
      }
      // X-Scissor: two green slashes crossing over the target.
      const hit = seg(g.t, 650, 1200);
      if (hit > 0 && hit < 1) {
        const s = Z(12 + g.power * 8), a = Math.min(1, hit * 2.5);
        bold(g.T.x - s, g.T.y - s, g.T.x - s + 2 * s * a, g.T.y - s + 2 * s * a, Z(2), '#1e3a0e', '#9acc2e', '#e8ffb0');
        if (hit > 0.25) bold(g.T.x + s, g.T.y - s, g.T.x + s - 2 * s * a, g.T.y - s + 2 * s * a, Z(2), '#1e3a0e', '#9acc2e', '#e8ffb0');
      }
    },
    rock(g) {
      // Boulders drop onto the target from above, kicking up dust.
      const n = 3 + r(g.power * 3);
      for (let i = 0; i < n; i++) {
        const f = seg(g.t, 300 + i * 110, 700 + i * 110), x = g.T.x + (i - (n - 1) / 2) * Z(9);
        if (f <= 0) continue;
        if (f < 1) blit(rockSpr(Z(4 + (i % 2) + g.power * 2), i % 3), x, lerp(-Z(10), g.T.y, f * f));
        else if (g.t < 700 + i * 110 + 220) for (let k = 0; k < 4; k++) dot(x - Z(6) + k * Z(4), g.T.y + Z(6) - (k % 2) * Z(3), Z(2), Z(2), '#a88e6a');
      }
    },
    ghost(g) {
      charge(g.A, g.t, '#a88aff');
      if (!g.physical) {
        const f = ease(seg(g.t, 250, 800));
        if (f > 0 && f < 1) {
          for (let i = 1; i <= 5; i++) { const q = along(g, Math.max(0, f - i * 0.045)), s = Z(2); dot(q.x - s / 2 + Math.sin(g.t * 0.02 + i) * Z(2), q.y - s / 2, s, s, i % 2 ? '#7a5ad0' : '#3a2a6a'); }
          const q = along(g, f);
          blit(orb(Z(5 + g.power * 3), ['#1e1238', '#3a2a6a', '#5a3fa0', '#8f6ee0'], 'g'), q.x, q.y);
        }
      }
      const hit = seg(g.t, 750, 1350);
      if (hit > 0 && hit < 1) {
        burst(g.T, hit, g.power, ['#1e1238', '#a88aff']);
        if (g.frame % 2) blit(orb(Z(3), ['#1e1238', '#3a2a6a', '#5a3fa0', '#8f6ee0'], 'g'), g.T.x, g.T.y);
      }
    },
    dragon(g) {
      charge(g.A, g.t, '#8a7aff');
      const f = ease(seg(g.t, 250, 820));
      if (f > 0 && f < 1) {
        // A spiralling pulse: two orbs winding around the path.
        for (const s of [1, -1]) {
          const q = along(g, f), w = Math.sin(f * Math.PI * 4) * Z(6) * s;
          blit(orb(Z(3 + g.power * 2), ['#1a1a5a', '#3a3ab0', '#6a5ae8', '#a89cff'], 'd'), q.x, q.y + w);
        }
      }
      const hit = seg(g.t, 800, 1350);
      if (hit > 0 && hit < 1) { ring(g.T.x, g.T.y, Z(4 + hit * 20), Z(2), '#6a5ae8'); ring(g.T.x, g.T.y, Z(2 + hit * 12), Z(1), '#ff8a5a'); burst(g.T, hit, g.power, ['#1a1a5a', '#a89cff']); }
    },
    dark(g) {
      if (!g.physical) {
        const f = ease(seg(g.t, 250, 750));
        if (f > 0 && f < 1) { const q = along(g, f); for (let i = 0; i < 3; i++) ring(q.x, q.y, Z(3 + i * 3 + f * 3), Z(1), i % 2 ? '#2a2234' : '#6a5a7a'); }
      }
      // Bite: jaws snap shut on the target.
      const hit = seg(g.t, 650, 1250);
      if (hit > 0 && hit < 1) {
        const w = Z(18 + g.power * 8), gap = Z(14) * (1 - Math.min(1, hit * 3)) + 1;
        blit(teeth(w, false), g.T.x, g.T.y - gap - 4);
        blit(teeth(w, true), g.T.x, g.T.y + gap + 4);
        if (hit > 0.35) burst(g.T, (hit - 0.35) / 0.65, g.power, ['#1a1420', '#9a86b0']);
      }
    },
    steel(g) {
      if (!g.physical) {
        const f = seg(g.t, 300, 650), fade = seg(g.t, 1050, 1250);
        if (f > 0 && fade < 1) { const e = along(g, f); bold(g.A.x, g.A.y, e.x, e.y, Z(2 + g.power * 3), '#3a4a5a', '#b8c8d8', '#ffffff'); }
      }
      // Metal claw marks and glints.
      const hit = seg(g.t, 680, 1250);
      if (hit > 0 && hit < 1) {
        const a = Math.min(1, hit * 2.5), s = Z(10 + g.power * 6);
        for (let i = -1; i <= 1; i++) bold(g.T.x - s + i * Z(5), g.T.y - s, g.T.x - s + i * Z(5) + s * 2 * a * 0.6, g.T.y - s + s * 2 * a, Z(1), '#3a4a5a', '#e8f0f8');
        if (g.frame % 2) for (let i = 0; i < 3; i++) blit(star(Z(3), '#ffffff', '#5a6a7a'), g.T.x + (i - 1) * Z(12), g.T.y - Z(12) + (i % 2) * Z(18));
      }
    },
    fairy(g) {
      charge(g.A, g.t, '#ffb0e0');
      const f = ease(seg(g.t, 250, 820));
      if (f > 0 && f < 1) {
        const q = along(g, f, Z(12));
        blit(orb(Z(5 + g.power * 3), ['#8a2a6a', '#e070b0', '#ff9cd0', '#ffe0f2'], 'f'), q.x, q.y);
        for (let i = 0; i < 4; i++) { const a = g.t * 0.01 + (i * Math.PI) / 2; blit(star(Z(2), '#fff6a8', '#8a6a2a'), q.x + Math.cos(a) * Z(10), q.y + Math.sin(a) * Z(10)); }
      }
      const hit = seg(g.t, 800, 1400);
      if (hit > 0 && hit < 1) burst(g.T, hit, g.power, [], star(Z(3), g.frame % 2 ? '#ffe0f2' : '#fff6a8', '#8a2a6a'));
    },
  };

  // ---- The frame loop -----------------------------------------------------------------------------
  let geo = null, startedAt = -1;
  drawMove = function (t, type) {
    const p = battler() || {}, move = String(p.move || '').replaceAll('!', '').trim().toUpperCase(), physical = PHYSICAL.has(move);
    const level = p.level ?? levelNow(), power = clamp((level - 1) / 49, 0, 1);
    const fitted = fit(attackCanvas);
    // Work out the positions once per attack (the lunge moves the attacker afterwards).
    if (startedAt !== window.attackStart) {
      startedAt = window.attackStart;
      geo = spots(fitted);
      paintBackdrop();
      stage.style.setProperty('--quake', '0px');
      wildImg.style.translate = '';
    }
    zoom = clamp(fitted.H / 120, 1, 3.6);
    ctx = actx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, fitted.W, fitted.H);
    attacker.style.setProperty('--attacker-scale', (0.82 + power * 0.35).toFixed(2));
    attacker.style.setProperty('--attacker-brightness', (1 + power * 0.25).toFixed(2));
    // Physical moves: dash in, hit, dash back (steps of whole art pixels).
    stage.classList.toggle('physical-attack', physical);
    if (physical) {
      const dash = t < 260 ? 0 : t < 640 ? (t - 260) / 380 : t < 880 ? 1 - (t - 640) / 240 : 0;
      attacker.style.setProperty('--lunge-x', r((geo.T.x - geo.A.x) * 0.55 * ease(clamp(dash, 0, 1))) * fitted.P + 'px');
    }
    (TYPES[type] || TYPES.normal)({ t, A: geo.A, T: geo.T, W: fitted.W, H: fitted.H, power, frame: Math.floor(t / 70), physical });
    if (t < 1700) attackRaf = requestAnimationFrame(() => drawMove(performance.now() - window.attackStart, type));
    else { stage.classList.remove('physical-attack'); attacker.style.removeProperty('--lunge-x'); stage.style.setProperty('--quake', '0px'); wildImg.style.translate = ''; }
  };
})();
