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
                                                 /api/projects/{projectId}/forms/{formId}/responses
```

Atenção ao nome da rota. O Swagger do JSYNQ, em `api.jsynq.com/api-docs`,
documenta `/answer` no singular, mas essa rota responde `404` para autenticação
por token. A que funciona é **`/responses`**, no plural. Outras entradas daquela
especificação também estão desatualizadas, como `/api/me`, que não existe. Ou
seja: confie no comportamento observado, não no Swagger.

A função valida tudo antes de repassar: campos obrigatórios, formato de e-mail e
telefone, datas que existem de verdade, e uma lista fechada de valores para cada
campo de escolha. Valor fora da lista é recusado com `422`, não repassado.

O navegador nunca vê o token nem os ids internos dos campos do CRM. O mapa de
campos fica em `FIELDS`, no topo de `api/connect-lead.js`.

Se o envio falhar, a página mostra um aviso e mantém o formulário preenchido.
Ela nunca diz "aplicação recebida" sem confirmação do servidor.

### Ao mexer no formulário

Os `value` dos campos de escolha na LP são iguais aos ids das opções no JSYNQ
(`viagem`, `10-50k`, `orlando`...). Ao adicionar ou renomear uma opção, mudar nos
dois lugares: no HTML em `src/connect/index.html` e na lista `options` do campo
correspondente em `api/connect-lead.js`.

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
