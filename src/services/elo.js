/*
 * elo.js — Servizio classifica ELO + economia oro.
 * Usa la tabella profiles su Supabase.
 */
import { supabase } from './supabase';

const K_FACTOR = 20;
const DEFAULT_ELO = 100;
export const GOLD_PER_WIN = 5;

// L'ELO dell'IA varia per "difficoltà" — per ora un valore fisso
const AI_ELO = 100;

/**
 * Calcola il punteggio atteso (stile Chess.com).
 * @param {number} playerElo
 * @param {number} opponentElo
 * @returns {number} punteggio atteso 0-1
 */
function expectedScore(playerElo, opponentElo) {
  return 1 / (1 + Math.pow(10, (opponentElo - playerElo) / 400));
}

/**
 * Calcola il nuovo ELO dopo una partita.
 * @param {number} currentElo
 * @param {number} opponentElo
 * @param {number} result — 1 = vittoria, 0 = sconfitta, 0.5 = pareggio
 * @returns {number} nuovo ELO (minimo 0, variazione limitata ±10)
 */
export function calculateNewElo(currentElo, opponentElo, result) {
  const expected = expectedScore(currentElo, opponentElo);
  let delta = Math.round(K_FACTOR * (result - expected));
  // Limita la variazione a ±10
  delta = Math.max(-10, Math.min(10, delta));
  return Math.max(0, currentElo + delta);
}

// Delta ELO statici per PvE
const PVE_WIN_DELTA = 3;
const PVE_LOSS_DELTA = -5;

/**
 * Registra il risultato di una partita: aggiorna ELO, vittorie/sconfitte, oro.
 * @param {string} userId
 * @param {'win'|'loss'|'draw'|'abandon'} outcome
 * @param {'pve'|'pvp'} mode — modalità di gioco
 * @returns {Object|null} riga del profilo aggiornata
 */
export async function recordGameResult(userId, outcome, mode = 'pve') {
  if (!supabase || !userId) return null;

  // Carica il profilo corrente
  const { data: profile, error: fetchErr } = await supabase
    .from('profiles')
    .select('elo, wins, losses')
    .eq('id', userId)
    .single();

  if (fetchErr || !profile) {
    console.error('recordGameResult fetch error:', fetchErr);
    return null;
  }

  const currentElo = profile.elo ?? DEFAULT_ELO;
  const currentWins = profile.wins ?? 0;
  const currentLosses = profile.losses ?? 0;

  let result;
  if (outcome === 'win') result = 1;
  else if (outcome === 'draw') result = 0.5;
  else result = 0; // sconfitta o abbandono

  let newElo;
  if (mode === 'pve') {
    // PvE: delta statico (+3 vittoria, -5 sconfitta/abbandono, 0 pareggio)
    const delta = outcome === 'win' ? PVE_WIN_DELTA
      : (outcome === 'loss' || outcome === 'abandon') ? PVE_LOSS_DELTA
      : 0;
    newElo = Math.max(0, currentElo + delta);
  } else {
    // PvP: formula Chess.com
    newElo = calculateNewElo(currentElo, AI_ELO, result);
  }
  const updates = {
    elo: newElo,
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
