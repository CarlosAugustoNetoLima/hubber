

const REDUCE = window.matchMedia('(prefers-reduced-motion: reduce)');
const SECONDS_PER_LANE = 4.5;
const BURST = 9;

export function initReel(root = document) {
  const reel = root.querySelector('[data-reel]');
  if (!reel) return;
  const strips = Array.from(reel.querySelectorAll('[data-strip]'));
  const html = document.documentElement;
  if (!strips.length || REDUCE.matches || !window.gsap || !html.classList.contains('has-motion')) return;

  const originals = Array.from(reel.querySelectorAll('img'));
  strips.forEach((strip) => {
    Array.from(strip.children).forEach((img) => strip.appendChild(img.cloneNode(true)));
  });

  const tweens = strips.map((strip, i) => {
    const up = i % 2 === 0;
    const tween = gsap.fromTo(strip,
      { yPercent: up ? 0 : -50 },
      { yPercent: up ? -50 : 0, ease: 'none', repeat: -1, duration: 20, paused: true });
    tween.progress(i * 0.37);
    return tween;
  });

  function fit() {
    strips.forEach((strip, i) => {
      const lane = strip.parentElement.offsetHeight || 1;
      tweens[i].duration(((strip.offsetHeight / 2) / lane) * SECONDS_PER_LANE);
    });
  }

  let visible = true;
  let started = false;
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (started) tweens.forEach((t) => (visible ? t.resume() : t.pause()));
  }).observe(reel);

  window.addEventListener('resize', fit);

  const decoded = Promise.all(originals.map((img) => img.decode().catch(() => {})));
  Promise.race([decoded, new Promise((r) => setTimeout(r, 1200))]).then(() => {
    if (started) return;
    fit();
    started = true;
    tweens.forEach((t) => {
      t.timeScale(BURST);
      if (visible) t.play();
      gsap.to(t, { timeScale: 1, duration: 2.8, ease: 'power3.out' });
    });
  });
}
