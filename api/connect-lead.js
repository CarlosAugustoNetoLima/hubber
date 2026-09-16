/**
 * Recebe a aplicação do formulário da Hubber Connect e cria o lead no CRM do JSYNQ.
 *
 * O token do JSYNQ vive só aqui, em variável de ambiente. Ele nunca é enviado ao
 * navegador, e o mapa de campos também fica no servidor: a página não precisa
 * conhecer os ids internos do CRM.
 *
 * Variáveis de ambiente (painel da Vercel, nunca no código):
 *   JSYNQ_API_TOKEN   token de API do JSYNQ, gerado pelo Carlos. Define quem
 *                     assina cada lead que entra.
 *   JSYNQ_PROJECT_ID  projeto CRM (opcional, já tem padrão abaixo)
 *   JSYNQ_FORM_ID     formulário do projeto (opcional, já tem padrão abaixo)
 */

const API_BASE = 'https://api.jsynq.com';
const PROJECT_ID = process.env.JSYNQ_PROJECT_ID || '6aaa3f3bef105cbe3adc9849';
const FORM_ID = process.env.JSYNQ_FORM_ID || '6aaa3f82ef105cbe3adc9df4';

/* Cada campo da LP apontando para o campo correspondente no formulário do JSYNQ.
   `options` é uma lista fechada: valor fora dela é recusado, não repassado. */
const FIELDS = {
  nome:          { id: '6aaa40cfef105cbe3adcb863', required: true, max: 120 },
  perfil:        { id: '6aaa40cfef105cbe3adcb864', required: true, max: 200 },
  nicho:         { id: '6aaa40cfef105cbe3adcb865', required: true,
                   options: ['lifestyle', 'viagem', 'gastronomia', 'moda-beleza', 'fitness-saude', 'familia', 'esporte', 'humor', 'outro'] },
  seguidores:    { id: '6aaa40cfef105cbe3adcb866', required: true,
                   options: ['ate-10k', '10-50k', '50-150k', '150k-mais'] },
  destino:       { id: '6aaa40cfef105cbe3adcb867', required: true,
                   options: ['orlando', 'miami', 'outra-fl', 'outra-eua'] },
  data_ida:      { id: '6aaa40cfef105cbe3adcb868', required: true, date: true },
  data_volta:    { id: '6aaa40cfef105cbe3adcb869', date: true },
  motivo:        { id: '6aaa40cfef105cbe3adcb86a', required: true,
                   options: ['ferias', 'trabalho', 'evento', 'mudanca'] },
  parceria:      { id: '6aaa40cfef105cbe3adcb86b', multiple: true,
                   options: ['post-pago', 'produto-servico', 'evento-presencial', 'longo-prazo'] },
  midiakit:      { id: '6aaa40cfef105cbe3adcb86c', max: 500 },
  email:         { id: '6aaa40cfef105cbe3adcb86d', required: true, max: 200 },
  whatsapp:      { id: '6aaa40cfef105cbe3adcb86e', required: true, max: 40 },
  consentimento: { id: '6aaa40cfef105cbe3adcb86f', required: true, options: ['sim'] },
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

function buildAnswers(body) {
  const answers = [];
  const missing = [];
  const invalid = [];

  for (const [name, spec] of Object.entries(FIELDS)) {
    let raw = body[name];

    if (spec.multiple) {
      const list = (Array.isArray(raw) ? raw : String(raw ?? '').split(','))
        .map((v) => String(v).trim())
        .filter(Boolean)
        .filter((v) => spec.options.includes(v));
      if (list.length) answers.push({ field: spec.id, value: list });
      continue;
    }

    raw = typeof raw === 'string' ? raw.trim() : raw == null ? '' : String(raw).trim();
    if (!raw) { if (spec.required) missing.push(name); continue; }
    if (spec.max && raw.length > spec.max) { invalid.push(name); continue; }
    if (spec.options && !spec.options.includes(raw)) { invalid.push(name); continue; }
    if (spec.date) {
      const iso = toISODate(raw);
      if (!iso) { invalid.push(name); continue; }
      answers.push({ field: spec.id, value: iso });
      continue;
    }
    if (name === 'email' && !isEmail(raw)) { invalid.push(name); continue; }
    if (name === 'whatsapp' && !isPhone(raw)) { invalid.push(name); continue; }
    answers.push({ field: spec.id, value: raw });
  }

  return { answers, missing, invalid };
}

/* O Swagger declara o token no header Authorization sem dizer se leva "Bearer".
   Tenta a forma mais comum e, se o servidor recusar a credencial, tenta a outra. */
async function postToJsynq(answers, token) {
  const url = `${API_BASE}/api/projects/${PROJECT_ID}/forms/${FORM_ID}/answer`;
  const variants = /^bearer\s/i.test(token) ? [token] : [`Bearer ${token}`, token];

  let last;
  for (const authorization of variants) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization },
      body: JSON.stringify({ answers }),
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

  // Isca para robô: campo escondido preenchido, ou envio rápido demais para
  // alguém ter lido o formulário. Responde 200 para o robô não aprender nada.
  if (body.website_extra) return res.status(200).json({ ok: true });

  const { answers, missing, invalid } = buildAnswers(body);
  if (missing.length || invalid.length) {
    return res.status(422).json({ ok: false, error: 'validation', missing, invalid });
  }

  const token = process.env.JSYNQ_API_TOKEN;
  if (!token) {
    console.error('[connect-lead] JSYNQ_API_TOKEN ausente: lead não foi gravado.');
    return res.status(503).json({ ok: false, error: 'not_configured' });
  }

  try {
    const out = await postToJsynq(answers, token);
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
