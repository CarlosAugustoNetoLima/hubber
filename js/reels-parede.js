/* A parede de portfólio. Cada reel começa parado no pôster, com botão de play
   por cima: autoplay de seis vídeos ao mesmo tempo custaria banda de quem está
   no 4G e ainda brigaria pelo olho. Tocar um pausa o anterior, porque dois com
   som ao mesmo tempo é ruído, não portfólio.

   Os controles são elementos de verdade, não divs: o play é <button> porque
   vídeo sem `controls` não recebe foco de teclado, e a barra é <input range>
   porque ela já vem com seta do teclado, arrasto e leitura de tela prontos.
   Um controle desenhado à mão custaria trinta linhas para ficar pior. */
const VOLTA = 10;

function formatar(segundos) {
  if (!Number.isFinite(segundos)) return '0:00';
  const m = Math.floor(segundos / 60);
  const s = Math.floor(segundos % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function initParede(root = document) {
  const itens = [...root.querySelectorAll('.wall__item')];
  if (!itens.length) return;

  let tocando = null;

  /* O modal é um <dialog> de verdade porque ele já traz Esc, foco preso dentro
     e devolução do foco ao fechar. Reescrever isso à mão daria trinta linhas
     para ficar pior, e acessibilidade de modal é fácil de errar.

     O vídeo é movido para dentro em vez de clonado: clone recomeçaria o
     download e voltaria ao início. Mover preserva o arquivo já baixado, e o
     tempo é restaurado à mão porque o navegador pausa na mudança de pai. */
  const caixa = root.querySelector('[data-wall-caixa]');
  const palco = root.querySelector('[data-wall-palco]');
  const fechar = root.querySelector('[data-wall-fechar]');
  let voltarPara = null;

  function abrir(video, item) {
    if (!caixa || !palco || typeof caixa.showModal !== 'function') return;
    const tempo = video.currentTime;
    const rodando = !video.paused;
    voltarPara = item;
    palco.appendChild(video);
    // Controles nativos no modal: seek, volume e tela cheia do sistema, de
    // graça e já acessíveis. A barra própria só existe na parede, onde o
    // controle nativo ocuparia metade da peça.
    video.controls = true;
    caixa.showModal();
    video.currentTime = tempo;
    if (rodando) video.play().catch(() => {});
  }

  function recolher() {
    if (!voltarPara || !palco.firstElementChild) return;
    const video = palco.firstElementChild;
    const tempo = video.currentTime;
    const rodando = !video.paused;
    video.controls = false;
    voltarPara.insertBefore(video, voltarPara.firstChild);
    video.currentTime = tempo;
    if (rodando) video.play().catch(() => {});
    voltarPara = null;
  }

  /* O evento `close` do <dialog> não chega em todo navegador, e sem ele o vídeo
     ficaria preso dentro do modal. Então a devolução é chamada em cada gatilho,
     e o `close` fica só como rede. `recolher` é seguro de rodar duas vezes. */
  function fecharCaixa() {
    recolher();
    if (caixa.open) caixa.close();
  }

  if (caixa) {
    caixa.addEventListener('close', recolher);
    caixa.addEventListener('cancel', recolher);
    fechar?.addEventListener('click', fecharCaixa);
    // Clique no fundo fecha. O <dialog> recebe o clique do ::backdrop nele
    // mesmo, então basta conferir se o alvo foi o próprio elemento.
    caixa.addEventListener('click', (e) => { if (e.target === caixa) fecharCaixa(); });
  }

  for (const item of itens) {
    const video = item.querySelector('[data-wall-video]');
    const botao = item.querySelector('[data-wall-play]');
    const barra = item.querySelector('[data-wall-barra]');
    const seek = item.querySelector('[data-wall-seek]');
    const voltar = item.querySelector('[data-wall-voltar]');
    const tempo = item.querySelector('[data-wall-tempo]');
    const expandir = item.querySelector('[data-wall-expandir]');
    if (!video || !botao) continue;

    expandir?.addEventListener('click', () => abrir(video, item));

    let arrastando = false;

    const parar = () => { video.pause(); };

    botao.addEventListener('click', () => {
      if (tocando === video && !video.paused) { parar(); return; }
      if (tocando && tocando !== video) tocando.pause();
      video.muted = false;
      const promessa = video.play();
      // Alguns navegadores recusam som sem gesto reconhecido. Melhor tocar mudo
      // do que não tocar.
      if (promessa?.catch) promessa.catch(() => { video.muted = true; video.play().catch(() => {}); });
      tocando = video;
    });

    video.addEventListener('play', () => {
      item.classList.add('is-playing');
      if (barra) barra.hidden = false;
      tocando = video;
    });
    video.addEventListener('pause', () => item.classList.remove('is-playing'));

    video.addEventListener('timeupdate', () => {
      if (!seek || arrastando || !video.duration) return;
      seek.value = String((video.currentTime / video.duration) * 100);
      if (tempo) tempo.textContent = formatar(video.currentTime);
    });

    if (seek) {
      // `input` cobre arrastar e as setas do teclado; `change` fecha o arrasto.
      seek.addEventListener('input', () => {
        arrastando = true;
        if (!video.duration) return;
        video.currentTime = (Number(seek.value) / 100) * video.duration;
        if (tempo) tempo.textContent = formatar(video.currentTime);
      });
      seek.addEventListener('change', () => { arrastando = false; });
    }

    if (voltar) {
      voltar.addEventListener('click', () => {
        video.currentTime = Math.max(0, video.currentTime - VOLTA);
      });
    }
  }
}
