/*
 * elo.js — ELO ranking + gold economy service.
 * Uses the profiles table on Supabase.
 */
import { supabase } from './supabase';

const K_FACTOR = 20;
const DEFAULT_ELO = 100;
const GOLD_PER_WIN = 5;

// AI ELO varies by "difficulty" — for now a fixed value
const AI_ELO = 100;

/**
 * Calculate expected score (Chess.com style).
 * @param {number} playerElo
 * @param {number} opponentElo
 * @returns {number} expected score 0-1
 */
function expectedScore(playerElo, opponentElo) {
  return 1 / (1 + Math.pow(10, (opponentElo - playerElo) / 400));
}

/**
 * Calculate new ELO after a game.
 * @param {number} currentElo
 * @param {number} opponentElo
 * @param {number} result — 1 = win, 0 = loss, 0.5 = draw
 * @returns {number} new ELO (clamped to min 0, change capped ±10)
 */
export function calculateNewElo(currentElo, opponentElo, result) {
  const expected = expectedScore(currentElo, opponentElo);
  let delta = Math.round(K_FACTOR * (result - expected));
  // Cap variation to ±10
  delta = Math.max(-10, Math.min(10, delta));
  return Math.max(0, currentElo + delta);
}

/**
 * Record a game result: update ELO, wins/losses, gold.
 * @param {string} userId
 * @param {'win'|'loss'|'draw'|'abandon'} outcome
 * @returns {Object|null} updated profile row
 */
export async function recordGameResult(userId, outcome) {
  if (!supabase || !userId) return null;

  // Fetch current profile
  const { data: profile, error: fetchErr } = await supabase
    .from('profiles')
    .select('elo, gold, wins, losses')
    .eq('id', userId)
    .single();

  if (fetchErr || !profile) {
    console.error('recordGameResult fetch error:', fetchErr);
    return null;
  }

  const currentElo = profile.elo ?? DEFAULT_ELO;
  const currentGold = profile.gold ?? 0;
  const currentWins = profile.wins ?? 0;
  const currentLosses = profile.losses ?? 0;

  let result;
  if (outcome === 'win') result = 1;
  else if (outcome === 'draw') result = 0.5;
  else result = 0; // loss or abandon

  const newElo = calculateNewElo(currentElo, AI_ELO, result);
  const goldEarned = outcome === 'win' ? GOLD_PER_WIN : 0;

  const updates = {
    elo: newElo,
    gold: currentGold + goldEarned,
    wins: outcome === 'win' ? currentWins + 1 : currentWins,
    losses: (outcome === 'loss' || outcome === 'abandon') ? currentLosses + 1 : currentLosses,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select()
    .single();

  if (error) {
    console.error('recordGameResult update error:', error);
    return null;
  }
  return data;
}

/**
 * Fetch top 50 players by ELO for leaderboard.
 */
export async function getLeaderboard(limit = 50) {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, avatar_url, elo, wins, losses, level')
    .order('elo', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('getLeaderboard error:', error);
    return [];
  }
  return data ?? [];
}
