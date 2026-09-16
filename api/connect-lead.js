/**
 * Recebe a aplicação do formulário da Hubber Connect e cria o lead no CRM do JSYNQ.
 *
 * O token do JSYNQ vive só aqui, em variável de ambiente. Ele nunca é enviado ao
 * navegador, e o mapa de campos também fica no servidor: a página não precisa
 * conhecer os ids internos do CRM.
 *
 * Quem aparece como responsável pelo lead não depende de quem gerou o token:
 * o JSYNQ carimba o reporter do card a partir do leader do projeto.
 *
 * Variáveis de ambiente (painel da Vercel, nunca no código):
 *   JSYNQ_API_TOKEN   token de API do JSYNQ, com permissão de escrita em projetos
 *   JSYNQ_PROJECT_ID  projeto CRM (opcional, já tem padrão abaixo)
 *   JSYNQ_FORM_ID     formulário do projeto (opcional, já tem padrão abaixo)
 */

const API_BASE = 'https://api.jsynq.com';
const PROJECT_ID = process.env.JSYNQ_PROJECT_ID || '6aaa3f3bef105cbe3adc9849';
const FORM_ID = process.env.JSYNQ_FORM_ID || '6aaa3f82ef105cbe3adc9df4';

/* Cada campo da LP apontando para o campo correspondente no formulário do JSYNQ.
   `options` é uma lista fechada: valor fora dela é recusado, não repassado. */
const BOARD_ID = process.env.JSYNQ_BOARD_ID || '6aaa3f3bef105cbe3adc984d';
const COLUMN_ID = process.env.JSYNQ_COLUMN_ID || '6aaa3f3bef105cbe3adc9855';
const LEAD_SOURCE_ID = process.env.JSYNQ_LEAD_SOURCE_ID || '6aaa506696e0e036ab0805ae';
const FORM_NAME = 'Hubber Connect · Aplicação de criador';

/* `label` e `type` reproduzem como o JSYNQ grava o campo no card; `crmKey`
   marca os três que o CRM trata como dados de contato. `options` é uma lista
   fechada: valor fora dela é recusado, não repassado. O rótulo de cada opção
   é o que aparece no card, no lugar do id. */
const FIELDS = {
  nome:          { id: '6aaa40cfef105cbe3adcb863', label: 'Nome', type: 'text',
                   crmKey: 'contactName', required: true, max: 120 },
  perfil:        { id: '6aaa40cfef105cbe3adcb864', label: 'Instagram ou TikTok', type: 'text',
                   required: true, max: 200 },
  nicho:         { id: '6aaa40cfef105cbe3adcb865', label: 'Nicho', type: 'select', required: true,
                   options: { lifestyle: 'Lifestyle', viagem: 'Viagem', gastronomia: 'Gastronomia',
                              'moda-beleza': 'Moda e beleza', 'fitness-saude': 'Fitness e saúde',
                              familia: 'Família', esporte: 'Esporte',
                              humor: 'Humor e entretenimento', outro: 'Outro' } },
  seguidores:    { id: '6aaa40cfef105cbe3adcb866', label: 'Faixa de seguidores', type: 'select', required: true,
                   options: { 'ate-10k': 'Até 10 mil', '10-50k': '10 a 50 mil',
                              '50-150k': '50 a 150 mil', '150k-mais': 'Acima de 150 mil' } },
  destino:       { id: '6aaa40cfef105cbe3adcb867', label: 'Destino', type: 'select', required: true,
                   options: { orlando: 'Orlando', miami: 'Miami',
                              'outra-fl': 'Outra cidade da Flórida', 'outra-eua': 'Outra cidade dos EUA' } },
  data_ida:      { id: '6aaa40cfef105cbe3adcb868', label: 'Data de ida', type: 'date',
                   required: true, date: true },
  data_volta:    { id: '6aaa40cfef105cbe3adcb869', label: 'Data de volta', type: 'date', date: true },
  motivo:        { id: '6aaa40cfef105cbe3adcb86a', label: 'Motivo da viagem', type: 'select', required: true,
                   options: { ferias: 'Férias', trabalho: 'Trabalho', evento: 'Evento',
                              mudanca: 'Mudança para os EUA' } },
  parceria:      { id: '6aaa40cfef105cbe3adcb86b', label: 'Tipo de parceria que te interessa',
                   type: 'multiselect', multiple: true,
                   options: { 'post-pago': 'Post pago', 'produto-servico': 'Produto ou serviço em troca de conteúdo',
                              'evento-presencial': 'Evento presencial', 'longo-prazo': 'Parceria de longo prazo' } },
  midiakit:      { id: '6aaa40cfef105cbe3adcb86c', label: 'Link do mídia kit ou portfólio',
                   type: 'text', max: 500 },
  email:         { id: '6aaa40cfef105cbe3adcb86d', label: 'E-mail', type: 'email',
                   crmKey: 'email', required: true, max: 200 },
  whatsapp:      { id: '6aaa40cfef105cbe3adcb86e', label: 'WhatsApp', type: 'text',
                   crmKey: 'phone', required: true, max: 40 },
  consentimento: { id: '6aaa40cfef105cbe3adcb86f', type: 'select',
                   label: 'Autorizo a Hubber a usar estes dados para avaliar minha aplicação',
                   required: true, options: { sim: 'Autorizo' } },
};

