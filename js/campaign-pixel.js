import {
  MARKETING_PIXEL_CONFIG,
  MARKETING_CONSENT_KEY,
  MARKETING_LEAD_KEY_PREFIX,
} from './campaign-pixel-config.js';

const EVENT_ID = /^(?:diagnostic_|clinic_)?[a-f\d]{8}-[a-f\d]{4}-[47][a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i;
const PAGE_PATHS = new Set([
  '/core/', '/agencia/', '/diagnostico/',
  '/en/core/', '/en/agency/', '/en/diagnostic/',
  '/plastic/', '/plastic/pt/',
]);
const instances = new WeakMap();
let browserController = null;

function read(storage, key) {
  try { return storage?.getItem(key) ?? null; } catch { return null; }
}

function write(storage, key, value) {
  try {
    if (!storage) return false;
    storage.setItem(key, value);
    return true;
  } catch { return false; }
}

function preference(value) {
  return value === 'granted' || value === 'denied' ? value : 'unset';
}

/** Injectable controller: importing or constructing it makes no network calls.
 * loadPixel returns an fbq-compatible function; all browser effects are injected.
 * Event return values mean handed to the SDK, not delivery confirmed by Meta.
 */
export function createMarketingPixelController({
  enabled = MARKETING_PIXEL_CONFIG.enabled,
  pixelId = MARKETING_PIXEL_CONFIG.pixelId,
  consentStorage,
  eventStorage,
  pageEligible = true,
  loadPixel = () => null,
  clearCookies = () => {},
  reload = () => {},
} = {}) {
  const configured = enabled === true && typeof pixelId === 'string' && /^\d{8,20}$/.test(pixelId);
  let consent = preference(read(consentStorage, MARKETING_CONSENT_KEY));
  let fbq = null;
  let initialized = false;
  let pageViewSent = false;
  const handledLeads = new Set();

  function init() {
    if (!configured || !pageEligible || consent !== 'granted') return false;
    try {
      if (!initialized) {
        fbq = loadPixel();
        if (typeof fbq !== 'function') return false;
        // Configure before init. Never pass customer data/advanced matching.
        // Meta's own template documents these consent and autoConfig commands:
        // github.com/facebook/GoogleTagManager-WebTemplate-For-FacebookPixel
        fbq('consent', 'revoke');
        fbq('set', 'autoConfig', false, pixelId);
        fbq.disablePushState = true;
        fbq('init', pixelId);
        fbq('consent', 'grant');
        initialized = true;
      }
      if (!pageViewSent) {
        fbq('trackSingle', pixelId, 'PageView');
        pageViewSent = true;
      }
      return true;
    } catch {
      // A blocked SDK must never break the diagnostic or consent controls.
      return false;
    }
  }

  function setConsent(value, { persist = true } = {}) {
    if (value !== 'granted' && value !== 'denied') return false;
    consent = value;
    const saved = !persist || write(consentStorage, MARKETING_CONSENT_KEY, value);
    if (value === 'granted') {
      if (initialized) {
        try { fbq('consent', 'grant'); } catch { /* SDK unavailable. */ }
      }
      init();
    } else {
      if (typeof fbq === 'function') {
        // Discard commands waiting for the SDK; do not replay them on re-consent.
        if (Array.isArray(fbq.queue)) fbq.queue.length = 0;
        try { fbq('consent', 'revoke'); } catch { /* Still clear local cookies. */ }
      }
      try { clearCookies(); } catch { /* Browser may disallow cookie access. */ }
      // Reload unloads an already-running SDK. If storage cannot save rejection,
      // stay revoked in this document instead of reloading into old consent.
      if (initialized && saved) reload();
    }
    return true;
  }

  function trackDiagnosticLead(response) {
    if (response?.ok !== true || response.delivery !== 'delivered'
      || typeof response.eventId !== 'string' || !EVENT_ID.test(response.eventId)) return false;

    const id = response.eventId;
    const key = `${MARKETING_LEAD_KEY_PREFIX}${pixelId}:${id}`;
    if (handledLeads.has(id) || read(eventStorage, key) === 'sent') return false;
    handledLeads.add(id);
    // No backlog: responses observed before consent are discarded, not queued
    // or retained for conversion tracking when consent is granted later.
    if (consent !== 'granted' || !init()) return false;

    // Mark before dispatch, so repeated responses/reloads cannot double-count.
    // In-memory protection remains available if sessionStorage is blocked.
    write(eventStorage, key, 'sent');
    try {
      const data = { content_name: 'Hubber marketing inquiry' };
      // Only these exact server product enums may accompany the fixed event.
      // Never spread the response/form, or normalize arbitrary input into it.
      if (response.product === 'core' || response.product === 'agency') {
        data.content_category = response.product;
      }
      fbq('trackSingle', pixelId, 'Lead',
        data, { eventID: id });
      return true;
    } catch { return false; }
  }

  return {
    init,
    setConsent,
    trackDiagnosticLead,
    getState: () => ({ consent, enabled: configured, active: initialized && consent === 'granted' }),
  };
}

export function isMarketingPage(pathname = '') {
  const path = pathname.replace(/\/index\.html$/, '/').replace(/\/?$/, '/');
  return PAGE_PATHS.has(path);
}

/** Remove this browser's accessible Meta cookies on the current host/parents. */
export function clearMetaCookies(doc, hostname = '') {
  const domains = new Set(['']);
  const parts = hostname.split('.');
  for (let i = 0; i < parts.length - 1; i += 1) {
    const domain = parts.slice(i).join('.');
    domains.add(`; Domain=${domain}`);
    domains.add(`; Domain=.${domain}`);
  }
  for (const name of ['_fbp', '_fbc']) {
    for (const domain of domains) {
      doc.cookie = `${name}=; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=/${domain}; SameSite=Lax`;
    }
  }
}

function loadBrowserPixel(win, doc) {
  // The helper never calls this function before an explicit stored/current opt-in.
  if (typeof win.fbq === 'function') return win.fbq;
  const fbq = function (...args) {
    if (fbq.callMethod) fbq.callMethod.apply(fbq, args);
    else fbq.queue.push(args);
  };
  fbq.push = fbq;
  fbq.loaded = true;
  fbq.version = '2.0';
  fbq.queue = [];
  win.fbq = fbq;
  if (!win._fbq) win._fbq = fbq;
  const script = doc.createElement('script');
  script.async = true;
  script.src = 'https://connect.facebook.net/en_US/fbevents.js';
  script.dataset.marketingPixel = '';
  doc.head.append(script);
  return fbq;
}

const TEXT = {
  en: {
    label: 'Marketing cookie preferences',
    notice: 'With your permission, we use the Meta Pixel to measure visits and successfully delivered inquiries for our marketing campaigns. Meta may receive your page address, browser information and cookie identifiers. Your diagnostic answers are not included in our events. You can change your choice in our privacy policy.',
    accept: 'Accept marketing cookies',
    reject: 'Reject',
    privacy: 'Privacy policy',
    privacyUrl: '/en/privacy/#marketing-cookies',
    granted: 'Your preference allows optional marketing cookies.',
    denied: 'Optional marketing cookies are disabled for you.',
    withdraw: 'Withdraw marketing cookie consent',
  },
  pt: {
    label: 'Preferências de cookies de marketing',
    notice: 'Com sua permissão, usamos o Pixel da Meta para medir visitas e contatos entregues com sucesso nas nossas campanhas de marketing. A Meta pode receber o endereço da página, informações do navegador e identificadores de cookies. Suas respostas ao diagnóstico não entram nos nossos eventos. Você pode mudar sua escolha na política de privacidade.',
    accept: 'Aceitar cookies de marketing',
    reject: 'Recusar',
    privacy: 'Política de privacidade',
    privacyUrl: '/privacidade/#marketing-cookies',
    granted: 'Sua preferência permite cookies opcionais de marketing.',
    denied: 'Os cookies opcionais de marketing estão desativados para você.',
    withdraw: 'Retirar consentimento para cookies de marketing',
  },
};

function storage(win, name) {
  try { return win[name]; } catch { return undefined; }
}

export function initMarketingPixel(root = document) {
  const doc = root.nodeType === 9 ? root : root.ownerDocument;
  const win = doc?.defaultView;
  if (!win) return null;
  if (instances.has(doc)) return instances.get(doc);
  const eligible = isMarketingPage(win.location.pathname);
  const settings = root.querySelector('[data-marketing-settings]');
  if (!eligible && !settings) return null;

  const controller = createMarketingPixelController({
    ...MARKETING_PIXEL_CONFIG,
    consentStorage: storage(win, 'localStorage'),
    eventStorage: storage(win, 'sessionStorage'),
    pageEligible: eligible,
    loadPixel: () => loadBrowserPixel(win, doc),
    clearCookies: () => clearMetaCookies(doc, win.location.hostname),
    reload: () => win.location.reload(),
  });
  instances.set(doc, controller);
  browserController = controller;
  const T = doc.documentElement.lang.startsWith('pt') ? TEXT.pt : TEXT.en;
  const element = (tag, text, className) => {
    const el = doc.createElement(tag);
    if (text) el.textContent = text;
    if (className) el.className = className;
    return el;
  };
  const button = (text, action) => {
    const el = element('button', text, 'btn btn--ghost');
    el.type = 'button';
    el.addEventListener('click', action);
    return el;
  };
  let banner;
  let summary;
  let change;
  const refresh = () => {
    const { consent } = controller.getState();
    if (banner) banner.hidden = consent !== 'unset';
    if (summary) summary.textContent = consent === 'granted' ? T.granted : T.denied;
    if (change) change.textContent = consent === 'granted' ? T.withdraw : T.accept;
  };
  const choose = (value) => { controller.setConsent(value); refresh(); };

  if (eligible) {
    banner = root.querySelector('[data-marketing-consent]');
    if (!banner) {
      banner = element('div');
      banner.dataset.marketingConsent = '';
      doc.body.append(banner);
    }
    banner.classList.add('consent');
    banner.dataset.surface = 'ink';
    banner.setAttribute('role', 'region');
    banner.setAttribute('aria-label', T.label);
    const box = element('div', '', 'consent__caixa');
    const notice = element('p', T.notice + ' ', 'consent__texto');
    const privacy = element('a', T.privacy);
    privacy.href = T.privacyUrl;
    notice.append(privacy);
    const actions = element('div', '', 'consent__acoes');
    actions.append(button(T.accept, () => choose('granted')), button(T.reject, () => choose('denied')));
    box.append(notice, actions);
    banner.replaceChildren(box);
  }
  if (settings) {
    summary = element('p');
    summary.setAttribute('aria-live', 'polite');
    change = button('', () => choose(controller.getState().consent === 'granted' ? 'denied' : 'granted'));
    settings.replaceChildren(summary, change);
    settings.hidden = false;
  }
  // Honor withdrawal from another open main-site tab, too.
  win.addEventListener('storage', (event) => {
    if (event.key !== MARKETING_CONSENT_KEY && event.key !== null) return;
    const value = preference(event.newValue);
    controller.setConsent(value === 'granted' ? 'granted' : 'denied', { persist: false });
    refresh();
  });
  refresh();
  controller.init();
  return controller;
}

/** Pass only the parsed server response; never pass the form or FormData. */
export function trackDiagnosticLead(response) {
  return browserController?.trackDiagnosticLead(response) ?? false;
}
