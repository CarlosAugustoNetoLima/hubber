/**
 * Formulário em etapas de briefing.hubbermarketing.com.
 *
 * Lê o tipo em <body data-tipo="marca|site">, desenha as etapas a partir de
 * js/briefing-perguntas.js e, na revisão, manda tudo para /api/briefing, que
 * cria o card no JSYNQ. As respostas ficam salvas no navegador até o envio e
 * somem depois de RASCUNHO_HORAS sem alteração, mesmo com a página aberta.
 *
 * O servidor refaz a validação com o mesmo módulo de perguntas. A conferência
 * daqui existe para a pessoa ver o erro na hora, não para proteger nada.
 *
 * Quem faz um segundo briefing na mesma sessão pode reaproveitar o que já
 * informou (contato e o básico do negócio). Os dados ficam em sessionStorage,
 * só nesta aba, por SESSAO_MIN minutos depois do envio, e nunca são preenchidos
 * sem a pessoa conferir e dar o ok. Não há consulta a servidor nem busca por
 * e-mail: qualquer um digitaria o e-mail de outra pessoa e veria os dados dela.
 */

import { BRIEFINGS, CONSENTIMENTO, validar, visivel, formatar, todosCampos, diaMesValido } from './briefing-perguntas.js';

const TIPO = document.body.dataset.tipo;
const B = BRIEFINGS[TIPO];
const N = B.passos.length;
const REVISAO = N + 1;
const STORE_KEY = `hubber-briefing-${TIPO}-v1`;
const RASCUNHO_HORAS = 24;
const RASCUNHO_MS = RASCUNHO_HORAS * 60 * 60 * 1000;
const AVISO_RASCUNHO = `As respostas que estavam salvas neste navegador foram apagadas porque ficaram ${RASCUNHO_HORAS} horas sem alteração.`;
const SESSAO_KEY = 'hubber-briefing-sessao-v1';
const SESSAO_MIN = 15;
const SESSAO_MS = SESSAO_MIN * 60 * 1000;
const GRUPOS_REUSO = { contato: 'Contato', cadastro: 'Dados de cadastro', negocio: 'Sobre o negócio', marketing: 'Marketing e metas' };

// ---------- estado ----------
const state = { a: {}, view: 0, max: 0 };
let enviando = false;
let enviado = false;
let consentiu = false;
let confirmandoApagar = false;
let aviso = '';
let ofertaRecusada = false;
let ofertaVisivel = false;
let avisoSessao = '';
let apagouAgora = false;
let timerSessao = null;
let avisoRascunho = '';
let timerRascunho = null;
let ultimaAlteracao = null;   // hora da última alteração do rascunho nesta aba
const reaproveitados = new Set();

let salvo = null;
try {
  const bruto = localStorage.getItem(STORE_KEY);
  if (bruto) {
    const p = JSON.parse(bruto);
    if (p && p.a && typeof p.a === 'object') {
      const agora = Date.now();
      /* Rascunho sem hora é de antes desta regra: ganha o prazo a partir de agora,
         em vez de sumir na cara de quem estava no meio do preenchimento. */
      const t = typeof p.t === 'number' && p.t <= agora ? p.t : agora;
      if (agora - t >= RASCUNHO_MS) {
        localStorage.removeItem(STORE_KEY);
        if (Object.keys(p.a).some((k) => String(p.a[k] || '').length)) avisoRascunho = AVISO_RASCUNHO;
      } else {
        salvo = p;
        ultimaAlteracao = t;
        state.a = p.a;
        state.max = Math.min(+p.max || 0, REVISAO);
        if (p.t !== t) localStorage.setItem(STORE_KEY, JSON.stringify({ ...p, t }));
      }
    }
  }
} catch { /* armazenamento indisponível */ }
/* Rascunho de uma versão antiga pode apontar para uma opção que deixou de
   existir. Ela sai da memória em vez de travar o envio sem a pessoa entender. */
for (const c of todosCampos(B)) {
  const v = state.a[c.k];
  if (v === undefined) continue;
  if (c.t === 'single' && !c.opts.includes(v)) delete state.a[c.k];
  if (c.t === 'multi') state.a[c.k] = Array.isArray(v) ? v.filter((o) => c.opts.includes(o)) : [];
}
let temSalvo = !!(salvo && Object.keys(salvo.a).some((k) => String(salvo.a[k] || '').length));
const vistaSalva = salvo ? Math.min(+salvo.v || 0, REVISAO) : 0;

