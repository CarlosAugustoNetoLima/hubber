/**
 * Destaque dos títulos (<mark class="hl">). Quando o título entra na tela,
 * põe .hl-on nele e o CSS pinta cada linha em sequência. O estado fica no
 * título, não na <mark>, porque o SplitText recria as marcas a cada quebra
 * de linha (resize) e elas precisam nascer já pintadas.
 */
(function () {
  'use strict';
  var marks = document.querySelectorAll('.hl');
  if (!marks.length) return;
  var heads = [];
  marks.forEach(function (m) {
    var h = m.closest('h1, h2, h3') || m.parentElement;
    if (heads.indexOf(h) < 0) heads.push(h);
  });
  var light = function (h) {
    h.querySelectorAll('.hl').forEach(function (m, i) { m.style.setProperty('--hl-d', (i * 0.16) + 's'); });
    h.classList.add('hl-on');
  };
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) {
    heads.forEach(light);
    return;
  }
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (!en.isIntersecting) return;
      var h = en.target;
      io.unobserve(h);
      /* títulos com revelação por linha: espera as linhas subirem */
      var wait = h.matches('.js-split, .js-intro-title') ? 650 : 150;
      window.setTimeout(function () { light(h); }, wait);
    });
  }, { threshold: 0.35 });
  heads.forEach(function (h) { io.observe(h); });
})();
