import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { getProfile, upsertProfile } from '../services/profiles';

const AuthContext = createContext({
  user: null,
  session: null,
  profile: null,
  loading: false,
  refreshProfile: () => {},
});

/**
 * Garantisce che il profilo esista nel DB al primo login.
 * Se il trigger DB non ha ancora creato la riga, la crea qui.
 */
async function ensureProfile(u) {
  if (!u) return null;
  let p = await getProfile(u.id);
  if (!p) {
    // Il trigger potrebbe non aver ancora scritto — upsert manuale
    const meta = u.user_metadata ?? {};
    p = await upsertProfile(u.id, {
      username: meta.full_name || meta.name || null,
      avatar_url: meta.avatar_url || null,
    });
  }
  return p;
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  // Se Supabase non è configurato, loading rimane false
  const [loading, setLoading] = useState(!!supabase);

  const loadProfile = useCallback(async (u) => {
    if (!u) { setProfile(null); return; }
    const p = await ensureProfile(u);
    if (!p) {
      // Profilo non trovato e upsert fallito → sessione fantasma
      console.warn('[Auth] Profilo non trovato — sign out forzato');
      await supabase.auth.signOut();
      setSession(null);
      setUser(null);
      setProfile(null);
      return;
    }
    setProfile(p);
  }, []);

  // Esposta per forzare ricarica del profilo (es. dopo pagamento)
  const refreshProfile = useCallback(() => {
    if (user) loadProfile(user);
  }, [user, loadProfile]);

  useEffect(() => {
    if (!supabase) return;

    // Recupera sessione iniziale
    supabase.auth.getSession().then(async ({ data: { session: s } }) => {
      // Se c'è una sessione in cache, validala SEMPRE contro il server.
      // getSession() legge solo il localStorage — non verifica che l'utente
      // esista ancora su Supabase. getUser() fa una chiamata al server
      // e fallisce se l'account è stato eliminato o il token revocato.
      if (s) {
        const { error: userError } = await supabase.auth.getUser();
        if (userError) {
          console.warn('[Auth] Token non valido lato server — sign out forzato:', userError.message);
          await supabase.auth.signOut();
          setSession(null);
          setUser(null);
          setProfile(null);
          setLoading(false);
          return;
        }
      }

      setSession(s);
      const u = s?.user ?? null;
      setUser(u);
      await loadProfile(u);
      setLoading(false);
    });

    // Ascolta cambi di auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, s) => {
        setSession(s);
        const u = s?.user ?? null;
        setUser(u);
        await loadProfile(u);
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, [loadProfile]);

  return (
    <AuthContext.Provider value={{ user, session, profile, loading, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
