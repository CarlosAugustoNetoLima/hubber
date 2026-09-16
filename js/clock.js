

export function initClocks(root = document) {
  const nodes = Array.from(root.querySelectorAll('time[data-tz]'));
  if (!nodes.length) return;

  const fmts = new Map();
  const fmtFor = (tz, locale) => {
    const key = tz + '|' + locale;
    if (!fmts.has(key)) {
      fmts.set(key, new Intl.DateTimeFormat(locale, {
        hour: '2-digit', minute: '2-digit', hour12: false, timeZone: tz,
      }));
    }
    return fmts.get(key);
  };

  function tick() {
    const now = new Date();
    for (const el of nodes) {
      const tz = el.dataset.tz;
      const locale = el.dataset.locale || document.documentElement.lang || 'pt-BR';
      try {
        el.textContent = fmtFor(tz, locale).format(now);
        el.setAttribute('datetime', now.toISOString());
      } catch (_) {
        el.textContent = '--:--';
      }
    }
  }

  tick();

  const ms = 60000 - (Date.now() % 60000);
  setTimeout(() => { tick(); setInterval(tick, 60000); }, ms);
}
