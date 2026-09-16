# Identidade visual Hubber — mapa de assets

Fonte: Google Drive → `IDENTIDADE VISUAL HUBBER GRUPO CINNAMON`
(atalho `.html` que veio na pasta `/Downloads/SITE`)

## Estrutura da pasta

```
IDENTIDADE VISUAL HUBBER GRUPO CINNAMON/
├── CORES ORIGINAIS HUBBER/         acento MAGENTA  #FF009E
│   └── PNG · SVG · EPS · PDF · VETOR (AI)
├── CORES HUBBER GRUPO CINNAMON/    acento ÂMBAR    #B8832A   ← em uso
│   └── PNG · SVG · EPS · PDF · VETOR (AI)
└── BRANDBOOK/
    └── Brandbook Hubber Cinnamon Group.pdf   (48,9 MB — ainda não lido)
```

São **duas identidades completas**, não formatos alternativos da mesma. A
geometria do símbolo difere entre elas: a versão Cinnamon foi redesenhada com
respiro interno (mesmo viewBox `0 0 1920 1707.43`, paths recuados ~51px).

## Paleta oficial

Extraída dos SVGs, não inferida.

| Token | Hex | Origem |
|---|---|---|
| Ink | `#161616` | `HUBBER_SÍMBOLO 01.svg` (as duas pastas) |
| Branco | `#FFFFFF` | `HUBBER_SÍMBOLO 02.svg` (as duas pastas) |
| Âmbar | `#B8832A` | `HUBBER_SÍMBOLO 03.svg` — pasta Cinnamon |
| Magenta | `#FF009E` | `HUBBER_SÍMBOLO 03.svg` — pasta Originais |

O `#B8832A` confere exatamente com o que o deck comercial aplica (106
ocorrências no XML dos slides).

## Tipografia

**Roc Grotesk**, distribuída pela Fontspring.

Declarada dentro de `HUBBER_LOGO HORIZONTAL 01.svg`:

```css
.cls-3 {
  font-family: FONTSPRINGDEMO-RocGroteskRegular, 'FONTSPRING DEMO - Roc Grotesk';
  font-size: 44.74px;
}
```

> ⚠ **Pendência de licença — Roc Grotesk.** O arquivo oficial de marca foi
> construído com a versão **demo** da fonte. Licenças demo do Fontspring
> cobrem apenas avaliação e comps — não cobrem uso comercial nem `@font-face`
> na web. Comprar licença desktop + webfont é pré-requisito de lançamento.
> Uso atual: só na tagline do lockup — e o site nem usa o SVG do lockup para
> isso (ver seção "Texto vivo no lockup" abaixo).

## A face de display real: 946 Latin Wide 3

`Roc Grotesk` era usada apenas na tagline do logo. A face de **display**
declarada no brandbook (página "Tipografia") é outra: **946 Latin Wide 3**,
de Roman Wilhelm (romantype.net).

Em 08/09, o usuário forneceu o arquivo `946-latin-wide-3.otf` diretamente.

> ⚠ **Pendência de licença — 946 Latin Wide 3.** O arquivo carrega
> `Version 1.000 | wf-rip DC20180430` no campo de versão. `wf-rip` é a
> assinatura de uma ferramenta que extrai o `.otf` instalável de dentro de um
> kit de webfont licenciado só para `@font-face` num domínio — os campos
> `License` e `License URL` do arquivo estão vazios. `fsType` (permissão de
> embedding) está em `0`, sem restrição declarada, mas isso não substitui uma
> licença válida.
>
> **Não é prova de pirataria** — pode ser uma extração de um kit que a Hubber
> já comprou. Mas o arquivo, sozinho, não prova isso. **Confirmar nota fiscal
> ou licença em romantype.net antes de produção.**
>
> Enquanto isso: subsetado (latin + latin-ext, 43 KB) e self-hosted como
> `946-latin-wide-3.DEV-PREVIEW.woff2`, carregado só para prévia de
> desenvolvimento — ver `css/fonts.css` e a nota em `css/tokens.css` junto ao
> token `--font-display`. **Não promover o sufixo `DEV-PREVIEW` para uma
> build de produção sem essa confirmação.**

## Inventário (pasta Cinnamon, SVG — 24 arquivos)

| Arquivo | Tamanho | Uso |
|---|---|---|
| `HUBBER_SÍMBOLO 01–03` | ~750 B | Monograma. Vetor limpo. **Usar.** |
| `HUBBER_LOGO HORIZONTAL 01–05` | ~7,3 KB | Lockup do header. **Usar.** |
| `HUBBER_LOGO VERTICAL 02–05` | ~7,3–8,5 KB | Lockup empilhado, footer. |
| `HUBBER_SÍMBOLO 04, 06, 07` | 1,0–1,3 MB | Versões com efeito. Não usar na web. |
| `HUBBER_WALPAPPER 01–06` | 7 KB – 1,9 MB | Papéis de parede. Fora do escopo. |
| `HUBBER_FOTO DE PERFIL 01–02` | ~630 KB | Avatar de rede social. |
| `Prancheta 1` | 7,3 KB | Prancheta solta do Illustrator. |

## Dois problemas para resolver antes de usar no site

**1. Colisão de classes CSS.** Todos os SVGs definem cor via `<style>` interno
com `.cls-1`, `.cls-2`… Inlinar dois ou mais no mesmo documento faz as regras
colidirem e a última vence — o logo sai com a cor errada. *(Verificado: ao
renderizar três símbolos juntos, os três saíram pretos.)*

**Correção:** reescrever com `fill="currentColor"`. Resolve a colisão e faz o
logo herdar a cor da superfície automaticamente — ink sobre creme, creme sobre
ink — sem arquivo duplicado por cor.

**2. Texto vivo no lockup.** Em `LOGO HORIZONTAL`, a tagline "UMA EMPRESA DO
GRUPO" é um elemento `<text>` que depende da fonte demo instalada. "HUBBER" e
"CINNAMON" já são contornos.

**Correção:** no site, marcar a tagline como texto HTML real ao lado do símbolo
— melhor para acessibilidade e SEO, e elimina a dependência de fonte no SVG.

## Arquivos já baixados aqui

- `simbolo-ink.svg` — `#161616`
- `simbolo-amber-CINNAMON.svg` — `#B8832A`
- `simbolo-magenta-ORIGINAL.svg` — `#FF009E`
- `_comparacao.png` — as três variantes lado a lado

Os lockups horizontais e verticais serão baixados e convertidos para
`currentColor` na etapa 2 (header e footer).
