/**
 * Recebe o formulário da LP de reels e cria o lead no CRM do JSYNQ.
 *
 * A página não marca horário. Quem envia pede a conversa, e a equipe combina o
 * dia com a pessoa depois, pelo contato que ela deixou. O card nasce na coluna
 * de entrada com o Nicolas como responsável, que é o sinal de que tem conversa
 * para marcar.
 *
 * Variáveis de ambiente:
 *   JSYNQ_API_TOKEN       token de API do JSYNQ
 *   JSYNQ_RESPONSAVEL_ID  quem atende a conversa (opcional)
 *   JSYNQ_REELS_FORM_ID   formulário com a definição dos campos (opcional)
 *   JSYNQ_REELS_LABEL_ID  etiqueta de origem (opcional)
 */

import { guardar, concluir, drenar, filaAtiva } from './_fila.js';
import { origemDoLead } from './_origem.js';

const API_BASE = 'https://api.jsynq.com';
const PROJECT_ID  = process.env.JSYNQ_REELS_PROJECT_ID || '6aaac5d2f1edc4c698019729';
const FORM_ID     = process.env.JSYNQ_REELS_FORM_ID    || '6ab1b817effd9919b73c6776';
const BOARD_ID    = process.env.JSYNQ_REELS_BOARD_ID   || '6aaac5d2f1edc4c69801972d';
const COLUMN_ID   = process.env.JSYNQ_REELS_COLUMN_ID  || '6aaac5d2f1edc4c698019735';
const LABEL_ID    = process.env.JSYNQ_REELS_LABEL_ID   || '6ab1b820effd9919b73c6ac1';
const RESPONSAVEL = process.env.JSYNQ_RESPONSAVEL_ID   || '6ab13770effd9919b7232453';
const FORM_NAME = 'Hubber Reels · Agendamento de conversa';
const ORIGEM = 'Reels · LP de Orlando';

const FIELDS = {
  nome:     { id: '6ab1b817effd9919b73c6778', label: 'Nome', type: 'text',
              crmKey: 'contactName', required: true, max: 120 },
  empresa:  { id: '6ab1b817effd9919b73c6779', label: 'Empresa', type: 'text',
              crmKey: 'company', required: true, max: 160 },
  email:    { id: '6ab1b817effd9919b73c677a', label: 'E-mail', type: 'email',
              crmKey: 'email', required: true, max: 200 },
  telefone: { id: '6ab1b817effd9919b73c677b', label: 'WhatsApp ou telefone', type: 'text',
              crmKey: 'phone', required: true, max: 40 },
  negocio:  { id: '6ab1b817effd9919b73c677c', label: 'Tipo de negócio', type: 'text',
              required: true, max: 200 },
  onde:     { id: '6ab1b817effd9919b73c677d', label: 'Onde fica em Orlando', type: 'text',
              required: true, max: 200 },
  plano:    { id: '6ab1b817effd9919b73c677e', label: 'Plano de interesse', type: 'select',
              required: true,
              options: { avulsa: 'Captação avulsa, US$ 1.500',
                         consistencia: 'Plano Consistência, US$ 2.700 por mês',
                         indeciso: 'Ainda não sei, quero entender na conversa' } },
  consentimento: { id: '6ab1b817effd9919b73c6781', type: 'select', required: true,
              label: 'Autoriza a Hubber a usar os dados para marcar e realizar a conversa',
              options: { sim: 'Autorizo' } },
};

const IDIOMA_FIELD   = { id: '6ab1b817effd9919b73c6782', label: 'Idioma', type: 'text' };
const ORIGEM_FIELD   = { id: '6ab1b817effd9919b73c6783', label: 'Origem', type: 'text' };
const CAMPANHA_FIELD = { id: '6ab1b817effd9919b73c6784', label: 'Campanha', type: 'text' };
const CRIATIVO_FIELD = { id: '6ab1b817effd9919b73c6785', label: 'Criativo', type: 'text' };
const CLIQUE_FIELD   = { id: '6ab5689aae13e00a84feb075', label: 'Clique do anúncio (fbclid)', type: 'text' };

const MAX_BODY = 256 * 1024;

function isEmail(v) { return /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(v); }
function isPhone(v) { return /^[0-9+()\s-]{8,40}$/.test(v); }

