import test from 'node:test';
import assert from 'node:assert/strict';
import { createClinicLeadHandler, buildClinicCard, validateClinicLead } from '../api/clinic-lead.js';
import { CRM } from '../api/diagnostico.js';
import { campaignFromUrl } from '../js/campaign-context.js';

// Offline: CRM e fila simulados, nenhuma chamada de rede.
function setup({ delivered = true, queued = true, token = 'offline-test-only', throws = false } = {}) {
  const calls = { guardar: [], concluir: [], deliver: [] };
  const queue = {
    guardar: async (tipo, dados) => { calls.guardar.push([tipo, dados]); return queued ? 'pendentes/clinica/x.json' : null; },
    concluir: async (c) => { calls.concluir.push(c); },
    filaAtiva: () => false,
    drenar: async () => ({ entregues: 0 }),
  };
  const handler = createClinicLeadHandler({
    getQueue: async () => queue,
    getToken: () => token,
    deliver: async (d) => { calls.deliver.push(d); if (throws) throw new Error('down'); return delivered; },
    eventId: () => 'clinic_3f2b8c1e-1a2b-4c3d-8e9f-0a1b2c3d4e5f',
  });
  return { handler, calls };
}
function response() {
  return { code: 0, body: null, headers: {}, status(n) { this.code = n; return this; },
    json(b) { this.body = b; return this; }, send(b) { this.body = b; return this; },
    setHeader(k, v) { this.headers[k.toLowerCase()] = v; }, end() { return this; } };
}
const valid = (extra = {}) => ({
  nome: 'Jane Doe', email: 'jane@clinic.com', telefone: '+1 (305) 555-0100',
  clinica: 'Example Aesthetic Surgery', site: 'example.com', local: 'Miami, FL',
  funcao: 'practice-manager', objetivo: 'consultations', consentimento: 'sim',
  idioma: 'en-US', utm_source: 'meta', utm_campaign: 'hubber_agency_us_surgeons', landing_path: '/plastic/',
  ...extra,
});
const req = (body, type = 'application/json') => ({ method: 'POST', headers: { 'content-type': type }, body });

test('Delivered lead returns eventId and product=agency; queue entry is concluded', async () => {
  const { handler, calls } = setup(); const res = response();
  await handler(req(valid()), res);
  assert.equal(res.code, 200);
  assert.deepEqual(res.body, { ok: true, delivery: 'delivered', eventId: 'clinic_3f2b8c1e-1a2b-4c3d-8e9f-0a1b2c3d4e5f', product: 'agency' });
  assert.equal(calls.guardar[0][0], 'clinica');
  assert.equal(calls.concluir.length, 1);
});

test('Queued but undelivered lead is pending, never carries an eventId', async () => {
  const { handler } = setup({ delivered: false }); const res = response();
  await handler(req(valid()), res);
  assert.equal(res.code, 200);
  assert.equal(res.body.delivery, 'pending');
  assert.equal(res.body.eventId, undefined);
});

test('Upstream failure without queue is an error, not success', async () => {
  const { handler } = setup({ delivered: false, queued: false }); const res = response();
  await handler(req(valid()), res);
  assert.equal(res.code, 502);
  assert.equal(res.body.ok, false);
});

test('Thrown CRM error with queue stays pending', async () => {
  const { handler } = setup({ throws: true }); const res = response();
  await handler(req(valid()), res);
  assert.equal(res.body.delivery, 'pending');
});

test('Missing token fails closed before touching the queue', async () => {
  const { handler, calls } = setup({ token: '' }); const res = response();
  await handler(req(valid()), res);
  assert.equal(res.code, 503);
  assert.equal(calls.guardar.length, 0);
});

test('Honeypot is ignored: no CRM, no queue, no eventId', async () => {
  const { handler, calls } = setup(); const res = response();
  await handler(req(valid({ website_extra: 'x' })), res);
  assert.deepEqual(res.body, { ok: true, delivery: 'ignored' });
  assert.equal(calls.deliver.length, 0);
  assert.equal(calls.guardar.length, 0);
});

