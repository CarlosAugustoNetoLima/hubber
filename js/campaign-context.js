// Shared allowlist: the browser carries this context and the server validates it
// again. Campaign labels must not contain a person's contact or medical data.
export const CAMPAIGN_LIMITS = Object.freeze({
  product: 12, offer: 32, utm_source: 80, utm_medium: 80,
  utm_campaign: 120, utm_content: 120, utm_term: 120, utm_id: 120,
  campaign_id: 30, adset_id: 30, ad_id: 30,
  fbclid: 500, landing_path: 40,
});
const PRODUCTS = new Set(['core', 'agency']);
// /plastic/ é a LP da Agency para clínicas de cirurgia plástica nos EUA (EN
// principal, PT em /plastic/pt/). Toda landing que não é Core resolve para agency.
const LANDINGS = new Set(['/core/', '/agencia/', '/en/core/', '/en/agency/', '/plastic/', '/plastic/pt/']);
const TOKEN = /^[A-Za-z0-9._~-]+$/;
const META_ID_FIELDS = new Set(['campaign_id', 'adset_id', 'ad_id']);
const META_ID = /^[1-9]\d{0,29}$/;
export const CORE_AD_OFFER = 'core-ads-997';

export function validateCampaign(input = {}) {
  const value = {};
  const errors = [];
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { value, errors: ['campaign'] };
  }
  for (const [key, max] of Object.entries(CAMPAIGN_LIMITS)) {
    const raw = input[key];
    if (raw === undefined || raw === '') continue;
    if (typeof raw !== 'string' || raw.length > max || raw !== raw.trim()) {
      errors.push(key); continue;
    }
    const valid = key === 'product' ? PRODUCTS.has(raw)
      : key === 'offer' ? raw === CORE_AD_OFFER
      : key === 'landing_path' ? LANDINGS.has(raw)
      : META_ID_FIELDS.has(key) ? META_ID.test(raw)
      : TOKEN.test(raw);
    if (!valid) { errors.push(key); continue; }
    value[key] = raw;
  }
  if (value.offer && value.product !== 'core') {
    errors.push('offer'); delete value.offer;
  }
  return { value, errors: [...new Set(errors)] };
}

export function campaignFromUrl(url) {
  const parsed = new URL(url, 'https://hubbermarketing.com');
  const raw = {};
  for (const key of Object.keys(CAMPAIGN_LIMITS)) {
    const values = parsed.searchParams.getAll(key);
    if (values.length === 1) raw[key] = values[0];
  }
  if (LANDINGS.has(parsed.pathname)) {
    raw.product = parsed.pathname.includes('core') ? 'core' : 'agency';
    if (!LANDINGS.has(raw.landing_path)) raw.landing_path = parsed.pathname;
    if (raw.product !== 'core') delete raw.offer;
  }
  return validateCampaign(raw).value;
}

export function campaignLink(href, context, base) {
  // Keep in-page controls (including the skip link) as fragment navigation.
  // Adding attribution here would change the document URL and cause a reload.
  if (typeof href !== 'string' || href.startsWith('#')) return null;
  const url = new URL(href, base);
  if (url.origin !== new URL(base).origin) return null;
  const diagnostic = ['/diagnostico/', '/en/diagnostic/'].includes(url.pathname);
  if (!diagnostic && !LANDINGS.has(url.pathname)) return null;
  const value = { ...validateCampaign(context).value };
  if (LANDINGS.has(url.pathname)) {
    value.product = url.pathname.includes('core') ? 'core' : 'agency';
    if (!value.landing_path) value.landing_path = url.pathname;
    if (value.product !== 'core') delete value.offer;
  }
  for (const key of Object.keys(CAMPAIGN_LIMITS)) url.searchParams.delete(key);
  for (const [key, item] of Object.entries(value)) url.searchParams.set(key, item);
  return url.pathname + url.search + url.hash;
}

export function initCampaignContext(root = document) {
  const context = campaignFromUrl(location.href);
  const en = root.documentElement.lang.startsWith('en');
  const productName = context.product === 'agency' ? (en ? 'Agency' : 'Agência') : 'Core';
  for (const terms of root.querySelectorAll('[data-standard-core-terms]')) {
    terms.hidden = context.offer === CORE_AD_OFFER;
  }
  for (const box of root.querySelectorAll('[data-campaign-context]')) {
    if (!context.product) continue;
    box.hidden = false;
    box.textContent = en
      ? `Your inquiry: Hubber ${productName}. Your diagnostic answers help us assess the fit; no service is selected or purchased automatically.`
      : `Seu interesse: Hubber ${productName}. Suas respostas ajudam a avaliar a adequação; nenhum serviço é selecionado ou contratado automaticamente.`;
    if (context.offer === CORE_AD_OFFER) {
      const p = root.createElement('p');
      p.className = 't-small';
      p.textContent = en
        ? 'Offer for customers acquired through this ad: $997 first payment, followed by six monthly payments of $997. The $500 activation uplift is waived. Ad spend is separate. Professional filming is not included.'
        : 'Oferta para clientes adquiridos por este anúncio: US$997 no primeiro pagamento, seguidos de seis parcelas mensais de US$997. O adicional de US$500 de ativação está dispensado. Verba de mídia à parte. Filmagem profissional não incluída.';
      box.append(p);
    }
  }
  for (const a of root.querySelectorAll('a[href]')) {
    const next = campaignLink(a.getAttribute('href'), context, location.href);
    if (next) a.setAttribute('href', next);
  }
  // No cookies or storage are needed: these values travel only with explicit
  // navigation and the diagnostic submission, never to the Meta helper.
  return context;
}
