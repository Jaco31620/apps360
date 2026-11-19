# Clic-Clac : migration du stockage Supabase → Cloudflare R2

Le code gère les deux fournisseurs. Le choix se fait par la variable Vercel
`CLICCLAC_STORAGE` : absente (ou `supabase`) = Supabase Storage, `r2` = R2.
Code : `lib/clicclac/server.js` (aiguillage) et `lib/clicclac/r2.js` (pilote R2).

## 1. Cloudflare

1. Créer un compte Cloudflare, puis **R2 Object Storage** → activer (carte bancaire demandée).
2. Facturation → mettre une **alerte de facturation** (ex. 1 $).
3. **Create bucket** : nom `clicclac`, Location = *Automatic* ou *Western Europe (WEUR)*.
   - Si on choisit la juridiction **EU** : ajouter `R2_JURISDICTION=eu` dans Vercel.
   - Laisser l'accès public **désactivé** (bucket privé, liens signés).
4. Bucket → **Settings → CORS Policy** → coller :

   ```json
   [{"AllowedOrigins":["https://apps360.fr","https://www.apps360.fr","http://localhost:3000"],"AllowedMethods":["GET","HEAD"],"AllowedHeaders":["*"],"MaxAgeSeconds":3600}]
   ```

   (indispensable : téléchargement des photos, export, cadre personnalisé dessiné sur canvas)
5. R2 → **Manage API tokens → Create API token** : permission *Object Read & Write*,
   limité au bucket `clicclac`. Noter l'**Access Key ID**, le **Secret Access Key**
   (affiché une seule fois) et l'**Account ID** (visible dans l'URL S3 `https://<account_id>.r2.cloudflarestorage.com`).

## 2. Vercel (Settings → Environment Variables, Production)

`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET=clicclac`
(+ `R2_JURISDICTION=eu` le cas échéant). **Ne pas encore** ajouter `CLICCLAC_STORAGE`.
Redéployer.

## 3. Copie des fichiers existants

Super-admin Clic-Clac → encart Stockage → « Copie des photos vers Cloudflare R2 » →
**Lancer la copie**. Idempotent, relançable ; rien n'est supprimé chez Supabase.

## 4. Bascule

Ajouter `CLICCLAC_STORAGE=r2` dans Vercel, redéployer, puis **relancer la copie**
(rattrape les photos envoyées entre-temps). L'encart Stockage affiche « Cloudflare R2 ».
Vérifier : une galerie, l'écran live, l'envoi d'une photo, un téléchargement.

Retour arrière : supprimer `CLICCLAC_STORAGE` et redéployer (les photos envoyées
après la bascule ne seraient alors pas visibles).

## 5. Nettoyage (après quelques jours sans souci)

Supabase → Storage → bucket `clicclac` → vider les fichiers (libère le quota de 1 Go).
