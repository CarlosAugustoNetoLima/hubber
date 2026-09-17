

const MARK = [
  'm1310.41,1133.49v573.95s526.37-186.42,526.37-186.42c49.88-17.67,83.22-64.84,83.22-117.76V304.18c0-52.92-33.34-100.09-83.22-117.76L1310.41,0v573.95s-213.2,213.2-213.2,213.2c-36.77,36.77-36.77,96.38,0,133.15l213.2,213.2Z',
  'm83.22,1521.01l526.37,186.42v-573.95s213.2-213.2,213.2-213.2c36.77-36.77,36.77-96.38,0-133.15l-213.2-213.2V0S83.22,186.43,83.22,186.43C33.34,204.09,0,251.27,0,304.19v1099.06c0,52.92,33.34,100.09,83.22,117.76Z',
];
const MARK_W = 1924, MARK_H = 1711.43;

const COLORS = ['#9E9E9E', '#787878'];
const LEVELS = 16;
const TAU = Math.PI * 2;

const HTML = document.documentElement;
const REDUCE = window.matchMedia('(prefers-reduced-motion: reduce)');
const unit = () => Math.min(1.111, Math.max(0.711, window.innerWidth * 0.000694));

const easeSettle = (t) => 1 - Math.pow(1 - t, 3);
const smooth = (t) => t * t * (3 - 2 * t);
const FONT_WAIT = 800;

export function initPixels() {
  document.querySelectorAll('canvas[data-pixels]').forEach((canvas) => new Field(canvas));
}

class Field {
  constructor(canvas) {
    this.canvas = canvas;
    this.host = canvas.parentElement;
    this.ctx = canvas.getContext('2d', { alpha: true });
    this.animate = !REDUCE.matches && HTML.classList.contains('has-motion');
    this.pointer = { x: 0, y: 0, on: false };
    this.particles = [];
    this.groups = COLORS.map(() => []);
    this.bins = COLORS.map(() => Array.from({ length: LEVELS }, () => []));
    this.t0 = performance.now();
    this.raf = 0;
    this.visible = true;

    const fontsLoaded = !document.fonts || document.fonts.status === 'loaded';
    this.ready = fontsLoaded;

    this.build();
    if (!this.animate) {
      this.settle(); this.draw();
      if (!fontsLoaded) document.fonts.ready.then(() => this.build(true));
      return;
    }

    this.onMove = (e) => {
      const r = this.rect;
      this.pointer.x = e.clientX - r.left;
      this.pointer.y = e.clientY - r.top;
      this.pointer.on = true;
    };
    this.onLeave = () => { this.pointer.on = false; };
    window.addEventListener('pointermove', this.onMove, { passive: true });
    document.addEventListener('pointerleave', this.onLeave);
    window.addEventListener('blur', this.onLeave);

    this.io = new IntersectionObserver(([en]) => {
      this.visible = en.isIntersecting;
      this.visible ? this.start() : this.stop();
    }, { threshold: 0 });
    this.io.observe(this.host);
    document.addEventListener('visibilitychange', () => (document.hidden ? this.stop() : this.visible && this.start()));

    let rt = 0;
    this.ro = new ResizeObserver(() => {
      const r = this.host.getBoundingClientRect();
      if (Math.round(r.width) === this.w && Math.round(r.height) === this.h) return;
      clearTimeout(rt); rt = setTimeout(() => this.build(true), 120);
    });
    this.ro.observe(this.host);

    REDUCE.addEventListener('change', (e) => { if (e.matches) { this.stop(); this.settle(); this.draw(); } });
    if (!fontsLoaded) {
      let begun = false;
      const begin = () => {
        if (begun) return;
        begun = true; this.ready = true;
        this.build();
        if (this.visible && !document.hidden) this.start();
      };
      document.fonts.ready.then(() => (begun ? this.build(true) : begin()));
      setTimeout(begin, FONT_WAIT);
    }
    canvas.__pixels = this;
  }

  layout() {
    const w = this.w, h = this.h, u = unit();
    const mobile = w < 1000;

    const cell = Math.max(2.5, (mobile ? 3.2 : 3.8) * u);
    if (mobile) {

      const size = Math.min(w * 0.34, window.innerHeight * 0.24);
      let top = size + 48;
      const block = this.host.querySelector('.hero__in');
      if (block) {
        const b = block.getBoundingClientRect(), hr = this.host.getBoundingClientRect();
        top = b.top - hr.top + parseFloat(getComputedStyle(block).paddingTop);
      }
      return { size, cx: w / 2, cy: Math.max(size / 2 + 8, top - 24 - size / 2), cell, radius: 150, pull: 40, mobile };
    }

    const host = this.host.getBoundingClientRect();
    const visH = Math.max(200, Math.min(h, window.innerHeight - (host.top + window.scrollY)));
    const size = Math.min(visH * 0.7, (w * 0.9 * MARK_H) / MARK_W);
    const markW = (size * MARK_W) / MARK_H;
    return { size, cx: w * 1.05 - markW / 2, cy: visH / 2, cell, radius: Math.max(200, size * 0.4), pull: 64, mobile };
  }

