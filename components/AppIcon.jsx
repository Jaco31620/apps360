/*
 * Icône d'une app dans les pages (en-têtes, cartes, liens de retour) : même
 * image et même arrondi que l'icône d'écran d'accueil. Décorative (alt vide) :
 * toujours à côté du nom de l'app. Taille par className (w-20 en tête d'accueil,
 * w-16 pages secondaires, w-6 liens de retour).
 * Nuage : PNG, car son SVG contient du texte (rendu variable selon les polices).
 */
import { appIcon } from "@/lib/appIcons";

export default function AppIcon({ app, className = "w-6 h-6" }) {
  return <img src={appIcon(app)} alt="" aria-hidden="true" className={`inline-block shrink-0 ${className}`} style={{ borderRadius: "22.5%" }} />;
}
