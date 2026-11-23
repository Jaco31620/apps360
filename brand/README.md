# Identité visuelle apps360.fr

Kit source du logo (novembre 2026) : de quoi régénérer tous les fichiers ou créer de nouvelles déclinaisons.

## La marque

- **Nom :** « apps360 » + « .fr » (petit, Outfit Medium, gris).
- **Favicon :** symbole à 86 % dans le carré arrondi (`apps360-favicon.svg`, `favicon.ico`, `public/icon-apps360.svg`) pour rester lisible à 16 px ; les icônes d'écran d'accueil gardent leur marge (60 %), l'avatar réseaux est à 70 %.
- **Symbole :** le « 0 » de 360 est un cycle de trois flèches (orange → turquoise → bleu nuit, sens horaire depuis le haut). Pointes emboîtées, écarts à bords parallèles, l'ensemble tourné de 20°. Anneau : rayon extérieur 50, intérieur 24 (trait = 26 % du diamètre). Le même dessin sert partout (seul, dans le nom, icônes).
- **Dans le nom :** le « 0 » a la hauteur du « 6 » d'Outfit ExtraBold (0,72 em) et descend de 0,011 em sous la ligne de base. Pas d'ovale.
- **Police :** Outfit (Google Fonts, OFL) — ExtraBold 800 pour « apps36 », Medium 500 pour « .fr » (0,45 em). Espacement −0,02 em.

| Couleur | Fond clair | Fond sombre | Rôle |
|---|---|---|---|
| Orange | `#FF7A1A` | `#FF7A1A` | 1re flèche, accents |
| Turquoise | `#14C8B6` | `#2DE0CC` | 2e flèche |
| Bleu nuit | `#14306B` | blanc | 3e flèche, texte, fonds sombres |
| Gris « .fr » | `#6B6B73` | `#AAB4CC` | « .fr » |

## Fichiers

- Site : `public/brand/` (logos, symboles, icônes, image de partage), `public/icon-apps360.svg`, `public/apple-touch-icon.png`, `public/favicon.ico` (dans public/ et non app/ : sinon Next.js l’ajoute d’office à toutes les pages, par-dessus les icônes propres des apps).
- Livrables complets (OneDrive) : `C:\Users\jaco3\OneDrive\Documents\_Apps360\` — `logo/`, `symbole/`, `icones/`, `reseaux/`, charte PDF et texte.
- Planches de travail : canevas « Logo apps360 — pistes » sur claude.ai (dernières planches : « version finale », « .fr »).

## Régénérer

Prérequis : Python 3 avec `fonttools` et `uharfbuzz` (`pip install fonttools uharfbuzz`), et les dépendances Node du site (`sharp`).

```bash
python3 brand/scripts/brand.py   # SVG (textes convertis en tracés) dans brand/out/
node brand/scripts/raster.js     # PNG, favicon.ico, avatar, image de partage
python3 brand/scripts/charte_pdf.py  # charte graphique PDF (pip install reportlab)
```

Le site utilise les couleurs via Tailwind (`brand-orange`, `brand-teal`, `brand-navy`, `brand-cream`…, voir `tailwind.config.js`) et la police via `font-outfit` (chargée dans `app/layout.jsx`). Les pages « site » (accueil, connexion, soutien) suivent la charte ; les apps gardent leur propre identité. `components/BrandShell.jsx` = cadre des pages site.

`brand.py` contient la géométrie du symbole (`SYM`), les palettes (`PAL`) et la composition du logo (`logo_parts`) : c'est là qu'on ajoute une déclinaison (nouvelle couleur, format, bannière…).
