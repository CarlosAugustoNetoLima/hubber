

const live = [];
const HEADER_H = 72;
const INTO_PIN = 0.08;
const WIDE = window.matchMedia('(min-width: 768px)');

export function initFilm() {
  document.querySelectorAll('[data-film]').forEach((sec) => {
    const track = sec.querySelector('[data-film-track]');
    const frame = sec.querySelector('.film__frame');
    const video = sec.querySelector('.film__media video');
    const glow = sec.querySelector('[data-film-glow]');
    const play = sec.querySelector('[data-film-play]');
    const glass = sec.querySelector('.film__glass');
    if (!track || !frame || !video) return;
    sec.classList.add('film--live');

    video.removeAttribute('controls');
    const ease = gsap.parseEase('hub') || ((t) => t);

    const glowOn = () => !!glow && glow.offsetParent !== null;

    const curtain = ScrollTrigger.create({
      trigger: track,
      start: 'top 92%',
      end: 'top 30%',
      scrub: 0.6,
      onUpdate: (st) => sec.style.setProperty('--open', ease(st.progress).toFixed(4)),
    });

    const bandTop = () => `top ${HEADER_H + (glass ? glass.offsetHeight : 0)}px`;
    const reveal = ScrollTrigger.create({
      trigger: track,
      start: bandTop,
      end: () => `top ${HEADER_H - window.innerHeight * INTO_PIN}px`,
      scrub: 0.6,
      onUpdate: (st) => {
        if (!WIDE.matches) return;
        sec.style.setProperty('--reveal', ease(st.progress).toFixed(4));
      },
    });
    const drift = ScrollTrigger.create({
      trigger: track,
      start: bandTop,
      end: 'bottom bottom',
      scrub: 0.6,
      onUpdate: (st) => {
        if (!WIDE.matches) return;
        sec.style.setProperty('--py', ((st.progress - 0.5) * -60).toFixed(1));
      },
    });
    sec.style.setProperty('--open', '0');
    sec.style.setProperty('--reveal', '0');

    const syncTime = () => {
      if (!glowOn() || glow.seeking) return;
      const d = glow.duration;
      glow.currentTime = Number.isFinite(d) ? Math.min(video.currentTime, d) : video.currentTime;
    };
    const onVideoPlay = () => {
      sec.classList.add('is-playing');
      if (glowOn()) { syncTime(); glow.play().catch(() => {}); }
    };
    const onVideoPause = () => { if (glow) glow.pause(); };
    let ticks = 0;
    const onTimeUpdate = () => { if (glowOn() && ++ticks % 8 === 0) syncTime(); };

    const onPlay = () => {
      sec.classList.add('is-playing');
      video.setAttribute('controls', '');
      video.play().catch(() => {});
      video.focus({ preventScroll: true });
    };
    play && play.addEventListener('click', onPlay);
    video.addEventListener('play', onVideoPlay);
    video.addEventListener('pause', onVideoPause);
    video.addEventListener('ended', onVideoPause);
    video.addEventListener('seeked', syncTime);
    video.addEventListener('timeupdate', onTimeUpdate);

    const io = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting && !video.paused) video.pause();
    }, { threshold: 0 });
    io.observe(frame);

    live.push({ sec, video, glow, play, triggers: [curtain, reveal, drift], io, onPlay, onVideoPlay, onVideoPause, syncTime, onTimeUpdate });
  });
}

export function teardownFilm() {
  live.forEach(({ sec, video, glow, play, triggers, io, onPlay, onVideoPlay, onVideoPause, syncTime, onTimeUpdate }) => {
    triggers.forEach((st) => st.kill());
    io.disconnect();
    play && play.removeEventListener('click', onPlay);
    video.removeEventListener('play', onVideoPlay);
    video.removeEventListener('pause', onVideoPause);
    video.removeEventListener('ended', onVideoPause);
    video.removeEventListener('seeked', syncTime);
    video.removeEventListener('timeupdate', onTimeUpdate);
    if (glow) glow.pause();
    sec.classList.remove('film--live', 'is-playing');
    sec.style.removeProperty('--open');
    sec.style.removeProperty('--reveal');
    sec.style.removeProperty('--py');
    video.setAttribute('controls', '');
  });
  live.length = 0;
}
