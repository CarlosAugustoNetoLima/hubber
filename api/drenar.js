/**
 * Reenvia para o JSYNQ o que ficou pendente na fila.
 *
 * Existem dois caminhos de reenvio, de propósito. Cada submissão nova já drena
 * dois itens, o que resolve sozinho enquanto houver movimento no site. Este
 * aqui é o que cobre o caso sem movimento: o cron chama uma vez por dia.
 *
 * Variáveis de ambiente:
 *   CRON_SECRET       obrigatório. Sem ele a rota recusa, para não ficar um
 *                     endpoint aberto disparando trabalho a pedido de qualquer um.
 *   JSYNQ_API_TOKEN   o mesmo usado pelos formulários.
 */

import { drenar, contarPendentes, filaAtiva } from './_fila.js';
import { entregarLead } from './connect-lead.js';

export default async function handler(req, res) {
  const segredo = process.env.CRON_SECRET;
  if (!segredo) {
    console.error('[drenar] CRON_SECRET ausente: rota desligada.');
    return res.status(503).json({ ok: false, error: 'not_configured' });
  }
  if (req.headers.authorization !== `Bearer ${segredo}`) {
    return res.status(401).json({ ok: false, error: 'unauthorized' });
  }

  if (!filaAtiva()) return res.status(200).json({ ok: true, fila: 'inativa' });

  const token = process.env.JSYNQ_API_TOKEN;
  if (!token) return res.status(503).json({ ok: false, error: 'not_configured' });

  const r = await drenar('connect', (d) => entregarLead(d, token), 50);
  const restantes = await contarPendentes('connect');

  // Fila que não anda é sintoma de problema que ninguém viu ainda.
  if (restantes) console.error('[drenar] ainda pendentes:', restantes);
  console.log('[drenar]', JSON.stringify({ ...r, restantes }));

  return res.status(200).json({ ok: true, ...r, restantes });
}
