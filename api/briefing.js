/**
 * Recebe um briefing de briefing.hubbermarketing.com e cria o card no projeto
 * "Hubber · Briefings" do JSYNQ. Uma resposta, um card.
 *
 * Mesmo desenho do reels-lead.js: o token vive só aqui, o mapa de campos fica
 * no servidor e a resposta é gravada na fila antes da tentativa. A validação é
 * refeita aqui com o mesmo módulo que a página usa (js/briefing-perguntas.js),
 * então o que o navegador mandou além do que o formulário oferece é ignorado.
 *
 * Os briefings têm projeto próprio e não entram no de leads: quem preenche já é
 * cliente. O que distingue marca de website dentro do quadro é a etiqueta e o
 * formulário. Briefing novo = entrada em BRIEFINGS, etiqueta e formulário no
 * JSYNQ e uma linha em TIPOS abaixo.
 *
 * O card guarda os campos de contato e o destaque do tipo como campos do CRM, e
 * leva todas as respostas, na ordem do briefing, na descrição.
 *
 * Variáveis de ambiente:
 *   JSYNQ_API_TOKEN              token de API do JSYNQ
 *   JSYNQ_BRIEFING_RESPONSAVEL_ID  quem recebe o card (opcional, padrão Larissa)
 */

import { guardar, concluir, drenar, filaAtiva } from './_fila.js';
import { BRIEFINGS, validar, montarTexto, CONSENTIMENTO } from '../js/briefing-perguntas.js';

const API_BASE = 'https://api.jsynq.com';
const PROJECT_ID  = process.env.JSYNQ_BRIEFING_PROJECT_ID || '6abf3ce857b946818a0ced8c';
const BOARD_ID    = process.env.JSYNQ_BRIEFING_BOARD_ID   || '6abf3ce857b946818a0ced90';
const COLUMN_ID   = process.env.JSYNQ_BRIEFING_COLUMN_ID  || '6abf3ce857b946818a0ced98';
/* Todo briefing cai na mão da Larissa, que conduz a entrega. Sem responsável o
   card nasce órfão e depende de alguém varrer a coluna para ver que chegou. */
const RESPONSAVEL = process.env.JSYNQ_BRIEFING_RESPONSAVEL_ID || '6a862692b045e567c7c8d55b';

/* `campos` liga a chave da pergunta ao campo do formulário do JSYNQ. `destaque`
   é o campo de lista do tipo (objetivo na marca, tipo de projeto no site). */
const TIPOS = {
  marca: {
    formId: '6abf3d6157b946818a0cf4ec',
    formName: 'Hubber Briefing · Marca',
    labelId: process.env.JSYNQ_BRIEFING_LABEL_MARCA || '6abf3cf157b946818a0cee9c',
    origem: 'Briefing · Marca',
    campos: {
      empresa:     { id: '6abf3d6157b946818a0cf4ee', label: 'Empresa', type: 'text', crmKey: 'company' },
      responsavel: { id: '6abf3d6157b946818a0cf4ef', label: 'Responsável', type: 'text', crmKey: 'contactName' },
      email:       { id: '6abf3d6157b946818a0cf4f0', label: 'E-mail', type: 'email', crmKey: 'email' },
      whatsapp:    { id: '6abf3d6157b946818a0cf4f1', label: 'WhatsApp', type: 'text', crmKey: 'phone' },
      cidade:      { id: '6abf3d6157b946818a0cf4f2', label: 'Cidade e região', type: 'text' },
      objetivo:    { id: '6abf3d6157b946818a0cf4f3', label: 'Objetivo principal', type: 'select' },
    },
    consentimento: { id: '6abf3d6157b946818a0cf4f4', label: 'Autoriza a Hubber a usar os dados para desenvolver o projeto', type: 'select' },
    origemCampo:   { id: '6abf3d6157b946818a0cf4f5', label: 'Origem', type: 'text' },
  },
  site: {
    formId: '6abf3d6457b946818a0cf52c',
    formName: 'Hubber Briefing · Website',
    labelId: process.env.JSYNQ_BRIEFING_LABEL_SITE || '6abf3cf457b946818a0cef38',
    origem: 'Briefing · Website',
    campos: {
      empresa:     { id: '6abf3d6457b946818a0cf52e', label: 'Empresa', type: 'text', crmKey: 'company' },
      responsavel: { id: '6abf3d6457b946818a0cf52f', label: 'Responsável', type: 'text', crmKey: 'contactName' },
      email:       { id: '6abf3d6457b946818a0cf530', label: 'E-mail', type: 'email', crmKey: 'email' },
      whatsapp:    { id: '6abf3d6457b946818a0cf531', label: 'WhatsApp', type: 'text', crmKey: 'phone' },
      cidade:      { id: '6abf3d6457b946818a0cf532', label: 'Cidade e região', type: 'text' },
      tipoprojeto: { id: '6abf3d6457b946818a0cf533', label: 'Tipo de projeto', type: 'select' },
    },
    consentimento: { id: '6abf3d6457b946818a0cf534', label: 'Autoriza a Hubber a usar os dados para desenvolver o projeto', type: 'select' },
    origemCampo:   { id: '6abf3d6457b946818a0cf535', label: 'Origem', type: 'text' },
  },
};

