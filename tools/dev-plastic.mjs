// Prévia LOCAL da LP /plastic/ com o handler real do formulário e CRM/fila
// SIMULADOS: nenhuma chamada ao JSYNQ, à Meta ou à Vercel. Só para revisão.
//
//   node tools/dev-plastic.mjs            → http://127.0.0.1:4329/plastic/
//   MOCK=pending node tools/dev-plastic.mjs   simula CRM fora (fica na fila)
//   MOCK=error   node tools/dev-plastic.mjs   simula falha sem fila
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClinicLeadHandler, buildClinicCard } from '../api/clinic-lead.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 4329);
const MOCK = process.env.MOCK || 'delivered';
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml',
  '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.mp4': 'video/mp4', '.vtt': 'text/vtt', '.woff2': 'font/woff2', '.json': 'application/json' };

const handler = createClinicLeadHandler({
  getToken: () => 'local-mock',
  getQueue: async () => ({
    guardar: async () => (MOCK === 'error' ? null : 'local/mock.json'),
    concluir: async () => {}, filaAtiva: () => false, drenar: async () => ({ entregues: 0 }),
  }),
  deliver: async (dados) => {
    console.log('\n[MOCK CRM] card que seria criado:\n' + JSON.stringify(buildClinicCard(dados), null, 2));
    return MOCK === 'delivered';
  },
});

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname === '/api/clinic-lead') {
    let body = '';
    for await (const chunk of req) body += chunk;
    req.body = body;
    const out = {
      status(n) { res.statusCode = n; return out; },
      setHeader(k, v) { res.setHeader(k, v); },
      json(b) { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(b)); },
      send(b) { res.end(b); }, end() { res.end(); },
    };
    return handler(req, out);
  }
  let file = path.join(ROOT, decodeURIComponent(url.pathname));
  if (!file.startsWith(ROOT)) { res.statusCode = 403; return res.end(); }
  try {
    if ((await stat(file)).isDirectory()) file = path.join(file, 'index.html');
    const data = await readFile(file);
    res.setHeader('content-type', TYPES[path.extname(file)] || 'application/octet-stream');
    res.end(data);
  } catch { res.statusCode = 404; res.end('not found'); }
}).listen(PORT, '127.0.0.1', () => console.log(`Prévia local (CRM simulado: ${MOCK}) → http://127.0.0.1:${PORT}/plastic/`));
