# Migration perf360.fr → apps360.fr (en cours, démarrée le 17/11/2026)

Fichier de suivi temporaire : à supprimer une fois la migration terminée.
Pour reprendre dans une nouvelle session Claude : « reprends la migration apps360, voir MIGRATION-APPS360.md ».

## Contexte
- Nouveau domaine **apps360.fr** (OVH, offre MX Plan 001 : 1 boîte mail + hébergement 100 Mo inutilisé).
  DNS géré chez OVH (ns103/dns103.ovh.net) — on le garde chez OVH.
- perf360.fr appartient toujours à l'utilisateur mais ne doit plus servir pour ces apps.
- Pas de vrais clients, seulement quelques bêta-testeurs (prévenus manuellement) : pas besoin de ménager la transition.
- Objectif : tout renommer proprement à tous les niveaux (code, Vercel, GitHub, Resend, Supabase, dossier local).

## Fait
- [x] Code : perf360 → apps360 partout (commit a049662) : liens, QR, expéditeurs `noreply@apps360.fr`,
      marque, icône `public/icon-apps360.svg` (« a360 »), manifeste, package.json, clé localStorage `apps360_uid`.
      Restent volontairement sur `perf360.vercel.app` : `.github/workflows/keep-alive.yml` et
      `ORIGINS` dans `lib/jukeboxRequests.js` (à changer à l'étape 6).
- [x] Étape 1 Vercel : apps360.fr ajouté (→ Production), www.apps360.fr → 308 → apps360.fr.
      Valeurs DNS données par Vercel : `A @ 216.198.79.1` ; `CNAME www 9196647e64f70a7d.vercel-dns-017.com.`
- [x] Étape 2 DNS OVH : anciens A/AAAA OVH supprimés, A @ → 216.198.79.1, CNAME www → Vercel
      (il a fallu supprimer le TXT `www "3|welcome"` d'OVH). MX/SPF/DKIM OVH intacts.
      apps360.fr et www (308 → apps360.fr) OK en HTTPS, « Valid Configuration » dans Vercel.
- [x] Étape 3 Resend : apps360.fr ajouté (eu-west-1) et « Verified » le 17/11. Zone OVH : TXT `resend._domainkey` (DKIM),
      CNAME `rsend` → rsend-euw1.forge.rmta.net., CNAME `send` → send.forge.rmta.net., TXT `_dmarc`
      (`v=DMARC1; p=none; rua=mailto:jaco31@gmail.com; adkim=r; aspf=r`). Rien à faire pour la clé FFBB (même compte).- [x] Étape 4 Supabase Auth : Site URL `https://apps360.fr`, Redirect URL `https://apps360.fr/**` ajoutée,
      SMTP custom (Resend) expéditeur `noreply@apps360.fr` / « Apps360 ».- [x] Étape 5 GitHub : dépôt renommé Jaco31620/apps360 (17/11). Remote mis à jour sur le PC fixe.
      RESTE : sur le portable, `git remote set-url origin git@github.com:Jaco31620/apps360.git` (fait à l'étape 9).- [x] Étape 6 Vercel : projet renommé apps360, apps360.vercel.app ajouté (→ Production), Git suit Jaco31620/apps360.
      keep-alive.yml appelle désormais https://apps360.fr/api/keep-alive ; ORIGINS jukebox : perf360.vercel.app → apps360.vercel.app.- [x] Étape 7 tests (17/11) : HTTPS OK ; lien magique OK (modèle Supabase Magic Link passé en apps360) ;
      contact@apps360.fr créé (MX Plan OVH, redirection sans copie → jaco31@gmail.com), reçu OK ;
      Jukebox demande + code OK, SPF/DKIM/DMARC pass. Test FFBB reporté (à faire plus tard, hors migration).
      Code : CONTACT_EMAIL (lib/clicclac/mail.js) = destinataire des demandes/alertes et reply-to par défaut ; pied de page accueil.

## À faire
- [ ] 8. Ménage : FAIT perf360.fr + perf360.vercel.app retirés de Vercel, perf360.fr retiré de Resend, Redirect URLs perf360 retirées de Supabase.
      Base Supabase scannée le 17/11 : 33 tables, aucune mention de perf360. (blackroll-codes.com reste, non concerné.)
      EN COURS : page « perf360 devient apps360 » (middleware.js, redirection auto 5 s vers la même URL sur apps360.fr) ;
      à faire : rajouter perf360.fr et www.perf360.fr dans Vercel (Production). DNS perf360.fr pointe déjà sur Vercel (216.198.79.1).
      Plus tard (quand perf360.fr resservira) : retirer ce bloc du middleware et les domaines de Vercel.
- [ ] 9. Portable : `git remote set-url origin git@github.com:Jaco31620/apps360.git`.
      Dossier local `~/perf360` → `~/apps360` sur chaque machine, et copier la mémoire Claude
      (`~/.claude/projects/-home-jaco31-perf360/memory/` → `-home-jaco31-apps360/memory/`), mettre à jour la mémoire « perf360-deploy ».
- [ ] Fin : supprimer ce fichier.
