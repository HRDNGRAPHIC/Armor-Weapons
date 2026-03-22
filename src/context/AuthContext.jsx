import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../services/supabase';
import { getProfile, upsertProfile } from '../services/profiles';

const AuthContext = createContext({
  user: null,
  session: null,
  profile: null,
  gold: 0,
  loading: false,
  profileLoading: false,
  refreshProfile: () => {},
  updateUserGold: async () => {},
});

/**
 * Garantisce che il profilo esista nel DB al primo login.
 * Retries up to 3 times with exponential backoff per gestire la race condition col trigger.
 */
async function ensureProfile(u) {
  if (!u) return null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      let p = await getProfile(u.id);
      if (p) return p;

      if (attempt === 0) {
        const meta = u.user_metadata ?? {};
        p = await upsertProfile(u.id, {
          username: meta.full_name || meta.name || null,
          avatar_url: meta.avatar_url || null,
        });
        if (p) return p;
      }
    } catch (err) {
      console.warn(`[Auth] ensureProfile attempt ${attempt + 1} failed:`, err.message);
    }
    // Exponential backoff: 500ms → 1500ms → 4500ms
    await new Promise(r => setTimeout(r, 500 * Math.pow(3, attempt)));
  }
  return null;
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [gold, setGold] = useState(0);
  const [loading, setLoading] = useState(!!supabase);
  const [profileLoading, setProfileLoading] = useState(false);

  // Guard: prevent signOut → onAuthStateChange → loadProfile infinite loop
  const signingOutRef = useRef(false);
  const goldRef = useRef(0);

  const loadProfile = useCallback(async (u) => {
    if (!u) { setProfile(null); setGold(0); goldRef.current = 0; setProfileLoading(false); return; }
    setProfileLoading(true);
    try {
      const p = await ensureProfile(u);
      if (!p) {
        if (!signingOutRef.current) {
          signingOutRef.current = true;
          console.warn('[Auth] Profilo non trovato — sign out forzato');
          await supabase.auth.signOut();
          setSession(null);
          setUser(null);
          setProfile(null);
          setGold(0);
          goldRef.current = 0;
          signingOutRef.current = false;
        }
        return;
      }
      setProfile(p);
      setGold(p.gold ?? 0);
      goldRef.current = p.gold ?? 0;
    } catch (err) {
      console.error('[Auth] loadProfile error:', err);
      setProfile(null);
    } finally {
      setProfileLoading(false);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user) await loadProfile(user);
  }, [user, loadProfile]);

  // Realtime subscription for profile changes (gold, elo, wins, etc.)
  useEffect(() => {
    if (!supabase || !user) return;

    const channel = supabase
      .channel(`profile-changes-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${user.id}`,
        },
        (payload) => {
          const updated = payload.new;
          setProfile(prev => prev ? { ...prev, ...updated } : updated);
          if (updated.gold !== undefined) { setGold(updated.gold); goldRef.current = updated.gold; }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  useEffect(() => {
    if (!supabase) return;

    // Recupera sessione — sblocca il routing appena validata
    supabase.auth.getSession().then(async ({ data: { session: s } }) => {
      try {
        if (s) {
          const { error: userError } = await supabase.auth.getUser();
          if (userError) {
            console.warn('[Auth] Token non valido — sign out forzato:', userError.message);
            await supabase.auth.signOut();
            setSession(null);
            setUser(null);
            setProfile(null);
            return;
          }
        }
        setSession(s);
        const u = s?.user ?? null;
        setUser(u);
        // Profile loads asynchronously — non blocca il routing
        if (u) loadProfile(u);
      } catch (err) {
        console.error('[Auth] Session init error:', err);
      } finally {
        setLoading(false);
      }
    });

    // Ascolta cambi di auth (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, s) => {
        if (signingOutRef.current && !s) return;
        setSession(s);
        const u = s?.user ?? null;
        setUser(u);
        setLoading(false);
        if (u) loadProfile(u);
        else setProfile(null);
      }
    );

    return () => subscription.unsubscribe();
  }, [loadProfile]);

  const updateUserGold = useCallback(async (amountToAdd) => {
    if (!user || !supabase) return;
    const newGold = Math.max(0, goldRef.current + amountToAdd);
    goldRef.current = newGold;
    setGold(newGold);
    setProfile(prev => prev ? { ...prev, gold: newGold } : prev);
    const { error } = await supabase
      .from('profiles')
      .update({ gold: newGold, updated_at: new Date().toISOString() })
      .eq('id', user.id);
    if (error) console.error('[Auth] updateUserGold error:', error);
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, session, profile, gold, loading, profileLoading, refreshProfile, updateUserGold }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
