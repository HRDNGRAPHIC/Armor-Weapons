/*
 * decks.js — Servizio Supabase per la tabella user_decks.
 * Gestisce i mazzi salvati con persistenza completa.
 */
import { supabase } from './supabase';

/**
 * Ottieni tutti i mazzi di un utente.
 * Restituisce array di { id, user_id, name, knights, cards, created_at, updated_at }
 * knights e cards sono array JSON di catalogId.
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
 * Salva un nuovo mazzo o aggiorna uno esistente.
 * @param {string} userId
 * @param {Object} deck - { id?, name, knights: string[], cards: string[] }
 * @returns riga del mazzo salvato o null
 */
export async function saveDeck(userId, deck) {
  if (!supabase || !userId) return null;

  const payload = {
    user_id: userId,
    name: deck.name || 'Mazzo Senza Nome',
    knights: deck.knights, // array di catalogId
    cards: deck.cards,     // array di catalogId (può avere duplicati)
    updated_at: new Date().toISOString(),
  };

  if (deck.id) {
    // Aggiorna esistente
    const { data, error } = await supabase
      .from('user_decks')
      .update(payload)
      .eq('id', deck.id)
      .eq('user_id', userId) // Sicurezza: verifica che il mazzo appartenga all'utente
      .select()
      .single();

    if (error) {
      console.error('saveDeck update error:', error);
      return null;
    }
    return data;
  } else {
    // Inserisci nuovo
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
 * Elimina un mazzo.
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
 * Conta quante volte ogni catalogId è usato in tutti i mazzi salvati dell'utente.
 * Restituisce mappa: catalogId → conteggio totale su tutti i mazzi.
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
