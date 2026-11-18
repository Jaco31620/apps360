"""Charte graphique apps360 en PDF (A4 paysage, 2 pages).
À lancer après brand.py et raster.js : python3 brand/scripts/charte_pdf.py → brand/out/apps360-charte-graphique.pdf
"""
import os
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from reportlab.lib.pagesizes import A4, landscape
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont as RLFont
from reportlab.lib.colors import HexColor

HERE = os.path.dirname(os.path.abspath(__file__)); os.chdir(os.path.dirname(HERE))
for w, n in [(800, 'Outfit-ExtraBold'), (500, 'Outfit-Medium'), (400, 'Outfit-Regular')]:
    if not os.path.exists(f'fonts/{n}.ttf'):
        instancer.instantiateVariableFont(TTFont('fonts/Outfit-VF.ttf'), {'wght': w}).save(f'fonts/{n}.ttf')
pdfmetrics.registerFont(RLFont('XB', 'fonts/Outfit-ExtraBold.ttf'))
pdfmetrics.registerFont(RLFont('MD', 'fonts/Outfit-Medium.ttf'))
pdfmetrics.registerFont(RLFont('RG', 'fonts/Outfit-Regular.ttf'))

NAVY, ORANGE, TEAL, TEAL2, GREY, MIST, CREAM = (HexColor(c) for c in ['#14306B', '#FF7A1A', '#14C8B6', '#2DE0CC', '#6B6B73', '#AAB4CC', '#F5F4F0'])
LINE = HexColor('#E4E2DC'); WHITE = HexColor('#FFFFFF'); TXT = HexColor('#3A3A40')
W, H = landscape(A4); M = 36
O = 'out'

def img(c, path, x, y, w=None, h=None):
    """Image calée en bas à gauche (x, y), largeur ou hauteur imposée, proportions gardées."""
    from reportlab.lib.utils import ImageReader
    ir = ImageReader(path); iw, ih = ir.getSize()
    if w and not h: h = w * ih / iw
    if h and not w: w = h * iw / ih
    c.drawImage(ir, x, y, w, h, mask='auto'); return w, h

def card(c, x, y, w, h, fill=WHITE, stroke=LINE, r=12):
    c.setFillColor(fill)
    if stroke: c.setStrokeColor(stroke); c.setLineWidth(0.8)
    c.roundRect(x, y, w, h, r, stroke=1 if stroke else 0, fill=1)

def centered_img(c, path, x, y, w, h, maxw, maxh):
    from reportlab.lib.utils import ImageReader
    iw, ih = ImageReader(path).getSize(); s = min(maxw / iw, maxh / ih)
    img(c, path, x + (w - iw * s) / 2, y + (h - ih * s) / 2, iw * s, ih * s)

def label(c, text, x, y, size=9, font='MD', color=GREY):
    c.setFont(font, size); c.setFillColor(color); c.drawString(x, y, text)

def header(c, n, subtitle):
    c.setFillColor(CREAM); c.rect(0, 0, W, H, stroke=0, fill=1)
    label(c, 'IDENTITÉ VISUELLE · NOVEMBRE 2026', M, H - M - 4, 8.5, 'MD', GREY)
    c.setFont('XB', 26); c.setFillColor(NAVY); c.drawString(M, H - M - 34, 'apps360.fr — charte graphique')
    label(c, subtitle, M, H - M - 52, 10.5, 'RG', TXT)
    label(c, f'{n} / 2', W - M - 20, M - 14, 8, 'MD', GREY)

