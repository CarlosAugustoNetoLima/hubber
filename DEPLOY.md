# Deploy e integração com o JSYNQ

## As peças

| Arquivo | O que faz |
| --- | --- |
| `build.py` | Estampa `partials/` em `src/**/*.html` e grava o HTML final na raiz. Rodar depois de editar HTML. |
| `api/connect-lead.js` | Função serverless da Vercel. Recebe o formulário da Connect e cria o lead no CRM do JSYNQ. |
| `api/diagnostico.js` | Função serverless da Vercel. Recebe o diagnóstico do site e cria o card no CRM do JSYNQ. |
| `js/route.js` | A regra que escolhe a rota (Build, Agência, Core, Nutrição). Lida pelo navegador e pelo servidor. |
| `vercel.json` | Cabeçalhos de segurança (CSP, HSTS, etc.) e cache dos assets. |
| `package.json` | Só marca o projeto como ESM para a função serverless. Não há build de JS. |

O site é estático: o HTML da raiz é o que vai para o ar. A única parte dinâmica é `api/`.

## Um projeto só para todos os leads do site

**Todo lead que o site gera vai para o projeto `Hubber Site · Diagnósticos` no
JSYNQ.** Não criar projeto novo por landing page. Decidido em 16/09/2026, depois
que a Connect nasceu em projeto separado e teve de ser consolidada.

O que distingue a origem, dentro do mesmo quadro:

| Peça | Para que serve |
| --- | --- |
| Etiqueta no card | Vê a origem no quadro sem abrir o card |
| Campo `Origem` | Guarda o caminho ou o nome da LP, para filtro e relatório |
| Formulário do JSYNQ | Cada LP tem o seu, com os campos que só ela coleta |

Formulários são por projeto, então uma LP com campos próprios ganha **formulário
novo dentro do mesmo projeto**, nunca projeto novo. Hoje existem dois:

| Formulário | LP | Etiqueta |
| --- | --- | --- |
| Hubber Site · Diagnóstico de crescimento | `/diagnostico/` | Site · Diagnóstico |
| Hubber Connect · Aplicação de criador | `/connect/` | Connect · Influencers |

### Como adicionar a próxima LP

1. `create_project_form` no projeto `6aaac5d2f1edc4c698019729`, com os campos da LP e um campo `Origem`.
2. `create_project_label` com o nome da origem.
3. Nova função em `api/`, copiando o desenho de `api/diagnostico.js`: mesmo projeto, mesmo quadro, mesma coluna de entrada, etiqueta e formulário próprios.
4. Nunca `create_project`.

## Briefings (briefing.hubbermarketing.com)

Subdomínio com os briefings de cliente: `/` escolhe o tipo e `/marca/`, `/site/`,
`/onboarding/` e `/designer/` são os formulários em etapas. É página privada
(`noindex`, `robots.txt` com `Disallow: /`).

| Briefing | Origem das perguntas | Destaque no card |
|---|---|---|
| marca | artifact original da Hubber | Objetivo principal |
| site | escrito para o projeto (sem pergunta de preço: o briefing é de contrato fechado) | Tipo de site |
| onboarding | formulário do Google "Briefing de Onboarding" | WhatsApp dos leads |
| designer | formulário do Google "Briefing Identidade Visual" | Nome da marca |

No onboarding e no designer só a identificação é nossa (os formulários do Google
não pediam quem respondia). As perguntas que o onboarding repete da marca saem de
`igualMarca()` em `js/briefing-perguntas.js`: o enunciado é o da marca, não o do
Google, para a resposta poder ser reaproveitada entre os dois.

- **Perguntas:** `js/briefing-perguntas.js`, fonte única. A página desenha as
  etapas a partir dele e `api/briefing.js` valida com o mesmo módulo. Mexer na
  pergunta é mexer num arquivo só.
