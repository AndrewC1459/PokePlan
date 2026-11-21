// The world in pixel art, drawn in the same style as the Gen V sprites: 1px outlines in a dark shade
// of each object's own colour, 3–5 tone colour ramps lit from the top left, and crisp pixels.
//
// - PixelKit: drawing on a pixel buffer (shapes with outlines, lit blobs, ridges, trees, rocks, ...).
//   The attack art (07-attacks.js) builds its effect sprites with it too.
// - SCENES: one entry per biome type. `paint` draws the still landscape once into a cached layer;
//   `behind` / `front` animate the moving parts (clouds, water, particles) each frame.
// - drawWorld: paints the current biome (activeBiome) on the background canvas, at 15 fps so the
//   motion steps like sprite animation. paintScene renders any biome at any size (the battle stage).
// Biome types and wildlife are listed in 02-habitats.js, 09-more-habitats.js and 09b-new-biomes.js.

// Aquatic species swim along the waterline instead of using aerial paths.
const waterSpeciesIds = new Set([54, 60, 72, 118, 129, 130, 183, 194, 283]);

const PixelKit = (() => {
  const colors = new Map();
  // '#rrggbb' or '#rrggbbaa' → a 32-bit pixel for the ImageData buffer (little-endian ABGR).
  function pixel(hex) {
    let v = colors.get(hex);
    if (v === undefined) {
      const n = parseInt(hex.slice(1, 7), 16), a = hex.length > 7 ? parseInt(hex.slice(7, 9), 16) : 255;
      v = ((a << 24) | ((n & 0xff) << 16) | (n & 0xff00) | ((n >> 16) & 0xff)) >>> 0;
      colors.set(hex, v);
    }
    return v;
  }

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  // A stable 0..1 value per pixel (or per particle), so textures never shimmer between frames.
  function hash(x, y) {
    let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  // Seeded random numbers, so a biome always looks the same.
  function rng(seed) {
    let a = 0;
    for (const ch of String(seed)) a = Math.imul(a ^ ch.charCodeAt(0), 2654435761);
    return () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const pick = (ramp, v) => ramp[clamp(Math.floor(v * ramp.length), 0, ramp.length - 1)];
  const wrap = (v, m) => ((v % m) + m) % m;

  // Light comes from the top left and a little in front, like the sprites.
  const L = [-0.42, -0.62, 0.66];
  function sphere(cx, cy, rx, ry, x, y) {
    const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry, nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
    return clamp(nx * L[0] + ny * L[1] + nz * L[2], 0, 1);
  }

  class Pix {
    constructor(w, h) {
      this.w = w;
      this.h = h;
      this.img = new ImageData(Math.max(1, w), Math.max(1, h));
      this.d = new Uint32Array(this.img.data.buffer);
      this.reach = h; // top of the tallest standing prop (trees, pillars, ...), so flying wildlife stays above it
    }
    tall(y) { if (y < this.reach) this.reach = Math.round(y); }
    set(x, y, c) {
      if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.d[y * this.w + x] = pixel(c);
    }
    rect(x, y, w, h, c) {
      x = Math.round(x); y = Math.round(y);
      const v = pixel(c), x0 = Math.max(0, x), x1 = Math.min(this.w, x + Math.round(w)), y1 = Math.min(this.h, y + Math.round(h));
      if (x1 <= x0) return;
      for (let j = Math.max(0, y); j < y1; j++) this.d.fill(v, j * this.w + x0, j * this.w + x1);
    }
    // Fill every pixel in the box where inside(x, y) holds, with `fill` (a colour, or (x, y) => colour),
    // then give the shape a 1px `outline` on the outside pixels that touch it.
    shape(x0, y0, x1, y1, inside, fill, outline) {
      x0 = Math.max(-1, Math.floor(x0)); y0 = Math.max(-1, Math.floor(y0));
      x1 = Math.min(this.w + 1, Math.ceil(x1)); y1 = Math.min(this.h + 1, Math.ceil(y1));
      const bw = x1 - x0 + 2, bh = y1 - y0 + 2;
      if (bw <= 2 || bh <= 2) return;
      const m = new Uint8Array(bw * bh);
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if (inside(x, y)) m[(y - y0 + 1) * bw + x - x0 + 1] = 1;
      const solid = typeof fill === 'string';
      for (let j = 1; j < bh - 1; j++) for (let i = 1; i < bw - 1; i++) {
        if (m[j * bw + i]) this.set(x0 + i - 1, y0 + j - 1, solid ? fill : fill(x0 + i - 1, y0 + j - 1));
      }
      if (!outline) return;
      for (let j = 0; j < bh; j++) for (let i = 0; i < bw; i++) {
        const at = j * bw + i;
        if (m[at]) continue;
        if ((i > 0 && m[at - 1]) || (i < bw - 1 && m[at + 1]) || (j > 0 && m[at - bw]) || (j < bh - 1 && m[at + bw])) this.set(x0 + i - 1, y0 + j - 1, outline);
      }
    }
    canvas() {
      const c = document.createElement('canvas');
      c.width = this.img.width;
      c.height = this.img.height;
      c.getContext('2d').putImageData(this.img, 0, 0);
      return c;
    }
  }

  // ---- Shapes --------------------------------------------------------------------------------
  // A bumpy blob made of circles (tree tops, bushes, clouds, smoke): each pixel is lit by the circle
  // it sits deepest in, which gives the clustered, rounded shading of sprite art.
  function blob(p, circles, ramp, outline, { noise = 0, floor = Infinity, bias = 0 } = {}) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const c of circles) {
      x0 = Math.min(x0, c.x - c.r); y0 = Math.min(y0, c.y - c.r);
      x1 = Math.max(x1, c.x + c.r); y1 = Math.max(y1, c.y + c.r);
    }
    const deepest = (x, y) => {
      let best = null, depth = 0;
      for (const c of circles) {
        const d = c.r - Math.hypot(x + 0.5 - c.x, y + 0.5 - c.y);
        if (d > depth) { depth = d; best = c; }
      }
      return best;
    };
    p.shape(x0, y0, x1 + 1, Math.min(y1 + 1, floor), (x, y) => y < floor && deepest(x, y), (x, y) => {
      const c = deepest(x, y);
      const v = sphere(c.x, c.y, c.r, c.r, x, y) + bias + (noise ? (hash(x, y) - 0.5) * noise : 0);
      return pick(ramp, v);
    }, outline);
  }

  // An ellipse lit like a dome (rocks, ponds of light, battle pads). Cut flat at `floor` if given.
  function dome(p, cx, cy, rx, ry, ramp, outline, { floor = Infinity, noise = 0, bias = 0 } = {}) {
    p.shape(cx - rx, cy - ry, cx + rx + 1, Math.min(cy + ry + 1, floor),
      (x, y) => y < floor && ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1,
      (x, y) => pick(ramp, sphere(cx, cy, rx, ry, x, y) + bias + (noise ? (hash(x, y) - 0.5) * noise : 0)), outline);
  }

  function insidePoly(pts, x, y) {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i], [xj, yj] = pts[j];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }
  function poly(p, pts, fill, outline) {
    const xs = pts.map(q => q[0]), ys = pts.map(q => q[1]);
    p.shape(Math.min(...xs), Math.min(...ys), Math.max(...xs) + 1, Math.max(...ys) + 1, (x, y) => insidePoly(pts, x + 0.5, y + 0.5), fill, outline);
  }

  // Thick lines (branches, poles, cracks): every pixel within w/2 of one of the segments.
  function strokes(p, segs, w, fill, outline) {
    const xs = segs.flatMap(s => [s[0], s[2]]), ys = segs.flatMap(s => [s[1], s[3]]), r = w / 2;
    const near = (x, y) => segs.some(([ax, ay, bx, by]) => {
      const dx = bx - ax, dy = by - ay, len = dx * dx + dy * dy || 1;
      const k = clamp(((x + 0.5 - ax) * dx + (y + 0.5 - ay) * dy) / len, 0, 1);
      return Math.hypot(x + 0.5 - ax - dx * k, y + 0.5 - ay - dy * k) <= r;
    });
    p.shape(Math.min(...xs) - r, Math.min(...ys) - r, Math.max(...xs) + r + 1, Math.max(...ys) + r + 1, near, fill, outline);
  }

  // ---- Landscape ---------------------------------------------------------------------------
  // Sky bands from the top to `bottom`. Where two bands meet, an ordered (4×4 Bayer) dither blends
  // them over a few rows, the classic pixel-art gradient.
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  function sky(p, bands, bottom) {
    const n = bands.length, step = bottom / n, blend = Math.max(2, Math.min(6, Math.floor(step / 3)));
    for (let y = 0; y < p.h; y++) {
      const i = Math.min(n - 1, Math.floor(y / step));
      p.rect(0, y, p.w, 1, bands[i]);
      if (i >= n - 1) continue;
      const into = y - (Math.floor((i + 1) * step) - blend);
      if (into < 0) continue;
      const f = (into + 1) / (blend + 1);
      for (let x = 0; x < p.w; x++) if (BAYER[(y & 3) * 4 + (x & 3)] / 16 < f) p.set(x, y, bands[i + 1]);
    }
  }

  // A mountain range or hills across the whole width. ramp = [outline, shadow, base, lit, highlight].
  // Pointy peaks shade by side (lit on the left); round ones shade like domes. `snow` adds caps.
  function range(p, rand, { y, height, width, count, ramp, round = false, snow = null, streaks = true, cap = 0.3 }) {
    const W = p.w, peaks = [];
    const n = count || Math.max(2, Math.ceil(W / width) + 1);
    for (let i = -1; i <= n; i++) {
      peaks.push({ x: ((i + 0.2 + rand() * 0.6) * W) / n, h: height * (0.55 + rand() * 0.45), w: width * (0.6 + rand() * 0.5) });
    }
    const top = new Float32Array(W), owner = new Int16Array(W);
    for (let x = 0; x < W; x++) {
      let best = -1e9;
      peaks.forEach((pk, i) => {
        const d = Math.abs(x + 0.5 - pk.x) / pk.w;
        const h = round ? pk.h * Math.sqrt(Math.max(0, 1 - d * d)) : pk.h * (1 - d) + (hash(x >> 1, i) - 0.5) * 2;
        if (h > best) { best = h; owner[x] = i; }
      });
      top[x] = Math.round(y - Math.max(0, best));
    }
    p.shape(0, Math.min(...top), W, p.h, (x, yy) => yy >= top[x], (x, yy) => {
      const pk = peaks[owner[x]], depth = yy - top[x], lit = x + 0.5 < pk.x;
      if (snow && yy < y - pk.h * (1 - cap) + (hash(x, 7) * 3 | 0)) return lit ? snow[1] : snow[0];
      if (round) {
        const v = sphere(pk.x, y, pk.w, pk.h * 1.15, x, yy);
        return depth < 2 && v > 0.55 ? ramp[4] : pick(ramp.slice(1, 4), v);
      }
      if (depth < 2 && lit) return ramp[4];
      if (streaks && hash(x, yy >> 2) > 0.93) return lit ? ramp[2] : ramp[1];
      return lit ? ramp[3] : ramp[2];
    }, ramp[0]);
    return top;
  }

  // Flat ground from `top` to the bottom with a dark edge and a few grass tufts or pebbles.
  // ramp = [outline, dark, base, light]
  function ground(p, rand, top, ramp, { tufts = 0.004, pebble = false, patches = true } = {}) {
    p.rect(0, top, p.w, p.h - top, ramp[2]);
    // Lighter and darker patches (checker-dithered) so the ground isn't one flat colour.
    if (patches) {
      const n = Math.ceil((p.w * (p.h - top)) / 5000);
      for (let i = 0; i < n; i++) {
        const cx = rand() * p.w, cy = top + 6 + rand() * (p.h - top), rx = 14 + rand() * 40, ry = 3 + rand() * 6, c = i % 3 ? ramp[3] : ramp[1];
        p.shape(cx - rx, cy - ry, cx + rx, cy + ry, (x, y) => ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1 && ((x + y) & 1) === 0, c);
      }
    }
    p.rect(0, top, p.w, 1, ramp[0]);
    p.rect(0, top + 1, p.w, 1, ramp[3]);
    const n = Math.floor(p.w * (p.h - top) * tufts);
    for (let i = 0; i < n; i++) {
      const x = Math.floor(rand() * p.w), y = top + 3 + Math.floor(rand() * (p.h - top - 3));
      if (pebble) { p.rect(x, y, 2, 1, ramp[1]); p.set(x, y - 1, ramp[3]); continue; }
      p.set(x, y, ramp[1]); p.set(x - 1, y - 1, ramp[1]); p.set(x + 1, y - 1, ramp[1]);
      p.set(x, y - 1, ramp[3]);
    }
  }

  // ---- Props ---------------------------------------------------------------------------------
  // leaf / trunk ramps: [outline, dark, base, light, (highlight)]
  function tree(p, x, base, size, leaf, trunk) {
    const r = Math.max(3, size), th = Math.round(r * 0.9), tw = Math.max(2, Math.round(r * 0.36));
    const tx = Math.round(x - tw / 2);
    p.shape(tx, base - th - r * 0.5, tx + tw, base, () => true, xx => (xx < tx + tw / 2 ? trunk[2] : trunk[1]), trunk[0]);
    const cy = base - th - r * 0.75;
    p.tall(cy - r * 1.2);
    blob(p, [
      { x, y: cy, r }, { x: x - r * 0.72, y: cy + r * 0.32, r: r * 0.66 }, { x: x + r * 0.72, y: cy + r * 0.28, r: r * 0.7 },
      { x: x - r * 0.25, y: cy - r * 0.62, r: r * 0.6 }, { x: x + r * 0.36, y: cy - r * 0.45, r: r * 0.55 },
    ], leaf.slice(1), leaf[0], { noise: 0.14 });
  }

  function pine(p, x, base, h, leaf, trunk, snow = null) {
    const tw = Math.max(2, Math.round(h * 0.09));
    p.shape(x - tw / 2, base - h * 0.2, x + tw / 2, base, () => true, trunk[1], trunk[0]);
    const tiers = h > 24 ? 4 : 3, top = base - h, tierH = (h * 0.85) / tiers;
    p.tall(top);
    const spans = Array.from({ length: tiers }, (_, i) => {
      const ay = top + i * tierH * 0.72, by = ay + tierH * 1.25;
      return { ay, by, hw: h * (0.17 + i * 0.07) };
    });
    const inside = (xx, yy) => spans.some(s => yy + 0.5 >= s.ay && yy + 0.5 <= s.by && Math.abs(xx + 0.5 - x) <= s.hw * ((yy + 0.5 - s.ay) / (s.by - s.ay)) - (yy % 3 === 0 ? 1 : 0));
    p.shape(x - h * 0.5, top, x + h * 0.5, base - h * 0.12, inside, (xx, yy) => {
      const s = spans.find(q => yy + 0.5 >= q.ay && yy + 0.5 <= q.by);
      const lit = xx + 0.5 < x;
      if (snow && s && yy - s.ay < 2.5) return lit ? snow[1] : snow[0];
      if (s && s.by - yy < 2) return leaf[1];
      return lit ? leaf[3] : leaf[2];
    }, leaf[0]);
  }

  function rock(p, cx, base, w, h, ramp) {
    dome(p, cx, base, w / 2, h, ramp.slice(1), ramp[0], { floor: base, noise: 0.1 });
    if (w > 8) p.set(Math.round(cx - w * 0.15), Math.round(base - h * 0.5), ramp[1]), p.set(Math.round(cx - w * 0.1), Math.round(base - h * 0.4), ramp[1]);
  }

  function bush(p, cx, base, w, ramp) {
    const r = w / 4;
    blob(p, [{ x: cx - r, y: base - r * 0.6, r }, { x: cx + r, y: base - r * 0.6, r: r * 1.05 }, { x: cx, y: base - r * 1.2, r: r * 1.15 }],
      ramp.slice(1), ramp[0], { floor: base, noise: 0.12 });
  }

  function deadTree(p, x, base, h, ramp) {
    p.tall(base - h * 0.98);
    const s = h / 40;
    strokes(p, [
      [x, base, x - 1 * s, base - h * 0.62],
      [x - s, base - h * 0.62, x - 9 * s, base - h * 0.95],
      [x - s, base - h * 0.5, x + 10 * s, base - h * 0.86],
      [x + 5 * s, base - h * 0.7, x + 13 * s, base - h * 0.68],
      [x - 5 * s, base - h * 0.8, x - 12 * s, base - h * 0.76],
    ], Math.max(2, 3 * s), (xx, yy) => (hash(xx, yy) > 0.8 ? ramp[1] : xx < x ? ramp[3] : ramp[2]), ramp[0]);
    p.shape(x - 3 * s, base - h * 0.35, x + 3 * s, base, (xx, yy) => Math.abs(xx + 0.5 - x) <= 1.5 * s + (base - yy) * -0.02 + (base - yy < 4 * s ? 1.2 * s : 0), (xx) => (xx < x ? ramp[3] : ramp[2]), ramp[0]);
  }

  function crystal(p, x, base, h, ramp) {
    p.tall(base - h);
    const w = Math.max(3, h * 0.32);
    poly(p, [[x - w / 2, base], [x - w / 2, base - h * 0.7], [x, base - h], [x + w / 2, base - h * 0.7], [x + w / 2, base]], (xx, yy) => {
      if (Math.abs(xx + 0.5 - x) < 1 && yy < base - 2) return ramp[4];
      return xx + 0.5 < x ? ramp[3] : ramp[2];
    }, ramp[0]);
  }

  function tomb(p, x, base, w, h, ramp, cross = false) {
    const r = w / 2;
    p.shape(x - r, base - h, x + r, base, (xx, yy) => yy + 0.5 >= base - h + r || Math.hypot(xx + 0.5 - x, yy + 0.5 - (base - h + r)) <= r,
      (xx, yy) => (xx + 0.5 < x - r + 2 ? ramp[3] : yy > base - 3 ? ramp[1] : ramp[2]), ramp[0]);
    if (cross) { p.rect(x - 0.5, base - h + r * 0.6, 1, h * 0.45, ramp[1]); p.rect(x - 2, base - h + r * 0.9, 4, 1, ramp[1]); }
    else p.rect(x - r + 3, base - h + r + 1, w - 6, 1, ramp[1]);
  }

  function pillar(p, x, base, w, h, ramp, broken = 0) {
    const top = base - h;
    p.tall(top - 3);
    p.shape(x - w / 2, top, x + w / 2, base, (xx, yy) => yy >= top + (broken ? hash(xx, 3) * broken : 0),
      (xx, yy) => {
        const f = (xx + 0.5 - (x - w / 2)) / w;
        if (yy > base - 3) return ramp[1];
        if (f < 0.25) return ramp[3];
        return Math.floor(f * w) % 3 === 0 ? ramp[1] : ramp[2];
      }, ramp[0]);
    if (!broken) p.shape(x - w / 2 - 2, top - 3, x + w / 2 + 2, top, () => true, ramp[3], ramp[0]);
    p.shape(x - w / 2 - 2, base - 3, x + w / 2 + 2, base, () => true, ramp[2], ramp[0]);
  }

  function cloudSprite(w, h, ramp, seed = 1) {
    const p = new Pix(w + 4, h + 3), rand = rng('cloud' + seed + w), circles = [];
    const n = Math.max(2, Math.round(w / (h * 0.9)));
    for (let i = 0; i < n; i++) {
      const r = h * (0.42 + rand() * 0.3);
      circles.push({ x: 2 + r + (i * (w - 2 * r)) / Math.max(1, n - 1), y: h + 1 - r * 0.75, r });
    }
    circles.push({ x: 2 + w * (0.35 + rand() * 0.3), y: h * 0.6, r: h * 0.6 });
    blob(p, circles, ramp.slice(1), ramp[0], { floor: h + 1, bias: 0.1 });
    return p.canvas();
  }

  return { Pix, hash, rng, pick, wrap, clamp, sphere, blob, dome, poly, strokes, sky, range, ground, tree, pine, rock, bush, deadTree, crystal, tomb, pillar, cloudSprite };
})();

