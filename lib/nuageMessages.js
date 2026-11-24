/*
 * Nuage de mots — messages à envoyer (super-admin, organisateur). PUR : partagé
 * client + serveur.
 *  - presenter : UN seul lien, celui de commande, comme Jukebox : le reste est
 *    sur la page (le code est dans la partie #… de l'adresse,
 *    jamais envoyée au serveur) ;
 *  - guest : invitation des participants ; - view : écran d'affichage.
 */
export const fmtPresenterCode = (c) => `${String(c).slice(0, 4)} ${String(c).slice(4)}`;

export const presenterLink = (o, n) => `${o}/nuage/${n.code}/presenter#p=${n.presenterCode}`;
export const viewLink = (o, code) => `${o}/nuage/${code}/presenter?affichage`;
export const guestLink = (o, code) => `${o}/nuage/${code}`;

export function nuageMessage(kind, o, n) {
  const subject = `Nuage de mots « ${n.question} »`.slice(0, 150);
  if (kind === "guest")
    return {
      subject,
      text: [
        `☁️ « ${n.question} »`,
        `Répondez ici 👉 ${guestLink(o, n.code)}`,
        `(ou code ${String(n.code).slice(0, 3)} ${String(n.code).slice(3)} sur ${o.replace(/^https?:\/\//, "")}/nuage)`,
      ].join("\n"),
    };
  if (kind === "view")
    return { subject, text: [`☁️ Nuage de mots « ${n.question} »`, "", `👉 ${viewLink(o, n.code)}`].join("\n") };
  return {
    subject,
    text: [
      `☁️ Nuage de mots « ${n.question} » : votre nuage est prêt !`,
      "",
      `👉 ${presenterLink(o, n)}`,
      `🔑 Code organisateur, si un autre appareil le demande : ${fmtPresenterCode(n.presenterCode)}`,
      "",
      "Tout le reste est sur la page : QR code et lien pour les participants, écran d'affichage, réglages (⚙️).",
      "",
      "Gardez ce message pour vous : il donne les commandes du nuage.",
    ].join("\n"),
  };
}
