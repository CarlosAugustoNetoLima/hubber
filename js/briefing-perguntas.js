/**
 * As perguntas dos briefings de briefing.hubbermarketing.com.
 *
 * Fonte única: a página lê este arquivo para desenhar o formulário e
 * api/briefing.js lê o mesmo arquivo para validar o que chega e para montar o
 * card. Se as duas pontas tivessem cópias, bastaria uma perder a outra de vista
 * para o CRM aceitar resposta que a página nunca ofereceu.
 *
 * Tipos de campo: text, email, tel, date, textarea, single (uma opção) e
 * multi (várias, com `max` opcional). `showIf` esconde o campo conforme as
 * respostas anteriores; campo escondido não é cobrado nem enviado.
 *
 * `compartilha` ('contato' ou 'negocio') marca a pergunta que é IDÊNTICA em mais
 * de um briefing. É o que a página oferece reaproveitar quando a pessoa faz um
 * segundo briefing na mesma sessão (ver js/briefing.js). Só vale marcar quando o
 * enunciado e as opções são os mesmos: chave igual não basta, porque `tom`,
 * `regiao`, `provas` e `objetivo` se chamam igual e perguntam coisas diferentes.
 *
 * Briefing novo = entrada nova em BRIEFINGS, etiqueta e formulário no JSYNQ e
 * os ids em api/briefing.js. Nada mais.
 */

const TOM = ['Premium', 'Acessível', 'Técnica e especialista', 'Próxima e amigável', 'Ousada',
  'Sóbria e institucional', 'Jovem', 'Tradicional', 'Inovadora', 'Humana e acolhedora'];

const CANAIS = ['Instagram', 'Facebook', 'Google (busca e Maps)', 'WhatsApp', 'Site próprio', 'Indicação',
  'TikTok', 'YouTube', 'E-mail', 'Eventos e ações presenciais'];

const inclui = (a, k, v) => Array.isArray(a[k]) && a[k].includes(v);

/* ---------------------------------------------------------------- MARCA */