- **Envio:** `POST /api/briefing` cria **um card por resposta** no projeto
  `Hubber · Briefings` (`6abf3ce857b946818a0ced8c`), coluna `Recebido`, com a
  Larissa como responsável. Contato e destaque do tipo viram campos do CRM e
  a descrição leva as respostas formatadas: resumo no topo, uma seção por etapa,
  pergunta em negrito cinza e resposta embaixo, opções em lista e links
  clicáveis. A descrição do JSYNQ é uma lista de blocos BlockNote em JSON, por
  isso `montarDescricao` em `api/briefing.js` monta blocos, não texto corrido
  (texto corrido chega sem nenhum peso). Pergunta não respondida não aparece.
  Passa pela mesma fila
  (`_fila.js`) e pelo cron (`drenar.js`) dos outros formulários.
- **Projeto separado dos leads de propósito:** quem preenche já é cliente. O tipo
  se distingue por etiqueta (`Briefing · Marca`, `Briefing · Website`,
  `Briefing · Onboarding`, `Briefing · Designer`) e por formulário, dentro do
  mesmo quadro.
- **Reaproveitar dados entre briefings:** ao enviar um briefing, a página guarda
  em `sessionStorage` (só aquela aba, some ao fechá-la) as respostas das perguntas
  marcadas com `compartilha` em `js/briefing-perguntas.js`, por 15 minutos
  (`SESSAO_MIN` em `js/briefing.js`). No outro briefing, a abertura mostra um
  painel listando tudo e só preenche com o ok da pessoa; ela pode seguir sem
  preencher ou apagar na hora. Nada passa pelo servidor nem por busca de e-mail,
  de propósito: qualquer um digitaria o e-mail de outro e veria os dados dele.
  Só vale marcar `compartilha` quando enunciado e opções são idênticos nos dois
  briefings (`tom`, `regiao`, `provas` e `objetivo` têm a mesma chave e perguntam
  coisas diferentes); em dúvida, use `igualMarca()`. Rascunho existente tem
  prioridade sobre a oferta. Data de nascimento (`diames`) nunca é compartilhada.
- **Briefing novo:** entrada em `BRIEFINGS`, etiqueta e formulário no JSYNQ, uma
  linha em `TIPOS` no `api/briefing.js`, card no hub (`src/briefing/index.html`)
  e página em `src/briefing/<slug>/index.html`.
- **Domínio:** adicionar `briefing.hubbermarketing.com` ao projeto na Vercel e o
  CNAME no DNS. O `middleware.js` reescreve por host, como no reels.
- **Responsável:** `JSYNQ_BRIEFING_RESPONSAVEL_ID` troca quem recebe o card.
- **Fila:** o item pendente é `{ tipo, respostas }` já validado, sob
  `pendentes/briefing/`.

## Publicar na Vercel

1. Transformar a pasta em repositório e subir para o GitHub.
2. Na Vercel, importar o repositório. Não há framework nem comando de build: o
   *Root Directory* é a raiz e a saída é a própria raiz.
3. Configurar a variável de ambiente abaixo antes do primeiro envio de formulário.

## A variável de ambiente

Uma só, em **Project Settings → Environment Variables**:

```
JSYNQ_API_TOKEN
```

O mesmo token serve para os dois formulários.

As opcionais já têm padrão no código e só importam se o projeto ou o formulário
do CRM mudar de lugar:

| Formulário | Variáveis |
| --- | --- |
| Connect | `JSYNQ_CONNECT_PROJECT_ID`, `JSYNQ_CONNECT_FORM_ID`, `JSYNQ_CONNECT_BOARD_ID`, `JSYNQ_CONNECT_COLUMN_ID`, `JSYNQ_CONNECT_LABEL_ID` |
| Diagnóstico | `JSYNQ_DIAG_PROJECT_ID`, `JSYNQ_DIAG_FORM_ID`, `JSYNQ_DIAG_BOARD_ID`, `JSYNQ_DIAG_COLUMN_ID`, `JSYNQ_DIAG_LABEL_ID` |

### Como gerar o token

Nas configurações de conta do JSYNQ, seção **Tokens de API**. A rota por trás é
`POST /api/users/{userId}/api-token/generate`.

