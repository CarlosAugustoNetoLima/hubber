/**
 * Fila de entrega para o JSYNQ.
 *
 * O CRM é o canal onde a equipe recebe, mas ele é um serviço de terceiro e sai
 * do ar. Para que nenhum lead se perca nessas horas, toda submissão é gravada
 * aqui ANTES de tentar o CRM. Só sai da fila quando o JSYNQ confirma.
 *
 * Os arquivos guardam nome, e-mail e telefone de pessoas, então o armazenamento
 * é privado: sem o token não há URL que abra.
 *
 * Enquanto não existir um Blob conectado ao projeto, tudo aqui vira no-op e as
 * funções seguem se comportando como antes. Publicar sem o armazenamento não
 * quebra nada, só não protege.
 *
 * Variável de ambiente: BLOB_READ_WRITE_TOKEN, criada pela Vercel ao conectar
 * um Blob store ao projeto.
 */

import { put, list, del, get } from '@vercel/blob';

const ATIVA = Boolean(process.env.BLOB_READ_WRITE_TOKEN);

export const filaAtiva = () => ATIVA;

function caminhoDe(tipo, id) {
  return `pendentes/${tipo}/${id}.json`;
}

/* Grava a submissão e devolve o caminho, para quem chamou poder concluir
   depois. Um erro aqui não pode derrubar o envio: é melhor seguir sem rede de
   proteção do que recusar o lead na cara da pessoa. */
export async function guardar(tipo, dados) {
  if (!ATIVA) return null;
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const caminho = caminhoDe(tipo, id);
  try {
    await put(caminho, JSON.stringify({ tipo, id, criadoEm: new Date().toISOString(), dados }), {
      access: 'private',
      contentType: 'application/json',
      addRandomSuffix: false,
    });
    return caminho;
  } catch (err) {
    console.error('[fila] não consegui guardar:', err?.message);
    return null;
  }
}

/* Some com o item depois que o JSYNQ confirmou. Se esta remoção falhar, o item
   fica pendente e será entregue de novo mais tarde: gera um card repetido, que
   é bem menos grave que perder o lead. */
export async function concluir(caminho) {
  if (!ATIVA || !caminho) return;
  try {
    await del(caminho);
  } catch (err) {
    console.error('[fila] entregue mas não consegui remover da fila:', caminho, err?.message);
  }
}

/**
 * Tenta entregar o que ficou para trás.
 *
 * `entregar` recebe os dados originais e devolve true quando o JSYNQ aceitou.
 * O limite existe porque isto roda junto de um envio real: drenar demais faria
 * a pessoa esperar. O cron chama com um limite maior, sem ninguém esperando.
 */
export async function drenar(tipo, entregar, limite = 3) {
  if (!ATIVA) return { pendentes: 0, entregues: 0 };
  let blobs = [];
  try {
    ({ blobs } = await list({ prefix: `pendentes/${tipo}/`, limit: limite }));
  } catch (err) {
    console.error('[fila] não consegui listar:', err?.message);
    return { pendentes: 0, entregues: 0 };
  }

  let entregues = 0;
  for (const b of blobs) {
    try {
      const r = await get(b.pathname, { access: 'private' });
      if (r?.statusCode !== 200) continue;
      const item = JSON.parse(await new Response(r.stream).text());
      if (await entregar(item.dados)) {
        await concluir(b.pathname);
        entregues += 1;
      }
    } catch (err) {
      console.error('[fila] falha ao reenviar', b.pathname, err?.message);
    }
  }
  return { pendentes: blobs.length, entregues };
}

/* Quantos leads estão presos. Serve para o cron avisar no log quando a fila
   para de andar, que é o sintoma de um problema que ninguém viu ainda. */
export async function contarPendentes(tipo) {
  if (!ATIVA) return 0;
  try {
    const { blobs } = await list({ prefix: `pendentes/${tipo}/`, limit: 1000 });
    return blobs.length;
  } catch {
    return 0;
  }
}
