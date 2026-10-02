/**
 * Formulário em etapas de briefing.hubbermarketing.com.
 *
 * Lê o tipo em <body data-tipo="marca|site">, desenha as etapas a partir de
 * js/briefing-perguntas.js e, na revisão, manda tudo para /api/briefing, que
 * cria o card no JSYNQ. As respostas ficam salvas no navegador até o envio.
 *
 * O servidor refaz a validação com o mesmo módulo de perguntas. A conferência
 * daqui existe para a pessoa ver o erro na hora, não para proteger nada.
 */

import { BRIEFINGS, CONSENTIMENTO, validar, visivel, formatar } from './briefing-perguntas.js';

const TIPO = document.body.dataset.tipo;
const B = BRIEFINGS[TIPO];
const N = B.passos.length;
const REVISAO = N + 1;
const STORE_KEY = `hubber-briefing-${TIPO}-v1`;

// ---------- estado ----------
const state = { a: {}, view: 0, max: 0 };
let enviando = false;
let enviado = false;
let consentiu = false;
let confirmandoApagar = false;
let aviso = '';

let salvo = null;
try {
  const bruto = localStorage.getItem(STORE_KEY);
  if (bruto) {
    const p = JSON.parse(bruto);
    if (p && p.a && typeof p.a === 'object') {
      salvo = p;
      state.a = p.a;
      state.max = Math.min(+p.max || 0, REVISAO);
    }
  }
} catch { /* armazenamento indisponível */ }
let temSalvo = !!(salvo && Object.keys(salvo.a).some((k) => String(salvo.a[k] || '').length));
const vistaSalva = salvo ? Math.min(+salvo.v || 0, REVISAO) : 0;

function persistir() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify({ a: state.a, v: state.view, max: state.max })); } catch { /* ignora */ }
}
function limparSalvo() { try { localStorage.removeItem(STORE_KEY); } catch { /* ignora */ } }
function zerar() { state.a = {}; state.max = 0; temSalvo = false; consentiu = false; enviando = false; enviado = false; aviso = ''; }

// ---------- util ----------
function h(tag, props, ...filhos) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  (function add(lista) {
    for (const c of lista) {
      if (c === null || c === undefined || c === false) continue;
      if (Array.isArray(c)) { add(c); continue; }
      el.append(c.nodeType ? c : document.createTextNode(c));
    }
  })(filhos);
  return el;
}
const $ = (id) => document.getElementById(id);
const val = (k) => (state.a[k] === undefined ? '' : state.a[k]);
const vazio = (c) => { const v = val(c.k); return Array.isArray(v) ? v.length === 0 : String(v).trim() === ''; };
const fid = (k) => `f-${k}`;
const mostra = (c) => visivel(c, state.a);

