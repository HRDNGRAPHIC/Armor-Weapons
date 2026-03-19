/*
 * decks.js — Supabase service for user_decks table.
 * Manages saved deck loadouts with full persistence.
 */
import { supabase } from './supabase';

/**
 * Fetch all decks for a user.
 * Returns array of { id, user_id, name, knights, cards, created_at, updated_at }
 * knights and cards are JSON arrays of catalogIds.
 */
export async function getUserDecks(userId) {
  if (!supabase || !userId) return [];
  const { data, error } = await supabase
    .from('user_decks')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('getUserDecks error:', error);
    return [];
  }
  return data ?? [];
}

/**
 * Save a new deck or update an existing one.
 * @param {string} userId
 * @param {Object} deck - { id?, name, knights: string[], cards: string[] }
 * @returns saved deck row or null
 */
export async function saveDeck(userId, deck) {
  if (!supabase || !userId) return null;

  const payload = {
    user_id: userId,
    name: deck.name || 'Mazzo Senza Nome',
    knights: deck.knights, // array of catalogIds
    cards: deck.cards,     // array of catalogIds (can have duplicates)
    updated_at: new Date().toISOString(),
  };

  if (deck.id) {
    // Update existing
    const { data, error } = await supabase
      .from('user_decks')
      .update(payload)
      .eq('id', deck.id)
      .eq('user_id', userId) // Security: ensure user owns the deck
      .select()
      .single();

    if (error) {
      console.error('saveDeck update error:', error);
      return null;
    }
    return data;
  } else {
    // Insert new
    payload.created_at = new Date().toISOString();
    const { data, error } = await supabase
      .from('user_decks')
      .insert(payload)
      .select()
      .single();

    if (error) {
      console.error('saveDeck insert error:', error);
      return null;
    }
    return data;
  }
}

/**
 * Delete a deck.
 */
export async function deleteDeck(userId, deckId) {
  if (!supabase || !userId) return false;
  const { error } = await supabase
    .from('user_decks')
    .delete()
    .eq('id', deckId)
    .eq('user_id', userId);

  if (error) {
    console.error('deleteDeck error:', error);
    return false;
  }
  return true;
}

/**
 * Count how many times each catalogId is used across all user's saved decks.
 * Returns map: catalogId → total count across all decks.
 */
export async function getCardsInUse(userId) {
  const decks = await getUserDecks(userId);
  const usage = {};
  decks.forEach(deck => {
    [...(deck.knights || []), ...(deck.cards || [])].forEach(cid => {
      usage[cid] = (usage[cid] || 0) + 1;
    });
  });
  return usage;
}
