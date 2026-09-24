import { capturarOrigem, origemParaEnvio } from './origem.js';

const ORIGEM = 'hubber:connect:origem';

export function initConnectForm(root = document) {
  const form = root.querySelector('[data-connect-form]');
  if (!form) return;

  capturarOrigem(ORIGEM);

  const summary = form.querySelector('[data-errors]');
  const result = root.querySelector('[data-connect-result]');
  const startedAt = Date.now();

  form.setAttribute('novalidate', '');

  function fieldsOf() {
    return Array.from(form.querySelectorAll('input, select, textarea')).filter((el) => el.name && !el.disabled && el.type !== 'hidden');
  }
  function wrapOf(el) { return el.closest('[data-field]'); }
  // Campos controlados por plugin (Choices) ficam hidden: foca o gatilho visível.
  function focusField(el) {
    // O input de arquivo é invisível por desenho; o anel de foco aparece no
    // botão pelo :focus-within, então basta rolar o campo até a vista.
    if (el.type === 'file') {
      wrapOf(el)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.focus({ preventScroll: true });
      return;
    }
    if (!el.offsetParent) {
      const proxy = wrapOf(el)?.querySelector('.choices[tabindex]');
      if (proxy) { proxy.focus(); return; }
    }
    el.focus();
  }
  /* Campo de arquivo: mostra o nome escolhido e valida tipo e tamanho.
     A crítica entra por setCustomValidity para reaproveitar a mesma máquina
     de erro dos outros campos, em vez de um caminho paralelo. */
  const ANEXO_MAX = 3 * 1024 * 1024;
  const fileWrap = form.querySelector('[data-file]');
  const fileInput = fileWrap?.querySelector('input[type="file"]');
  const fileName = fileWrap?.querySelector('[data-file-name]');
  const fileClear = fileWrap?.querySelector('[data-file-clear]');

  function syncFile() {
    if (!fileInput) return;
    const f = fileInput.files && fileInput.files[0];
    if (!f) {
      fileInput.setCustomValidity('');
      fileWrap.classList.remove('is-set');
      if (fileName) fileName.textContent = 'Nenhum arquivo escolhido';
      if (fileClear) fileClear.hidden = true;
      return;
    }
    const ehPdf = f.type === 'application/pdf' || /\.pdf$/i.test(f.name);
    if (!ehPdf) fileInput.setCustomValidity('Esse arquivo não é um PDF. Envie o mídia kit em PDF.');
    else if (f.size > ANEXO_MAX) fileInput.setCustomValidity('O arquivo tem mais de 3 MB. Envie uma versão menor ou deixe só o link.');
    else fileInput.setCustomValidity('');
    fileWrap.classList.add('is-set');
    if (fileName) fileName.textContent = `${f.name} (${(f.size / 1048576).toFixed(1)} MB)`;
    if (fileClear) fileClear.hidden = false;
  }
  fileInput?.addEventListener('change', syncFile);
  fileClear?.addEventListener('click', () => {
    fileInput.value = '';
    syncFile();
    clearError(fileInput);
    fileInput.focus();
  });

  function lerBase64(file) {
    return new Promise((ok, falha) => {
      const fr = new FileReader();
      fr.onload = () => ok(String(fr.result).split(',')[1] || '');
      fr.onerror = () => falha(fr.error);
      fr.readAsDataURL(file);
    });
  }

  function messageFor(el) {
    const w = wrapOf(el) || {}; const d = w.dataset || {};
    if (el.validity.valueMissing) return d.errorRequired || 'Preencha este campo.';
    if (el.validity.typeMismatch || el.validity.patternMismatch) return d.errorFormat || 'Confira o formato deste campo.';
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
    if (!form.querySelector('.is-invalid')) clearSummary();
  }
  function validate() {
    const errors = []; const seen = new Set();
    for (const el of fieldsOf()) {
      const key = el.type === 'radio' ? el.name : el;
      if (seen.has(key)) continue; seen.add(key);
      const target = el.type === 'radio' ? form.querySelector(`input[name="${el.name}"]`) : el;
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
    summary.innerHTML = `<p>${n === 1 ? 'Falta um campo' : `Faltam ${n} campos`} para enviar:</p><ul>${
      errors.map((er) => `<li><a href="#${er.el.id || ''}" data-focus>${er.label}</a>: ${er.msg}</li>`).join('')
    }</ul>`;
    summary.hidden = false;
    summary.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  function clearSummary() { if (summary) { summary.hidden = true; summary.innerHTML = ''; } }
  summary?.addEventListener('click', (e) => {
    const a = e.target.closest('[data-focus]'); if (!a) return;
    e.preventDefault();
    const id = a.getAttribute('href').slice(1);
    const el = id && document.getElementById(id); el && focusField(el);
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errors = validate();
    if (errors.length) { announce(errors); focusField(errors[0].el); return; }

    const hp = form.querySelector('[data-honeypot]');
    if ((hp && hp.value) || Date.now() - startedAt < 3000) { showResult(); return; }

    const fd = new FormData(form);
    const data = Object.fromEntries(fd.entries());
    if (hp?.name) delete data[hp.name];
    data.parceria = fd.getAll('parceria');
    data.origem = origemParaEnvio(ORIGEM);

    // O FormData entrega um File, que não sobrevive ao JSON. Vai como base64.
    const arquivo = fileInput?.files && fileInput.files[0];
    if (fileInput?.name) delete data[fileInput.name];
    if (arquivo) {
      data.anexo = {
        nome: arquivo.name,
        tipo: arquivo.type || 'application/pdf',
        dados: await lerBase64(arquivo),
      };
    }

    const endpoint = form.dataset.endpoint;
    if (!endpoint) {
      console.info('[hubber] connect: sem endpoint configurado; payload:', data);
      showResult();
      return;
    }

    const btn = form.querySelector('[type="submit"]');
    const label = btn?.textContent;
    if (btn) { btn.disabled = true; btn.textContent = 'Enviando...'; }
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(String(res.status));
      clearSummary();
      marcarLead();
      showResult();
    } catch (_) {
      // Sem confirmação do servidor a aplicação não chegou: dizer que deu certo
      // faria o criador ir embora achando que se aplicou.
      announceFailure();
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = label; }
    }
  });

  // Conversão para a campanha da Meta. Só aqui, depois do 200: o caminho do
  // honeypot e o de endpoint ausente também mostram a tela de sucesso, e contar
  // esses como lead ensinaria a campanha a perseguir robô. Não vai nada do que
  // a pessoa escreveu: para a Meta só vai navegação, como diz a política.
  function marcarLead() {
    if (typeof window.fbq !== 'function') return;
    window.fbq('track', 'Lead', { content_name: 'Hubber Connect' });
  }

  function announceFailure() {
    if (!summary) return;
    summary.innerHTML = '<p>Não conseguimos enviar a sua aplicação agora. '
      + 'Tente de novo em alguns instantes ou fale com a gente pelo WhatsApp.</p>';
    summary.hidden = false;
    summary.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function showResult() {
    if (!result) return;
    form.hidden = true;
    result.hidden = false;
    const h = result.querySelector('h2');
    if (h) h.focus({ preventScroll: true });
    const top = result.getBoundingClientRect().top + window.scrollY - 96;
    window.scrollTo({ top, behavior: 'smooth' });
  }
}