// ---------- campos ----------
function desenharCampo(c) {
  const id = fid(c.k);
  const dica = c.hint ? h('p', { class: 'hint', id: `${id}-h`, text: c.hint }) : null;
  const erro = h('p', { class: 'err', id: `${id}-e`, role: 'alert', hidden: true });
  const marca = c.req ? h('span', { class: 'req', 'aria-hidden': 'true' }, ' *') : null;
  const descreve = [c.hint ? `${id}-h` : '', `${id}-e`].join(' ').trim();
  let wrap;

  if (c.t === 'single' || c.t === 'multi') {
    const multi = c.t === 'multi';
    const lista = h('div', { class: `opts${multi ? ' chips' : ''}`, id });
    c.opts.forEach((o, i) => {
      const input = h('input', { type: multi ? 'checkbox' : 'radio', name: id, value: o, id: `${id}-${i}` });
      const atual = val(c.k);
      input.checked = multi ? Array.isArray(atual) && atual.includes(o) : atual === o;
      input.addEventListener('change', () => {
        if (multi) {
          const arr = Array.isArray(state.a[c.k]) ? state.a[c.k].slice() : [];
          const at = arr.indexOf(o);
          if (input.checked && at < 0) arr.push(o);
          if (!input.checked && at > -1) arr.splice(at, 1);
          state.a[c.k] = arr;
        } else {
          state.a[c.k] = o;
        }
        persistir(); limparErro(c); sincronizarLimite(c); sincronizarCondicionais();
      });
      lista.append(h('label', { class: 'opt', for: `${id}-${i}` }, input, h('span', { text: o })));
    });
    wrap = h('fieldset', { class: 'field', 'data-k': c.k, 'aria-describedby': descreve },
      h('legend', null, c.label, marca), dica, lista, erro);
  } else {
    const tag = c.t === 'textarea' ? 'textarea' : 'input';
    const ctl = h(tag, {
      class: 'in', id, name: c.k,
      type: tag === 'input' ? (c.t === 'tel' ? 'tel' : c.t) : null,
      rows: tag === 'textarea' ? 4 : null,
      placeholder: c.ph || null,
      autocomplete: c.t === 'email' ? 'email' : c.t === 'tel' ? 'tel' : 'off',
      inputmode: c.t === 'tel' ? 'tel' : null,
      maxlength: c.t === 'textarea' ? 4000 : 400,
      'aria-describedby': descreve,
    });
    ctl.value = String(val(c.k));
    ctl.addEventListener('input', () => { state.a[c.k] = ctl.value; persistir(); limparErro(c); sincronizarCondicionais(); });
    wrap = h('div', { class: 'field', 'data-k': c.k },
      h('label', { for: id }, c.label, marca), dica, ctl, erro);
  }
  if (!mostra(c)) wrap.hidden = true;
  return wrap;
}

function sincronizarLimite(c) {
  if (c.t !== 'multi' || !c.max) return;
  const arr = Array.isArray(state.a[c.k]) ? state.a[c.k] : [];
  const cheio = arr.length >= c.max;
  for (const b of document.querySelectorAll(`input[name="${fid(c.k)}"]`)) {
    const off = cheio && !b.checked;
    b.disabled = off;
    b.closest('.opt').classList.toggle('off', off);
  }
}

function sincronizarCondicionais() {
  const passo = B.passos[state.view - 1];
  if (!passo) return;
  for (const c of passo.campos) {
    if (!c.showIf) continue;
    const el = document.querySelector(`[data-k="${c.k}"]`);
    if (el) el.hidden = !mostra(c);
  }
}

function marcarErro(c, msg) {
  const el = document.querySelector(`[data-k="${c.k}"]`);
  if (!el) return;
  el.classList.add('bad');
  const e = $(`${fid(c.k)}-e`);
  e.textContent = msg; e.hidden = false;
  const ctl = el.querySelector('.in');
  if (ctl) ctl.setAttribute('aria-invalid', 'true');
}
function limparErro(c) {
  const el = document.querySelector(`[data-k="${c.k}"]`);
  if (!el) return;
  el.classList.remove('bad');
  const e = $(`${fid(c.k)}-e`);
  e.hidden = true; e.textContent = '';
  const ctl = el.querySelector('.in');
  if (ctl) ctl.removeAttribute('aria-invalid');
}

function conferirPasso(passo) {
  let primeiro = null;
  for (const c of passo.campos) {
    if (!mostra(c)) continue;
    let msg = null;
    if (c.req && vazio(c)) {
      msg = c.t === 'single' || c.t === 'multi' ? 'Escolha uma opção para continuar.' : 'Preencha este campo para continuar.';
    } else if (c.t === 'email' && !vazio(c) && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(val(c.k)).trim())) {
      msg = 'Use um e-mail completo, como nome@empresa.com.';
    } else if (c.t === 'tel' && !vazio(c) && !/^[0-9+()\s.-]{8,40}$/.test(String(val(c.k)).trim())) {
      msg = 'Use só números, com DDD ou código do país.';
    }
    if (msg) { marcarErro(c, msg); if (!primeiro) primeiro = c; } else limparErro(c);
  }
  return primeiro;
}

function focarCampo(c) {
  const el = document.querySelector(`[data-k="${c.k}"]`);
  if (!el) return;
  const d = el.closest('details');
  if (d) d.open = true;
  const alvo = el.querySelector('.in') || el.querySelector('input');
  if (alvo) { alvo.focus(); alvo.scrollIntoView({ block: 'center' }); }
}