function persistir() {
  ultimaAlteracao = Date.now();
  try { localStorage.setItem(STORE_KEY, JSON.stringify({ a: state.a, v: state.view, max: state.max, t: ultimaAlteracao })); } catch { /* ignora */ }
  agendarVencimentoRascunho(ultimaAlteracao);
}
function limparSalvo() {
  clearTimeout(timerRascunho);
  ultimaAlteracao = null;
  try { localStorage.removeItem(STORE_KEY); } catch { /* ignora */ }
}

/* O rascunho some depois de RASCUNHO_HORAS sem alteração, também com a página
   aberta: num computador compartilhado, quem senta depois não encontra as
   respostas de outra pessoa. Cada alteração recomeça a contagem. */
function agendarVencimentoRascunho(t) {
  clearTimeout(timerRascunho);
  timerRascunho = setTimeout(verificarRascunho, Math.max(RASCUNHO_MS - (Date.now() - t), 0) + 1000);
}
function verificarRascunho() {
  if (enviado || enviando) return;
  // Vale a alteração mais recente, desta aba ou de outra aberta no mesmo briefing.
  let t = ultimaAlteracao;
  try {
    const p = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
    if (p && typeof p.t === 'number') t = Math.max(t || 0, p.t);
  } catch { /* ignora */ }
  if (t === null) return;
  if (Date.now() - t < RASCUNHO_MS) { agendarVencimentoRascunho(t); return; }
  const tinhaRespostas = Object.keys(state.a).some((k) => String(state.a[k] || '').length);
  zerar();
  limparSalvo();
  if (tinhaRespostas) avisoRascunho = AVISO_RASCUNHO;
  state.view = 0;
  desenhar(false);
}
// Computador que dormiu ou aba esquecida em segundo plano: confere ao voltar.
document.addEventListener('visibilitychange', () => { if (!document.hidden) verificarRascunho(); });
function zerar() {
  state.a = {}; state.max = 0; temSalvo = false; consentiu = false; enviando = false; enviado = false; aviso = '';
  reaproveitados.clear(); ofertaRecusada = false; avisoSessao = ''; apagouAgora = false;
}

// ---------- dados reaproveitados entre briefings ----------
const chavesReusaveis = new Set(Object.values(BRIEFINGS).flatMap((b) => todosCampos(b).filter((c) => c.compartilha).map((c) => c.k)));

function gravarSessao(itens) {
  try {
    if (itens.length) sessionStorage.setItem(SESSAO_KEY, JSON.stringify({ itens }));
    else sessionStorage.removeItem(SESSAO_KEY);
  } catch { /* sem sessionStorage o recurso simplesmente não existe */ }
}

/* Devolve as entradas ainda dentro do prazo e apaga do armazenamento as que
   venceram ou vieram malformadas. Cada briefing enviado é uma entrada, com a
   hora do envio: o prazo conta daí. */
function lerSessao() {
  let itens = [];
  try {
    const bruto = sessionStorage.getItem(SESSAO_KEY);
    if (bruto) {
      const p = JSON.parse(bruto);
      if (p && Array.isArray(p.itens)) itens = p.itens;
    }
  } catch { gravarSessao([]); return []; }
  const agora = Date.now();
  const vivas = itens.filter((e) => e && BRIEFINGS[e.tipo] && typeof e.at === 'number'
    && agora - e.at >= 0 && agora - e.at < SESSAO_MS && e.d && typeof e.d === 'object');
  if (vivas.length !== itens.length) gravarSessao(vivas);
  return vivas;
}

function guardarNaSessao(limpo) {
  const d = {};
  for (const k of chavesReusaveis) if (limpo[k] !== undefined) d[k] = limpo[k];
  const outras = lerSessao().filter((e) => e.tipo !== TIPO);
  gravarSessao(Object.keys(d).length ? [...outras, { tipo: TIPO, at: Date.now(), d }] : outras);
  agendarExpiracao();
}

function apagarSessao() {
  clearTimeout(timerSessao);
  gravarSessao([]);
}

