# LP /plastic/: estado para revisão

**Status:** prévia local. **Nada publicado, nada enviado, nenhuma campanha alterada.**

- **Branch:** `claude/plastic-lp`, num worktree separado em `~/projetos-web/hubber-site-plastic`.
  - Commit 1 = snapshot fiel do rascunho do Codex (`codex/hubber-campaign-funnel-review`).
  - Commits seguintes = a LP.
  - A pasta do Codex e o checkout original não foram tocados.
- **Prévia:** `node tools/dev-plastic.mjs` → http://127.0.0.1:4329/plastic/ (EN) e /plastic/pt/ (PT).
  - O CRM é simulado: o formulário funciona, mas só mostra no terminal o card que seria criado.
  - `MOCK=pending` simula o CRM fora do ar; `MOCK=error`, uma falha sem fila.

## O que foi implementado

- **Páginas:** `/plastic/` (inglês americano, principal) e `/plastic/pt/`, com seletor discreto EN/PT.
  - Geradas por `tools/plastic_page.py` a partir de uma única fonte de copy.
  - Ficam com `noindex` até você aprovar.
- **Narrativa:** abertura → clientes no Brasil + depoimentos → o problema (caminho do paciente) → o que a Agency faz → quem faz o quê → como começamos → Nicolas → perguntas → convite + formulário.
- **Formulário curto** (só dados comerciais): nome, e-mail profissional, telefone (opcional), clínica, site/Instagram (opcional), cidade/estado, função, objetivo principal, observação opcional (avisa para não incluir dados de paciente) e consentimento.
- **Backend `api/clinic-lead.js`:**
  - Reaproveita a integração existente: mesmo projeto, quadro e coluna do JSYNQ do diagnóstico, etiqueta Agência, responsável Nicolas, campo Origem `/plastic/` ou `/plastic/pt/`, e a mesma fila de reenvio (incluída no cron `drenar`).
  - Produto fixado em `agency` no servidor, **sem o piso de US$85k do Build**.
  - Respostas `delivered`, `pending` e `ignored`, no mesmo contrato do Codex.
- **Mensagens honestas:** a página só confirma o **recebimento**. Nunca diz que a reunião foi marcada. Não há horários nem links de agenda inventados.
- **Atribuição:** `/plastic/` registrado como landing da Agency no `campaign-context`. UTM, IDs da Meta, fbclid e caminho de entrada seguem validados até o card, rotulados como "não verificados".
- **Pixel:** a página entra na mesma política de consentimento.
  - O Lead só dispara com `delivered` + `eventId` do servidor.
  - Nenhum campo do formulário vai para a Meta.
  - O Pixel continua **vazio e desligado** (`js/campaign-pixel-config.js`): não reutilizei o HUBBER REELS e não inventei ID.
- **Mídia:**
  - 4 fotos reais de palco, com a marca do Instagram recortada.
  - 2 depoimentos recortados, carregados **só no clique** (5 a 7 MB cada, nada na abertura), com legenda em inglês.
  - Vídeos clínicos excluídos.

## Testes

- **Locais, automatizados:** `npm test` → **50/50**. São os 35 do Codex mais 15 do formulário da clínica: entrega, fila, erro, token ausente, isca de robô, campos fora da lista, produto fixo, campanha inválida, origem PT, formato do card, caminho sem JS.
- **Locais, no navegador** (prévia com CRM simulado):
  - Desktop 1280–1440px e celular 375px, sem rolagem horizontal.
  - Botão principal visível sem rolar no celular.
  - Validação do formulário e estado "recebido" com botão travado.
  - Card simulado conferido.
  - Vídeo baixado só no clique, com legenda ativa.
  - Parâmetros de campanha passando entre EN e PT.
- **Em produção: NENHUM.** A integração real com o JSYNQ, o recebimento do card e o Pixel em Test Events **não foram testados**, porque exigem deploy autorizado.

## Depende de você

1. **Aprovar layout e copy:** o projeto inteiro segue a regra "nunca site sem layout aprovado".
2. **Depoimentos:** decidir sobre MedGrowth, o tema de IA do depoimento A e o Dr. Rafael Sabino. Ver `DEPOIMENTOS.md`.
3. **Dublagem:** escolher a ferramenta e aprovar o custo. Nada foi processado.
4. **Pixel:** dataset dedicado aprovado (ID), com correspondência avançada automática e eventos automáticos **desligados**.
5. **Agenda (hubberdigital22@gmail.com):** conexão Google + JSYNQ ainda não confirmada. Até lá, a página só confirma o recebimento.
6. **Publicação:** após aprovar, fazer deploy, tirar o `noindex`, incluir no sitemap/llms.txt e fazer **um lead de teste controlado** até o card no JSYNQ.
7. **Revisar o trabalho do Codex** (commit 1) junto. Ele ainda não passou por teste de produção.