const MARCA = {
  slug: 'marca',
  titulo: 'Briefing de marca',
  resumo: 'Posicionamento, mensagem e comunicação da marca.',
  duracao: 'cerca de 15 minutos',
  intro: 'Estas perguntas definem o que a Hubber vai construir com você: posicionamento, mensagem e comunicação da marca. Quanto mais específica a resposta, melhor o resultado.',
  destaque: 'objetivo',
  rotuloDestaque: 'Objetivo principal',
  passos: [
    {
      titulo: 'Empresa e contato',
      porque: 'Para saber com quem a Hubber está falando e onde a marca atua.',
      campos: [
        { k: 'empresa', t: 'text', compartilha: 'contato', label: 'Nome da empresa', req: true },
        { k: 'responsavel', t: 'text', compartilha: 'contato', label: 'Nome do responsável', hint: 'Quem decide sobre a marca e aprova as entregas.', req: true },
        { k: 'email', t: 'email', compartilha: 'contato', label: 'E-mail principal', req: true },
        { k: 'whatsapp', t: 'tel', compartilha: 'contato', label: 'WhatsApp', hint: 'Com DDD ou código do país.', req: true },
        { k: 'cidade', t: 'text', compartilha: 'contato', label: 'Cidade e região de atuação', req: true },
        { k: 'instagram', t: 'text', compartilha: 'contato', ig: true, label: 'Instagram da empresa', ph: '@usuario' },
        { k: 'site', t: 'text', url: true, label: 'Site e outras redes', hint: 'Facebook, LinkedIn, TikTok, YouTube. Cole os links.' },
        { k: 'cnpj', t: 'text', label: 'CNPJ ou EIN', grupo: 'Dados para cadastro (opcional)' },
        { k: 'endereco', t: 'text', label: 'Endereço completo', hint: 'Rua, número, bairro, cidade e estado.', grupo: 'Dados para cadastro (opcional)' },
        { k: 'horario', t: 'text', label: 'Dias e horários de funcionamento', grupo: 'Dados para cadastro (opcional)' },
        { k: 'aniversario', t: 'date', label: 'Data de aniversário da empresa', grupo: 'Dados para cadastro (opcional)' },
      ],
    },
    {
      titulo: 'O negócio',
      porque: 'A estratégia de marca parte do que a empresa vende e do que mais dá resultado.',
      campos: [
        { k: 'oquefaz', t: 'textarea', compartilha: 'negocio', label: 'O que a empresa faz?', hint: 'Explique como se fosse para alguém que nunca ouviu falar de vocês.', req: true },
        { k: 'tempo', t: 'single', label: 'Há quanto tempo a empresa opera?', req: true, opts: ['Menos de 1 ano', 'De 1 a 3 anos', 'De 3 a 7 anos', 'Mais de 7 anos'] },
        { k: 'divulgar', t: 'textarea', label: 'Quais produtos ou serviços você quer divulgar agora?', req: true },
        { k: 'lucrativo', t: 'text', label: 'Qual produto ou serviço é o mais lucrativo hoje?' },
        { k: 'ticket', t: 'text', label: 'Ticket médio do principal produto ou serviço', ph: 'Ex.: US$ 450 ou R$ 2.000' },
        { k: 'naoatender', t: 'text', label: 'Existe algo que a empresa não quer vender ou atender?' },
      ],
    },
    {
      titulo: 'A marca',
      porque: 'Aqui se define o posicionamento: por que a marca existe, como fala e como quer ser lembrada.',
      campos: [
        { k: 'proposito', t: 'textarea', label: 'Por que a empresa existe, além de ganhar dinheiro?', req: true },
        { k: 'origem', t: 'textarea', label: 'Como a empresa começou?', hint: 'A história do fundador costuma ser o melhor material de marca.' },
        { k: 'diferencial', t: 'textarea', compartilha: 'negocio', label: 'O que o cliente só encontra com vocês?', hint: 'Evite “qualidade” e “bom atendimento”. Dê um fato ou um exemplo.', req: true },
        { k: 'palavras', t: 'text', label: 'Três palavras que definem a marca', ph: 'Ex.: precisa, próxima, ousada', req: true },
        { k: 'percepcao', t: 'textarea', label: 'Depois de conhecer a marca, o que o cliente deve pensar e sentir?', req: true },
        { k: 'tom', t: 'multi', max: 3, label: 'Como a marca deve soar?', hint: 'Escolha até 3.', req: true, opts: TOM },
        { k: 'naoser', t: 'text', label: 'O que a marca nunca deve parecer?' },
        { k: 'referencias', t: 'textarea', label: 'Marcas que você admira, de qualquer setor', hint: 'Diga o que atrai em cada uma: o visual, o jeito de falar, a postura.' },
        { k: 'identidade', t: 'single', compartilha: 'negocio', label: 'Como está a identidade visual hoje?', req: true,
          opts: ['Tenho logo e manual de marca', 'Tenho logo, mas sem manual', 'Tenho um logo antigo que quero refazer', 'Ainda não tenho identidade visual'] },
        { k: 'arquivos', t: 'text', compartilha: 'negocio', url: true, label: 'Link da pasta com logo, fotos e materiais', hint: 'Google Drive, Dropbox ou similar. Libere o acesso por link.' },
      ],
    },
    {
      titulo: 'O público',
      porque: 'A marca só funciona quando é escrita para uma pessoa específica.',
      campos: [
        { k: 'cliente', t: 'textarea', compartilha: 'negocio', label: 'Quem é o cliente ideal?', hint: 'Idade, perfil, cargo, interesses e onde mora.', req: true },
        { k: 'tipo', t: 'single', label: 'A empresa atende', req: true, opts: ['Cliente final (pessoa física)', 'Outras empresas', 'Os dois'] },
        { k: 'dor', t: 'textarea', label: 'Qual o principal problema que esse cliente enfrenta hoje?', req: true },
        { k: 'objecao', t: 'textarea', label: 'O que faz um cliente hesitar ou desistir antes de comprar?' },
        { k: 'elogios', t: 'textarea', label: 'O que os clientes atuais mais elogiam?', hint: 'Se tiver frases reais de clientes, cole aqui.' },
        { k: 'faixa', t: 'text', label: 'Faixa média de investimento do cliente' },
        { k: 'regiao', t: 'text', label: 'Onde a empresa quer captar clientes?', hint: 'Cidades, estados ou países.', req: true },
      ],
    },
    {
      titulo: 'O mercado',
      porque: 'Posicionar é escolher uma diferença. Para isso precisamos saber com quem a marca é comparada.',
      campos: [
        { k: 'concorrentes', t: 'textarea', label: 'Cite 2 ou 3 concorrentes diretos', hint: 'Nome e, se possível, Instagram ou site.', req: true },
        { k: 'comparativo', t: 'textarea', label: 'Onde vocês ganham deles e onde perdem?' },
        { k: 'provas', t: 'textarea', label: 'Que provas a marca já tem?', hint: 'Cases, depoimentos, prêmios, certificações e números. Só o que dá para comprovar.' },
      ],
    },
    {
      titulo: 'Marketing e metas',
      porque: 'Define o que a estratégia de marca precisa entregar para o negócio.',
      campos: [
        { k: 'objetivo', t: 'single', label: 'Qual o principal objetivo agora?', req: true,
          opts: ['Gerar mais leads', 'Aumentar vendas', 'Fortalecer a marca', 'Construir posicionamento e autoridade', 'Lançar um produto', 'Levar tráfego para o site'] },
        { k: 'meta', t: 'text', label: 'Existe uma meta clara?', ph: 'Ex.: 80 leads por mês ou 20% de crescimento em 12 meses' },
        { k: 'mudanca', t: 'textarea', label: 'O que mais precisa mudar nos próximos 12 meses?', hint: 'Traga números, prazo e motivo.', req: true },
        { k: 'hoje', t: 'single', label: 'Quem cuida do marketing hoje?', req: true,
          opts: ['Uma agência', 'Freelancers', 'Uma pessoa da equipe', 'Um time interno', 'Ninguém, eu mesmo'] },
        { k: 'investiu', t: 'single', label: 'Já investiu em marketing digital?',
          opts: ['Sim, e deu resultado', 'Sim, mas sem o resultado esperado', 'Nunca investi'] },
        { k: 'canais', t: 'multi', label: 'Quais canais a empresa usa hoje?', opts: CANAIS },
        { k: 'crm', t: 'single', label: 'Usa algum CRM?', hint: 'Plataforma para gestão de leads e atendimento.', opts: ['Sim', 'Não'] },
        { k: 'crmqual', t: 'text', label: 'Qual CRM?', showIf: (a) => a.crm === 'Sim' },
        { k: 'zap', t: 'tel', label: 'WhatsApp que vai receber os contatos dos clientes' },
        { k: 'gads', t: 'text', label: 'Investimento mensal previsto no Google Ads', par: 'inv' },
        { k: 'mads', t: 'text', label: 'Investimento mensal previsto no Meta Ads', par: 'inv' },
      ],
    },
  ],
};

