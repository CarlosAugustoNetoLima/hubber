import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createMarketingPixelController,
  isMarketingPage,
  clearMetaCookies,
  trackDiagnosticLead,
} from '../js/campaign-pixel.js';
import {
  MARKETING_PIXEL_CONFIG,
  MARKETING_CONSENT_KEY,
  MARKETING_LEAD_KEY_PREFIX,
} from '../js/campaign-pixel-config.js';

const PIXEL = '123456789012345';
const EVENT = 'diagnostic_51984672-034b-4ffb-9a68-2d2ed3c0c5ac';
const DELIVERED = { ok: true, delivery: 'delivered', eventId: EVENT };

function memoryStorage(entries = []) {
  const values = new Map(entries);
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
  };
}

function harness(options = {}) {
  const calls = [];
  const effects = { loads: 0, clears: 0, reloads: 0 };
  const consentStorage = options.consentStorage ?? memoryStorage();
  const eventStorage = options.eventStorage ?? memoryStorage();
  const fbq = (...args) => calls.push(args);
  const controller = createMarketingPixelController({
    enabled: true,
    pixelId: PIXEL,
    consentStorage,
    eventStorage,
    loadPixel: () => { effects.loads += 1; return fbq; },
    clearCookies: () => { effects.clears += 1; },
    reload: () => { effects.reloads += 1; },
    ...options,
  });
  const events = (name) => calls.filter((args) => args[0] === 'trackSingle' && args[2] === name);
  return { controller, calls, effects, consentStorage, eventStorage, fbq, events };
}

test('main site uses the authorized HUBBER REELS dataset, and nothing fires without a controller', () => {
  assert.deepEqual(MARKETING_PIXEL_CONFIG, { enabled: true, pixelId: '1622410909278763' });
  assert.equal(trackDiagnosticLead(DELIVERED), false);
});

test('a disabled configuration stays off even with explicit consent', () => {
  const h = harness({ enabled: false, pixelId: '' });
  assert.equal(h.controller.init(), false);
  assert.equal(h.controller.trackDiagnosticLead(DELIVERED), false);
  h.controller.setConsent('granted');
  assert.equal(h.controller.init(), false);
  h.controller.setConsent('denied');
  assert.equal(h.controller.init(), false);
  assert.equal(h.effects.loads, 0);
  assert.deepEqual(h.calls, []);
});

test('unset, legacy, and invalid consent never load the SDK', () => {
  for (const value of [null, 'ciente', 'aceito', 'true', 'denied']) {
    const h = harness({ consentStorage: memoryStorage([[MARKETING_CONSENT_KEY, value]]) });
    assert.equal(h.controller.init(), false);
    assert.equal(h.controller.trackDiagnosticLead(DELIVERED), false);
    assert.equal(h.effects.loads, 0);
  }
});

test('explicit opt-in configures before init without PII and sends PageView once', () => {
  const h = harness();
  assert.equal(h.controller.setConsent('granted'), true);
  h.controller.init();
  h.controller.setConsent('granted');
  assert.equal(h.consentStorage.getItem(MARKETING_CONSENT_KEY), 'granted');
  assert.equal(h.effects.loads, 1);
  assert.equal(h.events('PageView').length, 1);
  // No queued 'consent revoke' before init: fbevents.js would hold the queue.
  assert.deepEqual(h.calls.slice(0, 3), [
    ['set', 'autoConfig', false, PIXEL],
    ['init', PIXEL],
    ['trackSingle', PIXEL, 'PageView'],
  ]);
  assert.equal(h.calls.some((c) => c[0] === 'consent' && c[1] === 'revoke'), false);
  assert.equal(h.fbq.disablePushState, true);
});

test('only an explicitly stored granted preference initializes a fresh page', () => {
  const h = harness({ consentStorage: memoryStorage([[MARKETING_CONSENT_KEY, 'granted']]) });
  assert.equal(h.controller.init(), true);
  assert.equal(h.events('PageView').length, 1);
});

test('invalid or disabled Pixel IDs never load even with consent', () => {
  for (const options of [{ enabled: false }, { pixelId: '' }, { pixelId: 'not-verified' }, { pixelId: 123456789 }]) {
    const h = harness(options);
    h.controller.setConsent('granted');
    assert.equal(h.effects.loads, 0);
  }
});

