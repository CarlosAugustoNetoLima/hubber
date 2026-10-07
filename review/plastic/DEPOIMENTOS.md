# Depoimentos: transcrição, tradução e estado da dublagem

Revisão interna da LP `/plastic/`. Nada aqui foi publicado.

## Quais vídeos são depoimentos

Identificados pelo conteúdo (áudio transcrito + quadros), não pelo nome do arquivo.

| Arquivo original (Downloads) | O que é | Usado na página? |
|---|---|---|
| `nicolasjpalma_1743022800_…mp4` (70s) | **Depoimento A**: Dr. Luiz Cruz, gravado com Nicolas no evento Experts Club | Sim, versão recortada (53,7s) |
| `nicolasjpalma_1743109832_…mp4` (121s) | **Depoimento B**: Dr. Ícaro Samuel e Dr. Rafael Sabino (cirurgiões plásticos), com Nicolas | Sim, versão recortada (110,3s) |
| `TOPO03.mp4` | Conteúdo clínico: sequência de cirurgias de paciente pós-bariátrica, com imagens corporais | **Não** (paciente identificável, procedimento) |
| `FUNDO03.mp4` | Anúncio de lipo HD da clínica do Dr. Ícaro Samuel, com cenas de cirurgia | **Não** |
| `TOPO02.mp4` | Conteúdo clínico: técnica de prótese em 15 minutos, centro cirúrgico | **Não** |
| `Icaro samuel.mp4` | Cenas de cirurgia e "antes" com nudez parcial | **Não** |

Os arquivos originais não foram alterados. As versões web estão em `assets/video/plastic/`.

## Quem fala (evidência)

- **A**: Nicolas apresenta "doutor Luiz Cruz" (0:10). Nicolas faz a pergunta no meio (0:41) e diz "Que legal" no fim.
- **B**: o próprio vídeo mostra o nome na tela: **Dr. Ícaro Samuel, Cirurgião Plástico** (aos 12s) e **Dr. Rafael Sabino, Cirurgião Plástico** (aos 66s).
  - **Ícaro:** 0:10–1:02 e 1:16–1:50. Os quadros mostram ele gesticulando nesses trechos.
  - **Rafael:** 1:02–1:16.
  - **"Não adianta modelar o Ícaro":** quem diz é o próprio Ícaro, aconselhando outros cirurgiões a não copiar ninguém.

## O que foi cortado na versão web (e por quê)

- **A, 0:00–0:05,6:** teaser editado que repete a frase do próprio médico ("É sábado à noite…"). A frase aparece inteira depois.
- **A, a partir de 0:59,3:** fechamento de anúncio do Nicolas ("clica no botão aqui embaixo… com a MedGrowth"). Não faz sentido na página.
- **B, a partir de 1:50,3:** idem ("clicar no botão aí embaixo… escalar com esses dois gigantes").
- **Todos os vídeos, faixa superior:** marca do Instagram ("Nicolas Palma @nicolasjpalma"), recortada.

Nenhuma fala de médico foi cortada ou alterada.

## ⚠️ Pontos que só você pode decidir

1. **Os médicos falam "MedGrowth", não "Hubber".** A tradução mantém "MedGrowth", porque trocar seria pôr na boca deles algo que não disseram. Na página, a legenda diz apenas: *"the surgeons refer to MedGrowth"*. Se a relação MedGrowth → Hubber for verdadeira e você quiser explicá-la, me passe a frase exata.
2. **Depoimento A é sobre IA vendendo consultas.** Agentes de IA estão **fora** do escopo padrão da Agency. A legenda do vídeo avisa isso. Alternativa: tirar o A e deixar só o B, que fala de tráfego, criativo, lead→consulta e personalização (está dentro do escopo).
3. **Dr. Rafael Sabino não está na lista de clientes que você confirmou.** Nicolas o apresenta como cliente no vídeo, e você disse que os médicos dos depoimentos autorizaram. Confirme que isso inclui ele.
4. **Legendas em português gravadas na imagem.** Os vídeos originais têm palavras em português no centro do quadro, da edição do Instagram. Elas ficam por baixo da legenda em inglês, e ficariam por cima de uma dublagem. Para a versão dublada, o ideal é a matriz **sem** essas legendas (com quem editou).

