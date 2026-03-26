/*
 * packs.js — Servizio Supabase per la tabella user_packs.
 * Gestisce i pacchetti in sospeso/riscattabili.
 */
import { supabase } from './supabase';

/**
 * Ottieni i pacchetti in sospeso (non riscattati) di un utente.
 */
export async function getPendingPacks(userId) {
  if (!supabase || !userId) return [];
  const { data, error } = await supabase
    .from('user_packs')
    .select('*')
    .eq('user_id', userId)
    .eq('redeemed', false)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('getPendingPacks error:', error);
    return [];
  }
  return data ?? [];
}

/**
 * Segna un pacchetto come riscattato.
 */
export async function redeemPack(userId, packId) {
  if (!supabase || !userId) return null;
  const { data, error } = await supabase
    .from('user_packs')
    .update({ redeemed: true, redeemed_at: new Date().toISOString() })
    .eq('id', packId)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) {
    console.error('redeemPack error:', error);
    return null;
  }
  return data;
}

/**
 * Conta i pacchetti non riscattati per il badge di notifica.
 */
export async function countPendingPacks(userId) {
  if (!supabase || !userId) return 0;
  const { count, error } = await supabase
    .from('user_packs')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('redeemed', false);

  if (error) {
    console.error('countPendingPacks error:', error);
    return 0;
  }
  return count ?? 0;
}