test('privacy/settings and out-of-scope pages can save consent without tracking', () => {
  const h = harness({ pageEligible: false });
  h.controller.setConsent('granted');
  assert.equal(h.controller.trackDiagnosticLead(DELIVERED), false);
  assert.equal(h.effects.loads, 0);
  for (const path of ['/core/', '/agencia', '/diagnostico/', '/en/core/index.html', '/en/agency/', '/en/diagnostic/', '/plastic/', '/plastic/pt/', '/plastic/index.html']) {
    assert.equal(isMarketingPage(path), true, path);
  }
  for (const path of ['/', '/connect/', '/reels/', '/reels/pt/', '/en/privacy/', '/privacidade/', '/core/anything/', '/plastic/extra/']) {
    assert.equal(isMarketingPage(path), false, path);
  }
});

test('rejecting before consent saves the choice and clears cookies without loading', () => {
  const h = harness();
  h.controller.setConsent('denied');
  assert.equal(h.consentStorage.getItem(MARKETING_CONSENT_KEY), 'denied');
  assert.deepEqual(h.effects, { loads: 0, clears: 1, reloads: 0 });
  assert.deepEqual(h.calls, []);
});

test('withdrawal revokes, clears waiting SDK commands/cookies and reloads', () => {
  const h = harness();
  h.controller.setConsent('granted');
  h.fbq.queue = [['trackSingle', PIXEL, 'Lead']];
  h.controller.setConsent('denied');
  assert.equal(h.consentStorage.getItem(MARKETING_CONSENT_KEY), 'denied');
  assert.deepEqual(h.calls.at(-1), ['consent', 'revoke']);
  assert.deepEqual(h.fbq.queue, []);
  assert.deepEqual(h.effects, { loads: 1, clears: 1, reloads: 1 });
  assert.equal(h.controller.getState().active, false);
  assert.equal(h.controller.trackDiagnosticLead(DELIVERED), false);
});

test('Lead requires real delivery; queue, error and honeypot success cannot convert', () => {
  const h = harness();
  h.controller.setConsent('granted');
  for (const response of [
    null, {}, { ok: true }, { ok: true, delivery: 'queued' },
    { ...DELIVERED, delivery: 'pending' }, { ...DELIVERED, ok: false },
    { ...DELIVERED, ok: 'true' }, { ok: true, delivery: 'delivered' },
    { ...DELIVERED, eventId: 'person@example.com' },
    { ...DELIVERED, eventId: '' }, { ...DELIVERED, eventId: { id: EVENT } },
  ]) assert.equal(h.controller.trackDiagnosticLead(response), false);
  assert.equal(h.events('Lead').length, 0);
  assert.equal(h.controller.trackDiagnosticLead(DELIVERED), true);
  assert.equal(h.events('Lead').length, 1);
});

test('a lead observed without consent is never replayed after accepting', () => {
  const h = harness();
  assert.equal(h.controller.trackDiagnosticLead(DELIVERED), false);
  h.controller.setConsent('granted');
  assert.equal(h.controller.trackDiagnosticLead(DELIVERED), false);
  assert.equal(h.events('Lead').length, 0);
  assert.equal(h.eventStorage.getItem(`${MARKETING_LEAD_KEY_PREFIX}${PIXEL}:${EVENT}`), null);
});

test('Lead includes only fixed content name and opaque server event ID', () => {
  const h = harness();
  h.controller.setConsent('granted');
  h.controller.trackDiagnosticLead({
    ...DELIVERED, nome: 'Private name', email: 'private@example.com',
    telefone: '+15555555555', faturamento: 'sensitive', product: 'untrusted',
    content_name: 'private answer', route: 'nurture',
  });
  assert.deepEqual(h.events('Lead'), [[
    'trackSingle', PIXEL, 'Lead',
    { content_name: 'Hubber marketing inquiry' }, { eventID: EVENT },
  ]]);
});

test('Lead product metadata allows only exact core and agency enums, with no form fields', () => {
  for (const product of ['core', 'agency']) {
    const h = harness();
    h.controller.setConsent('granted');
    assert.equal(h.controller.trackDiagnosticLead({
      ...DELIVERED,
      product,
      nome: 'Private name', name: 'Private name', email: 'private@example.com',
      telefone: '+15555555555', phone: '+15555555555',
      faturamento: 'private revenue', revenue: 'private revenue',
      empresa: 'Private company', objetivo: 'Private answer', porque: 'Private answer',
      answers: { email: 'private@example.com' }, user_data: { em: 'private@example.com' },
      content_name: 'Private answer', content_category: 'private@example.com',
    }), true);
    assert.deepEqual(h.events('Lead'), [[
      'trackSingle', PIXEL, 'Lead',
      { content_name: 'Hubber marketing inquiry', content_category: product, product },
      { eventID: EVENT },
    ]]);
  }
});