/* ---------------------------------------------------------------- SITE */

/* O tipo de site decide o que mais se pergunta: landing page é uma página só,
   então a quantidade de páginas não faz sentido para ela. */
const LANDING = 'Landing page (uma página, focada em uma ação)';
const TIPOS_DE_SITE = [
  LANDING,
  'Site institucional enxuto (poucas páginas, sem subpáginas)',
  'Site institucional completo (várias páginas e subpáginas)',
  'Loja online (e-commerce)',
  'Site com área de login ou sistema',
  'Ainda não sei, preciso de orientação',
];

const SITE = {
  slug: 'site',
  titulo: 'Briefing de website',
  resumo: 'Objetivo, conteúdo, visual e requisitos técnicos do site.',
  duracao: 'cerca de 15 minutos',
  intro: 'Estas perguntas definem o que o site precisa fazer, o que vai dentro dele e como será publicado. Quanto mais específica a resposta, menos idas e vindas até o site ir ao ar.',
  destaque: 'tipoprojeto',
  rotuloDestaque: 'Tipo de site',
  passos: [
    {
      titulo: 'Empresa e contato',
      porque: 'Para saber com quem a Hubber está falando e quem aprova o site.',
      campos: [
        { k: 'empresa', t: 'text', compartilha: 'contato', label: 'Nome da empresa', req: true },
        { k: 'responsavel', t: 'text', compartilha: 'contato', label: 'Nome do responsável', hint: 'Quem acompanha o projeto no dia a dia.', req: true },
        { k: 'email', t: 'email', compartilha: 'contato', label: 'E-mail principal', req: true },
        { k: 'whatsapp', t: 'tel', compartilha: 'contato', label: 'WhatsApp', hint: 'Com DDD ou código do país.', req: true },
        { k: 'cidade', t: 'text', compartilha: 'contato', label: 'Cidade e região de atuação', req: true },
        { k: 'instagram', t: 'text', compartilha: 'contato', ig: true, label: 'Instagram da empresa', ph: '@usuario' },
        { k: 'siteatual', t: 'text', url: true, label: 'Endereço do site atual, se houver', ph: 'https://' },
      ],
    },
    {
      titulo: 'O projeto',
      porque: 'Define o tamanho do trabalho e o que o site precisa entregar para o negócio.',
      campos: [
        { k: 'tipoprojeto', t: 'single', label: 'Que tipo de site você precisa?', req: true,
          hint: 'Landing page é uma página só, feita para uma ação. Site institucional apresenta a empresa em várias páginas.',
          opts: TIPOS_DE_SITE },
        { k: 'situacao', t: 'single', label: 'É um site novo ou a reformulação de um site existente?', req: true,
          opts: ['Site novo', 'Redesign de um site existente'] },
        { k: 'objetivo', t: 'single', label: 'Qual o principal objetivo do site?', req: true,
          opts: ['Gerar contatos e pedidos de orçamento', 'Vender online', 'Agendar reuniões ou consultas', 'Passar credibilidade e autoridade', 'Apresentar portfólio e cases', 'Informar e tirar dúvidas do cliente'] },
        { k: 'acao', t: 'textarea', label: 'Quando alguém chega ao site, qual é a ação que você mais quer que ela faça?', hint: 'Ex.: chamar no WhatsApp, preencher o formulário, comprar, agendar.', req: true },
        { k: 'problema', t: 'textarea', label: 'O que o site atual não resolve, ou por que fazer um site agora?' },
        { k: 'prazo', t: 'single', label: 'Para quando precisa do site no ar?', req: true,
          opts: ['O quanto antes, em até 30 dias', 'De 1 a 2 meses', 'De 2 a 4 meses', 'Sem data definida'] },
        { k: 'evento', t: 'text', label: 'Existe uma data ou evento que define esse prazo?', hint: 'Lançamento, campanha, feira, abertura de unidade.' },
        { k: 'aprovador', t: 'text', label: 'Quem aprova o site antes de ir ao ar?', hint: 'Nome e cargo. Se for mais de uma pessoa, liste todas.' },
      ],
    },
    {
      titulo: 'Negócio e público',
      porque: 'O site precisa falar com a pessoa certa, no momento em que ela decide.',
      campos: [
        { k: 'oquefaz', t: 'textarea', compartilha: 'negocio', label: 'O que a empresa faz?', hint: 'Explique como se fosse para alguém que nunca ouviu falar de vocês.', req: true },
        { k: 'cliente', t: 'textarea', compartilha: 'negocio', label: 'Quem é o cliente ideal?', hint: 'Idade, perfil, cargo, interesses e onde mora.', req: true },
        { k: 'busca', t: 'textarea', label: 'O que esse cliente quer saber ou resolver quando chega ao site?', req: true },
        { k: 'diferencial', t: 'textarea', compartilha: 'negocio', label: 'O que o cliente só encontra com vocês?', hint: 'Evite “qualidade” e “bom atendimento”. Dê um fato ou um exemplo.', req: true },
        { k: 'regiao', t: 'text', label: 'Onde a empresa atende?', hint: 'Cidades, estados ou países.', req: true },
        { k: 'concorrentes', t: 'textarea', label: 'Sites de concorrentes para a Hubber olhar', hint: 'Cole os links e diga o que eles fazem bem e o que fazem mal.' },
      ],
    },
    {
      titulo: 'Conteúdo e estrutura',
      porque: 'Com páginas e textos definidos, o prazo deixa de estourar.',
      campos: [
        { k: 'qtdpaginas', t: 'single', label: 'Quantas páginas o site deve ter, aproximadamente?', req: true,
          hint: 'Conte as páginas do menu e as subpáginas, como uma para cada serviço.',
          showIf: (a) => a.tipoprojeto !== LANDING,
          opts: ['De 2 a 5 páginas', 'De 6 a 10 páginas', 'De 11 a 20 páginas', 'Mais de 20 páginas', 'Ainda não sei, preciso de orientação'] },
        { k: 'paginas', t: 'multi', label: 'Quais páginas o site precisa ter?', req: true,
          hint: 'Em landing page, marque as seções que a página deve ter.',
          opts: ['Início', 'Sobre a empresa', 'Serviços ou produtos', 'Cases e portfólio', 'Depoimentos', 'Blog ou conteúdos', 'Perguntas frequentes', 'Contato', 'Agendamento', 'Loja online', 'Área do cliente', 'Outras, descrevo abaixo'] },
        { k: 'paginasoutras', t: 'textarea', label: 'Quais outras páginas?', showIf: (a) => inclui(a, 'paginas', 'Outras, descrevo abaixo') },
        { k: 'menu', t: 'textarea', label: 'Como você imagina o menu e as subpáginas?',
          hint: 'Liste os itens na ordem em que devem aparecer e diga quais terão subpáginas. Ex.: Serviços (Implantes, Clareamento), Sobre, Contato. Em landing page, diga se quer um menu que leve às seções.' },
        { k: 'idiomaprincipal', t: 'single', label: 'Qual o idioma principal do site?', req: true, opts: ['Português', 'Inglês', 'Espanhol', 'Outro'] },
        { k: 'traducoes', t: 'multi', label: 'O site terá tradução para outros idiomas?',
          hint: 'Marque só os idiomas além do principal. Se o site terá um idioma só, deixe em branco.',
          opts: ['Português', 'Inglês', 'Espanhol', 'Outro'] },
        { k: 'idiomaoutro', t: 'text', label: 'Qual outro idioma?', showIf: (a) => a.idiomaprincipal === 'Outro' || inclui(a, 'traducoes', 'Outro') },
        { k: 'textos', t: 'single', label: 'Quem escreve os textos do site?', req: true,
          opts: ['Já tenho os textos prontos', 'Tenho parte, preciso de ajuda', 'A Hubber escreve tudo', 'Ainda não sei'] },
        { k: 'fotos', t: 'single', label: 'Como estão as fotos e os vídeos?', req: true,
          opts: ['Tenho material profissional', 'Tenho fotos simples, preciso melhorar', 'Preciso produzir tudo'] },
        { k: 'funcionalidades', t: 'multi', label: 'O que o site precisa ter além das páginas?',
          opts: ['Formulário de contato', 'Botão de WhatsApp', 'Agendamento online', 'Pagamento online', 'Chat', 'Blog', 'Área de login', 'Integração com CRM', 'Mapa e endereço', 'Calculadora ou simulador'] },
        { k: 'destinocontato', t: 'textarea', label: 'Para onde devem chegar os contatos do site?', req: true,
          hint: 'Informe o WhatsApp e o e-mail que vão receber os pedidos de contato. Se forem pessoas diferentes por assunto, explique.' },
        { k: 'integracoes', t: 'textarea', label: 'O site precisa se integrar a algum sistema?',
          hint: 'Agenda, e-mail marketing, CRM, ERP, meio de pagamento, planilha ou automações. Diga qual e para quê. Se não precisa, escreva “não”.' },
        { k: 'provas', t: 'textarea', label: 'Que provas o site pode mostrar?', hint: 'Cases, depoimentos, logos de clientes, prêmios e números. Só o que dá para comprovar.' },
        { k: 'arquivos', t: 'text', compartilha: 'negocio', url: true, label: 'Link da pasta com logo, fotos e materiais', hint: 'Google Drive, Dropbox ou similar. Libere o acesso por link.' },
      ],
    },
    {
      titulo: 'Visual e referências',
      porque: 'Saber o que agrada e o que não agrada evita refazer o design depois.',
      campos: [
        { k: 'identidade', t: 'single', compartilha: 'negocio', label: 'Como está a identidade visual hoje?', req: true,
          opts: ['Tenho logo e manual de marca', 'Tenho logo, mas sem manual', 'Tenho um logo antigo que quero refazer', 'Ainda não tenho identidade visual'] },
        { k: 'cores', t: 'text', label: 'Cores e fontes da marca, se já definidas' },
        { k: 'tom', t: 'multi', max: 3, label: 'Como o site deve soar?', hint: 'Escolha até 3.', req: true, opts: TOM },
        { k: 'sensacao', t: 'text', label: 'Em uma frase, o que a pessoa deve sentir ao abrir o site?' },
        { k: 'admira', t: 'textarea', label: 'Sites que você admira, de qualquer setor', hint: 'Cole os links e diga o que atrai em cada um: layout, cores, movimento, jeito de falar.', req: true },
        { k: 'naogosta', t: 'textarea', label: 'Sites ou estilos que você não quer', hint: 'O que não gosta também é informação.' },
      ],
    },
    {
      titulo: 'Técnico e marketing',
      porque: 'Evita surpresa na hora de publicar e de medir o resultado.',
      campos: [
        { k: 'dominio', t: 'single', label: 'A empresa já tem domínio?', req: true, opts: ['Sim, já tenho', 'Não, preciso registrar', 'Não sei'] },
        { k: 'dominionome', t: 'text', url: true, label: 'Qual domínio?', ph: 'empresa.com', showIf: (a) => a.dominio === 'Sim, já tenho' },
        { k: 'plataforma', t: 'single', label: 'Onde o site atual está hospedado?',
          opts: ['WordPress', 'Wix', 'Shopify', 'Webflow', 'Código próprio ou outra plataforma', 'Não tenho site hoje', 'Não sei'] },
        { k: 'acesso', t: 'single', label: 'Você tem acesso ao painel do domínio e da hospedagem?', opts: ['Sim', 'Não', 'Não sei'] },
        { k: 'ferramentas', t: 'multi', label: 'O que já está configurado?',
          opts: ['Google Analytics', 'Google Search Console', 'Google Tag Manager', 'Pixel da Meta', 'Google Meu Negócio', 'CRM', 'Nada disso'] },
        { k: 'crmqual', t: 'text', label: 'Qual CRM?', showIf: (a) => inclui(a, 'ferramentas', 'CRM') },
        { k: 'seo', t: 'textarea', label: 'Que buscas no Google você quer aparecer?', hint: 'Ex.: dentista em Orlando, aluguel de carro, contador para brasileiros.' },
        { k: 'ads', t: 'single', label: 'Pretende anunciar no Google ou na Meta?', opts: ['Sim, já anuncio', 'Sim, quando o site estiver pronto', 'Talvez depois', 'Não'] },
        { k: 'obs', t: 'textarea', label: 'Algo mais que a Hubber precise saber?' },
      ],
    },
  ],
};

