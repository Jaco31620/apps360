"use client";
/* Connexion du backoffice (mot de passe super-admin commun). */
import { useState } from "react";
import PasswordInput from "@/components/PasswordInput";
import { login } from "./session";

export default function Login({ onDone }) {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setErr(""); setBusy(true);
    try { await login(pw); setPw(""); onDone(); } catch (e2) { setErr(e2.message); } finally { setBusy(false); }
  };
  return (
    <div className="min-h-screen bg-brand-cream flex items-start justify-center px-4 pt-16">
      <form onSubmit={submit} className="w-full max-w-sm bg-white rounded-3xl shadow-xl p-7 space-y-4">
        <img src="/brand/apps360-logo.svg" alt="apps360.fr" className="h-8 w-auto" />
        <h1 className="font-outfit text-xl font-extrabold text-brand-navy">Backoffice</h1>
        <p className="text-sm text-gray-500">Mot de passe super-admin (le même que Jukebox, Clic-Clac, Ami Invisible et Nuage de mots).</p>
        <PasswordInput autoFocus value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Mot de passe"
          className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-brand-orange outline-none" />
        {err && <p className="text-red-600 text-sm">{err}</p>}
        <button disabled={busy || !pw} className="w-full bg-brand-navy text-white font-bold py-3 rounded-full disabled:opacity-50">Se connecter</button>
      </form>
    </div>
  );
}
