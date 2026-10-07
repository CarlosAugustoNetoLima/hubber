import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

// Offline: o JSYNQ é simulado e a fila fica desligada (sem BLOB_READ_WRITE_TOKEN).
process.env.JSYNQ_API_TOKEN = 'offline-test-only';
delete process.env.BLOB_READ_WRITE_TOKEN;
// Pior caso: as variáveis que um dia trocaram o destino apontam para o projeto de
// leads. O briefing precisa continuar no Hubber · Briefings (regra do Carlos).
Object.assign(process.env, {
  JSYNQ_BRIEFING_PROJECT_ID: '6aaac5d2f1edc4c698019729', JSYNQ_BRIEFING_BOARD_ID: 'quadro-errado',
  JSYNQ_BRIEFING_COLUMN_ID: 'coluna-errada', JSYNQ_BRIEFING_LABEL_MARCA: 'etiqueta-errada',
});
const chamadas = [];
globalThis.fetch = async (url, init) => {
  chamadas.push({ url: String(url), body: init && init.body ? JSON.parse(init.body) : null });
  return new Response('{}', { status: 200 });
};

const { BRIEFINGS, CONSENTIMENTO, todosCampos, visivel, validar, diaMesValido } = await import('../js/briefing-perguntas.js');
const { EN, UI, SLUG_EN, traduzir } = await import('../js/briefing-idiomas.js');
const { default: handler, montarCard, montarDescricao, PROJECT_ID } = await import('../api/briefing.js');

const LABEL_INGLES = '6ac663ea156b5d9ab291bda1';
const TRAVESSAO = '—';

// Todo texto que a pessoa lê, vindo do módulo de perguntas.
function textosVisiveis() {
  const textos = new Set([CONSENTIMENTO]);
  for (const b of Object.values(BRIEFINGS)) {
    [b.titulo, b.resumo, b.duracao, b.intro].forEach((t) => textos.add(t));
    for (const p of b.passos) {
      textos.add(p.titulo); textos.add(p.porque);
      for (const c of p.campos) [c.label, c.hint, c.ph, c.grupo, ...(c.opts || [])].forEach((t) => t && textos.add(t));
    }
  }
  return [...textos];
}

// Respostas completas e válidas de um briefing, para os envios simulados.
function respostas(tipo) {
  const a = {};
  for (const c of todosCampos(BRIEFINGS[tipo])) {
    if (!visivel(c, a)) continue;
    a[c.k] = c.t === 'email' ? 'jane@example.com' : c.t === 'tel' ? '+1 407 555 0100' : c.t === 'date' ? '2020-05-10'
      : c.t === 'diames' ? '14/03' : c.t === 'single' ? c.opts[0] : c.t === 'multi' ? [c.opts[0]] : `answer ${c.k}`;
  }
  return a;
}

function resposta() {
  return { code: 0, body: null, status(n) { this.code = n; return this; }, json(b) { this.body = b; return this; },
    setHeader() {}, end() { return this; } };
}

test('todo texto das perguntas tem tradução para o inglês', () => {
  const faltam = textosVisiveis().filter((t) => !Object.prototype.hasOwnProperty.call(EN, t));
  assert.deepEqual(faltam, []);
});

test('nenhuma tradução sobra sem pergunta correspondente', () => {
  const usados = new Set(textosVisiveis());
  assert.deepEqual(Object.keys(EN).filter((k) => !usados.has(k)), []);
});

test('nenhum texto em inglês tem travessão nem fica vazio', () => {
  for (const [pt, en] of Object.entries(EN)) {
    assert.ok(en.trim(), `tradução vazia: ${pt}`);
    assert.ok(!en.includes(TRAVESSAO), `travessão em: ${en}`);
  }
});

test('os textos da página têm as mesmas chaves nos dois idiomas e nenhum travessão', () => {
  assert.deepEqual(Object.keys(UI.en).sort(), Object.keys(UI.pt).sort());
  for (const idioma of ['pt', 'en']) {
    for (const [chave, v] of Object.entries(UI[idioma])) {
      const amostra = typeof v === 'function' ? v(...(chave === 'ofertaTitulo' ? [['brand brief']] : chave === 'chegou' ? ['Acme', 'Brand brief'] : [3, 'about 15 minutes', 24])) : v;
      assert.ok(!JSON.stringify(amostra).includes(TRAVESSAO), `${idioma}.${chave}`);
    }
  }
});

test('traduzir mantém o português e cai no original quando falta tradução', () => {
  assert.equal(traduzir('Nome da empresa', 'pt'), 'Nome da empresa');
  assert.equal(traduzir('Nome da empresa', 'en'), 'Company name');
  assert.equal(traduzir('texto sem tradução', 'en'), 'texto sem tradução');
});