O propósito precisa ser **Automação** ou **MCP / Assistente IA**, com escrita em
projetos. O propósito "Geral (orientado à leitura)" não grava.

**O token define quem assina o lead.** O reporter de cada card é o dono do token
que criou o card, não o leader do projeto. Medido em 16/09/2026 nos dois
projetos, ambos com o Carlos como leader: cards criados com o token da Larissa
entraram com a Larissa como reporter.

Uma versão anterior deste arquivo dizia o contrário. Estava errado. Na prática:
o token guardado na Vercel precisa ser o **do Carlos**, senão os leads do site
entram assinados por outra pessoa. O leader do projeto continua sendo o Carlos,
mas ele sozinho não carimba nada.

O token vai direto do JSYNQ para o painel da Vercel. Ele não deve passar por
chat, e-mail, commit ou qualquer arquivo do repositório: quem tem o token
consegue escrever no workspace inteiro.

## Como o lead chega no CRM

```
formulário da LP  →  POST /api/connect-lead  →  POST https://api.jsynq.com
                                                 /api/projects/{projectId}/cards
```

A função valida tudo antes de repassar: campos obrigatórios, formato de e-mail e
telefone, datas que existem de verdade, e uma lista fechada de valores para cada
campo de escolha. Valor fora da lista é recusado com `422`, não repassado.

O navegador nunca vê o token nem os ids internos dos campos do CRM. O mapa de
campos fica em `FIELDS`, no topo de `api/connect-lead.js`.

Se o envio falhar, a página mostra um aviso e mantém o formulário preenchido.
Ela nunca diz "aplicação recebida" sem confirmação do servidor.

### Por que o card é criado direto, e não pela rota de formulário

Existe uma rota de resposta de formulário, mas ela **não funciona com token de
API**. O caminho até essa conclusão, para ninguém repetir:

- O Swagger em `api.jsynq.com/api-docs` documenta `POST .../forms/{formId}/answer`.
  Essa rota responde `404` para token. A que existe é `/responses`, no plural.
  Aquela especificação tem outras entradas mortas, como `/api/me`. Confie no
  comportamento observado, não nela.
- `/responses` aceitou exatamente um envio e passou a responder `400 Invalid
  request data` para todo o resto, inclusive para o mesmo corpo que tinha
  funcionado. Não é permissão: com o mesmo token, `POST .../lead-sources`
  grava normalmente, e leitura de projeto, formulário e workspace responde 200.
  Também não é o corpo: o conector MCP aceita o mesmo JSON.

`POST /api/projects/{projectId}/cards` é estável e produz um card idêntico ao
que o formulário hospedado gera: mesmos campos, mesma coluna, e o contato criado
a partir dos campos marcados com `crmKey`.

Dois detalhes que custaram caro e é melhor não mexer:

- **Datas vão em `dd/mm/aaaa`**, o formato que a pessoa digitou. Em ISO o JSYNQ
  grava a string com aspas dentro dela, tipo `"2026-10-20T00:00:00.000Z"`.
- **O `fieldId` é sempre o id do campo do formulário**, nunca o `crmKey`, e os
  dados de contato não vão no topo do card. O JSYNQ já deduz o contato pelo
  `crmKey` que o campo tem no formulário. Mandar nos dois lugares faz o card
  listar "Contact name", "Email" e "Phone" duas vezes cada.

### O CRM deduplica contato por e-mail

Ao criar um card cujo e-mail já existe no CRM, o JSYNQ **reaproveita o contato e
a empresa existentes** e sobrescreve os campos de `crmKey` com o que já estava
guardado, em vez de gravar o que veio no envio. Medido em 16/09/2026: um card da
Connect enviado com o mesmo e-mail de um card de diagnóstico anterior saiu com o
nome, o telefone e a empresa do primeiro.

Na prática: quem preencher duas LPs com o mesmo e-mail vira um contato só, e
dados de contato atualizados no segundo envio não sobem sozinhos. Os campos
próprios de cada formulário são gravados normalmente, então nada se perde; o que
não atualiza é nome, telefone e empresa. Conferir no card antes de ligar.

