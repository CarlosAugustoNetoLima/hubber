/**
 * Horários livres do Nicolas para a chamada de qualificação da LP de reels.
 *
 * O formulário da LP precisa saber quando ele pode falar, mas o token do JSYNQ
 * não pode chegar ao navegador. Esta rota lê a agenda dele no servidor e
 * devolve só a lista de horários já filtrada. Quem consulta não descobre nada
 * da agenda além do que está livre.
 *
 * Tudo no fuso de Orlando, sempre. O JSYNQ guarda e devolve em UTC, sem campo
 * de fuso nenhum, e quem preenche o formulário pode estar no Brasil. Se a conta
 * saísse no relógio de quem visita, alguém às 21h em São Paulo veria liberado um
 * horário que em Orlando ainda é hoje. A resposta carrega o rótulo do fuso para
 * a página mostrar junto do horário, que é o que evita o cliente entrar na
 * chamada com uma hora de diferença.
 *
 * Variáveis de ambiente:
 *   JSYNQ_API_TOKEN      o mesmo token dos formulários
 *   JSYNQ_RESPONSAVEL_ID quem atende a chamada (opcional, padrão abaixo)
 */

const API_BASE = 'https://api.jsynq.com';
const RESPONSAVEL = process.env.JSYNQ_RESPONSAVEL_ID || '6ab13770effd9919b7232453';

const FUSO = 'America/New_York';
const ABRE = 9;
const FECHA = 17;
const DURACAO = 30;
const HORIZONTE = 21;

function partesEm(instante) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: FUSO, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const p = {};
  for (const { type, value } of fmt.formatToParts(instante)) p[type] = value;
  // Meia-noite sai como "24" nesse formato, e 24 quebra a aritmética adiante.
  if (p.hour === '24') p.hour = '00';
  return {
    ano: +p.year, mes: +p.month, dia: +p.day,
    hora: +p.hour, minuto: +p.minute, segundo: +p.second,
  };
}

/* Quanto Orlando está deslocada do UTC naquele instante, em minutos. Muda duas
   vezes por ano, e é por isso que não dá para fixar -4 nem -5. */
function deslocamento(instante) {
  const p = partesEm(instante);
  const comoSeFosseUtc = Date.UTC(p.ano, p.mes - 1, p.dia, p.hora, p.minuto, p.segundo);
  return (comoSeFosseUtc - instante.getTime()) / 60000;
}

/* O instante UTC de uma hora de relógio de parede em Orlando. Duas passadas
   porque o deslocamento depende do próprio instante: a primeira estimativa cai
   do lado errado da virada do horário de verão, a segunda corrige. */
function instanteDe(ano, mes, dia, hora, minuto) {
  const parede = Date.UTC(ano, mes - 1, dia, hora, minuto);
  let t = parede;
  for (let i = 0; i < 2; i++) t = parede - deslocamento(new Date(t)) * 60000;
  return new Date(t);
}

/* EDT ou EST, conforme a data. Vai junto na resposta para a página escrever o
   horário com o fuso ao lado, em vez de um número solto. */
function siglaDoFuso(instante) {
  const fmt = new Intl.DateTimeFormat('en-US', { timeZone: FUSO, timeZoneName: 'short' });
  const parte = fmt.formatToParts(instante).find((p) => p.type === 'timeZoneName');
  return parte ? parte.value : 'ET';
}

function somaDias(ano, mes, dia, n) {
  const d = new Date(Date.UTC(ano, mes - 1, dia + n));
  return { ano: d.getUTCFullYear(), mes: d.getUTCMonth() + 1, dia: d.getUTCDate() };
}

function diaDaSemana(ano, mes, dia) {
  return new Date(Date.UTC(ano, mes - 1, dia)).getUTCDay();
}

const doisDigitos = (n) => String(n).padStart(2, '0');
const comoData = (d) => `${d.ano}-${doisDigitos(d.mes)}-${doisDigitos(d.dia)}`;

/* Os horários que existiriam num dia útil, antes de olhar a agenda. O último
   começa cedo o bastante para terminar dentro do expediente. */
export function grade(dia) {
  const slots = [];
  for (let h = ABRE * 60; h + DURACAO <= FECHA * 60; h += DURACAO) {
    const inicio = instanteDe(dia.ano, dia.mes, dia.dia, Math.floor(h / 60), h % 60);
    slots.push({
      inicio,
      fim: new Date(inicio.getTime() + DURACAO * 60000),
      hora: `${doisDigitos(Math.floor(h / 60))}:${doisDigitos(h % 60)}`,
    });
  }
  return slots;
}

