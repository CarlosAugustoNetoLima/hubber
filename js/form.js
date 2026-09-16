

const PISO = new Set(['85-200k', '200-500k', '500k+']);

export function computeRoute(a) {
  const piso = PISO.has(a.faturamento);
  const semVerba = a.verba === 'nao';
  const decide = a.papel === 'sozinho' || a.papel === 'socios';
  const notes = [];

  if (!piso || semVerba) {
    if (!piso) notes.push('piso');
    if (semVerba) notes.push('verba');
    return { route: 'nutricao', notes };
  }
  if (a.verba === 'a-definir') notes.push('verba-a-definir');

  if (a.estrutura === 'time-interno') {
    if (!decide) notes.push('sponsor');
    return { route: 'build', notes };
  }
  if (a.estrutura === 'executar') return { route: 'agencia', notes };
  if (a.estrutura === 'base')     return { route: 'pocket', notes };

  if (a.time === 'ninguem') return { route: 'pocket', notes };
  if ((a.gargalo === 'time' || a.gargalo === 'gestao') && decide) return { route: 'build', notes };
  return { route: 'agencia', notes };
}

export function initDiagnostic(root = document) {
  const form = root.querySelector('[data-diagnostic]');
  if (!form) return;

  const steps = Array.from(form.querySelectorAll('[data-step]'));

  const progressItems = Array.from(root.querySelectorAll('[data-progress] li'));
  const counter = root.querySelector('[data-step-counter]');
  const summary = form.querySelector('[data-errors]');
  const result = root.querySelector('[data-result]');
  const startedAt = Date.now();
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
    if (counter) counter.textContent = `Passo ${i + 1} de ${steps.length}`;
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
    if (el.validity.valueMissing) return d.errorRequired || 'Preencha este campo.';
    if (el.validity.typeMismatch || el.validity.patternMismatch) return d.errorFormat || 'Confira o formato deste campo.';
    if (el.validity.tooShort) return d.errorShort || `Escreva pelo menos ${el.minLength} caracteres.`;
    return el.validationMessage || 'Confira este campo.';
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
    summary.innerHTML = `<p>${n === 1 ? 'Falta um campo' : `Faltam ${n} campos`} para continuar:</p><ul>${
      errors.map((er) => `<li><a href="#${er.el.id || ''}" data-focus>${er.label}</a>: ${er.msg}</li>`).join('')
    }</ul>`;
    summary.hidden = false;
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
    Object.assign(data, {
      rota: route, notas: notes.join(','),
      idioma: document.documentElement.lang, origem: location.pathname,
      enviado_em: new Date().toISOString(),
    });

    const endpoint = form.dataset.endpoint;
    if (endpoint) {
      const btn = form.querySelector('[type="submit"]'); btn && (btn.disabled = true);
      try {
        await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      } catch (_) {}
      btn && (btn.disabled = false);
    } else {
      console.info('[hubber] diagnóstico: sem endpoint configurado; payload:', data);
    }
    showResult(route, notes);
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