def page1(c):
    header(c, 1, 'Des applis utiles, sans pub et sans exploitation des données. Le « 0 » de 360 est un cycle de trois flèches.')
    # logo principal
    top = H - M - 70
    card(c, M, top - 132, W - 2 * M, 122)
    centered_img(c, f'{O}/logo/apps360-logo.png', M, top - 132, W - 2 * M, 122, 400, 84)
    # 4 déclinaisons
    y = top - 236; cw = (W - 2 * M - 3 * 12) / 4
    vs = [('apps360-logo.png', WHITE, 'Couleur · fond clair'), ('apps360-logo-fond-sombre.png', NAVY, 'Couleur · fond sombre'),
          ('apps360-logo-bleu.png', WHITE, 'Une couleur · bleu nuit'), ('apps360-logo-blanc.png', NAVY, 'Une couleur · blanc')]
    for i, (f, bg, t) in enumerate(vs):
        x = M + i * (cw + 12)
        card(c, x, y, cw, 84, bg, LINE if bg == WHITE else None)
        centered_img(c, f'{O}/logo/{f}', x, y, cw, 84, cw - 40, 42)
        label(c, t, x + 2, y - 13, 9, 'MD', NAVY)
        label(c, f'logo/{f[:-4]}.svg', x + 2, y - 25, 7.5, 'RG', GREY)
    # symbole et usages (cadres de y2 à y - 42)
    y2 = M + 4; h2 = y - 42 - y2
    card(c, M, y2, 170, h2)
    centered_img(c, f'{O}/symbole/apps360-symbole.png', M, y2 + 30, 170, h2 - 40, 100, h2 - 52)
    label(c, 'Symbole seul', M + 14, y2 + 22, 9, 'MD', NAVY); label(c, 'symbole/apps360-symbole.svg', M + 14, y2 + 10, 7, 'RG', GREY)
    x3 = M + 182; card(c, x3, y2, W - M - x3, h2)
    S = min(76, h2 - 58); base = y2 + 40
    items = [('icones/apps360-icone-512.png', 'Icône d\'app', 'icones/apps360-icone.svg', S),
             ('reseaux/apps360-avatar-320.png', 'Avatar réseaux', 'reseaux/apps360-avatar-*.png', S),
             ('reseaux/apps360-partage-1200x630.png', 'Partage des liens', 'reseaux/apps360-partage-*.png', S * 1200 / 630)]
    xx = x3 + 22
    for f, t, p, w in items:
        if 'avatar' in f:
            c.saveState(); pth = c.beginPath(); pth.circle(xx + S / 2, base + S / 2, S / 2); c.clipPath(pth, stroke=0, fill=0)
            img(c, f'{O}/{f}', xx, base, S, S); c.restoreState()
        else:
            img(c, f'{O}/{f}', xx, base, w, S)
        label(c, t, xx, y2 + 24, 9, 'MD', NAVY); label(c, p, xx, y2 + 12, 7, 'RG', GREY)
        xx += max(w, 120) + 26
    # favicons
    img(c, f'{O}/icones/apps360-icone-48.png', xx, base, 32); img(c, f'{O}/icones/apps360-icone-32.png', xx + 40, base, 20); img(c, f'{O}/icones/apps360-icone-16.png', xx + 68, base, 12)
    label(c, 'Favicon', xx, y2 + 24, 9, 'MD', NAVY); label(c, 'icones/favicon.ico', xx, y2 + 12, 7, 'RG', GREY)

