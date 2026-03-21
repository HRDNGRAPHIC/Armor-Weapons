/*
 * cardLibrary.js — Extended card library with unique IDs and lore connections.
 * Wraps cardCatalog.js and adds: relatedTo, lore, set fields.
 * Used for future story expansions and collection displays.
 */
import { CARD_CATALOG, RARITIES, getCardById, getCardsByType } from './cardCatalog';

// Re-export everything from cardCatalog for convenience
export { RARITIES, getCardById, getCardsByType, CARD_CATALOG };

/*
 * relatedTo map: catalogId → array of related catalogIds.
 * Links minor cards to their legendary "anchor" for future story expansions.
 *
 * Example: Sardeth il Re Nero (K012) is connected to several cards
 * in his storyline.
 */
const RELATIONS = {
  // Sardeth il Re Nero's court
  'K012': ['K014', 'W025', 'S035', 'I046'],  // Sardeth → Mortharion, Spadone di Sangue, Egida del Re Morto, Sottrai
  'K014': ['K012', 'I045'],                    // Mortharion Spettrale → Sardeth, Sacrificio
  'K013': ['W026', 'W024'],                    // Velkan il Distruttore → Spadone di Sangue, Lama Oscura

  // Ragnar's warband
  'K010': ['W022', 'W023', 'I040'],            // Ragnar Lugubre → Flagello di Catene, Falce Animica, Sabbia
  'K008': ['S033', 'I042'],                    // Vornik il Brutale → Egida Oscura, Veleno Berserker

  // Azrael's shadow
  'K006': ['I043', 'T054'],                    // Azrael il Silente → Lacrima di Angelo, Riflesso Oscuro
  'K011': ['I044', 'S034'],                    // Kaelen il Dannato → Sangue al Nemico, Barriera dell'Abisso
};

/**
 * Full card library — each card enriched with relatedTo array.
 * Every card object has:
 *   - All fields from CARD_CATALOG
 *   - relatedTo: string[] — catalogIds of lore-linked cards
 *   - set: string — expansion set name
 */
export const CARD_LIBRARY = CARD_CATALOG.map(card => ({
  ...card,
  relatedTo: RELATIONS[card.catalogId] ?? [],
  set: 'base',
}));

/**
 * Get full library card by catalogId (with relations).
 */
export function getLibraryCard(catalogId) {
  return CARD_LIBRARY.find(c => c.catalogId === catalogId) ?? null;
}

/**
 * Get all cards related to a given card.
 */
export function getRelatedCards(catalogId) {
  const card = getLibraryCard(catalogId);
  if (!card || card.relatedTo.length === 0) return [];
  return card.relatedTo.map(id => getLibraryCard(id)).filter(Boolean);
}

/**
 * Generate a Starter Deck: exactly 5 knights + 45 equipment = 50 cards.
 * Mirrors the game engine composition: 15 weapons, 15 shields, 10 items, 5 terrains.
 * Uses common-rarity cards from the catalog, distributing copies evenly.
 * Returns array of { catalogId, quantity } for addCardsToCollection.
 */
export function generateStarterDeck() {
  const counts = {};
  const add = (id) => { counts[id] = (counts[id] ?? 0) + 1; };

  // 5 knights — use the 4 comuni (K000-K003) + 1 duplicate
  const commonKnights = CARD_CATALOG.filter(c => c.type === 'knight' && c.rarity?.id === 'comune');
  for (let i = 0; i < 5; i++) {
    add(commonKnights[i % commonKnights.length].catalogId);
  }

  // 15 weapons — distribute evenly across common weapons
  const commonWeapons = CARD_CATALOG.filter(c => c.type === 'weapon' && c.rarity?.id === 'comune');
  for (let i = 0; i < 15; i++) {
    add(commonWeapons[i % commonWeapons.length].catalogId);
  }

  // 15 shields — distribute evenly across common shields
  const commonShields = CARD_CATALOG.filter(c => c.type === 'shield' && c.rarity?.id === 'comune');
  for (let i = 0; i < 15; i++) {
    add(commonShields[i % commonShields.length].catalogId);
  }

  // 10 items — one of each base item (first 10 with unique itemIds from gameData)
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

  // 5 terrains — one of each base terrain (first 5 with unique terrainIds from gameData)
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
