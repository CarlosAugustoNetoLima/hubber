/**
 * Recebe a aplicação do formulário da Hubber Connect e cria o lead no CRM do JSYNQ.
 *
 * O token do JSYNQ vive só aqui, em variável de ambiente. Ele nunca é enviado ao
 * navegador, e o mapa de campos também fica no servidor: a página não precisa
 * conhecer os ids internos do CRM.
 *
 * Quem assina o lead é o dono do token: o JSYNQ carimba o reporter do card a
 * partir de quem gerou a credencial, não do leader do projeto. Medido.
 *
 * O destino é o projeto "Hubber Site · Diagnósticos", o mesmo de todo lead que
 * o site gera. Não criar projeto separado por landing page: origem se distingue
 * por etiqueta e pelo campo Origem, dentro do mesmo quadro.
 *
 * Variáveis de ambiente (painel da Vercel, nunca no código):
 *   JSYNQ_API_TOKEN            token de API do JSYNQ, com escrita em projetos
 *   JSYNQ_CONNECT_PROJECT_ID   projeto CRM (opcional, já tem padrão abaixo)
 *   JSYNQ_CONNECT_FORM_ID      formulário com a definição dos campos (idem)
 *   JSYNQ_CONNECT_BOARD_ID     quadro (idem)
 *   JSYNQ_CONNECT_COLUMN_ID    coluna de entrada (idem)
 *   JSYNQ_CONNECT_LABEL_ID     etiqueta que marca a origem do lead (idem)
 *   JSYNQ_RESPONSAVEL_ID       quem recebe o card (idem)
 */

import { guardar, concluir, drenar, filaAtiva } from './_fila.js';
import { origemDoLead } from './_origem.js';

const API_BASE = 'https://api.jsynq.com';
const PROJECT_ID = process.env.JSYNQ_CONNECT_PROJECT_ID || '6aaac5d2f1edc4c698019729';
const FORM_ID    = process.env.JSYNQ_CONNECT_FORM_ID    || '6aaaca2ef1edc4c69802a9e5';
const BOARD_ID   = process.env.JSYNQ_CONNECT_BOARD_ID   || '6aaac5d2f1edc4c69801972d';
const COLUMN_ID  = process.env.JSYNQ_CONNECT_COLUMN_ID  || '6aaac5d2f1edc4c698019735';
const LABEL_ID   = process.env.JSYNQ_CONNECT_LABEL_ID   || '6aaaca4ef1edc4c69802b021';
/* Todo lead do site cai na mão do Nicolas. Sem responsável o card nasce órfão
   e depende de alguém varrer a coluna para descobrir que chegou. */
const RESPONSAVEL = process.env.JSYNQ_RESPONSAVEL_ID || '6ab13770effd9919b7232453';
const FORM_NAME = 'Hubber Connect · Aplicação de criador';

/* Todo lead do site vive no mesmo projeto do CRM. A etiqueta é o que separa as
   origens no quadro: cada LP nova entra aqui com a sua, não com projeto novo. */
const ORIGEM_FIELD = { id: '6aaaca2ef1edc4c69802a9f6', label: 'Origem', type: 'text' };
const ORIGEM = 'Connect · LP de influencers';
const CAMPANHA_FIELD = { id: '6ab56a9bae13e00a84ff6ae4', label: 'Campanha', type: 'text' };
const CRIATIVO_FIELD = { id: '6ab56a9bae13e00a84ff6ae5', label: 'Criativo', type: 'text' };
const CLIQUE_FIELD   = { id: '6ab56a9bae13e00a84ff6ae6', label: 'Clique do anúncio (fbclid)', type: 'text' };

/* `label` e `type` reproduzem como o JSYNQ grava o campo no card; `crmKey`
   marca os três que o CRM trata como dados de contato. `options` é uma lista
   fechada: valor fora dela é recusado, não repassado. O rótulo de cada opção
   é o que aparece no card, no lugar do id. */
