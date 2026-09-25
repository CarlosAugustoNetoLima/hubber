#!/usr/bin/env python3
"""
HUBBER — build mínimo.

Sem framework, sem bundler, sem dependências. Só resolve o que HTML puro não
resolve sozinho: reaproveitar header e footer em todas as páginas.

    src/**/*.html   →   ./**/*.html      (partials estampados, subpastas espelhadas)

Marcadores suportados dentro de src/*.html:

    <!--partial:header-->     conteúdo de partials/header.html
    <!--partial:footer-->     conteúdo de partials/footer.html
    <!--partial:NOME-->       qualquer partials/NOME.html
    <!--partial:NOME:TEXTO-->  idem, trocando {{1}} dentro do partial por TEXTO

Um partial pode chamar outro: a estampagem repete até não sobrar marcador,
no máximo cinco voltas. É o que evita manter quatro cópias do logotipo.
    <!--page:SLUG-->          marca href="/SLUG/" com aria-current e resolve o
                              seletor de idioma; "home" vira "/"

PT mora na raiz e EN espelha em src/en/. Nas duas versões, `__PT__` e `__EN__`
viram a URL da própria página em cada idioma, para o seletor cair na página
equivalente em vez de jogar a pessoa na home do outro idioma.

O HTML de saída é estático e completo — todo conteúdo existe no arquivo
servido, nada é injetado em runtime. Rodar depois de editar src/ ou partials/:

    python3 build.py
"""
import base64
import hashlib
import json
import re
import sys
import pathlib

# O par de slugs de cada página. É o que liga a versão PT à versão EN: sem esse
# mapa, /agencia/ mandaria para /en/agencia/, que não existe.
SLUGS = {
    "home": "home",
    "build": "build",
    "agencia": "agency",
    "pocket": "pocket",
    "diagnostico": "diagnostic",
    "termos": "terms",
    "privacidade": "privacy",
    "cases": "case-studies",
    "cases/florida-rental-car": "case-studies/florida-rental-car",
    "cases/identidade-visual/cinnamon-studio": "case-studies/visual-identity/cinnamon-studio",
    "cases/identidade-visual/romtech-infrastructure": "case-studies/visual-identity/romtech-infrastructure",
    "sobre": "about",
}
EN_PARA_PT = {en: pt for pt, en in SLUGS.items()}

def par_de_urls(slug, ingles):
    """(url em PT, url em EN) da mesma página, a partir do slug de um dos lados."""
    pt = EN_PARA_PT[slug] if ingles else slug
    en = SLUGS[pt]
    return ("/" if pt == "home" else f"/{pt}/",
            "/en/" if en == "home" else f"/en/{en}/")

ROOT = pathlib.Path(__file__).resolve().parent
SRC = ROOT / "src"
PARTIALS_DIR = ROOT / "partials"
VERCEL_JSON = ROOT / "vercel.json"

def check_csp(built_files):
    """A CSP libera cada script inline pelo hash do conteúdo. Editar um script
    sem atualizar o vercel.json faria o navegador bloquear o script em produção,
    em silêncio. Aqui isso vira um aviso na hora do build."""
    if not VERCEL_JSON.exists():
        return []
    csp = ""
    for rule in json.loads(VERCEL_JSON.read_text(encoding="utf8")).get("headers", []):
        for header in rule.get("headers", []):
            if header.get("key", "").lower() == "content-security-policy":
                csp = header["value"]
    if not csp:
        return []
    faltando = []
    for rel in built_files:
        html = (ROOT / rel).read_text(encoding="utf8")
        for attrs, body in re.findall(r"<script(?![^>]*\bsrc=)([^>]*)>(.*?)</script>", html, re.S):
            if "ld+json" in attrs:  # dado estruturado, o navegador não executa
                continue
            h = "sha256-" + base64.b64encode(hashlib.sha256(body.encode()).digest()).decode()
            if h not in csp:
                faltando.append((rel, h))
    return faltando

def load_partials():
    return {p.stem: p.read_text(encoding="utf8") for p in PARTIALS_DIR.glob("*.html")}

def build():
    partials = load_partials()
    missing = set()

    def stamp(match):
        name = match.group(1)
        if name not in partials:
            missing.add(name)
            return match.group(0)
        # Um argumento só, para o caso em que duas páginas usam o mesmo partial
        # e muda uma palavra (o rótulo do cabeçalho legal). Não é template:
        # se um dia precisar de dois, é sinal de que são partials diferentes.
        return partials[name].replace("{{1}}", match.group(2) or "")

    built = []
    sem_par = set()
    for src in sorted(SRC.rglob("*.html")):
        rel = src.relative_to(SRC)
        html = src.read_text(encoding="utf8")
        for _ in range(5):
            html, trocas = re.subn(r"<!--partial:([\w-]+)(?::([^>]*?))?-->", stamp, html)
            if not trocas:
                break
        # <!--page:build--> resolve o seletor de idioma e marca o link da
        # página atual com aria-current, em qualquer lugar onde ele apareça.
        ingles = rel.parts[0] == "en"
        m = re.search(r"<!--page:([\w/-]+)-->\s*", html)
        if m:
            slug = m.group(1)
            tem_par = slug in (EN_PARA_PT if ingles else SLUGS)
            if tem_par:
                pt_url, en_url = par_de_urls(slug, ingles)
                html = html.replace("__PT__", pt_url).replace("__EN__", en_url)
                aqui = en_url if ingles else pt_url
            else:
                # Página fora do espelho bilíngue, como a LP da Connect: não tem
                # seletor de idioma, mas o aria-current do menu continua valendo.
                base = "/en/" if ingles else "/"
                aqui = base if slug == "home" else f"{base}{slug}/"
                if "__PT__" in html or "__EN__" in html:
                    sem_par.add(slug)
            html = re.sub(rf'href="{re.escape(aqui)}"(?![^>]*aria-current)',
                          f'href="{aqui}" aria-current="page"', html)
            html = html.replace(m.group(0), "", 1)
        out = ROOT / rel
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(html, encoding="utf8")
        built.append((str(rel), len(html)))

    for name, size in built:
        print(f"  built  {name:<24} {size:>7} bytes")

    status = 0
    if missing:
        print(f"  AVISO  partials não encontrados: {sorted(missing)}", file=sys.stderr)
        status = 1
    if sem_par:
        print(f"  AVISO  slug sem par de idioma em SLUGS: {sorted(sem_par)}", file=sys.stderr)
        status = 1
    for rel, h in check_csp([name for name, _ in built]):
        print(f"  AVISO  script inline de {rel} fora da CSP. Some ao script-src "
              f"em vercel.json: '{h}'", file=sys.stderr)
        status = 1
    return status

if __name__ == "__main__":
    sys.exit(build())