def page2(c):
    header(c, 2, 'Couleurs, typographie, règles d\'usage et emplacement des fichiers.')
    top = H - M - 76
    # couleurs
    cols = [('Orange', '#FF7A1A', '255 · 122 · 26', '1re flèche, accents, boutons d\'action'),
            ('Turquoise', '#14C8B6', '20 · 200 · 182', '2e flèche (#2DE0CC sur fond sombre)'),
            ('Bleu nuit', '#14306B', '20 · 48 · 107', '3e flèche, texte, fonds sombres'),
            ('Gris', '#6B6B73', '107 · 107 · 115', '« .fr » (#AAB4CC sur fond sombre)')]
    cw = (W - 2 * M - 3 * 12) / 4
    label(c, 'COULEURS', M, top, 8.5, 'MD', GREY)
    for i, (n, hx, rgb, use) in enumerate(cols):
        x = M + i * (cw + 12); y = top - 112
        c.setFillColor(HexColor(hx)); c.roundRect(x, y + 30, cw, 66, 10, stroke=0, fill=1)
        label(c, n, x, y + 16, 11, 'XB', NAVY); label(c, f'{hx}   RVB {rgb}', x, y + 4, 8, 'RG', TXT); label(c, use, x, y - 8, 7.5, 'RG', GREY)
    # typo
    y = top - 170
    label(c, 'TYPOGRAPHIE', M, y, 8.5, 'MD', GREY)
    card(c, M, y - 128, 330, 118)
    c.setFont('XB', 40); c.setFillColor(NAVY); c.drawString(M + 16, y - 58, 'Outfit')
    label(c, 'ExtraBold 800 — « apps36 »', M + 16, y - 80, 9.5, 'MD', TXT)
    label(c, 'Medium 500 — « .fr », à 45 % de la taille du nom', M + 16, y - 94, 9.5, 'MD', TXT)
    label(c, 'Police libre (Google Fonts, licence OFL). Textes en tracés dans les fichiers.', M + 16, y - 110, 8, 'RG', GREY)
    # règles
    x = M + 345
    label(c, 'RÈGLES D\'USAGE', x, y, 8.5, 'MD', GREY)
    card(c, x, y - 128, W - M - x, 118)
    rules = ['Le symbole est le même partout : seul, dans le nom, dans les icônes.',
             'Ordre des flèches : orange → turquoise → bleu nuit, sens horaire depuis le haut.',
             'Le « 0 » a la hauteur et le trait du « 6 » ; ne pas déformer (pas d\'ovale).',
             'Marge autour du logo : au moins la moitié de la hauteur du « 0 ».',
             'Taille minimale : 24 px de haut à l\'écran, 15 mm de large imprimé.',
             'Sur fond foncé ou photo chargée : version fond sombre ou une couleur blanche.']
    for i, r in enumerate(rules):
        c.setFillColor(ORANGE); c.circle(x + 18, y - 26 - i * 16.5 + 3, 2.2, stroke=0, fill=1)
        label(c, r, x + 28, y - 26 - i * 16.5, 9, 'RG', TXT)
    # fichiers
    y = y - 150
    label(c, 'FICHIERS', M, y, 8.5, 'MD', GREY)
    card(c, M, M + 6, W - 2 * M, y - M - 14)
    rows = [('Dossier livré', '_Apps360/  (OneDrive · Documents)'),
            ('logo/', 'apps360-logo · -fond-sombre · -bleu · -blanc   (.svg + .png 2000 px)'),
            ('symbole/', 'apps360-symbole · -fond-sombre · -bleu · -blanc   (.svg + .png 1024 px)'),
            ('icones/', 'apps360-icone.svg + PNG 16→1024 · apps360-icone-carree (iOS / Android) · favicon.ico'),
            ('reseaux/', 'apps360-avatar (1080, 320) · apps360-partage-1200x630'),
            ('Site (dépôt)', 'public/brand/ · public/icon-apps360.svg · public/apple-touch-icon.png · app/favicon.ico'),
            ('Kit source', 'brand/  (README, scripts de génération, police Outfit) — pour toute nouvelle déclinaison')]
    for i, (k, v) in enumerate(rows):
        yy = y - 24 - i * 14.5
        label(c, k, M + 16, yy, 9, 'XB', NAVY); label(c, v, M + 120, yy, 9, 'RG', TXT)

os.makedirs(O, exist_ok=True)
c = canvas.Canvas(f'{O}/apps360-charte-graphique.pdf', pagesize=landscape(A4))
c.setTitle('apps360.fr — charte graphique'); c.setAuthor('apps360.fr')
page1(c); c.showPage(); page2(c); c.showPage(); c.save()
print('ok', f'{O}/apps360-charte-graphique.pdf')
