/*
 * Clic-Clac — message d'accès à envoyer à l'organisateur. PUR : partagé client +
 * serveur. UN seul lien (connexion directe, 7 jours), plus le code organisateur
 * quand il est connu : passé 7 jours, la page le demande. Le reste (invités,
 * écran d'affichage, télécommande) est dans l'espace organisateur.
 */
export const guestLink = (o, code) => `${o}/clic-clac/${code}`;
export const liveLink = (o, code) => `${o}/clic-clac/${code}/live`;
export const organizerLink = (o, code, pass) => `${o}/clic-clac/${code}/admin${pass ? `#j=${pass}` : ""}`;

const day = (d) => new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Paris" });

/* album : { name, code } · link : { pass, expiresAt } · pin : code organisateur ou null */
export function organizerMessage(o, album, link, pin) {
  return {
    subject: `Clic-Clac — votre album « ${album.name} »`,
    text: [
      `📸 Clic-Clac « ${album.name} » : votre album est prêt !`,
      "",
      `👉 ${organizerLink(o, album.code, link.pass)}`,
      pin
        ? `🔑 Code organisateur : ${pin} (demandé après le ${day(link.expiresAt)} ou sur un autre appareil : gardez-le)`
        : `Lien direct valable jusqu'au ${day(link.expiresAt)}. Ensuite, le code organisateur qui vous a été communiqué est demandé.`,
      "",
      "Tout le reste est sur la page : QR code et lien pour les invités, écran d'affichage, télécommande, réglages.",
      "",
      "Gardez ce message pour vous : il donne les commandes de l'album.",
    ].join("\n"),
  };
}
