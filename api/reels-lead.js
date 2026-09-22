/**
 * Recebe o formulário da LP de reels, marca a conversa na agenda do Nicolas e
 * cria o lead no CRM do JSYNQ.
 *
 * A ordem importa. A reunião vem primeiro, porque é o que a pessoa veio buscar
 * e é o único passo que não dá para refazer sem consequência: se o CRM cair, o
 * lead espera na fila e entra depois, mas um horário prometido e não marcado é
 * uma conversa que ninguém vai ter. Por isso o item da fila guarda a reunião já
 * criada: o reenvio recria o card, nunca o compromisso.
 *
 * O horário é revalidado aqui contra a agenda. A lista que o navegador recebeu
 * pode ter envelhecido entre carregar a página e enviar o formulário, e duas
 * pessoas podem escolher o mesmo horário no mesmo minuto.
 *
 * Tudo no fuso de Orlando. Ver api/reels-agenda.js, que devolve a grade.
 *
 * Variáveis de ambiente:
 *   JSYNQ_API_TOKEN       token de API do JSYNQ
 *   JSYNQ_RESPONSAVEL_ID  quem atende a conversa (opcional)
 *   JSYNQ_REELS_FORM_ID   formulário com a definição dos campos (opcional)
 *   JSYNQ_REELS_LABEL_ID  etiqueta de origem (opcional)
 */

import { guardar, concluir, drenar, filaAtiva } from './_fila.js';
import { montarAgenda, rotuloDoHorario } from './reels-agenda.js';

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

const AGENDADA_FIELD = { id: '6ab1b817effd9919b73c677f', label: 'Conversa agendada', type: 'text' };
const SALA_FIELD     = { id: '6ab1b817effd9919b73c6780', label: 'Sala da conversa', type: 'text' };
const IDIOMA_FIELD   = { id: '6ab1b817effd9919b73c6782', label: 'Idioma', type: 'text' };
const ORIGEM_FIELD   = { id: '6ab1b817effd9919b73c6783', label: 'Origem', type: 'text' };
const CAMPANHA_FIELD = { id: '6ab1b817effd9919b73c6784', label: 'Campanha', type: 'text' };
const CRIATIVO_FIELD = { id: '6ab1b817effd9919b73c6785', label: 'Criativo', type: 'text' };

const MAX_BODY = 256 * 1024;

function isEmail(v) { return /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(v); }
function isPhone(v) { return /^[0-9+()\s-]{8,40}$/.test(v); }

function buildCard(body, reuniao) {
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
    if (reuniao) {
      push(AGENDADA_FIELD, reuniao.rotulo);
      if (reuniao.sala) push(SALA_FIELD, reuniao.sala);
    }
    const idioma = String(body.idioma || '').trim().slice(0, 20);
    if (idioma) push(IDIOMA_FIELD, idioma);
    push(ORIGEM_FIELD, ORIGEM);

    // As UTMs em dois campos: a campanha de um lado, o criativo do outro. São
    // nove peças rodando, e saber qual trouxe o lead é o dado da campanha.
    const o = body.origem && typeof body.origem === 'object' ? body.origem : {};
    const campanha = [o.utm_source, o.utm_medium, o.utm_campaign]
      .filter(Boolean).map((v) => String(v).slice(0, 100)).join(' · ');
    const criativo = [o.utm_content, o.utm_term]
      .filter(Boolean).map((v) => String(v).slice(0, 100)).join(' · ');
    if (campanha) push(CAMPANHA_FIELD, campanha);
    if (criativo) push(CRIATIVO_FIELD, criativo);
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

/* O horário ainda está livre? A lista que o navegador tem pode ter envelhecido,
   e duas pessoas podem escolher o mesmo bloco no mesmo minuto. */
async function horarioLivre(inicioIso, token) {
  const dia = inicioIso.slice(0, 10);
  const url = `${API_BASE}/api/meetings/availability`
    + `?startDate=${dia}&endDate=${dia}&collaboratorIds=${RESPONSAVEL}`;
  const res = await fetch(url, { headers: { authorization: auth(token) } });
  if (!res.ok) throw new Error(`disponibilidade devolveu ${res.status}`);
  const dados = await res.json();
  const ocupados = dados?.busy || dados?.data?.busy || [];
  return montarAgenda(ocupados).some((d) => d.horarios.some((h) => h.inicio === inicioIso));
}

async function marcarConversa(inicioIso, fimIso, body, token) {
  const corpo = {
    title: `Conversa · ${String(body.empresa || body.nome || 'lead').slice(0, 80)}`,
    date: inicioIso.slice(0, 10),
    startTime: inicioIso,
    endTime: fimIso,
    invitees: [RESPONSAVEL],
    outsideInvitees: [String(body.email || '').trim()].filter(Boolean),
    description: `Conversa de qualificação vinda da LP de reels.\n`
      + `Empresa: ${body.empresa || ''}\nNegócio: ${body.negocio || ''}\n`
      + `Onde: ${body.onde || ''}\nPlano de interesse: ${body.plano || ''}`,
  };
  const res = await fetch(`${API_BASE}/api/meetings`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: auth(token) },
    body: JSON.stringify(corpo),
  });
  if (!res.ok) {
    return { ok: false, status: res.status, body: (await res.text().catch(() => '')).slice(0, 300) };
  }
  const dados = await res.json().catch(() => null);
  const m = dados?.scheduledMeeting || dados?.data?.scheduledMeeting || dados?.meeting || dados;
  return { ok: true, id: m?._id || null, sala: m?.room || null };
}

