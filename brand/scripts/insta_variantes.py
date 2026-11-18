"""Variantes du post « manifeste » avec un logo plus présent (1080 × 1350)."""
import os, importlib.util
HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location('m', os.path.join(HERE, 'insta_manifeste.py'))
M = importlib.util.module_from_spec(spec); spec.loader.exec_module(M)
B, W, H, line = M.B, M.W, M.H, M.line
FS = 108; LH1 = FS * 1.02; LH3 = FS * 1.05; GAP = 10.8; X = 97

def promesses(top1, x=X):
    top2 = top1 + LH1 + GAP; top3 = top2 + LH1 + GAP
    return [line('xb', 'Des applis utiles.', FS, '#FFFFFF', x, top1, LH1), line('xb', 'Sans pub.', FS, '#FF7A1A', x, top2, LH1),
            line('xb', 'Sans exploiter', FS, '#2DE0CC', x, top3, LH3), line('xb', 'vos données.', FS, '#2DE0CC', x, top3 + LH3, LH3)], top3 + 2 * LH3

def logo(pal, fs, x, base):
    body, bb = B.logo_parts(pal, fs=fs)
    return f'<g transform="translate({x:.1f} {base:.1f})">{body}</g>', (bb[2] - bb[0])

def doc(parts, name):
    s = (f'<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}">'
         f'<rect width="{W}" height="{H}" fill="#14306B"/>{"".join(parts)}</svg>\n')
    B.save(f'out/reseaux/{name}.svg', s)

tag = lambda y: line('md', 'Juste là pour faire le job.', 40.5, '#AAB4CC', X, y, 56.7)

# L1 · logo en tête, symbole en filigrane en bas à droite
p = [B.sym_group(['#FFFFFF'] * 3, 330, 380, 1150).replace('<g transform', '<g opacity="0.07" transform', 1)]  # grand filigrane sous les textes
g, w = logo('sombre', 190, X - 4, 300); p.append(g)
t, end = promesses(470); p += t; p.append(tag(end + 40))
doc(p, 'apps360-post-manifeste-L1')

# L2 · grand symbole en haut, texte remonté, logo en grand en bas
p = [B.sym_group(B.PAL['sombre']['sym'], 330, -370, 900)]
t, end = promesses(540); p += t; p.append(tag(end + 26))
g, w = logo('sombre', 150, X - 4, 1235); p.append(g)
doc(p, 'apps360-post-manifeste-L2')

# L3 · promesses sur bleu nuit, bandeau clair en bas avec le logo centré
p = [B.sym_group(B.PAL['sombre']['sym'], 480, -340, 700)]
t, end = promesses(420); p += t; p.append(tag(end + 26))
p.append(f'<rect x="0" y="1050" width="{W}" height="300" fill="#F5F4F0"/>')
body, bb = B.logo_parts('clair', fs=170); lw = bb[2] - bb[0]
p.append(f'<g transform="translate({(W - lw) / 2 - bb[0]:.1f} {1050 + 150 + 52:.1f})">{body}</g>')
doc(p, 'apps360-post-manifeste-L3')
print('ok')
