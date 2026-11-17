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

## En cours
- [ ] Étape 2 DNS OVH (zone apps360.fr) :
  - supprimer A @ et A www → 51.91.236.255 ; AAAA @ et AAAA www → 2001:41d0:301::29
  - ajouter A @ → 216.198.79.1 ; CNAME www → 9196647e64f70a7d.vercel-dns-017.com.
  - NE PAS toucher : MX OVH (mx1 prio 1, mx2 prio 5, mx3 prio 100), TXT SPF `v=spf1 include:mx.ovh.com -all`, NS, autoconfig/autodiscover.
  - vérif : `curl -s "https://dns.google/resolve?name=apps360.fr&type=A"` (dig absent de WSL), puis Refresh dans Vercel.

## À faire
- [ ] 3. Resend : ajouter/vérifier apps360.fr (DKIM/SPF/MX sur `send.` et `resend._domainkey` dans la zone OVH),
      y compris pour la clé FFBB (RESEND_FFBB_KEY) si compte séparé. Tant que non vérifié, les e-mails échouent.
- [ ] 4. Supabase Auth : Site URL `https://apps360.fr`, Redirect URLs `https://apps360.fr/**`.
- [ ] 5. GitHub : renommer le dépôt Jaco31620/perf360 → apps360 ; puis `git remote set-url origin git@github.com:Jaco31620/apps360.git`
      sur CHAQUE machine (PC fixe + portable). Vérifier que Vercel suit (Settings → Git).
- [ ] 6. Vercel : renommer le projet perf360 → apps360 (+ avatar « p360 ») ; ajouter apps360.vercel.app si dispo ;
      mettre à jour keep-alive.yml et ORIGINS ; vérifier la pastille « 1 » sur Environment Variables.
- [ ] 7. Vérifs bout en bout : HTTPS apps360.fr + redirection www, envoi d'un e-mail (jukebox contact, clic-clac, nuage, FFBB), connexion Supabase.
- [ ] 8. Ménage : retirer perf360.fr du projet Vercel ; ancien domaine perf360.fr dans Resend ; modèles d'e-mail FFBB en base mentionnant perf360 ;
      (blackroll-codes.com reste, non concerné).
- [ ] 9. Dossier local `~/perf360` → `~/apps360` sur chaque machine, et copier la mémoire Claude
      (`~/.claude/projects/-home-jaco31-perf360/memory/` → `-home-jaco31-apps360/memory/`), mettre à jour la mémoire « perf360-deploy ».
- [ ] Fin : supprimer ce fichier.
