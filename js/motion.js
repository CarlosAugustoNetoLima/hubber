

import { initDeck, teardownDeck } from './deck.js';
import { initDoor, teardownDoor } from './door.js';
import { initFold, teardownFold } from './fold.js';
import { initFilm, teardownFilm } from './film.js';
import { initDepth, teardownDepth } from './depth.js';

const HTML = document.documentElement;
const REDUCE = window.matchMedia('(prefers-reduced-motion: reduce)');
const DESKTOP = '(min-width: 861px)';

let lenis = null;
let splits = [];
let classObserver = null;

export function initMotion() {
  if (REDUCE.matches || !HTML.classList.contains('has-motion')) return;

  const ok = window.gsap && window.ScrollTrigger && window.SplitText && window.CustomEase;
  if (!ok) { HTML.classList.remove('has-motion'); return; }

  gsap.registerPlugin(ScrollTrigger, SplitText, CustomEase);
  CustomEase.create('hub', 'M0,0 C0.32,0 0.12,1 1,1');
  gsap.defaults({ ease: 'hub', duration: 1.0 });

  initLenis();
  initFold();
  initDoor();
  initDeck({ lenis });
  initFilm();
  initDepth();
  initReveals();
  initLineReveals();
  initCounters();
  initPhasesPin();
  initHeroIntro();

  HTML.classList.add('motion-ready');
  REDUCE.addEventListener('change', (e) => { if (e.matches) teardown(); });
}

function initLenis() {
  if (!window.Lenis) return;
  lenis = new Lenis({
    duration: 1.1,
    smoothWheel: true,
    anchors: { offset: -88 },
  });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);

  classObserver = new MutationObserver(() => {
    if (!lenis) return;
    HTML.classList.contains('menu-open') ? lenis.stop() : lenis.start();
  });
  classObserver.observe(HTML, { attributes: true, attributeFilter: ['class'] });
}

function initReveals() {
  gsap.utils.toArray('[data-reveal]').forEach((el) => {
    gsap.set(el, { opacity: 0, y: 24 });
    gsap.to(el, {
      opacity: 1, y: 0,
      scrollTrigger: { trigger: el, start: 'top 88%', once: true },
    });
  });

  gsap.utils.toArray('[data-reveal-group]').forEach((group) => {
    const kids = Array.from(group.children);
    if (!kids.length) return;
    gsap.set(kids, { opacity: 0, y: 24 });
    gsap.to(kids, {
      opacity: 1, y: 0, stagger: 0.08,
      scrollTrigger: { trigger: group, start: 'top 85%', once: true },
    });
  });
}

function splitAndReveal(el, tweenVars) {
  const split = SplitText.create(el, {
    type: 'lines',
    mask: 'lines',
    aria: 'auto',
    autoSplit: true,
    onSplit: (self) => gsap.from(self.lines, { yPercent: 110, duration: 1.2, stagger: 0.1, ...tweenVars }),
  });
  splits.push(split);
  gsap.set(el, { opacity: 1 });
  return split;
}

function initLineReveals() {
  const targets = gsap.utils.toArray('.js-split');
  if (!targets.length) return;
  document.fonts.ready.then(() => {
    targets.forEach((el) => {
      splitAndReveal(el, { scrollTrigger: { trigger: el, start: 'top 85%', once: true } });
    });
  });
}

async function initHeroIntro() {
  const hero = document.querySelector('[data-hero]');
  if (!hero) return;
  const title = hero.querySelector('.js-intro-title');
  const rest = hero.querySelectorAll('[data-intro]');

  await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 700))]);

  if (title) splitAndReveal(title, {});
  if (rest.length) {
    gsap.fromTo(rest, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 1.0, stagger: 0.1, delay: 0.45 });
  }
}

function initCounters() {
  gsap.utils.toArray('[data-count]').forEach((el) => {
    const end = parseFloat(el.dataset.count);
    if (Number.isNaN(end)) return;
    const prefix = el.dataset.prefix || '';
    const suffix = el.dataset.suffix || '';
    const state = { v: 0 };
    ScrollTrigger.create({
      trigger: el, start: 'top 85%', once: true,
      onEnter: () => gsap.to(state, {
        v: end, duration: 1.4, snap: { v: 1 },
        onUpdate: () => { el.textContent = prefix + Math.round(state.v) + suffix; },
      }),
    });
  });
}

function initPhasesPin() {
  const sec = document.getElementById('metodo');
  const wrap = sec && sec.querySelector('.wrap');
  const bar = sec && sec.querySelector('.phases__progress');
  const nums = sec ? sec.querySelectorAll('.phase__num') : [];
  if (!wrap || !bar || !nums.length) return;

  const mm = gsap.matchMedia();
  mm.add(DESKTOP, () => {
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: wrap,
        pin: wrap,
        start: 'top top+=96',
        end: '+=120%',
        scrub: 0.6,
        anticipatePin: 1,
      },
    });
    tl.fromTo(bar, { scaleX: 0 }, { scaleX: 1, ease: 'none', duration: 3 }, 0);

    nums.forEach((n, i) => {
      tl.fromTo(n, { '--lit': 0 }, { '--lit': 1, ease: 'none', duration: 0.5 }, i + 0.35);
    });
  });
}

function teardown() {
  teardownDepth();
  teardownFilm();
  teardownFold();
  teardownDoor();
  teardownDeck();
  ScrollTrigger.getAll().forEach((t) => t.kill(true));
  gsap.globalTimeline.clear();
  splits.forEach((s) => s.revert());
  splits = [];
  gsap.set(
    '[data-reveal], [data-reveal-group] > *, [data-intro], .js-split, .js-intro-title, .phase__num, .phases__progress',
    { clearProps: 'all' }
  );
  if (lenis) { lenis.destroy(); lenis = null; }
  if (classObserver) { classObserver.disconnect(); classObserver = null; }
  HTML.classList.remove('has-motion', 'motion-ready', 'lenis', 'lenis-smooth', 'lenis-stopped');
}
