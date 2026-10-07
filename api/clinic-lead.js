/**
 * Formulário curto da LP /plastic/ (Hubber Agency para clínicas de cirurgia
 * plástica nos EUA). Cria o card no MESMO projeto do CRM do diagnóstico: todo
 * lead do site cai naquele quadro, distinguido pela etiqueta (Agência) e pelo
 * campo Origem (/plastic/ ou /plastic/pt/). Nada de banco paralelo.
 *
 * Diferenças em relação ao diagnóstico, de propósito:
 *   - Não há rota calculada: a LP vende só a Agency. Sem o piso de faturamento
 *     de US$85 mil do Build, que não se aplica aqui.
 *   - Só dados comerciais: nome, e-mail, telefone (opcional), clínica, site,
 *     cidade/estado, função e objetivo principal. Nenhum dado de paciente.
 *
 * O contrato da resposta é o mesmo do diagnóstico, para o Pixel e a página
 * tratarem igual: `delivered` (CRM confirmou, com eventId), `pending` (salvo na
 * fila, sem eventId: fila não é conversão) e `ignored` (isca de robô).
 *
 * Variáveis de ambiente: as mesmas do api/diagnostico.js (JSYNQ_API_TOKEN etc.).
 */

import { randomUUID } from 'node:crypto';
import {
  CRM, FIELDS, ROTA_FIELD, IDIOMA_FIELD, ORIGEM_FIELD,
  criarCard, isEmail, isPhone, parseUrlEncoded, MAX_BODY,
} from './diagnostico.js';
import { validateCampaign } from '../js/campaign-context.js';

const productionQueue = async () => import('./_fila.js');
const TIPO_FILA = 'clinica';

/* Listas fechadas: valor fora daqui é recusado, não repassado ao CRM. Os
   rótulos são os que aparecem no card (em PT, que é como a equipe lê). */
export const ROLES = Object.freeze({
  'surgeon-owner':    'Cirurgião(ã) e dono(a) da clínica',
  'practice-owner':   'Dono(a) / sócio(a), não cirurgião',
  'practice-manager': 'Gestor(a) da clínica',
  marketing:          'Responsável por marketing',
  other:              'Outra função',
});
export const GOALS = Object.freeze({
  consultations: 'Mais consultas qualificadas',
  authority:     'Autoridade e presença digital mais fortes',
  ads:           'Anúncios que trazem o paciente certo',
  website:       'Site e landing pages que convertem',
  tracking:      'Saber de onde vêm os pacientes',
  other:         'Outro objetivo',
});

const ORIGENS = { 'en-US': '/plastic/', 'pt-BR': '/plastic/pt/' };

/* Valida e normaliza o corpo. Devolve os dados limpos (só chaves conhecidas,
   que é o que pode entrar na fila) ou a lista do que falta/está inválido. */
export function validateClinicLead(body) {
  const missing = [];
  const invalid = [];
  const out = {};
  const text = (name, { required = false, max = 200, min = 0 } = {}) => {
    const v = body[name];
    if (v != null && typeof v !== 'string') { invalid.push(name); return; }
    const raw = (v || '').trim();
    if (!raw) { if (required) missing.push(name); return; }
    if (raw.length > max || raw.length < min) { invalid.push(name); return; }
    out[name] = raw;
  };
  text('nome', { required: true, max: 120 });
  text('email', { required: true, max: 200 });
  text('telefone', { max: 40 });
  text('clinica', { required: true, max: 160 });
  text('site', { max: 300 });
  text('local', { max: 120 });
  text('detalhe', { max: 1000 });
  // Objetivo é obrigatório (um toque na página); função é opcional.
  for (const [name, list, required] of [['funcao', ROLES, false], ['objetivo', GOALS, true]]) {
    const raw = typeof body[name] === 'string' ? body[name].trim() : '';
    if (!raw) { if (required) missing.push(name); }
    else if (!(raw in list)) invalid.push(name);
    else out[name] = raw;
  }
  if (body.consentimento !== 'sim') missing.push('consentimento');
  else out.consentimento = 'sim';

  if (out.email && !isEmail(out.email)) { invalid.push('email'); delete out.email; }
  if (out.telefone && !isPhone(out.telefone)) { invalid.push('telefone'); delete out.telefone; }

  const campaign = validateCampaign(body);
  invalid.push(...campaign.errors);
  // A LP só vende Agency: o produto vem fixo do servidor, não do navegador.
  Object.assign(out, campaign.value, { product: 'agency' });

  const idioma = String(body.idioma || '').toLowerCase().startsWith('pt') ? 'pt-BR' : 'en-US';
  out.idioma = idioma;
  out.origem = ORIGENS[idioma];
  return { data: out, missing: [...new Set(missing)], invalid: [...new Set(invalid)] };
}

