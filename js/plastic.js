/**
 * LP /plastic/ (EN) e /plastic/pt/ (PT).
 *
 * - Contexto de campanha (UTM, IDs da Meta, fbclid) vem da URL, validado pela
 *   mesma allowlist do resto do site, e só segue junto do envio do formulário.
 * - Pixel: mesma política de consentimento das páginas Core/Agência. O evento
 *   Lead só sai quando o servidor confirma ENTREGA ao CRM (delivery=delivered
 *   com eventId). Fila (pending) ou erro não é conversão. Nenhum campo do
 *   formulário é passado ao Pixel.
 * - A página confirma o RECEBIMENTO do pedido. Nunca diz que a reunião foi
 *   marcada: a agenda ainda não está conectada.
 * - Vídeos dos depoimentos: nada é baixado até a pessoa clicar.
 */
import { campaignFromUrl, initCampaignContext } from './campaign-context.js';
import { initMarketingPixel, trackDiagnosticLead } from './campaign-pixel.js';
import { MARKETING_PIXEL_CONFIG } from './campaign-pixel-config.js';

const doc = document;
const en = !doc.documentElement.lang.startsWith('pt');
const T = en ? {
  sending: 'Sending…',
  delivered: 'Request received. We will get back to you to find a time with Nicolas. No meeting has been scheduled yet.',
  pending: 'Request saved. It is waiting to reach our team and we will retry delivery. You do not need to submit again. No meeting has been scheduled yet.',
  error: 'We could not send your request. Please check your connection and try again.',
  fix: 'Please review the highlighted fields.',
  required: 'Required.',
  goal: 'Please review your choices.',
  email: 'Enter a valid email address.',
  phone: 'Enter a valid phone number, or leave it blank.',
  consent: 'Please confirm so we can contact you.',
} : {
  sending: 'Enviando…',
  delivered: 'Pedido recebido. Vamos entrar em contato para combinar um horário com o Nicolas. Nenhuma reunião foi agendada ainda.',
  pending: 'Pedido salvo. Ele aguarda entrega à nossa equipe e vamos tentar de novo. Você não precisa reenviar. Nenhuma reunião foi agendada ainda.',
  error: 'Não conseguimos enviar seu pedido. Confira sua conexão e tente de novo.',
  fix: 'Revise os campos destacados.',
  required: 'Obrigatório.',
  goal: 'Revise suas escolhas.',
  email: 'Informe um e-mail válido.',
  phone: 'Informe um telefone válido ou deixe em branco.',
  consent: 'Confirme para podermos falar com você.',
};

