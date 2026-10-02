#!/usr/bin/env python3
"""
Gera as páginas de identidade visual (template "brand case" v2) a partir das
apresentações originais de cada marca.

  python3 tools/brand_cases.py assets PDF_DIR   extrai as páginas escolhidas dos PDFs
  python3 tools/brand_cases.py freeze [REV]     congela o texto das páginas v1 (git) em JSON
  python3 tools/brand_cases.py pages            reescreve src/cases/identidade-visual/*/index.html

Depois rode `python3 build.py` como sempre.

Fonte das imagens: PDFs "Brand Presentation" de cada cliente (pasta do Drive
19eM5g8TLIZZw0crlYCnloP_Twc1yzxCj). As imagens embutidas têm 1920x1080 e são
extraídas cruas (sem reamostrar), salvas em webp q86.

Textos (conceito, notas, paleta, tipografia) vêm das páginas atuais, que já
foram revisadas; aqui só se reorganiza o layout.
"""
import html
import io
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'src/cases/identidade-visual')
IMG = '/assets/img/cases/identidade-visual'
IMG_DIR = os.path.join(ROOT, IMG.lstrip('/'))

# Ordem do "próximo case" (cíclica)
ORDER = ['titanium', 'cinnamon-studio', 'romtech-infrastructure', 'driver-x', 'skin-pro',
         'master-vacation-homes', 'cinnamon-finance', 'infinity', 'usa-equity-summit',
         'ka-rv-repair-sales', 'sos-direito']

