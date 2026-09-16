# Deploy e integração com o JSYNQ

## As peças

| Arquivo | O que faz |
| --- | --- |
| `build.py` | Estampa `partials/` em `src/**/*.html` e grava o HTML final na raiz. Rodar depois de editar HTML. |
| `api/connect-lead.js` | Função serverless da Vercel. Recebe o formulário da Connect e cria o lead no CRM do JSYNQ. |
| `vercel.json` | Cabeçalhos de segurança (CSP, HSTS, etc.) e cache dos assets. |
| `package.json` | Só marca o projeto como ESM para a função serverless. Não há build de JS. |

O site é estático: o HTML da raiz é o que vai para o ar. A única parte dinâmica é `api/`.

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

Duas opcionais, já com padrão no código, úteis se um dia o projeto ou o
formulário do CRM mudar: `JSYNQ_PROJECT_ID` e `JSYNQ_FORM_ID`.

### Como gerar o token

Nas configurações de conta do JSYNQ, seção **Tokens de API**. A rota por trás é
`POST /api/users/{userId}/api-token/generate`.

O propósito precisa ser **Automação** ou **MCP / Assistente IA**, com escrita em
projetos. O propósito "Geral (orientado à leitura)" não grava.

O token é por usuário, mas **não é ele que define quem assina o lead**: o JSYNQ
carimba o reporter do card a partir do **leader do projeto**, que é o Carlos.
Testado: um envio feito com o token de outra pessoa entrou com o Carlos como
reporter mesmo assim.

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
que o formulário hospedado gera: mesmos 13 campos, mesma coluna, mesma origem de
lead, e o contato criado a partir dos campos marcados com `crmKey`.

Dois detalhes que custaram caro e é melhor não mexer:

- **Datas vão em `dd/mm/aaaa`**, o formato que a pessoa digitou. Em ISO o JSYNQ
  grava a string com aspas dentro dela, tipo `"2026-10-20T00:00:00.000Z"`.
- **O `fieldId` é sempre o id do campo do formulário**, nunca o `crmKey`, e os
  dados de contato não vão no topo do card. O JSYNQ já deduz o contato pelo
  `crmKey` que o campo tem no formulário. Mandar nos dois lugares faz o card
  listar "Contact name", "Email" e "Phone" duas vezes cada.

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

### Ao mexer no formulário

Os `value` dos campos de escolha na LP são iguais às chaves de `options` em
`api/connect-lead.js` (`viagem`, `10-50k`, `orlando`...), e o valor de cada chave
é o rótulo que aparece no card. Ao adicionar ou renomear uma opção, mudar nos
dois lugares: no HTML em `src/connect/index.html` e na lista `options` do campo
correspondente na função.

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
