/**
 * Case de identidade visual (template v2).
 *
 * 1. Carrossel com inércia: arrastar, trackpad horizontal, setas do teclado e a
 *    própria rolagem da página empurram o trilho; a posição corre atrás do alvo
 *    por lerp e o loop é infinito. A velocidade gera um leve zoom no slide e um
 *    parallax oposto na imagem — é isso que dá a sensação de material físico.
 * 2. Folha "Ler mais", que sobe por cima da página.
 * 3. Revelação por clip-path e parallax das imagens em tela cheia.
 *
 * Arquivo próprio porque a CSP só libera script de 'self'. Sem JS, o trilho é
 * uma rolagem horizontal nativa e todo o conteúdo já aparece pronto.
 */
(function () {
  'use strict';

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var root = document.documentElement;
  var lerp = function (a, b, t) { return a + (b - a) * t; };
  var clamp = function (v, lo, hi) { return Math.max(lo, Math.min(hi, v)); };
  var wrap = function (v, lo, hi) { var r = hi - lo; return ((((v - lo) % r) + r) % r) + lo; };

  /* ── 1. Carrossel ───────────────────────────────────────────────────── */
  var rail = document.querySelector('[data-bc-rail]');
  if (rail && !reduce) {
    var slides = Array.prototype.slice.call(rail.querySelectorAll('.bc-slide'));
    var imgs = slides.map(function (s) { return s.querySelector('img'); });
    var counter = document.querySelector('[data-bc-count]');
    var n = slides.length;
    var step = 0, total = 0, gap = 0;
    var target = 0, current = 0, vel = 0;
    var dragging = false, lastX = 0, hover = false, visible = true;
    var lastScroll = window.scrollY;
    var DRIFT = 0.35;

    var measure = function () {
      gap = parseFloat(getComputedStyle(rail).getPropertyValue('--bc-pad')) || 16;
      var w = slides[0].getBoundingClientRect().width;
      step = w + gap;
      total = step * n;
    };

    rail.classList.add('is-live');
    measure();
    window.addEventListener('resize', measure);

    var render = function () {
      if (visible) {
        if (!dragging && !hover) target -= DRIFT;
        var prev = current;
        current = lerp(current, target, 0.1);
        vel = current - prev;
        var v = clamp(vel, -100, 100);
        var sc = 1 + Math.abs(v) * 0.0018;
        for (var i = 0; i < n; i++) {
          var x = wrap(i * step + current + gap, -step, total - step);
          slides[i].style.transform = 'translate3d(' + x + 'px,0,0) scale(' + sc + ')';
          if (imgs[i]) imgs[i].style.transform = 'translate3d(' + (-v * 0.9) + 'px,0,0)';
        }
        if (counter) {
          var idx = Math.round(wrap(-current / step, 0, n)) % n;
          counter.textContent = String(idx + 1).padStart(2, '0') + ' / ' + String(n).padStart(2, '0');
        }
      }
      window.requestAnimationFrame(render);
    };
    window.requestAnimationFrame(render);

    /* arrastar (mouse e toque) */
    rail.addEventListener('pointerdown', function (e) {
      dragging = true; lastX = e.clientX;
      rail.classList.add('is-drag');
      rail.setPointerCapture(e.pointerId);
    });
    rail.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      target += (e.clientX - lastX) * 1.6;
      lastX = e.clientX;
    });
    var stop = function () { dragging = false; rail.classList.remove('is-drag'); };
    rail.addEventListener('pointerup', stop);
    rail.addEventListener('pointercancel', stop);
    rail.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse') hover = true; });
    rail.addEventListener('pointerleave', function () { hover = false; });

    /* trackpad horizontal: só intercepta quando o gesto é de fato lateral */
    rail.addEventListener('wheel', function (e) {
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        e.preventDefault();
        target -= e.deltaX * 0.9;
      }
    }, { passive: false });

    /* a rolagem vertical da página também empurra o trilho */
    window.addEventListener('scroll', function () {
      var y = window.scrollY;
      target -= (y - lastScroll) * 0.7;
      lastScroll = y;
    }, { passive: true });

    /* teclado */
    rail.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') { target -= step; e.preventDefault(); }
      if (e.key === 'ArrowLeft') { target += step; e.preventDefault(); }
    });

    /* fora da tela, para de calcular */
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (en) { visible = en[0].isIntersecting; }).observe(rail);
    }
  }

  /* ── 2. Folha "Ler mais" ────────────────────────────────────────────── */
  var sheet = document.querySelector('[data-bc-sheet]');
  if (sheet) {
    var opener = null;
    var open = function (e) {
      opener = e.currentTarget;
      sheet.hidden = false;
      void sheet.offsetWidth;
      sheet.classList.add('is-open');
      sheet.setAttribute('aria-hidden', 'false');
      var c = sheet.querySelector('[data-bc-close]');
      if (c) c.focus({ preventScroll: true });
    };
    var close = function () {
      sheet.classList.remove('is-open');
      sheet.setAttribute('aria-hidden', 'true');
      if (opener) opener.focus({ preventScroll: true });
    };
    document.querySelectorAll('[data-bc-open]').forEach(function (b) { b.addEventListener('click', open); });
    sheet.querySelectorAll('[data-bc-close]').forEach(function (b) { b.addEventListener('click', close); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && sheet.classList.contains('is-open')) close(); });
  }

  if (reduce) return;

  /* ── 3a. Revelação por clip-path ────────────────────────────────────── */
  var reveals = document.querySelectorAll('[data-bc-reveal]');
  if (reveals.length && 'IntersectionObserver' in window) {
    root.classList.add('bc-armed');
    /* O clip-path zera a área do próprio elemento, então o observador vigia o
       pai (que não é recortado) e revela os filhos dele. */
    var groups = new Map();
    reveals.forEach(function (el) {
      var p = el.parentElement;
      if (!groups.has(p)) groups.set(p, []);
      groups.get(p).push(el);
    });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        groups.get(en.target).forEach(function (el) {
          var d = parseFloat(el.getAttribute('data-bc-reveal')) || 0;
          el.style.transitionDelay = d + 's';
          el.classList.add('is-in');
        });
        io.unobserve(en.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -5% 0px' });
    groups.forEach(function (_, p) { io.observe(p); });
  }

  /* ── 3b. Parallax das imagens em tela cheia ─────────────────────────── */
  var fulls = Array.prototype.slice.call(document.querySelectorAll('.bc-full'));
  if (fulls.length) {
    var tick = function () {
      var vh = window.innerHeight;
      fulls.forEach(function (f) {
        var r = f.getBoundingClientRect();
        if (r.bottom < 0 || r.top > vh) return;
        var p = clamp((vh - r.top) / (vh + r.height), 0, 1);   // 0 entrando → 1 saindo
        var img = f.querySelector('img');
        img.style.transform = 'translate3d(0,' + ((p - 0.5) * -12) + '%,0) scale(' + (1.22 - p * 0.12) + ')';
      });
      window.requestAnimationFrame(tick);
    };
    window.requestAnimationFrame(tick);
  }
})();
