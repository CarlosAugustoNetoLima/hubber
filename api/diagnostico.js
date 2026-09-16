/**
 * Recebe o formulário de diagnóstico de /diagnostico/ e cria o card no CRM do
 * JSYNQ (projeto "Hubber Site · Diagnósticos").
 *
 * Mesmo desenho do api/connect-lead.js: o token vive só aqui, em variável de
 * ambiente, e o mapa de campos fica no servidor — a página não conhece os ids
 * internos do CRM. O responsável pelo card vem do leader do projeto, não de
 * quem gerou o token.
 *
 * Duas entradas, porque o formulário funciona sem JavaScript:
 *   application/json                    fetch de js/form.js, responde JSON
 *   application/x-www-form-urlencoded   POST nativo do <form>, responde HTML
 *
 * A rota (Build, Agência, Pocket, Nutrição) é sempre recalculada aqui a partir
 * das respostas. O que o navegador mandou em `rota` é ignorado: senão bastaria
 * editar o payload para aparecer no CRM como lead qualificado.
 *
 * Variáveis de ambiente (painel da Vercel, nunca no código):
 *   JSYNQ_API_TOKEN          token de API do JSYNQ, com escrita em projetos
 *   JSYNQ_DIAG_PROJECT_ID    projeto do CRM (opcional, padrão abaixo)
 *   JSYNQ_DIAG_FORM_ID       formulário com a definição dos campos (idem)
 *   JSYNQ_DIAG_BOARD_ID      quadro (idem)
 *   JSYNQ_DIAG_COLUMN_ID     coluna de entrada, "Leads" (idem)
 *   JSYNQ_DIAG_LABEL_ID      etiqueta que marca a origem do lead (idem)
 *
 * Este projeto recebe todo lead que o site gera, de qualquer landing page. Não
 * criar projeto separado por LP: a origem se distingue pela etiqueta e pelo
 * campo Origem, dentro do mesmo quadro.
 *
 * Nenhuma resposta se perde quando o CRM está fora: ela é gravada na fila antes
 * da tentativa e reenviada depois, pelo próximo envio do site ou pelo cron
 * diário. Ver _fila.js e drenar.js.
 */

import { computeRoute, ROUTE_LABEL, NOTE_LABEL } from '../js/route.js';
import { guardar, concluir, drenar, filaAtiva } from './_fila.js';

const API_BASE = 'https://api.jsynq.com';
const PROJECT_ID = process.env.JSYNQ_DIAG_PROJECT_ID || '6aaac5d2f1edc4c698019729';
const FORM_ID    = process.env.JSYNQ_DIAG_FORM_ID    || '6aaac60ff1edc4c69801a1a7';
const BOARD_ID   = process.env.JSYNQ_DIAG_BOARD_ID   || '6aaac5d2f1edc4c69801972d';
const COLUMN_ID  = process.env.JSYNQ_DIAG_COLUMN_ID  || '6aaac5d2f1edc4c698019735';
const LABEL_ID   = process.env.JSYNQ_DIAG_LABEL_ID   || '6aaaca4af1edc4c69802af3f';
const FORM_NAME  = 'Hubber Site · Diagnóstico de crescimento';

/* `id` é o campo no formulário do JSYNQ; `label` e `type` reproduzem como ele
   grava no card. `type` aqui usa o vocabulário do CRM (text, select, email...),
   que não tem "textarea": as respostas longas entram como text.
   grava no card. `type` usa o vocabulário do CRM (text, select, email, date),
   que não tem "textarea": as respostas longas entram como text.
   `crmKey` marca os que o CRM trata como dados de contato.
   `options` é lista fechada: valor fora dela é recusado, não repassado, e o
   rótulo é o que aparece no card no lugar do id. */
