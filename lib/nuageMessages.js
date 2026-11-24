/*
 * Nuage de mots — messages à envoyer (super-admin, organisateur). PUR : partagé
 * client + serveur.
 *  - presenter : lien de commande (le code est dans la partie #… de l'adresse,
 *    jamais envoyée au serveur) ; - view : consultation seule.
 */
const fmtCode = (c) => `${String(c).slice(0, 3)} ${String(c).slice(3)}`;
export const fmtPresenterCode = (c) => `${String(c).slice(0, 4)} ${String(c).slice(4)}`;

export const presenterLink = (o, n) => `${o}/nuage/${n.code}/presenter#p=${n.presenterCode}`;
export const viewLink = (o, code) => `${o}/nuage/${code}/presenter?affichage`;
export const guestLink = (o, code) => `${o}/nuage/${code}`;

export function nuageMessage(kind, o, n) {
  const subject = `Nuage de mots « ${n.question} »`.slice(0, 150);
  if (kind === "view")
    return { subject, text: [`☁️ Nuage de mots « ${n.question} »`, "", `👉 ${viewLink(o, n.code)}`].join("\n") };
  return {
    subject,
    text: [
      `☁️ Nuage de mots « ${n.question} » : votre accès présentateur.`,
      "",
      `👉 ${presenterLink(o, n)}`,
      `Sur un autre appareil : ${o}/nuage/${n.code}/presenter avec le code présentateur ${fmtPresenterCode(n.presenterCode)}`,
      "",
      "Gardez ce lien et ce code pour vous : ils donnent les commandes du nuage.",
      "",
      `Pour les participants : ${guestLink(o, n.code)} (code ${fmtCode(n.code)})`,
      `Pour un écran (sans réglages) : ${viewLink(o, n.code)}`,
    ].join("\n"),
  };
}
