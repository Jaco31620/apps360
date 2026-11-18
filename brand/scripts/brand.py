import os, sys, uharfbuzz as hb
from fontTools.ttLib import TTFont
HERE=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.dirname(HERE)
os.chdir(ROOT)  # chemins relatifs à brand/
# polices statiques tirées de la police variable Outfit (créées au premier lancement)
from fontTools.varLib import instancer
for w,n in [(800,'Outfit-ExtraBold'),(500,'Outfit-Medium')]:
    if not os.path.exists(f'fonts/{n}.ttf'):
        instancer.instantiateVariableFont(TTFont('fonts/Outfit-VF.ttf'),{'wght':w}).save(f'fonts/{n}.ttf')
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.boundsPen import BoundsPen

FONTS={'xb':'fonts/Outfit-ExtraBold.ttf','md':'fonts/Outfit-Medium.ttf'}
_cache={}
def font(k):
    if k not in _cache:
        p=FONTS[k]; d=open(p,'rb').read(); f=hb.Font(hb.Face(d)); t=TTFont(p)
        _cache[k]=(f,t,t.getGlyphSet(),t.getGlyphOrder(),t['head'].unitsPerEm)
    return _cache[k]

def text_path(k, s, size, x0, base, ls=0.0):
    """Tracé SVG du texte s (taille size), à partir de x0 sur la ligne de base base. Renvoie (d, x_fin, bounds)."""
    f,t,gs,order,upm=font(k); sc=size/upm
    buf=hb.Buffer(); buf.add_str(s); buf.guess_segment_properties(); hb.shape(f,buf,{"kern":True,"liga":True})
    pen=SVGPathPen(gs); bp=BoundsPen(gs); x=x0
    for info,pos in zip(buf.glyph_infos,buf.glyph_positions):
        tr=(sc,0,0,-sc,x+pos.x_offset*sc,base-pos.y_offset*sc)
        g=gs[order[info.codepoint]]; g.draw(TransformPen(pen,tr)); g.draw(TransformPen(bp,tr))
        x+=pos.x_advance*sc+ls
    return pen.getCommands(), x, bp.bounds

SYM=["M53.03 0.09 A50 50 0 0 1 94.69 72.42 L79.30 71.83 L72.16 59.22 A24 24 0 0 0 52.88 26.17 L60.21 13.71 Z",
     "M91.71 77.58 A50 50 0 0 1 8.24 77.50 L16.45 64.46 L30.94 64.58 A24 24 0 0 0 69.20 64.41 L76.32 76.99 Z",
     "M5.26 72.33 A50 50 0 0 1 47.07 0.09 L54.25 13.71 L46.90 26.20 A24 24 0 0 0 27.93 59.42 L13.47 59.30 Z"]
def sym_group(cols, x=0, y=0, size=100):
    s=size/100
    paths=''.join(f'<path fill="{c}" d="{d}"/>' for c,d in zip(cols,SYM))
    return f'<g transform="translate({x:.3f} {y:.3f}) scale({s:.5f}) rotate(20 50 50)">{paths}</g>'

PAL={
 'clair':  {'sym':['#FF7A1A','#14C8B6','#14306B'],'ink':'#14306B','fr':'#6B6B73'},
 'sombre': {'sym':['#FF7A1A','#2DE0CC','#FFFFFF'],'ink':'#FFFFFF','fr':'#AAB4CC'},
 'bleu':   {'sym':['#14306B']*3,'ink':'#14306B','fr':'#14306B'},
 'blanc':  {'sym':['#FFFFFF']*3,'ink':'#FFFFFF','fr':'#FFFFFF'},
}

