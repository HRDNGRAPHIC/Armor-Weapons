/*
 * collection.js — Servizio Supabase per la tabella user_collection.
 * Gestisce le carte possedute (popolate dalle aperture di pacchetti).
 */
import { supabase } from './supabase';

/**
 * Ottieni tutte le carte possedute da un utente.
 * Restituisce array di { id, user_id, catalog_id, quantity, obtained_at }
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
 * Aggiungi carte alla collezione dell'utente (dopo l'apertura di un pacchetto).
 * Se la carta esiste già, incrementa la quantità.
 * @param {string} userId
 * @param {Array<{catalogId: string, quantity?: number}>} cards
 */
export async function addCardsToCollection(userId, cards) {
  if (!supabase || !userId || !cards?.length) return [];

  // Carica la collezione esistente per unire le quantità
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
 * Ottieni una mappa catalogId → quantità per ricerche veloci.
 */
export async function getCollectionMap(userId) {
  const collection = await getUserCollection(userId);
  const map = {};
  collection.forEach(row => {
    map[row.catalog_id] = row.quantity;
  });
  return map;
}

/**
 * Ottieni l'insieme di catalogId che sono "nuovi" (is_new = true).
 * Restituisce Set<string>.
 */
export async function getNewCards(userId) {
  if (!supabase || !userId) return new Set();
  const { data, error } = await supabase
    .from('user_collection')
    .select('catalog_id')
    .eq('user_id', userId)
    .eq('is_new', true);
  if (error) {
    console.error('getNewCards error:', error);
    return new Set();
  }
  return new Set((data ?? []).map(r => r.catalog_id));
}

/**
 * Segna una carta come vista (is_new = false).
 */
export async function markCardSeen(userId, catalogId) {
  if (!supabase || !userId) return;
  await supabase
    .from('user_collection')
    .update({ is_new: false })
    .eq('user_id', userId)
    .eq('catalog_id', catalogId);
}
