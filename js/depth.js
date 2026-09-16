

let trigger = null;
let io = null;
let targets = [];
let hdr = null;

export function initDepth() {
  const main = document.querySelector('main');
  if (!main) return;
  const door = document.querySelector('[data-door-track]');
  let pts = [];

  const top = (el) => el.getBoundingClientRect().top + window.scrollY;
  const measure = () => {
    const y0 = top(main);
    const y1 = y0 + main.offsetHeight - window.innerHeight;
    if (door) {
      const d0 = top(door);
      const d1 = d0 + door.offsetHeight - window.innerHeight;
      pts = [[y0, 0], [d0, 0.2], [d1, 0.8], [y1, 1]];
    } else {
      pts = [[y0, 0], [y1, 1]];
    }
  };
  const depthAt = (y) => {
    if (!pts.length) return 0;
    if (y <= pts[0][0]) return pts[0][1];
    for (let i = 1; i < pts.length; i++) {
      const [ya, da] = pts[i - 1], [yb, db] = pts[i];
      if (y <= yb) return yb === ya ? db : da + ((y - ya) / (yb - ya)) * (db - da);
    }
    return pts[pts.length - 1][1];
  };

  hdr = document.querySelector('.hdr');
  targets = [hdr, document.querySelector('.sticky-cta'), ...main.children, document.querySelector('.ftr')].filter(Boolean);
  const onScreen = new Set();
  let q = 0;
  const paint = (el) => {
    if (el.__depth === q) return;
    el.__depth = q;
    el.style.setProperty('--depth', q.toFixed(2));
  };
  const write = () => {
    const d = depthAt(window.scrollY);
    if (hdr) hdr.style.setProperty('--line', d.toFixed(4));
    const nq = Math.round(d * 50) / 50;
    if (nq !== q) { q = nq; onScreen.forEach(paint); }
  };

  trigger = ScrollTrigger.create({
    trigger: main,
    start: 'top top',
    end: 'bottom bottom',
    onUpdate: write,
    onRefresh: () => { measure(); write(); },
  });
  measure();
  write();

  io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) { onScreen.add(e.target); paint(e.target); }
      else onScreen.delete(e.target);
    });
  }, { rootMargin: '20% 0px' });
  targets.forEach((el) => io.observe(el));
}

export function teardownDepth() {
  if (trigger) { trigger.kill(); trigger = null; }
  if (io) { io.disconnect(); io = null; }
  targets.forEach((el) => { el.style.removeProperty('--depth'); delete el.__depth; });
  targets = [];
  if (hdr) hdr.style.removeProperty('--line');
}