const FIELDS = {
  nome:          { id: '6aaaca2ef1edc4c69802a9e9', label: 'Nome', type: 'text',
                   crmKey: 'contactName', required: true, max: 120 },
  perfil:        { id: '6aaaca2ef1edc4c69802a9ea', label: 'Instagram ou TikTok', type: 'text',
                   required: true, max: 200 },
  nicho:         { id: '6aaaca2ef1edc4c69802a9eb', label: 'Nicho', type: 'select', required: true,
                   options: { lifestyle: 'Lifestyle', viagem: 'Viagem', gastronomia: 'Gastronomia',
                              'moda-beleza': 'Moda e beleza', 'fitness-saude': 'Fitness e saúde',
                              familia: 'Família', esporte: 'Esporte',
                              humor: 'Humor e entretenimento', outro: 'Outro' } },
  seguidores:    { id: '6aaaca2ef1edc4c69802a9ec', label: 'Faixa de seguidores', type: 'select', required: true,
                   options: { 'ate-10k': 'Até 10 mil', '10-50k': '10 a 50 mil',
                              '50-150k': '50 a 150 mil', '150k-mais': 'Acima de 150 mil' } },
  destino:       { id: '6aaaca2ef1edc4c69802a9ed', label: 'Destino', type: 'select', required: true,
                   options: { orlando: 'Orlando', miami: 'Miami',
                              'outra-fl': 'Outra cidade da Flórida', 'outra-eua': 'Outra cidade dos EUA' } },
  data_ida:      { id: '6aaaca2ef1edc4c69802a9ee', label: 'Data de ida', type: 'date',
                   required: true, date: true },
  data_volta:    { id: '6aaaca2ef1edc4c69802a9ef', label: 'Data de volta', type: 'date', date: true },
  motivo:        { id: '6aaaca2ef1edc4c69802a9f0', label: 'Motivo da viagem', type: 'select', required: true,
                   options: { ferias: 'Férias', trabalho: 'Trabalho', evento: 'Evento',
                              mudanca: 'Mudança para os EUA' } },
  parceria:      { id: '6aaaca2ef1edc4c69802a9f1', label: 'Tipo de parceria que interessa',
                   type: 'multiselect', multiple: true,
                   options: { 'post-pago': 'Post pago', 'produto-servico': 'Produto ou serviço em troca de conteúdo',
                              'evento-presencial': 'Evento presencial', 'longo-prazo': 'Parceria de longo prazo' } },
  midiakit:      { id: '6aaaca2ef1edc4c69802a9f2', label: 'Link do mídia kit ou portfólio',
                   type: 'text', max: 500 },
  email:         { id: '6aaaca2ef1edc4c69802a9f3', label: 'E-mail', type: 'email',
                   crmKey: 'email', required: true, max: 200 },
  whatsapp:      { id: '6aaaca2ef1edc4c69802a9f4', label: 'WhatsApp', type: 'text',
                   crmKey: 'phone', required: true, max: 40 },
  consentimento: { id: '6aaaca2ef1edc4c69802a9f5', type: 'select',
                   label: 'Autoriza a Hubber a usar os dados para avaliar a aplicação',
                   required: true, options: { sim: 'Autorizo' } },
};

