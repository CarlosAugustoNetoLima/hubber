/**
 * A rota do diagnóstico: mesma regra no navegador e no servidor.
 *
 * `js/form.js` usa para mostrar a devolutiva na hora; `api/diagnostico.js`
 * recalcula antes de gravar no CRM. Não é organização por gosto: se as duas
 * cópias divergirem, a pessoa lê "Pocket" na tela e o card sai "Build". O que
 * o navegador manda no corpo do POST é ignorado — só este cálculo vale.
 *
 * Função pura, sem DOM: roda igual nos dois lados.
 */

// Abaixo de US$85 mil por mês o Build não se paga. É o piso do funil inteiro.
const PISO = new Set(['85-200k', '200-500k', '500k+']);

export const ROUTE_LABEL = {
  build: 'Build',
  agencia: 'Agência',
  pocket: 'Pocket',
  nutricao: 'Nutrição',
};

export const NOTE_LABEL = {
  piso: 'Abaixo do piso de faturamento',
  verba: 'Sem verba para os próximos 90 dias',
  'verba-a-definir': 'Verba ainda a definir',
  sponsor: 'Quem decide não é quem respondeu',
};

export function computeRoute(a) {
  const piso = PISO.has(a.faturamento);
  const semVerba = a.verba === 'nao';
  const decide = a.papel === 'sozinho' || a.papel === 'socios';
  const notes = [];

  if (!piso || semVerba) {
    if (!piso) notes.push('piso');
    if (semVerba) notes.push('verba');
    return { route: 'nutricao', notes };
  }
  if (a.verba === 'a-definir') notes.push('verba-a-definir');

  if (a.estrutura === 'time-interno') {
    if (!decide) notes.push('sponsor');
    return { route: 'build', notes };
  }
  if (a.estrutura === 'executar') return { route: 'agencia', notes };
  if (a.estrutura === 'base')     return { route: 'pocket', notes };

  if (a.time === 'ninguem') return { route: 'pocket', notes };
  if ((a.gargalo === 'time' || a.gargalo === 'gestao') && decide) return { route: 'build', notes };
  return { route: 'agencia', notes };
}