test('aniversário: inglês lê mês/dia e sai sempre como dia/mês', () => {
  assert.equal(diaMesValido('14/03'), '14/03');
  assert.equal(diaMesValido('03/14', 'en'), '14/03');
  assert.equal(diaMesValido('14/03', 'en'), null);
  assert.equal(diaMesValido('31/02'), null);
  const a = { ...respostas('onboarding'), nascimento: '03/14' };
  assert.equal(validar('onboarding', a, 'en').limpo.nascimento, '14/03');
  assert.ok(validar('onboarding', a).invalidos.includes('nascimento'), 'em português, 03/14 seria dia 3 do mês 14');
});

test('card em português continua igual: uma etiqueta, sem aviso de idioma', () => {
  const card = montarCard('marca', respostas('marca'), '2026-10-07T12:00:00Z');
  assert.deepEqual(card.labels, ['6abf3cf157b946818a0cee9c']);
  assert.ok(!card.title.includes('inglês'));
  assert.ok(!card.desc.includes('respondido em inglês'));
  assert.equal(card.customFields.find((f) => f.fieldName === 'Origem').value, 'Briefing · Marca');
});

test('card em inglês: etiqueta do tipo mais a de idioma, aviso no título, na descrição e na origem', () => {
  for (const tipo of Object.keys(BRIEFINGS)) {
    const card = montarCard(tipo, respostas(tipo), '2026-10-07T12:00:00Z', 'en');
    assert.equal(card.labels.length, 2, tipo);
    assert.equal(card.labels[1], LABEL_INGLES, tipo);
    assert.ok(card.title.endsWith(' (inglês)'), tipo);
    assert.match(card.desc, /respondido em inglês · recebido em .* por briefing\.hubbermarketing\.com\/en/);
    assert.ok(card.customFields.find((f) => f.fieldName === 'Origem').value.endsWith(' · Inglês'), tipo);
  }
});

test('o card em inglês traz perguntas e opções em português para a equipe', () => {
  const desc = montarDescricao('site', respostas('site'), '2026-10-07T12:00:00Z', 'en');
  assert.ok(desc.includes('É um site novo ou a reformulação de um site existente?'));
  assert.ok(desc.includes('"Site novo"'));
  assert.ok(desc.includes('Landing page (uma página, focada em uma ação)'), 'tipo de site, no resumo');
});

test('envio em inglês pelo servidor vai para o Hubber · Briefings com as duas etiquetas', async () => {
  for (const tipo of Object.keys(BRIEFINGS)) {
    chamadas.length = 0;
    const res = resposta();
    await handler({ method: 'POST', body: { tipo, idioma: 'en', respostas: respostas(tipo), consentimento: true } }, res);
    assert.equal(res.code, 200, tipo);
    assert.equal(chamadas.length, 1);
    assert.equal(chamadas[0].url, `https://api.jsynq.com/api/projects/${PROJECT_ID}/cards`);
    assert.equal(chamadas[0].body.labels[1], LABEL_INGLES);
  }
});

test('idioma desconhecido vira português', async () => {
  chamadas.length = 0;
  const res = resposta();
  await handler({ method: 'POST', body: { tipo: 'marca', idioma: 'fr', respostas: respostas('marca'), consentimento: true } }, res);
  assert.equal(res.code, 200);
  assert.deepEqual(chamadas[0].body.labels, ['6abf3cf157b946818a0cee9c']);
});

test('cada briefing tem página em inglês publicada e rota no subdomínio', () => {
  const middleware = readFileSync(new URL('../middleware.js', import.meta.url), 'utf8');
  for (const tipo of Object.keys(BRIEFINGS)) {
    const slug = SLUG_EN[tipo];
    assert.ok(slug, tipo);
    const pagina = new URL(`../briefing/en/${slug}/index.html`, import.meta.url);
    assert.ok(existsSync(pagina), `rode python3 build.py: falta briefing/en/${slug}/`);
    const html = readFileSync(pagina, 'utf8');
    assert.ok(html.includes(`data-tipo="${tipo}" data-idioma="en"`), slug);
    assert.ok(html.includes('<html lang="en"'), slug);
    assert.ok(middleware.includes(`'/en/${slug}/': '/briefing/en/${slug}/index.html'`), slug);
    assert.ok(middleware.includes(`'/en/${slug}/',`), `matcher: ${slug}`);
  }
});