/* Monta o card no formato que o JSYNQ grava, reaproveitando os ids de campo do
   formulário do diagnóstico onde o significado é o mesmo. O que não tem campo
   próprio (cidade/estado, função) vai na descrição, que aparece em todo lugar. */
export function buildClinicCard(d) {
  const customFields = [];
  const contato = {};
  const push = (spec, value) => {
    customFields.push({ fieldId: spec.id, fieldName: spec.label, fieldType: spec.type,
      value, formId: CRM.FORM_ID, formName: CRM.FORM_NAME });
    if (spec.crmKey) contato[spec.crmKey] = value;
  };
  push(FIELDS.empresa, d.clinica);
  push(FIELDS.nome, d.nome);
  push(FIELDS.email, d.email);
  if (d.telefone) push(FIELDS.telefone, d.telefone);
  if (d.site) push(FIELDS.site, d.site);
  push(FIELDS.setor, 'Cirurgia plástica');
  push(FIELDS.mercado, FIELDS.mercado.options.eua);
  push(FIELDS.objetivo, d.detalhe ? `${GOALS[d.objetivo]}: ${d.detalhe}` : GOALS[d.objetivo]);
  push(FIELDS.consentimento, FIELDS.consentimento.options.sim);
  push(ROTA_FIELD, 'Agência');
  push(IDIOMA_FIELD, d.idioma);
  push(ORIGEM_FIELD, d.origem);

  const linhas = [
    'Pedido de reunião · LP /plastic (Hubber Agency · clínicas de cirurgia plástica nos EUA)',
    `Clínica / Instagram: ${d.clinica}`,
    `Nome: ${d.nome}`,
    d.funcao && `Função: ${ROLES[d.funcao]}`,
    `E-mail: ${d.email}`,
    d.telefone && `Telefone: ${d.telefone}`,
    d.site && `Site / Instagram: ${d.site}`,
    d.local && `Cidade/estado: ${d.local}`,
    `Objetivo principal: ${GOALS[d.objetivo]}`,
    d.detalhe && `Detalhe: ${d.detalhe}`,
    `Idioma: ${d.idioma} · Origem: ${d.origem}`,
    'Reunião NÃO agendada: a página só confirma o recebimento.',
  ].filter(Boolean);
  const campaign = Object.entries(validateCampaign(d).value);
  if (campaign.length) {
    linhas.push('', 'Campaign context (URL values; attribution not independently verified):',
      ...campaign.map(([k, v]) => `${k}: ${v}`));
  }
  return {
    title: d.clinica,
    type: 'task',
    board: CRM.BOARD_ID,
    column: CRM.COLUMN_ID,
    labels: [CRM.LABEL_POR_ROTA.agencia],
    assignedUsers: [CRM.RESPONSAVEL],
    desc: linhas.join('\n'),
    customFields,
  };
}

/* Usada pelo envio ao vivo e pelo reenvio da fila (drenar.js). */
export async function entregarClinicLead(dados, token) {
  const out = await criarCard(buildClinicCard(dados), token);
  if (!out.ok) {
    console.error('[clinic-lead] JSYNQ recusou:', out.status, out.body?.slice(0, 500), resumo(dados));
    return false;
  }
  return true;
}

function resumo(d) {
  return `| ${d.clinica || '?'} · ${d.nome || '?'} · ${d.email || '?'} · ${d.telefone || '-'}`;
}

const PAGINA = {
  'en-US': {
    ok: ['Request received.', 'Thank you. Your request reached our team. We will get back to you to find a time for the conversation. No meeting has been scheduled yet.'],
    pend: ['Request saved.', 'Your request is saved and waiting to reach our team. We will retry delivery; you do not need to submit again. No meeting has been scheduled yet.'],
    err: ['We could not record your request.', 'Something failed on our side. Please try again in a few minutes.'],
    back: 'Back to the page', href: '/plastic/',
  },
  'pt-BR': {
    ok: ['Pedido recebido.', 'Obrigado. Seu pedido chegou à nossa equipe. Vamos entrar em contato para combinar um horário para a conversa. Nenhuma reunião foi agendada ainda.'],
    pend: ['Pedido salvo.', 'Seu pedido está salvo e aguarda entrega à nossa equipe. Vamos tentar de novo; você não precisa reenviar. Nenhuma reunião foi agendada ainda.'],
    err: ['Não conseguimos registrar seu pedido.', 'Algo falhou do nosso lado. Tente de novo em alguns minutos.'],
    back: 'Voltar para a página', href: '/plastic/pt/',
  },
};

