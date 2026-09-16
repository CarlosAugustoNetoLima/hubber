import { computeRoute } from './route.js';

/* As frases que este arquivo escreve na tela. Tudo o mais já vem traduzido do
   HTML da página, inclusive as mensagens de erro por campo, que vêm dos
   data-error-* de cada `[data-field]`. Aqui ficam só as que não existem no
   markup. O idioma sai do <html lang>. */
const TEXTOS = {
  'pt-BR': {
    passo: (i, n) => `Passo ${i} de ${n}`,
    faltam: (n) => (n === 1 ? 'Falta um campo para continuar:' : `Faltam ${n} campos para continuar:`),
    obrigatorio: 'Preencha este campo.',
    formato: 'Confira o formato deste campo.',
    curto: (n) => `Escreva pelo menos ${n} caracteres.`,
    confira: 'Confira este campo.',
    enviando: 'Enviando…',
    falha: 'Não conseguimos enviar o diagnóstico agora. '
         + 'Suas respostas continuam preenchidas aqui: toque em enviar de novo em alguns instantes.',
  },
  'en-US': {
    passo: (i, n) => `Step ${i} of ${n}`,
    faltam: (n) => (n === 1 ? 'One field is missing:' : `${n} fields are missing:`),
    obrigatorio: 'Please fill in this field.',
    formato: 'Check the format of this field.',
    curto: (n) => `Write at least ${n} characters.`,
    confira: 'Check this field.',
    enviando: 'Sending…',
    falha: 'We could not send your diagnostic right now. '
         + 'Your answers are still here: try sending again in a moment.',
  },
};