# Configuração curada por marca (números = páginas do PDF)
B = {
 'titanium': dict(name='Titanium', pdf='titanium.pdf',
   rail=[7,14,36,48,12,57,40,62,20,44,9,53,60,10,22,37,50,59,45,13,49,18,61,56,42,46,1],
   grid=[(12,'Sinalização'),(10,'Sinalização'),(14,'Cartão de visita'),(23,'Cartão de visita'),(48,'Embalagem de entrega'),
         (44,'Uniforme'),(36,'Brindes'),(40,'Brindes'),(57,'Book impresso'),(60,'Book digital')],
   full=[(7,'Showroom'),(62,'Tática de rua: o bilhete no para-brisa que compra o carro do dono')],
   type_img='p06-specimen.webp', logo_svg=True,
   pins=[('l','top:26%;right:61%;','Traço de alto contraste'),('r','top:30%;left:60%;','Herança das serifas'),
         ('l','top:64%;right:57%;','Borda afiada'),('r','top:76%;left:55%;','Terminal em presa')],
   swatch_names={'#da0000':('Vermelho Scuderia','0 98 93 0'),'#000000':('Pure Black','84 83 73 80'),'#ffffff':('Pure White','0 0 0 0')}),
 'driver-x': dict(name='Driver X', pdf='driver-x.pdf',
   rail=[6,7,9,10,12,13,16,17,19,20,21,22,26,28,29,30,31,33,34,36,38,39,40,41,42,45,48,49],
   grid=[(6,'Fachada'),(34,'Showroom'),(19,'Cartão de visita'),(22,'Cartão de visita'),(38,'Ícone do app'),
         (29,'Boné'),(28,'Uniforme'),(10,'Caneta'),(42,'Sinalização'),(48,'Placa suspensa')],
   full=[(37,'Showroom'),(45,'Sinalização')], logos_slide=3,
   font='Stereo Gothic', type_img='type-specimen.webp', type_img_h=1080),
 'cinnamon-finance': dict(name='Cinnamon Finance', pdf='cinnamon-finance.pdf',
   rail=[12,13,14,15,16,17,18,19,21,22,23,24,25,27,28,30,31,35,36,39,40,41,42,44],
   grid=[(12,'Cartão de visita'),(17,'Cartão de visita'),(22,'Cartão de visita'),(24,'Cartão de visita'),(27,'Caneca'),
         (28,'Caneca'),(35,'Caneca'),(39,'Caneca'),(41,'Papelaria'),(44,'Papelaria')],
   full=[(1,'Logotipo'),(14,'Cartão de visita')], logos_slide=7, type_page=11),
 'master-vacation-homes': dict(name='Master Vacation Homes', pdf='master-vacation-homes.pdf',
   rail=[5,6,8,9,10,11,13,16,17,19,20,22,23,25,26,27,29,30,33,36,37,38,40,42,45,48,49,54,56,57,59,60],
   grid=[(5,'Aviso de porta'),(8,'Chaveiro'),(11,'Amenities'),(16,'Embalagem'),(22,'Veículo'),
         (25,'Van'),(33,'Crachá'),(40,'Enxoval'),(57,'Guarda-chuva'),(60,'Relógio')],
   full=[(23,'Frota'),(41,'Enxoval')], logos_jpgs=True, type_page=3),
 'cinnamon-studio': dict(name='Cinnamon Studio', pdf='cinnamon-studio.pdf',
   rail=[1,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,33,35,36,40],
   grid=[(10,'Book'),(11,'Folder'),(13,'Folder'),(16,'Material de venda'),(18,'Painel'),
         (19,'Painel'),(22,'Book'),(23,'Book'),(35,'Canecas'),(36,'Caneta')],
   full=[(1,'Fachada'),(20,'Outdoor')], logos_pages=[6,7,8], type_page=9),
 'infinity': dict(name='Infinity', pdf='infinity.pdf',
   rail=[9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27],
   grid=[(9,'Cartão de visita'),(13,'Cartão de visita'),(17,'Cartão de visita'),(11,'Cartão de visita'),(21,'Caneta'),
         (23,'Caneta'),(24,'Equipamento'),(25,'Container'),(26,'Placa de identificação'),(27,'Painel de controle')],
   full=[(1,'Logotipo'),(25,'Container')], logos_pages=[1,2,3], type_page=8),
 'ka-rv-repair-sales': dict(name='KA RV Repair & Sales', pdf='ka-rv-repair-sales.pdf',
   rail=[9,10,12,13,14,15,16,17,18,19,20,22,23,24,25,27,28,29,30,31,32],
   grid=[(12,'Fachada'),(14,'Letreiro'),(15,'Sinalização'),(16,'Sinalização'),(19,'Canecas'),
         (22,'Folheto'),(23,'Wind banners'),(24,'Boné'),(28,'Papelaria'),(30,'Vitrine')],
   full=[(30,'Vitrine'),(12,'Fachada')], logos_pages=[9,10,11], type_page=6),
 'sos-direito': dict(name='SOS Direito', pdf='sos-direito.pdf',
   rail=[10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,26,27,28,29,31,33],
   grid=[(10,'Cartão de visita'),(11,'Cartão de visita'),(14,'Cartão de visita'),(15,'Cartão de visita'),(18,'Cartão de visita'),
         (19,'Cartão de visita'),(26,'Canetas'),(27,'Caneca'),(29,'Caneca'),(31,'Caneca')],
   full=[(5,'Logotipo'),(26,'Canetas')], logos_pages=[6,5,7], type_page=9),
 'skin-pro': dict(name='Skin Pro', pdf='skin-pro.pdf',
   rail=[1,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22],
   grid=[(7,'Embalagem'),(9,'Embalagem'),(10,'Site'),(13,'Site no tablet'),(14,'Site no tablet'),
         (16,'Caixas'),(18,'Caixas'),(19,'Caixa de envio'),(20,'Caixa de envio'),(22,'Caixas de envio')],
   full=[(1,'Campanha'),(17,'Caixas')], logos_slide=5, type_page=3),
 'romtech-infrastructure': dict(name='Romtech Infrastructure', pdf='romtech-infrastructure.pdf',
   rail=[1,3,4,5,6,7,8,9,10,11],
   grid=[(5,'Capacete'),(6,'Capacete'),(8,'Caminhão'),(9,'Caminhão'),(10,'Site'),(11,'Redes sociais'),(7,'Capacete'),(3,'Lógica do símbolo')],
   full=[(1,'Campanha'),(8,'Frota')], logos_slide=4, type_page=2,
   type_text=['QB One Medium Expanded nos títulos, Montserrat no texto corrido: uma família larga e técnica para a voz da marca, e uma de leitura confortável para o resto.']),
 'usa-equity-summit': dict(name='USA Equity Summit', pdf='usa-equity-summit.pdf',
   rail=[1,2,3,6,7,8,9],
   grid=[(6,'Uniforme'),(7,'Crachá'),(8,'Caderno'),(9,'Site'),(3,'O símbolo')],
   full=[(1,'Campanha'),(9,'Site')], logos_slide=2, type_page=4),
}