/* ── Formulário ─────────────────────────────────────────────────────── */
export function initClinicForm(root = doc) {
  const form = root.querySelector('[data-clinic-form]');
  if (!form) return null;
  const status = form.querySelector('[data-form-status]');
  const button = form.querySelector('[type="submit"]');
  const label = button.textContent;
  const campaign = campaignFromUrl(location.href);
  let state = 'idle'; // idle | sending | done
  const REQUIRED = ['nome', 'email', 'clinica', 'local', 'funcao'];
  const FIELDS = [...REQUIRED, 'site', 'telefone', 'objetivo', 'detalhe', 'consentimento'];

  // Campo com erro dentro de "Adicionar detalhes" fechado: abre antes de focar.
  const focusFirstError = () => {
    const bad = form.querySelector('[aria-invalid="true"]');
    if (!bad) return;
    const more = bad.closest('details');
    if (more) more.open = true;
    (bad.matches('fieldset') ? bad.querySelector('input') : bad).focus();
  };

  const setError = (name, msg) => {
    const field = form.elements[name];
    const err = form.querySelector(`[data-err="${name}"]`);
    // Grupo de checkboxes (objetivo): marca o fieldset, não cada opção.
    const target = field && !field.setAttribute ? form.querySelector('.pl-chips') : field;
    if (target && target.setAttribute) target.setAttribute('aria-invalid', msg ? 'true' : 'false');
    if (err) err.textContent = msg || '';
  };

  const validate = (data) => {
    const errors = {};
    for (const name of REQUIRED) {
      if (!String(data[name] || '').trim()) errors[name] = T.required;
    }
    if (data.email && !/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(data.email.trim())) errors.email = T.email;
    if (data.telefone && !/^[0-9+()\s-]{8,40}$/.test(data.telefone.trim())) errors.telefone = T.phone;
    if (data.consentimento !== 'sim') errors.consentimento = T.consent;
    return errors;
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (state !== 'idle') return; // evita envio duplo
    const fd = new FormData(form);
    const data = Object.fromEntries(fd.entries());
    // Objetivos são múltipla escolha e opcionais.
    const goals = fd.getAll('objetivo');
    if (goals.length) data.objetivo = goals; else delete data.objetivo;
    data.consentimento = form.elements.consentimento.checked ? 'sim' : '';
    const errors = validate(data);
    for (const name of FIELDS) setError(name, errors[name]);
    if (Object.keys(errors).length) {
      status.dataset.state = 'error';
      status.textContent = T.fix;
      focusFirstError();
      return;
    }

    state = 'sending';
    button.disabled = true;
    button.textContent = T.sending;
    status.dataset.state = 'sending';
    status.textContent = '';
    // Só dados comerciais + contexto de campanha validado. O produto é fixado
    // pelo servidor como agency; mandar aqui é só informativo.
    Object.assign(data, campaign, { idioma: doc.documentElement.lang, landing_path: location.pathname.replace(/index\.html$/, '') });

    let resposta;
    try {
      const res = await fetch(form.action, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify(data),
      });
      resposta = await res.json().catch(() => null);
      if (res.status === 422 && resposta?.error === 'validation') {
        for (const name of [...(resposta.missing || []), ...(resposta.invalid || [])]) setError(name, name === 'objetivo' ? T.goal : T.required);
        focusFirstError();
        throw new Error('validation');
      }
    } catch {
      resposta = null;
    }

    const ok = resposta?.ok === true && ['delivered', 'pending', 'ignored'].includes(resposta.delivery);
    if (!ok) {
      state = 'idle';
      button.disabled = false;
      button.textContent = label;
      status.dataset.state = 'error';
      status.textContent = T.error;
      return;
    }
    state = 'done';
    button.textContent = label;
    // Lead só com entrega confirmada pelo CRM (o helper confere de novo).
    if (resposta.delivery === 'delivered') trackDiagnosticLead(resposta, { landingPage: 'plastic' });
    status.dataset.state = resposta.delivery === 'pending' ? 'pending' : 'delivered';
    status.textContent = resposta.delivery === 'pending' ? T.pending : T.delivered;
    status.focus?.();
  });
  return form;
}

/* ── Depoimentos: carregam só no clique ─────────────────────────────── */
function initPlayers(root = doc) {
  for (const btn of root.querySelectorAll('[data-video]')) {
    btn.addEventListener('click', () => {
      if (btn.querySelector('video')) return;
      const v = doc.createElement('video');
      v.controls = true;
      v.playsInline = true;
      v.preload = 'auto';
      v.src = btn.dataset.video;
      if (btn.dataset.captions) {
        const tr = doc.createElement('track');
        tr.kind = 'subtitles';
        tr.srclang = btn.dataset.captionsLang || 'en';
        tr.label = btn.dataset.captionsLabel || 'English';
        tr.src = btn.dataset.captions;
        tr.default = true;
        v.append(tr);
      }
      btn.append(v);
      btn.setAttribute('aria-label', btn.dataset.playingLabel || '');
      v.play().catch(() => {});
    }, { once: false });
  }
}

/* ── Revelação discreta ─────────────────────────────────────────────── */
function initReveal(root = doc) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) return;
  const items = root.querySelectorAll('.pl-reveal');
  if (!items.length) return;
  doc.documentElement.classList.add('pl-js');
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
  }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
  items.forEach((el) => io.observe(el));
}

initCampaignContext();
// Pixel só com consentimento (opt-in). Sem ID configurado, nem a tarja aparece.
if (MARKETING_PIXEL_CONFIG.enabled && MARKETING_PIXEL_CONFIG.pixelId) initMarketingPixel();
initClinicForm();
initPlayers();
initReveal();
