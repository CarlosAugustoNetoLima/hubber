// A escolha sobre o pixel da Meta. Duas interfaces para a mesma decisão: a
// tarja que avisa quem chega pela primeira vez, e o controle na política de
// privacidade, que deixa mudar de ideia depois. A medição já vale na chegada,
// então sair precisa estar a um clique, na tarja e na política.
//
// Guardar e aplicar a decisão é trabalho do script do partial
// consentimento-api, no <head>: ele roda antes de tudo para o PageView sair
// junto com a página. Aqui mora só a interface.
/* A política do reels existe em inglês e em português, e as duas carregavam
   este mesmo controle. O texto vinha fixo em português: quem lia a política em
   inglês encontrava uma frase em outra língua no meio dela. */
const TEXTO = {
  pt: {
    local: 'pt-BR',
    em: (data) => ` em ${data}`,
    ligada: 'A medição pelo pixel da Meta está ligada para você.',
    desligada: (q) => `Você desativou a medição${q}. Nada está sendo gravado no seu navegador.`,
    desativar: 'Desativar a medição',
    reativar: 'Reativar a medição',
  },
  en: {
    local: 'en-US',
    em: (data) => ` on ${data}`,
    ligada: 'Measurement by the Meta pixel is on for you.',
    desligada: (q) => `You opted out${q}. Nothing is being written to your browser.`,
    desativar: 'Opt out',
    reativar: 'Allow again',
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

  function quando() {
    const r = api.registro();
    if (!r?.em) return '';
    const d = new Date(r.em);
    return Number.isNaN(d.getTime()) ? '' : T.em(d.toLocaleDateString(T.local));
  }

  function pintarControle() {
    if (!controle || !resumo || !botao) return;
    if (api.permitido()) {
      resumo.textContent = T.ligada;
      botao.textContent = T.desativar;
    } else {
      resumo.textContent = T.desligada(quando());
      botao.textContent = T.reativar;
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

  /* "ciente" é quem leu o aviso e seguiu. Não vira "aceito": ninguém autorizou
     nada ao fechar um aviso, e o registro não deve dizer o contrário. */
  if (tarja) {
    if (api.registro() === null) tarja.hidden = false;
    tarja.querySelector('[data-consent-ok]')?.addEventListener('click', () => responder('ciente'));
    tarja.querySelector('[data-consent-sair]')?.addEventListener('click', () => responder('recusado'));
  }

  if (controle && botao) {
    botao.addEventListener('click', () => responder(api.permitido() ? 'recusado' : 'aceito'));
    pintarControle();
  }
}