function paginaHtml(idioma, estado) {
  const t = PAGINA[idioma] || PAGINA['en-US'];
  const [titulo, texto] = t[estado];
  return `<!doctype html>
<html lang="${idioma}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${titulo} | Hubber</title>
<link rel="icon" type="image/svg+xml" href="/assets/brand/favicon.svg">
<link rel="stylesheet" href="/css/fonts.css">
<link rel="stylesheet" href="/css/tokens.css">
<link rel="stylesheet" href="/css/base.css">
<link rel="stylesheet" href="/css/layout.css">
<link rel="stylesheet" href="/css/components.css">
</head>
<body data-surface="ink">
<main id="main"><section class="section" data-surface="ink"><div class="wrap">
  <h1 class="t-h2">${titulo}</h1>
  <p class="t-lead t-muted">${texto}</p>
  <p><a class="btn btn--primary" href="${t.href}">${t.back}</a></p>
</div></section></main>
</body>
</html>`;
}

export function createClinicLeadHandler(overrides = {}) {
  const getQueue = overrides.getQueue || productionQueue;
  const getToken = overrides.getToken || (() => process.env.JSYNQ_API_TOKEN);
  const deliver = overrides.deliver || entregarClinicLead;
  const eventId = overrides.eventId || (() => `clinic_${randomUUID()}`);

  return async function handler(req, res) {
    if (req.method === 'OPTIONS') return res.status(204).end();
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return res.status(405).json({ ok: false, error: 'method_not_allowed' });
    }
    const navegador = String(req.headers['content-type'] || '').includes('application/x-www-form-urlencoded');
    let body = req.body;
    if (typeof body === 'string') {
      if (body.length > MAX_BODY) return res.status(413).json({ ok: false, error: 'too_large' });
      if (navegador) body = parseUrlEncoded(body);
      else {
        try { body = JSON.parse(body); } catch { return res.status(400).json({ ok: false, error: 'invalid_json' }); }
      }
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) return res.status(400).json({ ok: false, error: 'invalid_json' });
    if (JSON.stringify(body).length > MAX_BODY) return res.status(413).json({ ok: false, error: 'too_large' });

    const idioma = String(body.idioma || '').toLowerCase().startsWith('pt') ? 'pt-BR' : 'en-US';
    const responder = (status, json, estado) => {
      if (navegador) {
        res.setHeader('content-type', 'text/html; charset=utf-8');
        return res.status(status).send(paginaHtml(idioma, estado));
      }
      return res.status(status).json(json);
    };

    // Isca de robô: responde como recebido, sem card e sem eventId.
    if (body.website_extra) return responder(200, { ok: true, delivery: 'ignored' }, 'ok');

    const { data, missing, invalid } = validateClinicLead(body);
    if (missing.length || invalid.length) {
      if (navegador) { res.setHeader('location', ORIGENS[idioma] + '#contact'); return res.status(303).end(); }
      return res.status(422).json({ ok: false, error: 'validation', missing, invalid });
    }

    const token = getToken();
    if (!token) {
      console.error('[clinic-lead] JSYNQ_API_TOKEN ausente: pedido não foi gravado.', resumo(data));
      return responder(503, { ok: false, error: 'not_configured' }, 'err');
    }

    const queue = await getQueue();
    const naFila = await queue.guardar(TIPO_FILA, data);
    try {
      if (await deliver(data, token)) {
        await queue.concluir(naFila);
        if (queue.filaAtiva()) {
          const r = await queue.drenar(TIPO_FILA, (d) => deliver(d, token), 2);
          if (r.entregues) console.log('[clinic-lead] fila: reenviados', r.entregues);
        }
        return responder(200, { ok: true, delivery: 'delivered', eventId: eventId(), product: 'agency' }, 'ok');
      }
    } catch (err) {
      console.error('[clinic-lead] falha ao falar com o JSYNQ:', err?.message, resumo(data));
    }
    if (naFila) {
      console.error('[clinic-lead] na fila para reenvio:', naFila, resumo(data));
      return responder(200, { ok: true, delivery: 'pending', pendente: true }, 'pend');
    }
    return responder(502, { ok: false, error: 'upstream' }, 'err');
  };
}

export default createClinicLeadHandler();