### O anexo em PDF

O campo de mídia kit aceita um PDF de até 3 MB. O arquivo viaja em base64 dentro
do mesmo JSON do formulário, e o servidor faz duas chamadas depois de criar o
card:

```
POST /api/projects/{projectId}/attachments          (multipart, campo "file")
POST /api/projects/{projectId}/cards/{cardId}/attachments/{attachmentId}
```

A primeira sobe para o S3 e devolve o anexo **sob a chave `newAttachment`**, não
`attachment`. Ler a chave errada não dá erro: o upload responde 200, o arquivo
fica no S3 e nunca aparece no card.

O servidor confere a assinatura do arquivo (`%PDF-`), não a extensão nem o
content-type, que qualquer cliente pode forjar. O limite de 3 MB existe porque a
função da Vercel aceita no máximo 4,5 MB de corpo e o base64 infla cerca de 33%.

Se o anexo falhar, o lead **não** se perde: o card já foi criado e a falha fica
no log, com o id do card, para a equipe pedir o PDF depois.

### A fila: por que o lead não se perde

O JSYNQ é o canal onde a equipe recebe, mas é serviço de terceiro e sai do ar.
Por isso a ordem, nos **dois** formulários do site, é **guardar primeiro,
entregar depois**:

1. A submissão vai para um Blob privado, antes de tocar no CRM
2. Tenta o JSYNQ, com três tentativas para falha de rede e 5xx
3. Deu certo: sai da fila
4. Deu errado: **fica pendente** e é reenviada até entrar

Cada formulário tem a sua fila, separada por prefixo: `pendentes/connect/` e
`pendentes/diagnostico/`. A entrega de cada um mora numa função exportada só,
`entregarLead` e `entregarDiagnostico`, usada tanto pelo envio ao vivo quanto
pelo reenvio, para os dois caminhos não divergirem com o tempo.

O reenvio tem dois caminhos, para não depender de um só. Cada submissão nova
drena dois pendentes da fila dela, o que resolve sozinho enquanto houver
movimento no site. E `/api/drenar` faz o mesmo nas duas filas uma vez por dia
pelo cron, para o caso sem movimento.

Quando o CRM recusa mas a submissão **está na fila**, a página responde sucesso:
a aplicação foi de fato recebida, e dizer que falhou faria a pessoa desistir ou
preencher de novo, criando card repetido. No diagnóstico isso quer dizer que a
pessoa continua vendo a rota dela, que é o que ela veio buscar; a rota é
recalculada no reenvio em vez de guardada, porque é função pura das respostas.

O armazenamento é **privado** (`access: 'private'`): os arquivos têm nome,
e-mail e telefone, e sem o token não há URL que abra.

**Enquanto não houver um Blob conectado ao projeto, tudo isso é no-op** e a
função se comporta como antes. Testado com a fila desligada e com a fila
quebrada: nos dois casos o formulário continua funcionando.

Duas variáveis, ambas no painel da Vercel:

| Nome | Para quê |
| --- | --- |
| `BLOB_READ_WRITE_TOKEN` | criada sozinha ao conectar um Blob store ao projeto |
| `CRON_SECRET` | protege `/api/drenar`. Sem ela a rota recusa, de propósito |

Um risco conhecido: se a remoção da fila falhar depois de o CRM aceitar, o item
é reenviado e vira card repetido. Preferimos repetido a perdido.

O que ainda pode perder dado: o Blob e o JSYNQ fora **ao mesmo tempo**. Aí a
pessoa vê o aviso de falha e o log guarda nome, e-mail e telefone para a equipe
retomar à mão. Não há o que fazer do lado do servidor nesse caso.

**Formulário novo que grave no CRM precisa de três coisas**: chamar `guardar`
antes de tentar, expor a entrega como função exportada, e entrar na lista
`filas` de `api/drenar.js`. Sem a terceira, a fila dele só anda quando o próprio
formulário recebe uma submissão nova.

### Ao mexer no formulário

