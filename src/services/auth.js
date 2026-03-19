import { supabase } from './supabase';

function requireSupabase() {
  if (!supabase) throw new Error('Supabase non configurato. Aggiungi le credenziali nel file .env');
}

/** Login tramite Google OAuth */
export async function signInWithGoogle() {
  requireSupabase();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      // Dopo Google OAuth, Supabase torna qui.
      // La app legge il profilo e decide se mandare a /onboarding o /lobby.
      redirectTo: `${window.location.origin}/character-creation`,
    },
  });
  if (error) throw error;
  return data;
}

/** Logout */
export async function signOut() {
  requireSupabase();
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

/** Restituisce la sessione corrente */
export async function getSession() {
  requireSupabase();
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

/** Restituisce l'utente corrente */
export async function getUser() {
  requireSupabase();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) throw error;
  return user;
}
