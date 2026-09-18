// A escolha sobre o pixel da Meta. Duas interfaces para a mesma decisão: a
// tarja que pergunta a quem ainda não escolheu, e o controle na política de
// privacidade, que deixa mudar de ideia depois. Retirar precisa ser tão fácil
// quanto dar, senão o consentimento não vale.
//
// Guardar e aplicar a decisão é trabalho do script do partial meta-pixel, no
// <head>: ele roda antes de tudo para não atrasar o PageView de quem já
// autorizou. Aqui mora só a interface.
export function initConsentimento(root = document) {
  const api = window.consentimento;
  if (!api) return;

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
    return Number.isNaN(d.getTime()) ? '' : ` em ${d.toLocaleDateString('pt-BR')}`;
  }

  function pintarControle() {
    if (!controle || !resumo || !botao) return;
    const atual = estado();
    if (atual === 'aceito') {
      resumo.textContent = `Você autorizou o pixel da Meta${quando()}.`;
      botao.textContent = 'Retirar a autorização';
    } else if (atual === 'recusado') {
      resumo.textContent = `Você recusou o pixel da Meta${quando()}. Nada está sendo gravado no seu navegador.`;
      botao.textContent = 'Autorizar';
    } else {
      resumo.textContent = 'Você ainda não escolheu, e por isso o pixel não está carregando.';
      botao.textContent = 'Autorizar';
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
