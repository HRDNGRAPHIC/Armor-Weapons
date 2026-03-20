import { supabase } from './supabase';

/**
 * Carica il profilo di un utente.
 * Ritorna null se non esiste ancora (primo accesso prima del trigger).
 */
export async function getProfile(userId) {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('getProfile error:', error);
    return null;
  }
  return data ?? null;
}

/**
 * Aggiorna (o inserisce) i dati del profilo.
 * Usato ad esempio per salvare il subscription_tier dopo il pagamento.
 */
export async function upsertProfile(userId, updates) {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('profiles')
    .upsert({ id: userId, ...updates, updated_at: new Date().toISOString() })
    .select()
    .single();

  if (error) {
    console.error('upsertProfile error:', error);
    return null;
  }
  return data;
}
