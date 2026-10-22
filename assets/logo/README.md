# Kit de marca — arquivos originais

Esta pasta guarda o **kit de marca bruto**, como veio do Google Drive. É a
fonte de onde saíram os arquivos de [`../brand/`](../brand/) — que são as versões
convertidas para `currentColor` e realmente usadas pelo site.

Os dois conjuntos **não** são duplicatas: `../brand/` tem poucas peças,
reescritas e em uso; aqui ficam as 30 originais, com as variações que não foram
para o site.

## Procedência

| | |
|---|---|
| Origem | Google Drive → `IDENTIDADE VISUAL HUBBER GRUPO CINNAMON` |
| Recuperado em | 22/10/2026, da pasta `hubber-site/` dentro do repositório privado `hubberdigital22-beep/huber-web` |
| Motivo | Ao desacoplar o site da conta `hubberdigital22-beep` (22/10/2026), a cópia de lá foi removida. Esta era a única cópia desses arquivos. |

Os nomes com acento (`HUBBER_SÍMBOLO`) são os originais do Drive — mantidos
como estavam.

## Inventário

30 arquivos, **25 conteúdos únicos** (cinco são renomeados, ver abaixo).

| Arquivo | Tamanho | O que é |
|---|---|---|
| `HUBBER_LOGO HORIZONTAL 01–06.svg` | 3,5 KB | Lockup horizontal. `01` é a variante ink (`= logo-dark.svg`). |
| `HUBBER_LOGO VERTICAL 02–06.svg` | 3,5–4,7 KB | Lockup empilhado, para footer. |
| `HUBBER_SÍMBOLO 01–04.svg` | 0,7 KB | Monograma, vetor limpo. `01` ink, `02` branco, `03` magenta, `04` blue. |
| `HUBBER_SÍMBOLO 05.svg` | 1,9 MB | Monograma com efeito (raster embutido). |
| `HUBBER_SÍMBOLO 06.svg` | 1,9 KB | Monograma, variante pequena. |
| `HUBBER_SÍMBOLO 07.svg` | 1,4 MB | Monograma com efeito. |
| `HUBBER_WALPAPPER 01–06.svg` | 3,4 KB – 1,5 MB | Papéis de parede. Fora do escopo do site. |
| `Prancheta 1.svg` | 3,5 KB | Prancheta solta do Illustrator. |
| `logo-dark.svg` / `logo-white.svg` | 3,5 KB | Cópias renomeadas dos lockups 01 e 02. |
| `symbol-blue.svg` / `symbol-magenta.svg` / `symbol-white.svg` | 0,7 KB | Cópias renomeadas dos monogramas 04, 03 e 02. |

### Duplicatas internas

Conteúdo byte-idêntico — podem ser apagados se quiser enxugar:

```
HUBBER_LOGO HORIZONTAL 01.svg == logo-dark.svg
HUBBER_LOGO HORIZONTAL 02.svg == logo-white.svg
HUBBER_SÍMBOLO 02.svg          == symbol-white.svg
HUBBER_SÍMBOLO 03.svg          == symbol-magenta.svg
HUBBER_SÍMBOLO 04.svg          == symbol-blue.svg
```

## Avisos

> ⚠ **Colisão de classes CSS.** Todos estes SVGs definem cor via `<style>`
> interno com `.cls-1`, `.cls-2`… Inlinar dois ou mais no mesmo documento faz as
> regras colidirem e a última vence — o logo sai com a cor errada. Por isso
> `../brand/` reescreveu tudo com `fill="currentColor"`. **Não inlinar direto
> daqui.** Detalhes em [`../brand/README.md`](../brand/README.md).

> ⚠ **Não estão aqui:** `HUBBER_FOTO DE PERFIL 01–02` (~630 KB, avatar de rede
> social) e `HUBBER_LOGO HORIZONTAL 01–05` na versão de 7,3 KB citada no
> inventário de `../brand/README.md` — esta pasta tem a versão de 3,5 KB. Os
> dois arquivos que faltam continuam só no Google Drive.

> ⚠ **Licenças de fonte pendentes.** O lockup declara Roc Grotesk *demo*
> (Fontspring) e o brandbook aponta 946 Latin Wide 3 (romantype.net) — ambas
> sem licença comercial confirmada. Ver as pendências detalhadas em
> [`../brand/README.md`](../brand/README.md).
