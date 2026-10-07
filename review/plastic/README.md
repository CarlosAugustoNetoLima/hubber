# LP /plastic/: revisão de conversão (07/out)

**Status:** versão de revisão, só local. **Não publicada.** Nenhum anúncio, orçamento ou público da Meta foi criado ou alterado. Nenhuma mensagem enviada a prospects, nenhum evento de agenda criado.

- **Branch:** `claude/plastic-publish`, no worktree `~/projetos-web/hubber-site-plastic`. Commit local, sem push (push na `main` = deploy).
- **Prévia:** `node tools/dev-plastic.mjs` → http://127.0.0.1:4329/plastic/ e `/plastic/pt/`. O CRM é simulado: o card que seria criado aparece no terminal.
- **Prints:** `review/plastic/prints/` (desktop 1440 e celular 390).

## Implementado

**Mensagem**
- **Hero:** eyebrow "Marketing for U.S. plastic surgery practices"; título "Make your expertise the reason patients reach out."; apoio sobre um plano único (conteúdo, anúncios, site, follow-up); CTA "Talk to Nicolas"; microcopy "A 30-minute conversation about your practice. No cost, no obligation."
- **Frases absolutas trocadas:**
  - "Most practices don't lose patients…" virou "Where interest can get lost…".
  - "so no inquiry sits unanswered" saiu; agora é "help them reply and keep track".
  - "Guaranteed results" na tabela virou "Big promises, vague scope".
- **Garantia × responsabilidade:** o FAQ e a nota de escopo dizem que pacientes, cirurgias e faturamento **não são garantidos**, e que a Hubber **responde pelo escopo combinado** (fazer, medir, revisar).
- **Escopo em 5 etapas:** encontrar, confiar, contatar, organizar contatos, medir/ajustar.
  - Cada etapa tem a sua linha de serviços.
  - 16 conteúdos/mês como obrigação.
  - Agentes de IA, ligações com IA e integrações complexas ficam fora do padrão.
  - Sem preços.
- **Seção de conteúdo (a sua, preservada):** mantidos título, intro, vídeos e "100+". Os 3 pontos agora separam:
  1. 16 conteúdos/mês incluídos; formato é ponto de partida, não garantia.
  2. Gravação presencial conforme local e escopo; **na Flórida pode vir como bônus**, no resto é caso a caso.
  3. Diária de conteúdo = serviço à parte, com escopo e orçamento próprios.
- **FAQ do time:** Nicolas lidera o trabalho com clínicas nos EUA; o time é brasileiro, remoto, no fuso do cliente. Mesma frase da página Sobre, sem escritório, número de pessoas ou horário inventado. Nova pergunta: sem newsletter nem SMS promocional.
- **Tabela genérica × Hubber:** cabeçalho magenta com o logo Hubber e coluna em destaque. No celular vira cards.

**Prova**
- **Depoimento em destaque logo abaixo do hero:** Dr. Ícaro Samuel · Plastic surgeon · Brazil · Client.
  - A citação é literal da tradução fiel ("…it has to be personalized.").
  - Leva o aviso "translated from Portuguese" e um link para o vídeo.
- **MedGrowth:** frase nova nos depoimentos: *"In these recordings Nicolas introduces the surgeons as clients of his agency, and they call it MedGrowth. Hubber is led by the same founder."* Afirma só o que está no vídeo e na página Sobre: não diz que houve troca de nome nem incorporação. **Confirmar com você** (ver pendências).

**Formulário**
- **Obrigatórios:** nome completo, e-mail profissional, nome da clínica, cidade/estado e função.
- **Opcional e visível:** site/Instagram.
- **"Add a few details" (fechado):** telefone, objetivos **com múltipla escolha** e observação.
- **Avisos no formulário:**
  - quadro "What happens next": resposta por e-mail, envio não marca reunião, sem newsletter/SMS, não incluir dados de pacientes;
  - consentimento restrito a este pedido.
- **Botões padronizados:** "Talk to Nicolas" (topo e hero) e "Request a conversation with Nicolas" (envio).
- **Backend `api/clinic-lead.js`:**
  - **Validação no servidor:** campos obrigatórios e listas fechadas de função e objetivos.
  - **Card no JSYNQ:** etiquetas **Agência + HUBBER ADS — AGENCY**, responsável Nicolas.
  - **Próxima ação no card:** "Nicolas responde por e-mail… Agenda não conectada."
  - **Mantidos:** produto agency fixo, origem `/plastic/`, UTMs, IDs de campanha/conjunto/anúncio e o contrato delivered / pending / ignored.

## Testado

- **Automático:** `node --test tests/clinic-lead.test.js` → **17/17**.
  - Cobre entrega, fila, CRM fora do ar, token ausente, isca de robô, campos fora da lista, múltiplos objetivos, obrigatórios, etiquetas, próxima ação e caminho sem JS.
- **No navegador (prévia local, CRM simulado):**
  - envio vazio destaca os 5 obrigatórios e foca o primeiro;
  - telefone inválido abre "Add a few details" e foca o campo;
  - envio válido com 2 objetivos gera o card simulado com as 2 etiquetas e a próxima ação; o botão fica travado; a mensagem diz que **nenhuma reunião foi marcada**.
- **Larguras:**
  - 375, 390 e 430 px, além de 1440: sem rolagem horizontal.
  - Botão do hero na primeira tela: 503px de 844 em 390×844; 564px de 812 em 375×812.
- **Lighthouse mobile, laboratório, prévia local:**
  - **Acessibilidade 100** (2 contrastes corrigidos), Boas práticas 100.
  - **Performance 80–89**, variando entre execuções: o servidor local não comprime arquivos. LCP 2,9–4,0 s, TBT 0 ms, CLS 0,02.
  - **SEO 69:** é o `noindex` proposital da LP de tráfego pago.
- **Produção (antes desta revisão):** E2E com contato interno TESTE → 200 delivered, card **HSD-57** no projeto "Hubber Site · Diagnósticos", coluna Leads, responsável Nicolas.

## Pendente / depende de você

1. **Aprovar esta versão** para publicar. Depois de publicar: novo lead TESTE em produção para confirmar a etiqueta HUBBER ADS — AGENCY e a próxima ação no card real.
2. **MedGrowth:** confirme se a frase acima está correta. Também: os "100+ cirurgiões" e os clientes listados são da MedGrowth, da Hubber ou dos dois? Hoje a página diz "Hubber clients".
3. **Dr. Rafael Sabino:** confirmar a autorização de uso.
4. **"100+ cirurgiões":** a fonte é a sua mensagem de 07/out; não há documento.
5. **Bônus de gravação na Flórida:** confirmar que existe nesses termos ("pode vir como bônus").
6. **Pixel:** sem dataset aprovado, segue **desligado**. Falta o ID do conjunto de dados dedicado à Hubber. O Lead só dispararia com `delivered`.
7. **Agenda:** não conectada. A página e o card só falam em resposta por e-mail.
8. **PageSpeed de produção:** a cota diária da API pública acabou hoje. Não há dado de campo (CrUX) para esta URL nova.
9. **Limitação:** não há proteção contra duplicidade no servidor. Hoje existem a trava no navegador e a isca de robô.
10. **Card HSD-57 (TESTE)** continua no JSYNQ. Pode arquivar quando quiser.
11. **Dublagem:** não processada (ver `DEPOIMENTOS.md`).