const MAX_BODY = 256 * 1024;

function montarCard(tipo, respostas) {
  const cfg = TIPOS[tipo];
  const customFields = [];
  const contato = {};

  const push = (spec, value) => {
    customFields.push({
      fieldId: spec.id, fieldName: spec.label, fieldType: spec.type,
      value, formId: cfg.formId, formName: cfg.formName,
    });
    if (spec.crmKey) contato[spec.crmKey] = value;
  };

  for (const [chave, spec] of Object.entries(cfg.campos)) {
    if (respostas[chave]) push(spec, respostas[chave]);
  }
  push(cfg.consentimento, 'Autorizo');
  push(cfg.origemCampo, cfg.origem);

  const titulo = BRIEFINGS[tipo].titulo;
  return {
    title: `${contato.company || respostas.empresa || 'Empresa sem nome'} · ${titulo}`,
    type: 'task',
    board: BOARD_ID,
    column: COLUMN_ID,
    labels: [cfg.labelId],
    assignedUsers: [RESPONSAVEL],
    desc: `${titulo}\n\n${montarTexto(tipo, respostas)}`,
    customFields,
  };
}

const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const auth = (token) => (/^bearer\s/i.test(token) ? token : `Bearer ${token}`);

async function criarCard(card, token) {
  const url = `${API_BASE}/api/projects/${PROJECT_ID}/cards`;
  let res = null;
  for (let tentativa = 0; tentativa < 3; tentativa++) {
    if (tentativa) await espera(tentativa * 600);
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: auth(token) },
        body: JSON.stringify(card),
      });
    } catch (err) {
      console.error('[briefing] tentativa', tentativa + 1, 'falhou:', err?.message);
      res = null; continue;
    }
    if (res.ok || res.status < 500) break;
  }
  if (!res) return { ok: false, status: 0, body: 'sem resposta do JSYNQ' };
  if (res.ok) return { ok: true };
  return { ok: false, status: res.status, body: await res.text().catch(() => '') };
}

const resumo = (d) => `| ${d?.tipo} · ${d?.respostas?.empresa || '?'} · ${d?.respostas?.email || '?'}`;

/* Usada pelo cron e pelo próprio envio. `dados` é { tipo, respostas } já
   validado: o que está na fila nunca foi aceito sem passar por validar(). */
export async function entregarBriefing(dados, token) {
  const { tipo, respostas } = dados;
  if (!TIPOS[tipo]) return false;
  const out = await criarCard(montarCard(tipo, respostas), token);
  if (!out.ok) {
    console.error('[briefing] JSYNQ recusou:', out.status, out.body?.slice(0, 500), resumo(dados));
    return false;
  }
  return true;
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    if (body.length > MAX_BODY) return res.status(413).json({ ok: false, error: 'too_large' });
    try { body = JSON.parse(body); } catch { return res.status(400).json({ ok: false, error: 'invalid_json' }); }
  }
  if (!body || typeof body !== 'object') return res.status(400).json({ ok: false, error: 'invalid_json' });

  // Campo-isca: gente não preenche, robô preenche. Responde como se tivesse dado certo.
  if (body.website_extra) return res.status(200).json({ ok: true });

  const tipo = body.tipo;
  if (typeof tipo !== 'string' || !TIPOS[tipo]) {
    return res.status(422).json({ ok: false, error: 'validation', invalid: ['tipo'] });
  }
  if (body.consentimento !== true) {
    return res.status(422).json({ ok: false, error: 'validation', missing: ['consentimento'] });
  }

  const { faltam, invalidos, limpo } = validar(tipo, body.respostas);
  if (faltam.length || invalidos.length) {
    return res.status(422).json({ ok: false, error: 'validation', missing: faltam, invalid: invalidos });
  }

  const token = process.env.JSYNQ_API_TOKEN;
  const dados = { tipo, respostas: limpo };
  if (!token) {
    console.error('[briefing] JSYNQ_API_TOKEN ausente.', resumo(dados));
    return res.status(503).json({ ok: false, error: 'not_configured' });
  }

  // Guardar vem antes de entregar. Se o JSYNQ estiver fora, a resposta já está
  // a salvo e entra na fila em vez de sumir.
  const naFila = await guardar('briefing', dados);

  try {
    if (await entregarBriefing(dados, token)) {
      await concluir(naFila);
      if (filaAtiva()) {
        const r = await drenar('briefing', (d) => entregarBriefing(d, token), 2);
        if (r.entregues) console.log('[briefing] fila: reenviados', r.entregues);
      }
      return res.status(200).json({ ok: true });
    }
  } catch (err) {
    console.error('[briefing] falha ao falar com o JSYNQ:', err?.message, resumo(dados));
  }

  // O CRM não aceitou, mas a resposta está na fila e será entregue depois. Dizer
  // que falhou faria a pessoa reenviar e criar card repetido.
  if (naFila) {
    console.error('[briefing] card na fila para reenvio:', naFila, resumo(dados));
    return res.status(200).json({ ok: true, pendente: true });
  }
  return res.status(502).json({ ok: false, error: 'upstream' });
}

export { CONSENTIMENTO };