  sample({ size, cx, cy, cell }) {
    const sw = Math.max(1, Math.ceil(size * MARK_W / MARK_H)), sh = Math.max(1, Math.ceil(size));
    const off = document.createElement('canvas');
    off.width = sw; off.height = sh;
    const c = off.getContext('2d');
    c.scale(sw / MARK_W, sh / MARK_H);
    c.fillStyle = '#fff';
    MARK.forEach((d) => c.fill(new Path2D(d)));
    const px = c.getImageData(0, 0, sw, sh).data;
    const inside = (x, y) => x >= 0 && y >= 0 && x < sw && y < sh && px[((y | 0) * sw + (x | 0)) * 4 + 3] > 128;
    const pts = [];
    const x0 = cx - sw / 2, y0 = cy - sh / 2;

    const step = cell / Math.sqrt(0.35);
    for (let y = step / 2; y < sh; y += step) {
      for (let x = step / 2; x < sw; x += step) {
        if (!inside(x, y)) continue;
        pts.push({ x: x0 + x + (Math.random() - 0.5) * step, y: y0 + y + (Math.random() - 0.5) * step, halo: false });
      }
    }

    const apexY = y0 + (853.7 / MARK_H) * sh;
    pts.push({ x: x0 + (850.37 / MARK_W) * sw, y: apexY, halo: false });
    pts.push({ x: x0 + (1069.63 / MARK_W) * sw, y: apexY, halo: false });

    const n = Math.round(pts.length * 0.14);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, r = 0.55 + Math.random() * 0.55;
      pts.push({ x: cx + Math.cos(a) * sw * r, y: cy + Math.sin(a) * sh * r * 0.9, halo: true });
    }
    return pts;
  }

  build(keep = false) {
    const r = this.host.getBoundingClientRect();
    this.rect = r;
    this.w = Math.round(r.width); this.h = Math.round(r.height);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = this.w * dpr; this.canvas.height = this.h * dpr;
    this.canvas.style.width = this.w + 'px'; this.canvas.style.height = this.h + 'px';
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const prevL = this.L;
    const L = this.layout();
    this.L = L;
    const pts = this.sample(L);
    const seed = { x: L.cx, y: L.cy };
    if (!this.ready) keep = false;
    const old = keep ? this.particles : [];
    const now = (performance.now() - this.t0) / 1000;
    const maxR = L.size * 0.75;

    const G = 0.03;
    const oldN = old.map((o) => [(o.hx - prevL.cx) / prevL.size, (o.hy - prevL.cy) / prevL.size]);
    const buckets = new Map();
    oldN.forEach(([nx, ny], j) => {
      const key = Math.floor(nx / G) + ',' + Math.floor(ny / G);
      (buckets.get(key) || buckets.set(key, []).get(key)).push(j);
    });
    const pair = (x, y) => {
      const nx = (x - L.cx) / L.size, ny = (y - L.cy) / L.size;
      const kx = Math.floor(nx / G), ky = Math.floor(ny / G);
      let best = null, bd = Infinity;
      for (let ring = 0; ring < 4 && !best; ring++) {
        for (let ix = kx - ring; ix <= kx + ring; ix++) {
          for (let iy = ky - ring; iy <= ky + ring; iy++) {
            const list = buckets.get(ix + ',' + iy);
            if (!list) continue;
            for (const j of list) {
              const dx = oldN[j][0] - nx, dy = oldN[j][1] - ny, d = dx * dx + dy * dy;
              if (d < bd) { bd = d; best = old[j]; }
            }
          }
        }
      }
      return best || old[(Math.random() * old.length) | 0];
    };
    this.particles = pts.map((p) => {
      const dx = p.x - seed.x, dy = p.y - seed.y;
      const rh = Math.hypot(dx, dy) || 1;
      const ang = Math.random() * TAU;
      const rnd = Math.random();
      const q = {
        hx: p.x, hy: p.y,

        r: rh, nx: dx / rh, ny: dy / rh,
        x: 0, y: 0,

        k: rh <= L.size * 0.12 ? 0 : rh >= L.size * 0.4 ? 1 : smooth((rh - L.size * 0.12) / (L.size * 0.28)),
        size: Math.max(1.6, L.cell * (p.halo ? 0.55 : 0.42 + Math.random() * 0.2)),

        delay: p.halo ? 0.9 + Math.random() * 0.8 : 0.1 + Math.random() * 0.5 + (rh / maxR) * 0.25,
        dur: p.halo ? 1.6 : 2.0 + Math.random() * 0.5,

        color: rnd < 0.5 ? 0 : 1,
        a0: 0.8 * (p.halo ? 0.2 + Math.random() * 0.3 : 0.26 + Math.random() * 0.74),
        a: 0, halo: p.halo,
      };

      const spread = L.size * (0.12 + Math.random() * 0.47);
      q.sx = p.x + Math.cos(ang) * spread;
      q.sy = p.y + Math.sin(ang) * spread;

      const o = old.length ? pair(p.x, p.y) : null;
      q.fx = q.sx; q.fy = q.sy;
      if (o && now > o.delay) {
        q.fx = o.x; q.fy = o.y; q.fa = o.a; q.fs = o.drawSize || o.size;
        q.delay = now;
        q.dur = Math.max(0.9, o.delay + o.dur - now);
      } else if (o) { q.delay = o.delay; q.dur = o.dur; }
      q.x = q.fx; q.y = q.fy;
      return q;
    });
    this.seed = seed;
    this.groups = COLORS.map(() => []);
    this.particles.forEach((p) => this.groups[p.color].push(p));
    if (!keep) this.t0 = performance.now();

    if (!this.raf) { if (!this.animate) this.settle(); this.draw(); }
  }

  start() { if (!this.raf && this.animate && this.ready) { this.last = performance.now(); this.raf = requestAnimationFrame(this.tick); } }
  stop()  { if (this.raf) { cancelAnimationFrame(this.raf); this.raf = 0; } }

  tick = (now) => {
    this.raf = 0;
    const t = (now - this.t0) / 1000;
    this.rect = this.host.getBoundingClientRect();
    this.step(t);
    this.draw();
    if (this.visible && !document.hidden) this.raf = requestAnimationFrame(this.tick);
  };

  step(t) {
    const { radius, pull, size } = this.L;
    const P = this.pointer;

    const scrolled = Math.max(0, -this.rect.top);
    const disperse = Math.min(1, scrolled / (this.h * 0.85));

    const E = 0.1;

    const waveK = TAU / (size * 0.6);

    const amp = size * 0.01;
    for (const p of this.particles) {
      const u = (t - p.delay) / p.dur;
      if (u <= 0) { p.a = 0; continue; }

      if (u < 1) {
        const e = easeSettle(u);
        p.x = p.hx + (p.fx - p.hx) * (1 - e);
        p.y = p.hy + (p.fy - p.hy) * (1 - e);
        if (p.fa === undefined) {
          p.a = p.a0 * Math.min(1, u / 0.3) * (0.25 + 0.75 * e) * (1 - disperse);
          p.drawSize = p.size * (1 + 0.5 * (1 - e));
        } else {
          p.a = (p.fa + (p.a0 - p.fa) * e) * (1 - disperse);
          p.drawSize = p.fs + (p.size - p.fs) * e;
        }
        continue;
      }

      const env = 1 / (1 + (p.r / size) * 0.5);
      const wave = Math.sin(p.r * waveK - t * 0.8) * env;

      const wl = wave * (0.35 + 0.65 * p.k);
      p.drawSize = Math.max(1.2, p.size * (1 + wl * 0.4));
      p.a = Math.min(1, p.a0 * Math.max(0.24, 1 + wl * 0.85) * (1 - disperse));
      let tx = p.hx + p.nx * wave * amp * p.k;
      let ty = p.hy + p.ny * wave * amp * p.k;
      if (disperse > 0) { tx += (p.sx - p.hx) * disperse; ty += (p.sy - p.hy) * disperse; }
      if (P.on) {
        const dx = P.x - p.hx, dy = P.y - p.hy, d = Math.hypot(dx, dy);
        if (d < radius) {
          const f = 1 - d / radius;
          const n = Math.min(1, (f * f * pull) / (d || 1));
          tx += dx * n; ty += dy * n;
        }
      }
      p.x += (tx - p.x) * E;
      p.y += (ty - p.y) * E;
    }
  }

  settle() { for (const p of this.particles) { p.x = p.hx; p.y = p.hy; p.a = p.a0; p.drawSize = p.size; } }

  draw() {
    const c = this.ctx;
    c.clearRect(0, 0, this.w, this.h);
    for (let g = 0; g < COLORS.length; g++) {
      const bins = this.bins[g];
      for (const b of bins) b.length = 0;
      for (const p of this.groups[g]) {
        if (p.a < 0.02) continue;
        bins[Math.min(LEVELS - 1, Math.round(p.a * (LEVELS - 1)))].push(p);
      }
      c.fillStyle = COLORS[g];
      for (let k = 1; k < LEVELS; k++) {
        const bin = bins[k];
        if (!bin.length) continue;
        c.globalAlpha = k / (LEVELS - 1);
        c.beginPath();
        for (const p of bin) {
          const rr = (p.drawSize || p.size) / 2;
          c.moveTo(p.x + rr, p.y);
          c.arc(p.x, p.y, rr, 0, TAU);
        }
        c.fill();
      }
    }
    c.globalAlpha = 1;
  }
}
