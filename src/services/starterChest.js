/*
 * starterChest.js — Servizio Supabase per la concessione e il tracciamento dei forzieri iniziali.
 * Un forziere iniziale contiene 45 carte Comuni (0.07% Rare per slot).
 */
import { supabase } from './supabase';
import { addCardsToCollection } from './collection';
import { generateStarterDeck } from '../game/data/cardLibrary';

/**
 * Controlla se l'utente ha già ricevuto il suo forziere iniziale.
 * Usa il booleano `starter_claimed` sulla tabella profiles.
 */
export async function hasClaimedStarter(userId) {
  if (!supabase || !userId) return true; // Per default "già riscattato"
  const { data, error } = await supabase
    .from('profiles')
    .select('starter_claimed')
    .eq('id', userId)
    .single();

  if (error) {
    console.error('hasClaimedStarter error:', error);
    return true;
  }
  return data?.starter_claimed ?? false;
}

/**
 * Concedi il forziere iniziale: genera 45 carte e aggiungile alla collezione.
 * Imposta starter_claimed = true sul profilo.
 * @returns {Array} carte aggiunte (array di { catalogId, quantity })
 */
export async function claimStarterChest(userId) {
  if (!supabase || !userId) return [];

  // Doppio controllo che non abbiano già riscattato
  const alreadyClaimed = await hasClaimedStarter(userId);
  if (alreadyClaimed) return [];

  // Genera il mazzo iniziale
  const starterCards = generateStarterDeck();

  // Aggiungi carte alla collezione
  await addCardsToCollection(userId, starterCards);

  // Segna come riscattato
  await supabase
    .from('profiles')
    .update({ starter_claimed: true, updated_at: new Date().toISOString() })
    .eq('id', userId);

  return starterCards;
}