GRID_CLS = ['bc-c-7', 'bc-c-5 bc-down', 'bc-c-6', 'bc-c-6 bc-down', 'bc-c-8', 'bc-c-4 bc-down',
            'bc-c-5', 'bc-c-7 bc-down', 'bc-c-7', 'bc-c-5 bc-down']


def pages_for(slug):
    c = B[slug]
    p = set(c['rail']) | {n for n, _ in c['grid']} | {n for n, _ in c['full']}
    p |= set(c.get('logos_pages', []))
    for k in ('logos_slide', 'type_page'):
        if c.get(k):
            p.add(c[k])
    return sorted(p)


# ── Assets ────────────────────────────────────────────────────────────────
def key_logo(src, dst):
    """Logo sobre fundo chapado → PNG transparente (fundo = cor do canto)."""
    from PIL import Image
    im = Image.open(src).convert('RGB')
    W, H = im.size
    if W < 1600:
        im = im.resize((W * 2, H * 2), Image.LANCZOS)
    px = im.load()
    w, h = im.size
    corners = [px[2, 2], px[w - 3, 2], px[2, h - 3], px[w - 3, h - 3]]
    bg = tuple(sorted(c[i] for c in corners)[1] for i in range(3))
    out = Image.new('RGBA', im.size)
    op = out.load()
    t0, t1 = 18.0, 90.0
    for y in range(h):
        for x in range(w):
            r, g, b = px[x, y]
            d = ((r - bg[0]) ** 2 + (g - bg[1]) ** 2 + (b - bg[2]) ** 2) ** 0.5
            a = 0.0 if d <= t0 else 1.0 if d >= t1 else (d - t0) / (t1 - t0)
            if a <= 0:
                op[x, y] = (0, 0, 0, 0)
                continue
            un = [min(255, max(0, round((c - (1 - a) * k) / a))) for c, k in zip((r, g, b), bg)]
            op[x, y] = (*un, round(a * 255))
    bbox = out.getchannel('A').point(lambda v: 255 if v > 10 else 0).getbbox()
    out.crop(bbox).save(dst, optimize=True)


def cmd_assets(pdf_dir):
    import fitz
    from PIL import Image
    for slug, c in B.items():
        doc = fitz.open(os.path.join(pdf_dir, c['pdf']))
        out = os.path.join(IMG_DIR, slug, 'deck')
        os.makedirs(out, exist_ok=True)
        n = 0
        for pg in pages_for(slug):
            dst = os.path.join(out, f'p{pg:02d}.webp')
            if os.path.exists(dst):
                continue
            page = doc[pg - 1]
            imgs = page.get_images(full=True)
            big = [i for i in imgs if doc.extract_image(i[0])['width'] >= 1800]
            if len(imgs) == 1 and big:
                im = Image.open(io.BytesIO(doc.extract_image(big[0][0])['image'])).convert('RGB')
            else:
                pix = page.get_pixmap(matrix=fitz.Matrix(1, 1))
                im = Image.frombytes('RGB', (pix.width, pix.height), pix.samples)
            im.save(dst, 'WEBP', quality=86, method=6)
            n += 1
        if not c.get('logo_svg'):
            key_logo(os.path.join(IMG_DIR, slug, 'logo-escuro.jpg'), os.path.join(IMG_DIR, slug, 'logo-hero.webp'))
        print(f'{slug}: {n} páginas novas')