const FIELDS = {
  empresa:       { id: '6aaac60ff1edc4c69801a1a9', label: 'Empresa', type: 'text',
                   crmKey: 'company', required: true, max: 160 },
  faturamento:   { id: '6aaac60ff1edc4c69801a1aa', label: 'Faturamento mensal (USD)', type: 'select', required: true,
                   options: { '<50k': 'Abaixo de US$50 mil', '50-85k': 'US$50 a 85 mil',
                              '85-200k': 'US$85 a 200 mil', '200-500k': 'US$200 a 500 mil',
                              '500k+': 'Acima de US$500 mil' } },
  setor:         { id: '6aaac60ff1edc4c69801a1ab', label: 'Setor', type: 'text', required: true, max: 120 },
  mercado:       { id: '6aaac60ff1edc4c69801a1ac', label: 'Onde a empresa opera', type: 'select', required: true,
                   options: { eua: 'Estados Unidos', brasil: 'Brasil', ambos: 'Os dois' } },
  gargalo:       { id: '6aaac60ff1edc4c69801a1ad', label: 'Onde o crescimento trava', type: 'select', required: true,
                   options: { demanda: 'Demanda', vendas: 'Vendas', operacao: 'Operação',
                              time: 'Time', gestao: 'Gestão e dados' } },
  tentou:        { id: '6aaac60ff1edc4c69801a1ae', label: 'O que já tentou', type: 'text',
                   required: true, min: 20, max: 4000 },
  depende:       { id: '6aaac60ff1edc4c69801a1af', label: 'O que depende do fundador', type: 'text',
                   required: true, min: 10, max: 4000 },
  time:          { id: '6aaac60ff1edc4c69801a1b0', label: 'Quem faz o marketing hoje', type: 'select', required: true,
                   options: { agencia: 'Uma agência externa', freelancers: 'Freelancers',
                              'uma-pessoa': 'Uma pessoa interna', 'time-interno': 'Um time interno',
                              ninguem: 'Ninguém: o próprio fundador' } },
  estrutura:     { id: '6aaac60ff1edc4c69801a1b1', label: 'O que quer', type: 'select', required: true,
                   options: { 'time-interno': 'Um time de marketing dentro da empresa',
                              executar: 'Alguém que execute por ele',
                              base: 'Só a base digital funcionando', 'nao-sei': 'Não sei ainda' } },
  verba:         { id: '6aaac60ff1edc4c69801a1b2', label: 'Verba para os próximos 90 dias', type: 'select', required: true,
                   options: { definida: 'Sim, já definida', 'a-definir': 'Sim, a definir', nao: 'Ainda não' } },
  papel:         { id: '6aaac60ff1edc4c69801a1b3', label: 'Papel na decisão', type: 'select', required: true,
                   options: { sozinho: 'Decide sozinho', socios: 'Decide com sócios',
                              influencio: 'Influencia; outra pessoa decide' } },
  objetivo:      { id: '6aaac60ff1edc4c69801a1b4', label: 'O que precisa mudar em 12 meses', type: 'text',
                   required: true, min: 20, max: 4000 },
  porque:        { id: '6aaac60ff1edc4c69801a1b5', label: 'Por que agora', type: 'text', max: 4000 },
  nome:          { id: '6aaac60ff1edc4c69801a1b6', label: 'Nome', type: 'text',
                   crmKey: 'contactName', required: true, max: 120 },
  email:         { id: '6aaac60ff1edc4c69801a1b7', label: 'E-mail', type: 'email',
                   crmKey: 'email', required: true, max: 200 },
  telefone:      { id: '6aaac60ff1edc4c69801a1b8', label: 'Telefone', type: 'text',
                   crmKey: 'phone', required: true, max: 40 },
  site:          { id: '6aaac60ff1edc4c69801a1b9', label: 'Site da empresa', type: 'text', max: 500 },
  consentimento: { id: '6aaac60ff1edc4c69801a1ba', type: 'select',
                   label: 'Autoriza a Hubber a usar os dados para responder ao diagnóstico',
                   required: true, options: { sim: 'Autorizo' } },
};

