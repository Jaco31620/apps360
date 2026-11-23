"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
const AuthContext = createContext({});
function getAnonId() {
  if (typeof window === "undefined") return null;
  let id = localStorage.getItem("apps360_uid");
  if (!id) { id = crypto.randomUUID(); localStorage.setItem("apps360_uid", id); }
  return id;
}
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    // getSession est plus rapide et plus robuste que getUser
    supabase.auth.getSession()
      .then(({ data }) => {
        setUser(data.session?.user || null);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Auth init error:", err);
        setUser(null);
        setLoading(false);
      });
    // (l'ancienne recopie des tirages « anonymes » vers le compte est retirée :
    // Ami Invisible exige un compte et ses tables ne sont lues que côté serveur)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const newUser = session?.user || null;
      setUser(newUser);
      setLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);
  // userId = id authentifié si connecté, sinon id local
  const userId = user?.id || getAnonId();
  const signIn = async (email, next = "/") => {
    const callback = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: callback },
    });
    if (error) throw error;
  };
  const signOut = async () => {
    await supabase.auth.signOut();
  };
  return (
    <AuthContext.Provider value={{ user, userId, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
export const useAuth = () => useContext(AuthContext);