// ---------- navegação ----------
function ir(vista, opcoes) {
  state.view = vista;
  if (vista > state.max) state.max = vista;
  confirmandoApagar = false;
  persistir();
  desenhar(opcoes && opcoes.manterRolagem);
}

function proximo() {
  const passo = B.passos[state.view - 1];
  const ruim = conferirPasso(passo);
  if (ruim) { focarCampo(ruim); return; }
  ir(state.view + 1);
}

// ---------- painel lateral ----------
function desenharPainel() {
  const titulo = state.view === 0 ? B.titulo
    : state.view === REVISAO ? (enviado ? 'Briefing enviado' : 'Revise e envie')
    : B.passos[state.view - 1].titulo;
  const t = $('railTitle');
  t.textContent = titulo;
  t.classList.remove('enter'); void t.offsetWidth; t.classList.add('enter');

  const seg = $('segbar'); seg.textContent = '';
  for (let i = 1; i <= REVISAO; i++) seg.append(h('i', { class: i <= state.view ? 'on' : '' }));

  const ol = $('steps'); ol.textContent = '';
  const itens = B.passos.map((p) => p.titulo).concat(['Revisão e envio']);
  itens.forEach((rotulo, idx) => {
    const n = idx + 1;
    const bloqueado = enviado || (n > state.max && n !== state.view);
    ol.append(h('li', null, h('button', {
      type: 'button',
      'aria-current': n === state.view ? 'step' : null,
      disabled: bloqueado && n !== state.view ? true : null,
      onclick: () => ir(n),
    }, h('span', { class: 'n', text: (n < 10 ? '0' : '') + n }), h('span', { class: 't', text: rotulo }))));
  });
}

// ---------- telas ----------
function telaIntro() {
  const retomar = temSalvo && vistaSalva > 0 && vistaSalva <= REVISAO;
  return [
    h('p', { class: 'lead' }, B.intro),
    h('p', { class: 'lead sm' }, `São ${N} etapas e ${B.duracao}. Suas respostas ficam salvas neste navegador até você enviar. Se não souber responder algo, escreva “não sei”: isso também é informação.`),
    h('div', { class: 'actions' },
      retomar
        ? [h('button', { class: 'btn', type: 'button', onclick: () => ir(Math.max(1, vistaSalva)) }, 'Continuar de onde parou'),
           h('button', { class: 'btn ghost', type: 'button', onclick: () => { zerar(); limparSalvo(); ir(1); } }, 'Começar do zero')]
        : h('button', { class: 'btn', type: 'button', onclick: () => ir(1) }, 'Começar')),
  ];
}

function telaPasso() {
  const passo = B.passos[state.view - 1];
  const saida = [
    h('p', { class: 'meta', text: `Etapa ${state.view} de ${N}` }),
    h('p', { class: 'lead', text: passo.porque }),
  ];
  const form = h('form', { novalidate: true, onsubmit: (e) => { e.preventDefault(); proximo(); } });

  const cs = passo.campos;
  let i = 0;
  while (i < cs.length) {
    const c = cs[i];
    if (c.grupo) {
      const nome = c.grupo;
      const dentro = h('div', { class: 'inner' });
      let respondido = false;
      while (i < cs.length && cs[i].grupo === nome) { dentro.append(desenharCampo(cs[i])); if (!vazio(cs[i])) respondido = true; i++; }
      form.append(h('details', { class: 'more', open: respondido ? true : null }, h('summary', { text: nome }), dentro));
    } else if (c.par) {
      const par = c.par;
      const linha = h('div', { class: 'pair' });
      while (i < cs.length && cs[i].par === par) { linha.append(desenharCampo(cs[i])); i++; }
      form.append(linha);
    } else {
      form.append(desenharCampo(c)); i++;
    }
  }

  form.append(h('div', { class: 'actions' },
    h('button', { class: 'btn ghost', type: 'button', onclick: () => ir(state.view - 1) }, 'Voltar'),
    h('button', { class: 'btn', type: 'submit' }, state.view === N ? 'Revisar respostas' : 'Continuar')));
  saida.push(form);
  return saida;
}

