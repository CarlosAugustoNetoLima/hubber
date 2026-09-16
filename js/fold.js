

const live = [];
const ROOM = '(min-width: 1100px) and (min-height: 620px)';
const FINE = window.matchMedia('(pointer: fine)');
const HEADER_H = 72;
const HOLD = 0.2;
const smooth = (t) => t * t * (3 - 2 * t);

export function initFold() {
  document.querySelectorAll('[data-fold]').forEach((sec) => {
    const mm = gsap.matchMedia();
    live.push(mm);
    mm.add(ROOM, () => build(sec));
  });
}

function build(sec) {
  const track = sec.querySelector('[data-fold-track]');
  const items = Array.from(sec.querySelectorAll('[data-fold-item]'));
  const n = items.length;
  if (!track || n < 2) return undefined;

  sec.classList.add('fold--live');
  sec.style.setProperty('--n', n);

  const written = items.map(() => -1);
  const write = (p) => {
    const x = 1 + Math.max(0, Math.min(1, p)) * (n - 1);
    const k = Math.min(n - 1, Math.floor(x));
    const f = x - k;
    const s = k + smooth(Math.max(0, Math.min(1, (f - HOLD) / (1 - 2 * HOLD))));
    items.forEach((el, i) => {
      const o = Math.round(Math.max(0, 1 - Math.abs(s - (i + 1))) * 1000) / 1000;
      if (o !== written[i]) { written[i] = o; el.style.setProperty('--o', o); }
    });
  };

  const st = ScrollTrigger.create({
    trigger: track,
    start: `top ${HEADER_H}px`,
    end: 'bottom bottom',
    scrub: 0.5,
    snap: FINE.matches ? {
      snapTo: 1 / (n - 1),
      duration: { min: 0.25, max: 0.6 },
      delay: 0.1,
      ease: 'hub',
      directional: true,
    } : false,
    onUpdate: (self) => write(self.progress),
    onRefresh: (self) => write(self.progress),
  });
  write(st.progress);

  return () => {
    st.kill();
    sec.classList.remove('fold--live');
    sec.style.removeProperty('--n');
    items.forEach((el) => el.style.removeProperty('--o'));
  };
}

export function teardownFold() {
  live.forEach((mm) => mm.revert());
  live.length = 0;
}
