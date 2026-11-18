"""Post Instagram « manifeste » (1080 × 1350, version A validée le 18/11/2026).
python3 brand/scripts/insta_manifeste.py → brand/out/reseaux/apps360-post-manifeste.svg (PNG : node brand/scripts/raster.js)
"""
import os, importlib.util
HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location('brand', os.path.join(HERE, 'brand.py'))
B = importlib.util.module_from_spec(spec); spec.loader.exec_module(B)  # régénère aussi les fichiers de base

W, H = 1080, 1350
K = W / 400  # la maquette validée faisait 400 × 500

def metrics(k, size):
    f, t, gs, order, upm = B.font(k); hh = t['hhea']
    return hh.ascent / upm * size, -hh.descent / upm * size

def line(k, text, size, color, x, box_top, lh):
    """Texte posé comme en CSS : boîte de hauteur lh, ligne de base centrée selon les métriques."""
    asc, desc = metrics(k, size)
    base = box_top + (lh - (asc + desc)) / 2 + asc
    d, _, _ = B.text_path(k, text, size, x, base, -0.02 * size)
    return f'<path fill="{color}" d="{d}"/>'

parts = [f'<rect width="{W}" height="{H}" fill="#14306B"/>']
# grand symbole qui déborde en haut à droite, sans toucher le texte (bas du symbole au-dessus de la 1re ligne)
parts.append(B.sym_group(B.PAL['sombre']['sym'], 330, -370, 900))
# les trois promesses (40 px de maquette), bloc calé à 120 px du bas
fs = 40 * K; x = 36 * K; gap = 4 * K
lh1 = fs * 1.02; lh3 = fs * 1.05
bottom = H - 120 * K
top3 = bottom - 2 * lh3; top2 = top3 - gap - lh1; top1 = top2 - gap - lh1
parts.append(line('xb', 'Des applis utiles.', fs, '#FFFFFF', x, top1, lh1))
parts.append(line('xb', 'Sans pub.', fs, '#FF7A1A', x, top2, lh1))
parts.append(line('xb', 'Sans exploiter', fs, '#2DE0CC', x, top3, lh3))
parts.append(line('xb', 'vos données.', fs, '#2DE0CC', x, top3 + lh3, lh3))
# accroche
fs2 = 15 * K; lh2 = fs2 * 1.4
parts.append(line('md', 'Juste là pour faire le job.', fs2, '#AAB4CC', x, H - 74 * K - lh2, lh2))
# logo en bas à gauche (22 px de maquette)
fsl = 22 * K; asc, desc = metrics('xb', fsl)
base = (H - 30 * K - fsl) + (fsl - (asc + desc)) / 2 + asc
body, _ = B.logo_parts('sombre', fs=fsl)
parts.append(f'<g transform="translate({x:.2f} {base:.2f})">{body}</g>')

svg = (f'<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}">'
       f'<title>apps360 — Des applis utiles. Sans pub. Sans exploiter vos données.</title>{"".join(parts)}</svg>\n')
B.save('out/reseaux/apps360-post-manifeste.svg', svg)
print('ok out/reseaux/apps360-post-manifeste.svg')
