/*
 * Lien discret « soutenir apps360 », à placer dans une app à un moment de
 * satisfaction (fin de soirée, album téléchargé, tirage envoyé, fin de séance…),
 * jamais pendant que l'utilisateur agit. Même texte partout (cohérence).
 *   <SoutenirLink />                 sur fond clair
 *   <SoutenirLink dark />            sur fond sombre
 *   <SoutenirLink className="mt-6" />
 */
import Link from "next/link";
import { SOUTENIR_URL } from "@/lib/soutien";

export default function SoutenirLink({ dark = false, className = "" }) {
  return (
    <p className={`text-center text-sm ${dark ? "text-white/70" : "text-gray-500"} ${className}`}>
      ☕ Cette app vous a plu ?{" "}
      <Link href={SOUTENIR_URL} target="_blank"
        className={`font-semibold underline underline-offset-2 ${dark ? "text-white hover:text-white" : "text-gray-700 hover:text-gray-900"}`}>
        Soutenez apps360
      </Link>
      {" "}: un don aide à payer les serveurs et à garder les apps gratuites.
    </p>
  );
}