// -------------------------------------------------------------------------------------------------
// Scenes. Each: { sky: [bands top→bottom], pad: [outline, dark, base, light] for battle pads,
//   paintSky(p, g)?, paint(p, g), behind(ctx, t, g)?, front(ctx, t, g)? }
// g = { W, H, hz (ground line), k (size scale), rand, ... anything paint stores for the animation }.
const SCENES = {};

const SceneFx = (() => {
  const { hash, wrap } = PixelKit;
  const r = Math.round;
  // Clouds made once per scene, then drifted each frame.
  function makeClouds(g, ramp, { n = 5, y0 = 0.06, y1 = 0.3, size = 1, speed = 2 } = {}) {
    g.clouds = Array.from({ length: n }, (_, i) => {
      const w = r((26 + g.rand() * 40) * g.k * size), h = r(w * (0.3 + g.rand() * 0.12));
      return { c: PixelKit.cloudSprite(w, h, ramp, i), x: g.rand() * g.W, y: r(g.H * (y0 + g.rand() * (y1 - y0))), v: speed * (0.6 + g.rand() * 0.8) };
    });
  }
  function clouds(ctx, t, g) {
    for (const c of g.clouds || []) ctx.drawImage(c.c, r(wrap(c.x + t * c.v, g.W + c.c.width * 2) - c.c.width), c.y);
  }
  // Particles worked out from the time alone: fn gets three stable 0..1 values per particle.
  function each(n, seed, fn) {
    for (let i = 0; i < n; i++) fn(i, hash(i, seed), hash(seed + 11, i * 7 + 1), hash(i * 13 + 3, seed * 3 + 5));
  }
  function dot(ctx, x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(r(x), r(y), w, h); }
  // Short light dashes that come and go on water.
  function shimmer(ctx, t, x0, y0, x1, y1, colors, n, speed = 3) {
    each(n, 41, (i, a, b, c) => {
      if (Math.floor(t * 1.6 + c * 7) % 3 === 0) return;
      dot(ctx, x0 + wrap(a * (x1 - x0) + t * speed * (b > 0.5 ? 1 : -0.6), x1 - x0), y0 + Math.floor(b * (y1 - y0)), 2 + Math.floor(c * 5), 1, colors[i % colors.length]);
    });
  }
  // Falling or rising specks: snow, embers, rain, dust.
  function fall(ctx, t, g, { n, seed = 1, vx = 0, vy = 20, colors, w = 1, h = 1, y0 = 0, y1 = g.H, sway = 0 }) {
    each(n, seed, (i, a, b, c) => {
      const span = y1 - y0, y = y0 + wrap(b * span + t * vy * (0.7 + c * 0.6), span);
      dot(ctx, wrap(a * g.W + t * vx + Math.sin(t * 1.3 + i) * sway, g.W), y, w, h, colors[i % colors.length]);
    });
  }
  // Floating lights that blink: fireflies, wisps, sparkles.
  function twinkle(ctx, t, g, { n, seed = 3, colors, y0 = 0, y1 = g.H, drift = 3, plus = false }) {
    each(n, seed, (i, a, b, c) => {
      if (Math.floor(t * 2 + c * 9) % 4 === 0) return;
      const x = a * g.W + Math.sin(t * 0.7 + i * 2) * drift * 2, y = y0 + b * (y1 - y0) + Math.cos(t * 0.9 + i) * drift;
      const col = colors[i % colors.length];
      dot(ctx, x, y, 1, 1, col);
      if (plus && c > 0.5) { dot(ctx, x - 1, y, 1, 1, col); dot(ctx, x + 1, y, 1, 1, col); dot(ctx, x, y - 1, 1, 1, col); dot(ctx, x, y + 1, 1, 1, col); }
    });
  }
  // Fog strips drifting sideways (pixel bands with soft alpha).
  function fog(ctx, t, g, { n = 5, y0, y1, color, speed = 3 }) {
    each(n, 77, (i, a, b, c) => {
      const w = r((30 + c * 60) * g.k), x = wrap(a * g.W + t * speed * (b > 0.5 ? 1 : -1), g.W + w) - w, y = y0 + b * (y1 - y0);
      dot(ctx, x, y, w, 2, color); dot(ctx, x + 6, y - 2, w - 12, 2, color);
    });
  }
  // Big props up close at the bottom corners (and now and then between) frame each scene.
  // fn(x, base, scale, i) paints one; base sits a little below the bottom edge.
  function framing(g, fn) {
    const xs = [r(g.W * 0.03 + g.rand() * 10 * g.k)];
    for (let x = xs[0] + 240 * g.k; x < g.W - 160 * g.k; x += (220 + g.rand() * 160) * g.k) if (g.rand() < 0.45) xs.push(r(x));
    xs.push(r(g.W * 0.97 - g.rand() * 10 * g.k));
    xs.forEach((x, i) => fn(x, g.H + r(3 * g.k), 0.9 + g.rand() * 0.4, i));
  }
  return { makeClouds, clouds, each, dot, shimmer, fall, twinkle, fog, framing };
})();

