#!/usr/bin/env python3
"""Gera uma versão auto-contida de UMA página — CSS, fonte, poster e JS
inlinados — para revisão remota. O site real continua sendo o HTML servido.

    python3 build-artifact.py index.html "Hubber Home"
    python3 build-artifact.py build/index.html "Hubber Build"

Saída: <página>.artifact.html na raiz (barras viram hífens).
"""
import re, base64, pathlib, sys
ROOT = pathlib.Path(__file__).resolve().parent
page = sys.argv[1]
title_override = sys.argv[2] if len(sys.argv) > 2 else None
out_name = sys.argv[3] if len(sys.argv) > 3 else page.replace(".html", ".artifact.html").replace("/", "-")
html = (ROOT / page).read_text(encoding="utf8")

def local(p): return ROOT / p.lstrip("/")
def b64(p, mime): return f"data:{mime};base64," + base64.b64encode(local(p).read_bytes()).decode()

# CSS: os <link> locais, na ordem em que a página os declara
css_links = re.findall(r'<link rel="stylesheet" href="(/?css/[^"]+)">', html)
css = "\n".join(local(c).read_text(encoding="utf8") for c in css_links)
css = re.sub(r'url\("\.\./assets/fonts/([^"]+)"\)',
             lambda m: f'url("{b64("assets/fonts/" + m.group(1), "font/woff2")}")', css)
css += "\n/* artifact: o <body> vem do wrapper; replica o data-surface=ink da página real */\nbody{background-color:var(--c-ink);color:var(--c-white);}\n"

# JS: vendor (UMD) na ordem da página + módulos sem `export` + inicialização
def strip_exports(src): return re.sub(r"^\s*export\s+", "", src, flags=re.M)
vendor_srcs = re.findall(r'<script defer src="(/?assets/vendor/[^"]+)"></script>', html)
vendor = "\n".join(local(v).read_text(encoding="utf8") for v in vendor_srcs)
mods = "\n".join(strip_exports((ROOT / "js" / m).read_text(encoding="utf8")) for m in ["header.js", "clock.js", "form.js", "motion.js"])
js = vendor + "\n" + mods + "\ninitHeader();initClocks();initDiagnostic();initMotion();\n"
head_inline = re.search(r"<head>.*?(<script>.*?</script>).*?</head>", html, re.S).group(1)

bm = re.search(r"<body([^>]*)>(.*)</body>", html, re.S)
body = bm.group(2)
# Atributos data-* do <body> não sobrevivem ao wrapper do artifact; reinjeta os que o JS lê.
body_attrs = dict(re.findall(r'data-([\w-]+)="([^"]*)"', bm.group(1)))
if "sticky-cta" in body_attrs:
    body = f"<script>document.body.dataset.stickyCta='{body_attrs['sticky-cta']}';</script>\n" + body
title = title_override or re.search(r"<title>(.*?)</title>", html, re.S).group(1)

def video_to_img(m):
    tag = m.group(0)
    poster = re.search(r'poster="([^"]+)"', tag).group(1)
    webp = poster.rsplit(".", 1)[0] + ".webp"
    src = b64(webp, "image/webp") if local(webp).exists() else b64(poster, "image/jpeg")
    alt = re.search(r'aria-label="([^"]+)"', tag)
    return f'<img src="{src}" width="1280" height="720" alt="{alt.group(1) if alt else ""}">'
body = re.sub(r"<video\b.*?</video>", video_to_img, body, flags=re.S)
body = re.sub(r'<script defer src="/?assets/vendor/[^"]+"></script>\s*', "", body)
# lambda: o JS entra literal (como template, o \s do vendor quebraria o re.sub)
body = re.sub(r'<script type="module" src="/?js/main.js"></script>', lambda m: "<script>\n" + js + "\n</script>", body)
gf = re.search(r'<link rel="stylesheet" href="https://fonts\.googleapis\.com[^"]*">', html).group(0)

out = f"<title>{title}</title>\n{gf}\n<style>\n{css}\n</style>\n{head_inline}\n{body}"
(ROOT / out_name).write_text(out, encoding="utf8")
print(f"  artifact  {out_name}  {len(out):,} bytes")
