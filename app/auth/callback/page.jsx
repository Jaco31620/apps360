"use client";
import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

function Waiting() {
  return (
    <main className="min-h-screen bg-brand-cream flex flex-col items-center justify-center px-4 text-center gap-4">
      <img src="/brand/apps360-symbole.svg" alt="" aria-hidden="true" className="w-14 h-14 animate-spin [animation-duration:2.4s]" />
      <p className="text-gray-600">Connexion en cours…</p>
    </main>
  );
}

function AuthCallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  useEffect(() => {
    const next = searchParams.get("next") || "/";
    // Supabase parse automatiquement les tokens dans l'URL (hash ou query)
    supabase.auth.getSession().then(() => {
      router.replace(next);
    });
  }, [router, searchParams]);
  return <Waiting />;
}

export default function AuthCallback() {
  return (
    <Suspense fallback={<Waiting />}>
      <AuthCallbackInner />
    </Suspense>
  );
}
