# Identité visuelle apps360.fr

Kit source du logo (novembre 2026) : de quoi régénérer tous les fichiers ou créer de nouvelles déclinaisons.

## La marque

- **Nom :** « apps360 » + « .fr » (petit, Outfit Medium, gris).
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

- Site : `public/brand/` (logos, symboles, icônes, image de partage), `public/icon-apps360.svg`, `public/apple-touch-icon.png`, `app/favicon.ico`.
- Livrables complets (OneDrive) : `C:\Users\jaco3\OneDrive\Documents\_Apps360\` — `logo/`, `symbole/`, `icones/`, `reseaux/`, charte PDF et texte.
- Planches de travail : canevas « Logo apps360 — pistes » sur claude.ai (dernières planches : « version finale », « .fr »).

## Régénérer

Prérequis : Python 3 avec `fonttools` et `uharfbuzz` (`pip install fonttools uharfbuzz`), et les dépendances Node du site (`sharp`).

```bash
python3 brand/scripts/brand.py   # SVG (textes convertis en tracés) dans brand/out/
node brand/scripts/raster.js     # PNG, favicon.ico, avatar, image de partage
```

`brand.py` contient la géométrie du symbole (`SYM`), les palettes (`PAL`) et la composition du logo (`logo_parts`) : c'est là qu'on ajoute une déclinaison (nouvelle couleur, format, bannière…).