## Tradução fiel, lado a lado

A tradução completa, bloco a bloco, está em `tools/plastic_testimonials.json`, e aparece na página em "Read the full transcript". As legendas sincronizadas em inglês estão em:

- `assets/video/plastic/testimonial-a.en.vtt` (15 trechos, tempos do vídeo recortado)
- `assets/video/plastic/testimonial-b.en.vtt` (27 trechos)

Critérios da tradução:
- **Sem melhorar o discurso:** "vendendo consulta" ficou *selling consultations*, e "tráfego" ficou *paid traffic*.
- **Ressalvas e intensidade mantidas:** "com tão pouco tempo que eu estou" ficou *in the short time I've been with them*.

As transcrições brutas do Whisper (large-v3-turbo, local) estão em `transcricoes-originais/`. Corrigi à mão "Mad Growth"/"MedGrow" para **MedGrowth**, e "tráfico" para **tráfego**.

## Estado da dublagem: **PENDENTE (não processada)**

Nada foi processado nem contratado. A página usa **o vídeo original em português com legenda em inglês**. Quando houver dublagem aprovada, o selo previsto é: *"English AI dub of the original Portuguese testimonial."*

Ferramentas avaliadas. Preços de páginas de terceiros, **conferir no site oficial antes de comprar**:

| Ferramenta | Sincronia labial | Custo estimado | Observação |
|---|---|---|---|
| **HeyGen** (Video Translate) | Sim | ~5 créditos/min com lip-sync; plano Creator ~US$29/mês (600 créditos) | Total de vídeo ≈ 2,7 min, cabe com folga no plano de entrada. Exige assinatura. |
| **ElevenLabs** (Dubbing) | **Não**, só áudio | ~US$0,50/min (API) ou Creator US$22/mês | Voz boa, mas a boca não acompanha. |
| **Higgsfield** (ferramenta `dubbing` do MCP) | A confirmar | Desconhecido | Já configurado aqui, mas o servidor está desconectado agora. Na memória consta pagamento recusado na conta. |

Fontes: [Creatify — HeyGen pricing 2026](https://creatify.ai/blog/heygen-pricing-(2026)-plans-and-what-you-ll-actually-pay), [Perso.ai — AI dubbing pricing 2026](https://perso.ai/blog/ai-dubbing-pricing-2026-cost-per-minute-compared), [BibiGPT — dubbing tools 2026](https://bibigpt.co/blog/posts/ai-video-dubbing-translation-tools-2026-guide).

Riscos técnicos:
- **B tem três pessoas em cena e falas curtas alternadas.** Ferramentas de lip-sync erram mais nesse caso, porque podem sincronizar a boca de quem não está falando.
- **Legendas gravadas na imagem** (ver ponto 4).

### Instruções de produção (quando aprovado)

1. Use os vídeos **recortados** (`assets/video/plastic/testimonial-a.mp4` e `-b.mp4`) ou, melhor, as matrizes sem legenda gravada, com os mesmos cortes.
2. Forneça à ferramenta o roteiro em inglês dos arquivos `.vtt`, em vez da tradução automática dela. Isso garante a tradução fiel revisada.
3. Use a voz clonada de cada médico, só com a autorização de adaptação de voz e lábios que você confirmou.
4. Revise quadro a quadro: boca do falante certo, nomes ("MedGrowth", "Ícaro", "Rafael") pronunciados corretamente, nenhuma frase acrescentada.
5. Coloque o selo "English AI dub of the original Portuguese testimonial." na página e no próprio vídeo.
6. Só publique depois da sua revisão. O arquivo original permanece guardado.
