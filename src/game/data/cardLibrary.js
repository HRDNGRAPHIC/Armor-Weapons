/*
 * cardLibrary.js — Libreria carte estesa con ID univoci e connessioni di lore.
 * Incapsula cardCatalog.js e aggiunge: i campi relatedTo, lore, set.
 * Usata per future espansioni narrative e visualizzazioni della collezione.
 */
import { CARD_CATALOG, RARITIES, getCardById, getCardsByType } from './cardCatalog';

// Ri-esporta tutto da cardCatalog per comodità
export { RARITIES, getCardById, getCardsByType, CARD_CATALOG };

/*
 * Mappa relatedTo: catalogId → array di catalogId correlati.
 * Collega le carte minori al loro «ancora» leggendario per future espansioni narrative.
 *
 * Esempio: Sardeth il Re Nero (K012) è connesso a diverse carte
 * della sua storia.
 */
const RELATIONS = {
  // Corte di Sardeth il Re Nero
  'K012': ['K014', 'W025', 'S035', 'I046'],  // Sardeth → Mortharion, Spadone di Sangue, Egida del Re Morto, Sottrai
  'K014': ['K012', 'I045'],                    // Mortharion Spettrale → Sardeth, Sacrificio
  'K013': ['W026', 'W024'],                    // Velkan il Distruttore → Spadone di Sangue, Lama Oscura

  // Banda di Ragnar
  'K010': ['W022', 'W023', 'I040'],            // Ragnar Lugubre → Flagello di Catene, Falce Animica, Sabbia
  'K008': ['S033', 'I042'],                    // Vornik il Brutale → Egida Oscura, Veleno Berserker

  // Ombra di Azrael
  'K006': ['I043', 'T054'],                    // Azrael il Silente → Lacrima di Angelo, Riflesso Oscuro
  'K011': ['I044', 'S034'],                    // Kaelen il Dannato → Sangue al Nemico, Barriera dell'Abisso
};

/**
 * Libreria carte completa — ogni carta arricchita con array relatedTo.
 * Ogni oggetto carta ha:
 *   - Tutti i campi da CARD_CATALOG
 *   - relatedTo: string[] — catalogId delle carte legate dalla lore
 *   - set: string — nome dell'espansione
 */
export const CARD_LIBRARY = CARD_CATALOG.map(card => ({
  ...card,
  relatedTo: RELATIONS[card.catalogId] ?? [],
  set: 'base',
}));

/**
 * Ottieni la carta completa dalla libreria tramite catalogId (con relazioni).
 */
export function getLibraryCard(catalogId) {
  return CARD_LIBRARY.find(c => c.catalogId === catalogId) ?? null;
}

/**
 * Ottieni tutte le carte correlate a una data carta.
 */
export function getRelatedCards(catalogId) {
  const card = getLibraryCard(catalogId);
  if (!card || card.relatedTo.length === 0) return [];
  return card.relatedTo.map(id => getLibraryCard(id)).filter(Boolean);
}

/**
 * Genera un Mazzo Iniziale: esattamente 5 cavalieri + 45 equipaggiamento = 50 carte.
 * Rispecchia la composizione del motore di gioco: 15 armi, 15 scudi, 10 oggetti, 5 terreni.
 * Usa le carte di rarità comune dal catalogo, distribuendo le copie uniformemente.
 * Restituisce un array di { catalogId, quantity } per addCardsToCollection.
 */
export function generateStarterDeck() {
  const counts = {};
  const add = (id) => { counts[id] = (counts[id] ?? 0) + 1; };

  // 5 cavalieri — usa i 4 comuni (K000-K003) + 1 duplicato
  const commonKnights = CARD_CATALOG.filter(c => c.type === 'knight' && c.rarity?.id === 'comune');
  for (let i = 0; i < 5; i++) {
    add(commonKnights[i % commonKnights.length].catalogId);
  }

  // 15 armi — distribuisce uniformemente tra le armi comuni
  const commonWeapons = CARD_CATALOG.filter(c => c.type === 'weapon' && c.rarity?.id === 'comune');
  for (let i = 0; i < 15; i++) {
    add(commonWeapons[i % commonWeapons.length].catalogId);
  }

  // 15 scudi — distribuisce uniformemente tra gli scudi comuni
  const commonShields = CARD_CATALOG.filter(c => c.type === 'shield' && c.rarity?.id === 'comune');
  for (let i = 0; i < 15; i++) {
    add(commonShields[i % commonShields.length].catalogId);
  }

  // 10 oggetti — uno per ogni oggetto base (i primi 10 con itemId univoci da gameData)
  const seenItemIds = new Set();
  const baseItems = CARD_CATALOG.filter(c => {
    if (c.type !== 'item') return false;
    if (seenItemIds.has(c.itemId)) return false;
    seenItemIds.add(c.itemId);
    return true;
  });
  for (const item of baseItems.slice(0, 10)) {
    add(item.catalogId);
  }

  // 5 terreni — uno per ogni terreno base (primi 5 con terrainId univoci da gameData)
  const seenTerrainIds = new Set();
  const baseTerrains = CARD_CATALOG.filter(c => {
    if (c.type !== 'terrain') return false;
    if (seenTerrainIds.has(c.terrainId)) return false;
    seenTerrainIds.add(c.terrainId);
    return true;
  });
  for (const terrain of baseTerrains.slice(0, 5)) {
    add(terrain.catalogId);
  }

  return Object.entries(counts).map(([catalogId, quantity]) => ({
    catalogId,
    quantity,
  }));
}