# ── Páginas ───────────────────────────────────────────────────────────────
CONTENT = os.path.join(ROOT, 'tools/brand_cases_content.json')


def old_content(slug):
    """Conteúdo editorial da página v1 (congelado em brand_cases_content.json)."""
    return json.load(open(CONTENT, encoding='utf8'))[slug]


def parse_v1(s):
    """Extrai o conteúdo da página v1. Só roda no `freeze`."""
    g = lambda p: (re.search(p, s, re.S).group(1).strip() if re.search(p, s, re.S) else '')
    secs = dict(re.findall(r'<section class="section"[^>]*aria-labelledby="([^"]+)"[^>]*>(.*?)</section>', s, re.S))
    con = secs.get('conceito-title', '')
    tipo = secs.get('tipo-title', '')
    return dict(
        head=s.split('<title>')[0],
        title=g(r'<title>(.*?)</title>'),
        desc=g(r'<meta name="description" content="([^"]*)"'),
        ogd=g(r'<meta property="og:description" content="([^"]*)"'),
        label=g(r'<p class="t-label t-accent" data-intro>(.*?)</p>'),
        lead=g(r'<p class="t-lead hero__lead" data-intro>(.*?)</p>'),
        accent=g(r'--brand-accent:(#[0-9a-fA-F]+)'),
        con_h2=g(r'id="conceito-title">(.*?)</h2>') if False else (re.search(r'<h2[^>]*>(.*?)</h2>', con, re.S).group(1).strip() if con else ''),
        con_lead=(re.findall(r'<p class="t-lead t-muted"[^>]*>(.*?)</p>', con, re.S) or [''])[0],
        notes=re.findall(r'<p class="own__t">(.*?)</p><p class="own__d">(.*?)</p>', con, re.S),
        palette=re.findall(r'palette__hex">(#[0-9a-fA-F]{6})<', secs.get('paleta-title', '')),
        pal_h2=(re.search(r'<h2[^>]*>(.*?)</h2>', secs.get('paleta-title', ''), re.S) or [None, ''])[1],
        font=g(r'role="img" aria-label="([^"]+)"[^>]*>\s*<mask'),
        type_leads=re.findall(r'<p class="t-lead t-muted"[^>]*>(.*?)</p>', tipo, re.S),
        final=g(r'(<section class="final".*?</section>)'),
        tail=s[s.index('<!--partial:footer-->'):],
    )


def strip(t):
    return html.unescape(re.sub(r'<[^>]+>', '', t)).strip()


def rgb(hx):
    return tuple(int(hx[i:i + 2], 16) for i in (1, 3, 5))


def lum(hx):
    r, g, b = [v / 255 for v in rgb(hx)]
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def svg_inner(path):
    s = open(path, encoding='utf8').read()
    return re.search(r'viewBox="([^"]+)"', s).group(1), re.search(r'<svg[^>]*>(.*)</svg>', s, re.S).group(1).strip()