/* A primeira etapa com pergunta obrigatória sem resposta, para a revisão
   mandar a pessoa de volta em vez de deixar o servidor recusar. */
function primeiroPendente() {
  for (let i = 0; i < B.passos.length; i++) {
    for (const c of B.passos[i].campos) {
      if (mostra(c) && c.req && vazio(c)) return i + 1;
    }
  }
  return 0;
}

function telaEnviado() {
  const empresa = String(val('empresa')).trim();
  return [
    h('p', { class: 'meta', text: 'Recebemos' }),
    h('p', { class: 'lead', text: `${empresa ? `${empresa}, o` : 'O'} ${B.titulo.toLowerCase()} chegou à equipe da Hubber.` }),
    h('p', { class: 'lead sm', text: 'Vamos ler com calma e falar com você pelo e-mail ou pelo WhatsApp que informou. Não precisa enviar de novo.' }),
    h('div', { class: 'actions' },
      h('a', { class: 'btn', href: '../' }, 'Voltar aos briefings'),
      h('button', { class: 'btn ghost', type: 'button', onclick: () => { zerar(); limparSalvo(); ir(0); } }, 'Preencher outro')),
  ];
}

function telaRevisao() {
  if (enviado) return telaEnviado();

  const saida = [
    h('p', { class: 'meta', text: 'Última etapa' }),
    h('p', { class: 'lead', text: 'Confira as respostas. Você pode voltar em qualquer etapa para ajustar antes de enviar.' }),
  ];

  B.passos.forEach((passo, idx) => {
    const dl = h('dl');
    for (const c of passo.campos) {
      if (!mostra(c)) continue;
      const v = formatar(c, val(c.k));
      dl.append(h('div', { class: 'qa' }, h('dt', { text: c.label }), h('dd', { class: v ? '' : 'empty', text: v || 'Não respondido' })));
    }
    saida.push(h('section', { class: 'group' },
      h('div', { class: 'group-head' },
        h('h2', { text: passo.titulo }),
        h('button', { class: 'linkbtn', type: 'button', 'aria-label': `Editar ${passo.titulo}`, onclick: () => ir(idx + 1) }, 'Editar')),
      dl));
  });

  const status = h('p', { class: `status${aviso ? ' bad' : ''}`, id: 'status', role: 'status', 'aria-live': 'polite', text: aviso });
  const caixa = h('input', { type: 'checkbox', id: 'consent' });
  caixa.checked = consentiu;
  const enviar = h('button', { class: 'btn', type: 'button', 'aria-disabled': consentiu && !enviando ? 'false' : 'true' }, enviando ? 'Enviando…' : 'Enviar briefing');
  const copiar = h('button', { class: 'btn ghost', type: 'button', 'aria-disabled': consentiu ? 'false' : 'true' }, 'Copiar respostas');
  const isca = h('input', { class: 'hp', type: 'text', name: 'website_extra', id: 'website_extra', tabindex: '-1', autocomplete: 'off', 'aria-hidden': 'true' });

  caixa.addEventListener('change', () => {
    consentiu = caixa.checked;
    enviar.setAttribute('aria-disabled', consentiu && !enviando ? 'false' : 'true');
    copiar.setAttribute('aria-disabled', consentiu ? 'false' : 'true');
    aviso = ''; status.textContent = ''; status.classList.remove('bad');
  });

  const dizer = (msg, ruim) => { aviso = ruim ? msg : ''; status.textContent = msg; status.classList.toggle('bad', !!ruim); };

  enviar.addEventListener('click', () => {
    if (enviando) return;
    if (!consentiu) { dizer('Marque a autorização acima para continuar.', true); caixa.focus(); return; }
    const pendente = primeiroPendente();
    if (pendente) { dizer(`Falta responder uma pergunta obrigatória na etapa ${pendente}.`, true); return; }
    enviarBriefing(isca.value, dizer, enviar);
  });

  copiar.addEventListener('click', () => {
    if (!consentiu) { dizer('Marque a autorização acima para continuar.', true); caixa.focus(); return; }
    copiarTexto(textoCompleto()).then((ok) => dizer(ok ? 'Respostas copiadas.' : 'Não deu para copiar sozinho.', !ok));
  });

  saida.push(
    h('label', { class: 'consent', for: 'consent' }, caixa, h('span', null, CONSENTIMENTO)),
    isca,
    h('div', { class: 'actions' },
      h('button', { class: 'btn ghost', type: 'button', onclick: () => ir(N) }, 'Voltar'),
      enviar, copiar),
    status,
    h('p', { class: 'hint', style: 'margin-top:2rem' },
      confirmandoApagar
        ? [h('span', null, 'Apagar todas as respostas salvas neste navegador? '),
           h('button', { class: 'linkbtn', type: 'button', onclick: () => { zerar(); limparSalvo(); ir(0); } }, 'Sim, apagar'),
           h('span', null, ' · '),
           h('button', { class: 'linkbtn', type: 'button', onclick: () => { confirmandoApagar = false; desenhar(true); } }, 'Cancelar')]
        : h('button', { class: 'linkbtn', type: 'button', onclick: () => { confirmandoApagar = true; desenhar(true); } }, 'Apagar respostas salvas')));
  return saida;
}

