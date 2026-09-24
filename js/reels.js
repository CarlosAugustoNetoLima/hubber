import { initReelsForm } from './reels-form.js';
import { initParede } from './reels-parede.js';
import { initConsentimento } from './consentimento.js';

const UTM_KEYS = [
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
  'fbclid', 'gclid'
];
const STORE_KEY = 'hubber:reels:origin';
const paradoQuieto = window.matchMedia('(prefers-reduced-motion: reduce)');

function lerOrigem() {
  try {
    return JSON.parse(sessionStorage.getItem(STORE_KEY) || '{}');
  } catch {
    return {};
  }
}

function capturarOrigem() {
  const params = new URLSearchParams(location.search);
  const vindos = {};
  /* O fbclid novo da Meta passa fácil de 200 caracteres, com o sufixo _aem_.
     Cortado, ele não casa com mais nada, então só ele ganha um teto maior. */
  for (const chave of UTM_KEYS) {
    const valor = params.get(chave);
    if (valor) vindos[chave] = valor.slice(0, chave === 'fbclid' ? 500 : 200);
  }
  if (!Object.keys(vindos).length) return lerOrigem();

  const origem = { ...lerOrigem(), ...vindos, landing: location.pathname };
  try {
    sessionStorage.setItem(STORE_KEY, JSON.stringify(origem));
  } catch {}
  return origem;
}

function revelar() {
  const alvos = document.querySelectorAll('[data-reveal]');
  if (!alvos.length) return;

  if (paradoQuieto.matches) {
    alvos.forEach((el) => el.classList.add('is-in'));
    return;
  }

  document.documentElement.classList.add('reveal-ready');

  for (const grupo of document.querySelectorAll('.lp-sec__head, .bento, .plans, .steps, .lp-prose')) {
    [...grupo.querySelectorAll('[data-reveal]')].forEach((el, i) => {
      el.style.setProperty('--i', String(Math.min(i, 6)));
    });
  }

  const observador = new IntersectionObserver((entradas) => {
    for (const entrada of entradas) {
      if (!entrada.isIntersecting) continue;
      entrada.target.classList.add('is-in');
      observador.unobserve(entrada.target);
    }
  }, { rootMargin: '0px 0px -6% 0px', threshold: 0 });

  alvos.forEach((el) => observador.observe(el));

  window.setTimeout(() => {
    alvos.forEach((el) => el.classList.add('is-in'));
  }, 2500);
}

function brilhoDeCard() {
  if (paradoQuieto.matches) return;
  for (const card of document.querySelectorAll('[data-glow]')) {
    card.addEventListener('pointermove', (evento) => {
      const caixa = card.getBoundingClientRect();
      card.style.setProperty('--mx', `${((evento.clientX - caixa.left) / caixa.width) * 100}%`);
      card.style.setProperty('--my', `${((evento.clientY - caixa.top) / caixa.height) * 100}%`);
    });
  }
}

function botaoMagnetico() {
  if (paradoQuieto.matches || !window.matchMedia('(pointer: fine)').matches) return;

  for (const botao of document.querySelectorAll('[data-magnetic]')) {
    botao.addEventListener('pointermove', (evento) => {
      const caixa = botao.getBoundingClientRect();
      const dx = evento.clientX - (caixa.left + caixa.width / 2);
      const dy = evento.clientY - (caixa.top + caixa.height / 2);
      botao.style.setProperty('--tx', `${dx * 0.16}px`);
      botao.style.setProperty('--ty', `${dy * 0.22}px`);
    });
    botao.addEventListener('pointerleave', () => {
      botao.style.setProperty('--tx', '0px');
      botao.style.setProperty('--ty', '0px');
    });
  }
}

function lateraisFixas() {
  const cabecalhos = [...document.querySelectorAll('.lp-sec__head')];
  if (!cabecalhos.length) return;

  const medir = () => {
    for (const cabecalho of cabecalhos) {
      const altura = `${Math.round(cabecalho.offsetHeight)}px`;
      if (cabecalho.style.getPropertyValue('--head-h') !== altura) {
        cabecalho.style.setProperty('--head-h', altura);
      }
    }
  };

  medir();
  const observador = new ResizeObserver(medir);
  cabecalhos.forEach((cabecalho) => observador.observe(cabecalho));
  window.addEventListener('resize', medir);
}

function videosNaTela() {
  const videos = [...document.querySelectorAll('video[data-autoplay]')];
  if (!videos.length) return;

  if (paradoQuieto.matches) {
    videos.forEach((v) => v.removeAttribute('loop'));
    return;
  }

  const observador = new IntersectionObserver((entradas) => {
    for (const entrada of entradas) {
      if (entrada.isIntersecting) {
        entrada.target.play().catch(() => {});
      } else {
        entrada.target.pause();
      }
    }
  }, { rootMargin: '10% 0px', threshold: 0.25 });

  videos.forEach((video) => observador.observe(video));
}

function ctaFixo() {
  const heroi = document.querySelector('.lp-hero');
  if (!heroi) return;

  const observador = new IntersectionObserver(
    ([entrada]) => document.documentElement.classList.toggle('is-scrolled', !entrada.isIntersecting),
    { rootMargin: '-40% 0px 0px 0px' }
  );
  observador.observe(heroi);
}

function seletorDeIdioma() {
  const raiz = document.querySelector('[data-lang]');
  if (!raiz) return;

  const botao = raiz.querySelector('.lp-lang__btn');

  const fechar = () => {
    raiz.classList.remove('is-open');
    botao.setAttribute('aria-expanded', 'false');
  };

  botao.addEventListener('click', (evento) => {
    evento.stopPropagation();
    const abrir = !raiz.classList.contains('is-open');
    raiz.classList.toggle('is-open', abrir);
    botao.setAttribute('aria-expanded', String(abrir));
  });

  document.addEventListener('click', (evento) => {
    if (!raiz.contains(evento.target)) fechar();
  });

  raiz.addEventListener('keydown', (evento) => {
    if (evento.key === 'Escape') {
      fechar();
      botao.focus();
    }
  });
}

/* Quem chegou até a seção da reserva é público de remarketing: leu a oferta e
   não marcou. Dispara uma vez só. Para quem desativou a medição o pixel não
   existe, e o evento vira no-op. */
function viuAReserva() {
  const secao = document.querySelector('#book');
  if (!secao || !window.pixel) return;

  const observador = new IntersectionObserver(([entrada], self) => {
    if (!entrada.isIntersecting) return;
    self.disconnect();
    window.pixel.evento('ViewContent', {
      content_name: 'Reels Orlando, book the call',
      content_category: 'reels',
    });
  }, { threshold: 0.35 });
  observador.observe(secao);
}

capturarOrigem();
revelar();
brilhoDeCard();
botaoMagnetico();
lateraisFixas();
videosNaTela();
ctaFixo();
seletorDeIdioma();
viuAReserva();

initConsentimento();
initParede();
initReelsForm(document, lerOrigem);

export { capturarOrigem, lerOrigem };
