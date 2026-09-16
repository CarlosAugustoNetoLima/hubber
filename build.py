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
    <!--page:SLUG-->          marca href="/SLUG/" (ou "/" para home) com aria-current

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
        return partials[name]

    built = []
    for src in sorted(SRC.rglob("*.html")):
        rel = src.relative_to(SRC)
        html = src.read_text(encoding="utf8")
        html = re.sub(r"<!--partial:([\w-]+)-->", stamp, html)
        # <!--page:build--> marca o link da página atual com aria-current
        m = re.search(r"<!--page:([\w-]+)-->\s*", html)
        if m:
            slug = m.group(1)
            href = "/" if slug == "home" else f"/{slug}/"
            # Seletor de idioma: PT aponta para a própria página, EN para o espelho em /en.
            html = html.replace('href="/" aria-current="page" lang="pt-BR"',
                                f'href="{href}" aria-current="page" lang="pt-BR"')
            html = html.replace('href="/en/" lang="en-US"', f'href="/en{href}" lang="en-US"')
            html = re.sub(rf'href="{re.escape(href)}"(?![^>]*aria-current)',
                          f'href="{href}" aria-current="page"', html)
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
    for rel, h in check_csp([name for name, _ in built]):
        print(f"  AVISO  script inline de {rel} fora da CSP. Some ao script-src "
              f"em vercel.json: '{h}'", file=sys.stderr)
        status = 1
    return status

if __name__ == "__main__":
    sys.exit(build())
