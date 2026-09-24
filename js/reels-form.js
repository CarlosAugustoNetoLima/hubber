const TEXTO = {
  en: { erro: 'We could not send it. Try again in a moment.',
        faltando: 'Some fields are missing.', enviando: 'Sending...' },
  pt: { erro: 'Não conseguimos enviar. Tente de novo em instantes.',
        faltando: 'Faltam campos para enviar.', enviando: 'Enviando...' },
};

/* O telefone só casa com o cadastro da Meta se vier com o DDI, e o número
   americano quase sempre chega digitado sem o +1. Dez dígitos no formato dos
   EUA (código de área e prefixo nunca começam por 0 ou 1), ou onze começando
   pelo 1, ganham o + na frente. O resto vai como a pessoa escreveu: com + ou
   00 no começo, o próprio SDK reconhece o DDI. */
function telefoneComDdi(bruto) {
  const texto = String(bruto || '').trim();
  if (/^(\+|00)/.test(texto)) return texto;
  const digitos = texto.replace(/\D/g, '');
  if (/^[2-9]\d{2}[2-9]\d{6}$/.test(digitos)) return `+1${digitos}`;
  if (/^1[2-9]\d{2}[2-9]\d{6}$/.test(digitos)) return `+${digitos}`;
  return texto;
}

/* `lerOrigem` chega por parâmetro em vez de import. O reels.js é quem chama
   este módulo, e importar de volta fecharia um ciclo: com await de topo de um
   lado e import estático do outro, os dois módulos ficam esperando um ao
   outro para sempre, sem erro nenhum no console. */
export function initReelsForm(root = document, lerOrigem = () => ({})) {
  const form = root.querySelector('[data-reels-form]');
  if (!form) return;

  const T = form.querySelector('[name="idioma"]')?.value === 'pt' ? TEXTO.pt : TEXTO.en;
  const nascido = Date.now();
  const resultado = root.querySelector('[data-reels-result]');
  const resumoErros = form.querySelector('[data-errors]');

  /* A mensagem vem do próprio campo, em data-error-required, como no resto do
     site. Antes ia um espaço em branco, e o campo exibia só a seta do ::before:
     o aviso apontava para o problema sem dizer qual era. */
  function mostrarErro(campo) {
    const caixa = campo.closest('[data-field]');
    const alvo = caixa?.querySelector('[data-error]');
    if (!alvo) return;
    alvo.textContent = caixa.dataset.errorRequired || T.faltando;
    alvo.hidden = false;
    caixa.classList.add('is-invalid');
  }

  function limparErros() {
    form.querySelectorAll('[data-error]').forEach((e) => { e.hidden = true; e.textContent = ''; });
    form.querySelectorAll('[data-field]').forEach((c) => c.classList.remove('is-invalid'));
    if (resumoErros) { resumoErros.hidden = true; resumoErros.textContent = ''; }
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    limparErros();

    // Radio tem value preenchido mesmo desmarcado, então a checagem é pelo
    // grupo: vale se algum do mesmo name estiver marcado.
    const faltando = [...form.querySelectorAll('[required]')].filter((el) => {
      if (el.type === 'checkbox') return !el.checked;
      if (el.type === 'radio') return !form.querySelector(`[name="${el.name}"]:checked`);
      return !el.value.trim();
    });

    if (faltando.length) {
      faltando.forEach((el) => mostrarErro(el));
      if (resumoErros) { resumoErros.textContent = T.faltando; resumoErros.hidden = false; }
      faltando[0].focus();
      return;
    }
    // A guarda de três segundos é a mesma dos outros formulários do site.
    if (Date.now() - nascido < 3000) { mostrarSucesso(); return; }

    const dados = Object.fromEntries(new FormData(form).entries());
    delete dados.website_extra;
    dados.origem = lerOrigem();

    const btn = form.querySelector('[type="submit"]');
    const rotulo = btn?.textContent;
    if (btn) { btn.disabled = true; btn.textContent = T.enviando; }
    try {
      const res = await fetch(form.dataset.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dados),
      });
      if (!res.ok) throw new Error(String(res.status));
      marcarConversao(dados);
      mostrarSucesso();
    } catch (_) {
      if (resumoErros) { resumoErros.textContent = T.erro; resumoErros.hidden = false; }
    } finally {
      if (btn) { btn.disabled = false; if (rotulo) btn.textContent = rotulo; }
    }
  });

  /* A conversão só existe depois do servidor confirmar. O caminho do honeypot e
     o da guarda de três segundos mostram a mesma tela de sucesso sem ter
     enviado nada, e contar aquilo como pedido envenenaria a otimização da
     campanha com o que os robôs fazem. */
  function marcarConversao(dados) {
    if (!window.pixel) return;

    /* Correspondência avançada: é o que liga este pedido à pessoa que viu o
       anúncio. Vai embaralhado pelo próprio SDK, dentro do navegador. */
    const nome = String(dados.nome || '').trim().split(/\s+/);
    window.pixel.identificar({
      em: String(dados.email || '').trim().toLowerCase(),
      ph: telefoneComDdi(dados.telefone),
      fn: (nome[0] || '').toLowerCase(),
      ln: nome.slice(1).join(' ').toLowerCase(),
    });

    // O plano vai pelo valor cru, não pelo texto traduzido: o relatório da
    // campanha mistura as duas línguas e "avulsa" é a mesma coisa nas duas.
    const conteudo = {
      content_name: 'Reels Orlando, qualification call',
      content_category: dados.plano || '',
    };

    /* Dois nomes para a mesma conversão, com a mesma contagem. Sem calendário
       nada é agendado na hora do envio, e o nome certo passou a ser Lead. O
       Schedule segue junto para não derrubar campanha que já otimize por ele;
       sai quando nenhuma depender mais dele. */
    window.pixel.evento('Schedule', conteudo);
    window.pixel.evento('Lead', conteudo);
  }

  function mostrarSucesso() {
    if (!resultado) return;
    form.hidden = true;
    resultado.hidden = false;
    resultado.querySelector('h3')?.focus({ preventScroll: true });
    const topo = resultado.getBoundingClientRect().top + window.scrollY - 96;
    window.scrollTo({ top: topo, behavior: 'smooth' });
  }

  /* O CTA do plano leva ao formulário com o plano marcado, mesmo que a pessoa
     tenha mexido na escolha antes de clicar. */
  const DE_PARA = { once: 'avulsa' };
  for (const cta of root.querySelectorAll('[data-plan]')) {
    cta.addEventListener('click', () => {
      const alvo = form.querySelector(`input[name="plano"][value="${DE_PARA[cta.dataset.plan]}"]`);
      if (alvo) alvo.checked = true;
    });
  }
}
