"use client";
import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { MailCheck, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import BrandShell from "@/components/BrandShell";

function ConnexionInner() {
  const { signIn, user, signOut } = useAuth();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/";
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("idle");
  const [err, setErr] = useState("");

  const handleSubmit = async () => {
    if (!email.trim()) return setErr("Entre ton adresse email.");
    setStatus("sending"); setErr("");
    try {
      await signIn(email.trim(), next);
      setStatus("sent");
    } catch (e) {
      setErr(e.message || "Une erreur est survenue.");
      setStatus("idle");
    }
  };

  if (user) {
    return (
      <main className="max-w-md mx-auto px-4 py-12 text-center space-y-6">
        <CheckCircle2 size={48} className="mx-auto text-teal-600" aria-hidden="true" />
        <h1 className="font-outfit text-2xl font-extrabold text-brand-navy">Tu es connecté</h1>
        <p className="text-gray-600 text-sm">{user.email}</p>
        <div className="flex flex-col gap-2 items-center">
          <Link href={next} className="bg-brand-navy hover:bg-brand-navy-dark text-white px-6 py-2.5 rounded-full text-sm font-semibold">
            {next === "/" ? "Retour aux apps" : "Continuer"}
          </Link>
          <button onClick={signOut} className="text-xs text-gray-500 hover:underline">Se déconnecter</button>
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-md mx-auto px-4 py-12 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="font-outfit text-3xl font-extrabold text-brand-navy">Connexion</h1>
        <p className="text-gray-600 text-sm">Reçois un lien de connexion par email — pas de mot de passe à retenir.</p>
      </div>
      {status === "sent" ? (
        <div className="bg-white border border-teal-200 rounded-2xl p-6 text-center space-y-2">
          <MailCheck size={36} className="mx-auto text-teal-600" aria-hidden="true" />
          <h2 className="font-outfit font-extrabold text-brand-navy">Email envoyé !</h2>
          <p className="text-sm text-gray-600">Clique sur le lien dans l'email que nous t'avons envoyé à <strong>{email}</strong> pour te connecter.</p>
          <p className="text-xs text-gray-500 mt-2">Pense à vérifier tes spams.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
          <div>
            <label htmlFor="email" className="text-xs text-gray-600 mb-1 block">Ton email</label>
            <input id="email" type="email" className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-teal focus:border-brand-teal"
              value={email} onChange={e => setEmail(e.target.value)} placeholder="ton@email.fr"
              onKeyDown={e => e.key === "Enter" && handleSubmit()} />
          </div>
          {err && <p className="text-red-600 text-xs">{err}</p>}
          <button onClick={handleSubmit} disabled={status === "sending"}
            className="w-full bg-brand-navy hover:bg-brand-navy-dark disabled:opacity-50 text-white py-3 rounded-full font-semibold transition-colors">
            {status === "sending" ? "Envoi…" : "Recevoir le lien de connexion"}
          </button>
        </div>
      )}
      <p className="text-center text-xs text-gray-500">
        <Link href={next} className="hover:underline">← Retour</Link>
      </p>
    </main>
  );
}

export default function ConnexionPage() {
  return (
    <BrandShell>
      <Suspense fallback={
        <main className="max-w-md mx-auto px-4 py-12 text-center">
          <p className="text-gray-500 animate-pulse">Chargement…</p>
        </main>
      }>
        <ConnexionInner />
      </Suspense>
    </BrandShell>
  );
}