const MAX_BODY = 5 * 1024 * 1024; // base64 de um PDF de 3 MB dá ~4 MB

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

  // Os dados de contato não vão no topo do card: o JSYNQ já os deduz pelo
  // crmKey que os campos têm no formulário. Mandar nos dois lugares fazia o
  // card repetir "Contact name", "Email" e "Phone" duas vezes cada.
  if (!missing.length && !invalid.length) {
    push(ORIGEM_FIELD, ORIGEM);
    const { campanha, criativo, clique } = origemDoLead(body);
    if (campanha) push(CAMPANHA_FIELD, campanha);
    if (criativo) push(CRIATIVO_FIELD, criativo);
    if (clique) push(CLIQUE_FIELD, clique);
  }

  /* O JSYNQ promove a coluna do CRM só o que tem crmKey no formulário: nome,
     e-mail e telefone. Todo o resto fica no detalhe do card, e quem abre a
     visão de contatos não vê. A descrição repete tudo em texto, que aparece
     em qualquer lugar onde o card apareça. */
  const desc = customFields
    .map((f) => `${f.fieldName}: ${Array.isArray(f.value) ? f.value.join(', ') : f.value}`)
    .join('\n');

  const card = {
    title: contato.contactName || 'Aplicação sem nome',
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

/* O Swagger declara o token no header Authorization sem dizer se leva "Bearer".
   Tenta a forma mais comum e, se o servidor recusar a credencial, tenta a outra. */
/* Se o CRM estiver fora do ar, a aplicação não pode sumir junto: o log guarda
   o suficiente para a equipe retomar o contato à mão. */
function resumo(body) {
  return `| ${body.nome || '?'} · ${body.perfil || '?'} · ${body.email || '?'}`
    + ` · ${body.whatsapp || '?'} · ${body.destino || '?'} ${body.data_ida || ''}`;
}

const espera = (ms) => new Promise((r) => setTimeout(r, ms));

async function criarCard(card, token) {
  const url = `${API_BASE}/api/projects/${PROJECT_ID}/cards`;
  const variants = /^bearer\s/i.test(token) ? [token] : [`Bearer ${token}`, token];

  let last;
  for (const authorization of variants) {
    // Falha de rede e 5xx costumam ser passageiras, e a API do JSYNQ já se
    // mostrou instável. Tentar de novo custa menos que perder o lead.
    let res = null;
    for (let tentativa = 0; tentativa < 3; tentativa++) {
      if (tentativa) await espera(tentativa * 600);
      try {
        res = await fetch(url, {
          method: 'POST',
          headers: { 'content-type': 'application/json', authorization },
          body: JSON.stringify(card),
        });
      } catch (err) {
        console.error('[connect-lead] tentativa', tentativa + 1, 'falhou:', err?.message);
        res = null;
        continue;
      }
      if (res.ok || res.status < 500) break;
      console.error('[connect-lead] tentativa', tentativa + 1, 'devolveu', res.status);
    }
    if (!res) { last = { status: 0, body: 'sem resposta do JSYNQ' }; break; }
    if (res.ok) {
      const dados = await res.json().catch(() => null);
      // A API já devolveu o card ora na raiz, ora sob "card". Aceita os dois.
      const id = dados?.card?._id || dados?._id || dados?.data?.card?._id || null;
      return { ok: true, cardId: id };
    }
    last = { status: res.status, body: await res.text().catch(() => '') };
    if (res.status !== 401 && res.status !== 403) break;
  }
  return { ok: false, ...last };
}

/* Sobe o PDF para o S3 do JSYNQ e amarra no card. São duas chamadas: a de
   upload devolve o id do anexo, a segunda faz a associação. */
async function anexarPdf(cardId, anexo, token) {
  const authorization = /^bearer\s/i.test(token) ? token : `Bearer ${token}`;
  const bytes = Buffer.from(anexo.dados, 'base64');

  const form = new FormData();
  // O boundary quem monta é o fetch; definir content-type na mão quebra.
  form.append('file', new Blob([bytes], { type: 'application/pdf' }), anexo.nome);
  form.append('type', 'CARD');

  const envio = await fetch(`${API_BASE}/api/projects/${PROJECT_ID}/attachments`, {
    method: 'POST', headers: { authorization }, body: form,
  });
  if (!envio.ok) {
    return { ok: false, etapa: 'upload', status: envio.status,
             body: (await envio.text().catch(() => '')).slice(0, 300) };
  }
  const criado = await envio.json().catch(() => null);
  // A API devolve o anexo sob "newAttachment"; os outros nomes ficam de reserva.
  const anexoId = criado?.newAttachment?._id || criado?.attachment?._id || criado?._id || criado?.data?._id;
  if (!anexoId) return { ok: false, etapa: 'upload', status: 200, body: 'resposta sem id de anexo' };

  const liga = await fetch(
    `${API_BASE}/api/projects/${PROJECT_ID}/cards/${cardId}/attachments/${anexoId}`,
    { method: 'POST', headers: { authorization } },
  );
  if (!liga.ok) {
    return { ok: false, etapa: 'associar', status: liga.status,
             body: (await liga.text().catch(() => '')).slice(0, 300) };
  }
  return { ok: true };
}

/* Aceita só PDF de verdade: confere a assinatura do arquivo, não a extensão
   nem o content-type, que qualquer cliente pode mentir. */
const ANEXO_MAX = 3 * 1024 * 1024;
function lerAnexo(bruto) {
  if (!bruto || typeof bruto !== 'object') return { anexo: null };
  const dados = typeof bruto.dados === 'string' ? bruto.dados : '';
  if (!dados) return { anexo: null };
  if (!/^[A-Za-z0-9+/=\s]+$/.test(dados)) return { erro: 'anexo_invalido' };

  let bytes;
  try { bytes = Buffer.from(dados, 'base64'); } catch { return { erro: 'anexo_invalido' }; }
  if (!bytes.length) return { erro: 'anexo_invalido' };
  if (bytes.length > ANEXO_MAX) return { erro: 'anexo_grande' };
  if (bytes.subarray(0, 5).toString('latin1') !== '%PDF-') return { erro: 'anexo_nao_pdf' };

  const nome = String(bruto.nome || 'midia-kit.pdf')
    .replace(/[\\/\r\n\t]/g, ' ')
    .trim()
    .slice(0, 120) || 'midia-kit.pdf';
  return { anexo: { nome: /\.pdf$/i.test(nome) ? nome : `${nome}.pdf`, dados } };
}

/* Uma entrega completa: monta o card, cria e anexa o PDF. Usada tanto pelo
   envio ao vivo quanto pelo reenvio da fila, para os dois caminhos não
   divergirem com o tempo. */
export async function entregarLead(dados, token) {
  const { card } = buildCard(dados);
  const { anexo } = lerAnexo(dados.anexo);

  const out = await criarCard(card, token);
  if (!out.ok) {
    console.error('[connect-lead] JSYNQ recusou:', out.status, out.body?.slice(0, 500), resumo(dados));
    return false;
  }

  // O lead já está salvo. Se o anexo falhar, não vale perder a aplicação
  // inteira: registra no log para a equipe pedir o PDF depois.
  if (anexo && out.cardId) {
    const anexado = await anexarPdf(out.cardId, anexo, token);
    if (!anexado.ok) {
      console.error('[connect-lead] anexo falhou em', anexado.etapa, anexado.status,
        anexado.body, '| card', out.cardId);
    }
  } else if (anexo) {
    console.error('[connect-lead] anexo recebido mas a API não devolveu id de card.');
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

  // Isca para robô: campo escondido preenchido. Responde 200 para o robô não
  // aprender nada com a diferença entre aceitar e recusar.
  if (body.website_extra) return res.status(200).json({ ok: true });

  const { missing, invalid } = buildCard(body);
  if (missing.length || invalid.length) {
    return res.status(422).json({ ok: false, error: 'validation', missing, invalid });
  }

  const { erro: erroAnexo } = lerAnexo(body.anexo);
  if (erroAnexo) return res.status(422).json({ ok: false, error: erroAnexo });

  const token = process.env.JSYNQ_API_TOKEN;
  if (!token) {
    console.error('[connect-lead] JSYNQ_API_TOKEN ausente: lead não foi gravado.', resumo(body));
    return res.status(503).json({ ok: false, error: 'not_configured' });
  }

  // Guardar vem antes de entregar. Se o JSYNQ estiver fora, o lead já está a
  // salvo e entra na fila em vez de sumir.
  const naFila = await guardar('connect', body);

  try {
    if (await entregarLead(body, token)) {
      await concluir(naFila);
      // O CRM respondeu, então é boa hora de empurrar o que ficou para trás.
      if (filaAtiva()) {
        const r = await drenar('connect', (d) => entregarLead(d, token), 2);
        if (r.entregues) console.log('[connect-lead] fila: reenviados', r.entregues);
      }
      return res.status(200).json({ ok: true });
    }
  } catch (err) {
    console.error('[connect-lead] falha ao falar com o JSYNQ:', err?.message, resumo(body));
  }

  // Aqui o CRM não aceitou. Se o lead está na fila, a aplicação foi recebida de
  // fato e será entregue depois: dizer que falhou faria a pessoa desistir ou
  // reenviar, criando card repetido.
  if (naFila) {
    console.error('[connect-lead] na fila para reenvio:', naFila, resumo(body));
    return res.status(200).json({ ok: true, pendente: true });
  }
  return res.status(502).json({ ok: false, error: 'upstream' });
}