function resumo(body) {
  return `| ${body.empresa || '?'} · ${body.nome || '?'} · ${body.email || '?'}`
    + ` · ${body.telefone || '?'} · ${body.inicio || '?'}`;
}

/* Só o card. A reunião já existe e vai no item da fila, para o reenvio não
   marcar o mesmo horário duas vezes. */
export async function entregarReelsLead(dados, token) {
  const { card } = buildCard(dados, dados.reuniao || null);
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

  const { missing, invalid } = buildCard(body, null);
  if (missing.length || invalid.length) {
    return res.status(422).json({ ok: false, error: 'validation', missing, invalid });
  }

  /* Sem JavaScript não há como consultar a agenda, e a página precisa funcionar
     assim. Nesse caminho o lead entra sem horário e a conversa é marcada à mão:
     é bem melhor que recusar quem chegou até o fim do formulário. */
  const semHorario = !body.inicio;
  const rotulo = semHorario ? 'A marcar, enviado sem calendário' : rotuloDoHorario(body.inicio);
  if (!rotulo) return res.status(422).json({ ok: false, error: 'horario_invalido' });

  const token = process.env.JSYNQ_API_TOKEN;
  if (!token) {
    console.error('[reels-lead] JSYNQ_API_TOKEN ausente.', resumo(body));
    return res.status(503).json({ ok: false, error: 'not_configured' });
  }

  let marcada = { ok: true, id: null, sala: null };
  if (!semHorario) {
    try {
      if (!(await horarioLivre(body.inicio, token))) {
        return res.status(409).json({ ok: false, error: 'horario_ocupado' });
      }
    } catch (err) {
      console.error('[reels-lead] não consegui conferir a agenda:', err?.message, resumo(body));
      return res.status(502).json({ ok: false, error: 'upstream' });
    }

    const fim = new Date(new Date(body.inicio).getTime() + 30 * 60000).toISOString();
    marcada = await marcarConversa(body.inicio, fim, body, token);
    if (!marcada.ok) {
      console.error('[reels-lead] não consegui marcar:', marcada.status, marcada.body, resumo(body));
      return res.status(502).json({ ok: false, error: 'agenda' });
    }
  }

  const dados = { ...body, reuniao: { rotulo, sala: marcada.sala, id: marcada.id } };
  const naFila = await guardar('reels', dados);

  try {
    if (await entregarReelsLead(dados, token)) {
      await concluir(naFila);
      if (filaAtiva()) {
        const r = await drenar('reels', (d) => entregarReelsLead(d, token), 2);
        if (r.entregues) console.log('[reels-lead] fila: reenviados', r.entregues);
      }
      return res.status(200).json({ ok: true, agendada: rotulo, sala: marcada.sala });
    }
  } catch (err) {
    console.error('[reels-lead] falha ao falar com o JSYNQ:', err?.message, resumo(dados));
  }

  // A conversa está marcada e a pessoa recebeu o convite. Dizer que falhou a
  // faria reenviar e marcar um segundo horário.
  if (naFila) {
    console.error('[reels-lead] card na fila para reenvio:', naFila, resumo(dados));
    return res.status(200).json({ ok: true, pendente: true, agendada: rotulo, sala: marcada.sala });
  }
  return res.status(502).json({ ok: false, error: 'upstream' });
}
