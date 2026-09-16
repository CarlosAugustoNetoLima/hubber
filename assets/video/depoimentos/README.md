# Depoimentos em vídeo (9:16)

Três vídeos verticais gravados pelos próprios médicos, com legenda queimada no
arquivo. Recebidos em `~/Downloads/videos nicolas/`. Recodificados para web em
09/09/2026.

## Arquivos

| arquivo | origem | duração | resolução | tamanho |
|---|---|---|---|---|
| `luiz-cruz.mp4` | `b8850a1c-83da-42e1-a261-6ab8e87d1f83.mp4` | 01:10 | 720×1280 | 8,3 MB |
| `icaro-rafael.mp4` | `ca70d1dd-39b2-430f-b5dd-250cf4745148.mp4` | 02:01 | 720×1280 | 13,8 MB |
| `joao-pedro.mp4` | `ef0b9c9b-3065-4f6d-a1c4-4ff7175b5bec.mp4` | 00:51 | 360×640 | 1,8 MB |

Encode: H.264 main, CRF 31, maxrate 850k, AAC 80k mono, `+faststart`.
`joao-pedro.mp4` foi só remuxado — a fonte já vinha em 360×640 a 282 kbps, e
reencodar não recupera qualidade. **É o vídeo mais fraco dos três; se existir
um master melhor, trocar.**

Pôsteres: JPEG 540×960 extraídos de quadros sem palavra de legenda na tela
(luiz-cruz 44,8 s · icaro-rafael 38,2 s · joao-pedro 19,2 s). Sem WebP: o
ffmpeg desta máquina não tem encoder webp.

Nada carrega antes do clique: `preload="none"` + pôster de 40–80 KB.

## Quem aparece

| vídeo | quem fala | perfil |
|---|---|---|
| `luiz-cruz` | Dr. Luiz Cruz — cirurgião, contorno corporal, Santa Fé do Sul/SP | `@drluizcruz` |
| `icaro-rafael` | Dr. Ícaro Samuel — cirurgião plástico, CEO Dream Clinic | `@dricarosamuel` |
| `icaro-rafael` | Dr. Rafael Sabino — cirurgião plástico | `@dr.rafaelsabino` |
| `joao-pedro` | Dr. João Pedro Alves — especialista em dor, São Paulo/SP | `@drjoaopedrodor` |

Os três vídeos trazem o selo de menção `@nicolaspalma` no topo.

## Falas usadas na página, e onde conferi-las

As frases foram lidas da legenda queimada, quadro a quadro (OCR). **Não foram
conferidas contra o áudio.** Timestamps para revisão:

- `luiz-cruz` 48–53 s — “Sábado à noite, ela tá vendendo consulta. E domingo,
  durante o dia, tá vendendo consulta.”
- `icaro-rafael` 18–23 s — “Transformar lead em consulta. Nos ajudar a crescer,
  a alavancar nossa clínica.” (Ícaro)
- `icaro-rafael` 70–77 s — “Esse é o grande diferencial: não é um trabalho igual
  pra todo mundo.” (Rafael, sobre personalização)
- `joao-pedro` 28–34 s — “Optei por fechar contrato com a Hubber. E até agora a
  experiência está sendo excelente.”

## Uso na página

Home, seção `S8b` — o baralho (`.deck`, `js/deck.js`): uma carta por
depoimento, vídeo à esquerda, fala à direita; a cena prende por N telas e
cada tela dá a carta seguinte. Para acrescentar um depoimento: mais um
`<li class="deck__card" data-deck-card>` em `src/index.html`, com vídeo,
pôster e fala — o JS conta as cartas e ajusta contador, barra e altura.

Material validado e autorizado pelo cliente em 09/09/2026 — sem ressalvas
na página. Os timestamps acima ficam como referência para localizar cada
fala no vídeo.

Ainda em aberto: faixa `.vtt` (a legenda existe só queimada na imagem) e a
versão EN da seção quando o espelho `/en/` existir.
