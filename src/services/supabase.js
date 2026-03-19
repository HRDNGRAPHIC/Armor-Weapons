import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/** Verifica che sia un URL http/https valido e non un placeholder */
function isValidHttpUrl(str) {
  try {
    const url = new URL(str);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

const configured =
  supabaseUrl &&
  supabaseAnonKey &&
  isValidHttpUrl(supabaseUrl) &&
  !supabaseAnonKey.startsWith('your_');

if (!configured) {
  console.warn(
    '[Armor & Weapons] Variabili VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY mancanti o non valide.\n' +
    'Controlla il file .env nella root del progetto.\n' +
    `URL ricevuto: "${supabaseUrl}" — chiave presente: ${!!supabaseAnonKey}`
  );
}

// null se le env vars mancano — gestito da AuthContext
export const supabase = configured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;
