/*
 * Formulaire de contact — gestes de secours pendant une soirée (« Ça ne marche pas »).
 * À garder d'accord avec les apps et leurs aides. Clé : icône de lib/apps.js.
 */
export const RESCUE = {
  jukebox: {
    help: { href: "/jukebox/aide", label: "Tout le mode d'emploi" },
    items: [
      { q: "Plus de musique", a: "Rechargez la page de l'appareil qui joue le son, gardez-la au premier plan et vérifiez qu'il ne s'est pas mis en veille. Puis appuyez sur lecture." },
      { q: "La télé affiche la soirée, mais sans son", a: "Appuyez sur OK avec la télécommande de la télé, puis vérifiez le volume de la télé et celui de la page Organiser." },
      { q: "La télé ne suit plus ou s'est fermée", a: "Sur la télé, ouvrez apps360.fr/tv et choisissez votre soirée sous « Reprendre ». Sinon, reconnectez-la depuis la page Organiser : 📺 Connecter une télé." },
      { q: "J'ai perdu les commandes", a: "Ouvrez apps360.fr/jukebox, « Mes soirées ». Sur un autre appareil, rouvrez le lien reçu et tapez le code organisateur." },
      { q: "Un invité ne peut pas ajouter de titre", a: "Sur la page Organiser, vérifiez que les ajouts des invités sont ouverts. Il a peut-être aussi atteint son nombre de titres en attente." },
    ],
  },
  clicclac: {
    items: [
      { q: "Une photo n'apparaît pas", a: "Si le réseau est lent, elle reste sur le téléphone et part toute seule : gardez la page ouverte. Sinon, elle attend peut-être la validation de l'organisateur." },
      { q: "Je ne peux plus ajouter de photo", a: "Vous avez peut-être utilisé toutes vos photos (le nombre restant est affiché sous les boutons), ou l'organisateur a fermé les envois." },
      { q: "Le mode cabine ou la borne ne montre pas d'image", a: "Autorisez la caméra pour apps360.fr dans le navigateur, puis rechargez la page. Vérifiez aussi qu'aucune autre application n'utilise la caméra. Sur téléphone, vous pouvez sinon utiliser « 📸 Prendre une photo »." },
      { q: "L'écran d'affichage ne bouge plus", a: "Rechargez la page sur cet écran. Sur une télé, ouvrez apps360.fr/tv et choisissez votre album sous « Reprendre »." },
      { q: "J'ai perdu mes accès d'organisateur", a: "Sur apps360.fr/clic-clac, « Espace organisateur » en bas de page : code de l'album et code organisateur. Le lien reçu par e-mail fonctionne 7 jours." },
    ],
  },
};
