// A escolha sobre o pixel da Meta. Duas interfaces para a mesma decisão: a
// tarja que pergunta a quem ainda não escolheu, e o controle na política de
// privacidade, que deixa mudar de ideia depois. Retirar precisa ser tão fácil
// quanto dar, senão o consentimento não vale.
//
// Guardar e aplicar a decisão é trabalho do script do partial meta-pixel, no
// <head>: ele roda antes de tudo para não atrasar o PageView de quem já
// autorizou. Aqui mora só a interface.
/* A política do reels existe em inglês e em português, e as duas carregavam
   este mesmo controle. O texto vinha fixo em português: quem lia a política em
   inglês encontrava uma frase em outra língua no meio dela. */
const TEXTO = {
  pt: {
    local: 'pt-BR',
    em: (data) => ` em ${data}`,
    aceito: (q) => `Você autorizou o pixel da Meta${q}.`,
    recusado: (q) => `Você recusou o pixel da Meta${q}. Nada está sendo gravado no seu navegador.`,
    nenhum: 'Você ainda não escolheu, e por isso o pixel não está carregando.',
    retirar: 'Retirar a autorização',
    autorizar: 'Autorizar',
  },
  en: {
    local: 'en-US',
    em: (data) => ` on ${data}`,
    aceito: (q) => `You allowed the Meta pixel${q}.`,
    recusado: (q) => `You declined the Meta pixel${q}. Nothing is being written to your browser.`,
    nenhum: 'You have not chosen yet, which is why the pixel is not loading.',
    retirar: 'Withdraw permission',
    autorizar: 'Allow',
  },
};

export function initConsentimento(root = document) {
  const api = window.consentimento;
  if (!api) return;

  const T = document.documentElement.lang.startsWith('pt') ? TEXTO.pt : TEXTO.en;

  const tarja = root.querySelector('[data-consent]');
  const controle = root.querySelector('[data-consent-controle]');
  if (!tarja && !controle) return;

  const resumo = controle?.querySelector('[data-consent-resumo]');
  const botao = controle?.querySelector('[data-consent-trocar]');

  function estado() {
    const r = api.registro();
    return r ? r.estado : null;
  }

  function quando() {
    const r = api.registro();
    if (!r?.em) return '';
    const d = new Date(r.em);
    return Number.isNaN(d.getTime()) ? '' : T.em(d.toLocaleDateString(T.local));
  }

  function pintarControle() {
    if (!controle || !resumo || !botao) return;
    const atual = estado();
    if (atual === 'aceito') {
      resumo.textContent = T.aceito(quando());
      botao.textContent = T.retirar;
    } else if (atual === 'recusado') {
      resumo.textContent = T.recusado(quando());
      botao.textContent = T.autorizar;
    } else {
      resumo.textContent = T.nenhum;
      botao.textContent = T.autorizar;
    }
    controle.hidden = false;
  }

  function responder(novo) {
    // Se o pixel já estava rodando nesta aba, apagar o cookie não desliga o
    // script que continua na memória. Recarregar é o único jeito honesto de
    // fazer a página parar de verdade.
    const precisaRecarregar = novo === 'recusado' && typeof window.fbq === 'function';
    api.registrar(novo);
    if (tarja) tarja.hidden = true;
    if (precisaRecarregar) { window.location.reload(); return; }
    pintarControle();
  }

  if (tarja) {
    if (estado() === null) tarja.hidden = false;
    tarja.querySelector('[data-consent-aceitar]')?.addEventListener('click', () => responder('aceito'));
    tarja.querySelector('[data-consent-recusar]')?.addEventListener('click', () => responder('recusado'));
  }

  if (controle && botao) {
    botao.addEventListener('click', () => responder(estado() === 'aceito' ? 'recusado' : 'aceito'));
    pintarControle();
  }
}