// Shared palettes (outline first, then dark → light).
const PAL = {
  grass: ['#2f5a37', '#4f8a3f', '#6aa94a', '#8cc95a'],
  leaf: ['#244a33', '#33683d', '#4c8a46', '#6fae55', '#96cf6a'],
  bark: ['#3e2a22', '#6b4632', '#8c5f3e'],
  stone: ['#3b3f4c', '#5e6577', '#7f879a', '#a4adbd', '#c9d0db'],
  cloud: ['#7f9fc4', '#c9dcef', '#e8f2fa', '#ffffff'],
  water: ['#2a5c8a', '#3d7fb5', '#5aa2d1', '#8cc8e8'],
};

(() => {
  const K = PixelKit, F = SceneFx, r = Math.round;

  SCENES.meadow = {
    sky: ['#4f9ad6', '#67abe0', '#82bde8', '#a2d0ee', '#c3e2f2'],
    pad: ['#3a6a35', '#5f9a48', '#79b657', '#a5d77a'],
    paintSky(p, g) {
      K.dome(p, r(g.W * 0.82), r(g.H * 0.12), 9 * g.k + 4, 9 * g.k + 4, ['#ffd25a', '#ffe580', '#fff4bf'], '#f6b847');
      F.makeClouds(g, PAL.cloud, { n: Math.ceil(g.W / 160) + 2 });
    },
    paint(p, g) {
      K.range(p, g.rand, { y: g.hz - r(24 * g.k), height: 60 * g.k, width: 140 * g.k, ramp: ['#4f7aa2', '#7ea3c4', '#8fb3d0', '#a3c4dc', '#bcd6e8'], round: true });
      const hills = K.range(p, g.rand, { y: g.hz + 2, height: 34 * g.k, width: 90 * g.k, ramp: ['#2f5a37', '#4f8a3f', '#62a048', '#79b657', '#9fd474'], round: true });
      for (let x = r(g.rand() * 40); x < g.W; x += r((50 + g.rand() * 70) * g.k)) {
        K.tree(p, x, hills[Math.min(g.W - 1, Math.max(0, x))] + r(4 * g.k), r((7 + g.rand() * 4) * g.k), PAL.leaf, PAL.bark);
      }
      K.ground(p, g.rand, g.hz, PAL.grass, { tufts: 0.006 });
      const petals = ['#ffffff', '#ffe066', '#ff9bc0', '#ffb1e0'];
      for (let i = 0; i < g.W * (g.H - g.hz) * 0.0025; i++) {
        const x = r(g.rand() * g.W), y = g.hz + 4 + r(g.rand() * (g.H - g.hz - 4)), c = petals[i % petals.length];
        p.set(x, y, c); p.set(x - 1, y, c); p.set(x + 1, y, c); p.set(x, y - 1, c); p.set(x, y, '#f7c948');
      }
      for (let x = r(g.rand() * 80); x < g.W; x += r((90 + g.rand() * 120) * g.k)) K.bush(p, x, g.hz + r(10 * g.k), r(18 * g.k), PAL.leaf);
    },
    behind: (ctx, t, g) => F.clouds(ctx, t, g),
    front: (ctx, t, g) => F.twinkle(ctx, t, g, { n: 10, colors: ['#fff6a8', '#ffffff'], y0: g.hz - 20, y1: g.H, drift: 6 }),
  };

  SCENES.forest = {
    sky: ['#5ea7c7', '#78b9cf', '#97cbd6', '#bbdcd8'],
    pad: ['#2f4f2c', '#4c7339', '#5f8a45', '#86ad5e'],
    paintSky(p, g) { F.makeClouds(g, PAL.cloud, { n: Math.ceil(g.W / 200) + 1, size: 0.8, y1: 0.18 }); },
    paint(p, g) {
      for (let x = -10; x < g.W + 10; x += r((14 + g.rand() * 8) * g.k)) {
        K.pine(p, x, g.hz - r(12 * g.k), r((44 + g.rand() * 22) * g.k), ['#1e3d3c', '#2e5752', '#3a6a62', '#4b7d70'], ['#1e2a24', '#2e3a30']);
      }
      for (let x = -20; x < g.W + 20; x += r((26 + g.rand() * 14) * g.k)) {
        K.tree(p, x, g.hz + r(6 * g.k), r((11 + g.rand() * 5) * g.k), ['#1f4430', '#2b5d39', '#3f7c45', '#5c9b52', '#7fbb63'], PAL.bark);
      }
      K.ground(p, g.rand, g.hz + r(6 * g.k), ['#25402a', '#3b6233', '#4f7a3e', '#6b9750'], { tufts: 0.008 });
      // Sunlight patches on the forest floor.
      for (let i = 0; i < g.W / 50; i++) {
        const x = r(g.rand() * g.W), y = g.hz + r((12 + g.rand() * 40) * g.k), w = r((10 + g.rand() * 16) * g.k);
        p.shape(x - w, y - 3, x + w, y + 3, (xx, yy) => ((xx - x) / w) ** 2 + ((yy - y) / 3) ** 2 <= 1 && (xx + yy) % 2 === 0, '#86ad5e');
      }
      for (let i = 0; i < g.W / 70; i++) {
        const x = r(g.rand() * g.W), y = g.hz + r((14 + g.rand() * 60) * g.k);
        K.dome(p, x, y - 3, 3, 3, ['#b8403a', '#e2584b', '#ff8a70'], '#5a2420', { floor: y - 1 });
        p.rect(x - 1, y - 1, 2, 3, '#f2e6cc'); p.set(x - 1, y - 4, '#fff');
      }
    },
    behind: (ctx, t, g) => F.clouds(ctx, t, g),
    front(ctx, t, g) {
      F.fall(ctx, t, g, { n: 14, seed: 5, vx: 6, vy: 9, colors: ['#e0b04a', '#c97a3a', '#9fca5a'], w: 2, h: 1, sway: 8 });
      F.twinkle(ctx, t, g, { n: 8, colors: ['#fff4a3'], y0: g.hz, y1: g.H, drift: 5 });
    },
  };

  SCENES.river = {
    sky: ['#4e9bd8', '#69aee0', '#88c1e8', '#a9d4ee', '#cbe6f1'],
    pad: ['#3a6a35', '#5f9a48', '#79b657', '#a5d77a'],
    paintSky(p, g) { F.makeClouds(g, PAL.cloud, { n: Math.ceil(g.W / 160) + 2 }); },
    paint(p, g) {
      K.range(p, g.rand, { y: g.hz - r(14 * g.k), height: 48 * g.k, width: 120 * g.k, ramp: ['#4f7aa2', '#7ea3c4', '#8fb3d0', '#a3c4dc', '#bcd6e8'], round: true });
      const far = K.range(p, g.rand, { y: g.hz + 2, height: 22 * g.k, width: 80 * g.k, ramp: ['#2f5a37', '#4f8a3f', '#62a048', '#79b657', '#9fd474'], round: true });
      for (let x = r(g.rand() * 50); x < g.W; x += r((60 + g.rand() * 60) * g.k)) K.tree(p, x, far[Math.max(0, Math.min(g.W - 1, x))] + 3, r((6 + g.rand() * 3) * g.k), PAL.leaf, PAL.bark);
      K.ground(p, g.rand, g.hz, PAL.grass, { tufts: 0.005 });
      // The river: a wavy band with sandy banks.
      const y0 = g.hz + r((g.H - g.hz) * 0.32), y1 = g.hz + r((g.H - g.hz) * 0.7);
      g.water = [y0, y1];
      const bank = x => Math.sin(x * 0.03) * 3 * g.k;
      p.shape(0, y0 - 6, g.W, y1 + 6, (x, y) => y >= y0 + bank(x) - 2 && y <= y1 + bank(x + 40) + 2, '#d8c38a', '#6e5a36');
      p.shape(0, y0 - 6, g.W, y1 + 6, (x, y) => y >= y0 + bank(x) && y <= y1 + bank(x + 40), (x, y) => {
        const f = (y - y0 - bank(x)) / (y1 - y0);
        return f < 0.12 ? PAL.water[3] : f < 0.45 ? PAL.water[2] : f < 0.8 ? PAL.water[1] : PAL.water[0];
      }, '#2a4a6a');
      for (let x = r(g.rand() * 30); x < g.W; x += r((22 + g.rand() * 40) * g.k)) {
        const y = r(y0 + bank(x) - 1);
        for (let i = 0; i < 3; i++) K.strokes(p, [[x + i * 2, y, x + i * 2 + (i - 1), y - r((7 + i * 2) * g.k)]], 1.4, '#5d8a3a', '#2f4a25');
        p.rect(x + 1, y - r(9 * g.k), 2, 3, '#7a4a2c');
      }
      for (let x = r(g.rand() * 90); x < g.W; x += r((110 + g.rand() * 100) * g.k)) K.rock(p, x, y1 + r(bank(x + 40)) + 3, r(14 * g.k), r(7 * g.k), PAL.stone);
    },
    behind: (ctx, t, g) => F.clouds(ctx, t, g),
    front: (ctx, t, g) => F.shimmer(ctx, t, 0, g.water[0] + 2, g.W, g.water[1] - 1, ['#d9f1fb', '#a9dcef'], Math.ceil(g.W / 18), 6),
  };

  SCENES.volcano = {
    sky: ['#5a2c45', '#86384a', '#b6504b', '#d9774f', '#efa060'],
    pad: ['#2a1d24', '#4a3134', '#5e3d3a', '#7f5446'],
    paintSky(p, g) { F.makeClouds(g, ['#4d2a38', '#7a4450', '#9c5a5e', '#bf7b6e'], { n: Math.ceil(g.W / 180) + 2, y1: 0.22, speed: 3 }); },
    paint(p, g) {
      K.range(p, g.rand, { y: g.hz - r(20 * g.k), height: 70 * g.k, width: 90 * g.k, ramp: ['#2c1a2a', '#4d2d3c', '#5e3747', '#71424f', '#8c5660'] });
      // The volcano: a broad cone with a glowing crater and lava runs.
      const cx = r(g.W * 0.7), top = r(g.hz - Math.min(150 * g.k, g.hz * 0.68)), w = 150 * g.k, crater = 16 * g.k;
      g.crater = [cx, top];
      K.poly(p, [[cx - w, g.hz + 4], [cx - crater, top], [cx + crater, top], [cx + w, g.hz + 4]], (x, y) => {
        const lit = x < cx, f = (y - top) / (g.hz - top);
        if (y - top < 3 && Math.abs(x - cx) < crater - 2) return '#ffb347';
        return lit ? (f < 0.5 ? '#6e4152' : '#5c3646') : (f < 0.5 ? '#4f2f40' : '#432735');
      }, '#24141f');
      for (const dx of [-0.35, 0.15, 0.55]) {
        const x0 = cx + dx * crater * 2, segs = [];
        let x = x0, y = top + 2;
        while (y < g.hz) { const nx = x + (K.hash(r(x), r(y)) - 0.5 + dx * 0.8) * 10 * g.k, ny = y + 12 * g.k; segs.push([x, y, nx, ny]); x = nx; y = ny; }
        K.strokes(p, segs, Math.max(2, 3 * g.k), (xx, yy) => (K.hash(xx, yy) > 0.6 ? '#ffd166' : '#ff8a3d'), '#b23a2a');
      }
      K.ground(p, g.rand, g.hz, ['#1e141c', '#3b2730', '#4a3134', '#5e4040'], { tufts: 0.004, pebble: true });
      // Lava cracks in the ground.
      for (let i = 0; i < g.W / 60; i++) {
        let x = g.rand() * g.W, y = g.hz + 8 + g.rand() * (g.H - g.hz - 10);
        const segs = [];
        for (let s = 0; s < 4; s++) { const nx = x + (g.rand() - 0.3) * 16 * g.k, ny = y + (g.rand() - 0.5) * 6; segs.push([x, y, nx, ny]); x = nx; y = ny; }
        K.strokes(p, segs, 1.6, '#ff8a3d', '#5a1e1e');
      }
      for (let x = r(g.rand() * 60); x < g.W; x += r((80 + g.rand() * 90) * g.k)) K.rock(p, x, g.hz + r((12 + g.rand() * 50) * g.k), r(16 * g.k), r(9 * g.k), ['#1e141c', '#3b2730', '#563a3f', '#704c4c', '#8c6262']);
    },
    behind: (ctx, t, g) => F.clouds(ctx, t, g),
    front(ctx, t, g) {
      const [cx, top] = g.crater;
      // Smoke puffs rising from the crater.
      F.each(5, 9, (i, a) => {
        const life = (t * 0.25 + i / 5) % 1, s = r((4 + life * 10) * g.k);
        F.dot(ctx, cx - s / 2 + life * 30 * g.k + Math.sin(i + t) * 3, top - 4 - life * 60 * g.k, s, r(s * 0.7), life < 0.5 ? '#6b4a58' : '#8a6a74');
        F.dot(ctx, cx - s / 2 + life * 30 * g.k + Math.sin(i + t) * 3 + 1, top - 4 - life * 60 * g.k, s - 2, 1, '#a88a92');
      });
      F.fall(ctx, t, g, { n: Math.ceil(g.W / 25), seed: 4, vx: 4, vy: -16, colors: ['#ffd166', '#ff8a3d', '#ff5a3a'], sway: 4 });
    },
  };

  SCENES.sky = {
    sky: ['#3f8fd8', '#5aa2e0', '#78b6e8', '#9ccaee', '#c2ddf1'],
    pad: ['#5d7590', '#9fb5cc', '#c7d6e6', '#ffffff'],
    paintSky(p, g) {
      K.dome(p, r(g.W * 0.18), r(g.H * 0.12), 8 * g.k + 4, 8 * g.k + 4, ['#ffe48a', '#fff2c0', '#fffbe8'], '#f6c85a');
      F.makeClouds(g, PAL.cloud, { n: Math.ceil(g.W / 140) + 2, y0: 0.08, y1: 0.4, speed: 5 });
    },
    paint(p, g) {
      // Peaks poking up through a sea of clouds.
      K.range(p, g.rand, { y: g.hz + r(10 * g.k), height: 120 * g.k, width: 70 * g.k, count: Math.ceil(g.W / (180 * g.k)) + 1, ramp: ['#3a4660', '#5d6a86', '#717f9c', '#8a98b4', '#b3c0d6'], snow: ['#c9d6e8', '#ffffff'], cap: 0.25 });
      const sea = g.hz + r(6 * g.k);
      for (let x = -20; x < g.W + 40; x += r(26 * g.k)) K.blob(p, [{ x, y: sea + 6 * g.k, r: (14 + K.hash(x, 1) * 8) * g.k }], PAL.cloud.slice(1), PAL.cloud[0], { bias: 0.15 });
      p.rect(0, sea + r(12 * g.k), p.w, p.h, '#e8f2fa');
      for (let x = -30; x < g.W + 40; x += r(40 * g.k)) K.blob(p, [{ x: x + 10, y: g.H - 4 * g.k, r: (20 + K.hash(x, 9) * 12) * g.k }], PAL.cloud.slice(1), PAL.cloud[0], { bias: 0.1 });
    },
    behind: (ctx, t, g) => F.clouds(ctx, t, g),
    front(ctx, t, g) {
      // A few birds flapping across (two-frame V shapes).
      F.each(4, 21, (i, a, b) => {
        const x = PixelKit.wrap(a * g.W + t * (14 + b * 8), g.W + 20) - 10, y = g.H * (0.15 + b * 0.25) + Math.sin(t * 2 + i) * 3, up = Math.floor(t * 4 + i) % 2;
        F.dot(ctx, x - 2, y - up, 2, 1, '#2f3b52'); F.dot(ctx, x, y, 1, 1, '#2f3b52'); F.dot(ctx, x + 1, y - up, 2, 1, '#2f3b52');
      });
    },
  };

  SCENES.cave = {
    sky: ['#1b1626', '#231c31', '#2c233c', '#352a46'],
    pad: ['#1a1622', '#3a3346', '#4c4358', '#655a72'],
    paint(p, g) {
      // Back wall texture, stalactites, a glowing pool and crystals.
      for (let i = 0; i < g.W * g.H * 0.004; i++) { const x = r(g.rand() * g.W), y = r(g.rand() * g.hz); p.rect(x, y, 3, 1, '#3d3250'); p.set(x, y + 1, '#171221'); }
      // The ceiling hangs in front of the wildlife, which flies below its lowest point.
      for (let x = -6; x < g.W + 6; x += r((14 + g.rand() * 18) * g.k)) {
        const h = r((14 + g.rand() * 34) * g.k), w = r((6 + g.rand() * 6) * g.k);
        p.rect(x - w, 0, w * 2, 3, '#2a2238');
        K.poly(g.front, [[x - w, -1], [x + w, -1], [x + 1, h]], (xx) => (xx < x ? '#5c4f72' : '#463b5a'), '#140f1d');
        g.ceiling = Math.max(g.ceiling, h);
      }
      K.range(p, g.rand, { y: g.hz + 4, height: 44 * g.k, width: 60 * g.k, ramp: ['#140f1d', '#2e2640', '#3b3150', '#4b3f62', '#64567e'] });
      K.ground(p, g.rand, g.hz + 4, ['#140f1d', '#2a2238', '#382e48', '#4a3e5c'], { tufts: 0.004, pebble: true });
      const py = g.hz + r((g.H - g.hz) * 0.45), pw = r(g.W * 0.18);
      g.pool = [r(g.W * 0.3), py, pw];
      K.dome(p, g.pool[0], py, pw, r(9 * g.k), ['#1d3c58', '#2c5d80', '#3f7fa6', '#6fb5d6'], '#10202f');
      for (let x = r(g.rand() * 50); x < g.W; x += r((60 + g.rand() * 90) * g.k)) {
        const base = g.hz + r((10 + g.rand() * 60) * g.k);
        K.crystal(p, x, base, r((12 + g.rand() * 10) * g.k), ['#22405a', '#3d7aa8', '#5fa8d6', '#8fd3f2', '#e6fbff']);
        K.crystal(p, x + r(6 * g.k), base + 1, r((7 + g.rand() * 6) * g.k), ['#22405a', '#3d7aa8', '#5fa8d6', '#8fd3f2', '#e6fbff']);
      }
      for (let x = r(g.rand() * 70); x < g.W; x += r((70 + g.rand() * 80) * g.k)) K.rock(p, x, g.hz + r((20 + g.rand() * 70) * g.k), r(14 * g.k), r(10 * g.k), ['#140f1d', '#2e2640', '#45395a', '#5c4f72', '#7a6b92']);
    },
    front(ctx, t, g) {
      const [px, py, pw] = g.pool;
      F.shimmer(ctx, t, px - pw * 0.7, py - 4, px + pw * 0.7, py + 5, ['#a6e2f7', '#6fb5d6'], 8, 2);
      F.twinkle(ctx, t, g, { n: 14, colors: ['#9fe3ff', '#ffffff', '#c9a8ff'], y0: g.hz - 30, y1: g.H, drift: 2, plus: true });
      // Drips from the ceiling.
      F.each(5, 33, (i, a, b) => { const y = PixelKit.wrap(t * 50 + b * 400, g.hz + 60); F.dot(ctx, a * g.W, y, 1, 2, '#8fd3f2'); });
    },
  };

  const nightSky = (p, g, moon = true) => {
    for (let i = 0; i < g.W * g.hz * 0.002; i++) p.set(r(g.rand() * g.W), r(g.rand() * g.hz * 0.8), g.rand() > 0.7 ? '#fff6d8' : '#b9b4d8');
    if (!moon) return;
    const mx = r(g.W * 0.78), my = r(g.H * 0.14), mr = r(10 * g.k + 5);
    K.dome(p, mx, my, mr, mr, ['#c9c2a0', '#e8e1c0', '#fffbe6'], '#8f8a74');
    p.set(mx - 3, my + 2, '#c9c2a0'); p.rect(mx + 2, my - 4, 2, 2, '#d8d1b0');
  };

  SCENES.haunted = {
    sky: ['#14112a', '#1d1838', '#28214a', '#352b5a', '#433768'],
    pad: ['#141225', '#2e2a45', '#3b3655', '#514a6e'],
    paintSky: nightSky,
    paint(p, g) {
      K.range(p, g.rand, { y: g.hz - r(10 * g.k), height: 40 * g.k, width: 110 * g.k, ramp: ['#120f22', '#221d3a', '#2a2445', '#332c52', '#3f3762'], round: true });
      for (let x = r(g.rand() * 30); x < g.W; x += r((40 + g.rand() * 50) * g.k)) K.deadTree(p, x, g.hz + r(4 * g.k), r((50 + g.rand() * 30) * g.k), ['#0e0b18', '#2a2238', '#3a2f4c', '#4d4064']);
      K.ground(p, g.rand, g.hz + r(4 * g.k), ['#0e0b18', '#1f1a30', '#29223c', '#3a3150'], { tufts: 0.005 });
      for (let x = r(g.rand() * 90); x < g.W; x += r((100 + g.rand() * 100) * g.k)) K.bush(p, x, g.hz + r(14 * g.k), r(20 * g.k), ['#0e0b18', '#1f2a2c', '#2a3a3a', '#38504a']);
    },
    front(ctx, t, g) {
      F.fog(ctx, t, g, { n: 6, y0: g.hz - 4, y1: g.H - 10, color: '#8f88b833', speed: 4 });
      // Will-o'-wisps: two-frame flames.
      F.each(5, 13, (i, a, b) => {
        const x = a * g.W + Math.sin(t * 0.6 + i * 3) * 18, y = g.hz - 10 + b * (g.H - g.hz) + Math.sin(t * 1.4 + i) * 6, f = Math.floor(t * 6 + i) % 2;
        F.dot(ctx, x - 2, y - 1, 5, 4, '#5a3fa0'); F.dot(ctx, x - 1, y - 3 - f, 3, 5, '#8f6ee0'); F.dot(ctx, x, y - 1, 1, 2, '#e8dcff');
      });
    },
  };

  SCENES.ruins = {
    sky: ['#3c3f66', '#575a80', '#787594', '#a08c98', '#c7a796'],
    pad: ['#3a3d3a', '#6b6c62', '#86877a', '#a8a896'],
    paintSky(p, g) { nightSky(p, g, false); F.makeClouds(g, ['#4e4b6a', '#7d7896', '#9f97ae', '#c2b6c4'], { n: Math.ceil(g.W / 200) + 1, y1: 0.25 }); },
    paint(p, g) {
      K.range(p, g.rand, { y: g.hz - r(4 * g.k), height: 30 * g.k, width: 120 * g.k, ramp: ['#2c2d3e', '#46485e', '#52556c', '#5f627a', '#75788e'], round: true });
      const stone = ['#3b3934', '#6e6a5e', '#8a8676', '#a9a492', '#cbc6b0'];
      // An arch and rows of pillars, some broken.
      const ax = r(g.W * 0.32), aw = r(34 * g.k), ah = r(70 * g.k), base = g.hz + r(6 * g.k);
      K.pillar(p, ax - aw, base, r(10 * g.k), ah, stone);
      K.pillar(p, ax + aw, base, r(10 * g.k), ah, stone);
      p.shape(ax - aw - r(7 * g.k), base - ah - r(12 * g.k), ax + aw + r(7 * g.k), base - ah, () => true, (x, y) => (y < base - ah - r(9 * g.k) ? stone[3] : stone[2]), stone[0]);
      for (let x = r(g.rand() * 40); x < g.W; x += r((44 + g.rand() * 40) * g.k)) {
        if (Math.abs(x - ax) < aw + 20) continue;
        K.pillar(p, x, base, r(9 * g.k), r((30 + g.rand() * 40) * g.k), stone, g.rand() > 0.4 ? r(8 * g.k) : 0);
      }
      K.ground(p, g.rand, base, ['#2e3328', '#4d5a3c', '#5f6e48', '#7a8a58'], { tufts: 0.006 });
      // Flagstones.
      for (let y = base + r(8 * g.k); y < g.H; y += r(16 * g.k)) for (let x = r(K.hash(y, 1) * 30); x < g.W; x += r(30 * g.k)) {
        if (K.hash(x, y) < 0.72) continue;
        p.shape(x, y, x + r(22 * g.k), y + r(7 * g.k), () => true, (xx, yy) => (yy === y ? stone[3] : stone[2]), stone[0]);
      }
      for (let x = r(g.rand() * 80); x < g.W; x += r((90 + g.rand() * 80) * g.k)) K.rock(p, x, base + r((14 + g.rand() * 40) * g.k), r(12 * g.k), r(6 * g.k), stone);
    },
    behind: (ctx, t, g) => F.clouds(ctx, t, g),
    front: (ctx, t, g) => F.twinkle(ctx, t, g, { n: 12, colors: ['#f6e3a6', '#ffffff'], y0: g.H * 0.2, y1: g.H, drift: 4 }),
  };

  SCENES.marsh = {
    sky: ['#4c5e5e', '#5f726c', '#768a7c', '#90a38c', '#aab79c'],
    pad: ['#2a3a2c', '#47603f', '#58734b', '#748f5e'],
    paintSky(p, g) { F.makeClouds(g, ['#56685f', '#8a9c8c', '#a6b6a4', '#c4cfbd'], { n: Math.ceil(g.W / 150) + 2, y1: 0.28, speed: 1.5 }); },
    paint(p, g) {
      K.range(p, g.rand, { y: g.hz - r(6 * g.k), height: 26 * g.k, width: 100 * g.k, ramp: ['#33443e', '#4c5f55', '#56695d', '#627566', '#738670'], round: true });
      for (let x = r(g.rand() * 40); x < g.W; x += r((50 + g.rand() * 60) * g.k)) K.deadTree(p, x, g.hz + 2, r((30 + g.rand() * 20) * g.k), ['#1c241e', '#3d4a3c', '#4c5a48', '#5e6c56']);
      K.ground(p, g.rand, g.hz, ['#25321f', '#41552f', '#4f663a', '#6a8248'], { tufts: 0.007 });
      const y0 = g.hz + r((g.H - g.hz) * 0.25);
      g.water = [y0, g.H];
      const edge = x => Math.sin(x * 0.05) * 2 + Math.sin(x * 0.013) * 4;
      p.shape(0, y0 - 8, g.W, g.H, (x, y) => y >= y0 + edge(x), (x, y) => ((y - y0) < 3 ? '#5f7a5a' : (y - y0) < 20 * g.k ? '#40594a' : '#334a3e'), '#1d2b23');
      for (let i = 0; i < g.W / 30; i++) {
        const x = r(g.rand() * g.W), y = y0 + r(8 + g.rand() * (g.H - y0 - 10)), w = r((5 + g.rand() * 4) * g.k);
        K.dome(p, x, y, w, Math.max(2, r(w * 0.4)), ['#3d6b34', '#5a8f44', '#79b058'], '#22401f');
        if (g.rand() > 0.6) { p.set(x, y - 2, '#ff9bd0'); p.set(x + 1, y - 2, '#ffd0ea'); }
      }
      for (let x = r(g.rand() * 20); x < g.W; x += r((16 + g.rand() * 30) * g.k)) {
        const y = r(y0 + edge(x)), h = r((10 + g.rand() * 8) * g.k);
        K.strokes(p, [[x, y, x, y - h]], 1.4, '#5d7a3a', '#2a3a1e');
        p.shape(x - 1, y - h - r(4 * g.k), x + 2, y - h + 1, () => true, '#7a4a2c', '#3a2416');
      }
    },
    behind: (ctx, t, g) => F.clouds(ctx, t, g),
    front(ctx, t, g) {
      F.shimmer(ctx, t, 0, g.water[0] + 4, g.W, g.H, ['#7f9c86', '#9ab79c'], Math.ceil(g.W / 25), 1.5);
      F.fog(ctx, t, g, { n: 7, y0: g.hz - 6, y1: g.H, color: '#c9d6c433', speed: 2 });
      F.twinkle(ctx, t, g, { n: 9, colors: ['#e9ff8a', '#c6f06a'], y0: g.hz - 20, y1: g.H, drift: 6 });
    },
  };

  // ---- Close-up props at the bottom edge (see SceneFx.framing) ----
  const bigLeaf = ['#1f4430', '#2b5d39', '#3f7c45', '#5c9b52', '#7fbb63'];
  SCENES.meadow.fore = (p, g, x, base, s, i) => (i % 2 ? K.bush(p, x, base, r(70 * g.k * s), bigLeaf) : K.tree(p, x, base, r(26 * g.k * s), bigLeaf, PAL.bark));
  SCENES.forest.fore = (p, g, x, base, s) => { K.tree(p, x, base + r(10 * g.k), r(34 * g.k * s), ['#16301f', '#224a2c', '#336a3a', '#4c8a46', '#6aa956'], PAL.bark); K.bush(p, x + r(40 * g.k), base, r(60 * g.k), bigLeaf); };
  SCENES.river.fore = (p, g, x, base, s) => {
    K.bush(p, x, base, r(64 * g.k * s), bigLeaf);
    for (let j = -3; j <= 3; j++) {
      const h = r((40 + Math.abs(j) * -5) * g.k * s);
      K.strokes(p, [[x + 30 * g.k + j * 3, base, x + 30 * g.k + j * 4, base - h]], 2, '#6a9a44', '#2f4a25');
      if (j % 2 === 0) p.shape(x + 30 * g.k + j * 4 - 1, base - h - r(8 * g.k), x + 30 * g.k + j * 4 + 2, base - h + 1, () => true, '#7a4a2c', '#3a2416');
    }
  };
  const darkRock = ['#1e141c', '#3b2730', '#563a3f', '#704c4c', '#8c6262'];
  SCENES.volcano.fore = (p, g, x, base, s) => { K.rock(p, x, base, r(70 * g.k * s), r(40 * g.k * s), darkRock); K.rock(p, x + r(34 * g.k), base, r(36 * g.k), r(20 * g.k), darkRock); };
  SCENES.sky.fore = (p, g, x, base, s) => K.blob(p, [{ x, y: base - 6 * g.k, r: 34 * g.k * s }, { x: x + 34 * g.k, y: base, r: 26 * g.k * s }], PAL.cloud.slice(1), PAL.cloud[0], { bias: 0.1 });
  SCENES.cave.fore = (p, g, x, base, s) => {
    K.poly(p, [[x - 18 * g.k * s, base], [x - 4 * g.k, base - 70 * g.k * s], [x + 3 * g.k, base - 76 * g.k * s], [x + 18 * g.k * s, base]], (xx) => (xx < x ? '#5c4f72' : '#463b5a'), '#140f1d');
    K.crystal(p, x + r(26 * g.k), base, r(40 * g.k * s), ['#22405a', '#3d7aa8', '#5fa8d6', '#8fd3f2', '#e6fbff']);
  };
  SCENES.haunted.fore = (p, g, x, base, s, i) => (i % 2
    ? K.bush(p, x, base, r(64 * g.k * s), ['#0e0b18', '#1f2a2c', '#2a3a3a', '#38504a'])
    : K.deadTree(p, x, base, r(130 * g.k * s), ['#0b0816', '#241d34', '#30283f', '#3f3452']));
  SCENES.ruins.fore = (p, g, x, base, s) => {
    K.pillar(p, x, base, r(22 * g.k * s), r(70 * g.k * s), ['#3b3934', '#6e6a5e', '#8a8676', '#a9a492', '#cbc6b0'], r(14 * g.k));
    K.bush(p, x + r(22 * g.k), base, r(44 * g.k), ['#24361f', '#3a5a30', '#4c7240', '#62904e']);
  };
  SCENES.marsh.fore = (p, g, x, base, s) => {
    for (let j = -4; j <= 4; j++) {
      const h = r((50 - Math.abs(j) * 5) * g.k * s), xx = x + j * r(5 * g.k);
      K.strokes(p, [[xx, base, xx + j, base - h]], 2, '#5d7a3a', '#2a3a1e');
      if (j % 2 === 0) p.shape(xx + j - 2, base - h - r(10 * g.k), xx + j + 2, base - h + 1, () => true, '#7a4a2c', '#3a2416');
    }
  };
})();