export const BRIEFINGS = { marca: MARCA, site: SITE };

export const CONSENTIMENTO = 'A empresa autoriza a Hubber a usar estas informações para desenvolver o projeto.';

const MAX_CURTO = 400;
const MAX_LONGO = 4000;

export const todosCampos = (b) => b.passos.flatMap((p) => p.campos);
export const visivel = (c, a) => !c.showIf || c.showIf(a);

/* Formata um valor para leitura humana: lista vira "a, b", data vira dd/mm/aaaa. */
export function formatar(c, v) {
  if (Array.isArray(v)) return v.join(', ');
  const s = v == null ? '' : String(v).trim();
  if (c.t === 'date' && /^\d{4}-\d{2}-\d{2}$/.test(s)) { const [y, m, d] = s.split('-'); return `${d}/${m}/${y}`; }
  return s;
}

const vazio = (v) => (Array.isArray(v) ? v.length === 0 : String(v ?? '').trim() === '');

/**
 * Confere as respostas de um briefing. Devolve { faltam, invalidos, limpo },
 * onde `limpo` só tem campos visíveis, aparados e dentro do que a página
 * oferece. Quem chama usa `limpo` e ignora o resto do que o navegador mandou.
 */
export function validar(tipo, bruto) {
  const b = BRIEFINGS[tipo];
  const faltam = [];
  const invalidos = [];
  const limpo = {};
  const a = bruto && typeof bruto === 'object' ? bruto : {};

  for (const c of todosCampos(b)) {
    if (!visivel(c, limpo)) continue;
    let v = a[c.k];
    if (c.t === 'multi') {
      v = Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
      if (v.some((x) => !c.opts.includes(x)) || (c.max && v.length > c.max)) { invalidos.push(c.k); continue; }
    } else {
      v = typeof v === 'string' ? v.trim() : v == null ? '' : String(v).trim();
      if (v && c.t === 'single' && !c.opts.includes(v)) { invalidos.push(c.k); continue; }
      if (v && c.t === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) { invalidos.push(c.k); continue; }
      if (v && c.t === 'tel' && !/^[0-9+()\s.-]{8,40}$/.test(v)) { invalidos.push(c.k); continue; }
      if (v && c.t === 'date' && !/^\d{4}-\d{2}-\d{2}$/.test(v)) { invalidos.push(c.k); continue; }
      if (v.length > (c.t === 'textarea' ? MAX_LONGO : MAX_CURTO)) { invalidos.push(c.k); continue; }
    }
    if (vazio(v)) { if (c.req) faltam.push(c.k); continue; }
    limpo[c.k] = v;
  }
  return { faltam, invalidos, limpo };
}
