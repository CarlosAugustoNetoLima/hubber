

const live = [];
const DEPTH = 3;

const ROOM = '(min-height: 640px)';
const pad2 = (n) => String(n).padStart(2, '0');

const FINE = window.matchMedia('(pointer: fine)');

const unit = () => Math.min(1.111, Math.max(0.711, window.innerWidth * 0.000694));

const dim    = (d) => (d <= 0 ? 1 : d === 1 ? 0.6 : d === 2 ? 0.35 : 0);
const lift   = (d) => -18 * unit() * Math.min(d, DEPTH);
const shrink = (d) => 1 - 0.045 * Math.min(d, DEPTH);

export function initDeck({ lenis = null } = {}) {
  document.querySelectorAll('[data-deck]').forEach((sec) => {
    const mm = gsap.matchMedia();
    live.push(mm);
    mm.add(ROOM, () => build(sec, lenis));
  });
}

function build(sec, lenis) {
    const track = sec.querySelector('[data-deck-track]');
    const stage = sec.querySelector('[data-deck-stage]');
    const cards = gsap.utils.toArray(sec.querySelectorAll('[data-deck-card]'));
    const n = cards.length;
    if (!track || !stage || n < 2) return undefined;

    const counter = sec.querySelector('[data-deck-counter]');
    const total   = sec.querySelector('[data-deck-total]');
    const bar     = sec.querySelector('[data-deck-bar]');

    sec.classList.add('deck--live');
    sec.style.setProperty('--n', n);
    if (total) total.textContent = pad2(n);

    const below = () => stage.getBoundingClientRect().height;
    const park = () => {
      const p = tl ? tl.progress() * (n - 1) : 0;
      cards.forEach((c, k) => { if (k > 0 && p <= k - 1) gsap.set(c, { y: below(), rotate: 3 }); });
    };
    cards.forEach((c, i) => { c.style.zIndex = i + 1; });
    gsap.set(cards, { transformOrigin: '50% 0%' });
    let tl = null;
    park();

    let active = 0;
    const setActive = (i) => {
      if (i === active) return;
      active = i;
      cards.forEach((c, k) => {
        if (k !== i) c.querySelectorAll('video').forEach((v) => { if (!v.paused) v.pause(); });
      });
      if (counter) counter.textContent = pad2(i + 1);
    };

    tl = gsap.timeline({
      scrollTrigger: {
        trigger: track,
        start: 'top 72px',
        end: 'bottom bottom',
        scrub: 0.8,
        invalidateOnRefresh: true,

        refreshPriority: -1,
        snap: FINE.matches ? {
          snapTo: 1 / (n - 1),
          duration: { min: 0.25, max: 0.7 },
          delay: 0.12,
          ease: 'hub',
          directional: true,
        } : false,
        onUpdate: (st) => {
          const p = st.progress * (n - 1);
          if (bar) bar.style.transform = `scaleX(${st.progress})`;
          setActive(Math.round(p));
        },
      },
    });

    for (let k = 1; k < n; k++) {
      const at = k - 1;
      tl.fromTo(cards[k],
        { y: () => below(), rotate: 3 },
        { y: 0, rotate: 0, duration: 1, ease: 'power3.out', immediateRender: false },
        at);
      for (let j = 0; j < k; j++) {
        const d = k - j;
        tl.fromTo(cards[j],
          { scale: () => shrink(d - 1), y: () => lift(d - 1), opacity: dim(d - 1) },
          { scale: () => shrink(d),     y: () => lift(d),     opacity: dim(d), duration: 1, ease: 'power2.inOut', immediateRender: false },
          at);
      }
    }

    const goTo = (i) => {
      const st = tl.scrollTrigger;
      const top = st.start + (i * (st.end - st.start)) / (n - 1);
      if (lenis) lenis.scrollTo(top, { duration: 0.9 });
      else window.scrollTo({ top, behavior: 'smooth' });
    };
    const onFocus = (e) => {
      const i = cards.indexOf(e.target.closest('[data-deck-card]'));
      if (i >= 0 && i !== active) goTo(i);
    };
    sec.addEventListener('focusin', onFocus);

    ScrollTrigger.addEventListener('refresh', park);

    return () => {
      ScrollTrigger.removeEventListener('refresh', park);
      sec.removeEventListener('focusin', onFocus);
      if (tl.scrollTrigger) tl.scrollTrigger.kill(true);
      tl.kill();
      gsap.set(cards, { clearProps: 'all' });
      cards.forEach((c) => { c.style.zIndex = ''; });
      if (bar) bar.style.transform = '';
      if (counter) counter.textContent = '01';
      sec.classList.remove('deck--live');
      sec.style.removeProperty('--n');
    };
}

export function teardownDeck() {
  live.forEach((mm) => mm.revert());
  live.length = 0;
}