def logo_parts(pal, fs=100.0):
    """Logo « apps36[0].fr » ; ligne de base y=0. Renvoie (contenu svg, bbox)."""
    p=PAL[pal]; ls=-0.02*fs
    d1,x,b1=text_path('xb','apps36',fs,0,0,ls)
    x+=0.03*fs; S=0.72*fs; sx=x; sy=-S+0.011*fs
    x+=S
    x+=0.1*0.45*fs
    d2,x2,b2=text_path('md','.fr',0.45*fs,x,0,ls)
    body=(f'<path fill="{p["ink"]}" d="{d1}"/>'+sym_group(p['sym'],sx,sy,S)+f'<path fill="{p["fr"]}" d="{d2}"/>')
    xmin=min(b1[0],sx); xmax=max(b2[2],sx+S); ymin=min(b1[1],sy); ymax=max(b1[3],sy+S)
    return body,(xmin,ymin,xmax,ymax)

def svg_doc(body, bbox, pad, bg=None, title=''):
    x0,y0,x1,y1=bbox; x0-=pad; y0-=pad; x1+=pad; y1+=pad; w=x1-x0; h=y1-y0
    bgr=f'<rect x="{x0:.3f}" y="{y0:.3f}" width="{w:.3f}" height="{h:.3f}" fill="{bg}"/>' if bg else ''
    return (f'<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="{x0:.3f} {y0:.3f} {w:.3f} {h:.3f}" width="{w:.1f}" height="{h:.1f}">'
            f'<title>{title}</title>{bgr}{body}</svg>\n')

def save(path, s):
    os.makedirs(os.path.dirname(path),exist_ok=True); open(path,'w').write(s)

O='out'
# --- logos (fond transparent) ---
for pal,name in [('clair','apps360-logo'),('sombre','apps360-logo-fond-sombre'),('bleu','apps360-logo-bleu'),('blanc','apps360-logo-blanc')]:
    body,bb=logo_parts(pal); save(f'{O}/logo/{name}.svg', svg_doc(body,bb,4,title='apps360.fr'))
# --- symbole seul ---
for pal,name in [('clair','apps360-symbole'),('sombre','apps360-symbole-fond-sombre'),('bleu','apps360-symbole-bleu'),('blanc','apps360-symbole-blanc')]:
    save(f'{O}/symbole/{name}.svg', svg_doc(sym_group(PAL[pal]['sym']),(0,0,100,100),0,title='apps360 symbole'))
# --- icône d'app : carré arrondi bleu nuit ---
icon=('<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="512" height="512"><title>apps360</title>'
      '<rect width="100" height="100" rx="23" fill="#14306B"/>'+sym_group(PAL['sombre']['sym'],20,20,60)+'</svg>\n')
save(f'{O}/icones/apps360-icone.svg', icon)
# icône pleine (sans arrondi) pour les plateformes qui arrondissent elles-mêmes (iOS, Android maskable)
full=('<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="512" height="512"><title>apps360</title>'
      '<rect width="100" height="100" fill="#14306B"/>'+sym_group(PAL['sombre']['sym'],22,22,56)+'</svg>\n')
save(f'{O}/icones/apps360-icone-carree.svg', full)
# --- avatar réseaux (carré plein, le réseau découpe le rond) ---
save(f'{O}/reseaux/apps360-avatar.svg', full.replace('22,22,56','0,0,0'))
av=('<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="1080" height="1080"><title>apps360</title>'
    '<rect width="100" height="100" fill="#14306B"/>'+sym_group(PAL['sombre']['sym'],24,24,52)+'</svg>\n')
save(f'{O}/reseaux/apps360-avatar.svg', av)
# --- image de partage 1200 × 630 ---
body,bb=logo_parts('sombre',fs=150)
lw=bb[2]-bb[0]; lx=(1200-lw)/2-bb[0]; ly=300
tag='Des applis utiles, sans pub et sans exploitation de vos données.'
dt,xt,bt=text_path('md',tag,36,0,0)
tx=(1200-(bt[2]-bt[0]))/2-bt[0]
og=(f'<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630"><title>apps360.fr</title>'
    f'<rect width="1200" height="630" fill="#14306B"/><g transform="translate({lx:.2f} {ly})">{body}</g>'
    f'<path fill="#AAB4CC" transform="translate({tx:.2f} 430)" d="{dt}"/></svg>\n')
save(f'{O}/reseaux/apps360-partage-1200x630.svg', og)
print('ok, logo bbox', [round(v,1) for v in logo_parts('clair')[1]])