/* Preenchidos aqui, não pelo navegador. */
const ROTA_FIELD   = { id: '6aaac60ff1edc4c69801a1bb', label: 'Rota sugerida', type: 'select' };
const NOTAS_FIELD  = { id: '6aaac60ff1edc4c69801a1bc', label: 'Ressalvas da rota', type: 'text' };
const IDIOMA_FIELD = { id: '6aaac60ff1edc4c69801a1bd', label: 'Idioma', type: 'text' };
const ORIGEM_FIELD = { id: '6aaac60ff1edc4c69801a1be', label: 'Origem', type: 'text' };

const MAX_BODY = 256 * 1024; // sem anexo: 15 campos de texto cabem de sobra

function isEmail(v) { return /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(v); }
function isPhone(v) { return /^[0-9+()\s-]{8,40}$/.test(v); }

/* Monta o card a partir do corpo do formulário, no mesmo formato que o JSYNQ
   grava quando a resposta vem pelo formulário hospedado. */
function buildCard(body, rota) {
  const customFields = [];
  const contato = {};
  const missing = [];
  const invalid = [];

  // O id é sempre o do campo do formulário, nunca o crmKey: o JSYNQ deduz os
  // campos de contato a partir do crmKey, e repetir o id sobrescreveria.
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
    const raw = typeof body[name] === 'string' ? body[name].trim()
              : body[name] == null ? '' : String(body[name]).trim();

    if (!raw) { if (spec.required) missing.push(name); continue; }
    if (spec.max && raw.length > spec.max) { invalid.push(name); continue; }
    if (spec.min && raw.length < spec.min) { invalid.push(name); continue; }
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
    push(ROTA_FIELD, ROUTE_LABEL[rota.route] || rota.route);
    if (rota.notes.length) {
      push(NOTAS_FIELD, rota.notes.map((n) => NOTE_LABEL[n] || n).join(' · '));
    }
    const idioma = String(body.idioma || '').trim().slice(0, 20);
    const origem = String(body.origem || '').trim().slice(0, 200);
    if (idioma) push(IDIOMA_FIELD, idioma);
    if (origem) push(ORIGEM_FIELD, origem);
  }

  // Empresa no título: o board é de empresas, não de pessoas. O nome de quem
  // respondeu entra pelos campos de contato, que o JSYNQ mostra no topo.
  const card = {
    title: contato.company || contato.contactName || 'Diagnóstico sem empresa',
    type: 'task',
    board: BOARD_ID,
    column: COLUMN_ID,
    labels: [LABEL_ID],
    customFields,
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

/* Corpo do POST nativo do <form>, que não passa por JSON. */
function parseUrlEncoded(raw) {
  const out = {};
  for (const [k, v] of new URLSearchParams(raw)) out[k] = v;
  return out;
}

/* A devolutiva da página sem JavaScript, nos dois idiomas. O formulário manda
   `idioma` em campo escondido, então o caminho sem JS também sabe responder. */
const PAGINA = {
  'pt-BR': {
    rotulo: 'Diagnóstico preliminar',
    erroTitulo: 'Recebemos, mas não conseguimos registrar agora.',
    erroTexto: 'Sua resposta chegou até nós, mas houve uma falha ao gravar. Escreva para o Nicolas e a gente retoma daqui, sem você preencher tudo de novo.',
    titulo: 'Diagnóstico enviado | Hubber',
    build: {
      titulo: 'O próximo passo é uma conversa com o Nicolas.',
      texto: 'Pelo que você respondeu, a empresa já fatura acima do piso, quer estrutura interna e tem quem decida. Esse é o perfil do Build.',
      href: '/build/', link: 'Rever o Build',
    },
    agencia: {
      titulo: 'Faz sentido falar de execução.',
      texto: 'Você quer alguém que execute agora, não um departamento interno. A conversa confirma o escopo e o que fica de cada lado.',
      href: '/agencia/', link: 'Conhecer a Agência',
    },
    pocket: {
      titulo: 'Comece pela base.',
      texto: 'O Pocket resolve o essencial: mídia paga, site, Perfil do Google e redes, coordenados para ser encontrado e converter.',
      href: '/pocket/', link: 'Conhecer o Pocket',
    },
    nutricao: {
      titulo: 'Ainda não é hora de contratar, e tudo bem.',
      texto: 'Você vai receber um material sobre como estruturar o marketing antes de escalar. Quando fizer sentido, a gente conversa, sem call forçada.',
      href: '/', link: 'Voltar para a Home',
    },
  },
  'en-US': {
    rotulo: 'Preliminary diagnostic',
    erroTitulo: 'We received it, but could not record it just now.',
    erroTexto: 'Your answers reached us, but saving them failed. Write to Nicolas and we pick it up from here, without you filling everything in again.',
    titulo: 'Diagnostic sent | Hubber',
    build: {
      titulo: 'The next step is a conversation with Nicolas.',
      texto: 'From what you answered, the company is already above the revenue floor, wants internal structure and has someone who decides. That is the Build profile.',
      href: '/en/build/', link: 'Review Build',
    },
    agencia: {
      titulo: 'It makes sense to talk about execution.',
      texto: 'You want someone executing now, not an internal department. The conversation confirms the scope and what sits on each side.',
      href: '/en/agency/', link: 'Explore Agency',
    },
    pocket: {
      titulo: 'Start with the foundation.',
      texto: 'Pocket covers the essentials: paid media, website, Google Business Profile and social, coordinated to be found and to convert.',
      href: '/en/pocket/', link: 'Explore Pocket',
    },
    nutricao: {
      titulo: 'It is not time to hire yet, and that is fine.',
      texto: 'You will receive material on how to structure marketing before scaling. When it makes sense, we talk, with no forced call.',
      href: '/en/', link: 'Back to the home page',
    },
  },
};

/* Resposta para quem enviou sem JavaScript. A página do site é estática e não
   consegue reagir a um redirect, então a devolutiva vem montada aqui. */
function paginaHtml(rota, recebido, ingles) {
  const t = PAGINA[ingles ? 'en-US' : 'pt-BR'];
  const p = t[rota] || t.nutricao;
  const titulo = recebido ? p.titulo : t.erroTitulo;
  const texto = recebido ? p.texto : t.erroTexto;
  return `<!doctype html>
<html lang="${ingles ? 'en-US' : 'pt-BR'}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${t.titulo}</title>
<link rel="icon" type="image/svg+xml" href="/assets/brand/favicon.svg">
<link rel="stylesheet" href="/css/fonts.css">
<link rel="stylesheet" href="/css/tokens.css">
<link rel="stylesheet" href="/css/base.css">
<link rel="stylesheet" href="/css/layout.css">
<link rel="stylesheet" href="/css/components.css">
</head>
<body data-surface="ink">
<main id="main">
  <section class="section" data-surface="ink">
    <div class="wrap">
      <p class="t-label t-accent">${t.rotulo}</p>
      <h1 class="t-h2">${titulo}</h1>
      <p class="t-lead t-muted">${texto}</p>
      <p><a class="btn btn--primary" href="${p.href}">${p.link}</a></p>
    </div>
  </section>
</main>
</body>
</html>`;
}

/* Uma entrega completa: recalcula a rota, monta o card e cria. Usada tanto pelo
   envio ao vivo quanto pelo reenvio da fila, para os dois caminhos não
   divergirem com o tempo. A rota é recalculada em vez de guardada porque é
   função pura das respostas: a fila só precisa do que a pessoa preencheu. */
export async function entregarDiagnostico(dados, token) {
  const rota = computeRoute(dados);
  const { card } = buildCard(dados, rota);
  const out = await criarCard(card, token);
  if (!out.ok) {
    // O corpo da resposta do JSYNQ fica só no log, nunca vai para o navegador.
    console.error('[diagnostico] JSYNQ recusou:', out.status, out.body?.slice(0, 500), resumo(dados, rota));
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

  const tipo = String(req.headers['content-type'] || '');
  const navegador = tipo.includes('application/x-www-form-urlencoded');

  let body = req.body;
  if (typeof body === 'string') {
    if (body.length > MAX_BODY) return res.status(413).json({ ok: false, error: 'too_large' });
    if (navegador) {
      body = parseUrlEncoded(body);
    } else {
      try { body = JSON.parse(body); }
      catch { return res.status(400).json({ ok: false, error: 'invalid_json' }); }
    }
  }
  if (!body || typeof body !== 'object') return res.status(400).json({ ok: false, error: 'invalid_json' });

  // Isca para robô: campo escondido preenchido. Responde como sucesso para o
  // robô não aprender nada com a diferença entre aceitar e recusar.
  // O idioma vem do campo escondido do formulário, que existe nas duas versões.
  const ingles = String(body.idioma || '').toLowerCase().startsWith('en');

  if (body.website_extra) {
    return responder(res, navegador, true, { route: 'nutricao', notes: [] }, 200, null, ingles);
  }

  const rota = computeRoute(body);
  const { missing, invalid } = buildCard(body, rota);
  if (missing.length || invalid.length) {
    if (navegador) {
      // Sem JS não há como marcar os campos na página: devolve para o formulário.
      res.setHeader('location', ingles ? '/en/diagnostic/' : '/diagnostico/');
      return res.status(303).end();
    }
    return res.status(422).json({ ok: false, error: 'validation', missing, invalid });
  }

  const token = process.env.JSYNQ_API_TOKEN;
  if (!token) {
    console.error('[diagnostico] JSYNQ_API_TOKEN ausente: diagnóstico não foi gravado.', resumo(body, rota));
    return responder(res, navegador, false, rota, 503, 'not_configured', ingles);
  }

  // Guardar vem antes de entregar. Se o JSYNQ estiver fora, a resposta já está
  // a salvo e entra na fila em vez de sumir.
  const naFila = await guardar('diagnostico', body);

  try {
    if (await entregarDiagnostico(body, token)) {
      await concluir(naFila);
      // O CRM respondeu, então é boa hora de empurrar o que ficou para trás.
      if (filaAtiva()) {
        const r = await drenar('diagnostico', (d) => entregarDiagnostico(d, token), 2);
        if (r.entregues) console.log('[diagnostico] fila: reenviados', r.entregues);
      }
      return responder(res, navegador, true, rota, 200, null, ingles);
    }
  } catch (err) {
    console.error('[diagnostico] falha ao falar com o JSYNQ:', err?.message, resumo(body, rota));
  }

  // Aqui o CRM não aceitou. Se a resposta está na fila, o diagnóstico foi
  // recebido de fato e será gravado depois: mostrar erro faria a pessoa
  // responder tudo de novo, e daria dois cards para a mesma empresa.
  if (naFila) {
    console.error('[diagnostico] na fila para reenvio:', naFila, resumo(body, rota));
    return responder(res, navegador, true, rota, 200, null, ingles, true);
  }
  return responder(res, navegador, false, rota, 502, 'upstream', ingles);
}

/* Se o CRM estiver fora do ar, o lead não pode sumir junto: o log guarda o
   suficiente para a equipe retomar o contato à mão. */
function resumo(body, rota) {
  return `| ${body.empresa || '?'} · ${body.nome || '?'} · ${body.email || '?'} · ${body.telefone || '?'} · rota ${rota.route}`;
}

function responder(res, navegador, gravou, rota, status, erro, ingles, pendente) {
  if (navegador) {
    res.setHeader('content-type', 'text/html; charset=utf-8');
    return res.status(gravou ? 200 : status).send(paginaHtml(rota.route, gravou, ingles));
  }
  // `pendente` é só para o log e para teste: a página mostra a rota igual, que
  // é o que a pessoa veio buscar.
  return gravou
    ? res.status(200).json({ ok: true, rota: rota.route, notas: rota.notes, ...(pendente && { pendente: true }) })
    : res.status(status).json({ ok: false, error: erro, rota: rota.route, notas: rota.notes });
}
