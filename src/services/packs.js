/*
 * packs.js — Supabase service for user_packs table.
 * Manages pending/redeemable packs.
 */
import { supabase } from './supabase';

/**
 * Fetch pending (unredeemed) packs for a user.
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
 * Mark a pack as redeemed.
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
 * Count unredeemed packs for notification badge.
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