test('Validation: required fields, closed lists, email, consent', () => {
  const r = validateClinicLead({ nome: '', email: 'not-an-email', funcao: 'ceo', objetivo: 'consultations', idioma: 'en' });
  assert.ok(r.missing.includes('nome'));
  assert.ok(r.missing.includes('clinica'));
  assert.ok(r.missing.includes('local'));
  assert.ok(r.missing.includes('consentimento'));
  assert.ok(r.invalid.includes('email'));
  assert.ok(r.invalid.includes('funcao'));
});

test('Phone is optional but must look like a phone when present', () => {
  assert.equal(validateClinicLead(valid({ telefone: '' })).invalid.length, 0);
  assert.ok(validateClinicLead(valid({ telefone: 'call me' })).invalid.includes('telefone'));
});

test('Only allowlisted fields enter the queue; unknown/patient fields are dropped', async () => {
  const { handler, calls } = setup(); const res = response();
  await handler(req(valid({ paciente: 'Maria, rinoplastia', notes: 'x' })), res);
  const saved = calls.guardar[0][1];
  assert.equal(saved.paciente, undefined);
  assert.equal(saved.notes, undefined);
  assert.equal(saved.product, 'agency');
  assert.equal(saved.origem, '/plastic/');
});

test('Product is fixed to agency server-side, even if the browser says core', () => {
  const r = validateClinicLead(valid({ product: 'core' }));
  assert.equal(r.data.product, 'agency');
});

test('Invalid campaign values are rejected (no free text from URL into the CRM)', async () => {
  const { handler, calls } = setup(); const res = response();
  await handler(req(valid({ utm_campaign: 'jane@clinic.com' })), res);
  assert.equal(res.code, 422);
  assert.ok(res.body.invalid.includes('utm_campaign'));
  assert.equal(calls.deliver.length, 0);
});

test('Portuguese submission records PT origin', () => {
  const r = validateClinicLead(valid({ idioma: 'pt-BR', landing_path: '/plastic/pt/' }));
  assert.equal(r.data.origem, '/plastic/pt/');
  assert.equal(r.data.idioma, 'pt-BR');
});

test('Card goes to the shared diagnostic board with the Agency label and the Nicolas assignee', () => {
  const { data } = validateClinicLead(valid({ detalhe: 'Two surgeons, one location.' }));
  const card = buildClinicCard(data);
  assert.equal(card.board, CRM.BOARD_ID);
  assert.equal(card.column, CRM.COLUMN_ID);
  assert.deepEqual(card.labels, [CRM.LABEL_POR_ROTA.agencia]);
  assert.deepEqual(card.assignedUsers, [CRM.RESPONSAVEL]);
  assert.equal(card.title, 'Example Aesthetic Surgery');
  assert.match(card.desc, /Reunião NÃO agendada/);
  assert.match(card.desc, /Cidade\/estado: Miami, FL/);
  assert.match(card.desc, /Campaign context/);
  const origem = card.customFields.find((f) => f.fieldName === 'Origem');
  assert.equal(origem.value, '/plastic/');
  // Nenhum campo de faturamento: a LP não aplica o piso do Build.
  assert.equal(card.customFields.some((f) => /Faturamento/.test(f.fieldName)), false);
});

test('No-JS POST receives an HTML confirmation that never claims a meeting was booked', async () => {
  const { handler } = setup(); const res = response();
  const body = new URLSearchParams(valid()).toString();
  await handler(req(body, 'application/x-www-form-urlencoded'), res);
  assert.equal(res.code, 200);
  assert.match(res.body, /No meeting has been scheduled yet/);
});

test('/plastic/ resolves to the Agency product for campaign context', () => {
  const c = campaignFromUrl('https://hubbermarketing.com/plastic/?utm_source=meta&utm_campaign=hubber_agency_us_surgeons');
  assert.equal(c.product, 'agency');
  assert.equal(c.landing_path, '/plastic/');
  const pt = campaignFromUrl('https://hubbermarketing.com/plastic/pt/?product=core&offer=core-ads-997');
  assert.equal(pt.product, 'agency');
  assert.equal(pt.offer, undefined);
});