/* O que dá para oferecer neste briefing: só dados de OUTROS briefings, só de
   perguntas marcadas como compartilhadas, e só valores que passam na validação
   daqui. O mais recente vence quando dois briefings trazem o mesmo campo. */
function ofertaDaSessao() {
  const entradas = lerSessao().filter((e) => e.tipo !== TIPO).sort((x, y) => x.at - y.at);
  if (!entradas.length) return null;
  const valores = {};
  for (const e of entradas) Object.assign(valores, e.d);
  const { limpo } = validar(TIPO, valores);
  const itens = todosCampos(B).filter((c) => c.compartilha && limpo[c.k] !== undefined).map((c) => [c, limpo[c.k]]);
  if (!itens.length) return null;
  return { itens, origens: entradas.map((e) => BRIEFINGS[e.tipo].titulo.toLowerCase()) };
}

/* Se a página ficar aberta além do prazo, os dados somem da tela e do
   armazenamento sozinhos, sem esperar a pessoa clicar em nada. */
function agendarExpiracao() {
  clearTimeout(timerSessao);
  const entradas = lerSessao();
  if (!entradas.length) return;
  const resta = Math.min(...entradas.map((e) => SESSAO_MS - (Date.now() - e.at)));
  timerSessao = setTimeout(() => {
    lerSessao();
    if (ofertaVisivel) avisoSessao = 'Por segurança, os dados venceram e foram apagados. Preencha normalmente.';
    if (state.view === 0 || (enviado && state.view === REVISAO)) desenhar(true);
    agendarExpiracao();
  }, Math.max(resta, 0) + 250);
}