// ---- Rendering ---------------------------------------------------------------------------------
// Each scene has three cached layers:
//   sky   – sky, sun or moon, stars;
//   land  – everything the wildlife walks and flies in front of;
//   front – what stands between the viewer and the wildlife: the close-up props at the bottom edge,
//           cave ceilings, canyon walls. Wildlife (09-more-habitats.js) roams between land and front.
// Scenes also report where wildlife can go: g.ceiling (lowest point of a ceiling), g.reach (top of
// the tallest tree, pillar or building on the land), g.water ([top, bottom] of swimmable water).
const sceneCache = new Map();
// stage: the battle backdrop, which leaves out the close-up props so nothing hides the Pokémon.
function sceneLayers(type, W, H, stage = false) {
  const key = `${type}:${W}x${H}${stage ? ':stage' : ''}`;
  let sc = sceneCache.get(key);
  if (sc) return sc;
  const def = SCENES[type] || SCENES.meadow;
  const g = { W, H, hz: Math.round(H * 0.56), k: Math.max(0.5, Math.min(1.7, H / 300, W / 200)), rand: PixelKit.rng(type), ceiling: 0 };
  const sky = new PixelKit.Pix(W, H);
  PixelKit.sky(sky, def.sky, Math.round(H * 0.62));
  def.paintSky?.(sky, g);
  const land = new PixelKit.Pix(W, H), front = new PixelKit.Pix(W, H);
  g.front = front;
  def.paint(land, g);
  g.reach = land.reach;
  if (def.fore && !stage) SceneFx.framing(g, (x, base, s, i) => def.fore(front, g, x, base, s, i));
  delete g.front;
  sc = { def, g, sky: sky.canvas(), land: land.canvas(), front: front.canvas() };
  // A scene registered by a later script isn't cached under the meadow stand-in.
  if (SCENES[type]) sceneCache.set(key, sc);
  // Keep a few (the background and the battle stage), dropping the oldest.
  if (sceneCache.size > 4) sceneCache.delete(sceneCache.keys().next().value);
  return sc;
}

