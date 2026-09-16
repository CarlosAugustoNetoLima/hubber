

const live = [];
const INTRO_END = 0.12;
const TYPE_END = 0.42;
const OPEN_FROM = 0.48;
const OPEN_TO = 0.88;
const MARK_W = 1924, MARK_H = 1711.43;
const HEADER_H = 72;

function splitChars(el, start) {
  const text = el.textContent;
  el.setAttribute('aria-label', text);
  const spans = [];
  const walk = (node) => {
    Array.from(node.childNodes).forEach((n) => {
      if (n.nodeType === 3) {
        const frag = document.createDocumentFragment();
        for (const ch of n.textContent) {
          if (ch === ' ' || ch === '\n') { frag.appendChild(document.createTextNode(' ')); continue; }
          const c = document.createElement('span');
          c.className = 'door__c';
          c.textContent = ch;
          c.setAttribute('aria-hidden', 'true');
          c.style.setProperty('--i', start + spans.length);
          spans.push(c);
          frag.appendChild(c);
        }
        n.replaceWith(frag);
      } else if (n.nodeType === 1) walk(n);
    });
  };
  walk(el);
  return spans;
}

export function initDoor() {
  document.querySelectorAll('[data-door]').forEach((sec) => {
    const track = sec.querySelector('[data-door-track]');
    const stage = sec.querySelector('[data-door-stage]');
    const clip = sec.querySelector('[data-door-clip]');
    if (!track || !stage) return;

    let chars = [];
    sec.querySelectorAll('.door__layer').forEach((layer) => {
      const list = [];
      layer.querySelectorAll('.door__title').forEach((el) => list.push(...splitChars(el, list.length)));
      if (layer.classList.contains('door__out')) chars = list;
    });

    stage.style.setProperty('--n', chars.length);
    const out = sec.querySelector('.door__out');
    const label = out.querySelector('.t-label');
    const caret = document.createElement('span');
    caret.className = 'door__caret';
    caret.setAttribute('aria-hidden', 'true');
    out.appendChild(caret);

    sec.classList.add('door--live');
    const ease = gsap.parseEase('hub') || ((t) => t);
    const proxy = { p: 0 };

    const place = (t) => {
      if (!clip) return;
      const w = stage.clientWidth, h = stage.clientHeight;
      const sMin = (h * 0.06) / MARK_H;
      const sMax = 1.7 * Math.max(w / MARK_W, h / MARK_H);
      const s = sMin * Math.pow(sMax / sMin, t);
      clip.setAttribute('transform',
        `translate(${(w / 2).toFixed(1)} ${(h / 2).toFixed(1)}) scale(${s.toFixed(5)}) translate(${-MARK_W / 2} ${-MARK_H / 2})`);
    };

    const measureLabel = () => {
      if (!label) return;

      const prevIntro = stage.style.getPropertyValue('--intro');
      stage.style.setProperty('--intro', '1');
      const lr = label.getBoundingClientRect(), sr = stage.getBoundingClientRect();
      const stageCenterY = HEADER_H + (window.innerHeight - HEADER_H) / 2;
      const labelCenterYWhenStuck = HEADER_H + (lr.top - sr.top) + lr.height / 2;
      stage.style.setProperty('--label-dy', Math.round(stageCenterY - labelCenterYWhenStuck) + 'px');

      stage.style.setProperty('--label-scale', Math.min(9, (stage.clientWidth * 0.88) / lr.width).toFixed(3));
      if (prevIntro) stage.style.setProperty('--intro', prevIntro); else stage.style.removeProperty('--intro');
    };

    let marks = [];
    const measureChars = () => {
      const o = out.getBoundingClientRect();
      marks = chars.map((c) => {
        const r = c.getBoundingClientRect();
        return [Math.round(r.right - o.left + 2), Math.round(r.top - o.top), Math.round(r.height)];
      });
    };
    const placeCaret = (typed) => {
      const n = marks.length;
      if (!n) return;
      if (typed <= 0 || typed >= 1) { caret.style.opacity = '0'; return; }
      const [x, y, h] = marks[Math.min(n - 1, Math.floor(typed * n))];
      caret.style.opacity = '1';
      caret.style.height = h + 'px';
      caret.style.transform = `translate(${x}px, ${y}px)`;
    };

    const written = {};
    const set = (k, v) => { if (written[k] !== v) { written[k] = v; stage.style.setProperty(k, v); } };
    const write = () => {
      const p = proxy.p;
      const intro = ease(Math.min(1, p / INTRO_END));
      const typed = Math.max(0, Math.min(1, p / TYPE_END));
      const t = ease(Math.max(0, Math.min(1, (p - OPEN_FROM) / (OPEN_TO - OPEN_FROM))));
      set('--intro', intro.toFixed(4));
      set('--typed', typed.toFixed(4));
      set('--open', t.toFixed(4));
      set('--fill', Math.max(0, Math.min(1, (t - 0.82) / 0.18)).toFixed(4));
      place(t);
      placeCaret(typed);
    };

    const tween = gsap.to(proxy, {
      p: 1,
      ease: 'none',
      onUpdate: write,
      scrollTrigger: { trigger: track, start: `top ${HEADER_H}px`, end: 'bottom bottom', scrub: 0.6 },
    });
    const onRefresh = () => {
      if (!sec.classList.contains('door--live')) return;
      measureLabel(); measureChars(); write();
    };
    ScrollTrigger.addEventListener('refresh', onRefresh);
    document.fonts && document.fonts.ready.then(onRefresh);
    onRefresh();
    live.push({ sec, stage, tween, onRefresh });
  });
}

export function teardownDoor() {
  live.forEach(({ sec, stage, tween, onRefresh }) => {
    ScrollTrigger.removeEventListener('refresh', onRefresh);
    if (tween.scrollTrigger) tween.scrollTrigger.kill(true);
    tween.kill();
    sec.classList.remove('door--live');
    ['--open', '--fill', '--typed', '--intro', '--label-dy', '--label-scale', '--n'].forEach((v) => stage.style.removeProperty(v));

    sec.querySelectorAll('[aria-label].door__title').forEach((el) => {
      const l1 = el.querySelector('.door__l1'), l2 = el.querySelector('.door__l2');
      if (l1 && l2) { l1.textContent = l1.textContent; l2.textContent = l2.textContent; }
      else el.textContent = el.textContent;
      el.removeAttribute('aria-label');
    });
    sec.querySelectorAll('.door__caret').forEach((c) => c.remove());
  });
  live.length = 0;
}