def build_page(slug):
    c = B[slug]
    o = old_content(slug)
    A = f'{IMG}/{slug}'
    name = c['name']
    seg = strip(o['label']).split('·', 2)[-1].strip() if o['label'] else ''
    accent = o['accent'] or '#ffffff'
    nxt = ORDER[(ORDER.index(slug) + 1) % len(ORDER)]
    esc = html.escape

    def deck(p):
        return f'{A}/deck/p{p:02d}.webp'

    # Logo do topo
    if c.get('logo_svg'):
        vb, inner = svg_inner(os.path.join(IMG_DIR, slug, 'logo.svg'))
        hero_logo = f'<svg class="bc-hero__logo" viewBox="{vb}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="{esc(name)}">{inner}</svg>'
    else:
        from PIL import Image
        w, h = Image.open(os.path.join(IMG_DIR, slug, 'logo-hero.webp')).size
        hero_logo = f'<img class="bc-hero__logo bc-hero__logo--img" src="{A}/logo-hero.webp" alt="{esc(name)}" width="{w}" height="{h}">'

    caps = {p: cap for p, cap in c['grid']}
    caps.update({p: cap for p, cap in c['full']})
    rail = []
    for i, p in enumerate(c['rail']):
        cap = caps.get(p, 'Aplicação')
        ld = 'eager' if i < 4 else 'lazy'
        rail.append(f'      <figure class="bc-slide"><img src="{deck(p)}" alt="{esc(name)}: {esc(cap.lower())}." width="1920" height="1080" loading="{ld}" decoding="async" draggable="false"><figcaption class="bc-mono">{i + 1:02d} · {esc(cap)}</figcaption></figure>')

    notes = '\n'.join(f'    <li><b>{t}</b><p>{d}</p></li>' for t, d in o['notes'])

    # Logotipo
    if c.get('logo_svg'):
        vb, inner = svg_inner(os.path.join(IMG_DIR, slug, 'logo.svg'))
        svb, sinner = svg_inner(os.path.join(IMG_DIR, slug, 'simbolo.svg'))
        logos = f'''  <div class="bc-logos">
    <div class="bc-logos__dark" data-bc-reveal="0"><svg viewBox="{vb}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Logotipo {esc(name)} em fundo preto">{inner}</svg><span class="bc-mono">Fundo preto</span></div>
    <div class="bc-logos__light" data-bc-reveal=".15"><svg viewBox="{vb}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Logotipo {esc(name)} em fundo branco">{inner}</svg><span class="bc-mono">Fundo branco</span></div>
    <div class="bc-logos__accent" data-bc-reveal=".3"><svg viewBox="{svb}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Símbolo {esc(name)}" style="color:#fff">{sinner}</svg><span class="bc-mono">Símbolo</span></div>
  </div>'''
    elif c.get('logos_slide'):
        logos = f'  <figure class="bc-logoslide" data-bc-reveal="0"><img src="{deck(c["logos_slide"])}" alt="Versões do logotipo {esc(name)}." width="1920" height="1080" loading="lazy" decoding="async"></figure>'
    elif c.get('logos_pages'):
        tiles = []
        for i, p in enumerate(c['logos_pages']):
            tiles.append(f'    <figure data-bc-reveal="{i * 0.15:.2f}"><img src="{deck(p)}" alt="Logotipo {esc(name)}, versão {i + 1}." width="1920" height="1080" loading="lazy" decoding="async"></figure>')
        logos = '  <div class="bc-logotiles">\n' + '\n'.join(tiles) + '\n  </div>'
    else:
        tiles = []
        for i, (f, lab) in enumerate([('logo-escuro.jpg', 'Fundo escuro'), ('logo-claro.jpg', 'Fundo claro'), ('logo-secundario.jpg', 'Versão secundária')]):
            tiles.append(f'    <figure data-bc-reveal="{i * 0.15:.2f}" class="bc-logotiles__jpg"><img src="{A}/{f}" alt="Logotipo {esc(name)}: {lab.lower()}." loading="lazy" decoding="async"><figcaption class="bc-mono">{lab}</figcaption></figure>')
        logos = '  <div class="bc-logotiles">\n' + '\n'.join(tiles) + '\n  </div>'

    # Paleta (só hex reais; "Gradiente" e repetidos ficam de fora)
    pal, seen = [], set()
    for hx in o['palette']:
        hx = hx.lower()
        if hx in seen:
            continue
        seen.add(hx)
        pal.append(hx)
    sw = []
    names = c.get('swatch_names', {})
    for i, hx in enumerate(pal):
        r, g, b = rgb(hx)
        fg = '#000' if lum(hx) > 0.55 else '#fff'
        light = lum(hx) > 0.9
        nm, cmyk = names.get(hx, (None, None))
        title = (f'<p class="bc-swatch__name">{"<br>".join(esc(nm).split(" ", 1))}</p>\n      ' if nm
                 else f'<p class="bc-swatch__name bc-swatch__name--hex">{hx.upper()}</p>\n      ')
        cm = ''
        if cmyk:
            cc, mm, yy, kk = cmyk.split()
            cm = f'\n      <dl><dt>C</dt><dd>{cc}</dd><dt>M</dt><dd>{mm}</dd><dt>Y</dt><dd>{yy}</dd><dt>K</dt><dd>{kk}</dd></dl>'
        extra = ' bc-swatch--white' if light else ''
        style = f'background:{hx};color:{fg};' + ('' if light or lum(hx) > 0.05 else 'box-shadow:inset 0 0 0 1px rgba(255,255,255,.18);')
        sw.append(f'''    <div class="bc-swatch{extra}" style="{style}" tabindex="0" data-bc-reveal="{i * 0.12:.2f}">
      {title}{f'<p class="bc-swatch__hex">{hx.upper()}</p>' if nm else ''}
      <dl><dt>R</dt><dd>{r}</dd><dt>G</dt><dd>{g}</dd><dt>B</dt><dd>{b}</dd></dl>{cm}
    </div>''')
    palette = '\n'.join(sw)

    # Tipografia
    font = c.get('font') or o['font'].rstrip('.')
    type_text = c.get('type_text') or o['type_leads'] or ['']
    type_paras = '\n      '.join(f'<p>{t}</p>' for t in type_text if t)
    if c.get('type_img'):
        tsrc, th = f'{A}/deck/{c["type_img"]}', c.get('type_img_h', 540)
    elif c.get('type_page'):
        tsrc, th = deck(c['type_page']), 1080
    else:
        tsrc = None
    type_media = (f'<div class="bc-media" data-bc-reveal="0" style="overflow:hidden;"><img src="{tsrc}" alt="Tipografia da {esc(name)}: {esc(font)}." width="1920" height="{th}" loading="lazy" decoding="async" style="width:100%;height:auto;display:block;"></div>'
                  if tsrc else '<div></div>')

    grid = []
    for i, (p, cap) in enumerate(c['grid']):
        cls = GRID_CLS[i % len(GRID_CLS)]
        d = '.1' if 'bc-down' in cls else '0'
        grid.append(f'''    <figure class="{cls}">
      <div class="bc-media" data-bc-reveal="{d}"><img src="{deck(p)}" alt="{esc(name)}: {esc(cap.lower())}." width="1920" height="1080" loading="lazy" decoding="async"></div>
      <figcaption class="bc-mono"><span>{esc(cap)}</span><span>05.{i + 1}</span></figcaption>
    </figure>''')

    (f1, f1c), (f2, f2c) = c['full']
    sheet_ps = [o['lead'], o['con_lead']]
    sheet_ps.append(f'O trabalho cobriu conceito, logotipo, paleta, tipografia e as aplicações da marca: {", ".join(dict.fromkeys(cap.lower() for _, cap in c["grid"]))}.')
    sheet_body = '\n        '.join(f'<p>{p}</p>' for p in sheet_ps if p)

    symbol_sec = ''
    if c.get('pins'):
        svb, sinner = svg_inner(os.path.join(IMG_DIR, slug, 'simbolo.svg'))
        pins = '\n'.join(f'    <p class="bc-pin bc-pin--{side} bc-mono" style="{pos}" data-bc-reveal="{0.3 + i * 0.15:.2f}"><i></i>{esc(t)}</p>'
                         for i, (side, pos, t) in enumerate(c['pins']))
        symbol_sec = f'''<section class="bc-sec bc-sec--ink" aria-labelledby="simbolo-title">
  <p class="bc-sec__label bc-mono"><span>Símbolo</span><span id="simbolo-title">Anatomia do símbolo</span></p>
  <div class="bc-symbol">
    <div class="bc-symbol__grid" aria-hidden="true"></div>
    <svg class="bc-symbol__mark" viewBox="{svb}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Símbolo da {esc(name)}" data-bc-reveal="0">{sinner}</svg>
{pins}
  </div>
</section>

'''
    con_h2 = o['con_h2']
    pal_h2 = strip(o['pal_h2']) or 'Paleta de cores'

    head = o['head'].replace('<html lang="pt-BR">', '<html lang="pt-BR">')
    out = head + f'''<title>{o["title"]}</title>
<meta name="description" content="{o["desc"]}">
<link rel="icon" type="image/svg+xml" href="/assets/brand/favicon.svg">
<link rel="canonical" href="https://hubbermarketing.com/cases/identidade-visual/{slug}/">
<meta property="og:title" content="{o["title"]}">
<meta property="og:description" content="{o["ogd"]}">
<meta property="og:image" content="https://hubbermarketing.com{deck(f1)}">
<meta property="og:url" content="https://hubbermarketing.com/cases/identidade-visual/{slug}/">
<meta property="og:locale" content="pt_BR">
<meta property="og:type" content="article">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="preload" href="/assets/fonts/946-latin-wide-3.DEV-PREVIEW.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@100..125,300..700&family=JetBrains+Mono:wght@400;500;700&display=swap">
<link rel="stylesheet" href="/css/fonts.css">
<link rel="stylesheet" href="/css/tokens.css">
<link rel="stylesheet" href="/css/base.css">
<link rel="stylesheet" href="/css/layout.css">
<link rel="stylesheet" href="/css/components.css">
<link rel="stylesheet" href="/css/pages/produto.css">
<link rel="stylesheet" href="/css/pages/brand-case.css">
</head>
<body data-surface="ink" class="bc" style="--bc-accent:{accent};">

<a class="skip" href="#main">Pular para o conteúdo</a>

<!--page:cases/identidade-visual/{slug}-->
<!--partial:header-->

<main id="main">

<section class="bc-hero" aria-labelledby="hero-title">
  <div class="bc-hero__top bc-mono">
    <p class="bc-hero__services">Identidade de marca: conceito, logotipo, paleta, tipografia e aplicações para <span>{esc(seg.lower()) if seg else esc(name)}</span></p>
    <a class="bc-link" href="/cases/">← Todos os cases</a>
  </div>

  <div class="bc-rail" data-bc-rail tabindex="0" role="region" aria-roledescription="carrossel" aria-label="Aplicações da marca {esc(name)}. Arraste ou use as setas.">
    <div class="bc-rail__track">
{chr(10).join(rail)}
    </div>
  </div>

  <div class="bc-hero__foot">
    <div class="bc-hero__id">
      {hero_logo}
      <h1 class="bc-hero__title" id="hero-title">{esc(name)} <span class="bc-tag bc-mono">(Identidade visual)</span></h1>
      <p class="bc-hero__desc">{o["lead"]}</p>
      <button class="bc-more bc-mono bc-link" type="button" data-bc-open aria-controls="bc-sheet">Ler mais</button>
    </div>
    <div class="bc-hero__meta bc-mono">
      <span class="bc-hero__count" data-bc-count>01 / {len(c["rail"]):02d}</span>
      <span>Arraste ou role</span>
    </div>
  </div>
</section>

<div class="bc-sheet" id="bc-sheet" data-bc-sheet aria-hidden="true" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
  <button class="bc-sheet__veil" type="button" data-bc-close tabindex="-1" aria-label="Fechar"></button>
  <div class="bc-sheet__panel">
    <div class="bc-sheet__head bc-mono"><span>Sobre o projeto</span><button class="bc-sheet__close bc-mono" type="button" data-bc-close>Fechar <i aria-hidden="true">×</i></button></div>
    <div class="bc-sheet__body">
      <h2 id="sheet-title">{strip(con_h2)}</h2>
      <div>
        {sheet_body}
      </div>
    </div>
  </div>
</div>

<section class="bc-sec bc-sec--paper" aria-labelledby="conceito-title">
  <p class="bc-sec__label bc-mono"><span>01 · Conceito</span><span>{esc(name)}</span></p>
  <h2 class="bc-statement js-split" id="conceito-title">{con_h2}</h2>
  <ul class="bc-notes" role="list" data-reveal-group>
{notes}
  </ul>
</section>

{symbol_sec}<section class="bc-sec bc-sec--ink" aria-labelledby="logo-title">
  <p class="bc-sec__label bc-mono"><span>02 · Logotipo</span><span id="logo-title">Em qualquer fundo, a mesma leitura</span></p>
{logos}
</section>

<section class="bc-sec bc-sec--paper" aria-labelledby="paleta-title">
  <p class="bc-sec__label bc-mono"><span>03 · Paleta</span><span id="paleta-title">{esc(pal_h2)}</span></p>
  <div class="bc-palette">
{palette}
  </div>
</section>

<section class="bc-sec bc-sec--ink" aria-labelledby="tipo-title">
  <p class="bc-sec__label bc-mono"><span>04 · Tipografia</span><span>{esc(font)}</span></p>
  <div class="bc-type">
    <div>
      <h2 class="bc-type__name" id="tipo-title">{esc(font)}</h2>
      {type_paras}
    </div>
    {type_media}
  </div>
</section>

<figure class="bc-full">
  <img src="{deck(f1)}" alt="{esc(name)}: {esc(f1c.lower())}." width="1920" height="1080" loading="lazy" decoding="async">
  <figcaption class="bc-mono">{esc(f1c)}</figcaption>
</figure>

<section class="bc-sec bc-sec--paper" aria-labelledby="aplic-title">
  <p class="bc-sec__label bc-mono"><span>05 · Aplicações</span><span id="aplic-title">Onde a marca aparece</span></p>
  <div class="bc-grid">
{chr(10).join(grid)}
  </div>
</section>

<figure class="bc-full">
  <img src="{deck(f2)}" alt="{esc(name)}: {esc(f2c.lower())}." width="1920" height="1080" loading="lazy" decoding="async">
  <figcaption class="bc-mono">{esc(f2c)}</figcaption>
</figure>

<a class="bc-next" href="/cases/identidade-visual/{nxt}/">
  <span class="bc-mono">Próximo case · Identidade visual</span>
  <span class="bc-next__name">{esc(B[nxt]["name"])} →</span>
</a>

{o["final"]}

</main>

{o["tail"]}'''
    if '/js/brand-case.js' not in out:
        out = out.replace('<script type="module" src="/js/main.js"></script>',
                          '<script type="module" src="/js/main.js"></script>\n<script defer src="/js/brand-case.js"></script>')
    if '/js/highlight.js' not in out and 'class="hl"' in out:
        out = out.replace('</body>', '<script defer src="/js/highlight.js"></script>\n</body>')
    return out


def cmd_freeze(rev):
    """Congela o conteúdo das páginas v1 (lido do git, nunca do disco)."""
    import subprocess
    data = {}
    for slug in B:
        src = subprocess.run(['git', 'show', f'{rev}:src/cases/identidade-visual/{slug}/index.html'],
                             cwd=ROOT, capture_output=True, text=True, check=True).stdout
        data[slug] = parse_v1(src)
    json.dump(data, open(CONTENT, 'w', encoding='utf8'), ensure_ascii=False, indent=1)
    print('congelado:', ', '.join(data))


def cmd_pages():
    built = {}
    for slug in B:
        built[slug] = build_page(slug)
    for slug, page in built.items():
        open(os.path.join(SRC, slug, 'index.html'), 'w', encoding='utf8').write(page)
        print('ok', slug)


if __name__ == '__main__':
    if sys.argv[1:2] == ['assets']:
        cmd_assets(sys.argv[2])
    elif sys.argv[1:2] == ['freeze']:
        cmd_freeze(sys.argv[2] if len(sys.argv) > 2 else 'HEAD')
    elif sys.argv[1:2] == ['pages']:
        cmd_pages()
    else:
        print(__doc__)