// Paints a scene. With frontCtx, the front layer and the weather go on that canvas instead (so
// wildlife can roam between the two); otherwise everything goes on ctx. Returns the scene's g.
function paintScene(ctx, type, W, H, t, { stage = false, frontCtx = null } = {}) {
  const { def, g, sky, land, front } = sceneLayers(type, W, H, stage);
  const f = frontCtx || ctx;
  for (const c of new Set([ctx, f])) { c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.imageSmoothingEnabled = false; }
  ctx.drawImage(sky, 0, 0);
  def.behind?.(ctx, t, g);
  ctx.drawImage(land, 0, 0);
  if (frontCtx) frontCtx.clearRect(0, 0, W, H);
  f.drawImage(front, 0, 0);
  def.front?.(f, t, g);
  for (const c of new Set([ctx, f])) c.restore();
  return g;
}

// Wildlife hooks: 09-more-habitats.js assigns the real one. Called every scenery frame with the
// time, the scene's g and the size of one art pixel in CSS pixels.
let stepResidents = () => {};

(() => {
  const FRAME_MS = 1000 / 15, still = matchMedia('(prefers-reduced-motion: reduce)');
  const front = $('#worldFront'), fctx = front?.getContext('2d');
  let last = 0, shown = '';
  drawWorld = function () {
    const now = performance.now(), type = activeBiome?.type || 'meadow', key = `${type}:${world.width}x${world.height}`;
    // Reduced motion: draw the scene once, without the moving parts.
    if (key === shown && (still.matches || now - last < FRAME_MS)) return;
    last = now;
    shown = key;
    if (front && (front.width !== world.width || front.height !== world.height)) {
      front.width = world.width;
      front.height = world.height;
      front.style.width = world.style.width;
      front.style.height = world.style.height;
    }
    const t = still.matches ? 0 : now / 1000;
    const g = paintScene(wctx, type, world.width, world.height, t, { frontCtx: fctx });
    stepResidents(t, g, worldPixel);
  };
})();