Os `value` dos campos de escolha na LP são iguais às chaves de `options` em
`api/connect-lead.js` (`viagem`, `10-50k`, `orlando`...), e o valor de cada chave
é o rótulo que aparece no card. Ao adicionar ou renomear uma opção, mudar nos
dois lugares: no HTML em `src/connect/index.html` e na lista `options` do campo
correspondente na função.

## O diagnóstico do site

```
/diagnostico/  →  POST /api/diagnostico  →  POST https://api.jsynq.com
                                             /api/projects/{projectId}/cards
```

Projeto no CRM: **Hubber Site · Diagnósticos**. Cada card é uma empresa; a coluna
de entrada é "Leads". O contato e a empresa são criados pelo JSYNQ a partir dos
campos marcados com `crmKey`, como na Connect.

### A rota é decidida no servidor

`js/route.js` guarda a regra em um arquivo só, importado pelos dois lados:
o navegador para mostrar a devolutiva na hora, a função para gravar no card.
O campo `rota` que vier no corpo do POST é **ignorado** e recalculado. Sem isso,
bastaria editar o payload para entrar no CRM como lead qualificado.

Ao mudar a regra, mudar só `js/route.js`. Se a lógica for duplicada, a pessoa lê
"Core" na tela e o card sai "Build".

### Funciona sem JavaScript

O `<form>` tem `action="/api/diagnostico"`, então o envio nativo do navegador
chega na mesma função. Ela responde conforme o `content-type` que recebeu:

| Entrada | Resposta |
| --- | --- |
| `application/json` (fetch) | JSON com `ok`, `rota` e `notas` |
| `application/x-www-form-urlencoded` (POST nativo) | HTML com a devolutiva da rota |
| urlencoded e inválido | `303` de volta para `/diagnostico/` |

A página HTML de resposta é montada na própria função porque o site é estático:
servido pela CDN, ele não teria como reagir a um redirect com a rota.

### Quando o CRM não responde

Se a resposta entrou na fila, a página mostra a devolutiva normalmente: o dado
está a salvo e será gravado depois, então a rota é o que a pessoa veio buscar.
Ver "A fila: por que o lead não se perde".

Só quando nem a fila aceitou é que a página **não** mostra a devolutiva: o botão
volta ao normal, o formulário continua preenchido e a caixa de erro pede para
tentar de novo. Antes o erro era engolido e a pessoa via "recebemos" com o lead
perdido.

No servidor, toda falha registra empresa, nome, e-mail, telefone e rota no log,
para a equipe retomar o contato à mão se o JSYNQ estiver fora do ar.

### Ao mexer no formulário

Os `value` dos campos de escolha em `src/diagnostico/index.html` são iguais às
chaves de `options` em `api/diagnostico.js` (`85-200k`, `time-interno`,
`a-definir`...), e o valor de cada chave é o rótulo que aparece no card. Mudar
nos dois lugares. As chaves de faturamento, verba, papel, estrutura, gargalo e
time também alimentam `js/route.js`: renomear uma delas sem atualizar os três
arquivos muda silenciosamente a rota de quem responde.

Campo novo precisa existir também no formulário do JSYNQ, para ter um `fieldId`.
`list_project_forms` devolve os ids.

## Content Security Policy

A CSP em `vercel.json` libera cada script inline pelo hash do conteúdo. Ao editar
um script inline, o hash muda e o navegador passa a bloquear o script em
produção, sem erro visível.

O `build.py` avisa quando isso acontece e já imprime o hash novo para colar no
`script-src`. Ele sai com código 1 nesse caso, então dá para usar como checagem
antes de publicar.

## Testar

```bash
python3 build.py
```

A função serverless não roda no servidor estático local. Para testá-la de ponta a
ponta, usar `vercel dev` com o token no `.env.local`, ou testar direto em um
deploy de preview da Vercel.

No servidor estático local o `POST /api/diagnostico` responde `501`. Isso não é
inútil: é exatamente o caminho de falha, e serve para conferir que a página
mostra o aviso de erro em vez de fingir que recebeu.
