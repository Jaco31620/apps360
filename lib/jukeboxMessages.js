/*
 * Jukebox — messages prêts à envoyer (copier, partager, WhatsApp, SMS,
 * e-mail) : invitation de l'organisateur (super-admin, page Organiser), code
 * d'activation, message pour les invités. Tous renvoient au mode d'emploi.
 */
const spaced = (c) => (c ? `${String(c).slice(0, 3)} ${String(c).slice(3)}` : "…");
const hostOf = (origin) => String(origin || "").replace(/^https?:\/\//, "");
export const helpUrl = (origin) => `${origin}/jukebox/aide`;

/* Organisateur d'une soirée déjà créée : un seul lien (page Organiser) + le code
 * organisateur ; tout le reste (lien invités, écran, télé) se
 * trouve sur la page, via la barre du haut et l'onglet 📣 Inviter. */
export function inviteText({ origin, code, name, regieCode }) {
  return [
    `🎶 Jukebox « ${name} » : votre soirée est prête !`,
    "",
    `👉 ${origin}/jukebox/${code}/organiser`,
    `🔑 Code organisateur : ${spaced(regieCode)}`,
    "",
    "Tout le reste est sur la page : commandes de la musique, lien pour les invités, écran d'affichage, télé.",
    `❓ Mode d'emploi : ${helpUrl(origin)}`,
    "",
    "Gardez ce message pour vous : il donne les commandes de la soirée.",
  ].join("\n");
}

/* Code d'activation : l'organisateur crée lui-même ses soirées. */
export function activationText({ origin, code, label, partiesText, expiresText, validText }) {
  return [
    `Bonjour ${label},`,
    "",
    `Voici votre code d'activation Jukebox : ${code}`,
    `Il vous permet de créer ${partiesText}${expiresText ? `, jusqu'au ${expiresText}` : ""}.`,
    ...(validText ? [`Chaque soirée reste ouverte ${validText} à partir de sa création.`] : []),
    "",
    `1. Créez votre soirée : ${origin}/jukebox?activation=${code}`,
    "2. Pilotez-la depuis votre téléphone ou un ordinateur (page Organiser).",
    `3. Pour la musique sur la télé : ouvrez ${hostOf(origin)}/tv dans son navigateur et connectez-la depuis la page Organiser.`,
    "",
    `❓ Mode d'emploi : ${helpUrl(origin)}`,
  ].join("\n");
}

/* Invités (groupe WhatsApp de la soirée…). */
export function guestText({ origin, code, name }) {
  return [
    `🎶 « ${name} » : c'est vous qui choisissez la musique !`,
    `Proposez vos titres ici 👉 ${origin}/jukebox/${code}`,
    `(ou code ${spaced(code)} sur ${hostOf(origin)}/jukebox)`,
  ].join("\n");
}
