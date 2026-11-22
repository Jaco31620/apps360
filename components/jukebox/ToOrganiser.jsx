"use client";
/* Anciennes adresses /regie et /telecommande : renvoient vers la page
 * Organiser, en gardant #t= / #j= (jeton ou passe d'accès). */
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ToOrganiser({ code }) {
  const router = useRouter();
  useEffect(() => { router.replace(`/jukebox/${code}/organiser${window.location.hash}`); }, [code, router]);
  return <div className="min-h-screen bg-gray-950" />;
}