// ---------- envio ----------
function textoCompleto() {
  const linhas = [`${B.titulo} · ${String(val('empresa')).trim() || 'Sem nome'}`, ''];
  for (const passo of B.passos) {
    linhas.push(passo.titulo.toUpperCase(), '');
    for (const c of passo.campos) {
      if (!mostra(c)) continue;
      linhas.push(c.label, formatar(c, val(c.k)) || 'Não respondido', '');
    }
  }
  return linhas.join('\n').trim();
}

function copiarTexto(texto) {
  const legado = () => {
    try {
      const ta = h('textarea', { 'aria-hidden': 'true', tabindex: '-1', style: 'position:fixed;top:0;left:0;opacity:0' });
      ta.value = texto; document.body.append(ta); ta.select();
      const ok = document.execCommand('copy'); ta.remove(); return ok;
    } catch { return false; }
  };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(texto).then(() => true, () => legado());
  }
  return Promise.resolve(legado());
}

async function enviarBriefing(isca, dizer, botao) {
  enviando = true;
  botao.setAttribute('aria-disabled', 'true');
  botao.textContent = 'Enviando…';
  dizer('Enviando…', false);

  const { limpo } = validar(TIPO, state.a);
  let resposta = null;
  try {
    resposta = await fetch('/api/briefing', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ tipo: TIPO, respostas: limpo, consentimento: true, website_extra: isca }),
    });
  } catch { /* sem rede */ }

  enviando = false;
  if (resposta && resposta.ok) {
    enviado = true;
    limparSalvo();
    desenhar(false);
    return;
  }

  botao.setAttribute('aria-disabled', consentiu ? 'false' : 'true');
  botao.textContent = 'Enviar briefing';
  if (resposta && resposta.status === 422) {
    dizer('Alguma resposta não passou na conferência. Volte pelas etapas e revise os campos obrigatórios.', true);
  } else if (!resposta) {
    dizer('Não consegui falar com o servidor. Confira sua conexão e tente de novo. Suas respostas continuam salvas.', true);
  } else {
    dizer('O envio falhou do nosso lado. Suas respostas continuam salvas: tente de novo em alguns minutos ou use “Copiar respostas” e mande pelo WhatsApp.', true);
  }
}

// ---------- desenho ----------
function desenhar(manterRolagem) {
  desenharPainel();
  const col = $('col'); col.textContent = '';
  const nos = state.view === 0 ? telaIntro() : state.view === REVISAO ? telaRevisao() : telaPasso();
  for (const n of nos) col.append(n);
  if (state.view >= 1 && state.view <= N) B.passos[state.view - 1].campos.forEach(sincronizarLimite);
  if (!manterRolagem) window.scrollTo(0, 0);
  if (!manterRolagem && state.view !== 0) { try { $('railTitle').focus({ preventScroll: true }); } catch { /* ignora */ } }
}

desenhar(true);