test('destino fixo: os 4 briefings, envio normal e reenvio da fila, só no Hubber · Briefings', async () => {
  const { entregarBriefing } = await import('../api/briefing.js');
  const etiquetas = { marca: '6abf3cf157b946818a0cee9c', site: '6abf3cf457b946818a0cef38', onboarding: '6ac014cf911fcfbe1c393f45', designer: '6ac014d2911fcfbe1c393fd0' };
  assert.equal(PROJECT_ID, '6abf3ce857b946818a0ced8c');
  for (const tipo of Object.keys(BRIEFINGS)) {
    for (const idioma of ['pt', 'en']) {
      chamadas.length = 0;
      const res = resposta();
      await handler({ method: 'POST', body: { tipo, idioma, respostas: respostas(tipo), consentimento: true } }, res);
      await entregarBriefing({ tipo, idioma, respostas: respostas(tipo), recebidoEm: new Date().toISOString() }, 'tok');
      assert.equal(chamadas.length, 2, `${tipo} ${idioma}`);
      for (const c of chamadas) {
        assert.equal(c.url, 'https://api.jsynq.com/api/projects/6abf3ce857b946818a0ced8c/cards');
        assert.equal(c.body.board, '6abf3ce857b946818a0ced90');
        assert.equal(c.body.column, '6abf3ce857b946818a0ced98');
        assert.equal(c.body.labels[0], etiquetas[tipo]);
        assert.deepEqual(c.body.assignedUsers, ['6a862692b045e567c7c8d55b']);
      }
    }
  }
});

test('website: landing page dispensa a quantidade de páginas; institucional exige', () => {
  const lp = respostas('site');   // primeira opção do tipo de site é a landing page
  assert.ok(lp.tipoprojeto.startsWith('Landing'));
  let r = validar('site', { ...lp, qtdpaginas: 'Mais de 20 páginas' });
  assert.ok(!('qtdpaginas' in r.limpo), 'campo escondido não é enviado');
  const inst = { ...lp, tipoprojeto: 'Site institucional completo (várias páginas e subpáginas)' };
  delete inst.qtdpaginas;
  assert.ok(validar('site', inst).faltam.includes('qtdpaginas'));
  inst.qtdpaginas = 'De 11 a 20 páginas';
  r = validar('site', inst);
  assert.deepEqual([r.faltam, r.invalidos], [[], []]);
});

test('barreiras: sem consentimento, tipo inexistente, isca de robô e GET não viram card', async () => {
  chamadas.length = 0;
  const casos = [
    [{ method: 'GET' }, 405],
    [{ method: 'POST', body: { tipo: 'proposta', respostas: respostas('marca'), consentimento: true } }, 422],
    [{ method: 'POST', body: { tipo: 'marca', respostas: respostas('marca'), consentimento: false } }, 422],
    [{ method: 'POST', body: { tipo: 'marca', respostas: { empresa: 'x' }, consentimento: true } }, 422],
    [{ method: 'POST', body: { tipo: 'marca', respostas: respostas('marca'), consentimento: true, website_extra: 'spam' } }, 200],
  ];
  for (const [req, esperado] of casos) {
    const res = resposta();
    await handler(req, res);
    assert.equal(res.code, esperado, JSON.stringify(req.body || req.method));
  }
  assert.equal(chamadas.length, 0);
});

test('subdomínio: endereço sem a barra final ganha a barra; com ela, abre a página', async () => {
  const { default: middleware } = await import('../middleware.js');
  const pedir = (host, caminho) => middleware({ url: `https://${host}${caminho}`, headers: { get: (k) => (k === 'host' ? host : null) } });
  const B = 'briefing.hubbermarketing.com';
  for (const caminho of ['/en', '/en/brand', '/en/website', '/en/onboarding', '/en/designer', '/marca', '/site']) {
    const r = pedir(B, caminho);
    assert.equal(r.status, 308, caminho);
    assert.equal(r.headers.get('location'), `https://${B}${caminho}/`, caminho);
  }
  const ok = pedir(B, '/en/brand/');
  assert.ok(ok.headers.get('x-middleware-rewrite').endsWith('/briefing/en/brand/index.html'));
  assert.ok(pedir(B, '/robots.txt').headers.get('x-middleware-rewrite').endsWith('/briefing/robots.txt'), 'arquivo não ganha barra');
  assert.equal(pedir('hubbermarketing.com', '/en/'), undefined, 'o /en/ do site principal segue o dele');
  assert.equal(pedir('hubbermarketing.com', '/briefing/en/brand').headers.get('location'), `https://${B}/en/brand`);
});

test('páginas de briefing não são traduzidas pelo navegador e a lista em inglês não se chama só "Briefs"', () => {
  const paginas = ['', 'marca/', 'site/', 'onboarding/', 'designer/', 'en/', 'en/brand/', 'en/website/', 'en/onboarding/', 'en/designer/'];
  for (const p of paginas) {
    const html = readFileSync(new URL(`../briefing/${p}index.html`, import.meta.url), 'utf8');
    assert.match(html, /<html lang="(pt-BR|en)" translate="no">/, p || 'raiz');
    assert.ok(html.includes('<meta name="google" content="notranslate">'), p || 'raiz');
  }
  const lista = readFileSync(new URL('../briefing/en/index.html', import.meta.url), 'utf8');
  assert.ok(!/<title>Briefs\b/.test(lista) && !/>Briefs</.test(lista), 'em inglês, "Briefs" sozinho também lê como cueca');
});
