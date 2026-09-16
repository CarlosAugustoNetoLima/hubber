

export function initHeader(root = document) {
  initDisclosure(root);
  initMobile(root);
  initStickyCta();
}

function initDisclosure(root) {
  const btn  = root.querySelector('[data-menu-btn]');
  const menu = btn && root.getElementById?.(btn.getAttribute('aria-controls'))
            || (btn && document.getElementById(btn.getAttribute('aria-controls')));
  if (!btn || !menu) return;

  const items = () => Array.from(menu.querySelectorAll('a[href]'));
  const isOpen = () => btn.getAttribute('aria-expanded') === 'true';

  function open(focusFirst = false) {
    btn.setAttribute('aria-expanded', 'true');
    menu.hidden = false;
    if (focusFirst) items()[0]?.focus();
  }
  function close(returnFocus = false) {
    btn.setAttribute('aria-expanded', 'false');
    menu.hidden = true;
    if (returnFocus) btn.focus();
  }

  btn.addEventListener('click', () => (isOpen() ? close() : open()));

  btn.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); open(true); }
    if (e.key === 'Escape' && isOpen()) { e.preventDefault(); close(true); }
  });

  menu.addEventListener('keydown', (e) => {
    const list = items();
    const i = list.indexOf(document.activeElement);
    if (e.key === 'Escape') { e.preventDefault(); close(true); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); list[(i + 1) % list.length]?.focus(); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); list[(i - 1 + list.length) % list.length]?.focus(); }
    if (e.key === 'Home')      { e.preventDefault(); list[0]?.focus(); }
    if (e.key === 'End')       { e.preventDefault(); list[list.length - 1]?.focus(); }
  });

  const group = btn.closest('[data-menu-group]') || btn.parentElement;
  group.addEventListener('focusout', (e) => {
    if (!group.contains(e.relatedTarget)) close();
  });

  document.addEventListener('pointerdown', (e) => {
    if (isOpen() && !group.contains(e.target)) close();
  });
}

function initMobile(root) {
  const burger = root.querySelector('[data-burger]');
  const panel  = burger && document.getElementById(burger.getAttribute('aria-controls'));
  if (!burger || !panel) return;

  const html = document.documentElement;
  const isOpen = () => burger.getAttribute('aria-expanded') === 'true';

  function open() {
    burger.setAttribute('aria-expanded', 'true');
    burger.setAttribute('aria-label', 'Fechar menu');
    panel.hidden = false;
    html.classList.add('menu-open');
    panel.querySelector('a[href]')?.focus();
  }
  function close(returnFocus = false) {
    burger.setAttribute('aria-expanded', 'false');
    burger.setAttribute('aria-label', 'Abrir menu');
    panel.hidden = true;
    html.classList.remove('menu-open');
    if (returnFocus) burger.focus();
  }

  burger.addEventListener('click', () => (isOpen() ? close() : open()));
  panel.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(true); });

  const mq = window.matchMedia('(min-width: 901px)');
  mq.addEventListener('change', (e) => { if (e.matches && isOpen()) close(); });
}

function initStickyCta() {
  if (document.body.dataset.stickyCta === 'off') return;
  const hero = document.querySelector('[data-hero]');
  if (!hero || !('IntersectionObserver' in window)) return;
  const html = document.documentElement;
  const io = new IntersectionObserver(([entry]) => {
    const passed = !entry.isIntersecting && entry.boundingClientRect.bottom <= 0;
    html.classList.toggle('is-scrolled', passed);
  }, { threshold: 0 });
  io.observe(hero);
}
