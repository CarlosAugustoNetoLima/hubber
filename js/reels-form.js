const TEXTO = {
  en: { carregando: 'Loading available times',
        falhou: 'We could not load the calendar. Send the form anyway and we will get in touch to schedule.',
        fuso: 'All times shown are Orlando time',
        escolha: 'Pick a day', ocupado: 'Someone just took that time. Pick another one.',
        erro: 'We could not send it. Try again in a moment.',
        faltando: 'Some fields are missing.', enviando: 'Booking...' },
  pt: { carregando: 'Carregando os horários livres',
        falhou: 'Não conseguimos carregar o calendário. Envie assim mesmo e a gente entra em contato para marcar.',
        fuso: 'Todos os horários são de Orlando',
        escolha: 'Escolha um dia', ocupado: 'Alguém acabou de pegar esse horário. Escolha outro.',
        erro: 'Não conseguimos enviar. Tente de novo em instantes.',
        faltando: 'Faltam campos para enviar.', enviando: 'Marcando...' },
};

/* `lerOrigem` chega por parâmetro em vez de import. O reels.js é quem chama
   este módulo, e importar de volta fecharia um ciclo: com await de topo de um
   lado e import estático do outro, os dois módulos ficam esperando um ao
   outro para sempre, sem erro nenhum no console. */
export function initReelsForm(root = document, lerOrigem = () => ({})) {
  const form = root.querySelector('[data-reels-form]');
  if (!form) return;

  const lang = form.querySelector('[name="idioma"]')?.value === 'pt' ? 'pt' : 'en';
  const T = TEXTO[lang];
  const nascido = Date.now();

  const agenda = form.querySelector('[data-agenda]');
  const estado = agenda.querySelector('[data-agenda-estado]');
  const rotuloFuso = agenda.querySelector('[data-agenda-fuso]');
  const caixaDias = agenda.querySelector('[data-agenda-dias]');
  const caixaHoras = agenda.querySelector('[data-agenda-horas]');
  const campoInicio = agenda.querySelector('[data-agenda-inicio]');
  const resultado = root.querySelector('[data-reels-result]');
  const quandoOk = resultado?.querySelector('[data-reels-quando]');
  const resumoErros = form.querySelector('[data-errors]');

  let dias = [];
  let diaAberto = null;

  const comoDia = (iso) => {
    const [a, m, d] = iso.split('-').map(Number);
    return new Date(Date.UTC(a, m - 1, d)).toLocaleDateString(lang === 'pt' ? 'pt-BR' : 'en-US',
      { timeZone: 'UTC', weekday: 'short', day: '2-digit', month: 'short' });
  };

  function pintarHoras() {
    const dia = dias.find((d) => d.data === diaAberto);
    caixaHoras.innerHTML = '';
    if (!dia) { caixaHoras.hidden = true; return; }
    for (const h of dia.horarios) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'agenda__hora';
      b.textContent = h.hora;
      b.setAttribute('aria-pressed', String(campoInicio.value === h.inicio));
      b.addEventListener('click', () => {
        campoInicio.value = h.inicio;
        pintarHoras();
      });
      caixaHoras.appendChild(b);
    }
    caixaHoras.hidden = false;
  }

  function pintarDias() {
    caixaDias.innerHTML = '';
    for (const d of dias) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'agenda__dia';
      b.textContent = comoDia(d.data);
      b.setAttribute('aria-pressed', String(d.data === diaAberto));
      b.addEventListener('click', () => {
        diaAberto = d.data;
        campoInicio.value = '';
        pintarDias();
        pintarHoras();
      });
      caixaDias.appendChild(b);
    }
    caixaDias.hidden = false;
  }

  // Sem calendário a pessoa ainda envia: o lead entra sem horário e alguém
  // marca à mão. Recusar quem chegou até aqui seria pior que agendar depois.
  async function carregarAgenda() {
    estado.textContent = T.carregando;
    try {
      const res = await fetch('/api/reels-agenda');
      if (!res.ok) throw new Error(String(res.status));
      const dados = await res.json();
      if (!dados?.dias?.length) throw new Error('vazio');
      dias = dados.dias;
      if (dados.fuso?.sigla) rotuloFuso.textContent = `${T.fuso} (${dados.fuso.sigla})`;
      estado.textContent = T.escolha;
      diaAberto = dias[0].data;
      pintarDias();
      pintarHoras();
    } catch (_) {
      estado.textContent = T.falhou;
    }
  }

  function mostrarErro(campo, texto) {
    const alvo = campo.closest('[data-field]')?.querySelector('[data-error]');
    if (!alvo) return;
    alvo.textContent = texto;
    alvo.hidden = false;
  }

  function limparErros() {
    form.querySelectorAll('[data-error]').forEach((e) => { e.hidden = true; e.textContent = ''; });
    if (resumoErros) { resumoErros.hidden = true; resumoErros.textContent = ''; }
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    limparErros();

    // Radio tem value preenchido mesmo desmarcado, então a checagem é pelo
    // grupo: vale se algum do mesmo name estiver marcado.
    const faltando = [...form.querySelectorAll('[required]')].filter((el) => {
      if (el.type === 'checkbox') return !el.checked;
      if (el.type === 'radio') return !form.querySelector(`[name="${el.name}"]:checked`);
      return !el.value.trim();
    });
    if (faltando.length) {
      faltando.forEach((el) => mostrarErro(el, ' '));
      if (resumoErros) { resumoErros.textContent = T.faltando; resumoErros.hidden = false; }
      faltando[0].focus();
      return;
    }
    // A guarda de três segundos é a mesma dos outros formulários do site.
    if (Date.now() - nascido < 3000) { mostrarSucesso(''); return; }

    const dados = Object.fromEntries(new FormData(form).entries());
    delete dados.website_extra;
    dados.origem = lerOrigem();

    const btn = form.querySelector('[type="submit"]');
    const rotulo = btn?.textContent;
    if (btn) { btn.disabled = true; btn.textContent = T.enviando; }
    try {
      const res = await fetch(form.dataset.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dados),
      });
      if (res.status === 409) {
        estado.textContent = T.ocupado;
        campoInicio.value = '';
        await carregarAgenda();
        return;
      }
      if (!res.ok) throw new Error(String(res.status));
      const corpo = await res.json().catch(() => ({}));
      mostrarSucesso(corpo.agendada || '');
    } catch (_) {
      if (resumoErros) { resumoErros.textContent = T.erro; resumoErros.hidden = false; }
    } finally {
      if (btn) { btn.disabled = false; if (rotulo) btn.textContent = rotulo; }
    }
  });

  function mostrarSucesso(quando) {
    if (!resultado) return;
    form.hidden = true;
    resultado.hidden = false;
    if (quandoOk) quandoOk.textContent = quando;
    resultado.querySelector('h3')?.focus({ preventScroll: true });
    const topo = resultado.getBoundingClientRect().top + window.scrollY - 96;
    window.scrollTo({ top: topo, behavior: 'smooth' });
  }

  carregarAgenda();
}
