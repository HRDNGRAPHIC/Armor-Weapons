/*
 * collection.js — Supabase service for user_collection table.
 * Manages owned cards (populated by pack openings).
 */
import { supabase } from './supabase';

/**
 * Fetch all cards owned by a user.
 * Returns array of { id, user_id, catalog_id, quantity, obtained_at }
 */
export async function getUserCollection(userId) {
  if (!supabase || !userId) return [];
  const { data, error } = await supabase
    .from('user_collection')
    .select('*')
    .eq('user_id', userId)
    .order('obtained_at', { ascending: false });

  if (error) {
    console.error('getUserCollection error:', error);
    return [];
  }
  return data ?? [];
}

/**
 * Add cards to user collection (after pack opening).
 * If card already exists, increments quantity.
 * @param {string} userId
 * @param {Array<{catalogId: string, quantity?: number}>} cards
 */
export async function addCardsToCollection(userId, cards) {
  if (!supabase || !userId || !cards?.length) return [];

  // Fetch existing collection to merge quantities
  const existing = await getUserCollection(userId);
  const existingMap = new Map(existing.map(e => [e.catalog_id, e]));

  const upserts = cards.map(c => {
    const prev = existingMap.get(c.catalogId);
    return {
      user_id: userId,
      catalog_id: c.catalogId,
      quantity: (prev?.quantity ?? 0) + (c.quantity ?? 1),
      obtained_at: prev?.obtained_at ?? new Date().toISOString(),
    };
  });

  const { data, error } = await supabase
    .from('user_collection')
    .upsert(upserts, { onConflict: 'user_id,catalog_id' })
    .select();

  if (error) {
    console.error('addCardsToCollection error:', error);
    return [];
  }
  return data ?? [];
}

/**
 * Get a map of catalogId → quantity for quick lookups.
 */
export async function getCollectionMap(userId) {
  const collection = await getUserCollection(userId);
  const map = {};
  collection.forEach(row => {
    map[row.catalog_id] = row.quantity;
  });
  return map;
}