const MAX_BODY = 16 * 1024;

/* dd/mm/aaaa para ISO, validando que a data existe de verdade (31/02 não passa). */
function toISODate(value) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(value).trim());
  if (!m) return null;
  const [, d, mo, y] = m.map(Number);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return dt.toISOString().slice(0, 10);
}

function isEmail(v) { return /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(v); }
function isPhone(v) { return /^[0-9+()\s-]{8,40}$/.test(v); }

/* Monta o card do CRM a partir do corpo do formulário, no mesmo formato que o
   JSYNQ grava quando a resposta vem pelo formulário hospedado: rótulo legível
   em vez do id da opção, e os três campos de contato marcados por crmKey. */
function buildCard(body) {
  const customFields = [];
  const contato = {};
  const missing = [];
  const invalid = [];

  // O id é sempre o do campo do formulário, nunca o crmKey: o JSYNQ já cria
  // sozinho os campos de contato a partir do que vai no topo do card, e usar
  // o mesmo id aqui faria um sobrescrever o outro.
  const push = (spec, value) => {
    customFields.push({
      fieldId: spec.id,
      fieldName: spec.label,
      fieldType: spec.type,
      value,
      formId: FORM_ID,
      formName: FORM_NAME,
    });
    if (spec.crmKey) contato[spec.crmKey] = value;
  };

  for (const [name, spec] of Object.entries(FIELDS)) {
    let raw = body[name];

    if (spec.multiple) {
      const list = (Array.isArray(raw) ? raw : String(raw ?? '').split(','))
        .map((v) => String(v).trim())
        .filter((v) => v in spec.options)
        .map((v) => spec.options[v]);
      if (list.length) push(spec, list.join(', '));
      continue;
    }

    raw = typeof raw === 'string' ? raw.trim() : raw == null ? '' : String(raw).trim();
    if (!raw) { if (spec.required) missing.push(name); continue; }
    if (spec.max && raw.length > spec.max) { invalid.push(name); continue; }
    if (spec.options) {
      if (!(raw in spec.options)) { invalid.push(name); continue; }
      push(spec, spec.options[raw]);
      continue;
    }
    if (spec.date) {
      // Valida que a data existe, mas grava no formato que a pessoa digitou:
      // em ISO o JSYNQ devolve a data entre aspas dentro do próprio texto.
      if (!toISODate(raw)) { invalid.push(name); continue; }
      push(spec, raw);
      continue;
    }
    if (name === 'email' && !isEmail(raw)) { invalid.push(name); continue; }
    if (name === 'whatsapp' && !isPhone(raw)) { invalid.push(name); continue; }
    push(spec, raw);
  }

  const card = {
    title: contato.contactName || 'Aplicação sem nome',
    type: 'task',
    board: BOARD_ID,
    column: COLUMN_ID,
    leadSource: [LEAD_SOURCE_ID],
    customFields,
    ...contato,
  };
  return { card, missing, invalid };
}

/* O Swagger declara o token no header Authorization sem dizer se leva "Bearer".
   Tenta a forma mais comum e, se o servidor recusar a credencial, tenta a outra. */
async function criarCard(card, token) {
  const url = `${API_BASE}/api/projects/${PROJECT_ID}/cards`;
  const variants = /^bearer\s/i.test(token) ? [token] : [`Bearer ${token}`, token];

  let last;
  for (const authorization of variants) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization },
      body: JSON.stringify(card),
    });
    if (res.ok) return { ok: true };
    last = { status: res.status, body: await res.text().catch(() => '') };
    if (res.status !== 401 && res.status !== 403) break;
  }
  return { ok: false, ...last };
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

  // Isca para robô: campo escondido preenchido. Responde 200 para o robô não
  // aprender nada com a diferença entre aceitar e recusar.
  if (body.website_extra) return res.status(200).json({ ok: true });

  const { card, missing, invalid } = buildCard(body);
  if (missing.length || invalid.length) {
    return res.status(422).json({ ok: false, error: 'validation', missing, invalid });
  }

  const token = process.env.JSYNQ_API_TOKEN;
  if (!token) {
    console.error('[connect-lead] JSYNQ_API_TOKEN ausente: lead não foi gravado.');
    return res.status(503).json({ ok: false, error: 'not_configured' });
  }

  try {
    const out = await criarCard(card, token);
    if (!out.ok) {
      // O corpo da resposta do JSYNQ fica só no log, nunca vai para o navegador.
      console.error('[connect-lead] JSYNQ recusou:', out.status, out.body?.slice(0, 500));
      return res.status(502).json({ ok: false, error: 'upstream' });
    }
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[connect-lead] falha ao falar com o JSYNQ:', err?.message);
    return res.status(502).json({ ok: false, error: 'upstream' });
  }
}
