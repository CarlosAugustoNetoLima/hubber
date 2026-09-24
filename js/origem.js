// De onde a pessoa veio: as UTMs e os cliques de anúncio que chegam na URL.
// Fica guardado na aba e vai junto do formulário, para o card no CRM dizer
// qual campanha e qual peça trouxeram o lead. Cada página passa a sua chave.

const PARAMETROS = [
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
  'fbclid', 'gclid'
];

function ler(chave) {
  try {
    return JSON.parse(sessionStorage.getItem(chave) || '{}');
  } catch {
    return {};
  }
}

/* O fbclid novo da Meta passa fácil de 200 caracteres, com o sufixo _aem_.
   Cortado, ele não casa com mais nada, então só ele ganha um teto maior. */
export function capturarOrigem(chave) {
  const params = new URLSearchParams(location.search);
  const vindos = {};
  for (const nome of PARAMETROS) {
    const valor = params.get(nome);
    if (valor) vindos[nome] = valor.slice(0, nome === 'fbclid' ? 500 : 200);
  }
  if (!Object.keys(vindos).length) return;

  try {
    sessionStorage.setItem(chave, JSON.stringify({ ...ler(chave), ...vindos, landing: location.pathname }));
  } catch {}
}

/* O fbclid só serve para devolver à Meta o que o lead virou. Quem desativou a
   medição não entra nesse caminho, então o clique dele nem chega ao CRM. As
   UTMs seguem: dizem de qual campanha a pessoa veio. */
export function origemParaEnvio(chave) {
  const origem = ler(chave);
  if (window.consentimento && !window.consentimento.permitido()) delete origem.fbclid;
  return origem;
}