export function initDiagnostic(root = document) {
  const form = root.querySelector('[data-diagnostic]');
  if (!form) return;

  const steps = Array.from(form.querySelectorAll('[data-step]'));

  const progressItems = Array.from(root.querySelectorAll('[data-progress] li'));
  const counter = root.querySelector('[data-step-counter]');
  const summary = form.querySelector('[data-errors]');
  const result = root.querySelector('[data-result]');
  const startedAt = Date.now();
  const T = TEXTOS[root.documentElement?.lang || document.documentElement.lang] || TEXTOS['pt-BR'];
  let i = 0;

  form.setAttribute('novalidate', '');
  form.classList.add('is-stepped');

  function show(n, moveFocus = true) {
    i = Math.max(0, Math.min(n, steps.length - 1));
    steps.forEach((s, k) => { s.hidden = k !== i; });
    progressItems.forEach((li, k) => {
      li.classList.toggle('is-done', k < i);
      li.classList.toggle('is-current', k === i);
      if (k === i) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current');
    });
    if (counter) counter.textContent = T.passo(i + 1, steps.length);
    clearSummary();
    if (moveFocus) {
      const legend = steps[i].querySelector('[data-step-focus]');
      legend && legend.focus({ preventScroll: true });
      const top = form.getBoundingClientRect().top + window.scrollY - 96;
      if (window.scrollY > top) window.scrollTo({ top, behavior: 'smooth' });
    }
  }

  form.addEventListener('click', (e) => {
    const next = e.target.closest('[data-next]');
    const prev = e.target.closest('[data-prev]');
    if (next) {
      e.preventDefault();
      const errors = validateStep(steps[i]);
      if (errors.length) { announce(errors); errors[0].el.focus(); return; }
      show(i + 1);
    }
    if (prev) { e.preventDefault(); show(i - 1); }
  });

  form.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || e.target.tagName === 'TEXTAREA' || e.target.type === 'submit') return;
    if (i < steps.length - 1) { e.preventDefault(); steps[i].querySelector('[data-next]')?.click(); }
  });

  function fieldsOf(step) {
    return Array.from(step.querySelectorAll('input, select, textarea')).filter((el) => el.name && !el.disabled && el.type !== 'hidden');
  }
  function wrapOf(el) { return el.closest('[data-field]'); }
  function messageFor(el) {
    const w = wrapOf(el) || {}; const d = w.dataset || {};
    if (el.validity.valueMissing) return d.errorRequired || T.obrigatorio;
    if (el.validity.typeMismatch || el.validity.patternMismatch) return d.errorFormat || T.formato;
    if (el.validity.tooShort) return d.errorShort || T.curto(el.minLength);
    return el.validationMessage || T.confira;
  }
  function setError(el, msg) {
    const w = wrapOf(el); if (!w) return;
    w.classList.add('is-invalid');
    const box = w.querySelector('[data-error]');
    if (box) { box.textContent = msg; box.hidden = false; }
    w.querySelectorAll('input, textarea, select').forEach((f) => f.setAttribute('aria-invalid', 'true'));
  }
  function clearError(el) {
    const w = wrapOf(el); if (!w) return;
    w.classList.remove('is-invalid');
    const box = w.querySelector('[data-error]');
    if (box) { box.textContent = ''; box.hidden = true; }
    w.querySelectorAll('[aria-invalid]').forEach((f) => f.removeAttribute('aria-invalid'));

    if (!steps[i].querySelector('.is-invalid')) clearSummary();
  }
  function validateStep(step) {
    const errors = []; const seen = new Set();
    for (const el of fieldsOf(step)) {
      const key = el.type === 'radio' ? el.name : el;
      if (seen.has(key)) continue; seen.add(key);
      const target = el.type === 'radio' ? step.querySelector(`input[name="${el.name}"]`) : el;
      if (target.checkValidity()) { clearError(target); continue; }
      const msg = messageFor(target); setError(target, msg);
      const w = wrapOf(target);
      errors.push({ el: target, msg, label: w?.querySelector('[data-field-label]')?.textContent.trim() || target.name });
    }
    return errors;
  }
  form.addEventListener('input',  (e) => clearError(e.target));
  form.addEventListener('change', (e) => clearError(e.target));

  function announce(errors) {
    if (!summary) return;
    const n = errors.length;
    summary.innerHTML = `<p>${T.faltam(n)}</p><ul>${
      errors.map((er) => `<li><a href="#${er.el.id || ''}" data-focus>${er.label}</a>: ${er.msg}</li>`).join('')
    }</ul>`;
    summary.hidden = false;
  }
  function falhaNoEnvio() {
    if (!summary) return;
    summary.innerHTML = `<p>${T.falha}</p>`;
    summary.hidden = false;
    summary.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  function clearSummary() { if (summary) { summary.hidden = true; summary.innerHTML = ''; } }
  summary?.addEventListener('click', (e) => {
    const a = e.target.closest('[data-focus]'); if (!a) return;
    e.preventDefault();
    const id = a.getAttribute('href').slice(1);
    const el = id && document.getElementById(id); el && el.focus();
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errors = validateStep(steps[i]);
    if (errors.length) { announce(errors); errors[0].el.focus(); return; }

    const hp = form.querySelector('[data-honeypot]');
    if ((hp && hp.value) || Date.now() - startedAt < 3000) { showResult('nutricao', []); return; }

    const data = Object.fromEntries(new FormData(form).entries());
    delete data[hp?.name];
    const { route, notes } = computeRoute(data);
    Object.assign(data, { idioma: document.documentElement.lang, origem: location.pathname });

    const endpoint = form.dataset.endpoint || form.getAttribute('action');
    if (!endpoint) {
      console.info('[hubber] diagnóstico: sem endpoint configurado; payload:', data);
      showResult(route, notes);
      return;
    }

    const btn = form.querySelector('[type="submit"]');
    const rotulo = btn?.textContent;
    if (btn) { btn.disabled = true; btn.textContent = T.enviando; }

    // A devolutiva só aparece depois que o servidor confirma que gravou. Antes
    // o erro era engolido e a pessoa via "recebemos" com o lead perdido.
    let resposta = null;
    try {
      const res = await fetch(endpoint, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
      });
      if (res.ok) resposta = await res.json().catch(() => ({ ok: true }));
    } catch (_) {}

    if (btn) { btn.disabled = false; if (rotulo) btn.textContent = rotulo; }

    if (!resposta?.ok) { falhaNoEnvio(); return; }

    // A rota que vale é a do servidor: é a que foi gravada no CRM.
    showResult(resposta.rota || route, resposta.notas || notes);
  });

  function showResult(route, notes) {
    if (!result) return;
    form.hidden = true;
    result.hidden = false;
    result.querySelectorAll('[data-route]').forEach((b) => { b.hidden = b.dataset.route !== route; });
    result.querySelectorAll('[data-note]').forEach((n) => { n.hidden = !notes.includes(n.dataset.note); });
    const block = result.querySelector(`[data-route="${route}"]`);
    const h = block?.querySelector('h2');
    if (h) { result.setAttribute('aria-labelledby', h.id); h.focus({ preventScroll: true }); }
    const top = result.getBoundingClientRect().top + window.scrollY - 96;
    window.scrollTo({ top, behavior: 'smooth' });
  }

  show(0, false);
}
