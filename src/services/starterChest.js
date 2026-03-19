/*
 * starterChest.js — Supabase service for granting and tracking starter chests.
 * A starter chest contains 45 Common cards (0.07% Rare per slot).
 */
import { supabase } from './supabase';
import { addCardsToCollection } from './collection';
import { generateStarterDeck } from '../game/data/cardLibrary';

/**
 * Check if the user has already received their starter chest.
 * Uses the `starter_claimed` boolean on the profiles table.
 */
export async function hasClaimedStarter(userId) {
  if (!supabase || !userId) return true; // Default to "already claimed"
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
 * Grant the starter chest: generate 45 cards and add to collection.
 * Marks starter_claimed = true on the profile.
 * @returns {Array} cards added (array of { catalogId, quantity })
 */
export async function claimStarterChest(userId) {
  if (!supabase || !userId) return [];

  // Double-check they haven't already claimed
  const alreadyClaimed = await hasClaimedStarter(userId);
  if (alreadyClaimed) return [];

  // Generate the starter deck
  const starterCards = generateStarterDeck();

  // Add cards to collection
  await addCardsToCollection(userId, starterCards);

  // Mark as claimed
  await supabase
    .from('profiles')
    .update({ starter_claimed: true, updated_at: new Date().toISOString() })
    .eq('id', userId);

  return starterCards;
}
