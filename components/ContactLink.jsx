/*
 * Lien « Une question, une idée, un souci ? » vers le formulaire de contact, app
 * déjà choisie. À placer en bas des accueils et des pages d'aide, jamais sur un
 * écran télé ni pendant une action. app : icône de lib/apps.js.
 */
import Link from "next/link";

export default function ContactLink({ app, className = "", children }) {
  return <Link href={app ? `/contact?app=${app}` : "/contact"} className={className || "underline"}>{children || "Une question, une idée, un souci ?"}</Link>;
}