test('arbitrary product values cannot enter Lead metadata', () => {
  for (const product of [undefined, null, 'CORE', ' core', 'agency ', 'agencia',
    'private@example.com', ['core'], { product: 'core' }, { toString: () => 'core' }]) {
    const h = harness();
    h.controller.setConsent('granted');
    assert.equal(h.controller.trackDiagnosticLead({ ...DELIVERED, product }), true);
    assert.deepEqual(h.events('Lead'), [[
      'trackSingle', PIXEL, 'Lead',
      { content_name: 'Hubber marketing inquiry' }, { eventID: EVENT },
    ]]);
  }
});

test('event IDs dedupe both repeated calls and fresh controllers after reload', () => {
  const first = harness();
  first.controller.setConsent('granted');
  assert.equal(first.controller.trackDiagnosticLead(DELIVERED), true);
  assert.equal(first.controller.trackDiagnosticLead(DELIVERED), false);
  const reloaded = harness({ consentStorage: first.consentStorage, eventStorage: first.eventStorage });
  reloaded.controller.init();
  assert.equal(reloaded.controller.trackDiagnosticLead(DELIVERED), false);
  assert.equal(reloaded.events('Lead').length, 0);
  assert.equal(reloaded.events('PageView').length, 1);
});

test('blocked storage is safe and preserves in-memory lead deduplication', () => {
  const blocked = { getItem() { throw Error('blocked'); }, setItem() { throw Error('blocked'); } };
  const h = harness({ consentStorage: blocked, eventStorage: blocked });
  assert.equal(h.controller.init(), false);
  h.controller.setConsent('granted');
  assert.equal(h.controller.trackDiagnosticLead(DELIVERED), true);
  assert.equal(h.controller.trackDiagnosticLead(DELIVERED), false);
  h.controller.setConsent('denied');
  assert.equal(h.effects.reloads, 0);
  assert.equal(h.controller.getState().active, false);
});

test('SDK errors never escape into the form submission flow', () => {
  const h = harness({ loadPixel: () => { throw Error('blocked SDK'); } });
  assert.doesNotThrow(() => h.controller.setConsent('granted'));
  assert.equal(h.controller.trackDiagnosticLead(DELIVERED), false);
});

test('withdrawal expires both Meta cookie names at host and parent domains', () => {
  const cookies = [];
  const doc = { set cookie(value) { cookies.push(value); } };
  clearMetaCookies(doc, 'www.hubbermarketing.com');
  for (const name of ['_fbp', '_fbc']) {
    assert.ok(cookies.some((value) => value.startsWith(`${name}=;`) && !value.includes('Domain=')));
    assert.ok(cookies.some((value) => value.startsWith(`${name}=;`) && value.includes('Domain=.hubbermarketing.com;')));
  }
  assert.ok(cookies.every((value) => value.includes('Max-Age=0') && value.includes('Path=/;')));
});

const CLINIC = { ok: true, delivery: 'delivered', eventId: 'clinic_92f843bf-6ff4-46c7-9322-e748e85d6bd4', product: 'agency' };

test('/plastic/ Lead carries only fixed product and landing labels, once per server event', () => {
  const h = harness();
  h.controller.setConsent('granted');
  assert.equal(h.controller.trackDiagnosticLead({ ...CLINIC, nome: 'Private', email: 'p@example.com' }, { landingPage: 'plastic' }), true);
  assert.equal(h.controller.trackDiagnosticLead(CLINIC, { landingPage: 'plastic' }), false);
  assert.deepEqual(h.events('Lead'), [[
    'trackSingle', PIXEL, 'Lead',
    { content_name: 'Hubber marketing inquiry', content_category: 'agency', product: 'agency', landing_page: 'plastic' },
    { eventID: CLINIC.eventId },
  ]]);
  assert.equal(h.events('PageView').length, 1);
  assert.equal(h.calls.some((c) => c[2] === 'Schedule'), false);
});

test('landing labels outside the allowlist never enter the Lead', () => {
  for (const landingPage of ['/plastic/?email=p@example.com', 'Plastic', 'core', { toString: () => 'plastic' }, ['plastic']]) {
    const h = harness();
    h.controller.setConsent('granted');
    h.controller.trackDiagnosticLead(CLINIC, { landingPage });
    assert.equal('landing_page' in h.events('Lead')[0][3], false);
  }
});

test('pending or rejected consent: a valid /plastic/ submission sends nothing to Meta', () => {
  for (const consent of [null, 'denied']) {
    const h = harness({ consentStorage: memoryStorage(consent ? [[MARKETING_CONSENT_KEY, consent]] : []) });
    h.controller.init();
    assert.equal(h.controller.trackDiagnosticLead(CLINIC, { landingPage: 'plastic' }), false);
    assert.equal(h.effects.loads, 0);
    assert.deepEqual(h.calls, []);
  }
});