function usarDados() {
  // Confere de novo: o painel pode ter ficado aberto além do prazo.
  const atual = ofertaDaSessao();
  if (!atual) {
    avisoSessao = 'Por segurança, os dados venceram e foram apagados. Preencha normalmente.';
    desenhar(true);
    return;
  }
  for (const [c, v] of atual.itens) {
    if (!vazio(c)) continue;
    state.a[c.k] = Array.isArray(v) ? v.slice() : v;
    reaproveitados.add(c.k);
  }
  ir(1);
}

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
        reaproveitados.delete(c.k);
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
      type: tag === 'input' ? (c.t === 'tel' ? 'tel' : c.t === 'diames' ? 'text' : c.t) : null,
      rows: tag === 'textarea' ? 4 : null,
      placeholder: c.ph || null,
      autocomplete: c.t === 'email' ? 'email' : c.t === 'tel' ? 'tel' : 'off',
      inputmode: c.t === 'tel' ? 'tel' : null,
      maxlength: c.t === 'textarea' ? 4000 : c.t === 'diames' ? 10 : 400,
      'aria-describedby': descreve,
    });
    ctl.value = String(val(c.k));
    ctl.addEventListener('input', () => { state.a[c.k] = ctl.value; reaproveitados.delete(c.k); persistir(); limparErro(c); sincronizarCondicionais(); });
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
    } else if (c.t === 'diames' && !vazio(c) && !diaMesValido(val(c.k))) {
      msg = 'Use o dia e o mês, como 14/03.';
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
  if (vista !== 0) avisoRascunho = '';
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
/* Painel de conferência: lista tudo o que seria preenchido e só preenche com o
   ok. Quem prefere começar do zero segue sem nada preenchido. */
function painelDeReuso(oferta) {
  const origem = oferta.origens.length === 1 ? `do ${oferta.origens[0]}` : 'dos briefings';
  const grupos = Object.entries(GRUPOS_REUSO).map(([chave, nome]) => {
    const itens = oferta.itens.filter(([c]) => c.compartilha === chave);
    if (!itens.length) return null;
    const dl = h('dl');
    for (const [c, v] of itens) {
      dl.append(h('div', { class: 'qa' }, h('dt', { text: c.label }), h('dd', { text: formatar(c, v) })));
    }
    return h('section', { class: 'group' }, h('div', { class: 'group-head' }, h('h2', { text: nome })), dl);
  });
  return h('section', { class: 'oferta', 'aria-labelledby': 'ofertaTitulo' },
    h('h2', { id: 'ofertaTitulo', text: `Reaproveitar os dados ${origem} que você enviou?` }),
    h('p', null, 'Para você não digitar tudo de novo, podemos preencher os campos que se repetem. Confira os dados abaixo: nada é preenchido sem o seu ok, e você ainda poderá editar cada campo.'),
    grupos,
    h('div', { class: 'actions' },
      h('button', { class: 'btn', type: 'button', onclick: usarDados }, 'Usar estes dados'),
      h('button', { class: 'btn ghost', type: 'button', onclick: () => { ofertaRecusada = true; ir(1); } }, 'Começar sem preencher')),
    h('p', { class: 'hint' },
      `Por segurança, estes dados ficam só nesta aba do navegador, por ${SESSAO_MIN} minutos depois do envio, e somem quando você fechar a aba. `,
      h('button', { class: 'linkbtn', type: 'button', onclick: () => { apagarSessao(); avisoSessao = 'Dados apagados deste navegador.'; desenhar(true); } }, 'Apagar agora')));
}

function telaIntro() {
  const retomar = temSalvo && vistaSalva > 0 && vistaSalva <= REVISAO;
  // Rascunho tem prioridade: não se preenche por cima do que a pessoa já escreveu.
  const oferta = !temSalvo && !ofertaRecusada ? ofertaDaSessao() : null;
  ofertaVisivel = !!oferta;
  return [
    h('p', { class: 'lead' }, B.intro),
    h('p', { class: 'lead sm' }, `São ${N} etapas e ${B.duracao}. Suas respostas ficam salvas neste navegador até você enviar e somem depois de ${RASCUNHO_HORAS} horas sem alteração. Se não souber responder algo, escreva “não sei”: isso também é informação.`),
    avisoRascunho ? h('p', { class: 'aviso', role: 'status', text: avisoRascunho }) : null,
    avisoSessao ? h('p', { class: 'aviso', role: 'status', text: avisoSessao }) : null,
    oferta
      ? painelDeReuso(oferta)
      : h('div', { class: 'actions' },
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
  if (passo.campos.some((c) => reaproveitados.has(c.k) && !vazio(c))) {
    saida.push(h('p', { class: 'aviso', role: 'note', text: 'Alguns campos vieram preenchidos com os dados do briefing anterior. Confira antes de continuar.' }));
  }
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
  const guardado = lerSessao().some((e) => e.tipo === TIPO);
  return [
    h('p', { class: 'meta', text: 'Recebemos' }),
    h('p', { class: 'lead', text: `${empresa ? `${empresa}, o` : 'O'} ${B.titulo.toLowerCase()} chegou à equipe da Hubber.` }),
    h('p', { class: 'lead sm', text: 'Vamos ler com calma e falar com você pelo e-mail ou pelo WhatsApp que informou. Não precisa enviar de novo.' }),
    guardado
      ? h('p', { class: 'hint' },
          `Se precisar preencher outro briefing agora, podemos reaproveitar seus dados de contato. Eles ficam só nesta aba do navegador, por ${SESSAO_MIN} minutos, e você pode `,
          h('button', { class: 'linkbtn', type: 'button', onclick: () => { apagarSessao(); apagouAgora = true; desenhar(true); } }, 'apagar agora'),
          '.')
      : null,
    apagouAgora ? h('p', { class: 'hint', role: 'status', text: 'Dados apagados deste navegador.' }) : null,
    // Leva à página com todos os briefings. Os dados da sessão seguem junto de propósito:
    // é assim que o próximo briefing oferece reaproveitar o que a pessoa acabou de informar.
    h('div', { class: 'actions' },
      h('a', { class: 'btn', href: '../' }, 'Preencher outro briefing')),
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
    guardarNaSessao(limpo);
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
  for (const n of nos) if (n) col.append(n);   // blocos opcionais chegam como null
  if (state.view >= 1 && state.view <= N) B.passos[state.view - 1].campos.forEach(sincronizarLimite);
  if (!manterRolagem) window.scrollTo(0, 0);
  if (!manterRolagem && state.view !== 0) { try { $('railTitle').focus({ preventScroll: true }); } catch { /* ignora */ } }
}

desenhar(true);
agendarExpiracao();
if (ultimaAlteracao !== null) agendarVencimentoRascunho(ultimaAlteracao);
