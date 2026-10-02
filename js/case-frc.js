/**
 * Case Florida Rental Car — efeitos do painel "Marketing OS" e do resultado.
 *
 * Arquivo próprio (e não inline) porque a CSP do site só libera script de
 * 'self' + hashes. Sem JS, ou com prefers-reduced-motion, tudo aparece pronto:
 * os módulos já vêm "online" no HTML, as barras já vêm no tamanho final e o
 * terminal já traz o texto completo. O JS só arma a animação por cima.
 */
(function () {
  'use strict';

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var hasIO = 'IntersectionObserver' in window;

  /* ── Painel ─────────────────────────────────────────────────────────── */
  var os = document.querySelector('[data-frc-os]');
  if (os) {
    var mods = Array.prototype.slice.call(os.querySelectorAll('.frc-mod'));
    var body = os.querySelector('.frc-os__body');
    var svg = os.querySelector('.frc-os__net');
    var counter = os.querySelector('[data-frc-count]');
    var term = os.querySelector('[data-frc-term]');
    var out = term && term.querySelector('[data-frc-out]');
    var labels = {
      on: os.getAttribute('data-on') || 'online',
      boot: os.getAttribute('data-boot') || 'booting',
      off: os.getAttribute('data-off') || 'standby'
    };

    var setState = function (mod, text) {
      var s = mod.querySelector('[data-frc-state]');
      if (s) s.textContent = text;
    };

    /* Holofote que segue o cursor dentro de cada módulo */
    mods.forEach(function (mod) {
      mod.addEventListener('pointermove', function (e) {
        var r = mod.getBoundingClientRect();
        mod.style.setProperty('--mx', (e.clientX - r.left) + 'px');
        mod.style.setProperty('--my', (e.clientY - r.top) + 'px');
      });
    });

    /* Trilhas ortogonais (estilo placa de circuito) ligando 01 → 08.
       Passam por trás dos cards, então só aparecem nos vãos entre eles. */
    var draw = function () {
      if (!svg || !body || !mods.length) return;
      var br = body.getBoundingClientRect();
      if (!br.width) return;
      svg.setAttribute('viewBox', '0 0 ' + br.width + ' ' + br.height);
      var pts = mods.map(function (m) {
        var r = m.getBoundingClientRect();
        return { x: r.left - br.left + r.width / 2, y: r.top - br.top + r.height / 2, h: r.height };
      });
      var d = 'M' + pts[0].x + ' ' + pts[0].y;
      for (var i = 1; i < pts.length; i++) {
        var a = pts[i - 1], p = pts[i];
        if (Math.abs(a.y - p.y) < 4) {
          d += ' L' + p.x + ' ' + p.y;
        } else {
          var midY = ((a.y + a.h / 2) + (p.y - p.h / 2)) / 2;
          d += ' L' + a.x + ' ' + midY + ' L' + p.x + ' ' + midY + ' L' + p.x + ' ' + p.y;
        }
      }
      svg.querySelectorAll('path').forEach(function (el) { el.setAttribute('d', d); });
      var g = svg.querySelector('#frcGrad');
      if (g) g.setAttribute('x2', String(br.width));
      os.classList.add('is-drawn');
    };

    draw();
    if ('ResizeObserver' in window && body) new ResizeObserver(draw).observe(body);
    window.addEventListener('load', draw);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(draw);

    if (reduce) {
      var packet = svg && svg.querySelector('.frc-packet');
      if (packet) packet.remove();
    }

    /* Boot sequencial quando o painel entra na tela */
    if (!reduce && hasIO) {
      os.classList.add('is-armed');
      mods.forEach(function (m) { setState(m, labels.off); });
      if (counter) counter.textContent = '0/' + mods.length;
      var full = out ? out.textContent : '';
      if (out) out.textContent = '';

      var typeLine = function () {
        if (!out) return;
        var i = 0;
        var tick = function () {
          out.textContent = full.slice(0, ++i);
          if (i < full.length) window.setTimeout(tick, 22);
        };
        tick();
      };

      var boot = function () {
        var online = 0;
        mods.forEach(function (m, idx) {
          window.setTimeout(function () {
            m.classList.add('is-booting');
            setState(m, labels.boot);
            window.setTimeout(function () {
              m.classList.remove('is-booting');
              m.classList.add('is-on');
              setState(m, labels.on);
              online += 1;
              if (counter) counter.textContent = online + '/' + mods.length;
              if (online === mods.length) typeLine();
            }, 280);
          }, 170 * idx);
        });
      };

      var io = new IntersectionObserver(function (entries) {
        if (entries[0].isIntersecting) { io.disconnect(); boot(); }
      }, { threshold: 0.2 });
      io.observe(os);
    }
  }

  /* ── Barras do resultado ────────────────────────────────────────────── */
  var bars = document.querySelector('[data-frc-bars]');
  if (bars && !reduce && hasIO) {
    bars.classList.add('is-armed');
    var io2 = new IntersectionObserver(function (entries) {
      if (entries[0].isIntersecting) {
        io2.disconnect();
        window.requestAnimationFrame(function () { bars.classList.add('is-in'); });
      }
    }, { threshold: 0.35 });
    io2.observe(bars);
  }
})();