/* Os dias que valem: a partir de amanhã em Orlando, nunca hoje, sem fim de
   semana. "Amanhã" é contado no calendário de lá, não no de quem visita. */
export function diasUteis(agora = new Date()) {
  const hoje = partesEm(agora);
  const dias = [];
  for (let n = 1; n <= HORIZONTE; n++) {
    const d = somaDias(hoje.ano, hoje.mes, hoje.dia, n);
    const semana = diaDaSemana(d.ano, d.mes, d.dia);
    if (semana === 0 || semana === 6) continue;
    dias.push(d);
  }
  return dias;
}

/* O rótulo que vai para o card e para o convite. Sempre com a sigla do fuso,
   porque quem preenche pode estar no Brasil e um horário sem fuso ao lado é
   uma reunião perdida por uma hora de diferença.

   Devolve null se o instante não for um horário válido da grade: fora do
   expediente, fim de semana, hoje ou passado. É a revalidação que impede
   alguém de mandar um horário montado à mão no lugar do que a página ofereceu. */
export function rotuloDoHorario(iso, agora = new Date()) {
  if (typeof iso !== 'string') return null;
  const instante = new Date(iso);
  if (Number.isNaN(instante.getTime())) return null;

  const valido = diasUteis(agora).some((dia) =>
    grade(dia).some((s) => s.inicio.getTime() === instante.getTime()));
  if (!valido) return null;

  const p = partesEm(instante);
  return `${doisDigitos(p.dia)}/${doisDigitos(p.mes)}/${p.ano} às `
    + `${doisDigitos(p.hora)}:${doisDigitos(p.minuto)} ${siglaDoFuso(instante)} (Orlando)`;
}

const sobrepoe = (a1, a2, b1, b2) => a1 < b2 && b1 < a2;

export function montarAgenda(ocupados, agora = new Date()) {
  const blocos = ocupados
    .map((b) => ({ inicio: new Date(b.start).getTime(), fim: new Date(b.end).getTime() }))
    .filter((b) => Number.isFinite(b.inicio) && Number.isFinite(b.fim));

  return diasUteis(agora)
    .map((dia) => ({
      data: comoData(dia),
      horarios: grade(dia)
        .filter((s) => !blocos.some((b) => sobrepoe(s.inicio.getTime(), s.fim.getTime(), b.inicio, b.fim)))
        .map((s) => ({ hora: s.hora, inicio: s.inicio.toISOString(), fim: s.fim.toISOString() })),
    }))
    .filter((d) => d.horarios.length);
}

async function ocupadosDoJsynq(de, ate, token) {
  const authorization = /^bearer\s/i.test(token) ? token : `Bearer ${token}`;
  const url = `${API_BASE}/api/meetings/availability`
    + `?startDate=${de}&endDate=${ate}&collaboratorIds=${RESPONSAVEL}`;
  const res = await fetch(url, { headers: { authorization } });
  if (!res.ok) throw new Error(`disponibilidade devolveu ${res.status}`);
  const dados = await res.json();
  return dados?.busy || dados?.data?.busy || [];
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }

  const token = process.env.JSYNQ_API_TOKEN;
  const agora = new Date();
  const dias = diasUteis(agora);
  const fuso = { nome: FUSO, sigla: siglaDoFuso(agora), duracao: DURACAO };

  if (!token) {
    console.error('[reels-agenda] JSYNQ_API_TOKEN ausente.');
    return res.status(503).json({ ok: false, error: 'not_configured' });
  }

  try {
    const ocupados = await ocupadosDoJsynq(
      comoData(dias[0]), comoData(somaDias(dias.at(-1).ano, dias.at(-1).mes, dias.at(-1).dia, 1)), token,
    );
    res.setHeader('cache-control', 'public, max-age=60');
    return res.status(200).json({ ok: true, fuso, dias: montarAgenda(ocupados, agora) });
  } catch (err) {
    // Sem a agenda não dá para prometer horário: melhor a página cair no
    // caminho sem calendário do que oferecer um horário que pode estar ocupado.
    console.error('[reels-agenda] falha ao ler a agenda:', err?.message);
    return res.status(502).json({ ok: false, error: 'upstream' });
  }
}