function buildCard(body) {
  const customFields = [];
  const contato = {};
  const missing = [];
  const invalid = [];

  const push = (spec, value) => {
    customFields.push({
      fieldId: spec.id, fieldName: spec.label, fieldType: spec.type,
      value, formId: FORM_ID, formName: FORM_NAME,
    });
    if (spec.crmKey) contato[spec.crmKey] = value;
  };

  for (const [name, spec] of Object.entries(FIELDS)) {
    const raw = typeof body[name] === 'string' ? body[name].trim()
              : body[name] == null ? '' : String(body[name]).trim();
    if (!raw) { if (spec.required) missing.push(name); continue; }
    if (spec.max && raw.length > spec.max) { invalid.push(name); continue; }
    if (spec.options) {
      if (!(raw in spec.options)) { invalid.push(name); continue; }
      push(spec, spec.options[raw]);
      continue;
    }
    if (name === 'email' && !isEmail(raw)) { invalid.push(name); continue; }
    if (name === 'telefone' && !isPhone(raw)) { invalid.push(name); continue; }
    push(spec, raw);
  }

  if (!missing.length && !invalid.length) {
    const idioma = String(body.idioma || '').trim().slice(0, 20);
    if (idioma) push(IDIOMA_FIELD, idioma);
    push(ORIGEM_FIELD, ORIGEM);

    // São nove peças rodando, e saber qual trouxe o lead é o dado da campanha.
    const { campanha, criativo, clique } = origemDoLead(body);
    if (campanha) push(CAMPANHA_FIELD, campanha);
    if (criativo) push(CRIATIVO_FIELD, criativo);
    if (clique) push(CLIQUE_FIELD, clique);
  }

  const desc = customFields
    .map((f) => `${f.fieldName}: ${Array.isArray(f.value) ? f.value.join(', ') : f.value}`)
    .join('\n');

  const card = {
    title: contato.company || contato.contactName || 'Conversa sem empresa',
    type: 'task',
    board: BOARD_ID,
    column: COLUMN_ID,
    labels: [LABEL_ID],
    assignedUsers: [RESPONSAVEL],
    desc,
    customFields,
  };
  return { card, missing, invalid };
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
      console.error('[reels-lead] tentativa', tentativa + 1, 'falhou:', err?.message);
      res = null; continue;
    }
    if (res.ok || res.status < 500) break;
  }
  if (!res) return { ok: false, status: 0, body: 'sem resposta do JSYNQ' };
  if (res.ok) return { ok: true };
  return { ok: false, status: res.status, body: await res.text().catch(() => '') };
}

function resumo(body) {
  return `| ${body.empresa || '?'} · ${body.nome || '?'} · ${body.email || '?'} · ${body.telefone || '?'}`;
}

export async function entregarReelsLead(dados, token) {
  const { card } = buildCard(dados);
  const out = await criarCard(card, token);
  if (!out.ok) {
    console.error('[reels-lead] JSYNQ recusou:', out.status, out.body?.slice(0, 500), resumo(dados));
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

  if (body.website_extra) return res.status(200).json({ ok: true });

  const { missing, invalid } = buildCard(body);
  if (missing.length || invalid.length) {
    return res.status(422).json({ ok: false, error: 'validation', missing, invalid });
  }

  const token = process.env.JSYNQ_API_TOKEN;
  if (!token) {
    console.error('[reels-lead] JSYNQ_API_TOKEN ausente.', resumo(body));
    return res.status(503).json({ ok: false, error: 'not_configured' });
  }

  // Guardar vem antes de entregar. Se o JSYNQ estiver fora, o lead já está a
  // salvo e entra na fila em vez de sumir.
  const naFila = await guardar('reels', body);

  try {
    if (await entregarReelsLead(body, token)) {
      await concluir(naFila);
      if (filaAtiva()) {
        const r = await drenar('reels', (d) => entregarReelsLead(d, token), 2);
        if (r.entregues) console.log('[reels-lead] fila: reenviados', r.entregues);
      }
      return res.status(200).json({ ok: true });
    }
  } catch (err) {
    console.error('[reels-lead] falha ao falar com o JSYNQ:', err?.message, resumo(body));
  }

  // O CRM não aceitou, mas o pedido está na fila e será entregue depois. Dizer
  // que falhou faria a pessoa reenviar e criar card repetido.
  if (naFila) {
    console.error('[reels-lead] card na fila para reenvio:', naFila, resumo(body));
    return res.status(200).json({ ok: true, pendente: true });
  }
  return res.status(502).json({ ok: false, error: 'upstream' });
}
